// js/carousel.js

const Carousel = {
    element: null,
    imagesContainer: null,
    dotsContainer: null,
    prevButton: null,
    nextButton: null,
    imageItems: [],
    dots: [],
    currentIndex: 0,

    // --- New Touch/Drag Variables ---
    isPointerDown: false,
    pointerStartX: 0,
    pointerCurrentX: 0,
    pointerMoveThreshold: 20, // Minimum pixels moved to register as drag/swipe
    slideChangeThreshold: 50, // Minimum pixels needed to change slide
    currentTranslate: 0, // Tracks current position during drag
    animationID: 0, // For requestAnimationFrame
    isDragging: false, // Differentiate click from drag

    // --- Additional Touch Variables ---
    startX: null,
    currentX: null,
    moveThreshold: 20, // minimum pixels to consider as swipe

    init: (carouselId, images) => {
        Carousel.element = document.getElementById(carouselId);
        if (!Carousel.element || !images || images.length === 0) {
            if (Carousel.element) Carousel.element.classList.add('hidden');
            Carousel.cleanup(); // Ensure listeners are removed if re-init with no images
            return;
        }
        Carousel.element.classList.remove('hidden');

        Carousel.imagesContainer = Carousel.element.querySelector('.carousel-images');
        Carousel.dotsContainer = Carousel.element.querySelector('.carousel-dots');
        Carousel.prevButton = Carousel.element.querySelector('.carousel-btn.prev');
        Carousel.nextButton = Carousel.element.querySelector('.carousel-btn.next');

        // --- Cleanup previous listeners before adding new ones ---
        Carousel.cleanup();

        Carousel.imagesContainer.innerHTML = '';
        Carousel.dotsContainer.innerHTML = '';
        Carousel.imageItems = [];
        Carousel.dots = [];
        Carousel.currentIndex = 0;
        Carousel.currentTranslate = 0; // Reset translate

        images.forEach((imgData, index) => {
            const imgItem = document.createElement('div');
            imgItem.className = 'carousel-image-item';
            const link = document.createElement('a');
            const imageUrl = imgData.fullsize || imgData.thumb || imgData.url || '#';
            link.href = imageUrl;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.setAttribute('aria-label', `View full image ${index + 1}`);
            // Prevent link click during drag/swipe
            link.addEventListener('click', (e) => { if (Carousel.isDragging) e.preventDefault(); });

            const img = document.createElement('img');
            img.src = imageUrl;
            img.alt = Utils.escapeHtml(imgData.alt || `Image ${index + 1}`);
            img.loading = 'lazy';
            img.onerror = () => {
                console.warn(`Carousel image failed to load: ${imageUrl}`);
                link.innerHTML = 'Image unavailable'; link.style.color = '#ccc'; link.style.textAlign = 'center'; link.style.padding = '20px'; link.href = '#';
            };

            link.appendChild(img);
            imgItem.appendChild(link);
            Carousel.imagesContainer.appendChild(imgItem);
            Carousel.imageItems.push(imgItem);

            const dot = document.createElement('button');
            dot.className = 'carousel-dot';
            dot.dataset.index = index;
            dot.setAttribute('aria-label', `Go to image ${index + 1}`);
            dot.addEventListener('click', (e) => { e.stopPropagation(); Carousel.goToSlide(index); });
            Carousel.dotsContainer.appendChild(dot);
            Carousel.dots.push(dot);
        });

        const showControls = images.length > 1;
        Carousel.prevButton.classList.toggle('hidden', !showControls);
        Carousel.nextButton.classList.toggle('hidden', !showControls);
        Carousel.dotsContainer.classList.toggle('hidden', !showControls);

        // --- Add Event Listeners ---
        Carousel.prevButton.addEventListener('click', Carousel.prevSlide);
        Carousel.nextButton.addEventListener('click', Carousel.nextSlide);

        // Remove pointer events and use only touch events for mobile
        if (Carousel.imagesContainer) {
            // Remove pointer event listeners
            Carousel.imagesContainer.removeEventListener('pointerdown', Carousel.pointerDown);
            window.removeEventListener('pointermove', Carousel.pointerMove);
            window.removeEventListener('pointerup', Carousel.pointerUp);

            // Add touch event listeners
            Carousel.imagesContainer.addEventListener('touchstart', Carousel.handleTouchStart, { passive: true });
            Carousel.imagesContainer.addEventListener('touchmove', Carousel.handleTouchMove, { passive: true });
            Carousel.imagesContainer.addEventListener('touchend', Carousel.handleTouchEnd);
        }

        Carousel.updateCarousel();
        Carousel.setSliderPosition(); // Set initial position without animation
    },

    cleanup: () => {
        // Remove all potentially attached listeners to prevent memory leaks on re-init
        if (Carousel.prevButton) Carousel.prevButton.removeEventListener('click', Carousel.prevSlide);
        if (Carousel.nextButton) Carousel.nextButton.removeEventListener('click', Carousel.nextSlide);
        if (Carousel.imagesContainer) Carousel.imagesContainer.removeEventListener('pointerdown', Carousel.pointerDown);
        window.removeEventListener('pointermove', Carousel.pointerMove);
        window.removeEventListener('pointerup', Carousel.pointerUp);
        window.removeEventListener('touchend', Carousel.pointerUp); // Remove touchend too
        // Clear any running animation frame
        cancelAnimationFrame(Carousel.animationID);

        // Add cleanup for touch events
        if (Carousel.imagesContainer) {
            Carousel.imagesContainer.removeEventListener('touchstart', Carousel.handleTouchStart);
            Carousel.imagesContainer.removeEventListener('touchmove', Carousel.handleTouchMove);
            Carousel.imagesContainer.removeEventListener('touchend', Carousel.handleTouchEnd);
        }
    },

    handleTouchStart: (e) => {
        Carousel.startX = e.touches[0].clientX;
        Carousel.isDragging = true;
        Carousel.imagesContainer.style.transition = 'none';
    },

    handleTouchMove: (e) => {
        if (!Carousel.isDragging) return;

        const currentX = e.touches[0].clientX;
        const diff = currentX - Carousel.startX;
        const currentPosition = -Carousel.currentIndex * Carousel.element.offsetWidth;

        // Apply the movement
        Carousel.setSliderVisualPosition(currentPosition + diff);
    },

    handleTouchEnd: (e) => {
        if (!Carousel.isDragging) return;

        const endX = e.changedTouches[0].clientX;
        const diff = endX - Carousel.startX;

        Carousel.imagesContainer.style.transition = 'transform 0.3s ease-out';

        if (Math.abs(diff) > 50) { // Threshold for slide change
            if (diff > 0 && Carousel.currentIndex > 0) {
                Carousel.prevSlide();
            } else if (diff < 0 && Carousel.currentIndex < Carousel.imageItems.length - 1) {
                Carousel.nextSlide();
            } else {
                // Reset to current position if at the ends
                Carousel.setSliderPosition();
            }
        } else {
            // Reset to current position if movement was too small
            Carousel.setSliderPosition();
        }

        Carousel.isDragging = false;
    },

    setSliderVisualPosition: (translateX) => {
        if (Carousel.imagesContainer) {
            Carousel.imagesContainer.style.transform = `translateX(${translateX}px)`;
        }
    },

    setSliderPosition: () => {
        if (Carousel.element && Carousel.imagesContainer) {
            const finalTranslate = -Carousel.currentIndex * Carousel.element.offsetWidth;
            Carousel.imagesContainer.style.transform = `translateX(${finalTranslate}px)`;
        }
    },

    updateCarousel: () => {
        if (!Carousel.element || Carousel.imageItems.length === 0) return;

        // Update dots
        Carousel.dots.forEach((dot, index) => {
            dot.classList.toggle('active', index === Carousel.currentIndex);
        });

        // Update buttons visibility
        if (Carousel.imageItems.length > 1) {
            Carousel.prevButton.style.display = Carousel.currentIndex === 0 ? 'none' : 'flex';
            Carousel.nextButton.style.display = Carousel.currentIndex === Carousel.imageItems.length - 1 ? 'none' : 'flex';
        } else {
            Carousel.prevButton.style.display = 'none';
            Carousel.nextButton.style.display = 'none';
        }
    },

    goToSlide: (index) => {
        if (index < 0 || index >= Carousel.imageItems.length || index === Carousel.currentIndex) return;
        Carousel.currentIndex = index;
        Carousel.updateCarousel();
        Carousel.setSliderPosition(); // Animate to new slide
    },

    prevSlide: (e) => {
        if (e) e.stopPropagation();
        Carousel.goToSlide(Carousel.currentIndex - 1);
    },

    nextSlide: (e) => {
        if (e) e.stopPropagation();
        Carousel.goToSlide(Carousel.currentIndex + 1);
    }
};