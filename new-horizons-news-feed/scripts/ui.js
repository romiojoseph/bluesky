function createPostElement(postData) {
    if (!postData.post.embed || postData.post.embed.$type !== 'app.bsky.embed.external#view' || !postData.post.embed.external.thumb) {
        return null;
    }

    const post = postData.post;
    const embed = post.embed.external;
    const authorDid = post.author.did;

    const postElement = document.createElement('article');
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

    let descriptionText = embed.description || '';
    if (descriptionText.length > 240) {
        descriptionText = descriptionText.substring(0, 240) + '...';
    }

    let interactionsHTML = '';
    if (post.replyCount > 0 || post.quoteCount > 0) {
        interactionsHTML += `
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
            </div>`;
    } else {
        interactionsHTML += '<div class="post-interactions no-interactions"></div>';
    }

    postElement.innerHTML = `
    <div class="post-external">
      <a href="${embed.uri}" target="_blank" class="post-external-link" title="Click to view the full article">
        <img src="${embed.thumb}" alt="${embed.title}">
        <div class="post-external-content">
          <div class="post-external-title">${embed.title}</div>
          ${descriptionText ? `<p class="post-external-description">${descriptionText}</p>` : ''}
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
    ${interactionsHTML}
  `;

    const postUri = post.uri;
    const [_, didAndRkey] = postUri.split('://');
    const [did, type, rkey] = didAndRkey.split('/');
    const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;

    const copyButton = postElement.querySelector('.post-copy');
    copyButton.addEventListener('click', () => {
        copyToClipboard(postUrl, copyButton);
    });

    const repliesElement = postElement.querySelector('.post-replies');
    if (repliesElement) {
        repliesElement.addEventListener('click', () => {
            window.open(postUrl, '_blank');
        });
    }

    const quotesElement = postElement.querySelector('.post-quotes');
    if (quotesElement) {
        quotesElement.addEventListener('click', () => {
            window.open(`${postUrl}/quotes`, '_blank');
        });
    }

    return postElement;
}

function displayPosts(posts, containerId) {
    const container = document.getElementById(containerId);
    const loadMoreButton = document.getElementById(`load-more-${containerId.split('-')[0]}`);

    if (!container) return;

    // Don't clear existing posts - just append new ones
    posts.forEach(postData => {
        if (postData.post.embed && postData.post.embed.$type === 'app.bsky.embed.external#view') {
            const postElement = createPostElement(postData);
            if (postElement) {
                container.appendChild(postElement);
            }
        }
    });

    // Ensure load more button is visible if we have a cursor
    if (loadMoreButton) {
        loadMoreButton.style.display = 'block';
    }
}

async function loadMorePosts(type) {
    const loadMoreButton = document.getElementById(`load-more-${type}`);
    if (!loadMoreButton) return;

    const limit = 100;
    const cursor = type === 'list' ? listCursor : feedCursor;

    try {
        // Show loading state
        loadMoreButton.disabled = true;
        loadMoreButton.textContent = 'Loading...';

        const data = await fetchPosts(type, limit, cursor);
        if (data.feed && data.feed.length > 0) {
            displayPosts(data.feed, `${type}-posts`);

            // Update cursor for next load
            if (type === 'list') {
                listCursor = data.cursor;
            } else {
                feedCursor = data.cursor;
            }
        }

        // Hide button only if no more posts
        if (!data.cursor) {
            loadMoreButton.style.display = 'none';
        }
    } catch (error) {
        console.error('Error loading more posts:', error);
    } finally {
        // Reset button state
        loadMoreButton.disabled = false;
        loadMoreButton.textContent = 'Load More';
    }
}

