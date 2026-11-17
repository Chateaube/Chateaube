import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Le build produit un unique fichier dist/index.html (JS + CSS inclus),
// consultable hors ligne et sans serveur.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
  // Anciens téléphones (Android 7 et plus, navigateur de WhatsApp, iPhone iOS 12 et plus) : le code récent
  // (?. ??, etc.) est réécrit pour eux, sinon l'application ne s'ouvre pas (« Unexpected token ? »).
  build: { target: ['es2017', 'chrome61', 'safari12', 'firefox60', 'edge79'] },
});
