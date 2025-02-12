function logAction(message) {
    const timestamp = new Date().toLocaleString();
    const logEntry = document.createElement('div');
    logEntry.innerHTML = `[${timestamp}] ${message}`;
    document.getElementById('progressLog').appendChild(logEntry);
    logEntry.scrollIntoView({ behavior: 'smooth', block: 'end' });

    // Update loading message (if loading screen is visible)
    if (document.getElementById('loadingScreen').style.display !== 'none') {
        setLoadingMessage(message);
    }
}

async function resolveHandleToDid(handle) {
    logAction(`Resolving handle '${handle}' to DID...`);
    try {
        const response = await fetch(`https://bsky.social/xrpc/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(handle)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (!data.did) throw new Error('DID not found in response');
        logAction(`✅ Successfully resolved to DID: ${data.did}`);
        document.getElementById('didDisplay').textContent = data.did;
        return data.did;
    } catch (error) {
        logAction(`❌ Error resolving handle: ${error.message}`);
        throw error;
    }
}

async function getPdsUrl(did) {
    logAction(`🔍 Looking up PDS URL for DID ${did}...`);
    try {
        const response = await fetch(`https://plc.directory/${did}`, {
            headers: { 'Accept': 'application/json' }
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        const pdsService = data.service.find(s => s.type === 'AtprotoPersonalDataServer');
        if (!pdsService) throw new Error('No PDS endpoint found');
        logAction(`📍 Found PDS URL: ${pdsService.serviceEndpoint}`);
        document.getElementById('pdsDisplay').textContent = pdsService.serviceEndpoint;
        return pdsService.serviceEndpoint;
    } catch (error) {
        logAction(`❌ Failed to retrieve DID document: ${error.message}`);
        throw error;
    }
}

async function getRepo(baseUrl, did) {
    logAction(`Downloading repository data from ${baseUrl}...`);
    try {
        const response = await fetch(`${baseUrl}/xrpc/com.atproto.sync.getRepo?did=${encodeURIComponent(did)}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const repoData = await response.blob();
        logAction('✅ Repository download complete!');
        return repoData;
    } catch (error) {
        logAction(`❌ Download failed: ${error.message}`);
        throw error;
    }
}

function processCborData(arrayBuffer) {
    try {
        return CBOR.decode(arrayBuffer);
    } catch (error) {
        return null;
    }
}

function cidToString(uint8Array) {
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

function processObject(obj, parentCid = null) {
    if (!obj) return obj;

    if (Array.isArray(obj)) {
        return obj.map(item => processObject(item, parentCid));
    }

    if (typeof obj === 'object') {
        const result = {};
        for (const [key, value] of Object.entries(obj)) {
            if (key === 'ref' && value instanceof Uint8Array) {
                result[key] = { "$link": cidToString(value) };
            } else if (value instanceof Uint8Array) {
                result[key] = btoa(String.fromCharCode.apply(null, value));
            } else if (value && typeof value === 'object') {
                result[key] = processObject(value, parentCid);
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

async function convertCarToJson(carBlob) {
    logAction('Converting CAR file to JSON...');
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

            const decodedData = processCborData(arrayBuffer);

            if (decodedData) {
                const processedData = processObject(decodedData, block.cid.toString());

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
            logAction(`Processing... ${processedCount} records processed`);
        }
    }

    logAction(`✅ Conversion complete! Processed ${processedCount} records`);
    return records;
}

let carBlob = null;
let jsonString = null;

function clearAllData() {
    // Clear all containers
    const containers = [
        'postsHeatmapContainer', 'postsHourlyBarChartContainer', 'postsWeeklyBarChartContainer',
        'likesHeatmapContainer', 'likesHourlyBarChartContainer', 'likesWeeklyBarChartContainer',
        'repostsHeatmapContainer', 'repostsHourlyBarChartContainer', 'repostsWeeklyBarChartContainer',
        'followsHeatmapContainer', 'followsHourlyBarChartContainer', 'followsWeeklyBarChartContainer',
        'hashtagsTableContainer', 'mentionsTableContainer', 'linksTableContainer',
        'wordsTableContainer'
    ];

    containers.forEach(containerId => {
        const container = document.getElementById(containerId);
        if (container) {
            container.innerHTML = '';
        }
    });

    // Hide chart container
    document.getElementById('chartContainer').style.display = 'none';
}

async function fetchAndProcessRepository() {
    clearAllData();
    let progressLog = document.getElementById('progressLog');
    if (!progressLog) {
        const progressContainer = document.createElement('div');
        progressContainer.className = 'progress-container';
        progressContainer.id = 'progressContainer';

        progressLog = document.createElement('div');
        progressLog.className = 'progress-log';
        progressLog.id = 'progressLog';

        progressContainer.appendChild(progressLog);
        document.querySelector('.container').appendChild(progressContainer);
    }

    progressLog.innerHTML = '';

    // Reset global variables
    carBlob = null;
    jsonString = null;

    // Clear previous results
    document.getElementById('postsHeatmapContainer').innerHTML = '';
    document.getElementById('postsHourlyBarChartContainer').innerHTML = '';
    document.getElementById('postsWeeklyBarChartContainer').innerHTML = '';
    document.getElementById('likesHeatmapContainer').innerHTML = '';
    document.getElementById('likesHourlyBarChartContainer').innerHTML = '';
    document.getElementById('likesWeeklyBarChartContainer').innerHTML = '';
    document.getElementById('repostsHeatmapContainer').innerHTML = '';
    document.getElementById('repostsHourlyBarChartContainer').innerHTML = '';
    document.getElementById('repostsWeeklyBarChartContainer').innerHTML = '';
    document.getElementById('followsHeatmapContainer').innerHTML = '';
    document.getElementById('followsHourlyBarChartContainer').innerHTML = '';
    document.getElementById('followsWeeklyBarChartContainer').innerHTML = '';
    document.getElementById('hashtagsTableContainer').innerHTML = '';
    document.getElementById('mentionsTableContainer').innerHTML = '';
    document.getElementById('linksTableContainer').innerHTML = '';
    document.getElementById('wordsTableContainer').innerHTML = '';

    const handleInput = document.getElementById('handleInput');
    if (!handleInput) {
        logAction('❌ Handle input element not found');
        return;
    }

    const handle = handleInput.value.trim();
    if (!handle) {
        logAction('❌ Please enter a handle');
        return;
    }

    try {
        const did = await resolveHandleToDid(handle);
        const pdsUrl = await getPdsUrl(did);
        const carData = await getRepo(pdsUrl, did);
        const records = await convertCarToJson(carData);

        // Generate all visualizations (same as processUploadedCarFile)
        generatePostsHeatmap(records);
        generatePostsHourlyBarChart(records);
        generatePostsWeeklyBarChart(records);

        generateLikesHeatmap(records);
        generateLikesHourlyBarChart(records);
        generateLikesWeeklyBarChart(records);

        generateRepostsHeatmap(records);
        generateRepostsHourlyBarChart(records);
        generateRepostsWeeklyBarChart(records);

        generateFollowsHeatmap(records);
        generateFollowsHourlyBarChart(records);
        generateFollowsWeeklyBarChart(records);

        generateHashtagsTable(records);
        generateMentionsTable(records);
        generateLinksTable(records);
        generateWordsTable(records);

        logAction('✅ Repository processed successfully!');
    } catch (error) {
        logAction(`❌ Error: ${error.message}`);
    }

    showChartContainer();
}

async function fetchAuditLog(did) {
    const BASE_URL = "https://plc.directory";
    const url = `${BASE_URL}/${did}/log/audit`;

    try {
        document.getElementById('filteredLog').textContent = 'Fetching...';
        document.getElementById('auditLogContainer').style.display = 'block';

        const response = await fetch(url);
        if (!response.ok) throw new Error(`Error: ${response.status} for DID ${did}`);

        const auditLog = await response.json();

        const filteredLog = auditLog
            .map(entry => ({
                createdAt: new Date(entry.createdAt).toLocaleString('en-US', {
                    month: 'short', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
                }),
                alsoKnownAs: entry.operation?.alsoKnownAs?.map(alias => alias.replace('at://', '@')) || []
            }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .map(entry => `${entry.createdAt}\nChanged to ${entry.alsoKnownAs.join(', ')}`)
            .join('\n\n');

        document.getElementById('filteredLog').textContent = filteredLog || 'No relevant data found.';

    } catch (error) {
        document.getElementById('filteredLog').textContent = `Error: ${error.message}`;
    }
}

function showChartContainer() {
    const chartContainer = document.getElementById('chartContainer');
    chartContainer.style.display = 'block';

    // Show first tab content in each section by default
    const sections = ['posts', 'likes', 'reposts', 'follows'];
    sections.forEach(section => {
        const chartsSection = document.getElementById(`${section}Charts`);
        if (chartsSection) {
            chartsSection.style.display = 'block';

            // Show heatmap by default
            const heatmapContainer = document.getElementById(`${section}HeatmapContainer`);
            if (heatmapContainer) {
                heatmapContainer.style.display = 'block';
            }
        }
    });

    // Show hashtags table by default
    document.getElementById('hashtagsTableContainer').style.display = 'block';

    // Show bubble chart container
    // document.getElementById('wordsTableContainer').style.display = 'block';
}