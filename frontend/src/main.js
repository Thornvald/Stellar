import { jsx as _jsx } from "react/jsx-runtime";
// React entry point for the Stellar UI.
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/base.css';
import './styles/app.css';
const root = document.getElementById('root');
if (!root) {
    throw new Error('Root element not found');
}
ReactDOM.createRoot(root).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
