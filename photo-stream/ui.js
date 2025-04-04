/**
 * Toggles the visibility of the main loading overlay using a CSS class.
 * @param {boolean} show - True to show, false to hide.
 */
export function showLoading(show) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        if (show) {
            loadingScreen.classList.add('visible');
        } else {
            loadingScreen.classList.remove('visible');
        }
    }
}

/**
 * Displays an error message to the user in the designated area.
 * @param {string} message - The error message text.
 */
export function displayError(message) {
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv) {
        // Clear previous timeout if exists
        if (errorDiv.timeoutId) {
            clearTimeout(errorDiv.timeoutId);
        }
        errorDiv.textContent = message;
        errorDiv.style.display = message ? 'block' : 'none'; // Control visibility directly

        // Optional: Auto-clear the error message after some time
        if (message) {
            errorDiv.timeoutId = setTimeout(() => {
                if (errorDiv.textContent === message) { // Only clear if it hasn't changed
                    errorDiv.textContent = '';
                    errorDiv.style.display = 'none';
                }
                delete errorDiv.timeoutId;
            }, 7000); // Clear after 7 seconds
        }
    }
}


/**
 * Clears the main posts container.
 */
export function clearPostsContainer() {
    const postsContainer = document.getElementById('posts-container');
    if (postsContainer) {
        postsContainer.innerHTML = '';
    }
}

/**
 * Appends multiple post elements to the container.
 * @param {Array<HTMLElement|null>} postElements - Array of post card elements (can contain nulls).
 */
export function renderPosts(postElements) {
    const postsContainer = document.getElementById('posts-container');
    if (!postsContainer) return;

    const validElements = postElements.filter(el => el instanceof HTMLElement); // Filter out nulls

    if (validElements.length > 0) {
        const fragment = document.createDocumentFragment();
        validElements.forEach(el => fragment.appendChild(el));
        postsContainer.appendChild(fragment);
        // Ensure "no posts" message is removed if we are adding posts
        const noPostsMsg = postsContainer.querySelector('.no-posts-message');
        if (noPostsMsg) {
            noPostsMsg.remove();
        }
    } else if (postsContainer.children.length === 0) { // Check if container is truly empty *after* filtering
        // Only show "no posts" if the container was empty *before* this render call
        // and we didn't actually add any new valid elements.
        postsContainer.innerHTML = `<p class="no-posts-message">No posts with images found in this feed/list, or it might be empty.</p>`;
    }
}


/**
 * Updates the state and text of the "Load More" button.
 * @param {boolean} isLoading - Is data currently being loaded?
 * @param {boolean} hasMore - Does the API indicate more posts are available?
 */
export function updateLoadMoreButton(isLoading, hasMore) {
    const container = document.getElementById('loadMoreContainer');
    const button = document.getElementById('loadMoreButton');
    if (!container || !button) return;

    // Show container only if there are more posts OR it's currently loading more
    // Hide if not loading AND no more posts available
    container.style.display = hasMore || isLoading ? 'block' : 'none';

    button.disabled = isLoading; // Disable only when loading
    button.textContent = isLoading ? 'Loading...' : 'Load more posts';

    // If loading finished and no more posts, hide container after a short delay
    // to avoid visual glitch if fetch was very fast.
    if (!isLoading && !hasMore) {
        setTimeout(() => {
            // Re-check condition in case state changed rapidly
            if (!button.disabled && !document.getElementById('loadMoreButton')?.classList.contains('has-more')) { // hypothetical class check if needed
                container.style.display = 'none';
            }
        }, 100) // Small delay
    }
}

/**
 * Extracts relevant data from a Bluesky API post object for rendering.
 * @param {object} post - The raw post object from the API.
 * @returns {object|null} Formatted data object or null if invalid.
 */
