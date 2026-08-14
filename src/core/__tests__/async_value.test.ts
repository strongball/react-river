import { describe, it, expect } from 'vitest';

import {
  asyncData,
  asyncLoading,
  asyncError,
  when,
  whenOrNull,
  mapAsyncValue,
  requireData,
  asyncValueEquals,
  asyncValueToPromise,
} from '../async_value';

describe('AsyncValue', () => {
  describe('constructors', () => {
    it('creates data state', () => {
      const val = asyncData('hello');
      expect(val.status).toBe('data');
      expect(val.data).toBe('hello');
      expect(val.isLoading).toBe(false);
      expect(val.isError).toBe(false);
      expect(val.hasData).toBe(true);
    });

    it('creates loading state', () => {
      const val = asyncLoading();
      expect(val.status).toBe('loading');
      expect(val.isLoading).toBe(true);
      expect(val.hasData).toBe(false);
    });

    it('creates loading state with previous data', () => {
      const val = asyncLoading('prev');
      expect(val.data).toBe('prev');
    });

    it('creates error state', () => {
      const error = new Error('fail');
      const val = asyncError(error);
      expect(val.status).toBe('error');
      expect(val.error).toBe(error);
      expect(val.isError).toBe(true);
    });
  });

  describe('when', () => {
    it('matches data', () => {
      const val = asyncData(10);
      const result = when(val, {
        data: (d) => d * 2,
        loading: () => 0,
        error: () => -1,
      });
      expect(result).toBe(20);
    });

    it('matches loading', () => {
      const val = asyncLoading();
      const result = when(val, {
        data: (d) => d,
        loading: () => 'is loading',
        error: () => 'is error',
      });
      expect(result).toBe('is loading');
    });

    it('matches error', () => {
      const error = 'some error';
      const val = asyncError(error);
      const result = when(val, {
        data: (d) => d,
        loading: () => 'loading',
        error: (e) => e,
      });
      expect(result).toBe(error);
    });
  });

  describe('whenOrNull', () => {
    it('returns undefined for unhandled branches', () => {
      const data = asyncData(1);
      const loading = asyncLoading();
      const error = asyncError('err');

      expect(whenOrNull(data, {})).toBeUndefined();
      expect(whenOrNull(loading, {})).toBeUndefined();
      expect(whenOrNull(error, {})).toBeUndefined();
    });
  });

  describe('mapAsyncValue', () => {
    it('maps data status', () => {
      const val = asyncData(10);
      const mapped = mapAsyncValue(val, (v) => v.toString());
      expect(mapped.status).toBe('data');
      expect(mapped.data).toBe('10');
    });

    it('maps loading status preserving data', () => {
      const val = asyncLoading(10);
      const mapped = mapAsyncValue(val, (v) => v.toString());
      expect(mapped.status).toBe('loading');
      expect(mapped.data).toBe('10');
    });

    it('maps error status preserving data', () => {
      const val = asyncError('err', 10);
      const mapped = mapAsyncValue(val, (v) => v.toString());
      expect(mapped.data).toBe('10');
    });

    it('returns undefined data if original is undefined', () => {
      expect(mapAsyncValue(asyncLoading(), (d) => (d as any) + 1).data).toBeUndefined();
      expect(mapAsyncValue(asyncError('err'), (d) => (d as any) + 1).data).toBeUndefined();
    });
  });

  describe('requireData', () => {
    it('returns data if present', () => {
      expect(requireData(asyncData(5))).toBe(5);
      expect(requireData(asyncLoading(10))).toBe(10);
    });

    it('throws if no data', () => {
      expect(() => requireData(asyncLoading())).toThrow();
      expect(() => requireData(asyncError('real-err'))).toThrow('real-err');
    });
  });

  describe('asyncValueEquals', () => {
    it('checks equality correctly', () => {
      expect(asyncValueEquals(asyncData(1), asyncData(1))).toBe(true);
      expect(asyncValueEquals(asyncData(1), asyncData(2))).toBe(false);
      expect(asyncValueEquals(asyncError('e1'), asyncError('e1'))).toBe(true);
      expect(asyncValueEquals(asyncError('e1'), asyncError('e2'))).toBe(false);
      expect(asyncValueEquals(asyncLoading(1), asyncLoading(1))).toBe(true);
      expect(asyncValueEquals(asyncLoading(1), asyncLoading(2))).toBe(false);
    });
  });

  describe('asyncValueToPromise', () => {
    it('resolves immediately for data state', async () => {
      const val = asyncData('done');
      const res = await asyncValueToPromise(val);
      expect(res).toBe('done');
    });

    it('rejects immediately for error state', async () => {
      const val = asyncError('fail');
      await expect(asyncValueToPromise(val)).rejects.toBe('fail');
    });

    it('waits for resolution when loading', async () => {
      const loading = asyncLoading();
      let onNextCb: any;
      const listen = (cb: any) => {
        onNextCb = cb;
        return () => {};
      };

      const promise = asyncValueToPromise(loading, (v) => (v as any).data, listen);

      onNextCb(asyncData('resolved'));
      const res = await promise;
      expect(res).toBe('resolved');
    });

    it('handles error during resolution when loading', async () => {
      const loading = asyncLoading();
      let onNextCb: any;
      const listen = (cb: any) => {
        onNextCb = cb;
        return () => {};
      };

      const promise = asyncValueToPromise(loading, (v) => (v as any).data, listen);

      onNextCb(asyncError('async-fail'));
      await expect(promise).rejects.toBe('async-fail');
    });
  });
});
