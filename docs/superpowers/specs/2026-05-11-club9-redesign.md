# Club9 Premium UI/UX Redesign — Design Spec

**Date:** 2026-05-11
**Status:** Approved

---

## Summary

Full visual overhaul of Club9 (Express/Handlebars/Supabase). The site is currently Bootstrap 5 dark mode with indigo accents. The redesign replaces it with a custom design system inspired by three sources:

- **Apple** — frosted glass nav, generous whitespace, clean layout hierarchy
- **Obsidian** — deep charcoal palette, Obsidian purple `#9580ff`, dot-grid backgrounds, JetBrains Mono metadata
- **Watch Dogs ctOS** — cyan HUD aesthetic for the login/gate emblem only; creates a deliberate "hacking your way in" feel at the gate

The app structure stays unchanged (routes, Supabase, session auth). Only CSS and templates change.

---

## 1. Color System

### CSS Custom Properties (replaces all existing variables in `main.css`)

```css
/* Backgrounds */
--bg:            #0d0d12;   /* deep charcoal — replaces pure black */
--bg-surface:    #13131a;   /* card/panel surfaces */
--bg-elevated:   #1a1a24;   /* hover states, dropdowns */
--bg-overlay:    rgba(13, 13, 18, 0.85); /* frosted glass base */

/* Borders */
--border:        rgba(255, 255, 255, 0.06);
--border-focus:  rgba(149, 128, 255, 0.35);

/* Obsidian Purple — primary accent (main app) */
--primary:       #9580ff;
--primary-light: #c0b5ff;
--primary-dim:   rgba(149, 128, 255, 0.15);
--primary-glow:  rgba(149, 128, 255, 0.25);

/* ctOS Cyan — gate pages only */
--ctos:          #00d4ff;
--ctos-dim:      rgba(0, 212, 255, 0.15);
--ctos-glow:     rgba(0, 212, 255, 0.3);

/* Text */
--text:          #f0eeff;   /* slightly warm white */
--text-secondary: rgba(255, 255, 255, 0.6);
--text-muted:    rgba(255, 255, 255, 0.35);
--text-accent:   #c0b5ff;

/* Dot grid pattern (applied as background on content areas) */
--dot-grid: radial-gradient(circle, rgba(149, 128, 255, 0.07) 1px, transparent 1px);
--dot-size: 20px 20px;
```

### Color Story

| Context | Accent | Rationale |
|---|---|---|
| Gate pages (login, register, pending, rejected, terms) | `--ctos` cyan `#00d4ff` | Surveillance / hacking into the system feel |
| Main app (all other pages) | `--primary` purple `#9580ff` | Obsidian inner vault, knowledge base |
| Admin badges | `#ff6b6b` red | Danger / authority, unchanged |

---

## 2. Typography

### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-serif: 'Playfair Display', Georgia, serif;
--font-mono: 'JetBrains Mono', 'SF Mono', monospace;
```

Add to `main.hbs` Google Fonts import:
```
Inter:wght@300;400;500;600;700
Playfair Display:wght@700;800
JetBrains Mono:wght@400;500;600
```

### Usage Rules

| Element | Font | Weight | Notes |
|---|---|---|---|
| Body, UI labels, nav | Inter | 400/500 | |
| Post titles (feed) | Inter | 600 | |
| Post content headings | Playfair Display | 700 | Editorial feel |
| Post metadata (author, date, tags) | JetBrains Mono | 400 | `author::cipher · #tag · 3 min` |
| Timestamps in chat | JetBrains Mono | 400 | |
| Admin badges, HUD labels | JetBrains Mono | 600 | Uppercase, tracked |
| Nav brand "Club9" | Inter | 700 | Letter-spacing: -0.5px |

---

## 3. Gate Pages (login, register, pending, rejected, terms)

**Layout:** Full-screen, centered column, no nav, no sidebar. `gate.hbs` layout.

**Background:** `--bg` with dot-grid pattern (`--dot-grid`) and a radial gradient spotlight behind the emblem.

### 3a. The Hex Eye Emblem

The ctOS-inspired animated logo. Replaces the current `.gate-ring` / `.gate-logo-text` entirely.

**Structure:**
```
.ctos-emblem
  .ctos-outer-hex        (SVG, dashed hex, rotates CW 12s)
  .ctos-inner-hex        (SVG, solid hex, rotates CCW 7s)
  .ctos-scan-line        (horizontal bar, translates Y, cyan glow)
  .ctos-glyph            ("C9", JetBrains Mono, cyan text-shadow)
  .ctos-corner × 4       (TL, TR, BL, BR bracket corners)
  .ctos-hud-label        ("CLUB.9 · ACCESS", bottom, mono, dim cyan)
```

