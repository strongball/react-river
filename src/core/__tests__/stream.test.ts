import { describe, expect, it } from 'vitest';

import { RiverContainer } from '../container';
import { streamProvider } from '../provider';

describe('streamProvider', () => {
  it('consumes a synchronous generator and keeps its final value', async () => {
    const container = new RiverContainer();
    const provider = streamProvider(
      function* () {
        yield 1;
        yield 2;
      },
      { name: 'stream_sync_generator' },
    );

    const value = container.read(provider);

    expect(provider.kind).toBe('streamProvider');
    expect(value.status).toBe('data');
    expect(value.data).toBe(2);
    await expect(container.read(provider.promise)).resolves.toBe(2);
  });

  it('consumes an async generator and updates for each yielded value', async () => {
    const container = new RiverContainer();
    let releaseSecond!: () => void;
    const secondGate = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const updates: unknown[] = [];
    const provider = streamProvider(
      async function* () {
        yield 'first';
        await secondGate;
        yield 'second';
      },
      { name: 'stream_async_generator' },
    );

    container.read(provider);
    const unsubscribe = container.listen(provider, (next) => updates.push(next.data));

    await expect(container.read(provider.promise)).resolves.toBe('first');
    expect(container.read(provider).data).toBe('first');

    releaseSecond();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(container.read(provider).data).toBe('second');
    expect(updates).toEqual(['first', 'second']);
    unsubscribe();
  });

  it('turns async generator errors into AsyncError', async () => {
    const container = new RiverContainer();
    const provider = streamProvider(
      async function* () {
        yield* [];
        throw new Error('stream failed');
      },
      { name: 'stream_error' },
    );

    await expect(container.read(provider.promise)).rejects.toThrow('stream failed');
    expect(container.read(provider).status).toBe('error');
  });

  it('closes an async generator when the container is disposed', async () => {
    const container = new RiverContainer();
    let release!: () => void;
    let finalized = false;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const provider = streamProvider(
      async function* () {
        try {
          await gate;
          yield 1;
        } finally {
          finalized = true;
        }
      },
      { name: 'stream_dispose' },
    );

    container.read(provider);
    container.dispose();
    release();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(finalized).toBe(true);
  });
});
