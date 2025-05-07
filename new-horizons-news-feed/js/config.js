export const API_BASE_URL = 'https://public.api.bsky.app/xrpc';

export const FEED_URIS = {
    news: {
        recent: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lc34yoopje27',
        trending: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.feed.generator/aaahn42hkwvf2',
        sources_list: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lc34yoopje27'
    },
    tech: {
        recent: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lh6agik2oh2x',
        trending: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.feed.generator/aaanqiwe5dvuu',
        techmeme_actor: 'techmeme.com',
        sources_list: 'at://did:plc:xglrcj6gmrpktysohindaqhj/app.bsky.graph.list/3lh6agik2oh2x'
    }
};

export const DEFAULT_THUMB = './assets/thumb.avif';
export const DEFAULT_AVATAR = './assets/avatar.svg';
export const POSTS_PER_PAGE = 100;
export const MODAL_POSTS_PER_PAGE = 50;
export const PROFILES_PER_CALL = 25;