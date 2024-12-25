"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNumericId = void 0;
const generateNumericId = (l = 10) => {
    let n = '';
    for (let i = 0; i < l; ++i) {
        n += Math.floor(Math.random() * 10);
    }
    return n;
};
exports.generateNumericId = generateNumericId;
//# sourceMappingURL=util.js.map