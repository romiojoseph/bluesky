document.addEventListener('DOMContentLoaded', () => {
    console.log("script_v3.js loaded and DOMContentLoaded event fired. (FRESH REWRITE v3 - No URL Links)");

    const handleInput = document.getElementById('handleInputV3');
    const resolveButton = document.getElementById('resolveButtonV3');
    const displayDid = document.getElementById('displayDidV3');
    const userInfoSection = document.getElementById('userInfoV3');
    const metadataDisplay = document.getElementById('metadataDisplayV3');
    const actionSection = document.getElementById('actionAreaV3');
    const blobsRadio = document.getElementById('blobsRadioV3');
    const repoRadio = document.getElementById('repoRadioV3');
    const blobNumberInputSection = document.getElementById('blobNumberInputAreaV3');
    const blobNumberInput = document.getElementById('blobNumberInputV3');
    const maxBlobsInputSpan = document.getElementById('maxBlobsInputV3');
    const downloadButton = document.getElementById('downloadButtonV3');
    const loadingOverlay = document.getElementById('loadingOverlayV3');
    const loadingMessage = document.getElementById('loadingMessageV3');
    const currentAuditInfoDisplay = document.getElementById('currentAuditV3');
    const previousAuditInfoDisplay = document.getElementById('previousAuditV3');


    let currentDid = null;
    let currentPdsUrl = null;
    let blobsList = [];

    function showLoading(message = "Loading...") {
        loadingMessage.textContent = message;
        loadingMessage.innerText = message;
        loadingOverlay.style.display = 'flex';
    }

    function hideLoading() {
        loadingOverlay.style.display = 'none';
    }

    function prettyPrintJson(data, label) {
        const formattedJson = JSON.stringify(data, null, 2);
        const heading = document.createElement('h3');
        heading.textContent = `--- ${label} ---`;
        metadataDisplay.appendChild(heading);
        const pre = document.createElement('pre');
        pre.textContent = formattedJson;
        metadataDisplay.appendChild(pre);
        metadataDisplay.style.display = 'block';
    }

    async function fetchJson(url, params = null, label = "Response") {
        try {
            const urlWithParams = new URL(url);
            if (params) {
                Object.keys(params).forEach(key => urlWithParams.searchParams.append(key, params[key]));
            }
            const response = await fetch(urlWithParams.toString());
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            prettyPrintJson(data, label);
            return data;
        } catch (error) {
            console.error(`Error fetching ${label}:`, error);
            displayMetadata(`Error fetching ${label}: {error.message}`);
            return null;
        }
    }

    async function getDidFromHandle(handle) {
        metadataDisplay.innerHTML = '';
        showLoading("Resolving DID...");
        if (handle.startsWith("https://bsky.app/profile/")) {
            handle = handle.split("/").pop();
        }

        const url = "https://bsky.social/xrpc/com.atproto.identity.resolveHandle";
        const params = { handle: handle };
        const response = await fetchJson(url, params, "DID Resolution");
        hideLoading();
        return response ? response.did : null;
    }

    async function getLatestPds(did) {
        showLoading("Fetching PDS Endpoint and Audit Log...");
        const url = `https://plc.directory/${did}/log/audit`;
        console.log("Fetching PLC Audit Log URL:", url);

        const response = await fetchJson(url, null, "PLC Audit Log");
        console.log("Raw PLC Audit Log Response:", response);
        hideLoading();

        if (!response) {
            console.log("No PLC Audit Log response received.");
            return null;
        }

        let latestPds = null;
        let latestTime = null;

        currentAuditInfoDisplay.textContent = '';
        previousAuditInfoDisplay.textContent = '';

        previousAuditInfoDisplay.parentNode.style.display = 'none';

        response.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        console.log("Sorted PLC Audit Log Response:", response);

        for (let i = 0; i < response.length; i++) {
            const entry = response[i];
            console.log(`Processing Audit Log Entry ${i}:`, entry);
            if (entry.nullified) {
                console.log(`Entry ${i} is nullified, skipping.`);
                continue;
            }
            const operation = entry.operation || {};
            const createdAt = entry.createdAt;
            const pds = operation.services?.atproto_pds?.endpoint;
            const alsoKnownAs = operation.alsoKnownAs;

            if (pds && (!latestTime || createdAt > latestTime)) {
                latestPds = pds;
                latestTime = createdAt;
            }

            if (i === 0) {
                if (alsoKnownAs && alsoKnownAs.length > 0) {
                    const currentHandlePara = document.createElement('p');
                    const formattedTime = formatDate(createdAt);
                    const handle = alsoKnownAs[0].replace("at://", "");
                    const handleLink = document.createElement('a');
                    handleLink.href = `https://bsky.app/profile/${handle}`;
                    handleLink.target = "_blank";
                    handleLink.className = "handle-text-link"; // Changed class to handle-text-link
                    handleLink.textContent = `@${handle}`; // Display text is still @handle
                    currentHandlePara.innerHTML = `<strong>Current handle is</strong> `;
                    currentHandlePara.appendChild(handleLink);
                    currentHandlePara.innerHTML += ` and it is changed on ${formattedTime}`;
                    currentAuditInfoDisplay.appendChild(currentHandlePara);
                    console.log("Appended to currentAuditInfoDisplay (Handle):", currentHandlePara.textContent);

                }
                if (pds) {
                    const currentPdsPara = document.createElement('p');
                    const formattedTime = formatDate(createdAt);
                    currentPdsPara.innerHTML = `<strong>PDS (Personal Data Server) at</strong> <span class="pds-url">${pds}</span> on ${formattedTime}`;
                    currentAuditInfoDisplay.appendChild(currentPdsPara);
                    console.log("Appended to currentAuditInfoDisplay (PDS):", currentPdsPara.innerHTML);
                }
            } else {
                previousAuditInfoDisplay.parentNode.style.display = 'block';
                if (alsoKnownAs && alsoKnownAs.length > 0) {
                    const handleChangeParagraph = document.createElement('p');
                    const formattedTime = formatDate(createdAt);
                    const handle = alsoKnownAs[0].replace("at://", "");
                    const handleLink = document.createElement('a');
                    handleLink.href = `https://bsky.app/profile/${handle}`;
                    handleLink.target = "_blank";
                    handleLink.className = "handle-text-link"; // Changed class to handle-text-link
                    handleLink.textContent = `@${handle}`; // Display text is still @handle
                    const label = (i === response.length - 1) ? 'Handle created as' : 'Handle changed to';
                    handleChangeParagraph.innerHTML = `<strong>${label}</strong> `;
                    handleChangeParagraph.appendChild(handleLink);
                    handleChangeParagraph.innerHTML += ` on ${formattedTime}`;
                    previousAuditInfoDisplay.appendChild(handleChangeParagraph);
                    console.log("Appended to previousAuditInfoDisplay (Handle History):", handleChangeParagraph.textContent);
                }
                if (pds) {
                    const pdsChangeParagraph = document.createElement('p');
                    const formattedTime = formatDate(createdAt);
                    const label = (i === response.length - 1) ? 'PDS created at' : 'PDS changed to';
                    pdsChangeParagraph.innerHTML = `<strong>${label}</strong> <span class="pds-url">${pds}</span> on ${formattedTime}`;
                    previousAuditInfoDisplay.appendChild(pdsChangeParagraph);
                    console.log("Appended to previousAuditInfoDisplay (PDS History):", pdsChangeParagraph.innerHTML);
                }
            }
        }


        return latestPds;
    }

    async function listBlobs(pdsUrl, did, limit = 500, cursor = null) {
        showLoading("Fetching Blob List...");
        const url = `${pdsUrl}/xrpc/com.atproto.sync.listBlobs`;
        const params = { did: did, limit: limit };
        if (cursor) {
            params.cursor = cursor;
        }
        const response = await fetchJson(url, params, "Blob List");
        hideLoading();

        if (!response) {
            return [];
        }

        let allCids = response.cids || [];
        if (response.cursor) {
            const nextCids = await listBlobs(pdsUrl, did, limit, response.cursor);
            allCids = allCids.concat(nextCids);
        }
        return allCids;
    }


    async function getBlobMetadata(pdsUrl, did, cid) {
        showLoading(`Fetching metadata for blob CID:${cid}...`);
        const url = `${pdsUrl}/xrpc/com.atproto.sync.getBlob`;
        const params = { did: did, cid: cid };

        try {
            const urlWithParams = new URL(url);
            Object.keys(params).forEach(key => urlWithParams.searchParams.append(key, params[key]));
            const response = await fetch(urlWithParams.toString(), { method: 'GET', redirect: 'follow' });
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const headersDiv = document.createElement('div');
            headersDiv.innerHTML = '<h3>--- Blob Metadata (Headers) ---</h3>';
            let headersText = '';
            for (const pair of response.headers.entries()) {
                headersText += `${pair[0]}: ${pair[1]}\n`;
            }
            const pre = document.createElement('pre');
            pre.textContent = headersText;
            headersDiv.appendChild(pre);
            metadataDisplay.appendChild(headersDiv); // Corrected to append headersDiv

        } catch (error) {
            console.error("Error fetching blob metadata:", error);
            displayMetadata(`Error fetching blob metadata: ${error.message}`);
        } finally {
            hideLoading();
        }
    }


    async function getRepo(pdsUrl, did, since = null) {
        showLoading("Fetching Repository Data...");
        const url = `${pdsUrl}/xrpc/com.atproto.sync.getRepo`;
        const params = { did: did };
        if (since) {
            params.since = since;
        }

        try {
            const urlWithParams = new URL(url);
            if (params) {
                Object.keys(params).forEach(key => urlWithParams.searchParams.append(key, params[key]));
            }
            const response = await fetch(urlWithParams.toString());
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const content = await response.blob();

            const headersDiv = document.createElement('div');
            headersDiv.innerHTML = '<h3>--- Repository Response Headers ---</h3>';
            let headersText = '';
            for (const pair of response.headers.entries()) {
                headersText += `${pair[0]}: ${pair[1]}\n`;
            }
            const pre = document.createElement('pre');
            pre.textContent = headersText;
            headersDiv.appendChild(pre);
            metadataDisplay.appendChild(headersDiv); // Corrected to append headersDiv

            hideLoading();
            return content;
        } catch (error) {
            console.error("Error fetching repository:", error);
            displayMetadata(`Error fetching repository: ${error.message}`);
            hideLoading();
            return null;
        }
    }

    function displayMetadata(text) {
        const p = document.createElement('p');
        p.textContent = text;
        metadataDisplay.appendChild(p);
        metadataDisplay.style.display = 'block';
    }

    // Clear previous data when resolving new ID
    function clearPreviousData() {
        metadataDisplay.innerHTML = '';
        userInfoSection.style.display = 'none';
        actionSection.style.display = 'none';
        currentDid = null;
        currentPdsUrl = null;
        blobsList = [];
        downloadButton.disabled = true;
        resolveButton.disabled = false; // Enable the resolve button

        // Remove the stats sections if they exist
        const typeCountsSection = document.getElementById('typeCountsSectionV4');
        const featuresStatsContainer = document.getElementById('featuresStatsContainerV4');
        const embedStatsContainer = document.getElementById('embedStatsContainerV4');

        if (typeCountsSection) typeCountsSection.remove();
        if (featuresStatsContainer) featuresStatsContainer.remove();
        if (embedStatsContainer) embedStatsContainer.remove();

        // Reset the download JSON button
        const downloadJsonButton = document.getElementById('downloadJsonButtonV4');
        if (downloadJsonButton) downloadJsonButton.style.display = 'none';
    }

    resolveButton.addEventListener('click', async () => {
        clearPreviousData();
        const handleOrUrl = handleInput.value.trim();
        if (!handleOrUrl) {
            alert("Please enter a Bluesky handle or profile link.");
            return;
        }

        // Enable both buttons initially
        resolveButton.disabled = true;
        downloadButton.disabled = false; // Changed this to false

        try {
            currentDid = await getDidFromHandle(handleOrUrl);
            if (currentDid) {
                displayDid.textContent = currentDid;
                userInfoSection.style.display = 'block';

                currentPdsUrl = await getLatestPds(currentDid);
                if (currentPdsUrl) {
                    actionSection.style.display = 'block';
                    downloadButton.disabled = false;
                } else {
                    displayMetadata("Could not determine PDS endpoint.");
                    actionSection.style.display = 'none';
                    downloadButton.disabled = true;
                }
            } else {
                displayMetadata("Could not resolve DID. Please check the handle or profile link.");
                userInfoSection.style.display = 'none';
                actionSection.style.display = 'none';
                downloadButton.disabled = true;
            }
        } catch (error) {
            console.error("Error resolving DID:", error);
            displayMetadata(`Error resolving DID: ${error.message}`);
        } finally {
            resolveButton.disabled = false;
        }
    });

    blobsRadio.addEventListener('change', async () => {
        blobNumberInputSection.style.display = 'block';
        downloadButton.disabled = true;
        updateDownloadButtonText();

        if (currentPdsUrl && currentDid) {
            // Use a default limit of 500, maxing out at 1000
            const maxLimit = 1000;
            blobsList = await listBlobs(currentPdsUrl, currentDid, maxLimit);
            console.log("Blobs List:", blobsList);

            maxBlobsInputSpan.textContent = blobsList.length;
            blobNumberInput.max = blobsList.length;
            // Ensure initial value doesn't exceed the new max
            blobNumberInput.value = Math.min(blobsList.length, maxLimit);

            if (blobsList.length === 0) {
                displayMetadata("No blobs found for this DID.");
            } else {
                downloadButton.disabled = false;
            }
        } else {
            blobsList = [];
        }
    });

    repoRadio.addEventListener('change', () => {
        blobNumberInputSection.style.display = 'none';
        downloadButton.disabled = false;
        updateDownloadButtonText();
    });

    // Update download button text based on selection
    function updateDownloadButtonText() {
        downloadButton.textContent = blobsRadio.checked ? 'Download Blobs' : 'Download CAR';
    }

    // Set default radio selection to repo
    repoRadio.checked = true;
    blobsRadio.checked = false;
    updateDownloadButtonText();
    blobNumberInputSection.style.display = 'none';


    downloadButton.addEventListener('click', async () => {
        downloadButton.disabled = true;
        updateDownloadButtonText();
        if (blobsRadio.checked) {
            const numberOfBlobsToDownload = parseInt(blobNumberInput.value, 10);
            if (isNaN(numberOfBlobsToDownload) || numberOfBlobsToDownload <= 0) {
                alert("Please enter a valid number of blobs to download.");
                downloadButton.disabled = false;
                return;
            }

            // Limit the number of blobs to download to the user's input, maxing out at 1000
            const cidsToDownload = blobsList.slice(0, Math.min(numberOfBlobsToDownload, 1000));

            console.log("Downloading multiple blobs CIDs:", cidsToDownload);
            if (cidsToDownload.length > 0) {
                await downloadBlobsAsZip(cidsToDownload);
            } else {
                displayMetadata("No blobs selected for download.");
                downloadButton.disabled = false;
            }
        } else if (repoRadio.checked) {
            const repoData = await getRepo(currentPdsUrl, currentDid);
            if (repoData && repoData.carBlob) {
                downloadCAR(repoData.carBlob, currentDid);

                // Show and setup JSON download button
                downloadJsonButtonV4.style.display = 'inline-block';
                downloadJsonButtonV4.onclick = () => {
                    if (repoData.jsonData) {
                        const jsonBlob = new Blob([JSON.stringify(repoData.jsonData, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(jsonBlob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${currentDid.replace(/:/g, '_')}_processed.json`;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                        URL.revokeObjectURL(url);
                    } else {
                        alert("JSON data not available.");
                    }
                };
            } else {
                downloadButton.disabled = false;
                downloadJsonButtonV4.style.display = 'none'; // Hide if no data
            }
        }
    });

    async function downloadBlobsAsZip(cids) {
        if (!currentPdsUrl || !currentDid) {
            alert("PDS URL or DID is not set.");
            return;
        }

        showLoading(`Fetching and zipping ${cids.length} blobs...`);
        const zip = new JSZip();
        let progress = 0;
        let totalBlobs = cids.length;

        for (const cid of cids) {
            try {
                const blobUrl = `${currentPdsUrl}/xrpc/com.atproto.sync.getBlob?did=${currentDid}&cid=${cid}`;

                const headersResponse = await fetch(blobUrl, { method: 'HEAD' });
                if (!headersResponse.ok) {
                    throw new Error(`Failed to fetch headers for blob ${cid}: ${headersResponse.status}`);
                }
                const contentType = headersResponse.headers.get('Content-Type');
                let fileExtension = 'bin';

                if (contentType) {
                    if (contentType.startsWith('image/jpeg')) {
                        fileExtension = 'jpeg';
                    } else if (contentType.startsWith('image/png')) {
                        fileExtension = 'png';
                    } else if (contentType.startsWith('image/gif')) {
                        fileExtension = 'gif';
                    } else if (contentType.startsWith('video/mp4')) {
                        fileExtension = 'mp4';
                    } else if (contentType.startsWith('audio/mpeg')) {
                        fileExtension = 'mp3';
                    }
                }

                const response = await fetch(blobUrl);
                if (!response.ok) {
                    throw new Error(`Failed to fetch blob data for ${cid}: ${response.status}`);
                }
                const blobData = await response.blob();
                zip.file(`${cid}.${fileExtension}`, blobData);
                progress++;
                loadingMessage.textContent = `Zipping blobs: ${progress}/${totalBlobs} (${Math.round((progress / totalBlobs) * 100)}%)`;

            } catch (error) {
                console.error("Error fetching and zipping blob:", error);
                displayMetadata(`Error zipping blob ${cid}: ${error.message}`);
                hideLoading();
                downloadButton.disabled = false;
                return;
            }
        }

        zip.generateAsync({ type: "blob" }).then(function (content) {
            hideLoading();
            const zipFilename = `${currentDid.replace(/:/g, '_')}_blobs.zip`;
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = zipFilename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            downloadButton.disabled = false;
        });
    }


    function downloadCAR(repoBlob, did) {
        const carFilename = `${did.replace(/:/g, '_')}.car`;
        const link = document.createElement('a');
        link.href = URL.createObjectURL(repoBlob);
        link.download = carFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        downloadButton.disabled = false;
    }

    function formatDate(isoDateString) {
        const date = new Date(isoDateString);
        const options = { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true };
        return date.toLocaleDateString('en-US', options);
    }

    // --- JSON Conversion Functions (from old-project/scripts/utils.js) ---
    function processCborDataV4(arrayBuffer) {
        try {
            return CBOR.decode(arrayBuffer);
        } catch (error) {
            return null;
        }
    }

    function cidToStringV4(uint8Array) {
        try {
            if (uint8Array.length > 4 && uint8Array[0] === 0 && uint8Array[1] === 1) {
                const cidBytes = uint8Array.slice(4);
                return multiformats.CID.decode(cidBytes).toString();
            }
            return multiformats.CID.decode(uint8Array).toString();
        } catch (error) {
            return Array.from(uint8Array)
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }
    }

    function processObjectV4(obj, parentCid = null) {
        if (!obj) return obj;

        if (Array.isArray(obj)) {
            return obj.map(item => processObjectV4(item, parentCid));
        }

        if (typeof obj === 'object') {
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                if (key === 'ref' && value instanceof Uint8Array) {
                    result[key] = { "$link": cidToStringV4(value) };
                } else if (value instanceof Uint8Array) {
                    result[key] = btoa(String.fromCharCode.apply(null, value));
                } else if (value && typeof value === 'object') {
                    result[key] = processObjectV4(value, parentCid);
                } else {
                    result[key] = value;
                }
            }
            if (parentCid) {
                result['$parentCid'] = parentCid;
            }
            return result;
        }

        return obj;
    }

    async function convertCarToJsonV4(carBlob) {
        showLoading("Converting CAR to JSON...");
        const reader = await IpldCar.CarReader.fromBytes(new Uint8Array(await carBlob.arrayBuffer()));

        const records = [];
        let blockCount = 0;
        let processedCount = 0;

        for await (const block of reader.blocks()) {
            blockCount++;
            try {
                const arrayBuffer = block.bytes.buffer.slice(
                    block.bytes.byteOffset,
                    block.bytes.byteOffset + block.bytes.byteLength
                );

                const decodedData = processCborDataV4(arrayBuffer);

                if (decodedData) {
                    const processedData = processObjectV4(decodedData, block.cid.toString());

                    if (processedData && processedData.$type) {
                        const record = {
                            cid: block.cid.toString(),
                            type: processedData.$type,
                            data: processedData
                        };

                        if (processedData.text) record.text = processedData.text;
                        if (processedData.subject) record.subject = processedData.subject;
                        if (processedData.createdAt) record.createdAt = processedData.createdAt;
                        if (processedData.embed) record.embed = processedData.embed;
                        if (processedData.facets) record.facets = processedData.facets;

                        records.push(record);
                        processedCount++;
                    }
                }
            } catch (error) {
                console.warn(`Failed to process block ${blockCount}:`, error);
            }

            if (blockCount % 100 === 0) {
                loadingMessage.textContent = `Processing... ${processedCount} records processed`;
            }
        }
        hideLoading();
        console.log(`Conversion complete! Processed ${processedCount} records`);
        return records;
    }

    // --- Display Type Counts (adapted from old-project/scripts/stats.js) ---
    function displayTypeCountsV4(records) {
        const typeCountsSectionV4 = document.createElement('div');
        typeCountsSectionV4.id = 'typeCountsSectionV4';
        typeCountsSectionV4.style.display = 'block';
        typeCountsSectionV4.innerHTML = '<h2>Data Types</h2><p>Bluesky’s Lexicons like app.bsky.feed.like, app.bsky.graph.follow, app.bsky.actor.profile, app.bsky.feed.post, etc., represent various social interactions and content types on the platform.</p>';

        const typeCountsContainerV4 = document.createElement('div');
        typeCountsContainerV4.id = 'typeCountsV4';
        typeCountsSectionV4.appendChild(typeCountsContainerV4);


        const typeCounts = {};
        records.forEach(record => {
            if (record.type) {
                if (!typeCounts[record.type]) {
                    typeCounts[record.type] = 0;
                }
                typeCounts[record.type]++;
            }
        });

        for (const [type, count] of Object.entries(typeCounts)) {
            const typeBox = document.createElement('div');
            typeBox.classList.add('info-box-v4'); // Use a new class

            const typeLabel = document.createElement('label');
            typeLabel.textContent = type;

            const typeCount = document.createElement('div');
            typeCount.textContent = count.toLocaleString();

            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = `Download ${type.split('.').pop()} JSON`;
            downloadBtn.onclick = () => {
                const typeRecords = records.filter(record => record.type === type);
                const typeJsonString = JSON.stringify(typeRecords, null, 2);
                const blob = new Blob([typeJsonString], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${type.replace(/\./g, '_')}_v4.json`; // Use v4 suffix
                a.click();
                URL.revokeObjectURL(url);
            };

            typeBox.appendChild(typeLabel);
            typeBox.appendChild(typeCount);
            typeBox.appendChild(downloadBtn);
            typeCountsContainerV4.appendChild(typeBox);
        }
        // Append after metadataDisplay, creating it if it doesn't exist
        if (metadataDisplay) {
            const statsContainer = document.getElementById('statsContainerV3');
            statsContainer.appendChild(typeCountsSectionV4);
        }
    }

    // --- Display Feature Stats (adapted from old-project/scripts/stats.js) ---
    function displayFeaturesStatsV4(records) {
        const featuresStatsContainerV4 = document.createElement('div');
        featuresStatsContainerV4.id = 'featuresStatsContainerV4';
        featuresStatsContainerV4.innerHTML = '<h2>Features Stats</h2><p>This section shows the number of times hashtags, mentions, and links are used in your posts. You can also export this data as a CSV file for further analysis.</p>';
        featuresStatsContainerV4.style.display = 'block';

        const featureCounts = {
            hashtags: {},
            mentions: {},
            links: {}
        };

        function countFeatures(facets) {
            facets.forEach(facet => {
                facet.features.forEach(feature => {
                    if (feature.$type === 'app.bsky.richtext.facet#tag') {
                        const tag = feature.tag;
                        if (!featureCounts.hashtags[tag]) {
                            featureCounts.hashtags[tag] = 0;
                        }
                        featureCounts.hashtags[tag]++;
                    } else if (feature.$type === 'app.bsky.richtext.facet#mention') {
                        const mention = feature.did;
                        if (!featureCounts.mentions[mention]) {
                            featureCounts.mentions[mention] = 0;
                        }
                        featureCounts.mentions[mention]++;
                    } else if (feature.$type === 'app.bsky.richtext.facet#link') {
                        const link = feature.uri;
                        if (!featureCounts.links[link]) {
                            featureCounts.links[link] = 0;
                        }
                        featureCounts.links[link]++;
                    }
                });
            });
        }

        records.forEach(record => {
            if (record.data && record.data.facets) {
                countFeatures(record.data.facets);
            }
        });

        const createStatBoxV4 = (label, data, downloadFilename) => {
            const statBox = document.createElement('div');
            statBox.classList.add('stat-box-v4'); // Use a new class

            const statLabel = document.createElement('label');
            statLabel.textContent = label;
            statBox.appendChild(statLabel);

            const statCount = document.createElement('div');
            statCount.textContent = Object.keys(data).length.toLocaleString();
            statBox.appendChild(statCount);

            const downloadBtn = document.createElement('button');
            downloadBtn.textContent = 'Download CSV';
            downloadBtn.onclick = () => {
                const csvContent = 'Item,Count\n' + Object.entries(data).map(([item, count]) => `${item},${count}`).join('\n');
                const blob = new Blob([csvContent], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = downloadFilename;
                a.click();
                URL.revokeObjectURL(url);
            };
            statBox.appendChild(downloadBtn);
            return statBox;
        };

        const featuresStatsBoxV4 = document.createElement('div');
        featuresStatsBoxV4.classList.add('stat-box-v4'); // Use the same class as feature stats

        const hashtagsBox = createStatBoxV4('Hashtags', featureCounts.hashtags, 'hashtags.csv');
        hashtagsBox.classList.remove('stat-box-v4'); // Remove stat-box-v4 class
        hashtagsBox.classList.add('info-box-v4'); // Add info-box-v4 class
        featuresStatsBoxV4.appendChild(hashtagsBox);

        const mentionsBox = createStatBoxV4('Mentions', featureCounts.mentions, 'mentions.csv');
        mentionsBox.classList.remove('stat-box-v4'); // Remove stat-box-v4 class
        mentionsBox.classList.add('info-box-v4'); // Add info-box-v4 class
        featuresStatsBoxV4.appendChild(mentionsBox);

        const linksBox = createStatBoxV4('Links', featureCounts.links, 'links.csv');
        linksBox.classList.remove('stat-box-v4'); // Remove stat-box-v4 class
        linksBox.classList.add('info-box-v4'); // Add info-box-v4 class
        featuresStatsBoxV4.appendChild(linksBox);

        featuresStatsContainerV4.appendChild(featuresStatsBoxV4);


        // Append after typeCountsSectionV4, creating it if it doesn't exist

        const typeCountsSectionV4 = document.getElementById('typeCountsSectionV4');
        if (typeCountsSectionV4) {
            typeCountsSectionV4.parentNode.insertBefore(featuresStatsContainerV4, typeCountsSectionV4.nextSibling);
        }
    }


    // --- Modified getRepo function ---
    async function getRepo(pdsUrl, did, since = null) {
        showLoading("Fetching Repository Data...");
        const url = `${pdsUrl}/xrpc/com.atproto.sync.getRepo`;
        const params = { did: did };
        if (since) {
            params.since = since;
        }

        try {
            const urlWithParams = new URL(url);
            if (params) {
                Object.keys(params).forEach(key => urlWithParams.searchParams.append(key, params[key]));
            }
            const response = await fetch(urlWithParams.toString());
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const carBlob = await response.blob();

            const headersDiv = document.createElement('div');
            headersDiv.innerHTML = '<h3>--- Repository Response Headers ---</h3>';
            let headersText = '';
            for (const pair of response.headers.entries()) {
                headersText += `${pair[0]}: ${pair[1]}\n`;
            }
            const pre = document.createElement('pre');
            pre.textContent = headersText;
            headersDiv.appendChild(pre);
            metadataDisplay.appendChild(headersDiv);

            // --- Process CAR to JSON ---
            const jsonData = await convertCarToJsonV4(carBlob);
            console.log("CAR converted to JSON:", jsonData);

            // --- Display Type Counts and Feature Stats ---
            removeExistingStats();
            displayTypeCountsV4(jsonData);
            displayFeaturesStatsV4(jsonData);
            displayEmbedStatsV4(jsonData);

            hideLoading();
            return { carBlob: carBlob, jsonData: jsonData }; // Return both CAR and JSON
        } catch (error) {
            console.error("Error fetching repository:", error);
            displayMetadata(`Error fetching repository: ${error.message}`);
            hideLoading();
            return null;
        }
    }

    // --- Display Embed Stats (adapted from old-project/scripts/stats.js) ---
    function displayEmbedStatsV4(records) {
        const embedStatsContainerV4 = document.createElement('div');
        embedStatsContainerV4.id = 'embedStatsContainerV4';
        embedStatsContainerV4.innerHTML = '<h2>Embed Stats</h2><p>Bluesky supports various custom content types—images, external links, quote posts (record), posts with media like images, videos, and any future additions. This section shows the count of these content types associated with the account you selected.</p>';
        embedStatsContainerV4.style.display = 'block';

        const embedCounts = {};

        function countEmbedTypes(embed) {
            if (embed && embed.$type) {
                const embedType = embed.$type;
                if (!embedCounts[embedType]) {
                    embedCounts[embedType] = 0;
                }
                embedCounts[embedType]++;

                if (embed.media && embed.media.$type) {
                    countEmbedTypes(embed.media);
                }
            }
        }

        records.forEach(record => {
            if (record.embed) {
                countEmbedTypes(record.embed);
            }
        });

        const embedStatsBoxV4 = document.createElement('div');
        embedStatsBoxV4.classList.add('stat-box-v4'); // Use the same class as feature stats

        for (const [embedType, count] of Object.entries(embedCounts)) {
            const embedTypeBox = document.createElement('div');
            embedTypeBox.classList.add('info-box-v4'); // Use the same class

            const embedTypeLabel = document.createElement('label');
            embedTypeLabel.textContent = embedType.split('.').pop();

            const embedTypeCount = document.createElement('div');
            embedTypeCount.textContent = count.toLocaleString();

            embedTypeBox.appendChild(embedTypeLabel);
            embedTypeBox.appendChild(embedTypeCount);
            embedStatsBoxV4.appendChild(embedTypeBox);
        }

        embedStatsContainerV4.appendChild(embedStatsBoxV4);
        const featuresStatsContainerV4 = document.getElementById('featuresStatsContainerV4');
        if (featuresStatsContainerV4) {
            featuresStatsContainerV4.parentNode.insertBefore(embedStatsContainerV4, featuresStatsContainerV4.nextSibling)
        }
    }

    function removeExistingStats() {
        const existingElements = [
            'typeCountsSectionV4',
            'featuresStatsContainerV4',
            'embedStatsContainerV4'
        ];

        existingElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) element.remove();
        });
    }
});