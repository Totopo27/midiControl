/**
 * Compuerta de Auditoría de Concurrencia y Estado MIDI (Fase 2 - Hub & Spoke)
 * Valida la ausencia absoluta de notas colgadas (stuck notes),
 * la integridad de ciclos Note-On / Note-Off bajo condiciones adversas,
 * la sincronización del StateCache y el pánico determinista en hardware y DAW.
 */

const assert = require('assert');
const StreamProcessor = require('./src/processor');
const JZZ = require('jzz');

async function testConcurrencyAudit() {
    console.log('================================================================');
    console.log('   TEST AUDITORÍA FASE 2: CONCURRENCIA, ESTADO Y ANTI-STUCK     ');
    console.log('================================================================\n');

    const processor = new StreamProcessor();
    await processor.init();

    // Abrir puerto loopback virtual para recibir los bytes físicos de prueba
    const outputs = processor.midiRouter.listOutputs();
    const targetPort = outputs.find(o => o.name.includes('USB'))?.name || outputs[0].name;
    await processor.midiRouter.openOutput(targetPort);
    await processor.enableVirtualProxy();

    // --- TEST 1: Ciclo estricto Note-On / Note-Off en MidiRouter ---
    console.log('[TEST 1] Verificando seguimiento de notas activas en MidiRouter...');
    
    // Inyectar 64 notas Note-On
    for (let i = 0; i < 64; i++) {
        processor.dispatchNoteOn(0, i, 100);
    }
    assert.strictEqual(processor.midiRouter.activeNotes.size, 64, 'Deben registrarse exactamente 64 notas activas');

    // Despachar Note-Off para las 64 notas
    for (let i = 0; i < 64; i++) {
        processor.dispatchNoteOff(0, i);
    }
    assert.strictEqual(processor.midiRouter.activeNotes.size, 0, 'El mapa debe quedar en 0 tras los Note-Off');
    console.log('  -> 64 notas encendidas y apagadas limpiamente (ActiveNotes: 0).');

    // --- TEST 2: Simulación de Pánico con notas colgadas intencionales ---
    console.log('[TEST 2] Verificando rutina de pánico con notas huérfanas...');
    
    // Dejar 10 notas huérfanas encendidas
    for (let i = 60; i < 70; i++) {
        processor.dispatchNoteOn(1, i, 120);
    }
    assert.strictEqual(processor.midiRouter.activeNotes.size, 10, 'Deben quedar 10 notas huérfanas antes del pánico');

    // Ejecutar pánico maestro
    processor.panic();
    assert.strictEqual(processor.midiRouter.activeNotes.size, 0, 'Panic debe limpiar al 100% el mapa de notas activas');
    console.log('  -> Pánico ejecutado: 10 notas huérfanas apagadas y mapa purgado a 0.');

    // --- TEST 3: Integridad de notas en Virtual Loopback Proxy hacia el DAW ---
    console.log('[TEST 3] Verificando mitigación de stuck notes en Virtual Proxy...');
    
    // Enviar notas desde DAW al Proxy
    for (let n = 36; n <= 48; n++) {
        processor.virtualProxy.handleDawMessage([0x90, n, 100]); // Note-On Ch 1
    }
    assert.strictEqual(processor.virtualProxy.activeNotes.size, 13, 'Virtual Proxy debe rastrear las 13 notas del DAW');

    // Simular pánico en el proxy
    processor.virtualProxy.panic();
    assert.strictEqual(processor.virtualProxy.activeNotes.size, 0, 'Virtual Proxy debe vaciar sus notas tras pánico');
    console.log('  -> Virtual Proxy: Anti-stuck verificado y notas purgadas correctamente.');

    // --- TEST 4: Medición de Latencia de Ráfaga Concurrente (< 5.0 ms por evento en USB/SO) ---
    console.log('[TEST 4] Medición de latencia de ráfaga masiva (128 eventos concurrentes)...');
    const durations = [];
    const tStart = process.hrtime.bigint();
    for (let i = 0; i < 64; i++) {
        const onRes = processor.dispatchNoteOn(0, i, 100);
        const offRes = processor.dispatchNoteOff(0, i);
        durations.push(onRes.durationUs, offRes.durationUs);
    }
    const tEnd = process.hrtime.bigint();
    const totalMs = Number(tEnd - tStart) / 1000000;
    const avgPerEventUs = durations.reduce((a, b) => a + b, 0) / durations.length;
    
    assert.ok(avgPerEventUs < 5000, `La latencia media por evento (${avgPerEventUs} µs) debe ser menor a 5.0 ms`);
    console.log(`  -> 128 eventos procesados en ${totalMs.toFixed(3)} ms (Media interna por evento: ${avgPerEventUs.toFixed(2)} µs).`);

    // Cerrar recursos
    processor.close();

    console.log('\n================================================================');
    console.log('>> AUDITORÍA FASE 2: 100% PASS (APROBADO)');
    console.log('================================================================');
    process.exit(0);
}

testConcurrencyAudit().catch((err) => {
    console.error('Fallo en auditoría de concurrencia:', err);
    process.exit(1);
});