function formatTechmemePostText(text, facets) {
    if (!facets) return text;

    let newText = '';
    let lastIndex = 0;

    facets.forEach(facet => {
        const start = facet.index.byteStart;
        const end = facet.index.byteEnd;

        newText += text.substring(lastIndex, start);

        facet.features.forEach(feature => {
            if (feature.$type === 'app.bsky.richtext.facet#link') {
                newText += `<a href="${feature.uri}" target="_blank">${text.substring(start, end)}</a>`;
            } else if (feature.$type === 'app.bsky.richtext.facet#mention') {
                const mentionUrl = `https://bsky.app/profile/${feature.did}`;
                newText += `<a href="${mentionUrl}" target="_blank">${text.substring(start, end)}</a>`;
            } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
                const tagUrl = `https://bsky.app/hashtag/${feature.tag}`;
                newText += `<a href="${tagUrl}" target="_blank">${text.substring(start, end)}</a>`;
            } else {
                newText += text.substring(start, end);
            }
        });

        lastIndex = end;
    });

    newText += text.substring(lastIndex);
    return newText;
}

function createTechmemePostElement(post) {
    const postElement = document.createElement('article');
    postElement.classList.add('techmeme-post');

    const formattedText = formatTechmemePostText(post.post.record.text, post.post.record.facets);

    let interactionsHTML = '';
    if (post.post.replyCount > 0 || post.post.quoteCount > 0) {
        interactionsHTML += `
            <div class="post-interactions">
                ${post.post.replyCount > 0 ? `
                <div class="techmeme-post-replies">
                    <i class="ph-duotone ph-chat-centered-dots"></i>
                    <span>View ${post.post.replyCount} repl${post.post.replyCount === 1 ? 'y' : 'ies'}</span>
                </div>` : ''}
                ${post.post.quoteCount > 0 ? `
                <div class="techmeme-post-quotes">
                    <i class="ph-duotone ph-quotes"></i>
                    <span>View ${post.post.quoteCount} quote${post.post.quoteCount === 1 ? '' : 's'}</span>
                </div>` : ''}
            </div>`;
    } else {
        interactionsHTML += '<div class="post-interactions no-interactions"></div>';
    }

    postElement.innerHTML = `
        <p class="techmeme-post-text">${formattedText}</p>
        <div class="post-meta">
            <div class="techmeme-post-author">
                <a href="https://bsky.app/profile/${post.post.author.did}" target="_blank">
                    <img src="${post.post.author.avatar}" alt="${post.post.author.handle}">
                    <span class="techmeme-post-author-handle">${post.post.author.handle}</span>
                </a>
                <span class="techmeme-post-timestamp"> • ${formatRelativeTime(post.post.record.createdAt)}</span>
            </div>
            <div class="techmeme-post-stats">
                <button class="techmeme-post-likes" aria-label="Like">
                    <i class="ph-duotone ph-heart"></i>
                    <span class="post-count">${post.post.likeCount}</span>
                </button>
                <button class="techmeme-post-reposts" aria-label="Repost">
                    <i class="ph-duotone ph-repeat"></i>
                    <span class="post-count">${post.post.repostCount}</span>
                </button>
                <button class="techmeme-post-copy" title="Copy Post URI">
                    <i class="ph-duotone ph-copy"></i>
                </button>
            </div>
        </div>
        ${interactionsHTML}
    `;

    const postUri = post.post.uri;
    const [_, didAndRkey] = postUri.split('://');
    const [did, type, rkey] = didAndRkey.split('/');

    const copyButton = postElement.querySelector('.techmeme-post-copy');
    copyButton.addEventListener('click', () => {
        const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;
        copyToClipboard(postUrl, copyButton);
    });

    const repliesElement = postElement.querySelector('.techmeme-post-replies');
    if (repliesElement) {
        repliesElement.addEventListener('click', () => {
            const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;
            window.open(postUrl, '_blank');
        });
    }

    const quotesElement = postElement.querySelector('.techmeme-post-quotes');
    if (quotesElement) {
        quotesElement.addEventListener('click', () => {
            const postUrl = `https://bsky.app/profile/${did}/post/${rkey}/quotes`;
            window.open(postUrl, '_blank');
        });
    }

    return postElement;
}

