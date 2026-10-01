---
name: GTT Operations
description: A shared operational interface with green light mode and charcoal-gold dark mode for Ops and Agent workspaces.
colors:
  primary: "rgb(var(--color-primary))"
  primary-container: "rgb(var(--color-primary-container))"
  on-primary: "rgb(var(--color-on-primary))"
  background: "rgb(var(--color-background))"
  background-deep: "rgb(var(--color-background-deep))"
  app-ground: "rgb(var(--serene-app-background))"
  surface: "rgb(var(--color-surface))"
  surface-container-low: "rgb(var(--color-surface-container-low))"
  surface-container-lowest: "rgb(var(--color-surface-container-lowest))"
  surface-container-high: "rgb(var(--color-surface-container-high))"
  surface-container-highest: "rgb(var(--color-surface-container-highest))"
  text-primary: "rgb(var(--color-text-primary))"
  text-secondary: "rgb(var(--color-text-secondary))"
  outline-variant: "rgb(var(--color-outline-variant))"
  primary-fixed: "rgb(var(--color-primary-fixed))"
  on-primary-fixed-variant: "rgb(var(--color-on-primary-fixed-variant))"
  tertiary-fixed: "rgb(var(--color-tertiary-fixed))"
  on-tertiary-fixed-variant: "rgb(var(--color-on-tertiary-fixed-variant))"
  error-container: "rgb(var(--color-error-container))"
  on-error-container: "rgb(var(--color-on-error-container))"
  approved-bg: "rgb(var(--color-emerald-100))"
  approved-text: "rgb(var(--color-emerald-800))"
  waiting-bg: "rgb(var(--color-amber-100))"
  waiting-text: "rgb(var(--color-amber-800))"
  rejected-bg: "rgb(var(--color-rose-100))"
  rejected-text: "rgb(var(--color-rose-800))"
  field-background: "rgb(var(--serene-field-background))"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 800
    lineHeight: "2.5rem"
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: "1.75rem"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: "1.25rem"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: "8px"
  md: "12px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  section: "20px"
  3xl: "24px"
  pill: "9999px"
spacing:
  1: "4px"
  2: "8px"
  3: "12px"
  4: "16px"
  5: "20px"
  6: "24px"
  8: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-secondary:
    backgroundColor: "var(--serene-btn-secondary-background)"
    textColor: "var(--serene-btn-secondary-text)"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  button-danger:
    backgroundColor: "{colors.error-container}"
    textColor: "{colors.on-error-container}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "44px"
  field:
    backgroundColor: "{colors.field-background}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.2xl}"
  section:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.section}"
    padding: "20px"
  command-bench:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.2xl}"
    padding: "12px"
  operational-list:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.2xl}"
  approval-status:
    backgroundColor: "{colors.approved-bg}"
    textColor: "{colors.approved-text}"
    rounded: "{rounded.lg}"
    padding: "4px 32px 4px 10px"
  assignment-badge:
    backgroundColor: "{colors.tertiary-fixed}"
    textColor: "{colors.on-tertiary-fixed-variant}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  active-navigation:
    backgroundColor: "{colors.surface-container-lowest}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: "14px 16px"
  modal:
    backgroundColor: "var(--serene-floating-surface)"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.3xl}"
---

# Design System: GTT Operations

## Overview

**Creative North Star: "The Calm Command Bench"**

GTT uses a shared visual system for the internal Ops dashboard and Agent workspace. Dense travel data sits in rounded work surfaces with compact typography, visible state labels, and actions close to their records. Light mode uses cool green-gray ground, white work surfaces, and deep green actions. Dark mode uses charcoal layers, warm neutral text, and muted gold actions; it is a distinct token mapping rather than a darkened green palette.

**Evidence and scope.** Refreshed on 2026-10-01 against the checked-out frontend implementation at `0380cf1`. Sources are `src/styles.css`, `tailwind.config.cjs`, `public/fonts.css`, `src/theme/theme-mode.ts`, shared components in `src/components/`, and `src/agent/agent-shell.tsx`. Existing review captures are supporting references; current source takes precedence where captures or earlier briefs differ. Live production deployment parity has not been independently verified in this refresh.

The frontmatter binds to the application's CSS custom properties so it follows the selected theme. Load the compiled frontend CSS when consuming these tokens; a standalone document renderer needs the same properties. Full gradients, shadows, state treatments, motion, and preview snippets are recorded in `.impeccable/design.json`.

**Key Characteristics:**

