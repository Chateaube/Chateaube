import React, { useState } from 'react';
import ScreenTabs from './ScreenTabs.jsx';
import TimetableView from './TimetableView.jsx';
import TimetableChanges from './TimetableChanges.jsx';
import { takeIntent } from '../navIntent.js';

// Emplois du temps et changements, sur un seul écran : on voit la grille (cours annulés barrés) et on
// annonce un changement sans changer d'écran.
export default function TimetableHub({ role, settings }) {
  const [tab, setTab] = useState(() => takeIntent('timetable')?.tab ?? 'view');
  return (
    <ScreenTabs label="Emplois du temps" value={tab} onChange={setTab} tabs={[
      ['view', 'Emplois du temps', <TimetableView key="view" settings={settings} />],
      ['changes', 'Changements de cours', <TimetableChanges key="changes" role={role} settings={settings} />],
    ]} />
  );
}
