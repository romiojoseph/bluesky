// --- START OF FILE ui.js ---

// --- Loading & Error ---

/**
 * Shows or hides the loading screen overlay.
 * @param {boolean} show - True to show, false to hide.
 */
export function showLoading(show) {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.style.display = show ? 'flex' : 'none';
    }
}

/**
 * Displays an error message in the designated area.
 * @param {string} message - The error message text.
 */
export function displayError(message) {
    const errorContainer = document.getElementById('errorMessageContainer');
    const errorDiv = document.getElementById('errorMessage');
    if (errorDiv && errorContainer) {
        if (errorDiv.timeoutId) {
            clearTimeout(errorDiv.timeoutId);
        }
        errorDiv.textContent = message;
        errorContainer.style.display = message ? 'block' : 'none'; // Show/hide container
        errorDiv.style.display = message ? 'block' : 'none'; // Show/hide message div itself

        if (message) {
            errorDiv.timeoutId = setTimeout(() => {
                if (errorDiv.textContent === message) {
                    errorDiv.textContent = '';
                    errorDiv.style.display = 'none';
                    errorContainer.style.display = 'none';
                }
                delete errorDiv.timeoutId;
            }, 7000); // Auto-clear after 7 seconds
        }
    }
}

// --- Feed Tabs & Info ---

/**
 * Creates the feed selection tabs based on the configuration.
 * @param {object} feedsConfig - The configuration object mapping feed names to details.
 * @param {string} currentFeedName - The name of the initially active feed.
 * @param {function} switchFeedCallback - The function to call when a tab is clicked.
 */
export function createTabs(feedsConfig, currentFeedName, switchFeedCallback) {
    const tabsContainer = document.getElementById('feedTabs');
    if (!tabsContainer) return;
    tabsContainer.innerHTML = ''; // Clear existing tabs

    Object.keys(feedsConfig).forEach(feedName => {
        const tab = document.createElement('button');
        tab.className = `tab ${feedName === currentFeedName ? 'active' : ''}`;
        // Use the display name from config for the tab text
        tab.textContent = feedsConfig[feedName].displayName;
        tab.addEventListener('click', () => switchFeedCallback(feedName));
        tabsContainer.appendChild(tab);
    });
}

/**
 * Updates the visual state of the tabs to show the active one.
 * @param {string} activeFeedName - The name of the feed that should be marked active.
 */
export function updateActiveTab(activeFeedName, feedsConfig) {
    const tabs = document.querySelectorAll('#feedTabs .tab');
    tabs.forEach(tab => {
        // Match tab text content (display name) with the display name from config
        const isActive = feedsConfig[activeFeedName] && tab.textContent === feedsConfig[activeFeedName].displayName;
        tab.classList.toggle('active', isActive);
    });
}

// Removed updateFeedInfo function


// --- Post Rendering ---

/**
 * Clears the main posts container.
 */
export function clearPostsContainer() {
    const postsContainer = document.getElementById('cardContainer');
    if (postsContainer) {
        postsContainer.innerHTML = '';
    }
    // Also clear any previous error messages when clearing posts
    displayError('');
}

/**
 * Appends multiple post card elements to the container.
 * @param {Array<HTMLElement|null>} postElements - Array of post card elements.
 */
export function renderPosts(postElements) {
    const postsContainer = document.getElementById('cardContainer');
    if (!postsContainer) return;

    const validElements = postElements.filter(el => el instanceof HTMLElement);

    if (validElements.length > 0) {
        const fragment = document.createDocumentFragment();
        validElements.forEach(el => fragment.appendChild(el));
        postsContainer.appendChild(fragment);
        // Ensure "no posts" message is removed if we are adding posts
        const noPostsMsg = postsContainer.querySelector('.no-posts-message');
        if (noPostsMsg) {
            noPostsMsg.remove();
        }
    } else if (postsContainer.children.length === 0) {
        // Show message only if container is empty and no valid posts were added
        if (!document.body.classList.contains('initial-load')) { // Assuming we add/remove this class
            postsContainer.innerHTML = `<p class="no-posts-message">No posts found in this feed/list, or they were filtered out (e.g., reposts, replies, quotes, videos).</p>`;
        }
    }
    document.body.classList.remove('initial-load'); // Remove flag after first render attempt
}


/**
 * Extracts and formats data from a Bluesky API post object.
 * Now includes like, repost, reply, and quote counts.
 * @param {object} post - The raw post object from the API.
 * @returns {object|null} Formatted data object or null if invalid.
 */
