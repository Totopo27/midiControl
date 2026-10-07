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
    const strBuf = Buffer.from(str + '\0', 'utf-8');
    return pad4(strBuf);
}

function encodeOSCMessage(address, typeTag, args) {
    const addressBuf = writeString(address);
    const typeTagBuf = writeString(',' + typeTag);
    const argsBuffers = [];

    for (let i = 0; i < typeTag.length; i++) {
        const type = typeTag[i];
        const val = args[i];

        if (type === 'f') {
            const buf = Buffer.alloc(4);
            buf.writeFloatBE(parseFloat(val), 0);
            argsBuffers.push(buf);
        } else if (type === 'i') {
            const buf = Buffer.alloc(4);
            buf.writeInt32BE(parseInt(val, 10), 0);
            argsBuffers.push(buf);
        } else if (type === 's') {
            argsBuffers.push(writeString(String(val)));
        }
    }

    return Buffer.concat([addressBuf, typeTagBuf, ...argsBuffers]);
}

module.exports = {
    encodeOSCMessage
};
