import { Worker } from 'node:worker_threads';
import { WorkerData } from './types';
import path from 'node:path';
import { once } from 'node:events';
import { generateNumericId } from './util';

const WORKERS_MAX_COUNT = 10;

export class WorkerPool {
  private workerPath: string;
  private workersMap: Map<string, Worker> = new Map();
  private isDestroyed = false;
  static __singletonInstance: WorkerPool;

  constructor() {
    if (WorkerPool.__singletonInstance) {
      return WorkerPool.__singletonInstance;
    }
    WorkerPool.__singletonInstance = this;

    const dirname = import.meta.dirname;
    const workerPath = path.join(dirname, 'worker.mjs');
    this.workerPath = workerPath;
  }

  public getWorker(workerData: WorkerData): Worker {
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
    // newWorker.stderr.pipe(process.stderr, { end: false });

    this.workersMap.set(serializedData, newWorker);

    return newWorker;
  }

  public async destroy() {
    if (this.isDestroyed) return;
    this.isDestroyed = true;

    const promises = [];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for (const [_, worker] of this.workersMap) {
      promises.push(once(worker, 'exit'));
      worker.terminate();
    }
    await Promise.allSettled(promises);
  }
}
