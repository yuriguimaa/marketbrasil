/**
 * Brilho que acompanha o cursor: um halo suave na página inteira (--mx/--my no <html>)
 * e um realce local na superfície sob o mouse (--lx/--ly no elemento).
 * Usa requestAnimationFrame para não disparar layout a cada evento.
 */
const SURFACES = '.panel, .mcard, .stat-strip, .notice, .modal, .search-results, .sidebar';

export function startSpotlight() {
  if (window.matchMedia('(pointer: coarse)').matches) return () => {};
  const root = document.documentElement;
  let x = 0, y = 0, frame = 0;
  let current: HTMLElement | null = null;

  const paint = () => {
    frame = 0;
    root.style.setProperty('--mx', x + 'px');
    root.style.setProperty('--my', y + 'px');
    const el = (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>(SURFACES) ?? null;
    if (el !== current) {
      current?.classList.remove('lit');
      el?.classList.add('lit');
      current = el;
    }
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--lx', x - r.left + 'px');
      el.style.setProperty('--ly', y - r.top + 'px');
    }
  };
  const move = (e: PointerEvent) => {
    x = e.clientX; y = e.clientY;
    root.classList.add('pointer-in');
    if (!frame) frame = requestAnimationFrame(paint);
  };
  const leave = () => { root.classList.remove('pointer-in'); current?.classList.remove('lit'); current = null; };

  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('pointerleave', leave);
  return () => {
    window.removeEventListener('pointermove', move);
    document.removeEventListener('pointerleave', leave);
  };
}
