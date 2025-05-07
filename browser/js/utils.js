function formatRelativeTime(timestamp) {
    const now = new Date();
    const date = new Date(timestamp);
    const diffInSeconds = (now - date) / 1000;
    const years = diffInSeconds / (365 * 24 * 60 * 60);
    const months = diffInSeconds / (30 * 24 * 60 * 60);
    const days = diffInSeconds / (24 * 60 * 60);
    const hours = diffInSeconds / (60 * 60);
    const minutes = diffInSeconds / 60;

    // Show years only with decimal if it's not a whole number
    if (years >= 1) {
        return `${years % 1 === 0 ? Math.floor(years) : years.toFixed(1).replace(/\.0$/, '')}y`; // Remove decimal if it's a whole number
    }
    // Show months if less than 1 year but more than a few days
    else if (months >= 1) {
        return `${Math.round(months)}mo`; // Rounded months
    }
    // Show days if less than a month
    else if (days >= 1) {
        return `${Math.round(days)}d`; // Rounded days
    }
    // Show hours if less than a day
    else if (hours >= 1) {
        return `${Math.round(hours)}h`; // Rounded hours
    }
    // Show minutes if less than an hour
    else if (minutes >= 1) {
        return `${Math.round(minutes)}m`; // Rounded minutes
    }
    // Show seconds if less than a minute
    else {
        return `${Math.round(diffInSeconds)}s`; // Rounded seconds
    }
}

function formatAbsoluteTime(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const options = {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: 'numeric', minute: '2-digit', hour12: true
        };
        return date.toLocaleString(undefined, options);
    } catch (e) {
        console.error("Error formatting absolute time:", dateString, e);
        return '';
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

function linkifyText(text, facets) {
    const trimmedText = text ? text.trim() : '';
    if (!trimmedText) return '';
    if (!facets || facets.length === 0) {
        return escapeHtml(trimmedText).replace(/\n/g, '<br>');
    }

    facets.sort((a, b) => a.index.byteStart - b.index.byteStart);

    const textEncoder = new TextEncoder();
    const textDecoder = new TextDecoder();
    const originalTextBytes = textEncoder.encode(text || '');
    const trimStartOffset = textEncoder.encode(text.substring(0, text.length - trimmedText.length)).length;

    let linkedText = '';
    let lastIndex = 0;

    facets.forEach(facet => {
        const originalStartIndex = facet.index.byteStart;
        const originalEndIndex = facet.index.byteEnd;
        if (originalStartIndex < 0 || originalEndIndex > originalTextBytes.length || originalStartIndex >= originalEndIndex) {
            console.warn('Skipping invalid facet:', facet, `originalTextLength: ${originalTextBytes.length}`);
            return;
        }
        const startIndexInTrimmed = Math.max(0, originalStartIndex - trimStartOffset);
        const endIndexInTrimmed = Math.max(0, originalEndIndex - trimStartOffset);
        if (endIndexInTrimmed <= 0) return;
        if (startIndexInTrimmed >= textEncoder.encode(trimmedText).length) return;

        if (startIndexInTrimmed > lastIndex) {
            linkedText += escapeHtml(trimmedText.substring(
                textDecoder.decode(textEncoder.encode(trimmedText).slice(0, lastIndex)).length,
                textDecoder.decode(textEncoder.encode(trimmedText).slice(0, startIndexInTrimmed)).length
            ));
        }
        const facetTextBytesOriginal = originalTextBytes.slice(originalStartIndex, originalEndIndex);
        const facetTextEscaped = escapeHtml(textDecoder.decode(facetTextBytesOriginal));
        let linkAdded = false;
        if (facet.features) {
            facet.features.forEach(feature => {
                if (!linkAdded) {
                    if (feature.$type === 'app.bsky.richtext.facet#link' && feature.uri) {
                        linkedText += `<a href="${escapeHtml(feature.uri)}" target="_blank" rel="noopener noreferrer">${facetTextEscaped}</a>`;
                        linkAdded = true;
                    } else if (feature.$type === 'app.bsky.richtext.facet#mention' && feature.did) {
                        const profileUrl = `https://bsky.app/profile/${feature.did}`;
                        linkedText += `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer">${facetTextEscaped}</a>`;
                        linkAdded = true;
                    } else if (feature.$type === 'app.bsky.richtext.facet#tag' && feature.tag) {
                        const searchUrl = `https://bsky.app/hashtag/${encodeURIComponent(feature.tag)}`;
                        linkedText += `<a href="${searchUrl}" target="_blank" rel="noopener noreferrer">${facetTextEscaped}</a>`;
                        linkAdded = true;
                    }
                }
            });
        }
        if (!linkAdded) { linkedText += facetTextEscaped; }
        lastIndex = endIndexInTrimmed;
    });
    const trimmedTextBytes = textEncoder.encode(trimmedText);
    if (lastIndex < trimmedTextBytes.length) {
        linkedText += escapeHtml(textDecoder.decode(trimmedTextBytes.slice(lastIndex)));
    }
    return linkedText.replace(/\n/g, '<br>');
}

function copyToClipboard(text, elementToSignal) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => {
            console.log('Text copied to clipboard:', text);
            showCopySuccess(elementToSignal);
        }).catch(err => {
            console.error('Clipboard API failed: ', err);
            fallbackCopyToClipboard(text, elementToSignal);
        });
    } else {
        // Use fallback for mobile devices or non-secure contexts
        fallbackCopyToClipboard(text, elementToSignal);
    }
}

