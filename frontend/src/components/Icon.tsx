const P: Record<string, string> = {
  overview: 'M3 3h7v9H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 16h7v5H3z',
  br: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  us: 'M4 19V5M4 19h16M8 15l3-4 3 2 5-6',
  crypto: 'M9 7h5a3 3 0 010 6H9zM9 13h6a3 3 0 010 6H9zM9 5v16M12 5v2M12 19v2',
  etf: 'M4 6h16M4 12h16M4 18h10',
  ranking: 'M6 20V10M12 20V4M18 20v-7',
  analysis: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
  wallet: 'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l2-3h11l2 3M16 13h2',
  news: 'M5 4h12v16H5a2 2 0 01-2-2V7M17 8h4v10a2 2 0 01-2 2M7 8h6M7 12h6M7 16h4',
  settings: 'M12 9a3 3 0 100 6 3 3 0 000-6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 01-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 010-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 014 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 010 4h-.1a1.7 1.7 0 00-1.5 1z',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  menu: 'M4 6h16M4 12h16M4 18h16',
  plus: 'M12 5v14M5 12h14',
  x: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  up: 'M12 19V5M5 12l7-7 7 7',
  down: 'M12 5v14M19 12l-7 7-7-7',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  refresh: 'M20 11a8 8 0 10-2.3 5.7M20 4v7h-7',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5',
  back: 'M15 18l-6-6 6-6',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v6M12 7.5v.01',
};

/** Marca MarketBrasil: cabeça de touro geométrica (mercado em alta). */
export function BullLogo({ size = 18, color = '#1fbf75' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M2.5 4.5c0 3.6 2.4 5.4 5.6 5.4M21.5 4.5c0 3.6-2.4 5.4-5.6 5.4" stroke={color} strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8.1 9.9h7.8l-.8 5.4H8.9z" fill={color} fillOpacity=".16" stroke={color} strokeWidth="1.9" strokeLinejoin="round" />
      <path d="M8.2 11 5 12.2l3.5.8M15.8 11l3.2 1.2-3.5.8" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <ellipse cx="12" cy="17.4" rx="4" ry="2.7" fill={color} />
      <circle cx="10.5" cy="17.6" r=".85" fill="#0b0e13" />
      <circle cx="13.5" cy="17.6" r=".85" fill="#0b0e13" />
    </svg>
  );
}

export function Icon({ name, size = 16, fill = false }: { name: string; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={P[name] ?? ''} />
    </svg>
  );
}
