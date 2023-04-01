import {
    LineType,
    MaterialRenderMode,
    FilterMode,
    LayerShading,
    TextureFlags,
    GeosetAnimFlags,
    NodeFlags,
    CollisionShapeType,
    ParticleEmitter2Flags,
    ParticleEmitter2FramesFlags,
    LightType,
    ParticleEmitter2FilterMode,
    ParticleEmitterFlags,
    NodeType,
    ParticleEmitterPopcornFlags,
} from '../model.mjs';

class State {
    str;
    pos;

    constructor(str) {
        this.str = str;
        this.pos = 0;
    }

    char() {
        if (this.pos >= this.str.length) {
            throwError(this, 'incorrect model data');
        }
        return this.str[this.pos];
    }
}

function throwError(state, str = '') {
    throw new Error(`SyntaxError, near ${state.pos}` + (str ? ', ' + str : ''));
}

function parseComment(state) {
    if (state.char() === '/' && state.str[state.pos + 1] === '/') {
        state.pos += 2;
        while (state.pos < state.str.length && state.str[++state.pos] !== '\n');
        ++state.pos;
        return true;
    }
    return false;
}

const spaceRE = /\s/i;

function parseSpace(state) {
    while (state.pos < state.str.length && spaceRE.test(state.char())) {
        ++state.pos;
    }
}

const keywordFirstCharRE = /[a-z]/i;
const keywordOtherCharRE = /[a-z0-9]/i;

function parseKeyword(state) {
    if (!keywordFirstCharRE.test(state.char())) {
        return null;
    }
    let keyword = state.char();
    ++state.pos;
    while (keywordOtherCharRE.test(state.char())) {
        keyword += state.str[state.pos++];
    }
    parseSpace(state);
    return keyword;
}

function parseSymbol(state, symbol) {
    if (state.char() === symbol) {
        ++state.pos;
        parseSpace(state);
    }
}

function strictParseSymbol(state, symbol) {
    if (state.char() !== symbol) {
        throwError(state, `extected ${symbol}`);
    }
    ++state.pos;
    parseSpace(state);
}

function parseString(state) {
    if (state.char() === '"') {
        const start = ++state.pos; // "
        while (state.char() !== '"') {
            ++state.pos;
        }
        ++state.pos; // "
        const res = state.str.substring(start, state.pos - 1);
        parseSpace(state);
        return res;
    }
    return null;
}

const numberFirstCharRE = /[-0-9]/;
const numberOtherCharRE = /[-+.0-9e]/i;

function parseNumber(state) {
    if (numberFirstCharRE.test(state.char())) {
        const start = state.pos;
        ++state.pos;
        while (numberOtherCharRE.test(state.char())) {
            ++state.pos;
        }
        const res = parseFloat(state.str.substring(start, state.pos));
        parseSpace(state);
        return res;
    }
    return null;
}

function parseArray(state, arr, pos) {
    if (state.char() !== '{') {
        return null;
    }
    if (!arr) {
        arr = [];
        pos = 0;
    }
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const num = parseNumber(state);
        if (num === null) {
            throwError(state, 'expected number');
        }
        arr[pos++] = num;
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    return arr;
}

function parseArrayCounted(state, arr, pos) {
    if (state.char() !== '{') {
        return 0;
    }
    const start = pos;
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const num = parseNumber(state);
        if (num === null) {
            throwError(state, 'expected number');
        }
        arr[pos++] = num;
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    return pos - start;
}

function parseArrayOrSingleItem(state, arr) {
    if (state.char() !== '{') {
        arr[0] = parseNumber(state);
        return arr;
    }
    let pos = 0;
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const num = parseNumber(state);
        if (num === null) {
            throwError(state, 'expected number');
        }
        arr[pos++] = num;
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    return arr;
}

function parseObject(state) {
    let prefix = null;
    const obj = {};
    if (state.char() !== '{') {
        prefix = parseString(state);
        if (prefix === null) {
            prefix = parseNumber(state);
        }
        if (prefix === null) {
            throwError(state, 'expected string or number');
        }
    }
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const keyword = parseKeyword(state);
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'Interval') {
            const array = new Uint32Array(2);
            obj[keyword] = parseArray(state, array, 0);
        } else if (keyword === 'MinimumExtent' || keyword === 'MaximumExtent') {
            const array = new Float32Array(3);
            obj[keyword] = parseArray(state, array, 0);
        } else {
            obj[keyword] = parseArray(state) || parseString(state);
            if (obj[keyword] === null) {
                obj[keyword] = parseNumber(state);
            }
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    return [prefix, obj];
}

function parseVersion(state, model) {
    const [_unused, obj] = parseObject(state);
    if (obj.FormatVersion) {
        model.Version = obj.FormatVersion;
    }
}

function parseModelInfo(state, model) {
    const [name, obj] = parseObject(state);
    model.Info = obj;
    model.Info.Name = name;
}

function parseSequences(state, model) {
    parseNumber(state); // count, not used
    strictParseSymbol(state, '{');
    const res = [];
    while (state.char() !== '}') {
        parseKeyword(state); // Anim
        const [name, obj] = parseObject(state);
        obj.Name = name;
        obj.NonLooping = 'NonLooping' in obj;
        obj.MoveSpeed = obj.MoveSpeed || 0;
        obj.Rarity = obj.Rarity || 0;
        res.push(obj);
    }
    strictParseSymbol(state, '}');
    model.Sequences = res;
}

