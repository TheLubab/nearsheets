export const READ_TIMEOUT_MS = 15_000;

/** Bound the whole read, including response decoding. Also handles ports that ignore abort. */
export async function boundedRead<T>(read:(signal:AbortSignal)=>Promise<T>, signal?:AbortSignal, timeout=READ_TIMEOUT_MS):Promise<T> {
  const controller=new AbortController();
  const abort=()=>controller.abort(signal?.reason ?? new DOMException('Read cancelled','AbortError'));
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('Read timed out. Refresh to try again.','TimeoutError')),timeout);
  let onAbort:()=>void=()=>{};
  try {
    return await Promise.race([
      new Promise<never>((_,reject)=>{
        onAbort=()=>reject(controller.signal.reason);
        if(controller.signal.aborted)onAbort();else controller.signal.addEventListener('abort',onAbort,{once:true});
      }),
      controller.signal.aborted ? Promise.reject(controller.signal.reason) : read(controller.signal),
    ]);
  } finally {
    clearTimeout(timer);signal?.removeEventListener('abort',abort);controller.signal.removeEventListener('abort',onAbort);
  }
}
