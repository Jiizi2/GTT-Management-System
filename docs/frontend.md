# Dokumentasi Frontend

## Stack

- React 19 (TypeScript)
- Tailwind CSS + design tokens custom (`serene` theme)
- esbuild (bundler)
- TanStack Query (data fetching + caching)
- React Router v6 (routing)
- Vitest (unit test)
- Playwright (e2e test)

---

## Struktur Direktori

```
apps/frontend/src/
├── app.tsx                     ← Auth gate, routing top-level
├── index.tsx                   ← React entry point
├── styles.css                  ← Global CSS + design tokens
├── components/                 ← Komponen UI reusable
├── pages/                      ← Halaman per fitur
├── hooks/                      ← Hooks + business logic
│   └── app-controller/         ← Sub-hooks controller dashboard
├── shared/                     ← Domain types, utils, API client
└── theme/                      ← Theme provider dark/light mode
```

---

## Components

| File | Deskripsi |
|---|---|
| `app-main-content.tsx` | Router halaman dalam dashboard, lazy loading semua page |
| `dashboard-workspace-shell.tsx` | Shell utama: Sidebar + Main + MobileNav + SyncFeedback |
| `app-sidebar.tsx` | Sidebar navigasi desktop (collapsible) |
| `group-card.tsx` | Kartu ringkasan grup di overview |
| `group-detail-modals.tsx` | Semua modal untuk group detail (edit itinerary, visa, checklist, notes) |
| `visa-detail-modals.tsx` | Modal untuk visa detail page |
| `date-time-pickers.tsx` | Date picker dan time picker reusable |
| `serene-select.tsx` | Custom select/dropdown bertema serene |
| `pagination-controls.tsx` | Kontrol paginasi |
| `mobile-nav.tsx` | Bottom nav bar mobile |
| `mobile-quick-actions-sheet.tsx` | Bottom sheet quick actions mobile |
| `page-hero-section.tsx` | Hero section standar |
| `theme-toggle-button.tsx` | Tombol dark/light mode toggle |
| `form-accessibility.tsx` | Helper aksesibilitas form |
| `use-modal-focus-trap.ts` | Hook focus trap untuk modal |

---

## Pages

| File | Route | Deskripsi |
|---|---|---|
| `login-page.tsx` | `/login` | Halaman login |
| `overview-page.tsx` | `/overview` | Daftar grup, statistik, filter |
| `group-detail-page.tsx` | `/groups/:code` | Detail lengkap satu grup |
| `group-itinerary-builder-page.tsx` | `/itinerary-builder/:code` | Builder itinerary khusus |
| `new-group-screen.tsx` | `/new-group` | Wizard tambah grup baru |
| `add-group-workspace-page.tsx` | (dipakai dari new-group-screen) | Workspace full form tambah grup |
| `checklist-page.tsx` | `/checklist` | H-1 checklist driver/bus assignment |
| `visa-tracking-page.tsx` | `/visa` | Tabel tracking visa semua grup |
| `visa-detail-page.tsx` | `/visa/:code` | Detail visa satu grup |
| `agreement-inbox-page.tsx` | `/agreement-inbox` | Kelola hotel agreement draft |
| `invoice-list-page.tsx` | `/invoice` | Daftar invoice |
| `invoice-page.tsx` | (dipakai dari invoice-list) | Detail/edit invoice |
| `raudhah-reminder-page.tsx` | `/raudhah-reminder` | Reminder Raudhah per grup |
| `manage-role-page.tsx` | `/user-management` | CRUD user (super-admin only) |
| `master-data-page.tsx` | `/master-data` | Kelola master data (super-admin only) |
| `profile-page.tsx` | `/profile` | Profil operator |
| `placeholder-page.tsx` | (fallback) | Halaman placeholder untuk route tidak ditemukan |

### File Helper Pages

| File | Fungsi |
|---|---|
| `add-group-workspace-helpers.ts` | Helper functions untuk form workspace group baru |
| `new-group-screen-helpers.ts` | Helper untuk new group screen |
| `group-detail-export.ts` | Export PDF/data group detail |
| `invoice-export.ts` | Export invoice |
| `invoice-page-shared.ts` | Shared logic invoice (list ↔ detail) |
| `overview-export.ts` | Export overview |
| `visa-tracking-export.ts` | Export visa tracking |

---

## Hooks

### Controller Utama

| Hook | Fungsi |
|---|---|
| `hooks/use-app-controller.ts` | Menyatukan semua state dashboard |
| `hooks/use-app-controller-backend.ts` | Semua fungsi API + mapping enum frontend↔backend |
| `hooks/app-controller/use-dashboard-group-records.ts` | State dan sinkronisasi group records |
| `hooks/app-controller/use-dashboard-route-state.ts` | State routing aktif |
| `hooks/app-controller/use-dashboard-sync-feedback.ts` | Toast feedback sync (success/error) |
| `hooks/app-controller/types.ts` | TypeScript types AppController |

