const BASE_URL = "https://public.api.bsky.app/xrpc";

// Elements moved to index.html
const profileDetailsElement = document.getElementById('profileDetails');
const profileBanner = document.getElementById('profileBanner');
const profileAvatarHandle = document.querySelector('.profile-avatar-handle');
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const profileHandle = document.getElementById('profileHandle');
const downloadProfileBtn = document.getElementById('downloadProfileBtn');
const profileDID = document.getElementById('profileDID');
const profileStats = document.getElementById('profileStats');
const profileFollowersCount = document.getElementById('profileFollowersCount');
const profileFollowingCount = document.getElementById('profileFollowingCount');
const profilePostsCount = document.getElementById('profilePostsCount');
const profileListsCount = document.getElementById('profileListsCount');
const profileFeedsCount = document.getElementById('profileFeedsCount');
const profileStarterPacksCount = document.getElementById('profileStarterPacksCount');
const profileDescription = document.getElementById('profileDescription');
const profileDates = document.getElementById('profileDates');
const profileCreatedAt = document.getElementById('profileCreatedAt');
const profileIndexedAt = document.getElementById('profileIndexedAt');
const progressElement = document.getElementById('progress');
const resultsElement = document.getElementById('results');
const resultSection = document.getElementById('resultSection');
const resultTitle = document.getElementById('resultTitle');
const resultSubtitle = document.getElementById('resultSubtitle');
const totalItemsSpan = document.getElementById('totalItems');
const noDataMessage = document.getElementById('noDataMessage');

function getActorFromLink(profileLink) {
    const urlMatch = profileLink.match(/bsky\.app\/profile\/([^/]+)/);
    if (urlMatch) return urlMatch[1];
    const handleMatch = profileLink.match(/^[a-zA-Z0-9._-]+$/);
    if (handleMatch) return profileLink;
    throw new Error("Invalid Bluesky profile link or handle");
}

function formatNumber(number) {
    return number.toLocaleString();
}

function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const options = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    };
    return date.toLocaleString('en-US', options).replace(/, (?=\d+:\d+ [AP]M$)/, ' • ');
}

function copyToClipboard(text) {
    // Create a temporary textarea
    const tempTextArea = document.createElement('textarea');
    tempTextArea.value = text;
    document.body.appendChild(tempTextArea);
    tempTextArea.select(); // Select the text
    document.execCommand('copy'); // Copy the text
    document.body.removeChild(tempTextArea); // Remove the temporary textarea

    // Alert the user (you might want to use a more subtle notification)
    alert('DID copied to clipboard!'); // Optional: You can customize this message
}

function hyperlinkDescription(description) {
    if (!description) return '';
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return description.replace(urlRegex, (url) => {
        return `<a href="${url}" target="_blank" rel="noopener">${url}</a>`;
    });
}

class DataCollector {
    constructor() {
        this.currentActor = null;
        this.profile = null;
        this.lists = null;
        this.feeds = null;
        this.starterPacks = null;
    }

    async fetchPaginatedData(endpoint, params, resourceKey) {
        let cursor = null;
        let allItems = [];
        let totalItems = 0;

        do {
            const currentParams = { ...params };
            if (cursor) currentParams.cursor = cursor;

            // Remove the conditional check so progress shows for all actions
            this.updateProgress(`Fetching ${resourceKey}... (${totalItems} items collected)`);

            try {
                const data = await this.fetchWithRetry(endpoint, currentParams);
                if (!data || !data[resourceKey]) break;

                allItems = allItems.concat(data[resourceKey]);
                totalItems += data[resourceKey].length;

                cursor = data.cursor || null;

                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                this.showError(`Error: ${error.message}`);
                break;
            }
        } while (cursor);

        // Update final progress for all actions
        this.updateProgress(`Total ${resourceKey} fetched: ${totalItems}`);

        return [allItems, totalItems];
    }

    async fetchWithRetry(endpoint, params, retries = 3) {
        try {
            const cleanParams = Object.fromEntries(
                Object.entries(params).filter(([_, v]) => v != null)
            );

            const query = new URLSearchParams(cleanParams).toString();
            const response = await fetch(`${endpoint}?${query}`);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            if (retries > 0) {
                await new Promise(resolve => setTimeout(resolve, 1000));
                return this.fetchWithRetry(endpoint, params, retries - 1);
            }
            throw error;
        }
    }

    async fetchProfileDetails() {
        const url = `${BASE_URL}/app.bsky.actor.getProfile`;
        return this.fetchWithRetry(url, { actor: this.currentActor });
    }

