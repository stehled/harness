export const CONFIDENCES = Object.freeze(['certain', 'likely', 'possible']);

const WRITE_LINE = /^\s*(certain|likely|possible)\s+([a-z]+)\s+(.+)$/;

export function parseCard(text) {
  const writes = [];
  let inWrites = false;

  for (const line of text.split('\n')) {
    if (/^\s*writes:\s*$/.test(line)) {
      inWrites = true;
      continue;
    }
    if (!inWrites) continue;

    const match = WRITE_LINE.exec(line);
    if (match === null) {
      if (/^\s*[a-z ()]+:/.test(line)) inWrites = false;
      continue;
    }

    const [, confidence, kind, rest] = match;
    for (const path of pathsOf(rest)) {
      writes.push({ confidence, kind, path });
    }
  }

  return writes;
}

export function expandBraces(path) {
  const open = path.indexOf('{');
  if (open === -1) return [path];

  const close = path.indexOf('}', open);
  if (close === -1) return [path];

  const head = path.slice(0, open);
  const tail = path.slice(close + 1);

  return path
    .slice(open + 1, close)
    .split(',')
    .flatMap((choice) => expandBraces(`${head}${choice.trim()}${tail}`));
}

export function pathMatches(pattern, file) {
  if (pattern.endsWith('/')) return file.startsWith(pattern);
  if (!pattern.includes('*') && !lastSegment(pattern).includes('.')) {
    return file === pattern || file.startsWith(`${pattern}/`);
  }
  if (!pattern.includes('*')) return file === pattern;

  const source = pattern
    .split(/(\*\*|\*)/)
    .map((part) => (part === '**' ? '.*' : part === '*' ? '[^/]*' : escapeRegExp(part)))
    .join('');

  return new RegExp(`^${source}$`).test(file);
}

export function scoreTicket({ predicted, actual }) {
  const byConfidence = Object.fromEntries(
    CONFIDENCES.map((confidence) => [confidence, { predicted: 0, hit: 0 }]),
  );
  const wrong = [];

  for (const write of predicted) {
    const patterns = expandBraces(write.path);
    const hit = actual.some((file) => patterns.some((pattern) => pathMatches(pattern, file)));
    byConfidence[write.confidence].predicted += 1;
    byConfidence[write.confidence].hit += hit ? 1 : 0;
    if (!hit) wrong.push(write);
  }

  const coverage = Object.fromEntries(
    CONFIDENCES.map((confidence, index) => {
      const allowed = new Set(CONFIDENCES.slice(0, index + 1));
      const patterns = predicted
        .filter((write) => allowed.has(write.confidence))
        .flatMap((write) => expandBraces(write.path));
      const covered = actual.filter((file) =>
        patterns.some((pattern) => pathMatches(pattern, file)),
      );
      return [confidence, covered.length];
    }),
  );

  const allPatterns = predicted.flatMap((write) => expandBraces(write.path));
  const missed = actual.filter(
    (file) => !allPatterns.some((pattern) => pathMatches(pattern, file)),
  );

  return { actual: actual.length, byConfidence, coverage, wrong, missed };
}

export function summarize(scores) {
  const total = { tickets: scores.length, actual: 0 };
  const byConfidence = Object.fromEntries(
    CONFIDENCES.map((confidence) => [confidence, { predicted: 0, hit: 0, covered: 0 }]),
  );

  for (const score of scores) {
    total.actual += score.actual;
    for (const confidence of CONFIDENCES) {
      byConfidence[confidence].predicted += score.byConfidence[confidence].predicted;
      byConfidence[confidence].hit += score.byConfidence[confidence].hit;
      byConfidence[confidence].covered += score.coverage[confidence];
    }
  }

  return {
    ...total,
    precision: Object.fromEntries(
      CONFIDENCES.map((confidence) => [
        confidence,
        ratio(byConfidence[confidence].hit, byConfidence[confidence].predicted),
      ]),
    ),
    recallUpTo: Object.fromEntries(
      CONFIDENCES.map((confidence) => [
        confidence,
        ratio(byConfidence[confidence].covered, total.actual),
      ]),
    ),
  };
}

function pathsOf(rest) {
  const [listed] = rest.split(/\s+(?:\(|—|–|-\s)/);
  const paths = splitOutsideBraces(listed)
    .map((piece) => piece.trim().split(/\s+/)[0] ?? '')
    .filter(looksLikePath);
  const sibling = /\(\+\s*(\.[\w.]+)\)/.exec(rest);

  if (sibling === null) return paths;

  return paths.flatMap((path) => [path, path.replace(/\.\w+$/, sibling[1])]);
}

function splitOutsideBraces(text) {
  const pieces = [''];
  let depth = 0;

  for (const character of text) {
    if (character === '{') depth += 1;
    if (character === '}') depth -= 1;
    if (character === ',' && depth === 0) {
      pieces.push('');
    } else {
      pieces[pieces.length - 1] += character;
    }
  }

  return pieces;
}

function lastSegment(path) {
  return path.slice(path.lastIndexOf('/') + 1);
}

function looksLikePath(text) {
  return text.includes('/') || /\.[a-z]+$/i.test(text);
}

function ratio(part, whole) {
  return whole === 0 ? null : part / whole;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
