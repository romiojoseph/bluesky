let currentPostUriForComments = null;
let commentsPaginationCursor = null;

async function fetchBlueskyVideoPostData(atUri) {
    const apiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPosts?uris=${encodeURIComponent(atUri)}`;
    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Bluesky API Error (${response.status}): Failed to fetch post. ${errorText.substring(0, 100)}`);
        }
        const data = await response.json();

        if (data.posts && data.posts.length > 0) {
            const post = data.posts[0];
            return post;
        } else {
            throw new Error('Bluesky post not found. The AT URI might be incorrect or the post deleted.');
        }
    } catch (error) {
        console.error('Error fetching/processing Bluesky post data:', error);
        throw error;
    }
}

async function fetchAndDisplayComments(atUri, cursor, isLoadMore, commentsContainerEl, loadMoreButtonEl, showMessageCallback, urlInputRef, searchButtonRef) {
    currentPostUriForComments = atUri;
    const commentsLoadingMessageArea = commentsContainerEl.querySelector('.message-area');
    const replyCountDisplay = document.getElementById('replyCountDisplay');

    if (!isLoadMore) {
        commentsContainerEl.innerHTML = '<div class="message-area">Loading comments...</div>';
        if (replyCountDisplay) replyCountDisplay.textContent = '';
    }

    const loadMoreButtonText = loadMoreButtonEl.querySelector('.button-text');
    const loadMoreButtonSpinner = loadMoreButtonEl.querySelector('.button-spinner');

    loadMoreButtonEl.disabled = true;
    if (isLoadMore && loadMoreButtonText && loadMoreButtonSpinner) {
        loadMoreButtonText.style.display = 'none';
        loadMoreButtonSpinner.style.display = 'inline-block';
    } else if (!isLoadMore && loadMoreButtonSpinner) { // Ensure spinner is hidden on initial load
        loadMoreButtonSpinner.style.display = 'none';
        if (loadMoreButtonText) loadMoreButtonText.style.display = 'inline';
    }


    try {
        const threadDepth = 5;
        let apiUrl = `https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(atUri)}&depth=${threadDepth}&parentHeight=0`;
        if (cursor) {
            apiUrl += `&cursor=${encodeURIComponent(cursor)}`;
        }

        const response = await fetch(apiUrl);
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to fetch thread (${response.status}): ${errorData.message || response.statusText}`);
        }
        const data = await response.json();

        if (!isLoadMore && commentsContainerEl.firstChild && commentsContainerEl.firstChild.classList && commentsContainerEl.firstChild.classList.contains('message-area')) {
            commentsContainerEl.innerHTML = '';
        }

        if (data.thread) {
            let repliesToRender = [];
            let totalReplyCount = 0;

            if (!isLoadMore && data.thread.post && data.thread.post.replyCount !== undefined) {
                totalReplyCount = data.thread.post.replyCount;
                if (replyCountDisplay) replyCountDisplay.textContent = totalReplyCount > 0 ? `(${formatNumberWithCommas(totalReplyCount)})` : '';
            }


            if (isLoadMore && data.thread.replies) {
                repliesToRender = data.thread.replies;
            } else if (!isLoadMore && data.thread.post && data.thread.replies) {
                repliesToRender = data.thread.replies;
            } else if (!isLoadMore && !data.thread.post) {
                commentsContainerEl.innerHTML = '<div class="message-area error">Main post of the thread not found.</div>';
                return;
            }

            let renderedCount = 0;
            if (repliesToRender && repliesToRender.length > 0) {
                renderedCount = renderReplies(repliesToRender, commentsContainerEl, 0, urlInputRef, searchButtonRef);
            }

            if (renderedCount === 0 && !isLoadMore && commentsContainerEl.innerHTML === '') {
                if (totalReplyCount > 0) {
                    commentsContainerEl.innerHTML = `<div class="message-area">No direct replies found or replies are filtered.</div>`;
                } else {
                    commentsContainerEl.innerHTML = '<div class="message-area">No comments yet.</div>';
                }
            }

            commentsPaginationCursor = null;
            loadMoreButtonEl.style.display = 'none';


        } else {
            if (!isLoadMore) commentsContainerEl.innerHTML = '<div class="message-area error">Could not load comment thread.</div>';
        }

    } catch (error) {
        console.error('Error fetching or displaying thread:', error);
        const errorDisplayTarget = (commentsLoadingMessageArea && !isLoadMore) ? commentsLoadingMessageArea : commentsContainerEl;

        if (!isLoadMore || !commentsContainerEl.hasChildNodes() || (commentsContainerEl.firstChild && commentsContainerEl.firstChild.classList && commentsContainerEl.firstChild.classList.contains('message-area'))) {
            errorDisplayTarget.innerHTML = `<div class="message-area error">Error loading comments: ${error.message}</div>`;
        } else {
            const errorMsgP = document.createElement('p');
            errorMsgP.textContent = `Failed to load more: ${error.message}`;
            errorMsgP.style.color = 'red';
            errorMsgP.style.textAlign = 'center';
            loadMoreButtonEl.parentNode.insertBefore(errorMsgP, loadMoreButtonEl.nextSibling);
            setTimeout(() => errorMsgP.remove(), 5000);
        }
        loadMoreButtonEl.style.display = 'none';
        if (replyCountDisplay) replyCountDisplay.textContent = '';
    } finally {
        loadMoreButtonEl.disabled = false;
        if (loadMoreButtonText && loadMoreButtonSpinner) {
            loadMoreButtonText.style.display = 'inline';
            loadMoreButtonSpinner.style.display = 'none';
        }
    }
}


function renderReplies(repliesArray, parentDomElement, currentReplyDepth, urlInputRef, searchButtonRef) {
    let renderedCount = 0;
    if (!repliesArray || currentReplyDepth > MAX_REPLY_DEPTH) {
        return renderedCount;
    }

    repliesArray.forEach(replyNode => {
        if (replyNode.$type === "app.bsky.feed.defs#threadViewPost" && replyNode.post && !replyNode.post.notFound && !replyNode.post.blocked) {
            if (isPostHiddenByLabels(replyNode.post)) {
                return; // Skip rendering this hidden post and its children
            }
            const commentElement = createCommentElement(replyNode.post, currentReplyDepth, urlInputRef, searchButtonRef);
            parentDomElement.appendChild(commentElement);
            renderedCount++;

            if (replyNode.replies && replyNode.replies.length > 0) {
                const nestedRepliesContainer = document.createElement('div');
                nestedRepliesContainer.classList.add('nested-replies');
                commentElement.appendChild(nestedRepliesContainer);
                renderedCount += renderReplies(replyNode.replies, nestedRepliesContainer, currentReplyDepth + 1, urlInputRef, searchButtonRef);
            }
        } else if (replyNode.$type === "app.bsky.feed.defs#notFoundPost") {
            const notFoundElement = document.createElement('div');
            notFoundElement.classList.add('comment', 'comment-not-found');
            notFoundElement.style.marginLeft = `${currentReplyDepth * 20}px`;
            notFoundElement.textContent = '[Comment not found or deleted]';
            parentDomElement.appendChild(notFoundElement);
            renderedCount++;
        } else if (replyNode.$type === "app.bsky.feed.defs#blockedPost") {
            const blockedElement = document.createElement('div');
            blockedElement.classList.add('comment', 'comment-blocked');
            blockedElement.style.marginLeft = `${currentReplyDepth * 20}px`;
            blockedElement.textContent = '[Comment from a blocked account]';
            parentDomElement.appendChild(blockedElement);
            renderedCount++;
        }
    });
    return renderedCount;
}

function createCommentElement(postView, depth, urlInputRef, searchButtonRef) {
    const commentDiv = document.createElement('div');
    commentDiv.classList.add('comment');
    if (depth > 0) {
        commentDiv.style.paddingLeft = `${10 + depth * 15}px`;
    }

    const authorContainer = document.createElement('div');
    authorContainer.classList.add('comment-author-container');

    const avatar = document.createElement('img');
    avatar.classList.add('comment-avatar');
    avatar.src = postView.author.avatar || DEFAULT_AVATAR;
    avatar.alt = `${postView.author.displayName || postView.author.handle}'s avatar`;
    avatar.onerror = () => { avatar.src = DEFAULT_AVATAR; };
    authorContainer.appendChild(avatar);

    const authorInfoDiv = document.createElement('div');
    authorInfoDiv.classList.add('comment-author-info');

    if (postView.author.verification && postView.author.verification.verifiedStatus === 'valid') {
        const verifiedBadge = document.createElement('span');
        verifiedBadge.classList.add('verification-badge');
        verifiedBadge.innerHTML = '<i class="ph-fill ph-seal-check"></i>';
        authorInfoDiv.appendChild(verifiedBadge);
    }

    const handleSpan = document.createElement('span');
    handleSpan.classList.add('comment-author-handle');
    handleSpan.textContent = `@${postView.author.handle}`;
    authorInfoDiv.appendChild(handleSpan);

    const timestampSpan = document.createElement('span');
    timestampSpan.classList.add('comment-timestamp');
    timestampSpan.textContent = `· ${formatRelativeTime(postView.record.createdAt)}`;
    authorInfoDiv.appendChild(timestampSpan);

    authorContainer.appendChild(authorInfoDiv);
    commentDiv.appendChild(authorContainer);


    const contentDiv = document.createElement('div');
    contentDiv.classList.add('comment-content');

    if (postView.record.text) {
        const textP = document.createElement('p');
        textP.classList.add('comment-text');
        textP.innerHTML = parseFacetsToHtml(postView.record.text, postView.record.facets, urlInputRef, searchButtonRef);
        contentDiv.appendChild(textP);

        textP.querySelectorAll('.internal-bsky-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const bskyUrl = link.dataset.bskyLink;
                if (urlInputRef && searchButtonRef && bskyUrl) {
                    urlInputRef.value = bskyUrl;
                    searchButtonRef.click();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
        });
    }

    if (postView.embed) {
        const embedDiv = document.createElement('div');
        embedDiv.classList.add('comment-embed');

        if (postView.embed.$type === 'app.bsky.embed.images#view' && postView.embed.images) {
            const imagesContainer = document.createElement('div');
            imagesContainer.classList.add('comment-embed-images');
            imagesContainer.classList.add(`count-${Math.min(postView.embed.images.length, 4)}`);
            if (postView.embed.images.length > 4) imagesContainer.classList.add('count-gt-4');

            postView.embed.images.forEach(img => {
                const imgLink = document.createElement('a');
                imgLink.href = img.fullsize;
                imgLink.target = '_blank';
                imgLink.rel = 'noopener noreferrer';

                const imgTag = document.createElement('img');
                imgTag.src = img.thumb;
                imgTag.alt = img.alt || 'Embedded image';
                imgTag.loading = 'lazy';
                imgLink.appendChild(imgTag);
                imagesContainer.appendChild(imgLink);
            });
            embedDiv.appendChild(imagesContainer);
        }
        else if (postView.embed.$type === 'app.bsky.embed.external#view' && postView.embed.external) {
            const ext = postView.embed.external;
            if (ext.uri && ext.uri.toLowerCase().endsWith('.gif')) {
                embedDiv.classList.add('comment-embed-gif');
                const gifImg = document.createElement('img');
                gifImg.src = ext.uri;
                gifImg.alt = ext.title || 'Embedded GIF';
                gifImg.loading = 'lazy';
                embedDiv.appendChild(gifImg);
            } else {
                const externalLink = document.createElement('a');
                externalLink.classList.add('comment-embed-external');
                externalLink.href = ext.uri;
                externalLink.target = '_blank';
                externalLink.rel = 'noopener noreferrer';

                if (ext.thumb) {
                    const thumbImg = document.createElement('img');
                    thumbImg.classList.add('external-thumb');
                    thumbImg.src = ext.thumb;
                    thumbImg.alt = 'External link thumbnail';
                    thumbImg.loading = 'lazy';
                    externalLink.appendChild(thumbImg);
                }

                const textContentDiv = document.createElement('div');
                textContentDiv.classList.add('external-text-content');

                const titleDiv = document.createElement('div');
                titleDiv.classList.add('external-title');
                titleDiv.textContent = ext.title || ext.uri;
                textContentDiv.appendChild(titleDiv);

                if (ext.description) {
                    const descDiv = document.createElement('div');
                    descDiv.classList.add('external-description');
                    descDiv.textContent = ext.description;
                    textContentDiv.appendChild(descDiv);
                }

                const uriDisplayDiv = document.createElement('div');
                uriDisplayDiv.classList.add('external-uri-display');
                uriDisplayDiv.textContent = getDomain(ext.uri);
                textContentDiv.appendChild(uriDisplayDiv);

                externalLink.appendChild(textContentDiv);
                embedDiv.appendChild(externalLink);
            }
        }
        else if (postView.embed.$type === 'app.bsky.embed.record#view' && postView.embed.record) {
            let recordData = null;
            let recordUri = null;
            let authorDid = null;

            if (postView.embed.record.$type === "app.bsky.embed.record#viewRecord") {
                recordData = postView.embed.record.value;
                recordUri = postView.embed.record.uri;
                authorDid = postView.embed.record.author.did;
            } else if (postView.embed.record.$type === "app.bsky.feed.defs#postView") {
                recordData = postView.embed.record.record;
                recordUri = postView.embed.record.uri;
                authorDid = postView.embed.record.author.did;
            }

            if (recordData) {
                const recordContainer = document.createElement('div');
                recordContainer.classList.add('comment-embed-record');

                const recordText = document.createElement('div');
                recordText.classList.add('record-text');
                recordText.innerHTML = parseFacetsToHtml(recordData.text ? recordData.text.substring(0, 150) + (recordData.text.length > 150 ? '...' : '') : '[Quoted post]', recordData.facets, urlInputRef, searchButtonRef);
                recordContainer.appendChild(recordText);

                if (recordUri && authorDid) {
                    const viewQuoteLink = document.createElement('a');
                    viewQuoteLink.href = `https://bsky.app/profile/${authorDid}/post/${recordUri.split('/').pop()}`;
                    viewQuoteLink.target = '_blank';
                    viewQuoteLink.rel = 'noopener noreferrer';
                    viewQuoteLink.classList.add('view-quote-link');
                    viewQuoteLink.textContent = 'View Quote Post';
                    recordContainer.appendChild(viewQuoteLink);
                }
                embedDiv.appendChild(recordContainer);

            } else if (postView.embed.record.$type === "app.bsky.embed.record#notFoundRecord") {
                embedDiv.textContent = '[Quoted post not found]';
            } else if (postView.embed.record.$type === "app.bsky.embed.record#blockedRecord") {
                embedDiv.textContent = '[Quoted post from a blocked account]';
            }
        }
        else if (postView.embed.$type === 'app.bsky.embed.recordWithMedia#view' && postView.embed.record && postView.embed.media) {
            if (postView.embed.media.$type === 'app.bsky.embed.images#view' && postView.embed.media.images) {
                const imagesContainer = document.createElement('div');
                imagesContainer.classList.add('comment-embed-images');
                imagesContainer.classList.add(`count-${Math.min(postView.embed.media.images.length, 4)}`);
                if (postView.embed.media.images.length > 4) imagesContainer.classList.add('count-gt-4');
                postView.embed.media.images.forEach(img => {
                    const imgLink = document.createElement('a'); imgLink.href = img.fullsize; imgLink.target = '_blank'; imgLink.rel = 'noopener noreferrer';
                    const imgTag = document.createElement('img'); imgTag.src = img.thumb; imgTag.alt = img.alt || 'Embedded image'; imgTag.loading = 'lazy';
                    imgLink.appendChild(imgTag); imagesContainer.appendChild(imgLink);
                });
                embedDiv.appendChild(imagesContainer);
            }
            let recordToDisplay = postView.embed.record.record;
            let authorDid = recordToDisplay && recordToDisplay.author ? recordToDisplay.author.did : null;


            if (recordToDisplay && recordToDisplay.value) {
                const recordContainer = document.createElement('div');
                recordContainer.classList.add('comment-embed-record');
                const recordTextDiv = document.createElement('div');
                recordTextDiv.classList.add('record-text');
                recordTextDiv.innerHTML = parseFacetsToHtml(recordToDisplay.value.text ? recordToDisplay.value.text.substring(0, 150) + '...' : '[Quoted Post]', recordToDisplay.value.facets, urlInputRef, searchButtonRef);
                recordContainer.appendChild(recordTextDiv);

                const recordUri = recordToDisplay.uri;
                if (recordUri && authorDid) {
                    const viewQuoteLink = document.createElement('a');
                    viewQuoteLink.href = `https://bsky.app/profile/${authorDid}/post/${recordUri.split('/').pop()}`;
                    viewQuoteLink.target = '_blank'; viewQuoteLink.rel = 'noopener noreferrer';
                    viewQuoteLink.classList.add('view-quote-link');
                    viewQuoteLink.textContent = 'View Quote Post';
                    recordContainer.appendChild(viewQuoteLink);
                }
                embedDiv.appendChild(recordContainer);
            } else if (recordToDisplay && recordToDisplay.$type === "app.bsky.embed.record#notFoundRecord") {
                embedDiv.appendChild(document.createTextNode('[Quoted post not found]'));
            } else if (recordToDisplay && recordToDisplay.$type === "app.bsky.embed.record#blockedRecord") {
                embedDiv.appendChild(document.createTextNode('[Quoted post from a blocked account]'));
            }
        }
        else if (postView.embed.$type === 'app.bsky.embed.video#view') {
            const videoPlaceholder = document.createElement('div');
            videoPlaceholder.classList.add('comment-embed-video-placeholder');
            videoPlaceholder.textContent = '[Video embed]';
            embedDiv.appendChild(videoPlaceholder);
        }


        if (embedDiv.hasChildNodes()) {
            contentDiv.appendChild(embedDiv);
        }
    }
    commentDiv.appendChild(contentDiv);
    return commentDiv;
}


function resetCommentsSection(commentsContainerEl, loadMoreButtonEl) {
    commentsContainerEl.innerHTML = '';
    commentsContainerEl.style.display = 'none';
    loadMoreButtonEl.style.display = 'none';

    const loadMoreButtonText = loadMoreButtonEl.querySelector('.button-text');
    const loadMoreButtonSpinner = loadMoreButtonEl.querySelector('.button-spinner');
    if (loadMoreButtonText) loadMoreButtonText.style.display = 'inline';
    if (loadMoreButtonSpinner) loadMoreButtonSpinner.style.display = 'none';

    const replyCountDisplay = document.getElementById('replyCountDisplay');
    if (replyCountDisplay) replyCountDisplay.textContent = '';


    currentPostUriForComments = null;
    commentsPaginationCursor = null;
}


function getCurrentPostUriForComments() { return currentPostUriForComments; }
function getCommentsPaginationCursor() { return commentsPaginationCursor; }