export function extractPostDataFromApi(post) {
    // Basic validation of input structure
    if (!post || typeof post !== 'object' || !post.author || typeof post.author !== 'object' || !post.record || typeof post.record !== 'object') {
        console.warn("Invalid post structure passed to extractPostDataFromApi:", post);
        return null;
    }

    const author = post.author;
    const record = post.record;
    const embed = post.embed || {};

    // Find images, ensuring arrays exist
    let images = [];
    if (embed.$type === 'app.bsky.embed.images#view' && Array.isArray(embed.images)) {
        images = embed.images;
    } else if (embed.$type === 'app.bsky.embed.recordWithMedia#view' && embed.media && embed.media.$type === 'app.bsky.embed.images#view' && Array.isArray(embed.media.images)) {
        images = embed.media.images;
    }

    // Construct post link
    const postRkey = typeof post.uri === 'string' ? post.uri.split('/').pop() : '';
    const postLink = postRkey && author.handle ? `https://bsky.app/profile/${author.handle}/post/${postRkey}` : '#'; // Fallback link

    const facets = record.facets || []; // Extract facets

    return {
        Author_Handle: author.handle || 'unknown.bsky.social',
        Author_Avatar: author.avatar || 'assets/default-avatar.png',
        Author_DisplayName: author.displayName || author.handle || 'Unknown Author',
        Post_CreatedAt: record.createdAt || post.indexedAt || new Date().toISOString(),
        Media_URLs: images.map(img => img.fullsize).filter(url => typeof url === 'string' && url).join('|'),
        Like_Count: post.likeCount ?? 0,
        Repost_Count: post.repostCount ?? 0,
        Reply_Count: post.replyCount ?? 0,
        Quote_Count: post.quoteCount ?? 0,
        Post_Text: record.text || '',
        Post_Link: postLink,
        Facets: facets,
        Labels: '', // Kept for potential future use, but currently unused
    };
}


/**
 * Creates the HTML element for a single post card.
 * @param {object} postData - Formatted post data from extractPostDataFromApi.
 * @returns {HTMLElement|null} The post card element or null if invalid.
 */
