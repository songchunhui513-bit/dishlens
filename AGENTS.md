# DishLens — AI Menu Translator

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Project Overview

DishLens is an H5/PWA mobile app for global travelers to translate restaurant menus via AI. Core features: multi-photo menu OCR + translation, AI-generated food images, and user reviews.

- **Design direction:** v7 — Warm Editorial (warm cream bg + sage green primary + orange accent, three-tier font system)
- **Tech stack:** Next.js 16 (App Router), TypeScript (strict), TailwindCSS 4, Supabase, Cloudflare R2
- **Prototype reference:** `../_temp/dishlens-v7-complete.html` — 20 screens, all component specs, animations, and states
- **Architecture:** `../tech-architecture.md`
- **PRD:** `../PRD.md`

## Development Rules

1. **Design tokens only** — never invent new colors. Use `var(--bg)`, `var(--card)`, `var(--card-alt)`, `var(--ink)`, `var(--ink-soft)`, `var(--primary)`, `var(--primary-soft)`, `var(--accent)`, `var(--accent-soft)`, `var(--muted)`, `var(--rule)`, `var(--allergen-bg)`, `var(--veg-bg)`.

2. **Fonts** — Display: `var(--font-display)` (Source Serif 4, brand/dish names), Body: `var(--font-body)` (Poppins, UI/buttons), UI: `var(--font-ui)` (Inter, labels/tags/settings). Chinese dish names always serif + 700 weight.

3. **"use client" required** for any interactive component (state, events, browser APIs).

4. **Shared components** in `src/components/shared/` — use them, don't re-implement Rule, Button, StarDisplay, StarPicker, AllergenTag, Skeleton, DishCardSkeleton, EmptyState, ErrorState, Modal, Toast.

5. **TypeScript** — types in `src/types/index.ts`, validate API boundaries with Zod.

6. **Mobile-first** — target 393×852 viewport. No desktop layouts in v1.

7. **No emoji icons** — use text characters (← ★ ☆ ✕) or inline SVG per editorial icon system.

8. **Border radius** — use `--radius-sm` (12px), `--radius` (18px), `--radius-lg` (24px), `--radius-xl` (28px). All cards are rounded, no sharp corners.

9. **Micro-animations** — use defined keyframes: fadeSlideUp, breathe, heartbeat, pulse-dot, checkDraw, popIn, gentleGlow, shimmer. Duration 150-400ms. No bouncy/overshoot easings.
