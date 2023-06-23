// https://github.com/stijnherfst/HiveWE/wiki/war3map(skin).w3*-Modifications

import {CDataView} from '../../utils/c-data-view.mjs';
import {CDataViewFake} from '../../utils/c-data-view-fake.mjs';
import fromBuffer from '../../utils/bufffer-to-buffer.mjs';
import {W3ABDHQTUItem} from './W3ABDHQTUItem.mjs';
import {Raw2Dec} from '../../rawcode/convert.mjs';
import {W3ABDHQTUItemData} from './W3ABDHQTUItemData.mjs';
import {W3ABDHQTUItemDataValue} from './W3ABDHQTUItemDataValue.mjs';

export class W3ABDHQTU {
    /**
     * @param {Buffer|ArrayBuffer} buffer
     * @param {boolean} adq
     */
    constructor(buffer, adq) {
        this.#buffer = fromBuffer(buffer);
        this.#adq = adq;
    }

    /**
     * @template T
     * @param {T} self
     * @param {string} json
     * @param {boolean} adq
     * @return {T}
     */
    static _fromJSON(self, json, adq) {
        const o = JSON.parse(json);
        self.formatVersion = o.formatVersion;
        for (const i of o.list) {
            const item = new W3ABDHQTUItem(adq, self.formatVersion);
            self.list.push(item);
            item.defaultId = Raw2Dec(String(i.defaultId));
            item.customId = i.customId === undefined ? 0 : Raw2Dec(String(i.customId));
            for (const id of i.list) {
                const itemData = new W3ABDHQTUItemData(adq, self.formatVersion);
                item.list.push(itemData);
                itemData.flag = id.flag === undefined ? 0 : Number(id.flag);
                for (const idv of id.list) {
                    const itemDataValue = new W3ABDHQTUItemDataValue(adq);
                    itemData.list.push(itemDataValue);
                    itemDataValue.id = Raw2Dec(String(idv.id));
                    if (adq) {
                        itemDataValue.level = idv.level;
                        itemDataValue.data = idv.data;
                    }
                    switch (idv.type) {
                        case 'integer':
                            itemDataValue.type = 0;
                            break;
                        case 'real':
                            itemDataValue.type = 1;
                            break;
                        case 'unreal':
                            itemDataValue.type = 2;
                            break;
                        case 'string':
                            itemDataValue.type = 3;
                            break;
                    }
                    itemDataValue.value = idv.value;
                    itemDataValue.end = idv.end === undefined ? 0 : Raw2Dec(String(idv.end));
                }
            }
        }
        return self;
    }

    /** @type {ArrayBuffer} */ #buffer;
    /** @type {boolean} */ #adq;
    /** @type {Error[]} */ errors = [];
    /** @type {W3ABDHQTUItem[]} */ list = [];
    /** @type {W3ABDHQTUItem[]} */ #original = [];
    /** @type {W3ABDHQTUItem[]} */ #mofified = [];

    #read() {
        const view = new CDataView(this.#buffer);
        this.formatVersion = view.uint32;
        if ([1, 2, 3].indexOf(this.formatVersion) < 0) {
            throw new Error(`This format is unsupported: ${this.formatVersion}`);
        }

        for (let i = 0; i < 2; i++) {
            for (let i = view.uint32; i > 0; i--) {
                const data = new W3ABDHQTUItem(this.#adq, this.formatVersion);
                data.read(view);
                this.list.push(data);
            }
        }

        if (view.cursor !== view.byteLength) {
            throw new Error(`Read not complete: ${view.cursor} !== ${view.byteLength}`);
        }
    }

    read() {
        try {
            this.#read();
        } catch (e) {
            this.errors.push(e);
        }
    }

    /** @param {CDataView} view */
    #write(view) {
        view.uint32 = this.formatVersion;
        view.uint32 = this.#original.length;
        for (const i of this.#original) i.write(view);
        view.uint32 = this.#mofified.length;
        for (const i of this.#mofified) i.write(view);
    }

    write() {
        this.#original = [];
        this.#mofified = [];

        for (const i of this.list) {
            if (i.customId > 0) this.#mofified.push(i);
            else this.#original.push(i);
        }

        /** @type {CDataView} */
        const dvf = new CDataViewFake();
        this.#write(dvf);

        const ab = new ArrayBuffer(dvf.cursor);
        const dv = new CDataView(ab);
        this.#write(dv);

        return ab;
    }

    toJSON() {
        return {
            formatVersion: this.formatVersion,
            list: this.list,
        };
    }
}