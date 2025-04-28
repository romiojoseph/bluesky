// js/splitter.js

const USER_BREAK_REGEX = /\n\s*---\s*\n/g;
// Updated to allow better control over line breaks
const SINGLE_NEWLINE_MARKER = '<<BR>>';
const HARD_NEWLINE_REGEX = /\n(?!\n)/g; // Match single newlines that aren't followed by another newline
const SENTENCE_END_REGEX = /(?<!\b(?:Mr|Mrs|Ms|Dr|Sr|Jr|St|No|vs)\.)[.!?]\s+/g;
const PARAGRAPH_SPLIT_REGEX = /\n{2,}/g;
const ELLIPSIS = "...";
const ELLIPSIS_LENGTH = ELLIPSIS.length; // Should be 3

/** Counts words */
export function countWords(str) {
    return str.trim().split(/\s+/).filter(Boolean).length;
}

/** Finds start index of the last sentence */
function findLastSentenceStart(text) {
    const trimmedText = text.trimEnd();
    if (!trimmedText) return 0;
    SENTENCE_END_REGEX.lastIndex = 0;
    let lastMatch = null;
    let match;
    while ((match = SENTENCE_END_REGEX.exec(trimmedText)) !== null) {
        lastMatch = match;
    }
    return lastMatch ? lastMatch.index + lastMatch[0].length : 0;
}

/** Estimates sentences */
export function countSentences(str) {
    const sentences = str.split(/[.!?]\s+/).filter(s => s.trim().length > 0);
    return sentences.length || (str.trim().length > 0 ? 1 : 0);
}

/** Counts paragraphs */
export function countParagraphs(str) {
    const paragraphs = str.trim().split(PARAGRAPH_SPLIT_REGEX).filter(p => p.trim().length > 0);
    return paragraphs.length || (str.trim().length > 0 ? 1 : 0);
}

/** Calculates numbering length */
export function getNumberingLength(totalPosts, showNumbers, numberPosition, addSpace) {
    if (!showNumbers || totalPosts <= 0) return 0;
    const numDigits = String(totalPosts).length;
    const numberingText = `(${'9'.repeat(numDigits)}/${totalPosts})`;
    const baseLength = numberingText.length;
    const separatorLength = 1 + (addSpace ? 1 : 0);
    return baseLength + separatorLength;
}

/**
 * Find the last complete word boundary before the given index.
 * @param {string} text - The text to search in
 * @param {number} index - The starting index to look backwards from
 * @returns {number} The index of the last space before a word
 */
function findLastWordBoundary(text, index) {
    // Find the last space before the index
    let i = Math.min(index, text.length - 1);
    while (i >= 0) {
        if (text[i] === ' ') {
            return i;
        }
        i--;
    }
    return -1; // No word boundary found
}

/**
 * Preprocesses text to handle single line breaks
 * @param {string} text Original text
 * @param {boolean} preserveSingleLineBreaks Whether to preserve single line breaks
 */
export function preprocessText(text, preserveSingleLineBreaks) {
    if (preserveSingleLineBreaks) {
        // Mark single line breaks with a special marker
        return text.replace(HARD_NEWLINE_REGEX, SINGLE_NEWLINE_MARKER);
    }
    return text;
}

/**
 * Restore line break markers in the final text
 * @param {string} text Processed text with markers
 */
export function restoreLineBreaks(text) {
    return text.replace(new RegExp(SINGLE_NEWLINE_MARKER, 'g'), '\n');
}

/**
 * Splits text into posts.
 * @returns {Array<{ content: string, stats: object, cutSentenceStartIndex: number | null, ellipsisApplied: boolean, looksCut: boolean }>}
 */
