// Configuration object for feeds
const FEEDS_CONFIG = {
    'Recent News': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=2142138896&single=true&output=csv',
        description: 'Curated from a list of news channel profiles. Posts are listed as they happen, reflecting key stories and events from across the globe.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/lists/3lc34yoopje27' // Replace with actual link
        }
    },
    'Trending News': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=465458887&single=true&output=csv',
        description: 'Discover trending news. This feed highlights posts over a 12-hour period, sorted by HN ranking. Click the button below for more updates.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/feed/aaahn42hkwvf2' // Replace with actual link
        }
    },
    'Explore': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=646667344&single=true&output=csv',
        description: 'Explore a variety of topics. This is an experimental feed where the types of posts may change frequently, offering a dynamic range of content.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/feed/aaacozc6mirtg' // Replace with actual link
        }
    },
    'What\'s hot': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=1047482805&single=true&output=csv',
        description: 'The original What\'s Hot experience. A feed from the Bluesky team.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/did:plc:z72i7hdynmk6r22z27h6tvur/feed/hot-classic' // Replace with actual link
        }
    },
    'Design': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=1824522149&single=true&output=csv',
        description: 'Product Design feed is currently a work in progress. Keywords: UX, UI, IA, IXD, User Experience, Accessibility, Usability, User Research.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/did:plc:5s4i5j2qyvyljav4zbdqhbn6/feed/aaaoc3nh4yxdu' // Replace with actual link
        }
    },
    'Web Development': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=1562404818&single=true&output=csv',
        description: 'Trending web dev topics on bsky. Want to improve it? Post at @hipstsersmoothie.com',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/did:plc:m2sjv3wncvsasdapla35hzwj/feed/web-development' // Replace with actual link
        }
    },
    'Developers': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=1011755847&single=true&output=csv',
        description: 'The developer feed from a dev @ Bluesky.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/did:plc:vpkhqolt662uhesyj6nxm7ys/feed/devfeed' // Replace with actual link
        }
    },
    'Science': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=1035358678&single=true&output=csv',
        description: 'The Science Feed. A curated feed from Bluesky professional scientists,  science communicators, and science/nature photographer/artists.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/did:plc:jfhpnnst6flqway4eaeqzj2a/feed/for-science' // Replace with actual link
        }
    },
    'Astronomy': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=1346687394&single=true&output=csv',
        description: 'A feed dedicated to space and astronomy. View  the latest discoveries, missions, and the wonders of the cosmos. Experimental!',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/feed/aaaoy5eufdxdo' // Replace with actual link
        }
    },
    'Trending': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=90197611&single=true&output=csv',
        description: 'Experimental feed with all kind of trending posts.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/feed/aaacormvemkfc' // Replace with actual link
        }
    },
    'Trending Images': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=1695603701&single=true&output=csv',
        description: 'You can create an Instagram-like feed using Bluesky. The key is finding a good algorithm that works. Currently, it\'s based on HN ranking.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/feed/aaadhst6s4epy' // Replace with actual link
        }
    },
    'Trending Links': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=696684800&single=true&output=csv',
        description: 'Experimental trending links feed from a dev @ Bluesky.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/did:plc:vpkhqolt662uhesyj6nxm7ys/feed/links' // Replace with actual link
        }
    },
    'Tech': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=23143452&single=true&output=csv',
        description: 'This feed comes from accounts related to tech. As more platforms join Bluesky, it will become a great space for tech discussions and udpates.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/feed/aaanqiwe5dvuu' // Replace with actual link
        }
    },
    'Bluesky Team': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=15359710&single=true&output=csv',
        description: 'I\'m a big fan of the Bluesky platform, especially its openness. Here, you can explore posts from the Bluesky team, curated based on HN ranking.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/feed/aaadaaed7mwec' // Replace with actual link
        }
    },
    'Movies': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=899516637&single=true&output=csv',
        description: 'A place to talk about movies and tv shows. Use hashtags #movie, #series, #filmsky, #tvshow or #documentary to get featured.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/feed/MoviesTVShows' // Replace with actual link
        }
    },
    'Philosophy': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=1375892508&single=true&output=csv',
        description: 'A broad and inclusive feed for academic philosophy on Bluesky. Tag posts with #philosophy, #PhilSky to include them in this feed.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/did:plc:3bybp6nqszlhuan2ch2cmv66/feed/philosophy' // Replace with actual link
        }
    },
    'Popular Profiles': {
        file: 'https://docs.google.com/spreadsheets/d/e/2PACX-1vSF3otwh0UsCKmq7NoSJklY9TByh-pg5LQZz_CHN_ZZeyZqP5xqbgvjJFYrYOsGj3YkMyAh7YDENdw7/pub?gid=1430454736&single=true&output=csv',
        description: 'There are many celebrities and well-known figures on Bluesky. Find posts from them here, in the order they are shared, with no algorithm involved.',
        button: {
            label: 'Add to your feeds',
            link: 'https://bsky.app/profile/romiojoseph.github.io/lists/3leviuxqxer2s' // Replace with actual link
        }
    }
};

