// --- Configuration ---
const BSKY_API_BASE_URL = 'https://public.api.bsky.app/xrpc';
const BSKY_GET_POST_THREAD_ENDPOINT = 'app.bsky.feed.getPostThread';
const BSKY_MAX_INITIAL_COMMENTS = 20;
const BSKY_COMMENTS_INCREMENT = 30;
const BSKY_PROFILE_URL_BASE = 'https://bsky.app/profile/';
const BSKY_HASHTAG_URL_BASE = 'https://bsky.app/hashtag/';
const BSKY_POST_URL_BASE = 'https://bsky.app/profile/';
const BSKY_DEFAULT_AVATAR_URL = 'https://raw.githubusercontent.com/romiojoseph/bluesky/refs/heads/main/photo-stream/assets/default-avatar.png';
const BSKY_DEBOUNCE_DELAY = 300;
const BSKY_FILTER_LABELED_COMMENTS = false;
const BSKY_INDENT_SIZE_PX = 20;

// --- Module State ---
let allCommentsFlat = [];
let visibleComments = [];
let visibleCommentCount = 0;
let currentSort = 'oldest';
let currentSearchTerm = '';
let debounceTimer = null;
let originalThreadData = null;
let commentListClickListenerAttached = false;

// --- Helper Functions ---

