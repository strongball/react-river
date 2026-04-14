import { describe, it, expect } from 'vitest';
import { asyncData, asyncLoading, asyncError, when, mapAsyncValue, requireData } from './async_value';

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
  });

  describe('requireData', () => {
    it('returns data if present', () => {
      expect(requireData(asyncData(5))).toBe(5);
    });

    it('throws if no data', () => {
      expect(() => requireData(asyncLoading())).toThrow();
    });
  });
});
