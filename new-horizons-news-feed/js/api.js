import { API_BASE_URL, POSTS_PER_PAGE, MODAL_POSTS_PER_PAGE, PROFILES_PER_CALL } from './config.js';
import { appState } from './state.js';

async function fetchData(endpoint, params = {}) {
    const url = new URL(`${API_BASE_URL}/${endpoint}`);
    Object.keys(params).forEach(key => {
        if (params[key] !== null && params[key] !== undefined) {
            url.searchParams.append(key, params[key]);
        }
    });
    // console.log(`Fetching: ${url}`);
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            console.error(`API Error (${response.status}) for ${endpoint}:`, errorData.message || response.statusText);
            throw new Error(`API Error: ${errorData.message || response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Network or fetch error for ${endpoint}:`, error);
        throw error;
    }
}

export async function getListFeed(listUri, cursor = null, limit = POSTS_PER_PAGE) {
    return fetchData('app.bsky.feed.getListFeed', { list: listUri, limit, cursor });
}

export async function getFeed(feedUri, cursor = null, limit = POSTS_PER_PAGE) {
    return fetchData('app.bsky.feed.getFeed', { feed: feedUri, limit, cursor });
}

export async function getAuthorFeed(actorHandle, cursor = null, limit = POSTS_PER_PAGE) {
    return fetchData('app.bsky.feed.getAuthorFeed', { actor: actorHandle, limit, cursor });
}

export async function getListMembers(listUri, cursor = null, limit = POSTS_PER_PAGE) {
    return fetchData('app.bsky.graph.getList', { list: listUri, limit, cursor });
}

export async function getPostThread(postUri) {
    // The 'depth' parameter influences how many parent posts are fetched.
    // For replies, the direct replies are usually included in thread.replies.
    // The API doc says "Possible values: <= 1000" for depth, but that's for parents mainly.
    // Let's fetch a reasonable depth if needed, or rely on default for direct replies.
    return fetchData('app.bsky.feed.getPostThread', { uri: postUri, depth: 5 /* Example depth */ });
}

export async function getQuotes(postUri, cursor = null, limit = MODAL_POSTS_PER_PAGE) {
    console.log("Fetching quotes with params:", { postUri, cursor, limit });
    const result = await fetchData('app.bsky.feed.getQuotes', { uri: postUri, limit, cursor });
    console.log("Got quotes result:", result);
    return result;
}

export async function getProfiles(dids = []) {
    if (!dids || dids.length === 0) return { profiles: [] };
    // API takes multiple actors, max 25
    const uniqueDids = [...new Set(dids)];
    const batchedDids = [];
    for (let i = 0; i < uniqueDids.length; i += PROFILES_PER_CALL) {
        batchedDids.push(uniqueDids.slice(i, i + PROFILES_PER_CALL));
    }

    const profiles = [];
    for (const batch of batchedDids) {
        try {
            const data = await fetchData('app.bsky.actor.getProfiles', { actors: batch.join(',') });
            if (data.profiles) {
                profiles.push(...data.profiles);
            }
        } catch (error) {
            console.error("Failed to fetch profiles for batch:", batch, error);
        }
    }
    return { profiles };
}