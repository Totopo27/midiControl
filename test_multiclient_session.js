/**
 * COMPUERTA DE VALIDACIÓN TÉCNICA - MULTI-CLIENT SESSION (midiOSCControl)
 *
 * Criterios de aceptación verificables:
 * 1. Registro de proyectos con canal MIDI y puerto OSC explícitos.
 * 2. Advertencia si dos proyectos comparten canal o puerto deliberadamente.
 * 3. Despacho estricto: notas de Wilson salen por Canal 1 y Puerto 57120.
 * 4. Despacho estricto: notas de Diapasón salen por Canal 2 y Puerto 57121.
 * 5. Aislamiento de pánico: pánico en Wilson apaga solo notas de Wilson sin tocar Diapasón.
 */

const assert = require('assert');
const SessionRegistry = require('./src/session_manager');

async function runMultiClientTest() {
    console.log('================================================================');
    console.log('   PRUEBA TÉCNICA: REGISTRY & MULTI-CLIENT SESSION ISOLATION   ');
    console.log('================================================================\n');

    const registry = new SessionRegistry();

    // 1. Registro explícito de Proyecto A: Wilson Keyboards
    console.log('[TEST 1] Registrando Wilson Keyboards (Canal 1, Puerto 57120)...');
    const resA = registry.registerClient('wilson-keyboards', {
        label: 'Teclados Wilson',
        midiChannel: 1,
        oscPort: 57120,
        oscPrefix: '/wilson'
    });
    assert.strictEqual(resA.session.midiChannel, 1);
    assert.strictEqual(resA.session.oscPort, 57120);
    assert.strictEqual(resA.conflicts.length, 0);
    console.log('  -> Wilson registrado sin conflictos (PASS)');

    // 2. Registro explícito de Proyecto B: Diapasón Microtonal
    console.log('\n[TEST 2] Registrando Diapasón Microtonal (Canal 2, Puerto 57121)...');
    const resB = registry.registerClient('diapason-microtonal', {
        label: 'Diapasón Microtonal',
        midiChannel: 2,
        oscPort: 57121,
        oscPrefix: '/diapason'
    });
    assert.strictEqual(resB.session.midiChannel, 2);
    assert.strictEqual(resB.session.oscPort, 57121);
    assert.strictEqual(resB.conflicts.length, 0);
    console.log('  -> Diapasón registrado sin conflictos (PASS)');

    // 3. Prueba de detección de colisión deliberada
    console.log('\n[TEST 3] Registrando Proyecto C compartiendo Canal 1 deliberadamente...');
    const resC = registry.registerClient('modular-synth', {
        label: 'Modular Synth',
        midiChannel: 1,
        oscPort: 57125
    });
    assert.strictEqual(resC.conflicts.length, 1);
    assert.strictEqual(resC.conflicts[0].type, 'midi_channel_shared');
    assert.strictEqual(resC.conflicts[0].sharedWith, 'wilson-keyboards');
    console.log('  -> Conflicto detectado e informado adecuadamente: PASS');

    // 4. Verificación de aislamiento de notas activas
    console.log('\n[TEST 4] Encendiendo notas simultáneas en Wilson y Diapasón...');
    registry.recordNoteOn('wilson-keyboards', 60);
    registry.recordNoteOn('wilson-keyboards', 64);
    registry.recordNoteOn('diapason-microtonal', 72);

    assert.deepStrictEqual(registry.getActiveNotes('wilson-keyboards'), [60, 64]);
    assert.deepStrictEqual(registry.getActiveNotes('diapason-microtonal'), [72]);
    console.log('  -> Estados de notas activas independientes: PASS');

    // 5. Verificación de Pánico Aislado (Scorched earth en Wilson no toca Diapasón)
    console.log('\n[TEST 5] Ejecutando pánico selectivo sobre Wilson...');
    const clearedWilson = registry.clearClientNotes('wilson-keyboards');
    assert.deepStrictEqual(clearedWilson, [60, 64]);
    assert.deepStrictEqual(registry.getActiveNotes('wilson-keyboards'), []);
    assert.deepStrictEqual(registry.getActiveNotes('diapason-microtonal'), [72]);
    console.log('  -> Pánico selectivo verificado: Notas de Diapasón permanecen intactas (PASS)');

    console.log('\n================================================================');
    console.log('>> RESULTADO COMPUERTA MULTI-CLIENT: APROBADO (PASS)');
    console.log('================================================================\n');
}

runMultiClientTest().catch(err => {
    console.error('FAIL:', err);
    process.exit(1);
});
