let currentMainPostData = null;
let currentPlayingFeedContext = null; // AT-URI of the feed, if current video is from a feed
let currentVideoFromFeedUri = null; // AT-URI of the specific video post loaded from a feed
let isNavigatingThroughHistory = false; // Flag to track if we're handling a popstate event

document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const searchButton = document.getElementById('searchButton');
    const messageArea = document.getElementById('messageArea');
    const hiddenPostMessage = document.getElementById('hiddenPostMessage');
    const mainPostDetailsContainer = document.getElementById('mainPostDetailsContainer');

    const commentsSectionHeader = document.querySelector('.comments-section-header');
    const commentsContainerElement = document.getElementById('commentsContainer');
    const loadMoreCommentsButtonElement = document.getElementById('loadMoreCommentsButton');

    const explorePostsContainerElement = document.getElementById('explorePostsContainer');
    const exploreSpinnerContainerElement = document.getElementById('exploreSpinnerContainer');
    const exploreSourceSelectElement = document.getElementById('exploreSourceSelect');


    const player = initializePlayer({
        videoElementId: 'videoPlayer',
        controlsContainerId: 'customControls',
        qualitySelectorId: 'qualitySelector',
        playPauseButtonId: 'playPauseButton',
        bottomPlayIconId: 'bottomPlayIcon',
        bottomPauseIconId: 'bottomPauseIcon',
        muteButtonId: 'muteButton',
        volumeIconId: 'volumeIcon',
        muteIconId: 'muteIcon',
        currentTimeDisplayId: 'currentTime',
        totalDurationDisplayId: 'totalDuration',
        progressBarWrapperClass: '.progress-bar-wrapper',
        progressBarFilledId: 'progressBarFilled',
        fullscreenButtonId: 'fullscreenButton',
        fullscreenOpenIconId: 'fullscreenIconOpen',
        fullscreenCloseIconId: 'fullscreenIconClose',
        centerControlsOverlayId: 'videoCenterControlsOverlay',
        centerRewindButtonId: 'centerRewindButton',
        centerPlayPauseButtonId: 'centerPlayPauseButton',
        centerPlayIconId: 'centerPlayIcon',
        centerPauseIconId: 'centerPauseIcon',
        centerForwardButtonId: 'centerForwardButton',
        videoStatusIconOverlayId: 'videoStatusIconOverlay'
    });

    searchButton.addEventListener('click', () => handleSearch(urlInput.value, false));
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch(urlInput.value, false);
    });

    window.addEventListener('popstate', (event) => {
        if (event.state && event.state.videoUrl) {
            isNavigatingThroughHistory = true;
            urlInput.value = event.state.videoUrl;
            handleSearch(event.state.videoUrl, false);
            isNavigatingThroughHistory = false;
        }
    });

    loadMoreCommentsButtonElement.addEventListener('click', () => {
        const atUri = getCurrentPostUriForComments();
        const cursor = getCommentsPaginationCursor();
        if (atUri && cursor) {
            fetchAndDisplayComments(atUri, cursor, true, commentsContainerElement, loadMoreCommentsButtonElement, showAppMessage, urlInput, searchButton);
        }
    });

    function showAppMessage(message, isError = false, useGlobalSpinner = false, keepSpinnerForNextStep = false) {
        hiddenPostMessage.style.display = 'none';

        if (useGlobalSpinner) {
            if (message) showGlobalSpinner(message);
        }

        if (!keepSpinnerForNextStep && useGlobalSpinner) {
            hideGlobalSpinner();
        } else if (!useGlobalSpinner) { // Also hide if not using global spinner at all for this message
            hideGlobalSpinner();
        }


        messageArea.textContent = message;
        messageArea.className = 'message-area';
        if (isError) messageArea.classList.add('error');

        // Control messageArea display
        if (message || (isError && message)) { // Show if there's a message, especially an error message
             messageArea.style.display = 'block';
        } else if (!useGlobalSpinner && !message) { // Hide if no message and not using global spinner
            messageArea.style.display = 'none';
        } else if (useGlobalSpinner && !isError && !message) { // Hide if using global spinner for a non-error, no-text message
            messageArea.style.display = 'none';
        }
    }

    async function handleSearch(urlToSearch, isRecursiveCall = false) {
        const urlValue = urlToSearch ? urlToSearch.trim() : '';
        
        hiddenPostMessage.style.display = 'none';

        if (!urlValue) {
            showAppMessage('Please enter a URL.', true, false, false);
            player.resetPlayer();
            if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
            resetCommentsSection(commentsContainerElement, loadMoreCommentsButtonElement);
            mainPostDetailsContainer.style.display = 'none';
            currentMainPostData = null;
            currentPlayingFeedContext = null; 
            currentVideoFromFeedUri = null;
            loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, null, null);
            return;
        }
        
        if (!isRecursiveCall) {
            let inputAtUri = null;
            try {
                inputAtUri = isBlueskyFeedURL(urlValue) ? 
                             await convertFeedPageUrlToAtUri(urlValue, null) : 
                             await getAtUriFromInput(urlValue, null);
            } catch (e) { /* ignore resolution error for this check */ }

            if (currentMainPostData && inputAtUri === currentMainPostData.uri) { 
                showAppMessage('This video is already loaded.', false, false, false);
                loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, currentPlayingFeedContext, currentMainPostData.uri);
                return;
            }
            if (currentPlayingFeedContext && inputAtUri === currentPlayingFeedContext && currentVideoFromFeedUri) {
                // Allow this, but the specific video check below for `currentVideoFromFeedUri` will handle if it's the *exact same video*.
            }
             if (currentPlayingFeedContext && currentVideoFromFeedUri && inputAtUri === currentVideoFromFeedUri) {
                showAppMessage('This video (from current feed) is already loaded.', false, false, false);
                loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, currentPlayingFeedContext, currentVideoFromFeedUri);
                return;
            }
        }


        player.resetPlayer();
        if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
        resetCommentsSection(commentsContainerElement, loadMoreCommentsButtonElement);
        mainPostDetailsContainer.style.display = 'none';
        
        if (!isRecursiveCall) { 
            currentMainPostData = null;
        }
        if (!isBlueskyFeedURL(urlValue) && !isRecursiveCall) {
            currentPlayingFeedContext = null;
            currentVideoFromFeedUri = null;
        }


        showAppMessage('Processing URL...', false, true, true); // Full screen spinner for initial processing

        let feedUriForSidebar = currentPlayingFeedContext; 
        let playingUriForSidebar = null;

        try {
            if (urlValue.endsWith('.m3u8')) {
                showAppMessage('', false, false, false); // Clear message area, player will show its own
                player.loadVideoSource(urlValue, showAppMessage); // Player shows its own spinner/message
                playingUriForSidebar = null; 
                feedUriForSidebar = null; 
                currentMainPostData = null; 
                currentPlayingFeedContext = null; 
                currentVideoFromFeedUri = null;
                
                if (!isNavigatingThroughHistory) {
                    window.history.pushState({ videoUrl: urlValue }, '', `?video=${encodeURIComponent(urlValue)}`);
                }
            } else if (isBlueskyFeedURL(urlValue)) {
                showAppMessage('Processing feed...', false, true, true); // Full screen spinner
                const feedAtUri = await convertFeedPageUrlToAtUri(urlValue, showAppMessage);
                
                currentPlayingFeedContext = feedAtUri; 
                feedUriForSidebar = feedAtUri;
                currentVideoFromFeedUri = null; 

                const feedApiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(feedAtUri)}&limit=50`;
                const response = await fetch(feedApiUrl);
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(`Failed to fetch feed (${response.status}): ${errorData.message || response.statusText}`);
                }
                const feedData = await response.json();

                let firstVideoPost = null;
                if (feedData.feed) {
                    for (const item of feedData.feed) {
                        if (item.post && item.post.embed && item.post.embed.$type === 'app.bsky.embed.video#view' && !isPostHiddenByLabels(item.post)) {
                            firstVideoPost = item.post;
                            break;
                        }
                    }
                }

                if (firstVideoPost) {
                    currentVideoFromFeedUri = firstVideoPost.uri; 
                    const postRkey = firstVideoPost.uri.split('/').pop();
                    const profileIdentifier = firstVideoPost.author.handle;
                    const bskyWebUrlForFirstVideo = `https://bsky.app/profile/${profileIdentifier}/post/${postRkey}`;
                    
                    if (urlInput.value !== bskyWebUrlForFirstVideo) { 
                        urlInput.value = bskyWebUrlForFirstVideo; 
                    }
                    
                    if (!isNavigatingThroughHistory) {
                        window.history.pushState({ videoUrl: bskyWebUrlForFirstVideo }, '', `?video=${encodeURIComponent(bskyWebUrlForFirstVideo)}`);
                    }
                    
                    await handleSearch(bskyWebUrlForFirstVideo, true); // Recursive call
                    return; 

                } else {
                    if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
                    playingUriForSidebar = null;
                    currentMainPostData = null; 
                    throw new Error('No playable video posts found in the provided feed or they are filtered.');
                }

            } else { 
                const atUri = await getAtUriFromInput(urlValue, showAppMessage);
                playingUriForSidebar = atUri;

                showAppMessage(`Fetching post data...`, false, true, true); // Full screen spinner
                const postData = await fetchBlueskyVideoPostData(atUri);

                if (isPostHiddenByLabels(postData)) {
                    mainPostDetailsContainer.style.display = 'none';
                    if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
                    commentsContainerElement.style.display = 'none';
                    loadMoreCommentsButtonElement.style.display = 'none';
                    player.resetPlayer();
                    hiddenPostMessage.style.display = 'block';
                    showAppMessage('', false, false, false); // Clear message area
                    currentMainPostData = null; 
                    loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, currentPlayingFeedContext, null);
                    return;
                }
                currentMainPostData = postData; 

                if (!isRecursiveCall) {
                    currentPlayingFeedContext = null;
                    currentVideoFromFeedUri = null;
                }
                feedUriForSidebar = currentPlayingFeedContext; 

                let playlistUrl = null;
                if (postData.embed && postData.embed.$type === 'app.bsky.embed.video#view' && postData.embed.playlist) {
                    playlistUrl = postData.embed.playlist;
                } else {
                    displayMainPostDetails(currentMainPostData, urlInput, searchButton);
                    if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
                    loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, feedUriForSidebar, currentMainPostData.uri);
                    throw new Error('Post does not contain a playable video.');
                }

                displayMainPostDetails(currentMainPostData, urlInput, searchButton);

                showAppMessage('', false, false, false); // Clear message area, player will handle its own
                player.loadVideoSource(playlistUrl, showAppMessage); // Player handles its own spinner
                
                if (!isNavigatingThroughHistory && !isRecursiveCall) {
                    window.history.pushState({ videoUrl: urlValue }, '', `?video=${encodeURIComponent(urlValue)}`);
                }
                
                if (atUri) {
                    if (commentsSectionHeader) commentsSectionHeader.style.display = 'block';
                    commentsContainerElement.style.display = 'block';
                    fetchAndDisplayComments(atUri, null, false, commentsContainerElement, loadMoreCommentsButtonElement, showAppMessage, urlInput, searchButton);
                }
            }
            
            loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, feedUriForSidebar, playingUriForSidebar);

        } catch (error) {
            showAppMessage(`${error.message}`, true, false, false);
            if (!currentMainPostData) { 
                mainPostDetailsContainer.style.display = 'none';
            }
            if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
            resetCommentsSection(commentsContainerElement, loadMoreCommentsButtonElement);
            loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, feedUriForSidebar, null);
        } finally {
            // Global spinner hiding (ensure it's hidden if no longer needed by other operations)
            const spinnerElement = document.getElementById('globalSpinner');
            const spinnerMsgEl = document.getElementById('spinnerMessage');
            if (spinnerElement && spinnerElement.style.display !== 'none') {
                // Hide if not explicitly kept for next step OR if message doesn't imply ongoing video init
                 if (!spinnerMsgEl || (spinnerMsgEl && !spinnerMsgEl.textContent.includes("Initializing video...") && !spinnerMsgEl.textContent.includes("Video loaded, setting quality..."))) {
                    // Check if the keepSpinnerForNextStep logic in showAppMessage handled this.
                    // This check is a fallback.
                    // Generally, hideGlobalSpinner() should be called by showAppMessage when appropriate.
                 }
            }
            // If showAppMessage was called with keepSpinnerForNextStep=true, it won't hide.
            // If last message was an error without global spinner, it's already hidden.
            // This is to catch cases where global spinner might be left on.
            // A more robust way is to ensure every path that sets it, also clears it.
            // For now, showAppMessage's logic should handle most cases.

            // Sidebar scroll restoration and flag reset
            if (window.sidebarScrollToRestore !== undefined) {
                const sidebarElem = document.querySelector('.explore-more-sidebar');
                if (sidebarElem) {
                    const scrollPos = window.sidebarScrollToRestore;
                    // Use rAF to ensure DOM updates are flushed before scrolling
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => { // Double rAF for more certainty
                            sidebarElem.scrollTop = scrollPos;
                        });
                    });
                }
                delete window.sidebarScrollToRestore; // Clear after attempting to restore
            }
            // Always reset the global flag after handleSearch completes
            window.preventSidebarReloadGlobal = false;
        }
    }

    function displayMainPostDetails(post, urlInputRef, searchButtonRef) {
        if (!post || !post.author || !post.record) {
            mainPostDetailsContainer.style.display = 'none';
            return;
        }
    
        const authorAvatarSrc = post.author.avatar || DEFAULT_AVATAR;
        const authorDisplayName = escapeHtml(post.author.displayName || post.author.handle);
        const authorHandleText = escapeHtml(post.author.handle);
        const verificationHtml = (post.author.verification && post.author.verification.verifiedStatus === 'valid')
            ? '<span class="verification-badge"><i class="ph-fill ph-seal-check"></i></span>'
            : '';
    
        const postTextHtml = post.record.text
            ? `<p class="main-post-text">${parseFacetsToHtml(post.record.text, post.record.facets, urlInputRef, searchButtonRef)}</p>`
            : '';
    
        const postRkey = post.uri.split('/').pop();
        const blueskyPostUrl = `https://bsky.app/profile/${post.author.did}/post/${postRkey}`;
    
        const likeCount = post.likeCount || 0;
        const repostCount = post.repostCount || 0;
    
        let metaHtml = '';
    
        if (likeCount > 0) {
            metaHtml += `<div><i class="ph ph-heart"></i> ${formatNumberWithCommas(likeCount)} ${likeCount === 1 ? 'Like' : 'Likes'}</div>`;
        }
    
        if (repostCount > 0) {
            metaHtml += `<div><i class="ph ph-repeat"></i> ${formatNumberWithCommas(repostCount)} ${repostCount === 1 ? 'Repost' : 'Reposts'}</div>`;
        }
    
        const timeAgo = formatRelativeTime(post.record.createdAt);
        const absoluteTime = formatAbsoluteDateTime(post.record.createdAt);
    
        if (typeof timeAgo === 'string' && timeAgo.trim().length > 0) {
            metaHtml += `<div class="post-time" title="${absoluteTime}">${timeAgo}</div>`;
        }
    
        mainPostDetailsContainer.innerHTML = `
            <div class="main-post-header">
                <div class="main-post-author">
                    <img id="mainPostAuthorAvatar" src="${authorAvatarSrc}" alt="${authorDisplayName}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <div class="main-post-author-info">
                        <div>
                            <strong id="mainPostAuthorDisplayName">${authorDisplayName}</strong>
                            ${verificationHtml}
                        </div>
                        <div>
                            <span id="mainPostAuthorHandle">@${authorHandleText}</span>
                        </div>
                    </div>
                </div>
                <a id="openInBlueskyLink" href="${blueskyPostUrl}" target="_blank" rel="noopener noreferrer" class="open-in-bluesky-button" title="Open post in Bluesky">
                    <i class="ph ph-arrow-square-out"></i>
                </a>
            </div>
            ${postTextHtml}
            <div id="mainPostMeta" class="main-post-meta">
                ${metaHtml}
            </div>
        `;
        mainPostDetailsContainer.style.display = 'block';
    
        mainPostDetailsContainer.querySelectorAll('.internal-bsky-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const bskyUrl = link.dataset.bskyLink;
                if (urlInputRef && searchButtonRef && bskyUrl) {
                    urlInputRef.value = bskyUrl;
                    searchButtonRef.click(false); // Ensure this matches how you trigger search
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }
    

    async function initializeApp() {
        // Initialize global flags if they don't exist
        window.preventSidebarReloadGlobal = window.preventSidebarReloadGlobal || false;
        if (typeof window.sidebarScrollToRestore === 'undefined') {
            window.sidebarScrollToRestore = undefined;
        }


        const experimentalFeedUrl = "https://bsky.app/profile/romiojoseph.github.io/feed/stream";
        const oldDefaultPostUrlForInputCheck = "https://bsky.app/profile/letterboxd.social/post/3lovot24hoc2o";

        let urlToLoadInitially = experimentalFeedUrl; 

        const currentUrlInInput = urlInput.value.trim();
        if (currentUrlInInput !== "" && currentUrlInInput !== oldDefaultPostUrlForInputCheck) {
            urlToLoadInitially = currentUrlInInput;
        } else if (currentUrlInInput === oldDefaultPostUrlForInputCheck || currentUrlInInput === "") {
            urlInput.value = ''; 
        }
        
        await handleSearch(urlToLoadInitially, false); 
    }

    initializeApp();

});