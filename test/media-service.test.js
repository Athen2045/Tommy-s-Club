'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createMediaService, MAX_IMAGE_BYTES } = require('../media-service');

const ownerId = '4acd449c-31f3-498e-ae3e-c71ffa2eb8f2';
const fileId = 'abcDEF_1234567890';

function details(overrides = {}) {
    return {
        fileId,
        fileType: 'image',
        mime: 'image/webp',
        size: 1024,
        width: 1200,
        height: 800,
        filePath: `/tommys-club/${ownerId}/posts/images/canonical-name.webp`,
        url: 'https://ik.imagekit.io/demo/canonical-name.webp',
        ...overrides
    };
}

function serviceWith(fileDetails) {
    return createMediaService({
        imagekit: {
            getFileDetails: async () => fileDetails,
            deleteFile: async () => undefined
        },
        urlEndpoint: 'https://ik.imagekit.io/demo',
        logger: { warn() {} }
    });
}

test('accepts the canonical ImageKit URL returned for an owned upload', async () => {
    const media = await serviceWith(details()).verify(ownerId, 'post-image', fileId);
    assert.equal(media.url, 'https://ik.imagekit.io/demo/canonical-name.webp');
    assert.equal(media.width, 1200);
    assert.equal(media.height, 800);
});

test('rejects an upload outside the signed-in owner folder', async () => {
    await assert.rejects(
        serviceWith(details({ filePath: '/tommys-club/another-user/posts/images/image.webp' }))
            .verify(ownerId, 'post-image', fileId),
        /Invalid uploaded image/
    );
});

test('rejects unsupported MIME types and non-image file records', async () => {
    await assert.rejects(
        serviceWith(details({ mime: 'image/svg+xml' })).verify(ownerId, 'post-image', fileId),
        /Invalid uploaded image/
    );
    await assert.rejects(
        serviceWith(details({ fileType: 'non-image' })).verify(ownerId, 'post-image', fileId),
        /Invalid uploaded image/
    );
});

test('rejects files over 8 MB and invalid dimensions', async () => {
    await assert.rejects(
        serviceWith(details({ size: MAX_IMAGE_BYTES + 1 })).verify(ownerId, 'post-image', fileId),
        /Invalid uploaded image/
    );
    await assert.rejects(
        serviceWith(details({ width: 0 })).verify(ownerId, 'post-image', fileId),
        /Invalid uploaded image/
    );
});

test('rejects unknown file IDs without exposing adapter errors', async () => {
    const service = createMediaService({
        imagekit: {
            getFileDetails: async () => { throw new Error('private adapter response'); },
            deleteFile: async () => undefined
        },
        urlEndpoint: 'https://ik.imagekit.io/demo',
        logger: { warn() {} }
    });
    await assert.rejects(service.verify(ownerId, 'post-image', fileId), /Uploaded image could not be verified/);
});
