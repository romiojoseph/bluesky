// js/ui.js
import { copyTextToClipboard, extractDomain, bskyAppBase } from './utils.js';

// Store references to frequently used elements
let elements = {};

export function initUI(elementRefs) {
    elements = elementRefs; // Store the references passed from main.js
}

/** Displays the raw JSON data with highlighting */
export function displayJson(postData) {
    if (!elements.jsonOutputCode || !postData) return;

    const jsonString = JSON.stringify(postData, null, 2);
    elements.jsonOutputCode.textContent = jsonString;
    delete elements.jsonOutputCode.dataset.highlighted;

    if (typeof hljs !== 'undefined') {
        try {
            hljs.highlightElement(elements.jsonOutputCode);
        } catch (e) { console.error("Highlight.js error:", e); }
    } else { console.warn("highlight.js not loaded."); }
}

/** Clears and displays media (images, video, external embeds, facet links) */
export function displayMedia(postData, showFeedback) {
    if (!elements.mediaPreviewArea) return;

    elements.mediaPreviewArea.innerHTML = '';
    elements.mediaPreviewArea.style.display = 'none';

    const embed = postData?.embed;
    const record = postData?.record;
    let hasMediaOrLinks = false;

    // --- Handle Images ---
    let images = [];
    if (embed?.$type === 'app.bsky.embed.images#view' && embed.images) { images = embed.images; }
    else if (embed?.$type === 'app.bsky.embed.recordWithMedia#view' && embed.media?.$type === 'app.bsky.embed.images#view' && embed.media.images) { images = embed.media.images; }

    if (images.length > 0) {
        const group = createMediaGroup('Images');
        const grid = document.createElement('div'); grid.className = 'image-grid';
        images.forEach(img => {
            const itemWrapper = document.createElement('div'); itemWrapper.className = 'image-grid-item';
            const link = document.createElement('a'); link.href = img.fullsize; link.target = '_blank'; link.title = `View full image (${img.alt || 'No description'})`; link.className = 'preview-image-link';
            const imgElem = document.createElement('img'); imgElem.src = img.thumb; imgElem.alt = img.alt || 'Bluesky Image'; imgElem.classList.add('preview-image'); imgElem.onerror = () => { itemWrapper.style.display = 'none'; };
            link.appendChild(imgElem);
            const metaContainer = document.createElement('div'); metaContainer.className = 'image-meta-container';

            // Alt Text Span
            const altSpan = document.createElement('span');
            altSpan.className = 'image-alt';
            const altTextContent = img.alt || '(No alt text)'; // Determine text
            altSpan.textContent = altTextContent; // Set text
            // Conditionally hide if it's the placeholder text
            if (altTextContent === '(No alt text)') {
                altSpan.style.display = 'none';
            }
            metaContainer.appendChild(altSpan);

            // Dimensions Span
            if (img.aspectRatio?.width && img.aspectRatio?.height) {
                const dimsSpan = document.createElement('span'); dimsSpan.className = 'image-dims'; dimsSpan.textContent = `${img.aspectRatio.width} x ${img.aspectRatio.height}`; metaContainer.appendChild(dimsSpan);
            }

            itemWrapper.appendChild(link); itemWrapper.appendChild(metaContainer); grid.appendChild(itemWrapper);
        });
        group.appendChild(grid); elements.mediaPreviewArea.appendChild(group); hasMediaOrLinks = true;
    }

    // --- Handle Video ---
    if (embed?.$type === 'app.bsky.embed.video#view' && embed.playlist && embed.thumbnail) {
        const group = createMediaGroup('Video');
        const item = document.createElement('div'); item.className = 'video-item';
        const thumb = document.createElement('img'); thumb.src = embed.thumbnail; thumb.alt = 'Video thumbnail'; thumb.className = 'video-thumb'; thumb.onerror = () => { thumb.style.display = 'none'; };
        const playlistInfo = document.createElement('div'); playlistInfo.className = 'playlist-info';
        const urlSpan = document.createElement('span'); urlSpan.className = 'playlist-url'; urlSpan.textContent = embed.playlist;
        const copyBtn = document.createElement('button'); copyBtn.className = 'icon-btn mini-copy-btn'; copyBtn.title = 'Copy Playlist URL'; copyBtn.innerHTML = '<i class="ph-duotone ph-copy-simple"></i>';
        copyBtn.onclick = () => copyTextToClipboard(embed.playlist, showFeedback, 'Playlist URL Copied!');
        playlistInfo.appendChild(urlSpan); playlistInfo.appendChild(copyBtn); item.appendChild(thumb); item.appendChild(playlistInfo); group.appendChild(item); elements.mediaPreviewArea.appendChild(group); hasMediaOrLinks = true;
    }

    // --- Handle External Link Embed ---
    if (embed?.$type === 'app.bsky.embed.external#view' && embed.external) {
        const ext = embed.external; const group = createMediaGroup('External Link');
        const card = document.createElement('a'); card.href = ext.uri; card.target = '_blank'; card.className = 'external-embed-card';
        const thumbContainer = document.createElement('div'); thumbContainer.className = 'external-thumb-container';
        if (ext.thumb) { const thumb = document.createElement('img'); thumb.src = ext.thumb; thumb.alt = 'Link preview'; thumb.className = 'external-thumb'; thumb.onerror = () => { thumbContainer.innerHTML = '<i class="ph ph-link"></i>'; }; thumbContainer.appendChild(thumb); }
        else { thumbContainer.innerHTML = '<i class="ph ph-link"></i>'; }
        const content = document.createElement('div'); content.className = 'external-content'; const title = document.createElement('div'); title.className = 'external-title'; title.textContent = ext.title || 'External Link'; const description = document.createElement('div'); description.className = 'external-description'; description.textContent = ext.description || ''; const domain = document.createElement('div'); domain.className = 'external-domain'; domain.textContent = extractDomain(ext.uri) || ''; content.appendChild(title); content.appendChild(description); content.appendChild(domain); card.appendChild(thumbContainer); card.appendChild(content); group.appendChild(card);
        const urlDisplay = document.createElement('div'); urlDisplay.className = 'external-link-display'; const urlLink = document.createElement('a'); urlLink.href = ext.uri; urlLink.target = '_blank'; urlLink.className = 'external-link-url'; urlLink.textContent = ext.uri; const copyBtn = document.createElement('button'); copyBtn.className = 'icon-btn mini-copy-btn'; copyBtn.title = 'Copy External URL'; copyBtn.innerHTML = '<i class="ph-duotone ph-copy-simple"></i>'; copyBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); copyTextToClipboard(ext.uri, showFeedback, 'External URL Copied!'); }; urlDisplay.appendChild(urlLink); urlDisplay.appendChild(copyBtn); group.appendChild(urlDisplay); elements.mediaPreviewArea.appendChild(group); hasMediaOrLinks = true;
    }

    // --- Handle Quoted Post Embed ---
    if (embed?.$type === 'app.bsky.embed.record#view' || embed?.$type === 'app.bsky.embed.recordWithMedia#view') {
        const group = createMediaGroup('Quoted Post');
        let recordData, authorData, uriData, rkeyData;
        if (embed.$type === 'app.bsky.embed.record#view') { recordData = embed.record?.value; authorData = embed.record?.author; uriData = embed.record?.uri; }
        else { recordData = embed.record?.record?.value; authorData = embed.record?.record?.author; uriData = embed.record?.record?.uri; }
        rkeyData = uriData?.split('/')?.pop(); const quoteText = recordData?.text ? `"${recordData.text.substring(0, 100)}${recordData.text.length > 100 ? '...' : ''}"` : '[No text preview]'; const quoteLink = (authorData && rkeyData) ? `${bskyAppBase}/profile/${authorData.handle || authorData.did}/post/${rkeyData}` : '#'; const quoteDiv = document.createElement('div'); quoteDiv.className = 'quoted-post-container'; quoteDiv.innerHTML = `<span>Quoting @${authorData?.handle || 'unknown'}</span><p style="margin:5px 0;">${quoteText}</p>${(authorData && rkeyData) ? `<a href="${quoteLink}" target="_blank">View quoted post</a>` : ''}`; group.appendChild(quoteDiv); elements.mediaPreviewArea.appendChild(group); hasMediaOrLinks = true;
    }

    // --- Handle Facet Links ---
    if (record?.facets && record.text) {
        const linkFacets = record.facets.filter(facet => facet.features?.some(feature => feature.$type === 'app.bsky.richtext.facet#link'));
        if (linkFacets.length > 0) {
            const group = createMediaGroup('Links Found in Text');
            const encoder = new TextEncoder(); const decoder = new TextDecoder(); const textBytes = encoder.encode(record.text);
            linkFacets.forEach(facet => {
                const linkFeature = facet.features.find(feature => feature.$type === 'app.bsky.richtext.facet#link'); if (!linkFeature) return;
                const byteStart = facet.index.byteStart; const byteEnd = facet.index.byteEnd; let linkText = `[Link Text Error]`;
                try { const textSliceBytes = textBytes.slice(byteStart, byteEnd); linkText = decoder.decode(textSliceBytes); }
                catch (e) { console.error("Error decoding facet text bytes:", e); try { linkText = record.text.substring(byteStart, byteEnd); console.warn("Used potentially inaccurate JS substring for facet text."); } catch (subError) { console.error("JS substring fallback also failed:", subError); } }
                const linkUri = linkFeature.uri; const itemDiv = document.createElement('div'); itemDiv.className = 'facet-link-item';
                const textLink = document.createElement('a'); textLink.href = linkUri; textLink.target = '_blank'; textLink.className = 'facet-link-text'; textLink.textContent = linkText.trim() || '[Empty Link Text]';
                const separator = document.createElement('span'); separator.className = 'facet-link-separator'; separator.textContent = '—';
                const uriContainer = document.createElement('div'); uriContainer.className = 'facet-link-uri-container';
                const uriSpan = document.createElement('span'); uriSpan.className = 'facet-link-uri'; uriSpan.textContent = linkUri;
                const copyBtn = document.createElement('button'); copyBtn.className = 'icon-btn mini-copy-btn'; copyBtn.title = 'Copy Link URL'; copyBtn.innerHTML = '<i class="ph-duotone ph-copy-simple"></i>'; copyBtn.onclick = (e) => { e.preventDefault(); e.stopPropagation(); copyTextToClipboard(linkUri, showFeedback, 'Link URL Copied!'); };
                uriContainer.appendChild(uriSpan); uriContainer.appendChild(copyBtn); itemDiv.appendChild(textLink); itemDiv.appendChild(separator); itemDiv.appendChild(uriContainer); group.appendChild(itemDiv);
            });
            elements.mediaPreviewArea.appendChild(group); hasMediaOrLinks = true;
        }
    }

    if (hasMediaOrLinks) { elements.mediaPreviewArea.style.display = 'block'; }
}


