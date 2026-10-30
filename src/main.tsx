import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installInsets } from './lib/insets';
import './styles/app.css';
import './styles/accounts.css';
import './styles/polish.css';

try { history.scrollRestoration = 'manual'; } catch { /* older browsers */ }
installInsets();

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
