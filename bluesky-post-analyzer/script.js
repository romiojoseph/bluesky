// script.js

let postStatsChart; // Keep the post stats chart
const BASE_URL = "https://public.api.bsky.app/xrpc";

// We allow 10 calls per second per endpoint (100 ms between calls)
const RATE_LIMIT_DELAY = 100;
const rateLimitTimers = {};

async function rateLimit(endpoint = "default") {
    if (!rateLimitTimers[endpoint]) {
        rateLimitTimers[endpoint] = 0;
    }
    const elapsed = Date.now() - rateLimitTimers[endpoint];
    if (elapsed < RATE_LIMIT_DELAY) {
        await new Promise(resolve => setTimeout(resolve, RATE_LIMIT_DELAY - elapsed));
    }
    rateLimitTimers[endpoint] = Date.now();
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const month = date.toLocaleString('en-US', { month: 'short' });
    const day = date.getDate();
    const year = date.getFullYear();
    const time = date.toLocaleString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    return `${month} ${day}, ${year} • ${time}`;
}

function showTab(tabName) {
    const tabContents = document.getElementsByClassName('tab-content');
    for (const content of tabContents) {
        content.style.display = 'none';
    }
    const tabs = document.getElementsByClassName('tab');
    for (const tab of tabs) {
        tab.classList.remove('active');
    }
    document.getElementById(tabName).style.display = 'block';
    // Find the tab with the matching onclick attribute value
    for (const tab of tabs) {
        if (tab.getAttribute('onclick') === `showTab('${tabName}')`) {
            tab.classList.add('active');
            break; // Exit the loop once the correct tab is found
        }
    }
}

// --- Centralized Loading State Management ---
function setLoadingState(isLoading, message = "", action = "") {
    const loaderContainer = document.getElementById('loader');
    const progressMessage = document.getElementById('progress-message');
    const progressAction = document.getElementById('progress-action');

    if (isLoading) {
        loaderContainer.style.display = 'block';
        progressMessage.textContent = message;
        progressAction.textContent = action;
    } else {
        loaderContainer.style.display = 'none';
        progressMessage.textContent = '';
        progressAction.textContent = '';
    }
}

