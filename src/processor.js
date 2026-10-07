/**
 * Parallel Dispatch Pipeline (Stream Processor)
 * Bifurcación simultánea MIDI Físico + OSC UDP con latencia <1ms y trazabilidad de eventos.
 */
const dgram = require('dgram');
const MidiRouter = require('./router');
const ShiftEngine = require('./shift_engine');
const VirtualMidiProxy = require('./virtual_proxy');
const { encodeOSCMessage } = require('./osc');

class StreamProcessor {
    constructor() {
        this.midiRouter = new MidiRouter();
        this.shiftEngine = new ShiftEngine();
        this.virtualProxy = new VirtualMidiProxy();
        this.udpClient = dgram.createSocket('udp4');
        this.oscTargets = []; // [{ host, port, pathPrefix }]
        this.listeners = [];  // Callbacks para observadores (monitor / UI)

        // Configurar re-emisión física del buffer al alternar de capa
        this.shiftEngine.onHardwareEmit((items) => {
            this.handleShiftHardwareEmit(items);
        });

        // Notificar cambios de capa a la telemetría y UI
        this.shiftEngine.onLayerChange((newLayer, prevLayer, reason) => {
            this.notify({
                protocol: 'system',
                type: 'layer_change',
                activeLayer: newLayer,
                previousLayer: prevLayer,
                reason,
                timestamp: Date.now()
            });
        });

        // Enrutar automáticamente entradas MIDI de hardware hacia observadores y despacho opcional
        this.midiRouter.onMidiInput((parsedMsg) => {
            this.handleHardwareInput(parsedMsg);
        });
    }

    handleShiftHardwareEmit(items) {
        // Enviar ráfaga directa de mensajes al hardware sin demoras
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            try {
                if (item.type === 'note') {
                    if (item.value > 0) {
                        this.midiRouter.sendNoteOn(item.channel - 1, item.index, item.value);
                    } else {
                        this.midiRouter.sendNoteOff(item.channel - 1, item.index);
                    }
                } else if (item.type === 'cc') {
                    // Si el router implementa sendCC
                    if (typeof this.midiRouter.sendCC === 'function') {
                        this.midiRouter.sendCC(item.channel - 1, item.index, item.value);
                    }
                }
            } catch (_) {}
        }
    }

    handleHardwareInput(msg) {
        // Verificar si la entrada desde hardware está permitida
        if (!this.midiRouter.isRouteAllowed('hardware', 'system')) {
            return;
        }

        // Intercepción por el motor Shift (evaluar si es botón Shift o captura MIDI Learn)
        const shiftResult = this.shiftEngine.processHardwareInput(msg);
        if (shiftResult.consumed) {
            // Si fue capturado por modo MIDI Learn, notificar a los observadores/UI
            if (shiftResult.learned) {
                this.notify({
                    protocol: 'system',
                    type: 'midi_learn_captured',
                    binding: shiftResult.binding,
                    timestamp: Date.now()
                });
            }
            return;
        }

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
            midiStatus: { name: msg.source },
            layer: this.shiftEngine.activeLayer
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
        const sourceRoute = extraPayload.source_route || extraPayload.appId || 'app_a';

        // 1. Rama A: Envío Físico MIDI (Aislamiento de Retorno / Prevención de bucles)
        let midiResult = null;
        if (this.midiRouter.isRouteAllowed(sourceRoute, 'hardware')) {
            try {
                midiResult = this.midiRouter.sendNoteOn(channel, note, velocity);
            } catch (e) {
                midiResult = { error: e.message };
            }
        } else {
            midiResult = { status: 'blocked_by_routing_matrix', reason: `Feedback loop prevented: ${sourceRoute} -> hardware is disabled` };
        }

        // 2. Rama B: Envío OSC UDP en paralelo
        let oscDelivered = false;
        const noteFloat = extraPayload.noteFloat !== undefined ? extraPayload.noteFloat : parseFloat(note);
        const velFloat = parseFloat(velocity);

        if (this.midiRouter.isRouteAllowed(sourceRoute, 'osc')) {
            const oscBuffer = encodeOSCMessage('/mnote', 'ff', [noteFloat, velFloat]);
            for (let i = 0; i < this.oscTargets.length; i++) {
                const target = this.oscTargets[i];
                this.udpClient.send(oscBuffer, 0, oscBuffer.length, target.port, target.host);
            }
            oscDelivered = true;
        }

        const endTime = process.hrtime.bigint();
        const durationUs = Number(endTime - startTime) / 1000; // Microsegundos

        // Notificar telemetría OSC dedicada si fue entregado
        if (oscDelivered) {
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
        }

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
        const sourceRoute = extraPayload.source_route || extraPayload.appId || 'app_a';

        // 1. Rama A: Envío Físico MIDI (Aislamiento de Retorno)
        let midiResult = null;
        if (this.midiRouter.isRouteAllowed(sourceRoute, 'hardware')) {
            try {
                midiResult = this.midiRouter.sendNoteOff(channel, note);
            } catch (e) {
                midiResult = { error: e.message };
            }
        } else {
            midiResult = { status: 'blocked_by_routing_matrix', reason: `Feedback loop prevented: ${sourceRoute} -> hardware is disabled` };
        }

        // 2. Rama B: Envío OSC UDP en paralelo (velocidad 0.0)
        let oscDelivered = false;
        const noteFloat = extraPayload.noteFloat !== undefined ? extraPayload.noteFloat : parseFloat(note);

        if (this.midiRouter.isRouteAllowed(sourceRoute, 'osc')) {
            const oscBuffer = encodeOSCMessage('/mnote', 'ff', [noteFloat, 0.0]);
            for (let i = 0; i < this.oscTargets.length; i++) {
                const target = this.oscTargets[i];
                this.udpClient.send(oscBuffer, 0, oscBuffer.length, target.port, target.host);
            }
            oscDelivered = true;
        }

        const endTime = process.hrtime.bigint();
        const durationUs = Number(endTime - startTime) / 1000;

        // Notificar telemetría OSC dedicada
        if (oscDelivered) {
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
        }

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

    async enableVirtualProxy(options = {}) {
        if (options.inPortName) this.virtualProxy.inPortName = options.inPortName;
        if (options.outPortName) this.virtualProxy.outPortName = options.outPortName;
        const res = await this.virtualProxy.init();
        this.virtualProxy.attach(this);
        return res;
    }

    dispatchFromVirtualProxy(channel, note, velocity = 127, extraPayload = {}) {
        const payload = {
            ...extraPayload,
            source_route: 'daw_virtual_proxy'
        };
        if (velocity > 0) {
            return this.dispatchNoteOn(channel - 1, note, velocity, payload);
        } else {
            return this.dispatchNoteOff(channel - 1, note, payload);
        }
    }

    panic() {
        this.midiRouter.panic();
        if (this.virtualProxy) {
            try { this.virtualProxy.panic(); } catch (_) {}
        }
        // Disparar /allnotesoff por OSC
        const oscBuffer = encodeOSCMessage('/allnotesoff', '', []);
        for (let i = 0; i < this.oscTargets.length; i++) {
            const target = this.oscTargets[i];
            this.udpClient.send(oscBuffer, 0, oscBuffer.length, target.port, target.host);
        }
    }

    close() {
        this.panic();
        if (this.virtualProxy) {
            try { this.virtualProxy.close(); } catch (_) {}
        }
        this.midiRouter.close();
        try { this.udpClient.close(); } catch (e) {}
    }
}

module.exports = StreamProcessor;
