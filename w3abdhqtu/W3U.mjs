import {W3ABDHQTU} from './abstract/W3ABDHQTU.mjs';

export class W3U extends W3ABDHQTU {
    /** @param {Buffer|ArrayBuffer} buffer */
    constructor(buffer) {
        super(buffer, false);
    }

    /**
     * @param {string} json
     * @return {W3U}
     */
    static fromJSON(json) {
        return super._fromJSON(new W3U(new ArrayBuffer(0)), json, false);
    }

    /**
     * @param {string} ini
     * @return {W3U}
     */
    static fromTOML(ini) {
        return super._fromTOML(new W3U(new ArrayBuffer(0)), ini, false, {});
    }

    /** @return {string} */
    toTOML() {
        return super._toTOML({});
    }
}