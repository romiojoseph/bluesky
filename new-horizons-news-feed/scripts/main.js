let listCursor = null;
let feedCursor = null;
let techListCursor = null;
let techFeedCursor = null;
let techmemeCursor = null;
let isFeedLoaded = false;
let isListLoaded = false;
let isTechFeedLoaded = false;
let isTechListLoaded = false;
let isTechmemeLoaded = false;
let initialListPosts = [];
let initialFeedPosts = [];
let initialTechListPosts = [];
let initialTechFeedPosts = [];
let initialTechmemePosts = [];
let displayedListPosts = [];
let displayedFeedPosts = [];
let displayedTechListPosts = [];
let displayedTechFeedPosts = [];
let displayedTechmemePosts = [];

// News URIs
const newsListUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lc34yoopje27';
const newsFeedUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.feed.generator/aaahn42hkwvf2';

// Tech URIs
const techListUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lh6agik2oh2x';
const techFeedUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.feed.generator/aaanqiwe5dvuu';

async function init() {
    // Load initial News recent posts (100)
    await loadInitialPosts('news', 'latest');

    // Add event listeners for "Load More" buttons
    document.getElementById('load-more-news').addEventListener('click', () => loadMorePosts('news'));
    document.getElementById('load-more-tech').addEventListener('click', () => loadMorePosts('tech'));
    document.getElementById('load-more-techmeme').addEventListener('click', () => loadMoreTechmemePosts());

    // Add event listeners to tabs
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.removeEventListener('click', tabClickHandler);
        tab.addEventListener('click', tabClickHandler);
    });

    // Add event listeners for trending/latest toggles
    document.getElementById('news-trending-toggle').addEventListener('click', () => toggleFeedType('news', 'trending'));
    document.getElementById('news-latest-toggle').addEventListener('click', () => toggleFeedType('news', 'latest'));
    document.getElementById('tech-trending-toggle').addEventListener('click', () => toggleFeedType('tech', 'trending'));
    document.getElementById('tech-latest-toggle').addEventListener('click', () => toggleFeedType('tech', 'latest'));
    document.getElementById('tech-techmeme-toggle').addEventListener('click', () => toggleFeedType('tech', 'techmeme'));
}

async function loadInitialPosts(section, type) {
    // Hide any existing load more buttons during loading
    if (section === 'news') {
        document.getElementById('load-more-news').style.display = 'none';
    } else if (section === 'tech') {
        document.getElementById('load-more-tech').style.display = 'none';
        document.getElementById('load-more-techmeme').style.display = 'none';
    }

    if (section === 'news') {
        if (type === 'trending' && !isFeedLoaded) {
            const initialFeedData = await fetchPosts('feed', 100, null, newsFeedUri);
            initialFeedPosts = initialFeedData.feed;
            feedCursor = initialFeedData.cursor;
            isFeedLoaded = true;
            displayInitialPosts('news', initialFeedPosts);
        } else if (type === 'latest' && !isListLoaded) {
            const initialListData = await fetchPosts('list', 100, null, newsListUri);
            initialListPosts = initialListData.feed;
            listCursor = initialListData.cursor;
            isListLoaded = true;
            displayInitialPosts('news', initialListPosts);
        }
    } else if (section === 'tech') {
        if (type === 'trending' && !isTechFeedLoaded) {
            const initialTechFeedData = await fetchPosts('feed', 100, null, techFeedUri);
            initialTechFeedPosts = initialTechFeedData.feed;
            techFeedCursor = initialTechFeedData.cursor;
            isTechFeedLoaded = true;
            displayInitialPosts('tech', initialTechFeedPosts);
        } else if (type === 'latest' && !isTechListLoaded) {
            const initialTechListData = await fetchPosts('list', 100, null, techListUri);
            initialTechListPosts = initialTechListData.feed;
            techListCursor = initialTechListData.cursor;
            isTechListLoaded = true;
            displayInitialPosts('tech', initialTechListPosts);
        } else if (type === 'techmeme' && !isTechmemeLoaded) {
            const techmemeData = await fetchTechmemePosts();
            initialTechmemePosts = techmemeData.feed;
            techmemeCursor = techmemeData.cursor;
            isTechmemeLoaded = true;
            displayInitialPosts('tech', initialTechmemePosts, 'techmeme');
        }
    }
}

