/**
 * Virtual Loopback Proxy Module (Fase 8)
 * Intermediación transparente multiplataforma (Windows/macOS/Linux) para DAWs externos.
 * 
 * Arquitectura:
 * 1. Resuelve el bloqueo exclusivo de hardware en Windows (WinMM MMSYSERR_ALLOCATED).
 * 2. Expone puertos virtuales proxy ("midiControl Virtual IN" / "midiControl Virtual OUT").
 * 3. Enrutamiento bidireccional:
 *    - DAW Out -> Virtual Proxy IN -> midiControl Processor -> Hardware MIDI Out (+ OSC paralelo).
 *    - Hardware MIDI In -> midiControl Router -> Virtual Proxy OUT -> DAW In.
 * 4. Soporta loopback físico/kernel (loopMIDI / IAC / ALSA) y puente integrado por software (JZZ.Widget).
 */

const JZZ = require('jzz');

class VirtualMidiProxy {
    constructor(options = {}) {
        this.inPortName = options.inPortName || 'midiControl Virtual IN';
        this.outPortName = options.outPortName || 'midiControl Virtual OUT';
        this.platform = process.platform;
        this.mode = 'uninitialized'; // 'driver_loopback' | 'software_bridge'
        
        this.midi = null;
        this.widgetIn = null;
        this.widgetOut = null;
        
        this.dawListeners = [];
        this.activeNotes = new Map(); // key: `${channel}_${note}` -> timestamp
        
        this.stats = {
            dawToHwCount: 0,
            hwToDawCount: 0,
            totalErrors: 0,
            avgLatencyUs: 0.0,
            connectedAt: null
        };
        this._latencySamples = [];
    }

    /**
     * Detección de plataforma y análisis de capacidades de loopback en el SO.
     */
    detectPlatformCapabilities(info) {
        const platform = this.platform;
        const inputs = (info.inputs || []).map(i => i.name.toLowerCase());
        const outputs = (info.outputs || []).map(o => o.name.toLowerCase());
        
        let driverFound = false;
        let driverType = 'none';

        if (platform === 'win32') {
            // En Windows, buscar drivers de loopback instalados (loopMIDI, teevid, virtualMIDI)
            const winLoop = inputs.concat(outputs).some(name => 
                name.includes('loopmidi') || name.includes('teevid') || name.includes('virtualmidi')
            );
            if (winLoop) {
                driverFound = true;
                driverType = 'loopMIDI/virtualMIDI';
            }
        } else if (platform === 'darwin') {
            // En macOS, buscar IAC Driver o puertos de sesión de red
            const macLoop = inputs.concat(outputs).some(name => 
                name.includes('iac') || name.includes('network') || name.includes('virtual')
            );
            if (macLoop) {
                driverFound = true;
                driverType = 'CoreMIDI IAC Driver';
            }
        } else if (platform === 'linux') {
            // En Linux, buscar Midi Through o snd-virmidi
            const linuxLoop = inputs.concat(outputs).some(name => 
                name.includes('through') || name.includes('virmidi')
            );
            if (linuxLoop) {
                driverFound = true;
                driverType = 'ALSA Midi Through / VirMIDI';
            }
        }

        return {
            platform,
            driverFound,
            driverType,
            supported: true
        };
    }

