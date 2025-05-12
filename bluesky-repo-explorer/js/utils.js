function formatISODateToLocal(isoString) {
    if (!isoString) return 'N/A';
    try {
        const date = new Date(isoString);
        return date.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    } catch (e) {
        console.error("Error formatting date:", isoString, e);
        return 'Invalid Date';
    }
}

function getDateDaysAgo(days) {
    const date = new Date();
    date.setDate(date.getDate() - days);
    date.setHours(0, 0, 0, 0);
    return date;
}

function getTodayStart() {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date;
}

function getYesterdayStart() {
    return getDateDaysAgo(1);
}

function isValidISODateString(value) {
    if (typeof value !== 'string') return false;
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|([+-]\d{2}(:\d{2})?))$/;
    if (!isoDateRegex.test(value)) {
        return false;
    }
    const date = new Date(value);
    return !isNaN(date.getTime());
}

function timeAgo(date) {
    if (!(date instanceof Date) || isNaN(date.getTime())) {
        return 'Invalid date';
    }
    const now = new Date();
    const seconds = Math.round((now - date) / 1000);
    const minutes = Math.round(seconds / 60);
    const hours = Math.round(minutes / 60);
    const days = Math.round(hours / 24);
    const weeks = Math.round(days / 7);
    const months = Math.round(days / 30.44);
    const years = days / 365.25;

    if (seconds < 60) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (weeks < 5) return `${weeks}w ago`;
    if (months < 12) return `${months}mo ago`;
    return `${parseFloat(years.toFixed(1))}y ago`;
}

// New copyToClipboard function
async function copyToClipboard(text) {
    if (!navigator.clipboard) {
        // Fallback for older browsers / insecure contexts
        try {
            const textArea = document.createElement("textarea");
            textArea.value = text;
            textArea.style.position = "fixed";  // Prevent scrolling to bottom of page in MS Edge.
            textArea.style.top = "0";
            textArea.style.left = "0";
            textArea.style.width = "2em";
            textArea.style.height = "2em";
            textArea.style.padding = "0";
            textArea.style.border = "none";
            textArea.style.outline = "none";
            textArea.style.boxShadow = "none";
            textArea.style.background = "transparent";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            const successful = document.execCommand('copy');
            document.body.removeChild(textArea);
            if (successful) return Promise.resolve();
            return Promise.reject(new Error('Fallback: Copying text command was unsuccessful'));
        } catch (err) {
            return Promise.reject(new Error('Fallback: Oops, unable to copy via execCommand'));
        }
    }
    return navigator.clipboard.writeText(text);
}