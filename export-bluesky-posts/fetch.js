const RATE_LIMIT_DELAY = 1000; // 1 second
const MAX_BATCH_SIZE = 100;

let lastRequestTime = 0;
let collectedPosts = [];
let resourceInfo = null;

// UI Elements
const urlInput = document.getElementById('urlInput');
const urlError = document.getElementById('urlError');
const postsSlider = document.getElementById('postsSlider');
const postsInput = document.getElementById('postsInput');
const fetchBtn = document.getElementById('fetchPostsBtn');
const downloadBtn = document.getElementById('downloadPostsBtn');
const progress = document.getElementById('progresser');

// Sync slider and number input
postsSlider.addEventListener('input', (e) => {
    postsInput.value = e.target.value;
});

postsInput.addEventListener('input', (e) => {
    const value = parseInt(e.target.value);
    if (value > 0) {
        postsSlider.value = value;
    }
});

async function rateLimit() {
    const now = Date.now();
    const elapsed = now - lastRequestTime;
    if (elapsed < RATE_LIMIT_DELAY) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
    }
    lastRequestTime = Date.now();
}

async function resolveHandle(handle) {
    await rateLimit();
    const response = await fetch(`${BASE_URL}/com.atproto.identity.resolveHandle?handle=${handle}`);
    if (!response.ok) throw new Error('Failed to resolve handle');
    const data = await response.json();
    return data.did;
}

async function detectResourceType(url) {
    const profilePattern = /(?:https:\/\/bsky\.app\/profile\/|@?)([^/]+)/;
    const listPattern = /\/lists\/(\w+)$/;
    const feedPattern = /\/feed\/(\w+)$/;

    if (url.includes('/lists/')) {
        const handleMatch = url.match(/\/profile\/([^/]+)/);
        const listIdMatch = url.match(listPattern);
        if (handleMatch && listIdMatch) {
            const handle = handleMatch[1];
            const listId = listIdMatch[1];
            const did = await resolveHandle(handle);
            return {
                type: 'list',
                uri: `at://${did}/app.bsky.graph.list/${listId}`,
                name: `${handle}_list_${listId}`
            };
        }
    } else if (url.includes('/feed/')) {
        const handleMatch = url.match(/\/profile\/([^/]+)/);
        const feedIdMatch = url.match(feedPattern);
        if (handleMatch && feedIdMatch) {
            const handle = handleMatch[1];
            const feedId = feedIdMatch[1];
            const did = await resolveHandle(handle);
            return {
                type: 'feed',
                uri: `at://${did}/app.bsky.feed.generator/${feedId}`,
                name: `${handle}_feed_${feedId}`
            };
        }
    } else if (profilePattern.test(url)) {
        const handle = url.match(profilePattern)[1];
        const did = await resolveHandle(handle);
        return {
            type: 'profile',
            uri: did,
            name: handle
        };
    }

    throw new Error('Invalid URL format');
}

async function fetchPosts(resourceType, params, limit) {
    const allPosts = [];
    let cursor = null;
    let totalFetched = 0;
    let endReason = "Requested number of posts collected";

    const endpoint = {
        'profile': 'app.bsky.feed.getAuthorFeed',
        'list': 'app.bsky.feed.getListFeed',
        'feed': 'app.bsky.feed.getFeed'
    }[resourceType];

    while (totalFetched < limit) {
        await rateLimit();

        const currentParams = new URLSearchParams({
            ...params,
            limit: Math.min(limit - totalFetched, MAX_BATCH_SIZE),
            ...(cursor && { cursor })
        });

        const response = await fetch(`${BASE_URL}/${endpoint}?${currentParams}`);
        if (!response.ok) throw new Error('Failed to fetch posts');

        const data = await response.json();

        if (!data.feed || data.feed.length === 0) {
            endReason = "No more posts available";
            break;
        }

        allPosts.push(...data.feed);
        totalFetched += data.feed.length;

        const progressPercent = (totalFetched / limit) * 100;
        addProgressMessage(`Fetched ${totalFetched} posts (${progressPercent.toFixed(1)}%)`);

        if (!data.cursor) {
            endReason = "End of feed reached";
            break;
        }

        cursor = data.cursor;
    }

    return { posts: allPosts.slice(0, limit), endReason };
}