export function createPostElement(postData) {
    // Validate input again, especially Media_URLs
    if (!postData || typeof postData !== 'object' || !postData.Media_URLs || typeof postData.Media_URLs !== 'string') {
        return null;
    }

    const postCard = document.createElement('div');
    postCard.className = 'post-card';

    // --- Header ---
    const header = document.createElement('div');
    header.className = 'post-header';
    header.innerHTML = `
        <div class="author-info" onclick="openAuthorProfile('${postData.Author_Handle ?? ''}')" title="View ${postData.Author_DisplayName ?? 'Profile'} on Bluesky">
            <img src="${postData.Author_Avatar ?? 'assets/default-avatar.png'}" alt="${postData.Author_DisplayName ?? 'Author'}'s avatar" class="author-avatar" onerror="this.onerror=null; this.src='assets/default-avatar.png';">
            <div class="author-details">
                <div class="author-name">${postData.Author_DisplayName ?? 'Unknown Author'}</div>
                <div class="author-handle">@${postData.Author_Handle ?? 'unknown.bsky.social'}</div>
            </div>
        </div>
        <div class="post-time" title="${new Date(postData.Post_CreatedAt ?? Date.now()).toLocaleString()}">${formatTimestamp(postData.Post_CreatedAt)}</div>
    `;
    postCard.appendChild(header);

    // --- Media Carousel ---
    const mediaUrls = postData.Media_URLs.split('|').filter(url => url);
    if (mediaUrls.length > 0) {
        const carousel = createCarousel(mediaUrls); // Call the updated function
        if (carousel) {
            postCard.appendChild(carousel);
        } else {
            console.warn("Post skipped because carousel creation failed or all images failed.");
            // Decide if you want to show the post without images or skip it entirely
            // return null; // Uncomment to skip post if carousel fails
        }
    } else {
        console.warn("Post skipped in createPostElement as it has no media URLs after split.");
        return null; // Skip posts without media
    }

    // --- Actions ---
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'post-actions';
    const leftActionsDiv = document.createElement('div');
    leftActionsDiv.className = 'left-actions';
    const rightActionsDiv = document.createElement('div');
    rightActionsDiv.className = 'right-actions';
    const likeCountFormatted = formatNumber(postData.Like_Count);
    const repostCountFormatted = formatNumber(postData.Repost_Count);
    const replyCountFormatted = formatNumber(postData.Reply_Count);
    leftActionsDiv.innerHTML = `
        <button type="button" class="action-btn" title="Like this post on Bluesky" onclick="window.open('${postData.Post_Link ?? '#'}', '_blank', 'noopener')">
            <i class="ph-duotone ph-heart"></i>
            ${likeCountFormatted ? `<span class="count">${likeCountFormatted}</span>` : ''}
        </button>
        <button type="button" class="action-btn" title="Quote or repost this on Bluesky" onclick="window.open('${postData.Post_Link ?? '#'}', '_blank', 'noopener')">
            <i class="ph-duotone ph-repeat"></i>
            ${repostCountFormatted ? `<span class="count">${repostCountFormatted}</span>` : ''}
        </button>
        <button type="button" class="action-btn" title="Add a comment to this post on Bluesky" onclick="window.open('${postData.Post_Link ?? '#'}', '_blank', 'noopener')">
            <i class="ph-duotone ph-chat-centered"></i>
            ${replyCountFormatted ? `<span class="count">${replyCountFormatted}</span>` : ''}
        </button>
     `;
    rightActionsDiv.innerHTML = `
        <button type="button" class="action-btn copy-link-btn" title="Copy original Bluesky post link" data-link="${postData.Post_Link ?? '#'}">
            <i class="ph-duotone ph-copy-simple"></i>
        </button>
        <button type="button" class="action-btn" title="View original post on Bluesky" onclick="window.open('${postData.Post_Link ?? '#'}', '_blank', 'noopener')">
            <i class="ph-duotone ph-share-fat"></i>
        </button>
     `;
    const copyBtn = rightActionsDiv.querySelector('.copy-link-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const linkToCopy = copyBtn.getAttribute('data-link');
            if (linkToCopy && linkToCopy !== '#') {
                copyToClipboard(linkToCopy, copyBtn);
            }
        });
    }
    actionsDiv.appendChild(leftActionsDiv);
    actionsDiv.appendChild(rightActionsDiv);
    postCard.appendChild(actionsDiv);

    // --- Post text ---
    if (postData.Post_Text) {
        const formattedText = formatPostText(postData.Post_Text, postData.Facets); // Call the updated function
        const textDiv = document.createElement('div');
        textDiv.className = 'post-text';
        textDiv.innerHTML = formattedText;
        postCard.appendChild(textDiv);
    }

    // --- Add Comments and Quotes Links with PLURALIZATION ---
    const footerLinksContainer = document.createElement('div');
    footerLinksContainer.className = 'post-footer-links';
    let linksAdded = false;

    // Comments link
    const replyCount = parseInt(postData.Reply_Count);
    if (!isNaN(replyCount) && replyCount > 0) {
        const commentsDiv = document.createElement('div');
        commentsDiv.className = 'comments-link';
        const commentText = replyCount === 1 ? 'comment' : 'comments';
        commentsDiv.textContent = `View ${replyCount === 1 ? 'one' : `${formatNumber(replyCount)}`} ${commentText}`;
        commentsDiv.style.cursor = 'pointer';
        commentsDiv.setAttribute('role', 'link');
        commentsDiv.tabIndex = 0;
        const openCommentsLink = () => window.open(postData.Post_Link ?? '#', '_blank', 'noopener');
        commentsDiv.onclick = (e) => { e.stopPropagation(); openCommentsLink(); };
        commentsDiv.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openCommentsLink(); }
        };
        footerLinksContainer.appendChild(commentsDiv);
        linksAdded = true;
    }

    // Quotes link
    const quoteCount = parseInt(postData.Quote_Count);
    if (!isNaN(quoteCount) && quoteCount > 0) {
        const quotesDiv = document.createElement('div');
        quotesDiv.className = 'quotes-link comments-link'; // Reuse styling
        const quoteText = quoteCount === 1 ? 'quote' : 'quotes';
        quotesDiv.textContent = `View ${quoteCount === 1 ? 'one' : `${formatNumber(quoteCount)}`} ${quoteText}`;
        quotesDiv.style.cursor = 'pointer';
        quotesDiv.setAttribute('role', 'link');
        quotesDiv.tabIndex = 0;
        if (linksAdded) {
            quotesDiv.style.marginTop = '0px'; // Adjust if needed based on styling
        }
        const openQuotesLink = () => window.open(`${postData.Post_Link}/quotes`, '_blank', 'noopener');
        quotesDiv.onclick = (e) => { e.stopPropagation(); openQuotesLink(); };
        quotesDiv.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); openQuotesLink(); }
        };
        footerLinksContainer.appendChild(quotesDiv);
        linksAdded = true;
    }

    // Append the container only if it has links
    if (linksAdded) {
        postCard.appendChild(footerLinksContainer);
    }


    // Expose profile link helper globally if not already done
    if (typeof window.openAuthorProfile !== 'function') {
        window.openAuthorProfile = openAuthorProfile;
    }

    return postCard;
}


// --- Utility Functions ---


/**
 * Creates the HTML element for a post's image carousel.
 * Adapts height based on the first image and fits subsequent images.
 * @param {string[]} images - Array of image URLs.
 * @returns {HTMLElement|null} The carousel element or null if no valid images.
 */
