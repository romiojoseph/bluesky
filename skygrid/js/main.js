// js/main.js

const App = {
    config: null,
    currentMode: 'feed', // 'feed' or 'search'
    // --- State for Feed Mode ---
    currentFeedItem: null, // Stores { uri, type, name } for current feed/list tab
    feedCursor: null,
    // --- State for Search Mode ---
    currentSearchActor: null, // Stores { did, handle, profile } for profile search
    currentSearchUri: null,   // Stores AT URI for direct feed/list search
    currentSearchType: null,  // Stores 'feed' or 'list' for direct search
    currentSearchName: null,  // Stores name/description for direct search
    searchCursor: null,
    // --- Common State ---
    isLoadingFeed: false,
    isLoadingDetails: false,
    lastFailedAction: null, // For retry button
    masonryInstance: null, // Holds the Masonry instance
    resizeTimeout: null, // For debouncing resize
    isInitialLayoutComplete: false, // NEW: Track if initial Masonry layout is done

    init: async () => {
        // console.log("App initializing..."); // Removed log
        UI.showLoading();
        App.resetErrorState();
        App.isInitialLayoutComplete = false; // Reset on init

        try {
            await Config.load();
            App.config = await Config.process();

            if (!App.config || App.config.length === 0) {
                console.warn("Initialization stopped: No valid feeds/lists processed from config.");
                UI.hideLoading(); // Hide loading if no config
                UI.init([], App.handleTabClick, App.retryLastAction, App.handleSearchSubmit);
                return;
            }

            UI.init(App.config, App.handleTabClick, App.retryLastAction, App.handleSearchSubmit);

            App.currentMode = 'feed';
            App.currentFeedItem = App.config[0];
            App.clearSearchState();
            UI.setActiveTab(App.currentFeedItem.atUri);
            await App.loadCurrentFeedOrSearch(true);

            window.addEventListener('resize', App.handleResize);
            window.addEventListener('scroll', App.handleScroll);

        } catch (error) {
            console.error("Initialization failed:", error);
            if (!document.querySelector('.error-indicator:not(.hidden)')) {
                UI.showError(`Initialization failed: ${error.message}`);
            }
            UI.hideLoading(); // Hide loading on init error
        } finally {
            // Hide loading is now handled within loadCurrentFeedOrSearch/renderFeedItems for initial load
            // Only hide here if an early error occurred *before* loadCurrentFeedOrSearch was awaited
            if (!App.isInitialLayoutComplete && !App.isLoadingFeed && !document.querySelector('.error-indicator:not(.hidden)')) {
                // UI.hideLoading(); // Let imagesLoaded handle initial hide
            }
        }
    },

    handleResize: () => {
        Utils.debounce(() => {
            if (App.masonryInstance && !App.isLoadingFeed && UI.detailView.classList.contains('hidden')) {
                // console.log("Window resized, re-laying out Masonry..."); // Removed log
                try {
                    App.masonryInstance.layout();
                } catch (e) {
                    console.error("Error during Masonry layout on resize:", e);
                }
            }
        }, 250)();
    },

    loadCurrentFeedOrSearch: async (isInitialLoad = false) => {
        if (App.isLoadingFeed) return;

        let currentCursor = null;
        let identifier = null;
        let type = null;
        let displayName = 'Content';

        if (App.currentMode === 'search') {
            currentCursor = App.searchCursor;
            if (App.currentSearchActor) {
                identifier = App.currentSearchActor.did;
                type = 'author';
                displayName = `@${App.currentSearchActor.handle}'s feed`;
            } else if (App.currentSearchUri) {
                identifier = App.currentSearchUri;
                type = App.currentSearchType;
                displayName = `${App.currentSearchName || (type === 'list' ? 'List' : 'Feed')}`;
            }
        } else {
            currentCursor = App.feedCursor;
            identifier = App.currentFeedItem?.atUri;
            type = App.currentFeedItem?.type;
            displayName = `'${App.currentFeedItem?.name}' ${type}`;
        }

        if (!identifier || !type) {
            console.warn("Cannot load: Missing identifier or type.", { mode: App.currentMode, identifier, type });
            if (isInitialLoad) UI.hideLoading(); // Hide if we can't even start
            return;
        }

        if (!isInitialLoad && currentCursor === null) {
            // console.log(`Already at the end of ${displayName}. No more items to load.`); // Removed log
            if (UI.feedContainer.children.length > 0 && UI.feedEndMessage.classList.contains('hidden')) {
                UI.showFeedEndMessage(`You've reached the end of ${displayName}.`);
            }
            return;
        }

        App.isLoadingFeed = true;
        if (isInitialLoad) {
            App.isInitialLayoutComplete = false; // Reset flag for new initial load
            UI.clearFeed();
            if (App.currentMode === 'feed') {
                UI.clearSearchProfileHeader();
                UI.clearDirectSearchHeader();
            } else if (App.currentSearchActor) {
                UI.clearDirectSearchHeader();
            } else {
                UI.clearSearchProfileHeader();
            }
            UI.showLoading(); // Show loading indicator for initial load
        }
        App.resetErrorState();
        UI.hideFeedEndMessage();

        try {
            let data;
            const limit = 50; // Increased limit slightly

            // console.log(`Loading ${type}: ${identifier}, Cursor: ${currentCursor}`); // Removed log

            switch (type) {
                case 'author':
                    data = await API.getAuthorFeed(identifier, limit, currentCursor);
                    break;
                case 'list':
                    data = await API.getListFeed(identifier, limit, currentCursor);
                    break;
                case 'feed':
                    data = await API.getFeed(identifier, limit, currentCursor);
                    break;
                default:
                    throw new Error(`Unknown feed type: ${type}`);
            }

            if (data && data.feed) {
                const newCursor = data.cursor || null;

                if (App.currentMode === 'search') App.searchCursor = newCursor;
                else App.feedCursor = newCursor;

                // console.log(`Received ${data.feed.length} posts from ${displayName}. New cursor: ${newCursor}`); // Removed log

                // --- MODIFIED: Filter posts WITH valid media AND WITHOUT labels ---
                const postsToRender = data.feed.filter(item => {
                    if (!item.post) return false;
                    // Check for labels FIRST
                    if (item.post.labels && item.post.labels.length > 0) {
                        // console.log(`Skipping post ${item.post.uri} due to labels:`, item.post.labels); // Keep as warn/debug? Let's remove for now.
                        return false; // Skip if labels exist
                    }
                    // THEN check for valid media
                    const mediaInfo = Utils.extractMediaInfo(item.post); // extractMediaInfo already returns null if labels exist
                    return mediaInfo && (mediaInfo.primaryUrl || mediaInfo.thumbnail);
                });
                // --- END MODIFIED ---

                // console.log(`Found ${postsToRender.length} posts with displayable media and no labels out of ${data.feed.length}.`); // Removed log

                if (postsToRender.length > 0) {
                    // Pass isInitialLoad flag to renderFeedItems
                    UI.renderFeedItems(postsToRender, App.handleImageClick, isInitialLoad);
                } else if (isInitialLoad) {
                    // If initial load has no valid items, hide loading indicator here
                    UI.hideLoading();
                    App.isInitialLayoutComplete = true; // Mark as complete even if empty
                }

                // --- Handle End/Empty Messages ---
                const isEndOfFeed = !newCursor;
                const totalItemsRendered = UI.feedContainer.children.length; // Check *after* potential render

                if (isInitialLoad && postsToRender.length === 0 && data.feed.length === 0) {
                    // Case: Feed was completely empty initially
                    UI.showFeedEndMessage(`No posts found in ${displayName}.`);
                } else if (isInitialLoad && postsToRender.length === 0 && data.feed.length > 0) {
                    // Case: Feed had posts, but none were suitable (media or labels)
                    UI.showFeedEndMessage(`No suitable posts (image/video without moderation labels) found yet in ${displayName}.`);
                } else if (isEndOfFeed && totalItemsRendered > 0) {
                    // Case: Reached end after rendering some items
                    UI.showFeedEndMessage(`You've reached the end of ${displayName}.`);
                } else if (isEndOfFeed && totalItemsRendered === 0) {
                    // Case: Reached end without rendering anything (e.g., only labeled posts existed)
                    // Already handled above by showing "No suitable posts..."
                    // If we *only* hit the end message check when totalItemsRendered is 0, it means
                    // the *first* fetch returned endOfFeed immediately with 0 suitable posts.
                    UI.showFeedEndMessage(`No suitable posts (image/video without moderation labels) found in ${displayName}.`);
                }


            } else {
                console.warn(`No feed data received or feed array is missing for ${displayName}.`);
                if (App.currentMode === 'search') App.searchCursor = null;
                else App.feedCursor = null;
                if (isInitialLoad) {
                    UI.showFeedEndMessage(`Could not load posts from ${displayName}. The source might be empty or unavailable.`);
                    UI.hideLoading(); // Hide loading if initial load failed this way
                    App.isInitialLayoutComplete = true; // Mark as complete even on failure
                } else {
                    // If loading more failed but we had content, assume end.
                    if (UI.feedContainer.children.length > 0) {
                        UI.showFeedEndMessage(`You've reached the end of ${displayName}.`);
                    }
                }
            }

        } catch (error) {
            console.error(`Failed to load ${displayName}:`, error);
            UI.showError(`Failed to load ${displayName}: ${error.message}`);
            App.lastFailedAction = () => App.loadCurrentFeedOrSearch(isInitialLoad);
            if (App.currentMode === 'search') App.searchCursor = null;
            else App.feedCursor = null;
        } finally {
            App.isLoadingFeed = false;
            // Hide loading indicator logic is moved for initial load
            // Only hide here if it's *not* the initial load or if an error occurred
            if (!isInitialLoad || document.querySelector('.error-indicator:not(.hidden)')) {
                if (!document.querySelector('.error-indicator:not(.hidden)')) {
                    // UI.hideLoading(); // Hiding non-initial loads here is okay
                }
            }
            // Ensure Masonry layout runs after potential DOM updates, especially non-initial loads
            if (App.masonryInstance && !isInitialLoad) {
                window.requestAnimationFrame(() => {
                    if (App.masonryInstance) App.masonryInstance.layout();
                });
            }
        }
    },

    clearSearchState: () => {
        App.currentSearchActor = null;
        App.currentSearchUri = null;
        App.currentSearchType = null;
        App.currentSearchName = null;
        App.searchCursor = null;
    },

    handleTabClick: (feedItem) => {
        // console.log(`Tab clicked: ${feedItem.name} (${feedItem.type}, ${feedItem.atUri})`); // Removed log
        if (App.isLoadingFeed) return;

        if (App.currentMode === 'feed' && App.currentFeedItem?.atUri === feedItem.atUri) {
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }

        App.currentMode = 'feed';
        App.currentFeedItem = feedItem;
        App.feedCursor = null;
        App.clearSearchState();

        App.resetErrorState();
        UI.setActiveTab(feedItem.atUri);
        window.scrollTo({ top: 0, behavior: 'instant' });
        App.loadCurrentFeedOrSearch(true);
    },

    handleSearchSubmit: async (inputValue) => {
        // console.log(`Search submitted for: ${inputValue}`); // Removed log
        if (App.isLoadingFeed) return;

        UI.showLoading();
        App.resetErrorState();
        App.clearSearchState();
        UI.clearSearchProfileHeader();
        UI.clearDirectSearchHeader();
        UI.setActiveTab(null);
        App.isInitialLayoutComplete = false; // Reset flag for new search

        App.currentMode = 'search';

        try {
            const parsedUrl = Utils.parseBskyUrl(inputValue);

            if (parsedUrl) {
                // console.log("Search input parsed as URL:", parsedUrl); // Removed log
                if (!parsedUrl.type || !parsedUrl.identifier || !parsedUrl.rkey) {
                    throw new Error("Invalid Bluesky Feed/List URL structure.");
                }

                let did = parsedUrl.identifier;
                if (!did.startsWith('did:')) {
                    const handle = did;
                    // console.log(`Resolving handle from URL: ${handle}`); // Removed log
                    const resolveData = await API.resolveHandle(handle);
                    if (!resolveData?.did) {
                        throw new Error(`Could not resolve handle '${handle}' found in URL.`);
                    }
                    did = resolveData.did;
                    // console.log(`Resolved ${handle} to ${did}`); // Removed log
                }

                let collection = '';
                let searchName = '';
                if (parsedUrl.type === 'feed') {
                    collection = 'app.bsky.feed.generator';
                    searchName = `Feed by ${parsedUrl.identifier}`;
                } else if (parsedUrl.type === 'list') {
                    collection = 'app.bsky.graph.list';
                    searchName = `List by ${parsedUrl.identifier}`;
                } else {
                    throw new Error(`Unsupported URL type: ${parsedUrl.type}`);
                }

                App.currentSearchUri = `at://${did}/${collection}/${parsedUrl.rkey}`;
                App.currentSearchType = parsedUrl.type;
                App.currentSearchName = searchName;

                // console.log(`Prepared for ${parsedUrl.type} search: URI=${App.currentSearchUri}`); // Removed log
                UI.renderDirectSearchHeader(searchName, inputValue);
                window.scrollTo({ top: 0, behavior: 'instant' });
                await App.loadCurrentFeedOrSearch(true);

            } else {
                // console.log("Search input treated as handle:", inputValue); // Removed log
                const username = inputValue.trim().replace(/^@/, '');

                const resolveData = await API.resolveHandle(username);
                if (!resolveData?.did) {
                    throw new Error(`Could not resolve handle @${username}. Check spelling or try the full handle (e.g., user.bsky.social).`);
                }
                const resolvedDid = resolveData.did;
                // console.log(`Resolved ${username} to ${resolvedDid}`); // Removed log

                const profileData = await API.getProfile(resolvedDid);
                if (!profileData) {
                    throw new Error(`Could not fetch profile for @${username} (DID: ${resolvedDid}).`);
                }
                // console.log("Fetched profile:", profileData); // Removed log

                App.currentSearchActor = {
                    did: resolvedDid,
                    handle: profileData.handle,
                    profile: profileData
                };
                App.currentSearchUri = null;

                UI.renderSearchProfileHeader(profileData);
                window.scrollTo({ top: 0, behavior: 'instant' });
                await App.loadCurrentFeedOrSearch(true);
            }

        } catch (error) {
            console.error("Search failed:", error);
            UI.showError(`Search failed: ${error.message}`);
            App.lastFailedAction = null;
            UI.hideLoading(); // Hide loading on search error
            App.isInitialLayoutComplete = true; // Mark as complete on failure
            App.currentMode = 'feed';
            App.clearSearchState();
            if (App.config && App.config.length > 0) {
                App.currentFeedItem = App.config[0];
                UI.setActiveTab(App.currentFeedItem.atUri);
            } else {
                App.currentFeedItem = null;
                UI.setActiveTab(null);
            }
        }
    },

    handleScroll: () => {
        if (App.isLoadingFeed || App.isLoadingDetails || !UI.detailView.classList.contains('hidden')) {
            return;
        }

        const currentCursor = App.currentMode === 'search' ? App.searchCursor : App.feedCursor;

        if (currentCursor !== null) {
            const scrollY = window.scrollY;
            const windowHeight = window.innerHeight;
            const docHeight = document.documentElement.scrollHeight;

            // Load slightly earlier to avoid seeing the bottom
            if (scrollY + windowHeight >= docHeight - (windowHeight * 1.8)) {
                // console.log("Near bottom, loading more..."); // Removed log
                App.loadCurrentFeedOrSearch(false);
            }
        }
    },


    handleImageClick: (postUri) => {
        // console.log(`Grid item clicked, loading details for: ${postUri}`); // Removed log
        if (App.isLoadingDetails) return;

        App.isLoadingDetails = true;
        UI.showLoading(); // Show loading for detail view
        App.resetErrorState();

        API.getPostThread(postUri, 10, 0)
            .then(threadData => {
                // --- ADDED: Check labels on the main post of the thread ---
                if (threadData?.thread?.post?.labels && threadData.thread.post.labels.length > 0) {
                    console.warn(`Not displaying detail view for ${postUri} because it has labels:`, threadData.thread.post.labels);
                    throw new Error("This post cannot be displayed due to content labels.");
                }
                // --- END ADDED ---

                if (threadData?.thread?.post) {
                    const threadType = threadData.thread.$type;
                    if (threadType === 'app.bsky.feed.defs#threadViewPost') {
                        UI.showDetailView(threadData.thread.post, threadData.thread); // Pass post and full thread
                    } else if (threadType === 'app.bsky.feed.defs#notFoundPost') {
                        throw new Error("Post not found (deleted or private).");
                    } else if (threadType === 'app.bsky.feed.defs#blockedPost') {
                        throw new Error("Cannot load post details (blocked).");
                    } else {
                        throw new Error(`Unknown thread view type: ${threadType}`);
                    }
                } else {
                    console.error("Invalid thread data received:", threadData);
                    throw new Error("Invalid or empty thread data received from API.");
                }
            })
            .catch(error => {
                console.error('Failed to load post details:', error);
                UI.showError(`Failed to load post details: ${error.message}`);
                // Don't set retry for label errors, it won't change
                if (!error.message.includes("content labels")) {
                    App.lastFailedAction = () => App.handleImageClick(postUri);
                } else {
                    App.lastFailedAction = null; // No retry for labeled posts
                }
            })
            .finally(() => {
                App.isLoadingDetails = false;
                // Hide loading only if no error is shown for the detail view load
                if (!document.querySelector('#error-indicator:not(.hidden)')) {
                    UI.hideLoading();
                }
            });
    },

    retryLastAction: () => {
        // console.log("Retry button clicked."); // Removed log
        if (typeof App.lastFailedAction === 'function') {
            App.lastFailedAction();
        } else {
            console.warn("No specific failed action to retry. Reloading current view.");
            App.resetErrorState();
            if (App.currentMode === 'search') {
                App.searchCursor = null; // Reset cursor for retry
                App.loadCurrentFeedOrSearch(true);
            } else if (App.currentMode === 'feed' && App.currentFeedItem) {
                App.feedCursor = null; // Reset cursor for retry
                App.loadCurrentFeedOrSearch(true);
            } else {
                console.warn("No current view context for retry, attempting full re-init.");
                App.init();
            }
        }
    },

    resetErrorState: () => {
        UI.hideError();
        App.lastFailedAction = null;
    }
};

document.addEventListener('DOMContentLoaded', App.init);