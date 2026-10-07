/**
 * Prueba de Compuertas: Modo Live Bridge y Watchdog de Conexiones
 */

const assert = require('assert');
const LiveBridgeEngine = require('./src/bridge');

async function testLiveBridge() {
    console.log('================================================================');
    console.log('    TEST COMPUERTA: LIVE BRIDGE & AUTO-RECONNECT WATCHDOG       ');
    console.log('================================================================\n');

    const engine = new LiveBridgeEngine({
        targetOscPort: 57125,
        pollIntervalMs: 500
    });

    console.log('[TEST 1] Iniciando Live Bridge...');
    const status = await engine.start();

    assert.strictEqual(status.running, true, 'El bridge debe reportar estado running=true');
    assert.ok(status.virtualProxy, 'El proxy virtual debe estar activo');
    console.log('  -> Bridge iniciado correctamente:', status.virtualProxy.inPort);

    console.log('[TEST 2] Verificando watchdog de reconexión...');
    assert.strictEqual(typeof engine.reconnectTimer, 'object', 'El watchdog timer debe estar corriendo');
    console.log('  -> Watchdog activo y encuestando puertos.');

    console.log('[TEST 3] Verificando rutina de pánico...');
    await engine.panic();
    console.log('  -> Pánico ejecutado limpiamente sin excepciones.');

    console.log('[TEST 4] Deteniendo Live Bridge...');
    await engine.stop();
    assert.strictEqual(engine.isRunning, false, 'El bridge debe estar apagado');
    console.log('  -> Bridge detenido correctamente.');

    console.log('\n================================================================');
    console.log('>> TEST LIVE BRIDGE: APROBADO (PASS)');
    console.log('================================================================');
    process.exit(0);
}

testLiveBridge().catch((err) => {
    console.error('Fallo en test live bridge:', err);
    process.exit(1);
});
