# Club9 Full Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Club9 from an open blog into a fully-gated anonymous writing community with admin approval, rich text editor, emoji reactions, member alias profiles, a rules gate, and a real-time club chat room.

**Architecture:** Four sequential sprints, each shippable on its own. All changes stay within the existing Express/Handlebars/Supabase stack. Data access lives in `blog-service.js`, routing in `server.js`, auth in `auth-service.js`. No new npm packages — Quill.js and Supabase JS v2 are loaded via CDN only where needed.

**Tech Stack:** Node.js · Express · express-handlebars · Supabase PostgreSQL + Realtime · ImageKit · Bootstrap 5 · Quill.js (CDN) · Supabase JS v2 (CDN)

---

## File Map

| File | Role |
|---|---|
| `supabase-migration-sprint1.sql` | NEW — adds `status` + `terms_accepted` to profiles |
| `supabase-migration-sprint3.sql` | NEW — creates `reactions` table |
| `supabase-migration-sprint4.sql` | NEW — creates `messages` table |
| `auth-service.js` | MODIFY — `loginUser` returns `status` + `terms_accepted` |
| `blog-service.js` | MODIFY — add service fns per sprint |
| `server.js` | MODIFY — auth middleware rewrite + all new routes |
| `views/pending.hbs` | NEW — pending gate screen |
| `views/rejected.hbs` | NEW — rejected screen |
| `views/terms.hbs` | NEW — rules & conditions gate |
| `views/member.hbs` | NEW — alias profile page |
| `views/chat.hbs` | NEW — real-time club chat |
| `views/admin/approvals.hbs` | NEW — admin pending-user queue |
| `views/addPost.hbs` | MODIFY — Quill editor replaces textarea |
| `views/post.hbs` | MODIFY — reaction bar + author links |
| `views/blog.hbs` | MODIFY — reaction bar on cards + author links + chat sidebar link |
| `views/layouts/main.hbs` | MODIFY — chat link in sidebar |
| `views/categories.hbs` | MODIFY — hide add/delete for non-admins |
| `public/css/main.css` | MODIFY — styles for all new UI |

---

## Sprint 1 — The Access Gate

---

### Task 1: DB Migration — status + terms_accepted

**Files:**
- Create: `supabase-migration-sprint1.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase-migration-sprint1.sql
-- Run in Supabase SQL Editor BEFORE any code changes

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected'));

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS terms_accepted boolean DEFAULT false;

-- IMPORTANT: approve your own account immediately after running this.
-- Replace <your-uuid> with your user ID from Supabase Dashboard -> Auth -> Users.
UPDATE public.profiles
  SET status = 'approved', terms_accepted = true
  WHERE id = '<your-uuid>';
```

- [ ] **Step 2: Run the migration**

Open Supabase Dashboard -> SQL Editor -> New query -> paste contents -> Run.

Verify: Table Editor -> profiles -> confirm `status` and `terms_accepted` columns exist, and your row shows `status = approved`, `terms_accepted = true`.

- [ ] **Step 3: Commit**

```bash
git add supabase-migration-sprint1.sql
git commit -m "feat(db): add status and terms_accepted to profiles"
```

---

### Task 2: auth-service.js — loginUser returns status + terms_accepted

**Files:**
- Modify: `auth-service.js`

- [ ] **Step 1: Update the profile select query and return object**

Replace the entire `loginUser` export in `auth-service.js`:

```js
module.exports.loginUser = async function (email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error('Invalid email or password');

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('username, avatar_url, bio, status, terms_accepted')
        .eq('id', data.user.id)
        .single();

    return {
        id:             data.user.id,
        email:          data.user.email,
        username:       profile?.username       || email.split('@')[0],
        avatar_url:     profile?.avatar_url     || null,
        bio:            profile?.bio            || null,
        status:         profile?.status         || 'pending',
        terms_accepted: profile?.terms_accepted || false
    };
};
```

- [ ] **Step 2: Verify**

Start the server (`npm start`). Log in with your admin account. Temporarily add `console.log(req.session.user)` after `req.session.user = user` in server.js and confirm the log shows `status: 'approved'` and `terms_accepted: true`. Remove the log line.

- [ ] **Step 3: Commit**

```bash
git add auth-service.js
git commit -m "feat(auth): loginUser returns status and terms_accepted"
```

---

### Task 3: server.js — Rewrite global auth middleware

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Replace the existing global auth guard block**

Find and remove this block in `server.js`:

```js
// Global auth guard — every route requires login except /login and /register
app.use((req, res, next) => {
    const open = ['/login', '/register'];
    if (!req.session.user && !open.includes(req.path)) {
        return res.redirect('/login');
    }
    next();
});
```

Replace with:

```js
// Global auth guard — 5-step check in order
const OPEN_PATHS = ['/login', '/register', '/pending', '/rejected', '/terms', '/auth/refresh-status'];

app.use((req, res, next) => {
    const u = req.session.user;

    // 1. Not logged in
    if (!u) {
        if (OPEN_PATHS.includes(req.path)) return next();
        return res.redirect('/login');
    }

    // 2. Logged in but pending approval
    if (u.status === 'pending') {
        if (req.path === '/pending' || req.path === '/logout' || req.path === '/auth/refresh-status') return next();
        return res.redirect('/pending');
    }

    // 3. Logged in but rejected
    if (u.status === 'rejected') {
        if (req.path === '/rejected' || req.path === '/logout') return next();
        return res.redirect('/rejected');
    }

    // 4. Approved but hasn't accepted terms yet
    if (u.status === 'approved' && !u.terms_accepted) {
        if (req.path === '/terms' || req.path === '/logout') return next();
        return res.redirect('/terms');
    }

    // 5. All good — approved and terms accepted
    next();
});
```

- [ ] **Step 2: Verify**

Start the server. Log in as admin — should land on `/blog` with no redirect loops. Confirm `/login` and `/register` are still accessible when not logged in.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(auth): rewrite global middleware with 5-step status gate"
```

---

### Task 4: Pending and rejected gate screens

**Files:**
- Create: `views/pending.hbs`
- Create: `views/rejected.hbs`
- Modify: `server.js`
- Modify: `public/css/main.css`

- [ ] **Step 1: Create `views/pending.hbs`**

```html
<div class="gate-wrap">
    <div class="gate-ring-wrap">
        <div class="gate-ring gate-ring--sm">
            <div class="gate-ring-inner">
                <div class="gate-logo-text" aria-label="Club9">
                    <span>C</span><span>L</span><span>U</span><span>B</span><span>9</span>
                </div>
            </div>
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

- [ ] **Step 2: Create `views/rejected.hbs`**

```html
<div class="gate-wrap">
    <div class="gate-ring-wrap">
        <div class="gate-ring gate-ring--sm">
            <div class="gate-ring-inner">
                <div class="gate-logo-text" aria-label="Club9">
                    <span>C</span><span>L</span><span>U</span><span>B</span><span>9</span>
                </div>
            </div>
        </div>
    </div>
    <div class="gate-form-wrap">
        <div class="status-gate-icon">&#x1F6AB;</div>
        <h2 class="status-gate-heading">ACCESS DENIED</h2>
        <p class="status-gate-body">
            Your membership request was not approved.<br>
            Club9 membership is by discretion only.
        </p>
        <a href="/logout" class="gate-btn mt-3">SIGN OUT</a>
    </div>
</div>
```

- [ ] **Step 3: Add CSS to `public/css/main.css`**

Append to `public/css/main.css`:

```css
/* ── Status gate (pending / rejected) ────────────────────── */

.status-gate-icon {
    font-size: 2.5rem;
    margin-bottom: .75rem;
}

.status-gate-heading {
    font-family: var(--font-mono);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: .14em;
    color: #fff;
    margin-bottom: .75rem;
}

.status-gate-body {
    font-size: .85rem;
    color: var(--text-secondary);
    line-height: 1.8;
    text-align: center;
}
```

- [ ] **Step 4: Add routes to `server.js`**

Add immediately after the `/logout` route:

```js
// ── Routes: access gate screens ───────────────────────────

app.get('/pending',  (req, res) => res.render('pending',  GATE));
app.get('/rejected', (req, res) => res.render('rejected', GATE));
```

- [ ] **Step 5: Verify**

In Supabase Table Editor set your test account to `status = pending`. Log in — should land on `/pending`. Set back to `approved` in Supabase, sign out, sign in again — should go to `/blog` (or `/terms` if `terms_accepted` is false).