function sanitize(str) {
    if (str === null || typeof str === 'undefined') return '';
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

function formatCommentTimestamp(isoDateString) {
    if (!isoDateString) return 'Unknown date';
    try {
        const date = new Date(isoDateString);
        if (isNaN(date.getTime())) return 'Invalid Date';
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const day = String(date.getDate()).padStart(2, '0');
        const month = months[date.getMonth()];
        const year = date.getFullYear();
        let hour = date.getHours();
        const minute = String(date.getMinutes()).padStart(2, '0');
        const ampm = hour >= 12 ? 'PM' : 'AM';
        hour = hour % 12; hour = hour ? hour : 12;
        const hourStr = String(hour).padStart(2, '0');
        return `${day} ${month} ${year} ${hourStr}:${minute} ${ampm}`;
    } catch (e) {
        console.error("Timestamp formatting error:", e);
        return 'Date Error';
    }
}

function processFacets(text, facets) {
    if (!text) return '';
    if (!facets || facets.length === 0) {
        return sanitize(text).replace(/\n/g, '<br>');
    }
    let utf8Bytes = new TextEncoder().encode(text);
    let textSegments = [];
    const sortedFacets = facets.slice().sort((a, b) => a.index.byteStart - b.index.byteStart);
    let currentByteIndex = 0;
    const textDecoder = new TextDecoder('utf-8', { fatal: false });

    for (const facet of sortedFacets) {
        const byteStart = Number(facet?.index?.byteStart);
        const byteEnd = Number(facet?.index?.byteEnd);
        if (isNaN(byteStart) || isNaN(byteEnd) || byteStart < 0 || byteEnd <= byteStart || byteEnd > utf8Bytes.length) {
            console.warn("Skipping invalid or out-of-bounds facet:", facet); continue;
        }
        if (byteStart > currentByteIndex) {
            try {
                const preFacetText = sanitize(textDecoder.decode(utf8Bytes.slice(currentByteIndex, byteStart), { stream: true }));
                textSegments.push({ type: 'text', content: preFacetText });
            } catch (e) { console.warn("Error decoding pre-facet text segment:", e); }
        }
        const facetTextBytes = utf8Bytes.slice(byteStart, byteEnd);
        let facetText = '';
        try { facetText = sanitize(textDecoder.decode(facetTextBytes, { stream: true })); }
        catch (e) { console.warn("Error decoding facet text:", e); facetText = '[Decoding Error]'; }

        if (facet.features && facet.features.length > 0) {
            const feature = facet.features[0];
            let href = '#';
            let linkContent = facetText;

            switch (feature?.$type) {
                case 'app.bsky.richtext.facet#link':
                    href = feature.uri ? sanitize(feature.uri) : '#';
                    if (href !== '#' && !/^(https?|mailto|ftp):/i.test(href)) { href = 'https://' + href; }
                    textSegments.push({ type: 'link', href: href, content: linkContent });
                    break;
                case 'app.bsky.richtext.facet#mention':
                    href = feature.did ? `${BSKY_PROFILE_URL_BASE}${sanitize(feature.did)}` : '#';
                    textSegments.push({ type: 'mention', href: href, content: linkContent });
                    break;
                case 'app.bsky.richtext.facet#tag':
                    const tagName = feature.tag || '';
                    const safeTagNameForUrl = tagName.replace(/^#/, '');
                    href = safeTagNameForUrl ? `${BSKY_HASHTAG_URL_BASE}${sanitize(safeTagNameForUrl)}` : '#';
                    linkContent = sanitize(tagName);
                    if (tagName && !linkContent.startsWith('#')) {
                        linkContent = '#' + linkContent;
                    }
                    if (!linkContent) { linkContent = facetText; }
                    textSegments.push({ type: 'tag', href: href, content: linkContent });
                    break;
                default:
                    console.warn("Unknown facet feature type:", feature?.$type);
                    textSegments.push({ type: 'text', content: facetText });
            }
        } else {
            textSegments.push({ type: 'text', content: facetText });
        }
        currentByteIndex = byteEnd;
    }
    if (currentByteIndex < utf8Bytes.length) {
        try {
            const remainingText = sanitize(textDecoder.decode(utf8Bytes.slice(currentByteIndex)));
            textSegments.push({ type: 'text', content: remainingText });
        } catch (e) { console.warn("Error decoding final text segment:", e); textSegments.push({ type: 'text', content: '[Decoding Error]' }); }
    }

    let html = '';
    for (const segment of textSegments) {
        switch (segment.type) {
            case 'link': case 'mention': case 'tag':
                html += `<a href="${segment.href}" target="_blank" rel="noopener noreferrer" data-internal-link="true">${segment.content}</a>`;
                break;
            case 'text': default: html += segment.content;
        }
    }
    return html.replace(/\n/g, '<br>');
}

function getRkeyFromUri(uri) {
    if (!uri || typeof uri !== 'string') return null;
    const parts = uri.split('/');
    return parts.length > 0 ? parts[parts.length - 1] : null;
}

// --- UPDATED: flattenThread function ---
// Simplified to restore natural traversal order for correct threading appearance.
// It no longer sorts replies internally. Global sorting happens in updateDisplay.
function flattenThread(threadNode, depth = 0, flatList = [], rootReplyPost = null) {
    if (!threadNode || typeof threadNode !== 'object') { return flatList; }

    // Handle blocked/not found posts directly
    if (threadNode.$type === 'app.bsky.feed.defs#blockedPost' || threadNode.$type === 'app.bsky.feed.defs#notFoundPost') {
        // Add a placeholder-like entry to represent it in the list if needed,
        // though these are often filtered out later or rendered differently.
        flatList.push({ $type: threadNode.$type, uri: threadNode.uri || `placeholder-${Date.now()}-${Math.random()}`, depth: depth, post: null });
        // Continue processing replies if they exist (though unlikely for notFound/blocked)
        if (threadNode.replies && Array.isArray(threadNode.replies)) {
            threadNode.replies.forEach(reply => {
                flattenThread(reply, depth + 1, flatList, rootReplyPost); // Use the *same* rootReplyPost
            });
        }
        return flatList;
    }

    // Process regular posts (app.bsky.feed.defs#threadViewPost)
    if (threadNode.post && typeof threadNode.post === 'object') {
        let currentRootReplyPost = rootReplyPost;
        // Identify the root reply (depth 1) for potential sorting later
        if (depth === 1) {
            currentRootReplyPost = threadNode.post;
        }

        let shouldAddPost = true;
        // Apply label filtering if enabled
        if (BSKY_FILTER_LABELED_COMMENTS) {
            if (Array.isArray(threadNode.post.labels) && threadNode.post.labels.length > 0) {
                const authorDid = threadNode.post.author?.did;
                const hasExternalLabel = threadNode.post.labels.some(label => label.src !== authorDid);
                if (hasExternalLabel) {
                    shouldAddPost = false;
                }
            }
        }

        // Add the post to the flat list if it's not filtered out
        if (shouldAddPost) {
            // Ensure we only add the expected type with post data
            if (threadNode.$type === 'app.bsky.feed.defs#threadViewPost') {
                flatList.push({
                    ...threadNode, // Spread the original node data
                    depth: depth,   // Add calculated depth
                    // Store the root reply post's creation time for potential sorting
                    rootReplyCreatedAt: currentRootReplyPost?.record?.createdAt || null,
                    rootReplyUri: currentRootReplyPost?.uri || null
                });
            } else {
                console.warn("Encountered unexpected thread node type with post data:", threadNode.$type, threadNode);
            }
        }

        // --- RECURSION ---
        // Recursively process replies, if any exist.
        // CRITICAL: Do NOT sort replies here. Traverse in the order provided by the API.
        if (threadNode.replies && Array.isArray(threadNode.replies)) {
            threadNode.replies.forEach(reply => {
                // Pass the currentRootReplyPost down so nested replies know their thread root
                flattenThread(reply, depth + 1, flatList, currentRootReplyPost);
            });
        }
    } else if (depth > 0 && threadNode.replies && Array.isArray(threadNode.replies)) {
        // Handle cases like a deleted reply that still has replies listed under it in the thread view
        console.warn("Thread node is missing 'post' data but has replies (potentially deleted post):", threadNode);
        threadNode.replies.forEach(reply => {
            flattenThread(reply, depth + 1, flatList, rootReplyPost); // Pass original root down
        });
    } else if (depth === 0) { // Root node processing
        // The root node itself (depth 0) is not added to the flatList of *comments*
        // but we need to process its replies.
        if (threadNode.replies && Array.isArray(threadNode.replies)) {
            threadNode.replies.forEach(reply => {
                // Start recursion for direct replies (depth 1). Pass null as their rootReplyPost initially.
                flattenThread(reply, depth + 1, flatList, null);
            });
        }
    }
    // else: Node has no post data and no replies, or is depth 0 with no replies - stop recursion for this branch.

    return flatList;
}
// --- END UPDATED: flattenThread function ---


function formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Renders a single comment element with inline style for indentation
function renderCommentElement(commentDataWithDepth) {
    const type = commentDataWithDepth.$type;
    const depth = commentDataWithDepth.depth;
    const commentEl = document.createElement('div');
    commentEl.className = `comment depth-${depth} comment-${type.split('#')[1]?.toLowerCase() || 'unknown'}`;

    // Apply inline style for indentation
    if (depth > 0) {
        commentEl.style.marginLeft = `${depth * BSKY_INDENT_SIZE_PX}px`;
    }

    if (type === 'app.bsky.feed.defs#blockedPost') {
        commentEl.innerHTML = `<p class="comment-blocked-notice"><i class="ph-duotone ph-eye-closed"></i> Blocked Post</p>`; return commentEl;
    }
    if (type === 'app.bsky.feed.defs#notFoundPost') {
        commentEl.innerHTML = `<p class="comment-notfound-notice"><i class="ph-duotone ph-question"></i> Post Not Found</p>`; return commentEl;
    }
    if (type !== 'app.bsky.feed.defs#threadViewPost' || !commentDataWithDepth.post) {
        console.warn("Skipping rendering unexpected comment node type or missing post data:", commentDataWithDepth);
        commentEl.innerHTML = `<p class="comment-error-notice"><i class="ph-duotone ph-warning"></i> Error displaying comment.</p>`;
        return commentEl;
    }

    const postData = commentDataWithDepth.post;
    if (!postData.author?.did || !postData.record?.createdAt || !postData.uri) {
        console.warn("Skipping rendering comment element due to missing essential post data fields:", commentDataWithDepth);
        commentEl.innerHTML = `<p class="comment-error-notice"><i class="ph-duotone ph-warning"></i> Error rendering comment details.</p>`; return commentEl;
    }

    const author = postData.author; const record = postData.record; const text = record.text || '';
    const facets = record.facets; const createdAt = record.createdAt; const embed = postData.embed;
    const currentPostUri = postData.uri; const rkey = getRkeyFromUri(currentPostUri);
    const authorDid = sanitize(author.did); const profileUrl = `${BSKY_PROFILE_URL_BASE}${authorDid}`;
    const displayName = sanitize(author.displayName || author.handle || 'Unknown User');
    const handle = sanitize(author.handle || 'unknown.handle');
    const avatarUrl = author.avatar ? sanitize(author.avatar) : BSKY_DEFAULT_AVATAR_URL;
    const postUrl = (authorDid && rkey) ? `${BSKY_POST_URL_BASE}${authorDid}/post/${rkey}` : '#';

    const processedText = processFacets(text, facets);

    let embedHTML = ''; let embedNoticeText = '';
    if (embed?.$type) {
        const embedType = embed.$type;
        if (embedType.includes('images') && embed.images?.length > 0) {
            embedHTML = '<div class="comment-embed-images">';
            embed.images.forEach(img => {
                const thumbUrl = img?.thumb && typeof img.thumb === 'string' ? sanitize(img.thumb) : null;
                const altText = sanitize(img?.alt || 'Embedded image');
                const fullsizeUrl = img?.fullsize && typeof img.fullsize === 'string' ? sanitize(img.fullsize) : thumbUrl;
                if (thumbUrl && fullsizeUrl) { embedHTML += `<a href="${fullsizeUrl}" target="_blank" rel="noopener noreferrer" class="comment-embed-image-link" data-internal-link="true"><img src="${thumbUrl}" alt="${altText}" loading="lazy" class="comment-embed-image" onerror="this.onerror=null; this.src='${BSKY_DEFAULT_AVATAR_URL}'; this.closest('a').style.pointerEvents='none';"></a>`; }
                else if (thumbUrl) { embedHTML += `<img src="${thumbUrl}" alt="${altText}" loading="lazy" class="comment-embed-image comment-embed-image-no-link" onerror="this.onerror=null; this.src='${BSKY_DEFAULT_AVATAR_URL}';">`; }
                else { console.warn("Skipping image embed due to missing thumb URL:", img); }
            });
            embedHTML += '</div>';
        } else if (embedType.includes('external') && embed.external) {
            const external = embed.external; const externalUri = external.uri ? sanitize(external.uri) : '#';
            if (externalUri !== '#') {
                const thumbUrl = external.thumb ? sanitize(external.thumb) : null; const title = sanitize(external.title || external.uri); const description = sanitize(external.description || '');
                embedHTML = `<a href="${externalUri}" target="_blank" rel="noopener noreferrer" class="comment-embed-external" data-internal-link="true">${thumbUrl ? `<img src="${thumbUrl}" alt="Preview" class="comment-embed-external-thumb" loading="lazy" onerror="this.onerror=null; this.src='${BSKY_DEFAULT_AVATAR_URL}'; this.style.display='none';"/>` : ''}<div class="comment-embed-external-text"><strong class="comment-embed-external-title">${title}</strong>${description ? `<p class="comment-embed-external-desc">${description}</p>` : ''}</div></a>`;
            } else { console.warn("Skipping external embed due to missing URI:", external); }
        } else if (embedType.includes('recordWithMedia') || embedType.includes('record')) {
            const recordType = embed.record?.record?.$type;
            if (recordType === 'app.bsky.feed.post') {
                embedNoticeText = `<em><i class="ph-duotone ph-quotes"></i> Quoted post${embedType.includes('Media') ? ' & Media' : ''} available</em>`;
                const quotedPostUri = embed.record?.record?.uri;
                const quotedAuthorDid = embed.record?.record?.author?.did;
                if (quotedPostUri && quotedAuthorDid) {
                    const quotedPostRkey = getRkeyFromUri(quotedPostUri);
                    if (quotedPostRkey) {
                        const quotedPostUrl = `${BSKY_POST_URL_BASE}${sanitize(quotedAuthorDid)}/post/${quotedPostRkey}`;
                        embedNoticeText += ` <a href="${quotedPostUrl}" target="_blank" rel="noopener noreferrer" class="comment-embed-quoted-link" data-internal-link="true">(View Quote)</a>`;
                    }
                }
            } else if (recordType === 'app.bsky.feed.defs#notFoundPost') {
                embedNoticeText = `<em><i class="ph-duotone ph-question"></i> Quoted post not found</em>`;
            } else if (recordType === 'app.bsky.feed.defs#blockedPost') {
                embedNoticeText = `<em><i class="ph-duotone ph-eye-closed"></i> Quoted post is blocked</em>`;
            } else {
                embedNoticeText = `<em><i class="ph-duotone ph-link"></i> Embedded content available</em>`;
                console.warn("Unsupported record type in embed:", recordType, embed.record);
            }
        } else if (embedType.includes('video')) { embedNoticeText = `<em><i class="ph-duotone ph-video"></i> Video attachment available</em>`; }
        else { embedNoticeText = `<em><i class="ph-duotone ph-paperclip"></i> Attachment available</em>`; }
    }
    const finalEmbedContent = embedHTML || (embedNoticeText ? `<p class="comment-embed-notice">${embedNoticeText}</p>` : '');

    commentEl.innerHTML = `
        <div class="comment-content-wrapper">
            <div class="comment-header">
                <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="comment-avatar-link" data-internal-link="true">
                     <img src="${avatarUrl}" alt="${displayName}'s avatar" class="comment-avatar" loading="lazy" onerror="this.onerror=null; this.src='${BSKY_DEFAULT_AVATAR_URL}';">
                </a>
                <div class="comment-author-meta">
                    <div class="comment-author">
                        <a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="comment-author-name" data-internal-link="true">${displayName}</a>
                        ${handle !== 'unknown.handle' ? `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer" class="comment-author-handle" data-internal-link="true">@${handle}</a>` : '<span class="comment-author-handle-unknown">@unknown</span>'}
                    </div>
                    <div class="comment-timestamp" title="Posted at: ${createdAt}">${formatCommentTimestamp(createdAt)}</div>
                </div>
            </div>

            <div class="comment-body-link" data-post-url="${postUrl}" ${postUrl !== '#' ? 'role="link" tabindex="0"' : ''}>
                <div class="comment-body">
                    <div class="comment-text">${processedText}</div>
                     ${finalEmbedContent ? `<div class="comment-embed">${finalEmbedContent}</div>` : ''}
                </div>
            </div>

            <div class="comment-metrics">
                 <span title="Likes"><i class="ph-duotone ph-heart"></i> ${formatNumber(postData.likeCount || 0)}</span>
                 <span title="Reposts"><i class="ph-duotone ph-repeat"></i> ${formatNumber(postData.repostCount || 0)}</span>
                 <span title="Replies"><i class="ph-duotone ph-chat-centered"></i> ${formatNumber(postData.replyCount || 0)}</span>
                 <span title="Quotes"><i class="ph-duotone ph-quotes"></i> ${formatNumber(postData.quoteCount || 0)}</span>
            </div>
        </div>
    `;
    return commentEl;
}


function renderVisibleComments(container) {
    container.innerHTML = '';
    // Render comments from the currently visible slice of `visibleComments`
    const commentsToRender = visibleComments.slice(0, visibleCommentCount);

    if (commentsToRender.length === 0) {
        // Display appropriate message based on why no comments are shown
        if (currentSearchTerm) {
            container.innerHTML = '<p class="comments-list-message"><em>No comments match your search.</em></p>';
        } else if (allCommentsFlat.length > 0 && visibleComments.length === 0) {
            // This case means filters (like label filtering) removed all comments
            container.innerHTML = '<p class="comments-list-message"><em>No comments available based on current filters.</em></p>';
        } else if (allCommentsFlat.length === 0 && originalThreadData) {
            // Thread loaded, but processing resulted in zero valid comments
            container.innerHTML = '<p class="comments-list-message"><em>No comments yet. Be the first to reply on Bluesky!</em></p>';
        } else {
            // Default initial state or error case
            container.innerHTML = '<p class="comments-list-message"><em>No comments to display.</em></p>';
        }
    } else {
        const fragment = document.createDocumentFragment();
        commentsToRender.forEach(commentData => {
            const element = renderCommentElement(commentData);
            if (element) { fragment.appendChild(element); }
        });
        container.appendChild(fragment);
    }
    // Update buttons based on the potentially filtered/sorted `visibleComments` list
    updateActionButtons(container);
}


function updateDisplay(container) {
    // 1. Filter: Apply search term to the master list `allCommentsFlat`
    let filteredComments = allCommentsFlat.filter(c => {
        // Basic validity check (already filtered in flattenThread, but good practice)
        if (c.depth === 0 || c.$type !== 'app.bsky.feed.defs#threadViewPost' || !c.post) { return false; }
        // Apply search filter
        if (!currentSearchTerm) { return true; }
        const lowerSearchTerm = currentSearchTerm.toLowerCase();
        return (c.post.record?.text?.toLowerCase().includes(lowerSearchTerm) ||
            c.post.author?.handle?.toLowerCase().includes(lowerSearchTerm) ||
            c.post.author?.displayName?.toLowerCase().includes(lowerSearchTerm));
    });

    // 2. Sort: Sort the *filtered* list based on `currentSort`
    let sortedComments = [...filteredComments]; // Create a copy to sort
    switch (currentSort) {
        // Metric sorts (simple descending)
        case 'likes': sortedComments.sort((a, b) => (b.post?.likeCount || 0) - (a.post?.likeCount || 0)); break;
        case 'reposts': sortedComments.sort((a, b) => (b.post?.repostCount || 0) - (a.post?.repostCount || 0)); break;
        case 'quotes': sortedComments.sort((a, b) => (b.post?.quoteCount || 0) - (a.post?.quoteCount || 0)); break;
        case 'replies': sortedComments.sort((a, b) => (b.post?.replyCount || 0) - (a.post?.replyCount || 0)); break;

        // Time-based sorts: Group by root thread first, then sort by own time within thread
        case 'oldest':
        case 'newest':
            sortedComments.sort((a, b) => {
                // Use root reply's creation date for primary sorting to keep threads together
                const rootDateA = a.rootReplyCreatedAt ? new Date(a.rootReplyCreatedAt) : new Date(0);
                const rootDateB = b.rootReplyCreatedAt ? new Date(b.rootReplyCreatedAt) : new Date(0);
                // Use the comment's own creation date for secondary sorting within a thread
                const ownDateA = a.post?.record?.createdAt ? new Date(a.post.record.createdAt) : new Date(0);
                const ownDateB = b.post?.record?.createdAt ? new Date(b.post.record.createdAt) : new Date(0);

                // Handle potential invalid dates defensively
                if (isNaN(rootDateA.getTime())) return 1;
                if (isNaN(rootDateB.getTime())) return -1;
                if (isNaN(ownDateA.getTime())) return 1;
                if (isNaN(ownDateB.getTime())) return -1;

                // If comments belong to different root threads, sort by the root thread's time
                if (rootDateA.getTime() !== rootDateB.getTime()) {
                    return currentSort === 'oldest' ? rootDateA - rootDateB : rootDateB - rootDateA;
                } else {
                    // If they are in the same root thread (or both direct replies), sort by their own time
                    return currentSort === 'oldest' ? ownDateA - ownDateB : ownDateB - ownDateA;
                }
            });
            break;

        default: // Should not happen, but default to 'newest' as a fallback
            console.warn("Unknown sort option:", currentSort, "Defaulting to newest.");
            sortedComments.sort((a, b) => (new Date(b.post?.record?.createdAt || 0)) - (new Date(a.post?.record?.createdAt || 0)));
            break;
    }

    // 3. Update state: `visibleComments` now holds the filtered and sorted list
    visibleComments = sortedComments;
    // Reset pagination count for the newly filtered/sorted list
    visibleCommentCount = Math.min(BSKY_MAX_INITIAL_COMMENTS, visibleComments.length);

    // 4. Render: Display the first page of the processed comments
    renderVisibleComments(container);
}


// Renders controls with a simple "Comments" heading
function renderControls(controlsContainer) {
    const commentsHeading = `<h6>Comments</h6>`; // Simple heading

    controlsContainer.innerHTML = `
        ${commentsHeading}
        <p class="comments-list-message">Reply on the Bluesky post to join the conversation.</p>
        <div class="comment-controls">
            <input type="search" id="bsky-comment-search-input" placeholder="Search comments...">
            <select id="bsky-comment-sort-select">
                <option value="newest">Newest First</option>
                <option value="oldest" selected>Oldest First</option>
                <option value="likes">Top Liked</option>
                <option value="reposts">Top Reposted</option>
                <option value="quotes">Top Quoted</option>
                <option value="replies">Most Replies</option>
            </select>
        </div>
    `;

    const searchInput = controlsContainer.querySelector('#bsky-comment-search-input');
    const sortSelect = controlsContainer.querySelector('#bsky-comment-sort-select');
    const listContainer = controlsContainer.parentElement?.querySelector('#bsky-comments-list');

    if (!listContainer) {
        console.error("Could not find #bsky-comments-list relative to controls container.");
        return;
    }

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentSearchTerm = e.target.value.trim();
            updateDisplay(listContainer); // Refilter and re-render
        }, BSKY_DEBOUNCE_DELAY);
    });
    sortSelect.addEventListener('change', (e) => {
        currentSort = e.target.value;
        sortSelect.value = currentSort; // Ensure dropdown reflects selection
        updateDisplay(listContainer); // Resort and re-render
    });

    sortSelect.value = currentSort; // Set initial dropdown state
}


function updateActionButtons(listContainer) {
    const parentContainer = listContainer.parentElement;
    if (!parentContainer) return;

    let actionsContainer = parentContainer.querySelector('.bsky-comments-actions');
    if (!actionsContainer) {
        actionsContainer = document.createElement('div');
        actionsContainer.className = 'bsky-comments-actions';
        listContainer.insertAdjacentElement('afterend', actionsContainer);
    }
    actionsContainer.innerHTML = '';

    // Load More Button: Based on the length of `visibleComments` after filtering/sorting
    if (visibleCommentCount < visibleComments.length) {
        const loadMoreBtn = document.createElement('button');
        loadMoreBtn.id = 'bsky-load-more-comments-btn';
        loadMoreBtn.className = 'bsky-action-button bsky-load-more-button';
        const remaining = visibleComments.length - visibleCommentCount;
        const countToShow = Math.min(remaining, BSKY_COMMENTS_INCREMENT);
        loadMoreBtn.textContent = `Load More (${countToShow})`;
        loadMoreBtn.onclick = () => {
            visibleCommentCount = Math.min(visibleCommentCount + BSKY_COMMENTS_INCREMENT, visibleComments.length);
            renderVisibleComments(listContainer); // Re-render showing more items from `visibleComments`
        };
        actionsContainer.appendChild(loadMoreBtn);
    }

    // Join Conversation Button
    let joinConversationUrl = '#';
    if (originalThreadData?.post?.author?.did && originalThreadData?.post?.uri) {
        const rootDid = sanitize(originalThreadData.post.author.did);
        const rootRkey = getRkeyFromUri(originalThreadData.post.uri);
        if (rootDid && rootRkey) {
            joinConversationUrl = `${BSKY_POST_URL_BASE}${rootDid}/post/${rootRkey}`;
        } else {
            console.warn("Could not construct 'Join Conversation' URL: Missing DID or rkey in root post data.", originalThreadData.post);
        }
    } else {
        console.warn("Could not construct 'Join Conversation' URL: Root post data not available or invalid.", originalThreadData);
    }

    const joinBtn = document.createElement('a');
    joinBtn.id = 'bsky-join-conversation-btn';
    joinBtn.className = 'bsky-action-button bsky-join-button';
    joinBtn.textContent = 'Join the Conversation';
    joinBtn.href = joinConversationUrl;
    joinBtn.target = '_blank';
    joinBtn.rel = 'noopener noreferrer';
    joinBtn.setAttribute('data-internal-link', 'true');
    if (joinConversationUrl === '#') {
        joinBtn.classList.add('bsky-button-disabled');
        joinBtn.onclick = (e) => e.preventDefault();
        joinBtn.title = "Could not determine original post URL";
        joinBtn.removeAttribute('href');
        joinBtn.setAttribute('aria-disabled', 'true');
    }
    actionsContainer.appendChild(joinBtn);
}


function handleCommentBodyClick(event) {
    const bodyLinkWrapper = event.target.closest('.comment-body-link');
    if (!bodyLinkWrapper) return;

    let targetElement = event.target;
    // Check if the click was on an actual interactive element *inside* the wrapper
    while (targetElement && targetElement !== bodyLinkWrapper) {
        if (targetElement.tagName === 'A' || targetElement.tagName === 'BUTTON' || targetElement.getAttribute('onclick') || targetElement.getAttribute('role') === 'button') {
            // Allow click on internal links, buttons, etc.
            return;
        }
        targetElement = targetElement.parentElement;
    }

    // If the click reached the wrapper without hitting an inner interactive element, open the post link
    const postUrl = bodyLinkWrapper.dataset.postUrl;
    if (postUrl && postUrl !== '#') {
        window.open(postUrl, '_blank', 'noopener,noreferrer');
    }
}

// Renders parent stats, hiding zero counts and linking non-zero counts
function renderParentPostStats(statsContainer, parentPostData) {
    if (!parentPostData || !parentPostData.uri || !parentPostData.author?.did) {
        statsContainer.innerHTML = '<p><em>Loading post details...</em></p>';
        return;
    }

    const likeCount = parentPostData.likeCount || 0;
    const repostCount = parentPostData.repostCount || 0;
    const replyCount = parentPostData.replyCount || 0;
    const quoteCount = parentPostData.quoteCount || 0;

    const rootDid = sanitize(parentPostData.author.did);
    const rootRkey = getRkeyFromUri(parentPostData.uri);
    let basePostUrl = '#';
    if (rootDid && rootRkey) {
        basePostUrl = `${BSKY_POST_URL_BASE}${rootDid}/post/${rootRkey}`;
    } else {
        console.warn("Could not construct base post URL for stats links.", parentPostData);
    }

    const statsHtmlParts = [];
    const canLink = basePostUrl !== '#';

    const createStatHtml = (count, labelSingular, labelPlural, iconClass, linkSuffix, linkTitle) => {
        if (count === 0) return ''; // Hide if count is 0
        const label = count === 1 ? labelSingular : labelPlural;
        const statContent = `<span><i class="ph-duotone ${iconClass}"></i> ${formatNumber(count)} ${label}</span>`;
        if (canLink) {
            const targetUrl = linkSuffix ? basePostUrl + linkSuffix : basePostUrl;
            return `<a href="${targetUrl}" target="_blank" rel="noopener noreferrer" title="${linkTitle}" class="bsky-stat-link">${statContent}</a>`;
        } else {
            return statContent;
        }
    };

    statsHtmlParts.push(createStatHtml(likeCount, 'Like', 'Likes', 'ph-heart', '/liked-by', 'View Likes on Bluesky'));
    statsHtmlParts.push(createStatHtml(repostCount, 'Repost', 'Reposts', 'ph-repeat', '/reposted-by', 'View Reposts on Bluesky'));
    statsHtmlParts.push(createStatHtml(replyCount, 'Reply', 'Replies', 'ph-chat-centered', '', 'View Post on Bluesky')); // Link replies to the post itself
    statsHtmlParts.push(createStatHtml(quoteCount, 'Quote', 'Quotes', 'ph-quotes', '/quotes', 'View Quotes on Bluesky'));

    const finalHtml = statsHtmlParts.filter(part => part).join('');

    if (finalHtml) {
        statsContainer.innerHTML = finalHtml;
    } else {
        // Only show if ALL counts were 0
        statsContainer.innerHTML = `<p><em>No interactions yet.</em></p>`;
    }
}


// Main function to load and render the widget
async function loadAndRenderComments(targetContainerId, postAtUri) {
    const mainContainer = document.getElementById(targetContainerId);
    if (!mainContainer) {
        console.error(`Target comments container #${targetContainerId} not found.`);
        return;
    }

    // Set up initial structure
    mainContainer.innerHTML = `
        <div id="bsky-parent-post-stats-container"><p><em>Loading post stats...</em></p></div>
        <div id="bsky-comment-controls-container"></div>
        <div id="bsky-comments-loading-status"><p><em>Loading comments...</em></p></div>
        <div id="bsky-comments-list"></div>
        <div class="bsky-comments-actions"></div>
    `;
    // Get references AFTER setting innerHTML
    const parentStatsContainer = mainContainer.querySelector('#bsky-parent-post-stats-container');
    const controlsContainer = mainContainer.querySelector('#bsky-comment-controls-container');
    const listContainer = mainContainer.querySelector('#bsky-comments-list');
    const statusContainer = mainContainer.querySelector('#bsky-comments-loading-status');
    const actionsContainer = mainContainer.querySelector('.bsky-comments-actions');

    if (!parentStatsContainer || !controlsContainer || !listContainer || !statusContainer || !actionsContainer) {
        console.error("Failed to find essential widget elements within #" + targetContainerId);
        mainContainer.innerHTML = '<p class="bsky-comments-error">Error initializing comment display structure.</p>';
        return;
    }

    // Reset state variables
    allCommentsFlat = []; visibleComments = []; visibleCommentCount = 0;
    currentSearchTerm = ''; currentSort = 'oldest'; // Default sort
    originalThreadData = null;
    clearTimeout(debounceTimer);
    // Remove previous listeners if they exist
    if (commentListClickListenerAttached && listContainer) {
        listContainer.removeEventListener('click', handleCommentBodyClick);
        listContainer.removeEventListener('keydown', handleCommentBodyKeydown);
        commentListClickListenerAttached = false;
    }

    // Validate AT URI
    if (!postAtUri || typeof postAtUri !== 'string' || !postAtUri.startsWith('at://')) {
        console.warn("Cannot load comments: Invalid or missing AT URI.", postAtUri);
        statusContainer.innerHTML = `<p class="bsky-comments-error"><em>Invalid post reference provided. Cannot load comments.</em></p>`;
        // Clear other sections for a clean error state
        controlsContainer.innerHTML = ''; listContainer.innerHTML = ''; actionsContainer.innerHTML = ''; parentStatsContainer.innerHTML = '<p><em>Invalid post reference.</em></p>';
        return;
    }

    // Add event listeners for interaction
    if (listContainer) {
        listContainer.addEventListener('click', handleCommentBodyClick);
        listContainer.addEventListener('keydown', handleCommentBodyKeydown);
        commentListClickListenerAttached = true;
    }

    // Fetch data
    const apiUrl = `${BSKY_API_BASE_URL}/${BSKY_GET_POST_THREAD_ENDPOINT}?uri=${encodeURIComponent(postAtUri)}`;

    try {
        const response = await fetch(apiUrl, { method: 'GET', credentials: 'omit', headers: { 'Accept': 'application/json' } });
        if (!response.ok) {
            // Improved error message parsing
            let errorMsg = `HTTP error! Status: ${response.status} ${response.statusText}`; let responseBodyText = '[Could not read response body]';
            try { responseBodyText = await response.text(); console.error("Error response body:", responseBodyText); try { const errorData = JSON.parse(responseBodyText); errorMsg += ` - Server: ${errorData.message || errorData.error || responseBodyText.substring(0, 100)}`; } catch { errorMsg += ` - Body: ${responseBodyText.substring(0, 100)}`; } } catch { /* ignore read error */ } throw new Error(errorMsg);
        }
        const data = await response.json();
        if (!data || !data.thread || typeof data.thread !== 'object' || !data.thread.post) {
            throw new Error("Invalid API response structure (missing 'thread' or 'thread.post').");
        }

        statusContainer.innerHTML = ''; // Clear loading message
        originalThreadData = data.thread; // Store raw data

        // Render parent post stats
        renderParentPostStats(parentStatsContainer, originalThreadData.post);

        // Flatten the thread structure into a list, preserving order from traversal
        // Filter out non-comment types and the root post (depth 0)
        allCommentsFlat = flattenThread(data.thread, 0, [], null)
            .filter(c => c.depth > 0 && c.$type === 'app.bsky.feed.defs#threadViewPost');

        // Render Controls (now with simple heading)
        renderControls(controlsContainer);

        // Initial rendering of comments based on default sort ('oldest')
        updateDisplay(listContainer);

    } catch (error) {
        console.error('Error fetching/processing comments:', error);
        statusContainer.innerHTML = `<p class="bsky-comments-error">Failed to load comments: ${sanitize(error.message)}.</p>`;
        // Clear dynamic sections on error
        controlsContainer.innerHTML = '';
        listContainer.innerHTML = '';
        actionsContainer.innerHTML = '';
        parentStatsContainer.innerHTML = '<p><em>Could not load post details.</em></p>';
        // Clean up listeners on error too
        if (commentListClickListenerAttached && listContainer) {
            listContainer.removeEventListener('click', handleCommentBodyClick);
            listContainer.removeEventListener('keydown', handleCommentBodyKeydown);
            commentListClickListenerAttached = false;
        }
    }
}


function handleCommentBodyKeydown(event) {
    // Handle Enter or Spacebar for activating the link wrapper
    if (event.key === 'Enter' || event.key === ' ') {
        const bodyLinkWrapper = event.target.closest('.comment-body-link[role="link"]');
        // Check if the event target *is* the wrapper itself (not an inner interactive element)
        if (bodyLinkWrapper && event.target === bodyLinkWrapper) {
            event.preventDefault(); // Prevent default action (scrolling, form submission)
            const postUrl = bodyLinkWrapper.dataset.postUrl;
            if (postUrl && postUrl !== '#') {
                window.open(postUrl, '_blank', 'noopener,noreferrer');
            }
        }
        // If event.target is an actual <a> tag inside, let default browser behavior handle it
    }
}