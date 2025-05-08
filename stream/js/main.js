let currentMainPostData = null;
let currentPlayingPostFromFeed = null;

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

    searchButton.addEventListener('click', () => handleSearch(urlInput.value));
    urlInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleSearch(urlInput.value);
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
        } else if (!useGlobalSpinner) {
            hideGlobalSpinner();
        }

        messageArea.textContent = message;
        messageArea.className = 'message-area';
        if (isError) messageArea.classList.add('error');

        if ((message || isError) && !useGlobalSpinner) {
            messageArea.style.display = 'block';
        } else if (!useGlobalSpinner) {
            messageArea.style.display = 'none';
        }

        if (useGlobalSpinner && !isError) {
            messageArea.style.display = 'none';
        }
        if (useGlobalSpinner && isError && message) {
            messageArea.style.display = 'block';
        }
        if (useGlobalSpinner && !message && !isError) {
            messageArea.style.display = 'none';
        }
    }

    async function handleSearch(urlToSearch) {
        const urlValue = urlToSearch.trim();
        currentPlayingPostFromFeed = null;
        hiddenPostMessage.style.display = 'none';


        if (!urlValue) {
            showAppMessage('Please enter a URL.', true);
            return;
        }

        player.resetPlayer();
        if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
        resetCommentsSection(commentsContainerElement, loadMoreCommentsButtonElement);

        mainPostDetailsContainer.style.display = 'none';
        mainPostDetailsContainer.innerHTML = '';
        currentMainPostData = null;

        showAppMessage('Processing URL...', false, true, true);

        try {
            if (urlValue.endsWith('.m3u8')) {
                showAppMessage('Loading M3U8 video...', false, true, false);
                player.loadVideoSource(urlValue, showAppMessage);
            } else if (isBlueskyFeedURL(urlValue)) {
                showAppMessage('Processing feed...', false, true, true);
                const feedAtUri = await convertFeedPageUrlToAtUri(urlValue, showAppMessage);

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
                    currentPlayingPostFromFeed = firstVideoPost.uri;
                    const postRkey = firstVideoPost.uri.split('/').pop();
                    const profileIdentifier = firstVideoPost.author.handle;
                    const bskyWebUrlForFirstVideo = `https://bsky.app/profile/${profileIdentifier}/post/${postRkey}`;

                    await handleSearch(bskyWebUrlForFirstVideo);
                    showAppMessage('', false, false, false);

                    loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, feedAtUri, firstVideoPost.uri);

                } else {
                    if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
                    throw new Error('No playable video posts found in the provided feed or they are filtered.');
                }

            } else {
                const atUri = await getAtUriFromInput(urlValue, showAppMessage);

                showAppMessage(`Fetching post data...`, false, true, true);
                const postData = await fetchBlueskyVideoPostData(atUri);

                if (isPostHiddenByLabels(postData)) {
                    mainPostDetailsContainer.style.display = 'none';
                    if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
                    commentsContainerElement.style.display = 'none';
                    loadMoreCommentsButtonElement.style.display = 'none';
                    player.resetPlayer();
                    hiddenPostMessage.style.display = 'block';
                    showAppMessage('', false, false, false);
                    return;
                }
                currentMainPostData = postData;


                let playlistUrl = null;
                if (postData.embed && postData.embed.$type === 'app.bsky.embed.video#view' && postData.embed.playlist) {
                    playlistUrl = postData.embed.playlist;
                } else {
                    displayMainPostDetails(currentMainPostData, urlInput, searchButton);
                    if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
                    throw new Error('Post does not contain a playable video.');
                }

                displayMainPostDetails(currentMainPostData, urlInput, searchButton);

                showAppMessage('Loading video...', false, true, false);
                player.loadVideoSource(playlistUrl, showAppMessage);

                if (atUri) {
                    if (commentsSectionHeader) commentsSectionHeader.style.display = 'block';
                    commentsContainerElement.style.display = 'block';
                    fetchAndDisplayComments(atUri, null, false, commentsContainerElement, loadMoreCommentsButtonElement, showAppMessage, urlInput, searchButton);
                }
                if (!currentPlayingPostFromFeed) {
                    loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, null, atUri);
                }
            }
        } catch (error) {
            showAppMessage(`${error.message}`, true, false, false);
            if (!currentMainPostData) {
                mainPostDetailsContainer.style.display = 'none';
            }
            if (commentsSectionHeader) commentsSectionHeader.style.display = 'none';
            resetCommentsSection(commentsContainerElement, loadMoreCommentsButtonElement);
        } finally {
            const spinnerElement = document.getElementById('globalSpinner');
            if (spinnerElement && spinnerElement.style.display !== 'none') {
                hideGlobalSpinner();
            }
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
            metaHtml += `<span>${formatNumberWithCommas(likeCount)} ${likeCount === 1 ? 'Like' : 'Likes'}</span>`;
        }
        if (repostCount > 0) {
            metaHtml += `${likeCount > 0 ? ' • ' : ''}<span>${formatNumberWithCommas(repostCount)} ${repostCount === 1 ? 'Repost' : 'Reposts'}</span>`;
        }

        if (likeCount === 0 && repostCount === 0) {
            metaHtml = '<span>No likes or reposts yet.</span>';
        }

        metaHtml += `<span class="post-time">${formatRelativeTime(post.record.createdAt)}</span>`;


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
                    searchButtonRef.click();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    async function initializeApp() {
        // First, ensure the dropdown is populated
        await loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, null, null);

        // Then, handle initial URL (default or from input)
        const defaultPostUrl = "https://bsky.app/profile/phillewis.bsky.social/post/3loocnxcs622u";
        let urlToLoadInitially = defaultPostUrl;
        let playingUriForSidebar = null;

        if (urlInput.value && urlInput.value.trim() !== "") {
            urlToLoadInitially = urlInput.value.trim();
        } else {
            urlInput.value = ''; // Clear if it was empty, so default is loaded without user input shown
        }

        await handleSearch(urlToLoadInitially);

        // After handleSearch, currentMainPostData or currentPlayingPostFromFeed might be set
        // This is mainly for the case where the initial load was a *single post*,
        // so we want the sidebar to refresh without that single post.
        // If it was a feed, loadExplorePosts was already called with the feed URI.
        if (currentMainPostData && !currentPlayingPostFromFeed) {
            playingUriForSidebar = currentMainPostData.uri;
            // Refresh explore posts, excluding the one just loaded if it was a single post
            loadExplorePosts(urlInput, searchButton, explorePostsContainerElement, exploreSpinnerContainerElement, exploreSourceSelectElement, showAppMessage, null, playingUriForSidebar);
        } else if (currentPlayingPostFromFeed) {
            // If a feed was loaded, loadExplorePosts was already called from within handleSearch.
            // No further action needed here for the sidebar related to the *initial feed* load.
        }
    }

    initializeApp();

});