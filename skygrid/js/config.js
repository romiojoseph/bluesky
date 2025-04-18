// js/config.js

const Config = {
    rawConfig: [],
    processedConfig: [],
    uniqueHandles: new Map(), // Cache resolved DIDs { handle: did }

    load: async () => {
        try {
            const response = await fetch('/assets/config.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            Config.rawConfig = await response.json();
            // console.log("Raw config loaded:", Config.rawConfig); // Removed log
            return Config.rawConfig;
        } catch (error) {
            console.error('Failed to load /assets/config.json:', error);
            UI.showError('Could not load configuration file.');
            throw error;
        }
    },

    process: async () => {
        Config.processedConfig = [];
        const resolutionPromises = [];
        const handlesToResolve = new Set();

        // First pass: Identify all unique handles needing resolution from URLs
        for (const item of Config.rawConfig) {
            const parsedUrl = Utils.parseBskyUrl(item.url); // Use the Utils parser
            if (!parsedUrl) {
                console.warn(`Skipping invalid or unparseable URL in config: ${item.url}`);
                continue; // Skip if basic parsing fails
            }
            // Only try to resolve if identifier is not already a DID
            if (!parsedUrl.identifier.startsWith('did:')) {
                handlesToResolve.add(parsedUrl.identifier);
            }
        }

        // Second pass: Queue resolution promises for unique handles
        for (const handle of handlesToResolve) {
            if (!Config.uniqueHandles.has(handle)) {
                // Add placeholder to prevent duplicate requests
                Config.uniqueHandles.set(handle, 'resolving');
                resolutionPromises.push(
                    API.resolveHandle(handle)
                        .then(data => {
                            if (data && data.did) {
                                Config.uniqueHandles.set(handle, data.did);
                                // console.log(`Resolved ${handle} -> ${data.did}`); // Removed log
                            } else {
                                // Keep 'resolving' or set to null if API returns no DID
                                Config.uniqueHandles.set(handle, null); // Mark as failed resolution
                                throw new Error(`API resolveHandle returned no DID for: ${handle}`);
                            }
                        })
                        .catch(error => {
                            console.error(`Failed to resolve handle ${handle}:`, error.message);
                            Config.uniqueHandles.set(handle, null); // Mark as failed resolution
                            // We don't re-throw here, just log and mark failure
                        })
                );
            }
        }

        // Wait for all resolutions to attempt completion
        await Promise.allSettled(resolutionPromises); // Use allSettled to proceed even if some fail
        // console.log("Handle resolution attempt complete. Cache:", Config.uniqueHandles); // Removed log


        // Final pass: Build the processed config
        for (const item of Config.rawConfig) {
            const parsedUrl = Utils.parseBskyUrl(item.url); // Parse again
            if (!parsedUrl || !parsedUrl.type || !parsedUrl.rkey || !parsedUrl.identifier) {
                console.warn(`Skipping item '${item.name}' due to incomplete parsing: ${item.url}`);
                continue; // Skip if parsing failed or didn't yield expected parts
            }

            const { type, identifier, rkey } = parsedUrl;
            let did = identifier.startsWith('did:') ? identifier : Config.uniqueHandles.get(identifier);

            // Handle cases where resolution failed or is still pending (shouldn't be pending here)
            if (!did || did === 'resolving') {
                console.warn(`Skipping item '${item.name}' due to unresolved/failed handle: ${identifier}`);
                continue;
            }

            let collection = '';
            if (type === 'feed') {
                collection = 'app.bsky.feed.generator';
            } else if (type === 'list') {
                collection = 'app.bsky.graph.list';
            } else {
                // This case should be caught by parseBskyUrl, but double-check
                console.warn(`Unsupported type '${type}' identified during config processing for URL: ${item.url}`);
                continue;
            }

            const atUri = `at://${did}/${collection}/${rkey}`;
            // console.log(`Processed config item '${item.name}': Type=${type}, Identifier=${identifier}, Resolved DID=${did}, rkey=${rkey}, Final AT URI=${atUri}`); // Removed log
            Config.processedConfig.push({
                name: item.name,
                url: item.url, // Keep original URL for reference if needed
                atUri: atUri,
                type: type // 'feed' or 'list'
            });
        }

        // console.log("Final processed config:", Config.processedConfig); // Removed log
        if (Config.processedConfig.length === 0 && Config.rawConfig.length > 0) {
            UI.showError("Failed to process any feeds/lists from config. Check URLs and console logs.");
        } else if (Config.processedConfig.length < Config.rawConfig.length) {
            console.warn("Some items from /assets/config.json were skipped due to errors (see logs above).")
        }
        return Config.processedConfig;
    },

    // parseBskyUrl moved to Utils.js
};