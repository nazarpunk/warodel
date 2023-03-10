/** @module MDX */

import {Uint32} from "../parser/Uint.mjs";
import {Float32, Float32List} from "../parser/Float.mjs";
import {Parser} from "../parser/Parser.mjs";
import {Interpolation} from "../parser/Interpolation.mjs";
import {Chunk} from "../parser/Chunk.mjs";

export class Layer {

	/** @type {Vers} */ vers;

	/** @param {DataView} view */
	read(view) {
		this.parser = new Parser();

		this.filterMode = this.parser.add(Uint32);
		this.shadingFlags = this.parser.add(Uint32);
		this.textureId = this.parser.add(Uint32);
		this.textureAnimationId = this.parser.add(Uint32);
		this.coordId = this.parser.add(Uint32);
		this.alpha = this.parser.add(Float32);

		if (this.vers.version > 800) {
			this.emissiveGain = this.parser.add(Float32);
			this.fresnelColor = this.parser.add(new Float32List(3));
			this.fresnelOpacity = this.parser.add(Float32);
			this.fresnelTeamColor = this.parser.add(Float32);
		}

		if (this.vers.version >= 1100) {
			this.parser.add(ShaderType);
		}

		if (this.vers.version > 800) {
			this.emissiveGainTrack = this.parser.add(new Interpolation(Chunk.KMTE, Float32));
		}

		this.textureIdTrack = this.parser.add(new Interpolation(Chunk.KMTF, Uint32));
		this.alphaTrack = this.parser.add(new Interpolation(Chunk.KMTA, Float32));

		if (this.vers.version > 900) {
			this.fresnelColorTrack = this.parser.add(new Interpolation(Chunk.KFC3, Float32List, 3));
			this.fresnelAlphaTrack = this.parser.add(new Interpolation(Chunk.KFCA, Float32));
			this.fresnelTeamColorTrack = this.parser.add(new Interpolation(Chunk.KFTC, Float32));
		}

		this.parser.read(view);
	}

	toJSON() {
		return {
			filterMode: this.filterMode,
			shadingFlags: this.shadingFlags,
			textureId: this.textureId,
			textureIdTrack: this.textureIdTrack,
			textureAnimationId: this.textureAnimationId,
			coordId: this.coordId,
			alpha: this.alpha,
			alphaTrack: this.alphaTrack,
			emissiveGain: this.emissiveGain,
			fresnelColor: this.fresnelColor,
			fresnelOpacity: this.fresnelOpacity,
			fresnelTeamColor: this.fresnelTeamColor,
			emissiveGainTrack: this.emissiveGainTrack,
			fresnelColorTrack: this.fresnelColorTrack,
			fresnelAlphaTrack: this.fresnelAlphaTrack,
			fresnelTeamColorTrack: this.fresnelTeamColorTrack,
		}
	}
}


class ShaderType {

	/** @param {DataView} view */
	read(view) {
		this.shaderTypeId = view.getUint32(view.cursor, true);
		this.textureIdCount = view.getUint32(view.cursor += 4, true);
		view.cursor += 4;

		for (let i = 0; i < this.textureIdCount; i++) {
			const a = view.getUint32(view.cursor, true);
			this.texture.push(a);
			view.cursor += 4;

			const b = view.getUint32(view.cursor, true);
			this.texture.push(b);
			view.cursor += 4;
		}
	}

	texture = [];

	/** @param {DataView} view */
	write(view) {
		view.setUint32(view.cursor, this.shaderTypeId, true);
		view.setUint32(view.cursor += 4, this.textureIdCount, true);
		view.cursor += 4;
		for (const t of this.texture) {
			view.setUint32(view.cursor, t, true);
			view.cursor += 4;
		}
	}
}