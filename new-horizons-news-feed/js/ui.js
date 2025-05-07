import { timeAgo, formatNumber, copyToClipboard, processFacets, debounce, showNotification } from './utils.js';
import { DEFAULT_THUMB, DEFAULT_AVATAR, FEED_URIS } from './config.js';
import { appState } from './state.js';
import * as api from './api.js';

const contentArea = document.getElementById('content-area');
const loader = document.getElementById('loader');

const modalOverlay = document.getElementById('modal-overlay');
const modalContent = document.getElementById('modal-content');
const modalCloseBtn = document.getElementById('modal-close-btn');
const modalHeaderEl = document.getElementById('modal-header');
const modalBody = document.getElementById('modal-body');
const modalLoader = document.getElementById('modal-loader');
const modalLoadMoreBtn = document.getElementById('modal-load-more-btn');

let currentSourceSearchTerm = '';

export function showLoader(isModal = false, message = 'Loading content...') {
    if (isModal) {
        modalLoader.innerHTML = `<i class="ph-bold ph-spinner-gap"></i> ${message}`;
        modalLoader.style.display = 'block';
    } else {
        loader.innerHTML = `<i class="ph-bold ph-spinner-gap"></i> ${message}`;
        loader.style.display = 'block';
    }
}

export function hideLoader(isModal = false) {
    if (isModal) modalLoader.style.display = 'none';
    else loader.style.display = 'none';
}

export function renderSubTabs() {
    const subTabsContainer = document.querySelector('.sub-tabs-container');
    subTabsContainer.innerHTML = '';
    let tabs;

    if (appState.currentMainTab === 'news') {
        tabs = [
            { id: 'recent', label: 'Recent' },
            { id: 'trending', label: 'Trending' },
            { id: 'sources', label: 'Sources' }
        ];
    } else {
        tabs = [
            { id: 'recent', label: 'Recent' },
            { id: 'trending', label: 'Trending' },
            { id: 'techmeme', label: 'Techmeme' },
            { id: 'sources', label: 'Sources' }
        ];
    }

    tabs.forEach(tab => {
        const button = document.createElement('button');
        button.classList.add('sub-tab-button');
        button.dataset.subTab = tab.id;
        button.textContent = tab.label;
        if (tab.id === appState.currentSubTab) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => handleSubTabClick(tab.id));
        subTabsContainer.appendChild(button);
    });
}

