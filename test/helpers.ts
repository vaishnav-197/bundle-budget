import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

export function fixturePath(...parts: string[]): string {
  return fileURLToPath(new URL(`../fixtures/${parts.join('/')}`, import.meta.url));
}

export function readFixture(...parts: string[]): unknown {
  return JSON.parse(readFileSync(fixturePath(...parts), 'utf8'));
}
