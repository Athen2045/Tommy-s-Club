(function () {
    'use strict';

    var root = document.querySelector('.entry-transition');
    if (!root) return;

    var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var handoff = root.querySelector('.entry-handoff');
    var wordmark = root.querySelector('[data-entry-wordmark]');
    var target = root.querySelector('[data-entry-o]');
    var loader = root.querySelector('[data-entry-loader]');

    function leave(delay) {
        window.setTimeout(function () { root.classList.add('is-leaving'); }, delay);
        window.setTimeout(function () { window.location.replace('/blog'); }, delay + 520);
    }

    if (reduced) {
        handoff.hidden = true;
        loader.classList.add('is-visible');
        leave(520);
        return;
    }

    var anime = window.anime;
    if (!anime || typeof anime.animate !== 'function' || !wordmark || !target) {
        root.classList.add('entry-transition--fallback');
        window.setTimeout(function () { loader.classList.add('is-visible'); }, 360);
        leave(1600);
        return;
    }

    window.requestAnimationFrame(function () {
        var rect = target.getBoundingClientRect();
        var wordmarkRect = wordmark.getBoundingClientRect();
        var offsetX = (window.innerWidth / 2) - (rect.left + rect.width / 2);
        var offsetY = (window.innerHeight / 2) - (rect.top + rect.height / 2);
        wordmark.style.transformOrigin =
            (rect.left + rect.width / 2 - wordmarkRect.left) + 'px ' +
            (rect.top + rect.height / 2 - wordmarkRect.top) + 'px';

        anime.animate(wordmark, {
            scale: [1, 18],
            x: [0, offsetX],
            y: [0, offsetY],
            duration: 520,
            delay: 130,
            ease: 'in(4)'
        });
        anime.animate(handoff, {
            opacity: [1, 0],
            duration: 170,
            delay: 540,
            ease: 'linear'
        });
        anime.animate(loader, {
            opacity: [0, 1],
            scale: [0.96, 1],
            duration: 220,
            delay: 570,
            ease: 'out(3)',
            onBegin: function () { loader.classList.add('is-visible'); }
        });
    });

    leave(1680);
})();
