export function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const months = Math.round(days / 30.44); // Average days in month
    const years = Math.round(days / 365.25); // Account for leap years

    if (seconds < 60) return `${seconds}s`;
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 30) return `${days}d`;
    if (months < 12) {
        const remainingDays = days - (months * 30.44);
        if (months < 2 && remainingDays > 7) return `${(days / 7).toFixed(0)}w`; // Show weeks for < 2 months
        return `${months}mo`;
    }
    const P = (y, p) => y.toFixed(p).replace(/\.0+$/, ""); // toFixed without trailing .0
    if (years < 10) return `${P(years + (months % 12) / 12, 1)}y`;
    return `${P(years, 0)}y`;
}

export function formatNumber(num) {
    if (num === null || num === undefined) return '0';
    return num.toLocaleString('en-US');
}

export function showNotification(message) {
    // Create and show notification
    const notification = document.createElement('div');
    notification.className = 'copy-notification';

    notification.innerHTML = `
        <i class="ph-fill ph-check-circle"></i>
        <span>${message}</span>
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.classList.add('visible');
    }, 10);

    // Remove after delay
    setTimeout(() => {
        notification.classList.remove('visible');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 300);
    }, 2000);
}

export async function copyToClipboard(text, type = 'link') {
    // Set message based on type
    let message = '';
    if (type === 'post') {
        message = 'Bluesky post link copied!';
    } else if (type === 'article') {
        message = 'Article link copied!';
    } else {
        message = 'Link copied to clipboard';
    }

    try {
        await navigator.clipboard.writeText(text);
        showNotification(message);
        return true;
    } catch (err) {
        console.warn('Clipboard API failed:', err);
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = 0;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();

        try {
            document.execCommand('copy');
            showNotification(message);
            return true;
        } catch (err) {
            console.error('Fallback copy failed:', err);
            showNotification('Failed to copy link');
            return false;
        } finally {
            document.body.removeChild(textArea);
        }
    }
}

function showFallbackNotification(notificationElement, message) {
    // Set the message
    notificationElement.textContent = message;

    // Show the notification
    notificationElement.classList.add('show');

    // Hide after 2 seconds
    setTimeout(() => {
        notificationElement.classList.remove('show');
    }, 2000);
}

export function processFacets(text, facets) {
    if (!facets || facets.length === 0) {
        return escapeHTML(text); // Escape user-generated text if no facets
    }

    // TextDecoder and TextEncoder work with UTF-8 byte indices directly
    const encoder = new TextEncoder();
    const textBytes = encoder.encode(text);

    let resultHtml = "";
    let currentBytePos = 0;

    // Sort facets by byteStart to process them in order
    const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

    for (const facet of sortedFacets) {
        const { byteStart, byteEnd } = facet.index;

        // Add text before this facet
        if (byteStart > currentBytePos) {
            resultHtml += escapeHTML(new TextDecoder().decode(textBytes.slice(currentBytePos, byteStart)));
        }

        // Process the facet itself
        const facetTextBytes = textBytes.slice(byteStart, byteEnd);
        const facetText = escapeHTML(new TextDecoder().decode(facetTextBytes));

        let linkAdded = false;
        for (const feature of facet.features) {
            if (feature.$type === "app.bsky.richtext.facet#link") {
                resultHtml += `<a href="${escapeAttribute(feature.uri)}" target="_blank" rel="noopener noreferrer" class="link">${facetText}</a>`;
                linkAdded = true;
                break;
            } else if (feature.$type === "app.bsky.richtext.facet#mention") {
                // Assuming mentions link to bsky.app profiles
                const handle = facetText.startsWith('@') ? facetText.substring(1) : facetText;
                resultHtml += `<a href="https://bsky.app/profile/${escapeAttribute(feature.did)}" target="_blank" rel="noopener noreferrer" class="mention">${facetText}</a>`;
                linkAdded = true;
                break;
            } else if (feature.$type === "app.bsky.richtext.facet#tag") {
                // Hashtags link to bsky.app search
                const tag = facetText.startsWith('#') ? facetText.substring(1) : facetText;
                resultHtml += `<a href="https://bsky.app/hashtag/${encodeURIComponent(tag)}" target="_blank" rel="noopener noreferrer" class="hashtag">${facetText}</a>`;
                linkAdded = true;
                break;
            }
        }
        if (!linkAdded) {
            resultHtml += facetText; // If no known feature, just add the text
        }
        currentBytePos = byteEnd;
    }

    // Add any remaining text after the last facet
    if (currentBytePos < textBytes.length) {
        resultHtml += escapeHTML(new TextDecoder().decode(textBytes.slice(currentBytePos)));
    }
    return resultHtml;
}

function escapeHTML(str) {
    if (str === null || str === undefined) return '';
    return str.replace(/[&<>"']/g, function (match) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match];
    });
}

function escapeAttribute(str) {
    if (str === null || str === undefined) return '';
    return str.replace(/[&<>"]/g, function (match) { // Only " for attributes generally
        return {
            '&': '&',
            '<': '<',
            '>': '>',
            '"': '"'
        }[match];
    });
}

export function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}