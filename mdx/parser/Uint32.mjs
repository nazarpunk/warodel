/** @module MDX */
export class Uint32 {
	/** @type {Reader} */ reader;

	read() {
		this.value = this.reader.getUint32();
		this.reader.next32();
	}

	write() {
		this.reader.outputView(4).setUint32(0, this.value, true);
	}

	toJSON() {
		return this.value;
	}
}