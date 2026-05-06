# SnapHeic Style Guide

This document defines the visual identity and design system for SnapHeic. The app uses a "Technical/Brutalist" aesthetic characterized by high contrast, sharp edges, and a "raw" feel that emphasizes its functional, local-first nature.

---

## 1. Design Philosophy

- **High Contrast:** Clear distinction between elements using deep blacks and off-whites.
- **Structural Integrity:** Use of visible borders and hard shadows to define space, rather than soft gradients or rounded corners.
- **Information Density:** Small, monospaced labels for metadata to reinforce the "technical" tool aspect.
- **Zero-Trust Visuals:** A clean, minimal UI that doesn't hide behind excessive decoration, reflecting the privacy-first architecture.

---

## 2. Color Palette

The app uses a limited but impactful palette to ensure focus and readability.

### Core Colors
- **Background:** `#F4F4F2` (Off-White/Beige) - Used for the main body background to reduce eye strain compared to pure white.
- **Foreground:** `#1A1A1A` (Near-Black) - Used for primary text, borders, and main UI elements.
- **Surface:** `#FFFFFF` (White) - Used for cards and containers to create depth against the background.

### Semantic Colors
- **Success:** `text-green-600` - Used for "Converted" states and completion icons.
- **Error:** `text-red-600` / `bg-red-50` - Used for validation errors and failed conversion states.
- **Muted:** `opacity-60` or `black/10` - Used for secondary labels, placeholders, and subtle dividers.

---

## 3. Typography

SnapHeic uses two primary typefaces to distinguish between content and technical metadata.

### Primary Font: **Inter**
- **Usage:** Headings, body text, buttons.
- **Styling:** Bold weights (`font-bold`) are used extensively for emphasis and to match the brutalist aesthetic.
- **Fallbacks:** `ui-sans-serif`, `system-ui`, `sans-serif`.

### Secondary Font: **JetBrains Mono**
- **Usage:** File sizes, status labels, technical metadata, and "Mono Labels".
- **Styling:** Often used in uppercase with tracking (`tracking-wider`) and reduced opacity.
- **Fallbacks:** `ui-monospace`, `SFMono-Regular`, `monospace`.

---

## 4. UI Components

### The "Technical Border"
This is the signature UI element of SnapHeic.
- **Class:** `.technical-border`
- **Definition:**
  - `border-2 border-[#1A1A1A]`
  - `shadow-[4px_4px_0px_0px_rgba(26,26,26,1)]` (A hard, offset shadow with no blur).

### Mono Labels
Used for supplementary information that needs to look "encoded" or secondary.
- **Class:** `.mono-label`
- **Definition:**
  - `font-mono`, `text-[10px]`, `uppercase`, `tracking-wider`, `opacity-60`.

### Buttons
- **Primary:** Black background, white text, bold.
- **Secondary:** White background, 2px black border, bold.
- **Hover States:** Subtle opacity changes (`hover:opacity-90`) or slight background shifts (`hover:bg-black/5`).

---

## 5. Layout & Spacing

- **Container:** Maximum width is `max-w-5xl` (1024px) to ensure readability on wide screens.
- **Spacing Scale:** Uses standard Tailwind spacing (e.g., `p-4`, `p-8`, `gap-8`) to maintain a consistent rhythm.
- **Responsive:** Layout shifts from vertical stacks on mobile to horizontal distributions on desktop (e.g., `flex-col md:flex-row`).

---

## 6. Animations (Motion Principles)

Powered by **Framer Motion**, animations are used to make the "conversion queue" feel alive without being distracting.

- **Transitions:** Usually `spring` or `ease-out` for a snappy feel.
- **List Items:** New files "pop" in with an opacity fade and a slight slide-up (`y: 20` to `y: 0`).
- **Interaction Feedback:** Buttons and interactive cards often have subtle scale changes or rotation (e.g., the "+" icon rotating on hover).
- **The Shimmer:** The SnapHeic logo features a continuous white shimmer effect to represent "active processing."

---
*Last updated: May 2026*
