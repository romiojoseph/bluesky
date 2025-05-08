const EXPLORE_POST_BATCH_SIZE = 10;
const EXPLORE_FEED_LIMIT = 25;

let jsonDataSource = null;
let isDropdownPopulated = false; // Crucial flag
let currentFeedCursor = null;
let isLoadingMoreFeedPosts = false;
let currentFeedAtUriForInfiniteScroll = null;


async function loadExplorePosts(urlInputRef, searchButtonRef, exploreContainerEl, exploreSpinnerContainerEl, exploreSourceSelectEl, showMessageCallback, feedAtUriToLoad = null, playingPostUri = null) {
    const exploreFeedEndMessageEl = document.getElementById('exploreFeedEndMessage');
    exploreFeedEndMessageEl.style.display = 'none';

    // Ensure dropdown is populated only once
    if (!isDropdownPopulated) {
        // This will set isDropdownPopulated = true upon successful completion
        await populateExploreDropdownAndSetupListener(exploreSourceSelectEl, urlInputRef, searchButtonRef, exploreContainerEl, exploreSpinnerContainerEl, showMessageCallback);
    }

    // Wait for dropdown population if it was just initiated
    // A simple mechanism, could be improved with a promise if populateExplore... itself returned one.
    while (!isDropdownPopulated) {
        await new Promise(resolve => setTimeout(resolve, 50)); // Small delay to allow population
    }


    const oldTempOption = document.getElementById("tempCustomFeedOption");
    if (oldTempOption && oldTempOption.value !== feedAtUriToLoad) {
        oldTempOption.remove();
    }

    if (feedAtUriToLoad) {
        const feedOption = Array.from(exploreSourceSelectEl.options).find(opt => opt.value === feedAtUriToLoad || opt.dataset.feedAtUri === feedAtUriToLoad);
        if (feedOption) {
            exploreSourceSelectEl.value = feedOption.value;
        } else {
            if (!document.getElementById("tempCustomFeedOption") || document.getElementById("tempCustomFeedOption").value !== feedAtUriToLoad) {
                const feedRkey = feedAtUriToLoad.split('/').pop();
                const customOption = document.createElement('option');
                customOption.value = feedAtUriToLoad;
                customOption.dataset.feedAtUri = feedAtUriToLoad;
                customOption.textContent = `Current: ${feedRkey}`;
                customOption.id = "tempCustomFeedOption";
                exploreSourceSelectEl.appendChild(customOption);
                exploreSourceSelectEl.value = feedAtUriToLoad;
            }
        }
        await displaySelectedExploreContent(feedAtUriToLoad, urlInputRef, searchButtonRef, exploreContainerEl, exploreSpinnerContainerEl, showMessageCallback, true, playingPostUri);
    } else {
        const tempOpt = document.getElementById("tempCustomFeedOption");
        if (tempOpt && exploreSourceSelectEl.value !== tempOpt.value) {
            tempOpt.remove();
        }
        await displaySelectedExploreContent(exploreSourceSelectEl.value, urlInputRef, searchButtonRef, exploreContainerEl, exploreSpinnerContainerEl, showMessageCallback, exploreSourceSelectEl.value !== '__presaved__', playingPostUri);
    }

    const sidebar = document.querySelector('.explore-more-sidebar');

    if (!sidebar.dataset.infiniteScrollAttached) {
        // Handle both scroll and touch events
        const handleScroll = async (e) => {
            const container = e.target;
            const scrollPosition = container.scrollTop + container.clientHeight;
            const totalHeight = container.scrollHeight;
            const threshold = 100; // pixels before bottom

            if (!isLoadingMoreFeedPosts &&
                scrollPosition + threshold >= totalHeight) {
                isLoadingMoreFeedPosts = true;
                exploreSpinnerContainerEl.style.display = 'block';

                try {
                    const feedApiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(currentFeedAtUriForInfiniteScroll)}&limit=${EXPLORE_FEED_LIMIT}&cursor=${encodeURIComponent(currentFeedCursor)}`;
                    const response = await fetch(feedApiUrl);
                    if (!response.ok) {
                        const errorData = await response.json().catch(() => ({}));
                        throw new Error(`Failed to fetch more feed items (${response.status}): ${errorData.message || response.statusText}`);
                    }
                    const data = await response.json();
                    let postsAdded = 0;
                    if (data.feed && data.feed.length > 0) {
                        data.feed.forEach(item => {
                            const post = item.post;
                            if (post && post.embed && post.embed.$type === "app.bsky.embed.video#view" && post.author && post.record && !isPostHiddenByLabels(post) && post.uri !== playingPostUri) {
                                const card = createExplorePostCard(post, urlInputRef, searchButtonRef);
                                exploreContainerEl.appendChild(card);
                                postsAdded++;
                            }
                        });
                    }
                    currentFeedCursor = data.cursor || null;
                    if (!currentFeedCursor && postsAdded === 0 && data.feed.length === 0) {
                        exploreFeedEndMessageEl.style.display = 'block';
                    } else if (!currentFeedCursor && postsAdded >= 0 && data.feed.length < EXPLORE_FEED_LIMIT) {
                        exploreFeedEndMessageEl.style.display = 'block';
                    }

                } catch (error) {
                    console.error('Error loading more feed posts:', error);
                } finally {
                    isLoadingMoreFeedPosts = false;
                    exploreSpinnerContainerEl.style.display = 'none';
                }
            }
        };

        // Attach scroll event
        sidebar.addEventListener('scroll', handleScroll);

        // Also handle touch events for mobile
        let touchStartY = 0;
        sidebar.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        }, { passive: true });

        sidebar.addEventListener('touchmove', (e) => {
            const touchY = e.touches[0].clientY;
            const container = sidebar;
            const scrollPosition = container.scrollTop + container.clientHeight;
            const totalHeight = container.scrollHeight;
            const threshold = 100;

            if (!isLoadingMoreFeedPosts &&
                scrollPosition + threshold >= totalHeight &&
                touchStartY > touchY) { // Only load more when scrolling down
                handleScroll({ target: container });
            }
        }, { passive: true });

        sidebar.dataset.infiniteScrollAttached = 'true';
    }
}


async function populateExploreDropdownAndSetupListener(exploreSourceSelectEl, urlInputRef, searchButtonRef, exploreContainerEl, exploreSpinnerContainerEl, showMessageCallback) {
    if (isDropdownPopulated) { // Check at the very beginning
        return;
    }
    isDropdownPopulated = true; // Set flag early to prevent race conditions

    try {
        const response = await fetch('assets/video_posts.json');
        if (!response.ok) throw new Error(`Failed to load explore posts config: ${response.status} ${response.statusText}`);
        jsonDataSource = await response.json();

        exploreSourceSelectEl.innerHTML = '';

        const presavedOption = document.createElement('option');
        presavedOption.value = '__presaved__';
        presavedOption.textContent = 'Preloaded videos';
        exploreSourceSelectEl.appendChild(presavedOption);

        if (jsonDataSource.feedGenerators && Array.isArray(jsonDataSource.feedGenerators)) {
            for (const feed of jsonDataSource.feedGenerators) {
                if (feed.name && feed.url) {
                    const feedOption = document.createElement('option');
                    try {
                        const feedAtUri = await convertFeedPageUrlToAtUri(feed.url, null);
                        feedOption.value = feedAtUri;
                        feedOption.dataset.feedAtUri = feedAtUri;
                        feedOption.textContent = feed.name;
                        exploreSourceSelectEl.appendChild(feedOption);
                    } catch (e) {
                        console.warn(`Could not resolve AT URI for feed '${feed.name}' (${feed.url}): ${e.message}`);
                    }
                }
            }
        }
        // isDropdownPopulated = true; // Moved up to prevent race conditions

        exploreSourceSelectEl.addEventListener('change', (event) => {
            const tempOption = document.getElementById("tempCustomFeedOption");
            if (tempOption && tempOption.value !== event.target.value) {
                tempOption.remove();
            }
            displaySelectedExploreContent(event.target.value, urlInputRef, searchButtonRef, exploreContainerEl, exploreSpinnerContainerEl, showMessageCallback, event.target.value !== '__presaved__');
        });

    } catch (error) {
        isDropdownPopulated = false; // Reset if failed
        console.error('Error initializing explore section:', error);
        exploreContainerEl.innerHTML = `<p style="color:red;">Error initializing explore sources: ${error.message}</p>`;
        exploreSpinnerContainerEl.style.display = 'none';
        if (jsonDataSource === null && showMessageCallback) showMessageCallback('Failed to load explore configuration.', true, false, false);
    }
}

async function displaySelectedExploreContent(selectedValueOrAtUri, urlInputRef, searchButtonRef, exploreContainerEl, exploreSpinnerContainerEl, showMessageCallback, isFeed = false, playingPostUri = null) {
    exploreSpinnerContainerEl.style.display = 'flex';
    exploreContainerEl.innerHTML = '';
    currentFeedCursor = null;
    currentFeedAtUriForInfiniteScroll = null;
    isLoadingMoreFeedPosts = false;
    const exploreFeedEndMessageEl = document.getElementById('exploreFeedEndMessage');
    exploreFeedEndMessageEl.style.display = 'none';


    try {
        if (!jsonDataSource) {
            const response = await fetch('assets/video_posts.json');
            if (!response.ok) throw new Error(`Failed to load explore posts config: ${response.status} ${response.statusText}`);
            jsonDataSource = await response.json();
        }

        if (selectedValueOrAtUri === '__presaved__') {
            await fetchAndDisplayPresavedVideoPosts(jsonDataSource.postUris || [], urlInputRef, searchButtonRef, exploreContainerEl, showMessageCallback, playingPostUri);
        } else {
            currentFeedAtUriForInfiniteScroll = selectedValueOrAtUri;
            await fetchAndDisplayFeedVideoPosts(selectedValueOrAtUri, urlInputRef, searchButtonRef, exploreContainerEl, showMessageCallback, playingPostUri);
        }
    } catch (error) {
        console.error('Error displaying explore content:', error);
        exploreContainerEl.innerHTML = `<p style="color:red;">Error loading content: ${error.message}</p>`;
    } finally {
        exploreSpinnerContainerEl.style.display = 'none';
        if (showMessageCallback) showMessageCallback('', false, false, false);
        else hideGlobalSpinner();
    }
}

async function fetchAndDisplayPresavedVideoPosts(postUrls, urlInputRef, searchButtonRef, exploreContainerEl, showMessageCallback, playingPostUri = null) {
    if (!postUrls || postUrls.length === 0) {
        exploreContainerEl.innerHTML = '<p>No presaved posts to explore currently.</p>';
        return;
    }

    const resolvedAtUris = [];
    for (const url of postUrls) {
        if (typeof url === 'string') {
            try {
                const atUri = await getAtUriFromInput(url, null);
                if (atUri !== playingPostUri) {
                    resolvedAtUris.push(atUri);
                }
            } catch (err) {
                console.warn(`Failed to convert presaved URL to AT URI: ${url}. Error: ${err.message}`);
            }
        }
    }

    if (resolvedAtUris.length === 0 && playingPostUri && postUrls.length > 0) {
        exploreContainerEl.innerHTML = '<p>The only presaved post is currently playing.</p>';
        return;
    }
    if (resolvedAtUris.length === 0) {
        exploreContainerEl.innerHTML = '<p>No valid Bluesky posts found to explore after resolving presaved URLs.</p>';
        return;
    }

    let postsAdded = 0;
    for (let i = 0; i < resolvedAtUris.length; i += EXPLORE_POST_BATCH_SIZE) {
        const batchUris = resolvedAtUris.slice(i, i + EXPLORE_POST_BATCH_SIZE);
        if (batchUris.length === 0) continue;

        const queryParams = new URLSearchParams();
        batchUris.forEach(uri => queryParams.append('uris', uri));
        const postsApiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?${queryParams.toString()}`;

        try {
            const postsResponse = await fetch(postsApiUrl);
            if (!postsResponse.ok) {
                const errorText = await postsResponse.text();
                console.error(`Failed to fetch batch of presaved posts (Status: ${postsResponse.status}): ${postsApiUrl}. Response: ${errorText.substring(0, 200)}`);
                continue;
            }
            const postsData = await postsResponse.json();

            if (postsData.posts) {
                postsData.posts.forEach(post => {
                    if (post && post.embed && post.embed.$type === "app.bsky.embed.video#view" && post.author && post.record && !isPostHiddenByLabels(post)) {
                        const card = createExplorePostCard(post, urlInputRef, searchButtonRef);
                        exploreContainerEl.appendChild(card);
                        postsAdded++;
                    }
                });
            }
        } catch (fetchError) {
            console.error(`Network error or JSON parse error fetching presaved batch from ${postsApiUrl}:`, fetchError);
        }
    }
    if (postsAdded === 0) {
        exploreContainerEl.innerHTML = '<p>No video posts found in the presaved list after filtering.</p>';
    }
}

async function fetchAndDisplayFeedVideoPosts(feedAtUri, urlInputRef, searchButtonRef, exploreContainerEl, showMessageCallback, playingPostUri = null) {
    const exploreFeedEndMessageEl = document.getElementById('exploreFeedEndMessage');
    try {
        const feedApiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getFeed?feed=${encodeURIComponent(feedAtUri)}&limit=${EXPLORE_FEED_LIMIT}`;

        const response = await fetch(feedApiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch feed '${feedAtUri}' (${response.status}): ${errorData.message || response.statusText}`);
        }
        const data = await response.json();
        currentFeedCursor = data.cursor || null;

        let videoPostCount = 0;
        if (data.feed && data.feed.length > 0) {
            data.feed.forEach(item => {
                const post = item.post;
                if (post && post.embed && post.embed.$type === "app.bsky.embed.video#view" && post.author && post.record && !isPostHiddenByLabels(post) && post.uri !== playingPostUri) {
                    const card = createExplorePostCard(post, urlInputRef, searchButtonRef);
                    exploreContainerEl.appendChild(card);
                    videoPostCount++;
                }
            });
        }

        if (videoPostCount === 0 && !currentFeedCursor && (!data.feed || data.feed.length === 0)) {
            exploreContainerEl.innerHTML = `<p class="user-notice">No video posts found in this feed after filtering.</p>`;
        } else if (videoPostCount === 0 && playingPostUri && data.feed && data.feed.length > 0) {
            exploreContainerEl.innerHTML = `<p class="user-notice">The only video posts in this feed are currently playing or filtered out.</p>`;
        } else if (videoPostCount === 0 && data.feed && data.feed.length > 0) {
            exploreContainerEl.innerHTML = `<p class="user-notice">No video posts found in this feed after filtering.</p>`;
        }

        if (!currentFeedCursor && videoPostCount > 0) {
            exploreFeedEndMessageEl.style.display = 'block';
        }


    } catch (error) {
        console.error(`Error loading posts from feed ${feedAtUri}:`, error);
        exploreContainerEl.innerHTML = `<p style="color:red;">Error loading feed: ${error.message}</p>`;
        currentFeedCursor = null;
        currentFeedAtUriForInfiniteScroll = null;
        if (showMessageCallback) showMessageCallback('', false, false, false);
    }
}


