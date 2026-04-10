# Contributing

## Branch and Pull Request flow

To separate development-ready vs production-ready code:

1. `develop` is the integration branch (active development).
2. `master`/`main` is production-ready only.
3. Create feature branches from `develop` (for example `feature/<short-description>`).
4. Open Pull Request from feature branch into `develop`.
5. Promote to production by Pull Request from `develop` into `master` (or `main`).
6. Merge only through Pull Request review.

GitHub Actions now supports this flow:
- CI runs on PR/push for `develop`, `master`, and `main`.
- Dev artifact is built from `develop`.
- Production artifact is built from `master`/`main`.
- `PR Workflow Guard` fails if a push commit to protected branches is not linked to a merged PR.

## Local push guard

This repository includes `.githooks/pre-push` to block direct pushes to protected branches (`develop`, `master`, and `main`).

Enable it once per clone:

```bash
git config core.hooksPath .githooks
```

## GitHub-side guard (for private/free repo fallback)

If native branch protection is unavailable, `.github/workflows/pr-workflow-guard.yml` provides a fallback check:

- Runs on push to `develop`, `master`, and `main`.
- Fails when a commit is not associated with a merged PR into that branch.

Note: this does not prevent the push itself. It provides immediate CI failure signal until branch protection can be enabled.
