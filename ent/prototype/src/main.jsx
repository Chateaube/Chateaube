import React from 'react';
import { createRoot } from 'react-dom/client';
import { watchTables } from './tableCards.js';
import App from './App.jsx';
import './index.css';

// Erreur d'affichage : écran de secours plutôt qu'une page blanche
class Guard extends React.Component {
  componentDidCatch(error) { window.__entFail?.(error?.message ?? error); }
  render() { return this.props.children; }
}

createRoot(document.getElementById('root')).render(<Guard><App /></Guard>);
watchTables();
