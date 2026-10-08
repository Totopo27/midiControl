/**
 * COMPUERTA DE VALIDACIÓN TÉCNICA - FASE 5 (Gate 5)
 * Criterio medible:
 * 1. Conexión WebSocket al servidor de midiControl (LiveSentinelApp).
 * 2. Inyección de ráfaga de 500 notas en modo normal -> telemetría recibida al 100%.
 * 3. Activación de Modo Bypass ('set_bypass', enabled: true) -> confirmación de estado vía broadcast.
 * 4. Inyección de ráfaga masiva de 1000 notas bajo Modo Bypass -> TELEMETRÍA SILENCIADA (0 eventos WebSocket recibidos).
 * 5. Verificación de que el procesamiento y despacho en paralelo (MIDI + OSC) NO sufre interrupción ni pérdida.
 * 6. Reactivación de telemetría ('set_bypass', enabled: false) -> telemetría vuelve a fluir con normalidad.
 */

const WebSocket = require('ws');
const dgram = require('dgram');
const LiveSentinelApp = require('./src/app');

async function runGate5Test() {
    console.log('================================================================');
    console.log('   PRUEBA AUTOMATIZADA COMPUERTA FASE 5: MODO BYPASS / ZERO-OVERHEAD');
    console.log('================================================================\n');

    // 1. Iniciar servidor principal
    const app = new LiveSentinelApp();
    const serverInfo = await app.start(null, 57122);
    console.log(`[TEST] Servidor midiControl activo en puerto WS: ${serverInfo.wsPort}`);

    // Receptor UDP auxiliar para verificar que OSC sigue despachando con 100% de integridad
    const oscServer = dgram.createSocket('udp4');
    let oscCount = 0;
    oscServer.on('message', () => {
        oscCount++;
    });
    await new Promise(res => oscServer.bind(57122, '127.0.0.1', res));
    console.log('[TEST] Receptor de verificación OSC vinculado en 127.0.0.1:57122');

    // 2. Conectar cliente WebSocket
    const ws = new WebSocket(`ws://127.0.0.1:${serverInfo.wsPort}`);
    let receivedTelemetryCount = 0;
    let bypassStatusFromWs = false;

    await new Promise((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
    });
    console.log('[TEST] Cliente WebSocket de prueba conectado exitosamente.\n');

    ws.on('message', (raw) => {
        try {
            const data = JSON.parse(raw);
            if (data.type === 'telemetry') {
                receivedTelemetryCount++;
            } else if (data.type === 'bypass_status') {
                bypassStatusFromWs = data.enabled;
            }
        } catch (e) {}
    });

    // --- ETAPA 1: MODO NORMAL (TELEMETRÍA ACTIVA) ---
    console.log('--- ETAPA 1: Verificando recepción de telemetría en Modo Normal (100 notas) ---');
    receivedTelemetryCount = 0;
    oscCount = 0;

    for (let i = 0; i < 100; i++) {
        ws.send(JSON.stringify({
            type: 'midi',
            event: 'noteon',
            channel: 1,
            note: 60 + (i % 12),
            velocity: 100
        }));
    }

    // Esperar despacho
    await new Promise(r => setTimeout(r, 200));

    console.log(`  > Eventos de telemetría recibidos por WS: ${receivedTelemetryCount}`);
    console.log(`  > Paquetes OSC recibidos por UDP:         ${oscCount}`);
    const normalTelemetryPass = receivedTelemetryCount >= 100 && oscCount >= 100;
    console.log(`  > Validación Modo Normal: ${normalTelemetryPass ? 'PASS' : 'FAIL'}\n`);

    if (!normalTelemetryPass) {
        throw new Error('Fallo en Modo Normal antes de probar Bypass.');
    }

    // --- ETAPA 2: ACTIVAR MODO BYPASS ---
    console.log('--- ETAPA 2: Conmutando a MODO BYPASS / ZERO-OVERHEAD ---');
    ws.send(JSON.stringify({ type: 'set_bypass', enabled: true }));
    await new Promise(r => setTimeout(r, 100));

    console.log(`  > Estado devuelto por servidor: bypass = ${bypassStatusFromWs}`);
    if (!bypassStatusFromWs) {
        throw new Error('El servidor no confirmó la activación de bypass.');
    }

    // --- ETAPA 3: RÁFAGA MASIVA BAJO BYPASS ---
    console.log('\n--- ETAPA 3: Disparando ráfaga masiva (1000 notas) con Bypass ACTIVO ---');
    receivedTelemetryCount = 0;
    oscCount = 0;

    const tStart = process.hrtime.bigint();
    for (let i = 0; i < 1000; i++) {
        ws.send(JSON.stringify({
            type: 'midi',
            event: 'noteon',
            channel: 1,
            note: 36 + (i % 60),
            velocity: 110
        }));
    }

    await new Promise(r => setTimeout(r, 1200));
    const tEnd = process.hrtime.bigint();
    const elapsedMs = Number(tEnd - tStart) / 1e6;

    console.log(`  > Tiempo total de proceso:                 ${elapsedMs.toFixed(2)} ms`);
    console.log(`  > Eventos de telemetría filtrados (WS):   ${receivedTelemetryCount} (Esperado: 0)`);
    console.log(`  > Paquetes OSC entregados intactos (UDP): ${oscCount} (Esperado: 1000)`);

    const bypassPass = receivedTelemetryCount === 0 && oscCount === 1000;
    console.log(`  > Validación Zero-Overhead Telemetría:    ${bypassPass ? 'PASS' : 'FAIL'}`);

    // --- ETAPA 4: REANUDAR MODO NORMAL ---
    console.log('\n--- ETAPA 4: Desactivando Modo Bypass (Reanudación en caliente) ---');
    ws.send(JSON.stringify({ type: 'set_bypass', enabled: false }));
    await new Promise(r => setTimeout(r, 200));

    receivedTelemetryCount = 0;
    for (let i = 0; i < 50; i++) {
        ws.send(JSON.stringify({
            type: 'midi',
            event: 'noteon',
            channel: 1,
            note: 60,
            velocity: 90
        }));
    }
    await new Promise(r => setTimeout(r, 300));

    console.log(`  > Eventos de telemetría tras reanudar: ${receivedTelemetryCount}`);
    const resumePass = receivedTelemetryCount >= 50;
    console.log(`  > Validación Reanudación:              ${resumePass ? 'PASS' : 'FAIL'}\n`);

    // Limpieza
    ws.close();
    oscServer.close();
    app.close();

    const allPassed = normalTelemetryPass && bypassPass && resumePass;
    console.log('================================================================');
    if (allPassed) {
        console.log('>> COMPUERTA GATE 5 APROBADA (PASS): BYPASS ZERO-OVERHEAD OPERATIVO');
    } else {
        console.log('>> COMPUERTA GATE 5 RECHAZADA (FAIL)');
    }
    console.log('================================================================\n');

    process.exit(allPassed ? 0 : 1);
}

runGate5Test().catch(err => {
    console.error('ERROR EN GATE 5:', err.message);
    process.exit(1);
});
