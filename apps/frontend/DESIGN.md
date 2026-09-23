---
name: GTT Operations
description: A restrained, light operational system for clear and efficient travel administration.
colors:
  primary: "rgb(35 116 49)"
  primary-hover: "rgb(46 133 64)"
  on-primary: "rgb(255 255 255)"
  app-ground: "rgb(244 247 245)"
  surface: "rgb(255 255 255)"
  surface-soft: "rgb(245 248 246)"
  surface-raised: "rgb(234 243 236)"
  text-primary: "rgb(21 24 20)"
  text-secondary: "rgb(74 84 77)"
  outline: "rgb(164 177 168)"
  approved-bg: "rgb(214 239 217)"
  approved-text: "rgb(37 89 54)"
  waiting-bg: "rgb(249 231 188)"
  waiting-text: "rgb(95 69 21)"
  rejected-bg: "rgb(247 221 225)"
  rejected-text: "rgb(101 40 49)"
typography:
  display:
    fontFamily: "Manrope, sans-serif"
    fontSize: "2.35rem"
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Manrope, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.4
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 600
    lineHeight: 1.2
rounded:
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  pill: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
    height: "44px"
  field:
    backgroundColor: "rgb(249 252 250)"
    textColor: "{colors.text-primary}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "44px"
  command-bench:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "12px"
  operational-list:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
  approval-status:
    backgroundColor: "{colors.approved-bg}"
    textColor: "{colors.approved-text}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "6px 10px"
  assignment-badge:
    backgroundColor: "{colors.rejected-bg}"
    textColor: "{colors.rejected-text}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "2px 10px"
  active-navigation:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.primary}"
    typography: "{typography.body}"
    rounded: "{rounded.pill}"
    padding: "14px 16px"
---

# Design System: GTT Operations

## Overview

**Creative North Star: "The Calm Command Bench"**

GTT is a restrained light operational interface: cool green-gray ground supports white semantic work surfaces, charcoal information, and a deep green action voice. It is workmanlike rather than austere. Thin rules, moderate rounding, compact labels, and generous enough touch targets make dense travel-administration data feel orderly without turning it into a decorative dashboard.

The Agreement Inbox is the clearest expression of this world. Its Command Bench places search, filters, and reset in one control surface; the review queue begins immediately afterward. Status changes happen in place, capacity is both numeric and visual, and linked-group detail expands within its row so operators retain context.

**Key Characteristics:**

- Restrained light operational palette with cool green-gray ground and white semantic surfaces.
- Deep GTT green reserved for primary action, selection, focus, and capacity progress.
- Compact, workhorse typography with Manrope headings and Inter interface text.
- Thin separators and tonal layering carry structure; shadows stay soft and subordinate.
- Direct controls for frequent actions, progressive disclosure for supporting detail.
- Material Symbols Outlined provide the shared icon language.

## Colors

The palette is quiet and functional: neutral surfaces carry most of the screen while green, amber, and rose communicate action and state sparingly.

### Primary

- **GTT Deep Green:** Primary buttons, active navigation, focus accents, links, pagination selection, and capacity progress.
- **GTT Lifted Green:** Hover state for primary actions.
- **On Green:** High-contrast content placed on primary actions.

### Secondary

- **Operational Green-Gray:** Secondary copy, field icons, inactive navigation, and supporting labels.

### Tertiary

- **Waiting Amber:** Waiting-for-approval controls and cautionary state cues.
- **Rejected Rose:** Rejected status, destructive feedback, and assignment warnings.

### Neutral

- **Cool Operations Ground:** The continuous app canvas behind all work surfaces.
- **Semantic White:** Command bars, lists, cards, fields, and active navigation surfaces.
- **Soft Surface:** Expanded rows, quiet hover fills, and low-emphasis regions.
- **Raised Surface:** Stronger hover and nested-container contrast.
- **Charcoal Ink:** Titles, key values, and primary operational data.
- **Green-Gray Rule:** Borders and separators, usually rendered with reduced opacity.

### Named Rules

**The Quiet Field Rule.** Neutral surfaces occupy the interface; accent color appears only where it conveys action, selection, capacity, focus, or state.

**The Status Pair Rule.** Approval states always combine a readable label with their semantic fill and text colors; color never carries the meaning alone.

