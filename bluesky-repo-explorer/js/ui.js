const NON_DELETABLE_COLLECTIONS = [
    'app.bsky.actor.profile',
    'chat.bsky.actor.declaration',
    'app.bsky.graph.verification'
];

function showMainSection(sectionElement) {
    const searchHrEl = document.getElementById('search-hr');
    if (searchHrEl) searchHrEl.classList.remove('hidden');

    const loadingSectionEl = document.getElementById('loading-section');
    if (loadingSectionEl) loadingSectionEl.classList.add('hidden');

    const profileDetailsSectionEl = document.getElementById('profile-details-section');
    if (profileDetailsSectionEl) profileDetailsSectionEl.classList.add('hidden');

    const userInfoSectionEl = document.getElementById('user-info-section'); // Old, ensure hidden
    if (userInfoSectionEl) userInfoSectionEl.classList.add('hidden');

    const collectionsListSectionEl = document.getElementById('collections-list-section');
    if (collectionsListSectionEl) collectionsListSectionEl.classList.add('hidden');

    const recordsListSectionEl = document.getElementById('records-list-section');
    if (recordsListSectionEl) recordsListSectionEl.classList.add('hidden');

    const recordsLoadingSpinnerEl = document.getElementById('recordsLoadingSpinnerIcon'); // Corrected ID
    if (recordsLoadingSpinnerEl) recordsLoadingSpinnerEl.classList.add('hidden');

    const recordsActionInfoEl = document.getElementById('records-action-info');
    if (recordsActionInfoEl) recordsActionInfoEl.classList.add('hidden');

    const progressBarContainerEl = document.getElementById('progressBarContainer');
    if (progressBarContainerEl) progressBarContainerEl.classList.add('hidden');

    const progressBarEl = document.getElementById('progressBar');
    if (progressBarEl) progressBarEl.style.width = '0%';

    const loadingTextEl = document.getElementById('loadingText');
    if (loadingTextEl) loadingTextEl.textContent = 'Loading...';

    const cancelOpButtonEl = document.getElementById('cancelOperationButton');
    if (cancelOpButtonEl) cancelOpButtonEl.classList.add('hidden');

    if (sectionElement) {
        sectionElement.classList.remove('hidden');
    } else {
        const globalSearchSectionEl = document.getElementById('global-search-section');
        if (globalSearchSectionEl) globalSearchSectionEl.classList.remove('hidden');
    }
}

function updateAuthUI() {
    const openLoginModalButton = document.getElementById('openLoginModalButton');
    const userSessionInfoEl = document.getElementById('user-session-info');
    const loggedInUserHandleDisplayEl = document.getElementById('loggedInUserHandleDisplay');

    if (isLoggedIn()) {
        const session = getCurrentSession();
        if (loggedInUserHandleDisplayEl) loggedInUserHandleDisplayEl.textContent = session.handle;
        if (openLoginModalButton) openLoginModalButton.classList.add('hidden');
        if (userSessionInfoEl) userSessionInfoEl.classList.remove('hidden');
    } else {
        if (loggedInUserHandleDisplayEl) loggedInUserHandleDisplayEl.textContent = '';
        if (openLoginModalButton) openLoginModalButton.classList.remove('hidden');
        if (userSessionInfoEl) userSessionInfoEl.classList.add('hidden');
    }
}

const verificationTextEl = document.getElementById('profileVerificationText');
if (verificationTextEl) {
    verificationTextEl.addEventListener('click', function (event) {
        const target = event.target.closest('a.issuer-handle');
        if (target && target.dataset.actor) {
            event.preventDefault();
            const actorToLoad = target.dataset.actor;
            const handleInputForEvent = document.getElementById('handleInput');
            const submitButtonForEvent = document.getElementById('submitHandle');
            if (handleInputForEvent && submitButtonForEvent) {
                handleInputForEvent.value = actorToLoad;
                submitButtonForEvent.click();
            }
        }
    });
}


