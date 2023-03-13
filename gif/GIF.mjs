export class GIF {
	/**
	 * @param {ArrayBuffer} buffer
	 */
	constructor(buffer) {
		this.buffer = new Uint8Array(buffer);
		this.view = new DataView(buffer);

		let p = 0;

		// - Header (GIF87a or GIF89a).
		if (this.buffer[p++] !== 0x47 || this.buffer[p++] !== 0x49 || this.buffer[p++] !== 0x46 ||
			this.buffer[p++] !== 0x38 || (this.buffer[p++] + 1 & 0xfd) !== 0x38 || this.buffer[p++] !== 0x61) {
			throw new Error("Invalid GIF 87a/89a header.");
		}

		// - Logical Screen Descriptor.
		this.width = this.buffer[p++] | this.buffer[p++] << 8;
		this.height = this.buffer[p++] | this.buffer[p++] << 8;

		const pf0 = this.buffer[p++];  // <Packed Fields>.
		const global_palette_flag = pf0 >> 7;
		const num_global_colors_pow2 = pf0 & 0x7;
		const num_global_colors = 1 << num_global_colors_pow2 + 1;
		p++; //const background = buf[p++];
		p++; //buf[p++];  // Pixel aspect ratio (unused?).

		let global_palette_offset = null;
		let global_palette_size = null;

		if (global_palette_flag) {
			global_palette_offset = p;
			global_palette_size = num_global_colors;
			p += num_global_colors * 3;  // Seek past palette.
		}

		let no_eof = true;

		/** @type {Frame[]}} */ this.frames = [];

		let delay = 0;
		let transparent_index = null;
		let disposal = 0;

		let loop_count = null;

		while (no_eof && p < this.buffer.length) {
			switch (this.buffer[p++]) {
				case 0x21:  // Graphics Control Extension Block
					switch (this.buffer[p++]) {
						case 0xff:  // Application specific block
							// Try if it's a Netscape block (with animation loop counter).
							if (this.buffer[p] !== 0x0b ||  // 21 FF already read, check block size.
								// NETSCAPE2.0
								this.buffer[p + 1] === 0x4e && this.buffer[p + 2] === 0x45 && this.buffer[p + 3] === 0x54 &&
								this.buffer[p + 4] === 0x53 && this.buffer[p + 5] === 0x43 && this.buffer[p + 6] === 0x41 &&
								this.buffer[p + 7] === 0x50 && this.buffer[p + 8] === 0x45 && this.buffer[p + 9] === 0x32 &&
								this.buffer[p + 10] === 0x2e && this.buffer[p + 11] === 0x30 &&
								// Sub-block
								this.buffer[p + 12] === 0x03 && this.buffer[p + 13] === 0x01 && this.buffer[p + 16] === 0) {
								p += 14;
								loop_count = this.buffer[p++] | this.buffer[p++] << 8;
								p++;  // Skip terminator.
							} else {  // We don't know what it is, just try to get past it.
								p += 12;
								while (true) {  // Seek through subblocks.
									let block_size = this.buffer[p++];
									// Bad block size (ex: undefined from an out of bounds read).
									if (!(block_size >= 0)) throw Error("Invalid block size");
									if (block_size === 0) break;  // 0 size is terminator
									p += block_size;
								}
							}
							break;

						case 0xf9:  // Graphics Control Extension
							if (this.buffer[p++] !== 0x4 || this.buffer[p + 4] !== 0)
								throw new Error("Invalid graphics extension block.");
							const pf1 = this.buffer[p++];
							delay = this.buffer[p++] | this.buffer[p++] << 8;
							transparent_index = this.buffer[p++];
							if ((pf1 & 1) === 0) transparent_index = null;
							disposal = pf1 >> 2 & 0x7;
							p++;  // Skip terminator.
							break;

						// Plain Text Extension could be present and we just want to be able
						// to parse past it.  It follows the block structure of the comment
						// extension enough to reuse the path to skip through the blocks.
						case 0x01:  // Plain Text Extension (fallthrough to Comment Extension)
						case 0xfe:  // Comment Extension.
							while (true) {  // Seek through subblocks.
								let block_size = this.buffer[p++];
								// Bad block size (ex: undefined from an out of bounds read).
								if (!(block_size >= 0)) throw Error("Invalid block size");
								if (block_size === 0) break;  // 0 size is terminator
								// console.log(buf.slice(p, p+block_size).toString('ascii'));
								p += block_size;
							}
							break;

						default:
							throw new Error(
								"Unknown graphic control label: 0x" + this.buffer[p - 1].toString(16));
					}
					break;

				case 0x2c:  // Image Descriptor.
					const x = this.buffer[p++] | this.buffer[p++] << 8;
					const y = this.buffer[p++] | this.buffer[p++] << 8;
					const w = this.buffer[p++] | this.buffer[p++] << 8;
					const h = this.buffer[p++] | this.buffer[p++] << 8;
					const pf2 = this.buffer[p++];
					const local_palette_flag = pf2 >> 7;
					const interlace_flag = pf2 >> 6 & 1;
					const num_local_colors_pow2 = pf2 & 0x7;
					const num_local_colors = 1 << num_local_colors_pow2 + 1;
					let palette_offset = global_palette_offset;
					let palette_size = global_palette_size;
					let has_local_palette = false;
					if (local_palette_flag) {
						has_local_palette = true;
						palette_offset = p;  // Override with local palette.
						palette_size = num_local_colors;
						p += num_local_colors * 3;  // Seek past palette.
					}

					const data_offset = p;

					p++;  // codesize
					while (true) {
						const block_size = this.buffer[p++];
						// Bad block size (ex: undefined from an out of bounds read).
						if (!(block_size >= 0)) throw Error("Invalid block size");
						if (block_size === 0) break;  // 0 size is terminator
						p += block_size;
					}

					const frame = new Frame(
						this, x, y, w, h,
						delay, disposal,
						!!interlace_flag,
						transparent_index,
						data_offset,
						p - data_offset,
						has_local_palette,
						palette_offset,
						palette_size,
					);

					this.frames.push(frame);
					break;

				case 0x3b:  // Trailer Marker (end of file).
					no_eof = false;
					break;

				default:
					throw new Error("Unknown gif block: 0x" + this.buffer[p - 1].toString(16));
			}
		}
	}
}

