/**
 * Main-thread client for the search workers.
 *
 * Falls back to a synchronous search on the main thread when workers are not
 * available (sandboxed iframes, disabled JS APIs, …) so the game never ends up
 * without an opponent.
 */
import { searchPosition, type SearchReply, type SearchRequest } from './engineCore';

type Pending = {
  resolve: (r: SearchReply) => void;
  settled: boolean;
};

class EnginePool {
  private workers: Worker[] = [];
  private next = 0;
  private seq = 1;
  private pending = new Map<number, Pending>();
  private broken = false;
  private spawned = false;

  constructor(private size = 2) {}

  private spawn() {
    if (this.spawned || this.broken) return;
    this.spawned = true;
    try {
      for (let i = 0; i < this.size; i++) {
        const w = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
        w.onmessage = (event: MessageEvent<{ id: number; reply?: SearchReply; error?: string }>) => {
          const { id, reply, error } = event.data;
          const entry = this.pending.get(id);
          if (!entry) return;
          this.pending.delete(id);
          entry.settled = true;
          if (error || !reply) entry.resolve({ from: null, to: null, score: 0, depth: 0, nodes: 0, timeMs: 0, evalForWhite: 0 });
          else entry.resolve(reply);
        };
        w.onerror = () => {
          // If a worker dies, keep the app alive by disabling the pool.
          this.broken = true;
          this.workers.forEach((x) => x.terminate());
          this.workers = [];
          this.pending.forEach((p) => {
            if (!p.settled) {
              p.settled = true;
              p.resolve({ from: null, to: null, score: 0, depth: 0, nodes: 0, timeMs: 0, evalForWhite: 0 });
            }
          });
          this.pending.clear();
        };
        this.workers.push(w);
      }
    } catch {
      this.broken = true;
      this.workers = [];
    }
  }

  /**
   * Resolve with the best move, or null when the caller aborted (the worker may
   * still answer later — the reply is simply ignored).
   */
  search(req: SearchRequest, signal?: AbortSignal): Promise<SearchReply | null> {
    this.spawn();
    if (this.broken || this.workers.length === 0) {
      return new Promise((resolve) => {
        setTimeout(() => {
          if (signal?.aborted) return resolve(null);
          try {
            resolve(searchPosition(req));
          } catch {
            resolve(null);
          }
        }, 0);
      });
    }
    const id = this.seq++;
    const worker = this.workers[id % this.workers.length];
    return new Promise((resolve) => {
      const entry: Pending = { resolve, settled: false };
      this.pending.set(id, entry);
      const onAbort = () => {
        if (!entry.settled) {
          entry.settled = true;
          this.pending.delete(id);
          resolve(null);
        }
      };
      signal?.addEventListener('abort', onAbort, { once: true });
      worker.postMessage({ id, req });
    });
  }

  dispose() {
    this.workers.forEach((w) => w.terminate());
    this.workers = [];
    this.spawned = false;
    this.broken = false;
  }
}

export const enginePool = new EnginePool(2);
export type { SearchReply, SearchRequest };
