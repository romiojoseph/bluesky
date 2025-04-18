// js/ui.js
// Implements recursive reply rendering and updated loading/error UI

const UI = {
    // Element references... (Keep all existing references)
    tabsContainer: document.getElementById('tabs-container'),
    searchProfileHeader: document.getElementById('search-profile-header'),
    directSearchHeader: document.getElementById('direct-search-header'),
    feedContainer: document.getElementById('feed-container'),
    feedEndMessage: document.getElementById('feed-end-message'),
    detailView: document.getElementById('detail-view'),
    backButton: document.getElementById('back-button'),
    leaveReplyButton: document.getElementById('leave-reply-button'),
    detailImageCarousel: document.getElementById('detail-image-carousel'),
    detailVideoPlayerContainer: document.getElementById('detail-video-player-container'),
    likeButton: document.getElementById('like-button'),
    likeCountSpan: document.getElementById('like-count'),
    commentButton: document.getElementById('comment-button'),
    commentCountSpan: document.getElementById('comment-count'),
    shareButton: document.getElementById('share-button'),
    copyStatusSpan: document.getElementById('copy-status'),
    followButton: document.getElementById('follow-button'),
    authorInfoDiv: document.getElementById('author-info'),
    postTextDiv: document.getElementById('post-text'),
    externalEmbedDiv: document.getElementById('external-embed-info'),
    repliesContainer: document.getElementById('replies-container'),
    noRepliesP: document.getElementById('no-replies'),
    pageOverlay: document.getElementById('page-overlay'),
    loadingIndicator: document.getElementById('loading-indicator'),
    errorIndicator: document.getElementById('error-indicator'),
    errorMessageSpan: document.getElementById('error-message'),
    retryButton: document.getElementById('retry-button'),
    searchIconButton: document.getElementById('search-icon-button'),
    searchPopup: document.getElementById('search-popup'),
    searchPopupClose: document.getElementById('search-popup-close'),
    searchForm: document.getElementById('search-form'),
    searchInput: document.getElementById('search-username'),
    searchError: document.getElementById('search-error'),

    init: (config, onTabClickCallback, onRetryCallback, onSearchSubmitCallback) => {
        UI.createTabs(config, onTabClickCallback);
        UI.backButton.addEventListener('click', UI.hideDetailView);
        UI.retryButton.addEventListener('click', () => {
            UI.hideError(); // Hide error first
            onRetryCallback();
        });
        UI.searchIconButton.addEventListener('click', UI.showSearchPopup);
        UI.searchPopupClose.addEventListener('click', UI.hideSearchPopup);
        UI.searchPopup.addEventListener('click', (e) => {
            if (e.target === UI.searchPopup) UI.hideSearchPopup();
        });
        UI.searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const inputValue = UI.searchInput.value.trim();
            if (inputValue) {
                UI.hideSearchPopup();
                onSearchSubmitCallback(inputValue);
            }
        });

        // Add this near other event listeners
        window.addEventListener('popstate', (event) => {
            const detailView = document.getElementById('detail-view');
            if (detailView && !detailView.classList.contains('hidden')) {
                UI.hideDetailView();
            }
        });
    },

    createTabs: (config, onTabClickCallback) => {
        UI.tabsContainer.innerHTML = '';
        if (!config || config.length === 0) {
            UI.tabsContainer.classList.add('hidden');
            return;
        }
        UI.tabsContainer.classList.remove('hidden');
        config.forEach((item, index) => {
            const tab = document.createElement('button');
            tab.className = 'tab';
            tab.textContent = item.name;
            tab.dataset.uri = item.atUri;
            tab.dataset.type = item.type;
            tab.dataset.index = index;
            tab.addEventListener('click', (event) => {
                onTabClickCallback(item);
            });
            UI.tabsContainer.appendChild(tab);
        });
    },

    setActiveTab: (atUri) => {
        let activeTabFound = false;
        document.querySelectorAll('.tab').forEach(tab => {
            const isActive = tab.dataset.uri === atUri;
            tab.classList.toggle('active', isActive);
            if (isActive) {
                activeTabFound = true;
                tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        });
        if (!atUri) {
            document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
        }
    },

    clearFeed: () => {
        if (App.masonryInstance) {
            try {
                App.masonryInstance.destroy();
            } catch (e) {
                console.error("Error destroying Masonry instance:", e);
            }
            App.masonryInstance = null;
        }
        UI.feedContainer.innerHTML = '';
        UI.hideFeedEndMessage();
    },

    // Added isInitialLoad parameter
    renderFeedItems: (posts, onImageClickCallback, isInitialLoad = false) => {
        if (!posts || posts.length === 0) {
            // If it's an initial load with no items, ensure loading is hidden
            if (isInitialLoad && !App.isInitialLayoutComplete) {
                UI.hideLoading();
                App.isInitialLayoutComplete = true;
            }
            return;
        }

        const fragment = document.createDocumentFragment();
        const newElements = [];

        posts.forEach(item => {
            const post = item.post; // Note: Filtering for labels is done in main.js before calling this

            const mediaInfo = Utils.extractMediaInfo(post);
            // Use mediaInfo.primaryUrl which is now correctly set to the thumbnail for grid display
            // For video/external, it will be their respective thumbnail URLs.
            const displayUrl = mediaInfo?.primaryUrl;

            if (mediaInfo && displayUrl) {
                const feedItem = document.createElement('div');
                feedItem.className = 'feed-item';
                feedItem.dataset.uri = post.uri;

                const mediaWrapper = document.createElement('div');
                mediaWrapper.className = 'feed-item-wrapper';

                const img = document.createElement('img');
                // --- CHANGE: Use displayUrl (which is now primaryUrl from extractMediaInfo) ---
                img.src = displayUrl;
                // --- END CHANGE ---
                img.alt = Utils.escapeHtml(
                    // Use alt from the first image in the array for consistency if it's an image embed
                    (mediaInfo.mediaType === 'image' ? mediaInfo.allImages[0]?.alt : '') ||
                    post.record.text?.substring(0, 50) ||
                    `${mediaInfo.mediaType === 'video' ? 'Video' : 'Image'} by ${post.author.handle}`
                );
                img.loading = 'lazy';
                img.onerror = () => {
                    console.warn(`Grid media load failed: ${displayUrl}`);
                    feedItem.style.display = 'none'; // Hide the item
                    if (App.masonryInstance) {
                        // Use requestAnimationFrame for layout stability after removal
                        window.requestAnimationFrame(() => {
                            if (App.masonryInstance) {
                                try { App.masonryInstance.layout(); } catch (e) { console.error("Error during layout on image error:", e) }
                            }
                        });
                    }
                };
                mediaWrapper.appendChild(img);

                // Format like count
                if (post.likeCount > 0) {
                    const likeCount = document.createElement('div');
                    likeCount.className = 'feed-item-like-count';
                    likeCount.innerHTML = `<i class="ph ph-heart"></i> ${Utils.formatNumberWithCommas(post.likeCount)}`; // Use formatter
                    mediaWrapper.appendChild(likeCount);
                }

                let iconHtml = '';
                if (mediaInfo.mediaType === 'image' && mediaInfo.hasMultiple) {
                    iconHtml = `<i class="ph-duotone ph-slideshow"></i>`;
                } else if (mediaInfo.mediaType === 'video') {
                    iconHtml = `<i class="ph-fill ph-video"></i>`;
                }

                if (iconHtml) {
                    const iconSpan = document.createElement('span');
                    iconSpan.className = 'slideshow-icon';
                    iconSpan.innerHTML = iconHtml;
                    mediaWrapper.appendChild(iconSpan);
                }

                feedItem.appendChild(mediaWrapper);

                const authorInfoDiv = document.createElement('div');
                authorInfoDiv.className = 'feed-item-author-info';
                const avatarImg = document.createElement('img');
                avatarImg.className = 'feed-item-avatar';
                avatarImg.src = post.author.avatar || './assets/placeholder-avatar.png';
                avatarImg.alt = ''; avatarImg.loading = 'lazy';
                avatarImg.onerror = function () { this.src = './assets/placeholder-avatar.png'; };
                const handleLink = document.createElement('a');
                handleLink.className = 'feed-item-handle';
                handleLink.href = Utils.createBskyProfileUrl(post.author.did || post.author.handle);
                handleLink.textContent = `@${post.author.handle}`;
                handleLink.target = '_blank'; handleLink.rel = 'noopener noreferrer';
                handleLink.addEventListener('click', (e) => e.stopPropagation());
                authorInfoDiv.appendChild(avatarImg);
                authorInfoDiv.appendChild(handleLink);
                feedItem.appendChild(authorInfoDiv);

                feedItem.addEventListener('click', () => onImageClickCallback(post.uri));

                fragment.appendChild(feedItem);
                newElements.push(feedItem);
            }
        });

        UI.feedContainer.appendChild(fragment);

        // Initialize or append to Masonry
        if (!App.masonryInstance) {
            try {
                if (UI.feedContainer) {
                    App.masonryInstance = new Masonry(UI.feedContainer, {
                        itemSelector: '.feed-item',
                        percentPosition: true,
                        transitionDuration: 0 // Disable Masonry animation for potentially smoother initial load
                    });
                } else { console.error("Masonry init failed: Container not found."); }
            } catch (e) {
                console.error("Failed to initialize Masonry:", e); App.masonryInstance = null;
            }
        } else {
            try {
                if (newElements.length > 0) {
                    App.masonryInstance.appended(newElements);
                }
            } catch (e) {
                console.error("Error calling masonry.appended():", e);
                // Fallback layout if append fails
                if (App.masonryInstance) { App.masonryInstance.layout(); }
            }
        }

        // Use imagesLoaded to ensure layout after images are loaded
        if (App.masonryInstance && newElements.length > 0) {
            try {
                const imgLoad = imagesLoaded(UI.feedContainer);

                imgLoad.on('progress', function () {
                    if (App.masonryInstance) {
                        window.requestAnimationFrame(() => {
                            if (App.masonryInstance) {
                                try { App.masonryInstance.layout(); } catch (e) { console.error("Error during layout on progress:", e) }
                            }
                        });
                    }
                });
                imgLoad.on('fail', function (instance) {
                    console.warn(`imagesLoaded: ${instance.badImages.length} images failed to load. Relayout.`);
                    window.requestAnimationFrame(() => {
                        if (App.masonryInstance) {
                            try { App.masonryInstance.layout(); } catch (e) { console.error("Error during layout on fail:", e) }
                        }
                    });
                });
                // --- OPTIMIZATION: Hide loading indicator after initial images are processed ---
                if (isInitialLoad && !App.isInitialLayoutComplete) {
                    imgLoad.on('always', () => { // *** Corrected: Use .on('always', ...) ***
                        // Check again if still initial load phase, prevent hiding if user navigated away quickly
                        if (!App.isInitialLayoutComplete) {
                            UI.hideLoading();
                            App.isInitialLayoutComplete = true; // Mark initial layout as complete
                            // Ensure a final layout call after hiding overlay potentially shifts things
                            window.requestAnimationFrame(() => {
                                if (App.masonryInstance) {
                                    try { App.masonryInstance.layout(); } catch (e) { console.error("Error during layout on always:", e) }
                                }
                            });
                        }
                    });
                }
                // --- END OPTIMIZATION ---

            } catch (e) {
                console.error("Error setting up imagesLoaded:", e);
                // Ensure layout happens even if imagesLoaded setup fails
                window.requestAnimationFrame(() => {
                    if (App.masonryInstance) {
                        try { App.masonryInstance.layout(); } catch (layoutError) { console.error("Error during fallback layout:", layoutError) }
                    }
                });
                // Hide loading indicator if imagesLoaded setup failed during initial load
                if (isInitialLoad && !App.isInitialLayoutComplete) {
                    UI.hideLoading();
                    App.isInitialLayoutComplete = true;
                }
            }
        } else if (App.masonryInstance) {
            // Ensure layout happens even if no new elements (e.g., only errors)
            window.requestAnimationFrame(() => {
                if (App.masonryInstance) {
                    try { App.masonryInstance.layout(); } catch (e) { console.error("Error during layout (no new elements):", e) }
                }
            });
            // If no new elements on initial load, hide loading
            if (isInitialLoad && !App.isInitialLayoutComplete) {
                UI.hideLoading();
                App.isInitialLayoutComplete = true;
            }
        } else {
            // If no masonry instance and it was initial load, hide loading
            if (isInitialLoad && !App.isInitialLayoutComplete) {
                UI.hideLoading();
                App.isInitialLayoutComplete = true;
            }
        }
    },


    showDetailView: (post, thread) => {
        // Note: Filtering for labels on the main post is done in main.js before calling this
        if (!post || !post.author || !post.record || !post.uri) {
            console.error("Cannot show detail view: Invalid post data", post);
            UI.showError("Failed to load post details: Invalid data.");
            return;
        }

        const mediaInfo = Utils.extractMediaInfo(post);

        Carousel.cleanup();
        VideoPlayer.cleanup();
        UI.detailImageCarousel.classList.add('hidden');
        UI.detailVideoPlayerContainer.classList.add('hidden');

        if (mediaInfo && mediaInfo.mediaType === 'video') {
            UI.detailVideoPlayerContainer.classList.remove('hidden');
            VideoPlayer.init(
                'detail-video-player-container',
                mediaInfo.playlist,
                mediaInfo.thumbnail,
                mediaInfo.aspectRatio
            );
        } else if (mediaInfo && mediaInfo.mediaType === 'image') {
            UI.detailImageCarousel.classList.remove('hidden');
            // Carousel uses the allImages array which contains fullsize URLs
            Carousel.init('detail-image-carousel', mediaInfo.allImages);
        }

        // Format counts in action buttons
        const likeCount = post.likeCount || 0;
        const replyCount = post.replyCount || 0;
        UI.likeCountSpan.textContent = likeCount > 0 ? Utils.formatNumberWithCommas(likeCount) : '';
        UI.commentCountSpan.textContent = replyCount > 0 ? Utils.formatNumberWithCommas(replyCount) : '';

        UI.copyStatusSpan.textContent = ''; UI.copyStatusSpan.style.display = 'none';

        const postUrl = Utils.createBskyPostUrl(post.uri);
        UI.leaveReplyButton.href = postUrl;
        UI.shareButton.onclick = async () => {
            try {
                if (navigator.share) {
                    await navigator.share({ url: postUrl, title: 'Check out this post on Bluesky' });
                    UI.copyStatusSpan.textContent = 'Shared!';
                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                    await navigator.clipboard.writeText(postUrl);
                    UI.copyStatusSpan.textContent = 'Copied!';
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = postUrl;
                    textarea.style.position = 'fixed'; textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    const success = document.execCommand('copy');
                    document.body.removeChild(textarea);
                    UI.copyStatusSpan.textContent = success ? 'Copied!' : 'Copy Failed';
                }
            } catch (err) {
                console.error('Share/Copy failed:', err); UI.copyStatusSpan.textContent = 'Failed';
            }
            UI.copyStatusSpan.style.display = 'inline';
            setTimeout(() => { UI.copyStatusSpan.style.display = 'none'; }, 2500);
        };

        const profileUrl = Utils.createBskyProfileUrl(post.author.did || post.author.handle);
        UI.followButton.href = profileUrl;
        UI.authorInfoDiv.innerHTML = `
            <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">
                <img src="${post.author.avatar || './assets/placeholder-avatar.png'}" alt="${Utils.escapeHtml(post.author.displayName || post.author.handle)}" class="author-avatar" loading="lazy" onerror="this.src='./assets/placeholder-avatar.png'">
            </a>
            <div class="author-details">
                 <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="author-display-name" onclick="event.stopPropagation()">${Utils.escapeHtml(post.author.displayName || post.author.handle)}</a>
                <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="author-handle" onclick="event.stopPropagation()">@${post.author.handle}</a>
            </div>
        `;
        const postText = post.record.text || '';
        const postFacets = post.record.facets || [];
        UI.postTextDiv.innerHTML = Utils.parseFacets(postText, postFacets);
        UI.renderExternalEmbed(post.embed);

        UI.renderReplies(thread); // Render replies

        UI.detailView.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
        UI.detailView.scrollTop = 0; // Ensure detail view starts at the top

        // Add history state when opening detail view
        if (!window.history.state || window.history.state.view !== 'detail') {
            window.history.pushState({ view: 'detail' }, '', '#detail');
        }
    },

    renderExternalEmbed: (embed) => {
        let externalData = null;
        if (embed) {
            if ((embed.$type === 'app.bsky.embed.external#view' || embed.$type === 'app.bsky.embed.external') && embed.external) {
                externalData = embed.external;
            } else if ((embed.$type === 'app.bsky.embed.recordWithMedia#view' || embed.$type === 'app.bsky.embed.recordWithMedia') && embed.media && (embed.media.$type === 'app.bsky.embed.external#view' || embed.media.$type === 'app.bsky.embed.external') && embed.media.external) {
                externalData = embed.media.external;
            } else if ((embed.$type === 'app.bsky.embed.recordWithMedia#view' || embed.$type === 'app.bsky.embed.recordWithMedia') && embed.record?.record?.embed && (embed.record.record.embed.$type === 'app.bsky.embed.external#view' || embed.record.record.embed.$type === 'app.bsky.embed.external') && embed.record.record.embed.external) {
                externalData = embed.record.record.embed.external;
            }
        }
        if (externalData && externalData.uri) {
            const uri = externalData.uri;
            const title = Utils.escapeHtml(externalData.title || '');
            const description = Utils.escapeHtml(externalData.description || '');
            let contentHTML = ''; let thumbHTML = '';
            if (externalData.thumb && typeof externalData.thumb === 'string') {
                // Simple validation for potentially invalid blob URLs
                if (externalData.thumb.startsWith('blob:')) {
                    console.warn("Skipping potentially invalid blob thumbnail in external embed:", externalData.thumb);
                } else {
                    thumbHTML = `<img src="${Utils.escapeHtml(externalData.thumb)}" class="external-embed-thumb" alt="" loading="lazy" onerror="this.style.display='none';" />`;
                }
            }
            contentHTML += `<a href="${Utils.escapeHtml(uri)}" target="_blank" rel="noopener noreferrer" class="external-embed-link" onclick="event.stopPropagation()">`;
            if (thumbHTML) contentHTML += thumbHTML;
            contentHTML += `<div class="external-embed-text-content">`;
            if (title) contentHTML += `<span class="external-embed-title">${title}</span>`;
            if (description) contentHTML += `<p class="external-embed-description">${description}</p>`;
            // Display hostname safely
            try {
                contentHTML += `<span class="external-embed-uri">${Utils.escapeHtml(new URL(uri).hostname)}</span>`;
            } catch (e) {
                console.warn("Could not parse hostname from external embed URI:", uri, e);
                contentHTML += `<span class="external-embed-uri">${Utils.escapeHtml(uri)}</span>`; // Fallback to full URI if hostname fails
            }
            contentHTML += `</div></a>`;
            UI.externalEmbedDiv.innerHTML = contentHTML;
            UI.externalEmbedDiv.classList.remove('hidden');
        } else {
            UI.externalEmbedDiv.classList.add('hidden'); UI.externalEmbedDiv.innerHTML = '';
        }
    },

    renderReplies: (thread) => {
        UI.repliesContainer.innerHTML = '';
        UI.noRepliesP.classList.add('hidden');

        const repliesHeading = UI.detailView.querySelector('.replies-section h3');
        if (!repliesHeading) { console.error("Could not find replies heading element."); return; }

        const officialReplyCount = thread?.post?.replyCount || 0;

        // Format count for heading
        repliesHeading.textContent = officialReplyCount > 0 ? `Replies (${Utils.formatNumberWithCommas(officialReplyCount)})` : 'Replies';


        let hasVisibleReplies = false;

        // Recursive function to render a reply and its children
        const renderSingleReply = (replyNode, depth, containerElement) => {
            // Validity Checks + Label Check
            if (!replyNode || replyNode.$type !== 'app.bsky.feed.defs#threadViewPost' || !replyNode.post || !replyNode.post.author || !replyNode.post.record || replyNode.post.uri === thread?.post?.uri) {
                if (replyNode && (replyNode.$type === 'app.bsky.feed.defs#notFoundPost' || replyNode.$type === 'app.bsky.feed.defs#blockedPost')) {
                    // Skip silently
                }
                return;
            }
            const reply = replyNode.post;
            // Check for labels on the reply itself
            if (reply.labels && reply.labels.length > 0) {
                return; // Don't render this reply or its children if it has labels
            }

            hasVisibleReplies = true;

            const replyLink = document.createElement('a');
            replyLink.className = 'reply-item-link';
            replyLink.href = Utils.createBskyPostUrl(reply.uri);
            replyLink.target = '_blank';
            replyLink.rel = 'noopener noreferrer';
            replyLink.setAttribute('aria-label', `View reply by ${reply.author.handle}`);
            replyLink.addEventListener('click', e => e.stopPropagation());

            const replyItemWrapper = document.createElement('div');
            replyItemWrapper.className = 'reply-item-wrapper';
            // Limit indentation depth visually
            replyItemWrapper.style.paddingLeft = `${Math.min(depth, 5) * 20}px`;

            const replyItemContent = document.createElement('div');
            replyItemContent.className = 'reply-item-content';

            const replyAvatar = document.createElement('div');
            replyAvatar.className = 'reply-avatar';
            const avatarUrl = reply.author.avatar || './assets/placeholder-avatar.png';
            replyAvatar.innerHTML = `<img src="${avatarUrl}" alt="" loading="lazy" onerror="this.src='./assets/placeholder-avatar.png'">`;

            const replyContent = document.createElement('div');
            replyContent.className = 'reply-content';

            const profileUrl = Utils.createBskyProfileUrl(reply.author.did || reply.author.handle);
            const displayName = Utils.escapeHtml(reply.author.displayName || reply.author.handle);
            const handle = Utils.escapeHtml(reply.author.handle);
            const timestamp = Utils.relativeTime(reply.record.createdAt);
            const replyHeader = document.createElement('div');
            replyHeader.className = 'reply-header';
            replyHeader.innerHTML = `
                <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="reply-author-name" onclick="event.stopPropagation()">${displayName}</a>
                <span class="reply-author-handle">@${handle}</span>
                <span class="reply-timestamp">${timestamp}</span>`;
            replyHeader.querySelectorAll('a').forEach(a => a.addEventListener('click', e => e.stopPropagation()));

            const replyText = document.createElement('div');
            replyText.className = 'reply-text';
            replyText.innerHTML = Utils.parseFacets(reply.record.text || '', reply.record.facets || []);

            const replyImagesDiv = document.createElement('div');
            replyImagesDiv.className = 'reply-images';
            // extractReplyImages already includes the label check
            const replyImages = Utils.extractReplyImages(reply);
            replyImages.forEach(imgInfo => {
                const imgLink = document.createElement('a');
                imgLink.href = imgInfo.fullsize || imgInfo.url;
                imgLink.target = '_blank';
                imgLink.rel = 'noopener noreferrer';
                imgLink.setAttribute('aria-label', 'View reply image');
                imgLink.addEventListener('click', e => e.stopPropagation());

                const img = document.createElement('img');
                img.src = imgInfo.url; // Use thumb/small version in replies
                img.alt = Utils.escapeHtml(imgInfo.alt || 'Reply image');
                img.loading = 'lazy';
                img.onerror = () => { imgLink.style.display = 'none'; };

                imgLink.appendChild(img);
                replyImagesDiv.appendChild(imgLink);
            });

            replyContent.appendChild(replyHeader);
            replyContent.appendChild(replyText);
            if (replyImages.length > 0) replyContent.appendChild(replyImagesDiv);

            replyItemContent.appendChild(replyAvatar);
            replyItemContent.appendChild(replyContent);
            replyItemWrapper.appendChild(replyItemContent);
            replyLink.appendChild(replyItemWrapper);
            containerElement.appendChild(replyLink);

            // Render children recursively
            if (replyNode.replies && replyNode.replies.length > 0) {
                const sortedChildren = [...replyNode.replies].sort((a, b) =>
                    new Date(a?.post?.indexedAt || 0).getTime() - new Date(b?.post?.indexedAt || 0).getTime()
                );
                sortedChildren.forEach(childNode => {
                    renderSingleReply(childNode, depth + 1, containerElement);
                });
            }
        };

        // Process top-level replies
        if (thread && thread.replies && thread.replies.length > 0) {
            const sortedTopLevel = [...thread.replies].sort((a, b) =>
                new Date(a?.post?.indexedAt || 0).getTime() - new Date(b?.post?.indexedAt || 0).getTime()
            );
            sortedTopLevel.forEach(topLevelReplyNode => {
                renderSingleReply(topLevelReplyNode, 0, UI.repliesContainer);
            });
        }

        if (!hasVisibleReplies) { // Show "No replies" only if truly none were rendered (after label filtering)
            UI.noRepliesP.classList.remove('hidden');
            UI.noRepliesP.textContent = 'No replies yet.';
            // Ensure heading is just "Replies" if nothing was rendered, even if official count > 0
            if (officialReplyCount > 0) {
                repliesHeading.textContent = 'Replies';
            }
        } else {
            UI.noRepliesP.classList.add('hidden');
        }
    },

    hideDetailView: () => {
        UI.detailView.classList.add('hidden');
        document.body.style.overflow = ''; // Restore body scroll

        // Clear dynamic content
        UI.authorInfoDiv.innerHTML = '';
        UI.postTextDiv.innerHTML = '';
        UI.externalEmbedDiv.innerHTML = '';
        UI.externalEmbedDiv.classList.add('hidden');
        UI.repliesContainer.innerHTML = '';
        UI.noRepliesP.classList.add('hidden');

        // Clean up media players/carousels
        Carousel.cleanup();
        VideoPlayer.cleanup();

        if (UI.detailImageCarousel) UI.detailImageCarousel.classList.add('hidden');
        if (UI.detailVideoPlayerContainer) UI.detailVideoPlayerContainer.classList.add('hidden');

        // If a grid layout exists, trigger relayout in case hiding detail view affects it
        if (App.masonryInstance) {
            window.requestAnimationFrame(() => {
                if (App.masonryInstance) {
                    try { App.masonryInstance.layout(); } catch (e) { console.error("Error during layout on detail hide:", e) }
                }
            });
        }
    },

    // --- Loading/Error/Search methods remain the same ---
    showLoading: () => {
        UI.loadingIndicator.classList.remove('hidden');
        UI.errorIndicator.classList.add('hidden'); // Ensure error is hidden when loading starts
        UI.pageOverlay.classList.remove('hidden');
    },

    hideLoading: () => {
        UI.loadingIndicator.classList.add('hidden');
        // Only hide overlay if error isn't also showing
        if (UI.errorIndicator.classList.contains('hidden')) {
            UI.pageOverlay.classList.add('hidden');
        }
    },

    showError: (message) => {
        UI.errorMessageSpan.textContent = message || 'An unknown error occurred.';
        UI.errorIndicator.classList.remove('hidden');
        UI.loadingIndicator.classList.add('hidden'); // Ensure loading is hidden when error shows
        UI.pageOverlay.classList.remove('hidden'); // Ensure overlay is visible for error
    },

    hideError: () => {
        UI.errorIndicator.classList.add('hidden');
        // Only hide overlay if loading isn't also showing
        if (UI.loadingIndicator.classList.contains('hidden')) {
            UI.pageOverlay.classList.add('hidden');
        }
    },

    showSearchPopup: () => {
        UI.searchError.classList.add('hidden');
        UI.searchInput.value = '';
        UI.searchPopup.classList.remove('hidden');
        UI.searchInput.focus();
        document.body.style.overflow = 'hidden'; // Prevent body scroll when popup open
    },

    hideSearchPopup: () => {
        UI.searchPopup.classList.add('hidden');
        // Only restore body scroll if detail view isn't also open
        if (UI.detailView.classList.contains('hidden')) {
            document.body.style.overflow = '';
        }
    },

    showSearchError: (message) => {
        UI.searchError.textContent = message;
        UI.searchError.classList.remove('hidden');
    },

    renderSearchProfileHeader: (profile) => {
        if (!profile || !UI.searchProfileHeader) { UI.clearSearchProfileHeader(); return; }
        const profileUrl = Utils.createBskyProfileUrl(profile.did || profile.handle);
        UI.searchProfileHeader.innerHTML = `
             <a href="${profileUrl}" target="_blank" rel="noopener noreferrer">
                <img src="${profile.avatar || './assets/placeholder-avatar.png'}" alt="" class="search-profile-avatar" loading="lazy" onerror="this.src='./assets/placeholder-avatar.png'">
             </a>
             <div class="search-profile-details">
                 <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="search-profile-display-name">${Utils.escapeHtml(profile.displayName || profile.handle)}</a>
                 <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="search-profile-handle">@${profile.handle}</a>
             </div>
         `;
        UI.searchProfileHeader.classList.remove('hidden');
        UI.clearDirectSearchHeader(); // Ensure only one header shows
    },

    clearSearchProfileHeader: () => {
        if (UI.searchProfileHeader) {
            UI.searchProfileHeader.innerHTML = ''; UI.searchProfileHeader.classList.add('hidden');
        }
    },

    renderDirectSearchHeader: (name, url) => {
        if (!UI.directSearchHeader) return;
        const urlLink = `<a href="${Utils.escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${Utils.escapeHtml(url)}</a>`;
        UI.directSearchHeader.innerHTML = `
            <p>Showing results for: <strong>${Utils.escapeHtml(name)}</strong></p>
            <p class="direct-search-url">(${urlLink})</p>
         `;
        UI.directSearchHeader.classList.remove('hidden');
        UI.clearSearchProfileHeader(); // Ensure only one header shows
    },

    clearDirectSearchHeader: () => {
        if (UI.directSearchHeader) {
            UI.directSearchHeader.innerHTML = ''; UI.directSearchHeader.classList.add('hidden');
        }
    },

    showFeedEndMessage: (message) => { UI.feedEndMessage.textContent = message; UI.feedEndMessage.classList.remove('hidden'); },
    hideFeedEndMessage: () => { UI.feedEndMessage.classList.add('hidden'); }
};