async function startCollection() {
    try {
        fetchBtn.disabled = true;
        downloadPostsBtn.classList.add('download-posts-hidden');
        progresser.style.display = 'block';
        progresser.innerHTML = ''; // Clear previous messages

        addProgressMessage('🚀 Starting data collection...');

        const url = urlInput.value.trim();
        const limit = parseInt(postsInput.value);

        resourceInfo = await detectResourceType(url);
        addProgressMessage(`✨ Resource type: ${resourceInfo.type}`);

        const params = {
            [resourceInfo.type === 'profile' ? 'actor' : resourceInfo.type]: resourceInfo.uri
        };

        if (resourceInfo.type === 'profile') {
            params.filter = 'posts_with_replies';
        }

        const { posts, endReason } = await fetchPosts(resourceInfo.type, params, limit);
        collectedPosts = posts;

        addProgressMessage(`✅ Successfully collected ${posts.length} posts`);
        if (posts.length < limit) {
            addProgressMessage(`ℹ️ Note: Fewer posts than requested were collected (${endReason})`);
        }

        downloadBtn.classList.remove('download-posts-hidden');
    } catch (error) {
        addProgressMessage(`Error: ${error.message}`, true);
    } finally {
        fetchBtn.disabled = false;
    }
}

// Add this new function for consistent progress messages
function addProgressMessage(message, isError = false) {
    const timestamp = new Date().toLocaleTimeString();
    const div = document.createElement('div');
    div.className = isError ? 'progress-error' : 'progress-message';

    const icon = isError ? '❌' :
        message.includes('Starting') ? '🚀' :
            message.includes('Resource type') ? '✨' :
                message.includes('Successfully') ? '✅' :
                    message.includes('Note') ? 'ℹ️' : '📥';

    div.innerHTML = `
        <span class="timestamp">[${timestamp}]</span>
        <span class="icon">${icon}</span>
        <span class="content">${message}</span>
    `;

    progresser.appendChild(div);
    progresser.scrollTop = progresser.scrollHeight;
}