function createCarousel(images) {
    const carousel = document.createElement('div');
    carousel.classList.add('carousel');
    const inner = document.createElement('div');
    inner.classList.add('carousel-inner');
    carousel.appendChild(inner);
    let visibleImageCount = 0;
    let firstImageLoaded = false; // Flag for first image

    let resizeTimeout; // For debouncing resize events

    images.forEach((image, index) => {
        const item = document.createElement('div');
        item.classList.add('carousel-item');
        item.style.display = 'flex'; // Keep as flex initially

        const img = document.createElement('img');
        img.src = image;
        img.alt = `Post image ${index + 1}`;
        img.loading = "lazy";

        img.onclick = (e) => {
            e.stopPropagation();
            window.open(image, '_blank', 'noopener');
        };

        // Define handler function to avoid repetition
        const handleImageLoadOrError = () => {
            // Check if the image actually loaded (naturalWidth > 0)
            const loadedSuccessfully = img.complete && typeof img.naturalWidth !== "undefined" && img.naturalWidth > 0;

            // Only calculate height based on the *first* image that loads successfully
            if (index === 0 && !firstImageLoaded && loadedSuccessfully) {
                firstImageLoaded = true;
                setCarouselHeight(carousel, img); // Call new function to set height
            }

            // Common logic for all images
            if (!loadedSuccessfully) {
                console.warn("Failed to load image or image is invalid:", image);
                item.style.display = 'none'; // Hide item if image fails/is invalid
            } else {
                visibleImageCount++; // Increment only for successfully loaded images
            }

            // Update nav visibility after *any* image attempt (load or fail)
            updateCarouselNavVisibility(carousel);
        };

        img.onload = handleImageLoadOrError;
        img.onerror = handleImageLoadOrError; // Treat error similarly for layout/visibility

        item.appendChild(img);
        inner.appendChild(item);

        // Attempt to trigger for cached images immediately after adding to DOM
        if (img.complete) {
            handleImageLoadOrError();
        }
    });


    // Initial check for visible images (some might have failed synchronously or from cache)
    visibleImageCount = Array.from(inner.children).filter(item => item.style.display !== 'none').length;


    if (images.length > 1) { // Only add nav and controls if multiple images intended
        const nav = document.createElement('div');
        nav.classList.add('carousel-nav');
        carousel.appendChild(nav);

        // Initially hide nav if only one or zero images are visible
        if (visibleImageCount <= 1) {
            nav.style.display = 'none';
        }

        let currentVisibleIndex = 0; // Index among VISIBLE items

        const updateNav = () => {
            const visibleItems = Array.from(inner.children).filter(item => item.style.display !== 'none');
            nav.innerHTML = ''; // Clear dots
            if (visibleItems.length <= 1) {
                nav.style.display = 'none'; // Hide nav if only 1 or 0 items are visible
                return;
            }
            nav.style.display = 'flex'; // Show nav if more than 1 item visible
            visibleItems.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.classList.add('carousel-dot');
                if (i === currentVisibleIndex) dot.classList.add('active');
                dot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentVisibleIndex = i; // Set index based on visible items
                    updateSlide();
                    updateNav(); // Update dot styles
                });
                nav.appendChild(dot);
            });
        };

        const updateSlide = () => {
            const firstVisibleItem = inner.querySelector('.carousel-item:not([style*="display: none"])');
            if (!firstVisibleItem) return; // No visible items
            const width = firstVisibleItem.offsetWidth;
            if (width === 0) return; // Avoid issues if not rendered yet
            // Transform based on the index within the *visible* items
            inner.style.transform = `translateX(-${width * currentVisibleIndex}px)`;
        };

        // Resize Listener to recalculate height and slide position
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const firstImgEl = carousel.querySelector('.carousel-item:not([style*="display: none"]) img');
                // Only recalculate if the first image is still valid and loaded
                if (firstImgEl && firstImgEl.complete && firstImgEl.naturalWidth > 0) {
                    setCarouselHeight(carousel, firstImgEl); // Recalculate height based on new width
                    // Recalculate currentVisibleIndex in case items became hidden/visible? (More complex)
                    // For simplicity, assume visible items don't change on resize, just update position
                    updateSlide(); // Update slide position after height potentially changed
                } else {
                    // Fallback if first image is gone or invalid
                    carousel.style.height = 'auto'; // Let CSS min/max handle it
                    updateSlide();
                }
            }, 150); // Debounce delay
        };
        window.addEventListener('resize', handleResize);

        // Store handler reference for potential cleanup later (optional)
        carousel._resizeHandler = handleResize;


        // Initial setup after images are added and potentially loaded from cache
        // Use timeout to allow initial rendering and potential sync loads
        setTimeout(() => {
            updateNav();
            updateSlide();
        }, 0);


        // Touch controls
        let startX = null;
        let currentX = null;
        let itemWidth = 0; // Store width during touch start

        const handleTouchStart = (e) => {
            const visibleItems = inner.querySelectorAll('.carousel-item:not([style*="display: none"])');
            if (visibleItems.length <= 1) return; // No swipe if <= 1 item
            const firstVisibleItem = visibleItems[0];
            if (!firstVisibleItem) return;
            itemWidth = firstVisibleItem.offsetWidth; // Get width at start
            if (itemWidth === 0) return; // Not ready
            startX = e.touches[0].clientX;
            currentX = startX;
            inner.style.transition = 'none'; // Disable transition during swipe for smooth dragging
        };

        const handleTouchMove = (e) => {
            if (startX === null || itemWidth === 0) return; // Exit if not touching or width not set
            currentX = e.touches[0].clientX;
            const diff = startX - currentX;
            // Calculate current offset and apply drag difference
            const currentTransformOffset = -itemWidth * currentVisibleIndex;
            inner.style.transform = `translateX(${currentTransformOffset - diff}px)`;
        };

        const handleTouchEnd = () => {
            const visibleItems = inner.querySelectorAll('.carousel-item:not([style*="display: none"])');
            if (startX === null || itemWidth === 0 || visibleItems.length <= 1) {
                inner.style.transition = 'transform 0.3s ease'; // Restore transition even if swipe fails
                startX = null;
                currentX = null;
                itemWidth = 0;
                updateSlide(); // Snap back if needed
                return;
            }

            inner.style.transition = 'transform 0.3s ease'; // Re-enable smooth transition

            const diff = startX - currentX;
            const threshold = itemWidth / 4; // Threshold relative to item width (e.g., 25%)

            // Determine direction and update index if threshold met
            if (Math.abs(diff) > threshold) {
                if (diff > 0 && currentVisibleIndex < visibleItems.length - 1) { // Swipe left
                    currentVisibleIndex++;
                } else if (diff < 0 && currentVisibleIndex > 0) { // Swipe right
                    currentVisibleIndex--;
                }
            }

            // Reset touch state variables
            startX = null;
            currentX = null;
            itemWidth = 0;

            // Snap to the new (or same) slide position and update navigation dots
            updateSlide();
            updateNav();
        };

        // Add touch event listeners
        inner.addEventListener('touchstart', handleTouchStart, { passive: true });
        inner.addEventListener('touchmove', handleTouchMove, { passive: true });
        inner.addEventListener('touchend', handleTouchEnd);
        inner.addEventListener('touchcancel', handleTouchEnd); // Handle cancellation same as end

    } else if (visibleImageCount === 0 && images.length > 0) {
        // All images failed to load or were invalid
        carousel.style.display = 'none'; // Hide the broken carousel container
        return null; // Indicate failure
    } else if (images.length === 0) {
        // No images were provided in the first place
        return null;
    }
    // If only one image, ensure its height is set if it loaded
    else if (images.length === 1 && visibleImageCount === 1 && !firstImageLoaded) {
        // This handles the case where the single image loaded from cache *before* the main loop ran its handler
        const firstImgEl = carousel.querySelector('.carousel-item:not([style*="display: none"]) img');
        if (firstImgEl && firstImgEl.complete && firstImgEl.naturalWidth > 0) {
            firstImageLoaded = true;
            setCarouselHeight(carousel, firstImgEl);
        }
    }

    return carousel; // Return the constructed carousel element
}


