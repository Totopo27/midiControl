/**
 * Punto de entrada principal para producción y directos
 * Inicia el servidor centinela, conecta hardware y levanta monitor web.
 */
const LiveSentinelApp = require('./src/app');

async function main() {
    console.log('================================================================');
    console.log('      INICIANDO ESTACIÓN UNIVERSAL MIDI & OSC LIVE SENTINEL     ');
    console.log('================================================================\n');

    const app = new LiveSentinelApp();
    const info = await app.start();

    console.log('\n>> ESTACIÓN ACTIVA Y LISTA PARA CONCIERTO EN VIVO:');
    console.log(`   - Dashboard de Monitoreo: http://${info.localIP}:${info.httpPort}`);
    console.log(`   - Socket de Ingesta iPad: ws://${info.localIP}:${info.wsPort}`);
    console.log('   - Destino OSC por defecto: 127.0.0.1:57120 (SuperCollider)');
    console.log('\n[Presiona Ctrl+C para detener de forma segura]');
}

main().catch(err => {
    console.error('Error al iniciar la estación:', err);
    process.exit(1);
});
