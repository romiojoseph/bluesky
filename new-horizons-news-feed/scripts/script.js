const listUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lc34yoopje27';
const feedUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.feed.generator/aaahn42hkwvf2';

let listCursor = null;
let feedCursor = null;
let isFeedLoaded = false;

async function fetchPosts(type, limit, cursor = null) {
    const endpoint = type === 'list' ? 'app.bsky.feed.getListFeed' : 'app.bsky.feed.getFeed';
    const formattedUri = convertToValidAtUri(type === 'list' ? listUri : feedUri);

    if (!formattedUri) {
        return { feed: [] };
    }

    let url = `${apiBase}/${endpoint}?${type}=${encodeURIComponent(formattedUri)}&limit=${limit}`;
    if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    // Show loader before fetching
    const loader = document.getElementById(`${type}-loader`);
    if (loader) {
        loader.style.display = 'flex';
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching ${type} posts:`, error);
        return { feed: [] };
    } finally {
        // Hide loader after fetching, regardless of success or failure
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

function createPostElement(postData) {
    if (!postData.post.embed || postData.post.embed.$type !== 'app.bsky.embed.external#view') {
        return null;
    }

    const post = postData.post;
    const embed = post.embed.external;
    const authorDid = post.author.did;

    const postElement = document.createElement('div');
    postElement.classList.add('post');

    let postStatsHTML = '';
    if (post.likeCount > 0) {
        postStatsHTML += `
        <button class="post-likes" aria-label="Like">
          <i class="ph-duotone ph-heart"></i>
          <span class="post-count">${post.likeCount}</span>
        </button>
      `;
    }
    if (post.repostCount > 0) {
        postStatsHTML += `
        <button class="post-reposts" aria-label="Repost">
          <i class="ph-duotone ph-repeat"></i>
          <span class="post-count">${post.repostCount}</span>
        </button>
      `;
    }

    let descriptionText = embed.description;
    if (descriptionText.length > 240) {
        descriptionText = descriptionText.substring(0, 240) + '...';
    }

    postElement.innerHTML = `
    <div class="post-external">
      <a href="${embed.uri}" target="_blank" class="post-external-link" title="Click to view the full article">
        ${embed.thumb ? `<img src="${embed.thumb}" alt="${embed.title}">` : ''}
        <div class="post-external-content">
          <div class="post-external-title">${embed.title}</div>
          <p class="post-external-description">${descriptionText}</p>
        </div>
      </a>
    </div>
    <div class="post-meta">
    <div class="post-author-info">
        <a href="https://bsky.app/profile/${authorDid}" target="_blank" class="post-author-link">
            <img src="${post.author.avatar}" alt="${post.author.handle}">
            <span class="post-author-handle">${post.author.handle}</span>
        </a>
        <span class="post-author-timestamp">
            • ${formatRelativeTime(post.record.createdAt)}
        </span>
    </div>
      <div class="post-stats">
        ${postStatsHTML}
        <button class="post-copy" title="Copy Post URI">
          <i class="ph-duotone ph-copy"></i>
        </button>
      </div>
    </div>
    <div class="post-interactions">
        ${post.replyCount > 0 ? `
        <div class="post-replies">
            <i class="ph-duotone ph-chat-centered-dots"></i>
            <span>View ${post.replyCount} repl${post.replyCount === 1 ? 'y' : 'ies'}</span>
        </div>` : ''}
        ${post.quoteCount > 0 ? `
        <div class="post-quotes">
            <i class="ph-duotone ph-quotes"></i>
            <span>View ${post.quoteCount} quote${post.quoteCount === 1 ? '' : 's'}</span>
        </div>` : ''}
    </div>
  `;

    // Copy URI logic (similar to reference script)
    const copyButton = postElement.querySelector('.post-copy');
    copyButton.addEventListener('click', () => {
        const postUri = post.uri;
        const [_, didAndRkey] = postUri.split('://');
        const [did, type, rkey] = didAndRkey.split('/');
        const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;

        if (navigator.clipboard) {
            navigator.clipboard.writeText(postUrl)
                .then(() => {
                    // Optional: Display a success message or change the icon
                    copyButton.innerHTML = '<i class="ph-duotone ph-check"></i>';
                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="ph-duotone ph-copy"></i>';
                    }, 1500); // Reset after 1.5 seconds
                })
                .catch(err => {
                    console.error("Failed to copy:", err);
                });
        } else {
            // Fallback for older browsers or mobile
            const textArea = document.createElement("textarea");
            textArea.value = postUrl;
            textArea.style.position = "fixed"; // Ensure off-screen
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                const successful = document.execCommand('copy');
                if (successful) {
                    copyButton.innerHTML = '<i class="ph-duotone ph-check"></i>';
                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="ph-duotone ph-copy"></i>';
                    }, 1500);
                } else {
                    throw new Error('Failed to copy');
                }
            } catch (err) {
                console.error('Fallback: Oops, unable to copy', err);
                // Optional: Display an error message to the user
            }
            document.body.removeChild(textArea);
        }
    });

    // Replies logic
    const repliesElement = postElement.querySelector('.post-replies');
    if (repliesElement) {
        repliesElement.addEventListener('click', () => {
            const postUri = post.uri;
            const [_, didAndRkey] = postUri.split('://');
            const [did, type, rkey] = didAndRkey.split('/');
            const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;
            window.open(postUrl, '_blank');
        });
    }

    // Quotes logic
    const quotesElement = postElement.querySelector('.post-quotes');
    if (quotesElement) {
        quotesElement.addEventListener('click', () => {
            const postUri = post.uri;
            const [_, didAndRkey] = postUri.split('://');
            const [did, type, rkey] = didAndRkey.split('/');
            const postUrl = `https://bsky.app/profile/${did}/post/${rkey}/quotes`;
            window.open(postUrl, '_blank');
        });
    }

    return postElement;
}

