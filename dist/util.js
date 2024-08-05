"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateNumericId = exports.openFileInSyncWay = void 0;
const node_fs_1 = require("node:fs");
const consts_1 = require("./consts");
const openFileInSyncWay = (filePath, encoding, highWaterMark, signal) => {
    const filePaths = filePath.split('/');
    const cwd = process.cwd();
    const cwdDir = cwd.split('/').slice(-1)[0];
    const si = filePaths.indexOf(cwdDir) + 1;
    for (let i = si; i <= filePaths.length; i++) {
        const p = filePaths.slice(0, i).join('/');
        if ((0, node_fs_1.existsSync)(p))
            continue;
        i === filePaths.length ? createEmptyFile(p) : createEmptyDir(p);
    }
    return (0, node_fs_1.createWriteStream)(filePath, {
        encoding,
        signal,
        autoClose: true,
        highWaterMark,
    });
};
exports.openFileInSyncWay = openFileInSyncWay;
function createEmptyFile(filePath) {
    let fd;
    try {
        fd = (0, node_fs_1.openSync)(filePath, 'w');
    }
    catch (err) {
        process.stderr.write(`${consts_1.LOGGER_PREFIX} Failed to create file: ${err.message}\n`);
        throw err;
    }
    finally {
        fd && (0, node_fs_1.closeSync)(fd);
    }
}
function createEmptyDir(dirPath) {
    try {
        (0, node_fs_1.mkdirSync)(dirPath);
    }
    catch (err) {
        process.stderr.write(`${consts_1.LOGGER_PREFIX} Failed to create dir: ${err.message}\n`);
        throw err;
    }
}
const generateNumericId = (l = 10) => {
    let n = '';
    for (let i = 0; i < l; ++i) {
        n += Math.floor(Math.random() * 10);
    }
    return n;
};
exports.generateNumericId = generateNumericId;
//# sourceMappingURL=util.js.map