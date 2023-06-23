import fs from 'fs';
import {W3U} from '../../W3U.mjs';
import vbindiff from '../../../utils/vbindiff.mjs';

const ext = 'w3u';
const name = [
    'war3map',
    'skin',
][0];

const w3u = W3U.fromJSON(fs.readFileSync(`${name}.${ext}.json`, {encoding: 'utf8'}));
const b = w3u.write();

const f2 = `${name}.test.${ext}`;
fs.writeFileSync(f2, Buffer.from(b), {flag: 'w+'});

vbindiff(`${name}.${ext}`, f2);