/** Displays Post and Author Labels, updates heading, and checks for special labels */
export function displayLabels(postData) {
    if (!elements.labelArea || !elements.labelHeading || !elements.labelBadgesContainer || !elements.labelHelpText || !postData) {
        console.warn("Label area elements not fully initialized.");
        return { hasLabels: false, isMarkedSpam: false, hasNoUnauthenticated: false };
    }

    elements.labelArea.style.display = 'none'; // Hide initially
    elements.labelHeading.textContent = '';
    elements.labelHelpText.textContent = '';
    elements.labelHelpText.style.display = 'none';
    elements.labelBadgesContainer.innerHTML = ''; // Clear only badges

    let isMarkedSpam = false;
    let hasNoUnauthenticated = false;

    const allLabels = [
        ...(postData.labels || []).map(l => ({ ...l, source: 'post' })),
        ...(postData.author?.labels || []).map(l => ({ ...l, source: 'author' }))
    ];

    if (allLabels.length > 0) {
        elements.labelHeading.textContent = allLabels.length === 1 ? 'Label Found' : 'Labels Found';

        allLabels.forEach(label => {
            const badge = document.createElement('span');
            badge.className = 'label-badge';
            badge.textContent = label.val;
            badge.title = `Source: ${label.source} | CID: ${label.cid || 'N/A'} | Issued by: ${label.src || 'N/A'}`;
            const lowerLabelVal = label.val.toLowerCase();
            badge.dataset.labelType = lowerLabelVal;
            elements.labelBadgesContainer.appendChild(badge);

            if (lowerLabelVal === 'spam' || lowerLabelVal === '!hide' || lowerLabelVal === '!alert') {
                isMarkedSpam = true;
            }
            if (lowerLabelVal === '!no-unauthenticated') {
                hasNoUnauthenticated = true;
            }
        });

        if (hasNoUnauthenticated) {
            elements.labelHelpText.textContent = "The !no-unauthenticated label on Bluesky means the content should be hidden from users who aren't logged in. Please respect the user's privacy when using this tool.";
            elements.labelHelpText.style.display = 'block';
        }

        elements.labelArea.style.display = 'block'; // Show the whole label area
    }

    return { hasLabels: allLabels.length > 0, isMarkedSpam, hasNoUnauthenticated };
}