### Query dan Backend Hooks

| Hook | Fungsi |
|---|---|
| `use-auth-session-query.ts` | Query + mutation auth (login, logout, cek sesi) |
| `use-auth-backend.ts` | Fetch langsung endpoint auth |
| `use-groups-query.ts` | TanStack Query untuk daftar grup |
| `use-agreement-drafts-query.ts` | Query hotel agreement drafts |
| `use-invoice-backend.ts` | Fetch + mutasi invoice |
| `use-invoice-query.ts` | TanStack Query invoice |
| `use-master-data-backend.ts` | Fetch + mutasi master data |
| `use-master-data-query.ts` | TanStack Query master data |
| `use-user-management-backend.ts` | Mutasi user management (CRUD) |
| `use-user-management-query.ts` | TanStack Query user management |
| `use-saudi-city-options.ts` | Dropdown opsi kota Saudi |

---

## Shared Utilities

| File | Isi |
|---|---|
| `shared/app-domain.ts` | Semua TypeScript types domain + data contoh + helper fungsi |
| `shared/visa-domain.ts` | Domain logic visa (format tanggal, WhatsApp copy text, dll.) |
| `shared/app-route.ts` | Route builder: `buildDashboardPath`, `buildGroupDetailPath`, `buildVisaDetailPath` |
| `shared/api-client.ts` | `fetchBackend()` + `fetchBackendParsed()` — auto-clear session jika 401 |
| `shared/api-error.ts` | Parsing error dari backend response |
| `shared/auth-session.ts` | Simpan/baca snapshot sesi non-sensitif |
| `shared/backend-api-base.ts` | Resolve base URL API |
| `shared/query-keys.ts` | Semua TanStack Query keys |
| `shared/raudhah-reminder-template.ts` | Template pesan reminder Raudhah |
| `shared/session-restore.ts` | Logic restore sesi saat mount |

---

## Design System

### Sumber Kebenaran

- Token warna: CSS custom properties di `src/styles.css` (`:root` dan `[data-theme="dark"]`)
- Tailwind config: `tailwind.config.cjs`
- Primitive CSS: class `.serene-*` di `styles.css`

### Token Warna Utama

Semua menggunakan CSS variables (`--color-*`):
- **Surface**: `surface`, `surface-container-low/lowest/high/highest`, `surface-variant`
- **On-surface**: `on-surface`, `on-surface-variant`, `outline-variant`
- **Primary**: `primary`, `on-primary`, `primary-container`
- **Brand**: `brand-primary`, `brand-secondary`, `brand-tertiary`, `brand-neutral`
- **Semantic**: `error-container`, `on-error-container`

### Font Families

| Nama | Font | Kegunaan |
|---|---|---|
| `font-sans` | Inter / `--serene-font-family` | Body utama |
| `font-display` | Manrope | Heading |
| `font-brand` | Sora | Branding |

### Shadows

- `shadow-ambient` — kartu normal
- `shadow-float` — modal, sheet, floating element
- `shadow-cta-soft` — tombol primary

### Primitive CSS (`.serene-*`)

| Class | Dipakai untuk |
|---|---|
| `.serene-section` | Container section besar |
| `.serene-card` | Card default |
| `.serene-card-interactive` | Card yang bisa diklik |
| `.serene-btn-primary/secondary/tertiary` | Tombol |
| `.serene-input/select/textarea` | Input form |
| `.serene-modal-overlay/shell` | Modal |
| `.serene-chip/*` | Badge dan status chip |
| `.serene-field` | Wrapper field form |

---

## TanStack Query Keys

Semua keys terpusat di `shared/query-keys.ts`:

```ts
authQueryKeys.session
groupQueryKeys.list(projection, activeOnly)
groupQueryKeys.search(query, projection, activeOnly)
agreementDraftQueryKeys.list(query, status)
masterDataQueryKeys.options(categoryKey, includeInactive)
userManagementQueryKeys.users
invoiceQueryKeys.dashboard
```

---

## Testing

| Command | Jenis |
|---|---|
| `npm run test:unit --workspace frontend` | Unit test (Vitest) |
| `npm run test:smoke --workspace frontend` | Smoke test |
| `npm run test:e2e:frontend` | Playwright e2e (butuh backend running) |
| `npm run lint:frontend` | ESLint |
| `npm run format:check:frontend` | Prettier check |

---

## Catatan Penting

- Semua page di-lazy load via `React.lazy()` di `app-main-content.tsx`.
- `/user-management` dan `/master-data` hanya render konten untuk `super-admin`; user lain mendapat `PlaceholderScreen`.
- Fetch ke backend selalu melalui `fetchBackend()` atau `fetchBackendParsed()` — jangan pakai `fetch()` langsung.
- Mapping enum frontend ↔ backend ada di `hooks/use-app-controller-backend.ts` (fungsi `map*ToBackend` dan `mapBackend*`).
