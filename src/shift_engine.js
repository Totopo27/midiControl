/**
 * Shift Engine & LED StateCache Module (Fase 7)
 * Provee conmutación de capas (Toggle / Flash) y memoria de estado de LEDs (StateCache)
 * con re-emisión instantánea (<2ms) al alternar entre capas.
 */

class ShiftEngine {
    constructor(options = {}) {
        // Configuración de capas
        this.activeLayer = 0;       // 0 = Capa Base, 1 = Capa Shift (ampliable a N capas)
        this.maxLayers = options.maxLayers || 2;
        this.mode = options.mode || 'flash'; // 'flash' (momentáneo) o 'toggle' (conmutado)

        this.isLearning = false;
        this.learnTarget = null; // metadata opcional del campo a aprender

        // StateCache por capa:
        // stateCache[layer] = Map(controlKey -> { type, channel, index, value, rawBytes })
        // controlKey: `${type}_${channel}_${index}`
        this.stateCaches = Array.from({ length: this.maxLayers }, () => new Map());

        // Callbacks de eventos
        this.onLayerChangeCallbacks = [];
        this.onHardwareEmitCallbacks = []; // Para reenviar ráfaga de LEDs hacia el puerto físico
    }

    /**
     * Activa o desactiva el modo MIDI Learn para el botón Shift o mapeo general.
     */
    setMidiLearn(enable = true, target = null) {
        this.isLearning = !!enable;
        this.learnTarget = enable ? target : null;
        return this.isLearning;
    }

    /**
     * Asigna manualmente el control que actúa como Shift.
     */
    setShiftBinding(binding) {
        if (!binding || !binding.type || binding.channel === undefined || binding.index === undefined) {
            throw new Error('ShiftBinding inválido. Debe incluir type ("note"|"cc"), channel y index.');
        }
        this.shiftBinding = {
            type: binding.type.toLowerCase(),
            channel: parseInt(binding.channel, 10),
            index: parseInt(binding.index, 10)
        };
    }

    /**
     * Configura el comportamiento del Shift ('flash' o 'toggle').
     */
    setMode(mode) {
        if (mode !== 'flash' && mode !== 'toggle') {
            throw new Error('Modo inválido. Debe ser "flash" o "toggle".');
        }
        this.mode = mode;
    }

    /**
     * Registra un callback que se ejecuta al conmutar de capa.
     * signature: (newLayer, previousLayer, reason)
     */
    onLayerChange(cb) {
        if (typeof cb === 'function') this.onLayerChangeCallbacks.push(cb);
    }

    /**
     * Registra el callback receptor de la re-emisión de LEDs hacia el hardware.
     * signature: (items: Array<{ type, channel, index, value }>)
     */
    onHardwareEmit(cb) {
        if (typeof cb === 'function') this.onHardwareEmitCallbacks.push(cb);
    }

    /**
     * Procesa un evento entrante desde el Hardware MIDI.
     * Retorna { consumed: boolean, layer: number, event: Object }
     * Si consumed es true, el evento fue capturado por el motor Shift y no debe llegar al DAW.
     */
    processHardwareInput(msg) {
        const type = (msg.event === 'noteon' || msg.event === 'noteoff') ? 'note' : (msg.event === 'cc' ? 'cc' : null);
        if (!type) return { consumed: false, layer: this.activeLayer };

        const channel = msg.channel;
        const index = (type === 'note') ? msg.note : msg.controller;
        const value = (type === 'note') ? (msg.event === 'noteon' ? msg.velocity : 0) : msg.value;

        // 1. Fase MIDI Learn: capturar el primer botón o control activado
        if (this.isLearning && value > 0) {
            const captured = { type, channel, index, target: this.learnTarget };
            // Si el target no es personalizado, asigna al shiftBinding por defecto
            if (!this.learnTarget || this.learnTarget === 'shift') {
                this.setShiftBinding({ type, channel, index });
            }
            this.isLearning = false;
            this.learnTarget = null;
            return { consumed: true, learned: true, binding: captured };
        }

        // 2. Verificar si coincide con el botón Shift configurado
        if (this.shiftBinding && 
            this.shiftBinding.type === type && 
            this.shiftBinding.channel === channel && 
            this.shiftBinding.index === index) {

            this.handleShiftButton(value > 0);
            return { consumed: true, layer: this.activeLayer };
        }

        // Evento ordinario de interpretación
        return { consumed: false, layer: this.activeLayer };
    }

    /**
     * Maneja la pulsación / liberación del botón Shift según el modo (Flash / Toggle).
     */
    handleShiftButton(isPressed) {
        const previousLayer = this.activeLayer;

        if (this.mode === 'flash') {
            // Momentáneo: presionado pasa a Capa 1, liberado vuelve a Capa 0
            const targetLayer = isPressed ? 1 : 0;
            if (targetLayer !== this.activeLayer) {
                this.switchLayer(targetLayer, 'flash_press');
            }
        } else if (this.mode === 'toggle') {
            // Conmutado: conmuta solo en el flanco ascendente (al presionar)
            if (isPressed) {
                const nextLayer = (this.activeLayer + 1) % this.maxLayers;
                this.switchLayer(nextLayer, 'toggle_press');
            }
        }
    }

    /**
     * Conmuta a una capa específica y dispara la re-emisión en ráfaga (burst) del buffer.
     */
    switchLayer(newLayer, reason = 'manual') {
        if (newLayer < 0 || newLayer >= this.maxLayers) return;
        if (newLayer === this.activeLayer) return;

        const previousLayer = this.activeLayer;
        this.activeLayer = newLayer;

        // Notificar cambio de capa
        for (const cb of this.onLayerChangeCallbacks) {
            try { cb(this.activeLayer, previousLayer, reason); } catch (_) {}
        }

        // Disparar re-emisión instantánea del StateCache de la nueva capa
        this.flushLayer(this.activeLayer);
    }

    /**
     * Almacena en el StateCache el estado de un LED o control para una capa específica.
     */
    cacheState(layer, control) {
        if (layer < 0 || layer >= this.maxLayers) return;
        const key = `${control.type}_${control.channel}_${control.index}`;
        this.stateCaches[layer].set(key, {
            type: control.type,
            channel: control.channel,
            index: control.index,
            value: control.value,
            timestamp: Date.now()
        });
    }

    /**
     * Actualiza el estado de la capa activa (por ejemplo cuando el DAW envía feedback MIDI In).
     */
    cacheFeedback(control) {
        this.cacheState(this.activeLayer, control);
    }

    /**
     * Obtiene el mapa de estados de una capa.
     */
    getLayerCache(layer = this.activeLayer) {
        return this.stateCaches[layer] || new Map();
    }

    /**
     * Vuelca todos los estados guardados en la capa especificada hacia el hardware en una sola ráfaga.
     * Retorna métricas de tiempo de ejecución (en microsegundos / milisegundos).
     */
    flushLayer(layer = this.activeLayer) {
        const cache = this.stateCaches[layer];
        if (!cache || cache.size === 0) return { count: 0, durationMs: 0 };

        const startTime = process.hrtime.bigint();
        const items = Array.from(cache.values());

        // Emitir a los listeners registrados para despacho físico
        for (const cb of this.onHardwareEmitCallbacks) {
            try {
                cb(items);
            } catch (_) {}
        }

        const endTime = process.hrtime.bigint();
        const durationUs = Number(endTime - startTime) / 1000;
        const durationMs = durationUs / 1000;

        return {
            count: items.length,
            durationUs,
            durationMs,
            layer
        };
    }
}

module.exports = ShiftEngine;