/** Displays the CID popover */
export function displayCidPopover(cid, showFeedback) {
    if (!elements.cidPopover || !elements.cidValue || !elements.copyCidButton) return;
    if (cid) {
        elements.cidValue.textContent = cid;
        elements.copyCidButton.onclick = () => copyTextToClipboard(cid, showFeedback, 'CID Copied!');
        elements.cidPopover.style.display = 'flex';
    } else { elements.cidPopover.style.display = 'none'; }
}

/** Hides the CID popover */
export function hideCidPopover() {
    if (elements.cidPopover) { elements.cidPopover.style.display = 'none'; }
}

/** Updates the enabled/disabled state of action buttons */
export function updateActionButtons(state) {
    const { postLoaded, cidAvailable, profileAvailable, linksAvailable, handleAvailable, didAvailable } = state;
    elements.copyButton.disabled = !postLoaded;
    elements.downloadButton.disabled = !postLoaded;
    elements.cidButton.disabled = !cidAvailable;
    elements.viewProfileButton.disabled = !profileAvailable;
    elements.moreOptionsButton.disabled = !linksAvailable;
    elements.copyHandleButton.disabled = !handleAvailable;
    elements.copyDidButton.disabled = !didAvailable;

    // No spam icon update needed
    if (!cidAvailable) hideCidPopover();
}

