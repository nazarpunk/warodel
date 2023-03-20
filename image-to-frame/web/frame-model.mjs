// noinspection CssUnusedSymbol

import {RibbonHeader} from "../../web/ribbon-header.mjs";
import {AnimatedTexture} from "./animated-texture.mjs";
import {Cyberlink} from "../../web/cyberlink.mjs";
import {nextDivisible, nextPow2} from "../../utils/utils.mjs";
import {InterpolationTrack} from "../../mdx/parser/Interpolation.mjs";
import {Float32List} from "../../mdx/parser/Float.mjs";
import {MDX} from "../../mdx/MDX.mjs";

export class FrameModel extends HTMLElement {
	constructor() {
		super();

		this.#shadow = this.attachShadow({mode: 'open'});
		this.#shadow.adoptedStyleSheets = [sheet];
	}

	/** @type {ShadowRoot} */ #shadow;

	/** @type {MDX} */ model;

	/**
	 * @param {File} file
	 * @param {ArrayBuffer} buffer
	 */
	async add(file, buffer) {

		RibbonHeader.fromText(file.name, this.#shadow);

		const texture = new AnimatedTexture();
		texture.buffer = buffer;
		this.#shadow.appendChild(texture);

		const buttons = document.createElement('div');
		buttons.classList.add('buttons');
		this.#shadow.appendChild(buttons);

		/** @type {TextureSwitcher} */
		const toggler = document.querySelector('/*noinspection CssInvalidHtmlTagReference*/texture-switcher');
		let pw = texture.packer.width;
		let ph = texture.packer.height;

		const filename = file.name.replace(/\.[a-z]+$/, '');

		const mdx = new Cyberlink();
		buttons.appendChild(mdx);
		mdx.color = 'red';
		mdx.text = 'MDX';
		mdx.addEventListener('click', async () => {
			this.model.textures.items[0].filename.value = `${filename}.${toggler.active ? 'dds' : 'blp'}`;

			const iw = texture.gif.width;
			const ih = texture.gif.height;

			// geoset
			const geoset = this.model.geoset;
			const sets = geoset.textureCoordinateSets.items[0].items;
			const x = iw / pw;
			const y = ih / ph;

			sets[0].value = x;
			sets[1].value = y;

			sets[2].value = 0;
			sets[3].value = 0;

			sets[4].value = 0;
			sets[5].value = y;

			sets[6].value = x;
			sets[7].value = 0;

			// vertex
			const pos = geoset.vertexPositions.items;
			const vw = iw * .0005;
			const vh = ih * .0005;

			pos[0].value = vw;
			pos[1].value = -vh;
			pos[2].value = 0;

			pos[3].value = -vw;
			pos[4].value = vh;
			pos[5].value = 0;

			pos[6].value = -vw;
			pos[7].value = -vh;
			pos[8].value = 0;

			pos[9].value = vw;
			pos[10].value = vh;
			pos[11].value = 0;

			// faces
			const face = geoset.faces.items;
			face[0].value = 0;
			face[1].value = 1;
			face[2].value = 2;
			face[3].value = 0;
			face[4].value = 3;
			face[5].value = 1;

			// extent
			const model = this.model.model.items[0];
			model.minimumExtent.list = [-vw, -vh, 0];
			model.maximumExtent.list = [vw, vh, 0];

			// filter mode
			this.model.materials.items[0].layers.items[0].filterMode.value = 1;

			// animation
			const translations = this.model.textureAnimations.items[0].translations;
			translations.items = [];
			let time = 0;
			for (const item of texture.packer.items) {
				const frame = texture.gif.frames[item.index];
				const t = new InterpolationTrack(translations);
				t.time = time;
				time += frame.delay * 10;
				t.value = new Float32List(3);
				t.value.list = [item.x / pw, item.y / ph, 0];
				translations.items.push(t);
			}

			const seqs = this.model.sequences.items[0];
			seqs.intervalEnd.value = time;
			seqs.minimumExtent.list = model.minimumExtent.list;
			seqs.maximumExtent.list = model.maximumExtent.list;

			if (location.host.indexOf('localhost') === 0) {
				const response = await fetch(`images/anime.mdx`);
				const modelBuffer = await response.arrayBuffer();
				const test = new MDX(modelBuffer);
				test.read();

				console.log(1,this.model.sequences.items[0]);
				console.log(2,test.sequences.items[0]);

				//console.log(1,this.model.textureAnimations.items[0].translations);
				//console.log(1,test.textureAnimations.items[0].translations);
				return;
			}

			const a = document.createElement('a');
			a.href = URL.createObjectURL(new Blob([this.model.write()]));
			a.target = '_blank';
			a.download = `${filename}.mdx`;
			a.click();
		});

		const png = new Cyberlink();
		buttons.appendChild(png);
		png.color = 'green';
		png.addEventListener('click', async () => {
			const canvas = document.createElement('canvas');
			const ctx = canvas.getContext('2d');
			canvas.width = pw;
			canvas.height = ph;
			ctx.putImageData(texture.imageData, 0, 0);

			/** @type {Blob} */
			const iblob = await new Promise(resolve => canvas.toBlob(blob => resolve(blob)));

			const a = document.createElement('a');
			a.href = URL.createObjectURL(iblob);
			a.target = '_blank';
			a.download = `${filename}.png`;
			a.click();
		});

		/** @param {number} active */
		const recalcSize = active => {
			if (active) {
				pw = nextDivisible(texture.packer.width, 4);
				ph = nextDivisible(texture.packer.height, 4);
			} else {
				pw = nextPow2(texture.packer.width);
				ph = nextPow2(texture.packer.height);
			}
			png.text = `${pw}x${ph}`;
		};
		recalcSize(toggler.active);

		toggler.addEventListener('toggle-change', () => {
			recalcSize(toggler.active);
		});
	}

}

const sheet = new CSSStyleSheet();
// noinspection CssUnresolvedCustomProperty
sheet.replaceSync(
	//language=CSS
	`
		:host {
			display: flex;
			justify-content: center;
			flex-direction: column;
			gap: 1rem;
		}

		.buttons {
			display: flex;
			flex-wrap: wrap;
			justify-content: space-evenly;
			gap: 1rem;
		}

	`);

customElements.define('frame-model', FrameModel);
