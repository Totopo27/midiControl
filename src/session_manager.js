/**
 * Session & Multi-Client Registry (midiOSCControl)
 * Gestiona clientes/proyectos concurrentes con asignación determinista de canal MIDI y puerto OSC.
 */

class SessionRegistry {
    constructor() {
        this.sessions = new Map(); // clientId -> SessionConfig
    }

    /**
     * Registra o actualiza la configuración de un cliente/proyecto.
     * @param {string} clientId - Identificador único del proyecto (ej: 'wilson-keyboards', 'diapason-microtonal')
     * @param {Object} options
     * @param {number} options.midiChannel - Canal MIDI (1 al 16)
     * @param {number} [options.oscPort=57120] - Puerto UDP OSC de destino
     * @param {string} [options.oscHost='127.0.0.1'] - Host OSC de destino
     * @param {string} [options.oscPrefix=''] - Prefijo de ruta OSC (ej: '/wilson')
     * @param {string} [options.label] - Nombre legible
     */
    registerClient(clientId, options = {}) {
        if (!clientId || typeof clientId !== 'string') {
            throw new Error('clientId debe ser un string válido no vacío.');
        }

        const rawChannel = options.midiChannel !== undefined ? parseInt(options.midiChannel, 10) : 1;
        if (isNaN(rawChannel) || rawChannel < 1 || rawChannel > 16) {
            throw new Error(`Canal MIDI inválido (${options.midiChannel}). Debe estar entre 1 y 16.`);
        }

        const rawOscPort = options.oscPort !== undefined ? parseInt(options.oscPort, 10) : 57120;
        if (isNaN(rawOscPort) || rawOscPort < 1024 || rawOscPort > 65535) {
            throw new Error(`Puerto OSC inválido (${options.oscPort}). Debe estar entre 1024 y 65535.`);
        }

        const oscHost = options.oscHost ? String(options.oscHost).trim() : '127.0.0.1';
        let oscPrefix = options.oscPrefix ? String(options.oscPrefix).trim() : '';
        if (oscPrefix && !oscPrefix.startsWith('/')) {
            oscPrefix = '/' + oscPrefix;
        }

        // Detección de colisiones informativas
        const conflicts = this.checkConflicts(clientId, rawChannel, rawOscPort, oscHost);

        const existing = this.sessions.get(clientId);
        const session = {
            clientId,
            label: options.label || clientId,
            midiChannel: rawChannel, // 1-16
            zeroIndexedChannel: rawChannel - 1, // 0-15
            oscPort: rawOscPort,
            oscHost,
            oscPrefix,
            activeNotes: existing ? existing.activeNotes : new Map(),
            registeredAt: existing ? existing.registeredAt : Date.now(),
            updatedAt: Date.now()
        };

        this.sessions.set(clientId, session);

        return {
            session: this.getSessionSummary(clientId),
            conflicts
        };
    }

    checkConflicts(clientId, midiChannel, oscPort, oscHost) {
        const warnings = [];
        for (const [id, session] of this.sessions.entries()) {
            if (id === clientId) continue;

            if (session.midiChannel === midiChannel) {
                warnings.push({
                    type: 'midi_channel_shared',
                    message: `Canal MIDI ${midiChannel} compartido con '${id}'.`,
                    sharedWith: id,
                    channel: midiChannel
                });
            }

            if (session.oscPort === oscPort && session.oscHost === oscHost) {
                warnings.push({
                    type: 'osc_port_shared',
                    message: `Puerto OSC ${oscHost}:${oscPort} compartido con '${id}'.`,
                    sharedWith: id,
                    port: oscPort,
                    host: oscHost
                });
            }
        }
        return warnings;
    }

    getClient(clientId) {
        return this.sessions.get(clientId) || null;
    }

    hasClient(clientId) {
        return this.sessions.has(clientId);
    }

    unregisterClient(clientId) {
        return this.sessions.delete(clientId);
    }

    recordNoteOn(clientId, note) {
        const session = this.sessions.get(clientId);
        if (session) {
            session.activeNotes.set(note, Date.now());
        }
    }

    recordNoteOff(clientId, note) {
        const session = this.sessions.get(clientId);
        if (session) {
            session.activeNotes.delete(note);
        }
    }

    clearClientNotes(clientId) {
        const session = this.sessions.get(clientId);
        if (!session) return [];
        const notes = Array.from(session.activeNotes.keys());
        session.activeNotes.clear();
        return notes;
    }

    getActiveNotes(clientId) {
        const session = this.sessions.get(clientId);
        return session ? Array.from(session.activeNotes.keys()) : [];
    }

    getSessionSummary(clientId) {
        const session = this.sessions.get(clientId);
        if (!session) return null;
        return {
            clientId: session.clientId,
            label: session.label,
            midiChannel: session.midiChannel,
            oscPort: session.oscPort,
            oscHost: session.oscHost,
            oscPrefix: session.oscPrefix,
            activeNotesCount: session.activeNotes.size
        };
    }

    listSessions() {
        const list = [];
        for (const id of this.sessions.keys()) {
            list.push(this.getSessionSummary(id));
        }
        return list;
    }
}

module.exports = SessionRegistry;
