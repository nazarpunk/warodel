/** @module MDX */

import {Parser} from "../parser/Parser.mjs";
import {Char} from "../parser/Char.mjs";
import {Uint32} from "../parser/Uint32.mjs";
import {Float32} from "../parser/Float32.mjs";
import {Float32List} from "../parser/Float32List.mjs";

export class Sequence {
	/**  @param {Reader} reader */
	constructor(reader) {
		this.reader = reader;
	}

	read() {
		this.parser = new Parser(this.reader);
		this.name = this.parser.add(new Char(80));
		this.intervalStart = this.parser.add(Uint32);
		this.intervalEnd = this.parser.add(Uint32);
		this.moveSpeed = this.parser.add(Float32);
		this.flags = this.parser.add(Uint32);
		this.rarity = this.parser.add(Float32);
		this.syncPoint = this.parser.add(Uint32);
		this.boundsRadius = this.parser.add(Float32);
		this.minimumExtent = this.parser.add(new Float32List(3));
		this.maximumExtent = this.parser.add(new Float32List(3));
		this.parser.read();
	}

	toJSON() {
		return {
			name: this.name,
			intervalStart: this.intervalStart,
			intervalEnd: this.intervalEnd,
			moveSpeed: this.moveSpeed,
			flags: this.flags,
			rarity: this.rarity,
			syncPoint: this.syncPoint,
			boundsRadius: this.boundsRadius,
			minimumExtent: this.minimumExtent,
			maximumExtent: this.maximumExtent,
		}
	}

}