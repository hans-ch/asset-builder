/** Parser simples de argumentos: `posicional --chave valor --flag`. */
export function parseArgs(argv: string[]): {
  positional: string[];
  flags: Record<string, string | boolean>;
} {
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      positional.push(arg);
      continue;
    }

    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = next;
    i++;
  }

  return { positional, flags };
}

export function flagString(
  flags: Record<string, string | boolean>,
  key: string,
  fallback: string
): string {
  const value = flags[key];
  return typeof value === 'string' ? value : fallback;
}

export function flagNumber(
  flags: Record<string, string | boolean>,
  key: string
): number | undefined {
  const value = flags[key];
  if (typeof value !== 'string') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function flagBoolean(
  flags: Record<string, string | boolean>,
  key: string
): boolean {
  return flags[key] === true || flags[key] === 'true';
}
