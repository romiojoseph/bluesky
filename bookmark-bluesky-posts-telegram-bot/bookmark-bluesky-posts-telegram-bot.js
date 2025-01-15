// Access script properties
const scriptProperties = PropertiesService.getScriptProperties();

// Load credentials from script properties
const TELEGRAM_BOT_TOKEN = scriptProperties.getProperty("TELEGRAM_BOT_TOKEN");
const TELEGRAM_CHAT_ID = scriptProperties.getProperty("TELEGRAM_CHAT_ID");
const SPREADSHEET_ID = scriptProperties.getProperty("SPREADSHEET_ID");

// Validate that credentials are set
if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID || !SPREADSHEET_ID) {
    throw new Error("Missing required script properties: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, or SPREADSHEET_ID");
}

// Store temporary data
const cache = CacheService.getScriptCache();

// Column headers for the spreadsheet (Video_URL and Context removed)
const HEADERS = [
    "Post_ID", "Post_URI", "Post_Link",
    "Author_DID", "Author_Handle", "Author_DisplayName", "Author_Avatar",
    "Author_CreatedAt", "Author_Labels",
    "Post_Text", "Post_CreatedAt", "Post_IndexedAt", "Post_Language",
    "Reply_Count", "Repost_Count", "Like_Count", "Quote_Count",
    "Has_Media", "Media_Count", "Media_URLs", "Media_Alt_Texts",
    "Image_Aspect_Ratio_Height", "Image_Aspect_Ratio_Width",
    "Embed_Type", "Embed_Title", "Embed_Description", "Embed_URL", "Embed_Thumb",
    "Video_Thumbnail", "Video_CID", "Video_Playlist",
    "Video_Aspect_Ratio_Height", "Video_Aspect_Ratio_Width",
    "Mentions", "Links", "Labels",
    "saved_at", "Category"
];

class BlueskyClient {
    constructor() {
        this.apiBaseUrl = "https://public.api.bsky.app/xrpc";
    }

    extractPostUri(postUrl) {
        try {
            const urlParts = postUrl.split('/');
            if (postUrl.includes('bsky.app') && urlParts.length >= 7) {
                const handle = urlParts[4];
                const postId = urlParts[6];
                return `at://${handle}/app.bsky.feed.post/${postId}`;
            }
            throw new Error("Invalid Bluesky post URL format");
        } catch (e) {
            throw new Error(`Failed to extract post URI: ${e.message}`);
        }
    }

    getPostThread(uri) {
        const url = `${this.apiBaseUrl}/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=100`;
        try {
            const response = UrlFetchApp.fetch(url);
            return JSON.parse(response.getContentText());
        } catch (e) {
            throw new Error(`Failed to fetch thread: ${e.message}`);
        }
    }

    processFacets(facets, text) {
        const mentions = [];
        const links = [];

        if (!facets) return [mentions, links];

        facets.forEach(facet => {
            const feature = facet.features?.[0] || {};
            const featureType = feature.$type;

            if (featureType === "app.bsky.richtext.facet#mention") {
                mentions.push(feature.did || "");
            } else if (featureType === "app.bsky.richtext.facet#link") {
                links.push(feature.uri || "");
            }
        });

        return [mentions, links];
    }