/**
 * Sets the height of the carousel container based on the first image's aspect ratio.
 * Respects the CSS min-height and max-height properties.
 * @param {HTMLElement} carouselElement - The .carousel container div.
 * @param {HTMLImageElement} firstImageElement - The first successfully loaded image element.
 */
function setCarouselHeight(carouselElement, firstImageElement) {
    if (!carouselElement || !firstImageElement || !firstImageElement.naturalWidth || !firstImageElement.naturalHeight) {
        carouselElement.style.height = 'auto'; // Fallback to CSS default/min/max
        return;
    }

    // Get container width *after* potential rendering updates
    const containerWidth = carouselElement.offsetWidth;
    if (containerWidth <= 0) {
        // Not rendered yet, maybe try again slightly later or rely on CSS?
        // For now, let CSS handle it via 'auto' height initially.
        carouselElement.style.height = 'auto';
        // Optionally: schedule a retry?
        // setTimeout(() => setCarouselHeight(carouselElement, firstImageElement), 50);
        return;
    }

    // Get min/max height constraints from CSS
    const computedStyle = window.getComputedStyle(carouselElement);
    const maxHeightValue = computedStyle.maxHeight;
    const minHeightValue = computedStyle.minHeight;
    let maxHeightPx = Infinity; // Default to no max limit unless specified
    let minHeightPx = 0;        // Default to no min limit unless specified

    if (maxHeightValue && maxHeightValue !== 'none' && maxHeightValue.endsWith('px')) {
        maxHeightPx = parseFloat(maxHeightValue) || Infinity;
    }
    // Add handling for vh if needed: else if (maxHeightValue.endsWith('vh')) maxHeightPx = (parseFloat(maxHeightValue) / 100) * window.innerHeight;

    if (minHeightValue && minHeightValue !== 'none' && minHeightValue.endsWith('px')) {
        minHeightPx = parseFloat(minHeightValue) || 0;
    }
    // Add handling for vh if needed: else if (minHeightValue.endsWith('vh')) minHeightPx = (parseFloat(minHeightValue) / 100) * window.innerHeight;


    const imageAspectRatio = firstImageElement.naturalHeight / firstImageElement.naturalWidth;
    let calculatedHeight = containerWidth * imageAspectRatio;

    // Clamp the height between min and max
    calculatedHeight = Math.max(minHeightPx, Math.min(calculatedHeight, maxHeightPx));

    // Apply the calculated height
    carouselElement.style.height = `${calculatedHeight}px`;
}