function parseTextures(state, model) {
    const res = [];
    parseNumber(state); // count, not used
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        parseKeyword(state); // Bitmap
        const [_unused, obj] = parseObject(state);
        obj.Flags = 0;
        if ('WrapWidth' in obj) {
            obj.Flags += TextureFlags.WrapWidth;
            delete obj.WrapWidth;
        }
        if ('WrapHeight' in obj) {
            obj.Flags += TextureFlags.WrapHeight;
            delete obj.WrapHeight;
        }
        res.push(obj);
    }
    strictParseSymbol(state, '}');
    model.Textures = res;
}

var AnimVectorType;
(function (AnimVectorType) {
    AnimVectorType[(AnimVectorType['INT1'] = 0)] = 'INT1';
    AnimVectorType[(AnimVectorType['FLOAT1'] = 1)] = 'FLOAT1';
    AnimVectorType[(AnimVectorType['FLOAT3'] = 2)] = 'FLOAT3';
    AnimVectorType[(AnimVectorType['FLOAT4'] = 3)] = 'FLOAT4';
})(AnimVectorType || (AnimVectorType = {}));
const animVectorSize = {
    [AnimVectorType.INT1]: 1,
    [AnimVectorType.FLOAT1]: 1,
    [AnimVectorType.FLOAT3]: 3,
    [AnimVectorType.FLOAT4]: 4,
};

function parseAnimKeyframe(state, frame, type, lineType) {
    const res = {
        Frame: frame,
        Vector: null,
    };
    const Vector = type === AnimVectorType.INT1 ? Int32Array : Float32Array;
    const itemCount = animVectorSize[type];
    res.Vector = parseArrayOrSingleItem(state, new Vector(itemCount));
    strictParseSymbol(state, ',');
    if (lineType === LineType.Hermite || lineType === LineType.Bezier) {
        parseKeyword(state); // InTan
        res.InTan = parseArrayOrSingleItem(state, new Vector(itemCount));
        strictParseSymbol(state, ',');
        parseKeyword(state); // OutTan
        res.OutTan = parseArrayOrSingleItem(state, new Vector(itemCount));
        strictParseSymbol(state, ',');
    }
    return res;
}

function parseAnimVector(state, type) {
    const animVector = {
        LineType: LineType.DontInterp,
        GlobalSeqId: null,
        Keys: [],
    };
    parseNumber(state); // count, not used
    strictParseSymbol(state, '{');
    const lineType = parseKeyword(state);
    if (lineType === 'DontInterp' || lineType === 'Linear' || lineType === 'Hermite' || lineType === 'Bezier') {
        animVector.LineType = LineType[lineType];
    }
    strictParseSymbol(state, ',');
    while (state.char() !== '}') {
        const keyword = parseKeyword(state);
        if (keyword === 'GlobalSeqId') {
            animVector[keyword] = parseNumber(state);
            strictParseSymbol(state, ',');
        } else {
            const frame = parseNumber(state);
            if (frame === null) {
                throwError(state, 'expected frame number or GlobalSeqId');
            }
            strictParseSymbol(state, ':');
            animVector.Keys.push(parseAnimKeyframe(state, frame, type, animVector.LineType));
        }
    }
    strictParseSymbol(state, '}');
    return animVector;
}

function parseLayer(state, model) {
    const res = {
        Alpha: null,
        TVertexAnimId: null,
        Shading: 0,
        CoordId: 0,
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        let keyword = parseKeyword(state);
        let isStatic = false;
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'static') {
            isStatic = true;
            keyword = parseKeyword(state);
        }
        if (!isStatic && keyword === 'TextureID') {
            res[keyword] = parseAnimVector(state, AnimVectorType.INT1);
        } else if (!isStatic && keyword === 'Alpha') {
            res[keyword] = parseAnimVector(state, AnimVectorType.FLOAT1);
        } else if (
            keyword === 'Unshaded' ||
            keyword === 'SphereEnvMap' ||
            keyword === 'TwoSided' ||
            keyword === 'Unfogged' ||
            keyword === 'NoDepthTest' ||
            keyword === 'NoDepthSet'
        ) {
            res.Shading |= LayerShading[keyword];
        } else if (keyword === 'FilterMode') {
            const val = parseKeyword(state);
            if (
                val === 'None' ||
                val === 'Transparent' ||
                val === 'Blend' ||
                val === 'Additive' ||
                val === 'AddAlpha' ||
                val === 'Modulate' ||
                val === 'Modulate2x'
            ) {
                res.FilterMode = FilterMode[val];
            }
        } else if (keyword === 'TVertexAnimId') {
            res.TVertexAnimId = parseNumber(state);
        } else if (model.Version >= 900 && keyword === 'EmissiveGain') {
            if (isStatic) {
                res[keyword] = parseNumber(state);
            } else {
                res[keyword] = parseAnimVector(state, AnimVectorType.FLOAT1);
            }
        } else if (model.Version >= 1000 && keyword === 'FresnelColor') {
            if (isStatic) {
                const array = new Float32Array(3);
                res[keyword] = parseArray(state, array, 0);
            } else {
                res[keyword] = parseAnimVector(state, AnimVectorType.FLOAT3);
            }
        } else if (model.Version >= 1000 && (keyword === 'FresnelOpacity' || keyword === 'FresnelTeamColor')) {
            if (isStatic) {
                res[keyword] = parseNumber(state);
            } else {
                res[keyword] = parseAnimVector(state, AnimVectorType.FLOAT1);
            }
        } else {
            let val = parseNumber(state);
            if (val === null) {
                val = parseKeyword(state);
            }
            res[keyword] = val;
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    return res;
}

function parseMaterials(state, model) {
    const res = [];
    parseNumber(state); // count, not used
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const obj = {
            RenderMode: 0,
            Layers: [],
        };
        parseKeyword(state); // Material
        strictParseSymbol(state, '{');
        while (state.char() !== '}') {
            const keyword = parseKeyword(state);
            if (!keyword) {
                throwError(state);
            }
            if (keyword === 'Layer') {
                obj.Layers.push(parseLayer(state, model));
            } else if (keyword === 'PriorityPlane' || keyword === 'RenderMode') {
                obj[keyword] = parseNumber(state);
            } else if (keyword === 'ConstantColor' || keyword === 'SortPrimsFarZ' || keyword === 'FullResolution') {
                obj.RenderMode |= MaterialRenderMode[keyword];
            } else if (model.Version >= 900 && keyword === 'Shader') {
                obj[keyword] = parseString(state);
            } else {
                throw new Error('Unknown material property ' + keyword);
            }
            parseSymbol(state, ',');
        }
        strictParseSymbol(state, '}');
        res.push(obj);
    }
    strictParseSymbol(state, '}');
    model.Materials = res;
}

