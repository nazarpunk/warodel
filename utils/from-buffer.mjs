import fs from 'fs';

/**
 * @param {Buffer|ArrayBuffer} buffer
 * @return {ArrayBuffer}
 */
export default function(buffer) {
    if (buffer instanceof ArrayBuffer) return buffer;
    const ab = new ArrayBuffer(buffer.length);
    buffer.copy(new Uint8Array(ab));
    return ab;
}