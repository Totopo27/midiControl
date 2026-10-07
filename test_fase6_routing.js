/**
 * COMPUERTA DE VALIDACIÓN TÉCNICA - FASE 6 (Gate 6)
 * Matriz de Ruteo Asimétrico & Aislamiento de Retorno (Inspirado en MIDI Split)
 *
 * Criterios medibles y verificables:
 * 1. Inicialización de LiveSentinelApp con routingMatrix por defecto:
 *    - app_a: { allowIn: true, allowOut: true } (DAW primario con feedback habilitado)
 *    - app_b: { allowIn: true, allowOut: false } (App secundaria con feedback BLOQUEADO hacia HW)
 * 2. Prueba A: Inyección de notas desde 'app_a' -> el hardware y OSC reciben los eventos (PASS).
 * 3. Prueba B: Inyección de notas de retorno desde 'app_b' -> el hardware bloquea y descarta el evento
 *    (status: 'blocked_by_routing_matrix') para prevenir bucles de feedback (PASS).
 * 4. Prueba C: Conmutación dinámica vía comando WS ('set_routing', target: 'app_b', direction: 'out', allowed: true) ->
 *    'app_b' ahora tiene permiso y el evento es admitido (PASS).
 * 5. Prueba D: Bloqueo de entrada en OSC ('set_routing', target: 'osc', direction: 'out', allowed: false) ->
 *    Los paquetes OSC son suprimidos mientras MIDI físico sigue operando normalmente (PASS).
 */

const WebSocket = require('ws');
const dgram = require('dgram');
const LiveSentinelApp = require('./src/app');

async function runGate6Test() {
    console.log('================================================================');
    console.log('   PRUEBA AUTOMATIZADA COMPUERTA FASE 6: RUTEO ASIMÉTRICO (SPLIT)');
    console.log('================================================================\n');

    // 1. Iniciar servidor principal
    const app = new LiveSentinelApp();
    const serverInfo = await app.start(null, 57123);
    console.log(`[TEST] Servidor activo en WS: ${serverInfo.wsPort}`);

    // Receptor UDP auxiliar
    const oscServer = dgram.createSocket('udp4');
    let oscCount = 0;
    oscServer.on('message', () => { oscCount++; });
    await new Promise(res => oscServer.bind(57123, '127.0.0.1', res));

    // 2. Conectar cliente WebSocket
    const ws = new WebSocket(`ws://127.0.0.1:${serverInfo.wsPort}`);
    let receivedTelemetry = [];
    let currentMatrix = null;

    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });

    ws.on('message', (raw) => {
        try {
            const data = JSON.parse(raw);
            if (data.type === 'telemetry') {
                receivedTelemetry.push(data.data);
            } else if (data.type === 'routing_matrix') {
                currentMatrix = data.matrix;
            }
        } catch (e) {}
    });

    // Solicitar matriz actual
    ws.send(JSON.stringify({ type: 'get_devices' }));
    await new Promise(r => setTimeout(r, 100));

    console.log('--- ETAPA 1: Inspección de Matriz Inicial de Ruteo ---');
    console.log('  > Matriz detectada:', JSON.stringify(currentMatrix));
    if (!currentMatrix || currentMatrix.app_b.allowOut !== false) {
        throw new Error('Matriz inicial no tiene app_b.allowOut = false');
    }
    console.log('  > Validación Matriz Inicial: PASS\n');

    // --- ETAPA 2: PRUEBA DE RETORNO DESDE APP_A (PERMITIDO) ---
    console.log('--- ETAPA 2: Envío de retorno desde App A (DAW primario) ---');
    receivedTelemetry = [];
    oscCount = 0;

    const resA = app.processor.dispatchNoteOn(0, 60, 100, { source_route: 'app_a' });
    await new Promise(r => setTimeout(r, 100));

    console.log(`  > Estado MIDI físico devuelto:`, resA.midiStatus);
    const passA = resA.midiStatus && resA.midiStatus.status !== 'blocked_by_routing_matrix';
    console.log(`  > Validación App A -> Hardware: ${passA ? 'PASS (Permitido)' : 'FAIL'}\n`);

    // --- ETAPA 3: PRUEBA DE AISLAMIENTO DESDE APP_B (BLOQUEO ANTI-BUCLE) ---
    console.log('--- ETAPA 3: Envío de retorno desde App B (Visuales/Resolume) ---');
    const resB = app.processor.dispatchNoteOn(0, 64, 100, { source_route: 'app_b' });
    await new Promise(r => setTimeout(r, 100));

    console.log(`  > Estado MIDI físico devuelto:`, resB.midiStatus);
    const passB = resB.midiStatus && resB.midiStatus.status === 'blocked_by_routing_matrix';
    console.log(`  > Validación Aislamiento App B: ${passB ? 'PASS (Bloqueado exitosamente)' : 'FAIL'}\n`);

    // --- ETAPA 4: CONMUTACIÓN DINÁMICA DE LA MATRIZ VÍA WEBSOCKET ---
    console.log('--- ETAPA 4: Habilitando retorno de App B en caliente vía WebSocket ---');
    ws.send(JSON.stringify({
        type: 'set_routing',
        target: 'app_b',
        direction: 'out',
        allowed: true
    }));
    await new Promise(r => setTimeout(r, 100));

    console.log(`  > Nueva matriz recibida por WS: app_b.allowOut = ${currentMatrix.app_b.allowOut}`);
    const resB2 = app.processor.dispatchNoteOn(0, 64, 100, { source_route: 'app_b' });
    const passB2 = resB2.midiStatus && resB2.midiStatus.status !== 'blocked_by_routing_matrix';
    console.log(`  > Validación Habilitación App B: ${passB2 ? 'PASS (Ahora admitido)' : 'FAIL'}\n`);

    // --- ETAPA 5: FILTRADO INDEPENDIENTE DE LA RAMA OSC ---
    console.log('--- ETAPA 5: Bloqueando rama OSC vía matriz ---');
    ws.send(JSON.stringify({
        type: 'set_routing',
        target: 'osc',
        direction: 'out',
        allowed: false
    }));
    await new Promise(r => setTimeout(r, 100));

    oscCount = 0;
    app.processor.dispatchNoteOn(0, 72, 100, { source_route: 'app_a' });
    await new Promise(r => setTimeout(r, 100));

    console.log(`  > Paquetes OSC tras bloqueo: ${oscCount} (Esperado: 0)`);
    const passOscBlock = oscCount === 0;
    console.log(`  > Validación Aislamiento OSC: ${passOscBlock ? 'PASS' : 'FAIL'}\n`);

    // Limpieza
    ws.close();
    oscServer.close();
    app.close();

    const allPassed = passA && passB && passB2 && passOscBlock;
    console.log('================================================================');
    if (allPassed) {
        console.log('>> COMPUERTA GATE 6 APROBADA (PASS): RUTEO ASIMÉTRICO Y ANTI-BUCLE OPERATIVO');
    } else {
        console.log('>> COMPUERTA GATE 6 RECHAZADA (FAIL)');
    }
    console.log('================================================================\n');

    process.exit(allPassed ? 0 : 1);
}

runGate6Test().catch(err => {
    console.error('ERROR EN GATE 6:', err.message);
    process.exit(1);
});
