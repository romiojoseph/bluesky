const BASE_URL = 'https://bsky.app/search?q=';

function encodeSearchTerm(term) {
    return encodeURIComponent(term);
}

function openSearch(searchTerm) {
    window.open(BASE_URL + encodeSearchTerm(searchTerm), '_blank');
}

function removeAtSymbol(username) {
    return username.replace('@', '');
}

function cleanHashtag(hashtag) {
    return hashtag.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

function searchSuper() {
    const fromUser = removeAtSymbol(document.getElementById('superFromUser').value.trim());
    const toUser = removeAtSymbol(document.getElementById('superToUser').value.trim());
    const mentions = removeAtSymbol(document.getElementById('superMentions').value.trim());
    const exactUsername = removeAtSymbol(document.getElementById('superExactUsername').value.trim());
    const domainInput = document.getElementById('superDomain').value.trim();
    const since = document.getElementById('superSince').value;
    const until = document.getElementById('superUntil').value;
    const phrase = document.getElementById('superPhrase').value.trim();
    const hashtag = cleanHashtag(document.getElementById('superHashtag').value.trim());

    let searchTerm = '';

    if (fromUser) searchTerm += `from:${fromUser} `;
    if (toUser) searchTerm += `to:${toUser} `;
    if (mentions) searchTerm += `mentions:${mentions} `;
    if (exactUsername) searchTerm += `"@${exactUsername}" `;
    if (domainInput) {
        const domain = new URL(domainInput).hostname.replace('www.', '');
        searchTerm += `domain:${domain} `;
    }
    if (since) searchTerm += `since:${since} `;
    if (until) searchTerm += `until:${until} `;
    if (phrase) searchTerm += `"${phrase}" `;
    if (hashtag) searchTerm += `#${hashtag} `;

    searchTerm = searchTerm.trim();

    if (searchTerm) {
        openSearch(searchTerm);
    } else {
        alert('Please fill at least one field.');
    }
}

// Add event listeners for Enter key
document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const parentDiv = input.closest('div.search-section');
            parentDiv.querySelector('button').click();
        }
    });
});
