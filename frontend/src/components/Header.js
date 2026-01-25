import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// App header with title and subtitle.
import { APP_NAME } from '@shared/constants';
export default function Header({ subtitle }) {
    return (_jsxs("header", { className: "app-header", children: [_jsxs("div", { children: [_jsx("p", { className: "eyebrow", children: "Unreal build desk" }), _jsxs("div", { className: "title-wrap", children: [_jsx("span", { className: "title-star star-1", "aria-hidden": "true" }), _jsx("span", { className: "title-star star-2", "aria-hidden": "true" }), _jsx("span", { className: "title-star star-3", "aria-hidden": "true" }), _jsx("span", { className: "title-star star-4", "aria-hidden": "true" }), _jsx("h1", { children: APP_NAME })] })] }), _jsx("p", { className: "subtitle", children: subtitle ?? 'Build, track, and ship Unreal projects without leaving your desktop.' })] }));
}