async function handleSubTabClick(subTabId) {
    appState.currentSubTab = subTabId;
    appState.currentSourceUser = null;
    document.querySelectorAll('.sub-tab-button').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.sub-tab-button[data-sub-tab="${subTabId}"]`).classList.add('active');

    contentArea.innerHTML = '';
    resetCursorsForCurrentView(false);

    if (subTabId === 'sources') {
        openSourcesModal();
    } else {
        await loadPosts(true);

        // Save the tab state when changing sub-tabs
        // This should be defined in main.js - we'll call it if it exists
        if (typeof saveTabState === 'function') {
            saveTabState();
        } else {
            // If the function doesn't exist yet, use localStorage directly
            try {
                const state = {
                    mainTab: appState.currentMainTab,
                    subTab: appState.currentSubTab
                };
                localStorage.setItem('tabState', JSON.stringify(state));
            } catch (e) {
                console.error("Error saving tab state:", e);
            }
        }
    }
}

export function clearContent() {
    contentArea.innerHTML = '';
}

export function createPostCard(feedItem) {
    if (!feedItem || !feedItem.post) {
        return null;
    }

    const post = feedItem.post;
    const author = post.author;
    const record = post.record;

    if (appState.currentSubTab === 'techmeme') {
        return createTechmemePostCard(post, feedItem.replyCount, feedItem.repostCount, feedItem.likeCount, feedItem.quoteCount);
    }

    let viewEmbedData = null;
    if (feedItem.embed &&
        feedItem.embed.$type === 'app.bsky.embed.external#view' &&
        feedItem.embed.external &&
        feedItem.embed.external.uri &&
        feedItem.embed.external.title &&
        feedItem.embed.external.thumb) {
        viewEmbedData = feedItem.embed.external;
    } else if (post.embed &&
        post.embed.$type === 'app.bsky.embed.external#view' &&
        post.embed.external &&
        post.embed.external.uri &&
        post.embed.external.title &&
        post.embed.external.thumb) {
        viewEmbedData = post.embed.external;
    }

    if (!viewEmbedData) {
        return null;
    }

    const card = document.createElement('div');
    card.classList.add('post-card');
    card.dataset.uri = post.uri;

    const bskyPostUrl = `https://bsky.app/profile/${author.handle}/post/${post.uri.split('/').pop()}`;
    const externalUri = viewEmbedData.uri;

    // --- Main Content Block (Thumb, Title, Description - linked) ---
    const mainContentLink = document.createElement('a');
    mainContentLink.classList.add('main-content-link');
    mainContentLink.href = externalUri;
    mainContentLink.target = '_blank';
    mainContentLink.rel = 'noopener noreferrer';

    // 1. Thumb with metrics
    const thumbContainer = document.createElement('div');
    thumbContainer.classList.add('post-thumb-container');
    const thumbImg = document.createElement('img');
    thumbImg.classList.add('post-thumb');
    thumbImg.src = viewEmbedData.thumb;
    thumbImg.alt = viewEmbedData.title || 'Post thumbnail';
    thumbImg.onerror = (e) => { e.target.src = DEFAULT_THUMB; };
    thumbContainer.appendChild(thumbImg);

    // Like and Repost metrics inside thumb, bottom-left
    if (feedItem.likeCount > 0 || feedItem.repostCount > 0) {
        const thumbMetrics = document.createElement('div');
        thumbMetrics.classList.add('post-thumb-metrics');
        let metricsHTML = '';
        if (feedItem.likeCount > 0) {
            metricsHTML += `<span><i class="ph-fill ph-heart"></i> ${formatNumber(feedItem.likeCount)}</span>`;
        }
        if (feedItem.repostCount > 0) {
            metricsHTML += `<span><i class="ph ph-repeat"></i> ${formatNumber(feedItem.repostCount)}</span>`;
        }
        thumbMetrics.innerHTML = metricsHTML;
        thumbContainer.appendChild(thumbMetrics);
    }
    mainContentLink.appendChild(thumbContainer);

    // 2. Title
    const titleEl = document.createElement('h3');
    titleEl.classList.add('post-title');
    titleEl.textContent = viewEmbedData.title;
    mainContentLink.appendChild(titleEl);

    // 3. Description
    if (viewEmbedData.description) {
        const descriptionEl = document.createElement('p');
        descriptionEl.classList.add('post-description');
        descriptionEl.textContent = viewEmbedData.description;
        mainContentLink.appendChild(descriptionEl);
    }
    card.appendChild(mainContentLink);

    // --- Author Header Row (Below Thumb/Title/Description block) ---
    const postHeaderRow = document.createElement('div');
    postHeaderRow.classList.add('post-header-row');

    const authorInfo = document.createElement('div');
    authorInfo.classList.add('author-info');
    authorInfo.innerHTML = `
        <a href="https://bsky.app/profile/${author.handle}" target="_blank" rel="noopener noreferrer" class="author-avatar-link">
            <img src="${author.avatar || DEFAULT_AVATAR}" alt="${author.displayName || author.handle}'s avatar" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'">
        </a>
        <div class="author-details">
            <a href="https://bsky.app/profile/${author.handle}" target="_blank" rel="noopener noreferrer" class="handle-link">
                <span class="handle-suffix">@${author.handle}</span>
                ${author.verification?.verifiedStatus === 'valid' ? '<i class="ph-fill ph-seal-check verification-tick" title="Verified"></i>' : ''}
            </a>
            <span class="time-ago">${timeAgo(record.createdAt)}</span>
        </div>
    `;

    const postHeaderActions = document.createElement('div');
    postHeaderActions.classList.add('post-header-actions');

    const copyPostLinkBtn = document.createElement('button');
    copyPostLinkBtn.classList.add('icon-button');
    copyPostLinkBtn.title = "Copy Bluesky Post Link";
    copyPostLinkBtn.innerHTML = `<i class="ph ph-link"></i>`;
    copyPostLinkBtn.onclick = (e) => {
        e.stopPropagation();
        copyToClipboard(bskyPostUrl, 'post');
    };

    const copyExternalLinkBtn = document.createElement('button');
    copyExternalLinkBtn.classList.add('icon-button');
    copyExternalLinkBtn.title = "Copy External Link";
    copyExternalLinkBtn.innerHTML = `<i class="ph ph-globe"></i>`;
    copyExternalLinkBtn.onclick = (e) => {
        e.stopPropagation();
        copyToClipboard(externalUri, 'article');
    };

    postHeaderActions.appendChild(copyPostLinkBtn);
    postHeaderActions.appendChild(copyExternalLinkBtn);

    postHeaderRow.appendChild(authorInfo);
    postHeaderRow.appendChild(postHeaderActions);
    card.appendChild(postHeaderRow);

    // --- Interaction Buttons Row (Below Header) ---
    const interactionButtonsRow = document.createElement('div');
    interactionButtonsRow.classList.add('interaction-buttons-row');

    // Make sure we're checking the specific properties for interactions
    const replyCount = feedItem.replyCount || 0;
    const quoteCount = feedItem.quoteCount || 0;

    let hasInteractions = false;

    if (replyCount > 0) {
        const replyBtn = document.createElement('button');
        replyBtn.classList.add('interaction-button');
        replyBtn.innerHTML = `<i class="ph ph-chat-centered"></i> View ${replyCount === 1 ? 'reply' : `${formatNumber(replyCount)} replies`}`;
        replyBtn.onclick = (e) => {
            e.stopPropagation();
            openRepliesModal(post.uri);
        };
        interactionButtonsRow.appendChild(replyBtn);
        hasInteractions = true;
    }

    if (quoteCount > 0) {
        const quoteBtn = document.createElement('button');
        quoteBtn.classList.add('interaction-button');
        quoteBtn.innerHTML = `<i class="ph ph-quotes"></i> View ${quoteCount === 1 ? 'quote' : `${formatNumber(quoteCount)} quotes`}`;
        quoteBtn.onclick = (e) => {
            e.stopPropagation();
            openQuotesModal(post.uri);
        };
        interactionButtonsRow.appendChild(quoteBtn);
        hasInteractions = true;
    }

    if (!hasInteractions) {
        const noInteractionsText = document.createElement('p');
        noInteractionsText.classList.add('no-interactions');
        noInteractionsText.textContent = 'No interactions yet';
        interactionButtonsRow.appendChild(noInteractionsText);
    }

    card.appendChild(interactionButtonsRow);
    return card;
}

