import { useRiverWatch, useRiverRef, useRiverListen } from 'react-river';

import { counterProvider, doubledProvider } from '../providers';

export function CounterCard() {
  const count = useRiverWatch(counterProvider);
  const doubled = useRiverWatch(doubledProvider);
  const ref = useRiverRef();

  // Side-effect listener demo: log when count changes
  useRiverListen(counterProvider, (next, _prev) => {
    if (next === 10) {
      console.log('🎉 Counter reached 10!');
    }
  });

  return (
    <section className="card">
      <div className="card-badge">stateProvider + provider</div>
      <h2>Counter</h2>
      <div className="counter-display">{count}</div>
      <p className="muted">
        doubled = <strong>{doubled}</strong>
      </p>
      <div className="button-row">
        <button onClick={() => ref.set(counterProvider, (c) => c - 1)}>−</button>
        <button onClick={() => ref.set(counterProvider, 0)} className="secondary">
          Reset
        </button>
        <button onClick={() => ref.set(counterProvider, (c) => c + 1)}>+</button>
      </div>
    </section>
  );
}
