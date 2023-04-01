import * as path from 'path';
import * as fs from 'fs';

const DIR = 'models/test';
const DELETE = false;

const getAllFiles = dir =>
    fs.readdirSync(dir).reduce((files, file) => {
        const name = path.join(dir, file);
        const isDirectory = fs.statSync(name).isDirectory();
        return isDirectory ? [...files, ...getAllFiles(name)] : [...files, name];
    }, []);

const models = getAllFiles(DIR).filter(f => path.extname(f) === '.mdx');

const map = new Map();

for (const file of models) {
    const view = new DataView(fs.readFileSync(file).buffer);

    let byteOffset = 4;
    while (byteOffset < view.byteLength) {
        let key = view.getUint32(byteOffset, true);
        const byteLength = view.getUint32(byteOffset += 4, true);
        byteOffset += 4;

        if (key === 0x53584554) {
            const end = byteOffset + byteLength;
            for (let i = byteOffset; i < end; i += 268) {
                const s = [];
                for (let k = 4; k < 264; k++) {
                    s.push(String.fromCharCode(view.getUint8(i + k)));
                }
                for (let j = s.length - 1; j >= 0; j--) {
                    if (s[j] !== '\x00') break;
                    s.length -= 1;
                }
                if (s.length === 0) continue;

                const p = path.join(DIR, s.join('').toLowerCase().replace('\\', path.sep));
                map.set(p, true);
            }
            break;
        }
        byteOffset += byteLength;
    }
}

const textures = getAllFiles(DIR).filter(f => ['.blp', '.dds'].indexOf(path.extname(f)) >= 0);

for (const t of textures) {
    if (map.has(t)) continue;
    if (DELETE) {
        console.log(`Delete: ${t}`);
        fs.unlinkSync(t);
    } else {
        console.log(`Found: ${t}`);
    }
}