/**
 * Headless Live Engine (Daemon / CLI sin interfaz gráfica)
 * 
 * Diseñado para entornos de producción y software externos (DAWs, SuperCollider, Max):
 * - Zero GUI / Zero HTTP overhead.
 * - Reconexión automática tolerante a fallos físicos (Hot-Plug Watchdog).
 * - Exposición de Virtual Proxy para DAWs ("midiControl Virtual IN/OUT").
 * - Bifurcación simultánea a hardware y red UDP OSC.
 * - Monitoreo determinista en consola mediante métricas compactas en una sola línea.
 */

const StreamProcessor = require('./processor');

class HeadlessEngine {
    constructor(options = {}) {
        this.options = {
            targetMidiIn: options.targetMidiIn || null,
            targetMidiOut: options.targetMidiOut || null,
            targetOscHost: options.targetOscHost || '127.0.0.1',
            targetOscPort: options.targetOscPort || 57120,
            autoReconnect: options.autoReconnect !== false,
            pollIntervalMs: options.pollIntervalMs || 2500,
            logHeartbeat: options.logHeartbeat !== false,
            ...options
        };

        this.processor = new StreamProcessor();
        this.isRunning = false;
        this.reconnectTimer = null;
        this.lastOutputName = null;
        this.lastInputName = null;

        this.stats = {
            eventsIn: 0,
            eventsOut: 0,
            oscSent: 0,
            reconnectAttempts: 0,
            startedAt: null
        };
    }

    async start() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.stats.startedAt = Date.now();

        await this.processor.init();
        await this.processor.enableVirtualProxy();
        this.processor.addOscTarget(this.options.targetOscHost, this.options.targetOscPort);

        // Intentar enlazar hardware inicial
        await this._resolveAndOpenPorts();

        // Suscribir observador para estadísticas internas en modo headless
        this.processor.subscribe((event) => {
            if (event.dir === 'in') {
                this.stats.eventsIn++;
            } else if (event.protocol === 'midi' && event.dir === 'out') {
                this.stats.eventsOut++;
            } else if (event.protocol === 'osc' && event.dir === 'out') {
                this.stats.oscSent++;
            }
        });

        // Configurar watchdog de hardware (Auto-reconexión y detección Hot-Plug)
        if (this.options.autoReconnect) {
            this._startWatchdog();
        }

        return this.getStatus();
    }

    async _resolveAndOpenPorts() {
        const outputs = this.processor.midiRouter.listOutputs();
        const inputs = this.processor.midiRouter.listInputs();

        // 1. Resolver y abrir salida física
        let outToOpen = this.options.targetMidiOut;
        if (!outToOpen) {
            const usbOut = outputs.find(o => o.name.toLowerCase().includes('usb'));
            outToOpen = usbOut ? usbOut.name : (outputs.find(o => !o.name.includes('Wavetable'))?.name || null);
        }

        if (outToOpen && outToOpen !== this.processor.midiRouter.activeOutputName) {
            try {
                await this.processor.midiRouter.openOutput(outToOpen);
                this.lastOutputName = outToOpen;
                console.log(`[HEADLESS::HW] Puerto Salida abierto: "${outToOpen}"`);
            } catch (err) {
                console.warn(`[HEADLESS::HW] Advertencia salida "${outToOpen}": ${err.message}`);
            }
        }

        // 2. Resolver y abrir entrada física
        let inToOpen = this.options.targetMidiIn;
        if (!inToOpen) {
            const usbIn = inputs.find(i => i.name.toLowerCase().includes('usb'));
            inToOpen = usbIn ? usbIn.name : (inputs[0]?.name || null);
        }

        if (inToOpen && inToOpen !== this.processor.midiRouter.activeInputName) {
            try {
                await this.processor.midiRouter.openInput(inToOpen);
                this.lastInputName = inToOpen;
                console.log(`[HEADLESS::HW] Puerto Entrada abierto: "${inToOpen}"`);
            } catch (err) {
                console.warn(`[HEADLESS::HW] Advertencia entrada "${inToOpen}": ${err.message}`);
            }
        }
    }

    _startWatchdog() {
        this.reconnectTimer = setInterval(async () => {
            if (!this.isRunning) return;

            try {
                const outputs = this.processor.midiRouter.listOutputs();
                const inputs = this.processor.midiRouter.listInputs();

                const outActive = this.processor.midiRouter.activeOutputName;
                const inActive = this.processor.midiRouter.activeInputName;

                // Verificar si el puerto de salida activo sigue existiendo en el bus
                const outExists = outActive && outputs.some(o => o.name === outActive);
                if (!outExists || !outActive) {
                    this.stats.reconnectAttempts++;
                    await this._resolveAndOpenPorts();
                }

                // Verificar si el puerto de entrada activo sigue existiendo en el bus
                const inExists = inActive && inputs.some(i => i.name === inActive);
                if (!inExists || !inActive) {
                    await this._resolveAndOpenPorts();
                }
            } catch (err) {
                // Silenciar errores transitorios durante desconexión de bus
            }
        }, this.options.pollIntervalMs);
    }

    getStatus() {
        return {
            running: this.isRunning,
            hardware: {
                activeOutput: this.processor.midiRouter.activeOutputName,
                activeInput: this.processor.midiRouter.activeInputName
            },
            virtualProxy: {
                inPort: this.processor.virtualProxy.inPortName,
                outPort: this.processor.virtualProxy.outPortName,
                mode: this.processor.virtualProxy.mode,
                ...this.processor.virtualProxy.getStatus()
            },
            oscTarget: `${this.options.targetOscHost}:${this.options.targetOscPort}`,
            stats: { ...this.stats, uptimeSeconds: Math.floor((Date.now() - (this.stats.startedAt || Date.now())) / 1000) }
        };
    }

    async panic() {
        return this.processor.panic();
    }

    async stop() {
        this.isRunning = false;
        if (this.reconnectTimer) {
            clearInterval(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.processor) {
            try { this.processor.close(); } catch (_) {}
        }

        console.log('[HEADLESS] Motor apagado correctamente.');
    }
}

module.exports = HeadlessEngine;
