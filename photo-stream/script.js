async function loadPosts() {
    const response = await fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vRwfcG_jQxcPgi9RFABBlm1o6EEJlCkJc9ObU39IlchdY3Jgp7YqT9n0QBwsuk_BHwbbCj2SRWM1_IN/pub?gid=1248501869&single=true&output=csv');
    const csvText = await response.text();
    const posts = parseCSV(csvText);
    const container = document.getElementById('posts-container');

    posts
        .filter(post => post.Has_Media === 'TRUE' && (!post.Labels || post.Labels.trim() === ''))
        .forEach(post => {
            container.appendChild(createPostElement(post));
        });
}

function parseCSV(csv) {
    const lines = csv.split('\n');
    const headers = lines[0].split(',').map(header => header.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index]?.trim() || '';
            return obj;
        }, {});
    });
}

function createPostElement(post) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';

    // Header
    postCard.innerHTML = `
        <div class="post-header">
            <div class="author-info" onclick="openAuthorProfile('${post.Author_Handle}')">
                <img src="${post.Author_Avatar}" alt="" class="author-avatar">
                <div class="author-details">
                    <div class="author-name">${post.Author_DisplayName || 'Author profile name'}</div>
                    <div class="author-handle">@${post.Author_Handle}</div>
                </div>
            </div>
            <div class="post-time">${formatTimestamp(post.Post_CreatedAt)}</div>
        </div>
    `;

    // Media Carousel
    const mediaUrls = post.Media_URLs.split('|').filter(url => url); // Filter out empty URLs
    if (mediaUrls.length > 0) {
        const carousel = createCarousel(mediaUrls);
        postCard.appendChild(carousel);
    }

    // Actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'post-actions';

    // Left side actions
    const leftActionsDiv = document.createElement('div');
    leftActionsDiv.className = 'left-actions';

    let leftActionsHTML = `
        <button class="action-btn" title="Like this post on Bluesky" onclick="window.open('${post.Post_Link}', '_blank')">
            <i class="ph-duotone ph-heart"></i>
        </button>
        <button class="action-btn" title="Quote or repost this on Bluesky" onclick="window.open('${post.Post_Link}', '_blank')">
            <i class="ph-duotone ph-repeat"></i>
            ${parseInt(post.Repost_Count) > 0 ? `<span>${formatNumber(post.Repost_Count)}</span>` : ''}
        </button>
        <button class="action-btn" title="Add a comment to this post on Bluesky" onclick="window.open('${post.Post_Link}', '_blank')">
            <i class="ph-duotone ph-chat-centered"></i>
            ${parseInt(post.Reply_Count) > 0 ? `<span>${formatNumber(post.Reply_Count)}</span>` : ''}
        </button>
    `;

    leftActionsDiv.innerHTML = leftActionsHTML;

    // Right side actions
    const rightActionsDiv = document.createElement('div');
    rightActionsDiv.className = 'right-actions';
    rightActionsDiv.innerHTML = `
        <button class="action-btn" title="Copy original Bluesky post link" onclick="copyToClipboard('${post.Post_Link}')">
            <i class="ph-duotone ph-copy-simple"></i>
        </button>
        <button class="action-btn" title="View original post on Bluesky" onclick="window.open('${post.Post_Link}', '_blank')">
            <i class="ph-duotone ph-share-fat"></i>
        </button>
    `;

    actionsDiv.appendChild(leftActionsDiv);
    actionsDiv.appendChild(rightActionsDiv);
    postCard.appendChild(actionsDiv);

    // Likes count
    if (parseInt(post.Like_Count) > 0) {
        const likesDiv = document.createElement('div');
        likesDiv.className = 'likes-count';
        const likeCount = formatNumber(post.Like_Count);
        likesDiv.textContent = `Liked by ${likeCount} ${likeCount === '1' ? 'person' : 'people'}`;
        postCard.appendChild(likesDiv);
    }

    // Post text
    if (post.Post_Text) {
        const formattedText = formatPostText(post.Post_Text);
        const textDiv = document.createElement('div');
        textDiv.className = 'post-text';

        if (formattedText.length > 140) {
            textDiv.classList.add('truncated');
            textDiv.innerHTML = `${formattedText.substring(0, 160)}...`;
            textDiv.addEventListener('click', () => {
                textDiv.innerHTML = formattedText;
                textDiv.classList.remove('truncated');
            });
        } else {
            textDiv.innerHTML = formattedText;
        }
        postCard.appendChild(textDiv);

        // Add links button if there are any links
        const links = post.Links ? post.Links.split('|').filter(link => link) : [];
        if (links.length > 0) {
            const linksDiv = document.createElement('div');
            linksDiv.className = 'links-button';
            linksDiv.innerHTML = links.map(link => {
                const displayText = link.length > 18 ? `${link.substring(0, 18)}...` : link;
                return `
                    <button class="post-btn" onclick="window.open('${link}', '_blank')">
                        <i class="ph-duotone ph-link"></i>
                        ${displayText}
                    </button>
                `;
            }).join('');
            postCard.appendChild(linksDiv);
        }
    }

    // Comments link
    if (parseInt(post.Reply_Count) > 0) {
        const commentsDiv = document.createElement('div');
        commentsDiv.className = 'comments-link';
        commentsDiv.textContent = `View all ${formatNumber(post.Reply_Count)} comments`;
        commentsDiv.onclick = () => window.open(post.Post_Link, '_blank');
        postCard.appendChild(commentsDiv);
    }

    return postCard;
}

