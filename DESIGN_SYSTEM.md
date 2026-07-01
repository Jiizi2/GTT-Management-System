# GTT Serene Design System Guidelines

Welcome to the **Ghaniya Tour and Travel (GTT) Serene Design System**. This document outlines our standard design tokens, component APIs, accessibility patterns, and visual rules to ensure UI consistency across both Light and Dark modes.

---

## 1. Color Palette & Dark Mode Tokens

GTT uses custom CSS variables formatted for Tailwind integration (`rgb(var(--color-...) / <alpha-value>)`). Never write hardcoded hex codes.

| Token | CSS Variable (Light) | CSS Variable (Dark) | Tailwind Class | Usage / Intent |
| :--- | :--- | :--- | :--- | :--- |
| **Primary** | `35 116 49` (Forest Green) | `242 202 80` (Gold Accent) | `bg-primary` / `text-primary` | Main branding CTAs, active states |
| **Secondary** | `91 111 96` (Muted Sage) | `208 197 175` (Warm Muted Gold) | `bg-secondary` / `text-secondary` | Secondary actions, text captions |
| **Tertiary (Error)**| `176 75 91` (Rose Red) | `170 159 133` (Muted Gold) | `text-error` / `bg-error` | Validation errors, delete warnings |
| **Surface** | `251 252 251` (Light Warm Green) | `32 31 31` (Dark Charcoal) | `bg-surface` | Card background, side panels |
| **Outline** | `164 177 168` (Muted border) | `77 70 53` (Dark border) | `border-slate-200` | Section dividers, input borders |

### Dark Mode Border Overrides
All border classes using `.border-slate-100`, `.border-slate-200`, `.border-slate-300`, and `.border-slate-400` are globally mapped inside `styles.css` to `var(--serene-outline) !important`. This ensures borders remain legible and maintain proper contrast on dark background panels.

---

## 2. Typography & Fonts

We consistently use a single typeface family for body/interface text and display text:

* **Variable**: `--serene-font-family`
* **Typeface**: `"Inter", sans-serif`
* **Display/Heading Typeface**: `"Manrope", sans-serif`
* **Rule**: Do not mix font packages across light/dark modes. Both themes inherit `"Inter"` as their default body font stack.

---

## 3. Reusable Atomic Components

### A. `<Button>`
**Path**: `src/components/button.tsx`

Use the `<Button>` component for all standard action triggers. It automatically includes keyboard navigation focus rings (`.serene-focus-ring`).

#### Props
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}
```

#### Sizing Matrix
* `sm`: Height `h-8` (32px) \| Padding `px-3` \| Text `text-xs` \| Radius `rounded-sm` (8px)
* `md` (Default): Height `h-11` (44px) \| Padding `px-4` \| Text `text-sm` \| Radius `rounded-md` (12px)
* `lg`: Height `h-12` (48px) \| Padding `px-6` \| Text `text-base` \| Radius `rounded-md` (12px)

---

### B. `<Badge>`
**Path**: `src/components/badge.tsx`

Use `<Badge>` for status indications, categorization tags, and pill counters.

#### Props
```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  children: React.ReactNode;
}
```

#### Status Color Mapping
* `success`: Green container (`bg-primary-fixed/20` / `text-on-primary-fixed-variant`)
* `warning`: Yellow/Gold container (`bg-tertiary-fixed` / `text-on-tertiary-fixed-variant`)
* `error`: Red container (`bg-error-container` / `text-on-error-container`)
* `info`: Blue container (`bg-sky-100` / `text-sky-800`)
* `neutral`: Slate container (`bg-slate-100` / `text-slate-800`)

---

### C. Sized Text Inputs
**Path**: Classes defined in `src/styles.css`

When configuring input fields, always append the height sizing utility class matching the layout row scale:

* **Small Inputs**: `className="serene-input serene-input-sm"`
* **Medium Inputs** (Default): `className="serene-input serene-input-md"`
* **Large Inputs**: `className="serene-input serene-input-lg"`

---

## 4. Accessibility (A11y) & Interactive Focus

All focusable elements must support standard keyboard navigation:
1. **Interactive Elements**: All custom clickable items must support focus indicators.
2. **Focus Utility Class**: Apply `.serene-focus-ring` (which defines an offset border outline in the primary brand color when focused via keyboard) on all custom clickable components:
   ```css
   .serene-focus-ring:focus-visible {
     outline: 2px solid rgb(var(--color-primary));
     outline-offset: 2px;
   }
   ```
3. **Modal Focus Trap**: All modal dialog wrappers (`.serene-modal-overlay` / `.serene-modal-shell`) must trap focus internally and release it upon close.
