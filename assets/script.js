document.addEventListener('DOMContentLoaded', () => {
    const introSection = document.getElementById('introSection');
    const lightboxSection = document.getElementById('lightboxSection');
    const lightboxImageContainer = document.getElementById('lightboxImageContainer');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxDescription = document.getElementById('lightboxDescription');
    const lightboxActions = document.getElementById('lightboxActions');
    const projectCards = document.querySelectorAll('.project-card');
    const progressBarContainer = document.getElementById('progressBarContainer');
    const progressBarValue = document.getElementById('progressBarValue');

    const LIGHTBOX_DURATION_MS = 12000;
    let lightboxTimeout = null;

    const showIntro = () => {
        lightboxSection.classList.remove('visible');
        lightboxSection.classList.add('hidden');
        introSection.classList.remove('hidden');
        introSection.classList.add('visible');

        progressBarContainer.classList.remove('visible');
        progressBarValue.style.transition = 'none';
        progressBarValue.style.transform = 'scaleX(1)';

        if (lightboxTimeout) {
            clearTimeout(lightboxTimeout);
            lightboxTimeout = null;
        }
    };

    const showLightbox = (cardData) => {
        // Add transition class to body
        document.body.classList.add('transitioning');

        // Set up the lightbox content
        lightboxTitle.textContent = cardData.title;
        lightboxDescription.textContent = cardData.description;

        // Clear and set up image with loading animation
        lightboxImageContainer.innerHTML = '';
        const img = document.createElement('img');
        img.src = cardData.image;
        img.alt = cardData.title + " Preview";
        img.style.opacity = '0';
        img.onload = () => {
            img.style.transition = 'opacity 0.3s ease';
            img.style.opacity = '1';
        };
        lightboxImageContainer.appendChild(img);

        // Set up actions with staggered animation
        lightboxActions.innerHTML = '';
        try {
            const actions = JSON.parse(cardData.actions || '[]');
            if (Array.isArray(actions)) {
                actions.forEach((action, index) => {
                    if (action.text && action.url) {
                        const link = document.createElement('a');
                        link.href = action.url;
                        link.textContent = action.text;
                        link.target = "_blank";
                        link.rel = "noopener noreferrer";

                        // Use custom button type if specified, otherwise use auto-detection
                        if (action.buttonType) {
                            link.dataset.buttonType = action.buttonType;
                        } else if (action.text.toLowerCase().includes('feedback')) {
                            link.dataset.buttonType = 'outline';
                        } else if (action.text.toLowerCase().includes('source')) {
                            link.dataset.buttonType = 'secondary';
                        } else {
                            link.dataset.buttonType = 'primary';
                        }

                        link.style.opacity = '0';
                        link.style.transform = 'translateY(10px)';
                        link.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
                        link.style.transitionDelay = `${index * 0.1}s`;
                        lightboxActions.appendChild(link);

                        setTimeout(() => {
                            link.style.opacity = '1';
                            link.style.transform = 'translateY(0)';
                        }, 50 + (index * 100));
                    }
                });
            }
        } catch (e) {
            console.error("Error parsing data-actions JSON:", e);
        }

        // Handle section transitions
        introSection.classList.remove('visible');
        introSection.classList.add('hidden');
        lightboxSection.classList.remove('hidden');
        lightboxSection.classList.add('visible');

        // Progress bar animation
        progressBarContainer.classList.add('visible');
        progressBarValue.style.transition = 'none';
        progressBarValue.style.transform = 'scaleX(1)';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                progressBarValue.style.transition = `transform ${LIGHTBOX_DURATION_MS / 1000}s linear`;
                progressBarValue.style.transform = 'scaleX(0)';
            });
        });

        // Reset timeout if exists
        if (lightboxTimeout) clearTimeout(lightboxTimeout);

        lightboxTimeout = setTimeout(() => {
            showIntro();
            lightboxTimeout = null;
        }, LIGHTBOX_DURATION_MS);
    };

    // Update card click handler
    projectCards.forEach(card => {
        let touchStartY = 0;
        let touchEndY = 0;
        const MIN_SWIPE = 10;

        const handleCardActivation = (e) => {
            const cardData = {
                title: card.dataset.title || 'No Title',
                description: card.dataset.description || 'No Description Available.',
                image: card.dataset.image || '',
                actions: card.dataset.actions || '[]'
            };

            // Add active state immediately
            card.classList.add('active');

            // Start loading image immediately but don't wait for it
            const img = new Image();
            img.src = cardData.image;

            // Show lightbox immediately
            showLightbox(cardData);

            // Remove active state after animation
            setTimeout(() => {
                card.classList.remove('active');
            }, 200); // Reduced from 300ms to 200ms for snappier feel

            // Update image when it loads
            img.onload = () => {
                const lightboxImg = document.querySelector('#lightboxImageContainer img');
                if (lightboxImg) {
                    lightboxImg.src = cardData.image;
                    lightboxImg.style.opacity = '1';
                }
            };
        };

        // Touch handling
        card.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        card.addEventListener('touchmove', (e) => {
            touchEndY = e.touches[0].clientY;
        }, { passive: true });

        card.addEventListener('touchend', (e) => {
            const swipeDistance = Math.abs(touchEndY - touchStartY);
            if (swipeDistance < MIN_SWIPE) {
                handleCardActivation(e);
            }
        });

        // Desktop click handling
        card.addEventListener('click', handleCardActivation);
    });

    lightboxSection.classList.add('hidden');
    introSection.classList.add('visible');
    progressBarContainer.classList.remove('visible');

});