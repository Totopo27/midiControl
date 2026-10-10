/**
 * Terminal Live Monitor (Zero-Overhead Console Dashboard)
 * Renderiza tabla de eventos en tiempo real con estadísticas y botón/atajo de pánico.
 */

class TerminalMonitor {
    constructor(maxHistory = 15) {
        this.maxHistory = maxHistory;
        this.history = [];
        this.totalCount = 0;
        this.noteOnCount = 0;
        this.noteOffCount = 0;
        this.activeChannels = new Set();
        this.sessionRegistry = null;
        this.isPaused = false;
        this.isBypass = false; // Modo Bypass (Zero-Overhead Live Sentinel)
    }

    setSessionRegistry(registry) {
        this.sessionRegistry = registry;
    }

    setBypass(enable) {
        this.isBypass = !!enable;
        return this.isBypass;
    }

    logEvent(event) {
        if (this.isBypass) return; // Zero-Overhead: En bypass no procesa ni acumula nada
        if (event.protocol === 'osc' || event.protocol === 'system') return; // TerminalMonitor es solo para eventos MIDI de interpretación

        this.totalCount++;
        if (event.event === 'noteon') {
            this.noteOnCount++;
            this.activeChannels.add(event.channel);
        } else if (event.event === 'noteoff') {
            this.noteOffCount++;
        }

        if (this.isPaused) return;

        const row = {
            id: this.totalCount,
            time: new Date(event.timestamp).toISOString().split('T')[1].replace('Z', ''),
            type: event.event.toUpperCase(),
            client: event.clientId || 'default',
            ch: event.channel,
            note: event.note,
            vel: event.velocity,
            latencyUs: event.durationUs ? event.durationUs.toFixed(1) + ' µs' : 'N/A',
            target: event.midiStatus && event.midiStatus.name ? event.midiStatus.name : 'Physical OUT'
        };

        this.history.push(row);
        if (this.history.length > this.maxHistory) {
            this.history.shift();
        }
    }

    renderTable() {
        if (this.isBypass) {
            console.clear();
            console.log('========================================================================================');
            console.log('                      SMART MIDI & OSC LIVE SENTINEL MONITOR                            ');
            console.log('========================================================================================');
            console.log(' Estado: [BYPASS / ZERO-OVERHEAD ACTIVO] (Telemetría y renderizado suspendidos)');
            console.log(' Tráfico MIDI/OSC en tiempo real activo al 100% con latencia mínima sin interrupción.');
            console.log('========================================================================================\n');
            return;
        }

        console.clear();
        console.log('========================================================================================');
        console.log('                 midiOSCControl — SMART MULTI-CLIENT LIVE SENTINEL                      ');
        console.log('========================================================================================');

        if (this.sessionRegistry) {
            const sessions = this.sessionRegistry.listSessions();
            if (sessions.length > 0) {
                console.log(' PROYECTOS / CLIENTES CONECTADOS:');
                sessions.forEach((s, idx) => {
                    const idxStr = `[${idx + 1}]`;
                    const labelStr = (s.label || s.clientId).padEnd(20);
                    const chStr = `MIDI Ch: ${String(s.midiChannel).padStart(2)}`;
                    const oscStr = `OSC: ${s.oscHost}:${s.oscPort}${s.oscPrefix || ''}`;
                    const notesStr = `Notas activas: ${s.activeNotesCount}`;
                    console.log(`   ${idxStr} ${labelStr} | ${chStr} | ${oscStr.padEnd(28)} | ${notesStr}`);
                });
                console.log('----------------------------------------------------------------------------------------');
            }
        }

        console.log(` Estado: [ACTIVO]  |  Total Eventos: ${this.totalCount}  |  Note-On: ${this.noteOnCount}  |  Note-Off: ${this.noteOffCount}  |  Canales: [${Array.from(this.activeChannels).sort((a,b)=>a-b).join(', ')}]`);
        console.log('----------------------------------------------------------------------------------------');
        console.log(' #ID  | HORA UTC    | ORIGEN/CLIENTE     | CH | NOTA | VEL | LATENCIA   | DESTINO');
        console.log('----------------------------------------------------------------------------------------');

        for (const r of this.history) {
            const idStr = String(r.id).padEnd(4);
            const timeStr = r.time.padEnd(11);
            const origStr = String(r.client || 'default').padEnd(18).slice(0, 18);
            const typeStr = r.type.padEnd(7);
            const chStr = String(r.ch).padStart(2);
            const noteStr = String(r.note).padStart(4);
            const velStr = String(r.vel).padStart(3);
            const latStr = r.latencyUs.padStart(10);
            const targetStr = r.target;

            console.log(` ${idStr} | ${timeStr} | ${origStr} | ${chStr} | ${noteStr} | ${velStr} | ${latStr} | ${targetStr}`);
        }

        console.log('========================================================================================');
        console.log(' Atajos: [1-9] Pánico por Proyecto  |  [P] Pánico Global  |  [C] Limpiar  |  [Espacio] Pausa');
        console.log('========================================================================================\n');
    }

    clear() {
        this.history = [];
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        return this.isPaused;
    }
}

module.exports = TerminalMonitor;
