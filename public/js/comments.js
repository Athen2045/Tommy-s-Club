(function () {
    'use strict';

    function setReply(id, open, restoreFocus) {
        var trigger = document.querySelector('[data-reply-trigger="' + id + '"]');
        var container = document.getElementById('reply-form-' + id);
        if (!trigger || !container) return;
        trigger.setAttribute('aria-expanded', String(open));
        container.hidden = !open;
        if (open) {
            var textarea = container.querySelector('textarea');
            if (textarea) textarea.focus();
        } else if (restoreFocus) {
            trigger.focus();
        }
    }

    document.querySelectorAll('[data-reply-trigger]').forEach(function (trigger) {
        trigger.addEventListener('click', function () {
            setReply(trigger.dataset.replyTrigger, trigger.getAttribute('aria-expanded') !== 'true', false);
        });
    });
    document.querySelectorAll('[data-reply-cancel]').forEach(function (button) {
        button.addEventListener('click', function () { setReply(button.dataset.replyCancel, false, true); });
    });
    document.addEventListener('keydown', function (event) {
        if (event.key !== 'Escape') return;
        var openForm = document.querySelector('[data-reply-form]:not([hidden])');
        if (!openForm) return;
        var id = openForm.id.replace('reply-form-', '');
        setReply(id, false, true);
    });

    document.querySelectorAll('[data-comment-composer]').forEach(function (composer) {
        var input = composer.querySelector('[data-comment-image-input]');
        var preview = composer.querySelector('[data-comment-image-preview]');
        var textarea = composer.querySelector('textarea[name="body"]');
        var imageId = composer.querySelector('input[name="image_file_id"]');
        var objectUrl = '';
        var counter = null;

        if (textarea) {
            counter = document.createElement('span');
            counter.className = 'comment-character-count';
            counter.setAttribute('aria-live', 'polite');
            textarea.insertAdjacentElement('afterend', counter);
            var updateCount = function () { counter.textContent = textarea.value.length + ' / 2000'; };
            textarea.addEventListener('input', updateCount);
            updateCount();
        }

        function clearValidity() {
            if (textarea) textarea.setCustomValidity('');
        }

        function clearPreview(restoreFocus) {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            objectUrl = '';
            if (input) input.value = '';
            if (preview) {
                preview.hidden = true;
                var image = preview.querySelector('img');
                if (image) image.removeAttribute('src');
            }
            if (imageId) imageId.value = '';
            var urlSelector = input && input.dataset.mediaUrlField;
            var urlField = urlSelector ? composer.querySelector(urlSelector) : null;
            if (urlField) urlField.value = '';
            clearValidity();
            if (restoreFocus && input) input.focus();
        }

        if (textarea) textarea.addEventListener('input', clearValidity);
        if (input && preview) {
            input.addEventListener('change', function () {
                var file = input.files && input.files[0];
                if (!file) return clearPreview(false);
                try {
                    window.TommyMedia.validate(file);
                } catch (error) {
                    clearPreview(false);
                    if (textarea) {
                        textarea.setCustomValidity(error.message);
                        textarea.reportValidity();
                    }
                    return;
                }
                if (objectUrl) URL.revokeObjectURL(objectUrl);
                objectUrl = URL.createObjectURL(file);
                preview.querySelector('img').src = objectUrl;
                preview.hidden = false;
                clearValidity();
            });
            var remove = preview.querySelector('[data-comment-image-remove]');
            if (remove) remove.addEventListener('click', function () { clearPreview(true); });
        }

        composer.addEventListener('submit', function (event) {
            var hasBody = textarea && textarea.value.trim().length > 0;
            var hasStoredImage = imageId && imageId.value.trim().length > 0;
            var hasPendingImage = input && input.files && input.files.length > 0;
            if (hasBody || hasStoredImage || hasPendingImage) {
                clearValidity();
                return;
            }
            event.preventDefault();
            if (textarea) {
                textarea.setCustomValidity('Add a comment or an image.');
                textarea.reportValidity();
            }
        });
    });
})();
