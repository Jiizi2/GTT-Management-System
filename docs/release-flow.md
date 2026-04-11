# Release Flow (Development vs Production)

This repo uses one codebase with branch-based separation:

- `develop`: development-ready integration branch.
- `master` / `main`: production-ready branch.
- `feature/*`: day-to-day work branches.

## Recommended Flow

1. Create feature branch from `develop`.
2. Run `npm run qa` for local fast regression. For release-risky changes, prefer `npm run qa:full`.
3. Run the release-risky commands manually as needed:
   - `npm run verify`
   - `npm run test:integration`
   - `npm run test:e2e:frontend`
4. Open PR to `develop` after finishing a feature.
5. For release, open PR from `develop` to `master` (or `main`).
6. Merge after review and after the required manual checks pass.

## Manual verification

GitHub Actions CI has been removed from this repo for now, so validation is expected to run locally before merge or release.

Recommended checks:

- Fast path: `npm run qa`
- Full path: `npm run qa:full`
- Granular commands when you want to test one layer only:
  - `npm run verify`
  - `npm run test:api`
  - `npm run test:integration`
  - `npm run test:e2e:frontend`

## GitHub settings

If this repository previously required GitHub status checks in branch protection/rulesets, remove those required checks in repository settings so manual testing can be used without blocked merges.
