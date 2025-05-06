// --- START OF FILE main.js ---

let currentFolderIndex = 0;
let currentItemIndex = 0;
let currentConfig = [];
let currentCursor = null;
let isLoadingMore = false;
let currentProfileTab = 'posts';
let isMobilePostsVisible = false; // Track mobile view state explicitly
let allItemsLoaded = false; // Track if all items have been loaded initially

const appContainer = document.getElementById('app-container');
const postsListElement = document.getElementById('posts-list');
const loadingMoreIndicator = document.getElementById('loading-more-indicator');
const profileTabsContainerElement = document.getElementById('profile-tabs-container');
const mobileBackButtonElement = document.getElementById('mobile-back-button');

// Define a standard limit for API calls
const DEFAULT_FETCH_LIMIT = 100;


async function initializeApp() {
    await loadConfig();
    currentConfig = getConfig();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW registration failed:', err));
    }

    if (currentConfig.length === 0 && loadFinderItems().length === 0) {
        console.error("Initialization failed: No configuration or finder items loaded.");
    }

    // Load saved state or use defaults
    const savedState = loadSavedState();
    if (savedState) {
        currentFolderIndex = savedState.folderIndex;
        currentItemIndex = savedState.itemIndex;
        currentProfileTab = savedState.profileTab || 'posts';
        console.log("Restored state:", savedState);
    }

    renderFolders(currentConfig, currentFolderIndex, handleFolderClick);
    postsListElement.addEventListener('scroll', handleScroll);
    addFinderItemButton.addEventListener('click', openAddItemModal);
    addItemForm.addEventListener('submit', handleAddItemSubmit);
    mobileBackButtonElement.addEventListener('click', handleMobileBackClick);

    // Add popstate listener for back gesture/button
    window.addEventListener('popstate', handlePopState);

    // Preload all folder items in the background
    preloadAllFolderItems().then(() => {
        allItemsLoaded = true;
        console.log("All folder items loaded and cached");
    });

    if (currentFolderIndex === FINDER_FOLDER_INDEX) {
        await loadFinderItemsView();
    } else if (currentConfig.length > 0) {
        await loadItemsForFolder(currentFolderIndex);
    } else {
        handleFolderClick(FINDER_FOLDER_INDEX);
    }
}

