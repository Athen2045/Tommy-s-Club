(function () {
    'use strict';

    document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
        var track = carousel.querySelector('[data-carousel-track]');
        var viewport = carousel.querySelector('[data-carousel-viewport]');
        var slides = Array.prototype.slice.call(carousel.querySelectorAll('[data-carousel-slide]'));
        var previous = carousel.querySelector('[data-carousel-prev]');
        var next = carousel.querySelector('[data-carousel-next]');
        var status = carousel.querySelector('[data-carousel-status]');
        var thumbnails = Array.prototype.slice.call(carousel.querySelectorAll('[data-carousel-thumb]'));
        var index = 0;
        var pointerStart = null;
        if (!track || !viewport || slides.length < 2) return;

        carousel.classList.add('is-enhanced');
        slides.forEach(function (slide, slideIndex) {
            slide.setAttribute('role', 'group');
            slide.setAttribute('aria-roledescription', 'slide');
            slide.setAttribute('aria-label', (slideIndex + 1) + ' of ' + slides.length);
        });

        function show(nextIndex) {
            index = (nextIndex + slides.length) % slides.length;
            track.style.transform = 'translate3d(-' + (index * 100) + '%, 0, 0)';
            slides.forEach(function (slide, slideIndex) {
                slide.setAttribute('aria-hidden', String(slideIndex !== index));
            });
            if (status) status.textContent = (index + 1) + ' / ' + slides.length;
            thumbnails.forEach(function (thumbnail, thumbnailIndex) {
                if (thumbnailIndex === index) thumbnail.setAttribute('aria-current', 'true');
                else thumbnail.removeAttribute('aria-current');
            });
        }

        if (previous) previous.addEventListener('click', function () { show(index - 1); });
        if (next) next.addEventListener('click', function () { show(index + 1); });
        thumbnails.forEach(function (thumbnail) {
            thumbnail.addEventListener('click', function () {
                show(Number(thumbnail.dataset.carouselIndex) || 0);
            });
        });
        viewport.addEventListener('keydown', function (event) {
            if (event.key === 'ArrowLeft') {
                event.preventDefault();
                show(index - 1);
            } else if (event.key === 'ArrowRight') {
                event.preventDefault();
                show(index + 1);
            } else if (event.key === 'Home') {
                event.preventDefault();
                show(0);
            } else if (event.key === 'End') {
                event.preventDefault();
                show(slides.length - 1);
            }
        });
        viewport.addEventListener('pointerdown', function (event) { pointerStart = event.clientX; });
        viewport.addEventListener('pointerup', function (event) {
            if (pointerStart === null) return;
            var distance = event.clientX - pointerStart;
            pointerStart = null;
            if (Math.abs(distance) > 50) show(index + (distance < 0 ? 1 : -1));
        });
        viewport.addEventListener('pointercancel', function () { pointerStart = null; });

        show(0);
    });
})();
