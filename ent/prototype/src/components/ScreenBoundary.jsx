import React from 'react';

// Un écran qui rencontre un problème n'emporte plus toute l'application : on l'indique à sa place,
// sans rien effacer, et les autres écrans restent utilisables.
export default class ScreenBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error) { try { console.error('Écran en panne :', error); } catch { /* rien */ } }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div role="alert" className="rounded-2xl bg-white p-5 shadow-soft">
        <p className="font-display text-lg font-semibold text-navy-900">Cet écran rencontre un problème</p>
        <p className="mt-1 text-sm text-slate-700">Vos données ne sont pas touchées. Revenez à l'accueil ou choisissez un autre écran ; signalez-le en précisant l'écran ouvert.</p>
        <p className="mt-2 text-xs text-slate-500">Détail : {String(this.state.error?.message ?? this.state.error)}</p>
        {this.props.onHome && <button type="button" onClick={this.props.onHome} className="mt-3 min-h-[44px] rounded-xl bg-navy-500 px-4 text-sm font-semibold text-white">Revenir à l'accueil</button>}
      </div>
    );
  }
}