## Typography

**Display Font:** Manrope (with sans-serif fallback)  
**Body Font:** Inter (with sans-serif fallback)  
**Brand Accent Font:** Noto Naskh Arabic (GTT wordmark only)  
**Icon Font:** Material Symbols Outlined

**Character:** Manrope gives page and section headings compact authority; Inter keeps tables, controls, labels, and numeric data highly legible. The hierarchy is weight-led and economical, with tight tracking reserved for major headings and wide uppercase tracking used only for small structural labels.

### Hierarchy

- **Display** (900, 2.35rem, 1 line-height): Desktop page title; on small screens it steps down to 1.875rem.
- **Headline** (900, 1.875rem, 1.2 line-height): Compact page-level heading where the desktop display size is not available.
- **Title** (800, 1.125rem, 1.4 line-height): Section and modal titles.
- **Body** (500, 0.875rem, 1.5 line-height): Descriptions, table values, controls, and supporting content; bold and extra-bold weights mark operational values.
- **Label** (600, 0.6875rem, 1.2 line-height): Metadata labels; selected structural labels may become uppercase with 0.08–0.18em tracking.

### Named Rules

**The Workhorse Hierarchy Rule.** Establish hierarchy through weight, size, and spacing before introducing color; most text remains charcoal or green-gray.

**The Tabular Data Rule.** Agreement numbers, counts, and other scan-critical numerals use tabular figures where implemented.

## Layout

The desktop shell uses a fixed left rail at 280px, collapsing to 104px, with the work area offset to match. Page content is centered and capped at the large application widths already used by each surface; Agreement Inbox uses a 2xl maximum and 16–32px horizontal shell padding across breakpoints.

The recurring vertical rhythm is compact: 20px between the Agreement Inbox's major regions, 12–16px within control surfaces, and 16–20px within list rows. The Command Bench is a single horizontal grid at the `xl` breakpoint, led by a flexible search field and followed by assignment, agent, period, and clear controls. Below `xl`, those controls stack at full width in task order.

Operational rows become a two-column metadata grid on small screens: identity spans both columns, agreement number and stay period share the next line, capacity spans both columns, status and assignment share a line, and row actions remain grouped. Desktop restores one aligned seven-column row. Expanded linked-group content stays directly below its parent row and its assignment controls stack before becoming inline.

The mobile shell removes the fixed sidebar, reserves bottom space for the five-item floating navigation, and keeps primary actions full width. Touch controls generally remain 44px or taller; the Agreement Inbox's New Draft action is 52px tall.

### Named Rules

**The Command Bench Rule.** Search and routine filters belong in one adjacent operational surface, not in KPI cards or a detached filter panel.

**The Context-Preserving Rule.** Supporting detail expands in place beneath its source row; do not route routine inspection away from the queue.

## Elevation & Depth

The system is flat by default and uses a hybrid of tonal layering, thin translucent rules, and low ambient shadows. Resting containers use the ambient shadow (`0 18px 30px -18px rgba(27, 26, 23, 0.14)`); floating menus and dialogs use the stronger float shadow (`0 30px 44px -20px rgba(27, 26, 23, 0.16)`). Primary actions receive a compact green-tinted shadow (`0 16px 24px -18px rgba(13, 99, 27, 0.68)`).

### Shadow Vocabulary

- **Ambient:** Soft separation for cards, navigation surfaces, and resting controls.
- **Float:** Structural elevation for menus, dialogs, and temporary layers.
- **CTA Soft:** A restrained emphasis beneath primary actions.

### Named Rules

**The Surface-Before-Shadow Rule.** Use surface tone and a thin rule to establish hierarchy first; shadow only reinforces an already meaningful layer.

## Shapes

The form language uses gently rounded rectangles rather than capsules for work surfaces and controls. Compact buttons and fields use 8px corners, filters and nested items use 12px, and primary surfaces such as command bars and lists use 16px. Large modal shells may reach 24px. Pills are reserved for navigation targets, badges, progress rails, and other semantically compact elements.

Borders are one-pixel rules derived from the green-gray outline and usually softened with opacity. Progress bars, badges, and active navigation may use fully rounded silhouettes, but core data containers retain visible rectangular structure.

### Named Rules