    /**
     * Inicializa el proxy virtual.
     */
    async init() {
        if (!this.midi) {
            this.midi = await JZZ();
        }

        const info = this.midi.info();
        const caps = this.detectPlatformCapabilities(info);

        // Crear puente virtual en software usando JZZ.Widget para garantizar disponibilidad inmediata
        // incluso en ausencia de drivers de kernel de terceros (ideal para Windows sin loopMIDI y tests)
        this.widgetIn = JZZ.Widget({
            _receive: (msg) => {
                this.handleDawMessage(msg);
            }
        });

        this.widgetOut = JZZ.Widget();

        // Registrar los puertos virtuales en el registro global de JZZ
        // inPortName: desde la perspectiva del DAW, es un puerto de salida (DAW envía aquí -> widgetIn recibe)
        // outPortName: desde la perspectiva del DAW, es un puerto de entrada (DAW escucha aquí <- widgetOut emite)
        try {
            JZZ.addMidiOut(this.inPortName, this.widgetIn);
            JZZ.addMidiIn(this.outPortName, this.widgetOut);
            this.mode = caps.driverFound ? 'hybrid_loopback' : 'software_bridge';
        } catch (e) {
            this.mode = 'software_bridge';
        }

        this.stats.connectedAt = Date.now();

        return {
            status: 'initialized',
            mode: this.mode,
            inPort: this.inPortName,
            outPort: this.outPortName,
            capabilities: caps
        };
    }

    /**
     * Suscribirse a mensajes que provienen del DAW hacia el Proxy.
     */
    onDawInput(callback) {
        if (typeof callback === 'function') {
            this.dawListeners.push(callback);
        }
    }

    /**
     * Procesa internamente un mensaje recibido desde el DAW.
     */
    handleDawMessage(msg) {
        const tStart = process.hrtime.bigint();
        const statusByte = msg[0];
        const channel = (statusByte & 0x0F) + 1; // 1-16
        const command = statusByte >> 4;
        const data1 = msg[1];
        const data2 = msg[2] !== undefined ? msg[2] : 0;

        let eventName = 'raw';
        let description = `Raw 0x${statusByte.toString(16).toUpperCase()}`;

        if (command === 0x9) {
            eventName = data2 > 0 ? 'noteon' : 'noteoff';
            description = `${eventName.toUpperCase()} ${data1} (Vel: ${data2})`;
            const noteKey = `${channel}_${data1}`;
            if (eventName === 'noteon') {
                this.activeNotes.set(noteKey, Date.now());
            } else {
                this.activeNotes.delete(noteKey);
            }
        } else if (command === 0x8) {
            eventName = 'noteoff';
            description = `NOTEOFF ${data1}`;
            const noteKey = `${channel}_${data1}`;
            this.activeNotes.delete(noteKey);
        } else if (command === 0xB) {
            eventName = 'cc';
            description = `CC ${data1} = ${data2}`;
            if (data1 === 123 || data1 === 120) {
                // All notes off / All sound off
                this.activeNotes.clear();
            }
        } else if (command === 0xC) {
            eventName = 'program_change';
            description = `Program Change ${data1}`;
        } else if (command === 0xE) {
            eventName = 'pitchbend';
            description = `Pitchbend ${data1 | (data2 << 7)}`;
        }

        const hexBytes = Array.from(msg)
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');

        const tEnd = process.hrtime.bigint();
        const durationUs = Number(tEnd - tStart) / 1000;

        this._recordLatency(durationUs);
        this.stats.dawToHwCount++;

        const parsed = {
            type: 'virtual_proxy_in',
            source: 'daw_external',
            dir: 'in',
            event: eventName,
            description: description,
            channel: channel,
            note: data1,
            velocity: data2,
            hex: hexBytes,
            rawBytes: Array.from(msg),
            timestamp: Date.now(),
            durationUs: durationUs
        };

        for (const cb of this.dawListeners) {
            try {
                cb(parsed);
            } catch (err) {
                this.stats.totalErrors++;
            }
        }
    }

    /**
     * Enviar mensaje MIDI desde midiControl hacia el DAW (a través de Virtual OUT).
     */
    sendToDaw(channel, note, velocity = 127, command = 'noteon') {
        if (!this.widgetOut) {
            throw new Error('VirtualMidiProxy no inicializado.');
        }

        const ch = Math.max(0, Math.min(15, parseInt(channel, 10) - 1));
        const n = Math.max(0, Math.min(127, parseInt(note, 10)));
        const vel = Math.max(0, Math.min(127, parseInt(velocity, 10)));

        if (command === 'noteon' && vel > 0) {
            this.widgetOut.noteOn(ch, n, vel);
        } else if (command === 'noteoff' || (command === 'noteon' && vel === 0)) {
            this.widgetOut.noteOff(ch, n);
        } else if (command === 'cc') {
            this.widgetOut.control(ch, n, vel);
        }

        this.stats.hwToDawCount++;

        return {
            event: command,
            channel: ch + 1,
            note: n,
            velocity: vel,
            target: 'daw_external',
            timestamp: Date.now()
        };
    }

