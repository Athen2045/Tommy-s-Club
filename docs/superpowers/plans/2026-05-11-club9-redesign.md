# Club9 Premium UI/UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Club9's Bootstrap dark theme with a custom Obsidian × Apple × ctOS design system across all pages, phased across 5 discrete stages.

**Architecture:** Complete rewrite of `public/css/main.css` with new CSS custom properties; template-level changes for structural components (nav, sidebar, gate emblem, blog feed); all routes and Supabase logic unchanged.

**Tech Stack:** Express.js, Handlebars (hbs), Bootstrap 5 (kept for utilities/grid/dropdowns only), custom CSS, SVG animations, Google Fonts (Inter + Playfair Display + JetBrains Mono).

---

## File Map

| File | Change type |
|---|---|
| `public/css/main.css` | Complete rewrite |
| `views/layouts/gate.hbs` | Font update, drop Bootstrap |
| `views/layouts/main.hbs` | Full rewrite — sidebar + new nav |
| `views/login.hbs` | Replace gate-ring with ctOS emblem |
| `views/register.hbs` | Replace gate-ring with ctOS emblem (sm) |
| `views/pending.hbs` | Replace gate-ring with ctOS emblem (sm) |
| `views/rejected.hbs` | Replace gate-ring with ctOS emblem (sm) |
| `views/terms.hbs` | Replace gate-ring with ctOS emblem (sm) |
| `views/blog.hbs` | Full rewrite — hero + category filter + grid |
| `views/post.hbs` | Fix reaction escaping bug + meta styling |
| All others | CSS-only update via token cascade |

---

## Task 1: CSS Design System (Phase 1)

**Files:**
- Modify: `public/css/main.css` (complete replacement)

This is the foundation. All visual changes downstream rely on these tokens being correct. Replace the entire file — do not merge with the old one.

- [ ] **Step 1: Replace `public/css/main.css` entirely**

Write the following as the complete new file:

```css
/* ============================================================
   Club9 — Obsidian × Apple × ctOS Design System
   ============================================================ */

/* ── 1. Design Tokens ──────────────────────────────────────── */

:root {
    /* Backgrounds */
    --bg:             #0d0d12;
    --bg-surface:     #13131a;
    --bg-elevated:    #1a1a24;
    --bg-overlay:     rgba(13, 13, 18, 0.85);
    --bg-input:       #1a1a24;

    /* Borders */
    --border:         rgba(255, 255, 255, 0.06);
    --border-focus:   rgba(149, 128, 255, 0.35);

    /* Purple accent — main app (Obsidian) */
    --primary:        #9580ff;
    --primary-dark:   #7c6af7;
    --primary-light:  rgba(149, 128, 255, 0.15);
    --primary-glow:   rgba(149, 128, 255, 0.25);

    /* Cyan accent — gate pages only (ctOS) */
    --ctos:           #00d4ff;
    --ctos-dim:       rgba(0, 212, 255, 0.15);
    --ctos-glow:      rgba(0, 212, 255, 0.3);

    /* Text */
    --text:           #f0eeff;
    --text-secondary: rgba(255, 255, 255, 0.6);
    --text-muted:     rgba(255, 255, 255, 0.35);
    --text-accent:    #c0b5ff;

    /* Shape */
    --radius:         12px;
    --radius-sm:      8px;
    --nav-h:          60px;

    /* Fonts */
    --font-sans:  'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --font-serif: 'Playfair Display', Georgia, serif;
    --font-mono:  'JetBrains Mono', 'SF Mono', monospace;

    /* Dot grid (Obsidian background texture) */
    --dot-grid: radial-gradient(circle, rgba(149, 128, 255, 0.07) 1px, transparent 1px);
    --dot-size:  20px 20px;
}

/* ── 2. Base ────────────────────────────────────────────────── */

*, *::before, *::after { box-sizing: border-box; }
html { scroll-behavior: smooth; }

body {
    font-family: var(--font-sans);
    background: var(--bg);
    color: var(--text);
    font-size: 16px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
}

a { color: var(--primary); }
a:hover { color: var(--text-accent); }
img { max-width: 100%; height: auto; }

/* ── 3. Gate Page ───────────────────────────────────────────── */

.gate-body {
    background: var(--bg);
    background-image: var(--dot-grid);
    background-size: var(--dot-size);
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
}

.gate-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 100vh;
    padding: 2rem 1.5rem;
    width: 100%;
}

/* Hide any leftover gate-ring markup */
.gate-ring-wrap { display: none; }

/* ─── ctOS Hex Eye Emblem ─── */

.ctos-emblem-wrap { margin-bottom: 2.5rem; }

.ctos-emblem {
    position: relative;
    width: 180px;
    height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
}

/* Radial spotlight */
.ctos-emblem::before {
    content: '';
    position: absolute;
    width: 300px;
    height: 300px;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    background: radial-gradient(circle, rgba(0,212,255,0.07) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
}

.ctos-outer-hex,
.ctos-inner-hex {
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
}

.ctos-outer-hex { animation: ctos-spin-cw  12s linear infinite; }
.ctos-inner-hex { animation: ctos-spin-ccw  7s linear infinite; }

.ctos-scan-line {
    position: absolute;
    width: 120px;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--ctos), transparent);
    box-shadow: 0 0 8px var(--ctos-glow);
    animation: ctos-scan 2.4s ease-in-out infinite;
    z-index: 5;
}

.ctos-glyph {
    position: relative;
    z-index: 10;
    font-family: var(--font-mono);
    font-size: 2rem;
    font-weight: 700;
    color: var(--ctos);
    text-shadow: 0 0 20px rgba(0,212,255,0.7), 0 0 40px rgba(0,212,255,0.3);
    letter-spacing: -0.05em;
    animation: ctos-glyph-pulse 4s ease-in-out infinite;
}

.ctos-corner {
    position: absolute;
    width: 14px;
    height: 14px;
}
.ctos-corner-tl { top:8px;    left:8px;   border-top:   1.5px solid var(--ctos); border-left:  1.5px solid var(--ctos); animation: ctos-corner-blink 3s ease-in-out 0.0s infinite; }
.ctos-corner-tr { top:8px;    right:8px;  border-top:   1.5px solid var(--ctos); border-right: 1.5px solid var(--ctos); animation: ctos-corner-blink 3s ease-in-out 0.4s infinite; }
.ctos-corner-bl { bottom:8px; left:8px;   border-bottom:1.5px solid var(--ctos); border-left:  1.5px solid var(--ctos); animation: ctos-corner-blink 3s ease-in-out 0.8s infinite; }
.ctos-corner-br { bottom:8px; right:8px;  border-bottom:1.5px solid var(--ctos); border-right: 1.5px solid var(--ctos); animation: ctos-corner-blink 3s ease-in-out 1.2s infinite; }

.ctos-hud-label {
    position: absolute;
    bottom: -22px;
    left: 50%;
    transform: translateX(-50%);
    font-family: var(--font-mono);
    font-size: 0.52rem;
    color: rgba(0,212,255,0.3);
    letter-spacing: 3px;
    text-transform: uppercase;
    white-space: nowrap;
    z-index: 10;
}

/* Smaller variant for status pages */
.ctos-emblem-sm { width: 120px; height: 120px; }
.ctos-emblem-sm .ctos-glyph     { font-size: 1.4rem; }
.ctos-emblem-sm .ctos-scan-line { width: 80px; }
.ctos-emblem-sm .ctos-hud-label { font-size: 0.46rem; }
.ctos-emblem-sm .ctos-corner    { width: 10px; height: 10px; }

/* ctOS keyframes */
@keyframes ctos-spin-cw  { from { transform: rotate(0deg);    } to { transform: rotate(360deg);  } }
@keyframes ctos-spin-ccw { from { transform: rotate(0deg);    } to { transform: rotate(-360deg); } }
@keyframes ctos-scan {
    0%,100% { transform: translateY(-55px); opacity: 0; }
    10%     { opacity: 1; }
    50%     { transform: translateY(55px);  opacity: 0.7; }
    90%     { opacity: 0.2; }
}
@keyframes ctos-glyph-pulse {
    0%,88%,100% { opacity: 1; transform: scale(1); }
    50%         { opacity: 1; transform: scale(1.06); }
    92%         { opacity: 0.25; }
}
@keyframes ctos-corner-blink {
    0%,100% { opacity: 0.35; }
    50%     { opacity: 1; }
}

/* ─── Gate Form ─── */

.gate-form-wrap {
    width: 100%;
    max-width: 340px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: .25rem;
}

.gate-form { width: 100%; display: flex; flex-direction: column; gap: .875rem; }
.gate-field { width: 100%; }

.gate-label {
    display: block;
    font-family: var(--font-mono);
    font-size: .6rem;
    letter-spacing: .14em;
    color: rgba(0,212,255,0.45);
    margin-bottom: .35rem;
    text-transform: uppercase;
}

.gate-input {
    width: 100%;
    background: rgba(0,212,255,0.04);
    border: 1px solid rgba(0,212,255,0.15);
    border-radius: 6px;
    color: var(--text);
    font-family: var(--font-mono);
    font-size: .9rem;
    padding: .6rem .9rem;
    outline: none;
    transition: border-color .2s, box-shadow .2s;
    -webkit-appearance: none;
}
.gate-input::placeholder { color: rgba(0,212,255,0.2); }
.gate-input:focus {
    border-color: var(--ctos);
    box-shadow: 0 0 0 3px var(--ctos-dim);
}

.gate-btn {
    width: 100%;
    margin-top: .5rem;
    background: rgba(0,212,255,0.07);
    border: 1px solid rgba(0,212,255,0.35);
    border-radius: 6px;
    color: var(--ctos);
    font-family: var(--font-mono);
    font-size: .78rem;
    letter-spacing: .18em;
    padding: .65rem 1rem;
    cursor: pointer;
    transition: background .2s, border-color .2s, box-shadow .2s;
    text-align: center;
    text-decoration: none;
    display: block;
}
.gate-btn:hover {
    background: rgba(0,212,255,0.14);
    border-color: var(--ctos);
    color: var(--ctos);
    box-shadow: 0 0 14px var(--ctos-dim);
}

.gate-error   { font-family: var(--font-mono); font-size: .75rem; color: #ff6b6b; text-align: center; margin-bottom: .5rem; letter-spacing: .05em; }
.gate-success { font-family: var(--font-mono); font-size: .75rem; color: #6bcb77; text-align: center; margin-bottom: .5rem; letter-spacing: .05em; }

.gate-switch { font-family: var(--font-mono); font-size: .68rem; letter-spacing: .08em; color: rgba(255,255,255,0.2); margin-top: 1.25rem; text-align: center; }
.gate-switch a { color: rgba(0,212,255,0.45); text-decoration: none; transition: color .15s; }
.gate-switch a:hover { color: var(--ctos); }

/* Status pages */
.status-gate-icon    { font-size: 2.2rem; margin-bottom: .75rem; }
.status-gate-heading { font-family: var(--font-mono); font-size: .9rem; font-weight: 700; letter-spacing: .14em; color: var(--ctos); margin-bottom: .75rem; }
.status-gate-body    { font-size: .85rem; color: var(--text-secondary); line-height: 1.8; text-align: center; }

/* Avatar picker */
.avatar-picker { display: flex; gap: 1rem; margin-top: .5rem; }
.avatar-pick-option { cursor: pointer; flex: 1; }
.avatar-pick-option input[type="radio"] { display: none; }
.avatar-pick-card {
    display: flex; flex-direction: column; align-items: center; gap: .5rem; padding: .75rem;
    border: 1px solid rgba(0,212,255,0.15); border-radius: var(--radius);
    background: rgba(0,212,255,0.03); transition: border-color .2s, background .2s;
}
.avatar-pick-card img { width: 56px; height: 56px; border-radius: 50%; }
.avatar-pick-card span { font-family: var(--font-mono); font-size: .7rem; letter-spacing: .08em; color: var(--text-secondary); text-transform: uppercase; }
.avatar-pick-option input[type="radio"]:checked + .avatar-pick-card { border-color: var(--ctos); background: var(--ctos-dim); }

.gate-input-row { display: flex; gap: .5rem; align-items: stretch; }
.gate-input-row .gate-input { flex: 1; margin: 0; }
.gate-gen-btn {
    display: flex; align-items: center; justify-content: center; padding: 0 .85rem;
    background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.15);
    border-radius: 6px; color: var(--ctos); cursor: pointer; transition: background .2s; flex-shrink: 0;
}
.gate-gen-btn:hover { background: var(--ctos-dim); border-color: var(--ctos); }

/* Terms */
.terms-rules { background: rgba(0,212,255,0.03); border: 1px solid rgba(0,212,255,0.1); border-radius: var(--radius-sm); padding: 1rem 1.25rem; margin-bottom: 1.25rem; text-align: left; width: 100%; }
.terms-rules ol { margin: 0; padding-left: 1.2rem; color: var(--text-secondary); font-size: .82rem; line-height: 2.1; }
.terms-check-label { display: flex; align-items: flex-start; gap: .6rem; font-size: .83rem; color: var(--text-secondary); cursor: pointer; text-align: left; width: 100%; }
.terms-check-label input[type="checkbox"] { accent-color: var(--ctos); flex-shrink: 0; margin-top: 3px; }

/* ── 4. Navbar ──────────────────────────────────────────────── */

.site-nav {
    position: sticky;
    top: 0;
    z-index: 1030;
    height: var(--nav-h);
    background: var(--bg-overlay);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border-bottom: 1px solid var(--border);
    transition: box-shadow .2s;
    display: flex;
    align-items: center;
}

.site-nav .container {
    display: flex;
    align-items: center;
    gap: 1rem;
    width: 100%;
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1.5rem;
}

.brand-logo {
    font-family: var(--font-sans);
    font-weight: 700;
    font-size: 1.15rem;
    letter-spacing: -0.5px;
    color: var(--text) !important;
    text-decoration: none;
    display: flex;
    align-items: center;
}
.brand-logo em { color: var(--primary); font-style: normal; }

.sidebar-toggle {
    background: none; border: none;
    color: var(--text-muted);
    font-size: 1.2rem;
    cursor: pointer;
    padding: .3rem .45rem;
    border-radius: 6px;
    transition: background .15s, color .15s;
    display: flex; align-items: center; justify-content: center; line-height: 1;
    flex-shrink: 0;
}
.sidebar-toggle:hover { background: rgba(255,255,255,.07); color: var(--text); }

.nav-center { display: flex; align-items: center; gap: .25rem; margin: 0 auto; }

.nav-link {
    color: var(--text-muted) !important;
    font-weight: 500; font-size: .875rem;
    padding: .4rem .75rem !important;
    border-radius: 8px;
    transition: color .15s, background .15s;
    text-decoration: none;
}
.nav-link:hover, .nav-link.active {
    color: var(--text) !important;
    background: rgba(255,255,255,.06);
}

.nav-actions { display: flex; align-items: center; gap: .6rem; flex-shrink: 0; }

.nav-write-btn {
    font-family: var(--font-mono);
    font-size: .7rem; letter-spacing: .04em;
    padding: .35rem .9rem; border-radius: 10px;
    border: 1px solid var(--border-focus);
    color: var(--text-accent);
    background: var(--primary-light);
    text-decoration: none;
    transition: background .15s, box-shadow .15s;
    white-space: nowrap;
}
.nav-write-btn:hover { background: rgba(149,128,255,0.22); box-shadow: 0 0 10px var(--primary-light); color: var(--text-accent); }

.btn-avatar { background: none; border: none; padding: 0; cursor: pointer; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.avatar-sm  { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; border: 2px solid var(--border); }
.avatar-initials {
    width: 32px; height: 32px; border-radius: 50%;
    background: linear-gradient(135deg, var(--primary) 0%, #5865f2 100%);
    color: #fff; font-size: .75rem; font-weight: 600;
    display: flex; align-items: center; justify-content: center;
    border: 2px solid var(--border);
}

.dropdown-menu         { background: var(--bg-elevated) !important; border: 1px solid var(--border) !important; border-radius: var(--radius) !important; font-size: .875rem; min-width: 180px; }
.dropdown-item         { color: var(--text-secondary) !important; border-radius: 6px; margin: 2px 4px; padding: .5rem .75rem; width: calc(100% - 8px); transition: background .12s, color .12s; }
.dropdown-item:hover   { background: var(--primary-light) !important; color: var(--text-accent) !important; }
.dropdown-item.text-danger       { color: #ff453a !important; }
.dropdown-item.text-danger:hover { background: rgba(255,69,58,.12) !important; }
.dropdown-divider      { border-color: var(--border) !important; }
.dropdown-item-text    { color: var(--text-muted) !important; }

.admin-badge {
    font-family: var(--font-mono); font-size: .55rem; font-weight: 700; letter-spacing: .1em;
    color: #000; background: var(--primary); padding: .1rem .4rem; border-radius: 4px;
    text-transform: uppercase; flex-shrink: 0;
}

/* ── 5. Toggle Sidebar ──────────────────────────────────────── */

.site-sidebar {
    position: fixed;
    top: 0; left: -260px;
    width: 240px; height: 100vh;
    background: var(--bg-surface);
    border-right: 1px solid var(--border);
    z-index: 1040;
    transition: left .25s cubic-bezier(.4,0,.2,1);
    display: flex; flex-direction: column;
    overflow-y: auto;
}
.site-sidebar.open { left: 0; }

.sidebar-overlay {
    display: none;
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.5);
    z-index: 1039;
    backdrop-filter: blur(2px);
}
.sidebar-overlay.open { display: block; }

.sidebar-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1rem .75rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}
.sidebar-header-brand { font-family: var(--font-sans); font-weight: 700; font-size: 1rem; letter-spacing: -0.4px; color: var(--text); }
.sidebar-header-brand em { color: var(--primary); font-style: normal; }
.sidebar-close {
    background: none; border: none; padding: .25rem .4rem;
    color: var(--text-muted); cursor: pointer; border-radius: 5px;
    font-size: 1.1rem; line-height: 1; transition: background .12s, color .12s;
}
.sidebar-close:hover { background: rgba(255,255,255,.07); color: var(--text); }

.sidebar-nav  { flex: 1; padding: .75rem 0; }
.sidebar-section { padding: 0 .5rem; margin-bottom: .5rem; }
.sidebar-section-label {
    font-family: var(--font-mono); font-size: .58rem; text-transform: uppercase;
    letter-spacing: .12em; color: var(--text-muted); padding: .4rem .5rem .25rem;
}

/* Sidebar items — covers both plain .sidebar-item and navLink-generated a.nav-link */
.sidebar-item,
.sidebar-nav a.nav-link {
    display: flex; align-items: center; gap: .5rem;
    padding: .4rem .6rem; border-radius: 7px;
    font-size: .875rem; color: var(--text-secondary);
    text-decoration: none;
    transition: background .12s, color .12s;
    margin-bottom: 1px;
    border-left: 2px solid transparent;
}
.sidebar-item:hover,
.sidebar-nav a.nav-link:hover {
    background: var(--primary-light);
    color: var(--text-accent);
}
.sidebar-item.active,
.sidebar-nav a.nav-link.active {
    background: var(--primary-light);
    color: var(--text-accent);
    border-left-color: var(--primary);
}

.sidebar-unread-dot { margin-left: auto; color: var(--primary); font-size: .6rem; line-height: 1; }

/* ── 6. Main Content Area ───────────────────────────────────── */

.main-content {
    min-height: calc(100vh - var(--nav-h) - 80px);
    background-image: var(--dot-grid);
    background-size: var(--dot-size);
}

/* ── 7. Buttons ─────────────────────────────────────────────── */

.btn-primary { background: var(--primary); border-color: var(--primary); font-weight: 500; color: #fff; transition: background .15s, box-shadow .15s; }
.btn-primary:hover, .btn-primary:focus { background: var(--primary-dark); border-color: var(--primary-dark); box-shadow: 0 0 16px var(--primary-glow); color: #fff; }

.btn-outline-primary { color: var(--primary); border-color: var(--primary); font-weight: 500; }
.btn-outline-primary:hover { background: var(--primary); border-color: var(--primary); box-shadow: 0 0 14px var(--primary-glow); color: #fff; }

.btn-outline-secondary { color: var(--text-muted); border-color: var(--border); background: transparent; }
.btn-outline-secondary:hover { background: rgba(255,255,255,.07); color: var(--text); border-color: rgba(255,255,255,.2); }

.btn-ghost-sm { background: none; border: none; color: var(--text-muted); font-size: .875rem; font-weight: 500; padding: .35rem .6rem; border-radius: 6px; transition: background .12s, color .12s; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; }
.btn-ghost-sm:hover { background: rgba(255,255,255,.07); color: var(--text); }

.btn-ghost-xs { background: none; border: none; color: var(--text-muted); font-size: .8rem; padding: .25rem .45rem; border-radius: 6px; transition: background .12s, color .12s; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; }
.btn-ghost-xs:hover { background: rgba(255,255,255,.07); color: var(--text); }

.btn-approve { background: rgba(52,211,153,0.12); border: 1px solid rgba(52,211,153,0.35); color: #6ee7b7; border-radius: 6px; font-size: .8rem; padding: 4px 14px; cursor: pointer; transition: background .2s; }
.btn-approve:hover { background: rgba(52,211,153,0.24); color: #6ee7b7; }

.btn-reject  { background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.28); color: #fca5a5; border-radius: 6px; font-size: .8rem; padding: 4px 14px; cursor: pointer; transition: background .2s; }
.btn-reject:hover  { background: rgba(239,68,68,0.18); color: #fca5a5; }

/* ── 8. Badges ──────────────────────────────────────────────── */

.category-badge {
    display: inline-block; font-family: var(--font-mono); font-size: .66rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: .06em; color: var(--text-accent);
    background: var(--primary-light); padding: .25rem .75rem; border-radius: 100px;
    text-decoration: none; transition: background .15s;
    border: 1px solid rgba(149,128,255,0.2);
}
.category-badge:hover { background: rgba(149,128,255,0.25); color: #c0b5ff; }

.category-badge-sm {
    display: inline-block; font-family: var(--font-mono); font-size: .62rem; font-weight: 600;
    text-transform: uppercase; letter-spacing: .05em; color: var(--text-accent);
    background: var(--primary-light); padding: .15rem .55rem; border-radius: 100px;
    text-decoration: none; transition: background .15s; margin-bottom: .5rem;
    border: 1px solid rgba(149,128,255,0.15);
}
.category-badge-sm:hover { background: rgba(149,128,255,0.25); }

.badge-live  { display: inline-block; font-size: .65rem; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; padding: .2rem .55rem; border-radius: 100px; background: rgba(48,209,88,.12); color: #30d158; }
.badge-draft { display: inline-block; font-size: .65rem; font-weight: 600; font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; padding: .2rem .55rem; border-radius: 100px; background: rgba(255,214,10,.1); color: #ffd60a; }

/* ── 9. Blog Hero ───────────────────────────────────────────── */

.blog-hero {
    padding: 4rem 1.5rem 2.5rem;
    text-align: center;
    max-width: 680px;
    margin: 0 auto;
}
.blog-hero-eyebrow {
    font-family: var(--font-mono);
    font-size: .68rem; color: rgba(149,128,255,0.5);
    letter-spacing: .12em; text-transform: uppercase; margin-bottom: .75rem;
}
.blog-hero-title {
    font-family: var(--font-serif);
    font-size: clamp(2.25rem, 5vw, 3.5rem);
    font-weight: 700; line-height: 1.15;
    color: var(--text); margin-bottom: .75rem;
}
.blog-hero-sub { font-size: .9rem; color: var(--text-muted); }

/* Category filter strip */
.category-filter-row { display: flex; flex-wrap: wrap; gap: .5rem; padding: 0 1.5rem 2rem; max-width: 1200px; margin: 0 auto; }
.category-filter-item {
    font-family: var(--font-mono); font-size: .65rem;
    padding: .3rem .8rem; border-radius: 100px;
    border: 1px solid var(--border); color: var(--text-muted);
    text-decoration: none; transition: border-color .15s, color .15s, background .15s;
}
.category-filter-item:hover { border-color: rgba(149,128,255,0.3); color: var(--text-accent); background: var(--primary-light); }
.category-filter-item.active { border-color: var(--primary); color: var(--text-accent); background: var(--primary-light); }

/* ── 10. Posts Grid ─────────────────────────────────────────── */

.posts-grid-section { padding: 0 1.5rem 4rem; max-width: 1200px; margin: 0 auto; }
.posts-grid-header  { font-family: var(--font-mono); font-size: .65rem; font-weight: 600; text-transform: uppercase; letter-spacing: .1em; color: var(--text-muted); margin-bottom: 1rem; display: flex; align-items: center; }
.posts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }

/* Legacy blog-layout compat — blog.hbs no longer has its own sidebar */
.blog-layout { display: block; }
.blog-main   { min-width: 0; }

/* Hide featured section (feat post now rendered in grid) */
.featured-section { display: none; }

/* ── 11. Post Card ──────────────────────────────────────────── */

.post-card {
    background: var(--bg-surface); border-radius: var(--radius);
    overflow: hidden; border: 1px solid var(--border);
    transition: box-shadow .2s, transform .2s, border-color .2s;
    height: 100%; display: flex; flex-direction: column;
}
.post-card:hover {
    box-shadow: 0 0 24px var(--primary-light);
    transform: translateY(-2px);
    border-color: var(--primary-glow);
}

.post-card-img-link.post-card-img-placeholder { display: none; }
.post-card-img-link:not(.post-card-img-placeholder) { display: block; overflow: hidden; aspect-ratio: 16/9; }
.post-card-img { width: 100%; height: 100%; object-fit: cover; transition: transform .3s; }
.post-card:hover .post-card-img { transform: scale(1.04); }

.post-card-body { padding: 1.25rem; flex: 1; display: flex; flex-direction: column; }

/* Obsidian-style mono metadata line */
.post-card-meta-line {
    font-family: var(--font-mono);
    font-size: .7rem;
    color: rgba(149,128,255,0.5);
    margin-bottom: .5rem;
    letter-spacing: .02em;
}

.post-card-title { font-size: 1rem; font-weight: 600; line-height: 1.35; margin: 0 0 .5rem; }
.post-card-title a { color: var(--text); text-decoration: none; transition: color .15s; }
.post-card-title a:hover { color: var(--text-accent); }

.post-card-excerpt {
    font-size: .875rem; color: var(--text-secondary); line-height: 1.6;
    flex: 1; margin-bottom: .75rem;
    display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}

/* Legacy meta row (used in old blog.hbs) */
.post-card-meta { display: flex; align-items: center; justify-content: space-between; font-size: .75rem; color: var(--text-muted); margin-top: auto; border-top: 1px solid var(--border); padding-top: .65rem; font-family: var(--font-mono); }
.post-card-meta .meta-author { font-size: .75rem; gap: .4rem; }
.meta-right { display: flex; align-items: center; gap: .2rem; }

/* ── 12. Post Meta Shared ───────────────────────────────────── */

.post-meta    { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; font-size: .875rem; color: var(--text-secondary); font-family: var(--font-mono); }
.meta-author  { display: flex; align-items: center; gap: .5rem; color: var(--text); font-weight: 500; font-family: var(--font-sans); }
.meta-avatar  { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; }
.meta-avatar-initials { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, var(--primary) 0%, #5865f2 100%); color: #fff; font-size: .75rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.meta-avatar-xs { width: 24px; height: 24px; border-radius: 50%; object-fit: cover; }
.meta-avatar-initials-xs { width: 24px; height: 24px; border-radius: 50%; background: linear-gradient(135deg, var(--primary) 0%, #5865f2 100%); color: #fff; font-size: .65rem; font-weight: 700; display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
.meta-dot { color: rgba(255,255,255,0.2); }

/* ── 13. Single Post ────────────────────────────────────────── */

.post-container { max-width: 720px; }
.post-header    { padding: 3.5rem 0 2rem; }

.post-title {
    font-family: var(--font-serif);
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    font-weight: 700; line-height: 1.2;
    color: var(--text); margin-bottom: 1.25rem;
}

.post-feature-image-wrap { padding-bottom: 2rem; }
.post-feature-image { width: 100%; border-radius: var(--radius); object-fit: cover; max-height: 480px; border: 1px solid var(--border); }

.post-body { padding: 2rem 0; font-size: 1.05rem; line-height: 1.85; color: var(--text); }
.post-body h1,.post-body h2,.post-body h3 { font-family: var(--font-serif); margin-top: 2rem; margin-bottom: .75rem; color: var(--text); }
.post-body p { margin-bottom: 1.5rem; color: var(--text-secondary); }
.post-body p:first-of-type { color: var(--text); }
.post-body a { color: var(--text-accent); }
.post-body img { border-radius: var(--radius-sm); margin: 1rem 0; border: 1px solid var(--border); }
.post-body blockquote { border-left: 3px solid var(--primary); padding: .75rem 1.25rem; color: var(--text-muted); font-style: italic; margin: 1.5rem 0; background: var(--primary-light); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.post-body code { background: var(--primary-light); color: var(--text-accent); padding: .15em .4em; border-radius: 4px; font-family: var(--font-mono); font-size: .9em; }
.post-body pre  { background: var(--bg-surface); color: #cdd6f4; padding: 1.25rem; border-radius: var(--radius-sm); overflow-x: auto; margin: 1.5rem 0; border: 1px solid var(--border); font-family: var(--font-mono); }
.post-body pre code { background: none; color: inherit; padding: 0; }

.post-footer-row { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem 0; border-top: 1px solid var(--border); margin-bottom: 1rem; color: var(--text-muted); }

/* ── 14. Reactions ──────────────────────────────────────────── */

.reaction-bar { display: flex; flex-wrap: wrap; gap: .5rem; margin: 1.5rem 0; padding: 1rem 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.reaction-btn { display: inline-flex; align-items: center; gap: .35rem; padding: .3rem .85rem; background: rgba(255,255,255,0.04); border: 1px solid var(--border); border-radius: 20px; color: var(--text-secondary); font-size: .88rem; cursor: pointer; transition: background .15s, border-color .15s; line-height: 1; }
.reaction-btn:hover    { background: var(--primary-light); border-color: rgba(149,128,255,0.35); color: var(--text); }
.reaction-btn--active  { background: var(--primary-light); border-color: rgba(149,128,255,0.5); color: var(--text-accent); }
.reaction-count { font-size: .8rem; font-weight: 600; font-family: var(--font-mono); }

/* ── 15. Comments ───────────────────────────────────────────── */

.comments-section { background: var(--bg-surface); padding: 2.5rem 0 5rem; border-top: 1px solid var(--border); }
.comments-heading { font-size: 1.2rem; font-weight: 700; margin-bottom: 2rem; }
.comment-form-card { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; }
.comment-cta { background: var(--primary-light); border-radius: var(--radius); padding: 1rem 1.5rem; margin-bottom: 2rem; font-size: .9rem; color: var(--text-secondary); }
.comment-cta a { color: var(--text-accent); }
.comment-textarea { background: var(--bg-elevated) !important; border: 1px solid var(--border) !important; border-radius: var(--radius-sm) !important; color: var(--text) !important; resize: vertical; font-size: .9rem; transition: border-color .15s, box-shadow .15s; }
.comment-textarea::placeholder { color: var(--text-muted) !important; }
.comment-textarea:focus { border-color: var(--primary) !important; box-shadow: 0 0 0 3px var(--primary-light) !important; outline: none; }
.comment-list { display: flex; flex-direction: column; gap: 1.25rem; }
.comment-item { background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.25rem; }
.reply-item   { background: rgba(255,255,255,.02); }
.comment-meta    { font-size: .875rem; margin-bottom: .35rem; }
.comment-body    { font-size: .9375rem; line-height: 1.65; margin: .5rem 0; color: var(--text-secondary); }
.comment-actions { display: flex; gap: .5rem; margin-top: .5rem; }
.replies-list    { border-left: 2px solid var(--border); padding-left: 1rem; display: flex; flex-direction: column; gap: 1rem; }

/* ── 16. Chat ───────────────────────────────────────────────── */

.chat-layout { display: flex; flex-direction: column; height: calc(100vh - var(--nav-h)); max-width: 860px; margin: 0 auto; position: relative; }
.chat-header { border-bottom: 1px solid var(--border); padding: 1rem 1.5rem; flex-shrink: 0; background: var(--bg-surface); }
.chat-header-inner { display: flex; align-items: center; gap: .75rem; }
.chat-header-icon  { font-size: 1.4rem; }
.chat-header-title { font-weight: 700; font-size: 1rem; }
.chat-header-sub   { font-size: .72rem; color: var(--text-muted); font-family: var(--font-mono); letter-spacing: .06em; }
.chat-messages { flex: 1; overflow-y: auto; padding: 1rem 1.5rem; display: flex; flex-direction: column; gap: .15rem; }
.chat-msg { display: flex; align-items: flex-start; gap: .75rem; padding: .35rem .5rem; border-radius: var(--radius-sm); position: relative; }
.chat-msg:hover { background: rgba(255,255,255,0.025); }
.chat-msg:hover .chat-delete-btn { opacity: 1; }
.chat-avatar-img      { width: 34px; height: 34px; border-radius: 50%; object-fit: cover; flex-shrink: 0; }
.chat-avatar-initials { width: 34px; height: 34px; border-radius: 50%; background: var(--bg-elevated); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: .75rem; font-weight: 700; color: var(--primary); flex-shrink: 0; }
.chat-msg-content { flex: 1; min-width: 0; }
.chat-msg-meta    { display: flex; align-items: baseline; gap: .6rem; margin-bottom: .2rem; }
.chat-msg-author  { font-weight: 700; font-size: .85rem; color: var(--primary); text-decoration: none; }
.chat-msg-author:hover { text-decoration: underline; }
.chat-msg-time    { font-size: .68rem; color: var(--text-muted); font-family: var(--font-mono); }
.chat-msg-body    { font-size: .9rem; color: var(--text); line-height: 1.55; word-break: break-word; }
.chat-mention     { color: var(--text-accent); font-weight: 600; text-decoration: none; }
.chat-mention:hover { text-decoration: underline; }
.chat-delete-btn  { opacity: 0; transition: opacity .15s; background: none; border: none; color: var(--text-muted); cursor: pointer; padding: .25rem .4rem; border-radius: 4px; font-size: .8rem; flex-shrink: 0; align-self: center; }
.chat-delete-btn:hover { color: #fca5a5; background: rgba(239,68,68,0.1); }
.chat-input-bar   { border-top: 1px solid var(--border); padding: .75rem 1.5rem; display: flex; gap: .75rem; align-items: flex-end; flex-shrink: 0; }
.chat-input-wrap  { flex: 1; }
.chat-input { width: 100%; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); color: var(--text); font-family: var(--font-sans); font-size: .9rem; padding: .6rem .9rem; resize: none; line-height: 1.5; max-height: 120px; overflow-y: auto; transition: border-color .2s; }
.chat-input:focus { outline: none; border-color: var(--primary); }
.chat-send-btn { background: var(--primary-light); border: 1px solid rgba(149,128,255,0.3); border-radius: var(--radius-sm); color: var(--text-accent); width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: background .2s; }
.chat-send-btn:hover { background: rgba(149,128,255,0.25); }
.mention-dropdown  { display: none; position: absolute; bottom: 70px; left: 1.5rem; right: 1.5rem; background: var(--bg-elevated); border: 1px solid var(--border); border-radius: var(--radius-sm); overflow: hidden; z-index: 100; max-height: 200px; overflow-y: auto; }
.mention-item { padding: .5rem 1rem; font-size: .85rem; cursor: pointer; color: var(--text); transition: background .12s; }
.mention-item:hover, .mention-item.active { background: var(--primary-light); color: var(--text-accent); }
.chat-unread-badge { margin-left: auto; color: var(--primary); font-size: .65rem; line-height: 1; }

/* ── 17. Admin Pages ────────────────────────────────────────── */

.admin-page  { padding-top: 0; }
.admin-title { font-size: 1.75rem; font-weight: 700; }
.admin-table-wrap { background: var(--bg-surface); border-radius: var(--radius); border: 1px solid var(--border); overflow: hidden; }
.admin-table { margin-bottom: 0; font-size: .875rem; }
.admin-table thead th { font-family: var(--font-mono); font-size: .62rem; text-transform: uppercase; letter-spacing: .07em; color: var(--text-muted); font-weight: 600; background: var(--bg-elevated); border-bottom: 1px solid var(--border); padding: .75rem 1rem; }
.admin-table tbody td { padding: .875rem 1rem; vertical-align: middle; border-color: var(--border); color: var(--text-secondary); }
.admin-table tbody tr:hover td { background: rgba(255,255,255,.02); }
.admin-filters .form-select, .admin-filters .form-control { font-size: .875rem; }
.category-admin-card { display: flex; align-items: center; gap: .75rem; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: .875rem 1rem; transition: border-color .15s, box-shadow .15s; }
.category-admin-card:hover { border-color: var(--primary-glow); box-shadow: 0 0 12px var(--primary-light); }
.category-admin-icon { width: 36px; height: 36px; background: var(--primary-light); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--primary); font-size: 1rem; flex-shrink: 0; }

/* ── 18. Post Editor ────────────────────────────────────────── */

.post-title-input { font-family: var(--font-serif); font-size: 1.75rem !important; font-weight: 700; background: transparent !important; border: none !important; border-bottom: 2px solid var(--border) !important; border-radius: 0 !important; padding-left: 0 !important; box-shadow: none !important; color: var(--text) !important; }
.post-title-input::placeholder { color: var(--text-muted) !important; }
.post-title-input:focus { border-bottom-color: var(--primary) !important; }
.post-body-input { background: var(--bg-input) !important; border-color: var(--border) !important; color: var(--text) !important; border-radius: var(--radius-sm); font-size: .9375rem; line-height: 1.7; min-height: 400px; resize: vertical; }
.post-body-input::placeholder { color: var(--text-muted) !important; }
.post-body-input:focus { border-color: var(--primary) !important; box-shadow: 0 0 0 3px var(--primary-light) !important; }

/* Quill */
.ql-toolbar  { background: var(--bg-elevated) !important; border-color: var(--border) !important; border-radius: var(--radius-sm) var(--radius-sm) 0 0 !important; }
.ql-container { background: var(--bg-surface) !important; border-color: var(--border) !important; border-radius: 0 0 var(--radius-sm) var(--radius-sm) !important; min-height: 400px; }
.ql-editor   { color: var(--text) !important; font-family: var(--font-sans) !important; font-size: .9375rem !important; line-height: 1.7 !important; }
.ql-toolbar .ql-stroke { stroke: var(--text-muted) !important; }
.ql-toolbar .ql-fill   { fill:   var(--text-muted) !important; }
.ql-toolbar button:hover .ql-stroke, .ql-toolbar button.ql-active .ql-stroke { stroke: var(--primary) !important; }
.ql-toolbar button:hover .ql-fill,   .ql-toolbar button.ql-active .ql-fill   { fill:   var(--primary) !important; }
.ql-toolbar .ql-picker-label   { color: var(--text-muted) !important; }
.ql-toolbar .ql-picker-options { background: var(--bg-elevated) !important; border-color: var(--border) !important; }
.ql-editor.ql-blank::before    { color: var(--text-muted) !important; font-style: italic; }

/* ── 19. Forms (Bootstrap overrides) ───────────────────────── */

.form-control, .form-select { background: var(--bg-input) !important; border-color: var(--border) !important; color: var(--text) !important; }
.form-control::placeholder { color: var(--text-muted) !important; }
.form-control:focus, .form-select:focus { border-color: var(--primary) !important; box-shadow: 0 0 0 3px var(--primary-light) !important; }
.form-select option { background: var(--bg-elevated); }
.form-check-input:checked { background-color: var(--primary) !important; border-color: var(--primary) !important; }
.form-check-label { color: var(--text-secondary); }

.auth-page  { min-height: calc(100vh - var(--nav-h) - 80px); display: flex; align-items: center; padding: 3rem 0; }
.auth-card  { background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 2rem; }
.auth-card-header { margin-bottom: 1.75rem; }
.auth-title { font-family: var(--font-serif); font-size: 1.75rem; font-weight: 700; }
.auth-form .form-control { background: var(--bg-elevated) !important; border-color: var(--border) !important; color: var(--text) !important; border-radius: var(--radius-sm); font-size: .9375rem; }

/* ── 20. Profile ────────────────────────────────────────────── */

.profile-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 3px solid var(--border); }
.profile-avatar-initials { width: 72px; height: 72px; border-radius: 50%; background: linear-gradient(135deg, var(--primary) 0%, #5865f2 100%); color: #fff; font-size: 1.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; }

/* ── 21. Member Page ────────────────────────────────────────── */

.member-profile-header { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; }
.member-avatar { width: 72px; height: 72px; border-radius: 50%; object-fit: cover; border: 2px solid rgba(149,128,255,0.4); flex-shrink: 0; }
.member-avatar-initials { width: 72px; height: 72px; border-radius: 50%; background: var(--bg-elevated); border: 2px solid rgba(149,128,255,0.4); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; font-weight: 700; color: var(--primary); flex-shrink: 0; }
.member-name  { font-size: 1.5rem; font-weight: 700; margin: 0 0 .25rem; }
.member-since { color: var(--text-muted); font-size: .82rem; font-family: var(--font-mono); margin: 0 0 .4rem; }
.member-bio   { color: var(--text-secondary); font-style: italic; margin: 0; font-size: .9rem; }
.member-section-label { font-family: var(--font-mono); font-size: .68rem; letter-spacing: .12em; color: var(--primary); margin-bottom: .75rem; text-transform: uppercase; }
.member-posts-list { display: flex; flex-direction: column; gap: .5rem; }
.member-post-item  { display: flex; justify-content: space-between; align-items: center; padding: .75rem 1rem; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius-sm); text-decoration: none; transition: background .15s, border-color .15s; gap: 1rem; }
.member-post-item:hover { background: var(--bg-elevated); border-color: rgba(149,128,255,0.3); }
.member-post-title { color: var(--text); font-weight: 500; font-size: .9rem; }
.member-post-date  { color: var(--text-muted); font-size: .78rem; font-family: var(--font-mono); white-space: nowrap; flex-shrink: 0; }
.member-link:hover { color: var(--primary) !important; }

/* ── 22. About Page ─────────────────────────────────────────── */

.about-hero { background: var(--bg-surface); padding: 5rem 0 3rem; border-bottom: 1px solid var(--border); }
.about-avatar-wrap { display: flex; justify-content: center; }
.about-avatar-initials { width: 96px; height: 96px; border-radius: 50%; background: linear-gradient(135deg, var(--primary) 0%, #5865f2 100%); color: #fff; font-family: var(--font-serif); font-size: 2.5rem; font-weight: 700; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 32px var(--primary-glow); }
.about-name    { font-family: var(--font-serif); font-size: 2.5rem; font-weight: 800; margin-bottom: .25rem; }
.about-tagline { color: var(--text-muted); font-size: 1.05rem; }
.about-content { padding: 4rem 0 5rem; }
.about-prose   { font-size: 1.05rem; line-height: 1.8; color: var(--text-secondary); }
.about-prose .lead { font-size: 1.2rem; color: var(--text); }
.about-topic-card { display: flex; align-items: center; gap: .75rem; background: var(--bg-surface); border: 1px solid var(--border); border-radius: var(--radius); padding: .875rem 1rem; font-weight: 500; font-size: .9rem; color: var(--text); transition: border-color .15s; }
.about-topic-card:hover { border-color: rgba(149,128,255,0.35); }
.about-topic-card i { color: var(--primary); font-size: 1.25rem; }

/* ── 23. Error Page ─────────────────────────────────────────── */

.error-page   { min-height: calc(100vh - var(--nav-h) - 80px); display: flex; align-items: center; padding: 3rem 0; }
.error-number { font-family: var(--font-serif); font-size: clamp(6rem,15vw,10rem); font-weight: 800; color: var(--primary); line-height: 1; opacity: .12; margin-bottom: -1rem; }
.error-title  { font-family: var(--font-serif); font-size: 2rem; font-weight: 700; }

/* ── 24. Footer ─────────────────────────────────────────────── */

.site-footer { background: var(--bg-surface); border-top: 1px solid var(--border); }
.site-footer .fw-semibold { font-family: var(--font-sans); }
.site-footer .small       { font-family: var(--font-mono); font-size: .68rem; }

/* ── 25. Alerts / Misc ──────────────────────────────────────── */

.alert-success { background: rgba(48,209,88,.1) !important; color: #30d158 !important; border-color: rgba(48,209,88,.2) !important; }
.alert-danger  { background: rgba(255,69,58,.1) !important; color: #ff453a !important; border-color: rgba(255,69,58,.2) !important; }
.empty-state   { padding: 4rem 0; }

/* ── 26. Responsive ─────────────────────────────────────────── */

@media (max-width: 768px) {
    .nav-center { display: none !important; }
    .blog-hero  { padding: 2.5rem 1rem 1.5rem; }
    .posts-grid-section { padding: 0 1rem 3rem; }
    .category-filter-row { padding: 0 1rem 1.5rem; }
    .posts-grid { grid-template-columns: 1fr; }
    .post-header { padding: 2rem 0 1.25rem; }
    .post-body  { font-size: 1rem; }
    .auth-card  { padding: 1.5rem; }
    .chat-layout    { height: calc(100vh - var(--nav-h) - 60px); }
    .chat-messages  { padding: .75rem 1rem; }
    .chat-input-bar { padding: .6rem 1rem; }
    .mention-dropdown { left: 1rem; right: 1rem; }
}

@media (max-width: 480px) {
    .ctos-emblem { width: 140px; height: 140px; }
    .ctos-glyph  { font-size: 1.6rem; }
    .ctos-scan-line { width: 90px; }
    .gate-form-wrap { max-width: 100%; }
}
```

