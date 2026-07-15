# Tommy’s Club

Tommy’s Club is a small open-source experiment about making a corner of the internet feel a little more human.

It is also a passion project and a testing ground. I use it to try out ideas around writing, identity, privacy, community, realtime chat, media uploads, and the small details that make a website feel like a place instead of a dashboard. It is not presented as a finished product or a production-ready social network. It is a place to build, learn, break things, and keep improving.

The login gate keeps its CRT character. Once inside, the application becomes a responsive editorial-pixel space inspired by magazines, 1990s web graphics, and modern social interfaces.

## What you can explore

- Email-verified accounts with terms acceptance and later admin approval or rejection.
- A blog with categories, drafts, publishing, reactions, threaded comments, and optimized images.
- The Room, a realtime chat with @mentions and text or image messages.
- Pseudonymous profiles with avatars, bios, username uniqueness, privacy controls, and account settings.
- A small admin area for approvals and category management.
- Responsive navigation, accessible motion, a CRT login gate, and an Anime.js entry transition.

## Tools and technologies

| Area | Tools |
| --- | --- |
| Runtime | Node.js |
| Server | Express 4 |
| Templates | Handlebars via `express-handlebars` |
| Languages | JavaScript, HTML, CSS, SQL |
| Database and auth | Supabase, PostgreSQL, Supabase Auth |
| Realtime | Supabase Postgres Changes and a server-side WebSocket relay |
| Media | ImageKit, Multer |
| Writing UI | Quill |
| Motion | Anime.js and CSS animations |
| Icons | Bootstrap Icons |
| Security | Helmet, `express-rate-limit`, `sanitize-html`, CSRF tokens, RLS |
| Project tooling | npm, Git, GitHub |

## Design references and influences

The project borrows visual and interaction cues from several places, while the implementation and content are being developed specifically for Tommy’s Club:

