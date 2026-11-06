import { isDefaultBranch } from '../worktree/config.mjs';

export function publishPlan({ branch, commitsAhead, config }) {
  if (!branch || branch === 'HEAD' || isDefaultBranch(branch, config)) return null;
  if (commitsAhead === 0) return null;

  const create = [
    'gh',
    'pr',
    'create',
    '--base',
    config.defaultBranch,
    '--draft',
    '--fill',
    '--assignee',
    '@me',
  ];
  if (config.reviewer) {
    create.push('--reviewer', config.reviewer);
  }

  return {
    push: ['git', 'push', '-u', 'origin', 'HEAD', '--quiet'],
    findExisting: ['gh', 'pr', 'view', '--json', 'url', '-q', '.url'],
    create,
  };
}
