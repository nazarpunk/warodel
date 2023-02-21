/** @module MDX */

import {Parser} from "../parser/Parser.mjs";
import {InclusiveSize} from "../parser/StructSize.mjs";
import {Uint32} from "../parser/Uint32.mjs";
import {Float32} from "../parser/Float32.mjs";
import {Float32List} from "../parser/Float32List.mjs";
import {Interpolation} from "../parser/Interpolation.mjs";

export class Layer {
	/** @type {Reader} */ reader;

	read() {
		this.parser = new Parser(this.reader);

		this.inclusiveSize = this.parser.add(InclusiveSize);
		this.filterMode = this.parser.add(Uint32);
		this.shadingFlags = this.parser.add(Uint32);
		this.textureId = this.parser.add(Uint32);
		this.textureAnimationId = this.parser.add(Uint32);
		this.coordId = this.parser.add(Uint32);
		this.alpha = this.parser.add(Float32);


		if (this.reader.version > 800) {
			this.emissiveGain = this.parser.add(Float32);
			this.fresnelColor = this.parser.add(new Float32List(3));
			this.fresnelOpacity = this.parser.add(Float32);
			this.fresnelTeamColor = this.parser.add(Float32);
		}

		this.textureIdTrack = this.parser.add(new Interpolation(0x46544d4b/*KMTF*/, Uint32));
		this.alphaTrack = this.parser.add(new Interpolation(0x41544d4b/*KMTA*/, Float32));
		if (this.reader.version > 800) {
			this.emissiveGainTrack = this.parser.add(new Interpolation(0x45544d4b/*KMTE*/, Float32));
		}

		if (this.reader.version > 900) {
			this.fresnelColorTrack = this.parser.add(new Interpolation(0x3343464b/*KFC3*/, Float32));
			this.fresnelAlphaTrack = this.parser.add(new Interpolation(0x4143464b/*KFCA*/, Float32List, 3));
			this.fresnelTeamColorTrack = this.parser.add(new Interpolation(0x4354464b/*KFTC*/, Float32));
		}

		this.parser.read();

		//console.log(JSON.stringify(this, null, 4));
	}

	toJSON() {
		return {
			inclusiveSize: this.inclusiveSize,
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

/*
Layer {
  uint32 inclusiveSize
  uint32 filterMode
  uint32 shadingFlags
  uint32 textureId
  uint32 textureAnimationId
  uint32 coordId
  float alpha

  if (version > 800) {
    float emissiveGain
    float[3] fresnelColor
    float fresnelOpacity
    float fresnelTeamColor
  }

  (KMTF)
  (KMTA)
  if (version > 800) {
    (KMTE)
  }
  if (version > 900) {
    (KFC3)
    (KFCA)
    (KFTC)
  }
}
 */