- [ ] **Step 6: Commit**

```bash
git add views/pending.hbs views/rejected.hbs server.js public/css/main.css
git commit -m "feat(gate): add pending and rejected screens"
```

---

### Task 5: /auth/refresh-status route

**Files:**
- Modify: `blog-service.js`
- Modify: `server.js`

- [ ] **Step 1: Add `getProfileStatus` to `blog-service.js`**

Append to `blog-service.js`:

```js
module.exports.getProfileStatus = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('status, terms_accepted')
        .eq('id', userId)
        .single();
    if (error) return null;
    return data;
};
```

- [ ] **Step 2: Add the route to `server.js`**

Add after the `/rejected` route:

```js
app.get('/auth/refresh-status', async (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    try {
        const fresh = await blogService.getProfileStatus(req.session.user.id);
        if (fresh) {
            req.session.user.status         = fresh.status;
            req.session.user.terms_accepted = fresh.terms_accepted;
        }
    } catch (e) { /* keep existing session values on error */ }

    const u = req.session.user;
    if (u.status === 'approved' && u.terms_accepted)  return res.redirect('/blog');
    if (u.status === 'approved' && !u.terms_accepted) return res.redirect('/terms');
    if (u.status === 'rejected')                      return res.redirect('/rejected');
    return res.redirect('/pending');
});
```

- [ ] **Step 3: Verify**

With a test account at `status = pending`, log in, land on `/pending`. In Supabase set that account to `approved`. Click "Check again" — should redirect to `/terms` (since `terms_accepted` is still false) or `/blog` if already true.

- [ ] **Step 4: Commit**

```bash
git add blog-service.js server.js
git commit -m "feat(auth): add refresh-status route for pending users to check approval"
```

---

### Task 6: Admin approval queue

**Files:**
- Modify: `blog-service.js`
- Modify: `server.js`
- Create: `views/admin/approvals.hbs`
- Modify: `views/layouts/main.hbs`
- Modify: `public/css/main.css`

- [ ] **Step 1: Add service functions to `blog-service.js`**

Append to `blog-service.js`:

```js
module.exports.getPendingProfiles = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
    if (error) throw new Error('unable to fetch pending profiles');
    return data || [];
};

module.exports.updateProfileStatus = async (userId, status) => {
    const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId);
    if (error) throw new Error('unable to update profile status');
};
```

- [ ] **Step 2: Add routes to `server.js`** (add before the 404 handler)

```js
// ── Routes: admin approvals ───────────────────────────────

app.get('/admin/approvals', ensureAdmin, async (req, res) => {
    try {
        const pending = await blogService.getPendingProfiles();
        res.render('admin/approvals', { pending });
    } catch (err) {
        res.render('admin/approvals', { pending: [], errorMessage: err.message });
    }
});

app.post('/admin/approvals/:id/approve', ensureAdmin, async (req, res) => {
    try { await blogService.updateProfileStatus(req.params.id, 'approved'); } catch (e) {}
    res.redirect('/admin/approvals');
});

app.post('/admin/approvals/:id/reject', ensureAdmin, async (req, res) => {
    try { await blogService.updateProfileStatus(req.params.id, 'rejected'); } catch (e) {}
    res.redirect('/admin/approvals');
});
```

- [ ] **Step 3: Create the admin directory and view**

```bash
mkdir -p /Users/allanmathewjohn/Downloads/Blog-Post-main/views/admin
```

Create `views/admin/approvals.hbs`:

```html
<div class="admin-page">
    <div class="container py-5">
        <div class="d-flex align-items-center justify-content-between mb-4">
            <div>
                <h1 class="admin-title">Membership Queue</h1>
                <p class="text-muted mb-0">Review and approve pending Club9 applications</p>
            </div>
            <a href="/posts" class="btn btn-ghost-sm">
                <i class="bi bi-arrow-left me-1"></i>Dashboard
            </a>
        </div>

        {{#if errorMessage}}
        <div class="alert alert-danger border-0 rounded-3">{{errorMessage}}</div>
        {{/if}}

        {{#if pending.length}}
        <div class="table-responsive admin-table-wrap">
            <table class="table table-hover admin-table mb-0">
                <thead>
                    <tr>
                        <th>Alias</th>
                        <th>Requested</th>
                        <th class="text-end">Action</th>
                    </tr>
                </thead>
                <tbody>
                    {{#each pending}}
                    <tr>
                        <td>
                            <div class="d-flex align-items-center gap-2">
                                {{#if avatar_url}}
                                <img src="{{avatar_url}}" class="meta-avatar-xs" alt="">
                                {{else}}
                                <span class="meta-avatar-initials-xs">{{avatarInitial username}}</span>
                                {{/if}}
                                <span class="fw-medium">{{username}}</span>
                            </div>
                        </td>
                        <td class="text-muted small">{{timeAgo created_at}}</td>
                        <td class="text-end">
                            <form method="POST" action="/admin/approvals/{{id}}/approve" class="d-inline">
                                <button type="submit" class="btn-approve me-1">Approve</button>
                            </form>
                            <form method="POST" action="/admin/approvals/{{id}}/reject" class="d-inline">
                                <button type="submit" class="btn-reject"
                                    onclick="return confirm('Reject this member?')">Reject</button>
                            </form>
                        </td>
                    </tr>
                    {{/each}}
                </tbody>
            </table>
        </div>
        {{else}}
        <div class="empty-state text-center py-5">
            <i class="bi bi-person-check display-1 text-muted"></i>
            <h3 class="mt-3 text-muted">No pending applications</h3>
            <p class="text-muted">You are all caught up.</p>
        </div>
        {{/if}}
    </div>
</div>
```

- [ ] **Step 4: Add approve/reject CSS to `public/css/main.css`**

Append:

```css
/* ── Admin approve / reject buttons ──────────────────────── */

.btn-approve {
    background: rgba(52, 211, 153, 0.15);
    border: 1px solid rgba(52, 211, 153, 0.4);
    color: #6ee7b7;
    border-radius: 6px;
    font-size: .8rem;
    padding: 4px 14px;
    cursor: pointer;
    transition: background .2s;
}
.btn-approve:hover { background: rgba(52, 211, 153, 0.28); color: #6ee7b7; }

.btn-reject {
    background: rgba(239, 68, 68, 0.08);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #fca5a5;
    border-radius: 6px;
    font-size: .8rem;
    padding: 4px 14px;
    cursor: pointer;
    transition: background .2s;
}
.btn-reject:hover { background: rgba(239, 68, 68, 0.2); color: #fca5a5; }
```

- [ ] **Step 5: Add Approvals link to the admin dropdown in `views/layouts/main.hbs`**

Find the `<li><a class="dropdown-item" href="/posts">` line and add after it:

```html
<li><a class="dropdown-item" href="/admin/approvals">
    <i class="bi bi-person-check me-2 text-muted"></i>Approvals
</a></li>
```

- [ ] **Step 6: Verify**

Create a new test account. In Supabase confirm `status = pending`. Log in as admin, go to `/admin/approvals` — test account appears. Click Approve — it disappears from the queue and Supabase shows `status = approved`.

- [ ] **Step 7: Commit**

```bash
git add blog-service.js server.js views/admin/approvals.hbs views/layouts/main.hbs public/css/main.css
git commit -m "feat(admin): add membership approval queue at /admin/approvals"
```

---

### Task 7: Admin-only category routes

**Files:**
- Modify: `server.js`
- Modify: `views/categories.hbs`

- [ ] **Step 1: Switch three category routes to `ensureAdmin` in `server.js`**

Change the middleware on these three lines only (keep handler bodies identical):

```js
// CHANGE ensureLogin → ensureAdmin on these three:
app.get('/categories/add',     ensureAdmin, (req, res) => res.render('addCategory'));
app.post('/categories/add',    ensureAdmin, async (req, res) => { /* body unchanged */ });
app.get('/categories/delete/:id', ensureAdmin, async (req, res) => { /* body unchanged */ });
```

- [ ] **Step 2: Guard the Add channel button in `views/categories.hbs`**

Read the current file, then wrap the "Add category" button in an admin guard:

```html
{{#if session.user.isAdmin}}
<a href="/categories/add" class="btn btn-primary rounded-pill px-4">
    <i class="bi bi-plus-lg me-1"></i>Add channel
</a>
{{/if}}
```

