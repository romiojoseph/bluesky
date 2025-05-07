import { appState } from './state.js';
import { initUI, renderSubTabs, loadPosts, clearContent, closeModal } from './ui.js'; // closeModal added

// Save and restore tab state
function saveTabState() {
    const state = {
        mainTab: appState.currentMainTab,
        subTab: appState.currentSubTab
    };
    localStorage.setItem('tabState', JSON.stringify(state));
}
// Make saveTabState accessible globally
window.saveTabState = saveTabState;

function restoreTabState() {
    try {
        const savedState = localStorage.getItem('tabState');
        if (savedState) {
            const state = JSON.parse(savedState);
            if (state.mainTab) {
                appState.currentMainTab = state.mainTab;

                // Update UI to reflect the saved main tab
                const mainTabBtn = document.querySelector(`.header-tabs .tab-button[data-tab="${state.mainTab}"]`);
                if (mainTabBtn) {
                    document.querySelectorAll('.header-tabs .tab-button').forEach(t => t.classList.remove('active'));
                    mainTabBtn.classList.add('active');
                }
            }

            if (state.subTab && state.subTab !== 'sources' && state.subTab !== 'source-posts') {
                appState.currentSubTab = state.subTab;
            } else {
                // Default to 'recent' if saved subtab is a modal/special tab
                appState.currentSubTab = 'recent';
            }
        }
    } catch (e) {
        console.error("Error restoring tab state:", e);
        // Use defaults if restoration fails
        appState.currentMainTab = 'news';
        appState.currentSubTab = 'recent';
    }
}

// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}

// Header Tab Event Listeners
const headerTabs = document.querySelectorAll('.header-tabs .tab-button');
headerTabs.forEach(tab => {
    tab.addEventListener('click', () => {
        appState.currentMainTab = tab.dataset.tab;
        appState.currentSubTab = 'recent'; // Default to 'recent' when changing main tab
        appState.currentSourceUser = null; // Reset source user

        headerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        renderSubTabs(); // Re-render sub-tabs for the new main tab
        clearContent();
        // Reset relevant cursors
        Object.keys(appState.cursors).forEach(key => {
            if (key.startsWith(appState.currentMainTab) || key === 'activeSourcePosts') {
                appState.cursors[key] = null;
            }
        });
        loadPosts(true); // Load initial posts for the new view

        // Save tab state when user changes tabs
        saveTabState();
    });
});


// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Restore tab state before initializing UI
    restoreTabState();

    initUI();

    // Save state when navigating away
    window.addEventListener('beforeunload', saveTabState);
});