// Helper to update nav visibility based on loaded images
function updateCarouselNavVisibility(carouselElement) {
    const inner = carouselElement.querySelector('.carousel-inner');
    const nav = carouselElement.querySelector('.carousel-nav');
    if (!inner || !nav) return; // Only proceed if nav exists

    // Count items that are *not* explicitly hidden due to load errors
    const visibleItems = inner.querySelectorAll('.carousel-item:not([style*="display: none"])');

    // Show nav only if there's more than one potentially visible image
    nav.style.display = visibleItems.length > 1 ? 'flex' : 'none';
}


// formatTimestamp
function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            console.warn("Invalid date for timestamp:", timestamp);
            return '';
        }
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        const weeks = Math.floor(days / 7);

        if (seconds < 60) return `now`;
        if (minutes < 60) return `${minutes}m`;
        if (hours < 24) return `${hours}h`;
        if (days < 7) return `${days}d`;
        return `${weeks}w`;

    } catch (e) {
        console.error("Error formatting timestamp:", timestamp, e);
        return '';
    }
}

// formatNumber
function formatNumber(numInput) {
    try {
        const num = parseInt(numInput);
        if (isNaN(num) || num === 0) return '';
        if (num < 1000) return num.toString();
        if (num < 1000000) {
            const thousands = num / 1000;
            return thousands.toFixed(thousands % 1 !== 0 ? 1 : 0) + 'K';
        }
        const millions = num / 1000000;
        return millions.toFixed(millions % 1 !== 0 ? 1 : 0) + 'M';
    } catch (e) {
        console.error("Error formatting number:", numInput, e);
        return '';
    }
}

