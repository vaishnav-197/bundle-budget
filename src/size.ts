// KB and MB are decimal (1 KB = 1000 bytes), matching what Vite and most CDNs report.
// KiB and MiB are binary (1 KiB = 1024 bytes).
const UNITS: Readonly<Record<string, number>> = {
  b: 1,
  kb: 1000,
  mb: 1000 * 1000,
  kib: 1024,
  mib: 1024 * 1024,
};

/**
 * Parses a size such as "150 KB", "1.2 MB", "100KiB", "512 B" or a plain number of bytes.
 * Returns the size in bytes, or null if the value is not a valid size.
 */
export function parseSize(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : null;
  }
  if (typeof value !== 'string') return null;

  const match = /^\s*(\d+(?:\.\d+)?)\s*([a-z]*)\s*$/i.exec(value);
  if (!match) return null;
  const amount = Number(match[1]);
  const unit = UNITS[(match[2] || 'b').toLowerCase()];
  return unit === undefined ? null : Math.round(amount * unit);
}

export function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(2)} KB`;
  return `${(bytes / (1000 * 1000)).toFixed(2)} MB`;
}
