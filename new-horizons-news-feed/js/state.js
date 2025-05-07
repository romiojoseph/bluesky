export const appState = {
    currentMainTab: 'news', // 'news' or 'tech'
    currentSubTab: 'recent', // 'recent', 'trending', 'techmeme', 'sources'
    cursors: {
        news_recent: null,
        news_trending: null,
        news_sources_list: null,
        tech_recent: null,
        tech_trending: null,
        tech_techmeme: null,
        tech_sources_list: null,
        activeSourcePosts: null, // For posts loaded when clicking a source
        modal_replies: null,
        modal_quotes: null,
    },
    isLoading: false,
    isModalLoading: false,
    currentSourceUser: null, // To store DID of selected source user for post fetching
    currentPostUriForModal: null, // For replies/quotes modal
};