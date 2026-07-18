(function () {
    'use strict';

    var root = document.querySelector('[data-post-media]');
    var form = document.getElementById('postForm');
    if (!root || !form || !window.TommyMedia) return;

    var input = root.querySelector('[data-post-media-input]');
    var list = root.querySelector('[data-post-media-list]');
    var count = root.querySelector('[data-post-media-count]');
    var feedback = root.querySelector('[data-post-media-feedback]');
    var items = [];
    var uploading = false;

    function announce(message, isError) {
        feedback.textContent = message || '';
        feedback.classList.toggle('is-error', Boolean(isError));
    }

    function discardUploaded() {
        var fileIds = items.filter(function (item) { return item.media; })
            .map(function (item) { return item.media.fileId; });
        if (!fileIds.length) return Promise.resolve();
        return fetch('/media/discard', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-CSRF-Token': window.CSRF_TOKEN
            },
            body: JSON.stringify({ kind: 'post-image', file_ids: fileIds })
        }).catch(function () {});
    }

    function dispose(item) {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    }

    function move(index, direction) {
        var target = index + direction;
        if (target < 0 || target >= items.length || uploading) return;
        var moved = items.splice(index, 1)[0];
        items.splice(target, 0, moved);
        render();
        var button = list.querySelector('[data-media-index="' + target + '"] [data-media-move="' + direction + '"]');
        if (button) button.focus();
    }

    function remove(index) {
        if (uploading || !items[index]) return;
        dispose(items[index]);
        items.splice(index, 1);
        render();
        announce(items.length ? 'Image removed.' : 'No images selected.', false);
        input.focus();
    }

    function render() {
        list.replaceChildren();
        count.textContent = items.length + ' / 4';
        input.disabled = uploading || items.length >= 4;

        items.forEach(function (item, index) {
            var card = document.createElement('article');
            card.className = 'post-media-item';
            card.dataset.mediaIndex = String(index);

            var preview = document.createElement('img');
            preview.src = item.previewUrl;
            preview.alt = '';
            preview.width = 180;
            preview.height = 135;

            var copy = document.createElement('div');
            copy.className = 'post-media-copy';
            var title = document.createElement('strong');
            title.textContent = (index === 0 ? 'Cover · ' : '') + item.file.name;
            var label = document.createElement('label');
            label.textContent = 'Alt text';
            var alt = document.createElement('input');
            alt.type = 'text';
            alt.maxLength = 300;
            alt.value = item.alt;
            alt.placeholder = 'Describe this image for readers who cannot see it';
            alt.addEventListener('input', function () { item.alt = alt.value; });
            label.appendChild(alt);
            var status = document.createElement('small');
            status.textContent = item.status || 'Ready to upload';
            copy.append(title, label, status);

            var actions = document.createElement('div');
            actions.className = 'post-media-actions';
            [
                { icon: 'bi-arrow-up', label: 'Move image earlier', direction: -1, disabled: index === 0 },
                { icon: 'bi-arrow-down', label: 'Move image later', direction: 1, disabled: index === items.length - 1 }
            ].forEach(function (action) {
                var button = document.createElement('button');
                button.type = 'button';
                button.dataset.mediaMove = String(action.direction);
                button.disabled = uploading || action.disabled;
                button.setAttribute('aria-label', action.label);
                button.innerHTML = '<i class="bi ' + action.icon + '" aria-hidden="true"></i>';
                button.addEventListener('click', function () { move(index, action.direction); });
                actions.appendChild(button);
            });
            var removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'post-media-remove';
            removeButton.disabled = uploading;
            removeButton.setAttribute('aria-label', 'Remove ' + item.file.name);
            removeButton.innerHTML = '<i class="bi bi-x-lg" aria-hidden="true"></i>';
            removeButton.addEventListener('click', function () { remove(index); });
            actions.appendChild(removeButton);

            card.append(preview, copy, actions);
            list.appendChild(card);
        });
    }

    input.addEventListener('change', function () {
        var files = Array.prototype.slice.call(input.files || []);
        var available = 4 - items.length;
        if (files.length > available) announce('Only the first ' + available + ' image(s) were added. A post can contain four.', true);
        files.slice(0, available).forEach(function (file) {
            try {
                window.TommyMedia.validate(file);
                items.push({ file: file, alt: '', previewUrl: URL.createObjectURL(file), media: null, status: '' });
            } catch (error) {
                announce(error.message, true);
            }
        });
        input.value = '';
        render();
    });

    form.addEventListener('submit', function (event) {
        if (!items.length || items.every(function (item) { return item.media; })) return;
        event.preventDefault();
        if (uploading) return;

        uploading = true;
        var submitter = event.submitter;
        var submitButtons = form.querySelectorAll('button[type="submit"]');
        submitButtons.forEach(function (button) { button.disabled = true; });
        render();
        announce('Uploading image 1 of ' + items.length + '…', false);

        items.reduce(function (chain, item, index) {
            return chain.then(function () {
                if (item.media) return undefined;
                item.status = 'Uploading… 0%';
                render();
                return window.TommyMedia.upload(item.file, 'post-image', function (percent) {
                    item.status = 'Uploading… ' + percent + '%';
                    var status = list.querySelector('[data-media-index="' + index + '"] small');
                    if (status) status.textContent = item.status;
                    announce('Uploading image ' + (index + 1) + ' of ' + items.length + '… ' + percent + '%', false);
                }).then(function (media) {
                    item.media = media;
                    item.status = 'Ready';
                    render();
                });
            });
        }, Promise.resolve()).then(function () {
            form.querySelectorAll('[data-generated-post-media]').forEach(function (field) { field.remove(); });
            items.forEach(function (item) {
                var fileId = document.createElement('input');
                fileId.type = 'hidden';
                fileId.name = 'image_file_ids[]';
                fileId.value = item.media.fileId;
                fileId.dataset.generatedPostMedia = '';
                var alt = document.createElement('input');
                alt.type = 'hidden';
                alt.name = 'image_alt[]';
                alt.value = item.alt.trim().slice(0, 300);
                alt.dataset.generatedPostMedia = '';
                form.append(fileId, alt);
            });
            uploading = false;
            announce('Images ready. Saving your post…', false);
            if (submitter && form.requestSubmit) form.requestSubmit(submitter);
            else form.submit();
        }).catch(function (error) {
            uploading = false;
            submitButtons.forEach(function (button) { button.disabled = false; });
            discardUploaded().finally(function () {
                items.forEach(function (item) { item.media = null; item.status = ''; });
                render();
                announce(error.message || 'Images could not be uploaded. Try again.', true);
                input.focus();
            });
        });
    });

    window.addEventListener('pagehide', function () { items.forEach(dispose); });
    render();
})();
