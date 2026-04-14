import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';
import { RiverScope } from './scope';
import { useRiverWatch, useRiverRef } from './hooks';
import { stateProvider } from '../core/provider';

const counterProvider = stateProvider(() => 0);

describe('React Hooks', () => {
  it('useRiverWatch should track state changes', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RiverScope>{children}</RiverScope>
    );

    const { result } = renderHook(() => {
      const count = useRiverWatch(counterProvider);
      const ref = useRiverRef();
      return { count, ref };
    }, { wrapper });

    expect(result.current.count).toBe(0);

    act(() => {
      result.current.ref.set(counterProvider, 1);
    });

    expect(result.current.count).toBe(1);

    act(() => {
      result.current.ref.set(counterProvider, (prev) => prev + 1);
    });

    expect(result.current.count).toBe(2);
  });

  it('useRiverWatch should support selectors', () => {
    const userProvider = stateProvider(() => ({ name: 'John', age: 30 }));
    
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <RiverScope>{children}</RiverScope>
    );

    const { result } = renderHook(() => {
      const name = useRiverWatch(userProvider, (u) => u.name);
      const ref = useRiverRef();
      return { name, ref };
    }, { wrapper });

    expect(result.current.name).toBe('John');

    act(() => {
      result.current.ref.set(userProvider, { name: 'Doe', age: 30 });
    });

    expect(result.current.name).toBe('Doe');
  });
});
