const API_BASE_URL = 'https://public.api.bsky.app';

async function fetchData(endpoint, params = {}) {
    const url = new URL(`${API_BASE_URL}/xrpc/${endpoint}`);
    Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            console.error(`API Error (${response.status}) for ${endpoint}:`, errorData);
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData.message || 'Unknown API error'}`);
        }
        if (response.status === 204) { return null; }
        return await response.json();
    } catch (error) {
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            console.error(`Network error while fetching ${endpoint}:`, error);
            throw new Error('Network error: Failed to connect to the API.');
        } else {
            console.error(`Failed to fetch or parse ${endpoint}:`, error);
            throw error;
        }
    }
}

async function getProfileDetails(actor) {
    return fetchData('app.bsky.actor.getProfile', { actor });
}

async function getListDetails(listUri) {
    return fetchData('app.bsky.graph.getList', { list: listUri });
}

async function getFeedGeneratorDetails(feedUri) {
    return fetchData('app.bsky.feed.getFeedGenerator', { feed: feedUri });
}

async function getAuthorFeed(actor, limit = 30, cursor = undefined) {
    const params = { actor, limit };
    if (cursor) params.cursor = cursor;
    return fetchData('app.bsky.feed.getAuthorFeed', params);
}

async function getListFeed(listUri, limit = 30, cursor = undefined) {
    const params = { list: listUri, limit };
    if (cursor) params.cursor = cursor;
    return fetchData('app.bsky.feed.getListFeed', params);
}

async function getFeed(feedUri, limit = 30, cursor = undefined) {
    const params = { feed: feedUri, limit };
    if (cursor) params.cursor = cursor;
    return fetchData('app.bsky.feed.getFeed', params);
}

async function getPostThread(uri, depth = 1, parentHeight = 0) {
    const params = { uri, depth, parentHeight };
    return fetchData('app.bsky.feed.getPostThread', params);
}

async function getQuotes(uri, limit = 50, cursor = undefined) {
    const params = { uri, limit };
    if (cursor) params.cursor = cursor;
    return fetchData('app.bsky.feed.getQuotes', params);
}