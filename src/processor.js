/**
 * Parallel Dispatch Pipeline (Stream Processor)
 * Bifurcación simultánea MIDI Físico + OSC UDP con latencia <1ms y trazabilidad de eventos.
 */
const dgram = require('dgram');
const MidiRouter = require('./router');
const { encodeOSCMessage } = require('./osc');

class StreamProcessor {
    constructor() {
        this.midiRouter = new MidiRouter();
        this.udpClient = dgram.createSocket('udp4');
        this.oscTargets = []; // [{ host, port, pathPrefix }]
        this.listeners = [];  // Callbacks para observadores (monitor / UI)

        // Enrutar automáticamente entradas MIDI de hardware hacia observadores y despacho opcional
        this.midiRouter.onMidiInput((parsedMsg) => {
            this.handleHardwareInput(parsedMsg);
        });
    }

    handleHardwareInput(msg) {
        // Notificar a la UI inmediatamente con estructura tipo MidiView
        const telemetry = {
            protocol: 'midi',
            type: 'hardware_in',
            dir: msg.dir || 'in',
            event: msg.event,
            description: msg.description,
            channel: msg.channel,
            note: msg.note,
            velocity: msg.velocity,
            hex: msg.hex,
            durationUs: 0.1,
            timestamp: msg.timestamp,
            midiStatus: { name: msg.source }
        };
        this.notify(telemetry);

        // Si es NoteOn/NoteOff del pedal, reenviarlo a OSC si OSC está activo
        if (msg.event === 'noteon' || msg.event === 'noteoff') {
            const velFloat = msg.event === 'noteon' ? parseFloat(msg.velocity) : 0.0;
            const noteFloat = parseFloat(msg.note);
            const oscBuffer = encodeOSCMessage('/mnote', 'ff', [noteFloat, velFloat]);
            for (let i = 0; i < this.oscTargets.length; i++) {
                const target = this.oscTargets[i];
                this.udpClient.send(oscBuffer, 0, oscBuffer.length, target.port, target.host);
            }

            this.notify({
                protocol: 'osc',
                dir: 'out',
                path: '/mnote',
                types: ',ff',
                args: `[${noteFloat.toFixed(2)}, ${velFloat.toFixed(1)}]`,
                target: `${this.oscTargets[0]?.host || '127.0.0.1'}:${this.oscTargets[0]?.port || 57120}`,
                durationUs: 0.1,
                timestamp: Date.now()
            });
        }
    }

    async init(targetMidiOutput = null) {
        await this.midiRouter.init();
        if (targetMidiOutput) {
            await this.midiRouter.openOutput(targetMidiOutput);
        }
    }

    addOscTarget(host = '127.0.0.1', port = 57120, pathPrefix = '/mnote') {
        this.oscTargets.push({ host, port, pathPrefix });
    }

    subscribe(listener) {
        if (typeof listener === 'function') {
            this.listeners.push(listener);
        }
    }

    notify(eventData) {
        for (let i = 0; i < this.listeners.length; i++) {
            try {
                this.listeners[i](eventData);
            } catch (err) {
                // El observador no debe tumbar el loop de audio
            }
        }
    }

    dispatchNoteOn(channel, note, velocity = 127, extraPayload = {}) {
        const startTime = process.hrtime.bigint();

        // 1. Rama A: Envío Físico MIDI
        let midiResult = null;
        try {
            midiResult = this.midiRouter.sendNoteOn(channel, note, velocity);
        } catch (e) {
            midiResult = { error: e.message };
        }

        // 2. Rama B: Envío OSC UDP en paralelo
        const noteFloat = extraPayload.noteFloat !== undefined ? extraPayload.noteFloat : parseFloat(note);
        const velFloat = parseFloat(velocity);
        const oscBuffer = encodeOSCMessage('/mnote', 'ff', [noteFloat, velFloat]);

        for (let i = 0; i < this.oscTargets.length; i++) {
            const target = this.oscTargets[i];
            this.udpClient.send(oscBuffer, 0, oscBuffer.length, target.port, target.host);
        }

        const endTime = process.hrtime.bigint();
        const durationUs = Number(endTime - startTime) / 1000; // Microsegundos

        // Notificar telemetría OSC dedicada
        this.notify({
            protocol: 'osc',
            dir: 'out',
            path: '/mnote',
            types: ',ff',
            args: `[${noteFloat.toFixed(2)}, ${velFloat.toFixed(1)}]`,
            target: `${this.oscTargets[0]?.host || '127.0.0.1'}:${this.oscTargets[0]?.port || 57120}`,
            durationUs,
            timestamp: Date.now()
        });

        const telemetry = {
            protocol: 'midi',
            type: 'dispatch',
            dir: 'out',
            event: 'noteon',
            channel: channel + 1,
            note,
            velocity,
            description: `NOTEON ${note}`,
            hex: `9${(channel).toString(16).toUpperCase()} ${note.toString(16).toUpperCase()} ${velocity.toString(16).toUpperCase()}`,
            noteFloat,
            durationUs,
            timestamp: Date.now(),
            midiStatus: midiResult
        };

        this.notify(telemetry);
        return telemetry;
    }

    dispatchNoteOff(channel, note, extraPayload = {}) {
        const startTime = process.hrtime.bigint();

        // 1. Rama A: Envío Físico MIDI
        let midiResult = null;
        try {
            midiResult = this.midiRouter.sendNoteOff(channel, note);
        } catch (e) {
            midiResult = { error: e.message };
        }

        // 2. Rama B: Envío OSC UDP en paralelo (velocidad 0.0)
        const noteFloat = extraPayload.noteFloat !== undefined ? extraPayload.noteFloat : parseFloat(note);
        const oscBuffer = encodeOSCMessage('/mnote', 'ff', [noteFloat, 0.0]);

        for (let i = 0; i < this.oscTargets.length; i++) {
            const target = this.oscTargets[i];
            this.udpClient.send(oscBuffer, 0, oscBuffer.length, target.port, target.host);
        }

        const endTime = process.hrtime.bigint();
        const durationUs = Number(endTime - startTime) / 1000;

        // Notificar telemetría OSC dedicada
        this.notify({
            protocol: 'osc',
            dir: 'out',
            path: '/mnote',
            types: ',ff',
            args: `[${noteFloat.toFixed(2)}, 0.0]`,
            target: `${this.oscTargets[0]?.host || '127.0.0.1'}:${this.oscTargets[0]?.port || 57120}`,
            durationUs,
            timestamp: Date.now()
        });

        const telemetry = {
            protocol: 'midi',
            type: 'dispatch',
            dir: 'out',
            event: 'noteoff',
            channel: channel + 1,
            note,
            velocity: 0,
            description: `NOTEOFF ${note}`,
            hex: `8${(channel).toString(16).toUpperCase()} ${note.toString(16).toUpperCase()} 00`,
            noteFloat,
            durationUs,
            timestamp: Date.now(),
            midiStatus: midiResult
        };

        this.notify(telemetry);
        return telemetry;
    }

    panic() {
        this.midiRouter.panic();
        // Disparar /allnotesoff por OSC
        const oscBuffer = encodeOSCMessage('/allnotesoff', '', []);
        for (let i = 0; i < this.oscTargets.length; i++) {
            const target = this.oscTargets[i];
            this.udpClient.send(oscBuffer, 0, oscBuffer.length, target.port, target.host);
        }
    }

    close() {
        this.panic();
        this.midiRouter.close();
        try { this.udpClient.close(); } catch (e) {}
    }
}

module.exports = StreamProcessor;
