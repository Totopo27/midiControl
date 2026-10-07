const LiveSentinelApp = require('./src/app');
const WebSocket = require('ws');

async function testPhase4Stress() {
    console.log('================================================================');
    console.log('   PRUEBA DE COMPUERTAS: FASE 4 (GATE 4 - ESTRÉS Y DIRECTO)    ');
    console.log('================================================================\n');

    const app = new LiveSentinelApp();
    const serverInfo = await app.start();

    const wsClient = new WebSocket(`ws://127.0.0.1:${serverInfo.wsPort}`);
    let telemetryCount = 0;

    await new Promise(resolve => wsClient.on('open', () => resolve()));
    wsClient.on('message', () => { telemetryCount++; });

    console.log('[TEST 1] Cliente WebSocket conectado al servidor centinela.');

    // Ráfaga masiva: 500 notas polifónicas con solapamiento y patrones de acordes/glissando
    console.log('[TEST 2] Disparando ráfaga masiva de 500 notas (1000 eventos On/Off)...');
    const TOTAL_NOTES = 500;
    const startTime = Date.now();

    for (let i = 0; i < TOTAL_NOTES; i++) {
        const channel = (i % 4); // Alternar canales 1, 2, 3, 4
        const note = 36 + (i % 60); // Rango de 5 octavas
        const velocity = 60 + (i % 68);

        // Disparar Note-On a través del WebSocket (simulando iPad / WebApp)
        wsClient.send(JSON.stringify({
            type: 'midi',
            event: 'noteon',
            channel: channel + 1,
            note: note,
            velocity: velocity
        }));

        // Pequeño jitter realista entre dedos de 1-3 ms
        if (i % 5 === 0) {
            await new Promise(r => setTimeout(r, 2));
        }

        // Disparar Note-Off correspondiente
        wsClient.send(JSON.stringify({
            type: 'midi',
            event: 'noteoff',
            channel: channel + 1,
            note: note
        }));
    }

    console.log('[TEST 3] Esperando que la cola procese el 100% de los eventos...');
    
    // Esperar hasta que se procesen o timeout
    const timeoutStart = Date.now();
    while (app.terminalMonitor.totalCount < (TOTAL_NOTES * 2) && (Date.now() - timeoutStart < 10000)) {
        await new Promise(r => setTimeout(r, 50));
    }

    const elapsedMs = Date.now() - startTime;
    const totalProcessed = app.terminalMonitor.totalCount;
    const noteOnProcessed = app.terminalMonitor.noteOnCount;
    const noteOffProcessed = app.terminalMonitor.noteOffCount;
    const remainingActiveNotes = app.processor.midiRouter.activeNotes.size;

    console.log('\n--- RESULTADOS DEL BENCHMARK DE ESTRÉS ---');
    console.log(`Tiempo total de prueba:       ${elapsedMs} ms`);
    console.log(`Total eventos procesados:     ${totalProcessed} / ${TOTAL_NOTES * 2}`);
    console.log(`Note-On procesados:           ${noteOnProcessed}`);
    console.log(`Note-Off procesados:          ${noteOffProcessed}`);
    console.log(`Notas activas remanentes:     ${remainingActiveNotes} (¡Debe ser 0 para evitar notas pegadas!)`);
    console.log(`Telemetría recibida por WS:   ${telemetryCount}`);

    // Simular prueba de desconexión en caliente y comando de pánico
    console.log('\n[TEST 4] Simulando evento de emergencia / desconexión con Panic...');
    app.panic();
    const activeAfterPanic = app.processor.midiRouter.activeNotes.size;
    console.log(`Notas activas tras pánico:    ${activeAfterPanic}`);

    const allEventsDelivered = totalProcessed === (TOTAL_NOTES * 2);
    const zeroStuckNotes = remainingActiveNotes === 0;
    const panicCleared = activeAfterPanic === 0;

    console.log('\n--- VERIFICACIÓN TÉCNICA GATE 4 ---');
    console.log('Integridad de entrega bajo estrés (1000/1000):', allEventsDelivered ? 'SÍ' : 'NO');
    console.log('Cero notas colgadas en memoria (Anti-Stuck):', zeroStuckNotes ? 'SÍ' : 'NO');
    console.log('Reinicio instantáneo vía Panic comprobado:', panicCleared ? 'SÍ' : 'NO');

    const gate4Passed = allEventsDelivered && zeroStuckNotes && panicCleared;

    console.log('\n================================================================');
    if (gate4Passed) {
        console.log('>> RESULTADO GATE 4: APROBADO (PASS)');
        console.log('   Estabilidad para conciertos en vivo y confiabilidad certificadas.');
    } else {
        console.log('>> RESULTADO GATE 4: FALLIDO (FAIL)');
    }
    console.log('================================================================');

    wsClient.close();
    app.close();
    process.exit(gate4Passed ? 0 : 1);
}

testPhase4Stress().catch(err => {
    console.error('ERROR EN FASE 4:', err);
    process.exit(1);
});
