import type { DevToolsEvent } from '../devtools-observer';
import { formatTime } from '../utils';

/** Component for a single event in the event list */
export function EventItem({ event }: { event: DevToolsEvent }) {
  return (
    <div className="rd-event-item">
      <span className={`rd-event-type rd-event-${event.type}`}>{event.type}</span>
      <div className="rd-event-body">
        <div className="rd-event-name">{event.providerName}</div>
        <div className="rd-event-kind">{event.providerKind}</div>
      </div>
      <span className="rd-event-time">{formatTime(event.timestamp)}</span>
    </div>
  );
}
