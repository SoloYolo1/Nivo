import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installInsets } from './lib/insets';
import './styles/app.css';
import './styles/accounts.css';
import './styles/polish.css';
import './styles/cashflow.css';
import './styles/tiles.css';
import './styles/design.css';

try { history.scrollRestoration = 'manual'; } catch { /* older browsers */ }
installInsets();

const el = document.getElementById('root');
if (el) createRoot(el).render(<App />);