function createTechmemePostCard(post, replyCount, repostCount, likeCount, quoteCount) {
    const author = post.author;
    const record = post.record;

    // Check if metrics are directly on the post object if not provided
    if (replyCount === undefined && post.replyCount !== undefined) {
        replyCount = post.replyCount;
    }
    if (repostCount === undefined && post.repostCount !== undefined) {
        repostCount = post.repostCount;
    }
    if (likeCount === undefined && post.likeCount !== undefined) {
        likeCount = post.likeCount;
    }
    if (quoteCount === undefined && post.quoteCount !== undefined) {
        quoteCount = post.quoteCount;
    }

    // Ensure we have numeric values for all counts
    replyCount = parseInt(replyCount || 0, 10);
    repostCount = parseInt(repostCount || 0, 10);
    likeCount = parseInt(likeCount || 0, 10);
    quoteCount = parseInt(quoteCount || 0, 10);

    console.log("Techmeme post metrics:", post.uri, { replyCount, repostCount, likeCount, quoteCount });

    const card = document.createElement('div');
    card.classList.add('post-card', 'techmeme-post');
    card.dataset.uri = post.uri;

    const bskyPostUrl = `https://bsky.app/profile/${author.handle}/post/${post.uri.split('/').pop()}`;

    // 1. Main Content (Text) for Techmeme
    const postBody = document.createElement('div');
    postBody.classList.add('post-body-techmeme');
    const textContent = document.createElement('div');
    textContent.classList.add('post-text-content');
    textContent.innerHTML = processFacets(record.text, record.facets);
    postBody.appendChild(textContent);
    card.appendChild(postBody);

    // 2. Author Header Row (Below Text Content)
    const postHeaderRow = document.createElement('div');
    postHeaderRow.classList.add('post-header-row');

    const authorInfo = document.createElement('div');
    authorInfo.classList.add('author-info');
    authorInfo.innerHTML = `
        <a href="https://bsky.app/profile/${author.handle}" target="_blank" rel="noopener noreferrer" class="author-avatar-link">
            <img src="${author.avatar || DEFAULT_AVATAR}" alt="${author.displayName || author.handle}'s avatar" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'">
        </a>
        <div class="author-details">
            <a href="https://bsky.app/profile/${author.handle}" target="_blank" rel="noopener noreferrer" class="handle-link">
                <span class="handle-suffix">@${author.handle}</span>
                ${author.verification?.verifiedStatus === 'valid' ? '<i class="ph-fill ph-seal-check verification-tick" title="Verified"></i>' : ''}
            </a>
            <span class="time-ago">${timeAgo(record.createdAt)}</span>
        </div>
    `;

    const postHeaderActions = document.createElement('div');
    postHeaderActions.classList.add('post-header-actions', 'techmeme-header-actions');

    const metricsContainer = document.createElement('div');
    metricsContainer.classList.add('techmeme-metrics');
    if (likeCount > 0) metricsContainer.innerHTML += `<span><i class="ph-fill ph-heart"></i> ${formatNumber(likeCount)}</span>`;
    if (repostCount > 0) metricsContainer.innerHTML += `<span><i class="ph ph-repeat"></i> ${formatNumber(repostCount)}</span>`;

    const copyPostLinkBtn = document.createElement('button');
    copyPostLinkBtn.classList.add('icon-button');
    copyPostLinkBtn.title = "Copy Bluesky Post Link";
    copyPostLinkBtn.innerHTML = `<i class="ph ph-link"></i>`;
    copyPostLinkBtn.onclick = (e) => { e.stopPropagation(); copyToClipboard(bskyPostUrl, 'post'); };

    if (metricsContainer.hasChildNodes()) {
        postHeaderActions.appendChild(metricsContainer);
    }
    postHeaderActions.appendChild(copyPostLinkBtn);

    postHeaderRow.appendChild(authorInfo);
    postHeaderRow.appendChild(postHeaderActions);
    card.appendChild(postHeaderRow);

    // 3. Interaction Buttons Row (Below Header)
    const interactionButtonsRow = document.createElement('div');
    interactionButtonsRow.classList.add('interaction-buttons-row');

    let hasInteractions = false;
    if (replyCount > 0) {
        const replyBtn = document.createElement('button');
        replyBtn.classList.add('interaction-button');
        replyBtn.innerHTML = `<i class="ph ph-chat-centered"></i> View ${replyCount === 1 ? 'reply' : `${formatNumber(replyCount)} replies`}`;
        replyBtn.onclick = (e) => { e.stopPropagation(); openRepliesModal(post.uri); };
        interactionButtonsRow.appendChild(replyBtn);
        hasInteractions = true;
    }
    if (quoteCount > 0) {
        const quoteBtn = document.createElement('button');
        quoteBtn.classList.add('interaction-button');
        quoteBtn.innerHTML = `<i class="ph ph-quotes"></i> View ${quoteCount === 1 ? 'quote' : `${formatNumber(quoteCount)} quotes`}`;
        quoteBtn.onclick = (e) => { e.stopPropagation(); openQuotesModal(post.uri); };
        interactionButtonsRow.appendChild(quoteBtn);
        hasInteractions = true;
    }

    if (!hasInteractions) {
        const noInteractionsText = document.createElement('p');
        noInteractionsText.classList.add('no-interactions');
        noInteractionsText.textContent = 'No interactions yet';
        interactionButtonsRow.appendChild(noInteractionsText);
    }
    card.appendChild(interactionButtonsRow);

    return card;
}


export function appendPosts(feedItems, isInitialLoad = false) {
    // Debug logging to see what's coming in
    console.log("AppendPosts received:", feedItems);

    if (isInitialLoad) {
        contentArea.innerHTML = '';
    }
    if (!feedItems || feedItems.length === 0) {
        if (isInitialLoad && contentArea.innerHTML === '') {
            contentArea.innerHTML = '<p class="no-posts">No posts found for this view.</p>';
        }
        return;
    }
    let postAppended = false;
    feedItems.forEach(feedItem => {
        // Log individual feed items to check for metrics
        console.log(`Feed item ${feedItem.post?.uri}:`, {
            replyCount: feedItem.replyCount,
            quoteCount: feedItem.quoteCount,
            likeCount: feedItem.likeCount,
            repostCount: feedItem.repostCount
        });

        const card = createPostCard(feedItem);
        if (card) {
            contentArea.appendChild(card);
            postAppended = true;
        }
    });
    if (isInitialLoad && !postAppended && contentArea.innerHTML === '') {
        contentArea.innerHTML = '<p class="no-posts">No posts match the display criteria for this view.</p>';
    }
}

function openModal() {
    modalOverlay.style.display = 'flex';
    modalBody.scrollTop = 0;

    // Block background scrolling when modal is open
    document.body.style.overflow = 'hidden';
}