var GeosetPartType;
(function (GeosetPartType) {
    GeosetPartType[(GeosetPartType['INT'] = 0)] = 'INT';
    GeosetPartType[(GeosetPartType['FLOAT'] = 1)] = 'FLOAT';
})(GeosetPartType || (GeosetPartType = {}));

function parseGeosetPart(state, countPerObj, type) {
    const count = parseNumber(state);
    const arr = new (type === GeosetPartType.FLOAT ? Float32Array : Uint8Array)(count * countPerObj);
    strictParseSymbol(state, '{');
    for (let index = 0; index < count; ++index) {
        parseArray(state, arr, index * countPerObj);
        strictParseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    return arr;
}

function parseGeoset(state, model) {
    const res = {
        Vertices: null,
        Normals: null,
        TVertices: [],
        VertexGroup: new Uint8Array(0),
        Faces: null,
        Groups: null,
        TotalGroupsCount: null,
        MinimumExtent: null,
        MaximumExtent: null,
        BoundsRadius: 0,
        Anims: [],
        MaterialID: null,
        SelectionGroup: null,
        Unselectable: false,
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const keyword = parseKeyword(state);
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'Vertices' || keyword === 'Normals' || keyword === 'TVertices') {
            let countPerObj = 3;
            if (keyword === 'TVertices') {
                countPerObj = 2;
            }
            const arr = parseGeosetPart(state, countPerObj, GeosetPartType.FLOAT);
            if (keyword === 'TVertices') {
                res.TVertices.push(arr);
            } else {
                res[keyword] = arr;
            }
        } else if (keyword === 'VertexGroup') {
            res[keyword] = new Uint8Array(res.Vertices.length / 3);
            parseArray(state, res[keyword], 0);
        } else if (keyword === 'Faces') {
            const groupCount = parseNumber(state); // group count, always 1 in the official models
            const indexCount = parseNumber(state);
            let pos = 0;
            res.Faces = new Uint16Array(indexCount);
            strictParseSymbol(state, '{');
            const keyword = parseKeyword(state);
            if (keyword !== 'Triangles') {
                throwError(state, 'unexpected faces type');
            }
            strictParseSymbol(state, '{');
            for (let g = 0; g < groupCount; ++g) {
                const count = parseArrayCounted(state, res.Faces, pos);
                if (!count) {
                    throwError(state, 'expected array');
                }
                pos += count;
                parseSymbol(state, ',');
            }
            if (pos !== indexCount || indexCount % 3 !== 0) {
                throwError(state, 'mismatched faces array');
            }
            strictParseSymbol(state, '}');
            strictParseSymbol(state, '}');
        } else if (keyword === 'Groups') {
            const groups = [];
            parseNumber(state); // groups count, unused
            res.TotalGroupsCount = parseNumber(state); // summed in subarrays
            strictParseSymbol(state, '{');
            while (state.char() !== '}') {
                parseKeyword(state); // Matrices
                groups.push(parseArray(state));
                parseSymbol(state, ',');
            }
            strictParseSymbol(state, '}');
            res.Groups = groups;
        } else if (keyword === 'MinimumExtent' || keyword === 'MaximumExtent') {
            const arr = new Float32Array(3);
            res[keyword] = parseArray(state, arr, 0);
            strictParseSymbol(state, ',');
        } else if (keyword === 'BoundsRadius' || keyword === 'MaterialID' || keyword === 'SelectionGroup') {
            res[keyword] = parseNumber(state);
            strictParseSymbol(state, ',');
        } else if (keyword === 'Anim') {
            const [_unused, obj] = parseObject(state);
            if (obj.Alpha === undefined) {
                obj.Alpha = 1;
            }
            res.Anims.push(obj);
        } else if (keyword === 'Unselectable') {
            res.Unselectable = true;
            strictParseSymbol(state, ',');
        } else if (model.Version >= 900) {
            if (keyword === 'LevelOfDetail') {
                res.LevelOfDetail = parseNumber(state);
                strictParseSymbol(state, ',');
            } else if (keyword === 'Name') {
                res.Name = parseString(state);
                strictParseSymbol(state, ',');
            } else if (keyword === 'Tangents') {
                res.Tangents = parseGeosetPart(state, 4, GeosetPartType.FLOAT);
            } else if (keyword === 'SkinWeights') {
                const count = parseNumber(state);
                const arr = new Uint8Array(count * 4);
                res.SkinWeights = parseArray(state, arr, 0);
            }
        }
    }
    strictParseSymbol(state, '}');
    model.Geosets.push(res);
}