export function extractPostDataFromApi(post) {
    // Added detailed check for necessary fields
    if (!post?.uri || !post?.author?.did || !post?.author?.handle || !post?.record?.createdAt) {
        console.warn("Invalid post structure for extraction:", post);
        return null;
    }

    const author = post.author;
    const record = post.record;
    const embed = post.embed; // May be undefined

    // Extract images
    let images = [];
    if (embed?.$type === 'app.bsky.embed.images#view' && Array.isArray(embed.images)) {
        images = embed.images;
    } else if (embed?.$type === 'app.bsky.embed.recordWithMedia#view' && embed.media?.$type === 'app.bsky.embed.images#view' && Array.isArray(embed.media.images)) {
        images = embed.media.images;
    }

    // Extract external link embed details
    let externalEmbed = null;
    if (embed?.$type === 'app.bsky.embed.external#view' && embed.external) {
        externalEmbed = {
            uri: embed.external.uri,
            title: embed.external.title,
            description: embed.external.description,
            thumb: embed.external.thumb
        };
    }

    const facets = record.facets || [];
    const postLink = `https://bsky.app/profile/${author.handle}/post/${post.uri.split('/').pop()}`;
    const postQuotesLink = `${postLink}/quotes`; // Link for quotes

    return {
        Author_Handle: author.handle,
        Author_Avatar: author.avatar || './assets/default-avatar.png',
        Author_DisplayName: author.displayName || author.handle,
        Author_DID: author.did,
        Post_CreatedAt: record.createdAt || post.indexedAt || new Date().toISOString(),
        Post_Text: record.text || '',
        Post_Link: postLink,
        Post_Quotes_Link: postQuotesLink, // Added link for quotes page
        Post_Uri: post.uri,
        Facets: facets,
        Media_URLs: images.map(img => img.fullsize).filter(Boolean),
        Embed_External: externalEmbed,
        Like_Count: post.likeCount ?? 0,       // Extract count
        Repost_Count: post.repostCount ?? 0,   // Extract count
        Reply_Count: post.replyCount ?? 0,     // Extract count
        Quote_Count: post.quoteCount ?? 0,     // Extract count
        _originalPostData: post
    };
}


/**
 * Creates the HTML element for a single post card with the updated layout.
 * @param {object} postData - Formatted post data from extractPostDataFromApi.
 * @returns {HTMLElement|null} The post card element or null if invalid.
 */