export function closeModal() {
    modalOverlay.style.display = 'none';
    modalBody.innerHTML = '';
    modalHeaderEl.innerHTML = '';

    // Re-enable background scrolling when modal is closed
    document.body.style.overflow = '';

    // Reset app state for modal
    appState.currentPostUriForModal = null;
    appState.isModalLoading = false;
    modalLoadMoreBtn.style.display = 'none';
    hideLoader(true);

    // If we're in sources tab, go back to the previous tab
    if (appState.currentSubTab === 'sources') {
        // Default to 'recent' if no previous tab
        appState.currentSubTab = 'recent';
        document.querySelectorAll('.sub-tab-button').forEach(btn => {
            if (btn.dataset.subTab === 'recent') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        loadPosts(true);
    }
}

async function openSourcesModal() {
    appState.currentSubTab = 'sources';
    openModal();

    // We'll update the header after loading content when we have the list item count
    modalHeaderEl.innerHTML = `<h3>All Sources</h3>
                               <div class="sources-controls">
                                   <button id="toggle-verified" class="icon-button" title="Toggle verified accounts only">
                                       <i class="ph ph-seal-check"></i>
                                   </button>
                                   <button id="sort-toggle" class="icon-button" title="Sort alphabetically">
                                       <i class="ph ph-sort-ascending"></i>
                                   </button>
                                   <input type="search" id="source-search-input" placeholder="Search by handle or name...">
                               </div>`;

    // Add event listeners for the filter/sort buttons
    const toggleVerifiedBtn = document.getElementById('toggle-verified');
    const sortToggleBtn = document.getElementById('sort-toggle');

    if (toggleVerifiedBtn) {
        toggleVerifiedBtn.addEventListener('click', toggleVerifiedSourcesOnly);
    }

    if (sortToggleBtn) {
        sortToggleBtn.addEventListener('click', toggleSortOrder);
    }

    // Add document click event to reset sort when clicking outside sort button
    const documentClickHandler = (e) => {
        // If click is outside the sort button, reset sort
        if (e.target.id !== 'sort-toggle' && !e.target.closest('#sort-toggle') && sourceSortOrder !== null) {
            sourceSortOrder = null;
            const sortButton = document.getElementById('sort-toggle');
            if (sortButton) {
                sortButton.innerHTML = '<i class="ph ph-sort-ascending"></i>';
                sortButton.classList.remove('active');
                filterAndSortSources();
                showNotification('Default sort order');
            }
        }
    };

    // Remove any existing handler to prevent duplicates
    document.removeEventListener('click', documentClickHandler);
    document.addEventListener('click', documentClickHandler);

    // Add search functionality
    const searchInput = document.getElementById('source-search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            currentSourceSearchTerm = e.target.value.toLowerCase();
            filterAndSortSources();
        }, 300));
    }

    currentSourceSearchTerm = '';
    showVerifiedOnly = false;
    sourceSortOrder = null;
    await loadModalContent(true);
}

async function openRepliesModal(postUri) {
    // Find the post card with the matching URI to get the reply count
    const postCard = document.querySelector(`.post-card[data-uri="${postUri}"]`);
    let replyCount = 0;

    if (postCard) {
        // Try to find the reply button to extract the count
        const replyBtn = postCard.querySelector('.interaction-button i.ph-chat-centered');
        if (replyBtn && replyBtn.parentElement) {
            const btnText = replyBtn.parentElement.textContent;
            // Extract number from "View X replies"
            const countMatch = btnText.match(/View (\d+) replies/);
            if (countMatch && countMatch[1]) {
                replyCount = parseInt(countMatch[1], 10);
            } else if (btnText.includes('View reply')) {
                replyCount = 1;
            }
        }
    }

    appState.currentPostUriForModal = postUri;
    appState.cursors.modal_replies = null;

    const modalHeader = document.getElementById('modal-header');
    modalHeader.innerHTML = `<h3>Replies${replyCount > 0 ? ` (${formatNumber(replyCount)})` : ''}</h3>`;

    openModal();
    showLoader(true, 'Loading replies...');
    await loadModalContent(true, 'replies');
}

async function openQuotesModal(postUri) {
    // Find the post card with the matching URI to get the quote count
    const postCard = document.querySelector(`.post-card[data-uri="${postUri}"]`);
    let quoteCount = 0;

    if (postCard) {
        // Try to find the quote button to extract the count
        const quoteBtn = postCard.querySelector('.interaction-button i.ph-quotes');
        if (quoteBtn && quoteBtn.parentElement) {
            const btnText = quoteBtn.parentElement.textContent;
            // Extract number from "View X quotes"
            const countMatch = btnText.match(/View (\d+) quotes/);
            if (countMatch && countMatch[1]) {
                quoteCount = parseInt(countMatch[1], 10);
            } else if (btnText.includes('View quote')) {
                quoteCount = 1;
            }
        }
    }

    appState.currentPostUriForModal = postUri;
    appState.cursors.modal_quotes = null;

    const modalHeader = document.getElementById('modal-header');
    modalHeader.innerHTML = `<h3>Quotes${quoteCount > 0 ? ` (${formatNumber(quoteCount)})` : ''}</h3>`;

    openModal();
    showLoader(true, 'Loading quotes...');
    await loadModalContent(true, 'quotes');
}

