/**
 * COMPUERTA E2E: INTEGRACIÓN MULTI-PROYECTO SIMULTÁNEO (Wilson + Diapasón)
 *
 * Simula dos clientes web independientes conectados simultáneamente al WebSocket
 * de midiOSCControl, cada uno operando con su puerto OSC y canal MIDI explícito.
 */

const WebSocket = require('ws');
const dgram = require('dgram');
const assert = require('assert');
const LiveSentinelApp = require('./src/app');

async function runMultiProjectE2ETest() {
    console.log('================================================================');
    console.log('   PRUEBA E2E: CONCURRENCIA SIMULTÁNEA DE PROYECTOS (GATE 9)   ');
    console.log('================================================================\n');

    // 1. Iniciar servidor centinela en puertos aislados de test
    const app = new LiveSentinelApp();
    const serverInfo = await app.start(null, 57120);

    // 2. Levantar dos servidores UDP de verificación:
    // Puerto 57120 para Wilson y Puerto 57121 para Diapasón
    const oscServerWilson = dgram.createSocket('udp4');
    const oscServerDiapason = dgram.createSocket('udp4');

    let oscPacketsWilson = [];
    let oscPacketsDiapason = [];

    oscServerWilson.on('message', (msg) => {
        oscPacketsWilson.push(msg);
    });

    oscServerDiapason.on('message', (msg) => {
        oscPacketsDiapason.push(msg);
    });

    await new Promise(r => oscServerWilson.bind(57120, '127.0.0.1', r));
    await new Promise(r => oscServerDiapason.bind(57121, '127.0.0.1', r));

    // 3. Conectar dos WebSockets simulando las dos apps abiertas a la vez
    const wsWilson = new WebSocket(`ws://127.0.0.1:${serverInfo.wsPort}`);
    const wsDiapason = new WebSocket(`ws://127.0.0.1:${serverInfo.wsPort}`);

    await Promise.all([
        new Promise(r => wsWilson.on('open', r)),
        new Promise(r => wsDiapason.on('open', r))
    ]);

    console.log('[TEST 1] Dos clientes conectados concurrentemente a midiOSCControl.');

    // 4. Registrar formalmente cada proyecto con canal y puerto explícitos
    wsWilson.send(JSON.stringify({
        type: 'register_client',
        clientId: 'wilson-keyboards',
        label: 'Teclados Wilson',
        midiChannel: 1,
        oscPort: 57120,
        oscPrefix: '/wilson'
    }));

    wsDiapason.send(JSON.stringify({
        type: 'register_client',
        clientId: 'diapason-microtonal',
        label: 'Diapasón Microtonal',
        midiChannel: 2,
        oscPort: 57121,
        oscPrefix: '/diapason'
    }));

    await new Promise(r => setTimeout(r, 100));

    // 5. Emitir notas desde ambos proyectos
    console.log('[TEST 2] Emitiendo nota desde Wilson (debe ir a Ch 1 y Puerto 57120)...');
    wsWilson.send(JSON.stringify({
        type: 'midi',
        clientId: 'wilson-keyboards',
        event: 'noteon',
        note: 60,
        velocity: 100
    }));

    console.log('[TEST 3] Emitiendo nota desde Diapasón (debe ir a Ch 2 y Puerto 57121)...');
    wsDiapason.send(JSON.stringify({
        type: 'midi',
        clientId: 'diapason-microtonal',
        event: 'noteon',
        note: 72,
        velocity: 90
    }));

    await new Promise(r => setTimeout(r, 150));

    assert.strictEqual(oscPacketsWilson.length, 1, 'Wilson debió recibir 1 paquete OSC en 57120');
    assert.strictEqual(oscPacketsDiapason.length, 1, 'Diapasón debió recibir 1 paquete OSC en 57121');
    console.log('  -> Enrutamiento UDP por puerto aislado: 100% VERIFICADO (PASS)');

    // 6. Test de pánico selectivo: Wilson manda pánico, Diapasón sigue sonando
    console.log('[TEST 4] Wilson envía pánico selectivo...');
    wsWilson.send(JSON.stringify({
        type: 'panic',
        clientId: 'wilson-keyboards'
    }));

    await new Promise(r => setTimeout(r, 100));

    // Wilson debió recibir un NOTEOFF en su puerto OSC, Diapasón no debió recibir nada nuevo
    assert.strictEqual(oscPacketsWilson.length, 2, 'Wilson debió recibir NOTEOFF de pánico en 57120');
    assert.strictEqual(oscPacketsDiapason.length, 1, 'Diapasón no debió ser perturbado por el pánico de Wilson');
    console.log('  -> Aislamiento de pánico en vivo: 100% VERIFICADO (PASS)');

    // Limpieza
    wsWilson.close();
    wsDiapason.close();
    oscServerWilson.close();
    oscServerDiapason.close();
    app.close();

    console.log('\n================================================================');
    console.log('>> COMPUERTA MULTI-PROYECTO E2E (GATE 9): APROBADA (PASS)');
    console.log('================================================================\n');
}

runMultiProjectE2ETest().catch(err => {
    console.error('FAIL E2E:', err);
    process.exit(1);
});
