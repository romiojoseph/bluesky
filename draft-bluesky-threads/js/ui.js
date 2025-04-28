// js/ui.js
import { getNumberingLength } from './splitter.js';

// --- DOM Elements Cache ---
export const elements = {
    inputText: document.getElementById('inputText'),
    threadOutput: document.getElementById('threadOutput'),
    copyButton: document.getElementById('copyButton'),
    clearButton: document.getElementById('clearButton'),
    postCountSpan: document.getElementById('postCount'),
    showNumberingCheckbox: document.getElementById('showNumberingCheckbox'),
    positionOptionsDiv: document.getElementById('positionOptions'),
    positionStartRadio: document.querySelector('input[name="numberingPosition"][value="start"]'),
    positionEndRadio: document.querySelector('input[name="numberingPosition"][value="end"]'),
    maxCharsInput: document.getElementById('maxCharsInput'),
    settingsArea: document.querySelector('.settings-area'),
    addSpaceCheckbox: document.getElementById('addSpaceCheckbox'),
    spaceOptionsDiv: document.getElementById('spaceOptions'),
    addEllipsisCheckbox: document.getElementById('addEllipsisCheckbox'),
    preserveLineBreaksCheckbox: document.getElementById('preserveLineBreaksCheckbox'),
    inputCounter: document.getElementById('inputCounter'),
};

/** Formats post content with numbering */
function formatPost(content, index, totalPosts, showNumbers, numberPosition, addSpace) {
    if (!showNumbers || totalPosts <= 0) return content;
    const numbering = `(${index + 1}/${totalPosts})`;
    const separator = '\n';
    const extraSpace = (addSpace && showNumbers) ? '\n' : '';

    switch (numberPosition) {
        case 'start': return `${numbering}${extraSpace}${separator}${content}`;
        case 'end': {
            const needsSeparator = !content.endsWith('\n') && !content.endsWith('\r');
            return `${content}${needsSeparator ? separator : ''}${extraSpace}${numbering}`;
        }
        default: return content;
    }
}