function fallbackCopyToClipboard(text, elementToSignal) {
    try {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed"; // Prevent scrolling to bottom of page
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.opacity = "0"; // Hide the textarea
        textArea.style.zIndex = "100"; // Make sure it's on top

        document.body.appendChild(textArea);

        // Special handling for iOS
        const range = document.createRange();
        range.selectNodeContents(textArea);

        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);

        textArea.focus();
        textArea.select();

        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);

        if (successful) {
            console.log('Fallback copy successful');
            showCopySuccess(elementToSignal);
        } else {
            console.error('Fallback copy failed');
            showCopyFailure(elementToSignal);
        }
    } catch (err) {
        console.error('Fallback copy method failed:', err);
        showCopyFailure(elementToSignal);
    }
}

function showCopySuccess(elementToSignal) {
    if (elementToSignal) {
        const originalIcon = elementToSignal.innerHTML;
        elementToSignal.innerHTML = '<i class="ph ph-check-circle"></i>';
        setTimeout(() => {
            elementToSignal.innerHTML = originalIcon;
        }, 1500);
    }
}

function showCopyFailure(elementToSignal) {
    if (elementToSignal) {
        const originalIcon = elementToSignal.innerHTML;
        elementToSignal.innerHTML = '<i class="ph ph-x-circle"></i>';
        setTimeout(() => {
            elementToSignal.innerHTML = originalIcon;
        }, 1500);
    }
}

function formatNumber(num) {
    if (num === undefined || num === null) return '0';
    return num.toLocaleString();
}

function hasLabels(item) {
    const acceptableLabels = ["!no-unauthenticated"];

    if (item?.labels && item.labels.length > 0) {
        const badPostLabels = item.labels.filter(label => !acceptableLabels.includes(label.val));
        if (badPostLabels.length > 0) {
            console.log(`Skipping post ${item?.uri} due to post labels: [${badPostLabels.map(l => l.val).join(', ')}]`);
            return true;
        }
    }

    if (item?.author?.labels && item.author.labels.length > 0) {
        const badAuthorLabels = item.author.labels.filter(label => !acceptableLabels.includes(label.val));
        if (badAuthorLabels.length > 0) {
            console.log(`Skipping post ${item?.uri} due to author (${item?.author?.handle}) labels: [${badAuthorLabels.map(l => l.val).join(', ')}]`);
            return true;
        }
    }

    return false;
}