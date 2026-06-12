import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import 'antd/dist/reset.css';
import './styles/global.scss';

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
