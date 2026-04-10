# Release Flow (Development vs Production)

This repo uses one codebase with branch-based separation:

- `develop`: development-ready integration branch.
- `master` / `main`: production-ready branch.
- `feature/*`: day-to-day work branches.

## Recommended Flow

1. Create feature branch from `develop`.
2. Open PR to `develop` after finishing a feature.
3. CI must pass (`verify`, backend integration, frontend e2e).
4. For release, open PR from `develop` to `master` (or `main`).
5. Merge release PR only after review and green CI.

## GitHub Actions added

- `CI` (`.github/workflows/ci.yml`)
  - Runs on push/PR for `develop`, `master`, and `main`.
  - Executes `npm run verify`.
  - Executes backend Prisma integration tests.
  - Executes frontend Playwright e2e tests.

- `Build Development Artifact` (`.github/workflows/build-development.yml`)
  - Runs on push to `develop`.
  - Builds and uploads a `development-build-<sha>.tar.gz` artifact.

- `Build Production Artifact` (`.github/workflows/build-production.yml`)
  - Runs on push to `master`/`main`.
  - Builds and uploads a `production-build-<sha>.tar.gz` artifact + `.sha256`.

- `PR Workflow Guard` (`.github/workflows/pr-workflow-guard.yml`)
  - Runs on push to `develop`, `master`, and `main`.
  - Fails if pushed commit is not associated with a merged PR into the target branch.

## Suggested GitHub settings (manual step, best option)

In repository settings:

1. Add branch protection for `develop` and `master`/`main`.
2. Require pull requests before merge.
3. Require status checks from CI workflows.
4. Optionally require approvals for production environment deployments.

## Private repo on free plan fallback

If branch protection/rulesets are unavailable on your plan, rely on these guardrails:

1. Enable local `.githooks/pre-push` hook.
2. Keep `PR Workflow Guard` workflow active for server-side detection.
3. Merge through Pull Requests as team policy.

This fallback gives fast detection, but unlike branch protection it cannot hard-block the push event.
