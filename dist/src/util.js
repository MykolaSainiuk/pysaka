import { BUFFER_STRING_TYPE, BUFFER_INTEGER_TYPE, BUFFER_DOUBLE_TYPE, BUFFER_OBJECT_TYPE, BUFFER_BOOLEAN_TYPE, BUFFER_UNDEFINED_TYPE, BUFFER_NULL_TYPE, } from './consts.js';
export const generateNumericId = (l = 10) => {
    let n = '';
    for (let i = 0; i < l; ++i) {
        n += Math.floor(Math.random() * 10);
    }
    return n;
};
export const getTypeAsBuffer = (value) => {
    if (value === null) {
        return BUFFER_NULL_TYPE;
    }
    switch (typeof value) {
        case 'string':
            return BUFFER_STRING_TYPE;
        case 'number':
            return Number.isInteger(+value)
                ? BUFFER_INTEGER_TYPE
                : BUFFER_DOUBLE_TYPE;
        case 'boolean':
            return BUFFER_BOOLEAN_TYPE;
        case 'object':
            return BUFFER_OBJECT_TYPE;
        case 'undefined':
            return BUFFER_UNDEFINED_TYPE;
        default:
            return BUFFER_OBJECT_TYPE;
    }
};
//# sourceMappingURL=util.js.map