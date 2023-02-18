/** @module MDX */

import {DWORD} from "../type/DWORD.mjs";
import {CHAR} from "../type/CHAR.mjs";

export class Texture {
	/**  @param {Reader} reader */
	constructor(reader) {
		this.ReplaceableId = new DWORD(reader);
		this.FileName = new CHAR(reader, 260);
		this.Flags = new DWORD(reader);
	}

	write() {
		this.ReplaceableId.write();
		this.FileName.write();
		this.Flags.write();
	}
}