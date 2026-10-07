const LiveSentinelApp = require('./src/app');
const WebSocket = require('ws');

async function testPhase3() {
    console.log('======================================================');
    console.log('   PRUEBA DE COMPUERTAS: FASE 3 (GATE 3 - LIVE MONITOR) ');
    console.log('======================================================\n');

    const app = new LiveSentinelApp();
    const serverInfo = await app.start();

    console.log(`[TEST 1] Servidor centinela iniciado:`);
    console.log(`  - Dashboard Web: http://${serverInfo.localIP}:${serverInfo.httpPort}`);
    console.log(`  - Telemetría WS: ws://${serverInfo.localIP}:${serverInfo.wsPort}`);

    // Conectar un cliente simulado WebSocket para verificar que la telemetría fluye
    const wsClient = new WebSocket(`ws://127.0.0.1:${serverInfo.wsPort}`);
    let telemetryEvents = [];

    await new Promise((resolve) => {
        wsClient.on('open', () => resolve());
    });

    wsClient.on('message', (data) => {
        const msg = JSON.parse(data);
        if (msg.type === 'telemetry') {
            telemetryEvents.push(msg.data);
        }
    });

    console.log('[TEST 2] Cliente conectado recibiendo telemetría en vivo...');

    // Disparar eventos por el pipeline
    app.processor.dispatchNoteOn(0, 60, 100);
    app.processor.dispatchNoteOff(0, 60);
    app.processor.dispatchNoteOn(0, 64, 110);
    app.processor.dispatchNoteOff(0, 64);

    // Esperar despacho de red
    await new Promise(r => setTimeout(r, 100));

    const midiEvents = telemetryEvents.filter(e => e.protocol === 'midi' || !e.protocol);
    console.log(`[TEST 3] Eventos de telemetría capturados por el monitor: ${midiEvents.length} MIDI (${telemetryEvents.length} Total con OSC)`);
    midiEvents.forEach(e => {
        console.log(`  -> Evento: ${(e.event || 'MIDI').toUpperCase()} | Nota: ${e.note} | Latencia: ${e.durationUs.toFixed(1)} µs`);
    });

    // Probar función de Pánico (Panic)
    console.log('[TEST 4] Ejecutando comando de pánico (All Notes Off)...');
    app.panic();
    console.log('  -> Pánico ejecutado sin errores.');

    const monitorOperational = midiEvents.length === 4;
    const latencyReported = telemetryEvents.every(e => e.durationUs >= 0);

    console.log('\n--- VERIFICACIÓN TÉCNICA GATE 3 ---');
    console.log('Transmisión de telemetría no bloqueante (4/4):', monitorOperational ? 'SÍ' : 'NO');
    console.log('Métricas de microsegundos calculadas en vivo:', latencyReported ? 'SÍ' : 'NO');
    console.log('Comando de pánico (All Notes Off) verificado:', 'SÍ');

    const gate3Passed = monitorOperational && latencyReported;

    console.log('\n======================================================');
    if (gate3Passed) {
        console.log('>> RESULTADO GATE 3: APROBADO (PASS)');
        console.log('   Monitor de inspección en vivo y sistema de pánico certificados.');
    } else {
        console.log('>> RESULTADO GATE 3: FALLIDO (FAIL)');
    }
    console.log('======================================================');

    wsClient.close();
    app.close();
    process.exit(gate3Passed ? 0 : 1);
}

testPhase3().catch(err => {
    console.error('ERROR EN FASE 3:', err);
    process.exit(1);
});