export function createPostElement(postData) {
    if (!postData) return null;

    const card = document.createElement('div');
    card.className = 'card';

    // --- Header (Modified) ---
    const cardHeader = document.createElement('div');
    cardHeader.className = 'card-header'; // Keep existing class for potential base styles

    const avatarImg = document.createElement('img');
    avatarImg.src = postData.Author_Avatar;
    avatarImg.alt = `${escapeHtml(postData.Author_DisplayName)}'s avatar`;
    avatarImg.className = 'avatar';
    avatarImg.onerror = function () { this.onerror = null; this.src = './assets/default-avatar.png'; };
    avatarImg.onclick = (e) => { // Make avatar clickable too
        e.stopPropagation();
        window.open(`https://bsky.app/profile/${postData.Author_Handle}`, '_blank', 'noopener');
    };
    avatarImg.style.cursor = 'pointer'; // Indicate clickable avatar

    const headerInfo = document.createElement('div');
    headerInfo.className = 'header-info'; // New class for right side of header

    // Combined Display Name and Handle link
    const profileLink = document.createElement('a');
    profileLink.href = `https://bsky.app/profile/${postData.Author_Handle}`;
    profileLink.target = '_blank';
    profileLink.rel = 'noopener';
    profileLink.className = 'user-profile-link'; // New class for the combined link
    profileLink.title = `View @${escapeHtml(postData.Author_Handle)} on Bluesky`;
    profileLink.onclick = (e) => e.stopPropagation(); // Prevent card click

    const displayNameSpan = document.createElement('span');
    displayNameSpan.className = 'display-name'; // Keep specific class
    displayNameSpan.textContent = postData.Author_DisplayName;

    const handleSpan = document.createElement('span');
    handleSpan.className = 'handle'; // New class for handle
    handleSpan.textContent = `@${postData.Author_Handle}`;

    profileLink.appendChild(displayNameSpan);
    profileLink.appendChild(handleSpan); // Add handle right after display name

    // Meta details (Timestamp, Likes, Reposts) below the name/handle
    const metaDetailsDiv = document.createElement('div');
    metaDetailsDiv.className = 'post-meta-details'; // Keep class for styling
    // Set the tooltip on the main div now
    metaDetailsDiv.title = new Date(postData.Post_CreatedAt).toLocaleString();

    const likeCount = postData.Like_Count;
    const repostCount = postData.Repost_Count;

    // --- Build the combined meta string ---
    let metaParts = [];

    // 1. Always add the timestamp
    metaParts.push(formatTimestamp(postData.Post_CreatedAt));

    // 2. Prepare Likes string (if applicable)
    let likesString = '';
    if (likeCount > 0) {
        likesString = `${formatCount(likeCount)} ${pluralize(likeCount, 'like', 'likes')}`;
    }

    // 3. Prepare Reposts string (if applicable)
    let repostsString = '';
    if (repostCount > 0) {
        repostsString = `${formatCount(repostCount)} ${pluralize(repostCount, 'repost', 'reposts')}`;
    }

    // 4. Combine Likes and Reposts with '&' if both exist
    let engagementString = '';
    if (likesString && repostsString) {
        engagementString = `${likesString} & ${repostsString}`;
    } else if (likesString) {
        engagementString = likesString; // Only likes
    } else if (repostsString) {
        engagementString = repostsString; // Only reposts
    }
    // Note: If both counts are 0, engagementString remains empty

    // 5. Add the engagement part with the '•' separator IF there is engagement info
    if (engagementString) {
        metaParts.push('•'); // Add the dot separator explicitly
        metaParts.push(engagementString);
    }
    // --- End building meta string ---

    // Set the final text content, joining parts with a space
    metaDetailsDiv.textContent = metaParts.join(' ');

    // --- Append elements to the DOM ---
    headerInfo.appendChild(profileLink);
    headerInfo.appendChild(metaDetailsDiv); // Append the single div containing the combined string

    cardHeader.appendChild(avatarImg);
    cardHeader.appendChild(headerInfo);
    card.appendChild(cardHeader);


    // --- Content (Remains Largely the Same) ---
    const cardContent = document.createElement('div');
    cardContent.className = 'card-content';

    if (postData.Post_Text) {
        const textDiv = document.createElement('div');
        textDiv.className = 'post-text';
        textDiv.innerHTML = formatPostText(postData.Post_Text, postData.Facets);
        cardContent.appendChild(textDiv);
    }

    // Media Carousel
    if (postData.Media_URLs && postData.Media_URLs.length > 0) {
        const mediaContainer = document.createElement('div');
        mediaContainer.className = 'media-container has-media';
        const carouselElement = createCarousel(postData.Media_URLs);
        if (carouselElement) {
            mediaContainer.appendChild(carouselElement);
            cardContent.appendChild(mediaContainer);
        }
    }

    // External Link Embed
    if (postData.Embed_External) {
        const embed = postData.Embed_External;
        const embedLink = document.createElement('a');
        embedLink.href = embed.uri;
        embedLink.target = '_blank';
        embedLink.rel = 'noopener noreferrer';
        embedLink.className = 'embed-link';
        embedLink.onclick = (e) => e.stopPropagation();

        const embedDiv = document.createElement('div');
        embedDiv.className = 'post-embed';

        if (embed.thumb) {
            const thumbImg = document.createElement('img');
            thumbImg.src = embed.thumb;
            thumbImg.alt = 'Embed Thumbnail';
            thumbImg.className = 'embed-thumb';
            thumbImg.onerror = (e) => { e.target.style.display = 'none'; };
            embedDiv.appendChild(thumbImg);
        }

        const embedTextDiv = document.createElement('div');
        embedTextDiv.className = 'embed-text';
        if (embed.title) {
            const titleP = document.createElement('p');
            titleP.className = 'embed-title';
            titleP.textContent = embed.title;
            embedTextDiv.appendChild(titleP);
        }
        if (embed.description) {
            const descP = document.createElement('p');
            descP.className = 'embed-description';
            descP.textContent = embed.description;
            embedTextDiv.appendChild(descP);
        }
        embedDiv.appendChild(embedTextDiv);
        embedLink.appendChild(embedDiv);
        cardContent.appendChild(embedLink);
    }

    card.appendChild(cardContent);

    // --- Footer Actions (Modified Layout and Content) ---
    const cardFooter = document.createElement('div');
    cardFooter.className = 'card-footer'; // Main footer container class

    const postActions = document.createElement('div');
    postActions.className = 'post-actions'; // Flex container for actions

    const leftActions = document.createElement('div');
    leftActions.className = 'footer-left-actions'; // Container for left actions

    const rightActions = document.createElement('div');
    rightActions.className = 'footer-right-actions'; // Container for right actions

    // Left Actions: Comments and Quotes OR "No interactions" text
    const replyCount = postData.Reply_Count;
    const quoteCount = postData.Quote_Count;

    if (replyCount === 0 && quoteCount === 0) {
        // Show "No interactions yet" text
        const noInteractionsText = document.createElement('span');
        noInteractionsText.className = 'no-interactions-text';
        noInteractionsText.textContent = 'No interactions yet';
        leftActions.appendChild(noInteractionsText);
    } else {
        // Show Comment and Quote counts if they exist
        if (replyCount > 0) {
            const commentButton = document.createElement('a');
            commentButton.href = postData.Post_Link;
            commentButton.target = '_blank';
            commentButton.rel = 'noopener';
            commentButton.className = 'action-link comments-link';
            commentButton.title = `View ${replyCount} ${pluralize(replyCount, 'comment', 'comments')} on Bluesky`;
            commentButton.innerHTML = `<i class="ph-duotone ph-chat-centered"></i><span class="count">${formatCount(replyCount)}</span>`;
            commentButton.onclick = (e) => e.stopPropagation();
            leftActions.appendChild(commentButton);
        }

        if (quoteCount > 0) {
            const quoteButton = document.createElement('a');
            quoteButton.href = postData.Post_Quotes_Link;
            quoteButton.target = '_blank';
            quoteButton.rel = 'noopener';
            quoteButton.className = 'action-link quotes-link';
            quoteButton.title = `View ${quoteCount} ${pluralize(quoteCount, 'quote', 'quotes')} on Bluesky`;
            quoteButton.innerHTML = `<i class="ph-duotone ph-quotes"></i><span class="count">${formatCount(quoteCount)}</span>`;
            quoteButton.onclick = (e) => e.stopPropagation();
            leftActions.appendChild(quoteButton);
        }
    }


    // Right Actions: View JSON, Download JSON, Copy Link, View Post
    // (Visit Profile button removed)

    // View JSON Button
    const viewJsonButton = document.createElement('button');
    viewJsonButton.className = 'action-button view-json-button';
    viewJsonButton.title = 'View post JSON data';
    viewJsonButton.innerHTML = '<i class="ph-duotone ph-code"></i>';
    viewJsonButton.onclick = (e) => {
        e.stopPropagation();
        showJsonModal(postData._originalPostData || postData);
    };

    // Download JSON Button
    const downloadJsonButton = document.createElement('button');
    downloadJsonButton.className = 'action-button download-json-button';
    downloadJsonButton.title = 'Download post metadata as JSON';
    downloadJsonButton.innerHTML = '<i class="ph-duotone ph-download-simple"></i>';
    downloadJsonButton.onclick = (e) => {
        e.stopPropagation();
        downloadJSON(postData._originalPostData || postData);
    };

    // Copy Post Link Button
    const copyLinkButton = document.createElement('button');
    copyLinkButton.className = 'action-button copy-link-button';
    copyLinkButton.title = 'Copy Bluesky post link';
    copyLinkButton.innerHTML = '<i class="ph-duotone ph-copy-simple"></i>';
    copyLinkButton.onclick = (e) => {
        e.stopPropagation();
        copyToClipboard(postData.Post_Link, copyLinkButton);
    };

    // View Post on Bluesky Button
    const viewPostButton = document.createElement('button');
    viewPostButton.className = 'action-button view-post-button';
    viewPostButton.title = 'View post on Bluesky';
    viewPostButton.innerHTML = '<i class="ph-duotone ph-arrow-square-out"></i>';
    viewPostButton.onclick = (e) => {
        e.stopPropagation();
        window.open(postData.Post_Link, '_blank', 'noopener');
    };

    // Append right actions in order
    rightActions.appendChild(viewJsonButton);
    rightActions.appendChild(downloadJsonButton);
    rightActions.appendChild(copyLinkButton);
    rightActions.appendChild(viewPostButton);

    // Add left and right containers to the main actions container
    postActions.appendChild(leftActions);
    postActions.appendChild(rightActions);
    cardFooter.appendChild(postActions); // Add actions to the footer
    card.appendChild(cardFooter);

    return card;
}