function downloadJSON() {
    const exportedPostCount = collectedPosts.length;
    let fileName = '';

    if (resourceInfo.type === 'profile') {
        fileName = `${resourceInfo.name}_posts_${exportedPostCount}.json`;
    } else if (resourceInfo.type === 'feed') {
        fileName = `${resourceInfo.name.split('_feed_')[0]}_feed_${resourceInfo.name.split('_feed_')[1]}_posts_${exportedPostCount}.json`;
    } else if (resourceInfo.type === 'list') {
        fileName = `${resourceInfo.name.split('_list_')[0]}_list_${resourceInfo.name.split('_list_')[1]}_posts_${exportedPostCount}.json`;
    }

    const blob = new Blob([JSON.stringify(collectedPosts, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

fetchBtn.addEventListener('click', startCollection);
downloadBtn.addEventListener('click', downloadJSON);


// Add at the end of the file

class PostAnalyzer {
    constructor() {
        this.BASE_URL = "https://public.api.bsky.app/xrpc";
        this.postInput = document.getElementById('postInput');
        this.analyzeBtn = document.getElementById('analyzePostBtn');
        this.progressElement = document.getElementById('postProgress');
        this.resultsElement = document.getElementById('postResults');
        this.downloadButtons = document.getElementById('downloadButtons');
        this.messagesElement = document.getElementById('postMessages');

        this.analyzeBtn.addEventListener('click', () => this.analyzePost());
        this.downloadButtons.classList.add('hidden'); // Hide by default
    }

    updateProgress(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        const div = document.createElement('div');
        div.className = isError ? 'progress-error' : 'progress-message';
        div.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="icon">${isError ? '❌' : '📥'}</span>
            <span class="content">${message}</span>
        `;
        this.progressElement.appendChild(div);
        this.progressElement.scrollTop = this.progressElement.scrollHeight;
    }

    async getPostThread(uri) {
        const response = await fetch(`${this.BASE_URL}/app.bsky.feed.getPostThread?uri=${uri}`);
        if (!response.ok) throw new Error('Failed to fetch post thread');
        const data = await response.json();
        return data;
    }

    async fetchData(endpoint, params) {
        const items = [];
        let cursor = null; // Changed from undefined to null

        do {
            const urlParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== null) urlParams.append(key, value);
            });
            if (cursor) urlParams.append('cursor', cursor);
            urlParams.append('limit', '100');

            const response = await fetch(`${this.BASE_URL}/${endpoint}?${urlParams}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch ${endpoint}`);
            }

            const data = await response.json();
            const key = endpoint.includes('getLikes') ? 'likes' :
                endpoint.includes('getRepostedBy') ? 'repostedBy' : 'posts';

            if (data[key]) {
                items.push(...data[key]);
                this.updateProgress(`Fetched ${items.length} ${key}...`);
            }

            cursor = data.cursor;
        } while (cursor);

        return items;
    }

    async parsePostUrl(url) {
        const pattern = /https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/]+)/;
        const match = url.match(pattern);
        if (!match) throw new Error("Invalid post URL format");

        const [_, username, postId] = match;
        const response = await fetch(`${this.BASE_URL}/com.atproto.identity.resolveHandle?handle=${username}`);
        if (!response.ok) throw new Error('Failed to resolve handle');

        const data = await response.json();
        const uri = `at://${data.did}/app.bsky.feed.post/${postId}`;

        // Get thread data to get CID
        const threadData = await this.getPostThread(uri);
        const cid = threadData.thread.post.cid;

        return { uri, cid, username, postId };
    }

    createDownloadButton(data, filename, buttonText) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.className = 'download-btn';
        link.textContent = buttonText;
        return link;
    }

    async analyzePost() {
        try {
            this.progressElement.innerHTML = '';
            this.downloadButtons.innerHTML = '';
            this.messagesElement.innerHTML = '';
            this.progressElement.classList.remove('hidden');
            this.resultsElement.classList.remove('hidden');
            this.downloadButtons.classList.add('hidden');

            const postUrl = this.postInput.value.trim();
            if (!postUrl) {
                throw new Error('Please enter a Bluesky post URL');
            }

            this.updateProgress('🚀 Starting post analysis...');
            const postInfo = await this.parsePostUrl(postUrl);

            // Fetch thread data
            this.updateProgress('📑 Fetching post thread...');
            const threadData = await this.getPostThread(postInfo.uri);

            try {
                this.downloadButtons.classList.remove('hidden');

                // Save thread data
                this.downloadButtons.appendChild(
                    this.createDownloadButton(threadData,
                        `${postInfo.username}_post_${postInfo.postId}_thread.json`,
                        'Download thread (Incl. replies)'
                    )
                );

                // Fetch likes
                this.updateProgress('❤️ Fetching likes...');
                const likes = await this.fetchData('app.bsky.feed.getLikes', {
                    uri: postInfo.uri,
                    cid: postInfo.cid
                });

                if (likes && likes.length) {
                    this.downloadButtons.appendChild(
                        this.createDownloadButton(likes,
                            `${postInfo.username}_post_${postInfo.postId}_likes.json`,
                            'Download likes'
                        )
                    );
                } else {
                    this.messagesElement.innerHTML += '<p>No likes found for this post.</p>';
                }

                // Fetch reposts
                this.updateProgress('🔄 Fetching reposts...');
                const reposts = await this.fetchData('app.bsky.feed.getRepostedBy', {
                    uri: postInfo.uri
                });

                if (reposts && reposts.length) {
                    this.downloadButtons.appendChild(
                        this.createDownloadButton(reposts,
                            `${postInfo.username}_post_${postInfo.postId}_reposts.json`,
                            'Download reposts'
                        )
                    );
                } else {
                    this.messagesElement.innerHTML += '<p>No reposts found for this post.</p>';
                }

                // Fetch quotes
                this.updateProgress('💬 Fetching quotes...');
                const quotes = await this.fetchData('app.bsky.feed.getQuotes', {
                    uri: postInfo.uri
                });

                if (quotes && quotes.length) {
                    this.downloadButtons.appendChild(
                        this.createDownloadButton(quotes,
                            `${postInfo.username}_post_${postInfo.postId}_quotes.json`,
                            'Download quotes'
                        )
                    );
                } else {
                    this.messagesElement.innerHTML += '<p>No quotes found for this post.</p>';
                }

                this.updateProgress('✨ Analysis complete! All data has been saved.');

            } catch (error) {
                this.updateProgress(`Error fetching post data: ${error.message}`, true);
            }

        } catch (error) {
            this.updateProgress(error.message, true);
        }
    }
}

// Initialize PostAnalyzer
new PostAnalyzer();