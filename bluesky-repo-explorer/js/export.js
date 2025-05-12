function downloadFile(filename, content, contentType = 'application/json;charset=utf-8;') {
    const a = document.createElement('a');
    const blob = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

function generateFilename(handle, collectionName, type) {
    const now = new Date();
    const timestamp = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
    const safeHandle = handle.replace(/[^a-z0-9_.-]/gi, '_');
    const safeCollection = collectionName ? collectionName.replace(/[^a-z0-9_.-]/gi, '_').replace(/\./g, '-') : 'blobs';
    return `${safeHandle}_${safeCollection}_${type}_${timestamp}.json`; // Default to .json, zip handled separately for blobs
}

function exportRecordsAsJson(selectedRecordsData, currentViewUserHandle, currentCollectionNsid) {
    if (selectedRecordsData.length === 0) {
        showCustomStatusModal({ title: "Export Error", message: "No records selected to export." });
        return;
    }
    const filename = generateFilename(currentViewUserHandle, currentCollectionNsid, 'full_records');
    const jsonString = JSON.stringify(selectedRecordsData, null, 2);
    downloadFile(filename, jsonString);
    showCustomStatusModal({ title: "Export Successful", message: `${selectedRecordsData.length} records exported as JSON.` });
}

function exportRecordUris(selectedRecordsData, currentViewUserHandle, currentCollectionNsid) {
    if (selectedRecordsData.length === 0) {
        showCustomStatusModal({ title: "Export Error", message: "No records selected to export." });
        return;
    }
    const uris = selectedRecordsData.map(record => {
        if (record && record.value) {
            const recordType = record.value.$type;
            const subject = record.value.subject;

            if ((recordType === 'app.bsky.feed.like' || recordType === 'app.bsky.feed.repost') &&
                subject && typeof subject.uri === 'string') {
                return subject.uri;
            }
            if ((recordType === 'app.bsky.graph.block' ||
                recordType === 'app.bsky.graph.follow' ||
                recordType === 'app.bsky.graph.listitem') &&
                typeof subject === 'string' && subject.startsWith('did:')) {
                return subject;
            }
        }
        return record.uri;
    });
    const filename = generateFilename(currentViewUserHandle, currentCollectionNsid, 'uris');
    const jsonString = JSON.stringify(uris, null, 2);
    downloadFile(filename, jsonString);
    showCustomStatusModal({ title: "Export Successful", message: `${uris.length} URIs exported.` });
}

let selectedBlobCIDs = new Set();

async function listUserBlobs(did, accessJwt, pdsHostOverride = null) {
    let allBlobs = [];
    let cursor = null;
    const blobListEl = document.getElementById('blobList');
    const blobCountEl = document.getElementById('blobCount');
    const downloadAllBlobsButton = document.getElementById('downloadAllBlobsButton');
    const blobListControlsEl = document.getElementById('blob-list-controls');

    if (blobListEl) blobListEl.innerHTML = '<li>Loading blobs... <i class="ph-duotone ph-spinner spinner-inline"></i></li>';
    if (blobCountEl) blobCountEl.textContent = '0';
    if (downloadAllBlobsButton) {
        downloadAllBlobsButton.disabled = true;
        downloadAllBlobsButton.textContent = `Select Blobs to Download`;
    }
    if (blobListControlsEl) blobListControlsEl.classList.add('hidden');
    selectedBlobCIDs.clear();

    let effectivePdsHost = pdsHostOverride;
    if (!effectivePdsHost && typeof BSKY_PDS_HOST !== 'undefined') {
        effectivePdsHost = BSKY_PDS_HOST;
    } else if (!effectivePdsHost) {
        effectivePdsHost = 'https://bsky.social'; // Hardcoded fallback if global BSKY_PDS_HOST is not defined here
        console.warn("BSKY_PDS_HOST not available to export.js, using default fallback for blob URLs.");
    }

    try {
        do {
            const response = await listRepoBlobs(did, 1000, cursor, accessJwt, pdsHostOverride);

            if (response && response.cids) {
                allBlobs = allBlobs.concat(response.cids);
                if (blobListEl && blobListEl.firstChild && blobListEl.firstChild.textContent.startsWith('Loading blobs...')) {
                    blobListEl.innerHTML = '';
                }
                response.cids.forEach((cid, index) => {
                    if (blobListEl) {
                        const overallIndex = allBlobs.length - response.cids.length + index;
                        const li = document.createElement('li');
                        const checkbox = document.createElement('input');
                        checkbox.type = 'checkbox';
                        checkbox.dataset.cid = cid;
                        checkbox.id = `blob-checkbox-${cid}`;
                        checkbox.onchange = (e) => {
                            if (e.target.checked) selectedBlobCIDs.add(cid);
                            else selectedBlobCIDs.delete(cid);
                            if (downloadAllBlobsButton) {
                                downloadAllBlobsButton.textContent = `Download Selected (${selectedBlobCIDs.size}) as ZIP`;
                                downloadAllBlobsButton.disabled = selectedBlobCIDs.size === 0;
                            }
                        };

                        const label = document.createElement('label');
                        label.setAttribute('for', `blob-checkbox-${cid}`);

                        const blobLink = document.createElement('a');
                        const blobViewUrl = new URL(`${effectivePdsHost}/xrpc/com.atproto.sync.getBlob`);
                        blobViewUrl.searchParams.append('did', did);
                        blobViewUrl.searchParams.append('cid', cid);

                        blobLink.href = blobViewUrl.toString();
                        blobLink.textContent = cid;
                        blobLink.target = "_blank";
                        blobLink.title = `View blob: ${cid}`;

                        label.appendChild(checkbox);
                        label.append(`${overallIndex + 1}. `);
                        label.appendChild(blobLink);
                        li.appendChild(label);

                        blobListEl.appendChild(li);
                    }
                });
                if (blobCountEl) blobCountEl.textContent = allBlobs.length;
            }
            cursor = response.cursor || null;
        } while (cursor);

        if (allBlobs.length === 0 && blobListEl) {
            blobListEl.innerHTML = '<li>No blobs found for this account.</li>';
        } else if (allBlobs.length > 0 && blobListControlsEl) {
            blobListControlsEl.classList.remove('hidden');
        }
        return allBlobs;

    } catch (error) {
        console.error("Error listing blobs:", error);
        if (blobListEl) blobListEl.innerHTML = `<li>Error listing blobs: ${error.message}</li>`;
        showCustomStatusModal({ title: "Error Listing Blobs", message: `Failed to list blobs: ${error.message}` });
        if (blobListControlsEl) blobListControlsEl.classList.add('hidden');
        return [];
    }
}

const MAX_CONCURRENT_BLOB_DOWNLOADS = 10;
const REQUESTS_PER_THROTTLE_BATCH = 50;
const THROTTLE_DELAY_MS = 5000;
let requestCounterForThrottling = 0;

let rateLimitRemaining = Infinity;
let rateLimitResetTime = 0;

async function downloadSingleBlob(did, cid, accessJwt, zip, pdsHostOverride = null) {
    try {
        const rawBlobResponse = await getRepoBlob(did, cid, accessJwt, pdsHostOverride);

        if (!rawBlobResponse || !rawBlobResponse.ok) {
            if (rawBlobResponse && rawBlobResponse.status === 429) {
                const retryAfter = rawBlobResponse.headers.get('Retry-After');
                console.warn(`Rate limited fetching blob ${cid}. Retry-After: ${retryAfter || 'N/A'}`);
                return { cid, status: 'rate-limited', retryAfter: retryAfter ? parseInt(retryAfter) : null };
            }
            throw new Error(`Failed to fetch blob ${cid}: ${rawBlobResponse ? rawBlobResponse.statusText : 'No response'}`);
        }

        const limit = rawBlobResponse.headers.get('RateLimit-Limit');
        const remaining = rawBlobResponse.headers.get('RateLimit-Remaining');
        const reset = rawBlobResponse.headers.get('RateLimit-Reset');

        if (remaining) rateLimitRemaining = parseInt(remaining);
        if (reset) rateLimitResetTime = parseInt(reset);

        const blobData = await rawBlobResponse.blob();
        let extension = '.bin';
        const contentType = rawBlobResponse.headers.get('content-type');
        if (contentType) {
            if (contentType.includes('jpeg')) extension = '.jpg';
            else if (contentType.includes('png')) extension = '.png';
            else if (contentType.includes('gif')) extension = '.gif';
            else if (contentType.includes('webp')) extension = '.webp';
            // Add more common image/video types if needed
            else if (contentType.includes('mp4')) extension = '.mp4';
            else if (contentType.includes('mov')) extension = '.mov';
            else if (contentType.includes('heic')) extension = '.heic';
            else if (contentType.includes('heif')) extension = '.heif';
        }
        zip.file(`${cid}${extension}`, blobData);
        requestCounterForThrottling++;
        return { cid, status: 'success' };
    } catch (error) {
        console.error(`Error downloading blob ${cid}:`, error);
        return { cid, status: 'failed', error: error.message };
    }
}

async function downloadBlobsAsZip(did, cidsToProcess, handle, accessJwt, pdsHostOverride = null) {
    if (cidsToProcess.length === 0) {
        showCustomStatusModal({ title: "No Blobs Selected", message: "Please select blobs to download." });
        const loadingSectionEl = document.getElementById('loading-section');
        if (loadingSectionEl) loadingSectionEl.classList.add('hidden');
        updateLoadingProgress('Loading...', null, false, false);
        return;
    }

    const zip = new JSZip();
    updateLoadingProgress('Starting blob download process...', 0, false, true);

    let downloadedCount = 0;
    let failedCount = 0;
    let rateLimitedPauses = 0;
    const totalBlobs = cidsToProcess.length;
    let remainingCIDs = [...cidsToProcess];

    async function processBatch() {
        const currentBatchCIDs = remainingCIDs.splice(0, MAX_CONCURRENT_BLOB_DOWNLOADS);
        if (currentBatchCIDs.length === 0) return;

        const promises = currentBatchCIDs.map(cid => downloadSingleBlob(did, cid, accessJwt, zip, pdsHostOverride));
        const results = await Promise.all(promises);

        for (const result of results) {
            if (result.status === 'success') {
                downloadedCount++;
            } else if (result.status === 'rate-limited') {
                failedCount++;
                remainingCIDs.unshift(result.cid);
                const pauseDuration = (result.retryAfter || 30) * 1000;
                rateLimitedPauses++;
                updateLoadingProgress(`Rate limited. Pausing for ${pauseDuration / 1000}s... (${downloadedCount + failedCount}/${totalBlobs})`, ((downloadedCount + failedCount) / totalBlobs) * 100, false, true);
                await new Promise(resolve => setTimeout(resolve, pauseDuration));
                rateLimitRemaining = Infinity;
                break;
            } else {
                failedCount++;
            }
        }

        updateLoadingProgress(`Downloading blobs... (${downloadedCount + failedCount}/${totalBlobs}, Success: ${downloadedCount}, Failed: ${failedCount})`, ((downloadedCount + failedCount) / totalBlobs) * 100, false, true);

        if (requestCounterForThrottling >= REQUESTS_PER_THROTTLE_BATCH && remainingCIDs.length > 0) { // Only pause if more CIDs left
            updateLoadingProgress(`Throttling: Pausing for ${THROTTLE_DELAY_MS / 1000}s... (${downloadedCount + failedCount}/${totalBlobs})`, ((downloadedCount + failedCount) / totalBlobs) * 100, false, true);
            await new Promise(resolve => setTimeout(resolve, THROTTLE_DELAY_MS));
            requestCounterForThrottling = 0;
        }
        else if (rateLimitRemaining < MAX_CONCURRENT_BLOB_DOWNLOADS * 2 && remainingCIDs.length > 0) {
            const nowSeconds = Math.floor(Date.now() / 1000);
            if (rateLimitResetTime > nowSeconds) {
                const pauseForReset = (rateLimitResetTime - nowSeconds + 1) * 1000;
                updateLoadingProgress(`Rate limit low. Pausing for ${pauseForReset / 1000}s until reset... (${downloadedCount + failedCount}/${totalBlobs})`, ((downloadedCount + failedCount) / totalBlobs) * 100, false, true);
                await new Promise(resolve => setTimeout(resolve, pauseForReset));
                rateLimitRemaining = Infinity;
            }
        }
    }

    while (remainingCIDs.length > 0) {
        await processBatch();
    }

    updateLoadingProgress('Zipping blobs...', 99, false, true);

    if (downloadedCount > 0) {
        zip.generateAsync({ type: "blob" })
            .then(function (content) {
                const zipFilename = `${handle}_blobs_${downloadedCount}_files_${new Date().toISOString().split('T')[0]}.zip`; // Simpler filename
                downloadFile(zipFilename, content, 'application/zip');
                showCustomStatusModal({
                    title: "Blob Export Complete",
                    message: `Successfully downloaded and zipped ${downloadedCount} blobs. ${failedCount} failed. Paused due to rate limits ${rateLimitedPauses} time(s).`
                });
            })
            .catch(err => {
                showCustomStatusModal({ title: "ZIP Error", message: `Error generating ZIP: ${err.message}` });
            });
    } else {
        showCustomStatusModal({ title: "Blob Export Failed", message: `No blobs were successfully downloaded. ${failedCount} failed. Paused due to rate limits ${rateLimitedPauses} time(s).` });
    }
    updateLoadingProgress('Loading...', null, false, false);
    const loadingSectionEl = document.getElementById('loading-section');
    if (loadingSectionEl) loadingSectionEl.classList.add('hidden');
}