// --- Utility Functions ---

/**
 * Formats a timestamp into a short relative time string (e.g., 5m, 2h, 3d).
 * @param {string} timestamp - ISO 8601 timestamp string.
 * @returns {string} Formatted relative time string.
 */
export function formatTimestamp(timestamp) {
    if (!timestamp) return '';
    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) return '';

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

/**
 * Formats numbers (e.g., 1234 -> 1.2k). Returns empty string for 0.
 * @param {number} numInput - The number to format.
 * @returns {string} Formatted number string or empty string.
 */
function formatCount(numInput) {
    try {
        const num = parseInt(numInput);
        if (isNaN(num) || num === 0) return ''; // Return empty for 0
        if (num < 1000) return num.toString();
        if (num < 1000000) {
            const thousands = num / 1000;
            return thousands.toFixed(thousands % 1 !== 0 ? 1 : 0) + 'K';
        }
        const millions = num / 1000000;
        return millions.toFixed(millions % 1 !== 0 ? 1 : 0) + 'M';
    } catch (e) {
        console.error("Error formatting count:", numInput, e);
        return '';
    }
}


/**
 * Selects singular or plural form based on count.
 * @param {number} count - The number to check.
 * @param {string} singular - The singular form.
 * @param {string} plural - The plural form.
 * @returns {string} The correct form.
 */
