import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { once } from 'node:events';
import { generateNumericId } from './util.js';
const WORKERS_MAX_COUNT = 10;
export class WorkerPool {
    workerPath;
    workersMap = new Map();
    isDestroyed = false;
    static __singletonInstance;
    constructor() {
        if (WorkerPool.__singletonInstance) {
            return WorkerPool.__singletonInstance;
        }
        WorkerPool.__singletonInstance = this;
        const dirname = import.meta.dirname;
        const workerPath = path.join(dirname, 'worker.mjs');
        this.workerPath = workerPath;
    }
    getWorker(workerData) {
        if (this.isDestroyed) {
            throw new Error('Worker pool is destroyed');
        }
        if (this.workersMap.size >= WORKERS_MAX_COUNT) {
            process.stderr.write('[WARN] Worker pool is full\n');
        }
        const serializedData = JSON.stringify(workerData);
        const worker = this.workersMap.get(serializedData);
        if (worker) {
            return worker;
        }
        const newWorker = new Worker(this.workerPath, {
            name: generateNumericId(10),
            stdout: true,
            stdin: true,
            stderr: false,
            workerData: {
                severity: workerData.severity,
                encoding: workerData.encoding,
                format: workerData.format,
            },
        });
        newWorker.unref();
        this.workersMap.set(serializedData, newWorker);
        return newWorker;
    }
    async destroy() {
        if (this.isDestroyed)
            return;
        this.isDestroyed = true;
        const promises = [];
        for (const [_, worker] of this.workersMap) {
            promises.push(once(worker, 'exit'));
            worker.terminate();
        }
        await Promise.allSettled(promises);
    }
}
//# sourceMappingURL=wpool.js.map