let currentFeed = Object.keys(FEEDS_CONFIG)[0];

const feedCache = {}; // Cache object to store fetched data
const UPDATE_INTERVAL = 4 * 60 * 60 * 1000; // Update interval in milliseconds (4 hours)

function showLoadingScreen() {
    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loadingScreen';
    loadingScreen.innerHTML = `
        <div class="loader"></div>
        <p>Checking for new posts. Just a moment...</p>
    `;
    document.body.appendChild(loadingScreen);
}

function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    if (loadingScreen) {
        loadingScreen.remove();
    }
}

async function fetchCSV(filename) {
    try {
        // Use & instead of ? for the cache buster since URL already has parameters
        const cacheBuster = `&t=${new Date().getTime()}`;
        const response = await fetch(filename + cacheBuster);
        const csvData = await response.text();
        return Papa.parse(csvData, {
            header: true,
            skipEmptyLines: true
        }).data;
    } catch (error) {
        console.error(`Error loading CSV ${filename}:`, error);
        return [];
    }
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    }) + ' • ' + date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
}

function formatPostText(text, mentions) {
    // Handle hashtags
    let formattedText = text.replace(/#(\w+)/g, (match, tag) => {
        return `<a href="https://bsky.app/hashtag/${tag}" target="_blank" class="post-link hashtag">#${tag}</a>`;
    });

    // Handle mentions
    if (mentions) {
        const mentionDIDs = mentions.split('|');
        let didIndex = 0;

        formattedText = formattedText.replace(/@([\w.-]+)/g, (match, username) => {
            if (didIndex < mentionDIDs.length) {
                const did = mentionDIDs[didIndex].trim();
                didIndex++;
                return `<a href="https://bsky.app/profile/${did}" target="_blank" class="post-link mention">${match}</a>`;
            }
            return match; // If no more DIDs, return the original match
        });
    }

    // Handle regular URLs
    formattedText = formattedText.replace(/(https?:\/\/[^\s]+)/g, (url) => {
        if (!url.endsWith('"') && !url.includes('</a>')) {
            return `<a href="${url}" target="_blank" class="post-link">${url}</a>`;
        }
        return url;
    });

    return formattedText;
}

