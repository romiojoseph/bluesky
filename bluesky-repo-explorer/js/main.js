window.currentViewUserDid = '';
const LAST_VIEWED_PROFILE_KEY = 'bskyExplorer_lastViewedProfile';

// DOM Element variable declarations (let statements)
let loginFormActual, openLoginModalButton, loginHandleInput, appPasswordInput, logoutButtonHeader,
    handleInputEl, submitHandleButton, loadingSection, mainLoadingSpinnerEl, cancelOperationButton,
    profileDetailsSectionEl, collectionsListSection, collectionsListEl, recordsListSection,
    recordsCollectionTitle, recordsLoadingSpinnerIconEl, recordsCountEl, recordsActionInfoEl,
    recordsListEl, backToCollectionsButton, loadMoreRecordsButton, infiniteScrollSentinel,
    recordDetailModalEl, recordJsonContentEl, recordActionsControlsEl,
    filterSelectEl,
    customDateRangeInputsEl, dateFromInput, dateToInput, applyFilterButton,
    selectAllVisibleButton, deselectAllButton, deleteSelectedButton, selectedCountDeleteSpan,
    collectionsLoadingSpinnerEl, blobExportSectionEl, listBlobsButton, blobListContainerEl,
    downloadAllBlobsButton, blobListEl, blobCountEl, exportSelectedJsonButton,
    exportSelectedUrisButton, selectedCountExportSpans, blobListControlsEl,
    selectAllBlobsButton, deselectAllBlobsButton;