/** Updates the enabled state of the 'More Options' dropdown items */
export function updateMoreOptionsState(state) {
    if (!elements.moreOptionsDropdown) return;
    const { atAvailable, didAvailable, handleAvailable } = state;
    elements.moreOptionsDropdown.querySelector('[data-copy-type="at"]').disabled = !atAvailable;
    elements.moreOptionsDropdown.querySelector('[data-copy-type="did"]').disabled = !didAvailable;
    elements.moreOptionsDropdown.querySelector('[data-copy-type="handle"]').disabled = !handleAvailable;
}

/** Shows/hides the loading overlay */
export function showLoadingOverlay(show) {
    if (elements.loadingOverlay) { elements.loadingOverlay.style.display = show ? 'flex' : 'none'; }
}

/** Manages UI state during loading */
export function setLoading(isLoading) {
    showLoadingOverlay(isLoading);
    elements.fetchButton.disabled = isLoading;

    if (isLoading) {
        elements.errorOutput.style.display = 'none';
        elements.labelArea.style.display = 'none';
        elements.mediaPreviewArea.style.display = 'none';
        elements.jsonContainer.style.display = 'none';
        hideCidPopover();
        if (elements.moreOptionsDropdown) elements.moreOptionsDropdown.style.display = 'none';
    } else {
        elements.jsonContainer.style.display = 'block';
    }
}

/** Displays an error message */
export function displayError(message) {
    if (!elements.errorOutput || !elements.jsonOutputCode) return;
    console.error("Error:", message);
    elements.errorOutput.textContent = `Error: ${message}`;
    elements.errorOutput.style.display = 'block';

    elements.jsonOutputCode.textContent = '{}';
    if (elements.labelArea) elements.labelArea.style.display = 'none';
    if (elements.mediaPreviewArea) elements.mediaPreviewArea.innerHTML = '';
    elements.mediaPreviewArea.style.display = 'none';
    hideCidPopover();
    if (elements.moreOptionsDropdown) elements.moreOptionsDropdown.style.display = 'none';

    if (typeof hljs !== 'undefined') {
        try { delete elements.jsonOutputCode.dataset.highlighted; hljs.highlightElement(elements.jsonOutputCode); }
        catch (e) { console.error("Highlight.js error on empty object:", e); }
    }
    elements.jsonContainer.style.display = 'block';
}

/** Shows copy feedback message */
export function showCopyFeedback(message, isError = false) {
    if (!elements.copyFeedback) return;
    elements.copyFeedback.textContent = message;
    elements.copyFeedback.style.backgroundColor = isError ? 'var(--red)' : 'var(--green)';
    elements.copyFeedback.style.display = 'block';
    elements.copyFeedback.style.animation = 'none';
    elements.copyFeedback.offsetHeight;
    elements.copyFeedback.style.animation = '';
}

// Helper to create a standard group container for media types
function createMediaGroup(title) {
    const group = document.createElement('div'); group.className = 'media-group';
    const heading = document.createElement('h3'); heading.textContent = title;
    group.appendChild(heading); return group;
}