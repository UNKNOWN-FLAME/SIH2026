---
name: Antarctic Research Monitoring System
colors:
  surface: '#051424'
  surface-dim: '#051424'
  surface-bright: '#2c3a4c'
  surface-container-lowest: '#010f1f'
  surface-container-low: '#0d1c2d'
  surface-container: '#122131'
  surface-container-high: '#1c2b3c'
  surface-container-highest: '#273647'
  on-surface: '#d4e4fa'
  on-surface-variant: '#c6c6cc'
  inverse-surface: '#d4e4fa'
  inverse-on-surface: '#233143'
  outline: '#909096'
  outline-variant: '#45464c'
  surface-tint: '#c2c6d8'
  primary: '#c2c6d8'
  on-primary: '#2b303e'
  primary-container: '#1a1f2c'
  on-primary-container: '#828697'
  inverse-primary: '#595e6d'
  secondary: '#c2c6d4'
  on-secondary: '#2b303b'
  secondary-container: '#444955'
  on-secondary-container: '#b4b8c6'
  tertiary: '#d8c4a8'
  on-tertiary: '#3b2e1b'
  tertiary-container: '#281d0b'
  on-tertiary-container: '#96846b'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dee2f4'
  primary-fixed-dim: '#c2c6d8'
  on-primary-fixed: '#161b28'
  on-primary-fixed-variant: '#424655'
  secondary-fixed: '#dee2f1'
  secondary-fixed-dim: '#c2c6d4'
  on-secondary-fixed: '#171c26'
  on-secondary-fixed-variant: '#424752'
  tertiary-fixed: '#f5dfc3'
  tertiary-fixed-dim: '#d8c4a8'
  on-tertiary-fixed: '#241a08'
  on-tertiary-fixed-variant: '#534530'
  background: '#051424'
  on-background: '#d4e4fa'
  surface-variant: '#273647'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  title-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-data:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
spacing:
  unit: 4px
  container-margin: 24px
  gutter: 16px
  component-padding-x: 12px
  component-padding-y: 8px
---

## Brand & Style
The design system is engineered for high-stakes, government-grade environmental monitoring. The personality is institutional, authoritative, and utilitarian. It prioritizes data integrity and rapid legibility over aesthetic flourishes.

The style is **Institutional Minimalism**. It utilizes a "Dark Mode" foundation to reduce eye strain during long monitoring shifts in low-light environments. Visual hierarchy is established through structural alignment and 1px borders rather than shadows or depth effects. Every element must feel "bolted down" and mission-critical.

## Colors
The palette is divided into functional layers to maintain extreme data density without visual noise.

- **Primary Background (#1a1f2c):** Used for the application shell and global background.
- **Secondary Surface (#2a2f3a):** Used for card backgrounds, sidebars, and header sections to provide subtle structural separation.
- **Accent (#00a3ad):** Reserved for interactive focus states, primary buttons, and active toggle indicators.
- **Status Colors:** These must never be used for decorative purposes. They are strictly reserved for sensor alerts, system health, and out-of-bounds telemetry data.

## Typography
This design system utilizes **Inter** for its neutral, systematic clarity. 

For telemetry and coordinate data, use the `mono-data` style which enables tabular figures (tnum) to ensure numbers align vertically in tables and dashboard widgets. `label-caps` is the primary style for table headers and section metadata to distinguish labels from live data.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy suitable for workstation displays (1920x1080 and above).

- **Grid:** 12-column system with 16px gutters. 
- **Density:** High density is achieved by using a 4px base spacing unit.
- **Layout Model:** Dashboard components are housed in "Tiles" that snap to the grid. 
- **Adaptation:** On smaller desktop viewports, sidebars collapse to icon-only views to maximize the data visualization area.

## Elevation & Depth
This system eschews shadows and traditional depth. 

- **Flat Layering:** Z-axis depth is communicated solely through color contrast and 1px borders.
- **Borders:** All containers use a 1px solid border (#3f4859) to separate surfaces.
- **Active State:** Focus and selection are indicated by a 2px interior border or a solid fill using the Accent color.
- **Overlay:** Modals or tooltips use a slightly darker border and a solid background of #1a1f2c to "cut through" the dashboard layers.

## Shapes
The design system uses a **Sharp (0px)** roundedness strategy. Every element—from buttons and input fields to large data cards—must have 90-degree corners. This reinforces the "hard-ware" and institutional nature of the platform, maximizing screen real estate by removing unnecessary corner gaps.

## Components

- **Buttons:** Sharp-cornered. Primary buttons use a solid Accent (#00a3ad) fill with white text. Secondary buttons use a 1px border with no fill.
- **Data Cards:** 1px border (#3f4859) with a header row utilizing the `label-caps` typography style. Backgrounds are solid #2a2f3a.
- **Segmented Controls:** Used for switching timeframes (1H, 6H, 24H). These should appear as a single joined unit with 1px dividers between options; the active state uses the Accent color.
- **Tables:** Minimalist, row-based layout. No vertical lines. Hover states for rows use a subtle background highlight (#353b48).
- **Input Fields:** Dark background (#1a1f2c), 1px border, and `mono-data` text for numeric entry.
- **Line Charts:** Use 1.5px stroke width. No area fills under the lines. Grid lines should be faint (#2a2f3a) and axes should use `body-sm` typography.