- [ ] **Step 2: Verify the server still starts**

```bash
cd /Users/allanmathewjohn/Downloads/Blog-Post-main
node server.js
```

Expected: `Server running on http://localhost:3000` with no errors. The CSS file has no syntax that Node reads — this step just confirms the file saved correctly and the dev server restarts cleanly.

- [ ] **Step 3: Commit**

```bash
git add public/css/main.css
git commit -m "feat: replace CSS with Obsidian × Apple × ctOS design system"
```

---

## Task 2: Gate Layout Template (Phase 2)

**Files:**
- Modify: `views/layouts/gate.hbs`

Update the font import to JetBrains Mono and remove Bootstrap (gate pages use no Bootstrap components).

- [ ] **Step 1: Replace `views/layouts/gate.hbs` entirely**

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Club9</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/main.css">
</head>
<body class="gate-body">
    {{{body}}}
</body>
</html>
```

- [ ] **Step 2: Open `http://localhost:3000/login` in a browser**

Expected: Black dot-grid background, placeholder page content visible (before emblem replacement). No Bootstrap styles, no Share Tech Mono. JetBrains Mono loading in Network tab.

- [ ] **Step 3: Commit**

```bash
git add views/layouts/gate.hbs
git commit -m "feat: update gate layout — JetBrains Mono, drop Bootstrap"
```

