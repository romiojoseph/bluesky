// BSKY_HOST and PLC_DIRECTORY_HOST are now managed in api.js

// getActorProfile and getPlcLog are now in api.js

async function fetchFullProfileData(handleOrDid) {
    try {
        let did = handleOrDid;
        let initialHandle = handleOrDid; // Store original input

        if (!handleOrDid.startsWith('did:')) {
            const identity = await resolveHandle(handleOrDid); // resolveHandle is public
            if (!identity || !identity.did) {
                throw new Error(`Could not resolve handle: ${handleOrDid}`);
            }
            did = identity.did;
            initialHandle = handleOrDid; // Keep the original handle if resolution was needed
        }
        // If it was a DID, initialHandle will be the DID itself for now.

        // Fetch both simultaneously
        const [bskyProfile, plcLog] = await Promise.all([
            getActorProfile(did), // getActorProfile now correctly marked as public in api.js
            getPlcLog(did)        // getPlcLog now in api.js, handles its own fetch
        ]);

        if (!bskyProfile) {
            // If bskyProfile is null, it might be due to a 404 (not found) or other error
            // that getActorProfile might have handled by returning null (if we choose that path)
            // For now, assuming it throws on critical errors.
            throw new Error(`Failed to fetch Bluesky profile data for ${did}.`);
        }

        // Use the handle from bskyProfile as the canonical one
        const canonicalHandle = bskyProfile.handle;
        // If we started with a handle and it resolved to a DID that then gave a *different* canonical handle,
        // it's good to be aware, but for display, canonical is usually best.
        // For primaryAtURI, we'll still prefer what PLC log says if available.

        let latestPlcOperation = null;
        let pdsInfo = { type: 'N/A', endpoint: '#' };
        let primaryAtURIFromPlc = null;

        if (plcLog && plcLog.length > 0) {
            latestPlcOperation = plcLog[plcLog.length - 1].operation;
            if (latestPlcOperation && latestPlcOperation.services && latestPlcOperation.services.atproto_pds) {
                pdsInfo.type = latestPlcOperation.services.atproto_pds.type || 'N/A';
                pdsInfo.endpoint = latestPlcOperation.services.atproto_pds.endpoint || '#';
            }
            if (latestPlcOperation && latestPlcOperation.alsoKnownAs && latestPlcOperation.alsoKnownAs.length > 0) {
                // Prefer the one that matches the canonical handle from bskyProfile, or the first one
                primaryAtURIFromPlc = latestPlcOperation.alsoKnownAs.find(aka => aka === `at://${canonicalHandle}`) || latestPlcOperation.alsoKnownAs[0];
            }
        }

        // Determine the primary at:// URI for display
        // If PLC provided one, use it. Otherwise, construct from canonical handle.
        const primaryAtURI = primaryAtURIFromPlc || `at://${canonicalHandle}`;

        return {
            bskyProfile,
            plcLog,
            processed: {
                did: bskyProfile.did,
                handle: canonicalHandle,
                displayName: bskyProfile.displayName || canonicalHandle,
                avatar: bskyProfile.avatar,
                description: bskyProfile.description,
                followersCount: bskyProfile.followersCount || 0,
                followsCount: bskyProfile.followsCount || 0,
                postsCount: bskyProfile.postsCount || 0,
                indexedAt: bskyProfile.indexedAt,
                createdAt: (plcLog && plcLog.length > 0 && plcLog[0].createdAt) ? plcLog[0].createdAt : null,
                labels: bskyProfile.labels || [],
                associated: bskyProfile.associated || {},
                verification: bskyProfile.verification || {},
                pds: pdsInfo,
                primaryAtURI: primaryAtURI,
                isLabeler: (bskyProfile.associated && bskyProfile.associated.labeler === true)
            }
        };
    } catch (error) {
        console.error(`Error fetching full profile data for "${handleOrDid}":`, error.message);
        // It might be useful to see the full error object too: console.error(error);
        throw error;
    }
}