---
version: alpha
name: "Wind window"
description: "A calm operational wind forecast desk with an explicit decision-time trail."
colors:
  primary: "#153d49"
  forecast: "#197c91"
  actual: "#b45332"
  background: "#f3f6f8"
  surface: "#ffffff"
  ink: "#18323c"
  muted: "#536b77"
  border: "#d9e3e8"
  soft: "#eaf3f5"
  warning: "#80521b"
  warningSurface: "#fff6e8"
  danger: "#ad3040"
  scrollbar: "#899fa9"
  scrollbarHover: "#536b77"
typography:
  sans:
    fontFamily: "Segoe UI, Arial, sans-serif"
  display:
    fontFamily: "Bahnschrift, Segoe UI, sans-serif"
  mono:
    fontFamily: "Consolas, monospace"
rounded:
  DEFAULT: "0.75rem"
  sm: "0.375rem"
  lg: "1rem"
spacing:
  section-gap: "1.5rem"
  page-max: "86rem"
components:
  button: {}
  card: {}
  input: {}
  chart: {}
  table: {}
---

# Wind window Design System

## Overview

### Creative North Star
The controlled precision of a coastal forecasting station: petrol blue, pale blue plotting paper, rust for measured outturn. A publication-to-delivery strip makes the temporal boundary the visual signature.

### Product context and register
UK utility procurement analysts reviewing a January 2026 pilot, primarily on a desktop. Product dashboard in en-GB, domain timezone Europe/London; API instants in UTC. No Japan market or locale scope. No existing sibling screens or design system existed. Two views reuse the same controls, chart, metric tiles and interval table. Avoid trading-terminal clutter, decorative wind-farm imagery and marketing copy.

Token ownership: runtime source is `frontend/src/styles.css` `:root`; this document mirrors those named tokens. No theme adapters or generated duplicates. Chart colours consume CSS variables. Native date/time and select popups intentionally use browser/OS geometry and locale; surrounding labels always state Europe/London.

### Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Date | App shared settings form | User date/cutoff scope; this document | native date and time | frontend/tests/dashboard.spec.ts |
| Form | App shared settings form | This document; API date validation | settings apply | frontend/tests/dashboard.spec.ts |
| Scrollbar | frontend/src/styles.css global baseline | Runtime CSS tokens | table geometry only | narrow layout test and visual review |
| Select/Listbox | App accuracy-period field | This document | native select | frontend/tests/dashboard.spec.ts |

## Colors
Primary is shell/action; forecast is the continuous teal series, actual the rust dashed series. Labels and line patterns supplement colour. Surface/background/border establish hierarchy. Muted remains readable on white. Warning/danger convey missing data and failures with text. One light theme; forced-colors uses system scrollbar colours.

## Typography
Display uses local Bahnschrift with Segoe fallback, body Segoe UI, time/hash values Consolas. No remote fonts or late font swap. Tabular numerals for metrics. Headline 36px, section 20px, body 14px at 1.55 line height.

## Layout
Compact brand rail, primary content max 86rem, shared date controls, wide chart and a narrower explanation panel, four summary tiles. At 980px rail becomes a top bar; at 680px content becomes a single column. Document owns scrolling; interval table alone has bounded overflow. Loading/error reserves the main panel footprint.

## Elevation & Depth
Use borders and tonal layers. No floating cards or decorative shadows. No overlays are needed.

## Shapes
Cards 12px, controls 6px, primary plot panel 16px. Hairline chart grids. Icons are lucide line icons with text labels.

## Components

### Foundational visual states
Hover has a soft surface, focus-visible a 3px forecast outline, active slight downward movement. Disabled buttons fade and never fire. A labelled inline loader owns the loading state; no skeletons. Errors remain inline with retry. Empty charts explain absence.

### Buttons and actions
Petrol solid for Apply settings, neutral outline for Retry and previous/next date. Labels remain stable while busy. No destructive actions.

### Navigation and data display
Two native navigation buttons use aria-pressed. Active view is URL state. Chart is paired with a full 48-row semantic table behind a native details disclosure. Pooling uses a native select and always states the dates being scored.

### Forms and overlays
One shared form owns validation and controls, noValidate, explicit labels and inline errors. Applied settings are separate from edits. No toast, dialog, authentication, or CRUD capabilities apply. Network requests time out and superseded requests cancel. Never display stale data under new settings.

### Iconography
Lucide-react, 18px strokes; decorative icons aria-hidden. Text labels remain mandatory for navigation.

### Motion
Only a loading spinner; reduced motion disables its animation. No entry transitions.

### Content and data visualization
Plain, specific English. MW, exact startTime matches, unfilled gaps, no inferred quantities. Signed bias always defines forecast minus actual. Do not label hourly forecast points as half-hourly complete data.

## Do's and Don'ts
- Do show the selected forecast publication for every delivery interval.
- Do reuse shared chart/status/control components across both views.
- Don't interpolate, silently replace failed requests, or display empty metrics as zero.
- Don't present national wind output as this utility's contracted supply.
