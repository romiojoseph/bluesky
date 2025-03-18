const listUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lc34yoopje27';
const feedUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.feed.generator/aaahn42hkwvf2';
const techmemeAuthorDid = 'did:plc:pv7fudnt4dspurzdnyq73pfe';
const techCompaniesListUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lh6agik2oh2x';
const recentListUri = 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lc34yoopje27';

async function fetchPosts(type, limit, cursor = null, uri) {
    const endpoint = type === 'list' ? 'app.bsky.feed.getListFeed' : 'app.bsky.feed.getFeed';
    const formattedUri = convertToValidAtUri(uri);

    if (!formattedUri) {
        return { feed: [] };
    }

    let url = `${apiBase}/${endpoint}?${type}=${encodeURIComponent(formattedUri)}&limit=${limit}`;
    if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    // Show loader before fetching
    const section = type === 'list' ?
        (uri === newsListUri ? 'news' : 'tech') :
        (uri === newsFeedUri ? 'news' : 'tech');
    const loader = document.getElementById(`${section}-loader`);
    if (loader) {
        loader.style.display = 'flex';
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching ${type} posts:`, error);
        return { feed: [] };
    } finally {
        // Hide loader after fetching, regardless of success or failure
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

async function fetchTechmemePosts(cursor = null) {
    let url = `${apiBase}/app.bsky.feed.getAuthorFeed?actor=${techmemeAuthorDid}&limit=64`;
    if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    const loader = document.getElementById('tech-loader');
    if (loader) {
        loader.style.display = 'flex';
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching Techmeme posts:', error);
        return { feed: [] };
    } finally {
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

async function fetchTechCompaniesPosts(limit = 100, cursor = null) {
    const loader = document.getElementById('tech-companies-loader');
    if (loader) {
        loader.style.display = 'flex';
    }

    let url = `${apiBase}/app.bsky.feed.getListFeed?list=${encodeURIComponent(techCompaniesListUri)}&limit=${limit}`;
    if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching tech companies posts:`, error);
        return { feed: [] };
    } finally {
        if (loader) {
            loader.style.display = 'none';
        }
    }
}

async function fetchRecentNewsPosts(limit = 100, cursor = null) {
    const loader = document.getElementById('recent-news-loader');
    if (loader) {
        loader.style.display = 'flex';
    }

    let url = `${apiBase}/app.bsky.feed.getListFeed?list=${encodeURIComponent(recentListUri)}&limit=${limit}`;
    if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error fetching recent news posts:`, error);
        return { feed: [] };
    } finally {
        if (loader) {
            loader.style.display = 'none';
        }
    }
}