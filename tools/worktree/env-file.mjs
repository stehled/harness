const ASSIGNMENT = /^([A-Z][A-Z0-9_]*)=(.*)$/;

export function parseEnvFile(contents) {
  const values = {};

  for (const line of contents.split('\n')) {
    const match = ASSIGNMENT.exec(line.trim());

    if (match) {
      values[match[1]] = match[2];
    }
  }

  return values;
}

export function renderEnvFile(example, values) {
  const pending = new Map(Object.entries(values));

  const lines = example.split('\n').map((line) => {
    const match = ASSIGNMENT.exec(line);

    if (!match || !pending.has(match[1])) {
      return line;
    }

    const key = match[1];
    const value = pending.get(key);
    pending.delete(key);

    return `${key}=${value}`;
  });

  if (pending.size > 0) {
    lines.push('', '# --- added by `pnpm env:init`; also add them to .env.example ---');
    for (const [key, value] of pending) {
      lines.push(`${key}=${value}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export function addMissingVariables(existing, example) {
  const present = parseEnvFile(existing);
  const missing = Object.entries(parseEnvFile(example)).filter(([key]) => !(key in present));

  if (missing.length === 0) {
    return { contents: existing, added: [] };
  }

  const lines = [
    existing.endsWith('\n') ? existing.slice(0, -1) : existing,
    '',
    '# --- added from .env.example by `pnpm env:init` ---',
    ...missing.map(([key, value]) => `${key}=${value}`),
    '',
  ];

  return { contents: lines.join('\n'), added: missing.map(([key]) => key) };
}