document.addEventListener('DOMContentLoaded', async () => {
    // Assign DOM elements (as in your last full main.js)
    loginFormActual = document.getElementById('loginActualForm');
    openLoginModalButton = document.getElementById('openLoginModalButton');
    loginHandleInput = document.getElementById('loginHandleInput');
    appPasswordInput = document.getElementById('appPasswordInput');
    logoutButtonHeader = document.getElementById('logoutButtonHeader');
    handleInputEl = document.getElementById('handleInput');
    submitHandleButton = document.getElementById('submitHandle');
    loadingSection = document.getElementById('loading-section');
    mainLoadingSpinnerEl = document.getElementById('mainLoadingSpinner');
    cancelOperationButton = document.getElementById('cancelOperationButton');
    profileDetailsSectionEl = document.getElementById('profile-details-section');
    collectionsListSection = document.getElementById('collections-list-section');
    collectionsLoadingSpinnerEl = document.getElementById('collectionsLoadingSpinner');
    collectionsListEl = document.getElementById('collectionsList');
    recordsListSection = document.getElementById('records-list-section');
    recordsCollectionTitle = document.getElementById('recordsCollectionTitle');
    recordsLoadingSpinnerIconEl = document.getElementById('recordsLoadingSpinnerIcon');
    recordsCountEl = document.getElementById('recordsCount');
    recordsActionInfoEl = document.getElementById('records-action-info');
    recordsListEl = document.getElementById('recordsList');
    backToCollectionsButton = document.getElementById('backToCollections');
    loadMoreRecordsButton = document.getElementById('loadMoreRecordsButton');
    infiniteScrollSentinel = document.getElementById('infiniteScrollSentinel');
    recordDetailModalEl = document.getElementById('record-detail-modal');
    recordJsonContentEl = document.getElementById('recordJsonContent');
    recordActionsControlsEl = document.getElementById('record-actions-controls');
    filterSelectEl = document.getElementById('filterSelect');
    customDateRangeInputsEl = document.getElementById('customDateRangeInputs');
    dateFromInput = document.getElementById('dateFromInput');
    dateToInput = document.getElementById('dateToInput');
    applyFilterButton = document.getElementById('applyFilterButton');
    selectAllVisibleButton = document.getElementById('selectAllVisibleButton');
    deselectAllButton = document.getElementById('deselectAllButton');
    deleteSelectedButton = document.getElementById('deleteSelectedButton');
    selectedCountDeleteSpan = document.getElementById('selectedCountDelete');
    exportSelectedJsonButton = document.getElementById('exportSelectedJsonButton');
    exportSelectedUrisButton = document.getElementById('exportSelectedUrisButton');
    selectedCountExportSpans = document.querySelectorAll('.selectedCountExport');
    blobExportSectionEl = document.getElementById('blob-export-section');
    listBlobsButton = document.getElementById('listBlobsButton');
    blobListContainerEl = document.getElementById('blob-list-container');
    downloadAllBlobsButton = document.getElementById('downloadAllBlobsButton');
    blobListEl = document.getElementById('blobList');
    blobCountEl = document.getElementById('blobCount');
    blobListControlsEl = document.getElementById('blob-list-controls');
    selectAllBlobsButton = document.getElementById('selectAllBlobsButton');
    deselectAllBlobsButton = document.getElementById('deselectAllBlobsButton');

    // State variables
    let currentViewUserHandle = '';
    let currentProfileData = null;
    let currentCollectionNsid = '';
    let currentRecordsCursor = null;
    let allLoadedRecords = [];
    let selectedRecordsForDeletion = new Set();
    let selectedRecordsForExport = new Set();
    let isFetchingMore = false;
    const INITIAL_LOAD_RECORD_COUNT = 2000;
    const MAX_RECORDS_PER_BURST_FETCH = Math.ceil(INITIAL_LOAD_RECORD_COUNT / 100);
    const MAX_DELETION_BATCH_SIZE = 1000;
    const MAX_EXPORT_BATCH_SIZE = 1000;
    let cancelDeletionFlag = false;
    let listedBlobsCIDs = [];


    async function initializeApp() {
        setupModalCloseButtons();
        await initializeAuth();
        updateAuthUI();
        setupActorSearch('handleInput');

        let profileToLoad = 'bsky.app';
        const lastViewed = localStorage.getItem(LAST_VIEWED_PROFILE_KEY);
        const session = getCurrentSession();

        if (session && session.handle) {
            profileToLoad = session.handle;
        } else if (lastViewed) {
            profileToLoad = lastViewed;
        }

        showMainSection(loadingSection);
        updateLoadingProgress(`Loading ${profileToLoad} profile...`, null, false, true);
        await loadProfileAndCollections(true, profileToLoad);
        if (handleInputEl) handleInputEl.value = '';
        if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.add('hidden');

        if (filterSelectEl) {
            filterSelectEl.addEventListener('change', () => {
                if (customDateRangeInputsEl) customDateRangeInputsEl.classList.toggle('hidden', filterSelectEl.value !== 'customRange');
            });
        }

        if (listBlobsButton) listBlobsButton.addEventListener('click', handleListBlobs);
        if (downloadAllBlobsButton) downloadAllBlobsButton.addEventListener('click', handleDownloadAllBlobs);
        if (exportSelectedJsonButton) exportSelectedJsonButton.addEventListener('click', handleExportSelectedJson);
        if (exportSelectedUrisButton) exportSelectedUrisButton.addEventListener('click', handleExportSelectedUris);
        if (selectAllBlobsButton) selectAllBlobsButton.addEventListener('click', toggleSelectAllBlobs(true));
        if (deselectAllBlobsButton) deselectAllBlobsButton.addEventListener('click', toggleSelectAllBlobs(false));
    }

    if (document.getElementById('loginActualForm') && document.getElementById('loading-section')) {
        initializeApp();
    } else {
        console.error("Core DOM elements for initialization not found. App may not function correctly.");
        setTimeout(initializeApp, 100);
    }

    if (openLoginModalButton) openLoginModalButton.addEventListener('click', () => openModal('loginModal'));

    if (loginFormActual) {
        loginFormActual.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!loginHandleInput || !appPasswordInput) {
                showLoginError("Login form elements not found. Please refresh.");
                return;
            }
            const handle = loginHandleInput.value.trim();
            const password = appPasswordInput.value.trim();
            if (!handle || !password) {
                showLoginError("Handle and App Password are required.");
                return;
            }
            try {
                updateLoadingProgress('Logging in...', null, false, true);
                showMainSection(loadingSection);
                const session = await loginUser(handle, password);
                closeModal('loginModal');
                updateAuthUI();
                loginHandleInput.value = '';
                appPasswordInput.value = '';
                localStorage.setItem(LAST_VIEWED_PROFILE_KEY, session.handle);
                await loadProfileAndCollections(true, session.handle);
                if (handleInputEl) handleInputEl.value = '';
                if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.add('hidden');
            } catch (err) {
                showLoginError(`Login failed: ${err.message}`);
                showMainSection(document.getElementById('global-search-section'));
                if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.add('hidden');
            } finally {
                updateLoadingProgress('Loading...', null, false, false);
            }
        });
    }

    if (logoutButtonHeader) {
        logoutButtonHeader.addEventListener('click', async () => {
            await showCustomConfirm({
                title: "Logout",
                message: "Are you sure you want to logout?",
                onConfirm: async () => {
                    logoutUser(true);
                    updateAuthUI();
                    localStorage.removeItem(LAST_VIEWED_PROFILE_KEY);
                    if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.remove('hidden');
                    await loadProfileAndCollections(true, 'bsky.app');
                    if (handleInputEl) handleInputEl.value = '';
                    if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.add('hidden');
                }
            });
        });
    }

    if (submitHandleButton && handleInputEl) {
        submitHandleButton.addEventListener('click', () => {
            const searchTerm = handleInputEl.value.trim();
            if (searchTerm) {
                if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.remove('hidden');
                loadProfileAndCollections(true, searchTerm).finally(() => {
                    if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.add('hidden');
                });
            } else {
                showCustomStatusModal({ title: "Input Required", message: "Please enter a handle to search." });
            }
        });
        handleInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                clearActorSuggestions();
                if (submitHandleButton) submitHandleButton.click();
            }
        });
    }

    async function loadProfileAndCollections(isNewSearch = true, targetHandleOrDid = null) {
        let effectiveHandle = '';
        if (isNewSearch) {
            effectiveHandle = targetHandleOrDid || (handleInputEl ? handleInputEl.value.trim() : '');
            if (!effectiveHandle) {
                showCustomStatusModal({ title: "Input Error", message: 'Please enter a Bluesky handle to view.' });
                showMainSection(document.getElementById('global-search-section'));
                return;
            }
        } else if (currentViewUserHandle) {
            effectiveHandle = currentViewUserHandle;
        } else {
            updateAuthUI();
            showMainSection(document.getElementById('global-search-section'));
            return;
        }
        clearActorSuggestions();

        showMainSection(loadingSection);
        if (profileDetailsSectionEl) profileDetailsSectionEl.classList.add('hidden');
        if (collectionsListSection) collectionsListSection.classList.add('hidden');
        if (blobExportSectionEl) blobExportSectionEl.classList.add('hidden');
        updateLoadingProgress(`Fetching profile for ${effectiveHandle}...`, null, false, true);

        if (collectionsListEl) collectionsListEl.innerHTML = '';
        if (recordsListEl) recordsListEl.innerHTML = '';
        allLoadedRecords = [];
        currentRecordsCursor = null;
        selectedRecordsForDeletion.clear();
        selectedRecordsForExport.clear();
        updateSelectedCounts();

        if (recordActionsControlsEl) recordActionsControlsEl.classList.add('hidden');
        if (recordsActionInfoEl) recordsActionInfoEl.classList.add('hidden');
        if (customDateRangeInputsEl) customDateRangeInputsEl.classList.add('hidden');
        if (filterSelectEl) filterSelectEl.value = 'manual';

        try {
            currentProfileData = await fetchFullProfileData(effectiveHandle);
            window.currentViewUserDid = currentProfileData.processed.did;
            currentViewUserHandle = currentProfileData.processed.handle;
            localStorage.setItem(LAST_VIEWED_PROFILE_KEY, currentViewUserHandle);

            await displayFullProfile(currentProfileData);

            updateLoadingProgress(`Fetching collections for ${currentViewUserHandle}...`, null, false, true);
            if (collectionsLoadingSpinnerEl) collectionsLoadingSpinnerEl.classList.remove('hidden');

            const userPdsEndpoint = currentProfileData.processed.pds.endpoint;
            const repoDescription = await describeRepo(window.currentViewUserDid, userPdsEndpoint);

            if (collectionsLoadingSpinnerEl) collectionsLoadingSpinnerEl.classList.add('hidden');
            updateAuthUI();

            displayCollectionsForUser(repoDescription.collections, collectionsListEl, handleCollectionClick);

            const session = getCurrentSession();
            if (isLoggedIn() && session.did === window.currentViewUserDid) {
                if (blobExportSectionEl) blobExportSectionEl.classList.remove('hidden');
                if (blobListContainerEl) blobListContainerEl.classList.add('hidden');
                if (blobListEl) blobListEl.innerHTML = '';
                if (blobCountEl) blobCountEl.textContent = '0';
                if (downloadAllBlobsButton) downloadAllBlobsButton.disabled = true;
                if (blobListControlsEl) blobListControlsEl.classList.add('hidden');
            } else {
                if (blobExportSectionEl) blobExportSectionEl.classList.add('hidden');
            }

            if (repoDescription.collections && repoDescription.collections.length > 0) {
                showMainSection(collectionsListSection);
            } else {
                showCustomStatusModal({ title: "No Collections", message: `${currentViewUserHandle} has no browsable collections. Profile information is displayed above.` });
                showMainSection(profileDetailsSectionEl);
            }
            if (profileDetailsSectionEl) profileDetailsSectionEl.classList.remove('hidden');

        } catch (err) {
            if (err.message && (err.message.includes('RepoDeactivated') || err.message.includes('RepoNotFound') || err.message.includes('RepoMigrated'))) {
                showCustomStatusModal({
                    title: "Repository Issue",
                    message: `Could not describe repository for ${effectiveHandle}. The repository might be deactivated, migrated, or not found on the PDS (${currentProfileData && currentProfileData.processed.pds.endpoint ? currentProfileData.processed.pds.endpoint : 'default PDS'}). Profile data might still be available from public sources.`
                });
                if (currentProfileData && profileDetailsSectionEl) {
                    showMainSection(profileDetailsSectionEl);
                    profileDetailsSectionEl.classList.remove('hidden');
                } else {
                    showMainSection(document.getElementById('global-search-section'));
                }
            } else {
                showCustomStatusModal({ title: "Error", message: `Error fetching data for ${effectiveHandle}: ${err.message}` });
                if (profileDetailsSectionEl) profileDetailsSectionEl.classList.add('hidden');
                showMainSection(document.getElementById('global-search-section'));
            }
            localStorage.removeItem(LAST_VIEWED_PROFILE_KEY);
            updateAuthUI();
        } finally {
            updateLoadingProgress('Loading...', null, false, false);
            if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.add('hidden');
            if (collectionsLoadingSpinnerEl) collectionsLoadingSpinnerEl.classList.add('hidden');
        }
    }

    // CORRECTED LOGIC HERE
    function updateRecordActionControlsVisibility() {
        const session = getCurrentSession();
        const isOwnProfile = isLoggedIn() && session && session.did === window.currentViewUserDid;
        const isSystemCollection = NON_DELETABLE_COLLECTIONS.includes(currentCollectionNsid);

        // Determine if the entire action control block should be visible
        const showActionControls = isOwnProfile && !isSystemCollection;

        if (recordActionsControlsEl) recordActionsControlsEl.classList.toggle('hidden', !showActionControls);
        if (recordsActionInfoEl) recordsActionInfoEl.classList.toggle('hidden', !showActionControls);

        if (showActionControls) {
            // If controls are shown, export buttons are always available (their disabled state is separate)
            if (exportSelectedJsonButton) exportSelectedJsonButton.classList.remove('hidden');
            if (exportSelectedUrisButton) exportSelectedUrisButton.classList.remove('hidden');
            // Delete button is only visible if it's not a system collection (already covered by showActionControls)
            if (deleteSelectedButton) deleteSelectedButton.classList.remove('hidden');
        } else {
            // If controls are hidden, ensure individual buttons are also hidden
            if (exportSelectedJsonButton) exportSelectedJsonButton.classList.add('hidden');
            if (exportSelectedUrisButton) exportSelectedUrisButton.classList.add('hidden');
            if (deleteSelectedButton) deleteSelectedButton.classList.add('hidden');
        }
    }


    async function handleCollectionClick(collectionNsid) {
        currentCollectionNsid = collectionNsid;
        allLoadedRecords = [];
        if (recordsListEl) recordsListEl.innerHTML = '';
        currentRecordsCursor = null;
        selectedRecordsForDeletion.clear();
        selectedRecordsForExport.clear();
        updateSelectedCounts();

        updateRecordActionControlsVisibility(); // Set visibility based on new collectionNsid and profile ownership

        if (customDateRangeInputsEl) customDateRangeInputsEl.classList.add('hidden');
        if (filterSelectEl) filterSelectEl.value = 'manual';
        if (blobExportSectionEl) blobExportSectionEl.classList.add('hidden');

        if (recordsCollectionTitle) recordsCollectionTitle.textContent = `Records in ${currentCollectionNsid}`;
        showMainSection(recordsListSection);
        if (profileDetailsSectionEl) profileDetailsSectionEl.classList.remove('hidden');
        if (recordsLoadingSpinnerIconEl) recordsLoadingSpinnerIconEl.classList.remove('hidden');

        await initialBurstFetchRecords();
        setupInfiniteScroll();
    }

    async function initialBurstFetchRecords() {
        isFetchingMore = true;
        let fetchedInBurst = 0;
        if (recordsLoadingSpinnerIconEl) recordsLoadingSpinnerIconEl.classList.remove('hidden');

        // updateRecordActionControlsVisibility() will be called after records are loaded.
        // Hide them initially to prevent flicker.
        if (recordActionsControlsEl) recordActionsControlsEl.classList.add('hidden');
        if (recordsActionInfoEl) recordsActionInfoEl.classList.add('hidden');


        for (let i = 0; i < MAX_RECORDS_PER_BURST_FETCH; i++) {
            if (currentRecordsCursor === null && i > 0 && allLoadedRecords.length > 0) break;
            const userPdsEndpoint = (currentProfileData && currentProfileData.processed && currentProfileData.processed.pds) ? currentProfileData.processed.pds.endpoint : null;
            await fetchAndDisplayRecordsBatch(false, userPdsEndpoint);
            fetchedInBurst++;
            if (!currentRecordsCursor && allLoadedRecords.length > 0) break;
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        isFetchingMore = false;
        if (recordsLoadingSpinnerIconEl) recordsLoadingSpinnerIconEl.classList.add('hidden');

        updateRecordActionControlsVisibility(); // Re-evaluate controls visibility

        if (allLoadedRecords.length > 0) {
            if (recordActionsControlsEl && !recordActionsControlsEl.classList.contains('hidden') && recordsActionInfoEl) {
                if (currentRecordsCursor) {
                    recordsActionInfoEl.textContent = `Actions apply to ${allLoadedRecords.length} loaded records. Max ${INITIAL_LOAD_RECORD_COUNT} loaded initially. Scroll or click "Load More" to fetch additional records.`;
                } else {
                    recordsActionInfoEl.textContent = `Actions apply to all ${allLoadedRecords.length} records.`;
                }
            }
        } else if (!currentRecordsCursor) {
            // recordsActionInfoEl is already hidden by updateRecordActionControlsVisibility if controls are hidden
            if (recordsListEl && recordsListEl.children.length === 0) {
                recordsListEl.innerHTML = '<li>No records found in this collection.</li>';
            }
        }

        if (!currentRecordsCursor) {
            if (infiniteScrollSentinel) infiniteScrollSentinel.classList.add('hidden');
            if (loadMoreRecordsButton) loadMoreRecordsButton.classList.add('hidden');
        } else {
            if (infiniteScrollSentinel) infiniteScrollSentinel.classList.remove('hidden');
            if (loadMoreRecordsButton) loadMoreRecordsButton.classList.remove('hidden');
        }
    }

    // ... (fetchAndDisplayRecordsBatch, setupInfiniteScroll, loadMoreRecordsButton listener, backToCollectionsButton listener, 
    //      handleRecordCheckboxChange, updateSelectedCounts, selectAllVisibleButton, deselectAllButton, 
    //      applyFilterButton listener, cancelOperationButton listener, deleteSelectedButton listener,
    //      blob handlers, export handlers, toggleSelectAllBlobs - these should be the same as your last full version)
    // (Pasting the rest for completeness from the previous known good state)

    async function fetchAndDisplayRecordsBatch(fromScroll = true, pdsHostForRecords = null) {
        if (isFetchingMore && fromScroll) return;
        isFetchingMore = true;
        if (fromScroll) {
            if (recordsLoadingSpinnerIconEl) recordsLoadingSpinnerIconEl.classList.remove('hidden');
        }
        if (loadMoreRecordsButton) loadMoreRecordsButton.classList.add('hidden');

        try {
            const userPdsToUse = pdsHostForRecords || (currentProfileData && currentProfileData.processed && currentProfileData.processed.pds ? currentProfileData.processed.pds.endpoint : null);
            const data = await listRecords(window.currentViewUserDid, currentCollectionNsid, 100, currentRecordsCursor, isLoggedIn() ? getCurrentSession().accessJwt : null, userPdsToUse);

            if (data.records && data.records.length > 0) {
                data.records.forEach(record => {
                    allLoadedRecords.push(record);
                    renderRecordItem(record, currentCollectionNsid, currentViewUserHandle, window.currentViewUserDid, recordsListEl, recordDetailModalEl, recordJsonContentEl, handleRecordCheckboxChange);
                });
            }

            currentRecordsCursor = data.cursor || null;
            if (recordsCountEl) recordsCountEl.textContent = `${allLoadedRecords.length} records loaded.`;

            if (currentRecordsCursor) {
                if (infiniteScrollSentinel) infiniteScrollSentinel.classList.remove('hidden');
                if (loadMoreRecordsButton) loadMoreRecordsButton.classList.remove('hidden');
            } else {
                if (infiniteScrollSentinel) infiniteScrollSentinel.classList.add('hidden');
                if (loadMoreRecordsButton) loadMoreRecordsButton.classList.add('hidden');
                if (allLoadedRecords.length > 0) {
                    if (recordsCountEl) recordsCountEl.textContent += " (All records loaded)";
                    if (recordActionsControlsEl && !recordActionsControlsEl.classList.contains('hidden') && recordsActionInfoEl) {
                        recordsActionInfoEl.textContent = `Actions apply to all ${allLoadedRecords.length} records.`;
                    }
                }
            }

        } catch (err) {
            showCustomStatusModal({ title: "Error", message: `Could not fetch records for ${currentCollectionNsid}: ${err.message}` });
            if (!fromScroll) {
                if (profileDetailsSectionEl && profileDetailsSectionEl.classList.contains('hidden')) {
                    showMainSection(document.getElementById('global-search-section'));
                } else {
                    showMainSection(collectionsListSection);
                    if (profileDetailsSectionEl) profileDetailsSectionEl.classList.remove('hidden');
                }
            }
        } finally {
            isFetchingMore = false;
            if (fromScroll) {
                if (recordsLoadingSpinnerIconEl) recordsLoadingSpinnerIconEl.classList.add('hidden');
            }
        }
    }

    let observer;
    function setupInfiniteScroll() {
        if (observer) observer.disconnect();
        if (!currentRecordsCursor || !infiniteScrollSentinel) {
            if (infiniteScrollSentinel) infiniteScrollSentinel.classList.add('hidden');
            return;
        }
        infiniteScrollSentinel.classList.remove('hidden');

        observer = new IntersectionObserver(async (entries) => {
            if (entries[0].isIntersecting && currentRecordsCursor && !isFetchingMore) {
                if (loadMoreRecordsButton) loadMoreRecordsButton.classList.add('hidden');
                const userPdsEndpoint = (currentProfileData && currentProfileData.processed && currentProfileData.processed.pds) ? currentProfileData.processed.pds.endpoint : null;
                await fetchAndDisplayRecordsBatch(true, userPdsEndpoint);
                if (!currentRecordsCursor) {
                    if (infiniteScrollSentinel) infiniteScrollSentinel.classList.add('hidden');
                    if (observer) observer.disconnect();
                }
            }
        }, { threshold: 0.1 });
        observer.observe(infiniteScrollSentinel);
    }

    if (loadMoreRecordsButton) {
        loadMoreRecordsButton.addEventListener('click', () => {
            if (!isFetchingMore && currentRecordsCursor) {
                if (recordsLoadingSpinnerIconEl) recordsLoadingSpinnerIconEl.classList.remove('hidden');
                const userPdsEndpoint = (currentProfileData && currentProfileData.processed && currentProfileData.processed.pds) ? currentProfileData.processed.pds.endpoint : null;
                fetchAndDisplayRecordsBatch(false, userPdsEndpoint).finally(() => {
                    if (recordsLoadingSpinnerIconEl) recordsLoadingSpinnerIconEl.classList.add('hidden');
                });
            }
        });
    }

    if (backToCollectionsButton) {
        backToCollectionsButton.addEventListener('click', async () => {
            if (observer) observer.disconnect();

            if (currentViewUserHandle && profileDetailsSectionEl && collectionsListSection) {
                showMainSection(loadingSection);
                updateLoadingProgress(`Refreshing collections for ${currentViewUserHandle}...`, null, false, true);
                if (collectionsLoadingSpinnerEl) collectionsLoadingSpinnerEl.classList.remove('hidden');

                try {
                    const userPdsEndpoint = currentProfileData.processed.pds.endpoint;
                    const repoDescription = await describeRepo(window.currentViewUserDid, userPdsEndpoint);
                    displayCollectionsForUser(repoDescription.collections, collectionsListEl, handleCollectionClick);
                    showMainSection(collectionsListSection);
                    profileDetailsSectionEl.classList.remove('hidden');

                    const session = getCurrentSession();
                    if (isLoggedIn() && session.did === window.currentViewUserDid && blobExportSectionEl) {
                        blobExportSectionEl.classList.remove('hidden');
                        if (blobListContainerEl) blobListContainerEl.classList.add('hidden');
                        if (blobListEl) blobListEl.innerHTML = '';
                        if (blobCountEl) blobCountEl.textContent = '0';
                        if (downloadAllBlobsButton) {
                            downloadAllBlobsButton.disabled = true;
                            downloadAllBlobsButton.textContent = `Select Blobs to Download`;
                        }
                        if (blobListControlsEl) blobListControlsEl.classList.add('hidden');
                        selectedBlobCIDs.clear();
                    }

                } catch (error) {
                    showCustomStatusModal({ title: "Error", message: `Could not refresh collections: ${error.message}` });
                    showMainSection(profileDetailsSectionEl);
                } finally {
                    updateLoadingProgress('Loading...', null, false, false);
                    if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.add('hidden');
                    if (collectionsLoadingSpinnerEl) collectionsLoadingSpinnerEl.classList.add('hidden');
                }
            } else {
                showMainSection(document.getElementById('global-search-section'));
            }

            allLoadedRecords = [];
            currentRecordsCursor = null;
            if (recordsListEl) recordsListEl.innerHTML = '';
            selectedRecordsForDeletion.clear();
            selectedRecordsForExport.clear();
            updateSelectedCounts();
            if (recordActionsControlsEl) recordActionsControlsEl.classList.add('hidden');
            if (recordsActionInfoEl) recordsActionInfoEl.classList.add('hidden');
            if (customDateRangeInputsEl) customDateRangeInputsEl.classList.add('hidden');
            if (filterSelectEl) filterSelectEl.value = 'manual';
            updateAuthUI();
        });
    }

    function handleRecordCheckboxChange(event) {
        const checkbox = event.target;
        const recordUri = checkbox.dataset.uri;
        const recordData = allLoadedRecords.find(r => r.uri === recordUri);

        if (!recordData) return;

        const recordIdentifier = JSON.stringify({ uri: recordUri, collection: checkbox.dataset.collection, rkey: checkbox.dataset.rkey });

        if (checkbox.checked) {
            if ((selectedRecordsForDeletion.size + selectedRecordsForExport.size) < MAX_EXPORT_BATCH_SIZE) {
                selectedRecordsForExport.add(JSON.stringify(recordData));
                if (!NON_DELETABLE_COLLECTIONS.includes(currentCollectionNsid)) {
                    selectedRecordsForDeletion.add(recordIdentifier);
                }
            } else {
                checkbox.checked = false;
                showCustomStatusModal({ title: "Selection Limit", message: `You can select a maximum of ${MAX_EXPORT_BATCH_SIZE} records for combined actions at a time.` });
            }
        } else {
            selectedRecordsForExport.delete(JSON.stringify(recordData));
            selectedRecordsForDeletion.delete(recordIdentifier);
        }
        updateSelectedCounts();
    }

    function updateSelectedCounts() {
        if (selectedCountExportSpans) selectedCountExportSpans.forEach(span => span.textContent = selectedRecordsForExport.size);
        if (selectedCountDeleteSpan) selectedCountDeleteSpan.textContent = selectedRecordsForDeletion.size;

        if (exportSelectedJsonButton) exportSelectedJsonButton.disabled = selectedRecordsForExport.size === 0;
        if (exportSelectedUrisButton) exportSelectedUrisButton.disabled = selectedRecordsForExport.size === 0;

        const isDeletableCollection = !NON_DELETABLE_COLLECTIONS.includes(currentCollectionNsid);
        if (deleteSelectedButton) deleteSelectedButton.disabled = selectedRecordsForDeletion.size === 0 || !isDeletableCollection;
    }

    if (selectAllVisibleButton) {
        selectAllVisibleButton.addEventListener('click', () => {
            const checkboxes = recordsListEl.querySelectorAll('.delete-checkbox');
            let currentTotalSelected = selectedRecordsForExport.size;

            checkboxes.forEach(cb => {
                if (currentTotalSelected >= MAX_EXPORT_BATCH_SIZE) return;
                if (!cb.checked) {
                    cb.checked = true;
                    const recordUri = cb.dataset.uri;
                    const recordData = allLoadedRecords.find(r => r.uri === recordUri);
                    if (recordData) {
                        selectedRecordsForExport.add(JSON.stringify(recordData));
                        if (!NON_DELETABLE_COLLECTIONS.includes(currentCollectionNsid)) {
                            selectedRecordsForDeletion.add(JSON.stringify({ uri: recordUri, collection: cb.dataset.collection, rkey: cb.dataset.rkey }));
                        }
                        currentTotalSelected++;
                    }
                }
            });
            if (currentTotalSelected >= MAX_EXPORT_BATCH_SIZE) {
                showCustomStatusModal({ title: "Selection Limit Reached", message: `Maximum ${MAX_EXPORT_BATCH_SIZE} records selected.` });
            }
            updateSelectedCounts();
        });
    }

    if (deselectAllButton) {
        deselectAllButton.addEventListener('click', () => {
            const checkboxes = recordsListEl.querySelectorAll('.delete-checkbox:checked');
            checkboxes.forEach(cb => cb.checked = false);
            selectedRecordsForDeletion.clear();
            selectedRecordsForExport.clear();
            updateSelectedCounts();
        });
    }

    if (applyFilterButton) {
        applyFilterButton.addEventListener('click', () => {
            const filterValue = filterSelectEl.value;

            if (allLoadedRecords.length === 0 && filterValue !== "manual") {
                showCustomStatusModal({ title: "Filter Error", message: "No records loaded to filter." });
                return;
            }

            deselectAllButton.click();

            let targetStartDate, endDate;
            const today = getTodayStart();
            const yesterday = getYesterdayStart();

            if (filterValue === "customRange") {
                const fromVal = dateFromInput.value;
                const toVal = dateToInput.value;
                if (!fromVal || !toVal) {
                    showCustomStatusModal({ title: "Input Error", message: "Please select both 'From' and 'To' dates for custom range." });
                    return;
                }
                targetStartDate = new Date(fromVal);
                targetStartDate.setHours(0, 0, 0, 0);

                endDate = new Date(toVal);
                endDate.setHours(23, 59, 59, 999);

                if (targetStartDate > endDate) {
                    showCustomStatusModal({ title: "Input Error", message: "'From' date cannot be after 'To' date." });
                    return;
                }
            } else if (filterValue !== "manual") {
                switch (filterValue) {
                    case "today": targetStartDate = today; endDate = new Date(); break;
                    case "yesterday": targetStartDate = yesterday; endDate = today; break;
                    case "last3days": targetStartDate = getDateDaysAgo(2); endDate = new Date(); break;
                    case "last7days": targetStartDate = getDateDaysAgo(6); endDate = new Date(); break;
                    case "last15days": targetStartDate = getDateDaysAgo(14); endDate = new Date(); break;
                    case "last30days": targetStartDate = getDateDaysAgo(29); endDate = new Date(); break;
                    default: return;
                }
            } else {
                showCustomStatusModal({ title: "Filter", message: "Manual selection active. Check items individually." });
                return;
            }

            let currentTotalSelected = 0;
            const recordItems = recordsListEl.querySelectorAll('.record-item');

            recordItems.forEach(item => {
                if (currentTotalSelected >= MAX_EXPORT_BATCH_SIZE) return;

                const createdAtISO = item.dataset.createdAt;
                if (!createdAtISO || createdAtISO === 'N/A') return;

                try {
                    const recordDate = new Date(createdAtISO);
                    if (recordDate >= targetStartDate && recordDate <= endDate) {
                        const checkbox = item.querySelector('.delete-checkbox');
                        if (checkbox && !checkbox.checked) {
                            checkbox.checked = true;
                            const recordUri = checkbox.dataset.uri;
                            const recordData = allLoadedRecords.find(r => r.uri === recordUri);
                            if (recordData) {
                                selectedRecordsForExport.add(JSON.stringify(recordData));
                                if (!NON_DELETABLE_COLLECTIONS.includes(currentCollectionNsid)) {
                                    selectedRecordsForDeletion.add(JSON.stringify({ uri: recordUri, collection: checkbox.dataset.collection, rkey: checkbox.dataset.rkey }));
                                }
                                currentTotalSelected++;
                            }
                        }
                    }
                } catch (e) {
                    console.warn("Could not parse date for filtering:", createdAtISO, item);
                }
            });

            if (currentTotalSelected >= MAX_EXPORT_BATCH_SIZE) {
                showCustomStatusModal({ title: "Selection Limit Reached", message: `Filter applied. Maximum ${MAX_EXPORT_BATCH_SIZE} records selected.` });
            } else if (currentTotalSelected === 0) {
                showCustomStatusModal({ title: "Filter Applied", message: "No records matched the selected date range among currently loaded items." });
            } else {
                showCustomStatusModal({ title: "Filter Applied", message: `${currentTotalSelected} records selected.` });
            }
            updateSelectedCounts();
        });
    }

    if (cancelOperationButton) {
        cancelOperationButton.addEventListener('click', () => {
            cancelDeletionFlag = true;
            cancelOperationButton.textContent = "Stopping...";
            cancelOperationButton.disabled = true;
        });
    }

    if (deleteSelectedButton) {
        deleteSelectedButton.addEventListener('click', async () => {
            if (selectedRecordsForDeletion.size === 0) {
                showCustomStatusModal({ message: "No deletable records selected for the current collection type." });
                return;
            }
            if (!isLoggedIn()) {
                showCustomStatusModal({ message: "You must be logged in to delete records." });
                return;
            }

            showDeleteConfirmModal({
                title: "Confirm Deletion",
                message: `You are about to delete ${selectedRecordsForDeletion.size} record(s). This action cannot be undone.`,
                onConfirm: async () => {
                    cancelDeletionFlag = false;
                    if (cancelOperationButton) {
                        cancelOperationButton.textContent = "Cancel Operation";
                        cancelOperationButton.disabled = false;
                    }
                    const session = getCurrentSession();
                    if (!session || session.did !== window.currentViewUserDid) {
                        showCustomStatusModal({ message: "You can only delete your own records." });
                        return;
                    }

                    showMainSection(loadingSection);
                    const totalToDelete = selectedRecordsForDeletion.size;
                    updateLoadingProgress(`Preparing to delete ${totalToDelete} records...`, 0, true, true);

                    let deletedCount = 0;
                    let failedCount = 0;
                    const recordsToDeleteArray = Array.from(selectedRecordsForDeletion).map(item => JSON.parse(item));
                    const userPdsEndpoint = (currentProfileData && currentProfileData.processed && currentProfileData.processed.pds) ? currentProfileData.processed.pds.endpoint : null;

                    for (const record of recordsToDeleteArray) {
                        if (cancelDeletionFlag) {
                            updateLoadingProgress('Deletion cancelling...', 100, true, true);
                            if (cancelOperationButton) cancelOperationButton.disabled = true;
                            break;
                        }
                        try {
                            await deleteRecord(session.did, record.collection, record.rkey, session.accessJwt, userPdsEndpoint);
                            updateRecordUIDeleted(record.uri);
                            allLoadedRecords = allLoadedRecords.filter(r => r.uri !== record.uri);

                            const exportRecordToRemove = Array.from(selectedRecordsForExport).find(expRecStr => {
                                try { return JSON.parse(expRecStr).uri === record.uri; } catch { return false; }
                            });
                            if (exportRecordToRemove) selectedRecordsForExport.delete(exportRecordToRemove);

                            deletedCount++;
                        } catch (err) {
                            console.error(`Failed to delete record ${record.uri}:`, err);
                            failedCount++;
                        }
                        const processedCount = deletedCount + failedCount;
                        const progressPercentage = (processedCount / totalToDelete) * 100;
                        updateLoadingProgress(
                            `Deleting records... ${processedCount}/${totalToDelete} (Deleted: ${deletedCount}, Failed: ${failedCount})`,
                            progressPercentage,
                            true, true
                        );
                        await new Promise(resolve => setTimeout(resolve, 750));
                    }

                    selectedRecordsForDeletion.clear();
                    updateSelectedCounts();
                    if (recordsCountEl) recordsCountEl.textContent = `${allLoadedRecords.length} records loaded.`;

                    let finalTitle = "Deletion Status";
                    let finalMessage = `Deletion process ${cancelDeletionFlag ? 'cancelled' : 'finished'}.`;
                    if (cancelDeletionFlag) finalMessage += ` ${deletedCount} record(s) deleted before cancellation.`;

                    showCustomStatusModal({
                        title: finalTitle,
                        message: finalMessage,
                        details: {
                            total: totalToDelete,
                            success: deletedCount,
                            failed: failedCount,
                            remaining: totalToDelete - (deletedCount + failedCount)
                        },
                        onOk: () => {
                            showMainSection(recordsListSection);
                            if (profileDetailsSectionEl) profileDetailsSectionEl.classList.remove('hidden');
                            updateRecordActionControlsVisibility();
                            if (recordsActionInfoEl && recordActionsControlsEl && !recordActionsControlsEl.classList.contains('hidden')) {
                                if (currentRecordsCursor) {
                                    recordsActionInfoEl.textContent = `Actions apply to ${allLoadedRecords.length} loaded records. Max ${INITIAL_LOAD_RECORD_COUNT} loaded initially. Scroll or click "Load More" to fetch additional records.`;
                                } else {
                                    recordsActionInfoEl.textContent = `Actions apply to all ${allLoadedRecords.length} records.`;
                                }
                            }
                            updateAuthUI();
                        }
                    });
                    updateLoadingProgress('Loading...', null, false, false);
                }
            });
        });
    }

    async function handleListBlobs() {
        const session = getCurrentSession();
        if (!session || session.did !== window.currentViewUserDid) {
            showCustomStatusModal({ title: "Error", message: "You must be logged in and viewing your own profile to list blobs." });
            return;
        }
        if (blobListContainerEl) blobListContainerEl.classList.remove('hidden');
        if (listBlobsButton) {
            listBlobsButton.disabled = true;
            listBlobsButton.innerHTML = 'Listing... <i class="ph-duotone ph-spinner spinner-inline"></i>';
        }
        // Pass the current profile's PDS endpoint
        const userPdsEndpoint = (currentProfileData && currentProfileData.processed && currentProfileData.processed.pds) ? currentProfileData.processed.pds.endpoint : null;
        listedBlobsCIDs = await listUserBlobs(session.did, session.accessJwt, userPdsEndpoint);

        if (listBlobsButton) {
            listBlobsButton.innerHTML = '<i class="ph-fill ph-images"></i>List My Blobs';
            listBlobsButton.disabled = false;
        }
        if (listedBlobsCIDs.length > 0 && blobListControlsEl) {
            blobListControlsEl.classList.remove('hidden');
        } else if (blobListControlsEl) {
            blobListControlsEl.classList.add('hidden');
        }
    }

    async function handleDownloadAllBlobs() {
        const session = getCurrentSession();
        if (!session || session.did !== window.currentViewUserDid) {
            showCustomStatusModal({ title: "Error", message: "You must be logged in and viewing your own profile to download blobs." });
            return;
        }
        const cidsToDownload = Array.from(selectedBlobCIDs);
        if (cidsToDownload.length === 0) {
            showCustomStatusModal({ title: "No Blobs Selected", message: "Please select blobs from the list to download." });
            return;
        }
        if (downloadAllBlobsButton) {
            downloadAllBlobsButton.disabled = true;
            downloadAllBlobsButton.innerHTML = 'Preparing... <i class="ph-duotone ph-spinner spinner-inline"></i>';
        }

        showMainSection(loadingSection);
        updateLoadingProgress('Starting blob download process...', 0, false, true);
        // Pass the current profile's PDS endpoint
        const userPdsEndpoint = (currentProfileData && currentProfileData.processed && currentProfileData.processed.pds) ? currentProfileData.processed.pds.endpoint : null;

        await downloadBlobsAsZip(session.did, cidsToDownload, session.handle, session.accessJwt, userPdsEndpoint);

        if (downloadAllBlobsButton) {
            downloadAllBlobsButton.innerHTML = `Download Selected (${selectedBlobCIDs.size}) as ZIP`;
            downloadAllBlobsButton.disabled = selectedBlobCIDs.size === 0;
        }
        if (mainLoadingSpinnerEl) mainLoadingSpinnerEl.classList.add('hidden');

        showMainSection(collectionsListSection); // Or appropriate previous section
        if (profileDetailsSectionEl) profileDetailsSectionEl.classList.remove('hidden');
        if (isLoggedIn() && session.did === window.currentViewUserDid && blobExportSectionEl) {
            blobExportSectionEl.classList.remove('hidden');
        }
    }

    function toggleSelectAllBlobs(select) {
        return function () {
            if (!blobListEl) return;
            const checkboxes = blobListEl.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
                if (cb.checked !== select) {
                    cb.checked = select;
                    const event = new Event('change', { bubbles: true });
                    cb.dispatchEvent(event);
                }
            });
            if (downloadAllBlobsButton) {
                downloadAllBlobsButton.textContent = `Download Selected (${selectedBlobCIDs.size}) as ZIP`;
                downloadAllBlobsButton.disabled = selectedBlobCIDs.size === 0;
            }
        }
    }

    function handleExportSelectedJson() {
        const recordsToExport = Array.from(selectedRecordsForExport).map(item => JSON.parse(item));
        exportRecordsAsJson(recordsToExport, currentViewUserHandle, currentCollectionNsid);
    }
    function handleExportSelectedUris() {
        const recordsToExport = Array.from(selectedRecordsForExport).map(item => JSON.parse(item));
        exportRecordUris(recordsToExport, currentViewUserHandle, currentCollectionNsid);
    }
});