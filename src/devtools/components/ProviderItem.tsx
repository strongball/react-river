import type { DevToolsProviderSnapshot } from '../../core/container';
import { kindLabel, serializeValue } from '../utils';
import { IconEye } from './Icons';

interface ProviderItemProps {
  snapshot: DevToolsProviderSnapshot;
  expanded: boolean;
  onToggle: () => void;
}

/** Component for a single provider in the provider list */
export function ProviderItem({
  snapshot,
  expanded,
  onToggle,
}: ProviderItemProps) {
  return (
    <div className="rd-provider-item" onClick={onToggle}>
      <div className="rd-provider-row">
        <span className={`rd-provider-kind rd-kind-${snapshot.kind}`}>
          {kindLabel(snapshot.kind)}
        </span>
        <span className="rd-provider-name" title={snapshot.name}>
          {snapshot.name}
        </span>
        <div className="rd-provider-meta">
          <span title="Listeners">
            <IconEye />
            {snapshot.listenerCount}
          </span>
          <span title="Version">v{snapshot.version}</span>
          {snapshot.autoDispose && <span className="rd-badge-auto-dispose">AD</span>}
        </div>
      </div>

      {expanded && (
        <div className="rd-provider-details">
          <div className="rd-detail-row">
            <span className="rd-detail-label">Value</span>
            <span className="rd-detail-value">
              <pre>{serializeValue(snapshot.value)}</pre>
            </span>
          </div>

          {snapshot.previousValue !== undefined && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Previous</span>
              <span className="rd-detail-value">
                <pre>{serializeValue(snapshot.previousValue)}</pre>
              </span>
            </div>
          )}

          <div className="rd-detail-row">
            <span className="rd-detail-label">Kind</span>
            <span className="rd-detail-value">{snapshot.kind}</span>
          </div>

          <div className="rd-detail-row">
            <span className="rd-detail-label">Listeners</span>
            <span className="rd-detail-value">{snapshot.listenerCount}</span>
          </div>

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

          {snapshot.autoDispose && (
            <div className="rd-detail-row">
              <span className="rd-detail-label">Cache Time</span>
              <span className="rd-detail-value">{snapshot.cacheTime ?? 0}ms</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
