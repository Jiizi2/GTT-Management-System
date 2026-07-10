# Critical Fixes Implementation Plan

> **Generated:** 2026-07-05  
> **Project:** GTT (Group Travel Tracker)  
> **Scope:** Comprehensive review findings dan remediation plan

---

## 📋 Table of Contents

- [Executive Summary](#executive-summary)
- [Review Overview](#review-overview)
- [Roadmap Analysis](#roadmap-analysis)
- [Critical Findings](#critical-findings)
- [Implementation Plan](#implementation-plan)
- [Risk Register](#risk-register)
- [Success Metrics](#success-metrics)
- [Execution Timeline](#execution-timeline)

---

## Executive Summary

Dokument ini berisi hasil review komprehensif dari 4 dimensi (Architecture, Security, Performance, Git/Organization) dan detailed implementation plan untuk memperbaiki critical issues.

**Key Statistics:**
- **Frontend:** ~54,700 baris TypeScript/TSX (109 files)
- **Backend:** ~29,600 baris TypeScript (81 files)
- **Database:** PostgreSQL dengan Prisma ORM
- **Architecture:** Monorepo dengan npm workspaces

**Overall Assessment:**
| Dimension | Rating | Status |
|-----------|--------|--------|
| Architecture | ⭐⭐⭐⭐ (4/5) | Solid foundations, file-level complexity risk |
| Security | ⭐⭐⭐⭐ (4/5) | Strong posture, critical issues need fixing |
| Performance | ⭐⭐⭐ (3/5) | Good patterns, many bottlenecks |
| Testing | ⭐⭐⭐ (3/5) | Comprehensive strategy, coverage gaps |
| Code Quality | ⭐⭐⭐ (3/5) | Clean patterns, god-object services |

**Total Estimated Effort:** 3-4 minggu (1 engineer)

---

## Review Overview

### 1. Architecture & Code Quality Review

#### ✅ Strengths
- **Intentional monorepo structure** dengan npm workspaces dan clean `apps/*` layout
- **Three-layer backend architecture** yang proper:
  - `domain/` (pure business logic, no framework imports)
  - `application/` (NestJS-injectable orchestrators)
  - `infrastructure/` (data-source-specific implementations)
- **Multi-layer testing strategy:** unit, smoke, component, integration, API E2E, Playwright browser E2E
- **Clean frontend state management** dengan React Query dan custom hooks
- **Well-organized shared domain layer** di frontend (`src/shared/` dengan 17 files)
- **Good API documentation** dengan Swagger/OpenAPI decorators
- **Structured logging** dengan Pino dan request ID propagation

#### ⚠️ Critical Issues

**God-Object Services:**

| File | Lines | Issue |
|------|-------|-------|
| `apps/backend/src/invoices/invoices.service.ts` | 1,966 | Single file handles clients, invoices, line items, payments, memory+Prisma paths |
| `apps/backend/src/groups/application/groups-command.service.ts` | 1,427 | Contains both Prisma and memory dispatch logic inline |
| `apps/frontend/src/pages/invoice-page.tsx` | 2,066 | Single React component untuk seluruh invoice dashboard |
| `apps/frontend/src/pages/group-detail-page.tsx` | 1,981 | Imports 40+ functions dari domain barrel |
| `apps/frontend/src/components/group-detail-modals.tsx` | 1,896 | 8 modal components dalam 1 file |

**Data Source Abstraction Leak:**
- Pattern `if (this.dataSource === "prisma")` di setiap method service
- 43 occurrences across 10 files
- Seharusnya menggunakan Repository/Strategy pattern

**AppController God Object (Frontend):**
- `use-app-controller.ts` return object dengan 45+ properties
- Dileaks ke `AppMainContent` yang distribute ke semua child pages

**Other Issues:**
- Prisma enum coupling di domain files
- Duplicated Prisma query logic di command dan query services
- Sub-services tidak visible ke DI container (manual instantiation)
- Frontend type duplication (449 baris type definitions)

---

### 2. Security Review

#### ✅ Strengths
- **Bcrypt 12 rounds** untuk password hashing
- **JWT dengan HS256** dan signature verification
- **HttpOnly, Secure, SameSite cookies** untuk auth
- **Rate limiting** pada login dengan configurable lockout
- **Comprehensive input validation** dengan class-validator dan Joi
- **Security headers** lengkap: Helmet, X-Frame-Options, Referrer-Policy, Permissions-Policy
- **CORS configuration** dengan explicit origin validation
- **Environment validation** enforce AUTH_SECRET minimum 32 karakter
- **XSS protection** dengan custom escapeHtml function
- **SQL injection protection** dengan Prisma parameterized queries
- **Role-based access control** dengan @Roles decorator

#### ⚠️ Vulnerabilities

**HIGH SEVERITY:**

1. **Committed Production Environment Files**
   - **Files:** `apps/backend/.env.production`, `apps/frontend/.env.production`
   - **Issue:** Production environment template files committed
   - **Status:** ✅ **FALSE POSITIVE** - files already in `.gitignore`
   - **Action:** No action needed

2. **Known Vulnerable Dependencies**
   - `form-data` (v4.0.0-4.0.5): CRLF injection (GHSA-hmw2-7cc7-3qxx)
   - `joi` (v18.0.0-18.2.0): DoS vulnerability (GHSA-q7cg-457f-vx79)
   - `@nestjs/core`, `@nestjs/platform-express`: High severity via multer
   - **Action:** Run `npm audit fix` and update packages

3. **Hardcoded Development Passwords**
   - **Files:** `auth-default-users.ts:165-167`, `apps/backend/.env:8-9`
   - **Passwords:** "DevSuperAdmin#2026", "DevAdmin#2026"
   - **Mitigation:** Code prevents bootstrap in production
   - **Action:** Document, move to env vars

**MEDIUM SEVERITY:**

4. **Weak Password Policy**
   - **Current:** Minimum 8 characters only
   - **Recommended:** 12+ chars, complexity requirements
   - **Files:** `login.dto.ts:20`, `create-managed-user.dto.ts:49`, `set-managed-user-password.dto.ts:11`

5. **No Request Body Size Limits**
   - **File:** `apps/backend/src/main.ts`
   - **Impact:** Potential DoS via large payloads
   - **Fix:** Add `express.json({ limit: '1mb' })`

6. **document.write() Usage**
   - **Files:** 4 export files (group-detail, invoice, visa-tracking, overview)
   - **Risk:** XSS risk despite escapeHtml usage
   - **Fix:** Replace with safer DOM APIs

7. **SameSite=Lax Instead of Strict**
   - **File:** `auth-cookie.ts:53`
   - **Impact:** CSRF edge cases on cross-site GET
   - **Trade-off:** Lax provides better UX

8. **No CSRF Token Protection**
   - **Mitigation:** SameSite cookies + origin validation
   - **Recommendation:** Add CSRF tokens for defense-in-depth

**LOW SEVERITY:**

9. **Swagger UI Exposed in Production**
   - **File:** `main.ts:126-134`
   - **Fix:** Disable or add authentication

10. **No HSTS Header**
    - **Fix:** Add `helmet({ hsts: { maxAge: 31536000, includeSubDomains: true } })`

11. **No Password History Enforcement**
    - **Recommendation:** Implement for sensitive accounts

---

### 3. Performance & Best Practices Review

#### ✅ Strengths
- Solid architecture dengan good separation of concerns
- Proper use of React Query untuk server state
- Database-backed rate limiting untuk distributed systems

#### ⚠️ Performance Bottlenecks

**Database Issues (Critical):**

1. **N+1 Query Problem in Invoice Service**
   - **File:** `apps/backend/src/invoices/invoices.service.ts:1150-1183`
   - **Issue:** `findAllWithPrisma()` melakukan bulk update sebelum fetch
   - **Impact:** Write operation on every read
   - **Shadow verification** (lines 1679-1707) adds comparison overhead

2. **Missing Composite Indexes**
   ```
   Missing indexes needed for common queries:
   - Invoice: (status, dueDate) - used in overdue invoice sync
   - Group: (searchDocument, lifecycleStatus) - used in list filtering
   - InvoiceItem: (invoiceId, description) - used in relational queries
   ```

3. **Inefficient Invoice Number Generation**
   - **File:** `invoices.service.ts:1759-1800`
   - **Issue:** `findFirst` dengan `startsWith` can't use indexes efficiently
   - **Impact:** O(n) scan as table grows
   - **Fix:** Use database sequence atau counter table

4. **Unbounded Audit Log Queries**
   - **File:** `apps/backend/src/groups/application/groups-query.service.ts:78-113`
   - **Issue:** `listAuditLogsWithPrisma()` has no default limit
   - **Impact:** Memory exhaustion as logs grow

5. **Transaction Lock Contention**
   - **File:** `invoices.service.ts:676-733`
   - **Issue:** `pg_advisory_xact_lock` serializes all client creation
   - **Fix:** Use database UNIQUE constraints dengan ON CONFLICT

6. **Lazy Sync Pattern**
   - **File:** `invoices.service.ts:1153-1171`
   - **Issue:** Every `findAll()` runs `updateMany()` untuk sync overdue
   - **Fix:** Move to background job/cron

**API Issues (Critical):**

7. **Missing Pagination on Invoices**
   - **File:** `apps/backend/src/invoices/invoices.controller.ts:50-63`
   - **Impact:** Response time dan payload grow linearly
   - **Fix:** Implement cursor atau offset-based pagination

8. **No Response Caching Headers**
   - **File:** `invoices.controller.ts:61`
   - **Issue:** `Cache-Control: no-store` even untuk list endpoints
   - **Fix:** Use ETag atau Last-Modified headers

9. **Blocking Operations in Invoice Creation**
   - **File:** `invoices.service.ts:1185-1321`
   - **Issue:** 5+ sequential database round trips
   - **Fix:** Parallelize independent lookups dengan `Promise.all`

10. **Master Data Seeding on Every Request**
    - **File:** `apps/backend/src/master-data/master-data.service.ts:644-694`
    - **Issue:** `ensurePrismaDefaultsSeeded()` called on every read
    - **Fix:** Run seeding once on module init

**Frontend Issues (Critical):**

11. **No Route-Based Code Splitting**
    - **File:** `apps/frontend/src/app.tsx:8-13`
    - **Issue:** Only 2 lazy-loaded components
    - **Impact:** Large initial bundle size
    - **Fix:** Lazy load each page component

12. **Aggressive Cache Invalidation**
    - **File:** `apps/frontend/src/hooks/use-groups-query.ts:9,28`
    - **Issue:** `staleTime: 30_000` dan `15_000` terlalu pendek
    - **Fix:** Increase to 5-10 minutes, use manual invalidation

13. **No Request Deduplication**
    - **File:** `apps/frontend/src/shared/api-client.ts`
    - **Issue:** Raw fetch tanpa deduplication
    - **Fix:** Ensure all data fetching uses React Query

**Error Handling Issues:**

14. **Swallowed Errors in Column Checks**
    - **File:** `invoices.service.ts:1048-1058, 1118-1128`
    - **Issue:** Errors caught dan return false silently
    - **Fix:** Fail fast in production

15. **Missing Error Boundaries**
    - **File:** `apps/frontend/src/app.tsx`
    - **Impact:** Unhandled errors crash entire app
    - **Fix:** Add React Error Boundaries

16. **Inconsistent Error Responses**
    - **Issue:** Mix of exception types tanpa consistent format
    - **Fix:** Use consistent error response schema

**Testing Coverage Issues:**

17. **Zero Coverage on Controllers**
    - `apps/backend/src/auth/auth.controller.ts` (0%)
    - `apps/backend/src/groups/http/groups.controller.ts` (0%)
    - `apps/backend/src/invoices/invoices.controller.ts` (0%)
    - `apps/backend/src/health/health.controller.ts` (0%)

18. **Zero Coverage on DTOs**
    - All DTO files in `apps/backend/src/*/dto/` (0%)

19. **Low Coverage on Critical Services**
    - `invoices.service.ts`: 69.34% (target 80%)
    - `hotel-agreement-drafts.service.ts`: 55.18%

20. **No E2E Tests for Critical Flows**
    - Missing: invoice creation, group management workflows

**Code Quality Issues:**

21. **Duplicated Validation Logic**
    - **File:** `invoices.service.ts`
    - **Functions:** `validateAmounts`, `validateItems`, `validatePayments`
    - **Fix:** Move to DTO validation decorators

22. **Duplicated Memory/Prisma Patterns**
    - **Files:** invoices.service.ts, groups-query.service.ts, master-data.service.ts
    - **Issue:** Identical `if (this.dataSource === "prisma")` branching
    - **Fix:** Use Strategy pattern atau repository abstraction

23. **Magic Strings in Notes**
    - **File:** `invoices.service.ts:305, 389-398`
    - **Issue:** Parsing metadata dari notes: `[NoDueDate:true]`, `[ExchangeRate:...]`
    - **Fix:** Add proper database columns atau JSON field

24. **Large Service Files**
    - invoices.service.ts (1,966 lines) - 50+ methods
    - **Fix:** Split into InvoiceQueryService, InvoiceCommandService, InvoiceNumberGenerator, InvoiceValidator

---

### 4. Git & Code Organization Review

#### ✅ Strengths
- **Clean git history** dengan conventional commits
- **Good branch strategy** — main, develop, feature branches
- **Comprehensive CI/CD** dengan GitHub Actions
- **Docker Compose deployment** yang well-organized
- **Environment configuration** yang proper dengan validation

#### ⚠️ Area Improvements

**Git & CI/CD:**

1. **E2E Tests Allowed to Fail**
   - **File:** GitHub Actions workflow
   - **Issue:** `continue-on-error: true` bisa mask regressions
   - **Fix:** Make E2E tests required atau fix flaky tests

2. **No Backend Linting/Formatting**
   - **Issue:** Only frontend has Prettier dan ESLint
   - **Fix:** Add backend linting configuration

3. **Inconsistent Test File Colocation**
   - Backend: colocated dengan source (`*.test.ts`)
   - Frontend: split across `src/unit/`, `src/smoke/`, `src/components/**/__tests__/`
   - **Fix:** Standardize test organization

**Documentation:**

4. **Missing API Documentation untuk Beberapa Endpoints**
   - **Fix:** Add Swagger decorators untuk semua endpoints

5. **No Architecture Decision Records (ADRs)**
   - **Fix:** Create `docs/adr/` directory untuk document decisions

6. **Limited Inline Comments di Complex Business Logic**
   - **Fix:** Add explanatory comments untuk non-obvious logic

**Code Organization:**

7. **Hardcoded Dev Credentials**
   - **File:** `apps/frontend/src/app.tsx:15-28`
   - **Issue:** Development login credentials hardcoded
   - **Fix:** Load dari environment configuration

8. **Magic Strings**
   - **Files:** `invoices.service.ts`
   - **Patterns:** `[NoDueDate:true]`, `[ExchangeRate:USD=X,SAR=Y]`, `[Payments:...]`
   - **Fix:** Use proper database columns atau JSON field

9. **Unused Dependencies**
   - **Issue:** `joi` listed tapi tidak digunakan (using class-validator)
   - **Fix:** Remove unused dependencies

---

## Roadmap Analysis

### 🔍 Findings

**Status:** ZERO roadmap markers ditemukan di group module

**Searched Patterns:**
- `TODO` / `FIXME` / `HACK` / `XXX` — 0 matches
- `roadmap` / `planned` / `future` — 0 matches
- `migrate` / `deprecate` / `legacy` / `refactor` — 0 matches
- `workaround` / `hack` / `temporary` / `dirty` — 0 matches
- `for now` / `until we` / `once we` / `later` / `eventually` — 0 matches
- `known issue` / `limitation` / `caveat` — 0 matches

**Files Analyzed:**
- `apps/backend/src/groups/**/*` (38 files)
- `apps/frontend/src/pages/group-detail-page.tsx`
- `apps/frontend/src/components/group-detail-modals.tsx`
- `apps/frontend/src/shared/group-status-domain.ts`
- `apps/frontend/src/shared/group-visa-domain.ts`

### 📊 Observations

**1. Architectural Decision Found:**
```typescript
// File: apps/backend/src/groups/domain/groups.hotel-validation.ts:132-133
// Soft rules: Do not throw BadRequestException for gaps or disconnected dates.
// The frontend will handle displaying warnings to the user.
```
**Category:** Design Decision  
**Relevance:** Documents intentional soft validation approach

**2. Dual-Source Architecture:**
- **Pattern:** Configuration-driven data source selection via `DATA_SOURCE` env var
- **Implementation:** Two complete paths: `memory` dan `prisma`
- **Assessment:** This is a **mature dual-source architecture**, NOT a migration in progress
- **Both paths are fully implemented dan tested**

**3. No Technical Debt Markers:**
- Zero TODO/FIXME comments
- No planned refactoring documented
- No known issues tracked
- All code appears production-ready

### 💡 Implications

**Review findings adalah FRESH INSIGHTS, bukan konfirmasi dari roadmap yang sudah ada.**

Jika ada improvement plan, kemungkinan di-track di luar codebase:
- Issue tracker (GitHub Issues)
- Project management tools (Jira, Linear, etc.)
- Internal documentation

**Recommendation:**
- Consider creating issue tracker tickets untuk review findings
- Add ADRs (Architecture Decision Records) untuk future decisions
- Use TODO comments sparingly untuk track technical debt

---

## Critical Findings

### Top 10 Priorities (Ranked by Impact)

#### 🔴 CRITICAL (Fix Immediately)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 1 | Fix vulnerable dependencies | M (4-6h) | Security risk |
| 2 | Add pagination ke invoices endpoint | L (10-14h) | Memory exhaustion |
| 3 | Add missing database indexes | M (4-6h) | 10-100x query improvement |
| 4 | Decompose god-object services | XL (20-30h) | Maintainability |
| 5 | Decompose frontend pages | L (12-16h) | Bundle size, performance |

#### 🟡 HIGH (This Sprint)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 6 | Strengthen password policy (12+ chars) | L (8-12h) | Security |
| 7 | Add request body size limits | S (1-2h) | DoS prevention |
| 8 | Implement Repository pattern | XL (30-40h) | Architecture |
| 9 | Add error boundaries | S (2-4h) | App stability |
| 10 | Increase test coverage | Ongoing | Quality |

#### 🟢 MEDIUM (Next Sprint)

| # | Issue | Effort | Impact |
|---|-------|--------|--------|
| 11 | Route-based code splitting | M (6-8h) | Performance |
| 12 | Remove shadow verification | S (1-2h) | Performance |
| 13 | Add CSRF tokens | M (4-6h) | Security |
| 14 | Increase React Query staleTime | S (1-2h) | Performance |
| 15 | Add backend linting | S (2-4h) | Code quality |

---

## Implementation Plan

### Phase 1: Security Fixes (1-2 hari)

**Timeline:** Week 1, Day 1-2  
**Priority:** Immediate  
**Risk Level:** Low

#### Task 1.1: Fix Vulnerable Dependencies

**Effort:** M (4-6 hours)  
**Dependencies:** None  
**Risk:** Breaking changes in major version updates

**Steps:**

1. Run security audit
   ```bash
   cd "c:/vibe coding"
   npm audit
   ```

2. Update dependencies based on audit results
   - Files: `package.json` (root, backend, frontend)

3. Test thoroughly
   ```bash
   npm run test:unit
   npm run test:integration
   ```

4. Manual smoke test authentication, invoices, groups

**Success Criteria:**
- [ ] `npm audit` shows 0 high/critical vulnerabilities
- [ ] All tests pass
- [ ] No runtime errors in dev environment

---

#### Task 1.2: Strengthen Password Policy

**Effort:** L (8-12 hours)  
**Dependencies:** None  
**Risk:** Existing users may be locked out

**Current State:**
- Minimum 8 characters only
- Files: `login.dto.ts:20`, `create-managed-user.dto.ts:49`, `set-managed-user-password.dto.ts:11`

**Steps:**

1. Create password validation utility
   - **File:** `apps/backend/src/auth/auth-password-validation.ts` (NEW)
   ```typescript
   export function validatePasswordStrength(password: string): { 
     valid: boolean; 
     errors: string[] 
   } {
     const errors: string[] = [];
     if (password.length < 12) 
       errors.push("Password must be at least 12 characters");
     if (!/[A-Z]/.test(password)) 
       errors.push("Password must contain uppercase letter");
     if (!/[a-z]/.test(password)) 
       errors.push("Password must contain lowercase letter");
     if (!/[0-9]/.test(password)) 
       errors.push("Password must contain number");
     if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) 
       errors.push("Password must contain special character");
     return { valid: errors.length === 0, errors };
   }
   ```

2. Create custom class-validator decorator
   - **File:** `apps/backend/src/auth/is-strong-password.ts` (NEW)

3. Update DTOs
   - `login.dto.ts` - Update `@MinLength(8)` to `@MinLength(12)`
   - `create-managed-user.dto.ts` - Add custom validator
   - `set-managed-user-password.dto.ts` - Add custom validator

4. Add tests
   - `auth.service.test.ts`
   - `auth.service.prisma.test.ts`

**Mitigation:**
- Enforce only on password changes, not login
- Add clear error messages
- Document new requirements

**Success Criteria:**
- [ ] All new passwords require 12+ chars dengan complexity
- [ ] Tests cover all validation scenarios
- [ ] API returns clear error messages

---

#### Task 1.3: Add Request Body Size Limits

**Effort:** S (1-2 hours)  
**Dependencies:** None  
**Risk:** Legitimate large requests may be rejected

**Steps:**

1. Add body parser configuration
   - **File:** `apps/backend/src/main.ts`
   ```typescript
   import express from "express";
   
   // After app.setGlobalPrefix("api");
   app.use(
     express.json({ 
       limit: '1mb',
       strict: true 
     })
   );
   app.use(
     express.urlencoded({ 
       extended: true, 
       limit: '1mb' 
     })
   );
   ```

2. Add tests
   - **File:** `apps/backend/src/e2e/backend.api.e2e.test.ts`
   - Test oversized payload returns 413

**Success Criteria:**
- [ ] Requests >1MB are rejected dengan 413 status
- [ ] Normal requests work without issues
- [ ] Test coverage for size limit validation

---

### Phase 2: Performance Fixes (2-3 hari)

**Timeline:** Week 1, Day 3-5  
**Priority:** High  
**Risk Level:** Medium

#### Task 2.1: Add Pagination ke Invoices Endpoint

**Effort:** L (10-14 hours)  
**Dependencies:** None  
**Risk:** Breaking change for API consumers

**Current State:**
- `findAll()` returns ALL invoices
- Files: `invoices.controller.ts:50-63`, `invoices.service.ts:575-581`

**Steps:**

1. Create pagination DTO
   - **File:** `apps/backend/src/invoices/dto/pagination.dto.ts` (NEW)
   ```typescript
   export class PaginationDto {
     @IsOptional()
     @IsInt()
     @Min(1)
     @Type(() => Number)
     page?: number = 1;
     
     @IsOptional()
     @IsInt()
     @Min(1)
     @Max(100)
     @Type(() => Number)
     limit?: number = 20;
   }
   
   export class PaginatedResponseDto<T> {
     data: T[];
     total: number;
     page: number;
     limit: number;
     totalPages: number;
   }
   ```

2. Update controller
   - **File:** `apps/backend/src/invoices/invoices.controller.ts`
   ```typescript
   @Get()
   findAll(
     @Query() pagination: PaginationDto,
     @Res({ passthrough: true }) response: ResponseLike
   ) {
     response.setHeader("Cache-Control", "no-store, private");
     return this.invoicesService.findAllPaginated(pagination);
   }
   ```

3. Implement paginated query
   - **File:** `apps/backend/src/invoices/invoices.service.ts`
   - Add `findAllPaginated()` method
   - Update `findAllWithPrisma()` to support pagination
   ```typescript
   const invoices = await this.prisma.invoice.findMany({
     select: invoiceSummarySelect,
     orderBy: [{ dueDate: "desc" }, { invoiceNumber: "desc" }],
     skip: (page - 1) * limit,
     take: limit,
   });
   
   const total = await this.prisma.invoice.count();
   ```

4. Update frontend
   - **Files:** 
     - `apps/frontend/src/hooks/use-invoice-query.ts`
     - `apps/frontend/src/pages/invoice-page.tsx`
   - Add pagination state dan controls
   - Use existing `PaginationControls` component

5. Add tests
   - **File:** `apps/backend/src/invoices/invoices.service.test.ts`

**Mitigation:**
- Make pagination optional dengan high default limit (100) initially
- Add deprecation warning for unpaginated endpoint
- Consider versioning endpoint

**Success Criteria:**
- [ ] Endpoint returns paginated results
- [ ] Response includes total count dan page info
- [ ] Frontend displays pagination controls
- [ ] Query performance improves (measure dengan EXPLAIN ANALYZE)

---

#### Task 2.2: Add Missing Database Indexes

**Effort:** M (4-6 hours)  
**Dependencies:** Best done dengan Task 2.1  
**Risk:** Index creation on large tables may lock table

**Steps:**

1. Create migration
   - **File:** `apps/backend/prisma/migrations/YYYYMMDDHHMMSS_add_performance_indexes/migration.sql` (NEW)
   ```sql
   -- Invoice: Composite index untuk status + dueDate filtering
   CREATE INDEX CONCURRENTLY "Invoice_status_dueDate_idx" 
   ON "Invoice"("status", "dueDate" DESC);
   
   -- Group: Composite index untuk search + lifecycle filtering
   CREATE INDEX CONCURRENTLY "Group_searchDocument_lifecycleStatus_idx" 
   ON "Group"("searchDocument", "lifecycleStatus");
   
   -- InvoiceItem: Composite index untuk invoice + description
   CREATE INDEX CONCURRENTLY "InvoiceItem_invoiceId_description_idx" 
   ON "InvoiceItem"("invoiceId", "description");
   ```

2. Update schema.prisma
   - **File:** `apps/backend/prisma/schema.prisma`
   ```prisma
   model Invoice {
     // ... existing fields ...
     @@index([status, dueDate(sort: Desc)])
   }
   
   model Group {
     // ... existing fields ...
     @@index([searchDocument, lifecycleStatus])
   }
   
   model InvoiceItem {
     // ... existing fields ...
     @@index([invoiceId, description])
   }
   ```

3. Run migration
   ```bash
   cd "c:/vibe coding/apps/backend"
   npm run db:migrate
   ```

4. Verify indexes
   ```sql
   SELECT indexname, indexdef 
   FROM pg_indexes 
   WHERE tablename IN ('Invoice', 'Group', 'InvoiceItem');
   ```

**Mitigation:**
- Use `CREATE INDEX CONCURRENTLY` to avoid locks
- Run during low-traffic period
- Monitor database performance

**Success Criteria:**
- [ ] All three indexes created successfully
- [ ] Query execution plans show index usage
- [ ] Query performance improves 50%+ (measure before/after)

---

#### Task 2.3: Remove Shadow Verification in Production

**Effort:** S (1-2 hours)  
**Dependencies:** None  
**Risk:** May miss data integrity issues in production

**Current State:**
- Shadow verification code at `invoices.service.ts:1678-1707`

**Steps:**

1. Add environment check
   - **File:** `apps/backend/src/invoices/invoices.service.ts`
   - Wrap lines 1677-1707:
   ```typescript
   // Only run shadow verification in non-production environments
   if (process.env.NODE_ENV !== 'production') {
     // Perform shadow read verification
     const shadowTracker = Telemetry.start("invoice_shadow_compare_ms");
     let shadowMismatch = false;
     // ... existing code ...
     if (shadowMismatch) {
       Telemetry.event("invoice_shadow_mismatch", { ... });
     }
   }
   ```

2. Update tests
   - **File:** `apps/backend/src/invoices/invoices.service.test.ts`
   - Add test that verifies shadow verification is skipped in production

**Success Criteria:**
- [ ] Shadow verification skipped in production
- [ ] Still runs in dev/staging environments
- [ ] Tests cover both scenarios

---

### Phase 3: Architecture Refactoring (1-2 minggu)

**Timeline:** Week 2-3  
**Priority:** High  
**Risk Level:** High

#### Task 3.1: Decompose invoices.service.ts (1,966 lines)

**Effort:** XL (20-30 hours)  
**Dependencies:** Should be done before Task 3.2  
**Risk:** Breaking changes to service API

**Target Structure:**
- `InvoiceValidator`: Pure domain validation class responsible for all format and numerical check rules.
- `InvoiceNumberGenerator`: Module for managing sequence logic, retries, and formatting of invoice numbers.
- `InvoiceQueryService`: Class containing all read operations, client mapping, and lists (both Prisma and In-Memory).
- `InvoiceCommandService`: Class containing write actions: creating, updating, and backfilling (both Prisma and In-Memory).
- `InvoicesService` (Facade): Keeps NestJS `@Injectable()` API fully backward-compatible by delegating queries and commands to sub-services.

**Detailed Execution Steps:**

1. **Extract Validation Logic**
   - **File:** `apps/backend/src/invoices/domain/invoice-validator.ts` [NEW]
   - **Methods to Move:**
     - `validateAmounts(amount, downPaymentIdr, items)`: Checks that subtotal matches total amount, and downPaymentIdr does not exceed the total amount.
     - `validateItems(items)`: Checks descriptions, pax (>0), currencies, and line total math accuracy.
     - `validatePayments(payments)`: Validates format and matches payment histories.
     - `validateInvoicePayloadInvariants(payload)`: Combined validation suite run before any creation or update operations.
   - **Dependency:** No database dependency. Pure TypeScript functions.

2. **Extract Number Generation Logic**
   - **File:** `apps/backend/src/invoices/domain/invoice-number-generator.ts` [NEW]
   - **Methods to Move:**
     - `extractInvoiceSerial(invoiceNumber)`: Extracts sequential ID from format `GTT/INV/YYYY/XXXX`.
     - `buildInvoiceNumber(year, serial)`: Formats number to pad serial digits.
     - `extractYearFromIsoDate(isoDate)`: Helper for segmenting sequences by year.
     - `resolveNextSerial(lastInvoiceNumber)`: Resolves next numeric counter.
     - `generateNextInvoiceNumberWithPrisma(prismaTx, issuedDateIso)`: Executes a locked transaction/findFirst select to retrieve the highest serial of the year, with sequential retry/fallback mechanisms.

3. **Create InvoiceQueryService**
   - **File:** `apps/backend/src/invoices/application/invoice-query.service.ts` [NEW]
   - **Class Declaration:**
     ```typescript
     @Injectable()
     export class InvoiceQueryService {
       constructor(
         @Inject(PrismaService) private readonly prisma: PrismaService,
         private readonly configService?: ConfigService
       ) {}
       // ... methods
     }
     ```
   - **Methods to Move:**
     - `findAll()`, `findAllWithPrisma()`, `findAllFromMemory()`
     - `findAllPaginated()`, `findAllWithPrismaPaginated()`, `findAllFromMemoryPaginated()`
     - `listClients()`, `listClientsWithPrisma()`, `listClientsFromMemory()`
     - Helpers: `mapPrismaInvoiceToListItem()`, `mapMemoryInvoiceToListItem()`, `resolvePrismaInvoiceInlineDownPayment()`, `ensurePrismaInvoiceDownPaymentColumn()`, `ensurePrismaInvoiceRecipientNameColumn()`

4. **Create InvoiceCommandService**
   - **File:** `apps/backend/src/invoices/application/invoice-command.service.ts` [NEW]
   - **Class Declaration:**
     ```typescript
     @Injectable()
     export class InvoiceCommandService {
       constructor(
         @Inject(PrismaService) private readonly prisma: PrismaService,
         private readonly validator: InvoiceValidator,
         private readonly generator: InvoiceNumberGenerator,
         private readonly configService?: ConfigService
       ) {}
       // ... methods
     }
     ```
   - **Methods to Move:**
     - `create()`, `createWithPrisma()`, `createInMemory()`
     - `update()`, `updateWithPrisma()`, `updateInMemory()`
     - `backfillLegacyItems()`

5. **Refactor InvoicesService into Facade**
   - **File:** `apps/backend/src/invoices/invoices.service.ts` [MODIFY]
   - **Changes:**
     - Inject `InvoiceQueryService` and `InvoiceCommandService`.
     - Delegate all existing public methods (`findAll`, `findAllPaginated`, `listClients`, `create`, `update`, `backfillLegacyItems`) to the respective services.
     - Maintain public method signatures exactly so that the REST controller (`InvoicesController`) and existing unit/integration tests do not break.

6. **Update Module Registration**
   - **File:** `apps/backend/src/invoices/invoices.module.ts` [MODIFY]
   - Add `InvoiceValidator`, `InvoiceNumberGenerator`, `InvoiceQueryService`, and `InvoiceCommandService` to the `providers` and `exports` arrays.

7. **Create Specific Test Suites**
   - **Files:** `apps/backend/src/invoices/domain/invoice-validator.test.ts` [NEW], `invoice-number-generator.test.ts` [NEW], `invoice-query.service.test.ts` [NEW], `invoice-command.service.test.ts` [NEW]
   - Move relevant test cases from `invoices.service.test.ts` to their new files to keep test coverage localized.

**Success Criteria:**
- [ ] Each file is decomposed, ensuring no single file exceeds 500 lines.
- [ ] Clear division between reads, writes, validation, and generation.
- [ ] Backward-compatibility is preserved and all existing tests pass.

---

#### Task 3.2: Decompose groups-command.service.ts (1,427 lines)

**Effort:** L (12-16 hours)  
**Dependencies:** None  
**Risk:** High coupling in transaction logics  
**Reference Document:** `docs/roadmap/evolusi-arsitektur-domain-group.md`

**Detailed Execution Steps:**

1. **Extract Bounded Context Services (Logical Separation)**
   - Decompose the giant monolith `groups-command.service.ts` into individual sub-domain services:
     - `GroupOperationalCommandService` (`apps/backend/src/groups/application/group-operational-command.service.ts` [NEW]): Manages operational journey data: itinerary schedule, travel timings, bus count rules, check-in checklists, and timeline updates.
     - `GroupVisaCommandService` (`apps/backend/src/groups/application/group-visa-command.service.ts` [NEW]): Manages passport entries validations, visa setup configuration, raudhah slot appointments, and hotel agreements.
     - `GroupTransportationCommandService` (`apps/backend/src/groups/application/group-transportation-command.service.ts` [NEW]): Manages drivers assign/reset events and syarikah transportation supplier assignments.
   
2. **Implement GroupWorkflowOrchestrator**
   - **File:** `apps/backend/src/groups/application/group-workflow-orchestrator.ts` [NEW]
   - Orchestrates multi-domain command execution. For example, during group creation, it coordinates:
     - Saving the core Group record.
     - Initializing the Visa Setup record in the Visa Domain.
     - Dispatching notification events to the Notification Domain.
     - Initializing timeline items and logs.

3. **Refactor GroupsCommandService as Facade**
   - **File:** `apps/backend/src/groups/application/groups-command.service.ts` [MODIFY]
   - Inject the newly created domain command services (`GroupOperationalCommandService`, `GroupVisaCommandService`, `GroupTransportationCommandService`) and `GroupWorkflowOrchestrator`.
   - Refactor all command methods to delegate to these services.
   - Maintain method signatures exactly to avoid breaking controller routes and tests.

4. **Split Integration and Unit Tests**
   - Extract tests related to visa setups, itinerary actions, and driver checklists into respective domain test files (`group-operational.test.ts`, `group-visa.test.ts`, `group-transportation.test.ts`).

**Success Criteria:**
- [ ] `groups-command.service.ts` is under 400 lines (facade only).
- [ ] Logically isolated domains with zero circular dependency between them.
- [ ] All tests pass in both Prisma and Memory modes.

---

#### Task 3.3: Decompose invoice-page.tsx (2,066 lines)

**Effort:** L (12-16 hours)  
**Dependencies:** None  
**Risk:** Prop-drilling of react-hook-form handles

**Target Analysis:**
- *Clarification:* The invoice list dashboard is rendered in [invoice-list-page.tsx](file:///c:/vibe%20coding/apps/frontend/src/pages/invoice-list-page.tsx). The file [invoice-page.tsx](file:///c:/vibe%20coding/apps/frontend/src/pages/invoice-page.tsx) is dedicated to the invoice editor workspace (creating/editing drafts).
- Decomposing this file requires extracting sub-forms and layout sections.

**Detailed Execution Steps:**

1. **Create Sub-Components under `apps/frontend/src/pages/invoice/`**
   - `InvoiceFormHeader.tsx` [NEW]: Displays title, metadata (e.g. invoice number), status badge, and control buttons (Save Draft, Print PDF, Delete).
   - `InvoiceClientSelection.tsx` [NEW]: Dropdown selector for clients, matching suggestions, and handling the "Manual Client" input fields when selected.
   - `InvoiceLineItemsTable.tsx` [NEW]: Renders tabular entry for line items using react-hook-form's `useFieldArray`. Handles item rows, description, pax, unit price, and currency selection (IDR, USD, SAR).
   - `InvoiceSummaryCard.tsx` [NEW]: Shows subtotal, exchange rate calculations, down payment adjustments, and final outstanding balance display.
   - `InvoiceNotesSection.tsx` [NEW]: Inputs for recipient name, notes, and remarks.

2. **Extract Form Controller and Calculations Hook**
   - **File:** `apps/frontend/src/pages/invoice/hooks/use-invoice-workspace-form.ts` [NEW]
   - Encapsulates:
     - Form setup: `useForm` initialization with zod validation resolver.
     - Calculations: watch functions for item lists, calculating totals, converting foreign currencies to IDR based on line-item exchange rates.
     - Actions: save/submit mutation handling and success callbacks.

3. **Refactor invoice-page.tsx**
   - Wrap the dashboard/editor in `<FormProvider>` to make form state accessible via `useFormContext` to all children.
   - Import and arrange the smaller, focused sub-components.

**Success Criteria:**
- [ ] `invoice-page.tsx` is under 400 lines.
- [ ] Custom hook `useInvoiceWorkspaceForm` encapsulates form calculations and state.
- [ ] Components are easy to maintain and test individually.

---

#### Task 3.4: Decompose group-detail-page.tsx (1,981 lines)

**Effort:** L (12-16 hours)  
**Dependencies:** None  
**Risk:** Broken page transitions or tabs state

**Detailed Execution Steps:**

1. **Define GroupDetailContext**
   - **File:** `apps/frontend/src/pages/group-detail/group-detail-context.tsx` [NEW]
   - Share group state (`groupData`), configuration options, current active tab, and query mutation functions down the component tree without prop drilling.

2. **Extract Layout Tabs under `apps/frontend/src/pages/group-detail/components/`**
   - `GroupDetailHeader.tsx` [NEW]: Header actions, status indicator, summary stats (e.g., total pax, active timeline items).
   - `GroupTimelineTab.tsx` [NEW]: List of audit log records and timeline events.
   - `GroupItineraryTab.tsx` [NEW]: Renders itinerary calendar list, transit schedules, and bus capacity planners.
   - `GroupChecklistTab.tsx` [NEW]: Checklist assignments panel with search filter and driver selection widgets.
   - `GroupVisaTab.tsx` [NEW]: Hotel agreements tables and Raudhah slot bookings grids.

3. **Clean up group-detail-page.tsx**
   - Refactor file to only manage URL query parsing, group queries, context provider wrapping, and tab navigation layout.

**Success Criteria:**
- [ ] `group-detail-page.tsx` is under 450 lines.
- [ ] Clear component structure with one file per tab.

---

#### Task 3.5: Implement Repository Pattern

**Effort:** XL (30-40 hours)  
**Dependencies:** Should be done after Task 3.1 and 3.2  
**Risk:** Dynamic dependency injection setup errors

**Detailed Execution Steps:**

1. **Define Common Interfaces**
   - Create `apps/backend/src/domain/repositories/`
     - `invoice.repository.interface.ts` [NEW]
     - `group.repository.interface.ts` [NEW]
     - `auth-user.repository.interface.ts` [NEW]

2. **Implement Data-Source Specific Classes**
   - Create `apps/backend/src/infrastructure/repositories/prisma/`
     - Prisma implementation for each interface injecting `PrismaService`.
   - Create `apps/backend/src/infrastructure/repositories/memory/`
     - In-memory mock implementation for unit testing.

3. **Dynamic Provider Registration**
   - **File:** `apps/backend/src/infrastructure/repositories/repositories.module.ts` [NEW]
   - Define dynamic providers using factories:
     ```typescript
     {
       provide: 'InvoiceRepository',
       useFactory: (prisma: PrismaService, config: ConfigService) => {
         const source = resolveConfiguredDataSource(config);
         return source === 'prisma' 
           ? new PrismaInvoiceRepository(prisma) 
           : new MemoryInvoiceRepository();
       },
       inject: [PrismaService, ConfigService]
     }
     ```

4. **Refactor Application Services**
   - Remove `resolveConfiguredDataSource` and `if (this.dataSource === "prisma")` branches.
   - Inject `@Inject('InvoiceRepository') private readonly invoiceRepo: InvoiceRepository`.
   - Call unified repository methods directly.

**Success Criteria:**
- [ ] Zero references to `dataSource === "prisma"` inside application services.
- [ ] Test suite runs seamlessly in both `prisma` and `memory` modes.
- [ ] Easy to add new data source (e.g., MongoDB)
- [ ] All tests pass

---

### Phase 4: Testing Improvements (ongoing)

**Timeline:** Week 4+ (parallel dengan Phase 3)  
**Priority:** High  
**Risk Level:** Low

#### Task 4.1: Add Controller Tests

**Effort:** 10-15 hours  
**Current Coverage:** 0%

**Files to create:**
- `apps/backend/src/invoices/invoices.controller.test.ts` (NEW)
- `apps/backend/src/groups/http/groups.controller.test.ts` (NEW)
- `apps/backend/src/auth/auth.controller.test.ts` (NEW)

**Test coverage:**
- Each endpoint dengan mocked services
- Request validation
- Error handling

**Success Criteria:**
- [ ] Controller coverage >80%

---

#### Task 4.2: Add DTO Validation Tests

**Effort:** 5-10 hours  
**Current Coverage:** 0%

**Files to create:**
- `apps/backend/src/invoices/dto/create-invoice.dto.test.ts` (NEW)
- `apps/backend/src/invoices/dto/update-invoice.dto.test.ts` (NEW)
- `apps/backend/src/groups/dto/create-group.dto.test.ts` (NEW)
- etc.

**Test coverage:**
- Each validation rule
- Edge cases

**Success Criteria:**
- [ ] DTO coverage >90%

---

#### Task 4.3: Increase invoices.service.ts Coverage

**Effort:** 5-10 hours  
**Current Coverage:** 69.34%  
**Target:** 80%

**File:** `apps/backend/src/invoices/invoices.service.test.ts`

**Add tests for:**
- Error handling paths
- Edge cases in validation
- Memory vs Prisma paths

**Success Criteria:**
- [ ] Coverage >80%

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking API consumers dengan pagination | High | High | Version endpoint, deprecation warnings |
| Password policy locks out users | Medium | High | Enforce only on password change |
| Refactoring introduces bugs | High | High | Extensive testing, feature flags |
| Index creation locks production DB | Low | High | Use CONCURRENTLY, off-peak hours |
| Dependency updates break functionality | Medium | Medium | Test thoroughly, review changelogs |
| Large PRs hard to review | High | Medium | Break into smaller PRs, clear documentation |
| Frontend bundle size increases | Low | Medium | Monitor bundle size, lazy loading |
| Test suite becomes slow | Medium | Low | Parallelize tests, use test database |

---

## Success Metrics

### Phase 1 Complete (Security)
- [ ] 0 high/critical vulnerabilities in `npm audit`
- [ ] Password policy enforced (12+ chars, complexity)
- [ ] Request body size limited to 1MB
- [ ] All security tests pass

### Phase 2 Complete (Performance)
- [ ] Invoices endpoint paginated (default 20, max 100)
- [ ] 3 composite indexes created
- [ ] Query performance improved by 50%+ (measure dengan EXPLAIN)
- [ ] Shadow verification disabled in production

### Phase 3 Complete (Architecture)
- [ ] invoices.service.ts <500 lines (split into 4 services)
- [ ] groups-command.service.ts <700 lines
- [ ] invoice-page.tsx <500 lines
- [ ] group-detail-page.tsx <500 lines
- [ ] Repository pattern implemented untuk Invoice domain
- [ ] No `dataSource === "prisma"` in services (only in repositories)

### Phase 4 Complete (Testing)
- [ ] Controller coverage >80%
- [ ] DTO coverage >90%
- [ ] invoices.service.ts coverage >80%
- [ ] All critical paths have 100% coverage

---

## Execution Timeline

### Week 1: Security + Performance

**Day 1-2: Phase 1 (Security)**
- Task 1.1: Fix vulnerable dependencies (4-6h)
- Task 1.2: Strengthen password policy (8-12h)
- Task 1.3: Add request body size limits (1-2h)

**Day 3-5: Phase 2 (Performance)**
- Task 2.1: Add pagination ke invoices endpoint (10-14h)
- Task 2.2: Add missing database indexes (4-6h)
- Task 2.3: Remove shadow verification (1-2h)

### Week 2-3: Architecture Refactoring

**Week 2: Invoice Service Decomposition**
- Task 3.1: Decompose invoices.service.ts (20-30h)
  - Day 1-2: Extract validation dan number generation
  - Day 3-4: Create InvoiceQueryService
  - Day 5: Create InvoiceCommandService

**Week 3: Other Decompositions**
- Task 3.2: Decompose groups-command.service.ts (12-16h)
- Task 3.3: Decompose invoice-page.tsx (12-16h)
- Task 3.4: Decompose group-detail-page.tsx (12-16h)

### Week 4: Repository Pattern + Testing

**Task 3.5: Repository Pattern** (30-40h)
- Start dengan Invoice domain
- Incrementally apply to other domains

**Task 4: Testing Improvements** (ongoing, parallel)
- Controller tests (10-15h)
- DTO tests (5-10h)
- invoices.service.ts coverage (5-10h)

### Post-Week 4
- Complete repository pattern untuk remaining domains
- Continue testing improvements
- Monitor dan optimize

---

## 📝 Notes

### Why No Existing Roadmap?

Group module memiliki ZERO roadmap markers (TODO, FIXME, dll). Ini berarti:

1. **Code dianggap production-ready** tanpa known issues
2. **Technical debt tracking** kemungkinan di luar codebase
3. **Review findings adalah fresh insights**, bukan konfirmasi dari planned work

**Recommendations:**
- Create issue tracker tickets untuk review findings
- Add ADRs (Architecture Decision Records) untuk future decisions
- Use TODO comments sparingly untuk track technical debt

### Dependency Graph

```
Phase 1 (Security):
  #1 Dependencies ──────────────┐
  #2 Password Policy ───────────┼── Can be parallel
  #3 Body Size Limits ──────────┘

Phase 2 (Performance):
  #4 Pagination ────────────────┐
  #5 Indexes ───────────────────┼── Can be parallel (indexes help pagination)
  #6 Shadow Verification ───────┘

Phase 3 (Architecture):
  #7A Invoice Service ─────┐
  #7B Groups Service ──────┼── Can be parallel
  #7C Invoice Page ────────┤
  #7D Group Detail Page ───┘
  #8 Repository Pattern ────── After #7A and #7B

Phase 4 (Testing):
  #9 Test Coverage ──────────── Ongoing, parallel with Phase 3
```

---

## 🚀 Getting Started

Ready to start? Here's the recommended order:

1. **Start Phase 1** (Security) - Quick wins, 1-2 hari
2. **Track progress** di issue tracker
3. **Create ADRs** untuk document decisions
4. **Add TODO comments** untuk future improvements

**First action:**
```bash
cd "c:/vibe coding"
npm audit
```

Review hasil audit dan proceed dengan Task 1.1.

---

**Last Updated:** 2026-07-05  
**Generated by:** Claude Code (Multi-agent review)
