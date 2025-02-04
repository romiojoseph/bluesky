let listCursor = null;
let feedCursor = null;
let isFeedLoaded = false;
let isListLoaded = false;
let initialListPosts = [];
let initialFeedPosts = [];
let displayedListPosts = [];
let displayedFeedPosts = [];

async function init() {
    // Load initial Trending feed and Recent News list posts (100 each)
    const initialFeedData = await fetchPosts('feed', 100);
    initialFeedPosts = initialFeedData.feed;
    feedCursor = initialFeedData.cursor;
    isFeedLoaded = true;
    displayInitialPosts('feed', initialFeedPosts);

    const initialListData = await fetchPosts('list', 100);
    initialListPosts = initialListData.feed;
    listCursor = initialListData.cursor;
    isListLoaded = true;
    displayInitialPosts('list', initialListPosts);

    // Load event listeners for "Load More" buttons
    document.getElementById('load-more-list').addEventListener('click', () => loadMorePosts('list'));
    document.getElementById('load-more-feed').addEventListener('click', () => loadMorePosts('feed'));

    // Add event listeners to tabs, removing any existing listeners first
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.removeEventListener('click', tabClickHandler);
        tab.addEventListener('click', tabClickHandler);
    });
}

function displayInitialPosts(type, posts) {
    const container = document.getElementById(`${type}-posts`);
    if (!container) return;

    // Check if posts are already displayed
    if ((type === 'list' && displayedListPosts.length > 0) || (type === 'feed' && displayedFeedPosts.length > 0)) {
        return;
    }

    const displayedPosts = posts.slice(0, 35);
    displayPosts(displayedPosts, `${type}-posts`);

    // Update the displayed posts array
    if (type === 'list') {
        displayedListPosts = displayedPosts;
    } else {
        displayedFeedPosts = displayedPosts;
    }

    // Show the "Load More" button after displaying initial posts
    const loadMoreButton = document.getElementById(`load-more-${type}`);
    if (loadMoreButton) {
        loadMoreButton.style.display = 'block';
    }
}

async function loadMorePosts(type) {
    const loadMoreButton = document.getElementById(`load-more-${type}`);
    if (!loadMoreButton) return;

    loadMoreButton.disabled = true;
    loadMoreButton.textContent = 'Loading...';

    const remainingPosts = type === 'list' ? initialListPosts.slice(35) : initialFeedPosts.slice(35);

    if (remainingPosts.length > 0) {
        // Display remaining posts from the initial fetch
        displayPosts(remainingPosts, `${type}-posts`);
        if (type === 'list') {
            initialListPosts = [];
        } else {
            initialFeedPosts = [];
        }

        // Update button text and re-enable
        loadMoreButton.textContent = 'Load More';
        loadMoreButton.disabled = false;

        // If all initial posts are displayed, hide the button
        if (remainingPosts.length < 65) {
            loadMoreButton.style.display = 'none';
        }
    } else {
        // Fetch new posts after initial posts are fully displayed
        const limit = 50;
        const cursor = type === 'list' ? listCursor : feedCursor;
        const data = await fetchPosts(type, limit, cursor);

        if (data.feed && data.feed.length > 0) {
            displayPosts(data.feed, `${type}-posts`);

            if (type === 'list') {
                listCursor = data.cursor;
            } else {
                feedCursor = data.cursor;
            }

            loadMoreButton.textContent = 'Load More';
            loadMoreButton.disabled = false;

            if (!data.cursor) {
                loadMoreButton.style.display = 'none';
            }
        } else {
            loadMoreButton.style.display = 'none';
        }
    }
}

function tabClickHandler(event) {
    const tab = event.currentTarget;
    const target = tab.dataset.target;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.getElementById('list').style.display = target === 'list' ? 'block' : 'none';
    document.getElementById('feed').style.display = target === 'feed' ? 'block' : 'none';

    // Do not fetch new posts when switching tabs
    if (target === 'feed' && isFeedLoaded) {
        displayInitialPosts('feed', initialFeedPosts);
    } else if (target === 'list' && isListLoaded) {
        displayInitialPosts('list', initialListPosts);
    }
}

// Initialize only once when the page loads
document.addEventListener('DOMContentLoaded', () => {
    init();
});

// Add this to the end of your main.js file:

document.addEventListener('DOMContentLoaded', () => {
    init();

    // Add event listener to the logo link
    const logoLink = document.getElementById('logo-link');
    logoLink.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default link behavior
        showTab(event, 'for-you'); // Switch to "For you" and refresh
    });
});