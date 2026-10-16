// Photos et documents déposés depuis le téléphone ou l'ordinateur : les images sont réduites
// (une photo de téléphone pèse plusieurs Mo) ; un PDF est gardé tel quel s'il reste léger.
const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = reject;
  r.readAsDataURL(file);
});

export async function imageToDataUrl(file, maxSide = 1400, quality = 0.75) {
  const src = await readAsDataUrl(file);
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', quality);
}

/** Pièce du dossier : image réduite, ou PDF de moins de 1,5 Mo. */
export async function documentToDataUrl(file) {
  if (file.type.startsWith('image/')) return { kind: 'image', dataUrl: await imageToDataUrl(file), name: file.name };
  if (file.type === 'application/pdf') {
    if (file.size > 1.5 * 1024 * 1024) throw new Error('PDF trop lourd (1,5 Mo au plus) : envoyez plutôt une photo de chaque page.');
    return { kind: 'pdf', dataUrl: await readAsDataUrl(file), name: file.name };
  }
  throw new Error('Format non pris en charge : photo (JPG, PNG) ou PDF.');
}

/** Photo d'identité : recadrée au format 3 × 4, petite. */
export async function idPhotoToDataUrl(file) {
  const src = await readAsDataUrl(file);
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  const W = 300; const H = 400;
  const ratio = W / H;
  let sw = img.width; let sh = img.height; let sx = 0; let sy = 0;
  if (sw / sh > ratio) { sw = sh * ratio; sx = (img.width - sw) / 2; } else { sh = sw / ratio; sy = (img.height - sh) / 4; }
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  return c.toDataURL('image/jpeg', 0.8);
}
