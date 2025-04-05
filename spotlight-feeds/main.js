// --- START OF FILE main.js ---
import { fetchListPosts, fetchFeedPosts } from './api.js';
import {
    showLoading,
    displayError,
    createTabs,
    // updateFeedInfo, // Removed
    updateActiveTab,
    clearPostsContainer,
    renderPosts,
    extractPostDataFromApi,
    createPostElement,
    updateLoadMoreButton
} from './ui.js';

// --- Configuration ---

// Using simple keys for internal use, displayName for tabs
// Removed description and button fields
const FEEDS_CONFIG = {
    'whats-hot': {
        type: 'feed',
        uri: 'at://did:plc:z72i7hdynmk6r22z27h6tvur/app.bsky.feed.generator/whats-hot',
        displayName: 'Discover'
    },
    'recent-news': {
        type: 'list',
        uri: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lc34yoopje27',
        displayName: 'Recent News'
    },
    'tech': {
        type: 'feed',
        uri: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.feed.generator/aaanqiwe5dvuu',
        displayName: 'Tech'
    },
    'trending-links': {
        type: 'feed',
        uri: 'at://did:plc:vpkhqolt662uhesyj6nxm7ys/app.bsky.feed.generator/links',
        displayName: 'Trending Links'
    },
    'bsky-team': {
        type: 'list',
        uri: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lerbsf2vix2x',
        displayName: 'Bluesky Team'
    },
    'devfeed': {
        type: 'feed',
        uri: 'at://did:plc:m2sjv3wncvsasdapla35hzwj/app.bsky.feed.generator/web-development',
        displayName: 'Web Development'
    },
    'science': {
        type: 'feed',
        uri: 'at://did:plc:jfhpnnst6flqway4eaeqzj2a/app.bsky.feed.generator/for-science',
        displayName: 'Science'
    },
    'interstellar': {
        type: 'feed',
        uri: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.feed.generator/aaaoy5eufdxdo',
        displayName: 'Astronomy'
    },
    'movies': {
        type: 'feed',
        uri: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.feed.generator/MoviesTVShows',
        displayName: 'Movies & TV'
    },
    'known-people': {
        type: 'list',
        uri: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3leviuxqxer2s',
        displayName: 'Popular Profiles'
    },
};

const INITIAL_FETCH_LIMIT = 50; // Number of posts to fetch initially
const LOAD_MORE_LIMIT = 100;   // Number of posts to fetch on "Load More"

// --- State ---
let currentFeedName = null; // Internal key/name of the current feed
let currentCursor = null;   // Cursor for pagination
let isLoadingFeed = false;  // Prevent concurrent initial fetches
let isLoadingMore = false; // Prevent concurrent 'load more' fetches

// --- Core Logic ---

/**
 * Fetches the initial batch of posts for the selected feed.
 * @param {string} feedName - The internal key/name of the feed to switch to.
 */
async function switchFeed(feedName) {
    if (isLoadingFeed || feedName === currentFeedName) return;

    console.log(`Switching feed to: ${feedName}`);
    isLoadingFeed = true;
    currentFeedName = feedName;
    localStorage.setItem('currentFeed', feedName);
    currentCursor = null; // Reset cursor for new feed
    isLoadingMore = false; // Reset load more state

    const feedConfig = FEEDS_CONFIG[feedName];
    if (!feedConfig) {
        console.error(`Feed configuration not found for key: ${feedName}`);
        displayError(`Configuration error for ${feedName}.`);
        isLoadingFeed = false;
        return;
    }

    updateActiveTab(feedName, FEEDS_CONFIG);
    // updateFeedInfo is no longer needed
    clearPostsContainer(); // Clear previous posts and errors
    updateLoadMoreButton(false, false); // Hide load more initially
    showLoading(true);
    window.scrollTo(0, 0);
    document.body.classList.add('initial-load'); // Flag for initial load message handling

    try {
        const result = await fetchPostsBatch(INITIAL_FETCH_LIMIT, null); // Fetch initial batch

        // Process and render posts
        const postDataObjects = result.posts.map(extractPostDataFromApi).filter(Boolean);
        const postElements = postDataObjects.map(createPostElement).filter(Boolean);
        renderPosts(postElements); // Render initial posts

        // Store cursor for Load More
        currentCursor = result.cursor;
        updateLoadMoreButton(false, !!currentCursor); // Update button based on cursor

    } catch (error) {
        console.error(`Error fetching initial feed ${feedName}:`, error);
        displayError(`Failed to load feed: ${error.message}`);
        renderPosts([]); // Ensure "no posts" message appears on error
        updateLoadMoreButton(false, false); // Hide load more on error
    } finally {
        showLoading(false);
        isLoadingFeed = false;
        // Initial load flag is removed within renderPosts
    }
}

/**
 * Fetches the next batch of posts using the stored cursor.
 */
async function loadMorePosts() {
    if (!currentFeedName || !currentCursor || isLoadingMore || isLoadingFeed) {
        console.log("Cannot load more:", { hasFeed: !!currentFeedName, hasCursor: !!currentCursor, isLoadingMore, isLoadingFeed });
        return;
    }

    isLoadingMore = true;
    updateLoadMoreButton(true, true); // Show loading state on the button
    displayError(''); // Clear errors before loading more

    try {
        console.log(`Fetching next batch (${LOAD_MORE_LIMIT}) for ${currentFeedName}`);
        const result = await fetchPostsBatch(LOAD_MORE_LIMIT, currentCursor); // Fetch next batch

        // Process and append new posts
        const postDataObjects = result.posts.map(extractPostDataFromApi).filter(Boolean);
        const postElements = postDataObjects.map(createPostElement).filter(Boolean);
        renderPosts(postElements); // Append new posts

        // Update cursor for the *next* load more
        currentCursor = result.cursor;
        updateLoadMoreButton(false, !!currentCursor); // Update button state

    } catch (error) {
        console.error("Error loading more posts:", error);
        displayError(`Error loading more: ${error.message}`);
        // Keep button enabled if cursor still exists, allowing retry
        updateLoadMoreButton(false, !!currentCursor);
    } finally {
        isLoadingMore = false;
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
    const feedConfig = FEEDS_CONFIG[currentFeedName];
    if (!feedConfig) {
        throw new Error("Cannot fetch posts: Current feed configuration is missing.");
    }

    if (feedConfig.type === 'list') {
        return await fetchListPosts(feedConfig.uri, limit, cursor);
    } else if (feedConfig.type === 'feed') {
        return await fetchFeedPosts(feedConfig.uri, limit, cursor);
    } else {
        throw new Error(`Invalid feed type encountered: ${feedConfig.type}`);
    }
}

/**
 * Initializes the application on page load.
 */
function initialize() {
    // Determine the initial feed
    const savedFeed = localStorage.getItem('currentFeed');
    const initialFeedName = (savedFeed && FEEDS_CONFIG[savedFeed]) ? savedFeed : Object.keys(FEEDS_CONFIG)[0];

    // Create tabs
    createTabs(FEEDS_CONFIG, initialFeedName, switchFeed);

    // Add listener for Load More button
    const loadMoreButton = document.getElementById('loadMoreButton');
    if (loadMoreButton) {
        loadMoreButton.addEventListener('click', loadMorePosts);
    } else {
        console.error("Load More button not found!");
    }

    // Load the initial feed
    switchFeed(initialFeedName);
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', initialize);

// --- END OF FILE main.js ---