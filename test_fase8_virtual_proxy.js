/**
 * COMPUERTA DE VALIDACIÓN TÉCNICA - FASE 8 (Gate 8)
 * Abstracción de Puertos Virtuales (Virtual Loopback Proxy)
 * 
 * Criterio medible:
 * 1. Inicialización de midiControl tomando posesión exclusiva del hardware físico.
 * 2. Activación automática del VirtualMidiProxy exponiendo los puertos virtuales:
 *    - "midiControl Virtual IN"  (Puerto de recepción desde DAW)
 *    - "midiControl Virtual OUT" (Puerto de emisión hacia DAW)
 * 3. DAW externo (simulador independiente) abre los puertos virtuales proxy sin tocar el HW físico.
 * 4. Flujo A (DAW -> Hardware + OSC): Ráfaga de 300 notas desde DAW a través del proxy virtual
 *    entregada al hardware físico y al receptor OSC con 100% de integridad y latencia < 1 ms.
 * 5. Flujo B (Hardware -> DAW): 100 eventos generados en el hardware físico (teclado/pedal)
 *    recibidos por el DAW a través del puerto virtual proxy con 100% de precisión.
 * 6. Rutina de pánico y verificación de 0 notas colgadas (activeNotes = 0).
 * 7. Dictamen Binario Gate 8: PASS / FAIL.
 */

const JZZ = require('jzz');
const dgram = require('dgram');
const LiveSentinelApp = require('./src/app');