export async function loadModalContent(isInitialLoad = false, type = appState.currentSubTab) {
    if (appState.isModalLoading) return;

    appState.isModalLoading = true;
    showLoader(true);
    modalLoader.innerHTML = '<i class="ph-bold ph-spinner-gap"></i> Loading sources...';

    try {
        let data;
        let allItems = [];

        if (type === 'sources') {
            // Load sources into modal
            const feedURIs = FEED_URIS[appState.currentMainTab];
            const sourceListURI = feedURIs.sources_list;

            // First load with null cursor
            let cursor = null;
            let hasMoreItems = true;

            // Load all sources by paginating through all available items
            while (hasMoreItems) {
                showLoader(true, `Loading sources... ${allItems.length > 0 ? `(${allItems.length} loaded)` : ''}`);

                data = await api.getListMembers(
                    sourceListURI,
                    cursor,
                    100 // Maximum allowed by API
                );

                if (data && data.items && data.items.length > 0) {
                    allItems = [...allItems, ...data.items];
                    cursor = data.cursor;
                    hasMoreItems = !!cursor;
                    console.log(`Loaded ${allItems.length} sources so far. ${hasMoreItems ? 'More available.' : 'All sources loaded.'}`);
                } else {
                    hasMoreItems = false;
                }
            }

            console.log(`All sources loaded: ${allItems.length} total items`);
            data = { items: allItems, list: data.list };

            if (isInitialLoad) {
                modalBody.innerHTML = '';

                // Check if list has item count and display it in the header
                if (data.list && data.list.listItemCount) {
                    modalHeaderEl.innerHTML = `<h3>All Sources (${allItems.length})</h3>
                        <div class="sources-controls">
                            <button id="toggle-verified" class="icon-button" title="Toggle verified accounts only">
                                <i class="ph ph-seal-check"></i>
                            </button>
                            <button id="sort-toggle" class="icon-button" title="Sort alphabetically">
                                <i class="ph ph-sort-ascending"></i>
                            </button>
                            <input type="search" id="source-search-input" placeholder="Search by handle or name...">
                        </div>`;

                    // Add event listeners for the new buttons
                    document.getElementById('toggle-verified').addEventListener('click', toggleVerifiedSourcesOnly);
                    document.getElementById('sort-toggle').addEventListener('click', toggleSortOrder);

                    // Add search input event listener
                    const searchInput = document.getElementById('source-search-input');
                    searchInput.addEventListener('input', debounce(async (e) => {
                        currentSourceSearchTerm = e.target.value.toLowerCase();
                        filterAndSortSources();
                    }, 300));
                }
            }

            if (data && data.items && data.items.length > 0) {
                renderSourceItems(data.items, isInitialLoad);
                // Always hide the load more button as we're loading all at once
                modalLoadMoreBtn.style.display = 'none';
            } else {
                if (isInitialLoad) {
                    modalBody.innerHTML = '<p class="error">No sources found.</p>';
                }
                modalLoadMoreBtn.style.display = 'none';
            }
        } else if (type === 'replies') {
            // Load post thread with replies
            const postUri = appState.currentPostUriForModal;
            if (!postUri) {
                throw new Error('No post URI specified for replies');
            }

            data = await api.getPostThread(postUri);

            if (isInitialLoad) {
                modalBody.innerHTML = '';
            }

            if (data && data.thread && data.thread.replies) {
                renderReplyQuoteItems(data.thread.replies, 'replies', isInitialLoad);

                // For replies from getPostThread, we don't have pagination
                // So we hide the load more button
                modalLoadMoreBtn.style.display = 'none';
            } else {
                if (isInitialLoad) {
                    modalBody.innerHTML = '<p class="error">No replies found.</p>';
                }
                modalLoadMoreBtn.style.display = 'none';
            }
        } else if (type === 'quotes') {
            // Load quotes
            const postUri = appState.currentPostUriForModal;
            if (!postUri) {
                throw new Error('No post URI specified for quotes');
            }

            // Use the proper parameter as per documentation
            // https://docs.bsky.app/docs/api/app-bsky-feed-get-quotes
            // limit should be between 1 and 100
            data = await api.getQuotes(
                postUri,
                isInitialLoad ? null : appState.cursors.modal_quotes,
                100 // Max value per API docs
            );

            if (isInitialLoad) {
                modalBody.innerHTML = '';
            }

            console.log("Quotes API response:", data);

            // Handle different response formats - the API might return 'posts' instead of 'quotes'
            const quoteItems = data.quotes || data.posts || [];

            if (quoteItems && quoteItems.length > 0) {
                renderReplyQuoteItems(quoteItems, 'quotes', isInitialLoad);

                if (data.cursor) {
                    appState.cursors.modal_quotes = data.cursor;
                    modalLoadMoreBtn.style.display = 'block';
                } else {
                    modalLoadMoreBtn.style.display = 'none';
                }
            } else {
                if (isInitialLoad) {
                    modalBody.innerHTML = '<p class="error">No quotes found.</p>';
                }
                modalLoadMoreBtn.style.display = 'none';
            }
        }
    } catch (error) {
        console.error(`Error loading modal content for ${type}:`, error);
        if (isInitialLoad) {
            modalBody.innerHTML = `<p class="error">Error loading content: ${error.message}</p>`;
        }
        modalLoadMoreBtn.style.display = 'none';
    } finally {
        appState.isModalLoading = false;
        hideLoader(true);
    }
}

// Add functions for sorting and filtering sources
let showVerifiedOnly = false;
let sourceSortOrder = null;
let originalSourceItems = [];

function toggleVerifiedSourcesOnly() {
    showVerifiedOnly = !showVerifiedOnly;
    const button = document.getElementById('toggle-verified');

    // First update the filter state
    if (showVerifiedOnly) {
        button.classList.add('active');
        console.log('Showing verified accounts only');
    } else {
        button.classList.remove('active');
        console.log('Showing all accounts (verified and unverified)');
    }

    // Apply the filter
    filterAndSortSources();

    // Show notification
    if (showVerifiedOnly) {
        showNotification('Showing verified sources only');
    } else {
        showNotification('Showing all sources');
    }
}

function toggleSortOrder() {
    const sortButton = document.getElementById('sort-toggle');

    // Toggle between ascending, descending, and null (default order)
    if (!sourceSortOrder) {
        sourceSortOrder = 'asc';
        sortButton.innerHTML = '<i class="ph ph-sort-ascending"></i>';
        sortButton.classList.add('active');
        showNotification('Sorted A to Z');
    } else if (sourceSortOrder === 'asc') {
        sourceSortOrder = 'desc';
        sortButton.innerHTML = '<i class="ph ph-sort-descending"></i>';
        sortButton.classList.add('active');
        showNotification('Sorted Z to A');
    } else {
        sourceSortOrder = null;
        sortButton.innerHTML = '<i class="ph ph-sort-ascending"></i>';
        sortButton.classList.remove('active');
        showNotification('Default sort order');
    }

    filterAndSortSources();
}

function filterAndSortSources() {
    // Apply filtering and sorting to the cached original items
    if (originalSourceItems.length === 0) return;

    let items = [...originalSourceItems];

    // Apply search term filtering
    if (currentSourceSearchTerm) {
        items = items.filter(item => {
            const displayName = (item.subject.displayName || '').toLowerCase();
            const handle = (item.subject.handle || '').toLowerCase();
            return displayName.includes(currentSourceSearchTerm) ||
                handle.includes(currentSourceSearchTerm);
        });
    }

    // Filter verified items if needed
    if (showVerifiedOnly) {
        items = items.filter(item =>
            item.subject.verification &&
            item.subject.verification.verifiedStatus === 'valid'
        );
    }

    // Sort items if needed
    if (sourceSortOrder) {
        items.sort((a, b) => {
            const nameA = (a.subject.displayName || a.subject.handle || '').toLowerCase();
            const nameB = (b.subject.displayName || b.subject.handle || '').toLowerCase();
            return sourceSortOrder === 'asc'
                ? nameA.localeCompare(nameB)
                : nameB.localeCompare(nameA);
        });
    }

    // Render the filtered/sorted items
    modalBody.innerHTML = '';
    if (items.length === 0) {
        modalBody.innerHTML = '<p>No sources match your criteria.</p>';
    } else {
        renderSourceItems(items, true, false);
    }

    // Update the header with the correct count after filtering
    const modalHeader = document.getElementById('modal-header');
    const h3 = modalHeader?.querySelector('h3');

    if (h3) {
        if (showVerifiedOnly) {
            h3.textContent = `Verified Sources (${items.length})`;
        } else {
            h3.textContent = `All Sources (${originalSourceItems.length})`;
        }
    }
}

