// User search functionality for Bluesky User Statistics
document.addEventListener('DOMContentLoaded', () => {
    // Get references to DOM elements
    const handleInput = document.getElementById('handleInput');
    const searchResultsContainer = document.createElement('div');
    searchResultsContainer.id = 'searchResultsContainer';
    searchResultsContainer.className = 'search-results-container';
    
    // Insert the search results container after the input section
    const inputSection = document.querySelector('.input-section');
    if (inputSection) {
        inputSection.parentNode.insertBefore(searchResultsContainer, inputSection.nextSibling);
    }
    
    // Add styling for the search results
    const style = document.createElement('style');
    style.textContent = `
        .search-results-container {
            max-height: 300px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 8px;
            margin-top: 10px;
            background-color: white;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            display: none;
        }
        
        .search-result {
            display: flex;
            align-items: center;
            padding: 10px;
            cursor: pointer;
            border-bottom: 1px solid #eee;
            transition: background-color 0.2s;
        }
        
        .search-result:hover {
            background-color: #f5f5f5;
        }
        
        .search-result:last-child {
            border-bottom: none;
        }
        
        .search-result-avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 12px;
            object-fit: cover;
        }
        
        .search-result-info {
            flex: 1;
        }
        
        .search-result-displayname {
            font-weight: bold;
            margin-bottom: 2px;
            display: flex;
            align-items: center;
            gap: 1px;
        }
        
        .search-result-handle {
            color: #666;
            font-size: 0.9em;
        }

        .badge-official {
            color: transparent;
            background: linear-gradient(135deg, #ffd54f, #ff8f00);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            font-size: 1.2em;
            margin-top: 2px;
        }

        .badge-official i {
            color: transparent;
            background: linear-gradient(135deg, #ffd54f, #ff8f00);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            margin-top: 2px;
        }

        .badge-trusted {
            color: transparent;
            background: linear-gradient(135deg, #4caf50 0%, #81c784 100%);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            font-size: 1.2em;
            margin-top: 2px;
        }

        .badge-trusted i {
            color: transparent;
            background: linear-gradient(135deg, #4caf50 0%, #81c784 100%);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            margin-top: 2px;
        }

        .badge-verified {
            color: transparent;
            background: linear-gradient(135deg, #1a8cff 0%, #e4b3ff 100%);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            font-size: 1.2em;
            margin-top: 2px;
        }

        .badge-verified i {
            color: transparent;
            background: linear-gradient(135deg, #1a8cff 0%, #e4b3ff 100%);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            margin-top: 2px;
        }

        .badge-private {
            color: transparent;
            background: linear-gradient(135deg, #ffd700, #ff6347);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            font-size: 1.2em;
            margin-top: 2px;
        }

        .badge-private i {
            color: transparent;
            background: linear-gradient(135deg, #ffd700, #ff6347);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            margin-top: 2px;
        }

        .badge-moderation {
            color: transparent;
            background: linear-gradient(135deg, #e53935, #d32f2f);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            font-size: 1.2em;
            margin-top: 2px;
        }

        .badge-moderation i {
            color: transparent;
            background: linear-gradient(135deg, #e53935, #d32f2f);
            text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.03);
            -webkit-background-clip: text;
            background-clip: text;
            margin-top: 2px;
        }

        .badge-container {
            display: flex;
            gap: 3px;
            margin-left: 5px;
        }
    `;
    document.head.appendChild(style);
    
    // Debounce function to limit API calls
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }
    
    // Function to search for users
    async function searchUsers(query) {
        if (!query || query.length < 2) {
            searchResultsContainer.style.display = 'none';
            return;
        }
        
        try {
            const response = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.actor.searchActors?term=${encodeURIComponent(query)}&limit=32`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.actors && data.actors.length > 0) {
                displaySearchResults(data.actors);
            } else {
                searchResultsContainer.style.display = 'none';
            }
        } catch (error) {
            console.error('Error searching for users:', error);
            searchResultsContainer.style.display = 'none';
        }
    }

    // Function to get badges for a user based on verification and moderation status
    function getUserBadges(actor) {
        const badges = [];
        
        // Check for verification badges (Type A, B, C)
        if (actor.verification) {
            // Type A: Official Verifier
            if (actor.verification.trustedVerifierStatus === 'valid' && 
                (actor.handle === 'bsky.app' || !actor.verification.verifications || actor.verification.verifications.length === 0)) {
                badges.push({
                    type: 'official',
                    icon: '<i class="ph-fill ph-seal-check"></i>',
                    class: 'badge-official'
                });
            } 
            // Type B: Trusted Verifier
            else if (actor.verification.trustedVerifierStatus === 'valid' && 
                     actor.verification.verifications && actor.verification.verifications.length > 0) {
                badges.push({
                    type: 'trusted',
                    icon: '<i class="ph-fill ph-seal-check"></i>',
                    class: 'badge-trusted'
                });
            } 
            // Type C: Verified Account
            else if ((actor.verification.trustedVerifierStatus !== 'valid' || !actor.verification.trustedVerifierStatus) && 
                     actor.verification.verifiedStatus === 'valid' && 
                     actor.verification.verifications && actor.verification.verifications.length > 0) {
                badges.push({
                    type: 'verified',
                    icon: '<i class="ph-fill ph-check-circle"></i>',
                    class: 'badge-verified'
                });
            }
        }
        
        // Check for moderation labels (Type E and F)
        if (actor.labels && actor.labels.length > 0) {
            // Type E: No Unauthenticated
            const hasNoUnauthenticated = actor.labels.some(label => label.val === '!no-unauthenticated');
            if (hasNoUnauthenticated) {
                badges.push({
                    type: 'private',
                    icon: '<i class="ph-fill ph-lock"></i>',
                    class: 'badge-private'
                });
            }
            
            // Type F: Other Moderation Labels
            const concerningLabels = ['spam', 'porn', 'nudity', 'gore'];
            const hasConcerningLabel = actor.labels.some(label => 
                (label.val.startsWith('!') && label.val !== '!no-unauthenticated') || 
                concerningLabels.some(term => label.val.includes(term))
            );
            
            if (hasConcerningLabel) {
                badges.push({
                    type: 'moderation',
                    icon: '<i class="ph-fill ph-warning-circle"></i>',
                    class: 'badge-moderation'
                });
            }
        }
        
        return badges;
    }
    
    // Function to display search results
    function displaySearchResults(actors) {
        searchResultsContainer.innerHTML = '';
        
        actors.forEach(actor => {
            const resultElement = document.createElement('div');
            resultElement.className = 'search-result';
            
            // Create avatar element
            const avatar = document.createElement('img');
            avatar.className = 'search-result-avatar';
            avatar.src = actor.avatar || 'assets/default-avatar.png'; // Fallback to default avatar
            avatar.onerror = () => { avatar.src = 'assets/default-avatar.png'; }; // Handle image load errors
            
            // Create info container
            const infoContainer = document.createElement('div');
            infoContainer.className = 'search-result-info';
            
            // Create display name element with badges
            const displayName = document.createElement('div');
            displayName.className = 'search-result-displayname';
            
            // Add the display name text
            const nameText = document.createElement('span');
            nameText.textContent = actor.displayName || actor.handle;
            displayName.appendChild(nameText);
            
            // Add badges if applicable
            const badges = getUserBadges(actor);
            if (badges.length > 0) {
                const badgeContainer = document.createElement('div');
                badgeContainer.className = 'badge-container';
                
                badges.forEach(badge => {
                    const badgeElement = document.createElement('span');
                    badgeElement.className = badge.class;
                    badgeElement.innerHTML = badge.icon;
                    badgeContainer.appendChild(badgeElement);
                });
                
                displayName.appendChild(badgeContainer);
            }
            
            // Create handle element
            const handle = document.createElement('div');
            handle.className = 'search-result-handle';
            handle.textContent = actor.handle;
            
            // Assemble the elements
            infoContainer.appendChild(displayName);
            infoContainer.appendChild(handle);
            resultElement.appendChild(avatar);
            resultElement.appendChild(infoContainer);
            
            // Add click event to select this user
            resultElement.addEventListener('click', () => {
                handleInput.value = actor.handle;
                searchResultsContainer.style.display = 'none';
                
                // Immediately trigger the fetch operation by clicking the fetch button
                const fetchBtn = document.getElementById('fetchBtn');
                if (fetchBtn) {
                    fetchBtn.click();
                }
            });
            
            searchResultsContainer.appendChild(resultElement);
        });
        
        searchResultsContainer.style.display = 'block';
    }
    
    // Add event listener to input field with debouncing
    if (handleInput) {
        const debouncedSearch = debounce(searchUsers, 300);
        
        handleInput.addEventListener('input', (event) => {
            const query = event.target.value.trim();
            debouncedSearch(query);
        });
        
        // Hide search results when clicking outside
        document.addEventListener('click', (event) => {
            if (!handleInput.contains(event.target) && !searchResultsContainer.contains(event.target)) {
                searchResultsContainer.style.display = 'none';
            }
        });
        
        // Hide search results when pressing Escape
        handleInput.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') {
                searchResultsContainer.style.display = 'none';
            }
        });
    }
});
