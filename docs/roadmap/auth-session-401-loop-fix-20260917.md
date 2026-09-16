# Auth Session 401 Loop Fix — 2026-09-17

## Finding

One failed dashboard login produced one `POST /api/auth/login` response followed
by 661 `GET /api/auth/session` responses in a one-second browser measurement.
Every session request returned `401`.

The shared API client cleared browser auth state for every `401`, including the
expected unauthenticated responses from the login and session-probe endpoints.
Clearing auth state emitted an event that invalidated the session query, creating
an immediate request loop.

## Fix

Expected `401` responses from `/auth/login` and `/auth/session` no longer broadcast
a global auth-state change. Unauthorized responses from protected application
endpoints continue to clear the session and notify the application.

## Verification

- Before: 1 failed login request + 661 session requests in one second.
- After: 1 failed login request + 0 session requests after the failure.
- Unit coverage verifies both silent auth probes and session clearing for a
  protected endpoint.
- No backend, database schema, migration, or production configuration changed.
