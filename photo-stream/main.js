import {
    resolveHandle,
    parseBlueskyUrl,
    fetchPostsFromList,
    fetchPostsFromFeed
} from './api.js';

import {
    showLoading,
    displayError,
    clearPostsContainer,
    renderPosts,
    updateLoadMoreButton,
    extractPostDataFromApi,
    createPostElement,
    applyInitialTheme,
    toggleTheme,
    showConfigModal,
    hideConfigModal,
    updateActiveFeedButton
} from './ui.js';

// --- Constants ---
const INITIAL_FETCH_LIMIT = 100; // Number of posts to load initially
const LOAD_MORE_LIMIT = 100;    // Number of posts to load per "Load More" click
const CUSTOM_URL_STORAGE_KEY = 'photostream_custom_url'; // Local storage key

// --- State ---
// Store the feed info used for the current display
let currentFeedInfo = {
    type: null,         // 'list' or 'feed'
    authorDid: null,    // DID of the author/creator
    id: null,           // rkey of the list/feed
    sourceUrl: null     // The original URL used (predefined or custom)
};
let currentCursor = null;   // API cursor for pagination
let isLoadingFeed = false;  // Prevent concurrent initial fetches
let isLoadingMore = false; // Prevent concurrent 'load more' fetches

// --- Core Logic ---

/**
 * Fetches and displays the initial set of posts for a given feed/list URL.
 * Resets previous state and posts. Scrolls window to top.
 * @param {string} url - The Bluesky feed or list URL.
 * @param {boolean} [isCustomFromStorage=false] - Indicates if the URL came from localStorage.
 */
async function handleFetchRequest(url, isCustomFromStorage = false) {
    // --- ADDED: Scroll to top when a new feed request starts ---
    window.scrollTo(0, 0);
    // --- END ADDED ---

    if (isLoadingFeed) {
        console.warn("Feed fetch already in progress. Ignoring request for:", url);
        return;
    }
    isLoadingFeed = true;

    // Reset UI and state for a new feed load
    currentCursor = null;
    isLoadingMore = false;
    clearPostsContainer();
    displayError(''); // Clear previous errors
    updateLoadMoreButton(false, false); // Hide load more initially
    showLoading(true); // Show loading *after* scrolling to top

    // Determine if the URL is one of the predefined ones
    const isPredefined = !isCustomFromStorage && isPredefinedUrl(url);
    updateActiveFeedButton(isPredefined ? url : null); // Update active button state

    try {
        if (!url || typeof url !== 'string' || !url.trim()) {
            throw new Error("Please provide a valid Bluesky feed or list URL.");
        }
        const trimmedUrl = url.trim();

        // Parse the URL to get type, author (handle OR DID), authorType, and id
        const parsedUrl = parseBlueskyUrl(trimmedUrl);
        if (!parsedUrl) {
            throw new Error("Invalid Bluesky URL format. Use .../profile/[handle_or_did]/feed/id or .../profile/[handle_or_did]/list/id.");
        }

        let authorDid; // This will store the final DID

        // Check if the parsed author is a DID or a handle
        if (parsedUrl.authorType === 'did') {
            // The URL contained the DID directly
            authorDid = parsedUrl.author;
            console.log("Using DID directly from URL:", authorDid);
        } else if (parsedUrl.authorType === 'handle') {
            // The URL contained a handle, need to resolve it
            console.log("Resolving handle:", parsedUrl.author);
            authorDid = await resolveHandle(parsedUrl.author);
            if (!authorDid) {
                // If resolveHandle returns null, it means an error occurred (logged in api.js)
                throw new Error(`Could not resolve handle or find user: ${parsedUrl.author}`);
            }
            console.log("Resolved handle to DID:", authorDid);
        } else {
            // This case should not be reachable if parseBlueskyUrl is correct
            throw new Error("Internal error: Could not determine author type from URL.");
        }

        // Store current feed info *before* fetching posts, using the determined authorDid
        currentFeedInfo = {
            type: parsedUrl.type,
            authorDid: authorDid, // Use the DID obtained either directly or via resolution
            id: parsedUrl.id,
            sourceUrl: trimmedUrl // Store the URL used for this fetch
        };

        // Fetch the first batch of posts
        console.log(`Fetching initial batch (${INITIAL_FETCH_LIMIT}) for ${currentFeedInfo.type} ${currentFeedInfo.id}`);
        const result = await fetchPostsBatch(INITIAL_FETCH_LIMIT, null); // Initial fetch uses null cursor

        // Render the fetched posts
        const postElements = result.posts.map(extractPostDataFromApi).map(createPostElement);
        renderPosts(postElements); // Render the elements

        // Store the cursor returned for the *next* potential fetch (Load More)
        currentCursor = result.cursor;

        // Update the 'Load More' button visibility based on whether a cursor was returned
        updateLoadMoreButton(false, !!currentCursor);

    } catch (error) {
        console.error("Error during initial fetch request:", error);
        // Display the error message to the user
        displayError(error.message || "An unknown error occurred while fetching posts.");
        // Ensure UI reflects error state
        updateLoadMoreButton(false, false); // Hide load more on error
        updateActiveFeedButton(null); // Clear active button on error
        // Reset feed info if fetch failed completely
        currentFeedInfo = { type: null, authorDid: null, id: null, sourceUrl: null };
    } finally {
        // Ensure loading indicators are hidden and state is reset regardless of success/failure
        showLoading(false);
        isLoadingFeed = false;
    }
}

