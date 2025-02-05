document.addEventListener('DOMContentLoaded', () => {
    fetchFeeds('trending.bsky.app');
});

async function fetchFeeds(handle) {
    const allFeeds = [];
    let cursor = null;
    const loader = document.getElementById('loader');
    const progress = document.getElementById('progress');

    loader.style.display = 'flex'; // Show loader with spinner
    progress.style.display = 'block';

    try {
        do {
            const params = { actor: handle, limit: 100 };
            if (cursor) {
                params.cursor = cursor;
            }

            const response = await fetch(`https://api.bsky.app/xrpc/app.bsky.feed.getActorFeeds?${new URLSearchParams(params)}`);
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            const data = await response.json();
            if (data.feeds) {
                allFeeds.push(...data.feeds);
                progress.textContent = `Fetching feeds: ${allFeeds.length} feeds retrieved`;
            }

            cursor = data.cursor;
        } while (cursor);
    } catch (error) {
        console.error('Error fetching feeds:', error);
    } finally {
        loader.style.display = 'none';
        progress.style.display = 'none';
        displayFeeds(allFeeds);
    }
}

function displayFeeds(feeds) {
    const container = document.getElementById('feeds-container');
    container.innerHTML = ''; // Clear existing feeds

    feeds.forEach(feed => {
        container.appendChild(createFeedCard(feed));
    });

    sortFeeds();
}

function createFeedCard(feed) {
    const card = document.createElement('div');
    card.classList.add('feed-card');

    const feedDid = feed.did; // DID of the feed itself
    const authorDid = feed.creator.did; // Author DID (for Bluesky link)
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
        ${feed.labels.length > 0 ? '<p>Labels applied: YES</p>' : ''}
        <p class="subtle">Last indexed at: ${formatDate(feed.indexedAt)}</p>
    `;

    // Add event listeners to buttons
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

function sortFeeds() {
    const sortOption = document.getElementById('sort').value;
    const container = document.getElementById('feeds-container');
    const feedCards = Array.from(container.children);

    feedCards.sort((a, b) => {
        const getVal = (card, prop) => {
            if (prop.startsWith('likeCount')) {
                const likeText = card.querySelector('p').innerText;
                return parseInt(likeText.match(/\d+/)[0]);
            } else if (prop.startsWith('displayName')) {
                return card.querySelector('h2').textContent.toLowerCase();
            } else if (prop.startsWith('indexedAt')) {
                const dateText = card.querySelector('.subtle').textContent.split(': ')[1];
                return new Date(dateText);
            }
            return null;
        };

        const valA = getVal(a, sortOption);
        const valB = getVal(b, sortOption);

        if (sortOption.endsWith('-asc')) {
            return valA < valB ? -1 : valA > valB ? 1 : 0;
        } else {
            return valB < valA ? -1 : valB > valA ? 1 : 0;
        }
    });

    container.innerHTML = '';
    feedCards.forEach(card => container.appendChild(card));
}

function filterFeeds() {
    const searchQuery = document.getElementById('search').value.toLowerCase();
    const container = document.getElementById('feeds-container');

    Array.from(container.children).forEach(card => {
        const title = card.querySelector('h2').textContent.toLowerCase();
        const feedDID = card.querySelectorAll('p')[2].textContent.toLowerCase();
        card.style.display = title.includes(searchQuery) || feedDID.includes(searchQuery) ? 'block' : 'none';
    });
}