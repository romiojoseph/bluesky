const API_BASE = 'https://public.api.bsky.app/xrpc';
let currentVideoDetails = null;
let selectedResolution = null;
let hls = null;
let currentQuality = 'auto';

// Utility Functions
function getExtensionFromMimeType(mimeType) {
    const mimeToExt = {
        'video/mp4': '.mp4',
        'video/x-matroska': '.mkv',
        'video/x-msvideo': '.avi',
        'video/quicktime': '.mov',
        'video/webm': '.webm',
        'video/x-flv': '.flv'
    };
    return mimeToExt[mimeType] || '.mp4';
}

function showError(message) {
    document.getElementById('error').textContent = message;
    document.getElementById('error').style.display = 'block';
}

function clearError() {
    document.getElementById('error').textContent = '';
    document.getElementById('error').style.display = 'none';
}

function showLoader() {
    document.getElementById('loader').style.display = 'block';
}

function hideLoader() {
    document.getElementById('loader').style.display = 'none';
}

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        alert('Playlist URL copied to clipboard');
    } catch (err) {
        // Fallback for mobile devices
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
            const successful = document.execCommand('copy');
            const msg = successful ? 'successful' : 'unsuccessful';
            alert('Playlist URL copied to clipboard');
        } catch (err) {
            alert('Failed to copy playlist URL');
        }
        document.body.removeChild(textArea);
    }
}

// Bluesky API Interaction Functions
async function resolveHandleToDid(handle) {
    try {
        // If it's already a DID, return it directly
        if (handle.startsWith('did:')) {
            return handle;
        }
        
        const response = await fetch(`${API_BASE}/com.atproto.identity.resolveHandle?handle=${handle}`);
        if (!response.ok) throw new Error('Failed to resolve handle');
        const data = await response.json();
        return data.did;
    } catch (error) {
        throw new Error(`Error resolving handle: ${error.message}`);
    }
}

function getPostIdFromLink(postLink) {
    // Handle standard bsky.app profile URL with handle
    let match = postLink.match(/bsky\.app\/profile\/([^/]+)\/post\/([^/]+)/);
    if (match) {
        const handleOrDid = match[1];
        // Check if the matched part is a DID
        if (handleOrDid.startsWith('did:plc:')) {
            return { did: handleOrDid, postId: match[2] };
        }
        return { handle: handleOrDid, postId: match[2] };
    }
    
    // Handle bsky.app profile URL with DID
    match = postLink.match(/bsky\.app\/profile\/did:plc:([^/]+)\/post\/([^/]+)/);
    if (match) {
        return { did: `did:plc:${match[1]}`, postId: match[2] };
    }
    
    // Handle at:// protocol URL
    match = postLink.match(/at:\/\/did:plc:([^/]+)\/app\.bsky\.feed\.post\/([^/]+)/);
    if (match) {
        return { did: `did:plc:${match[1]}`, postId: match[2] };
    }
    
    // Handle video.bsky.app URL (playlist URL)
    match = postLink.match(/video\.bsky\.app\/watch\/did%3Aplc%3A([^/]+)\/([^/]+)\/playlist\.m3u8/);
    if (match) {
        // Extract CID from the URL
        const cid = match[2];
        // For playlist URLs, we'll use the CID to construct the video details directly
        const did = `did:plc:${match[1]}`;
        // Return a special object that indicates this is a direct playlist URL
        return { did: did, cid: cid, isPlaylistUrl: true };
    }
    
    throw new Error('Invalid Bluesky post link. Supported formats: bsky.app profile links, at:// protocol links, or video.bsky.app playlist URLs');
}