function createSlideshow(mediaUrls) {
    const slideshowContainer = document.createElement('div');
    slideshowContainer.className = 'slideshow';

    mediaUrls.forEach((url, index) => {
        const slide = document.createElement('div');
        slide.className = `slide ${index === 0 ? 'active' : ''}`;

        const img = document.createElement('img');
        img.src = url;
        img.className = 'media-image';
        img.title = 'Open image in new tab';
        img.alt = 'Post media';

        // Make single image clickable
        if (mediaUrls.length === 1) {
            slide.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(url, '_blank');
            });
        }

        slide.appendChild(img);
        slideshowContainer.appendChild(slide);
    });

    if (mediaUrls.length > 1) {
        const prevButton = document.createElement('button');
        prevButton.className = 'arrow prev';
        prevButton.innerHTML = '<i class="ph-duotone ph-caret-left"></i>';
        prevButton.setAttribute('aria-label', 'Previous');

        const nextButton = document.createElement('button');
        nextButton.className = 'arrow next';
        nextButton.innerHTML = '<i class="ph-duotone ph-caret-right"></i>';
        nextButton.setAttribute('aria-label', 'Next');

        const dotsContainer = document.createElement('div');
        dotsContainer.className = 'slideshow-nav';

        mediaUrls.forEach((_, index) => {
            const dot = document.createElement('div');
            dot.className = `dot ${index === 0 ? 'active' : ''}`;
            dot.addEventListener('click', () => showSlide(index));
            dotsContainer.appendChild(dot);
        });

        slideshowContainer.appendChild(prevButton);
        slideshowContainer.appendChild(nextButton);
        slideshowContainer.appendChild(dotsContainer);

        let currentSlide = 0;

        function showSlide(index) {
            const slides = slideshowContainer.querySelectorAll('.slide');
            const dots = slideshowContainer.querySelectorAll('.dot');

            slides[currentSlide].classList.remove('active');
            dots[currentSlide].classList.remove('active');

            currentSlide = index;
            if (currentSlide >= slides.length) currentSlide = 0;
            if (currentSlide < 0) currentSlide = slides.length - 1;

            slides[currentSlide].classList.add('active');
            dots[currentSlide].classList.add('active');
        }

        prevButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showSlide(currentSlide - 1);
        });

        nextButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showSlide(currentSlide + 1);
        });

        // Make slideshow images clickable (existing code)
        slideshowContainer.addEventListener('click', (e) => {
            const img = e.target.closest('.media-image');
            if (img) {
                e.preventDefault();
                e.stopPropagation();
                window.open(mediaUrls[currentSlide], '_blank');
            }
        });
    }

    return slideshowContainer;
}

