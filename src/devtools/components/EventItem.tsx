import { useState } from 'react';
import type { DevToolsEvent } from '../devtools-observer';
import { formatTime, serializeValue } from '../utils';

/** Component for a single event in the event list */
export function EventItem({ event }: { event: DevToolsEvent }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = event.type === 'update' || event.type === 'create' || event.type === 'error';

  return (
    <div
      className="rd-event-item"
      onClick={() => hasData && setExpanded(!expanded)}
      style={{ cursor: hasData ? 'pointer' : 'default', display: 'block' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <span className={`rd-event-type rd-event-${event.type}`}>{event.type}</span>
        <div className="rd-event-body">
          <div className="rd-event-name">{event.providerName}</div>
          <div className="rd-event-kind">{event.providerKind}</div>
        </div>
        <span className="rd-event-time">{formatTime(event.timestamp)}</span>
      </div>

      {expanded && hasData && (
        <div className="rd-provider-details" style={{ marginTop: 8 }}>
          {event.type === 'error' && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Error</span>
              <span className="rd-detail-value">
                <pre>{serializeValue(event.error)}</pre>
              </span>
            </div>
          )}
          {event.type === 'update' && (
            <>
              <div className="rd-detail-row">
                <span className="rd-detail-label">New Value</span>
                <span className="rd-detail-value">
                  <pre>{serializeValue(event.value)}</pre>
                </span>
              </div>
              <div className="rd-detail-row">
                <span className="rd-detail-label">Previous</span>
                <span className="rd-detail-value">
                  <pre>{serializeValue(event.previousValue)}</pre>
                </span>
              </div>
            </>
          )}
          {event.type === 'create' && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Initial</span>
              <span className="rd-detail-value">
                <pre>{serializeValue(event.value)}</pre>
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