async function resolveHandle(handle) {
    await rateLimit("resolveHandle");
    setLoadingState(true, `Resolving handle: ${handle}...`); // Show loader
    try {
        const response = await fetch(`${BASE_URL}/com.atproto.identity.resolveHandle?handle=${handle}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        return data.did;
    } finally {
        setLoadingState(false); // Hide loader
    }
}

async function parsePostUrl(url) {
    const pattern = /https:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/]+)/;
    const match = url.match(pattern);
    if (!match) {
        throw new Error("Invalid post URL format.");
    }
    const [, username, postId] = match;
    const did = await resolveHandle(username);  // Await the handle resolution
    return { username, postId, did };
}

async function getPostThread(uri) {
    await rateLimit("getPostThread");
    setLoadingState(true, "Fetching post thread...");
    try {
        const response = await fetch(`${BASE_URL}/app.bsky.feed.getPostThread?uri=${uri}`);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return await response.json();
    } finally {
        setLoadingState(false);
    }
}

async function getQuotes(uri) {
    let allQuotes = [];
    let cursor = null;
    setLoadingState(true, "Fetching quotes..."); // Show loader
    let totalQuotes = 0;
    try {
        do {
            await rateLimit("getQuotes");
            let url = `${BASE_URL}/app.bsky.feed.getQuotes?uri=${uri}&limit=100`;
            if (cursor) {
                url += `&cursor=${cursor}`;
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            const newQuotes = data.posts || [];
            allQuotes = allQuotes.concat(newQuotes);
            totalQuotes += newQuotes.length;
            setLoadingState(true, "Fetching quotes...", `Fetched ${totalQuotes} quotes`); // Update progress
            cursor = data.cursor;
        } while (cursor);
        return allQuotes;
    } finally {
        setLoadingState(false); // Hide loader
    }
}

async function getLikes(uri) {
    let allLikes = [];
    let cursor = null;
    setLoadingState(true, "Fetching likes..."); // Show loader
    let totalLikes = 0;
    try {
        do {
            await rateLimit("getLikes");
            let url = `${BASE_URL}/app.bsky.feed.getLikes?uri=${uri}&limit=100`;
            if (cursor) {
                url += `&cursor=${cursor}`;
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            const newLikes = data.likes || [];
            allLikes = allLikes.concat(newLikes);
            totalLikes += newLikes.length;
            setLoadingState(true, "Fetching likes...", `Fetched ${totalLikes} likes`); // Update progress
            cursor = data.cursor;
        } while (cursor);
        return allLikes;
    } finally {
        setLoadingState(false); // Hide loader
    }

}

async function getReposts(uri) {
    let allReposts = [];
    let cursor = null;
    setLoadingState(true, "Fetching reposts..."); // Show loader
    let totalReposts = 0;
    try {
        do {
            await rateLimit('getReposts');
            let url = `${BASE_URL}/app.bsky.feed.getRepostedBy?uri=${uri}&limit=100`;
            if (cursor) {
                url += `&cursor=${cursor}`;
            }
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            const newReposts = data.repostedBy || [];
            allReposts = allReposts.concat(newReposts);
            totalReposts += newReposts.length
            setLoadingState(true, "Fetching reposts...", `Fetched ${totalReposts} reposts`);
            cursor = data.cursor;
        } while (cursor);
        return allReposts;
    } finally {
        setLoadingState(false); // Hide loader
    }
}

function renderPost(postData) {
    const container = document.getElementById('analyzed-post');
    container.innerHTML = ''; // Clear previous content

    if (!postData || !postData.author || !postData.record) {
        container.innerHTML = '<p>Post data could not be loaded.</p>';
        return;
    }
    const author = postData.author;
    const record = postData.record;

    // Author info
    const authorDiv = document.createElement('div');
    authorDiv.classList.add('post-author');

    const authorInfo = document.createElement('div');
    authorInfo.classList.add('post-author-info');
    const handleLink = document.createElement('a');
    handleLink.href = `https://bsky.app/profile/${author.did}`;
    handleLink.textContent = author.displayName || author.handle;
    handleLink.target = "_blank";

    const handleSpan = document.createElement('span');
    handleSpan.textContent = ` (@${author.handle})`;
    handleSpan.classList.add('post-handle');

    authorInfo.appendChild(handleLink);
    authorInfo.appendChild(handleSpan);
    authorDiv.appendChild(authorInfo);
    container.appendChild(authorDiv);

    // Post content
    const contentDiv = document.createElement('div');
    contentDiv.classList.add('post-content');

    const text = document.createElement('p');
    text.classList.add('post-text');
    text.textContent = record.text || ''; // Show empty string if no text
    contentDiv.appendChild(text);


    // Handle embeds (images, external, record, recordWithMedia)
    if (record.embed) {
        let embedType = record.embed.$type;
        const embedInfo = document.createElement('p');
        embedInfo.classList.add('post-embed-info');

        if (embedType === 'app.bsky.embed.images#view' && record.embed.images) {
            embedInfo.textContent = "Contains: Image Embed"; //Specific embed type
            const imagesDiv = document.createElement('div');
            imagesDiv.classList.add('post-images');
            record.embed.images.forEach(image => {
                const img = document.createElement('img');
                img.src = image.thumb || image.fullsize;
                img.alt = image.alt || 'Embedded image';
                img.classList.add('post-image');
                imagesDiv.appendChild(img);
            });
            contentDiv.appendChild(embedInfo); // Add embed info
            contentDiv.appendChild(imagesDiv);
        } else if (embedType === 'app.bsky.embed.external#view' && record.embed.external) {
            embedInfo.textContent = "Contains: External Embed"; //Specific embed type
            const externalDiv = document.createElement('div');
            externalDiv.classList.add('post-external');
            const externalLink = document.createElement('a');
            externalLink.href = record.embed.external.uri;
            externalLink.textContent = record.embed.external.title || 'External Link';
            externalLink.target = '_blank';
            externalDiv.appendChild(externalLink);
            const externalDesc = document.createElement('p');
            externalDesc.textContent = record.embed.external.description || '';
            externalDiv.appendChild(externalDesc);
            contentDiv.appendChild(embedInfo);
            contentDiv.appendChild(externalDiv);

        } else if (embedType === 'app.bsky.embed.record#view' && record.embed.record) {
            // Handle quoted post (recursive call)
            embedInfo.textContent = "Contains: Quoted Post";
            const quotedPostDiv = document.createElement('div');
            quotedPostDiv.classList.add('post-quoted');
            // Corrected recursive call:
            renderPost(record.embed.record.view.value);
            contentDiv.appendChild(embedInfo);
            contentDiv.appendChild(quotedPostDiv);

        } else if (embedType === 'app.bsky.embed.recordWithMedia#view' && record.embed) {
            embedInfo.textContent = "Contains: Post with Media";

            //record with media
            const recordWithMediaDiv = document.createElement('div');
            recordWithMediaDiv.classList.add('post-quoted-media');
            renderPost(record.embed.record.view.value); //Corrected

            contentDiv.appendChild(embedInfo); //Add embed info
            contentDiv.appendChild(recordWithMediaDiv);


            if (record.embed.media && record.embed.media.view && record.embed.media.view.$type === "app.bsky.embed.images#view" && record.embed.media.view.images) {

                const imagesDiv = document.createElement('div');
                imagesDiv.classList.add('post-images');
                record.embed.media.view.images.forEach(image => {
                    const img = document.createElement('img');
                    img.src = image.thumb || image.fullsize;
                    img.alt = image.alt || 'Embedded image';
                    img.classList.add('post-image');
                    imagesDiv.appendChild(img);
                });

                contentDiv.appendChild(imagesDiv);

            } else if (record.embed.media && record.embed.media.view && record.embed.media.view.$type === "app.bsky.embed.external#view" && record.embed.media.view.external) {

                const externalDiv = document.createElement('div');
                externalDiv.classList.add('post-external');
                const externalLink = document.createElement('a');
                externalLink.href = record.embed.media.view.external.uri;
                externalLink.textContent = record.embed.media.view.external.title || 'External Link';
                externalLink.target = '_blank';
                externalDiv.appendChild(externalLink);
                const externalDesc = document.createElement('p');
                externalDesc.textContent = record.embed.media.view.external.description || '';
                externalDiv.appendChild(externalDesc);
                contentDiv.appendChild(externalDiv);

            }
        } else {
            embedInfo.textContent = `Contains: Embed Type (${embedType})`;  // Handle unknown
            contentDiv.appendChild(embedInfo);
        }
    }

    container.appendChild(contentDiv);


    // Timestamp
    const timestampDiv = document.createElement('div');
    timestampDiv.classList.add('post-timestamp');
    timestampDiv.textContent = formatDate(postData.indexedAt);
    container.appendChild(timestampDiv);
}

// --- Function to prepare and show the modal ---
async function showProfiles() {
    //  Collect DIDs from likes and reposts
    const likesDids = (await getLikesData()).map(like => like.actor.did);
    const repostsDids = (await getRepostsData()).map(repost => repost.did);

    // Call the function from profile_fetcher.js to show the modal
    showProfileModal(likesDids, repostsDids);
}

// --- Global variables to store likes and reposts data ---
let cachedLikesData = null;
let cachedRepostsData = null;

// --- Functions to get likes and reposts data, with caching ---

async function getLikesData() {
    if (!cachedLikesData) {
        const url = document.getElementById('post-url').value.trim();
        const postInfo = await parsePostUrl(url);
        const postUri = `at://${postInfo.did}/app.bsky.feed.post/${postInfo.postId}`;
        cachedLikesData = await getLikes(postUri);
    }
    return cachedLikesData;
}

async function getRepostsData() {
    if (!cachedRepostsData) {
        const url = document.getElementById('post-url').value.trim();
        const postInfo = await parsePostUrl(url);
        const postUri = `at://${postInfo.did}/app.bsky.feed.post/${postInfo.postId}`;
        cachedRepostsData = await getReposts(postUri);
    }
    return cachedRepostsData;
}

async function analyzePost() {
    const url = document.getElementById('post-url').value.trim();
    if (!url) {
        document.getElementById('error-message').textContent = "Please enter a URL.";
        return;
    }

    // Hide all content sections initially
    document.querySelectorAll('#container > *').forEach(el => {
        if (!['header', 'input-section', 'loader', 'error-message'].includes(el.classList[0])) {
            el.style.display = 'none';
        }
    });

    document.getElementById('error-message').textContent = '';
    document.getElementById('show-profiles-button').style.display = 'none';

    try {
        const postInfo = await parsePostUrl(url);
        const postUri = `at://${postInfo.did}/app.bsky.feed.post/${postInfo.postId}`;

        const [threadData, quotesData, likesData, repostsData] = await Promise.all([
            getPostThread(postUri),
            getQuotes(postUri),
            getLikes(postUri),
            getReposts(postUri)
        ]);


        // Show the necessary container elements, but let showTab handle the tab content
        const sectionsToShow = {
            '#analyzed-post': 'block',
            '#show-profiles-button': 'block',
            'section': 'flex', // Keep flex layout for sections
            '.tabs': 'block',  // Show the tabs container
            //  '#replies': 'block',  // REMOVE THIS
            //  '#quotes': 'block'   // REMOVE THIS
        };

        Object.entries(sectionsToShow).forEach(([selector, displayValue]) => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(el => el.style.display = displayValue);
        });

        // Show the default tab ("replies") after data load:
        showTab('replies');


        // Cache likes and reposts data
        cachedLikesData = likesData;
        cachedRepostsData = repostsData;

        // Render the analyzed post
        renderPost(threadData.thread.post);

        // Get post stats for pie chart
        const postStats = {
            likeCount: threadData.thread.post.likeCount,
            repostCount: threadData.thread.post.repostCount,
            replyCount: threadData.thread.post.replyCount,
            quoteCount: threadData.thread.post.quoteCount
        };

        // Render pie chart
        renderPostStatsChart(postStats);

        // Create timeline data arrays
        const timelineData = {
            likes: likesData.map(like => ({
                timestamp: new Date(like.createdAt).getTime(),
                type: 'Like'
            })),
            quotes: quotesData.map(quote => ({
                timestamp: new Date(quote.record.createdAt).getTime(),
                type: 'Quote'
            })),
            replies: [],
            reposts: repostsData.map(repost => ({ // Add reposts to timeline
                timestamp: new Date(repost.createdAt).getTime(),
                type: 'Repost'
            }))
        };

        // Process replies recursively
        function processReplies(replies) {
            if (!replies) return;
            for (const reply of replies) {
                if (reply.post && reply.post.record) {
                    timelineData.replies.push({
                        timestamp: new Date(reply.post.record.createdAt).getTime(),
                        type: 'Reply'
                    });
                }
                if (reply.replies) {
                    processReplies(reply.replies);
                }
            }
        }

        if (threadData && threadData.thread && threadData.thread.replies) {
            processReplies(threadData.thread.replies);
        }

        // Render the timeline chart
        renderInteractionTimelineChart(timelineData, threadData.thread.post.record.createdAt);

        // Populate Replies Table
        const repliesTableBody = document.getElementById('replies-table').getElementsByTagName('tbody')[0];
        repliesTableBody.innerHTML = '';

        function addReplyToTable(reply, isNested = false) {
            if (!reply || !reply.post) return; // Robust check

            const row = repliesTableBody.insertRow();

            // "From" column (hyperlinked handle)
            const fromCell = row.insertCell(0);
            const fromLink = document.createElement('a');
            fromLink.href = `https://bsky.app/profile/${reply.post.author.did}`;
            fromLink.textContent = reply.post.author.handle;
            fromLink.target = "_blank";
            fromCell.appendChild(fromLink);

            // "Text" column (hyperlinked text or embed type)
            const textCell = row.insertCell(1);
            const textLink = document.createElement('a');
            textLink.href = `https://bsky.app/profile/${reply.post.author.did}/post/${reply.post.uri.split('/').pop()}`;
            textLink.target = "_blank";

            if (reply.post.embed && reply.post.embed.$type) {
                let embedType = reply.post.embed.$type;
                if (embedType === "app.bsky.embed.images#view") {
                    embedType = "Image Embed";
                } else if (embedType === "app.bsky.embed.external#view") {
                    embedType = "External Embed";
                } else if (embedType === "app.bsky.embed.record#view") {
                    embedType = "Record Embed";
                } else if (embedType === "app.bsky.embed.recordWithMedia#view") {
                    embedType = "Record With Media Embed";
                } else {
                    embedType = "Unknown Embed Type";
                }
                textLink.textContent = `[${embedType}]`;
            } else if (reply.post.record.text) {
                textLink.textContent = reply.post.record.text;
            } else {
                textLink.textContent = "[No Text]";
            }

            textCell.appendChild(textLink);

            if (isNested) {
                const replyThreadLabel = document.createElement('span');
                replyThreadLabel.textContent = "Reply Thread";
                replyThreadLabel.classList.add('reply-thread-label');
                textCell.appendChild(replyThreadLabel);
                row.classList.add("reply-thread");
            }

            row.insertCell(2).textContent = reply.post.replyCount;
            row.insertCell(3).textContent = reply.post.repostCount;
            row.insertCell(4).textContent = reply.post.likeCount;
            row.insertCell(5).textContent = reply.post.quoteCount;
            row.insertCell(6).textContent = formatDate(reply.post.record.createdAt);
        }

        if (threadData && threadData.thread && threadData.thread.replies) {
            for (const reply of threadData.thread.replies) {
                addReplyToTable(reply);
                if (reply.replies && Array.isArray(reply.replies)) {
                    for (const nestedReply of reply.replies) {
                        addReplyToTable(nestedReply, true);
                        if (nestedReply.replies && Array.isArray(nestedReply.replies)) {
                            for (const furtherNestedReply of nestedReply.replies) {
                                addReplyToTable(furtherNestedReply, true);
                            }
                        }
                    }
                }
            }
        }

        // Populate Quotes Table
        const quotesTableBody = document.getElementById('quotes-table').getElementsByTagName('tbody')[0];
        quotesTableBody.innerHTML = '';

        function addQuoteToTable(quote) {
            if (!quote || !quote.record) return;

            const row = quotesTableBody.insertRow();

            // "From" column
            const fromCell = row.insertCell(0);
            const fromLink = document.createElement('a');
            fromLink.href = `https://bsky.app/profile/${quote.author.did}`;
            fromLink.textContent = quote.author.handle;
            fromLink.target = "_blank";
            fromCell.appendChild(fromLink);

            // "Text" column
            const textCell = row.insertCell(1);
            const textLink = document.createElement('a');
            textLink.href = `https://bsky.app/profile/${quote.author.did}/post/${quote.uri.split('/').pop()}`;
            textLink.target = "_blank";

            if (quote.record.text) {
                textLink.textContent = quote.record.text;
            } else if (quote.embed && quote.embed.$type) {
                let embedType = quote.embed.$type;
                if (embedType === "app.bsky.embed.images#view") {
                    embedType = "Image Embed";
                } else if (embedType === "app.bsky.embed.external#view") {
                    embedType = "External Embed";
                } else if (embedType === "app.bsky.embed.record#view") {
                    if (quote.embed.record.view && quote.embed.record.view.value && quote.embed.record.view.value.text && quote.embed.record.view.value.text.trim() === "") {
                        textLink.textContent = "[Posted as an empty quote]";
                        textLink.style.fontStyle = "italic";
                    } else if (quote.embed.record.view && quote.embed.record.view.value && quote.embed.record.view.value.text) {
                        textLink.textContent = `Quoted Post: ${quote.embed.record.view.value.text}`;
                    } else {
                        embedType = "Record Embed";
                        textLink.textContent = `[${embedType}]`;
                    }
                } else if (embedType === "app.bsky.embed.recordWithMedia#view") {
                    embedType = "Record With Media Embed";
                    textLink.textContent = `[${embedType}]`;
                } else {
                    embedType = "Unknown Embed Type";
                    textLink.textContent = `[${embedType}]`;
                }
                if (!textLink.textContent) {
                    textLink.textContent = `[${embedType}]`;
                }
            } else {
                textLink.textContent = "[No Text]";
            }

            textCell.appendChild(textLink);

            row.insertCell(2).textContent = quote.replyCount;
            row.insertCell(3).textContent = quote.repostCount;
            row.insertCell(4).textContent = quote.likeCount;
            row.insertCell(5).textContent = quote.quoteCount;
            row.insertCell(6).textContent = formatDate(quote.record.createdAt);
        }

        if (quotesData) {
            quotesData.forEach(quote => addQuoteToTable(quote));
        }
        // Show the "Show Engaged Users" button after analysis
        document.getElementById('show-profiles-button').style.display = 'block';
        setLoadingState(true, "Analysis complete!"); // Final message
        setTimeout(() => {
            setLoadingState(false)
        }, 500)


    } catch (error) {
        document.getElementById('error-message').textContent = `Error: ${error.message}`;
        console.error(error);
        setLoadingState(false);
    }
}

//  Search Function
function searchTable(tableId, inputId) {
    const filter = document.getElementById(inputId).value.toUpperCase();
    const table = document.getElementById(tableId);
    const rows = table.getElementsByTagName('tr');

    for (let i = 1; i < rows.length; i++) { // Skip header row
        let rowVisible = false;
        const cells = rows[i].getElementsByTagName('td');
        for (let j = 0; j < cells.length; j++) {
            const cellText = cells[j].textContent || cells[j].innerText;
            if (cellText.toUpperCase().indexOf(filter) > -1) {
                rowVisible = true;
                break;
            }
        }
        rows[i].style.display = rowVisible ? "" : "none";
    }
}

//  Sort Function
let currentSort = {
    tableId: null,
    columnIndex: null,
    ascending: true
};

function sortTable(tableId, columnIndex, isNumeric = false) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    const rows = Array.from(tbody.querySelectorAll('tr'));

    if (currentSort.tableId) {
        const prevSortIndicator = document.getElementById(`${currentSort.tableId}-sort-${currentSort.columnIndex}`);
        if (prevSortIndicator) {
            prevSortIndicator.textContent = '';
        }
    }

    if (currentSort.tableId === tableId && currentSort.columnIndex === columnIndex) {
        currentSort.ascending = !currentSort.ascending;
    } else {
        currentSort.ascending = true;
        currentSort.tableId = tableId;
        currentSort.columnIndex = columnIndex;
    }

    const sortIndicator = document.getElementById(`${tableId}-sort-${columnIndex}`);
    sortIndicator.textContent = currentSort.ascending ? '▲' : '▼';

    rows.sort((rowA, rowB) => {
        let cellA = rowA.querySelectorAll('td')[columnIndex].textContent.trim();
        let cellB = rowB.querySelectorAll('td')[columnIndex].textContent.trim();

        if (isNumeric) {
            cellA = parseFloat(cellA) || 0;
            cellB = parseFloat(cellB) || 0;
        }

        return currentSort.ascending
            ? (cellA > cellB ? 1 : -1)
            : (cellA < cellB ? 1 : -1);
    });

    rows.forEach(row => tbody.appendChild(row));
}