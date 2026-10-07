/**
 * test_integration_e2e.js
 * Prueba de integración End-to-End: Teclados-Wilson (Cliente) -> midiControl (Sentinel) -> MIDI HW + OSC UDP
 */
const WebSocket = require('ws');
const dgram = require('dgram');
const LiveSentinelApp = require('./src/app');

async function runE2EIntegration() {
    console.log('================================================================');
    console.log('   PRUEBA INTEGRACIÓN END-TO-END: Teclados-Wilson -> midiControl');
    console.log('================================================================\n');

    const sentinel = new LiveSentinelApp();
    const TEST_OSC_PORT = 57121;
    let oscPacketsCount = 0;
    let telemetryCount = 0;

    // 1. Iniciar socket UDP para simular SuperCollider/Max recibiendo OSC
    const oscServer = dgram.createSocket('udp4');
    await new Promise((resolve) => {
        oscServer.bind(TEST_OSC_PORT, '127.0.0.1', () => {
            console.log(`[RECEPTOR OSC] Escuchando en 127.0.0.1:${TEST_OSC_PORT}`);
            resolve();
        });
    });

    oscServer.on('message', (msg) => {
        oscPacketsCount++;
    });

    // 2. Iniciar el servidor central de midiControl
    await sentinel.start(null, TEST_OSC_PORT);
    console.log('[CENTINELA] Servidor midiControl en ejecución.');

    // 3. Simular cliente Teclados-Wilson conectándose vía WebSocket
    const client = new WebSocket('ws://127.0.0.1:8081');

    await new Promise((resolve, reject) => {
        client.on('open', resolve);
        client.on('error', reject);
    });
    console.log('[CLIENTE WILSON] Conectado exitosamente al WebSocket de midiControl.');

    client.on('message', (raw) => {
        try {
            const data = JSON.parse(raw);
            if (data.type === 'telemetry') {
                telemetryCount++;
            }
        } catch (_) {}
    });

    // 4. Emitir ráfaga de notas tal como lo hace hexgrid.js (MIDI + OSC)
    console.log('\n[TEST 1] Simulando interpretación en Teclados-Wilson (Acorde EDO-53)...');
    
    // Tocar nota 60 (Note On + OSC)
    client.send(JSON.stringify({
        type: 'midi',
        event: 'noteon',
        channel: 1,
        note: 60,
        velocity: 110
    }));

    // Simular paquete OSC sintetizado por edo53.html
    const fakeOscBuffer = Buffer.from('/playNote,f\x00\x00,f\x00\x00\x00\x00', 'utf-8');
    client.send(JSON.stringify({
        type: 'osc',
        ip: '127.0.0.1',
        port: TEST_OSC_PORT,
        message: Array.from(fakeOscBuffer)
    }));

    // Tocar nota 64
    client.send(JSON.stringify({
        type: 'midi',
        event: 'noteon',
        channel: 1,
        note: 64,
        velocity: 100
    }));

    await new Promise(r => setTimeout(r, 60));

    // Liberar notas (Note Off)
    client.send(JSON.stringify({
        type: 'midi',
        event: 'noteoff',
        channel: 1,
        note: 60,
        velocity: 0
    }));

    client.send(JSON.stringify({
        type: 'midi',
        event: 'noteoff',
        channel: 1,
        note: 64,
        velocity: 0
    }));

    await new Promise(r => setTimeout(r, 60));

    // 5. Simular botón de Pánico (Panic) desde la interfaz
    console.log('[TEST 2] Simulando disparo de botón Panic (All Notes Off)...');
    client.send(JSON.stringify({
        type: 'midi',
        event: 'panic'
    }));

    await new Promise(r => setTimeout(r, 150));

    // Evaluaciones
    console.log('\n--- VERIFICACIÓN DEL FLUJO INTEGRADO ---');
    console.log(`Telemetría recibida por el cliente: ${telemetryCount} eventos`);
    console.log(`Paquetes OSC entregados por UDP:    ${oscPacketsCount} paquetes`);
    console.log(`Notas activas remanentes:           ${sentinel.processor.midiRouter.activeNotes.size}`);

    const passTelemetry = telemetryCount >= 4;
    const passOsc = oscPacketsCount >= 1;
    const passAntiStuck = sentinel.processor.midiRouter.activeNotes.size === 0;

    console.log(`\nValidación Telemetría WebSocket:    ${passTelemetry ? 'CORRECTO (PASS)' : 'FALLÓ'}`);
    console.log(`Validación Despacho UDP/OSC:        ${passOsc ? 'CORRECTO (PASS)' : 'FALLÓ'}`);
    console.log(`Validación Anti-Stuck (Panic/Off):  ${passAntiStuck ? 'CORRECTO (PASS)' : 'FALLÓ'}`);

    // Limpieza
    client.close();
    oscServer.close();
    sentinel.close();

    if (passTelemetry && passOsc && passAntiStuck) {
        console.log('\n================================================================');
        console.log('>> RESULTADO E2E: INTEGRACIÓN 100% EXITOSA (PASS)');
        console.log('================================================================\n');
        process.exit(0);
    } else {
        console.error('\n>> RESULTADO E2E: FALLÓ LA INTEGRACIÓN');
        process.exit(1);
    }
}

runE2EIntegration().catch(err => {
    console.error('Error durante la prueba E2E:', err);
    process.exit(1);
});
