let allFetchedFeeds = [];
const BATCH_SIZE = 100;
let currentDisplayIndex = 0;
let isLoading = false;

document.addEventListener('DOMContentLoaded', () => {
    fetchFeeds('trending.bsky.app');

    // Add event listeners
    document.getElementById('search').addEventListener('input', debounce(filterFeeds, 300));
    document.getElementById('sort').addEventListener('change', (e) => debounce(sortFeeds(e.target.value), 300));

    // Add scroll listener for infinite scroll
    window.addEventListener('scroll', debounce(handleScroll, 100));
});

// Debounce helper function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

async function fetchFeeds(handle) {
    const loader = document.getElementById('loader');
    const progress = document.getElementById('progress');
    let cursor = null;

    loader.style.display = 'flex';
    progress.style.display = 'block';
    progress.innerHTML = 'Please wait while the feeds are being fetched...<br>This might take a moment.';

    try {
        do {
            const params = { actor: handle, limit: 100 };
            if (cursor) params.cursor = cursor;

            const response = await fetch(`https://api.bsky.app/xrpc/app.bsky.feed.getActorFeeds?${new URLSearchParams(params)}`);
            if (!response.ok) throw new Error('Network response was not ok');

            const data = await response.json();
            if (data.feeds) {
                allFetchedFeeds = allFetchedFeeds.concat(data.feeds);
                progress.innerHTML = `Fetching feeds: ${allFetchedFeeds.length} feeds retrieved<br>Please wait while we load everything...`;

                // Sort and display at each fetch
                const defaultSort = document.getElementById('sort').value;
                sortFeeds(defaultSort, true);
            }
            cursor = data.cursor;
        } while (cursor);

    } catch (error) {
        console.error('Error fetching feeds:', error);
        progress.innerHTML = 'Error fetching feeds. Please try again.';
    } finally {
        loader.style.display = 'none';
        progress.style.display = 'none';
    }
}

function displayInitialFeeds() {
    const container = document.getElementById('feeds-container');
    container.innerHTML = '';

    const initialFeeds = allFetchedFeeds.slice(0, BATCH_SIZE);
    currentDisplayIndex = BATCH_SIZE;

    initialFeeds.forEach(feed => {
        container.appendChild(createFeedCard(feed));
    });
}

function handleScroll() {
    if (isLoading) return;

    const scrollPosition = window.innerHeight + window.scrollY;
    const documentHeight = document.documentElement.offsetHeight;

    if (scrollPosition >= documentHeight - 1000) {
        loadMoreFeeds();
    }
}

function loadMoreFeeds() {
    if (currentDisplayIndex >= allFetchedFeeds.length || isLoading) return;

    isLoading = true;
    const container = document.getElementById('feeds-container');

    const nextBatch = allFetchedFeeds.slice(
        currentDisplayIndex,
        currentDisplayIndex + BATCH_SIZE
    );

    nextBatch.forEach(feed => {
        container.appendChild(createFeedCard(feed));
    });

    currentDisplayIndex += BATCH_SIZE;
    isLoading = false;
}

function filterFeeds() {
    const searchQuery = document.getElementById('search').value.toLowerCase().trim();
    const container = document.getElementById('feeds-container');
    container.innerHTML = '';

    if (!searchQuery) {
        displayInitialFeeds();
        return;
    }

    const filteredFeeds = allFetchedFeeds.filter(feed =>
        feed.displayName.toLowerCase().includes(searchQuery)
    );

    if (filteredFeeds.length === 0) {
        // Add no results message
        const noResults = document.createElement('div');
        noResults.className = 'no-results';
        noResults.innerHTML = `
            <div class="no-results-message">
                <h3>No results found for "${searchQuery}"</h3>
                <p>Try different keywords or clear the search to see all feeds.</p>
            </div>
        `;
        container.appendChild(noResults);
        return;
    }

    filteredFeeds.forEach(feed => {
        container.appendChild(createFeedCard(feed));
    });
}

function sortFeeds(sortOption = null, isInitialSort = false) {
    // If sortOption is not provided, get it from the select element
    if (!sortOption) {
        sortOption = document.getElementById('sort').value;
    }

    // Sort the entire dataset
    allFetchedFeeds.sort((a, b) => {
        if (sortOption.startsWith('likeCount')) {
            return sortOption.endsWith('asc')
                ? a.likeCount - b.likeCount
                : b.likeCount - a.likeCount;
        } else if (sortOption.startsWith('displayName')) {
            return sortOption.endsWith('asc')
                ? a.displayName.localeCompare(b.displayName)
                : b.displayName.localeCompare(a.displayName);
        } else if (sortOption.startsWith('indexedAt')) {
            return sortOption.endsWith('asc')
                ? new Date(a.indexedAt) - new Date(b.indexedAt)
                : new Date(b.indexedAt) - new Date(a.indexedAt);
        }
        return 0;
    });

    // Reset display index and redisplay
    currentDisplayIndex = 0;
    displayInitialFeeds();
}

function createFeedCard(feed) {
    const card = document.createElement('div');
    card.classList.add('feed-card');

    const feedDid = feed.did;
    const authorDid = feed.creator.did;
    const feedId = feed.uri.split('/').pop();

    card.innerHTML = `
        <h2>${feed.displayName}</h2>
        <p><i class="ph-duotone ph-heart"></i> Liked by ${feed.likeCount} users</p>
        <div class="buttons">
            <button data-url="https://bsky.app/profile/${authorDid}/feed/${feedId}" title="Click to view the Bluesky feed">Bluesky</button>
            <button data-url="https://www.google.com/search?q=${encodeURIComponent(feed.displayName)}&tbm=nws" title="View this trending topic on Google News">Google</button>
            <button data-url="https://www.bing.com/news/search?q=${encodeURIComponent(feed.displayName)}" title="View this trending topic on Bing News">Bing</button>
            <button data-url="https://duckduckgo.com/?q=${encodeURIComponent(feed.displayName)}&iar=news&ia=news" title="View this trending topic on DuckDuckGo News">DuckDuckGo</button>
        </div>
        <aside>Feed created using: ${feedDid}</aside>
        ${feed.labels?.length > 0 ? '<p>Labels applied: YES</p>' : ''}
        <p class="subtle">Last indexed at: ${formatDate(feed.indexedAt)}</p>
    `;

    card.querySelectorAll('.buttons button').forEach(button => {
        button.addEventListener('click', () => {
            window.open(button.dataset.url, '_blank');
        });
    });

    return card;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}