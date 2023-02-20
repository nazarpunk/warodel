/** @module MDX */
import {Parser} from "../parser/Parser.mjs";
import {Key} from "../type/KEY.mjs";

export class Format {
	/**
	 * @constant
	 * @type {number}
	 */
	static id = 0x584c444d; // MDLX

	/** @type {Reader} reader */ reader;

	read() {
		this.parser = new Parser(this.reader);
		this.key = this.parser.add(new Key(Format.id));
		this.parser.read();
	}

	write() {
		this.parser.write();
	}

	toJSON() {
		return this.key.toJSON()
	}
}