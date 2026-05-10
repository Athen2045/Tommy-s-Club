require('dotenv').config();
const express = require('express');
const session = require('express-session');
const exphbs = require('express-handlebars');
const multer = require('multer');
const ImageKit = require('imagekit');
const stripJs = require('strip-js');
const path = require('path');

const blogService = require('./blog-service');
const authService = require('./auth-service');

const app = express();
const PORT = process.env.PORT || 8080;

// ── ImageKit ──────────────────────────────────────────────
const imagekit = new ImageKit({
    publicKey:   process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey:  process.env.IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT
});

const upload = multer();

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
            return stripJs(context);
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
        gt(a, b) { return a > b; },
        inc(n) { return n + 1; }
    }
}));
app.set('view engine', '.hbs');

// ── Middleware ────────────────────────────────────────────
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

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

function ensureLogin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

// ── ImageKit upload helper ────────────────────────────────
function streamUpload(req, folder = 'blog') {
    return imagekit.upload({
        file:     req.file.buffer,
        fileName: req.file.originalname || `upload-${Date.now()}`,
        folder:   `/${folder}`
    });
}

// ── Routes: public ────────────────────────────────────────

app.get('/', (req, res) => res.redirect('/blog'));

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
        const post = await blogService.getPostById(req.params.id);
        const allComments = await blogService.getCommentsByPost(req.params.id);
        const categories = await blogService.getCategories();

        // Build 1-level comment thread
        const topLevel = allComments.filter(c => !c.parent_id);
        const replies = allComments.filter(c => c.parent_id);
        const commentTree = topLevel.map(c => ({
            ...c,
            replies: replies.filter(r => r.parent_id === c.id)
        }));

        res.render('post', { post, commentTree, categories, commentCount: allComments.length });
    } catch (err) {
        res.status(404).render('404');
    }
});

// ── Routes: comments ──────────────────────────────────────

app.post('/blog/:id/comments', ensureLogin, async (req, res) => {
    try {
        await blogService.addComment({
            post_id: parseInt(req.params.id),
            author_id: req.session.user.id,
            parent_id: req.body.parent_id ? parseInt(req.body.parent_id) : null,
            body: req.body.body
        });
    } catch (err) { /* continue */ }
    res.redirect(`/blog/${req.params.id}#comments`);
});

app.get('/comments/delete/:id', ensureLogin, async (req, res) => {
    const postId = req.query.post;
    try { await blogService.deleteCommentById(req.params.id); } catch (e) {}
    res.redirect(`/blog/${postId}#comments`);
});

// ── Routes: auth ──────────────────────────────────────────

const GATE = { layout: 'gate' };

app.get('/login', (req, res) => {
    if (req.session.user) return res.redirect('/blog');
    res.render('login', GATE);
});

app.post('/login', async (req, res) => {
    try {
        const user = await authService.loginUser(req.body.email, req.body.password);
        user.isAdmin = (process.env.ADMIN_EMAIL && user.email === process.env.ADMIN_EMAIL);
        req.session.user = user;
        res.redirect('/blog');
    } catch (err) {
        res.render('login', { ...GATE, errorMessage: err.message, email: req.body.email });
    }
});

app.get('/register', (req, res) => {
    if (req.session.user) return res.redirect('/blog');
    res.render('register', GATE);
});

app.post('/register', async (req, res) => {
    try {
        await authService.registerUser(req.body);
        res.render('register', { ...GATE, successMessage: 'Account created! You can now sign in.' });
    } catch (err) {
        res.render('register', { ...GATE, errorMessage: err.message, username: req.body.username, email: req.body.email });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/blog');
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
    if (u.status === 'approved' && u.terms_accepted)  return res.redirect('/blog');
    if (u.status === 'approved' && !u.terms_accepted) return res.redirect('/terms');
    if (u.status === 'rejected')                      return res.redirect('/rejected');
    return res.redirect('/pending');
});

// ── Routes: profile ───────────────────────────────────────

app.get('/profile', ensureLogin, async (req, res) => {
    try {
        const profile = await blogService.getProfile(req.session.user.id);
        res.render('profile', { profile });
    } catch (err) {
        res.render('profile', { profile: req.session.user });
    }
});

app.post('/profile', ensureLogin, upload.single('avatar'), async (req, res) => {
    try {
        const updates = { bio: req.body.bio, username: req.body.username };
        if (req.file) {
            const result = await streamUpload(req, 'avatars');
            updates.avatar_url = result.url;
        }
        await blogService.updateProfile(req.session.user.id, updates);
        req.session.user = { ...req.session.user, ...updates };
        res.render('profile', { profile: { ...req.session.user, ...updates }, successMessage: 'Profile updated!' });
    } catch (err) {
        res.render('profile', { profile: req.session.user, errorMessage: err.message });
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

app.post('/posts/add', ensureLogin, upload.single('featureImage'), async (req, res) => {
    try {
        let imageUrl = '';
        if (req.file) {
            const result = await streamUpload(req);
            imageUrl = result.url;
        }
        req.body.featureImage = imageUrl;
        await blogService.addPost(req.body, req.session.user.id);
        res.redirect('/posts');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/posts/delete/:id', ensureLogin, async (req, res) => {
    try {
        await blogService.deletePostById(req.params.id);
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

app.get('/categories/add', ensureLogin, (req, res) => res.render('addCategory'));

app.post('/categories/add', ensureLogin, async (req, res) => {
    try {
        await blogService.addCategory(req.body);
        res.redirect('/categories');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/categories/delete/:id', ensureLogin, async (req, res) => {
    try {
        await blogService.deleteCategoryById(req.params.id);
        res.redirect('/categories');
    } catch (err) {
        res.status(500).send('Unable to remove category');
    }
});

// ── 404 ───────────────────────────────────────────────────
app.use((req, res) => res.status(404).render('404'));

// ── Start ─────────────────────────────────────────────────
blogService.initialize()
    .then(authService.initialize)
    .then(() => {
        app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
    })
    .catch(err => console.error('Failed to start:', err));