- One shared token system, with separate Ops and Agent navigation compositions.
- Rounded cards, tonal layering, compact labels, and task-oriented controls.
- Manrope headings, Inter interface text, and locally hosted Material Symbols Outlined.
- Semantic status hues remain distinct from the active theme's primary accent.
- Surface-specific layouts stay local: Agreement Inbox uses a queue, while Master Data uses a composer and preview workspace.

## Colors

Colors come from theme-aware CSS variables. Tailwind's semantic colors and its slate, emerald, amber, sky, violet, and rose scales resolve through these variables; the scale names do not imply Tailwind's stock palette.

### Primary

Deep green drives light-mode actions and selection; muted gold serves the same role in dark mode. Primary buttons use `--serene-btn-primary-bg` and its hover counterpart: solid green in light mode, a gold gradient in dark mode. The frontmatter's primary color is the accent primitive, not a substitute for that complete button background.

### Secondary

Green-gray supporting text becomes warm beige in dark mode. Informational sky chips use a muted teal family, while violet is available for domain-specific states. These are supporting semantic accents rather than additional primary actions.

### Tertiary

Agreement approval uses explicit emerald, amber, and rose pairs. Shared `Badge` success, warning, and error variants instead use primary-fixed, tertiary-fixed, and error-container pairs. The shared warning chip is rose-toned in light mode; do not assume every warning uses the agreement's amber pair.

**The Status Pair Rule.** Every status includes readable text. Preserve each component's actual semantic mapping when changing themes.

### Neutral

Resolved core values from the current CSS are shown below. `surface` and `surface-container-lowest` are separate roles even when their dark values coincide.

| Role                      | Light                                 | Dark                                 |
| ------------------------- | ------------------------------------- | ------------------------------------ |
| Primary                   | `rgb(35 116 49)`                      | `rgb(212 180 116)`                   |
| Primary container         | `rgb(46 133 64)`                      | `rgb(181 150 82)`                    |
| On primary                | `rgb(255 255 255)`                    | `rgb(60 47 0)`                       |
| Background                | `rgb(244 247 245)`                    | `rgb(19 19 19)`                      |
| Background deep           | `rgb(237 242 238)`                    | `rgb(14 14 14)`                      |
| App ground                | `rgb(244 247 245)`                    | `rgb(14 14 14)`                      |
| Surface                   | `rgb(251 252 251)`                    | `rgb(32 31 31)`                      |
| Surface container lowest  | `rgb(255 255 255)`                    | `rgb(32 31 31)`                      |
| Surface container low     | `rgb(245 248 246)`                    | `rgb(19 19 19)`                      |
| Surface container high    | `rgb(234 243 236)`                    | `rgb(42 42 42)`                      |
| Surface container highest | `rgb(223 236 227)`                    | `rgb(53 53 52)`                      |
| Primary text              | `rgb(21 24 20)`                       | `rgb(229 226 225)`                   |
| Secondary text            | `rgb(74 84 77)`                       | `rgb(208 197 175)`                   |
| Outline                   | `rgb(164 177 168)`                    | `rgb(77 70 53)`                      |
| Field background          | `rgb(249 252 250)`                    | `rgb(53 53 52)`                      |
| Approved fill / text      | `rgb(214 239 217)` / `rgb(37 89 54)`  | `rgb(32 46 37)` / `rgb(198 218 202)` |
| Waiting fill / text       | `rgb(249 231 188)` / `rgb(95 69 21)`  | `rgb(49 40 26)` / `rgb(234 213 170)` |
| Rejected fill / text      | `rgb(247 221 225)` / `rgb(101 40 49)` | `rgb(49 34 37)` / `rgb(235 192 198)` |

Dark accent scales invert and desaturate: low-number shades become dark tinted fills and high-number shades become readable light text. `--color-white` also changes with theme; use the intended semantic foreground instead of assuming it remains literal white.

**The Theme Binding Rule.** Use semantic utilities or existing CSS variables. Theme selection is applied as `data-theme` on the document root, stored under `serene-ui-theme`, and initially falls back to the system preference when no valid saved choice exists.

## Typography

**Display Font:** Manrope, sans-serif. **Body Font:** Inter, sans-serif. **Brand Fonts:** Sora is registered and available through the brand utility; the sidebar GTT wordmark uses Noto Naskh Arabic, serif. **Icon Font:** Material Symbols Outlined.

Fonts are self-hosted in `public/fonts.css`: Inter supplies weights 400–700, Manrope 400–800, Sora 700–800, and Noto Naskh Arabic 400–700. Some existing pages request 900 or Inter 800 through utilities, which exceed the shipped font ranges; do not document those requests as distinct supplied font weights.

