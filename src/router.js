/**
 * Core Router & Physical MIDI Output Module
 * Implementa la interfaz agnóstica de hardware para emisión MIDI 1.0 estándar.
 */
const JZZ = require('jzz');

class MidiRouter {
    constructor() {
        this.midi = null;
        this.activeOutput = null;
        this.activeOutputName = null;
        this.activeNotes = new Map(); // key: `${channel}_${note}` -> timestamp
    }

    async init() {
        if (!this.midi) {
            this.midi = await JZZ();
        }
        return this.midi.info();
    }

    listOutputs() {
        if (!this.midi) throw new Error('MidiRouter no inicializado. Llama a init() primero.');
        const info = this.midi.info();
        return (info.outputs || []).map((out, idx) => ({
            index: idx,
            name: out.name,
            manufacturer: out.manufacturer || 'Desconocido'
        }));
    }

    async openOutput(target) {
        if (!this.midi) await this.init();

        if (this.activeOutput) {
            await this.panic();
            this.activeOutput.close();
            this.activeOutput = null;
            this.activeOutputName = null;
        }

        try {
            this.activeOutput = await this.midi.openMidiOut(target);
            this.activeOutputName = this.activeOutput.name();
            return {
                status: 'connected',
                name: this.activeOutputName
            };
        } catch (err) {
            throw new Error(`Fallo al abrir puerto MIDI OUT "${target}": ${err.message}`);
        }
    }

    sendNoteOn(channel, note, velocity = 127) {
        if (!this.activeOutput) throw new Error('No hay puerto MIDI OUT abierto.');
        
        const ch = Math.max(0, Math.min(15, parseInt(channel, 10)));
        const n = Math.max(0, Math.min(127, parseInt(note, 10)));
        const vel = Math.max(0, Math.min(127, parseInt(velocity, 10)));

        const noteKey = `${ch}_${n}`;
        this.activeNotes.set(noteKey, Date.now());

        // JZZ noteOn: channel (0-15), note (0-127), velocity (0-127)
        this.activeOutput.noteOn(ch, n, vel);

        return {
            event: 'noteon',
            channel: ch + 1, // Exponer a usuario 1-16
            note: n,
            velocity: vel,
            timestamp: Date.now()
        };
    }

    sendNoteOff(channel, note) {
        if (!this.activeOutput) throw new Error('No hay puerto MIDI OUT abierto.');

        const ch = Math.max(0, Math.min(15, parseInt(channel, 10)));
        const n = Math.max(0, Math.min(127, parseInt(note, 10)));

        const noteKey = `${ch}_${n}`;
        this.activeNotes.delete(noteKey);

        // JZZ noteOff: channel (0-15), note (0-127)
        this.activeOutput.noteOff(ch, n);

        return {
            event: 'noteoff',
            channel: ch + 1, // Exponer a usuario 1-16
            note: n,
            velocity: 0,
            timestamp: Date.now()
        };
    }

    async panic() {
        if (!this.activeOutput) return;

        // 1. Apagar todas las notas registradas en memoria
        for (const [key] of this.activeNotes) {
            const [ch, n] = key.split('_').map(Number);
            this.activeOutput.noteOff(ch, n);
        }
        this.activeNotes.clear();

        // 2. Enviar comandos MIDI CC 123 (All Notes Off) y CC 120 (All Sound Off) en los 16 canales
        for (let ch = 0; ch < 16; ch++) {
            this.activeOutput.allNotesOff(ch);
            this.activeOutput.allSoundOff(ch);
            this.activeOutput.resetAllControllers(ch);
        }
    }

    close() {
        if (this.activeOutput) {
            this.panic();
            this.activeOutput.close();
            this.activeOutput = null;
            this.activeOutputName = null;
        }
    }
}

module.exports = MidiRouter;
