import { isDefaultBranch, ticketBranchPattern } from './config.mjs';

const MAIN_PORTS = Object.freeze({
  web: 3000,
  api: 3001,
  postgres: 5432,
  redis: 6379,
});

const BLOCK_BASE = 20000;
const BLOCK_SIZE = 10;
const BLOCK_COUNT = 899;

export function slotFromBranch(branch, config) {
  const match = ticketBranchPattern(config).exec(branch);

  return match ? Number(match[1]) : undefined;
}

export function slotFromPath(path) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < path.length; index += 1) {
    hash ^= path.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return (hash % BLOCK_COUNT) + 1;
}

export function resolveSlot({ branch, path, config }) {
  if (isDefaultBranch(branch, config)) {
    return 0;
  }

  return slotFromBranch(branch, config) ?? slotFromPath(path);
}

export function portsForSlot(slot) {
  if (slot === 0) {
    return { ...MAIN_PORTS };
  }

  const base = BLOCK_BASE + (((slot - 1) % BLOCK_COUNT) + 1) * BLOCK_SIZE;

  return {
    web: base,
    api: base + 1,
    postgres: base + 2,
    redis: base + 3,
  };
}

export function projectNameForSlot(slot, config) {
  return slot === 0 ? config.project : `${config.project}-${slot}`;
}

export function worktreeNameForBranch(branch, config) {
  const slot = slotFromBranch(branch, config);

  if (slot !== undefined) {
    return projectNameForSlot(slot, config);
  }

  return branch.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'branch';
}

export function environmentForSlot(slot, { postgresUser, postgresPassword, postgresDb, config }) {
  const ports = portsForSlot(slot);

  return {
    COMPOSE_PROJECT_NAME: projectNameForSlot(slot, config),
    WEB_PORT: String(ports.web),
    API_PORT: String(ports.api),
    POSTGRES_PORT: String(ports.postgres),
    REDIS_PORT: String(ports.redis),
    DATABASE_URL: `postgres://${postgresUser}:${postgresPassword}@localhost:${ports.postgres}/${postgresDb}`,
    REDIS_URL: `redis://localhost:${ports.redis}`,
    API_URL: `http://localhost:${ports.api}`,
    WEB_ORIGIN: `http://localhost:${ports.web}`,
  };
}
