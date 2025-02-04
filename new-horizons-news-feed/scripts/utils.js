const apiBase = 'https://public.api.bsky.app/xrpc';

function formatRelativeTime(isoDate) {
    const date = new Date(isoDate);
    const now = new Date();
    const diff = now - date;

    const seconds = Math.round(diff / 1000);
    const minutes = Math.round(diff / (1000 * 60));
    const hours = Math.round(diff / (1000 * 60 * 60));
    const days = Math.round(diff / (1000 * 60 * 60 * 24));
    const months = Math.round(diff / (1000 * 60 * 60 * 24 * 30));
    const years = Math.round(diff / (1000 * 60 * 60 * 24 * 365));

    if (seconds < 60) {
        return seconds + "s";
    } else if (minutes < 60) {
        return minutes + "m";
    } else if (hours < 24) {
        return hours + "h";
    } else if (days < 30) {
        return days + "d";
    } else if (months < 12) {
        return months + "mo";
    } else if (years > 0) {
        return years + (years === 1 ? "y" : "y");
    } else {
        return "Just now";
    }
}

function formatForYouDate(isoDate) {
    const date = new Date(isoDate);
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
}

function convertToValidAtUri(atUri) {
    const parts = atUri.split('://')[1].split('/');
    const did = parts[0];
    const collection = parts[1];
    const rkey = parts[2];

    if (!did || !collection || !rkey) {
        console.error("Invalid AT-URI format:", atUri);
        return null;
    }

    return `at://${did}/${collection}/${rkey}`;
}

function copyToClipboard(text, button) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text)
            .then(() => {
                button.innerHTML = '<i class="ph-duotone ph-check"></i>';
                setTimeout(() => {
                    button.innerHTML = '<i class="ph-duotone ph-copy"></i>';
                }, 1500);
            })
            .catch(err => {
                console.error("Failed to copy:", err);
            });
    } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "fixed";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                button.innerHTML = '<i class="ph-duotone ph-check"></i>';
                setTimeout(() => {
                    button.innerHTML = '<i class="ph-duotone ph-copy"></i>';
                }, 1500);
            } else {
                throw new Error('Failed to copy');
            }
        } catch (err) {
            console.error('Fallback: Oops, unable to copy', err);
        }
        document.body.removeChild(textArea);
    }
}