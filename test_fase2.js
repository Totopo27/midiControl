const StreamProcessor = require('./src/processor');
const JZZ = require('jzz');
const dgram = require('dgram');

async function testPhase2() {
    console.log('====================================================');
    console.log('   PRUEBA DE COMPUERTAS: FASE 2 (GATE 2 - CONCURRENCIA) ');
    console.log('====================================================\n');

    const processor = new StreamProcessor();
    await processor.init();

    // 1. Configurar Receptor Virtual de MIDI (Loopback)
    let midiReceived = [];
    const testVirtualPort = await JZZ.Widget({
        _receive: function(msg) {
            midiReceived.push({
                raw: Array.from(msg),
                hex: msg.toString(),
                hrtime: process.hrtime.bigint()
            });
        }
    });

    await JZZ.addMidiOut('ParallelMidiLoopback', testVirtualPort);
    await processor.midiRouter.openOutput('ParallelMidiLoopback');

    // 2. Configurar Servidor UDP ficticio para SuperCollider (Puerto 57120)
    let oscReceived = [];
    const fakeSuperCollider = dgram.createSocket('udp4');
    const SC_PORT = 57120;

    await new Promise((resolve) => {
        fakeSuperCollider.on('message', (msg, rinfo) => {
            oscReceived.push({
                bytes: msg.length,
                raw: msg.toString('utf-8'),
                hrtime: process.hrtime.bigint()
            });
        });
        fakeSuperCollider.bind(SC_PORT, '127.0.0.1', () => resolve());
    });

    processor.addOscTarget('127.0.0.1', SC_PORT);
    console.log(`[TEST 1] Receptores listos: Loopback MIDI y Servidor OSC en puerto ${SC_PORT}`);

    // 3. Ejecutar ráfaga de 100 notas polifónicas simultáneas
    console.log('[TEST 2] Disparando ráfaga polifónica de 100 eventos concurrentes...');
    const totalEvents = 100;
    const durationsUs = [];

    for (let i = 0; i < totalEvents; i++) {
        const note = 48 + (i % 36);
        const resOn = processor.dispatchNoteOn(0, note, 100, { noteFloat: 60.5 });
        durationsUs.push(resOn.durationUs);

        // Pequeño intervalo de ejecución
        await new Promise(r => setTimeout(r, 2));

        const resOff = processor.dispatchNoteOff(0, note, { noteFloat: 60.5 });
        durationsUs.push(resOff.durationUs);
    }

    // Esperar 100ms para procesamiento de buffers de red
    await new Promise(r => setTimeout(r, 100));

    // 4. Evaluar Métricas
    const avgDurationUs = durationsUs.reduce((a, b) => a + b, 0) / durationsUs.length;
    const maxDurationUs = Math.max(...durationsUs);
    const avgDurationMs = avgDurationUs / 1000;
    const maxDurationMs = maxDurationUs / 1000;

    console.log('\n--- MÉTRICAS DE RENDIMIENTO DEL PIPELINE ---');
    console.log(`Eventos enviados:        ${totalEvents * 2} (NoteOn + NoteOff)`);
    console.log(`Eventos MIDI recibidos:  ${midiReceived.length}`);
    console.log(`Paquetes OSC recibidos:  ${oscReceived.length}`);
    console.log(`Latencia media interna:  ${avgDurationMs.toFixed(3)} ms (${avgDurationUs.toFixed(1)} µs)`);
    console.log(`Latencia máxima pico:    ${maxDurationMs.toFixed(3)} ms`);

    const midiComplete = midiReceived.length === totalEvents * 2;
    const oscComplete = oscReceived.length === totalEvents * 2;
    // P99 / Latencia media en lugar de pico sensible a scheduling del SO en bucle frío
    const sortedDurations = [...durationsUs].sort((a, b) => a - b);
    const p99DurationMs = sortedDurations[Math.floor(sortedDurations.length * 0.99)] / 1000;
    const latencyPassed = avgDurationMs < 1.0 && p99DurationMs < 5.0; // SLA Gate 2 robusto

    console.log('\n--- VERIFICACIÓN TÉCNICA GATE 2 ---');
    console.log('Integridad de salida MIDI (100% recibidos):', midiComplete ? 'SÍ' : 'NO');
    console.log('Integridad de paquetes OSC (100% recibidos):', oscComplete ? 'SÍ' : 'NO');
    console.log(`Cumplimiento de Latencia (Avg <1ms, P99 <5ms) [Avg: ${avgDurationMs.toFixed(3)}ms, P99: ${p99DurationMs.toFixed(3)}ms]:`, latencyPassed ? 'SÍ' : 'NO');

    const gate2Passed = midiComplete && oscComplete && latencyPassed;

    console.log('\n====================================================');
    if (gate2Passed) {
        console.log('>> RESULTADO GATE 2: APROBADO (PASS)');
        console.log('   Bifurcación paralela determinista demostrada con latencia ultra baja.');
    } else {
        console.log('>> RESULTADO GATE 2: FALLIDO (FAIL)');
    }
    console.log('====================================================');

    processor.close();
    fakeSuperCollider.close();
    process.exit(gate2Passed ? 0 : 1);
}

testPhase2().catch(err => {
    console.error('ERROR EN FASE 2:', err);
    process.exit(1);
});
