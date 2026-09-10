/// <reference lib="webworker" />
import { searchPosition, type SearchReply, type SearchRequest } from './engineCore';

interface InMsg {
  id: number;
  req: SearchRequest;
}
interface OutMsg {
  id: number;
  reply?: SearchReply;
  error?: string;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (event: MessageEvent<InMsg>) => {
  const { id, req } = event.data;
  try {
    const reply = searchPosition(req);
    const msg: OutMsg = { id, reply };
    ctx.postMessage(msg);
  } catch (err) {
    const msg: OutMsg = { id, error: err instanceof Error ? err.message : String(err) };
    ctx.postMessage(msg);
  }
};
