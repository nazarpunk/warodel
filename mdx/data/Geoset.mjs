/** @module MDX */

import {DWORD} from "../type/DWORD.mjs";
import {BYTE} from "../type/BYTE.mjs";
import {FLOAT} from "../type/FLOAT.mjs";
import {KEY} from "../type/KEY.mjs";
import {StructSize} from "../type/StructSize.mjs";
import {WORD} from "../type/WORD.mjs";

export class Geoset {
	/** @param {Reader} reader */
	constructor(reader) {
		this.inclusiveSize = new StructSize(reader, {inclusive: true});

		let len;

		// TODO move to generic structure
		this.vertexPositionKey = new KEY(reader, {name: 'VRTX'});
		len = new DWORD(reader).value;
		for (let i = 0; i < len; i++) {
			this.vertexPositions.push(new FLOAT(reader, 3));
		}

		this.vertexNormalsKey = new KEY(reader, {name: 'NRMS'});
		len = new DWORD(reader).value;
		for (let i = 0; i < len; i++) {
			this.vertexNormals.push(new FLOAT(reader, 3));
		}

		this.faceTypeGroupsKey = new KEY(reader, {name: 'PTYP'});
		len = new DWORD(reader).value;
		for (let i = 0; i < len; i++) {
			this.faceTypeGroups.push(new DWORD(reader));
		}

		this.faceGroupsKey = new KEY(reader, {name: 'PCNT'});
		len = new DWORD(reader).value;
		for (let i = 0; i < len; i++) {
			this.faceGroups.push(new DWORD(reader));
		}

		this.faceKey = new KEY(reader, {name: 'PVTX'});
		len = new DWORD(reader).value / 3;
		for (let i = 0; i < len; i++) {
			this.face.push(new WORD(reader, 3));
		}

		this.vertexGroupsKey = new KEY(reader, {name: 'GNDX'});
		len = new DWORD(reader).value;
		for (let i = 0; i < len; i++) {
			this.vertexGroups.push(new BYTE(reader));
		}

		this.matrixGroupKey = new KEY(reader, {name: 'MTGC'});
		len = new DWORD(reader).value;
		for (let i = 0; i < len; i++) {
			this.matrixGroup.push(new DWORD(reader));
		}

		this.matrixIndexKey = new KEY(reader, {name: 'MATS'});
		len = new DWORD(reader).value;
		for (let i = 0; i < len; i++) {
			this.matrixIndex.push(new DWORD(reader));
		}

		this.MaterialId = new DWORD(reader);
		this.SelectionGroup = new DWORD(reader);
		this.SelectionFlags = new DWORD(reader);
		this.BoundsRadius = new FLOAT(reader);
		this.MinimumExtent = new FLOAT(reader, 3);
		this.MaximumExtent = new FLOAT(reader, 3);

		this.extentLength = new DWORD(reader);
		for (let i = 0; i < this.extentLength.value; i++) {
			this.extent.push([new FLOAT(reader), new FLOAT(reader, 3), new FLOAT(reader, 3)]);
		}

		this.NrOfTextureVertexGroupsKey = new KEY(reader, {name: 'UVAS'});
		this.NrOfTextureVertexGroups = new DWORD(reader);

		this.vertexTexturePositionKey = new KEY(reader, {name: 'UVBS'});
		len = new DWORD(reader).value;
		for (let i = 0; i < len; i++) {
			this.vertexTexturePosition.push(new FLOAT(reader, 2));
		}

		this.inclusiveSize.check();
	}

	/** @type {FLOAT[]} */ vertexPositions = [];
	/** @type {FLOAT[]} */ vertexNormals = [];

	/**
	 * 4   - Triangles
	 * ??? - Triangle fan
	 * ??? - Triangle strip
	 * ??? - Quads
	 * ??? - Quad strip
	 * @type {DWORD[]}
	 */
	faceTypeGroups = [];

	/** @type {DWORD[]} */ faceGroups = [];
	/** @type {WORD[]} */ face = [];
	/** @type {BYTE[]} */ vertexGroups = [];
	/** @type {DWORD[]} */ matrixGroup = [];
	/** @type {DWORD[]} */ matrixIndex = [];

	/**
	 * 0  - None
	 * 1 - ???
	 * 2 - ???
	 * 4 - Unselectable
	 * @type {DWORD}
	 */
	SelectionFlags;
	/** @type {[FLOAT,FLOAT,FLOAT][]} */ extent = [];


	/** @type {FLOAT[]} */ vertexTexturePosition = [];

	write() {
		this.inclusiveSize.save();

		/**
		 * @param {KEY} key
		 * @param {*[]} list
		 * @param multiply
		 */
		const simpleList = (key, list, multiply = 1) => {
			key.write();
			key.writeInt(list.length * multiply);
			for (const v of list) {
				v.write();
			}
		};

		simpleList(this.vertexPositionKey, this.vertexPositions);
		simpleList(this.vertexNormalsKey, this.vertexNormals);
		simpleList(this.faceTypeGroupsKey, this.faceTypeGroups);
		simpleList(this.faceGroupsKey, this.faceGroups);
		simpleList(this.faceKey, this.face, 3);
		simpleList(this.vertexGroupsKey, this.vertexGroups);
		simpleList(this.matrixGroupKey, this.matrixGroup);
		simpleList(this.matrixIndexKey, this.matrixIndex);

		this.MaterialId.write();
		this.SelectionGroup.write();
		this.SelectionFlags.write();
		this.BoundsRadius.write();
		this.MinimumExtent.write();
		this.MaximumExtent.write();

		this.extentLength.writeValue(this.extent.length);
		for (const list of this.extent) {
			for (const e of list) {
				e.write();
			}
		}

		this.NrOfTextureVertexGroupsKey.write();
		this.NrOfTextureVertexGroups.write();

		simpleList(this.vertexTexturePositionKey, this.vertexTexturePosition);

		this.inclusiveSize.write();
	}
}