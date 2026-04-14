import { describe, it, expect } from 'vitest';
import { RiverContainer } from '../container';
import { notifierProvider, asyncNotifierProvider } from '../provider';
import { Notifier, AsyncNotifier } from '../notifier';

describe('Notifier', () => {
  it('should manage synchronous state', () => {
    class CounterNotifier extends Notifier<number> {
      build() { return 0; }
      increment() { this.state++; }
    }
    
    const p = notifierProvider(() => new CounterNotifier());
    const container = new RiverContainer();
    
    expect(container.read(p)).toBe(0);
    
    const notifier = container.read(p.notifier);
    notifier.increment();
    
    expect(container.read(p)).toBe(1);
    expect(notifier.state).toBe(1);
  });

  it('should support update() convenience method', () => {
    class TextNotifier extends Notifier<string> {
      build() { return 'a'; }
    }
    const p = notifierProvider(() => new TextNotifier());
    const container = new RiverContainer();
    const notifier = container.read(p.notifier);
    
    notifier.update((s) => s + 'b');
    expect(container.read(p)).toBe('ab');
  });
});

describe('AsyncNotifier', () => {
  it('should manage asynchronous state', async () => {
    class DelayedNotifier extends AsyncNotifier<string> {
      async build() {
        return 'initial';
      }
    }
    
    const p = asyncNotifierProvider(() => new DelayedNotifier());
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
      async build() { return 1; }
      async setTo(val: number) { this.state = { status: 'data', data: val, isLoading: false, isError: false, hasData: true, error: undefined }; }
    }
    
    const p = asyncNotifierProvider(() => new ManualAsyncNotifier());
    const container = new RiverContainer();
    const notifier = container.read(p.notifier);
    
    await container.read(p.promise);
    expect(container.read(p).data).toBe(1);
    
    notifier.setTo(10);
    expect(container.read(p).data).toBe(10);
  });

  it('AsyncNotifier - error handling in build()', async () => {
    class FailNotifier extends AsyncNotifier<number> {
      async build(): Promise<number> { throw 'notif-fail'; }
    }
    const p = asyncNotifierProvider(() => new FailNotifier());
    const container = new RiverContainer();
    
    await expect(container.read(p.promise)).rejects.toBe('notif-fail');
    expect((container.read(p) as any).error).toBe('notif-fail');
  });

  it('base class methods and property accessors', () => {
    class MixedNotif extends Notifier<number> {
      build() { return 0; }
      testAccessors() {
        expect(this.ref).toBeDefined();
        expect(this.state).toBe(0);
        this.onDispose(() => {});
      }
    }
    const p = notifierProvider(() => new MixedNotif());
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
    const p = asyncNotifierProvider(() => new MixedAsyncNotif());
    const container = new RiverContainer();
    await container.read(p.promise);
    const notifier = container.read(p.notifier);
    notifier.testAccessors();

    container.dispose();
    expect(disposed).toBe(true);
  });
});
