import { createRoot } from 'react-dom/client';
import { AppRouter } from './src/router/AppRouter';
import './src/index.css';

declare global {
  interface Window {
    __cumlaudeRoot?: ReturnType<typeof createRoot>;
  }
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root container not found');
}

const root = window.__cumlaudeRoot ?? createRoot(rootElement);
window.__cumlaudeRoot = root;

root.render(<AppRouter />);
