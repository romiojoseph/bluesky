const foldersColumn = document.getElementById('folders-column');
const itemsColumn = document.getElementById('items-column');
const finderSearchContainer = document.getElementById('finder-search-container');
const itemListScrollContainer = document.getElementById('item-list-scroll-container');
const addFinderItemButton = document.getElementById('add-finder-item-button');
const postsHeader = document.getElementById('posts-header');
const postsHeaderContent = document.getElementById('posts-header-content'); // Correct target
const mobileBackButton = document.getElementById('mobile-back-button');
const postsList = document.getElementById('posts-list');
const profileTabsContainer = document.getElementById('profile-tabs-container');

const genericModalOverlay = document.getElementById('generic-modal-overlay');
const genericModalHeader = document.getElementById('generic-modal-header');
const genericModalTitle = document.getElementById('generic-modal-title');
const genericModalBody = document.getElementById('generic-modal-body');
const genericModalCloseButton = document.getElementById('generic-modal-close-button');

const addItemModalOverlay = document.getElementById('add-item-modal-overlay');
const addItemForm = document.getElementById('add-item-form');
const addItemUrlInput = document.getElementById('itemUrl');
const addItemError = document.getElementById('add-item-error');
const addItemSuccess = document.getElementById('add-item-success');
const finderItemListModal = document.getElementById('finder-item-list-modal');
const addItemModalCloseButton = document.getElementById('add-item-modal-close-button');

let feedItemDataStore = {};
let currentPostData = [];
let currentHeaderUrl = '';
const FINDER_FOLDER_INDEX = -1;

function isMediaPost(post) { if (!post?.embed) return false; if (post.embed.$type === 'app.bsky.embed.images#view') return true; if (post.embed.$type === 'app.bsky.embed.recordWithMedia#view' && post.embed.media?.$type === 'app.bsky.embed.images#view') return true; return false; }
function isLinkPost(post) { if (!post?.embed) return false; if (post.embed.$type === 'app.bsky.embed.external#view') return true; if (post.embed.$type === 'app.bsky.embed.recordWithMedia#view' && post.embed.media?.$type === 'app.bsky.embed.external#view') return true; return false; }
function isVideoPost(post) { if (!post?.embed) return false; return post.embed.$type === 'app.bsky.embed.video#view'; }

function renderFolders(config, activeFolderIndex, clickHandler) {
    foldersColumn.innerHTML = '';
    config.forEach((folder, index) => { const div = document.createElement('div'); div.className = 'folder-item'; if (index === activeFolderIndex) { div.classList.add('active'); } div.innerHTML = `<i class="folder-icon ph-duotone ph-${escapeHtml(folder.icon || 'folder')}"></i><span class="folder-name">${escapeHtml(folder.name)}</span>`; div.addEventListener('click', () => clickHandler(index)); foldersColumn.appendChild(div); });
    const finderDiv = document.createElement('div'); finderDiv.className = 'folder-item'; finderDiv.id = 'finder-folder-item'; if (activeFolderIndex === FINDER_FOLDER_INDEX) { finderDiv.classList.add('active'); } finderDiv.innerHTML = `<i class="folder-icon ph ph-rss"></i><span class="folder-name">Finder</span>`; finderDiv.addEventListener('click', () => clickHandler(FINDER_FOLDER_INDEX)); foldersColumn.appendChild(finderDiv);
}