function displayPosts(posts, containerId) {
    const container = document.getElementById(containerId);
    const loadMoreButton = document.getElementById(`load-more-${containerId.split('-')[0]}`);

    posts.forEach(postData => {
        const postElement = createPostElement(postData);
        if (postElement) {
            container.appendChild(postElement);
        }
    });

    // Show the "Load More" button after posts are displayed
    if (loadMoreButton) {
        loadMoreButton.style.display = 'inline-block';
    }
}

async function loadMorePosts(type) {
    const limit = 64;
    const cursor = type === 'list' ? listCursor : feedCursor;
    const data = await fetchPosts(type, limit, cursor);

    if (data.feed) {
        displayPosts(data.feed, type === 'list' ? 'list-posts' : 'feed-posts');
        if (type === 'list') {
            listCursor = data.cursor;
        } else {
            feedCursor = data.cursor;
        }
    }

    // Hide Load More button if no more posts
    if (!data.cursor) {
        document.getElementById(`load-more-${type}`).style.display = 'none';
    }
}

async function init() {
    // Load initial list posts (30)
    const initialListData = await fetchPosts('list', 33);
    displayPosts(initialListData.feed, 'list-posts');
    listCursor = initialListData.cursor;

    // Load More event listeners
    document.getElementById('load-more-list').addEventListener('click', () => loadMorePosts('list'));
    document.getElementById('load-more-feed').addEventListener('click', () => loadMorePosts('feed'));

    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        // Remove existing event listeners to prevent duplicates
        tab.removeEventListener('click', tabClickHandler);
        // Add new event listener
        tab.addEventListener('click', tabClickHandler);
    });
}

function tabClickHandler(event) {
    const tab = event.currentTarget;
    const target = tab.dataset.target;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.getElementById('list').style.display = target === 'list' ? 'block' : 'none';
    document.getElementById('feed').style.display = target === 'feed' ? 'block' : 'none';

    // Load feed posts only if not already loaded
    if (target === 'feed' && !isFeedLoaded) {
        fetchPosts('feed', 33).then(initialFeedData => {
            displayPosts(initialFeedData.feed, 'feed-posts');
            feedCursor = initialFeedData.cursor;
            isFeedLoaded = true;
        });
    }
}