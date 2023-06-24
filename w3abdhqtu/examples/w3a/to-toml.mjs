import fs from 'fs';
import {W3A} from '../../W3A.mjs';

const name = [
    'waSkin.w3a',
    'wa.test.w3a',
    'wa.w3a',
    'wm.w3a',
    'wshit.w3a',
    'war3map.w3a',
][0];

const w3a = new W3A(fs.readFileSync(name));
w3a.read();

console.log('🏁 W3A: start');

if (w3a.errors.length) {
    console.log('⚠️', w3a.errors);
} else {
    console.log('🏆 W3A: end');
    fs.writeFileSync(`${name}.toml`, w3a.toTOML(), {flag: 'w+'});
}