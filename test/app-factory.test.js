'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.APP_URL = 'http://localhost:8080';
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';

const { createApp } = require('../server');

test('createApp accepts injected adapters and exposes the new HTTP interfaces', () => {
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
});