/**
 * Fetches the next batch of posts using the stored cursor and feed info.
 */
async function loadMorePosts() {
    // Prevent loading more if no valid feed is selected, no cursor exists, or already loading
    if (!currentFeedInfo.type || !currentCursor || isLoadingMore || isLoadingFeed) {
        console.log("Cannot load more:", {
            hasFeed: !!currentFeedInfo.type,
            hasCursor: !!currentCursor,
            isLoadingMore,
            isLoadingFeed
        });
        return;
    }

    isLoadingMore = true;
    updateLoadMoreButton(true, true); // Show loading state on the button
    displayError(''); // Clear previous errors before loading more

    try {
        console.log(`Fetching next batch (${LOAD_MORE_LIMIT}) for ${currentFeedInfo.type} ${currentFeedInfo.id} using cursor`);
        // Fetch the next batch using the stored cursor
        const result = await fetchPostsBatch(LOAD_MORE_LIMIT, currentCursor);

        // Render *additional* posts by appending them
        const postElements = result.posts.map(extractPostDataFromApi).map(createPostElement);
        renderPosts(postElements); // Append new posts to the container

        // Update the cursor for the *next* 'Load More' click
        currentCursor = result.cursor;

        // Update the button state based on whether a new cursor was returned
        updateLoadMoreButton(false, !!currentCursor);

    } catch (error) {
        console.error("Error loading more posts:", error);
        // Display error and potentially allow retry
        displayError(`Error loading more: ${error.message || "Unknown error"}`);
        // Decide whether to keep the button enabled for retry or disable on error
        updateLoadMoreButton(false, !!currentCursor); // Keep button enabled if cursor still exists? Or disable? Let's allow retry if cursor exists.
    } finally {
        isLoadingMore = false; // Reset loading state
    }
}

/**
 * Helper function to call the correct API fetch method based on stored feed info.
 * @param {number} limit - Number of posts to fetch.
 * @param {string|null} cursor - API cursor.
 * @returns {Promise<{posts: Array<object>, cursor: string|null}>}
 * @throws {Error} If feed info is missing or API call fails.
 */
async function fetchPostsBatch(limit, cursor) {
    // Ensure we have valid feed information before attempting to fetch
    if (!currentFeedInfo || !currentFeedInfo.type || !currentFeedInfo.authorDid || !currentFeedInfo.id) {
        throw new Error("Cannot fetch posts: Feed information is incomplete or missing.");
    }
    const { type, authorDid, id } = currentFeedInfo;

    // Call the appropriate API function based on the feed type
    if (type === 'list') {
        return await fetchPostsFromList(authorDid, id, limit, cursor);
    } else if (type === 'feed') {
        return await fetchPostsFromFeed(authorDid, id, limit, cursor);
    } else {
        // This should not happen if parsing and state setting work correctly
        throw new Error(`Invalid feed type encountered: ${type}`);
    }
}


/**
 * Checks if a given URL matches the 'data-url' of any predefined feed button in the header.
 * @param {string} url - The URL to check.
 * @returns {boolean} True if the URL matches a predefined button, false otherwise.
 */
function isPredefinedUrl(url) {
    if (!url) return false;
    const trimmedUrl = url.trim();
    const predefinedFeedButtons = document.querySelectorAll('#main-header .predefined-feeds button');
    // Use Array.some for efficient checking
    return Array.from(predefinedFeedButtons).some(button => button.getAttribute('data-url')?.trim() === trimmedUrl);
}


// --- Event Listeners Setup ---