    async fetchAuthorFeed(includeReposts) {
        const endpoint = `${BASE_URL}/app.bsky.feed.getAuthorFeed`;
        const params = {
            actor: this.currentActor,
            limit: 100,
            filter: 'posts_with_replies'
        };

        let cursor = null;
        let allItems = [];
        let totalItems = 0;

        do {
            const currentParams = { ...params };
            if (cursor) currentParams.cursor = cursor;

            this.updateProgress(`Fetching posts... (${totalItems} items collected)`);

            try {
                const data = await this.fetchWithRetry(endpoint, currentParams);
                if (!data || !data.feed) break;

                let currentBatch = data.feed;

                if (!includeReposts) {
                    currentBatch = currentBatch.filter(post => !post.reason);
                }

                allItems = allItems.concat(currentBatch);
                totalItems += currentBatch.length;

                cursor = data.cursor || null;

                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                this.updateProgress(`Error: ${error.message}`, true);
                break;
            }
        } while (cursor);

        this.updateProgress(`Total posts fetched: ${totalItems}`);
        return [allItems, totalItems];
    }

    async fetchFollows() {
        return this.fetchPaginatedData(
            `${BASE_URL}/app.bsky.graph.getFollows`,
            { actor: this.currentActor, limit: 100 },
            'follows'
        );
    }

    async fetchFollowers() {
        return this.fetchPaginatedData(
            `${BASE_URL}/app.bsky.graph.getFollowers`,
            { actor: this.currentActor, limit: 100 },
            'followers'
        );
    }

    async fetchLists() {
        return this.fetchPaginatedData(
            `${BASE_URL}/app.bsky.graph.getLists`,
            { actor: this.currentActor, limit: 100 },
            'lists'
        );
    }

    async fetchListDetails(listUri) {
        const endpoint = `${BASE_URL}/app.bsky.graph.getList`;
        const params = {
            list: listUri,
            limit: 100
        };

        let cursor = null;
        let allItems = [];
        let totalItems = 0;

        do {
            const currentParams = { ...params };
            if (cursor) currentParams.cursor = cursor;

            this.updateProgress(`Fetching list members... (${totalItems} items collected)`);

            try {
                const data = await this.fetchWithRetry(endpoint, currentParams);
                if (!data || !data.items) break;

                allItems = allItems.concat(data.items);
                totalItems += data.items.length;

                cursor = data.cursor || null;

                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                this.updateProgress(`Error: ${error.message}`, true);
                break;
            }
        } while (cursor);

        this.updateProgress(`Total list members fetched: ${totalItems}`);
        return [allItems, totalItems];
    }

    async fetchStarterPacks() {
        return this.fetchPaginatedData(
            `${BASE_URL}/app.bsky.graph.getActorStarterPacks`,
            { actor: this.currentActor, limit: 100 },
            'starterPacks'
        );
    }

    async fetchActorFeeds() {
        return this.fetchPaginatedData(
            `${BASE_URL}/app.bsky.feed.getActorFeeds`,
            { actor: this.currentActor, limit: 100 },
            'feeds'
        );
    }

    async enrichLists(lists) {
        for (let i = 0; i < lists.length; i++) {
            const list = lists[i];
            this.updateProgress(`Fetching members for list ${i + 1} of ${lists.length}: ${list.name}...`);
            const [members, totalMembers] = await this.fetchListDetails(list.uri);
            list.members = members;
            list.totalMembers = totalMembers;
            this.updateProgress(`Fetched ${totalMembers} members for list: ${list.name}`);
        }
        return lists;
    }

    async enrichStarterPacks(starterPacks) {
        for (let i = 0; i < starterPacks.length; i++) {
            const pack = starterPacks[i];
            this.updateProgress(`Fetching members for starter pack ${i + 1} of ${starterPacks.length}...`);
            if (pack.record.list) {
                const [members, totalMembers] = await this.fetchListDetails(pack.record.list);
                pack.members = members;
                pack.totalMembers = totalMembers;
                this.updateProgress(`Fetched ${totalMembers} members for starter pack.`);
            } else {
                pack.members = [];
                pack.totalMembers = 0;
                this.updateProgress(`Starter pack has no list associated.`);
            }
        }
        return starterPacks;
    }

    createDownloadButton(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.textContent = `Download ${filename}`;
        link.className = 'download-btn';
        return link;
    }

    updateProgress(message, isError = false) {
        const timestamp = new Date().toLocaleTimeString();
        const div = document.createElement('div');
        div.className = isError ? 'progress-error' : 'progress-message';

        const icon = isError ? '❌' : '📥';

        div.innerHTML = `
            <span class="timestamp">[${timestamp}]</span>
            <span class="icon">${icon}</span>
            <span class="content">${message}</span>
        `;

        progressElement.appendChild(div);
        progressElement.scrollTop = progressElement.scrollHeight;
    }

