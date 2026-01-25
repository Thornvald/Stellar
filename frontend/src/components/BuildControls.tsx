// Build status and action controls.
import type { BuildStatus } from '@shared/types';

type BuildControlsProps = {
  canBuild: boolean;
  isBuilding: boolean;
  status: BuildStatus;
  onBuild: () => void;
  onCancel: () => void;
  onClearLogs: () => void;
};

function formatStatus(status: BuildStatus): string {
  switch (status.status) {
    case 'running':
      return 'Build in progress';
    case 'success':
      return 'Build completed';
    case 'cancelled':
      return 'Build cancelled';
    case 'error':
      return status.error ? `Build error: ${status.error}` : 'Build failed';
    default:
      return 'Idle';
  }
}

export default function BuildControls({
  canBuild,
  isBuilding,
  status,
  onBuild,
  onCancel,
  onClearLogs
}: BuildControlsProps) {
  return (
    <div className="build-controls">
      <div className="status-block">
        <p className="section-label">Status</p>
        <p className={`status-text status-${status.status}`}>{formatStatus(status)}</p>
      </div>
      <div className="button-row">
        <button
          className="primary-button"
          type="button"
          onClick={onBuild}
          disabled={!canBuild}
        >
          {isBuilding ? 'Building...' : 'Build Project'}
        </button>
        <button
          className="ghost-button"
          type="button"
          onClick={onCancel}
          disabled={!isBuilding}
        >
          Cancel
        </button>
        <button className="ghost-button" type="button" onClick={onClearLogs}>
          Clear Logs
        </button>
      </div>
    </div>
  );
}