function displayTechmemePosts(posts) {
    const techmemePostsContainer = document.getElementById('techmeme-posts');
    techmemePostsContainer.innerHTML = '';

    posts.forEach(post => {
        const postElement = createTechmemePostElement(post);
        if (postElement) {
            techmemePostsContainer.appendChild(postElement);
        }
    });
}

function createTechCompaniesPostElement(postData) {
    if (!postData.post.embed || postData.post.embed.$type !== 'app.bsky.embed.external#view' || !postData.post.embed.external.thumb) {
        return null;
    }

    const post = postData.post;
    const embed = post.embed.external;
    const authorDid = post.author.did;

    const postElement = document.createElement('article');
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

    let interactionsHTML = '';
    if (post.replyCount > 0 || post.quoteCount > 0) {
        interactionsHTML += `
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
            </div>`;
    } else {
        interactionsHTML += '<div class="post-interactions no-interactions"></div>';
    }

    postElement.innerHTML = `
    <div class="post-external">
      <a href="${embed.uri}" target="_blank" class="post-external-link" title="Click to view the full article">
        <img src="${embed.thumb}" alt="${embed.title}">
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
    ${interactionsHTML}
  `;

    const postUri = post.uri;
    const [_, didAndRkey] = postUri.split('://');
    const [did, type, rkey] = didAndRkey.split('/');

    const copyButton = postElement.querySelector('.post-copy');
    copyButton.addEventListener('click', () => {
        const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;
        copyToClipboard(postUrl, copyButton);
    });

    const repliesElement = postElement.querySelector('.post-replies');
    if (repliesElement) {
        repliesElement.addEventListener('click', () => {
            const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;
            window.open(postUrl, '_blank');
        });
    }

    const quotesElement = postElement.querySelector('.post-quotes');
    if (quotesElement) {
        quotesElement.addEventListener('click', () => {
            const postUrl = `https://bsky.app/profile/${did}/post/${rkey}/quotes`;
            window.open(postUrl, '_blank');
        });
    }

    return postElement;
}

function displayTechCompaniesPosts(posts) {
    const techCompaniesPostsContainer = document.getElementById('tech-companies-posts');
    techCompaniesPostsContainer.innerHTML = '';

    let displayedCount = 0;
    for (const postData of posts) {
        if (displayedCount >= 18) break;
        if (postData.post.embed && postData.post.embed.$type === 'app.bsky.embed.external#view' && postData.post.embed.external.thumb && postData.post.embed.external.uri && postData.post.embed.external.title) {
            const postElement = createTechCompaniesPostElement(postData);
            if (postElement) {
                techCompaniesPostsContainer.appendChild(postElement);
                displayedCount++;
            }
        }
    }
}