const LZWOutputIndexStream = (code_stream, p, output, output_length) => {
	const min_code_size = code_stream[p++];

	const clear_code = 1 << min_code_size;
	const eoi_code = clear_code + 1;
	let next_code = eoi_code + 1;

	let cur_code_size = min_code_size + 1;  // Number of bits per code.
	// NOTE: This shares the same name as the encoder, but has a different
	// meaning here.  Here this masks each code coming from the code stream.
	let code_mask = (1 << cur_code_size) - 1;
	let cur_shift = 0;
	let cur = 0;

	let op = 0;  // Output pointer.

	let subblock_size = code_stream[p++];

	const code_table = new Int32Array(4096);  // Can be signed, we only use 20 bits.

	let prev_code = null;  // Track code-1.

	while (true) {
		// Read up to two bytes, making sure we always 12-bits for max sized code.
		while (cur_shift < 16) {
			if (subblock_size === 0) {
				// No more data to be read.
				break;
			}

			cur |= code_stream[p++] << cur_shift;
			cur_shift += 8;

			if (subblock_size === 1) {  // Never let it get to 0 to hold logic above.
				subblock_size = code_stream[p++];  // Next subblock.
			} else {
				--subblock_size;
			}
		}

		// We should never really get here, we should have received
		// and EOI.
		if (cur_shift < cur_code_size) {
			break;
		}

		const code = cur & code_mask;
		cur >>= cur_code_size;
		cur_shift -= cur_code_size;

		// Maybe should check that the first code was a clear code,
		// at least this is what you're supposed to do.  But actually our encoder
		// now doesn't emit a clear code first anyway.
		if (code === clear_code) {
			// We don't actually have to clear the table.  This could be a good idea
			// for greater error checking, but we don't really do any anyway.  We
			// will just track it with next_code and overwrite old entries.

			next_code = eoi_code + 1;
			cur_code_size = min_code_size + 1;
			code_mask = (1 << cur_code_size) - 1;

			// Don't update prev_code ?
			prev_code = null;
			continue;
		} else if (code === eoi_code) {
			break;
		}

		// We have a similar situation as the decoder, where we want to store
		// variable length entries (code table entries), but we want to do in a
		// faster manner than an array of arrays.  The code below stores sort of a
		// linked list within the code table, and then "chases" through it to
		// construct the dictionary entries.  When a new entry is created, just the
		// last byte is stored, and the rest (prefix) of the entry is only
		// referenced by its table entry.  Then the code chases through the
		// prefixes until it reaches a single byte code.  We have to chase twice,
		// first to compute the length, and then to actually copy the data to the
		// output (backwards, since we know the length).  The alternative would be
		// storing something in an intermediate stack, but that doesn't make any
		// more sense.  I implemented an approach where it also stored the length
		// in the code table, although it's a bit tricky because you run out of
		// bits (12 + 12 + 8), but I didn't measure much improvements (the table
		// entries are generally not the long).  Even when I created benchmarks for
		// very long table entries the complexity did not seem worth it.
		// The code table stores the prefix entry in 12 bits and then the suffix
		// byte in 8 bits, so each entry is 20 bits.

		const chase_code = code < next_code ? code : prev_code;

		// Chase what we will output, either {CODE} or {CODE-1}.
		let chase_length = 0;
		let chase = chase_code;
		while (chase > clear_code) {
			chase = code_table[chase] >> 8;
			++chase_length;
		}

		const k = chase;

		const op_end = op + chase_length + (chase_code !== code ? 1 : 0);
		if (op_end > output_length) {
			throw new Error('Warning, gif stream longer than expected.');
		}

		// Already have the first byte from the chase, might as well write it fast.
		output[op++] = k;

		op += chase_length;
		let b = op;  // Track pointer, writing backwards.

		if (chase_code !== code) {
			// The case of emitting {CODE-1} + k.
			output[op++] = k;
		}

		chase = chase_code;
		while (chase_length--) {
			chase = code_table[chase];
			output[--b] = chase & 0xff;  // Write backwards.
			chase >>= 8;  // Pull down to the prefix code.
		}

		if (prev_code !== null && next_code < 4096) {
			code_table[next_code++] = prev_code << 8 | k;
			// Figure out this clearing vs code growth logic better.  I
			// have an feeling that it should just happen somewhere else, for now it
			// is awkward between when we grow past the max and then hit a clear code.
			// For now just check if we hit the max 12-bits (then a clear code should
			// follow, also of course encoded in 12-bits).
			if (next_code >= code_mask + 1 && cur_code_size < 12) {
				++cur_code_size;
				code_mask = code_mask << 1 | 1;
			}
		}

		prev_code = code;
	}

	if (op !== output_length) {
		throw new Error('Warning, gif stream shorter than expected.');
	}

	return output;
};

