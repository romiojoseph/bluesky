// js/api.js

export const publicApiEndpoint = 'https://public.api.bsky.app/xrpc';

/**
 * Resolves a Bluesky handle to a DID.
 * @param {string} handle - The handle to resolve.
 * @returns {Promise<string>} - The DID.
 * @throws {Error} - If resolution fails.
 */
export async function resolveHandle(handle) {
    const resolveHandleUrl = `${publicApiEndpoint}/com.atproto.identity.resolveHandle?handle=${handle}`;
    try {
        const response = await fetch(resolveHandleUrl);
        if (!response.ok) {
            let errorMsg = `Status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += ` - ${errorData.message || response.statusText}`;
            } catch (e) { /* ignore json parsing error */ }
            throw new Error(`Failed to resolve handle '${handle}'. ${errorMsg}`);
        }
        const data = await response.json();
        if (!data.did) {
            throw new Error(`Could not find DID for handle '${handle}'.`);
        }
        return data.did;
    } catch (error) {
        console.error("Handle resolution error:", error);
        throw error; // Re-throw to be caught by the caller
    }
}

/**
 * Fetches post details using the getPosts endpoint.
 * @param {string} atUri - The AT URI of the post to fetch.
 * @returns {Promise<object>} - The post object.
 * @throws {Error} - If fetching fails or post not found.
 */
export async function fetchPost(atUri) {
    const getPostsUrl = `${publicApiEndpoint}/app.bsky.feed.getPosts?uris=${encodeURIComponent(atUri)}`;
    try {
        const response = await fetch(getPostsUrl);
        if (!response.ok) {
            let errorMsg = `Status: ${response.status}`;
            try {
                const errorData = await response.json();
                errorMsg += ` - ${errorData.message || response.statusText}`;
            } catch (e) { /* ignore json parsing error */ }
            throw new Error(`Failed to fetch post. ${errorMsg} (URI: ${atUri})`);
        }
        const result = await response.json();

        if (!result.posts || result.posts.length === 0) {
            throw new Error(`Post not found or access denied for URI: ${atUri}`);
        }
        return result.posts[0]; // Return the first (and only) post
    } catch (error) {
        console.error("Fetch post error:", error);
        throw error; // Re-throw
    }
}