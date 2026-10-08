/**
 * OSC Binary Packet Encoder (OSC 1.0 Specification)
 * Construye buffers binarios OSC para envío de bajo overhead sobre UDP sin dependencias pesadas.
 */

function pad4(buffer) {
    const pad = (4 - (buffer.length % 4)) % 4;
    if (pad === 0) return buffer;
    return Buffer.concat([buffer, Buffer.alloc(pad, 0)]);
}

function writeString(str) {
    const cleanStr = String(str || '');
    const strBuf = Buffer.from(cleanStr + '\0', 'utf-8');
    return pad4(strBuf);
}

function encodeOSCMessage(address, typeTag, args) {
    if (typeof address !== 'string' || !address.startsWith('/')) {
        throw new Error('Dirección OSC inválida: debe ser string iniciando con "/"');
    }
    const safeTypeTag = typeof typeTag === 'string' ? typeTag : '';
    const safeArgs = Array.isArray(args) ? args : [];

    const addressBuf = writeString(address);
    const typeTagBuf = writeString(',' + safeTypeTag);
    const argsBuffers = [];

    for (let i = 0; i < safeTypeTag.length; i++) {
        const type = safeTypeTag[i];
        const val = safeArgs[i];

        if (type === 'f') {
            const buf = Buffer.alloc(4);
            const num = parseFloat(val);
            buf.writeFloatBE(isNaN(num) ? 0.0 : num, 0);
            argsBuffers.push(buf);
        } else if (type === 'i') {
            const buf = Buffer.alloc(4);
            const num = parseInt(val, 10);
            buf.writeInt32BE(isNaN(num) ? 0 : num, 0);
            argsBuffers.push(buf);
        } else if (type === 's') {
            argsBuffers.push(writeString(String(val !== undefined && val !== null ? val : '')));
        }
    }

    return Buffer.concat([addressBuf, typeTagBuf, ...argsBuffers]);
}

module.exports = {
    encodeOSCMessage
};
