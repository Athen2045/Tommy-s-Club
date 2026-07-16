(function () {
    'use strict';

    var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    var maxBytes = 8 * 1024 * 1024;

    function responseJson(response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
            if (!response.ok) throw new Error(data.error || 'Image upload could not be prepared');
            return data;
        });
    }

    function validate(file) {
        if (!file) throw new Error('Choose an image first.');
        if (!allowedTypes.includes(file.type)) throw new Error('Choose a JPEG, PNG, GIF, WebP, or AVIF image.');
        if (file.size > maxBytes) throw new Error('Image must be 8 MB or smaller.');
    }

    function uploadToImageKit(file, auth, onProgress) {
        return new Promise(function (resolve, reject) {
            var body = new FormData();
            body.append('file', file);
            body.append('fileName', file.name || ('image-' + auth.token));
            body.append('publicKey', auth.publicKey);
            body.append('signature', auth.signature);
            body.append('expire', String(auth.expire));
            body.append('token', auth.token);
            body.append('folder', auth.folder);
            body.append('useUniqueFileName', 'true');

            var request = new XMLHttpRequest();
            request.open('POST', auth.uploadEndpoint, true);
            request.setRequestHeader('Accept', 'application/json');
            request.upload.addEventListener('progress', function (event) {
                if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
            });
            request.addEventListener('load', function () {
                var data = {};
                try { data = JSON.parse(request.responseText || '{}'); } catch (_) {}
                if (request.status < 200 || request.status >= 300 || !data.url || !data.fileId) {
                    return reject(new Error(data.message || 'Image upload failed. Try again.'));
                }
                resolve({ url: data.url, fileId: data.fileId, width: data.width, height: data.height });
            });
            request.addEventListener('error', function () { reject(new Error('Image upload was interrupted. Try again.')); });
            request.addEventListener('abort', function () { reject(new Error('Image upload was cancelled.')); });
            request.send(body);
        });
    }

    function upload(file, kind, onProgress) {
        validate(file);
        return fetch('/media/auth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-Token': window.CSRF_TOKEN
            },
            body: JSON.stringify({ kind: kind })
        })
            .then(responseJson)
            .then(function (auth) {
                allowedTypes = auth.allowedTypes || allowedTypes;
                maxBytes = Number(auth.maxBytes) || maxBytes;
                validate(file);
                return uploadToImageKit(file, auth, onProgress);
            });
    }

    function bindDirectUpload(input) {
        var form = input.form;
        if (!form) return;
        var urlField = form.querySelector(input.dataset.mediaUrlField);
        var idField = form.querySelector(input.dataset.mediaIdField);
        var feedback = form.querySelector(input.dataset.mediaFeedback || '.form-upload-feedback');
        var uploading = false;

        input.addEventListener('change', function () {
            if (urlField) urlField.value = '';
            if (idField) idField.value = '';
            if (feedback) feedback.textContent = '';
        });

        form.addEventListener('submit', function (event) {
            var file = input.files && input.files[0];
            if (!file || (idField && idField.value) || uploading) return;
            event.preventDefault();
            var submitter = event.submitter;
            uploading = true;
            if (feedback) feedback.textContent = 'Uploading image… 0%';

            upload(file, input.dataset.mediaKind, function (percent) {
                if (feedback) feedback.textContent = 'Uploading image… ' + percent + '%';
            }).then(function (media) {
                if (urlField) urlField.value = media.url;
                if (idField) idField.value = media.fileId;
                input.disabled = true;
                if (feedback) feedback.textContent = 'Image ready.';
                uploading = false;
                if (submitter && typeof form.requestSubmit === 'function') form.requestSubmit(submitter);
                else form.submit();
            }).catch(function (error) {
                uploading = false;
                if (feedback) feedback.textContent = error.message;
                input.focus();
            });
        });
    }

    window.TommyMedia = { upload: upload, validate: validate };
    document.querySelectorAll('[data-media-kind][data-media-url-field][data-media-id-field]').forEach(bindDirectUpload);
})();
