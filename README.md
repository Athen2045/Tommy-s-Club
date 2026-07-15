# Tommy's Club

A private, invite-only community platform. Members write posts, react, comment, and chat in real time — all behind a curated approval gate. Built with a 1980s CRT retro aesthetic.

---

## Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 4 |
| Templates | Handlebars (express-handlebars) |
| Database & Auth | Supabase (PostgreSQL + Auth) |
| Realtime | Supabase Postgres Changes → server-side WebSocket relay |
| File Storage | ImageKit |
| Sessions | express-session |
| Security | helmet, express-rate-limit, sanitize-html |

---

## Features

- **Invite-only access** — new registrations sit in a pending queue until approved by an admin
- **Terms gate** — approved members must accept house rules before entering
- **Blog** — rich-text posts (Quill editor) with categories, reactions, and threaded comments
- **The Room** — real-time chat with @mention autocomplete (Mac System 1 aesthetic)
- **Member profiles** — avatar, bio, post history
- **Admin panel** — approve / reject pending members, manage categories
- **CRT UI** — scanlines, neon glow, boot sequence, hamburger nav on mobile

---

## Setup

### 1. Clone and install

```bash
git clone <repository-url>
cd "Tommy's Club"
npm install
```

### 2. Environment variables

Copy the example file and fill in your credentials:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (server-only) |
| `SESSION_SECRET` | Long random string — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | ImageKit private key |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit URL endpoint |
| `ADMIN_EMAIL` | Email address that receives admin privileges on login |
| `NODE_ENV` | Set to `production` on your server |

### 3. Run

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

App runs at `http://localhost:8080`

---

## Project Structure

```
Tommy's Club/
├── server.js               # Express app, all routes, WebSocket server, security middleware
├── auth-service.js         # Supabase Auth — register, login
├── blog-service.js         # Supabase DB — posts, comments, reactions, chat, profiles
├── public/
│   └── css/
│       └── crt.css         # CRT design system (tokens, layout, animations, responsive)
├── views/
│   ├── layouts/
│   │   ├── main.hbs        # Authenticated layout — topbar, sidebar, CRT frame
│   │   └── gate.hbs        # Unauthenticated layout — bare CRT screen
│   ├── login.hbs           # Boot sequence + login form
│   ├── register.hbs        # Registration form
│   ├── blog.hbs            # Post feed — THE VAULT
│   ├── post.hbs            # Post detail — reactions + threaded comments
│   ├── chat.hbs            # Real-time chat — The Room
│   ├── profile.hbs         # Edit your profile
│   ├── member.hbs          # Public member page
│   ├── posts.hbs           # Dashboard — manage your posts
│   ├── addPost.hbs         # Write / edit a post
│   ├── categories.hbs      # Channel list
│   ├── about.hbs           # About page
│   ├── pending.hbs         # Awaiting approval screen
│   ├── rejected.hbs        # Rejected screen
│   ├── terms.hbs           # House rules acceptance
│   ├── 404.hbs             # Not found
│   └── admin/
│       └── approvals.hbs   # Admin approval queue
├── .env.example            # Environment variable template
└── package.json
```

---

## Security

| Control | Detail |
|---|---|
| Session cookie | `httpOnly`, `sameSite: lax`, `secure` in production |
| Security headers | `helmet` — CSP, X-Frame-Options, HSTS, referrer policy, and more |
| Rate limiting | Login: 10 attempts / 15 min · Register: 5 accounts / hour per IP |
| CSRF | All destructive actions use `POST` forms — `sameSite: lax` blocks cross-site POSTs |
| XSS — post body | `sanitize-html` allowlist strips event attributes, `javascript:` URIs, unknown tags |
| XSS — chat | `createTextNode` only — `innerHTML` never used |
| File uploads | Image MIME types only (JPEG, PNG, GIF, WebP, AVIF), 8 MB max |
| Ownership checks | Delete post / comment verifies `author_id === userId` or `isAdmin` |
| Realtime credentials | Supabase anon key never sent to client — WebSocket relay proxies events server-side |
| Admin | `isAdmin` resolved from `ADMIN_EMAIL` env var at login time |
| Dependencies | 0 known vulnerabilities (`npm audit`) |

---

## Routes

### Public
| Method | Path | Description |
|---|---|---|
| GET | `/` | Redirect to `/blog` |
| GET | `/blog` | Post feed |
| GET | `/blog/:id` | Single post |
| GET | `/about` | About page |
| GET | `/login` | Login form |
| POST | `/login` | Authenticate (rate-limited) |
| GET | `/register` | Registration form |
| POST | `/register` | Create account (rate-limited) |
| POST | `/logout` | Destroy session |

### Authenticated
| Method | Path | Description |
|---|---|---|
| GET | `/posts` | Your post dashboard |
| GET | `/posts/add` | Write a post |
| POST | `/posts/add` | Submit a post |
| POST | `/posts/delete/:id` | Delete own post |
| GET | `/profile` | View / edit profile |
| POST | `/account/delete` | Re-authenticate and permanently delete your account |
| GET | `/member/:username` | Public member profile |
| GET | `/chat` | Real-time chat |
| POST | `/chat/send` | Send message |
| DELETE | `/chat/:id` | Delete own message |
| POST | `/blog/:id/comments` | Post a comment |
| POST | `/comments/delete/:id` | Delete own comment |
| POST | `/blog/:id/react` | Toggle reaction |
| GET | `/categories` | Channel list |

### Admin only
| Method | Path | Description |
|---|---|---|
| GET | `/admin/approvals` | Pending member queue |
| POST | `/admin/approvals/:id/approve` | Approve a member |
| POST | `/admin/approvals/:id/reject` | Reject a member |
| GET | `/categories/add` | Add channel form |
| POST | `/categories/add` | Create channel |
| POST | `/categories/delete/:id` | Delete channel |
