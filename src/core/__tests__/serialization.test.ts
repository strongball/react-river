import { describe, expect, it, vi } from 'vitest';

import { RiverContainer } from '../container';
import { stateProvider, promiseProvider } from '../provider';
import { validateSerializable, isSerializable } from '../serialization';

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

describe('isSerializable()', () => {
  it('returns true for primitives', () => {
    expect(isSerializable(1)).toBe(true);
    expect(isSerializable('a')).toBe(true);
    expect(isSerializable(true)).toBe(true);
    expect(isSerializable(null)).toBe(true);
  });

  it('returns false for functions and symbols', () => {
    expect(isSerializable(() => {})).toBe(false);
    expect(isSerializable(Symbol('s'))).toBe(false);
  });

  it('returns false for class instances', () => {
    class User {}
    expect(isSerializable(new User())).toBe(false);
  });

  it('returns true for plain objects and arrays', () => {
    expect(isSerializable({ a: 1, b: [2, 3] })).toBe(true);
  });

  it('returns false for circular references', () => {
    const circular: any = {};
    circular.self = circular;
    expect(isSerializable(circular)).toBe(false);
  });
});

describe('validateSerializable()', () => {
  it('warns about functions', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateSerializable({ a: () => {} }, 'test', 'root');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[River SSR] Provider "test" contains a non-serializable value (function) at path "root.a"',
      ),
    );
    warnSpy.mockRestore();
  });

  it('warns about symbols', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateSerializable({ s: Symbol('test') }, 'test', 'root');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[River SSR] Provider "test" contains a non-serializable value (symbol) at path "root.s"',
      ),
    );
    warnSpy.mockRestore();
  });

  it('warns about class instances', () => {
    class User {
      name: string;
      constructor(name: string) {
        this.name = name;
      }
    }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateSerializable(new User('John'), 'test', 'root');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[River SSR] Provider "test" contains a class instance or special object (User) at path "root"',
      ),
    );
    warnSpy.mockRestore();
  });

  it('warns about circular references', () => {
    const circular: any = {};
    circular.self = circular;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateSerializable(circular, 'test', 'root');
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[River SSR] Provider "test" contains a circular reference at path "root.self"'),
    );
    warnSpy.mockRestore();
  });

  it('handles nested structures', () => {
    const data = {
      items: [{ id: 1, action: () => {} }],
    };
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    validateSerializable(data, 'test', 'root');
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('at path "root.items[0].action"'));
    warnSpy.mockRestore();
  });
});

describe('Integration: Container dehydrate with validation', () => {
  it('triggers validation warnings during dehydrate', () => {
    const invalidProvider = stateProvider(() => ({ fn: () => {} }), { name: 'invalid' });
    const container = new RiverContainer();
    container.read(invalidProvider);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    container.dehydrate();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('triggers validation warnings for async data', async () => {
    const invalidAsync = promiseProvider(() => Promise.resolve({ fn: () => {} }), { name: 'async' });
    const container = new RiverContainer();
    container.read(invalidAsync);
    await delay(10);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    container.dehydrate();

    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('skips non-serializable states from the final output', () => {
    const invalidProvider = stateProvider(() => ({ fn: () => {} }), { name: 'invalid' });
    const validProvider = stateProvider(() => 'ok', { name: 'valid' });

    const container = new RiverContainer();
    container.read(invalidProvider);
    container.read(validProvider);

    // Suppress warning for this test
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const state = container.dehydrate();

    expect(state).toEqual({ valid: 'ok' });
    expect(state).not.toHaveProperty('invalid');
  });

  it('correctly dehydrates states that have a "status" field without mistaking them for AsyncValue', () => {
    // This tests that we use provider.kind instead of duck-typing the value
    const statusProvider = stateProvider(() => ({ status: 'active', data: 'some-data' }), { name: 'userStatus' });
    const container = new RiverContainer();
    container.read(statusProvider);

    const state = container.dehydrate();

    // It should export the whole object, not try to unwrap it
    expect(state).toEqual({
      userStatus: { status: 'active', data: 'some-data' },
    });
  });
});
