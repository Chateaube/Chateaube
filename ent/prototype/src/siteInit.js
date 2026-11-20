// Doit être importé tout de suite après les polyfills : le site choisi (Tamatave / Tana) décide où l'application
// lit et écrit ses données sur l'appareil, avant que le moindre module ne les lise.
import { installSite } from './site.js';

installSite();
