(function () {
    'use strict';

    function enhancePasswords() {
        document.querySelectorAll('input[type="password"]').forEach(function (input) {
            if (input.parentElement && input.parentElement.classList.contains('password-control')) return;
            var wrapper = document.createElement('div');
            wrapper.className = 'password-control';
            input.parentNode.insertBefore(wrapper, input);
            wrapper.appendChild(input);

            var toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'password-toggle';
            toggle.textContent = 'Show';
            toggle.setAttribute('aria-label', 'Show password');
            toggle.addEventListener('click', function () {
                var showing = input.type === 'text';
                input.type = showing ? 'password' : 'text';
                toggle.textContent = showing ? 'Show' : 'Hide';
                toggle.setAttribute('aria-label', (showing ? 'Show' : 'Hide') + ' password');
            });
            wrapper.appendChild(toggle);
        });
    }

    function enhanceForms() {
        document.querySelectorAll('form').forEach(function (form) {
            form.addEventListener('submit', function (event) {
                var confirmation = form.dataset.confirm;
                if (confirmation && !window.confirm(confirmation)) {
                    event.preventDefault();
                    return;
                }
                if (!form.checkValidity()) return;
                var submit = event.submitter || form.querySelector('button[type="submit"], input[type="submit"]');
                if (!submit) return;
                window.setTimeout(function () {
                    if (event.defaultPrevented) return;
                    submit.setAttribute('aria-busy', 'true');
                    submit.disabled = true;
                    if (submit.tagName === 'BUTTON') {
                        submit.dataset.originalLabel = submit.textContent;
                        submit.textContent = 'Working…';
                    }
                }, 0);
            });
        });

        var notice = document.querySelector('.gate-error');
        if (notice) {
            notice.setAttribute('role', 'alert');
            notice.setAttribute('tabindex', '-1');
            notice.focus({ preventScroll: false });
        }
        document.querySelectorAll('.gate-success').forEach(function (success) {
            success.setAttribute('role', 'status');
            success.setAttribute('aria-live', 'polite');
        });
    }

    function enhanceTermsAgreement() {
        var checkbox = document.getElementById('agreedBox');
        var submit = document.getElementById('termsBtn');
        if (!checkbox || !submit) return;

        function syncAgreement() {
            submit.disabled = !checkbox.checked;
            submit.setAttribute('aria-disabled', String(!checkbox.checked));
        }

        checkbox.addEventListener('change', syncAgreement);
        syncAgreement();
    }

    function animateVerificationStamp() {
        var stamp = document.querySelector('[data-verification-stamp]');
        if (!stamp) return;
        document.body.classList.add('intro-skipped');

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
            !window.anime || typeof window.anime.animate !== 'function') {
            stamp.classList.add('is-visible');
            return;
        }

        stamp.classList.add('is-visible');
        window.anime.animate(stamp, {
            opacity: [0, 1],
            y: [-8, 0],
            scale: [0.96, 1],
            duration: 320,
            ease: 'out(4)'
        });
    }

    function initialise() {
        enhancePasswords();
        enhanceForms();
        enhanceTermsAgreement();
        animateVerificationStamp();
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialise);
    else initialise();
})();
