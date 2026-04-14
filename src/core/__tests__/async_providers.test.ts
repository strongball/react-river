import { describe, it, expect } from 'vitest';

import { RiverContainer } from '../container';
import { provider, promiseProvider, observableProvider } from '../provider';

describe('Async Providers', () => {
  it('promiseProvider should handle basic promise resolution', async () => {
    const container = new RiverContainer();
    const p = promiseProvider(async () => 'hello');

    expect(container.read(p).status).toBe('loading');
    const data = await container.read(p.promise);
    expect(data).toBe('hello');
    expect(container.read(p).data).toBe('hello');
  });

  it('promiseProvider should handle errors', async () => {
    const container = new RiverContainer();
    const p = promiseProvider(async () => {
      throw new Error('fail');
    });

    container.read(p);
    await expect(container.read(p.promise)).rejects.toThrow('fail');
    expect(container.read(p).status).toBe('error');
  });

  it('observableProvider should handle observable stream', async () => {
    const container = new RiverContainer();

    let nextCb: (v: string) => void;
    const p = observableProvider(() => ({
      subscribe: (callbacks: any) => {
        nextCb = typeof callbacks === 'function' ? callbacks : callbacks.next;
        return { unsubscribe: () => {} };
      },
    }));

    expect(container.read(p).status).toBe('loading');

    // Push data
    nextCb!('first');
    expect(container.read(p).data).toBe('first');
    expect(container.read(p).status).toBe('data');

    nextCb!('second');
    expect(container.read(p).data).toBe('second');
  });

  it('observableProvider should handle async observable creation', async () => {
    const container = new RiverContainer();
    const p = observableProvider(async () => ({
      subscribe: (callbacks: any) => {
        const next = typeof callbacks === 'function' ? callbacks : callbacks.next;
        next('async');
        return { unsubscribe: () => {} };
      },
    }));

    expect(container.read(p).status).toBe('loading');
    await container.read(p.promise);
    expect(container.read(p).data).toBe('async');
  });

  it('should support watching promiseAccessor with selector', async () => {
    const container = new RiverContainer();
    const p = promiseProvider(async () => ({ id: 1, name: 'test' }));

    const nameP = provider((ref) => {
      // ref.watch(promiseAccessor, selector) returns Promise<R>
      return ref.watch(p.promise, (data) => data?.name.toUpperCase());
    });

    const namePromise = container.read(nameP);
    expect(namePromise).toBeInstanceOf(Promise);

    const name = await namePromise;
    expect(name).toBe('TEST');
  });
});