function createCarousel(images) {
    const carousel = document.createElement('div');
    carousel.classList.add('carousel');

    const inner = document.createElement('div');
    inner.classList.add('carousel-inner');
    carousel.appendChild(inner);

    images.forEach(image => {
        const item = document.createElement('div');
        item.classList.add('carousel-item');

        const img = document.createElement('img');
        img.src = image;
        img.onclick = () => window.open(image, '_blank');
        item.appendChild(img);

        inner.appendChild(item);
    });

    if (images.length > 1) {
        const nav = document.createElement('div');
        nav.classList.add('carousel-nav');
        carousel.appendChild(nav);

        let current = 0;

        const updateNav = () => {
            nav.innerHTML = '';
            images.forEach((_, i) => {
                const dot = document.createElement('div');
                dot.classList.add('carousel-dot');
                if (i === current) dot.classList.add('active');
                dot.addEventListener('click', () => {
                    current = i;
                    updateSlide();
                    updateNav();
                });
                nav.appendChild(dot);
            });
        };

        const updateSlide = () => {
            const width = inner.children[0].offsetWidth;
            inner.style.transform = `translateX(-${width * current}px)`;
        };

        updateNav();
        updateSlide();

        let startX = null;
        let currentX = null;

        const handleTouchStart = (e) => {
            startX = e.touches[0].clientX;
            currentX = startX;
        };

        const handleTouchMove = (e) => {
            if (!startX) return;
            currentX = e.touches[0].clientX;

            const diff = startX - currentX;
            const currentTransform = -inner.children[0].offsetWidth * current;
            inner.style.transform = `translateX(${currentTransform - diff}px)`;
        };

        const handleTouchEnd = () => {
            if (!startX) return;

            const diff = startX - currentX;
            if (Math.abs(diff) > 50) {
                if (diff > 0 && current < images.length - 1) current++;
                else if (diff < 0 && current > 0) current--;
            }

            startX = null;
            currentX = null;
            updateSlide();
            updateNav();
        };

        inner.addEventListener('touchstart', handleTouchStart);
        inner.addEventListener('touchmove', handleTouchMove);
        inner.addEventListener('touchend', handleTouchEnd);
    }

    return carousel;
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 30) return `${days}d`;
    return '30d+';
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(parseInt(num));
}

function formatPostText(text) {
    // Enhance the URL regex to be a bit more robust (optional)
    const urlRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/g;

    // Process URLs
    let formattedText = text.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank">${url}</a>`;
    });

    // Process mentions (handles)
    formattedText = formattedText.replace(
        /(?:^|[^a-zA-Z0-9])(@[a-zA-Z0-9.-]+)/g,
        (match, handle) => {
            const cleanHandle = handle.substring(1); // Remove @ symbol
            return `${match.charAt(0) === '@' ? '' : match.charAt(0)}<a href="https://bsky.app/profile/${cleanHandle}" target="_blank">${handle}</a>`;
        }
    );

    // Process hashtags
    formattedText = formattedText.replace(
        /(?:^|\s)(#[a-zA-Z0-9_\u0590-\u05ff\u0621-\u064A\u0660-\u0669]+)/g,
        (match, tag) => {
            const cleanTag = tag.substring(1); // Remove # symbol
            return ` <a href="https://bsky.app/hashtag/${cleanTag}" target="_blank">${tag}</a>`;
        }
    );

    return formattedText;
}

function openAuthorProfile(handle) {
    window.open(`https://bsky.app/profile/${handle}`, '_blank');
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert('Bluesky post link copied to clipboard.'); // Alert for successful copy
    } catch (err) {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            alert('Bluesky post link copied to clipboard.'); // Alert for fallback copy
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

function loadCSV() {
    const loadingScreen = document.getElementById('loadingScreen');

    // Check if loadingScreen exists
    if (loadingScreen) {
        // Show the loading screen
        loadingScreen.style.display = 'flex';
    }

    // Simulate CSV loading with a timeout (replace this with your actual loading logic)
    setTimeout(() => {
        // Your CSV loading logic here

        // Hide the loading screen after loading is complete
        if (loadingScreen) {
            loadingScreen.style.display = 'none';
        }
    }, 3000); // Adjust the timeout as needed
}

document.addEventListener('DOMContentLoaded', () => {
    loadCSV(); // Call loadCSV when the DOM is fully loaded
});

document.addEventListener('DOMContentLoaded', loadPosts);

// Get the theme toggle button and the body element
const themeToggle = document.getElementById('theme-toggle');
const body = document.body;
const icon = themeToggle.querySelector('i'); // Get the <i> element inside the button

// Check if a theme is already stored in localStorage
if (localStorage.getItem('theme') === 'light') {
    body.classList.add('light-theme');
    // Change icon to moon (light theme)
    icon.classList.remove('ph-sun-dim');
    icon.classList.add('ph-moon');
}

// Add an event listener to toggle the theme
themeToggle.addEventListener('click', () => {
    body.classList.toggle('light-theme');

    // Change icon based on the theme
    if (body.classList.contains('light-theme')) {
        icon.classList.remove('ph-sun-dim');
        icon.classList.add('ph-moon');
        localStorage.setItem('theme', 'light');
    } else {
        icon.classList.remove('ph-moon');
        icon.classList.add('ph-sun-dim');
        localStorage.removeItem('theme');
    }
});
