require('dotenv').config();
const http           = require('http');
const crypto         = require('crypto');
const express        = require('express');
const session        = require('express-session');
const exphbs         = require('express-handlebars');
const multer         = require('multer');
const ImageKit       = require('imagekit');
const sanitizeHtml   = require('sanitize-html');
const path           = require('path');
const helmet         = require('helmet');
const rateLimit      = require('express-rate-limit');
const { WebSocketServer } = require('ws');
const {
    createServerClient,
    SupabaseSessionStore,
    SupabaseRateLimitStore,
    SupabaseRuntimeState
} = require('./platform-store');

const blogService = require('./blog-service');
const authService = require('./auth-service');

const app = express();
const PORT = process.env.PORT || 8080;
const isProd = process.env.NODE_ENV === 'production';
const APP_URL = (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');

let parsedAppUrl;
try {
    parsedAppUrl = new URL(APP_URL);
} catch (_) {
    throw new Error('APP_URL must be a valid absolute URL');
}
if (!['http:', 'https:'].includes(parsedAppUrl.protocol)) {
    throw new Error('APP_URL must use http or https');
}
if (isProd && APP_URL !== 'https://tommysclub.vercel.app') {
    throw new Error('APP_URL must be https://tommysclub.vercel.app in production');
}

if (isProd && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
    throw new Error('SESSION_SECRET must be at least 32 characters in production');
}

if (isProd) app.set('trust proxy', 1);

const platformClient = createServerClient();
const runtimeState = new SupabaseRuntimeState(platformClient);

// ── ImageKit ──────────────────────────────────────────────
const imagekit = new ImageKit({
    publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

// ── File upload — type + size guards ─────────────────────
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
const SERVER_UPLOAD_MAX = isProd ? 4 * 1024 * 1024 : 8 * 1024 * 1024;
const upload = multer({
    limits: { fileSize: SERVER_UPLOAD_MAX },
    fileFilter(_req, file, cb) {
        if (ALLOWED_MIME.includes(file.mimetype)) return cb(null, true);
        cb(new Error('Only image files are allowed (JPEG, PNG, GIF, WebP, AVIF)'));
    }
});

function parseImageUpload(fieldName) {
    const middleware = upload.single(fieldName);
    return (req, res, next) => middleware(req, res, (err) => {
        if (err) {
            req.uploadError = err.code === 'LIMIT_FILE_SIZE'
                ? `Image must be ${isProd ? '4' : '8'} MB or smaller for a server upload.`
                : err.message;
        }
        next();
    });
}

// ── Handlebars ────────────────────────────────────────────
app.engine('.hbs', exphbs.engine({
    extname: '.hbs',
    helpers: {
        navLink(url, options) {
            const active = url === app.locals.activeRoute ? ' active' : '';
            return `<a class="nav-link${active}" href="${url}">${options.fn(this)}</a>`;
        },
        equal(a, b, options) {
            return a == b ? options.fn(this) : options.inverse(this);
        },
        safeHTML(context) {
            // strip-js only removed <script> tags — sanitize-html also kills
            // onerror/onclick attrs, data: URIs, and other XSS vectors
            return sanitizeHtml(context, {
                allowedTags: [
                    'h1','h2','h3','h4','h5','h6',
                    'p','br','hr','blockquote','pre','code',
                    'ul','ol','li',
                    'strong','b','em','i','u','s','strike',
                    'a','img',
                    'table','thead','tbody','tr','th','td',
                    'div','span'
                ],
                allowedAttributes: {
                    'a':   ['href', 'target', 'rel'],
                    'img': ['src', 'alt', 'width', 'height', 'loading', 'decoding'],
                    '*':   ['class']
                },
                allowedSchemes: ['http', 'https', 'mailto'],
                // Force external links to be safe
                transformTags: {
                    'a': sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
                    'img': sanitizeHtml.simpleTransform('img', { loading: 'lazy', decoding: 'async' })
                }
            });
        },
        formatDate(d) {
            if (!d) return '';
            const date = new Date(d);
            return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        },
        timeAgo(d) {
            if (!d) return '';
            const diff = (Date.now() - new Date(d)) / 1000;
            if (diff < 60) return 'just now';
            if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
            if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
            return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        },
        readTime(body) {
            if (!body) return '1 min read';
            const words = body.replace(/<[^>]*>/g, '').split(/\s+/).length;
            return `${Math.max(1, Math.ceil(words / 200))} min read`;
        },
        excerpt(body, len) {
            if (!body) return '';
            const plain = body.replace(/<[^>]*>/g, '');
            return plain.length > len ? plain.slice(0, len) + '…' : plain;
        },
        avatarInitial(username) {
            return username ? username[0].toUpperCase() : '?';
        },
        pluralize(count, singular, plural) {
            return Number(count) === 1 ? singular : (plural || `${singular}s`);
        },
        mediaUrl(src, preset) {
            if (!src || typeof src !== 'string') return '';
            const transforms = {
                feed: 'w-960,h-960,c-at_max,q-80,f-auto',
                post: 'w-1600,h-1600,c-at_max,q-82,f-auto',
                chat: 'w-320,h-320,c-at_max,q-78,f-auto'
            };
            const transform = transforms[preset];
            if (!transform || !process.env.IMAGEKIT_URL_ENDPOINT ||
                !src.startsWith(process.env.IMAGEKIT_URL_ENDPOINT)) return src;
            return `${src}${src.includes('?') ? '&' : '?'}tr=${transform}`;
        },
        gt(a, b) { return a > b; },
        inc(n) { return n + 1; }
    }
}));
app.set('view engine', '.hbs');

// ── Security headers (helmet) ─────────────────────────────
app.use(helmet({
    // Allow CDN scripts/styles used by the app
    contentSecurityPolicy: {
        directives: {
            defaultSrc:  ["'self'"],
            scriptSrc:   ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net'],
            styleSrc:    ["'self'", "'unsafe-inline'", 'cdn.jsdelivr.net', 'fonts.googleapis.com'],
            fontSrc:     ["'self'", 'fonts.gstatic.com', 'cdn.jsdelivr.net'],
            imgSrc:      ["'self'", 'data:', 'blob:', 'ik.imagekit.io', '*.imagekit.io'],
            connectSrc:  ["'self'", process.env.SUPABASE_URL || '', 'https://upload.imagekit.io'],
        }
    }
}));

// ── Rate limiters ─────────────────────────────────────────
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 10,                      // 10 attempts per window
    message: 'Too many login attempts — please try again in 15 minutes.',
    standardHeaders: true,
    legacyHeaders: false,
    ...(isProd ? { store: new SupabaseRateLimitStore('login', platformClient) } : {}),
});

const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 hour
    max: 5,                       // 5 registrations per IP per hour
    message: 'Too many accounts created — please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    ...(isProd ? { store: new SupabaseRateLimitStore('register', platformClient) } : {}),
});

const mediaAuthLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 60,
    standardHeaders: true,
    legacyHeaders: false,
    ...(isProd ? { store: new SupabaseRateLimitStore('media', platformClient) } : {}),
});

const confirmationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    ...(isProd ? { store: new SupabaseRateLimitStore('confirmation', platformClient) } : {}),
});

const wsTokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    ...(isProd ? { store: new SupabaseRateLimitStore('websocket', platformClient) } : {}),
});

// ── Middleware ────────────────────────────────────────────
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

app.use(session({
    ...(isProd ? { store: new SupabaseSessionStore(platformClient) } : {}),
    secret: process.env.SESSION_SECRET || (isProd
        ? (() => { throw new Error('SESSION_SECRET env var must be set in production'); })()
        : 'dev-secret-change-me-in-production'),
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge:   24 * 60 * 60 * 1000,
        httpOnly: true,          // JS cannot read the session cookie (XSS protection)
        secure:   isProd,        // HTTPS-only in production
        sameSite: 'lax'          // CSRF mitigation for same-site form posts
    }
}));

app.use((req, res, next) => {
    const privatePrefixes = ['/chat', '/profile', '/settings', '/posts', '/categories', '/member', '/admin', '/account'];
    if (['/', '/login', '/register', '/terms', '/enter', '/auth/confirm'].includes(req.path) ||
        privatePrefixes.some(prefix => req.path === prefix || req.path.startsWith(`${prefix}/`))) {
        res.set('Cache-Control', 'private, no-store');
    }
    next();
});

// Browser state-changing requests must carry a token issued to this session.
// This protects form and fetch endpoints against cross-site request forgery.
const multipartCsrfPaths = new Set(['/posts/add', '/posts/upload-image', '/profile', '/chat/send']);

