export class FLOAT {
	/** @param {Reader} reader */
	constructor(reader) {
		this.reader = reader;
		this.value = this.reader.view.getFloat32(reader.byteOffset, true);
		reader.byteOffset += 4;
	}

	write() {
		this.reader.outputView(4).setFloat32(0, this.value, true);
	}
}