function displayInitialPosts(section, posts, type = null) {
    const container = document.getElementById(`${section}-posts`);
    if (!container) return;

    // Clear container
    container.innerHTML = '';

    // Display all posts from the initial fetch
    if (type === 'techmeme') {
        // For techmeme posts, we need to use the special display function
        displayTechmemePosts(posts, `${section}-posts`);
    } else {
        displayPosts(posts, `${section}-posts`);
    }

    // Update the displayed posts array
    if (section === 'news') {
        if (document.getElementById('news-trending-toggle').classList.contains('active')) {
            displayedFeedPosts = posts;
            // Clear initial posts to force new fetch on load more
            initialFeedPosts = [];
        } else {
            displayedListPosts = posts;
            // Clear initial posts to force new fetch on load more
            initialListPosts = [];
        }
    } else if (section === 'tech') {
        if (document.getElementById('tech-trending-toggle').classList.contains('active')) {
            displayedTechFeedPosts = posts;
            // Clear initial posts to force new fetch on load more
            initialTechFeedPosts = [];
        } else if (document.getElementById('tech-latest-toggle').classList.contains('active')) {
            displayedTechListPosts = posts;
            // Clear initial posts to force new fetch on load more
            initialTechListPosts = [];
        } else if (document.getElementById('tech-techmeme-toggle').classList.contains('active')) {
            displayedTechmemePosts = posts;
            // Clear initial posts to force new fetch on load more
            initialTechmemePosts = [];
        }
    }

    // Show the appropriate "Load More" button after displaying initial posts
    if (section === 'tech' && type === 'techmeme') {
        const loadMoreButton = document.getElementById('load-more-techmeme');
        if (loadMoreButton) {
            loadMoreButton.style.display = 'block';
        }
        document.getElementById('load-more-tech').style.display = 'none';
    } else {
        const loadMoreButton = document.getElementById(`load-more-${section}`);
        if (loadMoreButton) {
            loadMoreButton.style.display = 'block';
        }
        if (section === 'tech') {
            document.getElementById('load-more-techmeme').style.display = 'none';
        }
    }
}

async function loadMorePosts(section) {
    const loadMoreButton = document.getElementById(`load-more-${section}`);
    if (!loadMoreButton) return;

    loadMoreButton.disabled = true;
    loadMoreButton.textContent = 'Loading...';
    // Hide the load more button while loading
    loadMoreButton.style.display = 'none';

    let currentType = '';
    let cursor = null;
    let uri = '';
    let type = '';

    if (section === 'news') {
        currentType = document.getElementById('news-trending-toggle').classList.contains('active') ? 'trending' : 'latest';

        if (currentType === 'trending') {
            cursor = feedCursor;
            uri = newsFeedUri;
            type = 'feed';
        } else {
            cursor = listCursor;
            uri = newsListUri;
            type = 'list';
        }
    } else if (section === 'tech') {
        if (document.getElementById('tech-trending-toggle').classList.contains('active')) {
            currentType = 'trending';
            cursor = techFeedCursor;
            uri = techFeedUri;
            type = 'feed';
        } else if (document.getElementById('tech-latest-toggle').classList.contains('active')) {
            currentType = 'latest';
            cursor = techListCursor;
            uri = techListUri;
            type = 'list';
        } else if (document.getElementById('tech-techmeme-toggle').classList.contains('active')) {
            currentType = 'techmeme';
            return loadMoreTechmemePosts();
        }
    }

    // Fetch new posts
    const limit = 100;
    const data = await fetchPosts(type, limit, cursor, uri);

    if (data.feed && data.feed.length > 0) {
        displayPosts(data.feed, `${section}-posts`);

        if (section === 'news') {
            if (currentType === 'trending') {
                feedCursor = data.cursor;
            } else {
                listCursor = data.cursor;
            }
        } else if (section === 'tech') {
            if (currentType === 'trending') {
                techFeedCursor = data.cursor;
            } else {
                techListCursor = data.cursor;
            }
        }

        // Always show the load more button, even if there's no cursor
        // This allows users to keep loading more posts
        loadMoreButton.textContent = 'Load More';
        loadMoreButton.disabled = false;
        loadMoreButton.style.display = 'block';
    } else {
        // Only hide the button if there are truly no more posts
        loadMoreButton.style.display = 'none';
    }
}