function renderSourceItems(sourceItems, isInitialLoad, storeOriginal = true) {
    if (isInitialLoad) modalBody.innerHTML = '';
    if (!sourceItems || sourceItems.length === 0) {
        if (isInitialLoad) modalBody.innerHTML = '<p>No sources found.</p>';
        return;
    }

    // Store the original items for filtering/sorting if needed
    if (storeOriginal) {
        originalSourceItems = [...sourceItems];
    }

    const fragment = document.createDocumentFragment();
    const verifierDids = new Set();
    sourceItems.forEach(item => {
        if (item.subject?.verification?.verifications?.[0]?.issuer) {
            verifierDids.add(item.subject.verification.verifications[0].issuer);
        }
    });

    api.getProfiles(Array.from(verifierDids)).then(verifierProfilesData => {
        const verifierMap = new Map(verifierProfilesData.profiles.map(p => [p.did, p]));

        sourceItems.forEach(item => {
            const source = item.subject;
            const listItem = document.createElement('div');
            listItem.classList.add('source-item');
            listItem.dataset.did = source.did;
            listItem.dataset.handle = source.handle;

            let verificationInfo = '';
            if (source.verification && source.verification.verifiedStatus === 'valid' && source.verification.verifications && source.verification.verifications[0]) {
                const verification = source.verification.verifications[0];
                const issuerProfile = verifierMap.get(verification.issuer);
                const issuerName = issuerProfile ? (issuerProfile.displayName || issuerProfile.handle) : verification.issuer.substring(0, 15) + '...';
                // Format date as DD MMM YYYY, HH:MM AM/PM
                const verificationDate = new Date(verification.createdAt);
                const day = verificationDate.getDate().toString().padStart(2, '0');
                const month = verificationDate.toLocaleString('en-US', { month: 'short' });
                const year = verificationDate.getFullYear();
                const hours = verificationDate.getHours() % 12 || 12;
                const minutes = verificationDate.getMinutes().toString().padStart(2, '0');
                const ampm = verificationDate.getHours() >= 12 ? 'PM' : 'AM';
                const formattedDate = `${day} ${month} ${year}, ${hours}:${minutes} ${ampm}`;

                verificationInfo = `<p class="source-meta">Verified by: <a href="https://bsky.app/profile/${verification.issuer}" target="_blank">${issuerName}</a> on ${formattedDate}</p>`;
            }

            listItem.innerHTML = `
                <div class="source-header">
                    <img src="${source.avatar || DEFAULT_AVATAR}" alt="${source.displayName || source.handle}" class="avatar" onerror="this.src='${DEFAULT_AVATAR}'">
                    <div class="source-details">
                        <span class="display-name">${source.displayName || source.handle}</span>
                        <span class="handle">@${source.handle}</span>
                        ${source.verification && source.verification.verifiedStatus === 'valid' ? '<i class="ph-fill ph-seal-check verification-tick" title="Verified"></i>' : ''}
                    </div>
                </div>
                <p class="source-meta">DID: ${source.did} • Joined: ${timeAgo(source.createdAt)} ago</p>
                ${verificationInfo}
                ${source.description ? `<p class="source-description">${processFacets(source.description, source.descriptionFacets || [])}</p>` : ''}
            `;
            listItem.addEventListener('click', () => {
                appState.currentSourceUser = { did: source.did, handle: source.handle };
                closeModal();
                appState.currentSubTab = 'source-posts';
                document.querySelectorAll('.sub-tab-button').forEach(btn => btn.classList.remove('active'));
                contentArea.innerHTML = '';
                resetCursorsForCurrentView(false);
                loadPosts(true);
            });
            fragment.appendChild(listItem);
        });
        modalBody.appendChild(fragment);
    });
}


