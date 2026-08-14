import type { KeyboardEvent } from 'react';

import { kindLabel, serializeValue } from '../utils';
import { CopyButton } from './CopyButton';
import { IconEye } from './Icons';

import type { DevToolsProviderSnapshot } from '../../core/container';

interface ProviderItemProps {
  snapshot: DevToolsProviderSnapshot;
  expanded: boolean;
  onToggle: () => void;
}

/** Component for a single provider in the provider list */
export function ProviderItem({ snapshot, expanded, onToggle }: ProviderItemProps) {
  const valueText = serializeValue(snapshot.value);
  const previousValueText = snapshot.previousValue === undefined ? undefined : serializeValue(snapshot.previousValue);
  const argumentsMatch = snapshot.name.match(/^.+?\((.*)\)$/);

  const handleSummaryKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <div className="rd-provider-item" data-expanded={expanded}>
      <div
        className="rd-provider-row"
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        onClick={onToggle}
        onKeyDown={handleSummaryKeyDown}
      >
        <div className="rd-provider-identity">
          <span className="rd-provider-chevron" aria-hidden="true">
            ›
          </span>
          <div className="rd-provider-heading">
            <span className="rd-provider-name" title={snapshot.name}>
              {snapshot.name}
            </span>
            <div className="rd-provider-meta">
              <span className={`rd-provider-kind rd-kind-${snapshot.kind}`}>{kindLabel(snapshot.kind)}</span>
              <span title="Listeners">
                <IconEye />
                {snapshot.listenerCount}
              </span>
              <span title="Version">v{snapshot.version}</span>
              {snapshot.autoDispose && <span className="rd-badge-auto-dispose">AD</span>}
              {snapshot.autoDispose && <span className="rd-provider-cache">cache {snapshot.cacheTime ?? 0}ms</span>}
            </div>
          </div>
        </div>
        <CopyButton value={snapshot.name} label="Copy provider name" />
      </div>

      {expanded && (
        <div className="rd-provider-details">
          <div className="rd-detail-row rd-detail-row-data">
            <span className="rd-detail-label">Value</span>
            <div className="rd-detail-value">
              <pre>{valueText}</pre>
              <CopyButton value={valueText} label="Copy value" />
            </div>
          </div>

          {previousValueText !== undefined && (
            <details className="rd-previous-details">
              <summary>Previous value</summary>
              <div className="rd-detail-value">
                <pre>{previousValueText}</pre>
                <CopyButton value={previousValueText} label="Copy previous value" />
              </div>
            </details>
          )}

          {argumentsMatch && (
            <div className="rd-detail-row rd-detail-row-data">
              <span className="rd-detail-label">Arguments</span>
              <div className="rd-detail-value">
                <pre>{argumentsMatch[1]}</pre>
                <CopyButton value={argumentsMatch[1]} label="Copy arguments" />
              </div>
            </div>
          )}

          {snapshot.dependencies.length > 0 && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Depends on</span>
              <div className="rd-deps-list">
                {snapshot.dependencies.map((dep) => (
                  <span key={dep} className="rd-dep-tag">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}

          {snapshot.dependents.length > 0 && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Used by</span>
              <div className="rd-deps-list">
                {snapshot.dependents.map((dep) => (
                  <span key={dep} className="rd-dep-tag">
                    {dep}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
