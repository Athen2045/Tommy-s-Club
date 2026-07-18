'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'development';
process.env.APP_URL = 'https://tommysclub.vercel.app';
process.env.SESSION_SECRET = 'test-session-secret-that-is-long-enough';

const credentialNames = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_KEY',
    'IMAGEKIT_PUBLIC_KEY',
    'IMAGEKIT_PRIVATE_KEY',
    'IMAGEKIT_URL_ENDPOINT'
];
for (const name of credentialNames) process.env[name] = '';

const { createApp } = require('../server');

function createTestApp(blogService, logger = { warn() {}, error() {} }) {
    return createApp({
        blogService,
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
        logger
    });
}

async function invokeSitemap(app) {
    const layer = app._router.stack.find(candidate => candidate.route?.path === '/sitemap.xml');
    assert.ok(layer, 'sitemap route should be registered');
    const handler = layer.route.stack[0].handle;
    const response = {
        statusCode: 200,
        headers: {},
        body: '',
        set(name, value) {
            if (typeof name === 'object') {
                for (const [header, headerValue] of Object.entries(name)) {
                    this.headers[header.toLowerCase()] = headerValue;
                }
            } else {
                this.headers[name.toLowerCase()] = value;
            }
            return this;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        type(value) {
            this.headers['content-type'] = value;
            return this;
        },
        send(body) {
            this.body = String(body);
            return this;
        }
    };
    await handler({}, response);
    return response;
}

test('sitemap contains canonical public pages and published post entries', async () => {
    const app = createTestApp({
        async getSitemapPosts() {
            return [
                { id: 7, created_at: '2026-07-01T08:00:00.000Z', updated_at: '2026-07-14T10:30:00.000Z' },
                { id: 9, created_at: '2026-07-15T12:00:00.000Z', updated_at: null },
                { id: 'invalid', created_at: '2026-07-16T12:00:00.000Z', updated_at: null }
            ];
        }
    });
    const response = await invokeSitemap(app);
    const xml = response.body;

    assert.equal(response.statusCode, 200);
    assert.match(response.headers['content-type'], /^application\/xml; charset=utf-8/i);
    assert.match(response.headers['cache-control'], /s-maxage=1800/);
    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>/);
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.match(xml, /<loc>https:\/\/tommysclub\.vercel\.app\/blog<\/loc>/);
    assert.match(xml, /<loc>https:\/\/tommysclub\.vercel\.app\/about<\/loc>/);
    assert.match(xml, /<loc>https:\/\/tommysclub\.vercel\.app\/categories<\/loc>/);
    assert.match(xml, /<loc>https:\/\/tommysclub\.vercel\.app\/blog\/7<\/loc>/);
    assert.match(xml, /<lastmod>2026-07-14T10:30:00\.000Z<\/lastmod>/);
    assert.match(xml, /<loc>https:\/\/tommysclub\.vercel\.app\/blog\/9<\/loc>/);
    assert.match(xml, /<lastmod>2026-07-15T12:00:00\.000Z<\/lastmod>/);
    assert.doesNotMatch(xml, /invalid|\/login|\/register|\/terms|\/settings|category=/);
    assert.doesNotMatch(xml, /<priority>|<changefreq>/);
    assert.equal((xml.match(/<url>/g) || []).length, 5);
});

test('sitemap returns a non-cacheable 503 when published posts cannot be loaded', async () => {
    const app = createTestApp({
        async getSitemapPosts() {
            throw new Error('database unavailable');
        }
    });
    const response = await invokeSitemap(app);

    assert.equal(response.statusCode, 503);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.body, 'Sitemap temporarily unavailable');
});