document.addEventListener('DOMContentLoaded', () => {
    // Get references to interactive elements
    const predefinedFeedButtons = document.querySelectorAll('#main-header .predefined-feeds button');
    const loadMoreButton = document.getElementById('loadMoreButton');
    const themeToggle = document.getElementById('theme-toggle');
    const configButton = document.getElementById('configButton');
    const closeModalButton = document.getElementById('closeModalButton');
    const fetchCustomFeedButton = document.getElementById('fetchCustomFeedButton');
    const urlInput = document.getElementById('bskyUrlInput'); // Input inside modal
    const modalOverlay = document.querySelector('#configModal .modal-overlay');
    const modalContent = document.querySelector('#configModal .modal-content'); // To stop propagation

    // Apply initial theme based on localStorage or system preference
    applyInitialTheme();

    // --- Initial Load ---
    // Check for a persisted custom URL first
    const persistedCustomUrl = localStorage.getItem(CUSTOM_URL_STORAGE_KEY);
    if (persistedCustomUrl) {
        console.log("Loading persisted custom URL:", persistedCustomUrl);
        if (urlInput) urlInput.value = persistedCustomUrl; // Pre-fill modal input for convenience
        handleFetchRequest(persistedCustomUrl, true); // Pass flag indicating it's custom
    } else {
        // If no custom URL, load the first predefined feed as default
        const firstFeedButton = predefinedFeedButtons[0];
        if (firstFeedButton) {
            const defaultUrl = firstFeedButton.getAttribute('data-url');
            console.log("Loading default predefined feed:", defaultUrl);
            handleFetchRequest(defaultUrl); // Let it update the active button
        } else {
            // Handle case where there are no predefined buttons (unlikely based on HTML)
            console.warn("No predefined feeds found for initial load.");
            displayError("Welcome! Please select a feed or configure a custom one using the gear icon.");
            updateActiveFeedButton(null); // Ensure no button appears active
            // Scroll to top even if no feed is loaded initially
            window.scrollTo(0, 0);
        }
    }

    // --- Event Listeners ---

    // Predefined Feed Buttons in Header
    predefinedFeedButtons.forEach(button => {
        button.addEventListener('click', () => {
            const url = button.getAttribute('data-url');
            if (!url) return; // Skip if button has no URL

            // Clear any saved custom URL when selecting a predefined feed
            localStorage.removeItem(CUSTOM_URL_STORAGE_KEY);
            console.log("Cleared persisted custom URL, loading predefined:", url);

            // Clear the input field in the modal as well
            if (urlInput) urlInput.value = '';

            // Fetch posts for the selected predefined URL
            // handleFetchRequest will scroll to top
            handleFetchRequest(url);
        });
    });

    // Configuration Modal Triggers
    if (configButton) {
        configButton.addEventListener('click', showConfigModal);
    }
    if (closeModalButton) {
        closeModalButton.addEventListener('click', hideConfigModal);
    }
    if (modalOverlay) {
        // Close modal when clicking the dark overlay background
        modalOverlay.addEventListener('click', hideConfigModal);
    }
    if (modalContent) {
        // Prevent clicks inside the modal content from closing it via the overlay listener
        modalContent.addEventListener('click', (event) => event.stopPropagation());
    }


    // Fetch Custom Feed Button (inside modal)
    if (fetchCustomFeedButton && urlInput) {
        const fetchAndSaveCustom = () => {
            const customUrl = urlInput.value.trim();
            if (customUrl) {
                // Basic validation (could be improved)
                if (!customUrl.startsWith('https://bsky.app/profile/') && !customUrl.startsWith('https://staging.bsky.app/profile/')) {
                    alert("Invalid URL. Please enter a full Bluesky feed or list URL (starting with https://bsky.app/profile/... or https://staging.bsky.app/profile/...).");
                    return;
                }
                // Save the valid URL to local storage
                localStorage.setItem(CUSTOM_URL_STORAGE_KEY, customUrl);
                console.log("Saved custom URL, fetching:", customUrl);
                hideConfigModal(); // Close the modal
                // handleFetchRequest will scroll to top
                handleFetchRequest(customUrl, true); // Fetch with the custom flag
            } else {
                // Provide feedback if the input is empty
                alert("Please enter a Bluesky URL.");
            }
        };

        fetchCustomFeedButton.addEventListener('click', fetchAndSaveCustom);

        // Allow fetching via Enter key in the modal input field
        urlInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault(); // Prevent default form submission behavior
                fetchAndSaveCustom(); // Trigger the same action as clicking the button
            }
        });
    }

    // Load More Button
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMorePosts);
        // Note: loadMorePosts does NOT scroll to top, which is desired behavior.
    }

    // Theme Toggle Button
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

}); // End DOMContentLoaded