// Helper function to format numbers with commas
function formatNumberWithCommas(number) {
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function createCard(item) {
    const card = document.createElement('div');
    card.className = 'card';

    const openInNewTabButton = `<button class="open-in-new-tab" title="View post on Bluesky">
                                    <i class="ph-duotone ph-arrow-up-right"></i>
                                </button>`;

    // Check for media and prepare media HTML
    let mediaHtml = '';
    if (item.Has_Media === 'TRUE' && item.Media_URLs) {
        mediaHtml = '<div class="media-container has-media"></div>';
    }

    // Handle Links and create buttons
    let linkButtonsHtml = '';
    let hasLinks = false; // Flag to indicate if there are any links
    if (item.Links) {
        const links = item.Links.split('|').map(link => link.trim());
        if (links.length > 0 && links[0] !== "") { // Check if there are any non-empty links
            hasLinks = true;
            links.forEach(link => {
                const truncatedLink = link.length > 32 ? link.substring(0, 32) + '...' : link;
                linkButtonsHtml += `<button class="link-button" onclick="window.open('${link}', '_blank')">${truncatedLink}</button>`;
            });
        }
    }

    // Handle Embeds
    let embedHtml = '';
    if (item.Embed_Title || item.Embed_Description || item.Embed_Thumb) {
        embedHtml = `
            <a href="${item.Embed_URL}" target="_blank" class="embed-link">
                <div class="post-embed">
                    ${item.Embed_Thumb ? `<img src="${item.Embed_Thumb}" alt="Embed Thumbnail" class="embed-thumb">` : ''}
                    <div class="embed-text">
                        ${item.Embed_Title ? `<p class="embed-title">${item.Embed_Title}</p>` : ''}
                        ${item.Embed_Description ? `<p class="embed-description">${item.Embed_Description}</p>` : ''}
                    </div>
                </div>
            </a>
        `;
    }

    // Wrap user-info in an anchor tag
    const userInfoHtml = `
        <a href="https://bsky.app/profile/${item.Author_Handle}" target="_blank" class="user-info-link">
            <div class="user-info">
                <div class="display-name">${item.Author_DisplayName || 'Author profile name'}</div>
                <div class="profile">@${item.Author_Handle}</div>
            </div>
        </a>
    `;

    card.innerHTML = `
        <div class="card-header">
            <div class="profile-head">
                <img src="${item.Author_Avatar}" alt="${item.Author_DisplayName}" class="avatar" onerror="this.style.display='none'">
                ${userInfoHtml}
            </div>
            ${openInNewTabButton}
        </div>
        <div class="card-content">
            <div class="post-text">${formatPostText(item.Post_Text, item.Mentions)}</div>
            ${hasLinks ? `<div class="post-links">${linkButtonsHtml}</div>` : ''}
            ${mediaHtml}
            ${embedHtml}
        </div>
        <div class="card-footer">
            <div class="post-meta">
                <div class="meta-item">
                    <i class="ph-duotone ph-heart"></i>
                    ${formatNumberWithCommas(item.Like_Count)} likes
                </div>
                <div class="meta-item">
                    <i class="ph-duotone ph-repeat"></i>
                    ${formatNumberWithCommas(item.Repost_Count)}
                </div>
                <div class="meta-item">
                    <i class="ph-duotone ph-chat-centered"></i>
                    ${formatNumberWithCommas(item.Reply_Count)}
                </div>
            </div>
            <div class="timestamp">${formatTimestamp(item.Post_CreatedAt)}</div>
            <div class="post-actions">
                <button class="visit-profile" title="Visit author profile">
                    Visit Profile
                </button>
                <button class="download-button" title="Download post metadata as JSON">
                    Download JSON
                </button>
                <button class="copy-post-link" title="Copy Bluesky post link">
                    Copy Link
                </button>
            </div>
        </div>
    `;

    // Handle media display
    if (item.Has_Media === 'TRUE' && item.Media_URLs) {
        const mediaUrls = item.Media_URLs.split('|').map(url => url.trim()).filter(url => url);
        if (mediaUrls.length > 0) {
            const mediaContainer = card.querySelector('.media-container');
            if (mediaContainer) {
                mediaContainer.appendChild(createSlideshow(mediaUrls));
                mediaContainer.style.display = 'block';
            }
        }
    }

    // Update click handlers to use new Post_Link property
    card.querySelector('.open-in-new-tab').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.open(item.Post_Link, '_blank');
    });

    // Download button functionality
    card.querySelector('.download-button').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        downloadJSON(item);
    });

    // Copy Post Link functionality
    card.querySelector('.copy-post-link').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard(item['Post_Link']);
    });

    // Visit Profile functionality
    card.querySelector('.visit-profile').addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const profileLink = `https://bsky.app/profile/${item.Author_Handle}`;
        window.open(profileLink, '_blank');
    });

    // Event listeners for media and post-text clicks (for links)
    card.querySelector('.media-container')?.addEventListener('click', (e) => {
        if (e.target.closest('.arrow') || e.target.closest('.dot')) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    card.querySelector('.post-text').addEventListener('click', (e) => {
        const link = e.target.closest('.post-link');
        if (link) {
            e.preventDefault();
            e.stopPropagation();
            window.open(link.href, '_blank');
        }
    });

    return card;
}

// ... (rest of your code - copyToClipboard, downloadJSON, createTabs, etc. - remains the same) ...

function copyToClipboard(text) {
    // Create a temporary textarea element
    const textarea = document.createElement('textarea');
    textarea.value = text;

    // Make it read-only and hidden
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';

    // Append it to the body
    document.body.appendChild(textarea);

    // Select the text
    if (navigator.userAgent.match(/ipad|iphone/i)) {
        // iOS-specific selection
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        textarea.setSelectionRange(0, 999999); // For iOS Safari
    } else {
        textarea.select();
    }

    // Copy the text
    document.execCommand('copy');

    // Remove the temporary element
    document.body.removeChild(textarea);

    alert('Post link copied to clipboard!');
}

function downloadJSON(item) {
    const jsonData = JSON.stringify(item, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const timestamp = new Date(item['Post_CreatedAt']).toISOString().replace(/[:.]/g, '-');
    const filename = `${item.Author_Handle}_${timestamp}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function createTabs() {
    const tabsContainer = document.getElementById('feedTabs');
    Object.keys(FEEDS_CONFIG).forEach(feedName => {
        const tab = document.createElement('button');
        tab.className = `tab ${feedName === currentFeed ? 'active' : ''}`;
        tab.textContent = feedName;
        tab.addEventListener('click', () => switchFeed(feedName));
        tabsContainer.appendChild(tab);
    });
}

function updateFeedInfo(feedName) {
    const feedInfo = FEEDS_CONFIG[feedName];
    const descriptionContainer = document.getElementById('feedDescription');
    const buttonContainer = document.getElementById('feedButton');

    descriptionContainer.textContent = feedInfo.description;

    if (feedInfo.button) {
        let button = buttonContainer.querySelector('button');
        if (!button) {
            button = document.createElement('button');
            buttonContainer.innerHTML = '';
            buttonContainer.appendChild(button);
        }
        button.textContent = feedInfo.button.label;
        button.onclick = () => window.open(feedInfo.button.link, '_blank');
    } else {
        buttonContainer.innerHTML = '';
    }
}

async function checkForUpdates(feedName) {
    try {
        const newData = await fetchCSV(FEEDS_CONFIG[feedName].file);
        if (newData && newData.length > 0) {
            if (!feedCache[feedName] || newData.length !== feedCache[feedName].length) {
                console.log(`Updating feed: ${feedName}`);
                feedCache[feedName] = newData;

                if (currentFeed === feedName) {
                    updateCards(newData);
                }
            }
        }
    } catch (error) {
        console.error(`Error checking for updates for ${feedName}:`, error);
    }
}

function updateCards(data) {
    const cardContainer = document.getElementById('cardContainer');
    cardContainer.innerHTML = '';

    data.forEach(item => {
        const card = createCard(item);
        cardContainer.appendChild(card);
    });
}

async function switchFeed(feedName) {
    currentFeed = feedName;
    localStorage.setItem('currentFeed', feedName);

    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.toggle('active', tab.textContent === feedName);
    });

    const cardContainer = document.getElementById('cardContainer');
    cardContainer.innerHTML = '';

    // Show loading screen only if we don't have cached data
    if (!feedCache[feedName]) {
        showLoadingScreen();
    }

    updateFeedInfo(feedName);

    try {
        // Always fetch fresh data on feed switch
        const data = await fetchCSV(FEEDS_CONFIG[feedName].file);
        feedCache[feedName] = data;
        updateCards(data);
    } finally {
        hideLoadingScreen();
    }

    startBackgroundUpdates(feedName);
}

let updateIntervals = {};

function startBackgroundUpdates(feedName) {
    if (updateIntervals[feedName]) {
        clearInterval(updateIntervals[feedName]);
    }

    checkForUpdates(feedName);
    updateIntervals[feedName] = setInterval(() => checkForUpdates(feedName), UPDATE_INTERVAL);
}

async function initialize() {
    createTabs();
    showLoadingScreen(); // Show loading screen on initial load

    try {
        const savedFeed = localStorage.getItem('currentFeed') || currentFeed;
        await switchFeed(savedFeed);
    } finally {
        hideLoadingScreen();
    }
}

document.addEventListener('DOMContentLoaded', initialize);