function pluralize(count, singular, plural) {
    return count === 1 ? singular : plural;
}


/**
 * Formats post text, converting mentions, links, and hashtags using facets.
 * @param {string} text - The raw post text.
 * @param {Array<object>} facets - The array of facet objects from the post record.
 * @returns {string} HTML string with formatted text.
 */
export function formatPostText(text, facets) {
    if (!text) return '';
    if (!facets || facets.length === 0) {
        return escapeHtml(text).replace(/\n/g, '<br>');
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const textBytes = encoder.encode(text);
    const sortedFacets = facets.slice().sort((a, b) => a.index.byteStart - b.index.byteStart);

    let htmlResult = '';
    let currentByteIndex = 0;

    for (const facet of sortedFacets) {
        if (!facet.index || typeof facet.index.byteStart !== 'number' || typeof facet.index.byteEnd !== 'number' ||
            facet.index.byteStart < currentByteIndex || facet.index.byteEnd > textBytes.length || facet.index.byteStart >= facet.index.byteEnd) {
            console.warn("Skipping invalid or overlapping facet:", facet);
            continue;
        }

        if (facet.index.byteStart > currentByteIndex) {
            const textSegmentBytes = textBytes.slice(currentByteIndex, facet.index.byteStart);
            htmlResult += escapeHtml(decoder.decode(textSegmentBytes));
        }

        const facetTextBytes = textBytes.slice(facet.index.byteStart, facet.index.byteEnd);
        const facetText = escapeHtml(decoder.decode(facetTextBytes));

        let linkCreated = false;
        if (Array.isArray(facet.features)) {
            for (const feature of facet.features) {
                const type = feature?.$type;
                try {
                    if (type === 'app.bsky.richtext.facet#link' && feature.uri) {
                        new URL(feature.uri); // Validate URI
                        htmlResult += `<a href="${escapeHtml(feature.uri)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" title="${escapeHtml(feature.uri)}" class="post-link">${facetText}</a>`;
                        linkCreated = true;
                        break;
                    } else if (type === 'app.bsky.richtext.facet#mention' && feature.did && feature.did.startsWith('did:')) {
                        htmlResult += `<a href="https://bsky.app/profile/${feature.did}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" title="View profile @${escapeHtml(decoder.decode(facetTextBytes)).substring(1)}" class="post-link mention">${facetText}</a>`;
                        linkCreated = true;
                        break;
                    } else if (type === 'app.bsky.richtext.facet#tag' && feature.tag) {
                        if (feature.tag.trim()) {
                            htmlResult += `<a href="https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" title="Search hashtag #${escapeHtml(feature.tag)}" class="post-link hashtag">${facetText}</a>`;
                            linkCreated = true;
                            break;
                        }
                    }
                } catch (e) {
                    console.warn("Skipping facet feature due to invalid data:", feature, e);
                    linkCreated = false;
                }
            }
        }

        if (!linkCreated) {
            htmlResult += facetText;
        }
        currentByteIndex = facet.index.byteEnd;
    }

    if (currentByteIndex < textBytes.length) {
        const remainingBytes = textBytes.slice(currentByteIndex);
        htmlResult += escapeHtml(decoder.decode(remainingBytes));
    }

    return htmlResult.replace(/\n/g, '<br>');
}

/**
 * Escapes HTML special characters in a string.
 * @param {string} unsafe - The string to escape.
 * @returns {string} The escaped string.
 */
export function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/**
 * Creates the HTML element for a post's image carousel with touch support.
 * Removes arrow buttons.
 * @param {string[]} images - Array of image URLs.
 * @returns {HTMLElement|null} The carousel element or null if no valid images.
 */
function createCarousel(images) {
    if (!images || images.length === 0) return null;

    const carousel = document.createElement('div');
    carousel.classList.add('carousel');
    const inner = document.createElement('div');
    inner.classList.add('carousel-inner');
    carousel.appendChild(inner);

    let firstImageLoaded = false;
    let visibleImageCount = 0;
    let resizeTimeout;

    images.forEach((image, index) => {
        const item = document.createElement('div');
        item.classList.add('carousel-item');

        const img = document.createElement('img');
        img.src = image;
        img.alt = `Post image ${index + 1}`;
        img.loading = "lazy";
        img.onerror = () => {
            console.warn("Failed to load image:", image);
            item.style.display = 'none';
            updateCarouselNavVisibility(carousel); // Update dot visibility
        };
        img.onload = () => {
            const loadedSuccessfully = img.complete && typeof img.naturalWidth !== "undefined" && img.naturalWidth > 0;
            if (!loadedSuccessfully) {
                img.onerror();
                return;
            }
            visibleImageCount++;
            if (!firstImageLoaded && loadedSuccessfully) {
                firstImageLoaded = true;
                setCarouselHeight(carousel, img);
            }
            updateCarouselNavVisibility(carousel); // Update dot visibility
        };
        img.onclick = (e) => {
            e.stopPropagation();
            window.open(image, '_blank', 'noopener');
        };

        item.appendChild(img);
        inner.appendChild(item);
        if (img.complete) img.onload();
    });

    visibleImageCount = Array.from(inner.children).filter(item => item.style.display !== 'none').length;

    if (images.length > 1) {
        const nav = document.createElement('div');
        nav.classList.add('carousel-nav');
        carousel.appendChild(nav);

        // Arrow buttons removed

        let currentVisibleIndex = 0;

        const updateNavDots = () => {
            const visibleItems = Array.from(inner.children).filter(item => item.style.display !== 'none');
            nav.innerHTML = '';
            if (visibleItems.length <= 1) {
                nav.style.display = 'none';
                // prevButton.style.display = 'none'; // Removed
                // nextButton.style.display = 'none'; // Removed
                return;
            }
            nav.style.display = 'flex';
            // prevButton.style.display = 'flex'; // Removed
            // nextButton.style.display = 'flex'; // Removed

            visibleItems.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.classList.add('carousel-dot');
                if (i === currentVisibleIndex) dot.classList.add('active');
                dot.addEventListener('click', (e) => {
                    e.stopPropagation();
                    currentVisibleIndex = i;
                    updateSlidePosition();
                    updateNavDots();
                });
                nav.appendChild(dot);
            });
        };

        const updateSlidePosition = () => {
            const firstVisibleItem = inner.querySelector('.carousel-item:not([style*="display: none"])');
            if (!firstVisibleItem) return;
            const width = firstVisibleItem.offsetWidth;
            if (width === 0) return;
            inner.style.transform = `translateX(-${width * currentVisibleIndex}px)`;
        };

        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                const firstImgEl = carousel.querySelector('.carousel-item:not([style*="display: none"]) img');
                if (firstImgEl && firstImgEl.complete && firstImgEl.naturalWidth > 0) {
                    setCarouselHeight(carousel, firstImgEl);
                } else {
                    const currentHeight = carousel.offsetHeight;
                    if (currentHeight < parseFloat(getComputedStyle(carousel).minHeight || 0) || currentHeight > parseFloat(getComputedStyle(carousel).maxHeight || Infinity)) {
                        carousel.style.height = 'auto';
                    }
                }
                updateSlidePosition();
            }, 150);
        };

        window.addEventListener('resize', handleResize);

        // Arrow button event listeners removed

        // --- Touch Controls (Remain the same) ---
        let touchStartX = null;
        let touchCurrentX = null;
        let itemWidth = 0;
        let isDragging = false;

        inner.addEventListener('touchstart', (e) => {
            const visibleItems = inner.querySelectorAll('.carousel-item:not([style*="display: none"])');
            if (visibleItems.length <= 1) return;
            const firstVisibleItem = visibleItems[0];
            if (!firstVisibleItem) return;
            itemWidth = firstVisibleItem.offsetWidth;
            if (itemWidth === 0) return;
            touchStartX = e.touches[0].clientX;
            touchCurrentX = touchStartX;
            isDragging = true;
            inner.style.transition = 'none';
        }, { passive: true });

        inner.addEventListener('touchmove', (e) => {
            if (!isDragging || touchStartX === null || itemWidth === 0) return;
            touchCurrentX = e.touches[0].clientX;
            const diff = touchStartX - touchCurrentX;
            const currentTransformOffset = -itemWidth * currentVisibleIndex;
            inner.style.transform = `translateX(${currentTransformOffset - diff}px)`;
        }, { passive: true });

        inner.addEventListener('touchend', () => {
            if (!isDragging) return;
            isDragging = false;
            const visibleItems = inner.querySelectorAll('.carousel-item:not([style*="display: none"])');
            inner.style.transition = 'transform 0.3s ease';

            if (touchStartX !== null && itemWidth > 0 && visibleItems.length > 1) {
                const diff = touchStartX - touchCurrentX;
                const threshold = itemWidth / 4;

                if (Math.abs(diff) > threshold) {
                    if (diff > 0 && currentVisibleIndex < visibleItems.length - 1) {
                        currentVisibleIndex++;
                    } else if (diff < 0 && currentVisibleIndex > 0) {
                        currentVisibleIndex--;
                    }
                }
            }
            touchStartX = null;
            touchCurrentX = null;
            itemWidth = 0;
            updateSlidePosition();
            updateNavDots();
        });
        inner.addEventListener('touchcancel', () => {
            if (!isDragging) return;
            isDragging = false;
            inner.style.transition = 'transform 0.3s ease';
            touchStartX = null;
            touchCurrentX = null;
            itemWidth = 0;
            updateSlidePosition();
            updateNavDots();
        });

        // Initial setup
        setTimeout(() => {
            updateNavDots();
            updateSlidePosition();
        }, 0);

    } else if (visibleImageCount === 0 && images.length > 0) {
        carousel.style.display = 'none';
        return null;
    } else if (visibleImageCount === 1 && !firstImageLoaded) {
        const firstImgEl = carousel.querySelector('.carousel-item:not([style*="display: none"]) img');
        if (firstImgEl && firstImgEl.complete && firstImgEl.naturalWidth > 0) {
            firstImageLoaded = true;
            setCarouselHeight(carousel, firstImgEl);
        }
    }

    return carousel;
}