async function fetchVideoDetails() {
    try {
        clearError();
        showLoader();
        document.getElementById('videoDetails').style.display = 'none';
        document.getElementById('resolutionSelector').style.display = 'none';

        const postLink = document.getElementById('postLink').value;
        const linkInfo = getPostIdFromLink(postLink);
        
        // Handle direct playlist URL case
        if (linkInfo.isPlaylistUrl) {
            // For direct playlist URLs, we don't have post data, so we create minimal details
            const playlistUrl = postLink;
            
            currentVideoDetails = {
                authorHandle: 'Unknown', // We don't have author info from playlist URL
                authorDisplayName: 'Unknown',
                recordCreatedAt: new Date().toISOString(),
                playlist: playlistUrl,
                cid: linkInfo.cid,
                mimeType: 'video/mp4',
                authorDid: linkInfo.did,
                text: 'Video from direct playlist URL'
            };
            
            displayVideoDetails();
            await fetchResolutions(playlistUrl);
            return;
        }
        
        // Regular post URL handling
        let did;
        if (linkInfo.did) {
            // If we already have the DID from the URL
            did = linkInfo.did;
        } else if (linkInfo.handle) {
            // If we have a handle, resolve it to a DID
            did = await resolveHandleToDid(linkInfo.handle);
        } else {
            throw new Error('Could not determine DID from the provided URL');
        }
        
        const response = await fetch(`${API_BASE}/app.bsky.feed.getPostThread?uri=at://${did}/app.bsky.feed.post/${linkInfo.postId}`);
        if (!response.ok) throw new Error('Failed to fetch post data');

        const postData = await response.json();
        const embedData = postData.thread.post.embed;
        const recordData = postData.thread.post.record;
        const author = postData.thread.post.author;

        if (!embedData || embedData['$type'] !== 'app.bsky.embed.video#view') {
            throw new Error('No video found in this post');
        }

        currentVideoDetails = {
            authorHandle: author.handle,
            authorDisplayName: author.displayName,
            recordCreatedAt: recordData.createdAt,
            playlist: embedData.playlist,
            cid: embedData.cid,
            mimeType: recordData?.embed?.video?.mimeType || 'video/mp4',
            authorDid: did,
            text: recordData.text || '' // Add text to currentVideoDetails
        };

        displayVideoDetails();
        await fetchResolutions(currentVideoDetails.playlist);
    } catch (error) {
        showError(error.message);
    } finally {
        hideLoader();
    }
}

// Video and Resolution Handling Functions
function displayVideoDetails() {
    const videoInfo = document.getElementById('videoInfo');
    const createdAt = new Date(currentVideoDetails.recordCreatedAt).toLocaleString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true
    });
    videoInfo.innerHTML = `
        <h4>Post details</h4>
        <div class="metadata-item">
            <div class="metadata-label">Author Handle</div>
            <div class="metadata-value">${currentVideoDetails.authorHandle}</div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">Author Display Name</div>
            <div class="metadata-value">${currentVideoDetails.authorDisplayName}</div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">Author DIID</div>
            <div class="metadata-value">${currentVideoDetails.authorDid}</div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">Created At</div>
            <div class="metadata-value">${createdAt}</div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">Playlist URL</div>
            <div class="metadata-value"><a href="${currentVideoDetails.playlist}" target="_blank" onclick="event.preventDefault(); copyToClipboard('${currentVideoDetails.playlist}')">${currentVideoDetails.playlist}</a></div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">CID</div>
            <div class="metadata-value">${currentVideoDetails.cid}</div>
        </div>
        <div class="metadata-item">
            <div class="metadata-label">MIME Type</div>
            <div class="metadata-value">${currentVideoDetails.mimeType}</div>
        </div>
    `;

    setupVideoPlayer(currentVideoDetails.playlist);

    // Clear previous text if it exists
    const existingTextElement = document.querySelector('.post-text');
    if (existingTextElement) {
        existingTextElement.remove();
    }

    // Grouping videoInfo and resolutionSelector
    const groupedContainer = document.createElement('div');
    groupedContainer.classList.add('video-info-resolution-group'); // Adding a class to the div

    // Add text above the grouped container if it exists
    if (currentVideoDetails.text) {
        const textElement = document.createElement('div');
        textElement.classList.add('post-text');
        textElement.textContent = currentVideoDetails.text;
        document.getElementById('videoDetails').appendChild(textElement);
    }

    groupedContainer.appendChild(videoInfo);
    groupedContainer.appendChild(document.getElementById('resolutionSelector'));
    document.getElementById('videoDetails').appendChild(groupedContainer);
    document.getElementById('videoDetails').style.display = 'block';
}

