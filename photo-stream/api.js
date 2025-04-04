const BSKY_API_BASE = "https://public.api.bsky.app/xrpc";

/**
 * Resolves a Bluesky handle to a DID.
 * @param {string} handle - The user handle (e.g., username.bsky.social).
 * @returns {Promise<string|null>} The DID string or null if resolution fails.
 */
export async function resolveHandle(handle) {
    // Handles starting with 'did:' should not be resolved, return null to indicate failure if passed here.
    if (typeof handle === 'string' && handle.startsWith('did:')) {
        console.error(`resolveHandle called with a DID, which shouldn't happen: ${handle}`);
        return null;
    }
    if (!handle || typeof handle !== 'string') {
        console.error(`resolveHandle called with invalid handle: ${handle}`);
        return null;
    }

    const endpoint = `${BSKY_API_BASE}/com.atproto.identity.resolveHandle`;
    const params = new URLSearchParams({ handle });
    try {
        const response = await fetch(`${endpoint}?${params}`);
        if (!response.ok) {
            const errorText = await response.text(); // Read error text first
            console.error(`Error resolving handle ${handle}: ${response.status}`);
            console.error("Response:", errorText);
            // Try to parse JSON for a more specific message
            try {
                const jsonError = JSON.parse(errorText);
                if (jsonError.message) throw new Error(jsonError.message);
            } catch (e) { /* Ignore parse error */ }
            // Throw generic error if parsing failed or no message found
            throw new Error(`Failed to resolve handle (${response.status})`);
        }
        const data = await response.json();
        return data.did;
    } catch (error) {
        console.error("Network or fetch error resolving handle:", error);
        // Re-throw specific error message if available, otherwise generic
        throw new Error(error.message || `Network error resolving handle.`);
    }
}

/**
 * Parses a Bluesky URL to extract type, author (handle or clean DID), author type, and list/feed ID.
 * @param {string} url - The Bluesky profile URL for a list or feed.
 * @returns {{type: 'list'|'feed', author: string, authorType: 'handle'|'did', id: string}|null} Info object or null if invalid.
 */
export function parseBlueskyUrl(url) {
    try {
        const urlObj = new URL(url);
        // Allow bsky.app and staging.bsky.app
        if (urlObj.hostname !== 'bsky.app' && urlObj.hostname !== 'staging.bsky.app') {
            console.warn("Hostname is not bsky.app or staging.bsky.app:", urlObj.hostname);
            return null;
        }

        const pathParts = urlObj.pathname.split('/').filter(part => part); // Remove empty parts
        // Need at least profile/[identifier]/type/id (4 parts)
        if (pathParts.length < 4 || pathParts[0] !== 'profile') {
            console.warn("URL path doesn't match expected profile/... pattern:", urlObj.pathname);
            return null;
        }

        let authorIdentifier = pathParts[1]; // e.g., "handle.bsky.social" OR "did:plc:..." OR "did=did:plc:..."
        const entityType = pathParts[2]; // 'lists' or 'feed'
        const entityId = pathParts[3];

        let authorType = 'handle'; // Assume handle by default
        let finalAuthorValue = authorIdentifier; // Start with the raw identifier

        if (authorIdentifier) {
            // Case 1: Identifier starts directly with 'did:'
            if (authorIdentifier.startsWith('did:')) {
                authorType = 'did';
                // finalAuthorValue is already the correct clean DID
            }
            // Case 2: Identifier starts with 'did='
            else if (authorIdentifier.startsWith('did=')) {
                authorType = 'did';
                // Extract the actual DID *after* "did="
                finalAuthorValue = authorIdentifier.substring(4); // Remove "did=" prefix
                // Validate that the rest looks like a DID
                if (!finalAuthorValue.startsWith('did:')) {
                    console.warn("Malformed DID identifier found after 'did=':", authorIdentifier);
                    return null; // Treat as invalid URL if format is wrong after "did="
                }
            }
            // Case 3: Neither of the above, assume it's a handle
            else {
                authorType = 'handle';
                // finalAuthorValue remains the handle string
            }
        } else {
            console.warn("Missing author identifier in URL path:", urlObj.pathname);
            return null; // Cannot proceed without identifier
        }


        // Return the object based on list or feed type
        if (entityType === 'lists') {
            return {
                type: 'list',
                author: finalAuthorValue, // Use the cleaned/correct value
                authorType: authorType,
                id: entityId
            };
        }
        if (entityType === 'feed') {
            return {
                type: 'feed',
                author: finalAuthorValue, // Use the cleaned/correct value
                authorType: authorType,
                id: entityId
            };
        }

        console.warn("URL path doesn't match expected list/feed pattern:", urlObj.pathname);
        return null; // Not a recognized feed or list URL structure
    } catch (e) {
        // Handle cases where new URL(url) fails (e.g., invalid format)
        console.error("Invalid URL format provided:", url, e);
        return null;
    }
}


