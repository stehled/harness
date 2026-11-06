import { isDefaultBranch } from '../worktree/config.mjs';

export function editDecision({ filePath, root, branch, linkedWorktree, config }) {
  if (typeof filePath !== 'string' || typeof root !== 'string') return { allow: true };
  if (!filePath.startsWith(`${root}/`)) return { allow: true };

  const relative = filePath.slice(root.length + 1);
  if (relative.startsWith('.claude/')) return { allow: true };
  if (linkedWorktree) return { allow: true };
  if (!branch || branch === 'HEAD' || isDefaultBranch(branch, config)) return { allow: true };

  return {
    allow: false,
    reason:
      `The main checkout is on '${branch}', not ${config.defaultBranch}. Ticket work belongs in a ` +
      `worktree: git worktree add .claude/worktrees/<name> ${branch}, then cd there and ` +
      'retry the edit against the file under that path.',
  };
}

export function editHookOutput(decision) {
  if (decision.allow) return {};

  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: decision.reason,
    },
  };
}
