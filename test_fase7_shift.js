/**
 * COMPUERTA DE VALIDACIÓN TÉCNICA - FASE 7 (Gate 7)
 * Criterio medible:
 * 1. Simulación de un controlador matricial (ej. APC Mini o Launchpad de 64 pads).
 * 2. Carga en StateCache de un mapa de colores diferenciado:
 *    - Capa 0: 64 pads en Color A (ej. Verde, velocity = 15).
 *    - Capa 1: 64 pads en Color B (ej. Rojo, velocity = 120).
 * 3. Configuración de botón Shift en modo Flash y Toggle con soporte MIDI Learn.
 * 4. Medición de tiempo de volcado (flush):
 *    - Al conmutar de Capa 0 a Capa 1, se deben re-emitir exactamente los 64 mensajes de color.
 *    - Tiempo medido en hardware / pipeline DEBE ser inferior a 2 milisegundos (< 2.0 ms).
 * 5. Verificación de precisión y aislamiento: los estados de Capa 0 y Capa 1 no se contaminan.
 */

const assert = require('assert');
const ShiftEngine = require('./src/shift_engine');
const StreamProcessor = require('./src/processor');

async function runGate7Test() {
    console.log('================================================================');
    console.log('   PRUEBA AUTOMATIZADA COMPUERTA FASE 7: MOTOR SHIFT & STATECACHE');
    console.log('================================================================\n');

    const TOTAL_PADS = 64;

    // --- TEST 1: VERIFICACIÓN DEL MOTOR SHIFT AISLADO ---
    console.log('--- TEST 1: Inicializando ShiftEngine y poblando StateCache (64 pads por capa) ---');
    const engine = new ShiftEngine({ maxLayers: 2, mode: 'flash' });

    // Configurar botón Shift manual: Nota 99 en Canal 1
    engine.setShiftBinding({ type: 'note', channel: 1, index: 99 });

    // Llenar Capa 0 (Verde, vel=15) y Capa 1 (Rojo, vel=120)
    for (let pad = 0; pad < TOTAL_PADS; pad++) {
        engine.cacheState(0, { type: 'note', channel: 1, index: pad, value: 15 });
        engine.cacheState(1, { type: 'note', channel: 1, index: pad, value: 120 });
    }

    assert.strictEqual(engine.getLayerCache(0).size, TOTAL_PADS, 'Capa 0 debe tener exactamente 64 estados.');
    assert.strictEqual(engine.getLayerCache(1).size, TOTAL_PADS, 'Capa 1 debe tener exactamente 64 estados.');
    console.log(`  > Capa 0 y Capa 1 pobladas exitosamente con ${TOTAL_PADS} controles cada una.`);

    // --- TEST 2: MEDIDAS DE TIEMPO EN CONMUTACIÓN Y VOLCADO (BURST) ---
    console.log('\n--- TEST 2: Conmutación de capa y medición de latencia de volcado (< 2.0 ms) ---');
    let emittedItems = [];
    engine.onHardwareEmit((items) => {
        emittedItems = items;
    });

    const burstMetrics = engine.flushLayer(1);
    console.log(`  > Elementos re-emitidos en ráfaga: ${burstMetrics.count}`);
    console.log(`  > Tiempo de volcado medido:       ${burstMetrics.durationUs.toFixed(2)} µs (${burstMetrics.durationMs.toFixed(3)} ms)`);
    console.log(`  > Límite estricto permitido:       2.000 ms`);

    assert.strictEqual(emittedItems.length, TOTAL_PADS, 'Deben haberse emitido los 64 estados de color.');
    assert.strictEqual(emittedItems[0].value, 120, 'El valor del primer pad debe ser el de Capa 1 (120).');
    assert.ok(burstMetrics.durationMs < 2.0, `El tiempo de volcado (${burstMetrics.durationMs} ms) supera los 2 ms permitidos.`);
    console.log('  > Validación de latencia de volcado: PASS (< 2 ms)');

    // --- TEST 3: COMPORTAMIENTO MODO FLASH (MOMENTÁNEO) ---
    console.log('\n--- TEST 3: Validación de interacción Flash (Presionar -> Capa 1, Soltar -> Capa 0) ---');
    assert.strictEqual(engine.activeLayer, 0, 'Debe iniciar en Capa 0.');

    // Presionar Shift
    const pressResult = engine.processHardwareInput({ event: 'noteon', channel: 1, note: 99, velocity: 127 });
    assert.strictEqual(pressResult.consumed, true, 'El evento de Shift debe ser consumido por el motor.');
    assert.strictEqual(engine.activeLayer, 1, 'Al presionar debe conmutar a Capa 1.');
    assert.strictEqual(emittedItems[0].value, 120, 'Al entrar a Capa 1, se debe enviar el color de Capa 1.');

    // Soltar Shift
    const releaseResult = engine.processHardwareInput({ event: 'noteoff', channel: 1, note: 99, velocity: 0 });
    assert.strictEqual(releaseResult.consumed, true);
    assert.strictEqual(engine.activeLayer, 0, 'Al soltar debe regresar a Capa 0.');
    assert.strictEqual(emittedItems[0].value, 15, 'Al regresar a Capa 0, se debe restaurar el color de Capa 0.');
    console.log('  > Modo Flash verificado correctamente: PASS');

    // --- TEST 4: COMPORTAMIENTO MODO TOGGLE (CONMUTACIÓN FIJA) ---
    console.log('\n--- TEST 4: Validación de interacción Toggle ---');
    engine.setMode('toggle');
    assert.strictEqual(engine.activeLayer, 0);

    // Primera pulsación (NoteOn) -> Conmuta a Capa 1
    engine.processHardwareInput({ event: 'noteon', channel: 1, note: 99, velocity: 127 });
    assert.strictEqual(engine.activeLayer, 1);

    // Liberación (NoteOff) -> Permanece en Capa 1
    engine.processHardwareInput({ event: 'noteoff', channel: 1, note: 99, velocity: 0 });
    assert.strictEqual(engine.activeLayer, 1);

    // Segunda pulsación (NoteOn) -> Conmuta de vuelta a Capa 0
    engine.processHardwareInput({ event: 'noteon', channel: 1, note: 99, velocity: 127 });
    assert.strictEqual(engine.activeLayer, 0);
    console.log('  > Modo Toggle verificado correctamente: PASS');

    // --- TEST 5: MIDI LEARN INTERACTIVO ---
    console.log('\n--- TEST 5: Verificación de MIDI Learn para asignación de Shift ---');
    engine.setMidiLearn(true);
    assert.strictEqual(engine.isLearning, true);

    // Inyectar pulsación de un nuevo control (ej. CC 64 - Pedal Sustain)
    const learnResult = engine.processHardwareInput({ event: 'cc', channel: 1, controller: 64, value: 127 });
    assert.strictEqual(learnResult.consumed, true);
    assert.strictEqual(learnResult.learned, true);
    assert.strictEqual(engine.isLearning, false, 'MIDI Learn debe desactivarse tras capturar.');
    assert.deepStrictEqual(engine.shiftBinding, { type: 'cc', channel: 1, index: 64 });
    console.log('  > MIDI Learn completado y asignado a CC 64: PASS');

    // --- TEST 6: INTEGRACIÓN EN STREAMPROCESSOR ---
    console.log('\n--- TEST 6: Validación de Integración en StreamProcessor ---');
    const processor = new StreamProcessor();
    processor.shiftEngine.setShiftBinding({ type: 'note', channel: 1, index: 99 });

    // Configurar estados en el processor
    for (let pad = 0; pad < TOTAL_PADS; pad++) {
        processor.shiftEngine.cacheState(0, { type: 'note', channel: 1, index: pad, value: 20 });
        processor.shiftEngine.cacheState(1, { type: 'note', channel: 1, index: pad, value: 80 });
    }

    let layerChangeEvent = null;
    processor.subscribe((event) => {
        if (event.type === 'layer_change') {
            layerChangeEvent = event;
        }
    });

    // Enviar evento de Shift a través de handleHardwareInput
    processor.handleHardwareInput({
        dir: 'in',
        event: 'noteon',
        channel: 1,
        note: 99,
        velocity: 127,
        source: 'Virtual Test Device',
        timestamp: Date.now()
    });

    assert.ok(layerChangeEvent !== null, 'Se debe notificar el evento de layer_change a los suscriptores.');
    assert.strictEqual(layerChangeEvent.activeLayer, 1, 'La capa activa notificada debe ser 1.');
    console.log('  > Notificación y despacho en StreamProcessor: PASS');

    console.log('\n================================================================');
    console.log('>> COMPUERTA GATE 7 APROBADA (PASS): MOTOR SHIFT & STATECACHE OK');
    console.log('================================================================\n');
}

runGate7Test().catch((err) => {
    console.error('\n[ERROR EN COMPUERTA GATE 7]:', err);
    process.exit(1);
});