    getMediaInfo(recordEmbed, postEmbed) {
        // Default return if no embed or postEmbed
        if (!recordEmbed || !postEmbed) return {
            hasMedia: false,
            mediaCount: 0,
            mediaUrls: [],
            altTexts: [],
            aspectRatioHeight: "",
            aspectRatioWidth: ""
        };

        const embedType = recordEmbed.$type || "";

        // Check for both "recordWithMedia" or "images"
        if (!embedType.includes("recordWithMedia") && !embedType.includes("images")) {
            return {
                hasMedia: false,
                mediaCount: 0,
                mediaUrls: [],
                altTexts: [],
                aspectRatioHeight: "",
                aspectRatioWidth: ""
            };
        }

        const mediaUrls = [];
        const altTexts = [];
        let aspectRatioHeight = "";
        let aspectRatioWidth = "";

        // Handling recordWithMedia case
        if (embedType.includes("recordWithMedia")) {
            const media = postEmbed.media || {};
            const images = media.images || [];

            images.forEach(img => {
                if (img.fullsize) mediaUrls.push(img.fullsize);

                if (img.alt) altTexts.push(img.alt);

                aspectRatioHeight = img.aspectRatio?.height || "";
                aspectRatioWidth = img.aspectRatio?.width || "";
            });
        }

        // Handling images case directly
        if (embedType.includes("images")) {
            const images = postEmbed.images || [];

            images.forEach(img => {
                if (img.fullsize) mediaUrls.push(img.fullsize);

                if (img.alt) altTexts.push(img.alt);

                aspectRatioHeight = img.aspectRatio?.height || "";
                aspectRatioWidth = img.aspectRatio?.width || "";
            });
        }

        return {
            hasMedia: mediaUrls.length > 0,
            mediaCount: mediaUrls.length,
            mediaUrls,
            altTexts,
            aspectRatioHeight,
            aspectRatioWidth
        };
    }

    getVideoInfo(embed) {
        const defaultVideo = {
            videoThumbnail: "",
            videoCid: "",
            videoPlaylist: "",
            aspectRatioHeight: "",
            aspectRatioWidth: ""
        };

        if (!embed || embed.$type !== "app.bsky.embed.video#view") return defaultVideo;

        return {
            videoThumbnail: embed.thumbnail || "",
            videoCid: embed.cid || "",
            videoPlaylist: embed.playlist || "",
            aspectRatioHeight: embed.aspectRatio?.height || "",
            aspectRatioWidth: embed.aspectRatio?.width || ""
        };
    }

    // Updated getEmbedInfo to handle different embed types
    getEmbedInfo(embed) {
        if (!embed) return { embedType: "" };

        const embedType = embed.$type || "";

        if (embedType.includes("external")) {
            const external = embed.external || {};
            return {
                embedType: embedType,
                embedTitle: external.title || "",
                embedDescription: external.description || "",
                embedUrl: external.uri || "",
                embedThumb: external.thumb || ""
            };
        } else if (embedType.includes("images")) {
            return { embedType: embedType };
        } else if (embedType.includes("record")) {
            return { embedType: embedType };
        } else if (embedType.includes("video")) {
            return { embedType: embedType };
        }

        return { embedType: embedType }; // Return the type even if we don't have specific details
    }

