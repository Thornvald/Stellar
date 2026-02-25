import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export default function ProjectList({ projects, selectedIndex, onSelect, onRemove }) {
    if (projects.length === 0) {
        return (_jsxs("div", { className: "empty-state", children: [_jsx("div", { className: "empty-icon", "aria-hidden": "true", children: _jsx("span", { children: "*" }) }), _jsx("p", { children: "No projects added yet." }), _jsx("p", { className: "muted", children: "Use Add Project to get started." })] }));
    }
    return (_jsx("div", { className: "project-list", role: "list", children: projects.map((project, index) => (_jsx("div", { className: `project-card${index === selectedIndex ? ' selected' : ''}`, role: "listitem", tabIndex: 0, onClick: () => onSelect(index), onKeyDown: (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(index);
                }
            }, children: _jsxs("div", { className: "project-card-header", children: [_jsxs("div", { children: [_jsx("p", { className: "project-name", children: project.name }), _jsx("p", { className: "project-path", children: project.path })] }), _jsx("button", { className: "ghost-button", type: "button", onClick: (event) => {
                            event.stopPropagation();
                            onRemove(index);
                        }, "aria-label": `Remove ${project.name}`, children: "Remove" })] }) }, `${project.path}-${index}`))) }));
}