**Animations:**
- `.ctos-outer-hex`: `rotate(0→360deg)` 12s linear infinite
- `.ctos-inner-hex`: `rotate(0→-360deg)` 7s linear infinite
- `.ctos-scan-line`: `translateY(-60px→60px)` 2.4s ease-in-out infinite, opacity 0→1→0.6→0
- `.ctos-glyph`: `scale(1→1.08→1)` + opacity flicker at 4s ease-in-out infinite
- `.ctos-corner`: opacity 0.4→1→0.4 at 3s staggered

**Colors:** All cyan (`--ctos`). Glow via `box-shadow` and `text-shadow`.

### 3b. Gate Form

Below the emblem. Compact, centered, max-width 360px.

```
.gate-form-wrap
  .gate-error   (if errorMessage)
  form.gate-form
    .gate-field > label.gate-label + input.gate-input
    button.gate-btn  "ENTER" / "REGISTER"
  p.gate-switch  "No account? Register"
```

**Styles:**
- `.gate-input`: `background: rgba(0,212,255,0.04)`, `border: 1px solid rgba(0,212,255,0.15)`, mono font for placeholder, focus border `--ctos`
- `.gate-btn`: full-width, `background: rgba(0,212,255,0.1)`, `border: 1px solid --ctos`, cyan text, hover lifts brightness
- `.gate-label`: JetBrains Mono, uppercase, tracked, dim cyan

---

## 4. Main Layout (`main.hbs`)

### 4a. Top Navigation

```
nav.site-nav
  .container
    a.brand-logo "Club9"  (href="/blog")
    button.sidebar-toggle (☰ icon, triggers sidebar)
    .nav-center  (Blog, About links — hidden on mobile)
    .nav-actions  (Write button + avatar dropdown)
```

**Styles:**
- `background: var(--bg-overlay)`, `backdrop-filter: blur(20px) saturate(180%)`
- `border-bottom: 1px solid var(--border)` (always visible, not just on scroll)
- Brand: Inter 700, `letter-spacing: -0.5px`, "9" in `--primary`
- No `.brand-dot` — replaced by colored "9"
- Write button: `border: 1px solid var(--border-focus)`, `color: var(--primary-light)`, mono font
- Avatar dropdown: `background: var(--bg-elevated)`, `border: 1px solid var(--border)`, no Bootstrap shadow

### 4b. Sidebar (Toggle)

Hidden by default. Slides in from the left over content (overlay, not push).

```
.site-sidebar  (position: fixed, left: -260px by default, transition: left 0.25s)
  .sidebar-header
    span "Club9"
    button.sidebar-close "×"
  nav.sidebar-nav
    .sidebar-section
      .sidebar-section-label "Browse"
      a.sidebar-item (href="/blog") "📝 All Posts"
      a.sidebar-item (href="/categories") "🏷 Categories"
    .sidebar-section
      .sidebar-section-label "Community"
      a.sidebar-item (href="/chat") "💬 The Room"
    .sidebar-section
      .sidebar-section-label "You"
      a.sidebar-item (href="/posts/add") "✎ Write"
      a.sidebar-item (href="/profile") "👤 Profile"
      a.sidebar-item (href="/posts") "⊞ Dashboard"
      (if isAdmin) a.sidebar-item (href="/admin/approvals") "✓ Approvals"
.sidebar-overlay  (fixed full-screen, semi-transparent, click to close)
```

**Open state:** `.site-sidebar.open { left: 0 }` + `.sidebar-overlay.open { display: block }`

**Active item detection:** Use the existing `navLink` Handlebars helper (which reads `app.locals.activeRoute`) in the sidebar markup. The helper produces `<a class="nav-link active">` — style `.sidebar-nav a.nav-link.active` in CSS to apply the purple left-border active state. No new helper needed.

**Styles:**
- Width: 240px
- `background: var(--bg-surface)`, `border-right: 1px solid var(--border)`
- Section labels: JetBrains Mono, 10px, uppercase, `--text-muted`, tracked
- Items: Inter 14px, `--text-secondary`, hover `background: var(--primary-dim)`, hover color `--primary-light`
- Active item: `background: var(--primary-dim)`, `color: var(--primary-light)`, left border `2px solid var(--primary)`

**JS (inline in `main.hbs`):**
```javascript
const toggle = document.querySelector('.sidebar-toggle');
const sidebar = document.querySelector('.site-sidebar');
const overlay = document.querySelector('.sidebar-overlay');
function openSidebar() { sidebar.classList.add('open'); overlay.classList.add('open'); }
function closeSidebar() { sidebar.classList.remove('open'); overlay.classList.remove('open'); }
toggle.addEventListener('click', openSidebar);
overlay.addEventListener('click', closeSidebar);
document.querySelector('.sidebar-close').addEventListener('click', closeSidebar);
```

### 4c. Footer