async function renderItems(folderItems, activeItemIndex, clickHandler, isFinder = false) {
    itemListScrollContainer.innerHTML = showLoadingIndicator('Loading items...');
    finderSearchContainer.style.display = isFinder ? 'flex' : 'none';
    const itemsToRender = isFinder ? loadFinderItems() : folderItems;
    if (!itemsToRender || itemsToRender.length === 0) {
        itemListScrollContainer.innerHTML = isFinder ? '<div class="loading-indicator">No items added yet. Use the button above to add some.</div>' : '<div class="loading-indicator">No items in this folder.</div>';
        return;
    }
    const itemPromises = itemsToRender.map(async (itemConfig, index) => {
        let parsed = isFinder ? parseBlueskyUrl(itemConfig.url || itemConfig.identifier) : parseBlueskyUrl(itemConfig.url);
        if (!parsed && !isFinder) return null;
        if (!parsed && isFinder) {
            parsed = { identifier: itemConfig.identifier || itemConfig.url, type: itemConfig.type, resourceId: null };
            console.warn("Could not parse finder item URL, rendering basic info:", itemConfig);
        }
        let details = null; let fetchError = null;
        try {
            if (itemConfig.type === 'profile')
                details = await getProfileDetails(parsed.identifier);
            else {
                const atUri = await ensureAtUri(parsed);
                if (atUri) {
                    if (itemConfig.type === 'list')
                        details = await getListDetails(atUri);
                    else if (itemConfig.type === 'feed')
                        details = await getFeedGeneratorDetails(atUri);
                    if (details) details.type = itemConfig.type;
                } else if (!isFinder) {
                    console.error(`Could not get AT URI for ${itemConfig.url}`);
                    return null;
                }
            }
        }
        catch (error) {
            console.error(`Failed to fetch details for ${itemConfig.url || parsed?.identifier}:`, error);
            fetchError = error;
        }
        const div = document.createElement('div');
        div.className = 'item-entry';
        if (index === activeItemIndex) {
            div.classList.add('active');
        }
        div.dataset.index = index;
        div.dataset.finderItem = isFinder;

        let avatar = 'assets/placeholder.svg', name = 'Unknown', handleOrPurpose = '', description = '', timestamp = '', createdAt = null;
        if (fetchError) {
            name = "Error Loading";
            handleOrPurpose = escapeHtml(parsed?.identifier || itemConfig.url);
            description = "Could not load details.";
            timestamp = '--';
        }
        else if (details) {
            if (itemConfig.type === 'profile') {
                avatar = details.avatar || avatar;
                name = details.displayName || details.handle;
                handleOrPurpose = `@${details.handle || 'unknown'}`;
                description = details.description || '';
                createdAt = details.createdAt;
                timestamp = `Created ${formatRelativeTime(createdAt)}`;
            } else if (itemConfig.type === 'list' && details?.list) {
                avatar = details.list.avatar || avatar;
                name = details.list.name;
                const itemCount = details.list.listItemCount || 0;
                handleOrPurpose = `Curated list - ${formatNumber(itemCount)} ${itemCount === 1 ? 'profile' : 'profiles'}`;
                description = details.list.description || '';
                createdAt = details.list.indexedAt;
                timestamp = `Last updated ${formatRelativeTime(createdAt)}`;
            } else if (itemConfig.type === 'feed' && details?.view) {
                avatar = details.view.avatar || avatar;
                name = details.view.displayName;
                handleOrPurpose = `by @${details.view.creator?.handle || 'unknown'}`;
                description = details.view.description || '';
                createdAt = details.view.indexedAt;
                timestamp = `Last updated ${formatRelativeTime(createdAt)}`;
            }
            if (createdAt) timestamp = formatRelativeTime(createdAt);
            else if (details?.createdAt) timestamp = formatRelativeTime(details.createdAt);
        }
        else if (isFinder) {
            name = `(${itemConfig.type})`;
            handleOrPurpose = escapeHtml(parsed?.identifier || itemConfig.url);
            description = "Details not loaded yet.";
            timestamp = '--';
        }
        else { return null; }

        // Add title attributes for tooltips
        const nameWithTitle = `<span class="item-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>`;
        const handleWithTitle = `<span class="item-handle" title="${escapeHtml(handleOrPurpose)}">${escapeHtml(handleOrPurpose)}</span>`;
        const descWithTitle = description ? `<span class="item-description" title="${escapeHtml(description)}">${escapeHtml(description)}</span>` : '';
        const timestampWithTitle = timestamp ? `<div class="item-timestamp" title="${escapeHtml(formatAbsoluteTime(createdAt) || 'Unknown date')}">${timestamp || '--'}</div>` : '<div class="item-timestamp">--</div>';

        div.innerHTML = `<img src="${escapeHtml(avatar)}" class="item-avatar" alt="Avatar" onerror="this.src='assets/placeholder.svg'; this.onerror=null;">
                         <div class="item-content">
                            <div class="item-details">
                                ${nameWithTitle}
                                ${handleWithTitle}
                                ${descWithTitle}
                            </div>
                            ${timestampWithTitle}
                         </div>`;

        div.addEventListener('click', () => clickHandler(index, isFinder));
        return div;
    });
    const renderedItems = (await Promise.all(itemPromises)).filter(item => item !== null);
    itemListScrollContainer.innerHTML = '';
    if (renderedItems.length === 0) {
        itemListScrollContainer.innerHTML = '<div class="loading-indicator">No items found or failed to load.</div>';
    } else {
        renderedItems.forEach(div => itemListScrollContainer.appendChild(div));
    }
}