    getPostMetadata(postUrl, keyword) {
        try {
            const postUri = this.extractPostUri(postUrl);
            const threadData = this.getPostThread(postUri);

            const thread = threadData.thread;
            const post = thread.post;
            const record = post.record;
            const author = post.author;
            const embed = post.embed || {};

            this.currentAuthorDid = author.did;

            const [mentions, links] = this.processFacets(record.facets, record.text);
            const mediaInfo = this.getMediaInfo(record.embed || {}, post.embed || {});
            const embedInfo = this.getEmbedInfo(post.embed || {});
            const videoInfo = this.getVideoInfo(post.embed || {});

            // Correctly extract label values
            const authorLabels = (author.labels || []).map(label => label.val).join("|");
            const postLabels = (post.labels || []).map(label => label.val).join("|");

            return {
                Post_ID: post.cid || "",
                Post_URI: post.uri || "",
                Post_Link: `https://bsky.app/profile/${author.handle}/post/${post.uri.split('/').pop()}`,
                Author_DID: author.did || "",
                Author_Handle: author.handle || "",
                Author_DisplayName: author.displayName || "",
                Author_Avatar: author.avatar || "",
                Author_CreatedAt: author.createdAt || "",
                Author_Labels: authorLabels, // Use the extracted values
                Post_Text: record.text || "",
                Post_CreatedAt: record.createdAt || "",
                Post_IndexedAt: post.indexedAt || "",
                Post_Language: (record.langs || []).join("|"),
                Reply_Count: post.replyCount || 0,
                Repost_Count: post.repostCount || 0,
                Like_Count: post.likeCount || 0,
                Quote_Count: post.quoteCount || 0,
                Has_Media: mediaInfo.hasMedia,
                Media_Count: mediaInfo.mediaCount,
                Media_URLs: mediaInfo.mediaUrls.join("|"),
                Media_Alt_Texts: mediaInfo.altTexts.join("|"),
                Image_Aspect_Ratio_Height: mediaInfo.aspectRatioHeight,
                Image_Aspect_Ratio_Width: mediaInfo.aspectRatioWidth,
                Embed_Type: embedInfo.embedType,
                Embed_Title: embedInfo.embedTitle,
                Embed_Description: embedInfo.embedDescription,
                Embed_URL: embedInfo.embedUrl,
                Embed_Thumb: embedInfo.embedThumb,
                Video_Thumbnail: videoInfo.videoThumbnail,
                Video_CID: videoInfo.videoCid,
                Video_Playlist: videoInfo.videoPlaylist,
                Video_Aspect_Ratio_Height: videoInfo.aspectRatioHeight,
                Video_Aspect_Ratio_Width: videoInfo.aspectRatioWidth,
                Mentions: mentions.join("|"),
                Links: links.join("|"),
                Labels: postLabels, // Use the extracted values
                saved_at: new Date().toISOString(),
                Category: keyword
            };
        } catch (e) {
            Logger.log(`Error getting post metadata: ${e.message}`);
            return null;
        }
    }
}

function setupSheet() {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName("Bluesky Bookmarks");

    if (!sheet) {
        sheet = ss.insertSheet("Bluesky Bookmarks");
        sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    }

    return sheet;
}

function saveToSheet(postData) {
    const sheet = setupSheet();
    const values = HEADERS.map(header => postData[header] || "");
    sheet.appendRow(values);
}

function doPost(e) {
    try {
        const update = JSON.parse(e.postData.contents);

        if (update.message.chat.id.toString() !== TELEGRAM_CHAT_ID) {
            return ContentService.createTextOutput("Unauthorized");
        }

        const messageText = update.message.text;
        if (!messageText) return;

        const chatId = update.message.chat.id.toString();
        const pendingUrl = cache.get(chatId + "_url");

        if (!pendingUrl) {
            // First step: Receive URL
            if (!messageText.startsWith('https://bsky.app/')) {
                sendTelegramMessage("Please send a valid Bluesky post URL.");
                return;
            }

            cache.put(chatId + "_url", messageText, 3600); // Store URL for 1 hour
            sendTelegramMessage("Got the URL! Now please send the keyword/category for this post.");
            return;
        } else {
            // Second step: Receive keyword and process
            const keyword = messageText;
            const postUrl = pendingUrl;

            const bluesky = new BlueskyClient();
            const postData = bluesky.getPostMetadata(postUrl, keyword);

            if (!postData) {
                sendTelegramMessage("❌ Failed to fetch post metadata. Please try again.");
                cache.remove(chatId + "_url");
                return;
            }

            saveToSheet(postData);
            sendTelegramMessage(`✅ Post saved successfully with category: ${keyword}!`);
            cache.remove(chatId + "_url");
        }

    } catch (error) {
        Logger.log(`Error in doPost: ${error.message}`);
        sendTelegramMessage("❌ An error occurred. Please try again.");
        cache.remove(update.message.chat.id.toString() + "_url");
    }
}

function sendTelegramMessage(text) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const payload = {
        chat_id: TELEGRAM_CHAT_ID,
        text: text
    };

    UrlFetchApp.fetch(url, {
        method: 'post',
        payload: payload
    });
}

function doGet() {
    return ContentService.createTextOutput("Bot is running!");
}