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
        this.isPaused = false;
    }

    logEvent(event) {
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
        console.clear();
        console.log('========================================================================================');
        console.log('                      SMART MIDI & OSC LIVE SENTINEL MONITOR                            ');
        console.log('========================================================================================');
        console.log(` Estado: [ACTIVO]  |  Total Eventos: ${this.totalCount}  |  Note-On: ${this.noteOnCount}  |  Note-Off: ${this.noteOffCount}  |  Canales: [${Array.from(this.activeChannels).sort((a,b)=>a-b).join(', ')}]`);
        console.log('----------------------------------------------------------------------------------------');
        console.log(' #ID  |  HORA UTC    | TIPO     | CH | NOTA | VEL | LATENCIA   | DESTINO');
        console.log('----------------------------------------------------------------------------------------');

        for (const r of this.history) {
            const idStr = String(r.id).padEnd(4);
            const timeStr = r.time.padEnd(11);
            const typeStr = r.type.padEnd(8);
            const chStr = String(r.ch).padStart(2);
            const noteStr = String(r.note).padStart(4);
            const velStr = String(r.vel).padStart(3);
            const latStr = r.latencyUs.padStart(10);
            const targetStr = r.target;

            console.log(` ${idStr} | ${timeStr} | ${typeStr} | ${chStr} | ${noteStr} | ${velStr} | ${latStr} | ${targetStr}`);
        }

        console.log('========================================================================================');
        console.log(' Atajos: [P] Pánico (All Notes Off)  |  [C] Limpiar historial  |  [Espacio] Pausar/Reanudar');
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