async function renderPostsHeader(itemConfig, backButtonHandler) {
    showLoading('header');
    postsHeader.onclick = null; mobileBackButton.onclick = null;
    currentHeaderUrl = '';
    const parsed = parseBlueskyUrl(itemConfig.url); if (!parsed) { postsHeaderContent.innerHTML = 'Error loading header.'; return; }
    let title = 'Posts', subtitle = '', targetUrl = itemConfig.url;
    let createdAt = null;
    try {
        if (itemConfig.type === 'profile') {
            const d = await getProfileDetails(parsed.identifier);
            title = d.displayName || d.handle;
            subtitle = `${formatNumber(d.postsCount || 0)} posts`;
            targetUrl = `https://bsky.app/profile/${d.did || parsed.identifier}`;
            createdAt = d.createdAt;
        } else {
            const atUri = await ensureAtUri(parsed);
            if (atUri) {
                if (itemConfig.type === 'list') {
                    const d = await getListDetails(atUri);
                    title = d.list.name;
                    subtitle = `${formatNumber(d.list.listItemCount || 0)} profiles`;
                    targetUrl = `https://bsky.app/profile/${d.list.creator.did}/lists/${atUri.split('/').pop()}`;
                    createdAt = d.list.indexedAt;
                } else if (itemConfig.type === 'feed') {
                    const d = await getFeedGeneratorDetails(atUri);
                    title = d.view.displayName;
                    subtitle = `Built on ${d.view.did || 'unknown DID'}`;
                    targetUrl = `https://bsky.app/profile/${d.view.creator.did}/feed/${atUri.split('/').pop()}`;
                    createdAt = d.view.indexedAt;
                }
            } else {
                title = "Error";
                subtitle = "Could not resolve identifier";
                targetUrl = '#';
            }
        }
    }
    catch (error) { console.error("Error fetching header details:", error); title = "Error Loading Header"; subtitle = `Failed for ${itemConfig.url}`; targetUrl = '#'; }
    currentHeaderUrl = targetUrl;

    // Add timestamp to header
    const timestamp = createdAt ? formatRelativeTime(createdAt) : '';
    const timestampFull = createdAt ? formatAbsoluteTime(createdAt) : '';
    const timestampPrefix = itemConfig.type === 'profile' ? 'Created' : 'Last updated';
    const timestampHtml = timestamp ? `<div class="header-timestamp" title="${escapeHtml(timestampFull)}">${timestampPrefix}: ${escapeHtml(timestamp)}</div>` : '';

    postsHeaderContent.innerHTML = `
        <div class="header-main-content">
            <h2 class="posts-header-title">${escapeHtml(title)}</h2>
            <p class="posts-header-subtitle">${escapeHtml(subtitle)}</p>
        </div>
        ${timestampHtml}
    `;

    if (currentHeaderUrl && currentHeaderUrl !== '#') {
        postsHeaderContent.onclick = () => window.open(currentHeaderUrl, '_blank');
        postsHeaderContent.style.cursor = 'pointer';
    } else {
        postsHeaderContent.style.cursor = 'default';
    }

    mobileBackButton.onclick = backButtonHandler;
}

function renderProfileTabs(activeTab, tabClickHandler) { profileTabsContainer.style.display = 'flex'; const tabs = profileTabsContainer.querySelectorAll('.profile-tab'); tabs.forEach(tab => { tab.classList.toggle('active', tab.dataset.tab === activeTab); tab.removeEventListener('click', tabClickHandler); tab.addEventListener('click', tabClickHandler); }); }
function hideProfileTabs() { profileTabsContainer.style.display = 'none'; }

// Update formatNumber function to add commas
function formatNumber(num) {
    return num ? num.toLocaleString() : '0';
}

