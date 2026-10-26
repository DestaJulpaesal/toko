import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';
import './styles/admin.css';
import './styles/tokens.css';
import './styles/ui.css';
import './styles/public-responsive.css';
import './styles/admin-responsive.css';
import './styles/globot.css';
import './styles/product-cards.css';
import { purgeLegacyCatalogCache } from './utils/catalogStorage';

purgeLegacyCatalogCache();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