And wrap each delete link in the table:

```html
{{#if ../session.user.isAdmin}}
<a href="/categories/delete/{{id}}" class="btn btn-ghost-xs text-danger"
    onclick="return confirm('Delete channel?')">
    <i class="bi bi-trash"></i>
</a>
{{/if}}
```

- [ ] **Step 3: Verify**

Log in as a regular approved member. Go to `/categories` — Add and Delete controls are hidden. Attempt `/categories/add` directly — receives 403 (renders 404 page). Log in as admin — controls are visible and functional.

- [ ] **Step 4: Commit**

```bash
git add server.js views/categories.hbs
git commit -m "feat(admin): restrict category create/delete to admin only"
```

---

## Sprint 2 — The Writing Experience

---

### Task 8: Quill rich text editor

**Files:**
- Modify: `views/addPost.hbs`

- [ ] **Step 1: Replace `views/addPost.hbs` entirely**

```html
<div class="admin-page">
    <div class="container py-5">
        <div class="row justify-content-center">
            <div class="col-lg-9">
                <div class="d-flex align-items-center gap-3 mb-4">
                    <a href="/posts" class="btn btn-ghost-sm"><i class="bi bi-arrow-left"></i></a>
                    <h1 class="admin-title mb-0">New Post</h1>
                </div>

                <form method="POST" action="/posts/add" enctype="multipart/form-data" id="postForm">
                    <!-- Title (optional) -->
                    <div class="mb-4">
                        <input type="text" class="form-control form-control-lg post-title-input"
                            id="title" name="title" placeholder="Title (optional)">
                    </div>

                    <!-- Quill editor -->
                    <div class="mb-4">
                        <label class="form-label text-muted small fw-medium">Content</label>
                        <div id="quill-editor" style="min-height:320px"></div>
                        <textarea name="body" id="bodyField" style="display:none"></textarea>
                    </div>

                    <div class="row g-3 mb-4">
                        <div class="col-md-5">
                            <label class="form-label text-muted small fw-medium" for="category">Channel</label>
                            {{#if categories}}
                            <select class="form-select" name="category" id="category">
                                <option value="">No channel</option>
                                {{#each categories}}
                                <option value="{{id}}">{{name}}</option>
                                {{/each}}
                            </select>
                            {{else}}
                            <div class="text-muted small">No channels yet.</div>
                            {{/if}}
                        </div>
                        <div class="col-md-7">
                            <label class="form-label text-muted small fw-medium" for="featureImage">
                                Cover image (optional)
                            </label>
                            <input class="form-control" type="file" id="featureImage"
                                name="featureImage" accept="image/*">
                        </div>
                    </div>

                    <div class="mb-4">
                        <div class="form-check form-switch">
                            <input class="form-check-input" type="checkbox" id="published" name="published">
                            <label class="form-check-label fw-medium" for="published">
                                Publish immediately
                            </label>
                        </div>
                        <div class="text-muted small mt-1">Unpublished posts are drafts — only visible to you.</div>
                    </div>

                    <div class="d-flex gap-2">
                        <button type="submit" class="btn btn-primary rounded-pill px-5">Publish</button>
                        <a href="/posts" class="btn btn-outline-secondary rounded-pill px-4">Cancel</a>
                    </div>
                </form>
            </div>
        </div>
    </div>
</div>

<link href="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.snow.css" rel="stylesheet">
<style>
.ql-toolbar.ql-snow {
    background: var(--bg-elevated);
    border-color: var(--border) !important;
    border-radius: var(--radius-sm) var(--radius-sm) 0 0;
}
.ql-container.ql-snow {
    background: var(--bg-input);
    border-color: var(--border) !important;
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    color: var(--text);
    font-family: var(--font-sans);
    font-size: 1rem;
}
.ql-editor { min-height: 300px; line-height: 1.8; }
.ql-snow .ql-stroke { stroke: var(--text-secondary); }
.ql-snow .ql-fill  { fill:   var(--text-secondary); }
.ql-snow .ql-picker-label { color: var(--text-secondary); }
.ql-snow .ql-picker-options {
    background: var(--bg-elevated);
    border-color: var(--border) !important;
}
.ql-snow.ql-toolbar button:hover .ql-stroke,
.ql-snow.ql-toolbar button.ql-active .ql-stroke { stroke: var(--primary); }
.ql-snow.ql-toolbar button:hover .ql-fill,
.ql-snow.ql-toolbar button.ql-active .ql-fill   { fill:   var(--primary); }
</style>
<script src="https://cdn.jsdelivr.net/npm/quill@2.0.3/dist/quill.js"></script>
<script>
(function () {
    var quill = new Quill('#quill-editor', {
        theme: 'snow',
        placeholder: 'Write anything. A haiku. A rant. A memory. A question with no answer.',
        modules: {
            toolbar: {
                container: [
                    [{ header: [1, 2, false] }],
                    ['bold', 'italic', 'blockquote', 'code-block'],
                    [{ list: 'bullet' }],
                    ['link', 'image'],
                    ['clean']
                ],
                handlers: {
                    image: function () {
                        var input = document.createElement('input');
                        input.setAttribute('type', 'file');
                        input.setAttribute('accept', 'image/*');
                        input.click();
                        input.onchange = function () {
                            var file = input.files[0];
                            if (!file) return;
                            var fd = new FormData();
                            fd.append('image', file);
                            fetch('/posts/upload-image', { method: 'POST', body: fd })
                                .then(function (r) { return r.json(); })
                                .then(function (json) {
                                    if (json.url) {
                                        var range = quill.getSelection(true);
                                        quill.insertEmbed(range.index, 'image', json.url);
                                    }
                                });
                        };
                    }
                }
            }
        }
    });

    document.getElementById('postForm').addEventListener('submit', function () {
        document.getElementById('bodyField').value = quill.root.innerHTML;
    });
})();
</script>
```

- [ ] **Step 2: Verify**

Go to `/posts/add`. The Quill toolbar should appear. Type formatted content, try Bold/Italic/Heading. Submit — confirm the post renders correctly with formatting in `/blog`.

- [ ] **Step 3: Commit**

```bash
git add views/addPost.hbs
git commit -m "feat(editor): replace textarea with Quill rich text editor"
```

---

### Task 9: Inline image upload route

**Files:**
- Modify: `server.js`

- [ ] **Step 1: Add the upload route to `server.js`** (add after the `POST /posts/add` route)

```js
app.post('/posts/upload-image', ensureLogin, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file provided' });
        const result = await streamUpload(req, 'posts');
        res.json({ url: result.url });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Verify**

Go to `/posts/add`. Click the image icon in the Quill toolbar, select a file. The image should appear inline in the editor. Submit the post — the body in the database should contain an `<img src="https://ik.imagekit.io/...">` tag.

- [ ] **Step 3: Commit**

```bash
git add server.js
git commit -m "feat(editor): add ImageKit inline image upload route for Quill"
```

---

## Sprint 3 — Rules, Reactions & Member Profiles

---

### Task 10: Rules & conditions gate

**Files:**
- Modify: `blog-service.js`
- Modify: `server.js`
- Create: `views/terms.hbs`
- Modify: `public/css/main.css`

- [ ] **Step 1: Add `acceptTerms` to `blog-service.js`**

Append to `blog-service.js`:

```js
module.exports.acceptTerms = async (userId) => {
    const { error } = await supabase
        .from('profiles')
        .update({ terms_accepted: true })
        .eq('id', userId);
    if (error) throw new Error('unable to accept terms');
};
```

- [ ] **Step 2: Add routes to `server.js`** (add after `/auth/refresh-status`)

```js
// ── Routes: terms ─────────────────────────────────────────

app.get('/terms', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.terms_accepted) return res.redirect('/blog');
    res.render('terms', GATE);
});