// Fix to renderSinglePost function to use the formatNumber function for metrics
function renderSinglePost(feedItemOrPost, options = {}) {
    const { isModal = false, isReplyContext = false, isGridView = false, isQuoteContext = false } = options;
    const post = feedItemOrPost.post || feedItemOrPost; if (!post || !post.author) { console.warn("Render invalid post:", feedItemOrPost); return null; }

    // Check for labels in posts or authors
    if (hasLabels(post)) {
        console.warn("Skipping post with labels:", post.uri);
        return null;
    }

    const reason = feedItemOrPost.reason; const record = post.record; const isActualReply = !!record?.reply; const replyParentRef = record?.reply?.parent; const feedReplyParentAuthor = feedItemOrPost.reply?.parent?.author;
    const postDiv = document.createElement('div'); postDiv.className = 'post-item'; postDiv.dataset.uri = post.uri;
    let metaHtml = ''; if (reason && reason.$type === 'app.bsky.feed.defs#reasonRepost') { metaHtml += `<i class="ph ph-repeat"></i> Reposted by @${escapeHtml(reason.by?.handle || 'unknown')}`; }
    const isOriginalPostInModal = isModal && !isReplyContext && !isQuoteContext;
    if (isActualReply && !isOriginalPostInModal) { let replyTargetName = `@${"unknown"}`; if (feedReplyParentAuthor) { if (feedReplyParentAuthor.displayName) { replyTargetName = `${escapeHtml(feedReplyParentAuthor.displayName)} (@${escapeHtml(feedReplyParentAuthor.handle || 'unknown')})`; } else if (feedReplyParentAuthor.handle) { replyTargetName = `@${escapeHtml(feedReplyParentAuthor.handle)}`; } } else if (replyParentRef) { console.log("Reply parent author details potentially missing from feed item, only have ref:", replyParentRef); } metaHtml += `${metaHtml ? ' · ' : ''}<i class="ph ph-arrow-bend-up-left"></i> Replying to <span class="reply-target-name">${replyTargetName}</span>`; }
    const metaInfoDiv = metaHtml ? `<div class="post-meta-info">${metaHtml}</div>` : '';
    const author = post.author; const postUrl = `https://bsky.app/profile/${author.did}/post/${post.uri.split('/').pop()}`;
    const postTopHtml = `<div class="post-top"><a href="${postUrl}" target="_blank" rel="noopener noreferrer" class="post-author-link"><img src="${escapeHtml(author.avatar || 'assets/placeholder.svg')}" class="post-author-avatar" alt="${escapeHtml(author.displayName || author.handle)}'s avatar" onerror="this.src='assets/placeholder.svg'; this.onerror=null;"><div class="post-author-info"><span class="post-author-name">${escapeHtml(author.displayName || author.handle)}</span><span class="post-author-handle">@${escapeHtml(author.handle)}</span></div></a><span class="post-relative-time" title="${escapeHtml(formatAbsoluteTime(post.indexedAt))}">${escapeHtml(formatRelativeTime(post.indexedAt))}</span></div>`;
    const postTextContent = linkifyText(record?.text, record?.facets); const contentTextHtml = postTextContent ? `<div class="post-content-text">${postTextContent}</div>` : '';
    const embedHtml = renderEmbed(post.embed, isQuoteContext);
    // Helper function to format the count or return an empty string if zero
    const formatMetricCount = (count) => {
        const num = count || 0; // Ensure we have a number
        return num > 0 ? `<span>${formatNumber(num)}</span>` : ''; // Only show span if count > 0
    };

    const metricsHtml = !isModal ? "<div class=\"post-metrics-container\"><div class=\"post-metrics\"><span class=\"metric-item\" title=\"Likes\"> <i class=\"ph-duotone ph-heart\"></i> " + formatMetricCount(post.likeCount) + " </span><span class=\"metric-item\" title=\"Reposts\"> <i class=\"ph-duotone ph-repeat\"></i> " + formatMetricCount(post.repostCount) + " </span><span class=\"metric-item\" title=\"Replies\"> <i class=\"ph-duotone ph-chat-circle\"></i> " + formatMetricCount(post.replyCount) + " </span><span class=\"metric-item\" title=\"Quotes\"> <i class=\"ph-duotone ph-quotes\"></i> " + formatMetricCount(post.quoteCount) + " </span></div><button class=\"post-action-button copy-button\" title=\"Copy link\" onclick=\"copyPostLink('" + postUrl + "', this)\"><i class=\"ph-duotone ph-share-network\"></i></button></div>" : "";
    const replyCount = post.replyCount || 0; const quoteCount = post.quoteCount || 0; let actionsHtml = '';
    if (!isModal) {
        const commentsButton = replyCount > 0 ? `<button class="post-action-button view-comments-button" onclick="openGenericModal('Replies', '${post.uri}', 'replies')"><span>${escapeHtml(replyCount === 1 ? "View comment" : `View ${formatNumber(replyCount)} comments`)}</span><i class="ph ph-caret-right"></i></button>` : '';
        const quotesButton = quoteCount > 0 ? `<button class="post-action-button view-quotes-button" onclick="openGenericModal('Quotes', '${post.uri}', 'quotes')"><span>${escapeHtml(quoteCount === 1 ? "View quote" : `View ${formatNumber(quoteCount)} quotes`)}</span><i class="ph ph-caret-right"></i></button>` : '';
        if (commentsButton || quotesButton) {
            actionsHtml = `<div class="post-actions-row">${commentsButton}${quotesButton}</div>`;
        }
    }
    if (isGridView) { postDiv.innerHTML = embedHtml; const videoElement = postDiv.querySelector('video.hls-video'); if (videoElement && videoElement.dataset.hlsSrc) { initializeHlsPlayer(videoElement, videoElement.dataset.hlsSrc); } }
    else { postDiv.innerHTML = `${!(isModal && isReplyContext) ? metaInfoDiv : ''}${postTopHtml}${contentTextHtml}${embedHtml}${metricsHtml}${actionsHtml}`; const videoElement = postDiv.querySelector('video.hls-video'); if (videoElement && videoElement.dataset.hlsSrc) { initializeHlsPlayer(videoElement, videoElement.dataset.hlsSrc); } }
    const itemToStore = feedItemOrPost.post ? feedItemOrPost : null; if (!isModal && itemToStore) { feedItemDataStore[post.uri] = itemToStore; }
    return postDiv;
}

