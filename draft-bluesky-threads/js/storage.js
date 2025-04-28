// js/storage.js
const STORAGE_KEY = 'threadBuilderInput';

/**
 * Saves the given text to localStorage.
 * @param {string} text The text to save.
 */
export function saveInput(text) {
    try {
        localStorage.setItem(STORAGE_KEY, text);
    } catch (e) {
        console.error("Failed to save input to localStorage:", e);
        // Optionally inform the user if storage is full or disabled
    }
}

/**
 * Loads the text from localStorage.
 * @returns {string} The saved text, or an empty string if none is found or an error occurs.
 */
export function loadInput() {
    try {
        return localStorage.getItem(STORAGE_KEY) || '';
    } catch (e) {
        console.error("Failed to load input from localStorage:", e);
        return '';
    }
}

/**
 * Clears the saved text from localStorage.
 */
export function clearInputStorage() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
        console.error("Failed to clear input from localStorage:", e);
    }
}