function setupVideoPlayer(playlistUrl) {
    const video = document.getElementById('my-video');
    if (hls) {
        hls.destroy();
    }

    if (Hls.isSupported()) {
        hls = new Hls();
        hls.loadSource(playlistUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            // Do not start playing automatically
        });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playlistUrl;
        video.addEventListener('loadedmetadata', () => {
            // Do not start playing automatically
        });
    }

    addCustomControls(video);
}

function addCustomControls(video) {
    const playPauseButton = document.getElementById('playPauseButton');
    const progressBar = document.getElementById('progressBar');
    const playProgress = document.getElementById('playProgress');
    const bufferProgress = document.getElementById('bufferProgress');
    const progressTooltip = document.getElementById('progressTooltip');
    const fullscreenButton = document.getElementById('fullscreenButton');
    const volumeButton = document.getElementById('volumeButton');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeTooltip = document.getElementById('volumeTooltip');
    const playbackSpeedButton = document.getElementById('playbackSpeedButton');
    const qualitySelector = document.getElementById('qualitySelector');

    let isDragging = false;
    let isMuted = false;
    let lastVolume = 1; // Default volume
    let currentPlaybackSpeed = 1;
    const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

    playPauseButton.onclick = () => togglePlay();
    video.onclick = () => togglePlay();
    progressBar.onmousedown = (e) => {
        isDragging = true;
        updateProgressBar(e);
    };
    progressBar.onmousemove = (e) => {
        if (isDragging) updateProgressBar(e);
        updateProgressTooltip(e);
    };
    progressBar.onmouseout = () => progressTooltip.style.display = 'none';
    document.onmouseup = () => isDragging = false;
    fullscreenButton.onclick = () => toggleFullscreen();
    volumeButton.onclick = () => toggleMute();
    volumeSlider.oninput = () => updateVolume();
    playbackSpeedButton.onclick = () => changePlaybackSpeed();
    qualitySelector.onchange = () => changeQuality();

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.target.tagName === 'INPUT' && e.target.type === 'text') {
            return; // Ignore keyboard shortcuts when focused on text input fields
        }

        switch (e.key) {
            case ' ':
            case 'k':
                togglePlay();
                break;
            case 'f':
                toggleFullscreen();
                break;
            case 'm':
                toggleMute();
                break;
        }
    });

    // HLS Events for Buffering
    if (hls) {
        hls.on(Hls.Events.FRAG_BUFFERED, function (event, data) {
            updateBufferBar();
        });
    }

    // Time Update
    video.addEventListener('timeupdate', () => {
        const percentage = (video.currentTime / video.duration) * 100;
        playProgress.style.width = percentage + '%';
    });

    function togglePlay() {
        if (video.paused) {
            video.play();
            playPauseButton.innerHTML = '<i class="ph-duotone ph-pause"></i>';
            const tooltip = playPauseButton.querySelector('.control-tooltip');
            if (tooltip) {
                tooltip.textContent = 'Pause (k)';
            }
        } else {
            video.pause();
            playPauseButton.innerHTML = '<i class="ph-duotone ph-play"></i>';
            const tooltip = playPauseButton.querySelector('.control-tooltip');
            if (tooltip) {
                tooltip.textContent = 'Play (k)';
            }
        }
    }

    function updateProgressBar(e) {
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    }

    function updateProgressTooltip(e) {
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const time = pos * video.duration;
        progressTooltip.textContent = formatTime(time);
        progressTooltip.style.left = `${e.clientX - rect.left - (progressTooltip.offsetWidth / 2)}px`;
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            if (video.parentElement.requestFullscreen) {
                video.parentElement.requestFullscreen();
            } else if (video.parentElement.mozRequestFullScreen) {
                video.parentElement.mozRequestFullScreen();
            } else if (video.parentElement.webkitRequestFullscreen) {
                video.parentElement.webkitRequestFullscreen();
            } else if (video.parentElement.msRequestFullscreen) {
                video.parentElement.msRequestFullscreen();
            }
            fullscreenButton.innerHTML = '<i class="ph-duotone ph-corners-in"></i>';
            const tooltip = fullscreenButton.querySelector('.control-tooltip');
            if (tooltip) {
                tooltip.textContent = 'Exit Fullscreen (f)';
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.mozCancelFullScreen) {
                document.mozCancelFullScreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            fullscreenButton.innerHTML = '<i class="ph-duotone ph-corners-out"></i>';
            const tooltip = fullscreenButton.querySelector('.control-tooltip');
            if (tooltip) {
                tooltip.textContent = 'Fullscreen (f)';
            }
        }
    }

    function updateBufferBar() {
        if (hls && video.duration > 0) {
            let bufferedEnd = 0;
            for (let i = 0; i < video.buffered.length; i++) {
                if (video.buffered.end(i) > bufferedEnd) {
                    bufferedEnd = video.buffered.end(i);
                }
            }
            const bufferedPercentage = (bufferedEnd / video.duration) * 100;
            bufferProgress.style.width = bufferedPercentage + '%';
        }
    }

    function toggleMute() {
        if (isMuted) {
            video.volume = lastVolume;
            volumeSlider.value = lastVolume * 100;
            volumeButton.innerHTML = '<i class="ph-duotone ph-speaker-high"></i>';
            const tooltip = volumeButton.querySelector('.control-tooltip');
            if (tooltip) {
                tooltip.textContent = 'Mute (m)';
            }
            isMuted = false;
        } else {
            lastVolume = video.volume;
            video.volume = 0;
            volumeSlider.value = 0;
            volumeButton.innerHTML = '<i class="ph-duotone ph-speaker-none"></i>';
            const tooltip = volumeButton.querySelector('.control-tooltip');
            if (tooltip) {
                tooltip.textContent = 'Unmute (m)';
            }
            isMuted = true;
        }
        updateVolumeTooltip();
    }

    function updateVolume() {
        const volumeValue = volumeSlider.value;
        video.volume = volumeValue / 100;
        if (video.volume === 0) {
            isMuted = true;
            volumeButton.innerHTML = '<i class="ph-duotone ph-speaker-none"></i>';
            const tooltip = volumeButton.querySelector('.control-tooltip');
            if (tooltip) {
                tooltip.textContent = 'Unmute (m)';
            }
        } else {
            isMuted = false;
            lastVolume = video.volume;
            if (video.volume < 0.5) {
                volumeButton.innerHTML = '<i class="ph-duotone ph-speaker-low"></i>';
            } else {
                volumeButton.innerHTML = '<i class="ph-duotone ph-speaker-high"></i>';
            }
            const tooltip = volumeButton.querySelector('.control-tooltip');
            if (tooltip) {
                tooltip.textContent = 'Mute (m)';
            }
        }
        updateVolumeTooltip();
    }

    function updateVolumeTooltip() {
        const volumePercentage = Math.round(video.volume * 100);
        volumeTooltip.textContent = `${volumePercentage}%`;
    }

    function changePlaybackSpeed() {
        currentPlaybackSpeed = playbackSpeeds[(playbackSpeeds.indexOf(currentPlaybackSpeed) + 1) % playbackSpeeds.length];
        video.playbackRate = currentPlaybackSpeed;
        playbackSpeedButton.textContent = `${currentPlaybackSpeed}x`;
    }

    function changeQuality() {
        currentQuality = qualitySelector.value;
        if (currentQuality === 'auto') {
            hls.currentLevel = -1;
        } else {
            hls.currentLevel = parseInt(currentQuality);
        }
    }

    function formatTime(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return `${h > 0 ? `${h}:` : ''}${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
}

async function fetchResolutions(playlistUrl) {
    try {
        const response = await fetch(playlistUrl);
        if (!response.ok) throw new Error('Failed to fetch playlist');
        const playlistText = await response.text();

        // Parse M3U8 playlist manually
        const resolutions = parseM3U8Playlist(playlistText);
        displayResolutions(resolutions, playlistUrl);
    } catch (error) {
        showError(`Error fetching resolutions: ${error.message}`);
    }
}

function parseM3U8Playlist(playlistText) {
    const lines = playlistText.split('\n');
    const resolutions = [];
    let currentResolution = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXT-X-STREAM-INF')) {
            const resolutionMatch = line.match(/RESOLUTION=(\d+x\d+)/);
            currentResolution = {
                resolution: resolutionMatch ? resolutionMatch[1] : 'unknown',
                uri: null
            };
        } else if (line && !line.startsWith('#') && currentResolution) {
            currentResolution.uri = line;
            resolutions.push(currentResolution);
            currentResolution = null;
        }
    }

    return resolutions;
}

function displayResolutions(resolutions, playlistUrl) {
    const container = document.getElementById('resolutionOptions');
    container.innerHTML = '';
    resolutions.forEach((res, index) => {
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'resolution';
        radio.value = index;
        radio.id = `res-${index}`;
        radio.dataset.uri = res.uri;
        radio.dataset.baseUrl = playlistUrl;

        const label = document.createElement('label');
        label.htmlFor = `res-${index}`;
        label.textContent = res.resolution;

        const div = document.createElement('div');
        div.className = 'resolution-option';
        div.appendChild(radio);
        div.appendChild(label);
        container.appendChild(div);
    });

    document.getElementById('resolutionSelector').style.display = 'block';

    document.querySelectorAll('input[name="resolution"]').forEach(radio => {
        radio.addEventListener('change', () => {
            selectedResolution = {
                index: radio.value,
                uri: radio.dataset.uri,
                baseUrl: radio.dataset.baseUrl.substring(0, radio.dataset.baseUrl.lastIndexOf('/'))
            };
        });
    });

    // Update quality selector in the player
    const qualitySelector = document.getElementById('qualitySelector');
    qualitySelector.innerHTML = '<option value="auto">Auto</option>';
    resolutions.forEach((res, index) => {
        const option = document.createElement('option');
        option.value = index;
        option.textContent = res.resolution;
        qualitySelector.appendChild(option);
    });
}

// Download Function
async function downloadVideo() {
    if (!selectedResolution) {
        showError('Please select a resolution');
        return;
    }

    const filename = document.getElementById('filename').value || 'video';
    const streamUrl = `${selectedResolution.baseUrl}/${selectedResolution.uri}`;
    const extension = getExtensionFromMimeType(currentVideoDetails.mimeType);

    try {
        const videoBlob = await fetchAndCombineSegments(streamUrl);
        const downloadUrl = URL.createObjectURL(videoBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = `${filename}${extension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        showError(`Download error: ${error.message}`);
    }
}

async function fetchAndCombineSegments(streamUrl) {
    const response = await fetch(streamUrl);
    if (!response.ok) throw new Error('Failed to fetch stream');

    const playlistText = await response.text();
    const lines = playlistText.split('\n');
    const baseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/'));
    const segmentPromises = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line && !line.startsWith('#')) {
            const segmentUrl = `${baseUrl}/${line}`;
            segmentPromises.push(fetch(segmentUrl).then(res => res.blob()));
        }
    }

    const segmentBlobs = await Promise.all(segmentPromises);
    return new Blob(segmentBlobs, { type: currentVideoDetails.mimeType });
}