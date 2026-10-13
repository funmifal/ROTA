---
trigger: always_on
---

# Design System Rule

## Purpose

All UI work MUST use the project's existing design system.

The design system is defined by the generated CSS custom properties and the component primitives built around them. Do not invent a separate visual system inside individual pages or components.

The CSS token file is generated from `design-tokens.tokens.json`.

**Do NOT manually edit the generated CSS token file.** Changes to design tokens MUST be made in the source token file and regenerated.

---

## 1. Colour Tokens

Use semantic `--color-*` variables for application UI styling.

Do NOT use `--primitive-*` variables directly in component styles.

### Required colour pattern

Use semantic roles such as:

* `--color-primary`
* `--color-on-primary`
* `--color-primary-container`
* `--color-on-primary-container`
* `--color-secondary`
* `--color-on-secondary`
* `--color-secondary-container`
* `--color-on-secondary-container`
* `--color-tertiary`
* `--color-on-tertiary`
* `--color-tertiary-container`
* `--color-on-tertiary-container`
* `--color-neutral`
* `--color-on-neutral`
* `--color-neutral-container`
* `--color-on-neutral-container`
* `--color-neutral-variant`
* `--color-on-neutral-variant`
* `--color-neutral-variant-container`
* `--color-on-neutral-variant-container`
* `--color-error`
* `--color-on-error`
* `--color-error-container`
* `--color-on-error-container`
* `--color-info`
* `--color-on-info`
* `--color-info-container`
* `--color-on-info-container`
* `--color-warning`
* `--color-on-warning`
* `--color-warning-container`
* `--color-on-warning-container`
* `--color-success`
* `--color-on-success`
* `--color-success-container`
* `--color-on-success-container`
* `--color-surface`
* `--color-on-surface`
* `--color-surface-varaint`
* `--color-on-surface-varaint`
* `--color-surface-container`
* `--color-surface-container-high`
* `--color-surface-container-highest`
* `--color-surface-container-low`
* `--color-surface-container-lowest`
* `--color-inverse-surface`
* `--color-inverse-on-surface`
* `--color-surface-tint`

Use the existing token names exactly as defined.

Do not create arbitrary colour values in component CSS when an existing semantic token provides the required role.

Do not replace semantic tokens with raw `rgba()`, hex, RGB, HSL, or other colour values.

---

## 2. Colour Role Rules

Choose colours by semantic purpose, not by palette preference.

Examples:

* Primary actions use the primary colour roles.
* Text placed on a primary background uses `--color-on-primary`.
* Error states use error roles.
* Informational states use info roles.
* Warning states use warning roles.
* Success states use success roles.
* Main application surfaces use surface roles.
* Text on the main surface uses `--color-on-surface`.
* Tonal containers use the corresponding `*-container` roles.
* Text and icons inside a container use the corresponding `--color-on-*-container` role.

Do not use a darker or lighter primitive colour merely because it appears visually convenient.

---

## 3. Typography

Use the existing typography tokens.

The design system uses:

* `Lora` for display styles.
* `DM Sans` for headline, title, body, and label styles.

### Display styles

* `--typography-display-large`
* `--typography-display-medium`
* `--typography-display-small`

### Headline styles

* `--typography-headline-large`
* `--typography-headline-medium`
* `--typography-headline-small`

### Title styles

* `--typography-title-large`
* `--typography-title-medium`
* `--typography-title-small`

### Body styles

* `--typography-body-large`
* `--typography-body-medium`
* `--typography-body-small`

### Label styles

* `--typography-label-large`
* `--typography-label-medium`
* `--typography-label-small`

Prefer the compound typography token when the complete typographic style is required.

Example:

```css
.heading {
  font: var(--typography-headline-medium);
}
```

Do not manually specify font family, size, weight, line height, or letter spacing when an appropriate typography token already exists.

---

## 4. Spacing

Use the existing spacing tokens for margins, padding, gaps, and layout spacing.

Do not introduce arbitrary spacing values when an existing spacing token provides the required value.

Use the project's spacing scale consistently across components and pages.

Example:

```css
.card {
  padding: var(--spacing-base-spacing);
  gap: var(--spacing-medium-spacing);
}
```

Spacing should communicate hierarchy and grouping rather than being applied inconsistently on a component-by-component basis.

---

## 5. Surface and Container Hierarchy

Use semantic surface tokens to establish visual hierarchy.

Available surface roles include:

* `--color-surface`
* `--color-surface-container`
* `--color-surface-container-high`
* `--color-surface-container-highest`
* `--color-surface-container-low`
* `--color-surface-container-lowest`
* `--color-inverse-surface`

Prefer surface tokens over arbitrary background colours.

Example:

```css
.card {
  background: var(--color-surface-container);
  color: var(--color-on-surface);
}
```

Use progressively higher or lower surface-container roles to communicate elevation and grouping.

Do not introduce arbitrary shades of grey for containers when an appropriate surface token exists.

---

## 6. Elevation and Shadows

Use the existing effect tokens for shadows and elevation.

Available shadow tokens:

* `--effect-soft-shadow`
* `--effect-medium-shadow`
* `--effect-hard-shadow`

Example:

```css
.card {
  box-shadow: var(--effect-soft-shadow);
}
```

Use:

* **Soft shadow** for subtle cards and elevated surfaces.
* **Medium shadow** for dropdowns, popovers, and moderately elevated components.
* **Hard shadow** for strongly elevated or prominent surfaces.

Do not create custom shadow values when an existing effect token provides the required elevation.

---

## 7. Components

All components MUST use the design-system tokens.