    showError(message) {
        const div = document.createElement('div');
        div.className = 'error';
        div.textContent = message;
        resultsElement.appendChild(div);
    }

    clearResults() {
        resultsElement.innerHTML = '';
        resultsElement.classList.add('hidden'); // Hide results container
        progressElement.innerHTML = '';
        // Hide result elements
        resultSection.style.display = 'none';
        resultTitle.textContent = '';
        resultSubtitle.textContent = '';
        totalItemsSpan.textContent = '';
        noDataMessage.style.display = 'none';
    }

    async displayProfile(profile) {
        profileBanner.src = profile.banner || '';
        profileBanner.style.display = profile.banner ? 'block' : 'none';
        profileAvatar.src = profile.avatar || '';
        profileAvatar.style.display = profile.avatar ? 'block' : 'none';
        profileName.textContent = profile.displayName || '';
        profileHandle.textContent = `@${profile.handle}`;
        profileDID.textContent = profile.did;
        profileFollowersCount.textContent = formatNumber(profile.followersCount);
        profileFollowingCount.textContent = formatNumber(profile.followsCount);
        profilePostsCount.textContent = formatNumber(profile.postsCount);
        profileListsCount.textContent = formatNumber(profile.associated?.lists || 0);
        profileFeedsCount.textContent = formatNumber(profile.associated?.feedgens || 0);
        profileStarterPacksCount.textContent = formatNumber(profile.associated?.starterPacks || 0);
        profileDescription.innerHTML = hyperlinkDescription(profile.description);
        profileCreatedAt.textContent = `Joined on ${formatTimestamp(profile.createdAt)}`;
        profileIndexedAt.textContent = `Last indexed at ${formatTimestamp(profile.indexedAt)}`;

        profileAvatarHandle.onclick = () => {
            window.open(`https://bsky.app/profile/${profile.handle}`, '_blank', 'noopener');
        };

        profileDID.onclick = () => {
            copyToClipboard(profile.did);
        };

        // Store fetched data for download button
        this.profile = profile;

        downloadProfileBtn.textContent = 'Download Profile'; // Reset button text
        downloadProfileBtn.disabled = false; // Re-enable the button

        downloadProfileBtn.onclick = async () => {
            downloadProfileBtn.textContent = 'Please wait...';
            downloadProfileBtn.disabled = true;

            // Fetch lists, feeds, and starterPacks in the background
            this.lists = await this.fetchLists();
            this.feeds = await this.fetchActorFeeds();
            this.starterPacks = await this.fetchStarterPacks();

            const combinedData = {
                profile: this.profile,
                lists: this.lists,
                feeds: this.feeds,
                starterPacks: this.starterPacks
            };

            const blob = new Blob([JSON.stringify(combinedData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `${this.currentActor}_profile.json`;
            link.click();
            URL.revokeObjectURL(url);

            downloadProfileBtn.textContent = 'Download Profile';
            downloadProfileBtn.disabled = false;
        };

        // Show profile details
        profileDetailsElement.classList.remove('hidden');
    }

    async handleAction(action) {
        if (!this.currentActor) {
            this.showError('Please fetch profile first');
            return;
        }

        this.clearResults();
        progressElement.classList.remove('hidden');
        disableActionButtons(true);

        try {
            let data;
            let filename;
            let buttonLabel;
            let totalItems = 0;
            let resultSubtitleText = '';

            switch (action) {
                case 'profile':
                    data = await this.fetchProfileDetails();
                    filename = `${this.currentActor}_profile.json`;
                    this.displayProfile(data);
                    progressElement.classList.add('hidden');
                    return;

                case 'follows':
                    [data, totalItems] = await this.fetchFollows();
                    filename = `${this.currentActor}_follows.json`;
                    buttonLabel = 'Following';
                    resultSubtitleText = 'List of accounts followed by the user';
                    break;

                case 'followers':
                    [data, totalItems] = await this.fetchFollowers();
                    filename = `${this.currentActor}_followers.json`;
                    buttonLabel = 'Followers';
                    resultSubtitleText = 'List of accounts following the user';
                    break;

                case 'originalPosts':
                    [data, totalItems] = await this.fetchAuthorFeed(false);
                    filename = `${this.currentActor}_original_posts.json`;
                    buttonLabel = 'Own Posts';
                    resultSubtitleText = 'Posts created by the user, excluding reposts';
                    break;

                case 'allPosts':
                    [data, totalItems] = await this.fetchAuthorFeed(true);
                    filename = `${this.currentActor}_all_posts.json`;
                    buttonLabel = 'All Posts';
                    resultSubtitleText = 'All posts, including reposts';
                    this.processAllPostsData(data);
                    break;

                case 'lists':
                    [data, totalItems] = await this.fetchLists();
                    data = await this.enrichLists(data);
                    filename = `${this.currentActor}_lists.json`;
                    buttonLabel = 'Lists';
                    resultSubtitleText = 'Lists created by the user';
                    break;

                case 'starterPacks':
                    [data, totalItems] = await this.fetchStarterPacks();
                    data = await this.enrichStarterPacks(data);
                    filename = `${this.currentActor}_starter_packs.json`;
                    buttonLabel = 'Starter Packs';
                    resultSubtitleText = 'curated starter packs of account';
                    break;

                default:
                    throw new Error('Invalid action');
            }
            this.showResults(data, filename, buttonLabel, totalItems, resultSubtitleText);
        } catch (error) {
            this.showError(error.message);
        } finally {
            progressElement.classList.add('hidden');
            disableActionButtons(false);
        }
    }

    showResults(data, filename, buttonLabel, totalItems, resultSubtitleText) {
        // Set text content for result elements
        resultTitle.textContent = `${buttonLabel}`;
        resultSubtitle.textContent = resultSubtitleText;
        totalItemsSpan.textContent = `Total: ${totalItems}`;

        // Show result elements
        resultSection.style.display = 'block';

        if (totalItems > 0) {
            const downloadButton = this.createDownloadButton(data, filename);
            downloadButton.id = 'downloadBtn'; // Set the ID for the new button
            downloadButton.textContent = `Download ${buttonLabel}`; // Change button text
            resultSection.appendChild(document.createElement('br'));
            resultSection.appendChild(downloadButton);
        } else {
            noDataMessage.style.display = 'block';
            noDataMessage.textContent = 'No data found.';
        }

        resultsElement.classList.remove('hidden');
        resultsElement.appendChild(resultSection);
    }

    processAllPostsData(posts) {
        if (posts.length === 0) {
            this.updateProgress("No posts found to analyze.", true);
            return;
        }

        let firstPost = posts[posts.length - 1].post;
        let lastPost = posts[0].post;
        let repostCount = 0;
        let mostEngagedPost = null;
        let maxEngagementScore = 0;

        for (const item of posts) {
            const post = item.post;
            const isRepost = !!item.reason;

            if (isRepost) {
                repostCount++;
            }

            if (!isRepost) {
                const engagementScore = (post.likeCount || 0) + (post.repostCount || 0) + (post.replyCount || 0) + (post.quoteCount || 0)

                if (engagementScore > maxEngagementScore) {
                    mostEngagedPost = post;
                    maxEngagementScore = engagementScore;
                }
            }
        }

        const firstPostLink = `<a href="https://bsky.app/profile/${firstPost.author.handle}/post/${firstPost.uri.split('/').pop()}" target="_blank" rel="noopener">Link</a>`;
        const lastPostLink = `<a href="https://bsky.app/profile/${lastPost.author.handle}/post/${lastPost.uri.split('/').pop()}" target="_blank" rel="noopener">Link</a>`;

        const statsDiv = document.createElement('div');
        statsDiv.className = 'relevant';
        statsDiv.innerHTML = `
            <p>First post on: ${formatTimestamp(firstPost.record.createdAt)} (${posts[posts.length - 1].reason ? 'Repost' : 'Post'}) - ${firstPostLink}</p>
            <p>Last post on: ${formatTimestamp(lastPost.record.createdAt)} (${posts[0].reason ? 'Repost' : 'Post'}) - ${lastPostLink}</p>
            <p>Total reposts: ${repostCount}</p>
        `;

        if (mostEngagedPost) {
            const mostEngagedPostLink = `<a href="https://bsky.app/profile/${mostEngagedPost.author.handle}/post/${mostEngagedPost.uri.split('/').pop()}" target="_blank" rel="noopener">Link</a>`;
            statsDiv.innerHTML += `<p>Most engaged post: ${mostEngagedPostLink}</p>`;
        }

        resultsElement.appendChild(statsDiv);
    }
}

function disableActionButtons(disable) {
    const actionButtons = document.querySelectorAll('.actions button');
    actionButtons.forEach(button => {
        button.disabled = disable;
    });
}

const collector = new DataCollector();

document.getElementById('profileInput').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') fetchProfile();
});

async function fetchProfile() {
    try {
        const input = document.getElementById('profileInput').value.trim();
        if (!input) throw new Error('Please enter a profile link or handle');

        collector.currentActor = getActorFromLink(input);
        collector.clearResults();
        profileDetailsElement.classList.add('hidden');

        const profile = await collector.fetchProfileDetails();
        collector.displayProfile(profile); // Display profile immediately

    } catch (error) {
        collector.showError(error.message);
    }
}

function handleAction(action) {
    collector.handleAction(action);
}