---

## Task 3: ctOS Hex Eye Emblem in Gate Pages (Phase 2)

**Files:**
- Modify: `views/login.hbs`
- Modify: `views/register.hbs`
- Modify: `views/pending.hbs`
- Modify: `views/rejected.hbs`
- Modify: `views/terms.hbs`

Replace `.gate-ring-wrap` markup in all five gate pages with the ctOS emblem. `login.hbs` gets the full-size emblem; all others get the smaller variant (`.ctos-emblem-sm`).

The reusable emblem snippets are:

**Full-size emblem** (for `login.hbs`):
```html
<div class="ctos-emblem-wrap">
    <div class="ctos-emblem">
        <svg class="ctos-outer-hex" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="90,6 166,48 166,132 90,174 14,132 14,48"
                stroke="#00d4ff" stroke-width="1" stroke-dasharray="6 3" opacity="0.6"/>
            <line x1="90"  y1="6"   x2="90"  y2="18"  stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
            <line x1="166" y1="48"  x2="155" y2="54"  stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
            <line x1="166" y1="132" x2="155" y2="126" stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
            <line x1="90"  y1="174" x2="90"  y2="162" stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
            <line x1="14"  y1="132" x2="25"  y2="126" stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
            <line x1="14"  y1="48"  x2="25"  y2="54"  stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
        </svg>
        <svg class="ctos-inner-hex" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="90,28 148,62 148,118 90,152 32,118 32,62"
                stroke="#00d4ff" stroke-width="1.5" opacity="0.3"/>
        </svg>
        <div class="ctos-scan-line"></div>
        <div class="ctos-glyph">C9</div>
        <div class="ctos-corner ctos-corner-tl"></div>
        <div class="ctos-corner ctos-corner-tr"></div>
        <div class="ctos-corner ctos-corner-bl"></div>
        <div class="ctos-corner ctos-corner-br"></div>
        <div class="ctos-hud-label">CLUB.9 · ACCESS</div>
    </div>
</div>
```

