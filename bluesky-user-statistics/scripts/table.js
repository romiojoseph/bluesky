async function fetchProfileDetails(dids) {
    // Add the main user's DID if not already in the list
    const mainDid = document.getElementById('didDisplay').textContent;
    const didList = Array.isArray(dids) ? dids : dids.split(',');
    if (mainDid && !didList.includes(mainDid)) {
        didList.push(mainDid);
    }

    // Process DIDs in batches of 25
    const batchSize = 25;
    const batches = [];
    for (let i = 0; i < didList.length; i += batchSize) {
        batches.push(didList.slice(i, i + batchSize));
    }

    try {
        // Fetch profiles for each batch
        const results = await Promise.all(batches.map(async batch => {
            const queryParams = batch.map(did => `actors=${encodeURIComponent(did.trim())}`).join('&');
            const apiUrl = `https://api.bsky.app/xrpc/app.bsky.actor.getProfiles?${queryParams}`;

            const response = await fetch(apiUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            return data;
        }));

        // Combine all profile results
        const combinedProfiles = {
            profiles: results.flatMap(result => result.profiles)
        };

        return combinedProfiles;
    } catch (error) {
        console.error("Failed to fetch profiles:", error);
        return null;
    }
}

function constructHashtagURL(handle, hashtag) {
    return `https://bsky.app/search?q=from%3A${encodeURIComponent(handle)}+%23${encodeURIComponent(hashtag)}`;
}

function constructMentionURL(handle, mentionHandle) {
    return `https://bsky.app/search?q=from%3A${encodeURIComponent(handle)}+mentions%3A${encodeURIComponent(mentionHandle)}`;
}

function constructDomainURL(handle, domain) {
    return `https://bsky.app/search?q=from%3A${encodeURIComponent(handle)}+domain%3A${encodeURIComponent(domain)}`;
}

function constructWordURL(handle, word) {
    return `https://bsky.app/search?q=from%3A${encodeURIComponent(handle)}+%22${encodeURIComponent(word)}%22`;
}

async function generateHashtagsTable(records, handle) {
    const container = document.getElementById('hashtagsTableContainer');
    container.innerHTML = ''; // Clear existing content

    if (records.length === 0) return;

    // Get the main user's handle from their DID
    const mainDid = document.getElementById('didDisplay').textContent;
    const profiles = await fetchProfileDetails(mainDid);
    const userHandle = profiles?.profiles[0]?.handle;

    const hashtagCounts = {};

    records.forEach(record => {
        if (record.data && record.data.facets) {
            record.data.facets.forEach(facet => {
                facet.features.forEach(feature => {
                    if (feature.$type === 'app.bsky.richtext.facet#tag') {
                        const tag = feature.tag;
                        if (!hashtagCounts[tag]) {
                            hashtagCounts[tag] = 0;
                        }
                        hashtagCounts[tag]++;
                    }
                });
            });
        }
    });

    const sortedHashtags = Object.entries(hashtagCounts).sort(([, a], [, b]) => b - a);

    if (sortedHashtags.length === 0) {
        container.textContent = 'No data available.';
        return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const headerRow = document.createElement('tr');
    const hashtagHeader = document.createElement('th');
    hashtagHeader.textContent = 'Hashtag';
    hashtagHeader.style.border = '1px solid #ddd';
    hashtagHeader.style.padding = '8px';
    hashtagHeader.style.textAlign = 'left';
    const countHeader = document.createElement('th');
    countHeader.textContent = 'Count';
    countHeader.style.border = '1px solid #ddd';
    countHeader.style.padding = '8px';
    countHeader.style.textAlign = 'left';
    headerRow.appendChild(hashtagHeader);
    headerRow.appendChild(countHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    sortedHashtags.forEach(([hashtag, count]) => {
        const row = document.createElement('tr');
        const hashtagCell = document.createElement('td');
        hashtagCell.textContent = hashtag;
        hashtagCell.style.border = '1px solid #ddd';
        hashtagCell.style.padding = '8px';
        hashtagCell.style.cursor = 'pointer';
        hashtagCell.style.color = 'blue';
        hashtagCell.style.textDecoration = 'underline';
        hashtagCell.addEventListener('click', () => {
            window.open(constructHashtagURL(userHandle, hashtag), '_blank');
        });

        const countCell = document.createElement('td');
        countCell.textContent = count.toLocaleString();
        countCell.style.border = '1px solid #ddd';
        countCell.style.padding = '8px';
        row.appendChild(hashtagCell);
        row.appendChild(countCell);
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

async function generateMentionsTable(records, handle) {
    const container = document.getElementById('mentionsTableContainer');
    container.innerHTML = '';
    if (records.length === 0) return;

    // Get the main user's handle
    const mainDid = document.getElementById('didDisplay').textContent;
    const mainProfile = await fetchProfileDetails(mainDid);
    const userHandle = mainProfile?.profiles[0]?.handle;

    const mentionCounts = {};

    records.forEach(record => {
        if (record.data && record.data.facets) {
            record.data.facets.forEach(facet => {
                facet.features.forEach(feature => {
                    if (feature.$type === 'app.bsky.richtext.facet#mention') {
                        const mention = feature.did;
                        if (!mentionCounts[mention]) {
                            mentionCounts[mention] = 0;
                        }
                        mentionCounts[mention]++;
                    }
                });
            });
        }
    });

    const sortedMentions = Object.entries(mentionCounts).sort(([, a], [, b]) => b - a);

    if (sortedMentions.length === 0) {
        container.textContent = 'No data available.';
        return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');
    const headerRow = document.createElement('tr');
    const mentionHeader = document.createElement('th');
    mentionHeader.textContent = 'Mention (DID)';
    mentionHeader.style.border = '1px solid #ddd';
    mentionHeader.style.padding = '8px';
    mentionHeader.style.textAlign = 'left';
    const countHeader = document.createElement('th');
    countHeader.textContent = 'Count';
    countHeader.style.border = '1px solid #ddd';
    countHeader.style.padding = '8px';
    countHeader.style.textAlign = 'left';
    headerRow.appendChild(mentionHeader);
    headerRow.appendChild(countHeader);
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const dids = sortedMentions.map(([mention]) => mention).join(',');
    const profiles = await fetchProfileDetails(dids);

    sortedMentions.forEach(([mention, count]) => {
        const row = document.createElement('tr');
        const mentionCell = document.createElement('td');
        mentionCell.style.border = '1px solid #ddd';
        mentionCell.style.padding = '8px';
        mentionCell.style.cursor = 'pointer';
        mentionCell.style.color = 'blue';
        mentionCell.style.textDecoration = 'underline';

        const profile = profiles?.profiles.find(p => p.did === mention);
        const displayName = profile ? profile.displayName || profile.handle : mention;
        const avatar = profile ? profile.avatar : '';
        const mentionHandle = profile ? profile.handle.replace('@', '') : mention;

        mentionCell.innerHTML = `
            <div style="display: flex; align-items: center;">
                ${avatar ? `<img src="${avatar}" alt="Avatar" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">` : ''}
                <span>${displayName}</span>
            </div>
        `;

        mentionCell.addEventListener('click', () => {
            window.open(constructMentionURL(userHandle, mentionHandle), '_blank');
        });

        const countCell = document.createElement('td');
        countCell.textContent = count.toLocaleString();
        countCell.style.border = '1px solid #ddd';
        countCell.style.padding = '8px';
        row.appendChild(mentionCell);
        row.appendChild(countCell);
        tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
}

async function generateLinksTable(records, handle) {
    const container = document.getElementById('linksTableContainer');
    container.innerHTML = ''; // Clear existing content
    if (records.length === 0) return;

    // Get the main user's handle
    const mainDid = document.getElementById('didDisplay').textContent;
    fetchProfileDetails(mainDid).then(mainProfile => {
        const userHandle = mainProfile?.profiles[0]?.handle;

        // Use a Map to store unique URLs and their counts
        const linkMap = new Map();

        records.forEach(record => {
            const uniqueUrls = new Set(); // Track unique URLs per post

            // Check for links in the embed section
            if (record.data?.embed?.external?.uri) {
                uniqueUrls.add(record.data.embed.external.uri);
            }

            // Check for links in the facets section
            if (record.data?.facets) {
                record.data.facets.forEach(facet => {
                    facet.features.forEach(feature => {
                        if (feature.uri) {
                            uniqueUrls.add(feature.uri);
                        }
                    });
                });
            }

            // Process unique URLs from this post
            uniqueUrls.forEach(url => {
                const domain = getDomainFromUrl(url);
                if (domain) {
                    const count = linkMap.get(domain) || 0;
                    linkMap.set(domain, count + 1);
                }
            });
        });

        // Convert Map to array and sort
        const sortedLinks = Array.from(linkMap.entries())
            .sort(([, a], [, b]) => b - a);

        if (sortedLinks.length === 0) {
            container.textContent = 'No data available.';
            return;
        }

        // Create table
        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        const headerRow = document.createElement('tr');
        const linkHeader = document.createElement('th');
        linkHeader.textContent = 'Link (Domain)';
        linkHeader.style.border = '1px solid #ddd';
        linkHeader.style.padding = '8px';
        linkHeader.style.textAlign = 'left';
        const countHeader = document.createElement('th');
        countHeader.textContent = 'Count';
        countHeader.style.border = '1px solid #ddd';
        countHeader.style.padding = '8px';
        countHeader.style.textAlign = 'left';
        headerRow.appendChild(linkHeader);
        headerRow.appendChild(countHeader);
        thead.appendChild(headerRow);
        table.appendChild(thead);

        sortedLinks.forEach(([link, count]) => {
            const row = document.createElement('tr');
            const linkCell = document.createElement('td');
            linkCell.textContent = link;
            linkCell.style.border = '1px solid #ddd';
            linkCell.style.padding = '8px';
            linkCell.style.cursor = 'pointer';
            linkCell.style.color = 'blue';
            linkCell.style.textDecoration = 'underline';
            linkCell.addEventListener('click', () => {
                window.open(constructDomainURL(userHandle, link), '_blank');
            });

            const countCell = document.createElement('td');
            countCell.textContent = count.toLocaleString();
            countCell.style.border = '1px solid #ddd';
            countCell.style.padding = '8px';
            row.appendChild(linkCell);
            row.appendChild(countCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        container.appendChild(table);
    });
}

// Function to extract domain from URL
function getDomainFromUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace('www.', '').toLowerCase(); // Normalize domain
    } catch (error) {
        console.error('Invalid URL:', url);
        return null; // Return null for invalid URLs
    }
}

// Function to extract URLs from text
function extractUrlsFromText(text) {
    const urlPattern = /https?:\/\/[^\s]+/g; // Regex to match URLs
    return text.match(urlPattern) || []; // Return matched URLs or empty array
}

function generateWordsTable(records, handle) {
    const container = document.getElementById('wordsTableContainer');
    container.innerHTML = ''; // Clear existing content

    // Get the main user's handle
    const mainDid = document.getElementById('didDisplay').textContent;
    fetchProfileDetails(mainDid).then(mainProfile => {
        const userHandle = mainProfile?.profiles[0]?.handle;

        const typeRecords = records.filter(record => record.type === 'app.bsky.feed.post' && record.text);
        if (typeRecords.length === 0) {
            container.textContent = 'No text data available.';
            return;
        }

        // Process text data
        const words = {};
        typeRecords.forEach(record => {
            const text = record.text.toLowerCase();
            const wordArray = text.split(/\s+/);
            wordArray.forEach(word => {
                // Filter out common words, short words, and non-word characters
                if (word.length > 3 && !commonWords.includes(word) && /^[a-zA-Z]+$/.test(word)) {
                    words[word] = (words[word] || 0) + 1;
                }
            });
        });

        // Convert to array and sort by frequency
        const sortedWords = Object.entries(words)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 50); // Take only top 50 words

        if (sortedWords.length === 0) {
            container.textContent = 'No data available.';
            return;
        }

        const table = document.createElement('table');
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');

        const wordHeader = document.createElement('th');
        wordHeader.textContent = 'Word';
        wordHeader.style.border = '1px solid #ddd';
        wordHeader.style.padding = '8px';
        wordHeader.style.textAlign = 'left';

        const countHeader = document.createElement('th');
        countHeader.textContent = 'Count';
        countHeader.style.border = '1px solid #ddd';
        countHeader.style.padding = '8px';
        countHeader.style.textAlign = 'left';

        headerRow.appendChild(wordHeader);
        headerRow.appendChild(countHeader);
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        sortedWords.forEach(([word, count]) => {
            const row = document.createElement('tr');

            const wordCell = document.createElement('td');
            wordCell.textContent = word;
            wordCell.style.border = '1px solid #ddd';
            wordCell.style.padding = '8px';
            wordCell.style.cursor = 'pointer';
            wordCell.style.color = 'blue';
            wordCell.style.textDecoration = 'underline';
            wordCell.addEventListener('click', () => {
                window.open(constructWordURL(userHandle, word), '_blank');
            });

            const countCell = document.createElement('td');
            countCell.textContent = count.toLocaleString();
            countCell.style.border = '1px solid #ddd';
            countCell.style.padding = '8px';
            row.appendChild(wordCell);
            row.appendChild(countCell);
            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        container.appendChild(table);
    });
}


// Common words to filter out
const commonWords = [
    // Articles & Pronouns
    'the', 'a', 'an', 'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her',
    'its', 'our', 'their', 'i', 'you', 'he', 'she', 'we', 'they', 'me', 'him', 'us', 'them',

    // Prepositions
    'of', 'in', 'on', 'at', 'by', 'for', 'with', 'to', 'from', 'up', 'down', 'about',
    'into', 'over', 'under', 'after', 'before', 'between', 'out', 'off', 'around',
    'through', 'during', 'without', 'within', 'upon', 'toward', 'until', 'among',
    'amid', 'beneath', 'beside', 'beyond', 'regarding', 'throughout',

    // Conjunctions
    'and', 'but', 'or', 'if', 'as', 'while', 'although', 'though', 'unless', 'than',
    'therefore', 'hence', 'thus', 'whereas', 'whether', 'either', 'neither',

    // Auxiliary Verbs
    'be', 'is', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'done', 'doing', 'can', 'could', 'may', 'might', 'shall', 'should',
    'will', 'would', 'must', 'ought',

    // Quantifiers
    'some', 'any', 'all', 'both', 'each', 'every', 'another', 'enough', 'such',

    // Particles & Misc
    'not', 'so', 'just', 'only', 'even', 'also', 'very', 'too', 'quite', 'rather',
    'perhaps', 'maybe', 'well', 'now', 'then', 'here', 'there', 'when', 'where',
    'why', 'how', 'what', 'who', 'whom', 'whose', 'which',

    // Technical/Web Noise
    'via', 'rt', 'amp', 'http', 'https', 'com', 'www', 'html', 'htm', 'php', 'asp',
    'jpg', 'jpeg', 'gif', 'png', 'pdf', 'doc', 'docx', 'txt', 'xml',

    // Added Generic Words
    'wherein', 'whereby', 'hereby', 'thereof', 'therein', 'thereto', 'herein',
    'thereby', 'whereupon', 'whereat', 'whereto', 'hereafter', 'thereafter',
    'wherever', 'whenever', 'whichever', 'whatever', 'whoever', 'nobody', 'somebody',
    'anybody', 'everybody', 'nothing', 'something', 'anything', 'everything',
    'somewhere', 'anywhere', 'everywhere', 'nowhere', 'otherwise', 'meanwhile',
    'furthermore', 'moreover', 'nevertheless', 'nonetheless', 'accordingly',
    'provided', 'except', 'including', 'despite', 'along', 'across', 'per',
    'plus', 'minus', 'versus', 'vs', 'est', 'ie', 'eg', 'etc', 'al', 'para', 'like',
    'more', 'feels', 'still', 'other', 'things', 'especially', 'seems', 'right', 'never'
];
