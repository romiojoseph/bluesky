const actorSuggestionsDropdown = document.getElementById('actorSuggestionsDropdown');
let searchTimeout;

// Simplified badge/text generation for actor search results
// This will now mostly generate icon badges, and main profile view handles detailed text.
// Or we can try to fetch issuer display name for a very short text here.
// For now, let's keep search suggestions focused on icons for brevity.
async function generateActorSuggestionBadgesAndText(actorData) {
    let badgesHtml = '';
    let verificationText = ''; // We won't fetch issuer here to keep search fast

    const verification = actorData.verification || {};
    const labels = actorData.labels || [];

    // Icons
    if (verification.trustedVerifierStatus === 'valid') {
        badgesHtml += (actorData.handle === 'bsky.app' || !verification.verifications || verification.verifications.length === 0)
            ? `<span class="badge-icon badge-crown" title="Original Trusted Verifier"><i class="ph-fill ph-seal-check"></i></span>`
            : `<span class="badge-icon badge-seal-check" title="Trusted Verifier"><i class="ph-fill ph-seal-check"></i></span>`;
    } else if (verification.verifiedStatus === 'valid' && verification.verifications && verification.verifications.length > 0) {
        badgesHtml += `<span class="badge-icon badge-check-circle" title="Verified Account"><i class="ph-fill ph-check-circle"></i></span>`;
    }

    if (labels.length > 0) {
        if (labels.some(label => label.val === '!no-unauthenticated')) {
            badgesHtml += `<span class="badge-icon badge-private" title="Auth Only"><i class="ph-fill ph-lock"></i></span>`;
        }
        if (labels.some(l => l.val !== '!no-unauthenticated' && (l.val.startsWith('!') || ['porn', 'spam', 'nudity', 'sexual', 'gore'].some(term => l.val.includes(term))))) {
            if (!badgesHtml.includes('ph-warning-circle')) {
                badgesHtml += `<span class="badge-icon badge-warning-circle" title="Mod Labels"><i class="ph-fill ph-warning-circle"></i></span>`;
            }
        }
    }
    // Text: Very simplified for search, or omit for speed
    if (verification.verifiedStatus === 'valid' && verification.verifications && verification.verifications.length > 0) {
        verificationText = `Verified`; // Keep it short
    }


    return { badgesHtml, verificationText };
}


async function searchActorsAndDisplay(query) {
    if (!query || query.length < 1) {
        clearActorSuggestions();
        return;
    }
    try {
        const data = await searchActors(query, 7);
        displayActorSuggestions(data.actors);
    } catch (error) {
        console.error("Error searching actors:", error);
        clearActorSuggestions();
    }
}

async function displayActorSuggestions(actors) { // Mark as async for potential awaits if fetching issuer names
    clearActorSuggestions();
    if (actors && actors.length > 0) {
        for (const actor of actors) { // Use for...of for async await inside loop if needed
            const item = document.createElement('div');
            item.classList.add('suggestion-item');

            // For search, we'll keep it simple and not fetch issuer names to keep it fast.
            // Just show icons if possible.
            const { badgesHtml } = await generateActorSuggestionBadgesAndText(actor);

            item.innerHTML = `
                <img src="${actor.avatar || 'assets/avatar.svg'}" alt="${actor.displayName || actor.handle}" onerror="this.src='assets/avatar.svg';">
                <div class="suggestion-info">
                    <div>
                        <span class="display-name">${actor.displayName || actor.handle}</span>
                        <span class="handle">@${actor.handle}</span>
                    </div>
                    ${badgesHtml ? `<div class="suggestion-badges">${badgesHtml}</div>` : ''}
                </div>
            `;
            item.addEventListener('click', (e) => {
                const handleInputEl = document.getElementById('handleInput');
                handleInputEl.value = actor.handle;
                clearActorSuggestions();
                document.getElementById('submitHandle').click();
            });
            actorSuggestionsDropdown.appendChild(item);
        }
        actorSuggestionsDropdown.classList.remove('hidden');
    } else {
        actorSuggestionsDropdown.classList.add('hidden');
    }
}

function clearActorSuggestions() {
    if (actorSuggestionsDropdown) {
        actorSuggestionsDropdown.innerHTML = '';
        actorSuggestionsDropdown.classList.add('hidden');
    }
}

function setupActorSearch(inputElementId) {
    const inputElement = document.getElementById(inputElementId);
    if (!inputElement) return;

    inputElement.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value;
        if (query.length === 0) {
            clearActorSuggestions();
            return;
        }
        searchTimeout = setTimeout(() => {
            searchActorsAndDisplay(query);
        }, 300);
    });

    document.addEventListener('click', (e) => {
        if (inputElement && actorSuggestionsDropdown && !inputElement.contains(e.target) && !actorSuggestionsDropdown.contains(e.target)) {
            clearActorSuggestions();
        }
    });
}