    /**
     * Reenvía un mensaje entrante de hardware directamente hacia el DAW.
     */
    forwardHardwareToDaw(hwMsg) {
        if (!this.widgetOut) return;

        if (hwMsg.event === 'noteon') {
            this.sendToDaw(hwMsg.channel, hwMsg.note, hwMsg.velocity, 'noteon');
        } else if (hwMsg.event === 'noteoff') {
            this.sendToDaw(hwMsg.channel, hwMsg.note, 0, 'noteoff');
        } else if (hwMsg.event === 'cc') {
            this.sendToDaw(hwMsg.channel, hwMsg.note, hwMsg.velocity, 'cc');
        } else if (hwMsg.rawBytes) {
            this.widgetOut.send(hwMsg.rawBytes);
            this.stats.hwToDawCount++;
        }
    }

    /**
     * Enlaza el proxy bidireccionalmente con el StreamProcessor y su Router.
     */
    attach(processor) {
        if (!processor) throw new Error('Se requiere una instancia de StreamProcessor.');
        
        // 1. Escuchar lo que el DAW envía al proxy -> inyectarlo al procesador para que llegue al Hardware y OSC
        this.onDawInput((dawMsg) => {
            if (dawMsg.event === 'noteon') {
                processor.dispatchFromVirtualProxy(dawMsg.channel, dawMsg.note, dawMsg.velocity, dawMsg);
            } else if (dawMsg.event === 'noteoff') {
                processor.dispatchFromVirtualProxy(dawMsg.channel, dawMsg.note, 0, dawMsg);
            }
        });

        // 2. Escuchar lo que el hardware físico recibe -> reenviarlo al DAW a través del proxy
        processor.midiRouter.onMidiInput((hwMsg) => {
            this.forwardHardwareToDaw(hwMsg);
        });

        return true;
    }

    /**
     * Rutina de pánico: All Notes Off hacia el DAW y limpieza de estado.
     */
    panic() {
        if (!this.widgetOut) return;

        for (const [key] of this.activeNotes) {
            const [ch, n] = key.split('_').map(Number);
            try {
                this.widgetOut.noteOff(ch - 1, n);
            } catch (_) {}
        }
        this.activeNotes.clear();

        for (let ch = 0; ch < 16; ch++) {
            try {
                this.widgetOut.allNotesOff(ch);
                this.widgetOut.allSoundOff(ch);
                this.widgetOut.resetAllControllers(ch);
            } catch (_) {}
        }
    }

    _recordLatency(us) {
        this._latencySamples.push(us);
        if (this._latencySamples.length > 100) {
            this._latencySamples.shift();
        }
        const sum = this._latencySamples.reduce((a, b) => a + b, 0);
        this.stats.avgLatencyUs = Number((sum / this._latencySamples.length).toFixed(2));
    }

    getStatus() {
        return {
            platform: this.platform,
            mode: this.mode,
            inPortName: this.inPortName,
            outPortName: this.outPortName,
            activeNotesCount: this.activeNotes.size,
            stats: { ...this.stats }
        };
    }

    close() {
        this.panic();
        if (this.inPortName) {
            try { JZZ.removeMidiOut(this.inPortName); } catch (_) {}
        }
        if (this.outPortName) {
            try { JZZ.removeMidiIn(this.outPortName); } catch (_) {}
        }
        this.mode = 'closed';
    }
}

module.exports = VirtualMidiProxy;
