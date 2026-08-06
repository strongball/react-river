import { useRiverWatch, when } from '@zerologix/react-river';

import { asyncGeneratorProvider, syncGeneratorProvider } from '../providers';

export function GeneratorCard() {
  const syncValue = useRiverWatch(syncGeneratorProvider);
  const asyncValue = useRiverWatch(asyncGeneratorProvider);

  return (
    <section className="card">
      <div className="card-badge">streamProvider</div>
      <h2>Generator Stream</h2>
      <p className="muted">Both synchronous and asynchronous generators can feed the same AsyncValue state.</p>

      <div className="stream-display">
        <span className="pulse-dot"></span>
        <div>
          <strong>function*</strong>
          <div>
            {when(syncValue, {
              loading: () => 'Starting sync generator…',
              error: (error) => `Error: ${String(error)}`,
              data: (value: string) => value,
            })}
          </div>
        </div>
      </div>

      <div className="stream-display">
        <span className="pulse-dot"></span>
        <div>
          <strong>async function*</strong>
          <div>
            {when(asyncValue, {
              loading: () => 'Waiting for first yield…',
              error: (error) => `Error: ${String(error)}`,
              data: (value: string) => value,
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
