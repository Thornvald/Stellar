// Project list rendering with selection and removal.
import type { ProjectConfig } from '@shared/types';

type ProjectListProps = {
  projects: ProjectConfig[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
};

export default function ProjectList({
  projects,
  selectedIndex,
  onSelect,
  onRemove
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon" aria-hidden="true">
          <span>*</span>
        </div>
        <p>No projects added yet.</p>
        <p className="muted">Use Add Project to get started.</p>
      </div>
    );
  }

  return (
    <div className="project-list" role="list">
      {projects.map((project, index) => (
        <div
          key={`${project.path}-${index}`}
          className={`project-card${index === selectedIndex ? ' selected' : ''}`}
          role="listitem"
          tabIndex={0}
          onClick={() => onSelect(index)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(index);
            }
          }}
        >
          <div className="project-card-header">
            <div>
              <p className="project-name">{project.name}</p>
              <p className="project-path">{project.path}</p>
            </div>
            <button
              className="ghost-button"
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(index);
              }}
              aria-label={`Remove ${project.name}`}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