async function loadMoreTechmemePosts() {
    const loadMoreButton = document.getElementById('load-more-techmeme');
    if (!loadMoreButton) return;

    loadMoreButton.disabled = true;
    loadMoreButton.textContent = 'Loading...';
    // Hide the load more button while loading
    loadMoreButton.style.display = 'none';

    try {
        const data = await fetchTechmemePosts(techmemeCursor);

        if (data.feed && data.feed.length > 0) {
            // Use the tech-posts container for displaying techmeme posts
            displayTechmemePosts(data.feed, 'tech-posts');
            techmemeCursor = data.cursor;

            // Always show the load more button
            loadMoreButton.textContent = 'Load More';
            loadMoreButton.disabled = false;
            loadMoreButton.style.display = 'block';
        } else {
            // Only hide if there are truly no more posts
            loadMoreButton.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading more Techmeme posts:', error);
        loadMoreButton.textContent = 'Load More';
        loadMoreButton.disabled = false;
        loadMoreButton.style.display = 'block';
    }
}

function toggleFeedType(section, type) {
    // Scroll to top
    window.scrollTo(0, 0);

    // Update toggle buttons
    const trendingToggle = document.getElementById(`${section}-trending-toggle`);
    const latestToggle = document.getElementById(`${section}-latest-toggle`);
    const techmemeToggle = document.getElementById(`${section}-techmeme-toggle`);

    if (section === 'tech' && techmemeToggle) {
        trendingToggle.classList.toggle('active', type === 'trending');
        latestToggle.classList.toggle('active', type === 'latest');
        techmemeToggle.classList.toggle('active', type === 'techmeme');

        // Show/hide the appropriate load more button
        document.getElementById('load-more-tech').style.display = type !== 'techmeme' ? 'block' : 'none';
        document.getElementById('load-more-techmeme').style.display = type === 'techmeme' ? 'block' : 'none';
    } else {
        trendingToggle.classList.toggle('active', type === 'trending');
        latestToggle.classList.toggle('active', type === 'latest');
    }

    // Clear the container before loading new posts
    const container = document.getElementById(`${section}-posts`);
    if (container) {
        container.innerHTML = '';
    }

    // Always load fresh posts when toggling, regardless of whether they were loaded before
    if (section === 'news') {
        if (type === 'trending') {
            // Reset the loaded flag to force a fresh fetch
            isFeedLoaded = false;
            loadInitialPosts('news', 'trending');
        } else {
            // Reset the loaded flag to force a fresh fetch
            isListLoaded = false;
            loadInitialPosts('news', 'latest');
        }
    } else if (section === 'tech') {
        if (type === 'trending') {
            // Reset the loaded flag to force a fresh fetch
            isTechFeedLoaded = false;
            loadInitialPosts('tech', 'trending');
        } else if (type === 'latest') {
            // Reset the loaded flag to force a fresh fetch
            isTechListLoaded = false;
            loadInitialPosts('tech', 'latest');
        } else if (type === 'techmeme') {
            // Reset the loaded flag to force a fresh fetch
            isTechmemeLoaded = false;
            loadInitialPosts('tech', 'techmeme');
        }
    }
}

function tabClickHandler(event) {
    const tab = event.currentTarget;
    const target = tab.dataset.target;

    // Scroll to top
    window.scrollTo(0, 0);

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    // Hide all content sections
    document.querySelectorAll('.content').forEach(content => {
        content.style.display = 'none';
    });

    // Show selected content
    const selectedContent = document.getElementById(target);
    if (selectedContent) {
        selectedContent.style.display = 'block';
    }

    // Always load fresh content for the selected tab
    if (target === 'news') {
        // Default to recent
        document.getElementById('news-latest-toggle').classList.add('active');
        document.getElementById('news-trending-toggle').classList.remove('active');
        isListLoaded = false;
        loadInitialPosts('news', 'latest');
    } else if (target === 'tech') {
        // Default to recent
        document.getElementById('tech-latest-toggle').classList.add('active');
        document.getElementById('tech-trending-toggle').classList.remove('active');
        document.getElementById('tech-techmeme-toggle').classList.remove('active');
        isTechListLoaded = false;
        loadInitialPosts('tech', 'latest');
    }
}

// Initialize only once when the page loads
document.addEventListener('DOMContentLoaded', () => {
    init();

    // Add event listener to the logo link
    const logoLink = document.getElementById('logo-link');
    logoLink.addEventListener('click', (event) => {
        event.preventDefault(); // Prevent default link behavior

        // Scroll to top
        window.scrollTo(0, 0);

        // Switch to "News" tab and refresh
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector('.tab[data-target="news"]').classList.add('active');

        // Hide all content sections
        document.querySelectorAll('.content').forEach(content => {
            content.style.display = 'none';
        });

        // Show news content
        document.getElementById('news').style.display = 'block';

        // Set Recent as active and load recent posts
        document.getElementById('news-latest-toggle').classList.add('active');
        document.getElementById('news-trending-toggle').classList.remove('active');
        isListLoaded = false;
        loadInitialPosts('news', 'latest');
    });
});