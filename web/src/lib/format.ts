export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}%`;

export const usd = (x: number) => {
  if (x < 0.01) return `$${x.toFixed(4)}`;
  if (x < 1) return `$${x.toFixed(3)}`;
  return `$${x.toFixed(2)}`;
};

export const tokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return `${n}`;
};

export const dur = (sec: number) => {
  if (sec < 60) return `${Math.round(sec)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return s ? `${m}m ${s}s` : `${m}m`;
};

export const ctx = (n: number) => {
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return `${n}`;
};

export const num = (n: number) => n.toLocaleString("en-US");