/** Simple HTML escaping function */
function escapeHtml(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** Updates the thread preview area */
export function updateThreadPreview(postsData, settings) {
    elements.threadOutput.innerHTML = '';
    const totalPosts = postsData.length;
    elements.postCountSpan.textContent = `Posts: ${totalPosts}`;
    elements.copyButton.disabled = totalPosts === 0;

    if (totalPosts === 0) return;

    postsData.forEach((postData, index) => {
        const postElement = document.createElement('div');
        postElement.classList.add('post');

        let rawContent = postData.content; // Includes ellipsis if applied by splitter
        let displayContent; // Content to be rendered (potentially with <mark>)

        // --- Apply Sentence Marking ---
        const startIndex = postData.cutSentenceStartIndex;

        // Check if this post is cut, has a valid startIndex, and ellipsis is applied
        if (postData.looksCut && startIndex !== null && startIndex >= 0) {
            // Content might have ellipsis at the end. Mark the text *before* the ellipsis.
            let contentToMark = rawContent;
            let trailingEllipsis = "";

            if (postData.ellipsisApplied && rawContent.endsWith("...")) {
                contentToMark = rawContent.slice(0, -3);
                trailingEllipsis = "...";
            }

            // Ensure startIndex is within the bounds of the content *to be marked*
            if (startIndex !== null && startIndex >= 0 && startIndex < contentToMark.length) {
                const part1 = escapeHtml(contentToMark.substring(0, startIndex));
                const part2 = escapeHtml(contentToMark.substring(startIndex));
                displayContent = part1 + '<mark>' + part2 + '</mark>' + trailingEllipsis;
            } else {
                // Don't warn, just show the content unmarked
                displayContent = escapeHtml(rawContent);
            }
        } else {
            // No cut detected or no valid start index, just escape the raw content
            displayContent = escapeHtml(rawContent);
        }

        // --- Apply Numbering & Spacing ---
        const formattedPostText = formatPost(
            displayContent,
            index,
            totalPosts,
            settings.showNumbers,
            settings.numberPosition,
            settings.addSpaceAroundNumbering
        );

        // --- Calculate Final Length (for display) ---
        const numberingLength = getNumberingLength(
            totalPosts, settings.showNumbers, settings.numberPosition, settings.addSpaceAroundNumbering
        );
        // Use the length of the content as returned by the splitter (includes ellipsis)
        const finalPostLength = postData.content.length + numberingLength;

        // --- Create Elements ---
        const postContentDiv = document.createElement('div');
        postContentDiv.classList.add('post-content');

        // Add numbering to the display
        postContentDiv.innerHTML = formattedPostText.replace(/\n/g, '<br>');

        // Add post number as data attribute for debugging
        postContentDiv.dataset.postNumber = `${index + 1}/${totalPosts}`;
        if (postData.ellipsisApplied) {
            postContentDiv.dataset.hasEllipsis = 'true';
        }

        // --- Post Counter (left) ---
        const postCounterDiv = document.createElement('div');
        postCounterDiv.classList.add('post-counter');
        let statsHTML = '';
        statsHTML += `<span>Characters: ${postData.content.length}</span>`;
        statsHTML += `<span>Words: ${postData.stats.words}</span>`;
        statsHTML += `<span>${finalPostLength}/${settings.maxChars}</span>`;
        postCounterDiv.innerHTML = statsHTML;

        // --- Copy Text Button (right, plain text) ---
        const postCopyDiv = document.createElement('div');
        postCopyDiv.className = 'post-copy';
        postCopyDiv.style.display = 'flex';
        postCopyDiv.style.alignItems = 'center';

        const copyText = document.createElement('span');
        copyText.textContent = 'Copy';
        copyText.style.cursor = 'pointer';
        copyText.style.userSelect = 'none';
        copyText.style.marginLeft = '12px';
        copyText.style.fontSize = 'inherit';
        copyText.style.fontWeight = 'normal';
        // Remove all button-like styles
        copyText.style.background = 'none';
        copyText.style.border = 'none';
        copyText.style.padding = '0';
        copyText.style.color = 'inherit';
        copyText.style.outline = 'none';
        copyText.tabIndex = 0; // Make it focusable for accessibility

        // Copy handler
        copyText.addEventListener('click', function (e) {
            e.preventDefault();
            // Remove <mark> tags and <br> for copying
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = formattedPostText.replace(/<mark>|<\/mark>/g, '').replace(/<br>/g, '\n');
            const textToCopy = tempDiv.textContent || tempDiv.innerText || "";

            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        const oldText = copyText.textContent;
                        copyText.textContent = 'Copied';
                        setTimeout(() => { copyText.textContent = oldText; }, 1500);
                    });
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = textToCopy;
                textarea.style.position = 'fixed';
                textarea.style.opacity = '0';
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy');
                    const oldText = copyText.textContent;
                    copyText.textContent = 'Copied';
                    setTimeout(() => { copyText.textContent = oldText; }, 1500);
                } finally {
                    document.body.removeChild(textarea);
                }
            }
        });

        // Keyboard accessibility (Enter/Space)
        copyText.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                copyText.click();
            }
        });

        postCopyDiv.appendChild(copyText);

        // --- Counter + Copy Row ---
        const counterRow = document.createElement('div');
        counterRow.className = 'post-meta-row';
        counterRow.style.display = 'flex';
        counterRow.style.justifyContent = 'space-between';
        counterRow.style.alignItems = 'center';
        counterRow.appendChild(postCounterDiv);
        counterRow.appendChild(postCopyDiv);

        // Append
        postElement.appendChild(postContentDiv);
        postElement.appendChild(counterRow);
        elements.threadOutput.appendChild(postElement);
    });
}

/** Updates visibility of numbering position/space options */
export function updateNumberingOptionsVisibility() {
    const show = elements.showNumberingCheckbox.checked;
    elements.positionOptionsDiv.style.display = show ? 'block' : 'none';
    elements.spaceOptionsDiv.style.display = show ? 'block' : 'none';
}

/** Shows temporary feedback on a button */
export function showButtonFeedback(button, message, isSuccess = true) {
    const originalText = button.textContent;
    const originalBg = button.style.backgroundColor;
    button.textContent = message;
    button.style.backgroundColor = isSuccess ? '#16a34a' : '#f50c52';
    button.style.color = isSuccess ? '#ffffff' : '#ffffff';
    button.disabled = true;
    setTimeout(() => {
        button.textContent = originalText;
        button.style.backgroundColor = originalBg;
        button.disabled = false;
    }, 2000);
}

/** Updates the input counter text */
export function updateInputCounter(charCount, wordCount) {
    if (elements.inputCounter) {
        elements.inputCounter.textContent = `Chars: ${charCount} | Words: ${wordCount}`;
    }
}