function createRecentNewsPostElement(postData) {
    const post = postData.post;

    if (!post.embed || post.embed.$type !== 'app.bsky.embed.external#view' || !post.embed.external || !post.embed.external.title || !post.embed.external.thumb) {
        return null;
    }

    const postElement = document.createElement('article');
    postElement.classList.add('post');

    let descriptionText = post.embed.external.description || '';
    if (descriptionText.length > 240) {
        descriptionText = descriptionText.substring(0, 240) + '...';
    }

    let interactionsHTML = '';
    if (post.replyCount > 0 || post.quoteCount > 0) {
        interactionsHTML += `
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
            </div>`;
    } else {
        interactionsHTML += '<div class="post-interactions no-interactions"></div>';
    }

    postElement.innerHTML = `
        <div class="post-external">
            <a href="${post.embed.external.uri}" target="_blank" class="post-external-link" title="Click to view the full article">
                <img src="${post.embed.external.thumb}" alt="${post.embed.external.title}">
                <div class="post-external-content">
                    <div class="post-external-title">${post.embed.external.title}</div>
                    ${descriptionText ? `<p class="post-external-description">${descriptionText}</p>` : ''}
                </div>
            </a>
        </div>
        <div class="post-meta">
            <div class="post-author-info">
                <a href="https://bsky.app/profile/${post.author.did}" target="_blank" class="post-author-link">
                    <img src="${post.author.avatar}" alt="${post.author.handle}">
                    <span class="post-author-handle">${post.author.handle}</span>
                </a>
                <span class="post-author-timestamp"> • ${formatRelativeTime(post.record.createdAt)}</span>
            </div>
            <div class="post-stats">
                <button class="post-likes" aria-label="Like">
                    <i class="ph-duotone ph-heart"></i>
                    <span class="post-count">${post.likeCount}</span>
                </button>
                <button class="post-reposts" aria-label="Repost">
                    <i class="ph-duotone ph-repeat"></i>
                    <span class="post-count">${post.repostCount}</span>
                </button>
                <button class="post-copy" title="Copy Post URI">
                    <i class="ph-duotone ph-copy"></i>
                </button>
            </div>
        </div>
        ${interactionsHTML}
    `;

    const postUri = post.uri;
    const [_, didAndRkey] = postUri.split('://');
    const [did, type, rkey] = didAndRkey.split('/');
    const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;

    const copyButton = postElement.querySelector('.post-copy');
    copyButton.addEventListener('click', () => {
        copyToClipboard(postUrl, copyButton);
    });

    const repliesElement = postElement.querySelector('.post-replies');
    if (repliesElement) {
        repliesElement.addEventListener('click', () => {
            window.open(postUrl, '_blank');
        });
    }

    const quotesElement = postElement.querySelector('.post-quotes');
    if (quotesElement) {
        quotesElement.addEventListener('click', () => {
            window.open(`${postUrl}/quotes`, '_blank');
        });
    }

    return postElement;
}

function showRecentNewsPosts() {
    const container = document.getElementById('recent-news-posts');
    container.innerHTML = '';

    const start = currentRecentNewsIndex;
    const end = Math.min(start + 3, recentNewsPosts.length);

    for (let i = start; i < end; i++) {
        const postElement = createRecentNewsPostElement(recentNewsPosts[i]);
        if (postElement) {
            container.appendChild(postElement);
        }
    }

    updateRecentNewsNavigation();
}

function updateRecentNewsNavigation() {
    const prevButton = document.getElementById('prev-news');
    const nextButton = document.getElementById('next-news');

    prevButton.style.display = currentRecentNewsIndex > 0 ? 'block' : 'none';

    const hasMorePosts = currentRecentNewsIndex + 3 < recentNewsPosts.length || recentNewsCursor;
    nextButton.style.display = hasMorePosts ? 'block' : 'none';
}