function createExplorePostCard(post, urlInputRef, searchButtonRef) {
    const card = document.createElement('div');
    card.classList.add('explore-post-card');
    card.dataset.uri = post.uri;

    const thumbnailContainer = document.createElement('div');
    thumbnailContainer.classList.add('explore-thumbnail-container');

    const thumbnailImg = document.createElement('img');
    thumbnailImg.classList.add('explore-thumbnail');

    if (post.embed && post.embed.$type === "app.bsky.embed.video#view" && post.embed.thumbnail) {
        thumbnailImg.src = post.embed.thumbnail;
    } else {
        thumbnailImg.src = DEFAULT_AVATAR;
    }
    thumbnailImg.alt = `Thumbnail for post by ${post.author.handle}`;
    thumbnailImg.onerror = () => {
        thumbnailImg.src = DEFAULT_AVATAR;
    };
    thumbnailContainer.appendChild(thumbnailImg);

    const playIconOverlay = document.createElement('div');
    playIconOverlay.classList.add('explore-play-icon-overlay');
    playIconOverlay.innerHTML = '<i class="ph-bold ph-play-circle"></i>';
    thumbnailContainer.appendChild(playIconOverlay);

    const metricsOverlay = document.createElement('div');
    metricsOverlay.classList.add('explore-metrics-overlay');

    const likeCount = post.likeCount || 0;
    const repostCount = post.repostCount || 0;

    if (likeCount > 0) {
        const likesSpan = document.createElement('span');
        likesSpan.innerHTML = `<i class="ph ph-heart"></i> ${formatNumberWithCommas(likeCount)}`;
        metricsOverlay.appendChild(likesSpan);
    }
    if (repostCount > 0) {
        const repostsSpan = document.createElement('span');
        repostsSpan.innerHTML = `<i class="ph ph-repeat"></i> ${formatNumberWithCommas(repostCount)}`;
        metricsOverlay.appendChild(repostsSpan);
    }
    if (metricsOverlay.hasChildNodes()) {
        thumbnailContainer.appendChild(metricsOverlay);
    }


    card.appendChild(thumbnailContainer);

    const infoDiv = document.createElement('div');
    infoDiv.classList.add('explore-info');

    const authorDiv = document.createElement('div');
    authorDiv.classList.add('explore-author');
    const handleSpan = document.createElement('span');
    handleSpan.classList.add('author-handle');
    handleSpan.textContent = `@${post.author.handle}`;
    authorDiv.appendChild(handleSpan);

    if (post.author.verification && post.author.verification.verifiedStatus === 'valid') {
        const verifiedBadge = document.createElement('span');
        verifiedBadge.classList.add('verification-badge');
        verifiedBadge.innerHTML = '<i class="ph-fill ph-seal-check"></i>';
        authorDiv.appendChild(verifiedBadge);
    }
    infoDiv.appendChild(authorDiv);

    const timestampDiv = document.createElement('div');
    timestampDiv.classList.add('explore-timestamp');
    timestampDiv.textContent = formatAbsoluteDateTime(post.record.createdAt);
    infoDiv.appendChild(timestampDiv);

    if (post.record.text) {
        const textPreviewDiv = document.createElement('div');
        textPreviewDiv.classList.add('explore-text-preview');
        textPreviewDiv.textContent = post.record.text;
        infoDiv.appendChild(textPreviewDiv);
    }

    card.appendChild(infoDiv);

    card.addEventListener('click', () => {
        if (urlInputRef && searchButtonRef && post.uri) {
            const postRkey = post.uri.split('/').pop();
            const profileIdentifier = post.author.handle;
            const bskyWebUrl = `https://bsky.app/profile/${profileIdentifier}/post/${postRkey}`;
            urlInputRef.value = bskyWebUrl;

            searchButtonRef.click();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    return card;
}