function renderReplyQuoteItems(items, type, isInitialLoad) {
    if (!items || items.length === 0) {
        if (isInitialLoad) {
            modalBody.innerHTML = `<p class="error">No ${type} found.</p>`;
        }
        return;
    }

    const fragment = document.createDocumentFragment();

    items.forEach(item => {
        // Items might be raw posts or have a post property
        const post = item.post || item;
        if (!post) return;

        const author = post.author;
        const record = post.record;

        if (!author || !record) return;

        const itemElement = document.createElement('div');
        itemElement.className = type === 'replies' ? 'reply-item' : 'quote-item';

        // Author section
        const authorHTML = `
            <div class="source-header">
                <a href="https://bsky.app/profile/${author.handle}" target="_blank" rel="noopener noreferrer">
                    <img src="${author.avatar || DEFAULT_AVATAR}" class="avatar" alt="${author.displayName || author.handle}" onerror="this.src='${DEFAULT_AVATAR}'">
                </a>
                <div class="source-details">
                    <a href="https://bsky.app/profile/${author.handle}" target="_blank" rel="noopener noreferrer">
                        <span class="handle">@${author.handle}</span>
                        ${author.verification?.verifiedStatus === 'valid' ? '<i class="ph-fill ph-seal-check verification-tick" title="Verified"></i>' : ''}
                    </a>
                    <div class="time-ago">${timeAgo(record.createdAt)}</div>
                </div>
            </div>
        `;

        // Post content
        let contentHTML = '';
        let hasContent = false;

        // Check if this is an empty post (no text content)
        const isEmpty = !record.text || record.text.trim() === '';

        if (record.text && record.text.trim() !== '') {
            contentHTML += `<div class="popup-text-content">${processFacets(record.text, record.facets)}</div>`;
            hasContent = true;
        }

        // Handle embeds (images, videos, external links)
        if (post.embed) {
            // Image embeds - support multiple images in a grid
            if (post.embed.$type === 'app.bsky.embed.images#view' && post.embed.images && post.embed.images.length > 0) {
                const imageCount = Math.min(post.embed.images.length, 4); // Max 4 images

                // Create a grid layout based on the number of images
                let gridClass = 'image-grid';
                if (imageCount === 1) gridClass += ' single';
                else if (imageCount === 2) gridClass += ' two-images';
                else if (imageCount === 3) gridClass += ' three-images';
                else if (imageCount === 4) gridClass += ' four-images';

                contentHTML += `<div class="${gridClass}">`;

                post.embed.images.slice(0, 4).forEach((img, index) => {
                    contentHTML += `
                        <div class="grid-image-container">
                            <a href="${img.fullsize}" target="_blank" rel="noopener noreferrer">
                                <img src="${img.thumb}" alt="${img.alt || `Image ${index + 1}`}" 
                                    class="grid-image" loading="lazy">
                            </a>
                        </div>
                    `;
                });

                contentHTML += `</div>`;
            }
            // External link embeds
            else if (post.embed.$type === 'app.bsky.embed.external#view' && post.embed.external) {
                const external = post.embed.external;
                contentHTML += `
                    <a href="${external.uri}" class="embedded-external-card" target="_blank" rel="noopener noreferrer">
                        ${external.thumb ? `<img src="${external.thumb}" alt="${external.title || 'External content'}" class="thumb">` : ''}
                        <div class="text-content">
                            <div class="title">${external.title || external.uri}</div>
                            ${external.description ? `<div class="description">${external.description}</div>` : ''}
                        </div>
                    </a>
                `;
            }
            // Record embeds (quotes within quotes/replies, handled differently)
            else if (post.embed.$type === 'app.bsky.embed.record#view' && post.embed.record) {
                // Only show secondary text for replies, not for quotes
                if (type === 'replies') {
                    contentHTML += `<div class="post-text-secondary">Quoted a post from ${post.embed.record.author?.handle || 'another user'}</div>`;
                }
                // For quotes, we don't show the post-text-secondary section
            }
            // Video embeds
            else if (post.embed.$type === 'app.bsky.embed.recordWithMedia#view' &&
                post.embed.media?.$type === 'app.bsky.embed.external#view' &&
                post.embed.media?.external?.uri?.includes('.m3u8')) {
                // HLS video embed
                const videoId = `video-${Math.random().toString(36).substring(2, 11)}`;
                contentHTML += `
                    <div class="video-container">
                        <video id="${videoId}" controls class="embedded-video" playsinline></video>
                    </div>
                `;

                // We'll initialize HLS player after adding to the DOM
                setTimeout(() => {
                    const videoElement = document.getElementById(videoId);
                    if (videoElement && Hls.isSupported()) {
                        const hls = new Hls();
                        hls.loadSource(post.embed.media.external.uri);
                        hls.attachMedia(videoElement);
                    } else if (videoElement && videoElement.canPlayType('application/vnd.apple.mpegurl')) {
                        // Native HLS support (Safari)
                        videoElement.src = post.embed.media.external.uri;
                    }
                }, 100);
            }
            // Regular video embeds (if they exist)
            else if (post.embed.$type === 'app.bsky.embed.external#view' &&
                post.embed.external?.uri?.endsWith('.mp4')) {
                contentHTML += `
                    <div class="video-container">
                        <video controls class="embedded-video" playsinline>
                            <source src="${post.embed.external.uri}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                `;
            }
        }

        // Check if this is an empty quote post (no text content)
        if (isEmpty && (!post.embed || post.embed.$type === 'app.bsky.embed.record#view')) {
            // Create a link to the original post
            const postUri = post.uri;
            const postId = postUri.split('/').pop();
            const postUrl = `https://bsky.app/profile/${author.handle}/post/${postId}`;

            // Add a subtle message for empty quote posts
            contentHTML += `<div class="popup-text-content empty-quote"><a href="${postUrl}" target="_blank" rel="noopener noreferrer"><i>User quote posted</i></a></div>`;
            hasContent = true;
        }

        itemElement.innerHTML = `${authorHTML}<div class="popup-post-container">${contentHTML}</div>`;
        fragment.appendChild(itemElement);
    });

    modalBody.appendChild(fragment);
}


