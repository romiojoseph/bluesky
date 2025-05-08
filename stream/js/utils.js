const DEFAULT_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2NjYyI+PHBhdGggZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bTAgM2M0LjQxIDAgOCAzLjU5IDggOHMtMy41OSA4LTggOC04LTMuNTktOC04IDMuNTktOCA4IDh6bTAgMmMtMi4yMSAwLTQgMS43OS00IDRzMS43OSA0IDQgNCA0LTEuNzkgNC00LTEuNzktNC00LTR6Ii8+PC9zdmc+';
const MAX_REPLY_DEPTH = 3;
const CONTENT_LABELS_TO_HIDE = ['porn', 'sexual', 'nudity', 'graphic-media'];

function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
}

function formatRelativeTime(isoDateString) {
    const date = new Date(isoDateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);

    const T = [1, 60, 3600, 86400, 2592000, 31536000, Infinity];
    const S = ["s", "m", "h", "d", "mo", "y"];

    let i = 0;
    while (T[i] < seconds && T[i + 1] <= seconds) i++;

    const val = Math.floor(seconds / T[i]);

    if (S[i] === "y") {
        const yearsExact = (now.getFullYear() - date.getFullYear()) + (now.getMonth() - date.getMonth()) / 12 + (now.getDate() - date.getDate()) / 365.25;
        if (yearsExact < 1) {
            i = 4;
            const monthsVal = Math.floor(seconds / T[i]);
            return `${monthsVal}${S[i]}`;
        }
        return `${yearsExact.toFixed(1)}${S[i]}`;
    }
    if (S[i] === "mo") {
        const monthsVal = Math.floor(seconds / (30.44 * 86400));
        return `${monthsVal}${S[i]}`;
    }
    return `${val}${S[i]}`;
}