export class Frame {
	/**
	 * @param {GIF} gif
	 * @param {number} x
	 * @param {number} y
	 * @param {number} width
	 * @param {number} height
	 * @param {boolean} hasLocalPalette
	 * @param {?number} paletteOffset
	 * @param {?number} paletteSize
	 * @param {number} dataOffset
	 * @param {number} dataLength
	 * @param {?number} transparentIndex
	 * @param {boolean} interlaced
	 * @param {number} delay
	 * @param {number} disposal
	 */
	constructor(
		gif,
		x,
		y,
		width,
		height,
		delay,
		disposal,
		interlaced,
		transparentIndex,
		dataOffset,
		dataLength,
		hasLocalPalette,
		paletteOffset,
		paletteSize,
	) {
		{
			this.#gif = gif;
			this.x = x;
			this.y = y;
			this.width = width;
			this.height = height;
			this.delay = delay;
			this.disposal = disposal;
			this.hasLocalPalette = hasLocalPalette;
			this.paletteOffset = paletteOffset;
			this.paletteSize = paletteSize;
			this.dataOffset = dataOffset;
			this.dataLength = dataLength;
			this.transparentIndex = transparentIndex;
			this.interlaced = interlaced;
		}
	}

	/** @type {GIF} */ #gif;

	/** @type {ImageData} */ #imageData;