/**
 * Fetches posts from a specific Bluesky list feed.
 * @param {string} authorDid - The DID of the list author.
 * @param {string} listId - The rkey (ID) of the list.
 * @param {number} limit - Maximum number of posts to fetch in this batch.
 * @param {string|null} cursor - API cursor for pagination.
 * @returns {Promise<{posts: Array<object>, cursor: string|null}>} Object containing posts and the next cursor.
 */
export async function fetchPostsFromList(authorDid, listId, limit, cursor = null) {
    const listUri = `at://${authorDid}/app.bsky.graph.list/${listId}`;
    const endpoint = `${BSKY_API_BASE}/app.bsky.feed.getListFeed`;
    return fetchPaginatedFeed(endpoint, { list: listUri }, limit, cursor);
}

/**
 * Fetches posts from a specific Bluesky custom feed.
 * @param {string} authorDid - The DID of the feed author.
 * @param {string} feedId - The rkey (ID) of the feed generator.
 * @param {number} limit - Maximum number of posts to fetch in this batch.
 * @param {string|null} cursor - API cursor for pagination.
 * @returns {Promise<{posts: Array<object>, cursor: string|null}>} Object containing posts and the next cursor.
 */
export async function fetchPostsFromFeed(authorDid, feedId, limit, cursor = null) {
    const feedUri = `at://${authorDid}/app.bsky.feed.generator/${feedId}`;
    const endpoint = `${BSKY_API_BASE}/app.bsky.feed.getFeed`;
    return fetchPaginatedFeed(endpoint, { feed: feedUri }, limit, cursor);
}

/**
 * Generic function to fetch feed data with pagination.
 * Filters posts to include only those with images *before* returning.
 * @param {string} endpoint - The specific Bluesky API endpoint URL.
 * @param {object} initialParams - Base parameters for the API call (e.g., {list: 'at://...'} or {feed: 'at://...'}).
 * @param {number} limit - The number of posts to fetch in this specific call.
 * @param {string|null} cursor - The cursor for pagination, if any.
 * @returns {Promise<{posts: Array<object>, cursor: string|null}>} Object containing image posts and the next cursor.
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
            // Try to parse JSON error for more details if possible
            let detail = errorText;
            try {
                const jsonError = JSON.parse(errorText);
                detail = jsonError.message || jsonError.error || detail;
            } catch (parseError) { /* Ignore if error response is not JSON */ }
            throw new Error(`API Error (${response.status}): ${detail}.`);
        }
        const data = await response.json();

        let postsWithMedia = [];
        if (data.feed && data.feed.length > 0) {
            postsWithMedia = data.feed
                .map(item => item.post) // Get the post object
                .filter(post => post && hasImages(post)); // Filter for posts with images
            console.log(`Fetched ${data.feed.length} total posts, ${postsWithMedia.length} have images.`);
        } else {
            console.log("No posts in this response batch.");
        }

        return {
            posts: postsWithMedia,
            cursor: data.cursor || null // Return the new cursor or null if none
        };

    } catch (error) {
        console.error("Error during paginated fetch:", error);
        // Add more specific error message for network issues
        if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
            throw new Error(`Network error: Unable to connect to the Bluesky API. Please check your connection.`);
        }
        // Re-throw API errors or other unexpected errors
        throw error;
    }
}

/**
 * Checks if a post object contains image embeds.
 * @param {object} post - The Bluesky post object.
 * @returns {boolean} True if the post has images, false otherwise.
 */
function hasImages(post) {
    // Check for post, embed, and the specific embed types containing images
    return post && post.embed &&
        (
            (post.embed.$type === 'app.bsky.embed.images#view' && Array.isArray(post.embed.images) && post.embed.images.length > 0) ||
            (post.embed.$type === 'app.bsky.embed.recordWithMedia#view' && post.embed.media && post.embed.media.$type === 'app.bsky.embed.images#view' && Array.isArray(post.embed.media.images) && post.embed.media.images.length > 0)
        );
}