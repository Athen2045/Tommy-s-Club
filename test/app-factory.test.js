'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.APP_URL = 'http://localhost:8080';
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';

const credentialNames = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'IMAGEKIT_PUBLIC_KEY',
    'IMAGEKIT_PRIVATE_KEY',
    'IMAGEKIT_URL_ENDPOINT'
];
const originalCredentials = Object.fromEntries(
    credentialNames.map(name => [name, process.env[name]])
);
for (const name of credentialNames) process.env[name] = '';

const { createApp } = require('../server');

for (const name of credentialNames) {
    if (originalCredentials[name] === undefined) delete process.env[name];
    else process.env[name] = originalCredentials[name];
}

test('createApp imports without credentials and accepts injected adapters', () => {
    const app = createApp({
        blogService: {},
        authService: {},
        platformClient: {},
        runtimeState: {},
        imagekit: {},
        mediaService: {
            allowedTypes: [],
            maxBytes: 8 * 1024 * 1024,
            folderFor() { return '/test'; },
            verify: async () => ({}),
            remove: async () => true,
            deliveryUrl(url) { return url || ''; }
        },
        logger: { warn() {} }
    });
    assert.equal(typeof app, 'function');
    const routes = app._router.stack
        .filter(layer => layer.route)
        .map(layer => `${Object.keys(layer.route.methods)[0].toUpperCase()} ${layer.route.path}`);
    assert.ok(routes.includes('POST /media/auth'));
    assert.ok(routes.includes('POST /posts/add'));
    assert.ok(routes.includes('POST /blog/:id/comments'));
    assert.ok(routes.includes('POST /categories/:id/follow'));
    assert.ok(routes.includes('POST /categories/:id/pin'));
    assert.ok(routes.includes('GET /search'));
    assert.ok(routes.includes('GET /sitemap.xml'));
});
