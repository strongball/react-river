import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { DevToolsEvent } from '../devtools-observer';
import { CopyButton } from './CopyButton';
import { formatTime, serializeValue } from '../utils';

/** Component for a single event in the event list */
export function EventItem({ event, repeatCount = 1 }: { event: DevToolsEvent; repeatCount?: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasData = event.type === 'update' || event.type === 'create' || event.type === 'error';
  const toggleExpanded = () => hasData && setExpanded((value) => !value);
  const handleSummaryKeyDown = (keyboardEvent: KeyboardEvent<HTMLDivElement>) => {
    if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
      keyboardEvent.preventDefault();
      toggleExpanded();
    }
  };

  return (
    <div className="rd-event-item">
      <div
        className="rd-event-summary"
        role={hasData ? 'button' : undefined}
        tabIndex={hasData ? 0 : undefined}
        aria-expanded={hasData ? expanded : undefined}
        onClick={toggleExpanded}
        onKeyDown={handleSummaryKeyDown}
      >
        <span className={`rd-event-type rd-event-${event.type}`}>{event.type}</span>
        <div className="rd-event-body">
          <div className="rd-event-name">{event.providerName}</div>
          <div className="rd-event-kind">{event.providerKind}</div>
        </div>
        {repeatCount > 1 && (
          <span className="rd-event-repeat" title={`${repeatCount} rapid updates grouped`}>
            ×{repeatCount} updates
          </span>
        )}
        <CopyButton value={event.providerName} label="Copy provider name" />
        <span className="rd-event-time">{formatTime(event.timestamp)}</span>
      </div>

      {expanded && hasData && (
        <div className="rd-provider-details">
          {event.type === 'error' && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Error</span>
              <div className="rd-detail-value">
                <pre>{serializeValue(event.error)}</pre>
                <CopyButton value={serializeValue(event.error)} label="Copy error" />
              </div>
            </div>
          )}
          {event.type === 'update' && (
            <>
              <div className="rd-detail-row">
                <span className="rd-detail-label">New Value</span>
                <div className="rd-detail-value">
                  <pre>{serializeValue(event.value)}</pre>
                  <CopyButton value={serializeValue(event.value)} label="Copy new value" />
                </div>
              </div>
              <details className="rd-previous-details">
                <summary>Previous value</summary>
                <div className="rd-detail-value">
                  <pre>{serializeValue(event.previousValue)}</pre>
                  <CopyButton value={serializeValue(event.previousValue)} label="Copy previous value" />
                </div>
              </details>
            </>
          )}
          {event.type === 'create' && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Initial</span>
              <div className="rd-detail-value">
                <pre>{serializeValue(event.value)}</pre>
                <CopyButton value={serializeValue(event.value)} label="Copy initial value" />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