async function displayFullProfile(profileData) {
    const { processed, plcLog } = profileData;

    const profileAvatarEl = document.getElementById('profileAvatar');
    if (profileAvatarEl) {
        profileAvatarEl.src = processed.avatar || 'assets/avatar.svg';
        profileAvatarEl.onerror = () => { profileAvatarEl.src = 'assets/avatar.svg'; };
    }

    const profileDisplayNameEl = document.getElementById('profileDisplayName');
    if (profileDisplayNameEl) profileDisplayNameEl.textContent = processed.displayName;

    const profileAtURIEl = document.getElementById('profileAtURI');
    if (profileAtURIEl) {
        profileAtURIEl.textContent = processed.primaryAtURI;
        profileAtURIEl.href = `https://bsky.app/profile/${processed.handle}`;
    }

    const profileDIDCodeEl = document.getElementById('profileDID');
    if (profileDIDCodeEl) profileDIDCodeEl.textContent = processed.did;

    const copyDIDButton = document.getElementById('copyDIDButton');
    if (copyDIDButton) {
        copyDIDButton.onclick = () => {
            copyToClipboard(processed.did)
                .then(() => showCustomStatusModal({ title: "Copied!", message: "DID copied to clipboard." }))
                .catch(err => showCustomStatusModal({ title: "Copy Failed", message: `Could not copy DID: ${err.message}` }));
        };
    }

    const badgesContainer = document.getElementById('profileVerificationBadges');
    // verificationTextEl is already defined globally for its event listener
    if (badgesContainer) badgesContainer.innerHTML = '';
    if (verificationTextEl) verificationTextEl.innerHTML = '';

    const verificationData = processed.verification || {};
    let verificationDescription = '';

    function createIssuerLinkHTML(issuerHandleOrDid, issuerDisplayName) {
        const safeDisplayName = String(issuerDisplayName || issuerHandleOrDid)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

        const safeActor = String(issuerHandleOrDid)
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");

        return `<a href="#" class="issuer-handle" data-actor="${safeActor}">${safeDisplayName}</a>`;
    }


    if (verificationData.trustedVerifierStatus === 'valid') {
        if (processed.handle === 'bsky.app' || (verificationData.verifications && verificationData.verifications.length === 0)) {
            if (badgesContainer) badgesContainer.innerHTML += `<span class="badge-icon badge-crown" title="Original Trusted Verifier"><i class="ph-fill ph-seal-check"></i></span>`; // Corrected icon
            verificationDescription = 'Official Verifier';
        } else {
            if (badgesContainer) badgesContainer.innerHTML += `<span class="badge-icon badge-seal-check" title="Trusted Verifier"><i class="ph-fill ph-seal-check"></i></span>`;
            if (verificationData.verifications && verificationData.verifications.length > 0) {
                const firstVerification = verificationData.verifications[0];
                const issuerDid = firstVerification.issuer;
                let issuerName = issuerDid;
                let issuerHandleForLink = issuerDid;
                try {
                    const issuerProfile = await getActorProfile(issuerDid);
                    issuerName = issuerProfile.displayName || issuerProfile.handle || issuerDid;
                    issuerHandleForLink = issuerProfile.handle || issuerDid;
                } catch (e) { console.warn("Could not fetch issuer profile for verification text", e); }
                verificationDescription = `Verified by ${createIssuerLinkHTML(issuerHandleForLink, issuerName)} on ${formatISODateToLocal(firstVerification.createdAt)} and recognized as a Trusted Verifier.`;
            } else {
                verificationDescription = 'Trusted Verifier';
            }
        }
    }
    else if (verificationData.verifiedStatus === 'valid' && verificationData.verifications && verificationData.verifications.length > 0) {
        if (badgesContainer) badgesContainer.innerHTML += `<span class="badge-icon badge-check-circle" title="Verified Account"><i class="ph-fill ph-check-circle"></i></span>`;
        const firstVerification = verificationData.verifications[0];
        const issuerDid = firstVerification.issuer;
        let issuerName = issuerDid;
        let issuerHandleForLink = issuerDid;
        try {
            const issuerProfile = await getActorProfile(issuerDid);
            issuerName = issuerProfile.displayName || issuerProfile.handle || issuerDid;
            issuerHandleForLink = issuerProfile.handle || issuerDid;
        } catch (e) { console.warn("Could not fetch issuer profile for verification text", e); }
        verificationDescription = `Verified by ${createIssuerLinkHTML(issuerHandleForLink, issuerName)} on ${formatISODateToLocal(firstVerification.createdAt)}.`;
    }
    if (verificationTextEl) verificationTextEl.innerHTML = verificationDescription;


    if (processed.labels && processed.labels.length > 0 && badgesContainer) {
        const noUnauthenticated = processed.labels.find(label => label.val === '!no-unauthenticated');
        if (noUnauthenticated) {
            badgesContainer.innerHTML += `<span class="badge-icon badge-private" title="Moderation Label: Authenticated Only"><i class="ph-fill ph-lock"></i></span>`; // Corrected icon
        }

        const potentiallyConcerningLabels = processed.labels.filter(
            l => l.val !== '!no-unauthenticated' &&
                (l.val.startsWith('!') || ['porn', 'spam', 'nudity', 'sexual', 'gore'].some(term => l.val.includes(term)))
        );
        if (potentiallyConcerningLabels.length > 0) {
            let alreadyHasWarning = badgesContainer.innerHTML.includes('ph-warning-circle');
            if (!alreadyHasWarning) {
                badgesContainer.innerHTML += `<span class="badge-icon badge-warning-circle" title="Account has moderation labels"><i class="ph-fill ph-warning-circle"></i></span>`;
            }
        }
    }

    const labelerBadgeEl = document.getElementById('labelerBadge');
    if (labelerBadgeEl) {
        if (processed.isLabeler) {
            labelerBadgeEl.innerHTML = `<span class="badge-icon badge-labeler" title="Official Labeler"><i class="ph-duotone ph-identification-card"></i></span>`;
            labelerBadgeEl.classList.remove('hidden');
        } else {
            labelerBadgeEl.classList.add('hidden');
        }
    }

    const profileTimestampsEl = document.getElementById('profileTimestamps');
    if (profileTimestampsEl) {
        let timestampsText = '';
        if (processed.createdAt) {
            timestampsText += `Member since ${formatISODateToLocal(processed.createdAt)}`; // Changed from "Joined on"
        }
        if (processed.indexedAt) {
            const relativeIndexedAt = timeAgo(new Date(processed.indexedAt));
            timestampsText += `${processed.createdAt ? ' • ' : ''}Last indexed <span class="rel-time">${relativeIndexedAt}</span>`;
        }
        profileTimestampsEl.innerHTML = timestampsText || 'Timestamps not available.';
    }

    const pdsTypeEl = document.getElementById('pdsType');
    if (pdsTypeEl) pdsTypeEl.textContent = processed.pds.type;

    const pdsEndpointEl = document.getElementById('pdsEndpoint');
    if (pdsEndpointEl) {
        pdsEndpointEl.textContent = processed.pds.endpoint;
        pdsEndpointEl.href = processed.pds.endpoint.startsWith('http') ? processed.pds.endpoint : '#';
    }

    const plcDirectoryLinkEl = document.getElementById('plcDirectoryLink');
    const plcLogLinkEl = document.getElementById('plcLogLink');
    if (plcDirectoryLinkEl) plcDirectoryLinkEl.href = `https://plc.directory/${processed.did}`;
    if (plcLogLinkEl) plcLogLinkEl.href = `https://plc.directory/${processed.did}/log/audit`;

    // Profile Description was removed. No code needed.

    const metricFollowersEl = document.getElementById('metricFollowers');
    if (metricFollowersEl) metricFollowersEl.textContent = processed.followersCount.toLocaleString();
    const metricFollowingEl = document.getElementById('metricFollowing');
    if (metricFollowingEl) metricFollowingEl.textContent = processed.followsCount.toLocaleString();
    const metricPostsEl = document.getElementById('metricPosts');
    if (metricPostsEl) metricPostsEl.textContent = processed.postsCount.toLocaleString();
    const metricListsEl = document.getElementById('metricLists');
    if (metricListsEl) metricListsEl.textContent = (processed.associated.lists || 0).toLocaleString();
    const metricFeedgensEl = document.getElementById('metricFeedgens');
    if (metricFeedgensEl) metricFeedgensEl.textContent = (processed.associated.feedgens || 0).toLocaleString();
    const metricStarterPacksEl = document.getElementById('metricStarterPacks');
    if (metricStarterPacksEl) metricStarterPacksEl.textContent = (processed.associated.starterPacks || 0).toLocaleString();

    const chatSetting = (processed.associated.chat && processed.associated.chat.allowIncoming);
    const chatAllowIncomingEl = document.getElementById('chatAllowIncoming');
    if (chatAllowIncomingEl) {
        if (chatSetting === 'following') {
            chatAllowIncomingEl.textContent = "This user only accepts new messages from users they follow.";
        } else if (chatSetting === 'none') {
            chatAllowIncomingEl.textContent = "This user is not accepting any new messages.";
        } else if (chatSetting === 'all') {
            chatAllowIncomingEl.textContent = "This user accepts new messages from everyone.";
        } else {
            chatAllowIncomingEl.textContent = "Cannot retrieve user's message settings.";
        }
    }

    const profileDetailsSectionElToShow = document.getElementById('profile-details-section');
    if (profileDetailsSectionElToShow) profileDetailsSectionElToShow.classList.remove('hidden');

    const profileHistoryButton = document.getElementById('profileHistoryButton');
    if (profileHistoryButton) {
        if (plcLog && plcLog.length > 0) {
            profileHistoryButton.onclick = () => displayPlcHistory(plcLog, processed.primaryAtURI);
            profileHistoryButton.disabled = false;
        } else {
            profileHistoryButton.disabled = true;
        }
    }
}
// ... (Rest of ui.js: displayPlcHistory, displayCollectionsForUser, getRecordTimestamps, renderRecordItem, etc. as provided in the last full version)
// Ensure these functions also have null checks for elements they touch if they are called independently.
function displayPlcHistory(plcLog, primaryAtHandle) {
    const timelineContainer = document.getElementById('plcHistoryTimeline');
    if (!timelineContainer) return;
    timelineContainer.innerHTML = '';

    if (!plcLog || plcLog.length === 0) {
        timelineContainer.innerHTML = '<p>No PLC history available.</p>';
        openModal('profileHistoryModal');
        return;
    }

    plcLog.slice().reverse().forEach(entry => {
        const entryDiv = document.createElement('div');
        entryDiv.classList.add('plc-log-entry');

        let titleText = entry.operation.type.replace('_', ' ');
        if (entry.operation.type === 'plc_operation' && entry.operation.alsoKnownAs && entry.operation.alsoKnownAs.length > 0) {
            const displayHandle = entry.operation.alsoKnownAs.find(aka => aka === primaryAtHandle) || entry.operation.alsoKnownAs[0];
            titleText = `${displayHandle}`;
        } else if (entry.operation.type === 'create') {
            titleText = `at://${entry.operation.handle}`;
        }

        let operationDetails = '';
        if (entry.operation.type === 'create') {
            operationDetails = `Initial Service: ${entry.operation.service}`;
        } else if (entry.operation.type === 'plc_operation') {
            if (entry.operation.services && entry.operation.services.atproto_pds) {
                operationDetails += `PDS Endpoint changed to: ${entry.operation.services.atproto_pds.endpoint}. `;
            }
        }

        entryDiv.innerHTML = `
            <h5>${titleText} <span style="font-size:0.8em; color: #777;">(${formatISODateToLocal(entry.createdAt)})</span></h5>
            <p><strong>CID:</strong> ${entry.cid}</p>
            ${operationDetails ? `<p>${operationDetails}</p>` : ''}
            <details>
                <summary>Raw Operation JSON</summary>
                <pre>${JSON.stringify(entry.operation, null, 2)}</pre>
            </details>
        `;
        timelineContainer.appendChild(entryDiv);
    });

    openModal('profileHistoryModal');
}
function displayCollectionsForUser(collections, collectionsListEl, onCollectionClick) {
    if (!collectionsListEl) return;
    collectionsListEl.innerHTML = '';
    if (collections.length === 0) {
        collectionsListEl.innerHTML = '<li>No collections found for this user or repository is not fully set up.</li>';
    } else {
        collections.forEach(collectionNsid => {
            const li = document.createElement('li');
            // Changed from creating an <a> tag inside to making the <li> itself clickable
            // and more easily stylable as a block.
            li.textContent = collectionNsid;
            li.dataset.collection = collectionNsid;
            li.style.cursor = 'pointer'; // Indicate it's clickable
            li.setAttribute('role', 'button'); // Accessibility
            li.setAttribute('tabindex', '0'); // Make it focusable
            li.addEventListener('click', (e) => {
                e.preventDefault();
                onCollectionClick(collectionNsid);
            });
            li.addEventListener('keypress', (e) => { // Allow activation with Enter key
                if (e.key === 'Enter') {
                    e.preventDefault();
                    onCollectionClick(collectionNsid);
                }
            });
            collectionsListEl.appendChild(li);
        });
    }
}

