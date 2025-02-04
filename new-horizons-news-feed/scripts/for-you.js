let recentNewsCursor = null;
let recentNewsPosts = [];
let currentRecentNewsIndex = 0;

async function loadInitialRecentNews() {
    return fetchRecentNewsPosts(100).then(data => {
        if (data.feed && data.feed.length > 0) {
            recentNewsPosts = data.feed.filter(postData =>
                postData.post.embed &&
                postData.post.embed.$type === 'app.bsky.embed.external#view' &&
                postData.post.embed.external.thumb &&
                postData.post.embed.external.uri &&
                postData.post.embed.external.title
            );
            recentNewsCursor = data.cursor;
            showRecentNewsPosts();
        }
    });
}

async function initForYou() {
    // Fetch For You posts
    const forYouData = await fetchForYouPosts(25);
    displayForYouPosts(forYouData.feed);

    // Fetch Techmeme posts, Recent News, and Tech Companies posts in parallel
    const [techmemeData, techCompaniesData] = await Promise.all([
        fetchTechmemePosts(),
        fetchTechCompaniesPosts(100)
    ]);

    // Display Techmeme and Tech Companies posts
    displayTechmemePosts(techmemeData.feed);
    displayTechCompaniesPosts(techCompaniesData.feed);

    // Load and display initial Recent News
    await loadInitialRecentNews();

    // Event listeners for Recent News navigation
    document.getElementById('prev-news').addEventListener('click', () => {
        if (currentRecentNewsIndex > 0) {
            currentRecentNewsIndex = Math.max(0, currentRecentNewsIndex - 3);
            showRecentNewsPosts();
        }
    });

    document.getElementById('next-news').addEventListener('click', async () => {
        if (currentRecentNewsIndex + 6 >= recentNewsPosts.length && recentNewsCursor) {
            const morePostsData = await fetchRecentNewsPosts(100, recentNewsCursor);
            if (morePostsData.feed && morePostsData.feed.length > 0) {
                const newPosts = morePostsData.feed.filter(postData =>
                    postData.post.embed &&
                    postData.post.embed.$type === 'app.bsky.embed.external#view' &&
                    postData.post.embed.external.thumb &&
                    postData.post.embed.external.uri &&
                    postData.post.embed.external.title
                );
                recentNewsPosts = [...recentNewsPosts, ...newPosts];
                recentNewsCursor = morePostsData.cursor;
            }
        }

        if (currentRecentNewsIndex + 3 < recentNewsPosts.length) {
            currentRecentNewsIndex += 3;
            showRecentNewsPosts();
        }
    });
}