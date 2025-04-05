// --- START OF FILE api.js ---
const BSKY_API_BASE = "https://public.api.bsky.app/xrpc";

/**
 * Fetches posts from a specific Bluesky list with pagination.
 * Filters out quote posts, video posts, reposts, replies, and posts with labels.
 * @param {string} listUri - The AT URI of the list.
 * @param {number} limit - Maximum number of posts to fetch.
 * @param {string|null} [cursor=null] - API cursor for pagination.
 * @returns {Promise<{posts: Array<object>, cursor: string|null}>} Filtered posts and next cursor.
 */
export async function fetchListPosts(listUri, limit, cursor = null) {
    const endpoint = `${BSKY_API_BASE}/app.bsky.feed.getListFeed`;
    return fetchPaginatedFeed(endpoint, { list: listUri }, limit, cursor);
}

/**
 * Fetches posts from a specific Bluesky custom feed with pagination.
 * Filters out quote posts, video posts, reposts, replies, and posts with labels.
 * @param {string} feedUri - The AT URI of the feed generator.
 * @param {number} limit - Maximum number of posts to fetch.
 * @param {string|null} [cursor=null] - API cursor for pagination.
 * @returns {Promise<{posts: Array<object>, cursor: string|null}>} Filtered posts and next cursor.
 */
export async function fetchFeedPosts(feedUri, limit, cursor = null) {
    const endpoint = `${BSKY_API_BASE}/app.bsky.feed.getFeed`;
    return fetchPaginatedFeed(endpoint, { feed: feedUri }, limit, cursor);
}

/**
 * Generic function to fetch feed data with pagination.
 * Filters posts based on embed type, reason (reposts), replies, and labels *before* returning.
 * @param {string} endpoint - The specific Bluesky API endpoint URL.
 * @param {object} initialParams - Base parameters for the API call.
 * @param {number} limit - The number of posts to fetch.
 * @param {string|null} cursor - The cursor for pagination, if any.
 * @returns {Promise<{posts: Array<object>, cursor: string|null}>} Object containing filtered posts and the next cursor.
 * @throws {Error} If the API request fails.
 */
async function fetchPaginatedFeed(endpoint, initialParams, limit, cursor) {
    const params = new URLSearchParams({ ...initialParams, limit });
    if (cursor) {
        params.set('cursor', cursor);
    }

    console.log(`Fetching from ${endpoint} with limit=${limit}, cursor=${cursor ? '...' : 'null'}`);

    try {
        const response = await fetch(`${endpoint}?${params}`);
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Error fetching feed/list (${response.status}): ${errorText}`);
            let detail = errorText;
            try {
                const jsonError = JSON.parse(errorText);
                detail = jsonError.message || jsonError.error || detail;
            } catch (parseError) { /* Ignore */ }
            throw new Error(`API Error (${response.status}): ${detail}.`);
        }
        const data = await response.json();

        let filteredPosts = [];
        if (data.feed && data.feed.length > 0) {
            filteredPosts = data.feed
                .filter(item => !isRepost(item)) // Filter out reposts first
                .map(item => item.post) // Now map to the post object
                .filter(post => post && !isExcludedPost(post)); // Filter out excluded embeds, replies, and labeled posts

            console.log(`Fetched ${data.feed.length} total items, ${filteredPosts.length} posts remain after filtering.`);
        } else {
            console.log("No posts in this response batch.");
        }

        return {
            posts: filteredPosts,
            cursor: data.cursor || null // Return the new cursor or null if none
        };

    } catch (error) {
        console.error("Error during feed fetch:", error);
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            throw new Error(`Network error: Unable to connect to the Bluesky API. Please check your connection.`);
        }
        throw error;
    }
}

/**
 * Checks if a feed item is a repost.
 * @param {object} item - The feed item from the API response (contains post and optional reason).
 * @returns {boolean} True if the item is a repost, false otherwise.
 */
function isRepost(item) {
    return item?.reason?.$type === 'app.bsky.feed.defs#reasonRepost';
}


/**
 * Checks if a post object should be excluded based on embed type, reply status, or labels.
 * @param {object} post - The Bluesky post object.
 * @returns {boolean} True if the post should be excluded, false otherwise.
 */
function isExcludedPost(post) {
    const embedType = post?.embed?.$type;
    const isReply = !!post?.record?.reply;
    const hasLabels = Array.isArray(post?.labels) && post.labels.length > 0; // Check for non-empty labels array

    return isReply || // Filter out replies
        hasLabels || // Filter out posts with any labels
        embedType === 'app.bsky.embed.record#view' || // Filter quote posts (without media)
        embedType === 'app.bsky.embed.recordWithMedia#view' || // Filter quote posts (with media)
        embedType === 'app.bsky.embed.video#view'; // Filter video posts
}
// --- END OF FILE api.js ---