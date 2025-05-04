// js/utils.js

export const bskyAppBase = 'https://bsky.app';

/**
 * Parses various Bluesky URL/URI formats.
 * Returns object { did: string, rkey: string } or { handle: string, rkey: string }
 * or null if invalid.
 */
export function parseInput(inputString) {
    inputString = inputString.trim();
    try {
        // 1. Try AT URI format: at://did:plc:xyz/app.bsky.feed.post/abc
        if (inputString.startsWith('at://')) {
            const parts = inputString.substring(5).split('/');
            if (parts.length === 3 && parts[1] === 'app.bsky.feed.post' && parts[0].startsWith('did:')) {
                return { type: 'did', did: parts[0], rkey: parts[2] };
            }
        }

        // 2. Try bsky.app URL format
        // Ensure protocol exists for URL parser
        let urlString = inputString;
        if (!urlString.startsWith('http://') && !urlString.startsWith('https://')) {
            urlString = 'https://' + urlString;
        }

        if (urlString.includes('bsky.app/profile/')) {
            const url = new URL(urlString);
            const pathSegments = url.pathname.split('/').filter(Boolean);

            if (pathSegments.length === 4 && pathSegments[0] === 'profile' && pathSegments[2] === 'post') {
                const identifier = pathSegments[1];
                const rkey = pathSegments[3];
                if (identifier.startsWith('did:')) {
                    return { type: 'did', did: identifier, rkey: rkey };
                } else {
                    return { type: 'handle', handle: identifier, rkey: rkey };
                }
            }
        }
    } catch (e) {
        console.error("URL/URI Parsing failed:", e);
        return null;
    }
    return null;
}

/**
 * Copies text to the clipboard with fallback.
 * @param {string} text - The text to copy.
 * @param {function} showFeedback - Function to call with feedback message and error status.
 * @param {string} [feedbackMessage='Copied!'] - Message on success.
 */
export async function copyTextToClipboard(text, showFeedback, feedbackMessage = 'Copied!') {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        showFeedback(feedbackMessage, false); // false = not an error
    } catch (err) {
        console.warn('Async clipboard write failed, trying fallback:', err);
        try { // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            // Make textarea invisible and out of the way
            textArea.style.position = 'fixed';
            textArea.style.top = '-9999px';
            textArea.style.left = '-9999px';
            textArea.style.width = '1px';
            textArea.style.height = '1px';
            textArea.style.opacity = '0';
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select(); // Select the text
            // Use try-catch for execCommand as it can fail
            let successful = false;
            try {
                successful = document.execCommand('copy');
            } catch (execErr) {
                console.warn('document.execCommand failed:', execErr);
            }
            document.body.removeChild(textArea); // Clean up textarea

            if (successful) {
                showFeedback(feedbackMessage, false);
            } else {
                throw new Error('Fallback copy failed'); // Throw if execCommand returned false or failed
            }
        } catch (fallbackErr) {
            console.error('Fallback clipboard copy failed:', fallbackErr);
            showFeedback('Copy failed!', true); // true = is an error
        }
    }
}

/**
 * Extracts the domain name from a URL.
 * @param {string} urlString - The URL to parse.
 * @returns {string|null} - The domain name or null if invalid.
 */
export function extractDomain(urlString) {
    try {
        // Ensure protocol for URL constructor
        let urlToParse = urlString;
        if (!urlToParse.startsWith('http://') && !urlToParse.startsWith('https://')) {
            urlToParse = 'https://' + urlToParse;
        }
        const url = new URL(urlToParse);
        return url.hostname.replace(/^www\./, ''); // Remove www. prefix if present
    } catch (e) {
        console.warn("Could not extract domain from:", urlString, e);
        return null;
    }
}