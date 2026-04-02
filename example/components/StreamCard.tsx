import { useWatch, when } from 'react-river';

import { clockProvider } from '../providers';

export function StreamCard() {
  const clockAsync = useWatch(clockProvider);

  return (
    <section className="card">
      <div className="card-badge">streamProvider</div>
      <h2>Live Clock</h2>
      <p className="muted">This provider yields a new value every 2 seconds via an async generator.</p>

      {when(clockAsync, {
        loading: () => <div className="skeleton">Starting stream…</div>,
        error: (e) => <div className="error-box">Stream Error: {String(e)}</div>,
        data: (value) => (
          <div className="stream-display">
            <span className="pulse-dot"></span>
            <code>{value}</code>
          </div>
        ),
      })}
    </section>
  );
}
