/**
 * Punto de entrada principal para producción y directos
 * Inicia el servidor centinela, conecta hardware y levanta monitor web.
 */
const LiveSentinelApp = require('./src/app');

async function main() {
    const args = process.argv.slice(2);
    const localOnly = args.includes('--local-only') || args.includes('-l');
    const bindHost = localOnly ? '127.0.0.1' : (args.find(a => a.startsWith('--host='))?.split('=')[1] || '0.0.0.0');

    console.log('================================================================');
    console.log('      INICIANDO ESTACIÓN UNIVERSAL MIDI & OSC LIVE SENTINEL     ');
    console.log('================================================================\n');

    const app = new LiveSentinelApp({
        host: bindHost,
        localOnly: localOnly,
        autoReconnect: true,
        pollIntervalMs: 2000
    });
    const info = await app.start(null, 57120, 'USB2.0-MIDI');

    console.log('\n>> ESTACIÓN ACTIVA Y LISTA PARA CONCIERTO EN VIVO:');
    console.log(`   - Modo de Red:            ${localOnly ? 'Aislado Local (127.0.0.1)' : 'Abierto a LAN / iPad (0.0.0.0)'}`);
    console.log(`   - Dashboard de Monitoreo: http://${info.localIP}:${info.httpPort}`);
    console.log(`   - Socket de Ingesta:      ws://${info.localIP}:${info.wsPort}`);
    console.log('   - Destino OSC por defecto: 127.0.0.1:57120 (SuperCollider)');
    console.log('   - Hot-Plug Watchdog:      ACTIVO (Reconexión automática USB en segundo plano)');
    console.log('\n[Comandos interactivos de consola]:');
    console.log('   - Presiona [P] para Pánico Global (All Notes Off)');
    console.log('   - Presiona [T] para ver tabla TUI del monitor en consola');
    console.log('   - Presiona [B] para conmutar Modo Bypass / Zero-Overhead');
    console.log('   - Presiona [Ctrl+C] para detener de forma segura\n');

    if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (key) => {
            if (key === '\u0003') { // Ctrl+C
                console.log('\n[CERRANDO] Deteniendo estación...');
                app.close();
                process.exit(0);
            } else if (key.toLowerCase() === 'p') {
                console.log('\n[PÁNICO INTERACTIVO] Disparando All Notes Off multicanal...');
                app.panic();
            } else if (key.toLowerCase() === 't') {
                app.terminalMonitor.renderTable();
            } else if (key.toLowerCase() === 'b') {
                const newState = !app.isBypass;
                app.setBypass(newState);
            }
        });
    }
}

main().catch(err => {
    console.error('Error al iniciar la estación:', err);
    process.exit(1);
});
