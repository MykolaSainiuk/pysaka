"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTypeAsBuffer = exports.generateNumericId = void 0;
const consts_1 = require("./consts");
const generateNumericId = (l = 10) => {
    let n = '';
    for (let i = 0; i < l; ++i) {
        n += Math.floor(Math.random() * 10);
    }
    return n;
};
exports.generateNumericId = generateNumericId;
const getTypeAsBuffer = (value) => {
    if (value === null) {
        return consts_1.BUFFER_NULL_TYPE;
    }
    switch (typeof value) {
        case 'string':
            return consts_1.BUFFER_STRING_TYPE;
        case 'number':
            return Number.isInteger(+value)
                ? consts_1.BUFFER_INTEGER_TYPE
                : consts_1.BUFFER_DOUBLE_TYPE;
        case 'boolean':
            return consts_1.BUFFER_BOOLEAN_TYPE;
        case 'object':
            return consts_1.BUFFER_OBJECT_TYPE;
        case 'undefined':
            return consts_1.BUFFER_UNDEFINED_TYPE;
        default:
            return consts_1.BUFFER_OBJECT_TYPE;
    }
};
exports.getTypeAsBuffer = getTypeAsBuffer;
