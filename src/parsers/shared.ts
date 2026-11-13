export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * Works out the npm package a module path belongs to, e.g.
 * "./node_modules/react-dom/client.js" -> "react-dom" and
 * "/node_modules/.pnpm/@scope+pkg@1.0.0/node_modules/@scope/pkg/index.js" -> "@scope/pkg".
 * Returns null for application code.
 */
export function packageName(moduleId: string): string | null {
  // Webpack prefixes module names with the loaders that produced them: "css ./a!./b.css".
  const path = moduleId.slice(moduleId.lastIndexOf('!') + 1).replaceAll('\\', '/');
  const marker = 'node_modules/';
  const index = path.lastIndexOf(marker);
  if (index === -1) return null;

  const [first, second] = path.slice(index + marker.length).split('/');
  if (!first) return null;
  if (first.startsWith('@')) return second ? `${first}/${second}` : null;
  return first;
}