async function preloadAllFolderItems() {
    // Preload all folder items in the background
    const preloadPromises = [];

    // Load regular folders
    currentConfig.forEach((folder, folderIndex) => {
        if (folder.items && folder.items.length) {
            folder.items.forEach(async (item) => {
                try {
                    const parsed = parseBlueskyUrl(item.url);
                    if (parsed) {
                        if (item.type === 'profile') {
                            preloadPromises.push(getProfileDetails(parsed.identifier));
                        } else {
                            const atUri = await ensureAtUri(parsed);
                            if (atUri) {
                                if (item.type === 'list') {
                                    preloadPromises.push(getListDetails(atUri));
                                } else if (item.type === 'feed') {
                                    preloadPromises.push(getFeedGeneratorDetails(atUri));
                                }
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error preloading item ${item.url}:`, error);
                }
            });
        }
    });

    // Preload finder items
    const finderItems = loadFinderItems();
    finderItems.forEach(async (item) => {
        try {
            const parsed = parseBlueskyUrl(item.url || item.identifier);
            if (parsed) {
                if (item.type === 'profile') {
                    preloadPromises.push(getProfileDetails(parsed.identifier));
                } else {
                    const atUri = await ensureAtUri(parsed);
                    if (atUri) {
                        if (item.type === 'list') {
                            preloadPromises.push(getListDetails(atUri));
                        } else if (item.type === 'feed') {
                            preloadPromises.push(getFeedGeneratorDetails(atUri));
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Error preloading finder item:`, error);
        }
    });

    // Wait for all preloading to complete
    return Promise.allSettled(preloadPromises);
}

function handleFolderClick(folderIndex) {
    if (folderIndex === currentFolderIndex || isLoadingMore) return;
    hideMobilePostsView(); // Ensure posts hidden when changing folder
    currentFolderIndex = folderIndex;
    currentItemIndex = 0;
    currentCursor = null;
    isLoadingMore = false;
    currentProfileTab = 'posts';

    // Save state
    saveCurrentState(currentFolderIndex, currentItemIndex, currentProfileTab);

    loadingMoreIndicator.style.display = 'none'; postsListElement.scrollTop = 0;
    renderFolders(currentConfig, currentFolderIndex, handleFolderClick);
    hideProfileTabs(); clearPosts(); postsHeaderContent.innerHTML = ''; mobileBackButton.onclick = null;
    if (folderIndex === FINDER_FOLDER_INDEX) { loadFinderItemsView(); }
    else { loadItemsForFolder(currentFolderIndex); }
}

function handleItemClick(itemIndex, isFinderItem = false) {
    const previousFolderIndex = currentFolderIndex;
    const previousItemIndex = currentItemIndex;
    currentItemIndex = itemIndex;
    currentFolderIndex = isFinderItem ? FINDER_FOLDER_INDEX : previousFolderIndex;
    const sameItemClicked = (itemIndex === previousItemIndex) && (isFinderItem === (previousFolderIndex === FINDER_FOLDER_INDEX));

    // Save state
    saveCurrentState(currentFolderIndex, currentItemIndex, currentProfileTab);

    if (!sameItemClicked) {
        currentCursor = null;
        isLoadingMore = false;
        currentProfileTab = 'posts';
        loadingMoreIndicator.style.display = 'none'; // Hide indicator when item changes
        postsListElement.scrollTop = 0;
    }

    const itemElements = itemListScrollContainer.querySelectorAll('.item-entry');
    itemElements.forEach((el, idx) => el.classList.toggle('active', idx === currentItemIndex));

    let itemConfig;
    if (isFinderItem) {
        const finderItems = loadFinderItems();
        itemConfig = finderItems[itemIndex];
        if (itemConfig && !itemConfig.url) itemConfig.url = itemConfig.identifier;
    } else {
        itemConfig = currentConfig[currentFolderIndex]?.items[currentItemIndex];
    }

    if (!itemConfig) {
        console.error("Could not find item config for index:", itemIndex, "isFinder:", isFinderItem);
        clearPosts();
        postsHeaderContent.innerHTML = 'Error: Item not found.';
        hideProfileTabs();
        return;
    }

    showMobilePostsView(); // Show the posts view and handle history

    // Check if it's a profile BEFORE loading posts, not after
    if (itemConfig.type === 'profile') {
        renderProfileTabs(currentProfileTab, handleTabClick);
    } else {
        hideProfileTabs();
    }

    loadPostsForItem(itemConfig, true); // Use true for fresh load
}

function handleTabClick(event) {
    const newTab = event.target.dataset.tab;
    if (!newTab || newTab === currentProfileTab || isLoadingMore) { return; }
    currentProfileTab = newTab; currentCursor = null; isLoadingMore = false;

    // Save state with new tab
    saveCurrentState(currentFolderIndex, currentItemIndex, currentProfileTab);

    loadingMoreIndicator.style.display = 'none'; // Hide indicator when tab changes
    postsListElement.scrollTop = 0;
    renderProfileTabs(currentProfileTab, handleTabClick);

    // Re-render posts from the existing data store for the new tab filter
    renderFilteredPosts(currentProfileTab, false); // false for fresh render of this filter

    // No need to auto-fetch here, scrolling will handle if more are needed
    // and `renderFilteredPosts` shows "no posts" message if applicable.
}


function loadFinderItemsView() {
    renderItems(null, currentItemIndex, handleItemClick, true);
    const finderItems = loadFinderItems();
    if (finderItems.length > 0) {
        // Ensure currentItemIndex is valid
        if (currentItemIndex < 0 || currentItemIndex >= finderItems.length) {
            currentItemIndex = 0;
            saveCurrentState(currentFolderIndex, currentItemIndex, currentProfileTab); // Save corrected index
        }
        let itemConfig = finderItems[currentItemIndex];
        if (itemConfig && !itemConfig.url) itemConfig.url = itemConfig.identifier;
        if (itemConfig) {
            loadPostsForItem(itemConfig, true); // true for fresh load
            const itemElements = itemListScrollContainer.querySelectorAll('.item-entry');
            itemElements.forEach((el, idx) => el.classList.toggle('active', idx === currentItemIndex));
        } else {
            clearPosts(); postsHeaderContent.innerHTML = 'Select an item'; hideProfileTabs();
        }
    } else {
        clearPosts(); postsHeaderContent.innerHTML = 'Use the button above to add Profiles/Feeds/Lists'; hideProfileTabs();
        itemListScrollContainer.innerHTML = '<div class="loading-indicator">No items added yet. Use the button above to add some.</div>';
    }
}


async function loadItemsForFolder(folderIndex) {
    showLoading('items'); clearPosts(); hideProfileTabs();
    const folder = currentConfig[folderIndex];
    if (!folder || !folder.items) {
        itemListScrollContainer.innerHTML = '<div class="loading-indicator">Error loading items.</div>';
        return;
    }

    await renderItems(folder.items, currentItemIndex, handleItemClick, false);

    if (folder.items.length > 0) {
        // Ensure currentItemIndex is valid
        if (currentItemIndex < 0 || currentItemIndex >= folder.items.length) {
            currentItemIndex = 0;
            saveCurrentState(currentFolderIndex, currentItemIndex, currentProfileTab); // Save corrected index
        }
        const itemConfig = folder.items[currentItemIndex]; // Use corrected index
        if (itemConfig) {
            if (itemConfig.type === 'profile') {
                renderProfileTabs(currentProfileTab, handleTabClick);
            }
            await loadPostsForItem(itemConfig, true); // true for fresh load
        } else {
            console.error("Could not find item config even after index correction.");
            clearPosts(); postsHeaderContent.innerHTML = "Error: Could not load item.";
        }
    }
    else { clearPosts(); postsHeaderContent.innerHTML = "No items in this folder."; }
}

// --- MODIFIED FUNCTION BELOW ---
async function loadPostsForItem(itemConfig, isFreshLoad = false) {
    const isProfile = itemConfig?.type === 'profile';
    const activeFilterTab = isProfile ? currentProfileTab : 'posts';

    if (isFreshLoad) {
        currentCursor = null;
        isLoadingMore = false;
        postsListElement.scrollTop = 0;
        feedItemDataStore = {}; // Clear data store for the new item/tab
        showLoading('header');
        showLoading('posts');
        loadingMoreIndicator.style.display = 'none'; // Ensure hidden on fresh load start

        // Ensure we re-render tabs if needed
        if (isProfile) {
            renderProfileTabs(currentProfileTab, handleTabClick);
        } else {
            hideProfileTabs();
        }
    }

    // Prevent stacking requests
    if (isLoadingMore) {
        console.log("Already loading more posts, returning.");
        return;
    }

    if (!itemConfig || !itemConfig.url) {
        if (isFreshLoad) {
            postsHeaderContent.innerHTML = 'Error: Invalid item configuration.';
            postsList.innerHTML = '';
            hideProfileTabs();
        }
        console.error("Invalid itemConfig in loadPostsForItem", itemConfig);
        loadingMoreIndicator.style.display = 'none'; // Ensure hidden if error before loading starts
        return;
    }

    isLoadingMore = true; // Set loading flag

    // Indicator visibility is handled by handleScroll *before* this call if !isFreshLoad
    // Here, just ensure header is loaded on fresh load
    if (isFreshLoad) {
        await renderPostsHeader(itemConfig, handleMobileBackClick);
    }
    // If !isFreshLoad, handleScroll should have already shown the indicator.

    const parsed = parseBlueskyUrl(itemConfig.url);
    if (!parsed) {
        if (isFreshLoad) postsList.innerHTML = '<div class="loading-indicator">Error parsing URL.</div>';
        isLoadingMore = false;
        loadingMoreIndicator.style.display = 'none'; // Hide indicator on parse error
        return;
    }

    try {
        let newFeedData;
        const cursor = currentCursor;
        const limit = DEFAULT_FETCH_LIMIT;

        // --- Fetch the first/next batch (standard logic) ---
        if (itemConfig.type === 'profile') {
            const did = await resolveIdentifierToDid(parsed.identifier);
            if (!did) throw new Error(`Could not resolve DID for ${parsed.identifier}`);
            newFeedData = await getAuthorFeed(did, limit, cursor);
        } else {
            const atUri = await ensureAtUri(parsed);
            if (!atUri) throw new Error(`Could not get AT URI for ${itemConfig.url}`);

            if (itemConfig.type === 'list')
                newFeedData = await getListFeed(atUri, limit, cursor);
            else if (itemConfig.type === 'feed')
                newFeedData = await getFeed(atUri, limit, cursor);
            else
                throw new Error(`Unsupported item type: ${itemConfig.type}`);
        }

        // Process the data from the API call
        let countAdded = 0;
        if (newFeedData && newFeedData.feed) {
            newFeedData.feed.forEach(item => {
                if (!feedItemDataStore[item.post.uri]) {
                    feedItemDataStore[item.post.uri] = item;
                    countAdded++;
                }
            });
        }

        // Update cursor and render posts
        currentCursor = newFeedData?.cursor;
        renderFilteredPosts(activeFilterTab, !isFreshLoad); // Pass true if appending

    } catch (error) {
        console.error(`Failed to load posts for ${itemConfig.url}:`, error);
        // Show error in indicator temporarily only if loading more fails
        if (!isFreshLoad) {
            loadingMoreIndicator.innerHTML = `<div class="loading-indicator">Error loading more posts.</div>`;
            loadingMoreIndicator.style.display = 'block';
            // Hide error after a delay, then hide indicator completely below
            setTimeout(() => {
                if (loadingMoreIndicator.textContent.includes("Error")) {
                    loadingMoreIndicator.style.display = 'none';
                }
            }, 3000);
        } else {
            // Show error in main list area for fresh load errors
            postsList.innerHTML = `<div class="loading-indicator">Error loading posts: ${escapeHtml(error.message)}</div>`;
        }
        currentCursor = null; // Stop further loading attempts on error
    } finally {
        isLoadingMore = false; // Reset loading flag
        // --- ALWAYS HIDE INDICATOR WHEN LOADING FINISHES ---
        // Unless an error message is temporarily shown above for non-fresh loads
        if (!loadingMoreIndicator.textContent.includes("Error")) {
            loadingMoreIndicator.style.display = 'none';
        }
    }
}
// --- END OF MODIFIED FUNCTION ---

// --- MODIFIED FUNCTION BELOW ---
function handleScroll() {
    // Don't trigger if a modal is open
    if (document.body.classList.contains('modal-open')) {
        return;
    }

    const { scrollTop, scrollHeight, clientHeight } = postsListElement;
    // Trigger when user is within 1.5x the viewport height from the bottom
    const scrollThreshold = clientHeight * 1.5;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < scrollThreshold;

    // Check if loading is possible and needed
    if (currentCursor && !isLoadingMore && isNearBottom) {
        console.log(`Reached bottom scroll threshold, attempting to load more... Cursor: ${currentCursor}`);

        // --- SHOW INDICATOR BEFORE LOADING ---
        loadingMoreIndicator.innerHTML = showLoadingIndicator('Loading more posts...');
        loadingMoreIndicator.style.display = 'block';

        // Get current item config safely
        let itemConfig = null;
        try {
            if (currentFolderIndex === FINDER_FOLDER_INDEX) {
                const finderItems = loadFinderItems();
                if (currentItemIndex >= 0 && currentItemIndex < finderItems.length) {
                    itemConfig = finderItems[currentItemIndex];
                    if (itemConfig && !itemConfig.url) itemConfig.url = itemConfig.identifier;
                }
            } else {
                if (currentFolderIndex >= 0 && currentFolderIndex < currentConfig.length &&
                    currentItemIndex >= 0 && currentItemIndex < currentConfig[currentFolderIndex].items.length) {
                    itemConfig = currentConfig[currentFolderIndex]?.items[currentItemIndex];
                }
            }
        } catch (error) {
            console.error("Error retrieving item config during scroll:", error);
        }


        if (itemConfig) {
            // Initiate the load, pass false to indicate it's appending
            loadPostsForItem(itemConfig, false);
        } else {
            console.error("Cannot load more, current item config not found or index out of bounds.");
            // Hide indicator immediately if we can't initiate the load
            loadingMoreIndicator.style.display = 'none';
        }
    }
}
// --- END OF MODIFIED FUNCTION ---


async function handleAddItemSubmit(event) {
    event.preventDefault();
    addItemError.style.display = 'none';
    addItemSuccess.style.display = 'none';

    // Disable submit button during validation
    const submitButton = event.target.querySelector('.submit-button');
    submitButton.disabled = true;
    submitButton.textContent = 'Processing...';

    const selectedType = addItemForm.elements.itemType.value;
    const urlOrHandle = addItemUrlInput.value.trim();

    if (!urlOrHandle) {
        addItemError.textContent = "URL or Handle/DID cannot be empty.";
        addItemError.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = 'Add Item';
        return;
    }

    let identifier = urlOrHandle;
    let resourceId = null;
    let detectedInputType = selectedType; // Assume selected is correct initially

    // Try parsing as URL first
    if (urlOrHandle.startsWith('https://bsky.app/profile/')) {
        const parts = urlOrHandle.split('/');
        if (parts.length >= 5) {
            identifier = parts[4]; // This is the profile handle or DID
            if (parts.length > 5) {
                const urlTypeSegment = parts[5]; // feed, lists, post etc.
                if (parts.length > 6) resourceId = parts[6]; // The actual ID of the feed/list/post

                if (urlTypeSegment === 'feed' && resourceId) {
                    detectedInputType = 'feed';
                } else if (urlTypeSegment === 'lists' && resourceId) {
                    detectedInputType = 'list';
                } else {
                    // Could be a post URL or something else, treat as profile for identifier extraction
                    detectedInputType = 'profile';
                }
            } else {
                // Just bsky.app/profile/handle -> profile
                detectedInputType = 'profile';
            }
        } else {
            addItemError.textContent = "Invalid Bluesky URL format.";
            addItemError.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = 'Add Item';
            return;
        }

        // Validate selected type against detected type from URL
        const isValidTypeMatch = (detectedInputType === selectedType);

        if (!isValidTypeMatch) {
            addItemError.textContent = `URL indicates type '${detectedInputType}', but you selected '${selectedType}'. Please correct the selection or URL.`;
            addItemError.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = 'Add Item';
            return;
        }

    } else if (urlOrHandle.startsWith('did:')) {
        identifier = urlOrHandle;
        if (selectedType !== 'profile') {
            addItemError.textContent = `Please provide the full bsky.app URL for Feeds or Lists, not just the DID.`;
            addItemError.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = 'Add Item';
            return;
        }
        detectedInputType = 'profile';
    } else if (urlOrHandle.includes('.')) {
        identifier = urlOrHandle;
        if (selectedType !== 'profile') {
            addItemError.textContent = `Please provide the full bsky.app URL for Feeds or Lists, not just the handle.`;
            addItemError.style.display = 'block';
            submitButton.disabled = false;
            submitButton.textContent = 'Add Item';
            return;
        }
        detectedInputType = 'profile';
    } else if (urlOrHandle.startsWith('at://')) {
        addItemError.textContent = "Please use bsky.app URL, not handle/DID or at:// URI.";
        addItemError.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = 'Add Item';
        return;
    } else {
        addItemError.textContent = "Invalid input. Please enter a Bluesky profile URL";
        addItemError.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = 'Add Item';
        return;
    }

    if (detectedInputType !== selectedType) {
        addItemError.textContent = `Input looks like a '${detectedInputType}', but you selected '${selectedType}'. Please correct the selection or input.`;
        addItemError.style.display = 'block';
        submitButton.disabled = false;
        submitButton.textContent = 'Add Item';
        return;
    }


    // Construct newItem ensuring identifier is set correctly
    let newItem = { type: selectedType, url: urlOrHandle, identifier: identifier };
    if (resourceId) {
        newItem.resourceId = resourceId;
    }


    try {
        // Validate the item by attempting to fetch its details
        if (selectedType === 'profile') {
            await getProfileDetails(identifier); // Checks if profile exists
        }
        else { // Feed or List
            if (!resourceId) {
                throw new Error(`Missing resource ID in the URL for ${selectedType}. Please provide the full URL.`);
            }
            const parsedForUri = { type: selectedType, identifier: identifier, resourceId: resourceId };
            const atUri = await ensureAtUri(parsedForUri);
            if (!atUri) throw new Error(`Could not resolve AT URI for the specified ${selectedType}.`);

            if (selectedType === 'list') {
                await getListDetails(atUri);
            } else if (selectedType === 'feed') {
                await getFeedGeneratorDetails(atUri);
            }
            // Store the resolved DID and resourceId for consistent future use
            newItem.identifier = await resolveIdentifierToDid(identifier);
            newItem.resourceId = resourceId;
            // Keep original URL for display/reference if needed
            newItem.url = urlOrHandle;
        }

        // If validation passed, add the item
        addFinderItem(newItem);
        addItemSuccess.textContent = `Successfully added ${selectedType}!`;
        addItemSuccess.style.display = 'block';
        addItemForm.reset();
        renderFinderItemsInModal(); // Update the list in the modal

        // If currently viewing the Finder, refresh the view and load the new item
        if (currentFolderIndex === FINDER_FOLDER_INDEX) {
            const finderItems = loadFinderItems();
            const newItemIndex = finderItems.length - 1;
            currentItemIndex = newItemIndex; // Update global index
            saveCurrentState(currentFolderIndex, currentItemIndex, currentProfileTab); // Save state

            await renderItems(null, currentItemIndex, handleItemClick, true);

            const itemConfig = finderItems[currentItemIndex];
            if (itemConfig) {
                if (!itemConfig.url) itemConfig.url = itemConfig.identifier;
                loadPostsForItem(itemConfig, true); // Fresh load for the new item
            }
        }

        setTimeout(() => {
            addItemSuccess.style.display = 'none';
        }, 3000);

    } catch (error) {
        console.error("Error adding item:", error);
        if (error.message.includes("already in your Finder list")) {
            addItemError.textContent = error.message; // Show duplicate error directly
        } else if (error.message.includes("Could not resolve handle")) {
            addItemError.textContent = `Failed to add: Could not find profile with handle '${identifier}'.`;
        } else if (error.message.includes("Could not resolve AT URI")) {
            addItemError.textContent = `Failed to add: Could not find the specified ${selectedType}. Check the URL.`;
        } else if (error.message.includes("HTTP error") || error.message.includes("Network error")) {
            addItemError.textContent = `Failed to add: Network error or API issue. Please try again later.`;
        } else {
            addItemError.textContent = `Failed to add: ${error.message}`;
        }
        addItemError.style.display = 'block';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Add Item';
    }
}


// --- Mobile Navigation ---
function showMobilePostsView() {
    if (window.innerWidth <= 768 && !isMobilePostsVisible) {
        appContainer.classList.add('mobile-show-posts');
        // Push a state to history only if we are not already in the posts view
        if (!history.state || history.state.mobileView !== 'posts') {
            history.pushState({ mobileView: 'posts' }, '', ''); // State, title (unused), URL (optional)
            console.log("Pushed history state for posts view");
        }
        isMobilePostsVisible = true;
    }
}

function hideMobilePostsView(isPopState = false) {
    if (window.innerWidth <= 768 && isMobilePostsVisible) {
        appContainer.classList.remove('mobile-show-posts');
        isMobilePostsVisible = false;
        console.log("Hid mobile posts view");
        // If this wasn't triggered by popstate, go back in history
        // This handles the case where the physical back button *inside the app* is clicked
        if (!isPopState && history.state?.mobileView === 'posts') {
            console.log("Going back in history due to button click");
            history.back();
        }
    }
}

function handleMobileBackClick() {
    hideMobilePostsView(false); // Trigger hide, and let it handle history.back()
}

function handlePopState(event) {
    console.log("Popstate event fired:", event.state);
    // If the state we are going back to is NOT the posts view (or null state),
    // and the posts view is currently visible, hide it.
    if (isMobilePostsVisible && event.state?.mobileView !== 'posts') {
        console.log("Hiding posts view due to popstate");
        hideMobilePostsView(true); // Pass true to indicate it's from popstate
    }
    // If the state IS the posts view, but it's somehow not visible, show it
    // (This handles cases like forward navigation back to the posts state)
    else if (!isMobilePostsVisible && event.state?.mobileView === 'posts') {
        console.log("Showing posts view due to popstate forward navigation");
        showMobilePostsView(); // Re-show without pushing state again
    }
}


function renderFilteredPosts(filterTab = 'posts', append = false) {
    const postsListContainer = document.getElementById('posts-list'); // Ensure we target the right element
    if (!append) {
        postsListContainer.innerHTML = ''; // Clear previous posts
        postsListContainer.scrollTop = 0; // Reset scroll on fresh render
    }

    let filteredData = [];
    let isProfileView = false;
    let currentItemConfig = null;

    // Determine if we are viewing a profile (works for both config and finder)
    if (currentFolderIndex === FINDER_FOLDER_INDEX) {
        const finderItems = loadFinderItems();
        if (currentItemIndex >= 0 && currentItemIndex < finderItems.length) {
            currentItemConfig = finderItems[currentItemIndex];
            isProfileView = currentItemConfig?.type === 'profile';
        }
    } else {
        if (currentFolderIndex >= 0 && currentFolderIndex < currentConfig.length &&
            currentItemIndex >= 0 && currentItemIndex < currentConfig[currentFolderIndex].items.length) {
            currentItemConfig = currentConfig[currentFolderIndex].items[currentItemIndex];
            isProfileView = currentItemConfig?.type === 'profile';
        }
    }

    const allData = Object.values(feedItemDataStore); // Use the central store

    // Apply filters based on the tab
    if (isProfileView) {
        switch (filterTab) {
            case 'replies':
                filteredData = allData.filter(item => !!item.post.record?.reply);
                break;
            case 'media':
                filteredData = allData.filter(item => isMediaPost(item.post));
                break;
            case 'links':
                filteredData = allData.filter(item => isLinkPost(item.post));
                break;
            case 'videos':
                filteredData = allData.filter(item => isVideoPost(item.post));
                break;
            case 'posts': // Intentional fallthrough to default
            default:
                // Standard posts (not replies)
                filteredData = allData.filter(item => !item.post.record?.reply);
                break;
        }
    } else {
        // For Feeds and Lists, show all posts without filtering by type (replies/media etc.)
        filteredData = allData;
    }

    // Sort data by indexedAt descending (most recent first) before rendering
    // It's better to sort the entire potential dataset if possible, or at least
    // the currently held data before filtering/rendering.
    // Sorting here ensures chronological order regardless of fetch order.
    // We sort *after* getting allData but *before* filtering might be slightly
    // more efficient if filters are heavy, but sorting the filtered set is safer.
    filteredData.sort((a, b) => new Date(b.post.indexedAt) - new Date(a.post.indexedAt));


    // Determine grid view based on tab *only* if it's a profile view
    const isMediaGrid = isProfileView && filterTab === 'media';
    const isVideoGrid = isProfileView && filterTab === 'videos';

    // Apply grid view classes conditionally
    postsListContainer.classList.toggle('media-grid-view', isMediaGrid);
    postsListContainer.classList.toggle('video-grid-view', isVideoGrid);

    // Ensure non-grid view if not applicable
    if (!isMediaGrid && !isVideoGrid) {
        postsListContainer.classList.remove('media-grid-view', 'video-grid-view');
    }


    if (filteredData.length === 0 && !append) {
        // Only show "no posts" message if it's a fresh render (not appending)
        postsListContainer.innerHTML = `<div class="loading-indicator">No posts found for this filter.</div>`;
        // Hide loading indicator if no posts and no cursor
        if (!currentCursor) {
            loadingMoreIndicator.style.display = 'none';
        }
        return;
    } else if (filteredData.length === 0 && append) {
        // If appending and no new items match the filter, do nothing visually
        console.log("Append triggered, but no new items match the filter.");
        return;
    }

    // Render the posts
    const fragment = document.createDocumentFragment();
    let postCountRendered = 0;
    filteredData.forEach(feedItem => {
        const postUri = feedItem.post.uri;
        const existingElement = append ? postsListContainer.querySelector(`.post-item[data-uri="${postUri}"]`) : null;

        if (!existingElement) {
            const isGridView = isMediaGrid || isVideoGrid;
            const isReplyPost = !!feedItem.post.record?.reply;
            const postElement = renderSinglePost(feedItem, {
                isModal: false,
                isReplyContext: isReplyPost,
                isGridView: isGridView
            });

            if (postElement) {
                fragment.appendChild(postElement);
                postCountRendered++;
            }
        } else {
            // console.log(`Skipping duplicate post in render: ${postUri}`);
        }
    });

    if (postCountRendered > 0) {
        postsListContainer.appendChild(fragment);
    }
    console.log(`Rendered ${postCountRendered} posts for tab ${filterTab}. Appended: ${append}. Total in filter: ${filteredData.length}`);

}


document.addEventListener('DOMContentLoaded', initializeApp);
// --- END OF FILE main.js ---