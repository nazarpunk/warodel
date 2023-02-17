//TODO chunk container
import {StructSize} from "../type/StructSize.mjs";
import {FLOAT} from "../type/FLOAT.mjs";
import {DWORD} from "../type/DWORD.mjs";
import {VECTOR} from "../type/VECTOR.mjs";
import {KEY} from "../type/KEY.mjs";
import {Alpha} from "./Alpha.mjs";
import {Translations} from "./Translations.mjs";

export class GeosetAnimations {
	/** @param {KEY} key */
	constructor(key) {
		const r = key.reader;
		this.key = key;
		this.chunkSize = new StructSize(r, {chunk: true});
		while (r.byteOffset < this.chunkSize.end) {
			this.list.push(new GeosetAnimation(r));
		}
		this.chunkSize.check();
	}

	/** @type {GeosetAnimation[]} */ list = [];

	write() {
		this.key.write();
		this.chunkSize.save();
		for (const e of this.list) {
			e.write();
		}
		this.chunkSize.write();
	}
}

class GeosetAnimation {
	/** @param {Reader} reader */
	constructor(reader) {
		this.inclusiveSize = new StructSize(reader, {inclusive: true});
		this.Alpha = new FLOAT(reader);
		this.Flags = new DWORD(reader);
		this.Color = new VECTOR(reader, 3);
		this.GeosetId = new DWORD(reader);

		while (reader.byteOffset < this.inclusiveSize.end) {
			const key = new KEY(reader);
			switch (key.name) {
				case 'KGAO':
					this.AlphaStruct = new Alpha(key);
					break;
				case 'KGAC':
					this.ColorStruct = new Translations(key);
					break;
				default:
					throw `GeosetAnimation wrong key: ${key.name}`;
			}
		}
	}

	/**
	 * 1 - DropShadow
	 * 2 - Color
	 * @type {DWORD}
	 */
	Flags;

	write() {
		this.inclusiveSize.save();
		this.Alpha.write();
		this.Flags.write();
		this.Color.write();
		this.GeosetId.write();
		this.AlphaStruct?.write();
		this.ColorStruct?.write();
		this.inclusiveSize.write();
	}
}
