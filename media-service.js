'use strict';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME = Object.freeze([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif'
]);

const PURPOSE_FOLDERS = Object.freeze({
    'post-image': 'posts/images',
    'post-cover': 'posts/covers',
    avatar: 'avatars',
    chat: 'chat',
    comment: 'comments'
});

function normalizeFolder(folder) {
    return `/${String(folder || '').replace(/^\/+|\/+$/g, '')}`;
}

function createMediaService({ imagekit, urlEndpoint, logger = console }) {
    if (!imagekit) throw new Error('ImageKit adapter is required');

    let deliveryEndpoint = null;
    try {
        deliveryEndpoint = new URL(urlEndpoint);
    } catch (_) {
        deliveryEndpoint = null;
    }

    function folderFor(ownerId, purpose) {
        const suffix = PURPOSE_FOLDERS[purpose];
        if (!suffix || typeof ownerId !== 'string') return null;
        return normalizeFolder(`tommys-club/${ownerId}/${suffix}`);
    }

    function deliveryUrlIsAllowed(value) {
        if (!deliveryEndpoint || typeof value !== 'string') return false;
        try {
            const candidate = new URL(value);
            const endpointPath = deliveryEndpoint.pathname.replace(/\/$/, '');
            return candidate.origin === deliveryEndpoint.origin &&
                (!endpointPath || candidate.pathname === endpointPath ||
                    candidate.pathname.startsWith(`${endpointPath}/`));
        } catch (_) {
            return false;
        }
    }

    async function verify(ownerId, purpose, fileId) {
        const expectedFolder = folderFor(ownerId, purpose);
        if (!expectedFolder || typeof fileId !== 'string' ||
            !/^[A-Za-z0-9_-]{8,128}$/.test(fileId)) {
            throw new Error('Invalid uploaded image');
        }

        let details;
        try {
            details = await imagekit.getFileDetails(fileId);
        } catch (error) {
            logger.warn?.('ImageKit verification failed', {
                purpose,
                reason: 'details_unavailable'
            });
            throw new Error('Uploaded image could not be verified');
        }

        const filePath = normalizeFolder(details.filePath || '');
        const canonicalUrl = details.url || '';
        const mimeType = details.mime || details.mimeType || '';
        const sizeBytes = Number(details.size);
        const width = Number(details.width);
        const height = Number(details.height);

        const valid = (!details.fileId || details.fileId === fileId) &&
            details.fileType === 'image' &&
            ALLOWED_IMAGE_MIME.includes(mimeType) &&
            Number.isFinite(sizeBytes) && sizeBytes > 0 && sizeBytes <= MAX_IMAGE_BYTES &&
            Number.isFinite(width) && width > 0 &&
            Number.isFinite(height) && height > 0 &&
            (filePath === expectedFolder || filePath.startsWith(`${expectedFolder}/`)) &&
            deliveryUrlIsAllowed(canonicalUrl);

        if (!valid) {
            logger.warn?.('ImageKit verification rejected an asset', {
                purpose,
                reason: 'asset_policy_mismatch'
            });
            throw new Error('Invalid uploaded image');
        }

        return {
            url: canonicalUrl,
            fileId: details.fileId || fileId,
            width,
            height,
            mimeType,
            sizeBytes
        };
    }

    async function remove(fileId, context = 'media cleanup') {
        if (!fileId) return false;
        try {
            await imagekit.deleteFile(fileId);
            return true;
        } catch (error) {
            logger.warn?.('Unable to remove ImageKit asset', {
                context,
                reason: 'provider_cleanup_failed'
            });
            return false;
        }
    }

    function deliveryUrl(url, preset) {
        const transforms = {
            feed: 'w-960,h-960,c-at_max,q-80,f-auto',
            post: 'w-1600,h-1600,c-at_max,q-82,f-auto',
            comment: 'w-1040,h-960,c-at_max,q-80,f-auto',
            chat: 'w-320,h-320,c-at_max,q-78,f-auto'
        };
        const transform = transforms[preset];
        if (!transform || !deliveryUrlIsAllowed(url)) return url || '';
        return `${url}${url.includes('?') ? '&' : '?'}tr=${transform}`;
    }

    return {
        allowedTypes: ALLOWED_IMAGE_MIME,
        maxBytes: MAX_IMAGE_BYTES,
        folderFor,
        verify,
        remove,
        deliveryUrl
    };
}

module.exports = {
    ALLOWED_IMAGE_MIME,
    MAX_IMAGE_BYTES,
    createMediaService
};