function parseGeosetAnim(state, model) {
    const res = {
        GeosetId: -1,
        Alpha: 1,
        Color: null,
        Flags: 0,
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        let keyword = parseKeyword(state);
        let isStatic = false;
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'static') {
            isStatic = true;
            keyword = parseKeyword(state);
        }
        if (keyword === 'Alpha') {
            if (isStatic) {
                res.Alpha = parseNumber(state);
            } else {
                res.Alpha = parseAnimVector(state, AnimVectorType.FLOAT1);
            }
        } else if (keyword === 'Color') {
            if (isStatic) {
                const array = new Float32Array(3);
                res.Color = parseArray(state, array, 0);
                res.Color.reverse();
            } else {
                res.Color = parseAnimVector(state, AnimVectorType.FLOAT3);
                for (const key of res.Color.Keys) {
                    key.Vector.reverse();
                    if (key.InTan) {
                        key.InTan.reverse();
                        key.OutTan.reverse();
                    }
                }
            }
        } else if (keyword === 'DropShadow') {
            res.Flags |= GeosetAnimFlags[keyword];
        } else {
            res[keyword] = parseNumber(state);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.GeosetAnims.push(res);
}

function parseNode(state, type, model) {
    const name = parseString(state);
    const node = {
        Name: name,
        ObjectId: null,
        Parent: null,
        PivotPoint: null,
        Flags: NodeType[type],
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const keyword = parseKeyword(state);
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'Translation' || keyword === 'Rotation' || keyword === 'Scaling' || keyword === 'Visibility') {
            let vectorType = AnimVectorType.FLOAT3;
            if (keyword === 'Rotation') {
                vectorType = AnimVectorType.FLOAT4;
            } else if (keyword === 'Visibility') {
                vectorType = AnimVectorType.FLOAT1;
            }
            node[keyword] = parseAnimVector(state, vectorType);
        } else if (
            keyword === 'BillboardedLockZ' ||
            keyword === 'BillboardedLockY' ||
            keyword === 'BillboardedLockX' ||
            keyword === 'Billboarded' ||
            keyword === 'CameraAnchored'
        ) {
            node.Flags |= NodeFlags[keyword];
        } else if (keyword === 'DontInherit') {
            strictParseSymbol(state, '{');
            const val = parseKeyword(state);
            if (val === 'Translation') {
                node.Flags |= NodeFlags.DontInheritTranslation;
            } else if (val === 'Rotation') {
                node.Flags |= NodeFlags.DontInheritRotation;
            } else if (val === 'Scaling') {
                node.Flags |= NodeFlags.DontInheritScaling;
            }
            strictParseSymbol(state, '}');
        } else if (keyword === 'Path') {
            node[keyword] = parseString(state);
        } else {
            let val = parseKeyword(state) || parseNumber(state);
            if (keyword === 'GeosetId' && val === 'Multiple' || keyword === 'GeosetAnimId' && val === 'None') {
                val = null;
            }
            node[keyword] = val;
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.Nodes[node.ObjectId] = node;
    return node;
}

function parseBone(state, model) {
    const node = parseNode(state, 'Bone', model);
    model.Bones.push(node);
}

function parseHelper(state, model) {
    const node = parseNode(state, 'Helper', model);
    model.Helpers.push(node);
}

function parseAttachment(state, model) {
    const node = parseNode(state, 'Attachment', model);
    model.Attachments.push(node);
}

function parsePivotPoints(state, model) {
    const count = parseNumber(state);
    const res = [];
    strictParseSymbol(state, '{');
    for (let i = 0; i < count; ++i) {
        res.push(parseArray(state, new Float32Array(3), 0));
        strictParseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.PivotPoints = res;
}

function parseEventObject(state, model) {
    const name = parseString(state);
    const res = {
        Name: name,
        ObjectId: null,
        Parent: null,
        PivotPoint: null,
        EventTrack: null,
        Flags: NodeType.EventObject,
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const keyword = parseKeyword(state);
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'EventTrack') {
            const count = parseNumber(state); // EventTrack count
            res.EventTrack = parseArray(state, new Uint32Array(count), 0);
        } else if (keyword === 'Translation' || keyword === 'Rotation' || keyword === 'Scaling') {
            const type = keyword === 'Rotation' ? AnimVectorType.FLOAT4 : AnimVectorType.FLOAT3;
            res[keyword] = parseAnimVector(state, type);
        } else {
            res[keyword] = parseNumber(state);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.EventObjects.push(res);
    model.Nodes.push(res);
}

function parseCollisionShape(state, model) {
    const name = parseString(state);
    const res = {
        Name: name,
        ObjectId: null,
        Parent: null,
        PivotPoint: null,
        Shape: CollisionShapeType.Box,
        Vertices: null,
        Flags: NodeType.CollisionShape,
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const keyword = parseKeyword(state);
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'Sphere') {
            res.Shape = CollisionShapeType.Sphere;
        } else if (keyword === 'Box') {
            res.Shape = CollisionShapeType.Box;
        } else if (keyword === 'Vertices') {
            const count = parseNumber(state);
            const vertices = new Float32Array(count * 3);
            strictParseSymbol(state, '{');
            for (let i = 0; i < count; ++i) {
                parseArray(state, vertices, i * 3);
                strictParseSymbol(state, ',');
            }
            strictParseSymbol(state, '}');
            res.Vertices = vertices;
        } else if (keyword === 'Translation' || keyword === 'Rotation' || keyword === 'Scaling') {
            const type = keyword === 'Rotation' ? AnimVectorType.FLOAT4 : AnimVectorType.FLOAT3;
            res[keyword] = parseAnimVector(state, type);
        } else {
            res[keyword] = parseNumber(state);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.CollisionShapes.push(res);
    model.Nodes.push(res);
}

function parseGlobalSequences(state, model) {
    const res = [];
    const count = parseNumber(state);
    strictParseSymbol(state, '{');
    for (let i = 0; i < count; ++i) {
        const keyword = parseKeyword(state);
        if (keyword === 'Duration') {
            res.push(parseNumber(state));
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.GlobalSequences = res;
}

function parseUnknownBlock(state) {
    let opened;
    while (state.char() !== undefined && state.char() !== '{') {
        ++state.pos;
    }
    opened = 1;
    ++state.pos;
    while (state.char() !== undefined && opened > 0) {
        if (state.char() === '{') {
            ++opened;
        } else if (state.char() === '}') {
            --opened;
        }
        ++state.pos;
    }
    parseSpace(state);
}

function parseParticleEmitter(state, model) {
    const res = {
        ObjectId: null,
        Parent: null,
        Name: null,
        Flags: 0,
    };
    res.Name = parseString(state);
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        let keyword = parseKeyword(state);
        let isStatic = false;
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'static') {
            isStatic = true;
            keyword = parseKeyword(state);
        }
        if (keyword === 'ObjectId' || keyword === 'Parent') {
            res[keyword] = parseNumber(state);
        } else if (keyword === 'EmitterUsesMDL' || keyword === 'EmitterUsesTGA') {
            res.Flags |= ParticleEmitterFlags[keyword];
        } else if (
            !isStatic &&
            (keyword === 'Visibility' ||
                keyword === 'Translation' ||
                keyword === 'Rotation' ||
                keyword === 'Scaling' ||
                keyword === 'EmissionRate' ||
                keyword === 'Gravity' ||
                keyword === 'Longitude' ||
                keyword === 'Latitude')
        ) {
            let type = AnimVectorType.FLOAT3;
            if (
                keyword === 'Visibility' ||
                keyword === 'EmissionRate' ||
                keyword === 'Gravity' ||
                keyword === 'Longitude' ||
                keyword === 'Latitude'
            ) {
                type = AnimVectorType.FLOAT1;
            } else if (keyword === 'Rotation') {
                type = AnimVectorType.FLOAT4;
            }
            res[keyword] = parseAnimVector(state, type);
        } else if (keyword === 'Particle') {
            strictParseSymbol(state, '{');
            while (state.char() !== '}') {
                let keyword2 = parseKeyword(state);
                let isStatic2 = false;
                if (keyword2 === 'static') {
                    isStatic2 = true;
                    keyword2 = parseKeyword(state);
                }
                if (!isStatic2 && (keyword2 === 'LifeSpan' || keyword2 === 'InitVelocity')) {
                    res[keyword2] = parseAnimVector(state, AnimVectorType.FLOAT1);
                } else if (keyword2 === 'LifeSpan' || keyword2 === 'InitVelocity') {
                    res[keyword2] = parseNumber(state);
                } else if (keyword2 === 'Path') {
                    res.Path = parseString(state);
                }
                parseSymbol(state, ',');
            }
            strictParseSymbol(state, '}');
        } else {
            res[keyword] = parseNumber(state);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.ParticleEmitters.push(res);
}

function parseParticleEmitter2(state, model) {
    const name = parseString(state);
    const res = {
        Name: name,
        ObjectId: null,
        Parent: null,
        PivotPoint: null,
        Flags: NodeType.ParticleEmitter,
        FrameFlags: 0,
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        let keyword = parseKeyword(state);
        let isStatic = false;
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'static') {
            isStatic = true;
            keyword = parseKeyword(state);
        }
        if (
            !isStatic &&
            (keyword === 'Speed' ||
                keyword === 'Latitude' ||
                keyword === 'Visibility' ||
                keyword === 'EmissionRate' ||
                keyword === 'Width' ||
                keyword === 'Length' ||
                keyword === 'Translation' ||
                keyword === 'Rotation' ||
                keyword === 'Scaling' ||
                keyword === 'Gravity' ||
                keyword === 'Variation')
        ) {
            let type = AnimVectorType.FLOAT3;
            switch (keyword) {
                case 'Rotation':
                    type = AnimVectorType.FLOAT4;
                    break;
                case 'Speed':
                case 'Latitude':
                case 'Visibility':
                case 'EmissionRate':
                case 'Width':
                case 'Length':
                case 'Gravity':
                case 'Variation':
                    type = AnimVectorType.FLOAT1;
                    break;
            }
            res[keyword] = parseAnimVector(state, type);
        } else if (keyword === 'Variation' || keyword === 'Gravity') {
            res[keyword] = parseNumber(state);
        } else if (
            keyword === 'SortPrimsFarZ' ||
            keyword === 'Unshaded' ||
            keyword === 'LineEmitter' ||
            keyword === 'Unfogged' ||
            keyword === 'ModelSpace' ||
            keyword === 'XYQuad'
        ) {
            res.Flags |= ParticleEmitter2Flags[keyword];
        } else if (keyword === 'Both') {
            res.FrameFlags |= ParticleEmitter2FramesFlags.Head | ParticleEmitter2FramesFlags.Tail;
        } else if (keyword === 'Head' || keyword === 'Tail') {
            res.FrameFlags |= ParticleEmitter2FramesFlags[keyword];
        } else if (keyword === 'Squirt') {
            res[keyword] = true;
        } else if (keyword === 'DontInherit') {
            strictParseSymbol(state, '{');
            const val = parseKeyword(state);
            if (val === 'Translation') {
                res.Flags |= NodeFlags.DontInheritTranslation;
            } else if (val === 'Rotation') {
                res.Flags |= NodeFlags.DontInheritRotation;
            } else if (val === 'Scaling') {
                res.Flags |= NodeFlags.DontInheritScaling;
            }
            strictParseSymbol(state, '}');
        } else if (keyword === 'SegmentColor') {
            const colors = [];
            strictParseSymbol(state, '{');
            while (state.char() !== '}') {
                parseKeyword(state); // Color
                const colorArr = new Float32Array(3);
                parseArray(state, colorArr, 0);
                // bgr order, inverse from mdx
                const temp = colorArr[0];
                colorArr[0] = colorArr[2];
                colorArr[2] = temp;
                colors.push(colorArr);
                parseSymbol(state, ',');
            }
            strictParseSymbol(state, '}');
            res.SegmentColor = colors;
        } else if (keyword === 'Alpha') {
            res.Alpha = new Uint8Array(3);
            parseArray(state, res.Alpha, 0);
        } else if (keyword === 'ParticleScaling') {
            res[keyword] = new Float32Array(3);
            parseArray(state, res[keyword], 0);
        } else if (keyword === 'LifeSpanUVAnim' || keyword === 'DecayUVAnim' || keyword === 'TailUVAnim' || keyword === 'TailDecayUVAnim') {
            res[keyword] = new Uint32Array(3);
            parseArray(state, res[keyword], 0);
        } else if (
            keyword === 'Transparent' ||
            keyword === 'Blend' ||
            keyword === 'Additive' ||
            keyword === 'AlphaKey' ||
            keyword === 'Modulate' ||
            keyword === 'Modulate2x'
        ) {
            res.FilterMode = ParticleEmitter2FilterMode[keyword];
        } else {
            res[keyword] = parseNumber(state);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.ParticleEmitters2.push(res);
    model.Nodes.push(res);
}

function parseCamera(state, model) {
    const res = {
        Name: null,
        Position: null,
        FieldOfView: 0,
        NearClip: 0,
        FarClip: 0,
        TargetPosition: null,
    };
    res.Name = parseString(state);
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const keyword = parseKeyword(state);
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'Position') {
            res.Position = new Float32Array(3);
            parseArray(state, res.Position, 0);
        } else if (keyword === 'FieldOfView' || keyword === 'NearClip' || keyword === 'FarClip') {
            res[keyword] = parseNumber(state);
        } else if (keyword === 'Target') {
            strictParseSymbol(state, '{');
            while (state.char() !== '}') {
                const keyword2 = parseKeyword(state);
                if (keyword2 === 'Position') {
                    res.TargetPosition = new Float32Array(3);
                    parseArray(state, res.TargetPosition, 0);
                } else if (keyword2 === 'Translation') {
                    res.TargetTranslation = parseAnimVector(state, AnimVectorType.FLOAT3);
                }
                parseSymbol(state, ',');
            }
            strictParseSymbol(state, '}');
        } else if (keyword === 'Translation' || keyword === 'Rotation') {
            res[keyword] = parseAnimVector(state, keyword === 'Rotation' ? AnimVectorType.FLOAT1 : AnimVectorType.FLOAT3);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.Cameras.push(res);
}

function parseLight(state, model) {
    const name = parseString(state);
    const res = {
        Name: name,
        ObjectId: null,
        Parent: null,
        PivotPoint: null,
        Flags: NodeType.Light,
        LightType: 0,
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        let keyword = parseKeyword(state);
        let isStatic = false;
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'static') {
            isStatic = true;
            keyword = parseKeyword(state);
        }
        if (
            !isStatic &&
            (keyword === 'Visibility' ||
                keyword === 'Color' ||
                keyword === 'Intensity' ||
                keyword === 'AmbIntensity' ||
                keyword === 'AmbColor' ||
                keyword === 'Translation' ||
                keyword === 'Rotation' ||
                keyword === 'Scaling' ||
                keyword === 'AttenuationStart' ||
                keyword === 'AttenuationEnd')
        ) {
            let type = AnimVectorType.FLOAT3;
            switch (keyword) {
                case 'Rotation':
                    type = AnimVectorType.FLOAT4;
                    break;
                case 'Visibility':
                case 'Intensity':
                case 'AmbIntensity':
                case 'AttenuationStart':
                case 'AttenuationEnd':
                    type = AnimVectorType.FLOAT1;
                    break;
            }
            res[keyword] = parseAnimVector(state, type);
            if (keyword === 'Color' || keyword === 'AmbColor') {
                for (const key of res[keyword].Keys) {
                    key.Vector.reverse();
                    if (key.InTan) {
                        key.InTan.reverse();
                        key.OutTan.reverse();
                    }
                }
            }
        } else if (keyword === 'Omnidirectional' || keyword === 'Directional' || keyword === 'Ambient') {
            res.LightType = LightType[keyword];
        } else if (keyword === 'Color' || keyword === 'AmbColor') {
            const color = new Float32Array(3);
            parseArray(state, color, 0);
            // bgr order, inverse from mdx
            const temp = color[0];
            color[0] = color[2];
            color[2] = temp;
            res[keyword] = color;
        } else {
            res[keyword] = parseNumber(state);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.Lights.push(res);
    model.Nodes.push(res);
}

function parseTextureAnims(state, model) {
    const res = [];
    parseNumber(state); // count, not used
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const obj = {};
        parseKeyword(state); // TVertexAnim
        strictParseSymbol(state, '{');
        while (state.char() !== '}') {
            const keyword = parseKeyword(state);
            if (!keyword) {
                throwError(state);
            }
            if (keyword === 'Translation' || keyword === 'Rotation' || keyword === 'Scaling') {
                const type = keyword === 'Rotation' ? AnimVectorType.FLOAT4 : AnimVectorType.FLOAT3;
                obj[keyword] = parseAnimVector(state, type);
            } else {
                throw new Error('Unknown texture anim property ' + keyword);
            }
            parseSymbol(state, ',');
        }
        strictParseSymbol(state, '}');
        res.push(obj);
    }
    strictParseSymbol(state, '}');
    model.TextureAnims = res;
}

function parseRibbonEmitter(state, model) {
    const name = parseString(state);
    const res = {
        Name: name,
        ObjectId: null,
        Parent: null,
        PivotPoint: null,
        Flags: NodeType.RibbonEmitter,
        HeightAbove: null,
        HeightBelow: null,
        Alpha: null,
        Color: null,
        LifeSpan: null,
        TextureSlot: null,
        EmissionRate: null,
        Rows: null,
        Columns: null,
        MaterialID: null,
        Gravity: null,
        Visibility: null,
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        let keyword = parseKeyword(state);
        let isStatic = false;
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'static') {
            isStatic = true;
            keyword = parseKeyword(state);
        }
        if (
            !isStatic &&
            (keyword === 'Visibility' ||
                keyword === 'HeightAbove' ||
                keyword === 'HeightBelow' ||
                keyword === 'Translation' ||
                keyword === 'Rotation' ||
                keyword === 'Scaling' ||
                keyword === 'Alpha' ||
                keyword === 'TextureSlot')
        ) {
            let type = AnimVectorType.FLOAT3;
            switch (keyword) {
                case 'Rotation':
                    type = AnimVectorType.FLOAT4;
                    break;
                case 'Visibility':
                case 'HeightAbove':
                case 'HeightBelow':
                case 'Alpha':
                    type = AnimVectorType.FLOAT1;
                    break;
                case 'TextureSlot':
                    type = AnimVectorType.INT1;
                    break;
            }
            res[keyword] = parseAnimVector(state, type);
        } else if (keyword === 'Color') {
            const color = new Float32Array(3);
            parseArray(state, color, 0);
            // bgr order, inverse from mdx
            const temp = color[0];
            color[0] = color[2];
            color[2] = temp;
            res[keyword] = color;
        } else {
            res[keyword] = parseNumber(state);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.RibbonEmitters.push(res);
    model.Nodes.push(res);
}

function parseFaceFX(state, model) {
    if (model.Version < 900) {
        throwError(state, 'Unexpected model chunk FaceFX');
    }
    const name = parseString(state);
    const res = {
        Name: name,
        Path: '',
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        const keyword = parseKeyword(state);
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'Path') {
            res.Path = parseString(state);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.FaceFX = model.FaceFX || [];
    model.FaceFX.push(res);
}

function parseBindPose(state, model) {
    if (model.Version < 900) {
        throwError(state, 'Unexpected model chunk BindPose');
    }
    const res = {
        Matrices: [],
    };
    strictParseSymbol(state, '{');
    parseKeyword(state); // Matrices
    const count = parseNumber(state);
    strictParseSymbol(state, '{');
    for (let i = 0; i < count; ++i) {
        const matrix = new Float32Array(12);
        parseArray(state, matrix, 0);
        res.Matrices.push(matrix);
    }
    strictParseSymbol(state, '}');
    strictParseSymbol(state, '}');
    model.BindPoses = model.BindPoses || [];
    model.BindPoses.push(res);
}

function parseParticleEmitterPopcorn(state, model) {
    if (model.Version < 900) {
        throwError(state, 'Unexpected model chunk ParticleEmitterPopcorn');
    }
    const name = parseString(state);
    const res = {
        Name: name,
        ObjectId: null,
        Parent: null,
        PivotPoint: null,
        Flags: NodeType.ParticleEmitter,
    };
    strictParseSymbol(state, '{');
    while (state.char() !== '}') {
        let keyword = parseKeyword(state);
        let isStatic = false;
        if (!keyword) {
            throwError(state);
        }
        if (keyword === 'static') {
            isStatic = true;
            keyword = parseKeyword(state);
        }
        if (
            !isStatic &&
            (keyword === 'LifeSpan' ||
                keyword === 'EmissionRate' ||
                keyword === 'Speed' ||
                keyword === 'Color' ||
                keyword === 'Alpha' ||
                keyword === 'Visibility' ||
                keyword === 'Rotation' ||
                keyword === 'Scaling' ||
                keyword === 'Translation')
        ) {
            let type = AnimVectorType.FLOAT3;
            switch (keyword) {
                case 'LifeSpan':
                case 'EmissionRate':
                case 'Speed':
                case 'Alpha':
                case 'Visibility':
                    type = AnimVectorType.FLOAT1;
                    break;
            }
            res[keyword] = parseAnimVector(state, type);
        } else if (keyword === 'LifeSpan' || keyword === 'EmissionRate' || keyword === 'Speed' || keyword === 'Alpha') {
            res[keyword] = parseNumber(state);
        } else if (keyword === 'Color') {
            const array = new Float32Array(3);
            res[keyword] = parseArray(state, array, 0);
        } else if (keyword === 'ReplaceableId') {
            res[keyword] = parseNumber(state);
        } else if (keyword === 'Path' || keyword === 'AnimVisibilityGuide') {
            res[keyword] = parseString(state);
        } else if (keyword === 'Unshaded' || keyword === 'SortPrimsFarZ' || keyword === 'Unfogged') {
            if (keyword === 'Unshaded') {
                res.Flags |= ParticleEmitterPopcornFlags.Unshaded;
            } else if (keyword === 'Unfogged') {
                res.Flags |= ParticleEmitterPopcornFlags.Unfogged;
            } else if (keyword === 'SortPrimsFarZ') {
                res.Flags |= ParticleEmitterPopcornFlags.SortPrimsFarZ;
            }
        } else {
            res[keyword] = parseNumber(state);
        }
        parseSymbol(state, ',');
    }
    strictParseSymbol(state, '}');
    model.ParticleEmitterPopcorns = model.ParticleEmitterPopcorns || [];
    model.ParticleEmitterPopcorns.push(res);
    model.Nodes.push(res);
}

const parsers = {
    Version: parseVersion,
    Model: parseModelInfo,
    Sequences: parseSequences,
    Textures: parseTextures,
    Materials: parseMaterials,
    Geoset: parseGeoset,
    GeosetAnim: parseGeosetAnim,
    Bone: parseBone,
    Helper: parseHelper,
    Attachment: parseAttachment,
    PivotPoints: parsePivotPoints,
    EventObject: parseEventObject,
    CollisionShape: parseCollisionShape,
    GlobalSequences: parseGlobalSequences,
    ParticleEmitter: parseParticleEmitter,
    ParticleEmitter2: parseParticleEmitter2,
    Camera: parseCamera,
    Light: parseLight,
    TextureAnims: parseTextureAnims,
    RibbonEmitter: parseRibbonEmitter,
    FaceFX: parseFaceFX,
    BindPose: parseBindPose,
    ParticleEmitterPopcorn: parseParticleEmitterPopcorn,
};

export function parse(str) {
    const state = new State(str);
    const model = {
        // default
        Version: 800,
        Info: {
            Name: '',
            MinimumExtent: null,
            MaximumExtent: null,
            BoundsRadius: 0,
            BlendTime: 150,
        },
        Sequences: [],
        GlobalSequences: [],
        Textures: [],
        Materials: [],
        TextureAnims: [],
        Geosets: [],
        GeosetAnims: [],
        Bones: [],
        Helpers: [],
        Attachments: [],
        EventObjects: [],
        ParticleEmitters: [],
        ParticleEmitters2: [],
        Cameras: [],
        Lights: [],
        RibbonEmitters: [],
        CollisionShapes: [],
        PivotPoints: [],
        Nodes: [],
    };
    while (state.pos < state.str.length) {
        while (parseComment(state));
        const keyword = parseKeyword(state);
        if (keyword) {
            if (keyword in parsers) {
                parsers[keyword](state, model);
            } else {
                parseUnknownBlock(state);
            }
        } else {
            break;
        }
    }
    for (let i = 0; i < model.Nodes.length; ++i) {
        if (model.PivotPoints[i]) {
            model.Nodes[i].PivotPoint = model.PivotPoints[i];
        }
    }
    return model;
}