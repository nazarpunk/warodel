/** @module MDX */
import {ChunkSize, StructSize} from "./StructSize.mjs";
import {int2s, s2s} from "../util/hex.mjs";
import {Reader} from "./Reader.mjs";

export class Parser {
	/** @param {Reader} reader */
	constructor(reader) {
		this.reader = reader;
	}

	_input = [];
	_output = [];

	add(parser) {
		const p = typeof parser === 'object' ? parser : new parser();
		p.reader = this.reader;
		this._input.push(p);
		return p;
	}

	static copyChild(child) {
		if (typeof child === 'object') {
			return child.copy();
		} else {
			return new child();
		}
	}

	read() {
		const map = new Map();
		for (const p of this._input) {
			// noinspection JSUnresolvedVariable
			const key = p.constructor.id || p.id;
			if (key) {
				map.set(key, p);
			}
		}

		let pSize, pSizeEnd;

		while (this._input.length > 0) {
			const p = this._input.shift();
			const o = this.reader.readOffset;

			const _read = p => {
				//const pid = p.constructor['id'] || p.id;
				//if (pid) console.log(pid, int2s(pid));
				p.read();
				this._output.push(p);
			};

			if (p instanceof StructSize) {
				pSize = p;
				pSizeEnd = this.reader.readOffset + this.reader.getUint32() + p.offset;
			}

			const pid = p.constructor['id'] || p.id;
			if (pid) {
				const map = new Map();
				map.set(pid, p);
				while (this._input.length > 0) {
					const pn = this._input.shift();
					const pnid = pn.constructor['id'] || pn.id;
					if (!pnid) {
						this._input.unshift(pn);
						break;
					}
					map.set(pnid, pn);
				}

				const end = pSize ? pSizeEnd : this.reader.view.byteLength;
				while (this.reader.readOffset < end) {
					const o = this.reader.readOffset;
					const key = this.reader.getUint32();

					if (map.has(key)) {
						_read(map.get(key));
						if (o === this.reader.readOffset) {
							break;
						}
						map.delete(key);
						if (map.size === 0) {
							break;
						}
						continue;
					}
					break;
				}
				continue;
			}

			_read(p);

			if (o === this.reader.readOffset) {
				//throw new Error('Parser infinity read!');
				console.error('Parser infinity read!');
				break;
			}
		}

		if (pSize) {
			if (this.reader.readOffset !== pSizeEnd) {
				//throw new Error(`StructSize is wrong: ${pSize.value} != ${value}`);
				console.error(`StructSize is wrong: ${this.reader.readOffset} != ${pSizeEnd}`);
				this.reader.readOffset = pSizeEnd;
			}
		}
	}

	write() {
		/** @type {ChunkSize} */ let chunk;
		let chunkOffset = 0;

		for (const p of this._output) {
			if (p instanceof StructSize) {
				chunk = p;
				chunkOffset = this.reader.output.byteLength;
			}

			if (!p.write) {
				p.parser.write();
			} else {
				p.write();
			}
		}

		if (chunk) {
			chunk.value = this.reader.output.byteLength - chunkOffset - chunk.offset;
			this.reader.updateUint32(chunk.value, chunkOffset);
		}
	}
}

export class Stop {
	/** @type {Reader} */ reader;

	read() {
		if (1) {
			let s = '';
			for (let i = 0; i < 50; i++) {
				s += String.fromCharCode(this.reader.view.getUint8(this.reader.readOffset + i));

				//const v = this.reader.view.getUint32(this.reader.byteOffset + i * 4, true);
				//console.log('stop', v, int2s(v));
			}
			console.log(s);
		}

		const v = this.reader.getUint32();
		throw new Error(`STOP ${v} | ${int2s(v)} | ${s2s(int2s(v))} | ${this.reader.readOffset}`);
	}
}