function createSlideElement(post) {
    if (!post.post.embed || post.post.embed.$type !== 'app.bsky.embed.external#view' || !post.post.embed.external) {
        return null;
    }

    const slide = document.createElement('article');
    slide.classList.add('slide');

    const authorDid = post.post.author.did;
    const postUri = post.post.uri;
    const [_, didAndRkey] = postUri.split('://');
    const [did, type, rkey] = didAndRkey.split('/');
    const postUrl = `https://bsky.app/profile/${did}/post/${rkey}`;
    const profileUrl = `https://bsky.app/profile/${authorDid}`;

    let descriptionText = post.post.embed.external.description || '';
    if (descriptionText.length > 240) {
        descriptionText = descriptionText.substring(0, 600) + '...';
    }

    let interactionsHTML = '';
    if (post.post.replyCount > 0 || post.post.quoteCount > 0) {
        interactionsHTML += `
            <div class="slide-interactions">
                ${post.post.replyCount > 0 ? `
                <div class="slide-replies">
                    <i class="ph-duotone ph-chat-centered-dots"></i>
                    <span>View ${post.post.replyCount} repl${post.post.replyCount === 1 ? 'y' : 'ies'}</span>
                </div>` : ''}
                ${post.post.quoteCount > 0 ? `
                <div class="slide-quotes">
                    <i class="ph-duotone ph-quotes"></i>
                    <span>View ${post.post.quoteCount} quote${post.post.quoteCount === 1 ? '' : 's'}</span>
                </div>` : ''}
            </div>`;
    } else {
        interactionsHTML += '<div class="slide-interactions no-interactions"></div>';
    }

    slide.innerHTML = `
        <div class="slide-content">
            <div class="slide-text">
                <div class="slide-author-info">
                    <a href="${profileUrl}" target="_blank">
                        <img src="${post.post.author.avatar}" alt="${post.post.author.handle}" class="slide-author-avatar">
                        <span class="slide-author-handle">${post.post.author.handle}</span>
                    </a>
                    <span class="slide-author-timestamp">${formatForYouDate(post.post.record.createdAt)}</span>
                </div>
                <div class="post-external-content">
                    <a href="${post.post.embed.external.uri}" target="_blank" style="text-decoration: none; color: inherit;" title="Click to view the full article">
                        <div class="post-external-title">${post.post.embed.external.title}</div>
                        ${descriptionText ? `<p class="post-external-description">${descriptionText}</p>` : ''}
                    </a>
                </div>
                <div class="slide-actions">
                    ${post.post.likeCount > 0 ? `
                        <button class="post-likes" aria-label="Like">
                            <i class="ph-duotone ph-heart"></i>
                            <span class="post-count">${post.post.likeCount}</span>
                        </button>
                    ` : ''}
                    ${post.post.repostCount > 0 ? `
                        <button class="post-reposts" aria-label="Repost">
                            <i class="ph-duotone ph-repeat"></i>
                            <span class="post-count">${post.post.repostCount}</span>
                        </button>
                    ` : ''}
                    <button class="post-copy" title="Copy Post URI">
                        <i class="ph-duotone ph-copy"></i>
                    </button>
                </div>
                ${interactionsHTML}
            </div>
            <div class="slide-image">
                <a href="${post.post.embed.external.uri}" target="_blank">
                    <img src="${post.post.embed.external.thumb}" alt="${post.post.embed.external.title}" title="Click to view the full article">
                </a>
            </div>
        </div>
    `;

    const copyButton = slide.querySelector('.post-copy');
    copyButton.addEventListener('click', () => {
        copyToClipboard(postUrl, copyButton);
    });

    const repliesElement = slide.querySelector('.slide-replies');
    if (repliesElement) {
        repliesElement.addEventListener('click', () => {
            window.open(postUrl, '_blank');
        });
    }

    const quotesElement = slide.querySelector('.slide-quotes');
    if (quotesElement) {
        quotesElement.addEventListener('click', () => {
            window.open(`${postUrl}/quotes`, '_blank');
        });
    }

    return slide;
}

function displayForYouPosts(posts) {
    const slideshowContainer = document.querySelector('.slideshow-container');
    const indicatorsContainer = document.querySelector('.slide-indicators');
    slideshowContainer.innerHTML = '';
    indicatorsContainer.innerHTML = '';

    let displayedPosts = 0;

    // Create slides and indicators
    posts.forEach((post, index) => {
        if (displayedPosts >= 5) return;
        if (!post.post.embed || post.post.embed.$type !== 'app.bsky.embed.external#view') return;

        const slide = createSlideElement(post);
        if (!slide) return;

        slideshowContainer.appendChild(slide);

        // Create and setup indicator
        const indicator = document.createElement('div');
        indicator.classList.add('indicator');
        indicator.setAttribute('data-index', displayedPosts);
        indicator.onclick = () => showSlide(parseInt(indicator.dataset.index));
        indicatorsContainer.appendChild(indicator);

        displayedPosts++;
    });

    // Initialize slideshow
    if (displayedPosts > 0) {
        currentSlideIndex = 0;
        showSlide(0);
        clearInterval(slideInterval);
        slideInterval = setInterval(nextSlide, 4500);
    }
}

