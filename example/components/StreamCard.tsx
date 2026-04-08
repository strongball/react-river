import { useRiverWatch, when } from '@zerologix/react-river';

import { clockProvider } from '../providers';

export function StreamCard() {
  const clockAsync = useRiverWatch(clockProvider);

  return (
    <section className="card">
      <div className="card-badge">observableProvider</div>
      <h2>Live Clock</h2>
      <p className="muted">This provider yields a new value every second via an Observable subscription.</p>

      {when(clockAsync, {
        loading: () => <div className="skeleton">Starting observable…</div>,
        error: (e) => <div className="error-box">Observable Error: {String(e)}</div>,
        data: (value: string) => (
          <div className="stream-display">
            <span className="pulse-dot"></span>
            <code>{value}</code>
          </div>
        ),
      })}
    </section>
  );
}