function renderFilteredPosts(filterTab = 'posts', append = false) {
    if (!append) { postsList.innerHTML = ''; } let filteredData = []; const isProfileView = currentConfig[currentFolderIndex]?.items[currentItemIndex]?.type === 'profile'; const allData = Object.values(feedItemDataStore);
    if (isProfileView) { switch (filterTab) { case 'replies': filteredData = allData.filter(item => !!item.post.record?.reply); break; case 'media': filteredData = allData.filter(item => isMediaPost(item.post)); break; case 'links': filteredData = allData.filter(item => isLinkPost(item.post)); break; case 'videos': filteredData = allData.filter(item => isVideoPost(item.post)); break; case 'posts': default: filteredData = allData.filter(item => !item.post.record?.reply); break; } } else { filteredData = allData; }
    const isMediaGrid = isProfileView && filterTab === 'media'; const isVideoGrid = isProfileView && filterTab === 'videos'; postsList.classList.toggle('media-grid-view', isMediaGrid); postsList.classList.toggle('video-grid-view', isVideoGrid); if (!isMediaGrid && !isVideoGrid) { postsList.classList.remove('media-grid-view', 'video-grid-view'); }
    if (filteredData.length === 0) { if (!append) { postsList.innerHTML = `<div class="loading-indicator">No posts found for this filter.</div>`; } return; }
    const fragment = document.createDocumentFragment(); filteredData.forEach(feedItem => { const isGridView = isMediaGrid || isVideoGrid; const isReplyPost = !!feedItem.post.record?.reply; const postElement = renderSinglePost(feedItem, { isModal: false, isReplyContext: isReplyPost, isGridView: isGridView }); if (postElement) { fragment.appendChild(postElement); } }); postsList.appendChild(fragment);
    currentPostData = append ? [...currentPostData, ...filteredData] : filteredData;
}

