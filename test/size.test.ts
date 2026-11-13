import { describe, expect, it } from 'vitest';
import { formatSize, parseSize } from '../src/size.js';

describe('parseSize', () => {
  it('uses 1000 for KB and MB', () => {
    expect(parseSize('150 KB')).toBe(150_000);
    expect(parseSize('1.2 MB')).toBe(1_200_000);
  });

  it('uses 1024 for KiB and MiB', () => {
    expect(parseSize('100 KiB')).toBe(102_400);
    expect(parseSize('1 MiB')).toBe(1_048_576);
  });

  it('accepts bytes with or without a unit', () => {
    expect(parseSize('512 B')).toBe(512);
    expect(parseSize('512')).toBe(512);
    expect(parseSize(512)).toBe(512);
  });

  it('ignores case and spacing', () => {
    expect(parseSize('150kb')).toBe(150_000);
    expect(parseSize('  2 mb ')).toBe(2_000_000);
    expect(parseSize('10kib')).toBe(10_240);
  });

  it('rounds fractional bytes', () => {
    expect(parseSize('1.5 KiB')).toBe(1536);
    expect(parseSize('0.0005 KB')).toBe(1);
  });

  it('rejects invalid sizes', () => {
    for (const value of ['', 'KB', '15 kilobytes', '-1 KB', '1,5 KB', '1 GB', '1e3', 1.5, -1, null, true, {}]) {
      expect(parseSize(value), JSON.stringify(value)).toBeNull();
    }
  });
});

describe('formatSize', () => {
  it('formats bytes, kilobytes and megabytes', () => {
    expect(formatSize(0)).toBe('0 B');
    expect(formatSize(999)).toBe('999 B');
    expect(formatSize(1000)).toBe('1.00 KB');
    expect(formatSize(75_052)).toBe('75.05 KB');
    expect(formatSize(1_250_000)).toBe('1.25 MB');
  });
});
