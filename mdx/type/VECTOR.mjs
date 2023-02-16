import {FLOAT} from "./FLOAT.mjs";
import {WORD} from "./WORD.mjs";

export class VECTOR {
	/**
	 * @param {Reader} reader
	 * @param {number} length
	 * @param {boolean} word
	 */
	constructor(reader, length, {word = false} = {}) {
		this.length = length;
		for (let i = 0; i < length; i++) {
			if (word) {
				this.value.push(new WORD(reader));
			} else {
				this.value.push(new FLOAT(reader));
			}
		}
	}

	/** @type {FLOAT|WORD[]} */ value = [];

	write() {
		for (let i = 0; i < this.length; i++) {
			this.value[i].write();
		}
	}
}