function renderEmbed(embed, isQuoteContext = false) { if (!embed) return ''; let embedHtml = ''; try { if (embed.$type === 'app.bsky.embed.images#view') embedHtml = renderImagesEmbed(embed.images); else if (embed.$type === 'app.bsky.embed.video#view') embedHtml = renderVideoEmbed(embed); else if (embed.$type === 'app.bsky.embed.external#view') embedHtml = renderExternalLinkEmbed(embed.external); else if (embed.$type === 'app.bsky.embed.record#view') { if (isQuoteContext) { embedHtml = ''; } else if (embed.record?.$type === 'app.bsky.embed.record#viewRecord') embedHtml = renderRecordEmbed(embed.record); else if (embed.record?.$type === 'app.bsky.embed.record#viewNotFound') embedHtml = renderNotFoundEmbed("Post not found or taken down."); else if (embed.record?.$type === 'app.bsky.embed.record#viewBlocked') embedHtml = renderBlockedEmbed("Content blocked."); else embedHtml = renderGenericRecordEmbed(embed.record); } else if (embed.$type === 'app.bsky.embed.recordWithMedia#view') { embedHtml = renderRecordWithMediaEmbed(embed, isQuoteContext); } } catch (error) { console.error("Error rendering embed:", embed, error); embedHtml = '<div class="post-embed embed-error">[Error displaying embed]</div>'; } return embedHtml ? `<div class="post-embed">${embedHtml}</div>` : ''; }
function renderImagesEmbed(images) {
    if (!images || images.length === 0) return '';
    const imageElements = images.map(img => {
        const ar = img.aspectRatio ? `width="${img.aspectRatio.width}" height="${img.aspectRatio.height}"` : '';
        return `<a href="${escapeHtml(img.fullsize)}" target="_blank" rel="noopener noreferrer">
            <img src="${escapeHtml(img.thumb)}" alt="${escapeHtml(img.alt || 'Image')}" ${ar} loading="lazy" 
            onerror="this.src='assets/thumb.png'; this.onerror=null;"></a>`;
    }).join('');
    const countClass = `count-${Math.min(images.length, 4)}`;
    return `<div class="embed-image-container ${countClass}">${imageElements}</div>`;
}
function renderVideoEmbed(videoView) {
    if (!videoView.playlist) return '<p>Video not available.</p>';

    // Use playlist and thumbnail properly
    return `<div class="embed-video-container">
        <video 
            class="hls-video" 
            data-hls-src="${escapeHtml(videoView.playlist)}"
            poster="${escapeHtml(videoView.thumbnail || '')}"
            controls 
            playsinline
            onerror="this.poster='assets/thumb.png'; this.onerror=null;"
            style="width: 100%; max-height: 500px; aspect-ratio: ${videoView.aspectRatio?.width || 16} / ${videoView.aspectRatio?.height || 9};">
            Your browser does not support the video tag.
        </video>
        ${videoView.alt ? `<p style="font-size: 13px; color: #65676b; margin-top: 5px;">${escapeHtml(videoView.alt)}</p>` : ''}
    </div>`;
}
function initializeHlsPlayer(videoElement, hlsSrc) {
    // Basic checks
    if (!videoElement || !hlsSrc || videoElement.dataset.hlsInitialized === 'true') return;

    // Mark as initialized to prevent duplicate initialization
    videoElement.dataset.hlsInitialized = 'true';

    // The simple approach that works reliably
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(hlsSrc);
        hls.attachMedia(videoElement);
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
        // For Safari that has native HLS support
        videoElement.src = hlsSrc;
    } else {
        videoElement.outerHTML = "<p>Your browser doesn't support HLS video playback.</p>";
    }
}
// Update renderExternalLinkEmbed to hide empty elements
function renderExternalLinkEmbed(external) {
    const siteName = external.uri ? new URL(external.uri).hostname.replace(/^www\./, '') : 'External Link';
    let embedContent = `<div class="embed-external-link"><a href="${escapeHtml(external.uri)}" target="_blank" rel="noopener noreferrer">`;

    // Add thumbnail if it exists
    if (external.thumb) {
        embedContent += `<img src="${escapeHtml(external.thumb)}" class="embed-thumb" alt="Link preview" loading="lazy" onerror="this.src='assets/thumb.png'; this.onerror=null;"/>`;
    }

    embedContent += '<div class="embed-text-content">';

    // Only add title if it exists
    if (external.title) {
        embedContent += `<div class="embed-title">${escapeHtml(external.title)}</div>`;
    }

    // Only add description if it exists
    if (external.description) {
        embedContent += `<div class="embed-description">${escapeHtml(external.description)}</div>`;
    }

    // Always add site name
    embedContent += `<div class="embed-site">${escapeHtml(siteName)}</div>`;

    embedContent += '</div></a></div>';

    return embedContent;
}
function renderRecordEmbed(record) { if (!record?.value) return '<div class="embed-quoted-post embed-error">[Could not load quoted post]</div>'; const author = record.author; const value = record.value; const postText = linkifyText(value.text, value.facets); const postUrl = `https://bsky.app/profile/${author.did}/post/${record.uri.split('/').pop()}`; const nestedEmbedHtml = record.embeds && record.embeds.length > 0 ? renderEmbed(record.embeds[0]) : ''; const textHtml = postText ? `<div class="embed-quoted-post-text">${postText}</div>` : ''; return `<div class="embed-quoted-post"><a href="${postUrl}" target="_blank" rel="noopener noreferrer" class="embed-quoted-post-link"><div><div class="embed-quoted-post-author"><img src="${escapeHtml(author.avatar || 'placeholder.svg')}" class="embed-quoted-post-avatar" alt="" onerror="this.src='placeholder.svg'; this.onerror=null;"><span class="embed-quoted-post-name">${escapeHtml(author.displayName || author.handle)}</span><span class="embed-quoted-post-handle">@${escapeHtml(author.handle)}</span><span class="embed-quoted-post-timestamp"> · ${formatRelativeTime(value.createdAt || record.indexedAt)}</span></div>${textHtml}</div></a>${nestedEmbedHtml}</div>`; }
function renderGenericRecordEmbed(record) { let uri = record?.uri || '#'; let content = `Quoted item type: ${record?.$type || 'Unknown type'} - <a href="${uri}" target="_blank">View Record</a>`; return `<div class="embed-quoted-post embed-generic">${content}</div>`; }
function renderNotFoundEmbed(message) { return `<div class="embed-quoted-post embed-not-found">${escapeHtml(message)}</div>`; }
function renderBlockedEmbed(message) { return `<div class="embed-quoted-post embed-blocked">${escapeHtml(message)}</div>`; }
function renderRecordWithMediaEmbed(embed, isQuoteContext = false) { let mediaEmbed = ''; let recordEmbed = ''; if (embed.media) { if (embed.media.$type === 'app.bsky.embed.images#view') mediaEmbed = renderImagesEmbed(embed.media.images); else if (embed.media.$type === 'app.bsky.embed.external#view') mediaEmbed = renderExternalLinkEmbed(embed.media.external); } if (!isQuoteContext && embed.record?.record) { if (embed.record.record.$type === 'app.bsky.embed.record#viewRecord') recordEmbed = renderRecordEmbed(embed.record.record); else if (embed.record.record.$type === 'app.bsky.embed.record#viewNotFound') recordEmbed = renderNotFoundEmbed("Quoted post not found."); else if (embed.record.record.$type === 'app.bsky.embed.record#viewBlocked') recordEmbed = renderBlockedEmbed("Quoted content blocked."); else recordEmbed = renderGenericRecordEmbed(embed.record.record); } const recordStyle = (mediaEmbed && recordEmbed) ? 'style="margin-top: 5px;"' : ''; return `<div class="embed-record-with-media">${mediaEmbed}${recordEmbed ? `<div ${recordStyle}>${recordEmbed}</div>` : ''}</div>`; }

