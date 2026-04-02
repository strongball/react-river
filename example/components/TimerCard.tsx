import { useState } from 'react';
import { useWatch } from 'react-river';

import { timerProvider } from '../providers';

export function TimerCard() {
  const [show, setShow] = useState(false);

  return (
    <section className="card">
      <div className="card-badge">autoDispose: true</div>
      <h2>Auto-Dispose</h2>
      <p className="muted">When the timer is hidden, the provider is automatically disposed (check logs).</p>

      {show ? (
        <div className="timer-box">
          <TimerDisplay />
          <button onClick={() => setShow(false)} className="secondary full-width">
            Stop & Unmount Timer
          </button>
        </div>
      ) : (
        <button onClick={() => setShow(true)} className="full-width">
          Start Timer (Mount)
        </button>
      )}
    </section>
  );
}

function TimerDisplay() {
  const count = useWatch(timerProvider);
  return (
    <div className="timer-display">
      <span className="icon">⏱️</span>
      <strong>{count}</strong> seconds
    </div>
  );
}