// Remove this as it creates duplicate intervals
// setInterval(nextSlide, 4500);

// Clean up before page unload
window.addEventListener('beforeunload', () => {
    if (slideInterval) {
        clearInterval(slideInterval);
    }
});

let slideInterval;
let currentSlideIndex = 0;

function showSlide(index) {
    const slides = document.querySelectorAll('.slide');
    const indicators = document.querySelectorAll('.slide-indicators .indicator');

    if (slides.length === 0) return;

    // Reset index if out of bounds
    if (index >= slides.length) {
        index = 0;
    } else if (index < 0) {
        index = slides.length - 1;
    }

    currentSlideIndex = index;

    // Update active states
    slides.forEach(slide => slide.classList.remove('active'));
    indicators.forEach(indicator => indicator.classList.remove('active'));

    slides[currentSlideIndex].classList.add('active');
    indicators[currentSlideIndex].classList.add('active');

    // Reset interval
    clearInterval(slideInterval);
    slideInterval = setInterval(nextSlide, 4500);
}

function nextSlide() {
    showSlide(currentSlideIndex + 1);
}

// Automatically advance to the next slide every 4.5 seconds
setInterval(nextSlide, 4500);

function tabClickHandler(event) {
    const tab = event.currentTarget;
    const target = tab.dataset.target;

    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');

    document.getElementById('list').style.display = target === 'list' ? 'block' : 'none';
    document.getElementById('feed').style.display = target === 'feed' ? 'block' : 'none';

    if (target === 'feed' && isFeedLoaded) {
        displayInitialPosts('feed', initialFeedPosts);
    } else if (target === 'list' && isListLoaded) {
        displayInitialPosts('list', initialListPosts);
    }
}

// Remove previous touch event handlers completely

// For hero section slider
document.querySelector('.slideshow-container').addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.querySelector('.slideshow-container').addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;

    const swipeDistanceX = touchEndX - touchStartX;
    const swipeDistanceY = touchEndY - touchStartY;

    const absSwipeX = Math.abs(swipeDistanceX);
    const absSwipeY = Math.abs(swipeDistanceY);

    // Only trigger horizontal slide if swipe is predominantly horizontal
    if (absSwipeX > absSwipeY * 1.5 && absSwipeX > 50) {
        if (swipeDistanceX > 0) {
            showSlide(currentSlideIndex - 1);
        } else {
            showSlide(currentSlideIndex + 1);
        }
    }
    // Otherwise, do nothing and allow natural scrolling
}, { passive: true });

// For recent news slider 
document.querySelector('.recent-news-container').addEventListener('touchstart', e => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
}, { passive: true });

document.querySelector('.recent-news-container').addEventListener('touchend', e => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;

    const swipeDistanceX = touchEndX - touchStartX;
    const swipeDistanceY = touchEndY - touchStartY;

    const absSwipeX = Math.abs(swipeDistanceX);
    const absSwipeY = Math.abs(swipeDistanceY);

    // Only trigger horizontal navigation if swipe is predominantly horizontal
    if (absSwipeX > absSwipeY * 1.5 && absSwipeX > 50) {
        if (swipeDistanceX > 0) {
            // Swipe right (previous posts)
            if (currentRecentNewsIndex > 0) {
                currentRecentNewsIndex = Math.max(0, currentRecentNewsIndex - 3);
                showRecentNewsPosts();
            }
        } else {
            // Swipe left (next posts)
            if (currentRecentNewsIndex + 3 < recentNewsPosts.length) {
                currentRecentNewsIndex += 3;
                showRecentNewsPosts();
            }
        }
    }
    // Otherwise, do nothing and allow natural scrolling
}, { passive: true });