**Small emblem** (for `register.hbs`, `pending.hbs`, `rejected.hbs`, `terms.hbs`):
```html
<div class="ctos-emblem-wrap">
    <div class="ctos-emblem ctos-emblem-sm">
        <svg class="ctos-outer-hex" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,4 110,32 110,88 60,116 10,88 10,32"
                stroke="#00d4ff" stroke-width="1" stroke-dasharray="5 3" opacity="0.5"/>
        </svg>
        <svg class="ctos-inner-hex" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,20 96,42 96,78 60,100 24,78 24,42"
                stroke="#00d4ff" stroke-width="1.5" opacity="0.3"/>
        </svg>
        <div class="ctos-scan-line"></div>
        <div class="ctos-glyph">C9</div>
        <div class="ctos-corner ctos-corner-tl"></div>
        <div class="ctos-corner ctos-corner-tr"></div>
        <div class="ctos-corner ctos-corner-bl"></div>
        <div class="ctos-corner ctos-corner-br"></div>
        <div class="ctos-hud-label">CLUB.9 · ACCESS</div>
    </div>
</div>
```

- [ ] **Step 1: Replace `views/login.hbs` entirely**

```hbs
<div class="gate-wrap">

    <div class="ctos-emblem-wrap">
        <div class="ctos-emblem">
            <svg class="ctos-outer-hex" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="90,6 166,48 166,132 90,174 14,132 14,48"
                    stroke="#00d4ff" stroke-width="1" stroke-dasharray="6 3" opacity="0.6"/>
                <line x1="90"  y1="6"   x2="90"  y2="18"  stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
                <line x1="166" y1="48"  x2="155" y2="54"  stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
                <line x1="166" y1="132" x2="155" y2="126" stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
                <line x1="90"  y1="174" x2="90"  y2="162" stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
                <line x1="14"  y1="132" x2="25"  y2="126" stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
                <line x1="14"  y1="48"  x2="25"  y2="54"  stroke="#00d4ff" stroke-width="1.5" opacity="0.9"/>
            </svg>
            <svg class="ctos-inner-hex" viewBox="0 0 180 180" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="90,28 148,62 148,118 90,152 32,118 32,62"
                    stroke="#00d4ff" stroke-width="1.5" opacity="0.3"/>
            </svg>
            <div class="ctos-scan-line"></div>
            <div class="ctos-glyph">C9</div>
            <div class="ctos-corner ctos-corner-tl"></div>
            <div class="ctos-corner ctos-corner-tr"></div>
            <div class="ctos-corner ctos-corner-bl"></div>
            <div class="ctos-corner ctos-corner-br"></div>
            <div class="ctos-hud-label">CLUB.9 · ACCESS</div>
        </div>
    </div>

    <div class="gate-form-wrap">
        {{#if errorMessage}}
        <p class="gate-error">{{errorMessage}}</p>
        {{/if}}

        <form method="POST" action="/login" class="gate-form">
            <div class="gate-field">
                <label class="gate-label">EMAIL</label>
                <input type="email" name="email" class="gate-input" value="{{email}}"
                    placeholder="your@email.com" required autofocus autocomplete="email">
            </div>
            <div class="gate-field">
                <label class="gate-label">PASSWORD</label>
                <input type="password" name="password" class="gate-input"
                    placeholder="••••••••" required autocomplete="current-password">
            </div>
            <button type="submit" class="gate-btn">ENTER</button>
        </form>

        <p class="gate-switch">
            No account? <a href="/register">Register</a>
        </p>
    </div>

</div>
```

