/** @module MDX */

import {Uint16, Uint32, Uint8} from "../parser/Uint.mjs";
import {Char} from "../parser/Char.mjs";
import {Extent} from "./Extent.mjs";
import {Float32} from "../parser/Float.mjs";
import {Parser} from "../parser/Parser.mjs";
import {Chunk} from "../parser/Chunk.mjs";
import {int2s} from "../utils/hex.mjs";

export class Geoset {

	/** @type {Vers} */ vers;

	/** @param {DataView} view */
	read(view) {
		this.parser = new Parser();

		this.vertexPositions = this.parser.add(new Child(Chunk.VRTX, Float32, 3));
		this.vertexNormals = this.parser.add(new Child(Chunk.NRMS, Float32, 3));
		this.faceTypeGroups = this.parser.add(new Child(Chunk.PTYP, Uint32));
		this.faceGroups = this.parser.add(new Child(Chunk.PCNT, Uint32));
		this.faces = this.parser.add(new Child(Chunk.PVTX, Uint16));
		this.vertexGroups = this.parser.add(new Child(Chunk.GNDX, Uint8));
		this.matrixGroups = this.parser.add(new Child(Chunk.MTGC, Uint32));
		this.matrixIndices = this.parser.add(new Child(Chunk.MATS, Uint32));
		this.materialId = this.parser.add(Uint32);
		this.selectionGroup = this.parser.add(Uint32);
		this.selectionFlags = this.parser.add(Uint32);
		if (this.vers.version > 800) {
			this.lod = this.parser.add(Uint32);
			this.lodName = this.parser.add(new Char(80));
		}
		this.parser.add(Extent);
		this.sequenceExtents = this.parser.add(new Child(null, Extent));
		if (this.vers.version > 800) {
			this.tangents = this.parser.add(new Child(Chunk.TANG, Float32, 4, true));
			this.skins = this.parser.add(new Child(Chunk.SKIN, Uint8, 1, true));
		}
		this.textureCoordinateSets = this.parser.add(new Child(Chunk.UVAS, new Child(Chunk.UVBS, Float32, 2)));

		this.parser.read(view);
	}

	toJSON() {
		return {
			vertexPositions: this.vertexPositions,
			vertexNormals: this.vertexNormals,
			faceTypeGroups: this.faceTypeGroups,
			faceGroups: this.faceGroups,
			faces: this.faces,
			vertexGroups: this.vertexGroups,
			matrixGroups: this.matrixGroups,
			matrixIndices: this.matrixIndices,
			materialId: this.materialId,
			selectionGroup: this.selectionGroup,
			selectionFlags: this.selectionFlags,
			lod: this.lod,
			lodName: this.lodName,
			sequenceExtents: this.sequenceExtents,
			tangents: this.tangents,
			skins: this.skins,
			textureCoordinateSets: this.textureCoordinateSets,
		}
	}
}

class Child {
	/**
	 * @param {?number} key
	 * @param child
	 * @param {number} lx
	 * @param {boolean} any
	 */
	constructor(key, child, lx = 1, any = false) {
		this.key = key;
		any && (this.id = key);
		this.child = child.copy ? child.copy() : child;
		this._lx = lx
	}

	copy() {
		return new this.constructor(this.key, this.child, this._lx);
	}

	items = [];

	/** @param {DataView} view */
	read(view) {
		if (this.key) {
			const id = view.getUint32(view.cursor, true);
			view.cursor += 4;
			if (id !== this.key) {
				throw new Error(`ChunkCountInclusive wrong id: ${int2s(this.key)} != ${int2s(id)}`);
			}
		}
		this.length = view.getUint32(view.cursor, true) * this._lx;
		view.cursor += 4;

		for (let i = 0; i < this.length; i++) {
			const p = typeof this.child === 'object' ? this.child : new this.child();
			this.items.push(p);
			p.read(view);
		}
	}

	/** @param {DataView} view */
	write(view) {
		if (this.key) {
			view.setUint32(view.cursor, this.key, true);
			view.cursor += 4;
		}
		view.setUint32(view.cursor, this.items.length / this._lx, true);
		view.cursor += 4;

		for (const i of this.items) {
			(i.write ? i : i.parser).write(view);
		}
	}

	toJSON() {
		return {
			length: this.length,
			items: this.items,
		}
	};
}