**The Medium-Radius Rule.** Round enough to soften dense operational UI, but keep the edge geometry visible; do not turn every control or card into a pill.

## Components

### Buttons

Confident, compact, and task-oriented.

- **Shape:** Gently rounded corners (8px), with heights of 32px, 44px, or 48px by size.
- **Primary:** Deep green surface, white text, semibold label, and soft CTA shadow; the page-level New Draft action is a taller 52px expression.
- **Hover / Focus:** Hover lifts by 1px and shifts to lifted green; focus-visible uses a 2px primary outline with 2px offset; active returns to rest.
- **Secondary:** White surface, green text, thin green-tinted border, and a minimal neutral shadow.
- **Tertiary:** Transparent surface with green text and no structural decoration beyond state changes.
- **Danger:** Soft error surface with dark error text; it remains restrained rather than saturated.

### Chips

- **Style:** Fully rounded, compact labels with 10px horizontal padding and 12px semibold text.
- **State:** Approved uses green, waiting uses amber, rejected and unassigned use rose, and informational states use a muted blue-green. Every chip contains explicit text.

### Cards / Containers

- **Corner Style:** Medium rounded surfaces (16px) for command bars and operational lists; larger 24px corners for modal shells.
- **Background:** Semantic white at rest, with soft green-gray surfaces for nested and expanded regions.
- **Shadow Strategy:** Ambient at rest; float only for transient layers.
- **Border:** One-pixel, low-opacity green-gray rule.
- **Internal Padding:** Usually 12–20px, scaled by hierarchy and viewport.

### Inputs / Fields

- **Style:** 44px high, white-to-near-white fill, 8–12px corners, 12px horizontal padding, and a thin green-gray stroke.
- **Focus:** Primary-colored bottom border plus a two-pixel soft focus halo and low ambient shadow.
- **Hover / Disabled:** Hover brightens the field and strengthens the border; disabled fields move to a deeper neutral surface and reduce text contrast.

### Navigation

Desktop navigation is a fixed green-gray rail with section labels, full-round active rows, Material Symbols, and a white active surface. The rail collapses from labeled 280px navigation to 104px icon navigation. Mobile navigation becomes a five-item floating white bar with an active green icon, a faint green selection capsule, and always-visible text labels.

### Command Bench

The Command Bench is a white, 16px-radius control surface holding search and the routine filters in task order. Controls share a 44px height and 12px-radius internal silhouette. It stays horizontal only where its columns remain usable; on smaller screens each control becomes a full-width stacked row, with Clear all visually quieter than filters.

### Operational Draft Row

Each row presents identity, agreement number, stay period, remaining capacity, direct approval status, assignment status, and actions. Capacity combines an exact remaining/total count with a green progress rail. Status is an operable labeled select, not a passive dot. Only one row is expanded by default, revealing linked groups and assignment controls beneath the row on a soft tonal surface.

### Iconography & Motion

Material Symbols Outlined is the sole interface icon language. Icons typically render at 16–26px and are paired with text or accessible labels for actions. State transitions are brief (about 200–300ms); row chevrons rotate, progress width animates, and expanded content reveals with a 240ms ease-out. Reduced-motion preferences collapse animations and transitions to effectively instantaneous behavior.

## Do's and Don'ts

### Do:

- **Do** preserve the cool ground, white semantic surfaces, charcoal hierarchy, and deep-green action voice.
- **Do** keep frequent operational actions direct: approval status, edit, link, unlink, and pagination stay close to their data.
- **Do** combine text, number, icon, and color where operational state must scan quickly.
- **Do** stack Command Bench controls in task order on narrow screens and preserve the two-column mobile metadata pattern.
- **Do** use progressive row expansion for linked records and supporting detail.
- **Do** retain visible labels, semantic HTML, keyboard operation, focus states, and reduced-motion behavior.

### Don't:

- **Don't** add KPI cards above task queues when the job is search, review, and action.
- **Don't** separate routine filters into a distant or permanently expanded panel.
- **Don't** use saturated color decoratively or let status color replace a written label.
- **Don't** hide frequent actions behind overflow menus when the shipped row already exposes them directly.
- **Don't** introduce heavy shadows, glass effects, oversized radii, or display typography into dense operational content.
- **Don't** collapse mobile rows into a single unreadable column or force the desktop seven-column row to overflow horizontally.