function showLoadingIndicator(text = 'Loading...') { return `<div class="loading-indicator"><i class="ph-duotone ph-spinner"></i> ${escapeHtml(text)}</div>`; }

function showLoading(column) {
    let element; let text = 'Loading...';
    if (column === 'items') { element = itemListScrollContainer; text = 'Loading items...'; }
    else if (column === 'posts') { element = postsList; text = 'Loading posts...'; }
    else if (column === 'header') { element = postsHeaderContent; text = 'Loading header...'; } // Target content div
    else return;
    if (element) element.innerHTML = showLoadingIndicator(text); // Check if element exists
}

function clearPosts() { postsList.innerHTML = ''; postsList.className = 'posts-list'; feedItemDataStore = {}; currentPostData = []; }
function clearItems() { itemListScrollContainer.innerHTML = ''; finderSearchContainer.style.display = 'none'; }

async function openGenericModal(title, uri, type) {
    genericModalTitle.textContent = title; genericModalBody.innerHTML = showLoadingIndicator(`Loading ${type}...`); genericModalOverlay.classList.add('visible'); document.body.classList.add('modal-open');
    genericModalCloseButton.onclick = closeGenericModal; genericModalOverlay.onclick = function (event) { if (event.target === genericModalOverlay) closeGenericModal(); }; document.addEventListener('keydown', handleModalEscapeKey);
    try { let items = []; let itemDataKey = 'posts'; if (type === 'replies') { const threadData = await getPostThread(uri, 6, 0); if (!threadData || !threadData.thread || threadData.thread.$type !== 'app.bsky.feed.defs#threadViewPost') { throw new Error("Invalid thread data received."); } items = threadData.thread.replies || []; } else if (type === 'quotes') { const quotesData = await getQuotes(uri, 50); if (!quotesData || !quotesData.posts) { throw new Error("Invalid quotes data received."); } items = quotesData.posts; itemDataKey = 'posts'; } genericModalBody.innerHTML = ''; const itemsContainer = document.createElement('div'); itemsContainer.className = `modal-${type}-container`; if (items.length > 0) { const fragment = document.createDocumentFragment(); items.forEach(itemData => { let element = null; if (type === 'replies') { if (itemData.$type === 'app.bsky.feed.defs#threadViewPost') { element = renderSinglePost(itemData.post, { isModal: true, isReplyContext: true }); } else if (itemData.$type === 'app.bsky.feed.defs#notFoundPost') { element = document.createElement('div'); element.className = 'post-item post-item-not-found'; element.innerHTML = `<div class="post-meta-info">Reply not found or deleted.</div>`; } else if (itemData.$type === 'app.bsky.feed.defs#blockedPost') { element = document.createElement('div'); element.className = 'post-item post-item-blocked'; element.innerHTML = `<div class="post-meta-info">Reply blocked.</div>`; } } else if (type === 'quotes') { element = renderSinglePost(itemData, { isModal: true, isQuoteContext: true }); } if (element) fragment.appendChild(element); }); itemsContainer.appendChild(fragment); genericModalBody.appendChild(itemsContainer); } else { genericModalBody.innerHTML = `<div class="loading-indicator">No ${type} found.</div>`; } }
    catch (error) { console.error(`Failed to load ${type}:`, error); genericModalBody.innerHTML = `<div class="loading-indicator">Error loading ${type}: ${escapeHtml(error.message)}</div>`; }
}

