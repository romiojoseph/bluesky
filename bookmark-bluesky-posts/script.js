document.addEventListener('DOMContentLoaded', () => {
    const csvFilePath = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRg5zI0SQ4jW9CD9NyGaSH0pGpwvsaCqWlhqwkeVxFNbW9nfcMcYPe8OhA1q9IJmWzdB21nny6gkVgs/pub?gid=1204339509&single=true&output=csv';
    const feedContainer = document.getElementById('feed');
    const filtersContainer = document.querySelector('.filters');
    const sortSelect = document.getElementById('sort-select');
    const searchInput = document.getElementById('search-input');

    let jsonData = [];
    let currentCategory = null;

    // Show loading screen initially
    showLoadingScreen();

    // Fetch and parse the CSV
    fetch(csvFilePath)
        .then(response => response.text())
        .then(csvData => {
            Papa.parse(csvData, {
                header: true,
                dynamicTyping: true,
                complete: function (results) {
                    jsonData = results.data.filter(item => item.Post_Text);
                    setupCategoryFilters([...new Set(jsonData.map(post => post.Category).filter(Boolean))]);
                    renderPosts();

                    // Hide loading screen after rendering posts
                    hideLoadingScreen();
                }
            });
        })
        .catch(error => {
            console.error('Error fetching or parsing CSV:', error);
            hideLoadingScreen(); // Hide loading screen even on error
        });

    // Function to create category filter buttons
    function setupCategoryFilters(categories) {
        filtersContainer.innerHTML = '';

        // Add "All" category
        const allButton = createFilterButton('All', 'all', true);
        filtersContainer.appendChild(allButton);

        // Sort categories alphabetically (case-insensitive)
        categories.sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

        // Add other categories
        categories.forEach(category => {
            const button = createFilterButton(category, category, false);
            filtersContainer.appendChild(button);
        });
    }

    // Function to create a single filter button
    function createFilterButton(text, filter, isActive) {
        const button = document.createElement('button');
        button.textContent = text;
        button.dataset.filter = filter;
        if (isActive) {
            button.classList.add('active');
        }
        button.addEventListener('click', () => {
            currentCategory = filter === 'all' ? null : filter;
            filtersContainer.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            renderPosts();
        });
        return button;
    }

    // Function to sort and display posts
    function renderPosts() {
        let filteredPosts = jsonData;

        // Filter by category
        if (currentCategory) {
            filteredPosts = filteredPosts.filter(post => post.Category === currentCategory);
        }

        // Filter by search query
        const searchQuery = searchInput.value.toLowerCase();
        if (searchQuery) {
            filteredPosts = filteredPosts.filter(post => {
                const searchableFields = [
                    'Post_Text', 'Author_DisplayName', 'Author_Handle',
                    'Category', 'Links', 'Embed_Title', 'Embed_Description'
                ];
                return searchableFields.some(field => post[field] && post[field].toLowerCase().includes(searchQuery));
            });
        }

        // Sort posts
        const sortType = sortSelect.value;
        filteredPosts = sortPosts(filteredPosts, sortType);

        // Display posts
        feedContainer.innerHTML = '';
        filteredPosts.forEach(post => {
            const postElement = createPostElement(post);
            if (postElement) feedContainer.appendChild(postElement);
        });
    }

    // Function to sort posts
    function sortPosts(posts, sortType) {
        const sorted = [...posts];
        switch (sortType) {
            case 'random':
                return sorted.sort(() => 0.5 - Math.random());
            case 'post-created-desc':
                return sorted.sort((a, b) => new Date(b.Post_CreatedAt) - new Date(a.Post_CreatedAt));
            case 'post-created-asc':
                return sorted.sort((a, b) => new Date(a.Post_CreatedAt) - new Date(b.Post_CreatedAt));
            case 'saved-desc':
                return sorted.sort((a, b) => new Date(b.saved_at) - new Date(a.saved_at));
            case 'saved-asc':
                return sorted.sort((a, b) => new Date(a.saved_at) - new Date(b.saved_at));
            default:
                return sorted;
        }
    }

    // Function to create a post element
    function createPostElement(post) {
        const postElement = document.createElement('div');
        postElement.classList.add('post');

        // Construct post tag
        const postTag = document.createElement('div');
        postTag.classList.add('post-tag');
        const icon = document.createElement('i');
        icon.classList.add('ph-duotone', 'ph-folder-simple');
        const timeAgo = formatRelativeTime(post.saved_at);
        postTag.innerHTML = `at://`;
        postTag.appendChild(icon);
        postTag.innerHTML += ` ${post.Category} • Saved ${timeAgo} ago`;
        postTag.title = 'Click to copy post data';
        postTag.addEventListener('click', () => {
            copyPostDataToClipboard(post);
        });

        postElement.appendChild(postTag);

        // Construct post header
        const postHeader = document.createElement('div');
        postHeader.classList.add('post-header');

        // Post header left
        const postHeaderLeft = document.createElement('div');
        postHeaderLeft.classList.add('post-header-left');
        const authorLink = document.createElement('a');
        authorLink.href = `https://bsky.app/profile/${post.Author_DID}`;
        authorLink.target = '_blank';
        authorLink.title = 'Click to view the author profile';
        authorLink.rel = 'noopener noreferrer';

        const authorAvatar = document.createElement('img');
        authorAvatar.src = post.Author_Avatar || './assets/avatar.svg';
        authorAvatar.alt = `${post.Author_DisplayName} avatar`;
        authorAvatar.onerror = () => { authorAvatar.src = './assets/avatar.svg'; };
        authorLink.appendChild(authorAvatar);

        const authorInfo = document.createElement('div');
        authorInfo.classList.add('post-author-info');
        const authorDisplayName = document.createElement('span');
        authorDisplayName.classList.add('author-display-name');
        authorDisplayName.textContent = post.Author_DisplayName || 'Author display name';
        authorInfo.appendChild(authorDisplayName);

        const authorHandle = document.createElement('span');
        authorHandle.classList.add('author-handle');
        authorHandle.textContent = `@${post.Author_Handle}`;
        authorInfo.appendChild(authorHandle);

        authorLink.appendChild(authorInfo);
        postHeaderLeft.appendChild(authorLink);
        postHeader.appendChild(postHeaderLeft);

        // Post header right
        const postHeaderRight = document.createElement('div');
        postHeaderRight.classList.add('post-header-right');
        const postLink = document.createElement('a');
        postLink.href = post.Post_Link;
        postLink.target = '_blank';
        postLink.title = 'Click to view the post on Bluesky';
        postLink.rel = 'noopener noreferrer';
        postLink.innerHTML = '<i class="ph-duotone ph-arrow-up-right"></i>';
        postHeaderRight.appendChild(postLink);
        postHeader.appendChild(postHeaderRight);

        postElement.appendChild(postHeader);

        // Construct post content
        const postContent = document.createElement('div');
        postContent.classList.add('post-content');

        // Add Embed_Type text with icon
        if (post.Embed_Type === 'app.bsky.embed.record#view') {
            const embedTypeMention = document.createElement('p');
            embedTypeMention.classList.add('embed-type-mention');
            embedTypeMention.innerHTML = `<i class="ph-duotone ph-info"></i> <a href="${post.Post_Link}" target="_blank">This post is a response. Check the original for context.</a>`;
            postContent.appendChild(embedTypeMention);
        }

        const postText = document.createElement('p');
        postText.innerHTML = processPostText(post.Post_Text, post.Mentions); // Use innerHTML to render links
        postContent.appendChild(postText);

        // Add links if available
        if (post.Links) {
            const linksContainer = document.createElement('div');
            linksContainer.classList.add('post-links');
            const links = post.Links.split('|');
            links.forEach(link => {
                const linkElement = document.createElement('a');
                linkElement.href = link;
                linkElement.target = '_blank';
                linkElement.rel = 'noopener noreferrer';
                linkElement.textContent = link;
                linksContainer.appendChild(linkElement);
            });
            postContent.appendChild(linksContainer);
        }

        // Add media if available
        const mediaURLs = post.Media_URLs ? post.Media_URLs.split('|') : [];
        const videoPlaylist = post.Video_Playlist;

        if (mediaURLs.length > 0 || videoPlaylist) {
            checkMediaAccessible(mediaURLs, videoPlaylist)
                .then(isAccessible => {
                    if (isAccessible) {
                        if (mediaURLs.length > 0) {
                            postContent.appendChild(createMediaElement(mediaURLs, post.Media_Alt_Texts));
                        } else if (videoPlaylist) {
                            postContent.appendChild(createVideoElement(videoPlaylist, post.Video_Aspect_Ratio_Height));
                        }
                    } else {
                        postContent.appendChild(createMediaAlert(post.Post_Link));
                    }
                });
        }

        // Add embed if available
        if (post.Embed_URL) {
            postContent.appendChild(createEmbedElement(post));
        }

        postElement.appendChild(postContent);

        // Construct post footer
        const postFooter = document.createElement('div');
        postFooter.classList.add('post-footer');

        // Post footer top (repost, quote, like)
        const postFooterTop = document.createElement('div');
        postFooterTop.classList.add('post-footer-top');

        if (post.Repost_Count > 0) {
            const reposts = document.createElement('div');
            const repostCount = formatNumberWithCommas(post.Repost_Count);
            reposts.innerHTML = `<i class="ph-duotone ph-arrows-clockwise"></i> <span>${repostCount} ${repostCount === '1' ? 'repost' : 'reposts'}</span>`;
            postFooterTop.appendChild(reposts);
        }

        if (post.Quote_Count > 0) {
            const quotes = document.createElement('div');
            const quoteCount = formatNumberWithCommas(post.Quote_Count);
            quotes.innerHTML = `<i class="ph-duotone ph-quotes"></i> <span>${quoteCount} ${quoteCount === '1' ? 'quote' : 'quotes'}</span>`;
            postFooterTop.appendChild(quotes);
        }

        if (post.Like_Count > 0) {
            const likes = document.createElement('div');
            const likeCount = formatNumberWithCommas(post.Like_Count);
            likes.innerHTML = `<i class="ph-duotone ph-heart"></i> <span>${likeCount} ${likeCount === '1' ? 'like' : 'likes'}</span>`;
            postFooterTop.appendChild(likes);
        }

        // Check if post-footer-top is empty and remove it if it is
        if (postFooterTop.children.length > 0) {
            postFooter.appendChild(postFooterTop); // Only append if not empty
        }

        // Post footer middle (reply)
        const postFooterMiddle = document.createElement('div');
        postFooterMiddle.classList.add('post-footer-middle');

        const replies = document.createElement('a');
        replies.href = post.Post_Link;
        replies.target = '_blank';
        replies.title = 'Click to view the post comments on Bluesky';
        replies.rel = 'noopener noreferrer';
        replies.textContent = post.Reply_Count > 0 ? `View ${formatNumberWithCommas(post.Reply_Count)} ${post.Reply_Count === 1 ? 'reply' : 'replies'}` : 'No replies';
        postFooterMiddle.appendChild(replies);

        postFooter.appendChild(postFooterMiddle);

        // Post footer bottom (timestamp, copy URL)
        const postFooterBottom = document.createElement('div');
        postFooterBottom.classList.add('post-footer-bottom');

        const postDate = document.createElement('span');
        postDate.textContent = formatDateTime(post.Post_CreatedAt);
        postFooterBottom.appendChild(postDate);

        const copyUrlButton = document.createElement('button');
        copyUrlButton.classList.add('copy-url-button');
        copyUrlButton.innerHTML = '<i class="ph-duotone ph-share-fat"></i> <span>Share</span>';
        copyUrlButton.title = 'Copy post URL';
        copyUrlButton.addEventListener('click', () => {
            copyToClipboard(post.Post_Link);
            alert('Post URL copied to clipboard!');
        });
        postFooterBottom.appendChild(copyUrlButton);

        postFooter.appendChild(postFooterBottom);
        postElement.appendChild(postFooter);

        return postElement;
    }

    function formatNumberWithCommas(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function createMediaAlert(postLink) {
        const alertElement = document.createElement('div');
        alertElement.classList.add('post-media-alert');
        alertElement.textContent = 'Like media not available, check at the original post on Bluesky';

        const viewPostButton = document.createElement('a');
        viewPostButton.href = postLink;
        viewPostButton.target = '_blank';
        viewPostButton.rel = 'noopener noreferrer';
        viewPostButton.textContent = 'View Post';
        viewPostButton.style.marginLeft = '10px';

        alertElement.appendChild(viewPostButton);
        return alertElement;
    }

    function checkMediaAccessible(mediaURLs, videoPlaylist) {
        return new Promise(resolve => {
            if (mediaURLs.length > 0) {
                const img = new Image();
                img.onload = () => resolve(true);
                img.onerror = () => resolve(false);
                img.src = mediaURLs[0];
            } else if (videoPlaylist) {
                fetch(videoPlaylist)
                    .then(response => resolve(response.ok))
                    .catch(() => resolve(false));
            } else {
                resolve(true);
            }
        });
    }

    // Function to create embed element
    function createEmbedElement(post) {
        const embedElement = document.createElement('a');
        embedElement.href = post.Embed_URL;
        embedElement.target = '_blank';
        embedElement.rel = 'noopener noreferrer';
        embedElement.classList.add('post-embed');

        const embedContent = document.createElement('div');
        embedContent.classList.add('post-embed-content');

        const embedTitle = document.createElement('h4');
        embedTitle.textContent = post.Embed_Title;
        embedContent.appendChild(embedTitle);

        const embedDescription = document.createElement('p');
        embedDescription.textContent = post.Embed_Description;
        embedContent.appendChild(embedDescription);
        embedElement.appendChild(embedContent);

        if (post.Embed_Thumb) {
            const embedThumb = document.createElement('img');
            embedThumb.classList.add('post-embed-thumb');
            embedThumb.src = post.Embed_Thumb;
            embedThumb.alt = 'Embed thumbnail';
            embedElement.appendChild(embedThumb);
        }

        return embedElement;
    }

    // Function to format post text with links
    function processPostText(text, mentions) {
        if (!text) return '';

        // Process mentions
        if (mentions) {
            const mentionsList = mentions.split('|');
            mentionsList.forEach(mention => {
                const regex = new RegExp(`@([\\w.-]+)`, 'g');
                text = text.replace(regex, (match, handle) => {
                    return `<a href="https://bsky.app/profile/${mention}" target="_blank" rel="noopener">@${handle}</a>`;
                });
            });
        }

        // Process hashtags
        text = text.replace(/#(\w+)/g, '<a href="https://bsky.app/hashtag/$1" target="_blank" rel="noopener">#$1</a>');

        return text;
    }

    // Function to create media element (image or carousel)
    function createMediaElement(mediaURLs, mediaAlts) {
        const mediaAltsArray = mediaAlts ? mediaAlts.split('|') : [];
        const mediaContainer = document.createElement('div');
        mediaContainer.classList.add('post-media', 'carousel');

        const inner = document.createElement('div');
        inner.classList.add('carousel-inner');
        mediaContainer.appendChild(inner);

        mediaURLs.forEach((url, index) => {
            const item = document.createElement('div');
            item.classList.add('carousel-item');

            const img = document.createElement('img');
            img.src = url;
            img.alt = mediaAltsArray[index] || 'Post media';
            img.addEventListener('click', () => window.open(url, '_blank'));
            item.appendChild(img);

            inner.appendChild(item);
        });

        if (mediaURLs.length > 1) {
            const nav = document.createElement('div');
            nav.classList.add('carousel-nav');
            mediaContainer.appendChild(nav);

            let current = 0;
            let intervalId = null;

            const updateNav = () => {
                nav.innerHTML = '';
                mediaURLs.forEach((_, i) => {
                    const dot = document.createElement('div');
                    dot.classList.add('carousel-dot');
                    if (i === current) dot.classList.add('active');
                    dot.addEventListener('click', () => {
                        current = i;
                        updateSlide();
                        updateNav();
                        resetInterval();
                    });
                    nav.appendChild(dot);
                });
            };

            const updateSlide = () => {
                const width = inner.children[0].offsetWidth;
                inner.style.transform = `translateX(-${width * current}px)`;
            };

            const nextSlide = () => {
                current = (current + 1) % mediaURLs.length;
                updateSlide();
                updateNav();
            };

            const prevSlide = () => {
                current = (current - 1 + mediaURLs.length) % mediaURLs.length;
                updateSlide();
                updateNav();
            };

            const startInterval = () => {
                intervalId = setInterval(nextSlide, 4000); // Change slide every 4 seconds
            };

            const resetInterval = () => {
                clearInterval(intervalId);
                startInterval();
            };

            // Previous and next buttons
            const prevButton = document.createElement('button');
            prevButton.classList.add('carousel-prev');
            prevButton.innerHTML = '<i class="ph-duotone ph-caret-left"></i>';
            prevButton.addEventListener('click', () => {
                prevSlide();
                resetInterval();
            });

            const nextButton = document.createElement('button');
            nextButton.classList.add('carousel-next');
            nextButton.innerHTML = '<i class="ph-duotone ph-caret-right"></i>';
            nextButton.addEventListener('click', () => {
                nextSlide();
                resetInterval();
            });

            mediaContainer.appendChild(prevButton);
            mediaContainer.appendChild(nextButton);

            updateNav();
            updateSlide();
            startInterval();

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
                    if (diff > 0) {
                        nextSlide();
                    } else {
                        prevSlide();
                    }
                    resetInterval();
                } else {
                    updateSlide(); // Snap back to the current slide
                }

                startX = null;
                currentX = null;
            };

            inner.addEventListener('touchstart', handleTouchStart);
            inner.addEventListener('touchmove', handleTouchMove);
            inner.addEventListener('touchend', handleTouchEnd);
        }

        return mediaContainer;
    }

    // Function to create video element
    function createVideoElement(videoPlaylist, aspectRatioHeight) {
        const videoContainer = document.createElement('div');
        videoContainer.classList.add('post-media');

        const video = document.createElement('video');
        video.controls = true;
        video.style.maxHeight = aspectRatioHeight ? `${aspectRatioHeight}px` : 'auto';
        videoContainer.appendChild(video);

        if (Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(videoPlaylist);
            hls.attachMedia(video);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = videoPlaylist;
        }

        return videoContainer;
    }

    // Function to format date
    function formatDateTime(dateString) {
        const date = new Date(dateString);
        const options = { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true };
        return date.toLocaleDateString('en-US', options);
    }

    // Function to calculate time since
    function formatRelativeTime(dateString) {
        const now = new Date();
        const seconds = Math.round((now - new Date(dateString)) / 1000);
        const minutes = Math.round(seconds / 60);
        const hours = Math.round(minutes / 60);
        const days = Math.round(hours / 24);
        const weeks = Math.round(days / 7);
        const months = Math.round(days / 30);
        const years = Math.round(days / 365);

        if (seconds < 60) return seconds + "s";
        if (minutes < 60) return minutes + "m";
        if (hours < 24) return hours + "h";
        if (days < 7) return days + "d";
        if (weeks < 4) return weeks + "wk";
        if (months < 12) return months + "mo";
        if (years >= 1) {
            // Handle year display: remove trailing ".0" if it's a whole number
            return (years === Math.floor(years)) ? years + "yr" : years.toFixed(1) + "yr";
        }
    }

    // Function to copy to clipboard
    function copyToClipboard(text) {
        // Create a temporary textarea
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = text;
        document.body.appendChild(tempTextArea);

        // Select and copy the text
        tempTextArea.select();
        document.execCommand('copy');

        // Remove the temporary textarea
        document.body.removeChild(tempTextArea);
    }

    function copyPostDataToClipboard(post) {
        const postData = JSON.stringify(post, null, 2);

        // Create a temporary textarea to copy from (for mobile compatibility)
        const tempTextArea = document.createElement('textarea');
        tempTextArea.value = postData;
        document.body.appendChild(tempTextArea);

        // Select and copy the text
        tempTextArea.select();
        document.execCommand('copy');

        // Remove the temporary textarea
        document.body.removeChild(tempTextArea);

        // Alert the user (you might want to use a more subtle notification)
        alert('Post data copied to clipboard!');
    }

    // Event listener for sort select
    sortSelect.addEventListener('change', renderPosts);

    // Event listener for search input
    searchInput.addEventListener('input', renderPosts);

    // Function to show the loading screen
    function showLoadingScreen() {
        document.body.classList.add('loading');
        document.getElementById('loading-screen').style.display = 'flex';
    }

    // Function to hide the loading screen
    function hideLoadingScreen() {
        document.body.classList.remove('loading');
        document.getElementById('loading-screen').style.display = 'none';
    }
});