function formatAbsoluteDateTime(isoDateString) {
    const date = new Date(isoDateString);
    const optionsDate = { day: '2-digit', month: 'short', year: 'numeric' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', hour12: true };
    const formattedDate = date.toLocaleDateString('en-GB', optionsDate);
    const formattedTime = date.toLocaleTimeString('en-US', optionsTime);
    return `${formattedDate}, ${formattedTime}`;
}

function formatNumberWithCommas(number) {
    if (typeof number !== 'number') return number;
    return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function showGlobalSpinner(message = 'Loading...') {
    const spinner = document.getElementById('globalSpinner');
    const spinnerMessage = document.getElementById('spinnerMessage');
    if (spinner && spinnerMessage) {
        spinnerMessage.textContent = message;
        spinner.style.display = 'flex';
    }
}

function hideGlobalSpinner() {
    const spinner = document.getElementById('globalSpinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

async function resolveHandleToDid(handle) {
    const apiUrl = `https://public.api.bsky.app/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ message: response.statusText }));
            throw new Error(`Failed to resolve handle '${handle}': ${response.status} ${errorData.message || response.statusText}`);
        }
        const data = await response.json();
        if (data.did) {
            return data.did;
        } else {
            throw new Error(`DID not found in response for handle '${handle}'.`);
        }
    } catch (error) {
        console.error('Error resolving handle:', error);
        throw error;
    }
}

async function getAtUriFromInput(urlValue, showMessageCallback) {
    if (urlValue.startsWith('at://')) {
        if (urlValue.includes('/app.bsky.feed.post/')) {
            return urlValue;
        } else if (urlValue.includes('/app.bsky.feed.generator/')) {
            return urlValue;
        } else {
            throw new Error('Invalid AT URI format. Expected post or feed generator URI.');
        }
    }

    const blueskyWebPostUrlRegex = /https?:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/;
    const blueskyWebFeedUrlRegex = /https?:\/\/bsky\.app\/profile\/([^/]+)\/feed\/([^/?#]+)/;

    let match = urlValue.match(blueskyWebPostUrlRegex);
    let type = 'post';

    if (!match) {
        match = urlValue.match(blueskyWebFeedUrlRegex);
        type = 'feed';
    }

    if (match) {
        let identifier = match[1];
        const rkey = match[2];
        let did = null;

        if (identifier.startsWith('did:')) {
            did = identifier;
        } else {
            if (showMessageCallback) showMessageCallback(`Resolving handle: ${identifier}...`, false, true, true);
            try {
                did = await resolveHandleToDid(identifier);
            } catch (resolveError) {
                if (showMessageCallback) showMessageCallback('', false, false, false);
                throw new Error(`Could not resolve Bluesky handle '${identifier}': ${resolveError.message}`);
            }
        }
        if (did) {
            if (type === 'post') {
                return `at://${did}/app.bsky.feed.post/${rkey}`;
            } else if (type === 'feed') {
                return `at://${did}/app.bsky.feed.generator/${rkey}`;
            }
        } else {
            throw new Error('Failed to obtain DID for the author/generator.');
        }
    }
    throw new Error('URL is not a recognized Bluesky post/feed URL or AT URI.');
}


async function convertFeedPageUrlToAtUri(feedPageUrl, showMessageCallback) {
    const feedUrlRegex = /https?:\/\/bsky\.app\/profile\/([^/]+)\/feed\/([^/?#]+)/;
    const atUriRegex = /at:\/\/([^/]+)\/app\.bsky\.feed\.generator\/([^/?#]+)/;

    let match = feedPageUrl.match(feedUrlRegex);
    if (match) {
        const identifier = match[1];
        const feedRkey = match[2];
        let did;

        if (identifier.startsWith('did:')) {
            did = identifier;
        } else {
            if (showMessageCallback) showMessageCallback(`Resolving handle for feed: ${identifier}...`, false, true, true);
            try {
                did = await resolveHandleToDid(identifier);
            } catch (resolveError) {
                if (showMessageCallback) showMessageCallback('', false, false, false);
                throw new Error(`Could not resolve Bluesky handle '${identifier}' for feed: ${resolveError.message}`);
            } finally {
                if (showMessageCallback && !(did)) showMessageCallback('', false, false, false);
            }
        }

        if (did) {
            if (showMessageCallback) showMessageCallback('', false, false, false);
            return `at://${did}/app.bsky.feed.generator/${feedRkey}`;
        } else {
            throw new Error('Failed to obtain DID for the feed author.');
        }
    } else {
        match = feedPageUrl.match(atUriRegex);
        if (match) {
            return feedPageUrl;
        }
    }
    throw new Error('URL is not a recognized Bluesky feed URL or feed AT URI.');
}


function getDomain(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch (e) {
        return url;
    }
}

function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function parseFacetsToHtml(text, facets, urlInputRef, searchButtonRef) {
    if (!facets || facets.length === 0 || !text) {
        return escapeHtml(text);
    }

    const textEncoder = new TextEncoder();
    const textBytes = textEncoder.encode(text);

    const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

    let html = '';
    let lastByteEnd = 0;

    sortedFacets.forEach(facet => {
        if (facet.index.byteStart > lastByteEnd) {
            const plainTextSegment = new TextDecoder().decode(textBytes.slice(lastByteEnd, facet.index.byteStart));
            html += escapeHtml(plainTextSegment);
        }

        const facetTextSegment = new TextDecoder().decode(textBytes.slice(facet.index.byteStart, facet.index.byteEnd));
        const escapedFacetText = escapeHtml(facetTextSegment);

        if (facet.features) {
            let processedFeature = false;
            facet.features.forEach(feature => {
                if (feature.$type === 'app.bsky.richtext.facet#mention' && feature.did) {
                    const mentionUrl = `https://bsky.app/profile/${feature.did}`;
                    html += `<a href="${mentionUrl}" target="_blank" rel="noopener noreferrer" class="facet-mention">${escapedFacetText}</a>`;
                    processedFeature = true;
                } else if (feature.$type === 'app.bsky.richtext.facet#link' && feature.uri) {
                    if (feature.uri.includes('bsky.app/profile/') && feature.uri.includes('/post/')) {
                        html += `<a href="#" data-bsky-link="${escapeHtml(feature.uri)}" class="facet-link internal-bsky-link">${escapedFacetText}</a>`;
                    } else {
                        html += `<a href="${escapeHtml(feature.uri)}" target="_blank" rel="noopener noreferrer" class="facet-link">${escapedFacetText}</a>`;
                    }
                    processedFeature = true;
                } else if (feature.$type === 'app.bsky.richtext.facet#tag' && feature.tag) {
                    const tagUrl = `https://bsky.app/search?q=${encodeURIComponent(feature.tag)}`;
                    html += `<a href="${tagUrl}" target="_blank" rel="noopener noreferrer" class="facet-tag">${escapedFacetText}</a>`;
                    processedFeature = true;
                }
            });
            if (!processedFeature) {
                html += escapedFacetText;
            }
        } else {
            html += escapedFacetText;
        }
        lastByteEnd = facet.index.byteEnd;
    });

    if (lastByteEnd < textBytes.byteLength) {
        const remainingText = new TextDecoder().decode(textBytes.slice(lastByteEnd));
        html += escapeHtml(remainingText);
    }

    return html;
}

function isPostHiddenByLabels(post) {
    if (!post) return false;

    const postLabels = post.labels || [];
    const authorLabels = post.author ? (post.author.labels || []) : [];

    const allLabels = [...postLabels, ...authorLabels];

    for (const labelObj of allLabels) {
        if (labelObj && CONTENT_LABELS_TO_HIDE.includes(labelObj.val)) {
            return true;
        }
    }
    return false;
}

function isBlueskyPostURL(url) {
    if (!url) return false;
    return /https?:\/\/bsky\.app\/profile\/([^/]+)\/post\/([^/?#]+)/.test(url) ||
        (url.startsWith('at://') && url.includes('/app.bsky.feed.post/'));
}

function isBlueskyFeedURL(url) {
    if (!url) return false;
    return /https?:\/\/bsky\.app\/profile\/([^/]+)\/feed\/([^/?#]+)/.test(url) ||
        (url.startsWith('at://') && url.includes('/app.bsky.feed.generator/'));
}