function closeGenericModal() { genericModalOverlay.classList.remove('visible'); document.body.classList.remove('modal-open'); genericModalBody.innerHTML = ''; genericModalCloseButton.onclick = null; genericModalOverlay.onclick = null; document.removeEventListener('keydown', handleModalEscapeKey); }
function handleModalEscapeKey(event) { if (event.key === 'Escape') { closeGenericModal(); closeAddItemModal(); } }
function openAddItemModal() { renderFinderItemsInModal(); addItemForm.reset(); addItemError.style.display = 'none'; addItemSuccess.style.display = 'none'; addItemModalOverlay.classList.add('visible'); document.body.classList.add('modal-open'); addItemModalCloseButton.onclick = closeAddItemModal; addItemModalOverlay.onclick = function (event) { if (event.target === addItemModalOverlay) closeAddItemModal(); }; document.addEventListener('keydown', handleModalEscapeKey); }
function closeAddItemModal() { addItemModalOverlay.classList.remove('visible'); document.body.classList.remove('modal-open'); addItemModalCloseButton.onclick = null; addItemModalOverlay.onclick = null; document.removeEventListener('keydown', handleModalEscapeKey); }
function renderFinderItemsInModal() { finderItemListModal.innerHTML = ''; const items = loadFinderItems(); if (items.length === 0) { finderItemListModal.innerHTML = '<li>No items saved yet.</li>'; return; } items.forEach((item, index) => { const li = document.createElement('li'); li.innerHTML = `<span>(${escapeHtml(item.type)}) ${escapeHtml(item.identifier || item.url)}</span><div class="finder-item-actions"><button title="Move Up" onclick="moveFinderItemHandler(${index}, 'up')" ${index === 0 ? 'disabled' : ''}><i class="ph ph-arrow-up"></i></button><button title="Move Down" onclick="moveFinderItemHandler(${index}, 'down')" ${index === items.length - 1 ? 'disabled' : ''}><i class="ph ph-arrow-down"></i></button><button title="Remove" onclick="removeFinderItemHandler(${index})"><i class="ph ph-trash"></i></button></div>`; finderItemListModal.appendChild(li); }); }

function initializeFolderNavigation() {
    const foldersColumn = document.getElementById('folders-column');

    foldersColumn.addEventListener('click', (e) => {
        const folderItem = e.target.closest('.folder-item');
        if (!folderItem) return;

        // Remove active class from all folders
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to clicked folder
        folderItem.classList.add('active');

        // Force layout recalculation
        folderItem.offsetHeight;

        loadFinderItemsView(folderItem.dataset.index);
    }, { passive: true }); // Add passive flag for better performance
}

window.copyPostLink = copyToClipboard; window.openGenericModal = openGenericModal; window.openAddItemModal = openAddItemModal;
window.removeFinderItemHandler = (index) => { removeFinderItem(index); renderFinderItemsInModal(); renderItems(null, currentItemIndex, handleItemClick, true); };
window.moveFinderItemHandler = (index, direction) => { moveFinderItem(index, direction); renderFinderItemsInModal(); renderItems(null, currentItemIndex, handleItemClick, true); };