Same structure, updated styles: `--bg-surface` bg, `--border` top border, `--text-muted` text, JetBrains Mono for copyright.

---

## 5. Blog Feed (`blog.hbs`)

**Layout:** Full-width content, no built-in sidebar (sidebar is the global toggle). Dot-grid on `main.main-content`.

### 5a. Hero Banner
```
.blog-hero
  .blog-hero-eyebrow  "// members only · vault open"  (mono, dim purple)
  h1.blog-hero-title  "The Vault"  (Playfair Display 700, large)
  p.blog-hero-sub     "Exclusive. Anonymous. Yours."  (Inter, muted)
```

### 5b. Post Cards
```
.posts-grid  (CSS grid, 1 col mobile, 2 col ≥768px, 3 col ≥1200px)
  .post-card
    .post-card-body
      .post-card-meta  "author::cipher · #introspection · 3 min"  (mono)
      h2.post-card-title  (Inter 600)
      p.post-card-excerpt  (Inter 400, muted, 3-line clamp)
    .post-card-footer
      .post-card-reactions  (emoji + count)
      a.post-card-read "Read →"  (dim, hover purple)
```

**Styles:**
- `background: var(--bg-surface)`, `border: 1px solid var(--border)`, `border-radius: 12px`
- Hover: `border-color: var(--primary-glow)`, `box-shadow: 0 0 20px var(--primary-dim)`, `transform: translateY(-2px)`
- No images — text-only cards, typographically rich

---

## 6. Post View (`post.hbs`)

**Layout:** Centered column, max-width 720px, generous padding.

```
.post-wrap
  .post-meta  "author::cipher · 2026-05-11 · #introspection"  (mono, muted)
  h1.post-title  (Playfair Display 700, large)
  .post-body  (Inter 400, 18px, 1.8 line-height)
  .post-reactions  (emoji reaction bar, existing logic)
  .post-author-card  (author alias card, existing logic)
```

---

## 7. Chat — The Room (`chat.hbs`)

No structural changes needed. CSS updates only:

- `.chat-layout` background: `var(--bg)` with dot-grid
- `.chat-header`: `var(--bg-surface)`, border-bottom
- `.chat-msg-author`: `var(--primary)` (purple instead of current)
- `.chat-msg-time`: JetBrains Mono, `--text-muted`
- `.chat-input`: `background: var(--bg-elevated)`, focus border `--primary`
- `.chat-send-btn`: `background: var(--primary-dim)`, `color: var(--primary-light)`
- `.chat-mention`: `color: var(--primary-light)`, underline `var(--primary-dim)`

---

## 8. Profile, Member, Admin Pages

Apply the new color system tokens consistently. No structural changes. Specific overrides:

- **Admin badges**: keep `#ff6b6b` / existing red
- **Approvals queue** (`admin/approvals.hbs`): status pills updated to new palette
- **Category cards**: use `.post-card` style with `var(--bg-surface)` + hover glow
- **Quill editor** (`addPost.hbs`): toolbar `var(--bg-elevated)`, content area `var(--bg-surface)`

---

## 9. Implementation Plan (Phased)

### Phase 1 — CSS System
- Rewrite all of `public/css/main.css` with new design tokens, typography, base resets
- Add JetBrains Mono to Google Fonts in `main.hbs`
- No template changes in this phase

### Phase 2 — Gate Pages
- Replace `.gate-ring` / `.gate-logo-text` with `.ctos-emblem` (The Hex Eye) in `gate.hbs` CSS + `login.hbs` / `register.hbs`
- Update gate form styles (cyan palette)
- Update `pending.hbs`, `rejected.hbs`, `terms.hbs` to new system

### Phase 3 — Main Layout
- Rewrite `views/layouts/main.hbs`: remove Bootstrap collapse nav, add `.sidebar-toggle`, `.site-sidebar`, `.sidebar-overlay`
- Add sidebar open/close JS inline in `main.hbs`
- Update nav styles, brand, avatar dropdown

### Phase 4 — Content Pages
- `blog.hbs`: hero banner, post card grid
- `post.hbs`: centered reading layout
- `chat.hbs`: CSS tokens only (no JS changes)
- `profile.hbs`, `member.hbs`: token updates

### Phase 5 — Admin Pages
- `addPost.hbs`, `editPost.hbs`, `posts.hbs` (dashboard): token updates
- `admin/approvals.hbs`, `categories.hbs`, `addCategory.hbs`: token updates

---

## 10. What Does Not Change

- All Express routes in `server.js`
- All Supabase queries in `blog-service.js` and `auth-service.js`
- All Handlebars helpers
- Session auth middleware
- ImageKit integration
- Quill.js CDN and editor logic
- Supabase Realtime subscription logic in `chat.hbs`
- All form `action` URLs and `name` attributes
