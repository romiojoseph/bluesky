// js/api.js

const API = {
    baseUrl: 'https://public.api.bsky.app/xrpc',

    fetchXRPC: async (endpoint, params = {}) => {
        const url = new URL(`${API.baseUrl}/${endpoint}`);
        Object.keys(params).forEach(key => {
            if (params[key] !== undefined && params[key] !== null) {
                url.searchParams.append(key, params[key]);
            }
        });

        // console.log(`Fetching: ${url}`); // Removed log

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                let errorData;
                try {
                    errorData = await response.json();
                } catch (e) {
                    // If response is not JSON (e.g., plain text error, or network error)
                    errorData = { error: `HTTP Error ${response.status}`, message: await response.text() || response.statusText };
                }
                console.error(`API Error Response (${url}):`, errorData);
                // Try to provide a more specific message if possible
                let message = errorData.message || errorData.error || `HTTP error! status: ${response.status}`;
                // Check for common Bluesky error types if available
                if (errorData.error === 'RateLimitExceeded') {
                    message = 'Rate limit exceeded. Please try again later.';
                } else if (response.status === 404) {
                    message = 'Resource not found (404). Check the handle, DID, or URI.';
                } else if (response.status === 400 && message.toLowerCase().includes("resolve handle")) {
                    message = 'Could not resolve handle. Check the username.';
                } else if (response.status === 400 && message.toLowerCase().includes("list not found")) {
                    message = 'List not found. It might be private or deleted.';
                }

                throw new Error(message);
            }

            return await response.json();
        } catch (error) {
            // Log the error caught from fetch or response handling
            console.error(`Error during fetchXRPC (${url}):`, error);
            // Re-throw the potentially enhanced error message
            throw error;
        }
    },

    resolveHandle: async (handle) => {
        // Basic handle cleanup (remove '@', convert to lowercase)
        const cleanedHandle = handle.trim().replace(/^@/, '').toLowerCase();
        return API.fetchXRPC('com.atproto.identity.resolveHandle', { handle: cleanedHandle });
    },

    getProfile: async (actorDidOrHandle) => {
        // Use DID if provided, otherwise assume it's a handle
        const actor = actorDidOrHandle;
        return API.fetchXRPC('app.bsky.actor.getProfile', { actor });
    },

    getFeed: async (feedUri, limit = 75, cursor = null) => {
        return API.fetchXRPC('app.bsky.feed.getFeed', {
            feed: feedUri,
            limit: limit,
            cursor: cursor
        });
    },

    getListFeed: async (listUri, limit = 75, cursor = null) => {
        // console.log(`Attempting API.getListFeed for URI: ${listUri}`); // Removed log
        return API.fetchXRPC('app.bsky.feed.getListFeed', {
            list: listUri,
            limit: limit,
            cursor: cursor
        });
    },

    getAuthorFeed: async (actorDid, limit = 75, cursor = null) => {
        return API.fetchXRPC('app.bsky.feed.getAuthorFeed', {
            actor: actorDid,
            limit: limit,
            cursor: cursor
        });
    },

    getPostThread: async (postUri, depth = 1, parentHeight = 0) => {
        return API.fetchXRPC('app.bsky.feed.getPostThread', {
            uri: postUri,
            depth: depth,
            parentHeight: parentHeight
        });
    }
};