/**
 * Prueba de Compuertas: Modo Headless Daemon y Watchdog de Conexiones
 */

const assert = require('assert');
const HeadlessEngine = require('./src/headless');

async function testHeadless() {
    console.log('================================================================');
    console.log('    TEST COMPUERTA: HEADLESS DAEMON & AUTO-RECONNECT WATCHDOG   ');
    console.log('================================================================\n');

    const engine = new HeadlessEngine({
        targetOscPort: 57125,
        pollIntervalMs: 500
    });

    console.log('[TEST 1] Iniciando motor headless...');
    const status = await engine.start();

    assert.strictEqual(status.running, true, 'El motor debe reportar estado running=true');
    assert.ok(status.virtualProxy, 'El proxy virtual debe estar activo');
    console.log('  -> Motor iniciado correctamente:', status.virtualProxy.inPort);

    console.log('[TEST 2] Verificando watchdog de reconexión...');
    assert.strictEqual(typeof engine.reconnectTimer, 'object', 'El watchdog timer debe estar corriendo');
    console.log('  -> Watchdog activo y encuestando puertos.');

    console.log('[TEST 3] Verificando rutina de pánico...');
    await engine.panic();
    console.log('  -> Pánico ejecutado limpiamente sin excepciones.');

    console.log('[TEST 4] Deteniendo motor headless...');
    await engine.stop();
    assert.strictEqual(engine.isRunning, false, 'El motor debe estar apagado');
    console.log('  -> Motor detenido correctamente.');

    console.log('\n================================================================');
    console.log('>> TEST HEADLESS: APROBADO (PASS)');
    console.log('================================================================');
    process.exit(0);
}

testHeadless().catch((err) => {
    console.error('Fallo en test headless:', err);
    process.exit(1);
});