function csrfTokenIsValid(req) {
    const supplied = req.get('x-csrf-token') || req.body?._csrf;
    const expected = req.session.csrfToken;
    return typeof supplied === 'string' && typeof expected === 'string' &&
        supplied.length === expected.length &&
        crypto.timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

function verifyCsrfToken(req, res, next) {
    if (csrfTokenIsValid(req)) return next();
    if (req.accepts('json') && !req.accepts('html')) {
        return res.status(403).json({ error: 'Invalid request token. Refresh the page and try again.' });
    }
    return res.status(403).send('Invalid request token. Refresh the page and try again.');
}

app.use((req, res, next) => {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    res.locals.csrfToken = req.session.csrfToken;

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return next();
    if (req.is('multipart/form-data') && multipartCsrfPaths.has(req.path)) return next();
    return verifyCsrfToken(req, res, next);
});

// Make session available to all templates
app.use((req, res, next) => {
    res.locals.session = req.session;
    next();
});

// Track active route for nav highlighting
app.use((req, res, next) => {
    const route = req.path.substring(1);
    app.locals.activeRoute = '/' + (isNaN(route.split('/')[1])
        ? route.replace(/\/(?!.*)/, '')
        : route.replace(/\/(.*)/, ''));
    next();
});

// Global auth guard — 5-step check in order
function isOpenPath(pathname) {
    return pathname === '/' || pathname === '/login' || pathname === '/register' ||
        pathname === '/pending' || pathname === '/rejected' || pathname === '/terms' ||
        pathname === '/about' || pathname === '/auth/refresh-status' || pathname === '/auth/confirm' ||
        pathname === '/blog' || pathname.startsWith('/blog/');
}

app.use(async (req, res, next) => {
    const u = req.session.user;

    // 1. Not logged in
    if (!u) {
        if (isOpenPath(req.path)) return next();
        return res.redirect('/login');
    }

    // 2. Email verification is required before any authenticated access.
    if (u.email_verified !== true) {
        if (req.path === '/logout') return next();
        return res.redirect('/login?unverified=1');
    }

    // 3. Keep pending users in sync so an admin rejection takes effect on the
    // next request, while verified pending users can use the site.
    if (u.status === 'pending') {
        try {
            const fresh = await blogService.getProfileStatus(u.id);
            if (fresh) {
                u.status = fresh.status;
                u.terms_accepted = fresh.terms_accepted;
            }
        } catch (e) { /* keep the session state if Supabase is temporarily unavailable */ }
    }

    // 4. Logged in but rejected
    if (u.status === 'rejected') {
        if (req.path === '/rejected' || req.path === '/logout') return next();
        return res.redirect('/rejected');
    }

    // 5. Verified members must accept the house rules before entering.
    if (!u.terms_accepted) {
        if (req.path === '/terms' || req.path === '/logout') return next();
        return res.redirect('/terms');
    }

    // 6. Email-verified members may enter before admin approval.
    next();
});

function ensureLogin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

// ── ImageKit upload helper ────────────────────────────────
function streamUpload(req, folder = 'blog') {
    const originalName = path.basename(req.file.originalname || `upload-${Date.now()}`);
    const fileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(0, 120) || `upload-${Date.now()}`;
    return imagekit.upload({
        file:     req.file.buffer,
        fileName,
        folder:   `/${folder}`
    });
}

const DIRECT_MEDIA_KINDS = Object.freeze({
    'post-cover': 'posts/covers',
    'post-inline': 'posts/inline',
    avatar: 'avatars',
    chat: 'chat'
});

function directMediaFolder(userId, kind) {
    const suffix = DIRECT_MEDIA_KINDS[kind];
    return suffix ? `/tommys-club/${userId}/${suffix}` : null;
}

async function verifyDirectMedia(userId, kind, fileId, submittedUrl) {
    const expectedFolder = directMediaFolder(userId, kind);
    if (!expectedFolder || typeof fileId !== 'string' || !/^[A-Za-z0-9_-]{8,128}$/.test(fileId)) {
        throw new Error('Invalid uploaded image');
    }
    const details = await imagekit.getFileDetails(fileId);
    const pathName = details.filePath || '';
    const fileUrl = details.url || '';
    if (details.fileType !== 'image' || Number(details.size) > 8 * 1024 * 1024 ||
        !pathName.startsWith(`${expectedFolder}/`) ||
        !process.env.IMAGEKIT_URL_ENDPOINT || !fileUrl.startsWith(process.env.IMAGEKIT_URL_ENDPOINT) ||
        (submittedUrl && submittedUrl !== fileUrl)) {
        throw new Error('Invalid uploaded image');
    }
    return { url: fileUrl, fileId: details.fileId };
}

function transformedImageUrl(url, preset) {
    const transforms = {
        post: 'w-1600,h-1600,c-at_max,q-82,f-auto',
        chat: 'w-320,h-320,c-at_max,q-78,f-auto'
    };
    if (!url || !transforms[preset] || !process.env.IMAGEKIT_URL_ENDPOINT ||
        !url.startsWith(process.env.IMAGEKIT_URL_ENDPOINT)) return url;
    return `${url}${url.includes('?') ? '&' : '?'}tr=${transforms[preset]}`;
}

function safeJson(value) {
    return JSON.stringify(value)
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
}

// ── Routes: public ────────────────────────────────────────

app.get('/', (req, res) => {
    const user = req.session.user;
    if (!user) return res.redirect('/login');
    if (user.email_verified !== true) return res.redirect('/login?unverified=1');
    if (user.status === 'rejected') return res.redirect('/rejected');
    if (!user.terms_accepted) return res.redirect('/terms');
    if (req.session.entryTransitionSeen === false) return res.redirect('/enter');
    return res.redirect('/blog');
});

app.get('/about', (req, res) => res.render('about'));

app.get('/blog', async (req, res) => {
    try {
        let posts;
        if (req.query.category) {
            posts = await blogService.getPublishedPostsByCategory(req.query.category);
        } else {
            posts = await blogService.getPublishedPosts();
        }
        const categories = await blogService.getCategories();
        res.render('blog', {
            posts,
            categories,
            activeCategory: req.query.category || null,
            featuredPost: posts[0] || null,
            recentPosts: posts.slice(1)
        });
    } catch (err) {
        res.render('blog', { posts: [], categories: [], message: 'No posts found' });
    }
});

app.get('/blog/:id', async (req, res) => {
    try {
        const post        = await blogService.getPostById(req.params.id);
        const user        = req.session.user;
        const canViewDraft = user && (user.isAdmin || user.id === post.author_id);
        if (!post.published && !canViewDraft) return res.status(404).render('404');
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

// ── Routes: comments ──────────────────────────────────────

app.post('/blog/:id/comments', ensureLogin, async (req, res) => {
    const postId = Number.parseInt(req.params.id, 10);
    const parentId = req.body.parent_id ? Number.parseInt(req.body.parent_id, 10) : null;
    const body = typeof req.body.body === 'string' ? req.body.body.trim() : '';
    if (!Number.isInteger(postId) || postId < 1 || (parentId !== null && (!Number.isInteger(parentId) || parentId < 1)) ||
        !body || body.length > 2000) {
        return res.redirect(`/blog/${encodeURIComponent(req.params.id)}#comments`);
    }
    try {
        await blogService.addComment({
            post_id: postId,
            author_id: req.session.user.id,
            parent_id: parentId,
            body
        });
    } catch (err) { /* redirect without leaking database details */ }
    res.redirect(`/blog/${encodeURIComponent(req.params.id)}#comments`);
});

app.post('/comments/delete/:id', ensureLogin, async (req, res) => {
    const postId = req.body.postId || req.query.post;
    try {
        await blogService.deleteCommentIfAuthorized(
            req.params.id,
            req.session.user.id,
            req.session.user.isAdmin
        );
    } catch (e) { /* redirect without leaking database details */ }
    res.redirect(`/blog/${encodeURIComponent(String(postId || ''))}#comments`);
});

// ── Routes: reactions ─────────────────────────────────────

app.post('/blog/:id/react', ensureLogin, async (req, res) => {
    const postId = Number.parseInt(req.params.id, 10);
    if (!Number.isInteger(postId) || postId < 1) return res.status(400).json({ error: 'Invalid post id' });
    try {
        const result = await blogService.toggleReaction(
            postId,
            req.session.user.id,
            req.body.emoji
        );
        res.json(result);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// ── Routes: auth ──────────────────────────────────────────

const GATE = { layout: 'gate' };

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/blog');
    const flash = req.session.flash;
    delete req.session.flash;
    res.render('login', {
        ...GATE,
        successMessage: flash?.type === 'success'
            ? flash.message
            : (req.query.deleted === '1' ? 'Your account and member data have been deleted.' : null),
        verificationSuccess: flash?.code === 'email_verified',
        errorMessage: flash?.type === 'error'
            ? flash.message
            : (req.query.unverified === '1' ? 'Please verify your email address before continuing.' : null)
    });
});

app.get('/auth/confirm', confirmationLimiter, async (req, res) => {
    const tokenHash = req.query.token_hash;
    if (req.query.type !== 'email' || typeof tokenHash !== 'string') {
        req.session.flash = {
            type: 'error',
            message: 'That verification link is invalid or incomplete. Request a new email and try again.'
        };
        return req.session.save(() => res.redirect('/login'));
    }
    try {
        await authService.verifyEmailToken(tokenHash);
        req.session.flash = {
            type: 'success',
            code: 'email_verified',
            message: 'Email verified. You can sign in now.'
        };
    } catch (_) {
        req.session.flash = {
            type: 'error',
            message: 'That verification link has expired or was already used. Try signing in or request a new email.'
        };
    }
    req.session.save(() => res.redirect('/login'));
});

app.post('/login', loginLimiter, async (req, res) => {
    try {
        const user = await authService.loginUser(req.body.email, req.body.password);
        user.isAdmin = !!(process.env.ADMIN_EMAIL && user.email.toLowerCase() === process.env.ADMIN_EMAIL.trim().toLowerCase());
        req.session.regenerate(err => {
            if (err) return res.status(500).render('login', { ...GATE, errorMessage: 'Unable to start a secure session' });
            req.session.user = user;
            req.session.csrfToken = crypto.randomBytes(32).toString('hex');
            req.session.entryTransitionSeen = false;
            req.session.save(saveError => {
                if (saveError) return res.status(500).render('login', { ...GATE, errorMessage: 'Unable to save your secure session' });
                res.redirect('/enter');
            });
        });
    } catch (err) {
        res.render('login', { ...GATE, errorMessage: err.message, email: req.body.email });
    }
});

// A short, one-time bridge between the CRT gate and the editorial club UI.
// The session flag prevents refreshes or direct revisits from replaying it.
app.get('/enter', ensureLogin, (req, res) => {
    if (req.session.entryTransitionSeen) return res.redirect('/blog');
    req.session.entryTransitionSeen = true;
    req.session.save(err => {
        if (err) return res.redirect('/blog');
        res.render('enter', { layout: 'transition', title: 'Opening the Club' });
    });
});

app.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/blog');
    res.render('register', GATE);
});

app.post('/register', registerLimiter, async (req, res) => {
    try {
        await authService.registerUser(req.body);
        res.render('register', { ...GATE, successMessage: 'Account created. Check your email and click the verification link before signing in.' });
    } catch (err) {
        res.render('register', { ...GATE, errorMessage: err.message, username: req.body.username, email: req.body.email });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

app.post('/account/delete', ensureLogin, async (req, res) => {
    try {
        await authService.verifyPassword(req.session.user.email, req.body.current_password);
        await authService.deleteUserAccount(req.session.user.id);
        req.session.destroy(() => res.redirect('/login?deleted=1'));
    } catch (err) {
        res.status(400).render('settings', {
            errorMessage: err.message === 'Current password is incorrect' || err.message === 'Current password is required'
                ? err.message
                : 'Account deletion failed. No changes were made to your account.'
        });
    }
});

// ── Routes: access gate screens ───────────────────────────

app.get('/pending',  (req, res) => res.render('pending',  GATE));
app.get('/rejected', (req, res) => res.render('rejected', GATE));

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
    if (u.status === 'rejected')                      return res.redirect('/rejected');
    if (u.terms_accepted)                             return res.redirect('/enter');
    return res.redirect('/terms');
});

// ── Routes: terms ─────────────────────────────────────────

app.get('/terms', (req, res) => {
    if (!req.session.user) return res.redirect('/login');
    if (req.session.user.terms_accepted) {
        return res.redirect(req.session.entryTransitionSeen === false ? '/enter' : '/blog');
    }
    res.render('terms', GATE);
});

app.post('/terms', ensureLogin, async (req, res) => {
    if (!req.body.agreed) {
        return res.render('terms', { ...GATE, errorMessage: 'You must agree to the rules to continue.' });
    }
    try {
        await blogService.acceptTerms(req.session.user.id);
        req.session.user.terms_accepted = true;
        req.session.save(saveError => {
            if (saveError) {
                return res.status(500).render('terms', {
                    ...GATE,
                    errorMessage: 'Your agreement was saved, but the session could not be updated. Sign in again to continue.'
                });
            }
            res.redirect('/enter');
        });
    } catch (err) {
        res.render('terms', { ...GATE, errorMessage: err.message });
    }
});

// ── Routes: profile ───────────────────────────────────────

app.post('/media/auth', ensureLogin, mediaAuthLimiter, (req, res) => {
    const kind = typeof req.body.kind === 'string' ? req.body.kind : '';
    const folder = directMediaFolder(req.session.user.id, kind);
    if (!folder) return res.status(400).json({ error: 'Unsupported media destination' });
    const authentication = imagekit.getAuthenticationParameters();
    res.set('Cache-Control', 'private, no-store');
    res.json({
        ...authentication,
        publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
        urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
        uploadEndpoint: 'https://upload.imagekit.io/api/v1/files/upload',
        folder,
        maxBytes: 8 * 1024 * 1024,
        allowedTypes: ALLOWED_MIME
    });
});

app.get('/profile', ensureLogin, async (req, res) => {
    try {
        const profile = await blogService.getProfile(req.session.user.id);
        res.render('profile', { profile });
    } catch (err) {
        res.render('profile', { profile: req.session.user });
    }
});

app.post('/profile', ensureLogin, parseImageUpload('avatar'), verifyCsrfToken, async (req, res) => {
    let newFileId = null;
    try {
        if (req.uploadError) throw new Error(req.uploadError);
        const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
        const bio = typeof req.body.bio === 'string' ? req.body.bio.trim() : '';
        if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) throw new Error('Username must be 3–32 characters using letters, numbers, or underscores');
        if (bio.length > 500) throw new Error('Bio must be 500 characters or fewer');
        const updates = { bio, username };
        if (req.body.avatar_file_id) {
            const directMedia = await verifyDirectMedia(
                req.session.user.id,
                'avatar',
                req.body.avatar_file_id,
                req.body.avatar_url
            );
            updates.avatar_url = directMedia.url;
            updates.avatar_file_id = directMedia.fileId;
            newFileId = directMedia.fileId;
        } else if (req.file) {
            const result = await streamUpload(req, 'avatars');
            updates.avatar_url = result.url;
            updates.avatar_file_id = result.fileId;
            newFileId = result.fileId;
        } else if (authService.DEFAULT_AVATARS[req.body.avatar_choice]) {
            updates.avatar_url = authService.DEFAULT_AVATARS[req.body.avatar_choice];
            updates.avatar_file_id = null;
        }
        const previousFileId = newFileId || updates.avatar_file_id === null
            ? await blogService.getProfileMediaFileId(req.session.user.id)
            : null;
        await blogService.updateProfile(req.session.user.id, updates);
        const publicUpdates = { ...updates };
        delete publicUpdates.avatar_file_id;
        req.session.user = { ...req.session.user, ...publicUpdates };
        if (previousFileId && previousFileId !== newFileId) {
            imagekit.deleteFile(previousFileId).catch(error => {
                console.error('Unable to remove replaced profile image:', error.message);
            });
        }
        res.render('profile', { profile: { ...req.session.user, ...publicUpdates }, successMessage: 'Profile updated!' });
    } catch (err) {
        if (newFileId) imagekit.deleteFile(newFileId).catch(() => {});
        res.render('profile', { profile: req.session.user, errorMessage: err.message });
    }
});

// ── Account settings ─────────────────────────────────────

app.get('/settings', ensureLogin, (req, res) => {
    res.render('settings');
});

app.post('/settings/username', ensureLogin, async (req, res) => {
    try {
        const username = typeof req.body.username === 'string' ? req.body.username.trim().toLowerCase() : '';
        if (!/^[a-z0-9_]{3,32}$/.test(username)) {
            throw new Error('Username must be 3–32 characters using letters, numbers, or underscores');
        }
        await authService.verifyPassword(req.session.user.email, req.body.current_password);
        await blogService.updateProfile(req.session.user.id, { username });
        req.session.user.username = username;
        res.render('settings', { successMessage: 'Username updated.' });
    } catch (err) {
        res.status(400).render('settings', { errorMessage: err.message });
    }
});

app.post('/settings/email', ensureLogin, async (req, res) => {
    try {
        await authService.changeEmail(
            req.session.user.email,
            req.body.current_password,
            req.body.new_email
        );
        res.render('settings', { successMessage: 'Verification email sent. Confirm the new address before using it to sign in.' });
    } catch (err) {
        res.status(400).render('settings', { errorMessage: err.message });
    }
});

app.post('/settings/password', ensureLogin, async (req, res) => {
    try {
        if (req.body.new_password !== req.body.new_password2) throw new Error('New passwords do not match');
        await authService.changePassword(
            req.session.user.email,
            req.body.current_password,
            req.body.new_password
        );
        res.render('settings', { successMessage: 'Password updated. Use the new password next time you sign in.' });
    } catch (err) {
        res.status(400).render('settings', { errorMessage: err.message });
    }
});

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

// ── Routes: admin posts ───────────────────────────────────

function ensureAdmin(req, res, next) {
    if (!req.session.user || !req.session.user.isAdmin) return res.status(403).render('404');
    next();
}

app.get('/posts', ensureLogin, async (req, res) => {
    try {
        const isAdmin = req.session.user.isAdmin;
        let posts;
        if (req.query.category) {
            posts = isAdmin
                ? await blogService.getPostsByCategory(req.query.category)
                : (await blogService.getPostsByAuthor(req.session.user.id)).filter(p => p.category_id == req.query.category);
        } else if (req.query.minDate) {
            posts = await blogService.getPostsByMinDate(req.query.minDate);
            if (!isAdmin) posts = posts.filter(p => p.author_id === req.session.user.id);
        } else {
            posts = isAdmin
                ? await blogService.getAllPosts()
                : await blogService.getPostsByAuthor(req.session.user.id);
        }
        const categories = await blogService.getCategories();
        res.render('posts', { posts, categories });
    } catch (err) {
        res.render('posts', { message: 'No results', posts: [] });
    }
});

app.get('/posts/add', ensureLogin, async (req, res) => {
    try {
        const categories = await blogService.getCategories();
        res.render('addPost', { categories });
    } catch (err) {
        res.render('addPost', { categories: [] });
    }
});

app.post('/posts/add', ensureLogin, parseImageUpload('featureImage'), verifyCsrfToken, async (req, res) => {
    let uploadedFileId = null;
    try {
        if (req.uploadError) throw new Error(req.uploadError);
        if (typeof req.body.title !== 'string' || !req.body.title.trim() || req.body.title.trim().length > 160) {
            throw new Error('Title must be between 1 and 160 characters');
        }
        if (typeof req.body.body !== 'string' || req.body.body.length > 200000) throw new Error('Post content is too large');
        let imageUrl = '';
        if (req.body.feature_image_file_id) {
            const directMedia = await verifyDirectMedia(
                req.session.user.id,
                'post-cover',
                req.body.feature_image_file_id,
                req.body.feature_image_url
            );
            imageUrl = directMedia.url;
            uploadedFileId = directMedia.fileId;
        } else if (req.file) {
            const result = await streamUpload(req);
            imageUrl = result.url;
            uploadedFileId = result.fileId;
        }
        const intent = req.body.intent === 'publish' ? 'publish' : 'draft';
        const postData = {
            ...req.body,
            title: req.body.title.trim(),
            featureImage: imageUrl,
            featureImageFileId: uploadedFileId,
            published: intent === 'publish'
        };
        await blogService.addPost(postData, req.session.user.id);
        res.redirect('/posts');
    } catch (err) {
        if (uploadedFileId) imagekit.deleteFile(uploadedFileId).catch(() => {});
        const categories = await blogService.getCategories().catch(() => []);
        const safeMessages = [
            'Title must be between 1 and 160 characters',
            'Post content is too large',
            'Image must be 8 MB or smaller.',
            'Only image files are allowed (JPEG, PNG, GIF, WebP, AVIF)'
        ];
        res.status(400).render('addPost', {
            categories,
            errorMessage: safeMessages.includes(err.message) ? err.message : 'Post could not be saved. Try again.',
            formData: { title: req.body?.title || '', body: req.body?.body || '', category: req.body?.category || '' }
        });
    }
});

app.post('/posts/upload-image', ensureLogin, parseImageUpload('image'), verifyCsrfToken, async (req, res) => {
    try {
        if (req.uploadError) throw new Error(req.uploadError);
        if (req.body.image_file_id) {
            const directMedia = await verifyDirectMedia(
                req.session.user.id,
                'post-inline',
                req.body.image_file_id,
                req.body.image_url
            );
            return res.json({ url: transformedImageUrl(directMedia.url, 'post'), fileId: directMedia.fileId });
        }
        if (!req.file) return res.status(400).json({ error: 'No file provided' });
        const result = await streamUpload(req, 'posts');
        res.json({ url: transformedImageUrl(result.url, 'post') });
    } catch (err) {
        const safeMessages = [
            'No file provided',
            'Image must be 8 MB or smaller.',
            'Only image files are allowed (JPEG, PNG, GIF, WebP, AVIF)'
        ];
        res.status(400).json({
            error: safeMessages.includes(err.message) ? err.message : 'Image could not be uploaded. Try again.'
        });
    }
});

app.post('/posts/delete/:id', ensureLogin, async (req, res) => {
    try {
        // Verify ownership — only the author or an admin may delete
        const post = await blogService.getPostById(req.params.id);
        if (!post) return res.status(404).render('404');
        if (!req.session.user.isAdmin && post.author_id !== req.session.user.id) {
            return res.status(403).render('404');
        }
        const deleted = await blogService.deletePostById(req.params.id);
        if (deleted?.feature_image_file_id) {
            imagekit.deleteFile(deleted.feature_image_file_id).catch(error => {
                console.error('Unable to remove deleted post image:', error.message);
            });
        }
        res.redirect('/posts');
    } catch (err) {
        res.status(500).send('Unable to remove post');
    }
});

// ── Routes: categories ────────────────────────────────────

app.get('/categories', ensureLogin, async (req, res) => {
    try {
        const categories = await blogService.getCategories();
        res.render('categories', { categories });
    } catch (err) {
        res.render('categories', { message: 'No results', categories: [] });
    }
});

app.get('/categories/add', ensureAdmin, (req, res) => res.render('addCategory'));

app.post('/categories/add', ensureAdmin, async (req, res) => {
    try {
        const name = typeof (req.body.category || req.body.name) === 'string' ? (req.body.category || req.body.name).trim() : '';
        if (!/^[^<>]{2,50}$/.test(name)) throw new Error('Channel name must be 2–50 characters');
        await blogService.addCategory({ name });
        res.redirect('/categories');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post('/categories/delete/:id', ensureAdmin, async (req, res) => {
    try {
        await blogService.deleteCategoryById(req.params.id);
        res.redirect('/categories');
    } catch (err) {
        res.status(500).send('Unable to remove category');
    }
});

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

// ── Routes: club chat ─────────────────────────────────────

app.get('/chat', ensureLogin, async (req, res) => {
    try {
        const messages = await blogService.getMessageHistory(100);
        const members  = await blogService.getAllMemberUsernames();
        res.render('chat', {
            messages,
            chatConfigJson: safeJson({
                members,
                currentUserId: req.session.user.id,
                currentUsername: req.session.user.username,
                isAdmin: !!req.session.user.isAdmin,
                imagekitEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || ''
            })
            // supabaseUrl + supabaseAnonKey intentionally omitted —
            // realtime is proxied through /chat/ws so keys stay server-side
        });
    } catch (err) {
        res.render('chat', {
            messages: [],
            chatConfigJson: safeJson({ members: [], currentUserId: '', currentUsername: '', isAdmin: false, imagekitEndpoint: '' })
        });
    }
});

app.post('/chat/send', ensureLogin, parseImageUpload('image'), verifyCsrfToken, async (req, res) => {
    let uploadedFileId = null;
    try {
        if (req.uploadError) throw new Error(req.uploadError);
        let media = null;
        if (req.body.image_file_id) {
            const directMedia = await verifyDirectMedia(
                req.session.user.id,
                'chat',
                req.body.image_file_id,
                req.body.image_url
            );
            uploadedFileId = directMedia.fileId;
            media = {
                imageUrl: directMedia.url,
                imageFileId: directMedia.fileId
            };
        } else if (req.file) {
            const uploaded = await streamUpload(req, 'chat');
            uploadedFileId = uploaded.fileId;
            media = {
                imageUrl: uploaded.url,
                imageFileId: uploaded.fileId
            };
        }
        const result = await blogService.insertMessage(req.session.user.id, req.body.body, media);
        res.json({ ok: true, id: result.id, created_at: result.created_at });
    } catch (err) {
        if (uploadedFileId) {
            imagekit.deleteFile(uploadedFileId).catch(() => {});
        }
        const safeMessages = [
            'Add a message or an image',
            'message too long',
            'Image must be 8 MB or smaller.',
            'Only image files are allowed (JPEG, PNG, GIF, WebP, AVIF)'
        ];
        res.status(400).json({
            error: safeMessages.includes(err.message) ? err.message : 'Message could not be sent. Try again.'
        });
    }
});

app.delete('/chat/:id', ensureLogin, async (req, res) => {
    try {
        const deleted = await blogService.deleteMessage(
            parseInt(req.params.id),
            req.session.user.id,
            req.session.user.isAdmin
        );
        if (deleted?.image_file_id) {
            imagekit.deleteFile(deleted.image_file_id).catch((error) => {
                console.error('Unable to remove orphaned chat image:', error.message);
            });
        }
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

app.get('/chat/messages', ensureLogin, async (req, res) => {
    const after = Number.parseInt(req.query.after || '0', 10);
    if (!Number.isInteger(after) || after < 0) return res.status(400).json({ error: 'Invalid message cursor' });
    try {
        const messages = await blogService.getMessagesAfter(after, 100);
        res.json({ messages: messages.map(message => ({
            id: message.id,
            author_id: message.author_id,
            body: message.body,
            image_url: message.image_url,
            created_at: message.created_at,
            username: message.profiles?.username || null,
            avatar_url: message.profiles?.avatar_url || null,
            image_full_url: message.image_url ? transformedImageUrl(message.image_url, 'post') : null,
            image_thumb_url: message.image_url ? transformedImageUrl(message.image_url, 'chat') : null
        })) });
    } catch (_) {
        res.status(503).json({ error: 'Messages are temporarily unavailable' });
    }
});

// ── WS auth token (one-time, 30s TTL) ────────────────────
app.get('/chat/ws-token', ensureLogin, wsTokenLimiter, async (req, res) => {
    try {
        const token = await runtimeState.issueWebSocketToken(req.session.user);
        res.set('Cache-Control', 'private, no-store');
        res.json({ token });
    } catch (_) {
        res.status(503).json({ error: 'Realtime connection is temporarily unavailable' });
    }
});

// Infrastructure middleware (sessions and distributed rate limits) runs before
// route handlers. Convert a temporary store failure into a useful response
// instead of exposing Express/Vercel's generic Internal Server Error page.
app.use((err, req, res, _next) => {
    const requestId = crypto.randomUUID();
    console.error('Request middleware failed', {
        requestId,
        method: req.method,
        path: req.path,
        error: err?.message || 'Unknown middleware error'
    });

    res.set('Cache-Control', 'private, no-store');
    if (req.path === '/register') {
        return res.status(503).render('register', {
            ...GATE,
            errorMessage: 'Registration is temporarily unavailable. Please try again in a moment.',
            username: req.body?.username,
            email: req.body?.email
        });
    }
    if (req.path === '/login') {
        return res.status(503).render('login', {
            ...GATE,
            errorMessage: 'Sign in is temporarily unavailable. Please try again in a moment.'
        });
    }
    if (req.accepts('json') && !req.accepts('html')) {
        return res.status(503).json({ error: 'The service is temporarily unavailable. Please try again.' });
    }
    return res.status(503).send('The service is temporarily unavailable. Please try again.');
});

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).render('404'));

// ── WebSocket server + Supabase realtime relay ────────────
const httpServer = http.createServer(app);
const wss = new WebSocketServer({ server: httpServer, path: '/chat/ws' });

// Server-side Supabase client for the realtime subscription
// (anon key never sent to browser)
const sbRelay = createServerClient();

let realtimeRelayStarted = false;
function startRealtimeRelay() {
    if (realtimeRelayStarted) return;
    realtimeRelayStarted = true;
    sbRelay.channel('server:messages')
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'messages' },
            async (payload) => {
                const row = payload.new;
                const { data: profile } = await sbRelay
                    .from('profiles')
                    .select('username, avatar_url')
                    .eq('id', row.author_id)
                    .single();

                const envelope = JSON.stringify({
                    type:       'message',
                    id:         row.id,
                    author_id:  row.author_id,
                    body:       row.body,
                    image_url:  row.image_url || null,
                    image_full_url: row.image_url ? transformedImageUrl(row.image_url, 'post') : null,
                    image_thumb_url: row.image_url ? transformedImageUrl(row.image_url, 'chat') : null,
                    created_at: row.created_at,
                    username:   profile?.username   || null,
                    avatar_url: profile?.avatar_url || null
                });

                wss.clients.forEach(client => {
                    if (client.readyState === 1 /* OPEN */) client.send(envelope);
                });
            }
        )
        .subscribe();
}

wss.on('connection', async (ws, req) => {
    const url   = new URL(req.url, `http://localhost`);
    const token = url.searchParams.get('token');
    let data = null;
    try {
        data = await runtimeState.consumeWebSocketToken(token);
    } catch (_) {
        ws.close(1013, 'Realtime authentication unavailable');
        return;
    }

    if (!token || !data) {
        ws.close(4001, 'Unauthorized');
        return;
    }
    ws.userId = data.user_id;
    ws.on('error', () => {});        // absorb socket errors
});

// ── Start ─────────────────────────────────────────────────
const ready = blogService.initialize()
    .then(authService.initialize)
    .then(() => {
        startRealtimeRelay();
        if (!process.env.VERCEL) {
            httpServer.listen(PORT, () =>
                console.log(`Server running on http://localhost:${PORT}`)
            );
        }
    })
    .catch(err => console.error('Failed to start:', err));

module.exports = httpServer;
module.exports.ready = ready;
