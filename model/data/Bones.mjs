import {ModelData} from "../ModelData.mjs";
import {NodeData} from "./NodeData.mjs";

export class Bones extends ModelData {
	/**
	 *  @param key
	 *  @param {Model} model
	 */
	constructor(key, model) {
		super(key);
		this.ChunkSize = model.dword();
		const end = model.byteOffset + this.ChunkSize;

		let i = 0;
		while (model.byteOffset < end) {
			i++;
			if (i > 1) break;
			this.bones.push(new Bone(model));
		}
	}

	/** @type {Bone[]} */
	bones = [];
}

class Bone {
	/** @param {Model} model */
	constructor(model) {
		this.node = new NodeData(model);
		this.GeosetId = model.dword();
		this.GeosetAnimationId = model.dword();
	}
}