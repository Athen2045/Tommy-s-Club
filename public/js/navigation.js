(function () {
    'use strict';

    var tokenMeta = document.querySelector('meta[name="csrf-token"]');
    window.CSRF_TOKEN = tokenMeta ? tokenMeta.content : '';

    function setupProfileMenus() {
        document.querySelectorAll('[data-profile-menu]').forEach(function (menu) {
            var trigger = menu.querySelector('[data-profile-trigger]');
            var content = menu.querySelector('[data-profile-content]');
            if (!trigger || !content) return;

            function setOpen(open, restoreFocus) {
                menu.classList.toggle('is-open', open);
                trigger.setAttribute('aria-expanded', String(open));
                content.hidden = !open;
                if (open) {
                    var first = content.querySelector('a, button');
                    if (first) first.focus();
                } else if (restoreFocus) {
                    trigger.focus();
                }
            }

            trigger.addEventListener('click', function (event) {
                event.stopPropagation();
                setOpen(!menu.classList.contains('is-open'), false);
            });
            document.addEventListener('click', function (event) {
                if (!menu.contains(event.target) && menu.classList.contains('is-open')) setOpen(false, true);
            });
            document.addEventListener('keydown', function (event) {
                if (event.key === 'Escape' && menu.classList.contains('is-open')) setOpen(false, true);
            });
        });
    }

    function setupMobileProfile() {
        var trigger = document.querySelector('[data-mobile-profile-trigger]');
        var sheet = document.getElementById('mobileProfileSheet');
        var scrim = document.querySelector('[data-mobile-profile-scrim]');
        if (!trigger || !sheet || !scrim) return;

        function setOpen(open, restoreFocus) {
            trigger.setAttribute('aria-expanded', String(open));
            sheet.setAttribute('aria-hidden', String(!open));
            sheet.hidden = !open;
            scrim.hidden = !open;
            document.body.classList.toggle('profile-sheet-open', open);
            if (open) {
                var first = sheet.querySelector('a, button');
                if (first) window.setTimeout(function () { first.focus(); }, 0);
            } else if (restoreFocus) {
                trigger.focus();
            }
        }

        trigger.addEventListener('click', function () {
            setOpen(trigger.getAttribute('aria-expanded') !== 'true', false);
        });
        scrim.addEventListener('click', function () { setOpen(false, true); });
        document.addEventListener('keydown', function (event) {
            var isOpen = trigger.getAttribute('aria-expanded') === 'true';
            if (event.key === 'Escape' && isOpen) {
                setOpen(false, true);
                return;
            }
            if (event.key === 'Tab' && isOpen) {
                var focusable = Array.prototype.slice.call(sheet.querySelectorAll('a[href], button:not([disabled])'));
                if (!focusable.length) return;
                var first = focusable[0];
                var last = focusable[focusable.length - 1];
                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first.focus();
                }
            }
        });
    }

    function checkUnreadMessages() {
        var marks = document.querySelectorAll('[data-unread-mark]');
        if (!marks.length) return;
        var lastSeen = parseInt(localStorage.getItem('tommys_club_last_msg') || '0', 10);
        fetch('/chat/unread-count')
            .then(function (response) { return response.json(); })
            .then(function (data) {
                if (data.latestId && data.latestId > lastSeen) {
                    marks.forEach(function (mark) { mark.hidden = false; });
                }
            })
            .catch(function () {});
    }

    setupProfileMenus();
    setupMobileProfile();
    checkUnreadMessages();
})();
