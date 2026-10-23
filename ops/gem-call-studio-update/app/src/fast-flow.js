export function singleFlight() {
  const pending = new Map();
  return (key, operation) => {
    if (pending.has(key)) return pending.get(key);
    const result = Promise.resolve().then(operation);
    pending.set(key, result);
    const clear = () => { if (pending.get(key) === result) pending.delete(key); };
    result.then(clear, clear);
    return result;
  };
}
export function pollSequential(operation, { intervalMs = 5000, hiddenIntervalMs = 15000, isHidden = () => false, onError = () => {}, timers = globalThis } = {}) {
  let stopped = false, timer;
  async function tick() {
    try { await operation(); } catch (error) { onError(error); }
    finally { if (!stopped) timer = timers.setTimeout(tick, isHidden() ? hiddenIntervalMs : intervalMs); }
  }
  void tick();
  return () => { stopped = true; if (timer !== undefined) timers.clearTimeout(timer); };
}