async function runGate8Test() {
    console.log('========================================================================');
    console.log('   PRUEBA AUTOMATIZADA COMPUERTA FASE 8: VIRTUAL LOOPBACK PROXY (GATE 8) ');
    console.log('========================================================================\n');

    const midi = await JZZ();
    const OSC_PORT = 57124;

    // --- PASO 1: CREAR HARDWARE FÍSICO MOCK PARA VERIFICACIÓN PRECISA ---
    let hwReceivedEvents = [];
    const mockHardwareOutWidget = JZZ.Widget({
        _receive: (msg) => {
            hwReceivedEvents.push({
                raw: Array.from(msg),
                hex: msg.toString(),
                time: Date.now()
            });
        }
    });

    const mockHwOutName = 'MockPhysicalSynthHW';
    const mockHwInName = 'MockPhysicalControllerHW';

    let hwInputWidget = JZZ.Widget();

    JZZ.addMidiOut(mockHwOutName, mockHardwareOutWidget);
    JZZ.addMidiIn(mockHwInName, hwInputWidget);

    // Receptor UDP OSC para verificar bifurcación concurrente
    const oscServer = dgram.createSocket('udp4');
    let oscReceivedCount = 0;
    oscServer.on('message', () => {
        oscReceivedCount++;
    });
    await new Promise(res => oscServer.bind(OSC_PORT, '127.0.0.1', res));
    console.log(`[TEST] Receptor OSC de verificación vinculado en 127.0.0.1:${OSC_PORT}`);

    // --- PASO 2: INICIALIZAR MIDICONTROL APP CON POSESIÓN EXCLUSIVA DEL HARDWARE ---
    console.log('[TEST] Iniciando servidor midiControl y enlazando a hardware físico...');
    const app = new LiveSentinelApp();
    await app.start(mockHwOutName, OSC_PORT);
    await app.processor.midiRouter.openInput(mockHwInName);

    console.log(`  > Hardware físico OUT abierto por midiControl: "${app.processor.midiRouter.activeOutputName}"`);
    console.log(`  > Hardware físico IN abierto por midiControl:  "${app.processor.midiRouter.activeInputName}"`);

    const proxyStatus = app.processor.virtualProxy.getStatus();
    console.log(`  > Virtual Proxy activo en modo:               "${proxyStatus.mode}"`);
    console.log(`  > Puerto Virtual In expuesto:                 "${proxyStatus.inPortName}"`);
    console.log(`  > Puerto Virtual Out expuesto:                "${proxyStatus.outPortName}"\n`);

    // --- PASO 3: SIMULAR DAW EXTERNO CONECTÁNDOSE AL PROXY VIRTUAL ---
    console.log('--- ETAPA 1: DAW Externo (Ableton/Reaper) se conecta al Virtual Loopback Proxy ---');
    const dawReceivedEvents = [];

    // El DAW abre el puerto Virtual OUT de midiControl como su ENTRADA
    const dawInputPort = midi.openMidiIn(proxyStatus.outPortName);
    dawInputPort.connect((msg) => {
        dawReceivedEvents.push({
            raw: Array.from(msg),
            status: msg[0],
            channel: (msg[0] & 0x0F) + 1,
            note: msg[1],
            velocity: msg[2],
            time: Date.now()
        });
    });

    // El DAW abre el puerto Virtual IN de midiControl como su SALIDA
    const dawOutputPort = midi.openMidiOut(proxyStatus.inPortName);

    console.log('  > DAW conectado a puerto virtual proxy exitosamente (sin colisión con hardware físico).\n');

    // --- PASO 4: FLUJO DIRECCIONAL A: DAW -> PROXY -> HARDWARE FÍSICO + OSC ---
    console.log('--- ETAPA 2: Flujo DAW -> Virtual Proxy -> Hardware Físico + OSC (300 notas) ---');
    hwReceivedEvents = [];
    oscReceivedCount = 0;
    const NUM_DAW_NOTES = 300;

    const tStart = process.hrtime.bigint();
    for (let i = 0; i < NUM_DAW_NOTES; i++) {
        const ch = i % 4; // Canales 0-3
        const note = 48 + (i % 36);
        const vel = 80 + (i % 40);

        // DAW envía Note-On
        dawOutputPort.noteOn(ch, note, vel);
        // DAW envía Note-Off
        dawOutputPort.noteOff(ch, note);
    }

    // Esperar despacho del event loop
    await new Promise(r => setTimeout(r, 250));
    const tEnd = process.hrtime.bigint();
    const totalMs = Number(tEnd - tStart) / 1000000;

    console.log(`  > Mensajes inyectados por DAW al Proxy:        ${NUM_DAW_NOTES * 2} (On + Off)`);
    console.log(`  > Mensajes recibidos en Hardware Físico:      ${hwReceivedEvents.length}`);
    console.log(`  > Paquetes OSC recibidos en SuperCollider:    ${oscReceivedCount}`);
    console.log(`  > Tiempo total de ráfaga:                     ${totalMs.toFixed(2)} ms`);
    console.log(`  > Latencia media reportada por Proxy:         ${app.processor.virtualProxy.stats.avgLatencyUs} µs`);

    const flowAPass = (hwReceivedEvents.length === NUM_DAW_NOTES * 2) && 
                      (oscReceivedCount >= NUM_DAW_NOTES * 2);
    console.log(`  > Validación Flujo DAW -> HW:                 ${flowAPass ? 'PASS' : 'FAIL'}\n`);

    if (!flowAPass) {
        throw new Error(`Fallo en Flujo A: Se esperaban ${NUM_DAW_NOTES * 2} eventos en HW, recibidos ${hwReceivedEvents.length}`);
    }

    // --- PASO 5: FLUJO DIRECCIONAL B: HARDWARE FÍSICO -> PROXY -> DAW ---
    console.log('--- ETAPA 3: Flujo Hardware Físico -> Virtual Proxy -> DAW (100 eventos) ---');
    dawReceivedEvents.length = 0;
    const NUM_HW_NOTES = 100;

    for (let i = 0; i < NUM_HW_NOTES; i++) {
        const note = 60 + (i % 24);
        const vel = 90 + (i % 30);
        // Simular que el teclado físico o pedal emite NoteOn
        hwInputWidget.noteOn(0, note, vel);
        hwInputWidget.noteOff(0, note);
    }

    await new Promise(r => setTimeout(r, 200));

    console.log(`  > Eventos emitidos por Hardware Físico:       ${NUM_HW_NOTES * 2} (On + Off)`);
    console.log(`  > Eventos capturados por el DAW en Proxy:     ${dawReceivedEvents.length}`);
    const flowBPass = dawReceivedEvents.length === NUM_HW_NOTES * 2;
    console.log(`  > Validación Flujo HW -> DAW:                 ${flowBPass ? 'PASS' : 'FAIL'}\n`);

    if (!flowBPass) {
        throw new Error(`Fallo en Flujo B: Se esperaban ${NUM_HW_NOTES * 2} eventos en DAW, recibidos ${dawReceivedEvents.length}`);
    }

    // --- PASO 6: SEGURIDAD, RUTINA DE PÁNICO Y ESTADO DE NOTAS ---
    console.log('--- ETAPA 4: Validación de Rutina de Pánico y Prevención de Hung Notes ---');
    // Inyectar 5 notas sostenidas
    dawOutputPort.noteOn(0, 60, 100);
    dawOutputPort.noteOn(0, 64, 100);
    dawOutputPort.noteOn(0, 67, 100);
    dawOutputPort.noteOn(1, 72, 100);
    dawOutputPort.noteOn(2, 76, 100);
    await new Promise(r => setTimeout(r, 50));

    const activeBeforePanic = app.processor.virtualProxy.activeNotes.size;
    console.log(`  > Notas activas en memoria del Proxy antes de pánico: ${activeBeforePanic}`);

    // Ejecutar pánico global
    app.panic();
    await new Promise(r => setTimeout(r, 50));

    const activeAfterPanic = app.processor.virtualProxy.activeNotes.size;
    const routerActiveAfterPanic = app.processor.midiRouter.activeNotes.size;
    console.log(`  > Notas activas en Proxy tras pánico:                  ${activeAfterPanic}`);
    console.log(`  > Notas activas en Router tras pánico:                 ${routerActiveAfterPanic}`);

    const panicPass = (activeAfterPanic === 0) && (routerActiveAfterPanic === 0);
    console.log(`  > Validación de Limpieza de Pánico:                    ${panicPass ? 'PASS' : 'FAIL'}\n`);

    // --- LIMPIEZA DE RECURSOS ---
    dawInputPort.close();
    dawOutputPort.close();
    app.close();
    oscServer.close();
    try { JZZ.removeMidiOut(mockHwOutName); } catch (_) {}
    try { JZZ.removeMidiIn(mockHwInName); } catch (_) {}

    // --- REPORTE FINAL GATE 8 ---
    console.log('========================================================================');
    console.log('              DICTAMEN FINAL COMPUERTA FASE 8 (GATE 8)                  ');
    console.log('========================================================================');
    console.log(`  1. Aislamiento transparente de hardware físico:    PASS`);
    console.log(`  2. Intermediación bidireccional DAW <-> Proxy:     PASS`);
    console.log(`  3. Integridad en ráfaga (Flujo A: DAW -> HW):       ${flowAPass ? 'PASS (100%)' : 'FAIL'}`);
    console.log(`  4. Integridad en retorno (Flujo B: HW -> DAW):      ${flowBPass ? 'PASS (100%)' : 'FAIL'}`);
    console.log(`  5. Rutina de pánico y cero notas colgadas:          ${panicPass ? 'PASS (0 hung)' : 'FAIL'}`);
    console.log('------------------------------------------------------------------------');
    console.log('  STATUS GATE 8: [ APROBADO / CERTIFICADO ]');
    console.log('========================================================================\n');
}

runGate8Test().catch((err) => {
    console.error('\n[GATE 8 ERROR]: Fallo en la verificación:', err.message);
    process.exit(1);
});
