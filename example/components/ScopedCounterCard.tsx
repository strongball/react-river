import { RiverScope, useRiverWatch, useRiverRef } from '@zerologix/react-river';

import { counterProvider, doubledProvider } from '../providers';

/**
 * A reusable counter display that uses the counterProvider from its current scope.
 */
function ScopedCounter({ label }: { label: string }) {
  const count = useRiverWatch(counterProvider);
  const doubled = useRiverWatch(doubledProvider);
  const ref = useRiverRef();

  return (
    <div className="scoped-container">
      <div className="scoped-label">{label}</div>
      <div className="counter-display" style={{ fontSize: '1.8rem', margin: '8px 0' }}>
        {count}
      </div>
      <div className="muted" style={{ marginBottom: '12px' }}>
        doubled: <strong>{doubled}</strong>
      </div>
      <div className="button-row">
        <button
          onClick={() => ref.set(counterProvider, (c) => c - 1)}
          className="secondary"
          style={{ padding: '4px 12px' }}
        >
          −
        </button>
        <button onClick={() => ref.set(counterProvider, (c) => c + 1)} style={{ padding: '4px 12px' }}>
          +
        </button>
      </div>
    </div>
  );
}

export function ScopedCounterCard() {
  return (
    <section className="card scoping-card">
      <div className="card-badge">Scoping & Overrides</div>
      <h2>Modular Scoping</h2>
      <p className="subtitle" style={{ fontSize: '0.9rem', marginBottom: '8px', textAlign: 'left' }}>
        The same provider logic, isolated in different scopes. Overrides allow you to redefine provider behavior or
        initial state for a specific subtree.
      </p>

      <div
        className="scoping-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginTop: '16px',
        }}
      >
        {/* 1. Global / Default Scope */}
        <ScopedCounter label="Root Scope" />

        {/* 2. Scoped Override (Initial Value = 100) */}
        <RiverScope>
          <ScopedCounter label="Scope A (Starts @ 100)" />
        </RiverScope>

        {/* 3. Scoped Override (Initial Value = 1000) */}
        <RiverScope overrides={[{ original: counterProvider, create: () => 1000 }]}>
          <ScopedCounter label="Scope B (Starts @ 1000)" />
        </RiverScope>
      </div>

      <p className="muted" style={{ marginTop: '12px', fontStyle: 'italic' }}>
        Notice how <strong>doubled</strong> correctly calculates based on the scoped counter!
      </p>
    </section>
  );
}