function getRecordTimestamps(recordValue, indexedAt = null) {
    const timestamps = [];
    const primaryTimestampCandidates = ['createdAt', 'publishedAt'];
    let primaryTimestampForFiltering = null;

    for (const key of primaryTimestampCandidates) {
        if (recordValue && recordValue[key] && isValidISODateString(recordValue[key])) {
            timestamps.push({ label: key, value: recordValue[key] });
            if (!primaryTimestampForFiltering) primaryTimestampForFiltering = recordValue[key];
        }
    }

    if (recordValue) {
        for (const key in recordValue) {
            if (key.endsWith('At') && !primaryTimestampCandidates.includes(key) && isValidISODateString(recordValue[key])) {
                if (!timestamps.some(ts => ts.label === key)) {
                    timestamps.push({ label: key, value: recordValue[key] });
                    if (!primaryTimestampForFiltering) primaryTimestampForFiltering = recordValue[key];
                }
            }
        }
    }

    if (indexedAt && isValidISODateString(indexedAt)) {
        if (!timestamps.some(ts => ts.value === indexedAt)) {
            timestamps.push({ label: 'indexedAt', value: indexedAt });
        }
        if (!primaryTimestampForFiltering) primaryTimestampForFiltering = indexedAt;
    }

    if (!primaryTimestampForFiltering && timestamps.length > 0) {
        primaryTimestampForFiltering = timestamps[0].value;
    }

    return { display: timestamps, filter: primaryTimestampForFiltering };
}