- CRT terminals and scanline-based login screens.
- 1990s editorial layouts, newsprint textures, pixel-art labels, hard shadows, and registration marks.
- X/Twitter-style profile navigation and mobile profile sheets.
- Reddit and X/Twitter-style feed media behavior, especially responsive image sizing and readable conversation layouts.
- Avatar, dropdown, and loader ideas from [Kokonut UI](https://kokonutui.com/) and the [Kokonut UI repository](https://github.com/kokonut-labs/kokonutui).
- UI/UX Pro Max for design-system exploration, Site Architecture for information structure, and HyperFrames guidance for motion decisions.

These are references and learning influences, not a claim that the project reproduces their code or branding.

## Run it locally

### Prerequisites

- Node.js 20 or newer.
- A Supabase project with the application tables, authentication, RLS, and deny-direct-client policies configured.
- An ImageKit account and URL endpoint for profile, post, and chat images.
- Git, if you plan to contribute.

### Install

Clone the repository and install dependencies:

```bash
git clone https://github.com/Athen2045/Tommy-s-Club.git
cd Tommy-s-Club
npm install
```

For SSH:

```bash
git clone git@github.com:Athen2045/Tommy-s-Club.git
cd Tommy-s-Club
npm install
```

### Configure the environment

Copy the example file and fill in your own values:

```bash
cp .env.example .env
```

Important variables:

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public Supabase key for compatibility/configuration |
| `SUPABASE_SERVICE_KEY` | Server-only service-role key; never expose it to the browser |
| `SESSION_SECRET` | Random session secret of at least 32 characters in production |
| `IMAGEKIT_PUBLIC_KEY` | ImageKit public key |
| `IMAGEKIT_PRIVATE_KEY` | Server-only ImageKit private key |
| `IMAGEKIT_URL_ENDPOINT` | ImageKit delivery endpoint |
| `ADMIN_EMAIL` | Account email that receives admin privileges at login |
| `NODE_ENV` | `development` locally, `production` when deployed |
| `PORT` | Optional server port; defaults to `8080` |

Do not commit `.env`. The repository includes `.env.example` as the safe template.

### Apply the chat image migration

Before testing chat image attachments, run [`20260715-chat-message-images.sql`](./20260715-chat-message-images.sql) in the Supabase SQL Editor. The migration adds optional image fields, keeps `messages.body` safe, and includes verification queries for constraints, RLS, and policies.

The application expects the server-side service key architecture: browser clients are denied direct access to application tables, while the Express server performs authorized database operations. Do not replace that setup with a public service key or client-side service-role access.

### Start the server

```bash
# Development with Node’s built-in file watcher
npm run dev

# Production-style start
npm start

# Static verification
npm run check
```

Open <http://localhost:8080> unless you chose another `PORT`.

## Fork and contribute

The canonical repository is:

- HTTPS: <https://github.com/Athen2045/Tommy-s-Club>
- SSH: `git@github.com:Athen2045/Tommy-s-Club.git`

To work from your own fork:

1. Click **Fork** on GitHub.
2. Clone your fork and enter the project directory:

   ```bash
   git clone git@github.com:<your-github-name>/Tommy-s-Club.git
   cd Tommy-s-Club
   ```

3. Add the canonical project as `upstream`:

   ```bash
   git remote add upstream git@github.com:Athen2045/Tommy-s-Club.git
   git remote -v
   ```

4. Create a focused branch:

   ```bash
   git switch -c feat/your-change
   ```

5. Make the change, run `npm run check`, review the diff, and confirm that no `.env` or service keys are included.
6. Commit the focused change and push it to your fork:

   ```bash
   git add .
   git commit -m "Describe the change"
   git push -u origin feat/your-change
   ```

7. Open a pull request against `Athen2045/Tommy-s-Club` and explain what you tried, what changed, and anything that still needs attention.

Small experiments, bug reports, design thoughts, documentation fixes, and code are all useful contributions. If a change is large, opening an issue first makes it easier to compare ideas before implementation.

## Project structure

```text
Tommy's Club/
├── server.js                         # Express routes, middleware, and WebSocket relay
├── auth-service.js                    # Supabase Auth operations
├── blog-service.js                    # Posts, comments, reactions, profiles, chat, and categories
├── 20260715-chat-message-images.sql   # Chat image schema migration and verification queries
├── username-uniqueness.sql            # Username constraint/query support
├── public/
│   ├── assets/                        # Project-owned image assets
│   ├── css/
│   │   ├── crt.css                     # Login and gate visuals
│   │   └── editorial.css               # Application design system and responsive layout
│   └── js/
│       ├── chat.js                     # Realtime chat and image attachments
│       ├── entry-transition.js         # Login-to-application transition
│       ├── forms.js                    # Shared form behavior
│       └── motion.js                   # Small application motion enhancements
├── views/                             # Handlebars pages and layouts
├── .env.example                       # Safe environment variable template
├── .gitignore
├── LICENSE
├── package.json
└── README.md
```

## Security notes

- Session cookies are `httpOnly`, `sameSite: lax`, and secure in production.
- State-changing form, JSON, and multipart requests use session-bound CSRF tokens.
- Supabase application tables use RLS and deny direct browser access.
- `SUPABASE_SERVICE_KEY` and `IMAGEKIT_PRIVATE_KEY` stay server-side.
- Post and chat content is validated and sanitized before display.
- Uploads are restricted to supported image MIME types and an 8 MB limit.
- Ownership checks protect destructive post, comment, message, and account operations.
- The WebSocket relay keeps Supabase credentials away from the browser.
- Run `npm audit` before deploying and review any remaining transitive advisories.

## Current limitations

Tommy’s Club is still experimental. It currently uses a manual Supabase SQL workflow, a single Express server, and a small server-side WebSocket relay. There is no promise of production-scale capacity, polished moderation tooling, or a stable public API yet. Expect the structure and design to change as the experiments continue.

## License

Tommy’s Club is released under the ISC License. See [`LICENSE`](./LICENSE).
