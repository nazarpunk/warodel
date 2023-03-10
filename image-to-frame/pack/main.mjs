// noinspection JSUnusedAssignment,DuplicatedCode

import {Dropzone} from "../../web/dropzone.mjs";
import {GIF} from "../../gif/GIF.mjs";
import {RibbonHeader} from "../../web/ribbon-header.mjs";
import {ErrorMessage} from "../split/web/error-message.mjs";
import {GrowingPacker} from "../../utils/growing-packer.mjs";
import {nextDivisible, nextPow2} from "../../utils/utils.mjs";
import {ImagePreview} from "../../web/image-preview.mjs";
import {Cyberlink} from "../../web/cyberlink.mjs";

const dropzone = new Dropzone();
dropzone.accept = '.gif';
document.body.appendChild(dropzone);

/**
 * @param {File} file
 * @param {ArrayBuffer} buffer
 * @return {Promise<void>}
 */
const addFile = async (file, buffer) => {
	const gif = new GIF(buffer);
	gif.parse();

	const header = new RibbonHeader();
	header.text = `${file.name} #${gif.frames.length}`;
	document.body.appendChild(header);

	if (gif.errors.length) {
		const em = new ErrorMessage();
		em.errors = gif.errors;
		document.body.appendChild(em);
	}

	const packer = new GrowingPacker();

	for (const frame of gif.frames) {
		frame.imageData;
		packer.item = {index: frame.index, width: gif.width, height: gif.height};
	}

	packer.pack();

	const w = packer.width;
	const h = packer.height;

	const image = new ImagePreview();
	document.body.appendChild(image);
	image.size(w, h);

	for (const item of packer.items) {
		const frame = gif.frames[item.index];
		const {x, y} = item;
		image.ctx.putImageData(frame.imageDataFrame, x, y);
		image.tip(x, y, frame.index);
	}

	const buttons = document.createElement('div');
	buttons.classList.add('buttons');
	document.body.appendChild(buttons);

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d');

	/**
	 * @param {number} w
	 * @param {number} h
	 * @param {string} color
	 */
	const btn = (w, h, color) => {
		const ba = new Cyberlink();
		ba.color = color;
		ba.text = `${w}x${h}`;
		buttons.appendChild(ba);
		ba.addEventListener('click', async e => {
			e.preventDefault();
			e.stopPropagation();
			canvas.width = w;
			canvas.height = h;
			ctx.putImageData(image.ctx.getImageData(0, 0, image.canvas.width, image.canvas.height), 0, 0);

			/** @type {Blob} */
			const iblob = await new Promise(resolve => canvas.toBlob(blob => resolve(blob)));
			open(URL.createObjectURL(iblob), '_blank');
		});
	};

	btn(w, h, 'red');
	btn(nextPow2(w), nextPow2(h), 'green');
	btn(nextDivisible(w, 4), nextDivisible(h, 4), 'blue');

};

dropzone.addEventListener('bufferupload', async e => {
	const [file, buffer] = /** @type [File, ArrayBuffer] */ e.detail;
	await addFile(file, buffer);
});

if (location.host.indexOf('localhost') === 0) {
	let name;
	name = 'kitagawa-marin.gif';
	name = 'disposal3-2.gif';
	name = 'boobs1.gif';
	const response = await fetch(`../images/${name}`);
	const buffer = await response.arrayBuffer();

	await addFile(new File([], name), buffer);
}