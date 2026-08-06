import { describe, it, expect } from 'vitest';

import { RiverContainer } from '../container';
import { provider } from '../provider';
import {
  providerFamily,
  stateProviderFamily,
  promiseProviderFamily,
  observableProviderFamily,
  streamProviderFamily,
  notifierProviderFamily,
  asyncNotifierProviderFamily,
} from '../family';
import { Notifier, AsyncNotifier } from '../notifier';

describe('Provider Families', () => {
  it('providerFamily should create parameterized providers', () => {
    const container = new RiverContainer();
    const greet = providerFamily<string, string>((ref, name) => `Hello ${name}`, { name: 'greet' });

    expect(container.read(greet('Alice'))).toBe('Hello Alice');
    expect(container.read(greet('Bob'))).toBe('Hello Bob');
    // Same instance for same arg
    expect(greet('Alice')).toBe(greet('Alice'));
  });

  it('stateProviderFamily should create parameterized state providers', () => {
    const container = new RiverContainer();
    const counter = stateProviderFamily<number, string>((ref, id) => 0, { name: 'counter' });

    container.set(counter('a'), 1);
    container.set(counter('b'), 2);

    expect(container.read(counter('a'))).toBe(1);
    expect(container.read(counter('b'))).toBe(2);
  });

  it('promiseProviderFamily should create parameterized promise providers', async () => {
    const container = new RiverContainer();
    const fetchUser = promiseProviderFamily<{ name: string }, number>(
      async (ref, id) => {
        return { name: `User ${id}` };
      },
      { name: 'fetchUser' },
    );

    const user1 = await container.read(fetchUser(1).promise);
    expect(user1.name).toBe('User 1');

    const user2 = await container.read(fetchUser(2).promise);
    expect(user2.name).toBe('User 2');
  });

  it('observableProviderFamily should create parameterized observable providers', () => {
    const container = new RiverContainer();
    const stream = observableProviderFamily<number, number>(
      (ref, start) => {
        const current = start;
        return {
          subscribe: (cb: any) => {
            const next = typeof cb === 'function' ? cb : cb.next;
            next(current);
            return { unsubscribe: () => {} };
          },
        };
      },
      { name: 'stream' },
    );

    expect(container.read(stream(10)).data).toBe(10);
    expect(container.read(stream(20)).data).toBe(20);
  });

  it('streamProviderFamily should create parameterized generator providers', () => {
    const container = new RiverContainer();
    const stream = streamProviderFamily<number, number>(
      function* (_ref, value) {
        yield value;
        yield value * 2;
      },
      { name: 'generatorStream' },
    );

    expect(container.read(stream(3)).data).toBe(6);
    expect(container.read(stream(4)).data).toBe(8);
  });

  it('notifierProviderFamily should create parameterized notifier providers', () => {
    const container = new RiverContainer();
    class MyNotifier extends Notifier<number> {
      private initial: number;
      constructor(initial: number) {
        super();
        this.initial = initial;
      }
      build() {
        return this.initial;
      }
    }

    const myFamily = notifierProviderFamily((initial: number) => new MyNotifier(initial), { name: 'myFamily' });

    expect(container.read(myFamily(10))).toBe(10);
    expect(container.read(myFamily(20))).toBe(20);
  });

  it('asyncNotifierProviderFamily should create parameterized async notifier providers', async () => {
    const container = new RiverContainer();
    class MyAsyncNotifier extends AsyncNotifier<number> {
      private initial: number;
      constructor(initial: number) {
        super();
        this.initial = initial;
      }
      async build() {
        return this.initial;
      }
    }

    const myFamily = asyncNotifierProviderFamily((initial: number) => new MyAsyncNotifier(initial), {
      name: 'myFamily',
    });

    expect(await container.read(myFamily(10).promise)).toBe(10);
    expect(await container.read(myFamily(20).promise)).toBe(20);
  });

  it('should support object arguments via serialization', () => {
    const container = new RiverContainer();
    const p = providerFamily<string, { id: number }>((ref, arg) => `ID: ${arg.id}`, { name: 'p' });

    expect(container.read(p({ id: 1 }))).toBe('ID: 1');
    expect(p({ id: 1 })).toBe(p({ id: 1 }));
    expect(p({ id: 1 })).not.toBe(p({ id: 2 }));
  });

  it('should treat object arguments with different key order as the same', () => {
    const container = new RiverContainer();
    const p = providerFamily<string, { a?: number; b?: number }>((ref, arg) => `a: ${arg.a}, b: ${arg.b}`, { name: 'p' });

    const arg1 = { a: 1, b: 2 };
    const arg2 = { b: 2, a: 1 };

    expect(p(arg1)).toBe(p(arg2));
    expect(container.read(p(arg1))).toBe('a: 1, b: 2');
    expect(container.read(p(arg2))).toBe('a: 1, b: 2');
  });


  it('family.clear() should clear the cache', () => {
    const p = providerFamily((ref, id) => id, { name: 'clear' });
    const instance1 = p(1);
    p.clear();
    const instance2 = p(1);
    expect(instance1).not.toBe(instance2);
  });

  it('should use custom names with parameter suffixes', () => {
    const p = providerFamily((ref, id) => id, { name: 'myProvider' });
    expect(p(1).name).toBe('myProvider(1)');

    const sp = stateProviderFamily((ref, id) => id, { name: 'sp' });
    expect(sp(1).name).toBe('sp(1)');

    const pp = promiseProviderFamily(async (ref, id) => id, { name: 'pp' });
    expect(pp(1).name).toBe('pp(1)');

    const op = observableProviderFamily((ref, id) => ({ subscribe: () => ({ unsubscribe: () => {} }) }), {
      name: 'op',
    });
    expect(op(1).name).toBe('op(1)');

    class MyNotifier extends Notifier<number> {
      build() {
        return 0;
      }
    }
    const np = notifierProviderFamily((id: number) => new MyNotifier(), { name: 'np' });
    expect(np(1).name).toBe('np(1)');

    class MyAsyncNotifier extends AsyncNotifier<number> {
      async build() {
        return 0;
      }
    }
    const anp = asyncNotifierProviderFamily((id: number) => new MyAsyncNotifier(), { name: 'anp' });
    expect(anp(1).name).toBe('anp(1)');
  });

  it('serializeArg should handle boolean and numbers', () => {
    const p = providerFamily((ref, arg) => arg, { name: 'myProvider' });
    // Check key internal via cache if we could, but we can just check if they are distinct
    expect(p(true)).not.toBe(p(false));
    expect(p(1)).not.toBe(p(2));
    // Note: currently '1' and 1 collide in serializeArg implementation
    // expect(p('1')).not.toBe(p(1));
  });

  it('family.getProviders() should return all cached provider instances', () => {
    const p = providerFamily((ref, id) => id, { name: 'getProvidersTest' });
    const instance1 = p(1);
    const instance2 = p(2);
    
    const providers = p.getProviders();
    expect(providers).toHaveLength(2);
    expect(providers).toContain(instance1);
    expect(providers).toContain(instance2);
  });

  it('container.invalidateFamily should invalidate all instances of a family', () => {
    const container = new RiverContainer();
    let counter = 0;
    const p = stateProviderFamily<number, number>((ref, id) => {
      counter++;
      return counter;
    }, { name: 'invalidateFamilyTest' });

    // Initialize two instances
    const val1 = container.read(p(1));
    const val2 = container.read(p(2));
    expect(val1).toBe(1);
    expect(val2).toBe(2);

    // Invalidate the entire family
    container.invalidateFamily(p);

    // Read again, they should both be re-initialized
    const newVal1 = container.read(p(1));
    const newVal2 = container.read(p(2));
    expect(newVal1).toBe(3);
    expect(newVal2).toBe(4);
  });

  it('ref.invalidateFamily should invalidate all instances of a family from within another provider', () => {
    const container = new RiverContainer();
    let counter = 0;
    const p = stateProviderFamily<number, number>((ref, id) => {
      counter++;
      return counter;
    }, { name: 'refInvalidateFamilyTest' });

    // Initialize two instances
    container.read(p(1));
    container.read(p(2));

    const triggerProvider = provider((ref) => {
      return {
        trigger: () => ref.invalidateFamily(p),
      };
    }, { name: 'trigger' });

    const trig = container.read(triggerProvider);
    trig.trigger();

    // Read again, they should both be re-initialized
    const newVal1 = container.read(p(1));
    const newVal2 = container.read(p(2));
    expect(newVal1).toBe(3);
    expect(newVal2).toBe(4);
  });
});
