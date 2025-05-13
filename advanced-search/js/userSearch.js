// userSearch.js

const BLUESKY_API_URL = 'https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors';
let userSearchResults = {};
let isSelectionInProgress = {};

function hideAllDropdowns(exceptInputId = null) {
    Object.keys(userSearchResults).forEach(inputId => {
        if (inputId !== exceptInputId && userSearchResults[inputId]) {
            if (userSearchResults[inputId].style.display !== 'none') {
                userSearchResults[inputId].style.display = 'none';
            }
        }
    });
}

function initUserSearch() {
    const userSearchFields = [
        document.getElementById('superFromUser'),
        document.getElementById('superToUser'),
        document.getElementById('superMentions'),
        document.getElementById('superExactUsername')
    ];

    userSearchFields.forEach(field => {
        if (!field) return;
        isSelectionInProgress[field.id] = false;

        const resultsContainer = document.createElement('div');
        resultsContainer.className = 'user-search-results';
        resultsContainer.style.display = 'none';
        field.parentNode.appendChild(resultsContainer);
        userSearchResults[field.id] = resultsContainer;

        field.addEventListener('input', debounce(e => {
            const inputField = e.target;
            if (isSelectionInProgress[inputField.id]) {
                isSelectionInProgress[inputField.id] = false;
                return;
            }
            handleUserSearch(inputField);
        }, 300));

        field.addEventListener('focus', e => {
            const currentField = e.target;
            const currentResultsContainer = userSearchResults[currentField.id];

            hideAllDropdowns(currentField.id);

            const value = currentField.value.trim();
            if (value && !isMeValue(value, currentField.id) && currentResultsContainer.children.length > 0 && currentResultsContainer.innerHTML.trim() !== '') {
                currentResultsContainer.style.display = 'block';
            } else {
                currentResultsContainer.style.display = 'none';
            }
        });

        field.addEventListener('blur', e => {
            const fieldId = e.target.id;
            const currentResultsContainer = userSearchResults[fieldId];
            setTimeout(() => {
                if (currentResultsContainer && !currentResultsContainer.contains(document.activeElement) && document.activeElement !== e.target) {
                    currentResultsContainer.style.display = 'none';
                }
            }, 150);
        });
    });

    document.addEventListener('click', e => {
        let clickedInsideAnySearchComponent = false;
        userSearchFields.forEach(field => {
            if (field && field.contains(e.target)) {
                clickedInsideAnySearchComponent = true;
            }
            if (userSearchResults[field.id] && userSearchResults[field.id].contains(e.target)) {
                clickedInsideAnySearchComponent = true;
            }
        });

        if (!clickedInsideAnySearchComponent) {
            hideAllDropdowns();
        }
    });
}

function isMeValue(value, fieldId) {
    return fieldId !== 'superExactUsername' && value.toLowerCase() === 'me';
}

async function handleUserSearch(inputField) {
    const fieldId = inputField.id;
    const query = inputField.value.trim();
    const resultsContainer = userSearchResults[fieldId];

    if (!resultsContainer) return;

    if (!query || isMeValue(query, fieldId)) {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        return;
    }

    resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
    resultsContainer.style.display = 'block';

    hideAllDropdowns(fieldId);

    try {
        const users = await searchBlueskyUsers(query);

        if ((document.activeElement !== inputField && !inputField.contains(document.activeElement)) || inputField.value.trim() !== query) {
            resultsContainer.style.display = 'none';
            return;
        }

        resultsContainer.innerHTML = '';

        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="no-results">No users found</div>';
        } else {
            users.forEach(user => {
                const userElement = createUserElement(user, inputField, resultsContainer);
                resultsContainer.appendChild(userElement);
            });
        }

        if (resultsContainer.children.length > 0 && resultsContainer.innerHTML.trim() !== '') {
            resultsContainer.style.display = 'block';
        } else {
            resultsContainer.style.display = 'none';
        }

    } catch (error) {
        console.error('Error searching users:', error);
        if (document.activeElement === inputField || inputField.contains(document.activeElement)) {
            resultsContainer.innerHTML = '<div class="search-error">Error searching users</div>';
            resultsContainer.style.display = 'block';
        } else {
            resultsContainer.style.display = 'none';
        }
    }
}

async function searchBlueskyUsers(query, limit = 10) {
    const url = `${BLUESKY_API_URL}?q=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
    }
    const data = await response.json();
    return data.actors || [];
}

function createUserElement(user, inputField, resultsContainer) {
    const userElement = document.createElement('div');
    userElement.className = 'user-item';

    const avatar = document.createElement('img');
    avatar.className = 'user-avatar';
    avatar.src = user.avatar || 'assets/default-avatar.png';
    avatar.alt = `${user.displayName || user.handle}'s avatar`;
    avatar.onerror = () => { avatar.src = 'assets/default-avatar.png'; };

    const userInfo = document.createElement('div');
    userInfo.className = 'user-info';

    const displayName = document.createElement('div');
    displayName.className = 'user-display-name';
    displayName.textContent = user.displayName || user.handle;

    const handleText = document.createElement('div');
    handleText.className = 'user-handle';
    handleText.textContent = `@${user.handle}`;

    const badgeContainer = document.createElement('div');
    badgeContainer.className = 'badge-container';
    addVerificationBadges(badgeContainer, user);

    userInfo.appendChild(displayName);
    userInfo.appendChild(handleText);
    userElement.appendChild(avatar);
    userElement.appendChild(userInfo);
    userElement.appendChild(badgeContainer);

    userElement.addEventListener('mousedown', (e) => {
        const fieldId = inputField.id;
        e.preventDefault();

        isSelectionInProgress[fieldId] = true;

        const previousValue = inputField.value;
        inputField.value = user.handle;

        hideAllDropdowns();

        if (inputField.value !== previousValue) {
            const inputEvent = new Event('input', { bubbles: true, cancelable: true });
            inputField.dispatchEvent(inputEvent);

            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            inputField.dispatchEvent(changeEvent);
        }
    });

    return userElement;
}

function addVerificationBadges(container, user) {
    const verification = user.verification || {};
    const labels = user.labels || [];
    if (verification.trustedVerifierStatus === 'valid' && (user.handle === 'bsky.app' || !verification.verifications || verification.verifications.length === 0)) {
        addBadge(container, 'ph-fill ph-seal-check', 'badge-official', 'Official Verifier');
    } else if (verification.trustedVerifierStatus === 'valid' && verification.verifications && verification.verifications.length > 0) {
        addBadge(container, 'ph-fill ph-seal-check', 'badge-trusted', 'Trusted Verifier');
    } else if ((!verification.trustedVerifierStatus || verification.trustedVerifierStatus !== 'valid') && verification.verifiedStatus === 'valid' && verification.verifications && verification.verifications.length > 0) {
        addBadge(container, 'ph-fill ph-check-circle', 'badge-verified', 'Verified Account');
    }
    if (labels.some(label => label.val === '!no-unauthenticated')) {
        addBadge(container, 'ph-fill ph-lock', 'badge-private', 'Private Account');
    }
    if (labels.some(label => (label.val && label.val.startsWith('!') && label.val !== '!no-unauthenticated') || ['spam', 'porn', 'nudity', 'gore'].includes(label.val))) {
        addBadge(container, 'ph-fill ph-warning-circle', 'badge-moderation', 'Content Warning');
    }
}

function addBadge(container, iconClass, badgeClass, title) {
    const badge = document.createElement('i');
    badge.className = iconClass;
    badge.classList.add(badgeClass);
    badge.title = title;
    container.appendChild(badge);
}

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

document.addEventListener('DOMContentLoaded', initUserSearch);