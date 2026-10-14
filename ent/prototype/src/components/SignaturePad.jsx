import React, { useEffect, useRef, useState } from 'react';

// Zone de signature au doigt (téléphone) ou à la souris (ordinateur). Renvoie une image PNG.
export default function SignaturePad({ onChange, height = 140, label = 'Signez dans le cadre' }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);

  useEffect(() => {
    const c = ref.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = height * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f2a4a';
  }, [height]);

  const point = (e) => {
    const r = ref.current.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const down = (e) => {
    e.preventDefault();
    ref.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    const ctx = ref.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = ref.current.getContext('2d');
    ctx.lineTo(...point(e));
    ctx.stroke();
    if (empty) setEmpty(false);
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    if (!empty) onChange(ref.current.toDataURL('image/png'));
  };
  const clear = () => {
    const c = ref.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange(null);
  };

  return (
    <div>
      <div className="relative rounded-xl border-2 border-dashed border-slate-300 bg-white">
        <canvas ref={ref} style={{ height, touchAction: 'none' }} className="block w-full cursor-crosshair rounded-xl"
          onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} aria-label={label} role="img" />
        {empty && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-slate-400">{label}</span>}
      </div>
      <button type="button" onClick={clear} className="mt-1 text-xs font-medium text-navy-500">Effacer et recommencer</button>
    </div>
  );
}