Components should consume semantic tokens instead of defining their own colours, typography, spacing, or shadows.

### Example

```css
.button {
  font: var(--typography-label-large);
  padding: var(--spacing-medium-spacing) var(--spacing-base-spacing);
  background: var(--color-primary);
  color: var(--color-on-primary);
}
```

Components MUST remain reusable and should not contain page-specific visual systems.

If the same visual treatment appears more than once, prefer creating or reusing a shared component.

---

## 8. Buttons

Buttons MUST use semantic colour roles.

### Primary button

```css
.primary-button {
  background: var(--color-primary);
  color: var(--color-on-primary);
}
```

### Tonal button

```css
.tonal-button {
  background: var(--color-primary-container);
  color: var(--color-on-primary-container);
}
```

### Destructive button

```css
.destructive-button {
  background: var(--color-error);
  color: var(--color-on-error);
}
```

Buttons MUST provide distinguishable:

* Default
* Hover
* Focus
* Active/pressed
* Disabled

states.

Do not introduce arbitrary colours for these states when the semantic system can provide the appropriate treatment.

---

## 9. Forms and Inputs

Form controls MUST use the design system for:

* Typography
* Text colour
* Background
* Borders
* Focus states
* Error states
* Disabled states
* Spacing

Example:

```css
.input {
  font: var(--typography-body-medium);
  background: var(--color-surface-container-lowest);
  color: var(--color-on-surface);
  border: 1px solid var(--color-neutral-container);
}
```

Error states should use the error semantic roles:

```css
.input-error {
  border-color: var(--color-error);
}
```

Do not use arbitrary red values for validation errors.

---

## 10. Feedback and Status States

Use semantic status tokens according to their intended meaning.

| State       | Semantic role     |
| ----------- | ----------------- |
| Success     | `--color-success` |
| Error       | `--color-error`   |
| Warning     | `--color-warning` |
| Information | `--color-info`    |

For lower-emphasis status containers, use the corresponding container roles.

Example:

```css
.success-message {
  background: var(--color-success-container);
  color: var(--color-on-success-container);
}
```

---

## 11. Icons

Icons MUST use semantic colours.

Examples:

```css
.icon {
  color: var(--color-on-surface);
}
```

Primary icon:

```css
.icon-primary {
  color: var(--color-primary);
}
```

Error icon:

```css
.icon-error {
  color: var(--color-error);
}
```

Do not use arbitrary colours for icons.

Important information MUST NOT be communicated through colour alone.

---

## 12. Borders and Dividers

Use semantic neutral tokens for borders and dividers.

Example:

```css
.divider {
  border-color: var(--color-neutral-container);
}
```

Avoid hardcoded black, grey, or other border colours when an appropriate semantic token exists.

Borders should support hierarchy without competing with primary content.

---

## 13. Responsive Design

All UI MUST be responsive across:

* Mobile
* Tablet
* Desktop
* Large desktop

Responsive layouts should adapt:

* Spacing
* Typography
* Grid structure
* Component dimensions
* Navigation
* Content density

Do not simply scale desktop layouts down for mobile.

Mobile layouts MUST remain usable without unintended horizontal scrolling.

---

## 14. Accessibility

All UI MUST meet reasonable accessibility standards.

Components MUST:

* Maintain sufficient colour contrast.
* Provide visible keyboard focus states.
* Use semantic HTML where appropriate.
* Provide accessible names for interactive elements.
* Support keyboard navigation.
* Avoid communicating important information through colour alone.
* Maintain readable typography.
* Preserve a logical heading hierarchy.
* Provide appropriate interactive target sizes.

Focus states MUST be clearly visible.

Do not remove browser or custom focus indicators without providing an accessible replacement.

---

## 15. Hardcoded Values

Avoid hardcoded values for:

* Colours
* Font families
* Font sizes
* Font weights
* Line heights
* Letter spacing
* Spacing
* Shadows
* Surface colours

when an appropriate design token exists.

### Avoid

```css
.card {
  background: #ffffff;
  padding: 17px;
  color: #1e1e1e;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}
```

### Prefer

```css
.card {
  background: var(--color-surface-container-lowest);
  padding: var(--spacing-base-spacing);
  color: var(--color-on-surface);
  box-shadow: var(--effect-soft-shadow);
}
```

Hardcoded values may only be used when there is no suitable existing token and the value is genuinely component-specific.

---

## 16. Adding New Tokens

When a required design value does not exist, do not repeatedly hardcode it.

Consider adding a new token to `design-tokens.tokens.json`.

New tokens MUST:

* Have a clear purpose.
* Follow the existing naming convention.
* Avoid duplicating an existing token.
* Be added to the source token file.
* Be regenerated into the CSS token file.
* Be documented when necessary.

Never manually add new tokens to the generated CSS file.

---

## 17. Token Naming

Use the existing token names exactly as defined.

Do not rename, shorten, or create alternative aliases for existing tokens inside components.

For example, use:

```css
var(--color-primary)
```

instead of creating:

```css
var(--green)
```

Likewise, use:

```css
var(--typography-body-medium)
```

instead of:

```css
var(--body-text)
```

The generated token API is part of the project's design-system contract.

---

## 18. Generated CSS

The generated CSS token file MUST be treated as read-only.

Do NOT manually edit:

```text
design-tokens.css
```

If a token needs to change:

1. Update `design-tokens.tokens.json`.
2. Run the project's token generation process.
3. Verify the generated CSS.
4. Update affected components if necessary.
5. Run the appropriate tests/build checks.

---

## 19. Design-System Consistency

Components with the same purpose MUST have consistent:

* Typogr