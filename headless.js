#!/usr/bin/env node

/**
 * CLI Runner para la Estación Headless (Daemon de Conexiones Estables)
 * Ejecuta el motor sin GUI ni HTTP, manteniendo el puerto virtual y OSC activos.
 */

const HeadlessEngine = require('./src/headless');

async function main() {
    const args = process.argv.slice(2);
    const options = {
        targetMidiIn: null,
        targetMidiOut: null,
        targetOscHost: '127.0.0.1',
        targetOscPort: 57120,
        pollIntervalMs: 2000
    };

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--in' && args[i + 1]) options.targetMidiIn = args[++i];
        if (args[i] === '--out' && args[i + 1]) options.targetMidiOut = args[++i];
        if (args[i] === '--osc-port' && args[i + 1]) options.targetOscPort = parseInt(args[++i], 10);
        if (args[i] === '--osc-host' && args[i + 1]) options.targetOscHost = args[++i];
        if (args[i] === '--help' || args[i] === '-h') {
            console.log(`
Uso: node headless.js [opciones]

Opciones:
  --in <nombre>        Nombre exacto o parcial del puerto MIDI IN físico
  --out <nombre>       Nombre exacto o parcial del puerto MIDI OUT físico
  --osc-host <ip>      Host destino OSC (por defecto: 127.0.0.1)
  --osc-port <puerto>  Puerto destino OSC (por defecto: 57120)
  --help, -h           Muestra esta ayuda
            `);
            process.exit(0);
        }
    }

    console.log('================================================================');
    console.log('         MIDICONTROL HEADLESS DAEMON (ZERO-GUI ENGINE)          ');
    console.log('================================================================');

    const engine = new HeadlessEngine(options);
    const status = await engine.start();

    console.log('\n[ESTADO INICIAL DEL MOTOR]:');
    console.log(`  - Salida Física activa: ${status.hardware.activeOutput || 'Ninguna (esperando conexión)'}`);
    console.log(`  - Entrada Física activa: ${status.hardware.activeInput || 'Ninguna (esperando conexión)'}`);
    console.log(`  - Proxy Virtual DAW:    ${status.virtualProxy.inPort} (Modo: ${status.virtualProxy.mode})`);
    console.log(`  - Destino UDP OSC:      ${status.oscTarget}`);
    console.log('\n[INFO] Monitoreando puertos con Hot-Plug Watchdog activo.');
    console.log('[INFO] Presiona Ctrl+C para detener de forma segura.\n');

    // Manejo de señales de cierre
    const shutdown = async () => {
        console.log('\n[CERRANDO] Deteniendo daemon y enviando All Notes Off...');
        await engine.stop();
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    console.error('[ERROR FATAL]:', err);
    process.exit(1);
});
