(function () {
    'use strict';

    if (!window.anime || !window.anime.animate ||
        window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var contribute = document.querySelector('[data-contribute-section]');
    if (contribute) {
        window.anime.animate(contribute, {
            opacity: [0, 1],
            y: [14, 0],
            duration: 340,
            ease: 'out(3)'
        });
    }
})();
