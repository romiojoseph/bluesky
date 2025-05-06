function parseBlueskyUrl(input) {
    try {
        // First check if it's a handle or DID
        if (!input.includes('://')) {
            // Remove any leading @ if present
            const identifier = input.startsWith('@') ? input.substring(1) : input;

            // Check if it's a handle (contains dots) or DID
            if (identifier.includes('.') || identifier.startsWith('did:')) {
                return {
                    originalUrl: input,
                    identifier: identifier,
                    type: 'profile',
                    resourceId: null,
                    atUri: null
                };
            }
        }

        // Try parsing as URL
        let parsedUrl;
        try {
            parsedUrl = new URL(input.startsWith('http') ? input : `https://bsky.app/profile/${input}`);
        } catch {
            // If URL parsing fails, treat as handle/DID
            return {
                originalUrl: input,
                identifier: input,
                type: 'profile',
                resourceId: null,
                atUri: null
            };
        }

        // Continue with existing URL parsing logic
        if (parsedUrl.hostname !== 'bsky.app') {
            console.warn(`Non-bsky.app hostname treated as handle: ${parsedUrl.hostname}`);
            return {
                originalUrl: input,
                identifier: input,
                type: 'profile',
                resourceId: null,
                atUri: null
            };
        }

        const pathParts = parsedUrl.pathname.split('/').filter(part => part);

        if (pathParts.length < 2 || pathParts[0] !== 'profile') {
            console.warn(`Invalid path structure: ${parsedUrl.pathname}`);
            return null;
        }

        const identifier = pathParts[1]; // This could be a handle or a DID
        let type = 'profile';
        let atUri = null;
        let resourceId = null;

        if (pathParts.length >= 4) {
            type = pathParts[2]; // 'feed', 'lists', etc.
            resourceId = pathParts[3];

            if (type === 'feed' || type === 'lists') {
                const collection = type === 'feed' ? 'app.bsky.feed.generator' : 'app.bsky.graph.list';
                // We need the DID to construct the AT URI. We'll resolve the handle later if needed.
                atUri = `at://${identifier}/${collection}/${resourceId}`; // Placeholder, might need DID lookup
            } else {
                console.warn(`Unsupported resource type in URL: ${type}`);
                return null; // Or handle other types if needed
            }
        }

        return {
            originalUrl: input,
            identifier: identifier, // Handle or DID
            type: type,
            resourceId: resourceId,
            atUri: atUri // This will be null for profiles initially, and potentially needs DID for feeds/lists
        };
    } catch (e) {
        console.error(`Failed to parse URL "${input}":`, e);
        return {
            originalUrl: input,
            identifier: input,
            type: 'profile',
            resourceId: null,
            atUri: null
        };
    }
}

async function resolveIdentifierToDid(identifier) {
    if (identifier.startsWith('did:')) {
        return identifier; // Already a DID
    }
    // Assume it's a handle, try to resolve it
    try {
        const response = await fetch(`${API_BASE_URL}/xrpc/com.atproto.identity.resolveHandle?handle=${identifier}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.did;
    } catch (error) {
        console.error(`Failed to resolve handle ${identifier}:`, error);
        return null; // Failed to resolve
    }
}

// Function to ensure we have the AT URI, resolving handle if necessary
async function ensureAtUri(parsedInfo) {
    if (parsedInfo.type === 'profile') {
        // Profiles don't use AT URI for fetching posts directly in the way we use it here
        return parsedInfo.identifier; // Return DID or handle for profile fetching
    }

    if (parsedInfo.atUri && parsedInfo.atUri.startsWith('at://did:')) {
        return parsedInfo.atUri; // Already have a DID-based AT URI
    }

    // Need to resolve the identifier (handle) to a DID
    const did = await resolveIdentifierToDid(parsedInfo.identifier);
    if (!did) {
        console.error(`Could not resolve DID for identifier: ${parsedInfo.identifier}`);
        return null;
    }

    const collection = parsedInfo.type === 'feed' ? 'app.bsky.feed.generator' : 'app.bsky.graph.list';
    parsedInfo.atUri = `at://${did}/${collection}/${parsedInfo.resourceId}`;
    return parsedInfo.atUri;
}