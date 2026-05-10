# Club9 — Full Design Spec
**Date:** 2026-05-11  
**Status:** Approved by owner  

---

## What Club9 Is

Club9 is a private, anonymous writing community. Access is admin-controlled. Members write under chosen aliases with anonymous avatars. Content is open-form — essays, haikus, rants, code, anything. Members react quietly to each other's work and talk in a shared real-time chat room. Real identities stay hidden; the alias is the person.

---

## Decisions Made

| Question | Decision |
|---|---|
| Access model | Admin-approved — accounts start `pending`, owner approves each one |
| Content format | Anything goes — no format rules, rich text editor |
| Social layer | Emoji reactions (anonymous, counts visible) + threaded comments |
| Member visibility | Alias profiles at `/member/:username` — avatar, bio, post history |
| Categories / channels | Admin-only creation and deletion |
| Chat | Real-time shared room for all approved members, with @mentions |

---

## Current State (what's already built)

- Express + Handlebars + Supabase (PostgreSQL) + ImageKit + Bootstrap 5 dark mode
- Auth via Supabase Auth (`signUp`, `signInWithPassword`)
- `profiles` table: `id, username, avatar_url, bio, created_at, updated_at`
- `posts` table with categories, slugs, feature images, publish toggle
- Threaded comments (1 level deep)
- Anonymous username generator on register (adjective + noun)
- Male/female SVG avatars in `/public/assets/`
- Admin privilege via `ADMIN_EMAIL` env var — sets `session.user.isAdmin`
- Discord-style category sidebar
- Animated gate ring on login/register

---

## Sprint 1 — The Access Gate

### Goal
Make Club9 actually exclusive. No one gets in without your approval.

