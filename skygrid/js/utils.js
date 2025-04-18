// js/utils.js

const Utils = {
    // Basic HTML escaping
    escapeHtml: (unsafe) => {
        if (!unsafe) return "";
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    },

    // Format numbers with commas
    formatNumberWithCommas: (number) => {
        if (number === null || number === undefined) return '';
        const num = Number(number);
        if (isNaN(num)) return number;
        return num.toLocaleString('en-US');
    },


    // Parse AT URI
    parseAtUri: (uri) => {
        if (!uri || !uri.startsWith('at://')) return null;
        const parts = uri.substring(5).split('/');
        if (parts.length < 3) return null;
        return {
            did: parts[0],
            collection: parts[1],
            rkey: parts[2],
        };
    },

    // Create Bluesky Post Web URL
    createBskyPostUrl: (uri) => {
        const parts = Utils.parseAtUri(uri);
        if (!parts) return '#';
        return `https://bsky.app/profile/${parts.did}/post/${parts.rkey}`;
    },

    // Create Bluesky Profile Web URL
    createBskyProfileUrl: (didOrHandle) => {
        if (!didOrHandle) return '#';
        const identifier = didOrHandle.startsWith('did:') ? didOrHandle : didOrHandle;
        return `https://bsky.app/profile/${identifier}`;
    },

    // Create Bluesky Hashtag Web URL
    createBskyHashtagUrl: (tag) => {
        if (!tag) return '#';
        const cleanTag = tag.startsWith('#') ? tag.substring(1) : tag;
        return `https://bsky.app/hashtag/${encodeURIComponent(cleanTag)}`;
    },

    // Universal Bluesky URL Parser
    parseBskyUrl: (urlString) => {
        try {
            const urlObj = new URL(urlString);
            if (urlObj.hostname !== 'bsky.app' || !urlObj.pathname.startsWith('/profile/')) {
                return null;
            }
            const pathParts = urlObj.pathname.split('/').filter(part => part && part.length > 0);
            if (pathParts.length < 2) return null;

            const handleOrDid = pathParts[1];
            if (pathParts.length === 2) {
                return { type: 'profile', identifier: handleOrDid, rkey: null };
            }
            if (pathParts.length === 4) {
                const typeSlug = pathParts[2];
                const rkey = pathParts[3];
                if ((typeSlug === 'feed' || typeSlug === 'lists') && handleOrDid && rkey) {
                    const internalType = (typeSlug === 'lists') ? 'list' : 'feed';
                    return { type: internalType, identifier: handleOrDid, rkey: rkey };
                }
            }
            return null;
        } catch (e) {
            return null;
        }
    },

    // Relative Time Formatting
    relativeTime: (dateString) => {
        const now = new Date();
        const past = new Date(dateString);
        const diffInSeconds = Math.floor((now - past) / 1000);
        const diffInMinutes = Math.floor(diffInSeconds / 60);
        const diffInHours = Math.floor(diffInMinutes / 60);
        const diffInDays = Math.floor(diffInHours / 24);
        const diffInWeeks = Math.floor(diffInDays / 7);

        if (diffInSeconds < 60) return `${diffInSeconds}s`;
        if (diffInMinutes < 60) return `${diffInMinutes}m`;
        if (diffInHours < 24) return `${diffInHours}h`;
        if (diffInDays < 7) return `${diffInDays}d`;
        if (diffInWeeks < 5) return `${diffInWeeks}w`;

        const formatOptions = { month: 'short', day: 'numeric' };
        if (now.getFullYear() !== past.getFullYear()) {
            formatOptions.year = 'numeric';
        }
        return past.toLocaleDateString('en-US', formatOptions);
    },

    // Helper to convert UTF8 byte array to string
    _utf8BytesToString: (bytes) => {
        try {
            return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        } catch (e) {
            console.error("UTF-8 decoding error:", e);
            try {
                return decodeURIComponent(escape(String.fromCharCode.apply(null, bytes)));
            } catch (e2) {
                console.error("UTF-8 decoding fallback error:", e2);
                return '';
            }
        }
    },

    // Parse Facets
    parseFacets: (text, facets) => {
        if (!text) return '';
        if (!facets || facets.length === 0) {
            return Utils.escapeHtml(text).replace(/\n/g, '<br>');
        }

        const textBytes = new TextEncoder().encode(text);
        const segments = [];
        let lastByteEnd = 0;

        const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

        for (const facet of sortedFacets) {
            if (!facet.index || typeof facet.index.byteStart !== 'number' || typeof facet.index.byteEnd !== 'number') {
                console.warn("Skipping facet with invalid index:", facet);
                continue;
            }
            const byteStart = facet.index.byteStart;
            const byteEnd = facet.index.byteEnd;

            if (byteStart < lastByteEnd || byteEnd > textBytes.length || byteStart >= byteEnd) {
                console.warn("Skipping invalid or overlapping facet based on byte range:", facet);
                continue;
            }

            if (byteStart > lastByteEnd) {
                segments.push({ type: 'text', text: Utils._utf8BytesToString(textBytes.slice(lastByteEnd, byteStart)) });
            }

            const facetText = Utils._utf8BytesToString(textBytes.slice(byteStart, byteEnd));
            const feature = facet.features?.[0];

            if (!feature || !feature.$type) {
                segments.push({ type: 'text', text: facetText });
            } else {
                switch (feature.$type) {
                    case 'app.bsky.richtext.facet#link':
                        if (feature.uri) {
                            segments.push({ type: 'link', text: facetText, uri: feature.uri });
                        } else {
                            console.warn("Link facet missing URI:", facet);
                            segments.push({ type: 'text', text: facetText });
                        }
                        break;
                    case 'app.bsky.richtext.facet#mention':
                        if (feature.did) {
                            segments.push({ type: 'mention', text: facetText, did: feature.did });
                        } else {
                            console.warn("Mention facet missing DID:", facet);
                            segments.push({ type: 'text', text: facetText });
                        }
                        break;
                    case 'app.bsky.richtext.facet#tag':
                        if (feature.tag) {
                            segments.push({ type: 'tag', text: facetText, tag: feature.tag });
                        } else {
                            console.warn("Tag facet missing tag property:", facet);
                            segments.push({ type: 'text', text: facetText });
                        }
                        break;
                    default:
                        segments.push({ type: 'text', text: facetText });
                }
            }
            lastByteEnd = byteEnd;
        }

        if (lastByteEnd < textBytes.length) {
            segments.push({ type: 'text', text: Utils._utf8BytesToString(textBytes.slice(lastByteEnd)) });
        }

        const html = segments.map(seg => {
            const escapedText = Utils.escapeHtml(seg.text);
            switch (seg.type) {
                case 'link':
                    return `<a href="${Utils.escapeHtml(seg.uri)}" target="_blank" rel="noopener noreferrer">${escapedText}</a>`;
                case 'mention':
                    const profileUrl = Utils.createBskyProfileUrl(seg.did);
                    return `<a href="${profileUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${escapedText}</a>`;
                case 'tag':
                    const hashtagUrl = Utils.createBskyHashtagUrl(seg.tag);
                    return `<a href="${hashtagUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${escapedText}</a>`;
                case 'text':
                default:
                    return escapedText;
            }
        }).join('');

        return html.replace(/\n/g, '<br>');
    },


    // Extract media (image(s) or video)
    extractMediaInfo: (post) => {
        // Label check
        if (post?.labels && post.labels.length > 0) {
            return null;
        }

        if (!post?.embed) return null;

        let mediaInfo = null;

        try {
            const processImagesEmbed = (imgEmbed) => {
                if (imgEmbed?.images?.length > 0) {
                    const validImages = imgEmbed.images.filter(img => img && (img.fullsize || img.thumb));
                    if (validImages.length > 0) {
                        const images = validImages.map(img => ({
                            // --- CHANGE: Ensure 'url' holds the fullsize for carousel ---
                            url: img.fullsize || img.thumb, // Fallback if fullsize missing
                            fullsize: img.fullsize,
                            thumb: img.thumb,
                            alt: img.alt || ''
                        }));
                        return {
                            mediaType: 'image',
                            // --- CHANGE: Set primaryUrl to thumb if available, else fullsize ---
                            primaryUrl: images[0].thumb || images[0].url, // Use thumb for grid
                            hasMultiple: images.length > 1,
                            allImages: images // Contains both thumb and fullsize for detail view
                        };
                    }
                }
                return null;
            };

            const processVideoEmbed = (videoEmbed) => {
                if (videoEmbed && videoEmbed.thumbnail && videoEmbed.playlist && typeof videoEmbed.playlist === 'string') {
                    return {
                        mediaType: 'video',
                        // --- CHANGE: Rename to primaryUrl for consistency ---
                        primaryUrl: videoEmbed.thumbnail, // Thumbnail is the primary display for grid
                        thumbnail: videoEmbed.thumbnail, // Keep original name for video player
                        playlist: videoEmbed.playlist,
                        aspectRatio: videoEmbed.aspectRatio || null,
                        hasMultiple: false
                    };
                }
                return null;
            };

            const processExternalEmbed = (extEmbed) => {
                if (extEmbed?.external?.thumb && typeof extEmbed.external.thumb === 'string') {
                    if (extEmbed.external.thumb.startsWith('blob:')) {
                        console.warn("Skipping blob thumbnail in external embed for primary display:", extEmbed.external.thumb);
                        return null;
                    }
                    const url = extEmbed.external.thumb;
                    return {
                        mediaType: 'image', // Treat as image for grid display
                        // --- CHANGE: Rename to primaryUrl for consistency ---
                        primaryUrl: url, // External thumb is the primary display for grid
                        hasMultiple: false,
                        // Provide structure similar to images for potential future use, but only thumb available
                        allImages: [{ url: url, fullsize: url, thumb: url, alt: extEmbed.external.title || '' }]
                    };
                }
                return null;
            };

            // Check different embed types
            const embed = post.embed;
            const embedType = embed.$type;

            switch (embedType) {
                case 'app.bsky.embed.images#view':
                case 'app.bsky.embed.images':
                    mediaInfo = processImagesEmbed(embed);
                    break;

                case 'app.bsky.embed.video#view':
                case 'app.bsky.embed.video':
                    mediaInfo = processVideoEmbed(embed);
                    break;

                case 'app.bsky.embed.external#view':
                case 'app.bsky.embed.external':
                    if (!mediaInfo) {
                        mediaInfo = processExternalEmbed(embed);
                    }
                    break;

                case 'app.bsky.embed.recordWithMedia#view':
                case 'app.bsky.embed.recordWithMedia':
                    if (embed.media) {
                        const mediaType = embed.media.$type;
                        if (mediaType === 'app.bsky.embed.images#view' || mediaType === 'app.bsky.embed.images') {
                            mediaInfo = processImagesEmbed(embed.media);
                        } else if (mediaType === 'app.bsky.embed.video#view' || mediaType === 'app.bsky.embed.video') {
                            mediaInfo = processVideoEmbed(embed.media);
                        } else if (mediaType === 'app.bsky.embed.external#view' || mediaType === 'app.bsky.embed.external') {
                            if (!mediaInfo) {
                                mediaInfo = processExternalEmbed(embed.media);
                            }
                        }
                    }
                    if (!mediaInfo && embed.record?.record?.embed) {
                        const nestedEmbed = embed.record.record.embed;
                        const nestedType = nestedEmbed.$type;
                        if (nestedType === 'app.bsky.embed.images#view' || nestedType === 'app.bsky.embed.images') {
                            mediaInfo = processImagesEmbed(nestedEmbed);
                        } else if (nestedType === 'app.bsky.embed.video#view' || nestedType === 'app.bsky.embed.video') {
                            mediaInfo = processVideoEmbed(nestedEmbed);
                        } else if (nestedType === 'app.bsky.embed.external#view' || nestedType === 'app.bsky.embed.external') {
                            if (!mediaInfo) {
                                mediaInfo = processExternalEmbed(nestedEmbed);
                            }
                        }
                    }
                    break;

                case 'app.bsky.embed.record#view':
                case 'app.bsky.embed.record':
                    if (embed.record?.embeds?.length > 0) {
                        for (const quotedEmbed of embed.record.embeds) {
                            const quotedType = quotedEmbed.$type;
                            if (quotedType === 'app.bsky.embed.images#view' || quotedType === 'app.bsky.embed.images') {
                                mediaInfo = processImagesEmbed(quotedEmbed);
                            } else if (quotedType === 'app.bsky.embed.video#view' || quotedType === 'app.bsky.embed.video') {
                                mediaInfo = processVideoEmbed(quotedEmbed);
                            } else if (quotedType === 'app.bsky.embed.external#view' || quotedType === 'app.bsky.embed.external') {
                                if (!mediaInfo) { mediaInfo = processExternalEmbed(quotedEmbed); }
                            }
                            if (mediaInfo) break;
                        }
                    }
                    break;
            }

        } catch (error) {
            console.error("Error extracting media from post:", error, post);
            return null;
        }

        // Ensure we have a valid result with a primaryUrl before returning
        if (mediaInfo && !mediaInfo.primaryUrl) return null;
        // Specific check for video completeness
        if (mediaInfo && mediaInfo.mediaType === 'video' && (!mediaInfo.thumbnail || !mediaInfo.playlist)) return null;

        return mediaInfo;
    },


    // Extract images from a reply post (uses thumb)
    extractReplyImages: (replyPost) => {
        const images = [];
        // Label check
        if (replyPost?.labels && replyPost.labels.length > 0) {
            return images;
        }

        if (!replyPost?.embed) return images;

        try {
            const processEmbed = (embed) => {
                if (!embed) return;
                const embedType = embed.$type;

                if ((embedType === 'app.bsky.embed.images#view' || embedType === 'app.bsky.embed.images') && embed.images) {
                    embed.images.forEach(img => {
                        const url = img.thumb || img.fullsize; // Prefer thumb for reply display
                        if (url && typeof url === 'string' && !url.startsWith('blob:')) {
                            images.push({ url: url, alt: img.alt || '', fullsize: img.fullsize || url });
                        } else if (url) {
                            console.warn("Skipping invalid/blob image URL in reply embed:", url);
                        }
                    });
                } else if ((embedType === 'app.bsky.embed.external#view' || embedType === 'app.bsky.embed.external') && embed.external?.thumb) {
                    if (typeof embed.external.thumb === 'string' && !embed.external.thumb.startsWith('blob:')) {
                        images.push({ url: embed.external.thumb, alt: embed.external.title || '', fullsize: embed.external.thumb });
                    } else if (embed.external.thumb) {
                        console.warn("Skipping invalid/blob external thumbnail URL in reply embed:", embed.external.thumb);
                    }
                } else if ((embedType === 'app.bsky.embed.recordWithMedia#view' || embedType === 'app.bsky.embed.recordWithMedia')) {
                    processEmbed(embed.media);
                    if (images.length === 0 && embed.record?.record?.embed) {
                        processEmbed(embed.record.record.embed);
                    }
                } else if ((embedType === 'app.bsky.embed.record#view' || embedType === 'app.bsky.embed.record')) {
                    if (embed.record?.embeds?.length > 0) {
                        for (const quotedEmbed of embed.record.embeds) {
                            processEmbed(quotedEmbed);
                            if (images.length > 0) break;
                        }
                    }
                }
            }
            processEmbed(replyPost.embed);

        } catch (error) {
            console.error("Error extracting reply images:", error, replyPost);
        }
        // Return unique image URLs
        return Array.from(new Map(images.map(img => [img.url, img])).values());
    },

    // Debounce function
    debounce: (func, wait, immediate) => {
        let timeout;
        return function executedFunction() {
            const context = this;
            const args = arguments;
            const later = function () {
                timeout = null;
                if (!immediate) func.apply(context, args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func.apply(context, args);
        };
    }
};