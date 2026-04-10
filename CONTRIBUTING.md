# Contributing

## Branch and Pull Request flow

To keep `master` stable, use a feature branch and open a Pull Request for every change.

1. Sync latest `master`.
2. Create a branch, for example `<short-description>`.
3. Commit changes on that branch.
4. Push the branch and open a Pull Request into `master`.
5. Merge only through Pull Request review.

## Local push guard

This repository includes `.githooks/pre-push` to block direct pushes to `master` and `main`.

Enable it once per clone:

```bash
git config core.hooksPath .githooks
```