### DB change
```sql
ALTER TABLE profiles
  ADD COLUMN status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected'));
```
Existing accounts (including the admin's) must be set to `approved` and `terms_accepted = true` as part of the migration:
```sql
-- Run immediately after adding the column
UPDATE profiles SET status = 'approved', terms_accepted = true
WHERE id = '<your-user-uuid>';
```

### Session carries status
`loginUser` in `auth-service.js` must return `status` and `terms_accepted` from the profile so they are stored in the session at login time. The middleware reads from the session (no DB hit per request).

**After approval:** the pending user is sitting on `/pending`. That screen shows a "Check again" button that calls `/auth/refresh-status` — a lightweight route that re-fetches the profile and updates the session, then redirects to `/blog` if now approved. This avoids requiring a full logout/login cycle.

### Auth middleware update — full order of checks
```
1. Not logged in AND path not in open list        → redirect /login
2. Logged in, status === 'pending'                → redirect /pending
3. Logged in, status === 'rejected'               → redirect /rejected
4. Logged in, approved, terms_accepted === false  → redirect /terms
5. All good                                       → next()
```
Open routes (bypass all checks): `/login`, `/register`, `/pending`, `/rejected`, `/terms`, `/auth/refresh-status`.

### New routes
- `GET /pending` — render `pending.hbs` (gate screen, cannot be dismissed)
- `GET /rejected` — render `rejected.hbs`
- `GET /auth/refresh-status` — re-fetches profile, updates session, redirects accordingly (used by "Check again" button on `/pending`)
- `GET /admin/approvals` — pending members queue (admin only)
- `POST /admin/approvals/:id/approve` — set status → `approved`
- `POST /admin/approvals/:id/reject` — set status → `rejected`

### Pending gate screen (`/pending`)
Full-screen gate (uses `gate` layout). Shows:
- Clock/hourglass icon
- "APPLICATION PENDING" heading (monospace, Club9 style)
- Short message: received, under review, usually under 24h
- Shows current alias + sign-out link
- No way to navigate elsewhere

### Rejected screen (`/rejected`)
Similar gate layout. Shows rejection message. Sign-out link only.

### Admin approval queue (`/admin/approvals`)
Table of pending users:
- Columns: Alias, Email (partially masked — first char + domain), Requested (time ago), Actions
- Actions: Approve (green) / Reject (red) buttons — each POSTs to the route above
- Admin-only route (`ensureAdmin` middleware)

### `blog-service.js` additions
```js
getPendingProfiles()     // SELECT * FROM profiles WHERE status = 'pending'
updateProfileStatus(id, status)  // UPDATE profiles SET status = $status WHERE id = $id
```

---

## Sprint 2 — The Writing Experience

### Goal
Replace the plain textarea with a real editor that supports the "anything goes" content model.

### Editor: Quill.js (CDN)
No npm install. Loaded via CDN in `addPost.hbs`. A hidden `<textarea name="body">` is synced from Quill's HTML output on form submit. Existing `safeHTML` / `strip-js` sanitisation remains compatible.

### Toolbar
Bold · Italic · H1 · H2 · Blockquote · Code block · Bullet list · **Image upload**

### Image upload flow
1. User clicks 🖼 Image in toolbar
2. File picker opens
3. JS uploads file to `/posts/upload-image` (new route)
4. Server calls `imagekit.upload()` and returns `{ url }`
5. Quill inserts the URL as an inline image

### Title is optional
Posts without a title use the first line of body as the feed card label (already handled by the `excerpt` Handlebars helper). Title field gets `placeholder="Title (optional)"`.

### `addPost.hbs` changes
- Replace `<textarea name="body">` with Quill editor div + hidden sync field
- Add image upload button to Quill toolbar
- Title field marked optional (remove `required`)

### New route
```
POST /posts/upload-image   (ensureLogin, upload.single('image'))
→ imagekit.upload() → return { url }
```

---

## Sprint 3 — Rules Modal, Reactions & Member Profiles

### 3a — Rules & Conditions Modal

#### DB change
```sql
ALTER TABLE profiles
  ADD COLUMN terms_accepted boolean DEFAULT false;
```

#### Flow
After a user is approved and logs in, the auth middleware checks:
```
if status === 'approved' AND terms_accepted === false → redirect /terms
```
`/terms` renders a full-screen gate with:
- Club9 monospace header
- Scrollable rules list (5–6 rules around anonymity, respect, admin authority)
- Checkbox: "I've read and agree to the Club9 rules"
- "ENTER CLUB9" button — disabled until checkbox is ticked
- On POST → server sets `terms_accepted = true` → redirect `/blog`

The modal cannot be dismissed. No other navigation is shown.

#### Rules (draft — owner should edit to taste)
1. Anonymity is mutual — never attempt to identify or expose another member
2. No harassment, hate speech, threats, or targeted abuse of any kind
3. The admin may remove any member or content at any time, for any reason
4. What is shared in Club9 stays in Club9 — do not screenshot or repost elsewhere
5. You are responsible for everything posted under your alias

#### New routes
- `GET /terms` — render `terms.hbs` (gate layout, approved but terms not accepted)
- `POST /terms` — set `terms_accepted = true`, redirect `/blog`

---

### 3b — Emoji Reactions

#### DB change
```sql
CREATE TABLE reactions (
  id        bigserial primary key,
  post_id   integer references posts(id) on delete cascade not null,
  user_id   uuid references auth.users(id) on delete cascade not null,
  emoji     text not null,
  created_at timestamptz default now(),
  UNIQUE (post_id, user_id, emoji)
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Reactions viewable by all members" ON reactions FOR SELECT USING (true);
CREATE POLICY "Members can insert own reactions" ON reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members can delete own reactions" ON reactions FOR DELETE USING (auth.uid() = user_id);
```

#### Available emoji
🔥 ❤️ 👁️ ✨ 🖤 (five options, fixed set)

#### Behaviour
- Toggle: clicking an emoji you've already reacted with removes it (DELETE); clicking one you haven't adds it (INSERT)
- Counts are public — everyone sees the number next to each emoji
- Attribution is private — no one knows who reacted
- One reaction per emoji per user per post (enforced by UNIQUE constraint)
- Rendered via AJAX (fetch POST/DELETE to `/blog/:id/react`) — no page reload

#### New routes
```
POST   /blog/:id/react   { emoji }  → upsert or delete reaction, return updated counts
```

#### `blog-service.js` additions
```js
getReactionsByPost(postId)          // grouped counts + current user's reactions
toggleReaction(postId, userId, emoji)
```

#### UI placement
Reaction bar appears at the bottom of every post card and at the bottom of the full post view, before the comments section.

---

### 3c — Member Alias Profiles

#### New route
```
GET /member/:username   → render member.hbs
```
Returns: profile (avatar, alias, bio, created_at) + all published posts by that member.

#### `member.hbs` shows
- Avatar (SVG default or uploaded) + alias name
- "Member since [Month Year]" — derived from `profiles.created_at`
- Bio (if set)
- Grid/list of their published posts (title + excerpt + date)
- No email, no real name, no follower counts

#### Author names become links
Every instance of an author alias (post cards, full post header, comment thread) becomes `<a href="/member/{{profiles.username}}">`.

---

## Sprint 4 — The Club Chat Room

### Goal
A real-time shared space where all approved members can talk, mention each other, and feel the community.

### Technology: Supabase Realtime
Already in the stack. The browser client subscribes to `INSERT` events on the `messages` table. No new npm packages, no WebSocket server to manage.

### DB change
```sql
CREATE TABLE messages (
  id        bigserial primary key,
  author_id uuid references auth.users(id) on delete cascade not null,
  body      text not null,
  created_at timestamptz default now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Messages viewable by approved members" ON messages FOR SELECT USING (true);
CREATE POLICY "Approved members can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "Members can delete own messages" ON messages FOR DELETE USING (auth.uid() = author_id);
```

### New routes
```
GET  /chat          → render chat.hbs (loads last 100 messages, approved members only)
POST /chat/send     → insert message into messages table, return { id, created_at }
DELETE /chat/:id    → delete message (own message, or admin deleting any)
```

### Real-time subscription (client-side JS in `chat.hbs`)
```js
const channel = supabaseClient
  .channel('public:messages')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
    payload => appendMessage(payload.new))
  .subscribe();
```
The anon key is passed to the page as a template variable (safe — it's the public key).

### @mentions
- Typing `@` in the input triggers a dropdown of member aliases (fetched once on page load, stored in JS array)
- Keyboard navigation (↑↓ to select, Enter/Tab to complete)
- On send: any `@alias` in the body is wrapped as `<span class="mention">@alias</span>` and rendered highlighted in indigo
- Clicking a mention navigates to `/member/:username`

### Message rendering
Each message shows:
- Avatar (32px circle) + alias (coloured per user, consistent hash-based colour)
- Timestamp (time only for today, date + time for older)
- Body with @mentions highlighted
- Date divider between days ("Today", "Yesterday", full date otherwise)
- On hover: trash icon appears (own messages for members, all messages for admin)

### Unread badge
- Last-seen message ID stored in `localStorage`
- On open: badge clears, `localStorage` updated
- No DB column needed

### Where it lives
Bottom of the sidebar, separated from channels:
```
CHANNELS
  # technology
  # life
  # design

THE ROOM
  💬 Club Chat   [3]   ← unread badge
```

### Admin-only categories (applies to all sprints)
- Routes `GET /categories/add`, `POST /categories/add`, `GET /categories/delete/:id` — change middleware from `ensureLogin` to `ensureAdmin`
- The "Add Category" link in `categories.hbs` — wrap in `{{#if session.user.isAdmin}}` guard
- In the sidebar, categories are labelled **CHANNELS** with the `#` icon (already present)
- Members see channels and can filter posts by them — they just can't create or delete them

---

## Architecture Summary

### New DB columns / tables

| Change | Purpose |
|---|---|
| `profiles.status` | `pending / approved / rejected` — access control |
| `profiles.terms_accepted` | Boolean — rules gate after first approval |
| `reactions` table | Emoji reactions with unique constraint |
| `messages` table | Chat room messages |

### New routes (all sprints)

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/pending` | GET | logged in | Pending gate screen |
| `/rejected` | GET | logged in | Rejected screen |
| `/auth/refresh-status` | GET | logged in | Re-check approval, update session |
| `/terms` | GET / POST | approved, terms pending | Rules modal |
| `/admin/approvals` | GET | admin | Pending members queue |
| `/admin/approvals/:id/approve` | POST | admin | Approve member |
| `/admin/approvals/:id/reject` | POST | admin | Reject member |
| `/posts/upload-image` | POST | approved | ImageKit upload for Quill |
| `/blog/:id/react` | POST | approved | Toggle emoji reaction |
| `/member/:username` | GET | approved | Alias profile page |
| `/chat` | GET | approved | Chat room |
| `/chat/send` | POST | approved | Send message |
| `/chat/:id` | DELETE | approved (own) / admin (any) | Delete message |

### New / modified files

| File | Change |
|---|---|
| `supabase-schema.sql` | Add migration for `status`, `terms_accepted`, `reactions`, `messages` |
| `blog-service.js` | Add `getPendingProfiles`, `updateProfileStatus`, `getReactionsByPost`, `toggleReaction`, `getMessageHistory`, `insertMessage`, `deleteMessage`, `getMemberByUsername` |
| `server.js` | Update auth middleware for status check, add all new routes, `ensureAdmin` on category routes |
| `views/pending.hbs` | Pending gate screen |
| `views/rejected.hbs` | Rejected screen |
| `views/terms.hbs` | Rules & conditions gate |
| `views/member.hbs` | Alias profile page |
| `views/chat.hbs` | Real-time chat room |
| `views/admin/approvals.hbs` | Admin approval queue |
| `views/addPost.hbs` | Replace textarea with Quill editor |
| `views/post.hbs` | Add reaction bar, make author name a link |
| `views/blog.hbs` | Add reaction bar to cards, make author name a link, add chat link to sidebar |
| `views/layouts/main.hbs` | Add chat link to sidebar |
| `views/categories.hbs` | Hide add/delete for non-admins |
| `public/css/main.css` | Styles for reaction bar, member profile, chat room, pending/rejected/terms screens |

---

## What Does NOT Change

- Auth provider (Supabase Auth) — no changes
- Session handling — no changes  
- ImageKit integration — extended for inline editor images, otherwise unchanged
- Comment system — no changes
- Profile edit page — no changes
- Admin email flag (`ADMIN_EMAIL` env var) — no changes
- Anonymous username generator — no changes
- SVG avatars — no changes
- Gate ring animation — no changes