function renderRecordItem(record, collectionNsid, targetUserHandle, targetUserDid, recordsListEl, recordDetailModalEl, recordJsonContentEl, onCheckboxChange) {
    if (!recordsListEl) return;

    const li = document.createElement('li');
    li.classList.add('record-item');
    li.dataset.uri = record.uri;

    const { display: displayTimestamps, filter: filterTimestamp } = getRecordTimestamps(record.value, record.indexedAt || record.createdAt);
    li.dataset.createdAt = filterTimestamp || '';

    const uriParts = record.uri.split('/');
    const rkey = uriParts[uriParts.length - 1];

    let recordLinkHref = '#';
    if (collectionNsid === 'app.bsky.feed.post') {
        recordLinkHref = `https://bsky.app/profile/${targetUserHandle}/post/${rkey}`;
    } else if (collectionNsid === 'app.bsky.actor.profile') {
        recordLinkHref = `https://bsky.app/profile/${targetUserHandle}`;
    } else {
        recordLinkHref = `https://bsky.app/profile/${targetUserDid}/post/${rkey}`;
    }

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('record-item-content');

    let timestampHtml = '<p class="record-timestamp">';
    if (displayTimestamps.length > 0) {
        displayTimestamps.forEach(ts => {
            timestampHtml += `<span><strong>${ts.label}:</strong> ${formatISODateToLocal(ts.value)}</span>`;
        });
    } else {
        timestampHtml += '<span>No timestamp available</span>';
    }
    timestampHtml += '</p>';

    let contentHtml = `
        <p><strong>URI:</strong> <a href="${recordLinkHref}" target="_blank" rel="noopener noreferrer">${record.uri}</a></p>
        <p><strong>rkey:</strong> ${rkey}</p>
        ${timestampHtml}
    `;
    if (record.value.text) contentHtml += `<p><strong>Text:</strong> ${truncateText(String(record.value.text), 150)}</p>`;
    if (record.value.displayName) contentHtml += `<p><strong>Display Name:</strong> ${record.value.displayName}</p>`;
    // No description for records, only profile
    // if (record.value.description) contentHtml += `<p><strong>Description:</strong> ${truncateText(String(record.value.description), 100)}</p>`;
    if (record.value.subject && record.value.subject.uri) {
        const subjectUriParts = record.value.subject.uri.split('/');
        const subjectActor = subjectUriParts[2];
        const subjectRkey = subjectUriParts[4];
        contentHtml += `<p><strong>Subject:</strong> <a href="https://bsky.app/profile/${subjectActor}/post/${subjectRkey}" target="_blank">${record.value.subject.uri}</a></p>`;
    }

    const viewJsonButton = document.createElement('button');
    viewJsonButton.classList.add('view-json-button');
    viewJsonButton.textContent = 'View JSON';
    viewJsonButton.addEventListener('click', () => {
        if (recordJsonContentEl) recordJsonContentEl.textContent = JSON.stringify(record.value, null, 2);
        if (recordDetailModalEl) openModal('record-detail-modal');
    });

    contentDiv.innerHTML = contentHtml;
    contentDiv.appendChild(viewJsonButton);
    li.appendChild(contentDiv);

    if (isLoggedIn() && !NON_DELETABLE_COLLECTIONS.includes(collectionNsid)) {
        const session = getCurrentSession();
        if (session && session.did === targetUserDid) {
            const checkboxLabel = document.createElement('label');
            checkboxLabel.classList.add('delete-checkbox-label');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.classList.add('delete-checkbox');
            checkbox.dataset.uri = record.uri;
            checkbox.dataset.collection = collectionNsid;
            checkbox.dataset.rkey = rkey;
            checkbox.addEventListener('change', onCheckboxChange);

            checkboxLabel.appendChild(checkbox);
            checkboxLabel.append(" Select");
            li.appendChild(checkboxLabel);
        }
    }
    recordsListEl.appendChild(li);
}

