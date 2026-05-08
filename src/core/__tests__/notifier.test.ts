import { describe, it, expect } from 'vitest';

import { RiverContainer } from '../container';
import { Notifier, AsyncNotifier } from '../notifier';
import { notifierProvider, asyncNotifierProvider, stateProvider } from '../provider';

describe('Notifier', () => {
  it('should manage synchronous state', () => {
    class CounterNotifier extends Notifier<number> {
      build() {
        return 0;
      }
      increment() {
        this.state++;
      }
    }

    const p = notifierProvider(() => new CounterNotifier(), { name: 'test_notifierProvider_480' });
    const container = new RiverContainer();

    expect(container.read(p)).toBe(0);

    const notifier = container.read(p.notifier);
    notifier.increment();

    expect(container.read(p)).toBe(1);
    expect(notifier.state).toBe(1);
  });

  it('should support update() convenience method', () => {
    class TextNotifier extends Notifier<string> {
      build() {
        return 'a';
      }
    }
    const p = notifierProvider(() => new TextNotifier(), { name: 'test_notifierProvider_982' });
    const container = new RiverContainer();
    const notifier = container.read(p.notifier);

    notifier.update((s) => s + 'b');
    expect(container.read(p)).toBe('ab');
  });

  it('Notifier listening to B receives updates, builds once, and B disposes when A disposes', async () => {
    let aBuildCount = 0;
    const bProvider = stateProvider((ref) => 0, { name: 'b', autoDispose: true, cacheTime: 0 }); // initial value 0
    let aNotif: ANotifier;

    class ANotifier extends Notifier<number> {
      build() {
        aBuildCount++;
        // oxlint-disable-next-line typescript/no-this-alias
        aNotif = this;
        this.ref.listen(bProvider, (next: number) => {
          this.state = next;
        });
        return 0; // initial state
      }
    }

    const aProvider = notifierProvider(() => new ANotifier(), { name: 'a', autoDispose: true, cacheTime: 0 });
    const container = new RiverContainer();

    // Subscribe to A to initialize and keep alive (this starts listening to B)
    const unsubA = container.listen(aProvider, () => {});

    expect(aBuildCount).toBe(1);
    expect(aNotif!.state).toBe(0);

    // Initial listener check: B is alive because A is listening
    expect(container.getState(bProvider.id)).toBeDefined();

    // Trigger B to update (mocking a "bouncing" / updating B provider)
    container.set(bProvider, 10);
    container.set(bProvider, 20);

    // Assert B's updates flow to A
    expect(aNotif!.state).toBe(20);

    // Assert A only built once despite B changing
    expect(aBuildCount).toBe(1);

    // Now trigger dispose of A
    unsubA();

    // Give autoDispose a microtask to finish cleanup
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Assert A is disposed
    expect(container.getState(aProvider.id)).toBeUndefined();

    // Assert B is disposed (cascading cleanup)
    expect(container.getState(bProvider.id)).toBeUndefined();
  });
});

describe('AsyncNotifier', () => {
  it('should manage asynchronous state', async () => {
    class DelayedNotifier extends AsyncNotifier<string> {
      async build() {
        return 'initial';
      }
    }

    const p = asyncNotifierProvider(() => new DelayedNotifier(), { name: 'test_asyncNotifierProvider_3196' });
    const container = new RiverContainer();

    // Initial read returns loading
    const val = container.read(p);
    expect(val.status).toBe('loading');

    // Wait for promise
    const data = await container.read(p.promise);
    expect(data).toBe('initial');
    expect(container.read(p).status).toBe('data');
    expect(container.read(p).data).toBe('initial');
  });

  it('should support manual state updates', async () => {
    class ManualAsyncNotifier extends AsyncNotifier<number> {
      async build() {
        return 1;
      }
      async setTo(val: number) {
        this.state = { status: 'data', data: val, isLoading: false, isError: false, hasData: true, error: undefined };
      }
    }

    const p = asyncNotifierProvider(() => new ManualAsyncNotifier(), { name: 'test_asyncNotifierProvider_4017' });
    const container = new RiverContainer();
    const notifier = container.read(p.notifier);

    await container.read(p.promise);
    expect(container.read(p).data).toBe(1);

    notifier.setTo(10);
    expect(container.read(p).data).toBe(10);
  });

  it('AsyncNotifier - error handling in build()', async () => {
    class FailNotifier extends AsyncNotifier<number> {
      async build(): Promise<number> {
        throw 'notif-fail';
      }
    }
    const p = asyncNotifierProvider(() => new FailNotifier(), { name: 'test_asyncNotifierProvider_4584' });
    const container = new RiverContainer();

    await expect(container.read(p.promise)).rejects.toBe('notif-fail');
    expect((container.read(p) as any).error).toBe('notif-fail');
  });

  it('base class methods and property accessors', () => {
    class MixedNotif extends Notifier<number> {
      build() {
        return 0;
      }
      testAccessors() {
        expect(this.ref).toBeDefined();
        expect(this.state).toBe(0);
        this.onDispose(() => {});
      }
    }
    const p = notifierProvider(() => new MixedNotif(), { name: 'test_notifierProvider_5042' });
    const container = new RiverContainer();
    container.read(p.notifier).testAccessors();
  });

  it('AsyncNotifier - base class methods and property accessors', async () => {
    let disposed = false;
    class MixedAsyncNotif extends AsyncNotifier<number> {
      async build() {
        return 0;
      }
      testAccessors() {
        expect(this.ref).toBeDefined();
        expect(this.state.data).toBe(0);
        this.onDispose(() => {
          disposed = true;
        });
      }
    }
    const p = asyncNotifierProvider(() => new MixedAsyncNotif(), { name: 'test_asyncNotifierProvider_5773' });
    const container = new RiverContainer();
    await container.read(p.promise);
    const notifier = container.read(p.notifier);
    notifier.testAccessors();

    container.dispose();
    expect(disposed).toBe(true);
  });
});
