import React from 'react';
import { createRoot } from 'react-dom/client';
import { watchTables } from './tableCards.js';
import App from './App.jsx';
import { DialogHost } from './components/Dialogs.jsx';
import { ONLINE } from './online/client.js';
import OnlineGate from './components/OnlineGate.jsx';
import './index.css';

// Erreur d'affichage : écran de secours plutôt qu'une page blanche
class Guard extends React.Component {
  componentDidCatch(error) { window.__entFail?.(error?.message ?? error); }
  render() { return this.props.children; }
}

createRoot(document.getElementById('root')).// version en ligne : rien ne s'affiche avant la connexion
render(<Guard>{ONLINE ? <OnlineGate><App /></OnlineGate> : <App />}<DialogHost /></Guard>);
watchTables();