export function splitTextIntoPosts(text, maxChars, settings) {
    const { showNumbers, numberPosition, addSpaceAroundNumbering, addEllipsisOnSplit, preserveSingleLineBreaks = true } = settings;

    // Preprocess text to preserve single line breaks if enabled
    let processedText = preprocessText(text.replace(/\r\n/g, '\n').trim(), preserveSingleLineBreaks);

    if (!processedText) return [];

    const userSegments = processedText.split(USER_BREAK_REGEX);
    let allPostsData = [];
    let requiresRecalculation = true;
    let currentTotalPosts = 0;
    let safetyCounter = 0;

    while (requiresRecalculation && safetyCounter < 5) {
        requiresRecalculation = false;
        const previousTotalPosts = allPostsData.length;
        allPostsData = []; // Reset

        const roughEstimate = userSegments.length + Math.floor(processedText.length / (maxChars > 0 ? maxChars : 300));
        const numberingLength = getNumberingLength(roughEstimate, showNumbers, numberPosition, addSpaceAroundNumbering);
        let effectiveMaxChars = maxChars - numberingLength;
        if (effectiveMaxChars < 10 && showNumbers) effectiveMaxChars = 10;
        else if (effectiveMaxChars <= 0) effectiveMaxChars = showNumbers ? 1 : maxChars;
        // Ensure effectiveMaxChars is at least 0 if possible
        effectiveMaxChars = Math.max(0, effectiveMaxChars);

        for (const segment of userSegments) {
            let remainingText = segment.trim();
            if (remainingText.length === 0) continue;

            while (remainingText.length > 0) {
                let chunk;
                let splitOccurred = false;
                let cutSentenceStartIndex = null;
                let ellipsisApplied = false;
                let looksCut = false;
                let splitIndex = null; // Index *before* the break point

                if (remainingText.length <= effectiveMaxChars) {
                    chunk = remainingText;
                    remainingText = '';
                } else {
                    // Segment needs character limit splitting
                    splitOccurred = true;

                    // Reserve space for ellipsis if needed
                    let reservedChars = 0;
                    if (addEllipsisOnSplit) {
                        reservedChars = ELLIPSIS_LENGTH;
                    }

                    // Adjusted max length for potential ellipsis
                    let adjustedMaxChars = effectiveMaxChars - reservedChars;

                    // Ensure we have at least some characters to work with
                    if (adjustedMaxChars < 10) {
                        adjustedMaxChars = 10;
                        reservedChars = Math.max(0, effectiveMaxChars - 10);
                    }

                    // --- V4 Breakpoint Search: Find best natural break *before* potentialEnd ---
                    let breakPointIndex = -1; // The index *before* the breaking char/sequence

                    let lastDoubleNewlineStart = -1;
                    let lastSpaceIndex = -1;

                    // Search backwards from the potential end position
                    for (let i = adjustedMaxChars; i >= 0; i--) {
                        // Check for double newline: break *before* the first \n
                        if (i > 0 && remainingText[i] === '\n' && remainingText[i - 1] === '\n') {
                            lastDoubleNewlineStart = i - 1;
                            break; // Found the highest priority break
                        }
                        // Check for space: break *at* the space
                        if (remainingText[i] === ' ' && lastSpaceIndex === -1) {
                            lastSpaceIndex = i;
                            // Don't break loop yet, keep searching for double newline
                        }
                    }

                    // Determine the actual break point index
                    if (lastDoubleNewlineStart !== -1) {
                        breakPointIndex = lastDoubleNewlineStart; // Split before \n\n
                    } else if (lastSpaceIndex !== -1) {
                        breakPointIndex = lastSpaceIndex; // Split at space
                    }
                    // --- End V4 Breakpoint Search ---

                    let originalChunkEndCheck; // For checking if sentence looks cut

                    if (breakPointIndex !== -1) { // Found a natural break point
                        splitIndex = breakPointIndex; // Record the index (used later for ellipsis check)
                        // Take text *before* the break point index
                        chunk = remainingText.substring(0, breakPointIndex);
                        originalChunkEndCheck = chunk;
                        // Remaining text starts *from* the break point index
                        remainingText = remainingText.substring(breakPointIndex);
                    } else { // No suitable natural break found, must force break
                        splitIndex = -1; // Mark as forced break

                        // If no break point found and ellipsis enabled, try to find the last word boundary
                        // that would allow us to fit both the text and ellipsis
                        if (addEllipsisOnSplit) {
                            const lastWordIndex = findLastWordBoundary(remainingText, adjustedMaxChars);

                            if (lastWordIndex > 0) {
                                // We found a word boundary we can use
                                chunk = remainingText.substring(0, lastWordIndex);
                                remainingText = remainingText.substring(lastWordIndex);
                                ellipsisApplied = true;
                            } else {
                                // No suitable word boundary, force break at adjusted max
                                chunk = remainingText.substring(0, adjustedMaxChars);
                                remainingText = remainingText.substring(adjustedMaxChars);
                                ellipsisApplied = true;
                            }
                        } else {
                            // No ellipsis needed, break at effective max chars
                            chunk = remainingText.substring(0, effectiveMaxChars);
                            remainingText = remainingText.substring(effectiveMaxChars);
                        }

                        originalChunkEndCheck = chunk;
                    }

                    // Check if sentence looks cut
                    const finalTrimmedEndCheck = (originalChunkEndCheck || chunk).trimEnd();
                    looksCut = splitOccurred && finalTrimmedEndCheck.length > 0 && !/[.!?]$/.test(finalTrimmedEndCheck);

                    // Apply ellipsis if needed
                    if (looksCut && addEllipsisOnSplit) {
                        // If we didn't already apply ellipsis and it will fit
                        if (!ellipsisApplied && chunk.length + ELLIPSIS_LENGTH <= effectiveMaxChars) {
                            chunk += ELLIPSIS;
                            ellipsisApplied = true;
                        }
                        // If we need to force fit the ellipsis
                        else if (!ellipsisApplied) {
                            // Find the last word boundary that would allow us to fit the ellipsis
                            const maxLengthWithEllipsis = effectiveMaxChars - ELLIPSIS_LENGTH;
                            if (maxLengthWithEllipsis > 0) {
                                const lastWordForEllipsis = findLastWordBoundary(chunk, maxLengthWithEllipsis);

                                if (lastWordForEllipsis > 0) {
                                    // Move the extra text to the next post
                                    const extraText = chunk.substring(lastWordForEllipsis);
                                    remainingText = extraText + remainingText;
                                    chunk = chunk.substring(0, lastWordForEllipsis);
                                    chunk += ELLIPSIS;
                                    ellipsisApplied = true;
                                }
                                else if (chunk.length > ELLIPSIS_LENGTH) {
                                    // Last resort: truncate the chunk to fit ellipsis
                                    chunk = chunk.substring(0, maxLengthWithEllipsis) + ELLIPSIS;
                                    ellipsisApplied = true;
                                }
                            }
                        }
                    }
                } // end else (remainingText > effectiveMaxChars)

                // --- Calculate cut sentence start index based on 'looksCut' ---
                const contentToCheckForSentenceStart = ellipsisApplied ? chunk.slice(0, -ELLIPSIS_LENGTH) : chunk;
                cutSentenceStartIndex = looksCut ? findLastSentenceStart(contentToCheckForSentenceStart) : null;

                // --- Store Post ---
                // Trim remainingText *before* storing the current chunk
                remainingText = remainingText.trimStart();
                // Restore line breaks before storing the chunk
                const finalChunk = restoreLineBreaks(chunk);

                // Store only if the final chunk (potentially with ellipsis) has content
                if (finalChunk.length > 0) {
                    const stats = {
                        words: countWords(finalChunk),
                        sentences: countSentences(finalChunk),
                        paragraphs: countParagraphs(finalChunk)
                    };
                    allPostsData.push({
                        content: finalChunk,
                        stats: stats,
                        cutSentenceStartIndex: cutSentenceStartIndex,
                        ellipsisApplied: ellipsisApplied,
                        looksCut: looksCut
                    });
                }

                if (allPostsData.length > 1000) { /* Safety break */
                    console.error("Exceeded post limit."); remainingText = ''; safetyCounter = 10;
                    allPostsData.push({ content: "Error: Too many posts.", stats: {}, cutSentenceStartIndex: null, ellipsisApplied: false, looksCut: false });
                    break;
                }
            } // end while(remainingText)
        } // end for(segment)

        currentTotalPosts = allPostsData.length;
        const newNumberingLength = getNumberingLength(currentTotalPosts, showNumbers, numberPosition, addSpaceAroundNumbering);
        const oldNumberingLength = getNumberingLength(previousTotalPosts, showNumbers, numberPosition, addSpaceAroundNumbering);
        if (newNumberingLength !== oldNumberingLength) {
            requiresRecalculation = true;
        }
        safetyCounter++;
    } // End while (stabilization)

    if (safetyCounter >= 5 && requiresRecalculation) {
        console.warn("Post count stabilization needed more iterations.");
    }

    // After splitting into posts array, for each post (except the first), remove leading blank lines
    for (let i = 1; i < allPostsData.length; i++) {
        allPostsData[i].content = allPostsData[i].content.replace(/^\s*\n+/, '');
    }

    return allPostsData;
}