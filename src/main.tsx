import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/app.css';
import './styles/accounts.css';
import './styles/polish.css';

try { history.scrollRestoration = 'manual'; } catch { /* older browsers */ }

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
