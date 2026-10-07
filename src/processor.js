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

        const telemetry = {
            type: 'dispatch',
            event: 'noteon',
            channel: channel + 1,
            note,
            velocity,
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

        const telemetry = {
            type: 'dispatch',
            event: 'noteoff',
            channel: channel + 1,
            note,
            velocity: 0,
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