/**
 * Helper to set carousel height based on the first image's aspect ratio.
 * (Function adapted from PhotoStream ui.js)
 * @param {HTMLElement} carouselElement - The .carousel container div.
 * @param {HTMLImageElement} firstImageElement - The first successfully loaded image element.
 */
function setCarouselHeight(carouselElement, firstImageElement) {
    if (!carouselElement || !firstImageElement || !firstImageElement.naturalWidth || !firstImageElement.naturalHeight) {
        carouselElement.style.height = 'auto';
        return;
    }

    const containerWidth = carouselElement.offsetWidth;
    if (containerWidth <= 0) {
        carouselElement.style.height = 'auto';
        return;
    }

    const computedStyle = window.getComputedStyle(carouselElement.parentElement); // Check parent (.media-container)
    const maxHeightValue = computedStyle.maxHeight;
    const minHeightValue = computedStyle.minHeight;
    let maxHeightPx = Infinity;
    let minHeightPx = 0;

    if (maxHeightValue && maxHeightValue !== 'none' && maxHeightValue.endsWith('px')) {
        maxHeightPx = parseFloat(maxHeightValue) || Infinity;
    } else if (maxHeightValue && maxHeightValue !== 'none' && maxHeightValue.endsWith('vh')) {
        maxHeightPx = (parseFloat(maxHeightValue) / 100) * window.innerHeight;
    }


    if (minHeightValue && minHeightValue !== 'none' && minHeightValue.endsWith('px')) {
        minHeightPx = parseFloat(minHeightValue) || 0;
    } else if (minHeightValue && minHeightValue !== 'none' && minHeightValue.endsWith('vh')) {
        minHeightPx = (parseFloat(minHeightValue) / 100) * window.innerHeight;
    }

    const imageAspectRatio = firstImageElement.naturalHeight / firstImageElement.naturalWidth;
    let calculatedHeight = containerWidth * imageAspectRatio;

    calculatedHeight = Math.max(minHeightPx, Math.min(calculatedHeight, maxHeightPx));

    carouselElement.parentElement.style.height = `${calculatedHeight}px`; // Set height on parent (.media-container)
    carouselElement.style.height = '100%'; // Carousel fills parent
}