- **Display:** Shared `PageHeader` title at 36px from `sm`, weight 800, tight tracking and 40px line-height.
- **Headline:** The same title at 30px below `sm`; the detail variant uses 32px from `sm`.
- **Title:** Common section headings at 18px, weight 800; individual sections also use 16–20px.
- **Body:** Common controls and data at 14px; descriptions can step up to 16px and use relaxed line-height. Weight varies with purpose rather than being globally fixed.
- **Label:** Compact metadata at 10–12px. Uppercase structural labels use deliberate tracking, typically 0.08–0.18em.

**The Workhorse Hierarchy Rule.** Establish hierarchy through weight, size, and spacing. Preserve tabular figures for scan-critical counts and capacities where implemented. Existing page-specific headings, including Master Data and Agent detail screens, need not use the shared hero size.

## Layout

Ops and Agent desktop rails appear at `xl` (1280px), with an expanded width of 280px or a collapsed width of 104px. The main content margin follows the rail. Below `xl`, bottom navigation replaces the rail, including on tablets; its safe-area inset and content clearance must remain intact.

`PageLayout` centers full-width content with maximum widths of 80rem (standard), 88rem (wide/detail), or 96rem (workspace). It uses horizontal padding of 16px, 24px from `sm`, and 32px from `lg`, with 20px vertical gaps increasing to 24px from `sm`. Some older and custom screens retain their own containers. Tailwind breakpoints are `sm` 640px, `md` 768px, `lg` 1024px, `xl` 1280px, and `2xl` 1536px.

Ops bottom navigation uses five slots, including a central Tools action. Agent bottom navigation uses a three-column grid for Dashboard, Visa Tracking, and Perjalanan, filtered by permissions; profile access is a separate floating action. Both use a rounded, translucent floating bar. A floating theme toggle sits near the upper-right edge; shared page toolbars reserve room for it.

**Surface patterns:**

- **Agreement Inbox:** A search/filter Command Bench stacks below `xl`, then becomes one horizontal grid. The operational list switches from individual bordered mobile rows to an aligned desktop list at `lg`; linked groups expand beneath the parent. Approval and action controls are 44px on narrow screens and may reduce to 36px at `xl`. New Draft retains a minimum height of 52px.
- **Master Data:** List/create mode selection and a category selector precede the workspace. The create/edit composer and preview/checks/recent-data column split at `lg`, then stack on smaller screens. Category-specific forms keep their existing action placement.
- **Agent and travel details:** Summary cards, resource sections, tabs, and timelines use the shared palette without inheriting the Agreement queue's composition. Existing summary and statistic cards are valid system components.

## Elevation & Depth

Light mode combines one-pixel translucent rules with soft shadows. Dark mode emphasizes tonal steps and subtle gradients: shared frame borders become zero-width where `--serene-frame-border-width` is used, while explicitly bordered components retain their own rules. It also uses stronger black shadows; dark mode is not uniformly flat or borderless.

### Shadow Vocabulary

- **Ambient:** Light `0 18px 30px -18px rgba(27, 26, 23, 0.14)` for resting surfaces.
- **Float:** Light `0 30px 44px -20px rgba(27, 26, 23, 0.16)` for transient layers.
- **CTA Soft:** Light `0 16px 24px -18px rgba(13, 99, 27, 0.68)` beneath primary actions.
- **Dark:** All three semantic shadow roles resolve to `0 12px 40px rgba(0, 0, 0, 0.6)`.

Dark shared cards use a subtle 160-degree surface gradient and primary buttons use a 135-degree gold gradient. Floating navigation and theme actions use the existing 12px backdrop blur; it is not a blanket treatment for data surfaces. Modal overlays use opacity 0.28 in light mode and 0.52 in dark mode.

## Shapes

Rounded rectangles dominate. Tailwind overrides `rounded-sm` to 8px and `rounded-md` to 12px; the default `rounded-lg` remains 8px and `rounded-xl` remains 12px. Radius names therefore are not a strictly increasing custom scale. Cards and form sections commonly use 16px, the later global `.serene-section` rule resolves to 20px, and modal/table shells use 24px. The floating navigation bar uses 1.7rem.

Full-round silhouettes belong to navigation rows, chips, avatars, progress rails, and circular actions. Work surfaces retain rectangular structure. Preserve page-specific radii and explicit separators rather than assigning one radius or border treatment to every container.

## Components

### Buttons