function updateRecordUIDeleted(uri) {
    const itemToRemove = document.querySelector(`.record-item[data-uri="${uri}"]`);
    if (itemToRemove) {
        itemToRemove.remove();
    }
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substr(0, maxLength) + '...';
}

function updateSelectedCountUI(count, selectedCountEl, deleteSelectedButtonEl) {
    if (selectedCountEl) selectedCountEl.textContent = count;
    if (deleteSelectedButtonEl) deleteSelectedButtonEl.disabled = count === 0;
}

function updateLoadingProgress(text, percentage = null, showCancel = false, showMainSpinner = false) {
    const loadingTextEl = document.getElementById('loadingText');
    if (loadingTextEl) loadingTextEl.textContent = text;

    const mainSpinner = document.getElementById('mainLoadingSpinner');
    if (mainSpinner) mainSpinner.classList.toggle('hidden', !showMainSpinner);

    const progressBarContainerEl = document.getElementById('progressBarContainer');
    const progressBarEl = document.getElementById('progressBar');
    const cancelOpButtonEl = document.getElementById('cancelOperationButton');

    if (percentage !== null && progressBarContainerEl && progressBarEl) {
        progressBarContainerEl.classList.remove('hidden');
        progressBarEl.style.width = `${percentage}%`;
    } else if (progressBarContainerEl && progressBarEl) {
        progressBarContainerEl.classList.add('hidden');
        progressBarEl.style.width = '0%';
    }
    if (cancelOpButtonEl) {
        cancelOpButtonEl.classList.toggle('hidden', !showCancel);
        if (showCancel) {
            cancelOpButtonEl.disabled = false;
            cancelOpButtonEl.textContent = "Cancel Operation";
        }
    }
}

function toggleRecordsLoadingSpinner(show) {
    const spinner = document.getElementById('recordsLoadingSpinnerIcon'); // Corrected ID
    if (spinner) {
        spinner.classList.toggle('hidden', !show);
    }
}