/**
 * Helper to update carousel navigation visibility (dots only).
 * @param {HTMLElement} carouselElement - The .carousel container div.
 */
function updateCarouselNavVisibility(carouselElement) {
    const inner = carouselElement.querySelector('.carousel-inner');
    const nav = carouselElement.querySelector('.carousel-nav');
    // const prev = carouselElement.querySelector('.arrow.prev'); // Removed
    // const next = carouselElement.querySelector('.arrow.next'); // Removed
    if (!inner || !nav) return; // Only check inner and nav

    const visibleItems = inner.querySelectorAll('.carousel-item:not([style*="display: none"])');
    const showNav = visibleItems.length > 1;

    nav.style.display = showNav ? 'flex' : 'none';
    // prev.style.display = showNav ? 'flex' : 'none'; // Removed
    // next.style.display = showNav ? 'flex' : 'none'; // Removed
}

/**
 * Copies text to the clipboard and provides visual feedback on a button.
 * @param {string} text - The text to copy.
 * @param {HTMLElement} buttonElement - The button that triggered the copy.
 */
export async function copyToClipboard(text, buttonElement = null) {
    if (!text) return;

    let success = false;
    try {
        await navigator.clipboard.writeText(text);
        success = true;
    } catch (err) {
        console.error('Failed to copy text: ', err);
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";
            textArea.style.top = "0";
            textArea.style.left = "0";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            success = document.execCommand('copy');
            document.body.removeChild(textArea);
        } catch (fallbackErr) {
            console.error('Fallback copy failed:', fallbackErr);
        }
    }

    if (buttonElement instanceof HTMLElement) {
        const originalIconHTML = buttonElement.innerHTML;
        const originalTitle = buttonElement.title;
        buttonElement.disabled = true;

        if (success) {
            buttonElement.innerHTML = '<i class="ph-duotone ph-check-circle" style="color: var(--primary-base);"></i>';
            buttonElement.title = 'Copied!';
        } else {
            buttonElement.innerHTML = '<i class="ph-duotone ph-x-circle" style="color: red;"></i>';
            buttonElement.title = 'Copy failed';
        }

        setTimeout(() => {
            if (buttonElement.querySelector('.ph-check-circle') || buttonElement.querySelector('.ph-x-circle')) {
                buttonElement.innerHTML = originalIconHTML;
            }
            buttonElement.title = originalTitle;
            buttonElement.disabled = false;
        }, 1500);
    } else if (!success) {
        alert("Failed to copy link.");
    } else {
        alert("Link copied to clipboard!");
    }
}