app.post('/terms', ensureLogin, async (req, res) => {
    if (!req.body.agreed) {
        return res.render('terms', { ...GATE, errorMessage: 'You must agree to the rules to continue.' });
    }
    try {
        await blogService.acceptTerms(req.session.user.id);
        req.session.user.terms_accepted = true;
        res.redirect('/blog');
    } catch (err) {
        res.render('terms', { ...GATE, errorMessage: err.message });
    }
});
```

- [ ] **Step 3: Create `views/terms.hbs`**

```html
<div class="gate-wrap">
    <div class="gate-ring-wrap">
        <div class="gate-ring gate-ring--sm">
            <div class="gate-ring-inner">
                <div class="gate-logo-text" aria-label="Club9">
                    <span>C</span><span>L</span><span>U</span><span>B</span><span>9</span>
                </div>
            </div>
        </div>
    </div>

    <div class="gate-form-wrap">
        <h2 class="status-gate-heading mb-1">MEMBERSHIP RULES</h2>
        <p class="status-gate-body mb-4">Read carefully. You agree once.</p>

        {{#if errorMessage}}
        <p class="gate-error">{{errorMessage}}</p>
        {{/if}}

        <form method="POST" action="/terms" class="gate-form">
            <div class="terms-rules">
                <ol>
                    <li>Anonymity is mutual &mdash; never attempt to identify or expose another member.</li>
                    <li>No harassment, hate speech, threats, or targeted abuse of any kind.</li>
                    <li>The admin may remove any member or content at any time, for any reason.</li>
                    <li>What is shared in Club9 stays in Club9 &mdash; do not screenshot or repost elsewhere.</li>
                    <li>You are responsible for everything posted under your alias.</li>
                </ol>
            </div>

            <label class="terms-check-label">
                <input type="checkbox" name="agreed" value="1" id="agreedBox"
                    onchange="document.getElementById('termsBtn').disabled = !this.checked">
                I have read and agree to the Club9 rules
            </label>

            <button type="submit" class="gate-btn mt-3" id="termsBtn" disabled>
                ENTER CLUB9
            </button>
        </form>
    </div>
</div>
```

- [ ] **Step 4: Add CSS to `public/css/main.css`**

Append:

```css
/* ── Terms gate ───────────────────────────────────────────── */

.terms-rules {
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    padding: 1rem 1.25rem;
    margin-bottom: 1.25rem;
    text-align: left;
    width: 100%;
}

.terms-rules ol {
    margin: 0;
    padding-left: 1.2rem;
    color: var(--text-secondary);
    font-size: .82rem;
    line-height: 2.1;
}

.terms-check-label {
    display: flex;
    align-items: flex-start;
    gap: .6rem;
    font-size: .83rem;
    color: var(--text-secondary);
    cursor: pointer;
    text-align: left;
    width: 100%;
}

.terms-check-label input[type="checkbox"] {
    accent-color: var(--primary);
    flex-shrink: 0;
    margin-top: 3px;
}
```

- [ ] **Step 5: Verify**

Set a test account to `status = approved`, `terms_accepted = false` in Supabase. Log in — should redirect to `/terms`. Submit without ticking — error message appears. Tick and submit — redirected to `/blog`. Check Supabase: `terms_accepted = true`.

- [ ] **Step 6: Commit**

```bash
git add views/terms.hbs server.js blog-service.js public/css/main.css
git commit -m "feat(gate): add rules and conditions screen on first approved login"
```

---

### Task 11: Reactions DB + service functions

**Files:**
- Create: `supabase-migration-sprint3.sql`
- Modify: `blog-service.js`

- [ ] **Step 1: Write the migration**

```sql
-- supabase-migration-sprint3.sql

CREATE TABLE IF NOT EXISTS public.reactions (
    id         bigserial primary key,
    post_id    integer references public.posts(id) on delete cascade not null,
    user_id    uuid references auth.users(id) on delete cascade not null,
    emoji      text not null CHECK (emoji IN ('fire','heart','eye','sparkle','black_heart')),
    created_at timestamptz default now(),
    UNIQUE (post_id, user_id, emoji)
);

ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reactions viewable by all" ON public.reactions
    FOR SELECT USING (true);

CREATE POLICY "Members insert own reactions" ON public.reactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Members delete own reactions" ON public.reactions
    FOR DELETE USING (auth.uid() = user_id);
```

Note: we store emoji as short text keys (`fire`, `heart`, `eye`, `sparkle`, `black_heart`) instead of emoji characters to avoid encoding issues in the DB CHECK constraint. The display emoji are mapped in JavaScript.

- [ ] **Step 2: Run in Supabase SQL Editor**

Paste and run. Verify the `reactions` table appears in Table Editor.

- [ ] **Step 3: Add service functions to `blog-service.js`**

Append to `blog-service.js`:

```js
const REACTION_KEYS   = ['fire', 'heart', 'eye', 'sparkle', 'black_heart'];
const REACTION_EMOJI  = { fire: '🔥', heart: '❤️', eye: '👁️', sparkle: '✨', black_heart: '🖤' };

module.exports.REACTION_EMOJI = REACTION_EMOJI;

module.exports.getReactionsByPost = async (postId, userId) => {
    const { data, error } = await supabase
        .from('reactions')
        .select('emoji, user_id')
        .eq('post_id', postId);
    if (error) return { counts: {}, userReactions: [] };

    const counts = Object.fromEntries(REACTION_KEYS.map(k => [k, 0]));
    const userReactions = [];
    for (const r of (data || [])) {
        if (counts[r.emoji] !== undefined) counts[r.emoji]++;
        if (userId && r.user_id === userId) userReactions.push(r.emoji);
    }
    return { counts, userReactions };
};

module.exports.toggleReaction = async (postId, userId, emojiKey) => {
    if (!REACTION_KEYS.includes(emojiKey)) throw new Error('invalid reaction');

    const { data: existing } = await supabase
        .from('reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('emoji', emojiKey)
        .single();

    if (existing) {
        await supabase.from('reactions').delete()
            .eq('post_id', postId).eq('user_id', userId).eq('emoji', emojiKey);
    } else {
        await supabase.from('reactions').insert({ post_id: postId, user_id: userId, emoji: emojiKey });
    }

    return module.exports.getReactionsByPost(postId, userId);
};
```

- [ ] **Step 4: Commit**

```bash
git add supabase-migration-sprint3.sql blog-service.js
git commit -m "feat(reactions): add reactions table and service functions"
```

---

### Task 12: Reaction bar UI + AJAX route

**Files:**
- Modify: `server.js`
- Modify: `views/post.hbs`
- Modify: `public/css/main.css`

- [ ] **Step 1: Add the react route to `server.js`** (add after the comment delete route)

```js
// ── Routes: reactions ─────────────────────────────────────

app.post('/blog/:id/react', ensureLogin, async (req, res) => {
    try {
        const result = await blogService.toggleReaction(
            parseInt(req.params.id),
            req.session.user.id,
            req.body.emoji
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});
```

- [ ] **Step 2: Update the `/blog/:id` GET route in `server.js` to pass reactions**

Replace the existing `/blog/:id` route handler:

```js
app.get('/blog/:id', async (req, res) => {
    try {
        const post        = await blogService.getPostById(req.params.id);
        const allComments = await blogService.getCommentsByPost(req.params.id);
        const categories  = await blogService.getCategories();
        const { counts: reactionCounts, userReactions } =
            await blogService.getReactionsByPost(req.params.id, req.session.user?.id);

        const topLevel = allComments.filter(c => !c.parent_id);
        const replies  = allComments.filter(c => c.parent_id);
        const commentTree = topLevel.map(c => ({
            ...c,
            replies: replies.filter(r => r.parent_id === c.id)
        }));

        res.render('post', {
            post,
            commentTree,
            categories,
            commentCount:   allComments.length,
            reactionCounts: JSON.stringify(reactionCounts),
            userReactions:  JSON.stringify(userReactions)
        });
    } catch (err) {
        res.status(404).render('404');
    }
});
```

- [ ] **Step 3: Add reaction bar to `views/post.hbs`**

After the `{{{safeHTML post.body}}}` line and before the `<div class="post-footer-row">`, insert:

```html
<!-- Reaction bar -->
<div class="reaction-bar" id="reactionBar" data-post-id="{{post.id}}"></div>
```

At the bottom of `views/post.hbs`, add a new script block after the existing one:

```html
<script>
(function () {
    var KEYS  = ['fire','heart','eye','sparkle','black_heart'];
    var EMOJI = { fire:'🔥', heart:'❤️', eye:'👁️', sparkle:'✨', black_heart:'🖤' };
    var bar   = document.getElementById('reactionBar');
    if (!bar) return;
    var postId       = bar.dataset.postId;
    var counts       = JSON.parse(bar.closest('[data-reaction-counts]') ? '' : '{{reactionCounts}}');
    var userReacted  = JSON.parse('{{userReactions}}');

    function renderBar() {
        // Build reaction buttons using safe DOM methods
        bar.textContent = '';
        KEYS.forEach(function (key) {
            var btn = document.createElement('button');
            btn.className = 'reaction-btn' + (userReacted.indexOf(key) !== -1 ? ' reaction-btn--active' : '');
            btn.setAttribute('data-key', key);
            btn.setAttribute('type', 'button');
            btn.addEventListener('click', function () { react(key); });
            var emojiSpan = document.createElement('span');
            emojiSpan.textContent = EMOJI[key];
            var countSpan = document.createElement('span');
            countSpan.className = 'reaction-count';
            countSpan.textContent = counts[key] || 0;
            btn.appendChild(emojiSpan);
            btn.appendChild(document.createTextNode(' '));
            btn.appendChild(countSpan);
            bar.appendChild(btn);
        });
    }

    function react(key) {
        fetch('/blog/' + postId + '/react', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji: key })
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.counts) {
                counts      = data.counts;
                userReacted = data.userReactions;
                renderBar();
            }
        });
    }

    renderBar();
})();
</script>
```

Note: reaction counts and user reactions are passed via Handlebars template variables. The JS builds all DOM elements using `createElement` and `textContent` — no user content is inserted via `innerHTML`.

- [ ] **Step 4: Add reaction CSS to `public/css/main.css`**

Append:

```css
/* ── Reaction bar ─────────────────────────────────────────── */

.reaction-bar {
    display: flex;
    flex-wrap: wrap;
    gap: .5rem;
    margin: 1.5rem 0;
    padding: 1rem 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
}

.reaction-btn {
    display: inline-flex;
    align-items: center;
    gap: .35rem;
    padding: .3rem .85rem;
    background: rgba(255,255,255,0.05);
    border: 1px solid var(--border);
    border-radius: 20px;
    color: var(--text-secondary);
    font-size: .88rem;
    cursor: pointer;
    transition: background .15s, border-color .15s;
    line-height: 1;
}

.reaction-btn:hover {
    background: rgba(99,102,241,0.12);
    border-color: rgba(99,102,241,0.4);
    color: var(--text);
}

.reaction-btn--active {
    background: rgba(99,102,241,0.2);
    border-color: rgba(99,102,241,0.6);
    color: #a5b4fc;
}

.reaction-count {
    font-size: .8rem;
    font-weight: 600;
}
```

- [ ] **Step 5: Verify**

Open any post. A row of five emoji buttons appears below the body. Click 🔥 — it highlights in indigo and the count increments without a page reload. Click it again — unhighlights and count decrements. Refresh — count persists from the database.

- [ ] **Step 6: Commit**

```bash
git add server.js views/post.hbs public/css/main.css
git commit -m "feat(reactions): add emoji reaction bar to post pages"
```

---

### Task 13: Member alias profiles

**Files:**
- Modify: `blog-service.js`
- Modify: `server.js`
- Create: `views/member.hbs`
- Modify: `views/post.hbs`
- Modify: `views/blog.hbs`
- Modify: `public/css/main.css`

- [ ] **Step 1: Add `getMemberByUsername` to `blog-service.js`**

Append to `blog-service.js`:

```js
module.exports.getMemberByUsername = async (username) => {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio, created_at')
        .eq('username', username)
        .single();
    if (error || !profile) throw new Error('member not found');

    const { data: posts } = await supabase
        .from('posts')
        .select('id, title, body, created_at')
        .eq('author_id', profile.id)
        .eq('published', true)
        .order('created_at', { ascending: false });

    return { ...profile, posts: posts || [] };
};
```

- [ ] **Step 2: Add route to `server.js`** (add before the 404 handler)

```js
// ── Routes: member profiles ───────────────────────────────

app.get('/member/:username', ensureLogin, async (req, res) => {
    try {
        const member     = await blogService.getMemberByUsername(req.params.username);
        const categories = await blogService.getCategories();
        res.render('member', { member, categories });
    } catch (err) {
        res.status(404).render('404');
    }
});
```

- [ ] **Step 3: Create `views/member.hbs`**

```html
<div class="container py-5">
    <div class="row justify-content-center">
        <div class="col-lg-8">

            <div class="member-profile-header mb-5">
                <div>
                    {{#if member.avatar_url}}
                    <img src="{{member.avatar_url}}" alt="" class="member-avatar">
                    {{else}}
                    <span class="member-avatar-initials">{{avatarInitial member.username}}</span>
                    {{/if}}
                </div>
                <div class="member-profile-info">
                    <h1 class="member-name">{{member.username}}</h1>
                    <p class="member-since">Member since {{formatDate member.created_at}}</p>
                    {{#if member.bio}}
                    <p class="member-bio">{{member.bio}}</p>
                    {{/if}}
                </div>
            </div>

            <div class="member-section-label">POSTS BY {{member.username}}</div>
            {{#if member.posts.length}}
            <div class="member-posts-list">
                {{#each member.posts}}
                <a href="/blog/{{id}}" class="member-post-item">
                    <span class="member-post-title">
                        {{#if title}}{{title}}{{else}}{{excerpt body 60}}{{/if}}
                    </span>
                    <span class="member-post-date">{{timeAgo created_at}}</span>
                </a>
                {{/each}}
            </div>
            {{else}}
            <p class="text-muted">No published posts yet.</p>
            {{/if}}

        </div>
    </div>
</div>
```

- [ ] **Step 4: Add member profile CSS to `public/css/main.css`**

Append:

```css
/* ── Member alias profile ─────────────────────────────────── */

.member-profile-header {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
}

.member-avatar {
    width: 72px; height: 72px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid rgba(99,102,241,0.4);
    flex-shrink: 0;
}

.member-avatar-initials {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: var(--bg-elevated);
    border: 2px solid rgba(99,102,241,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.6rem;
    font-weight: 700;
    color: var(--primary);
    flex-shrink: 0;
}

.member-name  { font-size: 1.5rem; font-weight: 700; margin: 0 0 .25rem; }
.member-since { color: var(--text-muted); font-size: .82rem; margin: 0 0 .4rem; }
.member-bio   { color: var(--text-secondary); font-style: italic; margin: 0; font-size: .9rem; }

.member-section-label {
    font-family: var(--font-mono);
    font-size: .72rem;
    letter-spacing: .12em;
    color: var(--primary);
    margin-bottom: .75rem;
}

.member-posts-list { display: flex; flex-direction: column; gap: .5rem; }

.member-post-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: .75rem 1rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    text-decoration: none;
    transition: background .15s, border-color .15s;
    gap: 1rem;
}

.member-post-item:hover {
    background: var(--bg-elevated);
    border-color: rgba(99,102,241,0.35);
}

.member-post-title { color: var(--text); font-weight: 500; font-size: .9rem; }
.member-post-date  { color: var(--text-muted); font-size: .78rem; white-space: nowrap; flex-shrink: 0; }

.member-link:hover { color: var(--primary) !important; }
```

- [ ] **Step 5: Make author names links in `views/post.hbs`**

In the post header, replace the static username display:

```html
{{!-- BEFORE --}}
<div class="fw-medium">{{post.profiles.username}}</div>

{{!-- AFTER --}}
<a href="/member/{{post.profiles.username}}" class="fw-medium text-decoration-none text-body member-link">
    {{post.profiles.username}}
</a>
```

In each comment (top-level and replies), replace `<span class="fw-semibold">{{profiles.username}}</span>`:

```html
<a href="/member/{{profiles.username}}" class="fw-semibold text-decoration-none text-body member-link">
    {{profiles.username}}
</a>
```

- [ ] **Step 6: Make author names links in `views/blog.hbs`**

In the featured post section, replace the static username:

```html
<a href="/member/{{featuredPost.profiles.username}}" class="text-decoration-none text-body member-link">
    {{featuredPost.profiles.username}}
</a>
```

In each post card, replace:

```html
<a href="/member/{{profiles.username}}" class="text-decoration-none text-body member-link">
    {{profiles.username}}
</a>
```

- [ ] **Step 7: Verify**

Open the blog. Click any author's alias — should navigate to `/member/theirusername` showing their avatar, bio, member-since date, and post list. Click author names in comments — same result.

- [ ] **Step 8: Commit**

```bash
git add blog-service.js server.js views/member.hbs views/post.hbs views/blog.hbs public/css/main.css
git commit -m "feat(profiles): add member alias profile pages at /member/:username"
```

---

## Sprint 4 — The Club Chat Room

---

### Task 14: Messages DB + service functions

**Files:**
- Create: `supabase-migration-sprint4.sql`
- Modify: `blog-service.js`

- [ ] **Step 1: Write the migration**

```sql
-- supabase-migration-sprint4.sql

CREATE TABLE IF NOT EXISTS public.messages (
    id         bigserial primary key,
    author_id  uuid references auth.users(id) on delete cascade not null,
    body       text not null,
    created_at timestamptz default now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Messages viewable by members" ON public.messages
    FOR SELECT USING (true);

CREATE POLICY "Members can send messages" ON public.messages
    FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Members delete own messages" ON public.messages
    FOR DELETE USING (auth.uid() = author_id);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Paste and run. Then enable Realtime on the messages table:

Supabase Dashboard -> Database -> Replication -> find `messages` table -> toggle Realtime ON.

This is required for the browser subscription to receive live push events.

- [ ] **Step 3: Add service functions to `blog-service.js`**

Append to `blog-service.js`:

```js
module.exports.getMessageHistory = async (limit) => {
    limit = limit || 100;
    const { data, error } = await supabase
        .from('messages')
        .select('id, body, author_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return [];
    return attachProfiles((data || []).reverse());
};

module.exports.insertMessage = async (authorId, body) => {
    var text = (body || '').trim();
    if (!text) throw new Error('message cannot be empty');
    if (text.length > 2000) throw new Error('message too long');
    const { data, error } = await supabase
        .from('messages')
        .insert({ author_id: authorId, body: text })
        .select('id, created_at')
        .single();
    if (error) throw new Error('unable to send message');
    return data;
};

module.exports.deleteMessage = async (messageId, requesterId, isAdmin) => {
    const { data: msg } = await supabase
        .from('messages').select('author_id').eq('id', messageId).single();
    if (!msg) throw new Error('message not found');
    if (!isAdmin && msg.author_id !== requesterId) throw new Error('not authorised');
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) throw new Error('unable to delete message');
};

module.exports.getLatestMessageId = async () => {
    const { data } = await supabase
        .from('messages').select('id').order('id', { ascending: false }).limit(1).single();
    return data ? data.id : 0;
};

module.exports.getAllMemberUsernames = async () => {
    const { data } = await supabase
        .from('profiles')
        .select('username')
        .eq('status', 'approved')
        .order('username');
    return (data || []).map(function (p) { return p.username; });
};
```

- [ ] **Step 4: Commit**

```bash
git add supabase-migration-sprint4.sql blog-service.js
git commit -m "feat(chat): add messages table and service functions"
```

---

### Task 15: Chat room routes + base UI

**Files:**
- Modify: `server.js`
- Create: `views/chat.hbs`
- Modify: `public/css/main.css`

- [ ] **Step 1: Add chat routes to `server.js`** (add before the 404 handler)

```js
// ── Routes: club chat ─────────────────────────────────────

app.get('/chat', ensureLogin, async (req, res) => {
    try {
        const messages = await blogService.getMessageHistory(100);
        const members  = await blogService.getAllMemberUsernames();
        res.render('chat', {
            messages,
            membersJson:     JSON.stringify(members),
            supabaseUrl:     process.env.SUPABASE_URL,
            supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
            currentUserId:   req.session.user.id,
            currentUsername: req.session.user.username,
            isAdmin:         !!req.session.user.isAdmin
        });
    } catch (err) {
        res.render('chat', {
            messages: [], membersJson: '[]',
            supabaseUrl: '', supabaseAnonKey: '',
            currentUserId: '', currentUsername: '', isAdmin: false
        });
    }
});

app.post('/chat/send', ensureLogin, async (req, res) => {
    try {
        const result = await blogService.insertMessage(req.session.user.id, req.body.body);
        res.json({ ok: true, id: result.id, created_at: result.created_at });
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.delete('/chat/:id', ensureLogin, async (req, res) => {
    try {
        await blogService.deleteMessage(
            parseInt(req.params.id),
            req.session.user.id,
            req.session.user.isAdmin
        );
        res.json({ ok: true });
    } catch (err) {
        res.status(403).json({ error: err.message });
    }
});

app.get('/chat/unread-count', ensureLogin, async (req, res) => {
    try {
        const latestId = await blogService.getLatestMessageId();
        res.json({ latestId });
    } catch (e) {
        res.json({ latestId: 0 });
    }
});
```

- [ ] **Step 2: Create `views/chat.hbs`**

```html
<div class="chat-layout">

    <div class="chat-header">
        <div class="chat-header-inner">
            <span class="chat-header-icon">&#x1F4AC;</span>
            <div>
                <div class="chat-header-title">The Room</div>
                <div class="chat-header-sub">Club9 &middot; members only</div>
            </div>
        </div>
    </div>

    <div class="chat-messages" id="chatMessages">
        {{#each messages}}
        <div class="chat-msg" data-id="{{id}}" data-author="{{author_id}}">
            <div class="chat-msg-avatar">
                {{#if profiles.avatar_url}}
                <img src="{{profiles.avatar_url}}" alt="" class="chat-avatar-img">
                {{else}}
                <span class="chat-avatar-initials">{{avatarInitial profiles.username}}</span>
                {{/if}}
            </div>
            <div class="chat-msg-content">
                <div class="chat-msg-meta">
                    <a href="/member/{{profiles.username}}" class="chat-msg-author">{{profiles.username}}</a>
                    <span class="chat-msg-time" data-ts="{{created_at}}"></span>
                </div>
                <div class="chat-msg-body" data-raw="{{body}}"></div>
            </div>
            <button class="chat-delete-btn" data-msgid="{{id}}" title="Delete message">
                <i class="bi bi-trash"></i>
            </button>
        </div>
        {{/each}}
    </div>

    <div class="mention-dropdown" id="mentionDropdown"></div>

    <div class="chat-input-bar">
        <div class="chat-input-wrap">
            <textarea id="chatInput" class="chat-input"
                placeholder="Message the room&#x2026; type @ to mention"
                rows="1" maxlength="2000"></textarea>
        </div>
        <button class="chat-send-btn" id="chatSendBtn" type="button">
            <i class="bi bi-send-fill"></i>
        </button>
    </div>
</div>

<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>
<script>
(function () {
    'use strict';

    var SUPABASE_URL      = '{{supabaseUrl}}';
    var SUPABASE_ANON_KEY = '{{supabaseAnonKey}}';
    var CURRENT_USER_ID   = '{{currentUserId}}';
    var CURRENT_USERNAME  = '{{currentUsername}}';
    var IS_ADMIN          = {{#if isAdmin}}true{{else}}false{{/if}};
    var members           = JSON.parse('{{membersJson}}');

    var sbClient  = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    var container = document.getElementById('chatMessages');
    var inputEl   = document.getElementById('chatInput');
    var sendBtn   = document.getElementById('chatSendBtn');
    var dropdown  = document.getElementById('mentionDropdown');

    var mentionStart = -1;

    // ── Helpers ───────────────────────────────────────────

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatTime(ts) {
        if (!ts) return '';
        var d   = new Date(ts);
        var now = new Date();
        var sameDay = d.toDateString() === now.toDateString();
        if (sameDay) {
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        }
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
               d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function scrollToBottom() {
        container.scrollTop = container.scrollHeight;
    }

    function autoResize() {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
    }

    // ── Render body text with @mention links (XSS-safe) ──
    // Escape HTML first, then replace @alias patterns with anchor elements.
    function renderBodyInto(el, rawText) {
        el.textContent = '';
        var escaped = escapeHtml(rawText);
        var parts   = escaped.split(/(@\w+)/g);
        parts.forEach(function (part) {
            var mentionMatch = part.match(/^@(\w+)$/);
            if (mentionMatch) {
                var alias = mentionMatch[1];
                var found = members.find(function (m) {
                    return m.toLowerCase() === alias.toLowerCase();
                });
                if (found) {
                    var a = document.createElement('a');
                    a.href      = '/member/' + found;
                    a.className = 'chat-mention';
                    a.textContent = '@' + found;
                    el.appendChild(a);
                    return;
                }
            }
            el.appendChild(document.createTextNode(part));
        });
    }

    // ── Build a message DOM element ───────────────────────
    function buildMsgEl(msg) {
        var isOwn  = msg.author_id === CURRENT_USER_ID;
        var canDel = isOwn || IS_ADMIN;

        var outer = document.createElement('div');
        outer.className       = 'chat-msg';
        outer.dataset.id      = msg.id;
        outer.dataset.author  = msg.author_id;

        // Avatar
        var avatarDiv = document.createElement('div');
        avatarDiv.className = 'chat-msg-avatar';
        if (msg.avatar_url) {
            var img = document.createElement('img');
            img.src       = msg.avatar_url;
            img.alt       = '';
            img.className = 'chat-avatar-img';
            avatarDiv.appendChild(img);
        } else {
            var initSpan = document.createElement('span');
            initSpan.className   = 'chat-avatar-initials';
            initSpan.textContent = (msg.username || '?')[0].toUpperCase();
            avatarDiv.appendChild(initSpan);
        }
        outer.appendChild(avatarDiv);

        // Content
        var contentDiv = document.createElement('div');
        contentDiv.className = 'chat-msg-content';

        var metaDiv = document.createElement('div');
        metaDiv.className = 'chat-msg-meta';

        var authorLink = document.createElement('a');
        authorLink.href       = '/member/' + (msg.username || '');
        authorLink.className  = 'chat-msg-author';
        authorLink.textContent = msg.username || 'unknown';
        metaDiv.appendChild(authorLink);

        var timeSpan = document.createElement('span');
        timeSpan.className   = 'chat-msg-time';
        timeSpan.textContent = formatTime(msg.created_at);
        metaDiv.appendChild(timeSpan);

        contentDiv.appendChild(metaDiv);

        var bodyDiv = document.createElement('div');
        bodyDiv.className = 'chat-msg-body';
        renderBodyInto(bodyDiv, msg.body || '');
        contentDiv.appendChild(bodyDiv);

        outer.appendChild(contentDiv);

        // Delete button
        if (canDel) {
            var delBtn = document.createElement('button');
            delBtn.className = 'chat-delete-btn';
            delBtn.title     = 'Delete message';
            delBtn.dataset.msgid = msg.id;
            delBtn.setAttribute('type', 'button');
            delBtn.innerHTML = '<i class="bi bi-trash"></i>';
            outer.appendChild(delBtn);
        }

        return outer;
    }

    // ── Render existing messages on load ──────────────────
    container.querySelectorAll('.chat-msg').forEach(function (el) {
        var bodyEl  = el.querySelector('.chat-msg-body');
        var timeEl  = el.querySelector('.chat-msg-time');
        var delBtn  = el.querySelector('.chat-delete-btn');
        var isOwn   = el.dataset.author === CURRENT_USER_ID;
        var canDel  = isOwn || IS_ADMIN;

        if (bodyEl) renderBodyInto(bodyEl, bodyEl.dataset.raw || '');
        if (timeEl && timeEl.dataset.ts) timeEl.textContent = formatTime(timeEl.dataset.ts);
        if (delBtn && !canDel) delBtn.remove();
    });

    // Store last-seen message ID
    var lastMsgEl = container.querySelector('.chat-msg:last-child');
    if (lastMsgEl) localStorage.setItem('club9_last_msg', lastMsgEl.dataset.id);

    scrollToBottom();

    // ── Supabase Realtime subscription ────────────────────
    sbClient.channel('public:messages')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
            function (payload) {
                var row = payload.new;
                // Fetch profile for the new message author
                sbClient.from('profiles')
                    .select('username, avatar_url')
                    .eq('id', row.author_id)
                    .single()
                    .then(function (result) {
                        var profile = result.data || {};
                        var msg = {
                            id:         row.id,
                            author_id:  row.author_id,
                            body:       row.body,
                            created_at: row.created_at,
                            username:   profile.username,
                            avatar_url: profile.avatar_url
                        };
                        container.appendChild(buildMsgEl(msg));
                        localStorage.setItem('club9_last_msg', row.id);
                        scrollToBottom();
                    });
            }
        )
        .subscribe();

    // ── Send message ──────────────────────────────────────
    function sendMessage() {
        var body = inputEl.value.trim();
        if (!body) return;
        inputEl.value = '';
        autoResize();
        closeMentionDropdown();
        fetch('/chat/send', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ body: body })
        }).catch(function (e) { console.error(e); });
    }

    sendBtn.addEventListener('click', sendMessage);

    inputEl.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (dropdown.style.display === 'block') {
                var active = dropdown.querySelector('.mention-item.active');
                if (active) { active.click(); return; }
            }
            sendMessage();
        }
        if (e.key === 'Escape') closeMentionDropdown();
    });

    // ── Delete message ────────────────────────────────────
    container.addEventListener('click', function (e) {
        var btn = e.target.closest('.chat-delete-btn');
        if (!btn) return;
        if (!confirm('Delete this message?')) return;
        var msgId = btn.dataset.msgid;
        fetch('/chat/' + msgId, { method: 'DELETE' })
            .then(function (r) { return r.json(); })
            .then(function (data) {
                if (data.ok) {
                    var msgEl = container.querySelector('.chat-msg[data-id="' + msgId + '"]');
                    if (msgEl) msgEl.remove();
                }
            });
    });

    // ── @mention autocomplete ─────────────────────────────
    function closeMentionDropdown() {
        dropdown.style.display = 'none';
        dropdown.textContent   = '';
        mentionStart = -1;
    }

    function insertMention(username) {
        var val    = inputEl.value;
        var before = val.slice(0, mentionStart);
        var after  = val.slice(inputEl.selectionStart);
        inputEl.value = before + '@' + username + ' ' + after;
        inputEl.focus();
        closeMentionDropdown();
    }

    inputEl.addEventListener('input', function () {
        autoResize();
        var val    = inputEl.value;
        var pos    = inputEl.selectionStart;
        var before = val.slice(0, pos);
        var match  = before.match(/@(\w*)$/);
        if (!match) { closeMentionDropdown(); return; }

        mentionStart = before.lastIndexOf('@');
        var query    = match[1].toLowerCase();
        var filtered = members.filter(function (m) {
            return m.toLowerCase().startsWith(query);
        }).slice(0, 6);

        if (!filtered.length) { closeMentionDropdown(); return; }

        dropdown.textContent = '';
        filtered.forEach(function (name, i) {
            var item = document.createElement('div');
            item.className   = 'mention-item' + (i === 0 ? ' active' : '');
            item.textContent = name;
            item.addEventListener('click', function () { insertMention(name); });
            item.addEventListener('mouseover', function () {
                dropdown.querySelectorAll('.mention-item').forEach(function (el) {
                    el.classList.remove('active');
                });
                item.classList.add('active');
            });
            dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
    });

    document.addEventListener('click', function (e) {
        if (!dropdown.contains(e.target) && e.target !== inputEl) {
            closeMentionDropdown();
        }
    });
})();
</script>
```

- [ ] **Step 3: Add chat CSS to `public/css/main.css`**

Append:

```css
/* ── Club Chat ────────────────────────────────────────────── */

.chat-layout {
    display: flex;
    flex-direction: column;
    height: calc(100vh - var(--nav-h));
    max-width: 860px;
    margin: 0 auto;
    position: relative;
}

.chat-header {
    border-bottom: 1px solid var(--border);
    padding: 1rem 1.5rem;
    flex-shrink: 0;
}

.chat-header-inner   { display: flex; align-items: center; gap: .75rem; }
.chat-header-icon    { font-size: 1.4rem; }
.chat-header-title   { font-weight: 700; font-size: 1rem; }
.chat-header-sub     { font-size: .75rem; color: var(--text-muted); font-family: var(--font-mono); letter-spacing: .06em; }

.chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
    display: flex;
    flex-direction: column;
    gap: .15rem;
}

.chat-msg {
    display: flex;
    align-items: flex-start;
    gap: .75rem;
    padding: .35rem .5rem;
    border-radius: var(--radius-sm);
    position: relative;
}

.chat-msg:hover                { background: rgba(255,255,255,0.03); }
.chat-msg:hover .chat-delete-btn { opacity: 1; }

.chat-avatar-img {
    width: 34px; height: 34px;
    border-radius: 50%;
    object-fit: cover;
    flex-shrink: 0;
}

.chat-avatar-initials {
    width: 34px; height: 34px;
    border-radius: 50%;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: .75rem;
    font-weight: 700;
    color: var(--primary);
    flex-shrink: 0;
}

.chat-msg-content { flex: 1; min-width: 0; }

.chat-msg-meta {
    display: flex;
    align-items: baseline;
    gap: .6rem;
    margin-bottom: .2rem;
}

.chat-msg-author {
    font-weight: 700;
    font-size: .85rem;
    color: var(--primary);
    text-decoration: none;
}
.chat-msg-author:hover { text-decoration: underline; }
.chat-msg-time  { font-size: .72rem; color: var(--text-muted); }

.chat-msg-body {
    font-size: .9rem;
    color: var(--text);
    line-height: 1.55;
    word-break: break-word;
}

.chat-mention {
    color: var(--primary);
    font-weight: 600;
    text-decoration: none;
}
.chat-mention:hover { text-decoration: underline; }

.chat-delete-btn {
    opacity: 0;
    transition: opacity .15s;
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: .25rem .4rem;
    border-radius: 4px;
    font-size: .8rem;
    flex-shrink: 0;
    align-self: center;
}
.chat-delete-btn:hover { color: #fca5a5; background: rgba(239,68,68,0.1); }

.chat-input-bar {
    border-top: 1px solid var(--border);
    padding: .75rem 1.5rem;
    display: flex;
    gap: .75rem;
    align-items: flex-end;
    flex-shrink: 0;
}

.chat-input-wrap { flex: 1; }

.chat-input {
    width: 100%;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    color: var(--text);
    font-family: var(--font-sans);
    font-size: .9rem;
    padding: .6rem .9rem;
    resize: none;
    line-height: 1.5;
    max-height: 120px;
    overflow-y: auto;
    transition: border-color .2s;
}
.chat-input:focus { outline: none; border-color: rgba(99,102,241,0.5); }

.chat-send-btn {
    background: var(--primary);
    border: none;
    border-radius: var(--radius-sm);
    color: #fff;
    width: 38px; height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: background .2s;
}
.chat-send-btn:hover { background: var(--primary-dark); }

.mention-dropdown {
    display: none;
    position: absolute;
    bottom: 70px;
    left: 1.5rem;
    right: 1.5rem;
    background: var(--bg-elevated);
    border: 1px solid var(--border);
    border-radius: var(--radius-sm);
    overflow: hidden;
    z-index: 100;
    box-shadow: var(--shadow-md);
    max-height: 200px;
    overflow-y: auto;
}

.mention-item {
    padding: .5rem 1rem;
    font-size: .85rem;
    cursor: pointer;
    color: var(--text);
    transition: background .12s;
}
.mention-item:hover,
.mention-item.active { background: rgba(99,102,241,0.15); color: var(--primary); }

/* Chat unread badge */
.chat-unread-badge {
    margin-left: auto;
    color: var(--primary);
    font-size: .65rem;
    line-height: 1;
}

@media (max-width: 768px) {
    .chat-layout   { height: calc(100vh - var(--nav-h) - 60px); }
    .chat-messages { padding: .75rem 1rem; }
    .chat-input-bar { padding: .6rem 1rem; }
    .mention-dropdown { left: 1rem; right: 1rem; }
}
```

- [ ] **Step 4: Verify**

Start the server. Go to `/chat`. The message list should load (empty if no messages yet). Type a message and press Enter — it should appear via Realtime. Open a second browser tab and log in with a different approved account. Send a message from one tab — it should appear in the other within 1–2 seconds.

- [ ] **Step 5: Commit**

```bash
git add server.js views/chat.hbs public/css/main.css
git commit -m "feat(chat): add real-time chat room with Supabase Realtime and @mentions"
```

---

### Task 16: Sidebar chat link + unread badge

**Files:**
- Modify: `views/blog.hbs`
- Modify: `views/layouts/main.hbs`

- [ ] **Step 1: Add chat section to sidebar in `views/blog.hbs`**

Inside the `<aside class="category-sidebar">` block, add before the `<div class="sidebar-footer">`:

```html
<div class="sidebar-section">
    <div class="sidebar-section-header">The Room</div>
    <nav class="sidebar-nav">
        <a href="/chat" class="sidebar-link" id="chatSidebarLink">
            <i class="bi bi-chat-fill sidebar-icon"></i>
            <span>Club Chat</span>
            <span class="chat-unread-badge" id="chatUnreadBadge" style="display:none">&#x25CF;</span>
        </a>
    </nav>
</div>
```

- [ ] **Step 2: Add unread badge script at the bottom of `views/blog.hbs`**

```html
<script>
(function () {
    var badge = document.getElementById('chatUnreadBadge');
    if (!badge) return;
    var lastSeen = parseInt(localStorage.getItem('club9_last_msg') || '0', 10);
    fetch('/chat/unread-count')
        .then(function (r) { return r.json(); })
        .then(function (data) {
            if (data.latestId && data.latestId > lastSeen) {
                badge.style.display = 'inline';
            }
        })
        .catch(function () {});
})();
</script>
```

- [ ] **Step 3: Add chat link to the main navbar dropdown in `views/layouts/main.hbs`**

In the dropdown menu, after the Dashboard and Categories links:

```html
<li><a class="dropdown-item" href="/chat">
    <i class="bi bi-chat me-2 text-muted"></i>The Room
</a></li>
```

- [ ] **Step 4: Verify**

Go to `/blog`. The sidebar shows a "Club Chat" link under "The Room". Open `/chat` in another tab, send a message. Navigate back to `/blog` — a dot `●` appears on the chat link. Click the link, visit `/chat` — the dot disappears on the next `/blog` load (since `localStorage` is updated when chat is visited).

- [ ] **Step 5: Commit**

```bash
git add views/blog.hbs views/layouts/main.hbs
git commit -m "feat(chat): add sidebar chat link with unread dot indicator"
```

---

## Final End-to-End Verification Checklist

- [ ] Register a new account → lands on `/pending` with the ring animation
- [ ] Log in as admin → go to `/admin/approvals` → account appears → click Approve
- [ ] New account clicks "CHECK AGAIN" → redirected to `/terms`
- [ ] New account reads rules, ticks checkbox, clicks "ENTER CLUB9" → lands on `/blog`
- [ ] Member writes a post using Quill: uses bold, inserts an inline image, publishes
- [ ] Another member opens the post → reacts with fire emoji → count increments without reload
- [ ] Click the author's alias → `/member/:username` shows avatar, bio, post list
- [ ] Go to `/chat` → type a message with Enter → appears in real-time in a second tab
- [ ] Type `@` in chat → member dropdown appears → click a name → mention inserted → renders as indigo link after send
- [ ] Admin hovers any chat message → trash icon appears → deletes it → message disappears
- [ ] Regular member: trash only appears on own messages
- [ ] Go to `/categories` as non-admin → no Add/Delete controls visible; `/categories/add` returns 403
- [ ] Go to `/categories` as admin → Add/Delete controls visible and functional

---

## Spec Coverage Check

| Spec requirement | Task |
|---|---|
| `status` column on profiles | Task 1 |
| `terms_accepted` column | Task 1 |
| `loginUser` returns status + terms_accepted | Task 2 |
| 5-step auth middleware | Task 3 |
| Pending gate screen + Check again | Tasks 4, 5 |
| Rejected gate screen | Task 4 |
| `/auth/refresh-status` | Task 5 |
| Admin approval queue | Task 6 |
| Approvals link in admin dropdown | Task 6 |
| Admin-only category mutations | Task 7 |
| UI guard on category add/delete | Task 7 |
| Quill rich text editor | Task 8 |
| Optional post title | Task 8 |
| Inline image upload via ImageKit | Task 9 |
| Rules & conditions gate | Task 10 |
| `acceptTerms` service function | Task 10 |
| `reactions` table + RLS | Task 11 |
| `toggleReaction` / `getReactionsByPost` | Task 11 |
| Reaction bar UI + AJAX + XSS-safe DOM | Task 12 |
| `/member/:username` profile page | Task 13 |
| Author names as links everywhere | Tasks 13 |
| `messages` table + RLS | Task 14 |
| Supabase Realtime enabled on messages | Task 14 |
| Chat room UI | Task 15 |
| `@mention` autocomplete (XSS-safe) | Task 15 |
| Delete own / admin deletes any message | Task 15 |
| Sidebar chat link + unread badge | Task 16 |
| Chat link in navbar dropdown | Task 16 |
