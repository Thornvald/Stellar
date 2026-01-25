// Engine path display and selection control.
import type { EngineInstall } from '@shared/types';

type EnginePathCardProps = {
  enginePath: string | null;
  onSelect: () => void;
  detectedEngines: EngineInstall[];
  onPickDetected: (install: EngineInstall) => void;
  detectError: string | null;
  onRetryDetect: () => void;
};

export default function EnginePathCard({
  enginePath,
  onSelect,
  detectedEngines,
  onPickDetected,
  detectError,
  onRetryDetect
}: EnginePathCardProps) {
  const showDetected = !enginePath && detectedEngines.length > 0;

  return (
    <div className="engine-card">
      <div>
        <p className="section-label">Unreal Engine Path</p>
        <p className={`engine-path${enginePath ? '' : ' muted'}`}>
          {enginePath ?? 'No engine path set'}
        </p>
        {detectError && !enginePath && (
          <div className="engine-detect-error">
            <p>{detectError}</p>
            <p className="engine-detect-hint">Use "Set Engine Path" to choose manually.</p>
            <button className="ghost-button engine-detect-retry" type="button" onClick={onRetryDetect}>
              Retry Detect
            </button>
          </div>
        )}
        {showDetected && (
          <div className="engine-detected">
            <p className="muted">Detected installs — pick one:</p>
            <div className="engine-options">
              {detectedEngines.map((install) => (
                <button
                  key={install.id}
                  className="engine-option"
                  type="button"
                  onClick={() => onPickDetected(install)}
                >
                  <span className="engine-option-name">{install.name}</span>
                  <span className="engine-option-path">{install.path}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <button className="primary-button" type="button" onClick={onSelect}>
        Set Engine Path
      </button>
    </div>
  );
}