/**
 * Triggers a download of the post data as a JSON file.
 * @param {object} itemData - The post data object (preferably the original API response).
 */
export function downloadJSON(itemData) {
    if (!itemData) return;

    const handle = itemData.Author_Handle || itemData.author?.handle || 'unknown';
    const createdAt = itemData.Post_CreatedAt || itemData.record?.createdAt || new Date().toISOString();
    const timestamp = new Date(createdAt).toISOString().replace(/[:.]/g, '-');
    const filename = `${handle}_${timestamp}.json`;

    const dataToDownload = itemData._originalPostData || itemData;

    try {
        const jsonData = JSON.stringify(dataToDownload, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Error creating or downloading JSON:", error);
        alert("Failed to prepare JSON for download.");
    }
}

// --- JSON Modal ---

/**
 * Displays the JSON viewer modal with the provided data.
 * @param {object} jsonData - The JavaScript object to display as JSON.
 */
export function showJsonModal(jsonData) {
    const modal = document.getElementById('jsonModal');
    const jsonViewer = document.getElementById('jsonViewer');
    if (modal && jsonViewer) {
        try {
            jsonViewer.textContent = JSON.stringify(jsonData, null, 2);
            modal.style.display = 'flex';
        } catch (error) {
            console.error("Error stringifying JSON for modal:", error);
            jsonViewer.textContent = "Error displaying JSON data.";
            modal.style.display = 'flex';
        }
    }
}

// --- Load More Button ---

/**
 * Updates the state and text of the "Load More" button.
 * @param {boolean} isLoading - Is data currently being loaded?
 * @param {boolean} hasMore - Does the API indicate more posts are available (i.e., is there a cursor)?
 */
export function updateLoadMoreButton(isLoading, hasMore) {
    const container = document.getElementById('loadMoreContainer');
    const button = document.getElementById('loadMoreButton');
    if (!container || !button) return;

    container.style.display = hasMore || isLoading ? 'block' : 'none';

    button.disabled = isLoading;
    button.textContent = isLoading ? 'Loading...' : 'Load more posts';

    if (!isLoading && !hasMore) {
        container.style.display = 'none';
    }
}


// --- END OF FILE ui.js ---