- [ ] **Step 2: Open `http://localhost:3000/login`**

Expected: Cyan ctOS hex eye with rotating hexagon rings, scan line, "C9" glyph glowing cyan. Corner brackets blinking at corners. "CLUB.9 · ACCESS" text below. Email/password form in cyan style beneath.

- [ ] **Step 3: Replace `views/pending.hbs` entirely**

```hbs
<div class="gate-wrap">
    <div class="ctos-emblem-wrap">
        <div class="ctos-emblem ctos-emblem-sm">
            <svg class="ctos-outer-hex" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="60,4 110,32 110,88 60,116 10,88 10,32"
                    stroke="#00d4ff" stroke-width="1" stroke-dasharray="5 3" opacity="0.5"/>
            </svg>
            <svg class="ctos-inner-hex" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <polygon points="60,20 96,42 96,78 60,100 24,78 24,42"
                    stroke="#00d4ff" stroke-width="1.5" opacity="0.3"/>
            </svg>
            <div class="ctos-scan-line"></div>
            <div class="ctos-glyph">C9</div>
            <div class="ctos-corner ctos-corner-tl"></div>
            <div class="ctos-corner ctos-corner-tr"></div>
            <div class="ctos-corner ctos-corner-bl"></div>
            <div class="ctos-corner ctos-corner-br"></div>
            <div class="ctos-hud-label">CLUB.9 · ACCESS</div>
        </div>
    </div>
    <div class="gate-form-wrap">
        <div class="status-gate-icon">&#x23F3;</div>
        <h2 class="status-gate-heading">APPLICATION PENDING</h2>
        <p class="status-gate-body">
            Your membership request has been received.<br>
            You will gain access once it has been reviewed.<br>
            This usually takes less than 24 hours.
        </p>
        <a href="/auth/refresh-status" class="gate-btn mt-3">CHECK AGAIN</a>
        <p class="gate-switch mt-3">
            Signed in as <strong>{{session.user.username}}</strong>
            &middot; <a href="/logout">Sign out</a>
        </p>
    </div>
</div>
```

- [ ] **Step 4: Replace `views/rejected.hbs` entirely**

Read the current file first to preserve the rejection message text, then replace the gate-ring-wrap block with the small ctOS emblem:

```bash
cat /Users/allanmathewjohn/Downloads/Blog-Post-main/views/rejected.hbs
```

Then write the file, replacing only the `.gate-ring-wrap` div with:
```html
<div class="ctos-emblem-wrap">
    <div class="ctos-emblem ctos-emblem-sm">
        <svg class="ctos-outer-hex" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,4 110,32 110,88 60,116 10,88 10,32"
                stroke="#00d4ff" stroke-width="1" stroke-dasharray="5 3" opacity="0.5"/>
        </svg>
        <svg class="ctos-inner-hex" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,20 96,42 96,78 60,100 24,78 24,42"
                stroke="#00d4ff" stroke-width="1.5" opacity="0.3"/>
        </svg>
        <div class="ctos-scan-line"></div>
        <div class="ctos-glyph">C9</div>
        <div class="ctos-corner ctos-corner-tl"></div>
        <div class="ctos-corner ctos-corner-tr"></div>
        <div class="ctos-corner ctos-corner-bl"></div>
        <div class="ctos-corner ctos-corner-br"></div>
        <div class="ctos-hud-label">CLUB.9 · ACCESS</div>
    </div>
</div>
```

- [ ] **Step 5: Apply the same emblem replacement to `views/terms.hbs`**

Read the file first:
```bash
cat /Users/allanmathewjohn/Downloads/Blog-Post-main/views/terms.hbs
```
Replace only the `.gate-ring-wrap` block with the small emblem HTML from Step 4.

- [ ] **Step 6: Apply the same emblem replacement to `views/register.hbs`**

Read the file first:
```bash
cat /Users/allanmathewjohn/Downloads/Blog-Post-main/views/register.hbs
```
Replace only the `.gate-ring-wrap` block with the small emblem HTML from Step 4. Keep all form fields (avatar picker, username generator, email, password) unchanged.

- [ ] **Step 7: Verify all gate pages**

```bash
# Start server if not running
node server.js
```