// formatPostText with facet handling
function formatPostText(text, facets) {
    if (!text) return '';
    if (!facets || facets.length === 0) {
        // Basic formatting if no facets: escape HTML and replace newlines
        return escapeHtml(text).replace(/\n/g, '<br>');
    }

    // Use TextEncoder/Decoder for accurate byte indexing as required by facets
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const textBytes = encoder.encode(text);

    // Sort facets by starting byte index to process them in order
    const sortedFacets = facets.slice().sort((a, b) => a.index.byteStart - b.index.byteStart);

    let htmlResult = '';
    let currentByteIndex = 0;

    for (const facet of sortedFacets) {
        // Validate facet byte range
        if (!facet.index || typeof facet.index.byteStart !== 'number' || typeof facet.index.byteEnd !== 'number' ||
            facet.index.byteStart < currentByteIndex || facet.index.byteEnd > textBytes.length || facet.index.byteStart >= facet.index.byteEnd) {
            console.warn("Skipping invalid or overlapping facet:", facet);
            continue; // Skip this facet
        }

        // Add text segment before the current facet
        if (facet.index.byteStart > currentByteIndex) {
            const textSegmentBytes = textBytes.slice(currentByteIndex, facet.index.byteStart);
            htmlResult += escapeHtml(decoder.decode(textSegmentBytes));
        }

        // Get the text segment covered by the facet
        const facetTextBytes = textBytes.slice(facet.index.byteStart, facet.index.byteEnd);
        const facetText = escapeHtml(decoder.decode(facetTextBytes)); // Escape the text itself

        let linkCreated = false;
        if (Array.isArray(facet.features)) {
            for (const feature of facet.features) {
                const type = feature?.$type;
                try {
                    if (type === 'app.bsky.richtext.facet#link' && feature.uri) {
                        // Ensure URI is a valid URL before creating link
                        new URL(feature.uri); // Throws error if invalid
                        const displayUri = feature.uri.length > 50 ? escapeHtml(feature.uri.substring(0, 47)) + '...' : escapeHtml(feature.uri);
                        htmlResult += `<a href="${escapeHtml(feature.uri)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" title="${escapeHtml(feature.uri)}">${facetText}</a>`;
                        linkCreated = true;
                        break; // Only apply the first valid link feature
                    } else if (type === 'app.bsky.richtext.facet#mention' && feature.did && feature.did.startsWith('did:')) {
                        // ** FIX HERE: Do NOT encodeURIComponent the DID for the href path **
                        htmlResult += `<a href="https://bsky.app/profile/${feature.did}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" title="View profile @${escapeHtml(decoder.decode(facetTextBytes)).substring(1)}">${facetText}</a>`;
                        linkCreated = true;
                        break;
                    } else if (type === 'app.bsky.richtext.facet#tag' && feature.tag) {
                        // Basic validation for tag (e.g., not empty)
                        if (feature.tag.trim()) {
                            // Encode the tag itself for the URL path, as tags can contain special chars
                            htmlResult += `<a href="https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" title="Search hashtag #${escapeHtml(feature.tag)}">${facetText}</a>`;
                            linkCreated = true;
                            break;
                        }
                    }
                } catch (e) {
                    console.warn("Skipping facet feature due to invalid data (e.g., bad URI):", feature, e);
                    // If URI was invalid, don't create a broken link
                    linkCreated = false; // Ensure linkCreated is false if validation fails
                }
            }
        }

        // If no link was created for this facet, add the plain (escaped) text
        if (!linkCreated) {
            htmlResult += facetText;
        }

        // Move the current index past this facet
        currentByteIndex = facet.index.byteEnd;
    }

    // Add any remaining text after the last facet
    if (currentByteIndex < textBytes.length) {
        const remainingBytes = textBytes.slice(currentByteIndex);
        htmlResult += escapeHtml(decoder.decode(remainingBytes));
    }

    // Replace newlines with <br> tags for final HTML output
    return htmlResult.replace(/\n/g, '<br>');
}

// escapeHtml helper
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}


// openAuthorProfile
function openAuthorProfile(handle) {
    if (handle && typeof handle === 'string') {
        // Basic handle validation could be added here if needed
        window.open(`https://bsky.app/profile/${encodeURIComponent(handle)}`, '_blank', 'noopener');
    }
}
// Make globally accessible if not already done by createPostElement
if (typeof window.openAuthorProfile !== 'function') {
    window.openAuthorProfile = openAuthorProfile;
}


