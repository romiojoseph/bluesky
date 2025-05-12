const BSKY_PDS_HOST = 'https://bsky.social';
const BSKY_PUBLIC_API_HOST = 'https://public.api.bsky.app';
const PLC_DIRECTORY_HOST = 'https://plc.directory';

async function fetchBskyApi(endpoint, method = 'GET', params = {}, body = null, accessJwt = null, usePublicHost = false, returnRawResponse = false, customHost = null) {
    let baseUrl;

    if (customHost) { // If a specific PDS host is provided for this call
        baseUrl = `${customHost}/xrpc`;
    } else if (endpoint.startsWith('plc/')) {
        baseUrl = PLC_DIRECTORY_HOST;
        endpoint = endpoint.substring(4);
    } else {
        baseUrl = usePublicHost ? `${BSKY_PUBLIC_API_HOST}/xrpc` : `${BSKY_PDS_HOST}/xrpc`;
    }

    const url = new URL(endpoint.startsWith('http') ? endpoint : `${baseUrl}/${endpoint}`);

    if (method === 'GET' && !endpoint.startsWith('http')) {
        Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
    }

    const options = {
        method: method,
        headers: {}
    };

    // Add Authorization header only if an accessJwt is provided AND we are not using the public host
    // AND we are not using a customHost that might be public (though customHost usually implies PDS)
    // For customHost, if it's a PDS action, JWT should be passed. If it's a public read on a specific PDS, JWT might be null.
    if (accessJwt && !usePublicHost && !customHost) { // Default PDS calls with JWT
        options.headers['Authorization'] = `Bearer ${accessJwt}`;
    } else if (accessJwt && customHost) { // Calls to a specific PDS with JWT
        options.headers['Authorization'] = `Bearer ${accessJwt}`;
    }


    if (body && method !== 'GET') {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch (e) {
                errorData = { message: response.statusText };
            }
            const errorMsg = `API Error (${response.status}) for ${url.pathname} on ${url.hostname}: ${errorData.error || errorData.message || 'Unknown error'}`;
            console.error(errorMsg, errorData); // Log the full error object too
            throw new Error(errorMsg);
        }

        if (returnRawResponse) {
            return response;
        }

        if (response.status === 204 || response.headers.get("content-length") === "0") {
            return null;
        }
        return await response.json();
    } catch (err) {
        console.error(`Fetch API error for ${url.toString()}:`, err);
        throw err;
    }
}

// Identity
async function resolveHandle(handle) {
    return fetchBskyApi('com.atproto.identity.resolveHandle', 'GET', { handle }, null, null, true);
}

// Session (These require Auth or are for creating sessions - use PDS_HOST by default)
async function createSession(identifier, appPassword) {
    return fetchBskyApi('com.atproto.server.createSession', 'POST', {}, { identifier, password: appPassword }, null, false);
}

async function refreshSession(refreshJwt) {
    return fetchBskyApi('com.atproto.server.refreshSession', 'POST', {}, null, refreshJwt, false);
}

async function deleteSession(accessJwt) {
    return fetchBskyApi('com.atproto.server.deleteSession', 'POST', {}, null, accessJwt, false);
}

async function getSession(accessJwt) {
    return fetchBskyApi('com.atproto.server.getSession', 'GET', {}, null, accessJwt, false);
}


// Repo
async function describeRepo(repoDid, pdsHostOverride = null) {
    // If pdsHostOverride is provided, use it. Otherwise, fetchBskyApi defaults to BSKY_PDS_HOST (if usePublicHost is false).
    // We want to hit the *actual* PDS for describeRepo.
    return fetchBskyApi('com.atproto.repo.describeRepo', 'GET', { repo: repoDid }, null, null, false, false, pdsHostOverride);
}

async function listRecords(repoDid, collectionNsid, limit = 50, cursor = null, accessJwt = null, pdsHostOverride = null) {
    const params = { repo: repoDid, collection: collectionNsid, limit };
    if (cursor) {
        params.cursor = cursor;
    }
    // If pdsHostOverride is provided, use it.
    // Otherwise, if no JWT, try public. If JWT, use default PDS.
    const usePublic = !accessJwt && !pdsHostOverride;
    return fetchBskyApi('com.atproto.repo.listRecords', 'GET', params, null, accessJwt, usePublic, false, pdsHostOverride);
}

async function deleteRecord(repoDid, collectionNsid, rkey, accessJwt, pdsHostOverride = null) {
    if (!accessJwt) throw new Error("Authentication required to delete record.");
    const body = {
        repo: repoDid,
        collection: collectionNsid,
        rkey: rkey
    };
    // Delete must go to the authoritative PDS.
    return fetchBskyApi('com.atproto.repo.deleteRecord', 'POST', {}, body, accessJwt, false, false, pdsHostOverride);
}


// Actor Profile (Public)
async function getActorProfile(actorIdentifier) {
    return fetchBskyApi('app.bsky.actor.getProfile', 'GET', { actor: actorIdentifier }, null, null, true);
}

async function searchActors(query, limit = 10) {
    return fetchBskyApi('app.bsky.actor.searchActors', 'GET', { q: query, limit: limit }, null, null, true);
}

// PLC Directory Log (Public) - This uses fetch directly, no changes needed here for PDS override
async function getPlcLog(did) {
    try {
        const response = await fetch(`${PLC_DIRECTORY_HOST}/${did}/log/audit`);
        if (!response.ok) {
            let errorBodyText = await response.text(); // Get raw text for better debugging
            console.error(`PLC Directory Error (${response.status}) for DID ${did}: ${response.statusText}. Body: ${errorBodyText}`);
            throw new Error(`PLC Directory Error (${response.status}): ${response.statusText}`);
        }
        return await response.json();
    } catch (err) {
        console.error(`Error fetching PLC log for DID ${did}:`, err);
        return null;
    }
}

async function listRepoBlobs(did, limit = 1000, cursor = null, accessJwt = null, pdsHostOverride = null) {
    if (!accessJwt) throw new Error("Authentication required to list blobs.");
    const params = { did: did, limit: limit };
    if (cursor) {
        params.cursor = cursor;
    }
    // listBlobs should go to the authoritative PDS.
    return fetchBskyApi('com.atproto.sync.listBlobs', 'GET', params, null, accessJwt, false, false, pdsHostOverride);
}

async function getRepoBlob(did, cid, accessJwt = null, pdsHostOverride = null) {
    if (!accessJwt) throw new Error("Authentication required to get blob.");
    const params = { did: did, cid: cid };
    // getBlob should go to the authoritative PDS.
    return fetchBskyApi('com.atproto.sync.getBlob', 'GET', params, null, accessJwt, false, true, pdsHostOverride);
}