	/** @type {Uint8Array} */ imageDataArray;

	/** @return {ImageData} */
	get imageData() {
		if (this.#imageData) {
			return this.#imageData;
		}

		this.#imageData = new ImageData(this.#gif.width, this.#gif.height);

		this.imageDataArray  = new Uint8Array(this.width * this.height);  // At most 8-bit indices.

		LZWOutputIndexStream(this.#gif.buffer, this.dataOffset, this.imageDataArray, this.imageDataArray.length);
		const palette_offset = this.paletteOffset;

		// It seems to be much faster to compare index to 256 than
		// to === null.  Not sure why, but CompareStub_EQ_STRICT shows up high in
		// the profile, not sure if it's related to using a Uint8Array.
		let trans = this.transparentIndex ?? 256;

		// We are possibly just blitting to a portion of the entire frame.
		// That is a subrect within the framerect, so the additional pixels
		// must be skipped over after we finished a scanline.
		const framewidth = this.width;
		const framestride = this.#gif.width - framewidth;
		let xleft = framewidth;  // Number of subrect pixels left in scanline.

		// Output index of the top left corner of the subrect.
		const opbeg = (this.y * this.#gif.width + this.x) * 4;
		// Output index of what would be the left edge of the subrect, one row
		// below it, i.e. the index at which an interlace pass should wrap.
		const opend = ((this.y + this.height) * this.#gif.width + this.x) * 4;
		let op = opbeg;

		let scanstride = framestride * 4;

		// Use scanstride to skip past the rows when interlacing.  This is skipping
		// 7 rows for the first two passes, then 3 then 1.
		if (this.interlaced === true) {
			scanstride += this.#gif.width * 4 * 7;  // Pass 1.
		}

		let interlaceskip = 8;  // Tracking the row interval in the current pass.

		for (let i = 0, il = this.imageDataArray.length; i < il; ++i) {
			const index = this.imageDataArray[i];

			if (xleft === 0) {  // Beginning of new scan line
				op += scanstride;
				xleft = framewidth;
				if (op >= opend) { // Catch the wrap to switch passes when interlacing.
					scanstride = framestride * 4 + this.#gif.width * 4 * (interlaceskip - 1);
					// interlaceskip / 2 * 4 is interlaceskip << 1.
					op = opbeg + (framewidth + framestride) * (interlaceskip << 1);
					interlaceskip >>= 1;
				}
			}

			if (index === trans) {
				op += 4;
			} else {
				const r = this.#gif.buffer[palette_offset + index * 3];
				const g = this.#gif.buffer[palette_offset + index * 3 + 1];
				const b = this.#gif.buffer[palette_offset + index * 3 + 2];
				this.#imageData.data[op++] = r;
				this.#imageData.data[op++] = g;
				this.#imageData.data[op++] = b;
				this.#imageData.data[op++] = 255;
			}
			--xleft;
		}

		return this.#imageData;
	}

	/** @return {string} */
	get disposalName() {
		switch (this.disposal) {
			case 0:
				// No disposal specified. The decoder is not required to take any action.
				return 'no-specified';
			case 1:
				// Do not dispose. The graphic is to be left in place.
				return 'not-dispose';
			case 2:
				// Restore to background color. The area used by the graphic must be restored to the background color.
				// Dispose background doesn't really work, apparently most browsers ignore the background palette index and clear to transparency.
				return 'restore-background';
			case 3:
				// Restore to previous. The decoder is required to restore the area overwritten by the graphic with what was there prior to rendering the graphic.
				return 'restore-previous';
			case 4:
			case 5:
			case 6:
			case 7:
				// To be defined.
				return 'reserved';
			default:
				return 'broken';
		}
	}

}