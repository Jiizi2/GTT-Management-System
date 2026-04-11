# Contributing

## Branch and Pull Request flow

To separate development-ready vs production-ready code:

1. `develop` is the integration branch (active development).
2. `master`/`main` is production-ready only.
3. Create feature branches from `develop` (for example `feature/<short-description>`).
4. Open Pull Request from feature branch into `develop`.
5. Promote to production by Pull Request from `develop` into `master` (or `main`).
6. Merge only through Pull Request review.

For now, verification is manual. Run the checks you need locally before opening or merging a Pull Request:

- `npm run qa`
- `npm run qa:full`
- `npm run verify`
- `npm run test:integration`
- `npm run test:e2e:frontend`

## Local push guard

This repository includes `.githooks/pre-push` to block direct pushes to protected branches (`develop`, `master`, and `main`).

Enable it once per clone:

```bash
git config core.hooksPath .githooks
```
