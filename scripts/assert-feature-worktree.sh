#!/usr/bin/env bash
set -euo pipefail

git_dir="$(git rev-parse --path-format=absolute --git-dir)"
common_dir="$(git rev-parse --path-format=absolute --git-common-dir)"
branch="$(git branch --show-current)"

if [[ "$git_dir" == "$common_dir" ]]; then
  echo "Feature work must run in a linked Git worktree, not the primary checkout." >&2
  exit 1
fi

if [[ "$branch" != codex/* ]]; then
  echo "Feature worktree branches must use the codex/ prefix; current branch: $branch" >&2
  exit 1
fi

echo "Verified linked feature worktree on $branch"