// copyToClipboard
async function copyToClipboard(text, buttonElement = null) {
    if (!text || typeof text !== 'string') return;

    let success = false;
    let feedbackMessage = 'Bluesky link copied to clipboard.';

    // Use modern Clipboard API if available and in secure context
    if (navigator.clipboard && window.isSecureContext) {
        try {
            await navigator.clipboard.writeText(text);
            success = true;
        } catch (err) {
            console.error('Clipboard API write failed:', err);
            feedbackMessage = 'Failed to copy link automatically.';
            success = false; // Ensure success is false on error
            // Fallback might be attempted below, or just show error
        }
    }

    // Fallback for older browsers or non-secure contexts
    if (!success) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        // Make it non-editable and off-screen
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        try {
            textArea.select();
            // execCommand is deprecated but needed for fallback
            success = document.execCommand('copy');
            if (!success) {
                feedbackMessage = 'Fallback copy command failed. Please copy manually.';
            }
        } catch (err) {
            console.error('Fallback copy execCommand failed:', err);
            feedbackMessage = 'Failed to copy link using fallback.';
            success = false;
        } finally {
            document.body.removeChild(textArea);
        }
    }

    // Provide user feedback
    if (buttonElement instanceof HTMLElement) {
        const originalIconHTML = buttonElement.innerHTML; // Store original content
        const originalTitle = buttonElement.title;
        buttonElement.disabled = true; // Disable button during feedback

        if (success) {
            // Show success icon and message
            buttonElement.innerHTML = '<i class="ph-duotone ph-check-circle" style="color: lightgreen; font-size: inherit;"></i>';
            buttonElement.title = 'Copied!';
        } else {
            // Optionally show a failure icon/state (e.g., red X) or just revert quickly
            // For simplicity, we'll just revert after timeout even on failure
            buttonElement.title = 'Copy failed'; // Indicate failure briefly
        }

        // Revert button state after a delay
        setTimeout(() => {
            // Check if the button hasn't been changed again in the meantime
            if (buttonElement.innerHTML.includes('ph-check') || buttonElement.title === 'Copied!' || buttonElement.title === 'Copy failed') {
                buttonElement.innerHTML = originalIconHTML;
                buttonElement.title = originalTitle; // Restore original title
            }
            buttonElement.disabled = false; // Re-enable button
        }, 1500); // Duration of feedback
    } else {
        // Fallback alert if no button element provided
        alert(feedbackMessage);
    }
}


// Modal UI Functions
export function showConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) {
        const urlInput = document.getElementById('bskyUrlInput');
        const persistedUrl = localStorage.getItem('photostream_custom_url');
        if (urlInput && persistedUrl) {
            urlInput.value = persistedUrl; // Pre-fill with saved URL
        } else if (urlInput) {
            urlInput.value = ''; // Clear if no saved URL
        }
        modal.classList.add('visible'); // Make modal visible
        if (urlInput) urlInput.focus(); // Focus input field
    }
}

export function hideConfigModal() {
    const modal = document.getElementById('configModal');
    if (modal) {
        modal.classList.remove('visible'); // Hide modal
    }
}


// Header UI Functions
export function updateActiveFeedButton(activeUrl) {
    const predefinedFeedButtons = document.querySelectorAll('#main-header .predefined-feeds button');
    predefinedFeedButtons.forEach(button => {
        // Use optional chaining and trim for robustness
        if (activeUrl && button.getAttribute('data-url')?.trim() === activeUrl.trim()) {
            button.classList.add('active-feed');
        } else {
            button.classList.remove('active-feed');
        }
    });
}


// Theme Handling
export function updateThemeIcon(isLight) {
    const themeToggle = document.getElementById('theme-toggle');
    const icon = themeToggle?.querySelector('i'); // Use optional chaining
    if (!icon) return;

    // More robust class switching
    const currentIcon = isLight ? 'ph-sun-dim' : 'ph-moon';
    const newIcon = isLight ? 'ph-moon' : 'ph-sun-dim';

    if (icon.classList.contains(currentIcon)) {
        icon.classList.remove(currentIcon);
    }
    if (!icon.classList.contains(newIcon)) {
        icon.classList.add(newIcon);
    }

    themeToggle.title = isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme';
}

export function toggleTheme() {
    const body = document.body;
    const isCurrentlyLight = body.classList.contains('light-theme');

    // Toggle the class
    body.classList.toggle('light-theme');

    // Update localStorage based on the *new* state
    if (!isCurrentlyLight) { // Means it's now light
        localStorage.setItem('theme', 'light');
        updateThemeIcon(true);
    } else { // Means it's now dark
        localStorage.removeItem('theme'); // Or set to 'dark' explicitly: localStorage.setItem('theme', 'dark');
        updateThemeIcon(false);
    }
}

export function applyInitialTheme() {
    const storedTheme = localStorage.getItem('theme');
    let isLight;

    if (storedTheme === 'light') {
        isLight = true;
    } else if (storedTheme === 'dark') {
        isLight = false;
    } else {
        // No stored theme, check system preference
        isLight = window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    // Apply the theme class if needed
    if (isLight) {
        document.body.classList.add('light-theme');
    } else {
        document.body.classList.remove('light-theme');
    }

    // Update the toggle icon to match the initial theme
    updateThemeIcon(isLight);
}