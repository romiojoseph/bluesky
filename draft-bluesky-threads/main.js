// main.js
import { loadInput, saveInput, clearInputStorage } from './js/storage.js';
import { splitTextIntoPosts, countWords, preprocessText, restoreLineBreaks } from './js/splitter.js'; // Import new functions
import { elements, updateThreadPreview, updateNumberingOptionsVisibility, showButtonFeedback, updateInputCounter } from './js/ui.js'; // Import updateInputCounter

// --- Constants and State ---
let currentSettings = {
    maxChars: 300,
    showNumbers: true,
    numberPosition: 'start',
    addSpaceAroundNumbering: false,
    addEllipsisOnSplit: false,
    preserveSingleLineBreaks: true // New setting for preserving single line breaks
};
let generatedPostsData = [];
let debounceTimeout = null;

// --- Debounce Function ---
function debounce(func, wait) {
    return function executedFunction(...args) {
        const later = () => { clearTimeout(debounceTimeout); func(...args); };
        clearTimeout(debounceTimeout);
        debounceTimeout = setTimeout(later, wait);
    };
}

// --- UI Update Helper ---
/** Updates the character/word counter below the input */
function updateInputCounterUI() {
    const text = elements.inputText.value;
    const charCount = text.length;
    const wordCount = countWords(text); // Use imported counter
    updateInputCounter(charCount, wordCount);
}

// --- Core Update Logic ---
function performUpdate() {
    const text = elements.inputText.value;
    saveInput(text);

    // Pass the whole settings object to the splitter
    generatedPostsData = splitTextIntoPosts(text, currentSettings.maxChars, currentSettings);

    updateThreadPreview(generatedPostsData, currentSettings);
}

const debouncedUpdate = debounce(performUpdate, 250);


// --- Event Handlers ---

function handleInputChange() {
    debouncedUpdate(); // Trigger debounced preview update
    updateInputCounterUI(); // Update counter immediately
}

function handleSettingsChange() {
    // Update settings state from DOM
    currentSettings.maxChars = parseInt(elements.maxCharsInput.value, 10) || 300;
    if (currentSettings.maxChars < 50) currentSettings.maxChars = 50;
    if (currentSettings.maxChars > 1000) currentSettings.maxChars = 1000;
    elements.maxCharsInput.value = currentSettings.maxChars;

    currentSettings.showNumbers = elements.showNumberingCheckbox.checked;
    currentSettings.numberPosition = elements.positionStartRadio.checked ? 'start' : 'end';
    currentSettings.addSpaceAroundNumbering = elements.addSpaceCheckbox.checked;
    currentSettings.addEllipsisOnSplit = elements.addEllipsisCheckbox.checked;
    currentSettings.preserveSingleLineBreaks = elements.preserveLineBreaksCheckbox ?
        elements.preserveLineBreaksCheckbox.checked : true;

    // Update UI related to settings
    updateNumberingOptionsVisibility();

    // Trigger full update
    performUpdate();
}

function handleClearInput() {
    elements.inputText.value = '';
    clearInputStorage();
    performUpdate();
    updateInputCounterUI(); // Update counter after clearing
    showButtonFeedback(elements.clearButton, "Cleared!", true);
}

function handleCopyThread() {
    if (generatedPostsData.length === 0) return;

    const threadString = generatedPostsData.map((postData, index) => {
        const content = postData.content; // Already includes ellipsis if needed
        if (!currentSettings.showNumbers) return content;

        const numbering = `(${index + 1}/${generatedPostsData.length})`;
        const separator = '\n';
        const extraSpace = currentSettings.addSpaceAroundNumbering ? '\n' : '';

        if (currentSettings.numberPosition === 'start') {
            return `${numbering}${extraSpace}${separator}${content}`;
        } else {
            const needsSeparator = !content.endsWith('\n') && !content.endsWith('\r');
            return `${content}${needsSeparator ? separator : ''}${extraSpace}${numbering}`;
        }
    }).join('\n\n---\n\n');

    // Try modern clipboard API first
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(threadString)
            .then(() => showButtonFeedback(elements.copyButton, "Copied!", true))
            .catch(handleCopyError);
    } else {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = threadString;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            document.execCommand('copy');
            showButtonFeedback(elements.copyButton, "Copied!", true);
        } catch (err) {
            handleCopyError(err);
        } finally {
            document.body.removeChild(textarea);
        }
    }
}

function handleCopyError(err) {
    console.error('Failed to copy thread: ', err);
    showButtonFeedback(elements.copyButton, "Copy Failed!", false);
}

// --- Initialization ---
function initialize() {
    // Load saved input
    const savedText = loadInput();
    if (savedText) { elements.inputText.value = savedText; }

    // Check if the preserveLineBreaks element exists, create it if not
    if (!elements.preserveLineBreaksCheckbox) {
        // Create the checkbox div
        const lineBreakDiv = document.createElement('div');
        lineBreakDiv.className = 'setting-group';

        // Create the label and checkbox
        const lineBreakLabel = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'preserveLineBreaksCheckbox';
        checkbox.checked = true; // Default to true

        // Set the label text
        lineBreakLabel.appendChild(checkbox);
        lineBreakLabel.appendChild(document.createTextNode(' Preserve single line breaks within posts'));

        // Add to the div
        lineBreakDiv.appendChild(lineBreakLabel);

        // Add to the settings area (append after ellipsis option)
        const ellipsisDiv = document.querySelector('.setting-group:has(#addEllipsisCheckbox)');
        if (ellipsisDiv && ellipsisDiv.parentNode) {
            ellipsisDiv.parentNode.insertBefore(lineBreakDiv, ellipsisDiv.nextSibling);

            // Add to elements object
            elements.preserveLineBreaksCheckbox = checkbox;

            // Add event listener
            checkbox.addEventListener('change', handleSettingsChange);
        }
    }

    // Initial settings sync from DOM
    currentSettings.maxChars = parseInt(elements.maxCharsInput.value, 10) || 300;
    currentSettings.showNumbers = elements.showNumberingCheckbox.checked;
    currentSettings.numberPosition = elements.positionStartRadio.checked ? 'start' : 'end';
    currentSettings.addSpaceAroundNumbering = elements.addSpaceCheckbox.checked;
    currentSettings.addEllipsisOnSplit = elements.addEllipsisCheckbox.checked;
    currentSettings.preserveSingleLineBreaks = elements.preserveLineBreaksCheckbox ?
        elements.preserveLineBreaksCheckbox.checked : true;

    // Update UI based on initial state
    updateNumberingOptionsVisibility();
    updateInputCounterUI(); // Initial counter update

    // Add event listeners
    elements.inputText.addEventListener('input', handleInputChange);
    elements.clearButton.addEventListener('click', handleClearInput);
    elements.copyButton.addEventListener('click', handleCopyThread);

    // Settings listeners
    elements.maxCharsInput.addEventListener('change', handleSettingsChange);
    elements.showNumberingCheckbox.addEventListener('change', handleSettingsChange);
    elements.positionStartRadio.addEventListener('change', handleSettingsChange);
    elements.positionEndRadio.addEventListener('change', handleSettingsChange);
    elements.addSpaceCheckbox.addEventListener('change', handleSettingsChange);
    elements.addEllipsisCheckbox.addEventListener('change', handleSettingsChange);
    if (elements.preserveLineBreaksCheckbox) {
        elements.preserveLineBreaksCheckbox.addEventListener('change', handleSettingsChange);
    }

    // Perform initial render
    performUpdate();
}

// --- Run Initialization ---
document.addEventListener('DOMContentLoaded', initialize);