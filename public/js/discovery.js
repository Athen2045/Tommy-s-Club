(function () {
    'use strict';

    document.documentElement.classList.add('has-js');

    function setupSearchCombobox(form) {
        var input = form.querySelector('[data-search-input]');
        var list = form.querySelector('[data-search-list]');
        var empty = form.querySelector('[data-search-empty]');
        var label = form.querySelector('.search-suggestions-label');
        if (!input || !list || !empty) return;

        var mobileTrigger = document.querySelector('[data-mobile-search-trigger]');
        var mobileClose = form.querySelector('[data-mobile-search-close]');
        var mobileQuery = window.matchMedia('(max-width: 520px)');
        var mobileScrim = document.createElement('button');
        mobileScrim.type = 'button';
        mobileScrim.className = 'mobile-search-scrim';
        mobileScrim.setAttribute('aria-label', 'Close search');
        mobileScrim.hidden = true;
        document.body.appendChild(mobileScrim);

        function setMobileOpen(open, restoreFocus) {
            if (!mobileTrigger) return;
            form.classList.toggle('is-mobile-open', open);
            mobileTrigger.setAttribute('aria-expanded', String(open));
            mobileScrim.hidden = !open;
            document.body.classList.toggle('channels-sheet-open', open);
            if (open) window.setTimeout(function () { input.focus(); }, 0);
            else {
                closeList();
                if (restoreFocus) mobileTrigger.focus();
            }
        }

        if (mobileTrigger) mobileTrigger.addEventListener('click', function () { setMobileOpen(true, false); });
        if (mobileClose) mobileClose.addEventListener('click', function () { setMobileOpen(false, true); });
        mobileScrim.addEventListener('click', function () { setMobileOpen(false, true); });
        if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', function () { setMobileOpen(false, false); });

        var initialOptions = Array.prototype.slice.call(form.querySelectorAll('[data-search-option]'))
            .map(function (option) { return option.cloneNode(true); });
        var options = [];
        var activeIndex = -1;
        var requestTimer = 0;
        var requestController = null;

        function refreshOptions() {
            options = Array.prototype.slice.call(list.querySelectorAll('[data-search-option]'));
            options.forEach(function (option, index) {
                option.id = 'search-option-' + index;
                option.setAttribute('aria-selected', 'false');
            });
        }

        function visibleOptions() {
            return options.filter(function (option) { return !option.hidden; });
        }

        function setActive(index) {
            var visible = visibleOptions();
            visible.forEach(function (option) { option.setAttribute('aria-selected', 'false'); });
            if (!visible.length || index < 0) {
                activeIndex = -1;
                input.removeAttribute('aria-activedescendant');
                return;
            }
            activeIndex = (index + visible.length) % visible.length;
            visible[activeIndex].setAttribute('aria-selected', 'true');
            input.setAttribute('aria-activedescendant', visible[activeIndex].id);
            visible[activeIndex].scrollIntoView({ block: 'nearest' });
        }

        function openList() {
            list.hidden = false;
            input.setAttribute('aria-expanded', 'true');
        }

        function closeList() {
            list.hidden = true;
            input.setAttribute('aria-expanded', 'false');
            setActive(-1);
        }

        function clearOptions() {
            options.forEach(function (option) { option.remove(); });
            options = [];
            setActive(-1);
        }

        function resetInitial() {
            clearOptions();
            initialOptions.forEach(function (option) { list.insertBefore(option.cloneNode(true), empty); });
            if (label) label.textContent = initialOptions.length ? 'Channels' : 'Search';
            refreshOptions();
            empty.textContent = initialOptions.length
                ? 'Press Enter to search all members and channels.'
                : 'Type to search members and channels.';
            empty.hidden = initialOptions.length > 0;
            openList();
        }

        function resultOption(item) {
            var option = document.createElement('a');
            option.href = item.href;
            option.setAttribute('role', 'option');
            option.setAttribute('data-search-option', '');
            option.dataset.searchValue = item.label;

            var main = document.createElement('span');
            main.className = 'search-suggestion-main';
            var mark = document.createElement('span');
            mark.className = 'search-suggestion-mark';
            if (item.type === 'member' && item.avatar_url) {
                var avatar = document.createElement('img');
                avatar.src = item.avatar_url;
                avatar.alt = '';
                mark.appendChild(avatar);
            } else {
                var icon = document.createElement('i');
                icon.className = item.type === 'member' ? 'bi bi-person' : 'bi bi-grid';
                icon.setAttribute('aria-hidden', 'true');
                mark.appendChild(icon);
            }
            var text = document.createElement('span');
            text.textContent = item.label;
            main.appendChild(mark);
            main.appendChild(text);
            if (item.isAdmin) {
                var badge = document.createElement('img');
                badge.className = 'admin-verified-badge';
                badge.src = '/assets/admin-verified.jpeg';
                badge.alt = '';
                badge.setAttribute('aria-hidden', 'true');
                main.appendChild(badge);
                var adminText = document.createElement('span');
                adminText.className = 'sr-only';
                adminText.textContent = 'Administrator';
                main.appendChild(adminText);
            }

            var detail = document.createElement('small');
            detail.textContent = item.description || (item.type === 'member' ? 'Member' : 'Channel');
            option.appendChild(main);
            option.appendChild(detail);
            return option;
        }

        function renderResults(items) {
            clearOptions();
            items.forEach(function (item) { list.insertBefore(resultOption(item), empty); });
            if (label) label.textContent = 'Results';
            refreshOptions();
            empty.textContent = 'No matches. Press Enter to view the full search page.';
            empty.hidden = items.length > 0;
            openList();
        }

        function searchRemote() {
            var query = input.value.trim();
            window.clearTimeout(requestTimer);
            if (requestController) requestController.abort();
            if (!query) {
                resetInitial();
                return;
            }

            options.forEach(function (option) { option.hidden = true; });
            empty.textContent = 'Searching…';
            empty.hidden = false;
            openList();
            requestTimer = window.setTimeout(function () {
                requestController = typeof AbortController === 'function' ? new AbortController() : null;
                fetch('/search?q=' + encodeURIComponent(query), {
                    headers: { Accept: 'application/json' },
                    signal: requestController ? requestController.signal : undefined
                })
                .then(function (response) {
                    if (!response.ok) throw new Error('Search unavailable');
                    return response.json();
                })
                .then(function (data) { renderResults(Array.isArray(data.results) ? data.results : []); })
                .catch(function (error) {
                    if (error.name === 'AbortError') return;
                    clearOptions();
                    empty.textContent = 'Search is unavailable. Press Enter to try the search page.';
                    empty.hidden = false;
                    openList();
                });
            }, 180);
        }

        refreshOptions();
        input.addEventListener('focus', function () {
            if (input.value.trim()) searchRemote();
            else resetInitial();
        });
        input.addEventListener('input', searchRemote);
        input.addEventListener('keydown', function (event) {
            var visible = visibleOptions();
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                openList();
                setActive(activeIndex + 1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                openList();
                setActive(activeIndex < 0 ? visible.length - 1 : activeIndex - 1);
            } else if (event.key === 'Enter' && activeIndex > -1 && visible[activeIndex]) {
                event.preventDefault();
                visible[activeIndex].click();
            } else if (event.key === 'Escape') {
                event.preventDefault();
                closeList();
            }
        });
        form.addEventListener('focusout', function () {
            window.setTimeout(function () {
                if (!form.contains(document.activeElement)) closeList();
            }, 0);
        });
        document.addEventListener('keydown', function (event) {
            var isMobileOpen = mobileTrigger && mobileTrigger.getAttribute('aria-expanded') === 'true';
            if (event.key === 'Escape' && isMobileOpen) {
                setMobileOpen(false, true);
                return;
            }
            if (event.key === 'Tab' && isMobileOpen && mobileQuery.matches) {
                var focusable = Array.prototype.slice.call(form.querySelectorAll('input, button:not([disabled]), a[href]'))
                    .filter(function (element) { return !element.closest('[hidden]'); });
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

    function setupChannels(control) {
        var trigger = control.querySelector('[data-channels-trigger]');
        var panel = control.querySelector('[data-channels-panel]');
        var close = control.querySelector('[data-channels-close]');
        if (!trigger || !panel) return;

        var mobileQuery = window.matchMedia('(max-width: 820px)');
        var scrim = document.createElement('button');
        scrim.type = 'button';
        scrim.className = 'channels-scrim';
        scrim.setAttribute('aria-label', 'Close joined channels');
        scrim.tabIndex = -1;
        scrim.hidden = true;
        document.body.appendChild(scrim);

        function setOpen(open, restoreFocus) {
            trigger.setAttribute('aria-expanded', String(open));
            trigger.classList.toggle('is-open', open);
            panel.hidden = !open;
            scrim.hidden = !(open && mobileQuery.matches);
            document.body.classList.toggle('channels-sheet-open', open && mobileQuery.matches);
            if (open && mobileQuery.matches) {
                panel.setAttribute('role', 'dialog');
                panel.setAttribute('aria-modal', 'true');
            } else {
                panel.removeAttribute('role');
                panel.removeAttribute('aria-modal');
            }
            if (open) {
                var first = mobileQuery.matches ? close : panel.querySelector('a, button');
                if (first) window.setTimeout(function () { first.focus(); }, 0);
            } else if (restoreFocus) {
                trigger.focus();
            }
        }

        trigger.addEventListener('click', function (event) {
            event.stopPropagation();
            setOpen(trigger.getAttribute('aria-expanded') !== 'true', false);
        });
        if (close) close.addEventListener('click', function () { setOpen(false, true); });
        scrim.addEventListener('click', function () { setOpen(false, true); });
        document.addEventListener('click', function (event) {
            if (!mobileQuery.matches && !control.contains(event.target) && trigger.getAttribute('aria-expanded') === 'true') {
                setOpen(false, true);
            }
        });
        document.addEventListener('keydown', function (event) {
            var isOpen = trigger.getAttribute('aria-expanded') === 'true';
            if (event.key === 'Escape' && isOpen) {
                setOpen(false, true);
                return;
            }
            if (event.key === 'Tab' && isOpen && mobileQuery.matches) {
                var focusable = Array.prototype.slice.call(panel.querySelectorAll('a[href], button:not([disabled])'));
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
        var handleBreakpoint = function () {
            if (trigger.getAttribute('aria-expanded') === 'true') setOpen(false, false);
        };
        if (mobileQuery.addEventListener) mobileQuery.addEventListener('change', handleBreakpoint);
        else mobileQuery.addListener(handleBreakpoint);
    }

    document.querySelectorAll('[data-search-form]').forEach(setupSearchCombobox);
    document.querySelectorAll('[data-channels-control]').forEach(setupChannels);
})();