Visit each URL and confirm the small ctOS emblem appears on each:
- `http://localhost:3000/register` — small emblem + registration form
- `http://localhost:3000/pending` (log in as a pending user, or temporarily set session) — small emblem + pending message
- `http://localhost:3000/rejected` — small emblem + rejected message
- `http://localhost:3000/terms` — small emblem + terms form

- [ ] **Step 8: Commit**

```bash
git add views/login.hbs views/register.hbs views/pending.hbs views/rejected.hbs views/terms.hbs
git commit -m "feat: replace gate ring with ctOS Hex Eye emblem across all gate pages"
```

---

## Task 4: Main Layout Rewrite (Phase 3)

**Files:**
- Modify: `views/layouts/main.hbs` (complete replacement)

Replace the Bootstrap collapse navbar with a custom nav bar + toggle sidebar. The sidebar uses the existing `navLink` Handlebars helper (which already adds `.active` to the current route's link) — no server-side changes needed.

The unread-badge fetch (previously only on blog.hbs) moves here so it works on every page.

- [ ] **Step 1: Replace `views/layouts/main.hbs` entirely**

```hbs
<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{#if title}}{{title}} — {{/if}}Club9</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css" rel="stylesheet">
    <link rel="stylesheet" href="/css/main.css">
</head>
<body>

<!-- Sidebar overlay (click to close) -->
<div class="sidebar-overlay" id="sidebarOverlay"></div>

<!-- Toggle Sidebar -->
<aside class="site-sidebar" id="siteSidebar">
    <div class="sidebar-header">
        <span class="sidebar-header-brand">Club<em>9</em></span>
        <button class="sidebar-close" id="sidebarClose" aria-label="Close sidebar">&times;</button>
    </div>
    <nav class="sidebar-nav">
        <div class="sidebar-section">
            <div class="sidebar-section-label">Browse</div>
            {{#navLink "/blog"}}<i class="bi bi-journal-text"></i> All Posts{{/navLink}}
            {{#navLink "/categories"}}<i class="bi bi-tags"></i> Categories{{/navLink}}
        </div>
        <div class="sidebar-section">
            <div class="sidebar-section-label">Community</div>
            {{#navLink "/chat"}}<i class="bi bi-chat-fill"></i> The Room
                <span class="sidebar-unread-dot" id="sidebarUnreadDot" style="display:none">&#x25CF;</span>
            {{/navLink}}
        </div>
        <div class="sidebar-section">
            <div class="sidebar-section-label">You</div>
            {{#navLink "/posts/add"}}<i class="bi bi-pencil-square"></i> Write{{/navLink}}
            {{#navLink "/profile"}}<i class="bi bi-person"></i> Profile{{/navLink}}
            {{#navLink "/posts"}}<i class="bi bi-grid-3x3-gap"></i> Dashboard{{/navLink}}
            {{#if session.user.isAdmin}}
            {{#navLink "/admin/approvals"}}<i class="bi bi-person-check"></i> Approvals{{/navLink}}
            {{/if}}
        </div>
    </nav>
</aside>

<!-- Navbar -->
<nav class="site-nav" id="siteNav">
    <div class="container">
        <button class="sidebar-toggle" id="sidebarToggle" aria-label="Open menu">
            <i class="bi bi-list"></i>
        </button>
        <a class="brand-logo" href="/blog">Club<em>9</em></a>
        <div class="nav-center d-none d-md-flex">
            {{#navLink "/blog"}}Blog{{/navLink}}
            {{#navLink "/about"}}About{{/navLink}}
        </div>
        <div class="nav-actions">
            <a href="/posts/add" class="nav-write-btn">&#x270E; Write</a>
            <div class="dropdown">
                <button class="btn-avatar" data-bs-toggle="dropdown" aria-expanded="false">
                    {{#if session.user.avatar_url}}
                    <img src="{{session.user.avatar_url}}" alt="avatar" class="avatar-sm">
                    {{else}}
                    <span class="avatar-initials">{{avatarInitial session.user.username}}</span>
                    {{/if}}
                </button>
                <ul class="dropdown-menu dropdown-menu-end border-0 mt-2">
                    <li>
                        <span class="dropdown-item-text text-muted small fw-medium px-3 d-flex align-items-center gap-2">
                            {{session.user.username}}
                            {{#if session.user.isAdmin}}<span class="admin-badge">ADMIN</span>{{/if}}
                        </span>
                    </li>
                    <li><hr class="dropdown-divider my-1"></li>
                    <li><a class="dropdown-item" href="/posts"><i class="bi bi-grid-3x3-gap me-2 text-muted"></i>Dashboard</a></li>
                    <li><a class="dropdown-item" href="/admin/approvals"><i class="bi bi-person-check me-2 text-muted"></i>Approvals</a></li>
                    <li><a class="dropdown-item" href="/chat"><i class="bi bi-chat me-2 text-muted"></i>The Room</a></li>
                    <li><a class="dropdown-item" href="/categories"><i class="bi bi-tags me-2 text-muted"></i>Categories</a></li>
                    <li><a class="dropdown-item" href="/profile"><i class="bi bi-person me-2 text-muted"></i>Profile</a></li>
                    <li><hr class="dropdown-divider my-1"></li>
                    <li><a class="dropdown-item text-danger" href="/logout"><i class="bi bi-box-arrow-right me-2"></i>Sign out</a></li>
                </ul>
            </div>
        </div>
    </div>
</nav>

<!-- Main content -->
<main class="main-content">
    {{{body}}}
</main>

<!-- Footer -->
<footer class="site-footer">
    <div class="container">
        <div class="row align-items-center py-4">
            <div class="col-md-6">
                <span class="fw-semibold">Club<em style="color:var(--primary);font-style:normal">9</em></span>
                <span class="text-muted ms-2 small">— Exclusive. Anonymous. Yours.</span>
            </div>
            <div class="col-md-6 text-md-end mt-2 mt-md-0">
                <span class="text-muted small">&copy; 2025 Club9</span>
            </div>
        </div>
    </div>
</footer>

<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js"></script>
<script>
(function () {
    var toggle   = document.getElementById('sidebarToggle');
    var sidebar  = document.getElementById('siteSidebar');
    var overlay  = document.getElementById('sidebarOverlay');
    var closeBtn = document.getElementById('sidebarClose');

    function openSidebar()  { sidebar.classList.add('open');    overlay.classList.add('open'); }
    function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('open'); }

    if (toggle)   toggle.addEventListener('click', openSidebar);
    if (overlay)  overlay.addEventListener('click', closeSidebar);
    if (closeBtn) closeBtn.addEventListener('click', closeSidebar);

    // Unread dot on chat sidebar link
    var dot = document.getElementById('sidebarUnreadDot');
    if (dot) {
        var lastSeen = parseInt(localStorage.getItem('club9_last_msg') || '0', 10);
        fetch('/chat/unread-count')
            .then(function (r) { return r.json(); })
            .then(function (d) { if (d.latestId && d.latestId > lastSeen) dot.style.display = 'inline'; })
            .catch(function () {});
    }
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Open `http://localhost:3000/blog` and verify the nav**

Expected:
- Hamburger `☰` button on the left of the nav bar
- `Club9` logo (inter, "9" in purple) in the centre-left
- `Blog` and `About` text links in the middle (desktop only)
- `✎ Write` button (mono font, purple border) and avatar dropdown on the right
- Clicking `☰` slides in the sidebar from the left; clicking the overlay or `×` closes it
- Sidebar shows: Browse (All Posts, Categories), Community (The Room), You (Write, Profile, Dashboard)
- Active link has a purple left border

- [ ] **Step 3: Commit**

```bash
git add views/layouts/main.hbs
git commit -m "feat: replace Bootstrap navbar with custom frosted-glass nav + toggle sidebar"
```

---

## Task 5: Blog Feed Redesign (Phase 4)

**Files:**
- Modify: `views/blog.hbs` (complete replacement)

Remove the always-open category sidebar. Add a hero banner and horizontal category filter strip. Render `featuredPost` (first post, from server) as the first grid card and `recentPosts` (rest) as the remaining cards. Remove the unread-badge script (now handled by `main.hbs`).

- [ ] **Step 1: Replace `views/blog.hbs` entirely**

```hbs
<div class="blog-main">

    <!-- Hero -->
    <div class="blog-hero">
        <div class="blog-hero-eyebrow">// members only &middot; vault open</div>
        <h1 class="blog-hero-title">The Vault</h1>
        <p class="blog-hero-sub">Exclusive. Anonymous. Yours.</p>
    </div>

    <!-- Category filter strip -->
    {{#if categories.length}}
    <div class="category-filter-row">
        <a href="/blog" class="category-filter-item {{#unless activeCategory}}active{{/unless}}">
            All Posts
        </a>
        {{#each categories}}
        <a href="/blog?category={{id}}" class="category-filter-item {{#equal id ../activeCategory}}active{{/equal}}">
            {{name}}
        </a>
        {{/each}}
    </div>
    {{/if}}

    <!-- Posts grid -->
    <section class="posts-grid-section">

        {{#if message}}
        <div class="empty-state text-center py-5">
            <i class="bi bi-journal-x display-1 text-muted"></i>
            <h3 class="mt-3 text-muted">No posts yet</h3>
            <p class="text-muted">Check back soon for new content.</p>
            {{#if session.user}}
            <a href="/posts/add" class="btn btn-primary rounded-pill mt-2">Write the first post</a>
            {{/if}}
        </div>
        {{else}}
        <div class="posts-grid">

            {{! Featured post — first card in grid }}
            {{#if featuredPost}}
            <article class="post-card">
                {{#if featuredPost.feature_image}}
                <a href="/blog/{{featuredPost.id}}" class="post-card-img-link">
                    <img src="{{featuredPost.feature_image}}" alt="{{featuredPost.title}}" class="post-card-img">
                </a>
                {{/if}}
                <div class="post-card-body">
                    {{#if featuredPost.categories}}
                    <a href="/blog?category={{featuredPost.categories.id}}" class="category-badge-sm">{{featuredPost.categories.name}}</a>
                    {{/if}}
                    <div class="post-card-meta-line">author::{{featuredPost.profiles.username}} &middot; {{timeAgo featuredPost.created_at}} &middot; {{readTime featuredPost.body}}</div>
                    <h2 class="post-card-title">
                        <a href="/blog/{{featuredPost.id}}">{{featuredPost.title}}</a>
                    </h2>
                    <p class="post-card-excerpt">{{excerpt featuredPost.body 160}}</p>
                </div>
            </article>
            {{/if}}

            {{! Remaining posts }}
            {{#each recentPosts}}
            <article class="post-card">
                {{#if feature_image}}
                <a href="/blog/{{id}}" class="post-card-img-link">
                    <img src="{{feature_image}}" alt="{{title}}" class="post-card-img">
                </a>
                {{/if}}
                <div class="post-card-body">
                    {{#if categories}}
                    <a href="/blog?category={{categories.id}}" class="category-badge-sm">{{categories.name}}</a>
                    {{/if}}
                    <div class="post-card-meta-line">author::{{profiles.username}} &middot; {{timeAgo created_at}} &middot; {{readTime body}}</div>
                    <h2 class="post-card-title">
                        <a href="/blog/{{id}}">{{title}}</a>
                    </h2>
                    <p class="post-card-excerpt">{{excerpt body 120}}</p>
                </div>
            </article>
            {{/each}}

        </div>
        {{/if}}

    </section>
</div>
```

- [ ] **Step 2: Open `http://localhost:3000/blog` and verify**

Expected:
- Large "The Vault" heading in Playfair Display serif
- `// members only · vault open` in small mono above it
- Category pills below hero (All Posts highlighted if no filter active)
- Post cards: no images (unless a post has a feature image), mono metadata line `author::username · 2 days ago · 3 min`, Inter 600 title, muted excerpt
- Cards have dark charcoal bg with subtle border; hover gives purple glow + lifts 2px
- No left sidebar anywhere on the page

- [ ] **Step 3: Commit**

```bash
git add views/blog.hbs
git commit -m "feat: redesign blog feed — hero banner, category filter strip, Obsidian post cards"
```

---

## Task 6: Post View + Reaction Escaping Fix (Phase 4)

**Files:**
- Modify: `views/post.hbs`

Fix a silent JS bug where `{{reactionCounts}}` and `{{userReactions}}` use double-braces which HTML-escape the JSON double-quotes, breaking `JSON.parse` and silently preventing the reaction bar from rendering. Also update the post header metadata to use JetBrains Mono style.

- [ ] **Step 1: Find the broken reaction script lines in `views/post.hbs`**

Look at lines ~213–214. They read:
```javascript
var counts      = JSON.parse('{{reactionCounts}}');
var userReacted = JSON.parse('{{userReactions}}');
```

- [ ] **Step 2: Fix the escaping bug**

Replace those two lines with:
```javascript
var counts      = {{{reactionCounts}}};
var userReacted = {{{userReactions}}};
```

Triple braces tell Handlebars not to HTML-escape the value. Since `JSON.stringify({fire:0,...})` produces valid JS object/array literal syntax, we can drop `JSON.parse` entirely and assign the value directly.

- [ ] **Step 3: Update the post metadata line to Obsidian mono style**

Find this block in `post.hbs` (around line 11–23):
```html
<div class="post-meta mb-4">
    <div class="meta-author">
        {{#if post.profiles.avatar_url}}
        <img src="{{post.profiles.avatar_url}}" class="meta-avatar" alt="author">
        {{else}}
        <span class="meta-avatar-initials">{{avatarInitial post.profiles.username}}</span>
        {{/if}}
        <div>
            <div class="fw-medium"><a href="/member/{{post.profiles.username}}" class="fw-medium text-decoration-none text-body member-link">{{post.profiles.username}}</a></div>
            <div class="text-muted small">{{formatDate post.created_at}} · {{readTime post.body}}</div>
        </div>
    </div>
</div>
```

Replace it with:
```html
<div class="post-meta mb-4" style="font-family:var(--font-mono);font-size:.78rem;color:rgba(149,128,255,0.55);">
    author::<a href="/member/{{post.profiles.username}}" class="text-decoration-none member-link" style="color:rgba(149,128,255,0.7);">{{post.profiles.username}}</a>
    &nbsp;&middot;&nbsp;{{formatDate post.created_at}}
    &nbsp;&middot;&nbsp;{{readTime post.body}}
</div>
```

- [ ] **Step 4: Verify reactions work**

Open any post. The reaction bar (`🔥 ❤️ 👁️ ✨ 🖤`) should appear immediately with counts. Clicking a reaction should toggle it with a purple active state. Open browser DevTools → Console and confirm no errors about `JSON.parse` or undefined counts.

- [ ] **Step 5: Commit**

```bash
git add views/post.hbs
git commit -m "fix: use triple-brace Handlebars to prevent JSON escaping in reactions; update post meta to mono style"
```

---

## Task 7: Verify Content & Chat Pages (Phase 4 wrap-up)

**Files:**
- No template changes — CSS token cascade handles everything.
- Verify: `views/chat.hbs`, `views/profile.hbs`, `views/member.hbs`

All visual updates to these pages are handled by the CSS token changes in Task 1. This task is pure verification.

- [ ] **Step 1: Verify The Room (`/chat`)**

Open `http://localhost:3000/chat`. Confirm:
- Background is `#0d0d12` charcoal with faint dot grid
- Chat header has dark surface bg with border
- Usernames in purple (`#9580ff`)
- Timestamps in JetBrains Mono, muted
- Input field has purple focus border
- Send button is purple-tinted (not solid purple)
- Send works (type a message, press Enter or click send — message appears)

- [ ] **Step 2: Verify Profile (`/profile`)**

Open `http://localhost:3000/profile`. Confirm:
- Charcoal background with dot grid
- Avatar circle uses purple gradient
- Form inputs have dark elevated bg, purple focus ring

- [ ] **Step 3: Verify Member page (`/member/:username`)**

Open any member profile. Confirm:
- Member avatar border is purple
- Section labels in JetBrains Mono uppercase purple
- Post list items have dark surface bg, purple hover border

- [ ] **Step 4: No commit needed** — this is verification only. If anything looks wrong, trace it back to the relevant CSS section from Task 1 and fix inline, then commit with: `git commit -m "fix: correct CSS for [component]"`

---

## Task 8: Admin Pages Verification (Phase 5)

**Files:**
- No template changes — CSS token cascade handles everything.
- Verify: `views/posts.hbs`, `views/addPost.hbs`, `views/admin/approvals.hbs`, `views/categories.hbs`

- [ ] **Step 1: Verify Posts Dashboard (`/posts`)**

Open `http://localhost:3000/posts`. Confirm:
- Table rows on dark surface bg
- Table headers in JetBrains Mono uppercase, muted purple
- `LIVE` badge is green, `DRAFT` badge is yellow (unchanged)
- Filter dropdowns have dark bg with purple focus ring
- New Post button is purple

- [ ] **Step 2: Verify Add Post (`/posts/add`)**

Open `http://localhost:3000/posts/add`. Confirm:
- Quill toolbar has `var(--bg-elevated)` dark bg
- Quill content area has `var(--bg-surface)` bg
- Toolbar icons visible (grey), turn purple on hover/active
- Title input is Playfair Display with purple underline on focus

- [ ] **Step 3: Verify Approvals (`/admin/approvals`)**

Open `http://localhost:3000/admin/approvals` (as admin user). Confirm:
- Approval queue table renders on dark surface
- Approve button is green-tinted, Reject button is red-tinted (unchanged from sprint 1)

- [ ] **Step 4: Verify Categories (`/categories`)**

Open `http://localhost:3000/categories`. Confirm:
- Category cards have dark surface bg with subtle border
- Hover gives purple glow
- Category icon background is purple-tinted

- [ ] **Step 5: Final commit if any fixes made, then tag**

```bash
# Only if fixes were made:
git add <changed files>
git commit -m "fix: polish admin page styles"

# Tag the redesign milestone
git tag -a v2.0.0 -m "Club9 premium UI redesign — Obsidian × Apple × ctOS"
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Task |
|---|---|
| Color system / CSS tokens | Task 1 |
| Typography (JetBrains Mono, Playfair, Inter) | Task 1 + Task 2 |
| ctOS Hex Eye emblem (login) | Task 3 |
| ctOS emblem smaller (pending/rejected/terms/register) | Task 3 |
| Gate form — cyan palette | Task 1 |
| Navbar — frosted glass, always visible border | Task 1 + Task 4 |
| Sidebar toggle | Task 4 |
| Sidebar active item detection via navLink | Task 4 |
| Unread badge on sidebar chat link | Task 4 |
| Blog hero + category filter | Task 5 |
| Post cards — mono metadata, purple hover glow | Task 1 + Task 5 |
| Post view — centered layout, Playfair heading | Task 1 + Task 6 |
| Reaction bar — purple active state | Task 1 + Task 6 (bug fix) |
| Chat — purple mentions, mono timestamps | Task 1 + Task 7 |
| Admin pages — token cascade | Task 1 + Task 8 |
| Dot-grid background on main content | Task 1 |
| Footer — dark surface, mono copyright | Task 1 + Task 4 |

All spec requirements covered. No gaps found.