Shared `Button` exposes primary, secondary, tertiary, and danger variants. Sizes are small (32px high, 12px horizontal padding, 8px corners), medium (44px, 16px padding, 12px corners), and large (48px, 24px padding, 12px corners). Labels are semibold at 12px, 14px, and 16px respectively. Direct CSS button primitives also supply 8px vertical padding; callers can override sizes.

Primary uses the theme's complete button background and on-primary text. Secondary is white with a green-tinted border in light mode, transparent with warm text in dark mode. Tertiary is transparent with primary text. Danger uses the error-container pair. Primary and secondary hover lift by 1px; shared buttons apply active scale 0.99 and disabled opacity 0.45. The shared focus-visible outline is 2px primary with a 2px offset.

### Chips and Status Controls

Shared badges are fully rounded with 12px semibold labels. Success uses primary-fixed; warning uses tertiary-fixed; error uses error-container; info uses the sky scale; neutral uses slate. Agreement approval remains a labeled select with emerald/amber/rose pairs and 8px corners. Assignment badges follow their own mapping: Assigned is success, Partially Assigned is info, and Unassigned is warning.

### Cards / Containers

Shared cards use 16px corners, lowest-container fill, and ambient shadow; sections, table shells, form sections, statistic cards, summary strips, and empty states have their own padding and depth. Dark gradients apply only to components that consume `--serene-card-gradient`. Interactive cards lift by 2px over 300ms. Empty states use a dashed outline and a written explanation.

### Inputs / Fields

Standard inputs/selects are 44px high with 12px corners and 12px horizontal padding. Input sizes also include 32px and 48px. Textareas share the field treatment. Light mode uses a near-white fill, one-pixel borders, and a two-pixel soft focus halo. Dark mode uses a charcoal fill, zero-width outer border, a two-pixel bottom border, and no focus halo. Both emphasize the bottom border with primary color on focus; hover and disabled fills come from field tokens. Search bars and compact status selects are distinct variants with their own geometry.

### Navigation and Page Headers

Rails use low-container ground, pill-shaped active items, lowest-container selection fill, primary-colored icons/text, and muted inactive items. Collapsed targets are 56px squares. The Ops rail includes Tools and Add New Group; the Agent rail has permission-filtered navigation and an agent identity card. Shared `PageHeader` supports hero, compact, and detail variants, with an optional toolbar and actions that wrap on narrow screens.

### Operational Lists and Accordions

Agreement rows show identity, agreement number, dates, capacity, approval, assignment, and actions. Remaining capacity combines exact numbers with a progress rail whose color follows primary. Editing and expansion are direct actions; Delete draft is in a `more_vert` menu and disabled for assigned drafts. Linked records and assignment controls expand within the queue. Preserve this implemented action grouping.

Native accordions hide the default marker, rotate their chevron, and reveal content over 240ms. Routine transitions run around 150–300ms; capacity width uses 500ms. Modal fade-in uses 220ms and zoom-in 240ms. The global reduced-motion rule reduces animations and transitions to 0.01ms and disables smooth scrolling.

### Dialogs and Icons

Dialogs use a rounded 24px floating shell, semantic overlay, contextual title/body, and responsive footer actions. Existing focus-trap and dismissal helpers remain part of dialog behavior. Material Symbols Outlined supplies interface icons, normally around 16–26px with a 24px default. Decorative icons are hidden from assistive technology; icon-only actions need accessible labels.

## Do's and Don'ts

### Do:

- **Do** reuse the shared theme tokens and component variants in both Ops and Agent screens.
- **Do** preserve the charcoal/gold dark-mode mapping, semantic status pairs, and theme-specific fields, gradients, and shadows.
- **Do** keep data, status text, and common actions close together; disclose supporting detail within the relevant surface.
- **Do** choose the existing page width and header variant appropriate to the task.
- **Do** preserve responsive navigation, safe-area clearance, labeled controls, keyboard focus, dialog behavior, and reduced motion.
- **Do** treat Command Bench and Guided Composer as surface patterns rather than mandatory layouts for every page.

### Don't:

- **Don't** hardcode light-only green, white, or stock Tailwind status colors into shared components.
- **Don't** replace the supplied theme treatment with a uniform border, shadow, radius, or gradient rule.
- **Don't** infer global bans on KPI cards, filters, overflow actions, or large modal radii from Agreement Inbox's local brief.
- **Don't** assume Ops and Agent have the same mobile navigation items or that desktop navigation begins at `lg`.
- **Don't** use color alone for status or rely on an unlabeled icon for an action.
- **Don't** treat historical mockups, screenshots, or roadmap concepts as evidence that a layout is currently deployed.
