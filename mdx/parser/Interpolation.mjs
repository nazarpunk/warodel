/** @module MDX */
import {Uint32} from "./Uint.mjs";
import {Parser} from "./Parser.mjs";
import {int2s} from "../utils/hex.mjs";

export class Interpolation {

	/**
	 * @param {number} id
	 * @param child
	 * @param {*?} count
	 */
	constructor(id, child, count) {
		this.id = id;
		this.child = child;
		this.count = count;
	}

	items = [];

	/** @param {DataView} view */
	read(view) {
		const id = view.getUint32(view.cursor, true);
		this.length = view.getUint32(view.cursor += 4, true);
		view.cursor += 4;
		if (id !== this.id) {
			throw new Error(`Interpolation wrong id: ${int2s(this.id)} != ${int2s(id)}`);
		}

		this.parser = new Parser();
		this.type = this.parser.add(Uint32);
		this.globalSequenceId = this.parser.add(Uint32);
		this.parser.read(view);

		for (let i = 0; i < this.length; i++) {
			const p = new InterpolationTrack(this);
			this.items.push(p);
			p.read(view);
		}
	}

	/** @param {DataView} view */
	write(view) {
		view.setUint32(view.cursor, this.id, true);
		view.setUint32(view.cursor += 4, this.items.length, true);
		view.cursor += 4;

		this.parser.write(view);
		for (const p of this.items) {
			p.write(view);
		}
	}

	toJSON() {
		return {
			id: int2s(this.id),
			length: this.length,
			type: this.type,
			items: this.items,
			globalSequenceId: this.globalSequenceId
		}
	}
}

export class InterpolationTrack {

	/** @param {Interpolation} parent */
	constructor(parent) {
		this.parent = parent;
	}

	/** @param {DataView} view */
	read(view) {
		this.time = view.getUint32(view.cursor, true);
		view.cursor += 4;

		this.value = new this.parent.child(this.parent.count);
		this.value.read(view);

		if (this.parent.type.value > 1) {
			this.inTan = new this.parent.child(this.parent.count);
			this.inTan.read(view);

			this.outTan = new this.parent.child(this.parent.count);
			this.inTan.read(view);
		}
	}

	/** @param {DataView} view */
	write(view) {
		view.setUint32(view.cursor, this.time, true);
		view.cursor += 4;
		this.value.write(view);
		this.inTan?.write(view);
		this.outTan?.write(view);
	}

	toJSON() {
		return {
			time: this.time,
			value: this.value,
			inTan: this.inTan,
			outTan: this.outTan,
		}
	}
}