export async function loadPosts(isInitialLoad = false) {
    if (appState.isLoading) return;
    appState.isLoading = true;

    let loadingMessage = 'Loading posts...';
    if (appState.currentSourceUser) {
        loadingMessage = `Loading posts from @${appState.currentSourceUser.handle}...`;
    } else if (appState.currentSubTab === 'recent') {
        loadingMessage = 'Loading recent posts...';
    } else if (appState.currentSubTab === 'trending') {
        loadingMessage = 'Loading trending posts...';
    } else if (appState.currentSubTab === 'techmeme') {
        loadingMessage = 'Loading Techmeme posts...';
    }

    showLoader(false, loadingMessage);

    let data;
    let feedForDisplay = [];
    let cursorKeyPart = `${appState.currentMainTab}_${appState.currentSubTab}`;
    let currentCursor = null;
    if (appState.currentSourceUser) {
        cursorKeyPart = 'activeSourcePosts';
    } else if (appState.currentSubTab === 'source-posts') {
        cursorKeyPart = 'activeSourcePosts';
    }

    try {
        if (appState.currentSourceUser) {
            currentCursor = appState.cursors.activeSourcePosts;
            data = await api.getAuthorFeed(appState.currentSourceUser.handle, isInitialLoad ? null : currentCursor);
        } else {
            switch (appState.currentMainTab) {
                case 'news':
                    if (appState.currentSubTab === 'recent') {
                        currentCursor = appState.cursors.news_recent;
                        data = await api.getListFeed(FEED_URIS.news.recent, isInitialLoad ? null : currentCursor);
                    } else if (appState.currentSubTab === 'trending') {
                        currentCursor = appState.cursors.news_trending;
                        data = await api.getFeed(FEED_URIS.news.trending, isInitialLoad ? null : currentCursor);
                    }
                    break;
                case 'tech':
                    if (appState.currentSubTab === 'recent') {
                        currentCursor = appState.cursors.tech_recent;
                        data = await api.getListFeed(FEED_URIS.tech.recent, isInitialLoad ? null : currentCursor);
                    } else if (appState.currentSubTab === 'trending') {
                        currentCursor = appState.cursors.tech_trending;
                        data = await api.getFeed(FEED_URIS.tech.trending, isInitialLoad ? null : currentCursor);
                    } else if (appState.currentSubTab === 'techmeme') {
                        currentCursor = appState.cursors.tech_techmeme;
                        data = await api.getAuthorFeed(FEED_URIS.tech.techmeme_actor, isInitialLoad ? null : currentCursor);
                    }
                    break;
            }
        }

        // Debug the feed data to understand its structure
        console.log("Raw API response:", data);

        // Process the data based on the API endpoint
        if (data) {
            if (data.feed) {
                // Standard feed response
                feedForDisplay = data.feed.map(item => {
                    // Process feed item to ensure interaction metrics are available
                    const processedItem = { ...item };

                    // Check if metrics are available at the top level or inside post
                    if (item.post) {
                        // Some endpoints have metrics at the top level
                        if (typeof processedItem.replyCount === 'undefined') {
                            processedItem.replyCount = item.post.replyCount || 0;
                        }
                        if (typeof processedItem.likeCount === 'undefined') {
                            processedItem.likeCount = item.post.likeCount || 0;
                        }
                        if (typeof processedItem.repostCount === 'undefined') {
                            processedItem.repostCount = item.post.repostCount || 0;
                        }
                        if (typeof processedItem.quoteCount === 'undefined') {
                            processedItem.quoteCount = item.post.quoteCount || 0;
                        }
                    }

                    console.log("Processed feed item:", processedItem);
                    return processedItem;
                });
            } else if (data.posts) {
                // Author feed might use 'posts' instead of 'feed'
                feedForDisplay = data.posts.map(post => {
                    return {
                        post: post,
                        replyCount: post.replyCount || 0,
                        likeCount: post.likeCount || 0,
                        repostCount: post.repostCount || 0,
                        quoteCount: post.quoteCount || 0
                    };
                });
            }
        }

        appendPosts(feedForDisplay, isInitialLoad);

        if (appState.currentSourceUser || appState.currentSubTab === 'source-posts') {
            appState.cursors.activeSourcePosts = data.cursor;
        } else {
            if (appState.cursors.hasOwnProperty(cursorKeyPart)) {
                appState.cursors[cursorKeyPart] = data.cursor;
            }
        }

    } catch (error) {
        console.error("Error loading posts:", error);
        if (isInitialLoad) contentArea.innerHTML = `<p class="error">Failed to load posts. Please try again.</p>`;
    } finally {
        hideLoader();
        appState.isLoading = false;
    }
}

function resetCursorsForCurrentView(isModalContext) {
    if (isModalContext) {
        if (appState.currentSubTab === 'sources') {
            const cursorKey = appState.currentMainTab === 'news' ? 'news_sources_list' : 'tech_sources_list';
            if (appState.cursors.hasOwnProperty(cursorKey)) {
                appState.cursors[cursorKey] = null;
            }
        } else if (appState.currentPostUriForModal) {
            appState.cursors.modal_replies = null;
            appState.cursors.modal_quotes = null;
        }
    } else {
        if (appState.currentSourceUser) {
            appState.cursors.activeSourcePosts = null;
        } else {
            const cursorKey = `${appState.currentMainTab}_${appState.currentSubTab}`;
            if (appState.cursors.hasOwnProperty(cursorKey)) {
                appState.cursors[cursorKey] = null;
            }
        }
    }
}

const mainContentScrollHandler = debounce(() => {
    if (appState.isLoading) return;

    let currentCursorKey = `${appState.currentMainTab}_${appState.currentSubTab}`;
    let hasMoreData = false;

    if (appState.currentSourceUser) {
        currentCursorKey = 'activeSourcePosts';
        hasMoreData = !!appState.cursors.activeSourcePosts;
    } else if (appState.currentSubTab === 'source-posts') {
        currentCursorKey = 'activeSourcePosts';
        hasMoreData = !!appState.cursors.activeSourcePosts;
    }
    else if (appState.cursors.hasOwnProperty(currentCursorKey)) {
        hasMoreData = !!appState.cursors[currentCursorKey];
    }

    if (!hasMoreData || appState.currentSubTab === 'sources') {
        return;
    }

    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 500;

    if (nearBottom) {
        loadPosts(false);
    }
}, 100);

window.addEventListener('scroll', mainContentScrollHandler);

const modalScrollHandler = debounce(() => {
    if (appState.isModalLoading) return;
    if (!modalOverlay || modalOverlay.style.display === 'none') return;

    const type = modalHeaderEl.textContent.toLowerCase().includes("replies") ? "replies" :
        modalHeaderEl.textContent.toLowerCase().includes("quotes") ? "quotes" :
            appState.currentSubTab === "sources" ? "sources" : null;

    if (!type) return;

    let cursorForModal;
    if (type === 'quotes') cursorForModal = appState.cursors.modal_quotes;
    else if (type === 'sources') cursorForModal = appState.currentMainTab === 'news' ? appState.cursors.news_sources_list : appState.cursors.tech_sources_list;

    if (!cursorForModal && (type === 'quotes' || type === 'sources')) {
        return;
    }

    const nearModalBottom = modalBody.scrollTop + modalBody.clientHeight >= modalBody.scrollHeight - 200;

    if (nearModalBottom && (type === 'quotes' || type === 'sources')) {
        loadModalContent(false, type);
    }
}, 100);

if (modalBody) {
    modalBody.addEventListener('scroll', modalScrollHandler);
}


modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (event) => {
    if (event.target === modalOverlay) {
        closeModal();
    }
});

export function initUI() {
    renderSubTabs();
    loadPosts(true);

    const loadMoreBtn = document.getElementById('load-more-btn');
    loadMoreBtn.addEventListener('click', () => loadPosts(false));

    // Modal close button
    modalCloseBtn.addEventListener('click', closeModal);

    // Modal overlay background click closes modal
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            closeModal();
        }
    });

    // Modal load more button
    modalLoadMoreBtn.addEventListener('click', () => {
        let type = 'sources';
        if (appState.currentPostUriForModal) {
            type = appState.cursors.modal_quotes ? 'quotes' : 'replies';
        }
        loadModalContent(false, type);
    });
}