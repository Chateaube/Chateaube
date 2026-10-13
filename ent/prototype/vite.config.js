import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Le build produit un unique fichier dist/index.html (JS + CSS inclus),
// consultable hors ligne et sans serveur.
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile()],
});
