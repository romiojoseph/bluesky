// js/main.js
import * as utils from './utils.js';
import * as api from './api.js';
import * as ui from './ui.js';

document.addEventListener('DOMContentLoaded', () => {
    // --- Get References to DOM Elements ---
    const elements = {
        postUrlInput: document.getElementById('postUrlInput'),
        fetchButton: document.getElementById('fetchButton'),
        copyButton: document.getElementById('copyButton'),
        downloadButton: document.getElementById('downloadButton'),
        viewProfileButton: document.getElementById('viewProfileButton'),
        cidButton: document.getElementById('cidButton'),
        cidPopover: document.getElementById('cidPopover'),
        cidValue: document.getElementById('cidValue'),
        copyCidButton: document.getElementById('copyCidButton'),
        moreOptionsButton: document.getElementById('moreOptionsButton'),
        moreOptionsDropdown: document.getElementById('moreOptionsDropdown'),
        mediaPreviewArea: document.getElementById('mediaPreviewArea'),
        jsonContainer: document.querySelector('.json-container'),
        jsonOutputCode: document.getElementById('jsonOutput').querySelector('code'),
        errorOutput: document.getElementById('errorOutput'),
        copyFeedback: document.getElementById('copyFeedback'),
        labelArea: document.getElementById('labelArea'),
        labelHeading: document.getElementById('labelHeading'),
        labelHelpText: document.getElementById('labelHelpText'),
        labelBadgesContainer: document.getElementById('labelBadgesContainer'),
        // spamIndicatorIcon reference removed
        loadingOverlay: document.getElementById('loadingOverlay'),
        copyHandleButton: document.getElementById('copyHandleButton'),
        copyDidButton: document.getElementById('copyDidButton'),
    };

    // --- Initialize UI Module with References ---
    ui.initUI(elements);

    // --- Application State ---
    let state = {
        postData: null,
        did: null,
        handle: null,
        rkey: null,
        cid: null,
        // isSpam state property removed
    };

    // --- Core Fetch & Display Logic ---
    async function fetchAndDisplayPost(postIdentifier) {
        ui.setLoading(true);
        resetState();
        updateButtonStatesOnLoading();

        const parsed = utils.parseInput(postIdentifier);
        if (!parsed) {
            ui.displayError(`Invalid Post URL or AT URI format provided.`);
            updateButtonStatesOnError();
            ui.setLoading(false);
            return;
        }

        try {
            let didToFetch = null;
            if (parsed.type === 'did') {
                didToFetch = parsed.did; state.rkey = parsed.rkey;
            } else if (parsed.type === 'handle') {
                didToFetch = await api.resolveHandle(parsed.handle); state.rkey = parsed.rkey;
            }
            if (!didToFetch || !state.rkey) throw new Error("Could not determine DID or Record Key.");

            const atUri = `at://${didToFetch}/app.bsky.feed.post/${state.rkey}`;
            const post = await api.fetchPost(atUri);

            state.postData = post;
            state.did = post.author.did;
            state.handle = post.author.handle;
            state.cid = post.cid;

            ui.displayJson(state.postData);
            ui.displayMedia(state.postData, ui.showCopyFeedback);
            ui.displayLabels(state.postData); // Call displayLabels, but don't need the return value for spam icon anymore
            elements.errorOutput.style.display = 'none';
            updateButtonStatesOnSuccess();

        } catch (error) {
            ui.displayError(error.message || 'An unknown error occurred fetching post.');
            updateButtonStatesOnError();
        } finally {
            ui.setLoading(false);
        }
    }

    function handleUserInputFetch() {
        const inputValue = elements.postUrlInput.value.trim();
        if (!inputValue) {
            ui.displayError('Please enter a Bluesky Post URL or AT URI.');
            return;
        }
        fetchAndDisplayPost(inputValue);
    }

    // --- State Management Helpers ---
    function resetState() {
        // Removed isSpam from reset
        state = { postData: null, did: null, handle: null, rkey: null, cid: null };
    }

    function updateButtonStatesOnLoading() {
        // Removed isSpam from parameters
        ui.updateActionButtons({
            postLoaded: false, cidAvailable: false, profileAvailable: false,
            linksAvailable: false, handleAvailable: false, didAvailable: false
        });
        ui.updateMoreOptionsState({ atAvailable: false, didAvailable: false, handleAvailable: false });
    }
    function updateButtonStatesOnError() {
        // Removed isSpam from parameters
        ui.updateActionButtons({
            postLoaded: false, cidAvailable: false, profileAvailable: false,
            linksAvailable: false, handleAvailable: false, didAvailable: false
        });
        ui.updateMoreOptionsState({ atAvailable: false, didAvailable: false, handleAvailable: false });
    }
    function updateButtonStatesOnSuccess() {
        const profileAvailable = !!state.did;
        const linksAvailable = !!(state.did && state.rkey);
        const handleAvailable = !!state.handle;
        const didAvailable = !!state.did;
        // Removed isSpam from parameters
        ui.updateActionButtons({
            postLoaded: !!state.postData, cidAvailable: !!state.cid,
            profileAvailable: profileAvailable, linksAvailable: linksAvailable,
            handleAvailable: handleAvailable, didAvailable: didAvailable
        });
        ui.updateMoreOptionsState({
            atAvailable: linksAvailable,
            didAvailable: linksAvailable,
            handleAvailable: handleAvailable && !!state.rkey
        });
    }

    // --- Event Listeners ---
    elements.fetchButton.addEventListener('click', handleUserInputFetch);
    elements.postUrlInput.addEventListener('keypress', (event) => {
        if (event.key === 'Enter') { event.preventDefault(); handleUserInputFetch(); }
    });

    elements.copyButton.addEventListener('click', () => {
        if (state.postData) { utils.copyTextToClipboard(JSON.stringify(state.postData, null, 2), ui.showCopyFeedback, 'JSON Copied!'); }
    });

    elements.downloadButton.addEventListener('click', () => {
        if (!state.postData) return;
        try {
            const jsonString = JSON.stringify(state.postData, null, 2); const blob = new Blob([jsonString], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `bsky-post-${state.rkey || state.cid || 'data'}.json`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        } catch (err) { console.error('Download failed:', err); ui.displayError("Download failed."); }
    });

    elements.copyHandleButton.addEventListener('click', () => {
        if (state.handle) { utils.copyTextToClipboard(state.handle, ui.showCopyFeedback, 'Handle Copied!'); }
    });

    elements.copyDidButton.addEventListener('click', () => {
        if (state.did) { utils.copyTextToClipboard(state.did, ui.showCopyFeedback, 'DID Copied!'); }
    });

    elements.viewProfileButton.addEventListener('click', () => {
        if (state.did) { window.open(`${utils.bskyAppBase}/profile/${state.did}`, '_blank'); }
        else if (state.handle) { window.open(`${utils.bskyAppBase}/profile/${state.handle}`, '_blank'); }
    });

    elements.cidButton.addEventListener('click', (event) => {
        event.stopPropagation();
        if (state.cid) { const isVisible = elements.cidPopover.style.display === 'flex'; if (!isVisible) { ui.displayCidPopover(state.cid, ui.showCopyFeedback); } else { ui.hideCidPopover(); } }
    });

    elements.moreOptionsButton.addEventListener('click', (event) => {
        event.stopPropagation(); const isVisible = elements.moreOptionsDropdown.style.display === 'block'; elements.moreOptionsDropdown.style.display = isVisible ? 'none' : 'block'; if (!isVisible) { updateButtonStatesOnSuccess(); }
    });

    elements.moreOptionsDropdown.addEventListener('click', (event) => {
        if (event.target.tagName === 'BUTTON' && !event.target.disabled) {
            const copyType = event.target.dataset.copyType; let textToCopy = ''; let feedback = ''; const base = utils.bskyAppBase;
            if (copyType === 'at' && state.did && state.rkey) { textToCopy = `at://${state.did}/app.bsky.feed.post/${state.rkey}`; feedback = 'AT URI Copied!'; }
            else if (copyType === 'did' && state.did && state.rkey) { textToCopy = `${base}/profile/${state.did}/post/${state.rkey}`; feedback = 'DID Link Copied!'; }
            else if (copyType === 'handle' && state.handle && state.rkey) { textToCopy = `${base}/profile/${state.handle}/post/${state.rkey}`; feedback = 'Handle Link Copied!'; }
            if (textToCopy) { utils.copyTextToClipboard(textToCopy, ui.showCopyFeedback, feedback); }
            elements.moreOptionsDropdown.style.display = 'none';
        }
    });

    document.addEventListener('click', (event) => {
        if (elements.cidPopover.style.display === 'flex' && !elements.cidButton.contains(event.target) && !elements.cidPopover.contains(event.target)) { ui.hideCidPopover(); }
        if (elements.moreOptionsDropdown.style.display === 'block' && !elements.moreOptionsButton.contains(event.target) && !elements.moreOptionsDropdown.contains(event.target)) { elements.moreOptionsDropdown.style.display = 'none'; }
    });

    // --- Initial Load ---
    const defaultPostToLoad = 'https://bsky.app/profile/esa.int/post/3lnfw336jx22a';
    updateButtonStatesOnLoading();
    fetchAndDisplayPost(defaultPostToLoad);

}); // End DOMContentLoaded