const FINDER_STORAGE_KEY = 'bskyViewerFinderItems';
const STATE_STORAGE_KEY = 'bskyViewerState';

function loadFinderItems() {
    try {
        const itemsJson = localStorage.getItem(FINDER_STORAGE_KEY);
        return itemsJson ? JSON.parse(itemsJson) : [];
    } catch (e) {
        console.error("Error loading finder items from localStorage:", e);
        return [];
    }
}

function saveFinderItems(items) {
    try {
        localStorage.setItem(FINDER_STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
        console.error("Error saving finder items to localStorage:", e);
    }
}

function addFinderItem(item) {
    const items = loadFinderItems();

    // Check for duplicates
    const isDuplicate = items.some(existingItem =>
        existingItem.type === item.type &&
        (existingItem.identifier === item.identifier || existingItem.url === item.url)
    );

    if (isDuplicate) {
        throw new Error("This item is already in your Finder list.");
    }

    items.push(item);
    saveFinderItems(items);
}

function removeFinderItem(index) {
    const items = loadFinderItems();
    if (index >= 0 && index < items.length) {
        items.splice(index, 1);
        saveFinderItems(items);
    }
}

function moveFinderItem(index, direction) { // direction: 'up' or 'down'
    const items = loadFinderItems();
    if (index < 0 || index >= items.length) return; // Invalid index

    const newIndex = direction === 'up' ? index - 1 : index + 1;

    if (newIndex < 0 || newIndex >= items.length) return; // Out of bounds

    // Swap items
    [items[index], items[newIndex]] = [items[newIndex], items[index]];
    saveFinderItems(items);
}

// Save current state to localStorage
function saveCurrentState(folderIndex, itemIndex, profileTab) {
    try {
        const state = {
            folderIndex: folderIndex,
            itemIndex: itemIndex,
            profileTab: profileTab
        };
        localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
        console.error("Error saving state to localStorage:", e);
    }
}

// Load state from localStorage
function loadSavedState() {
    try {
        const stateJson = localStorage.getItem(STATE_STORAGE_KEY);
        return stateJson ? JSON.parse(stateJson) : null;
    } catch (e) {
        console.error("Error loading state from localStorage:", e);
        return null;
    }
}