import test from 'node:test';
import assert from 'node:assert/strict';
import { createSaveQueue } from './save-queue.js';
test('coalesces pending edits', async () => {
  const writes = [];
  const queue = createSaveQueue();
  queue.schedule(async () => { writes.push('old'); });
  queue.schedule(async () => { writes.push('latest'); });
  await queue.flush();
  assert.deepEqual(writes, ['latest']);
});
test('serializes writes while another save is in flight', async () => {
  const writes = [];
  let release;
  const blocked = new Promise((resolve) => { release = resolve; });
  const queue = createSaveQueue();
  queue.schedule(async () => { writes.push('first:start'); await blocked; writes.push('first:end'); });
  const flush = queue.flush();
  await Promise.resolve();
  queue.schedule(async () => { writes.push('superseded'); });
  queue.schedule(async () => { writes.push('latest'); });
  release();
  await flush;
  assert.deepEqual(writes, ['first:start', 'first:end', 'latest']);
});
test('reports failures and retries the failed save', async () => {
  let attempts = 0;
  const queue = createSaveQueue();
  queue.schedule(async () => { if (++attempts === 1) throw new Error('offline'); });
  await assert.rejects(queue.flush(), /offline/);
  await queue.retry();
  assert.equal(attempts, 2);
});
test('can be reused after React StrictMode effect cleanup', async () => {
  let writes = 0;
  const queue = createSaveQueue();
  queue.cancel();
  queue.schedule(async () => { writes++; });
  await queue.flush();
  assert.equal(writes, 1);
});
