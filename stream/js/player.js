let hlsPlayer = null;
let playerControlsTimeout;
let statusIconTimeout;

function initializePlayer(config) {
    const {
        videoElementId, controlsContainerId, qualitySelectorId,
        playPauseButtonId, bottomPlayIconId, bottomPauseIconId,
        muteButtonId, volumeIconId, muteIconId,
        currentTimeDisplayId, totalDurationDisplayId,
        progressBarWrapperClass, progressBarFilledId,
        fullscreenButtonId, fullscreenOpenIconId, fullscreenCloseIconId,
        centerControlsOverlayId, centerRewindButtonId, centerPlayPauseButtonId,
        centerPlayIconId, centerPauseIconId, centerForwardButtonId,
        videoStatusIconOverlayId
    } = config;

    const videoPlayer = document.getElementById(videoElementId);
    const videoPlayerMessageOverlay = document.getElementById('videoPlayerMessageOverlay');
    const videoPlayerOverlaySpinner = document.getElementById('videoPlayerOverlaySpinner');
    const videoPlayerOverlayMessageSpan = document.getElementById('videoPlayerOverlayMessage');
    const customControls = document.getElementById(controlsContainerId);
    const qualitySelector = document.getElementById(qualitySelectorId);
    const playPauseButton = document.getElementById(playPauseButtonId);
    const bottomPlayIcon = document.getElementById(bottomPlayIconId);
    const bottomPauseIcon = document.getElementById(bottomPauseIconId);
    const muteButton = document.getElementById(muteButtonId);
    const volumeIcon = document.getElementById(volumeIconId);
    const muteIcon = document.getElementById(muteIconId);
    const currentTimeDisplay = document.getElementById(currentTimeDisplayId);
    const totalDurationDisplay = document.getElementById(totalDurationDisplayId);
    const progressBarWrapper = document.querySelector(progressBarWrapperClass);
    const progressBarFilled = document.getElementById(progressBarFilledId);
    const fullscreenButton = document.getElementById(fullscreenButtonId);
    const fullscreenIconOpen = document.getElementById(fullscreenOpenIconId);
    const fullscreenIconClose = document.getElementById(fullscreenCloseIconId);
    const videoPlayerContainer = videoPlayer.parentElement;

    const centerControlsOverlay = document.getElementById(centerControlsOverlayId);
    const centerRewindButton = document.getElementById(centerRewindButtonId);
    const centerPlayPauseButton = document.getElementById(centerPlayPauseButtonId);
    const centerPlayIcon = document.getElementById(centerPlayIconId);
    const centerPauseIcon = document.getElementById(centerPauseIconId);
    const centerForwardButton = document.getElementById(centerForwardButtonId);
    const videoStatusIconOverlay = document.getElementById(videoStatusIconOverlayId);

    videoPlayer.addEventListener('click', handleVideoAreaClick);
    playPauseButton.addEventListener('click', togglePlayPause);
    centerPlayPauseButton.addEventListener('click', togglePlayPause);
    muteButton.addEventListener('click', toggleMute);
    videoPlayer.addEventListener('loadedmetadata', updateDuration);
    videoPlayer.addEventListener('timeupdate', () => {
        updateProgressBar();
        updateCurrentTime();
    });
    videoPlayer.addEventListener('play', handlePlay);
    videoPlayer.addEventListener('pause', handlePause);
    videoPlayer.addEventListener('volumechange', updateMuteButtonVisuals);
    progressBarWrapper.addEventListener('click', seekVideo);
    fullscreenButton.addEventListener('click', toggleFullscreen);

    centerRewindButton.addEventListener('click', () => seekRelative(-10));
    centerForwardButton.addEventListener('click', () => seekRelative(10));

    document.addEventListener('fullscreenchange', updateFullscreenUi);
    document.addEventListener('webkitfullscreenchange', updateFullscreenUi);
    document.addEventListener('msfullscreenchange', updateFullscreenUi);

    videoPlayerContainer.addEventListener('mouseenter', handleInteractionStart);
    videoPlayerContainer.addEventListener('mousemove', handleInteractionStart);
    videoPlayerContainer.addEventListener('mouseleave', handleInteractionEnd);
    videoPlayerContainer.addEventListener('touchstart', handleInteractionStart, { passive: true });
    videoPlayerContainer.addEventListener('touchend', handleInteractionEnd, { passive: true });

    customControls.addEventListener('mouseenter', handleInteractionStart);
    customControls.addEventListener('mousemove', handleInteractionStart);
    customControls.addEventListener('touchstart', handleInteractionStart, { passive: true });
    centerControlsOverlay.addEventListener('mouseenter', handleInteractionStart);
    centerControlsOverlay.addEventListener('mousemove', handleInteractionStart);
    centerControlsOverlay.addEventListener('touchstart', handleInteractionStart, { passive: true });


    qualitySelector.addEventListener('change', () => {
        if (hlsPlayer) {
            showPlayerMessage("Changing quality...", true);
            hlsPlayer.currentLevel = parseInt(qualitySelector.value);
        }
        handleInteractionStart(); // Keep controls visible during interaction
    });

    // Listener for hiding controls when clicking outside the player
    document.addEventListener('click', (event) => {
        const isPlayerInteracting = videoPlayerContainer.classList.contains('user-interacting');
        const isClickInsidePlayer = videoPlayerContainer.contains(event.target);
        const header = document.querySelector('header');
        const isClickInsideHeader = header ? header.contains(event.target) : false;

        if (isPlayerInteracting && !isClickInsidePlayer && !isClickInsideHeader && !videoPlayer.paused) {
            hidePlayerControls();
        }
    });


    function showPlayerMessage(message, showSpinner = true) {
        if (videoPlayerMessageOverlay && videoPlayerOverlayMessageSpan && videoPlayerOverlaySpinner) {
            videoPlayerOverlayMessageSpan.textContent = message;
            videoPlayerOverlaySpinner.style.display = showSpinner ? 'inline-block' : 'none';
            videoPlayerMessageOverlay.style.display = 'flex';
        }
    }

    function hidePlayerMessage() {
        if (videoPlayerMessageOverlay && videoPlayerOverlaySpinner) {
            videoPlayerMessageOverlay.style.display = 'none';
            videoPlayerOverlaySpinner.style.display = 'none';
        }
    }


    function handleVideoAreaClick(event) {
        // Only toggle play/pause if the click is directly on the video or the status icon overlay
        // and not on other controls that might be overlaid (though center controls have their own handlers)
        if (event.target === videoPlayer || event.target === videoStatusIconOverlay) {
            togglePlayPause();
        }
    }

    function togglePlayPause() {
        if (videoPlayer.paused || videoPlayer.ended) {
            videoPlayer.play().catch(e => console.warn("Play action failed:", e));
        } else {
            videoPlayer.pause();
        }
    }

    function toggleMute() {
        videoPlayer.muted = !videoPlayer.muted;
        handleInteractionStart(); // Keep controls visible
    }

    function seekVideo(e) {
        if (!videoPlayer.duration || !isFinite(videoPlayer.duration)) return;
        const rect = progressBarWrapper.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        videoPlayer.currentTime = (offsetX / rect.width) * videoPlayer.duration;
        handleInteractionStart(); // Keep controls visible
    }

    function seekRelative(seconds) {
        if (!videoPlayer.duration || !isFinite(videoPlayer.duration)) return;
        videoPlayer.currentTime = Math.max(0, Math.min(videoPlayer.duration, videoPlayer.currentTime + seconds));
        handleInteractionStart(); // Keep controls visible
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (videoPlayerContainer.requestFullscreen) videoPlayerContainer.requestFullscreen();
            else if (videoPlayerContainer.webkitRequestFullscreen) videoPlayerContainer.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
        handleInteractionStart(); // Keep controls visible
    }

    function updatePlayPauseIcons(isPaused) {
        bottomPlayIcon.style.display = isPaused ? 'inline' : 'none';
        bottomPauseIcon.style.display = !isPaused ? 'inline' : 'none';
        centerPlayIcon.style.display = isPaused ? 'inline' : 'none';
        centerPauseIcon.style.display = !isPaused ? 'inline' : 'none';
        playPauseButton.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
        centerPlayPauseButton.setAttribute('aria-label', isPaused ? 'Play' : 'Pause');
    }

    function showStatusIcon(type) {
        clearTimeout(statusIconTimeout);
        videoStatusIconOverlay.innerHTML = `<i class="ph-fill ph-${type}"></i>`;
        videoStatusIconOverlay.classList.add('visible');
        statusIconTimeout = setTimeout(() => {
            videoStatusIconOverlay.classList.remove('visible');
        }, 700); // Icon visible for 0.7s
    }


    function updateMuteButtonVisuals() {
        if (videoPlayer.muted || videoPlayer.volume === 0) {
            muteIcon.style.display = 'inline'; volumeIcon.style.display = 'none';
            muteButton.setAttribute('aria-label', 'Unmute');
        } else {
            muteIcon.style.display = 'none'; volumeIcon.style.display = 'inline';
            muteButton.setAttribute('aria-label', 'Mute');
        }
    }

    function updateDuration() {
        if (isFinite(videoPlayer.duration)) {
            totalDurationDisplay.textContent = formatTime(videoPlayer.duration);
        } else {
            totalDurationDisplay.textContent = 'Live';
        }
        if (!videoPlayer.paused) hidePlayerMessage(); // Hide messages like "Tap to play" if we get metadata while playing
    }
    function updateCurrentTime() {
        currentTimeDisplay.textContent = formatTime(videoPlayer.currentTime);
    }

    function updateProgressBar() {
        if (videoPlayer.duration && isFinite(videoPlayer.duration)) {
            const percentage = (videoPlayer.currentTime / videoPlayer.duration) * 100;
            progressBarFilled.style.width = `${percentage}%`;
        } else {
            progressBarFilled.style.width = `100%`;
        }
    }

    function setupQualitySelectorUI(levels) {
        qualitySelector.innerHTML = '';
        const autoOption = document.createElement('option');
        autoOption.value = "-1";
        autoOption.textContent = "Auto";
        qualitySelector.appendChild(autoOption);

        levels.forEach((level, index) => {
            const option = document.createElement('option');
            option.value = index.toString();
            let label = level.height ? `${level.height}p` : (level.name || `Quality ${index + 1}`);
            if (level.bitrate) label += ` (${(level.bitrate / 1000000).toFixed(1)} Mbps)`;
            option.textContent = label;
            qualitySelector.appendChild(option);
        });
    }

    function updateFullscreenUi() {
        const isFs = !!(document.fullscreenElement || document.webkitFullscreenElement);
        videoPlayerContainer.classList.toggle('fullscreen', isFs);
        fullscreenIconOpen.style.display = isFs ? 'none' : 'inline';
        fullscreenIconClose.style.display = isFs ? 'inline' : 'none';
        fullscreenButton.setAttribute('aria-label', isFs ? 'Exit Fullscreen' : 'Enter Fullscreen');
    }

    function handlePlay() {
        hidePlayerMessage();
        showStatusIcon('play');
        updatePlayPauseIcons(false);
        centerControlsOverlay.classList.remove('visible-when-paused');
        customControls.classList.remove('visible-when-paused');
        startHideControlsTimer();
    }

    function handlePause() {
        showStatusIcon('pause');
        updatePlayPauseIcons(true);
        clearTimeout(playerControlsTimeout);
        videoPlayerContainer.classList.add('user-interacting');
        customControls.classList.add('visible-when-paused');
        centerControlsOverlay.classList.add('visible-when-paused');
    }

    function handleInteractionStart() {
        clearTimeout(playerControlsTimeout);
        videoPlayerContainer.classList.add('user-interacting');
        customControls.classList.add('visible-when-paused');
        centerControlsOverlay.classList.add('visible-when-paused');
        if (!videoPlayer.paused) {
            startHideControlsTimer();
        }
    }

    function handleInteractionEnd() {
        // Only start hide timer if not paused and mouse/touch leaves player area
        if (!videoPlayer.paused) {
            startHideControlsTimer();
        }
    }

    function hidePlayerControls() {
        if (!videoPlayer.paused) {
            videoPlayerContainer.classList.remove('user-interacting');
            customControls.classList.remove('visible-when-paused');
            centerControlsOverlay.classList.remove('visible-when-paused');
        }
    }

    function startHideControlsTimer() {
        clearTimeout(playerControlsTimeout);
        playerControlsTimeout = setTimeout(hidePlayerControls, 1000); // Hide after 1 second of no interaction
    }

    updateMuteButtonVisuals();
    updateFullscreenUi();
    updatePlayPauseIcons(true);

    return {
        loadVideoSource: (m3u8Url, showMessageCallback) => {
            videoPlayerContainer.style.display = 'block';
            if (Hls.isSupported()) {
                if (hlsPlayer) hlsPlayer.destroy();
                showPlayerMessage("Initializing video...", true);
                hlsPlayer = new Hls({});
                hlsPlayer.loadSource(m3u8Url);
                hlsPlayer.attachMedia(videoPlayer);

                hlsPlayer.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    videoPlayer.play().catch(e => {
                        console.warn("Autoplay prevented:", e);
                        showPlayerMessage("Tap to play", false);
                        handlePause();
                    });
                    qualitySelector.style.display = 'block';
                    setupQualitySelectorUI(data.levels);
                    if (data.levels.length > 0) {
                        hlsPlayer.currentLevel = -1;
                        qualitySelector.value = "-1";
                    }
                });
                hlsPlayer.on(Hls.Events.LEVEL_SWITCHED, (event, data) => {
                    if (!videoPlayer.paused) hidePlayerMessage(); // Hide "Changing quality..." if it was shown
                    if (qualitySelector.options.length > 0 && hlsPlayer.currentLevel !== -1) {
                        for (let i = 0; i < qualitySelector.options.length; i++) {
                            if (parseInt(qualitySelector.options[i].value) === data.level) {
                                qualitySelector.selectedIndex = i;
                                break;
                            }
                        }
                    } else if (hlsPlayer.currentLevel === -1) {
                        qualitySelector.value = "-1";
                    }
                });

                hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
                    let errorMsg = `Error: ${data.details}`;
                    let showErrorOverlay = true;
                    let showSpinnerInOverlay = false;

                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            errorMsg = `Network error: ${data.details}`;
                            if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                                errorMsg = `Error loading video (check URL/CORS).`;
                            }
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            errorMsg = `Media error: ${data.details}`;
                            if (data.details === Hls.ErrorDetails.BUFFER_SEEK_OVER_HOLE && hlsPlayer && !data.fatal) {
                                console.warn("HLS.js: bufferSeekOverHole, attempting recovery.");
                                showPlayerMessage("Player recovering...", true);
                                if (hlsPlayer.recoverMediaError) hlsPlayer.recoverMediaError(); else hlsPlayer.startLoad();
                                showErrorOverlay = false; 
                            } else if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR && hlsPlayer && !data.fatal) {
                                console.warn("HLS.js: bufferStalledError, attempting to resume load.");
                                showPlayerMessage("Resuming stream...", true);
                                hlsPlayer.startLoad();
                                showErrorOverlay = false;
                            }
                            break;
                        default:
                            errorMsg = `Video load error: ${data.details}`;
                            break;
                    }

                    if (showErrorOverlay) {
                        showPlayerMessage(errorMsg, showSpinnerInOverlay);
                    }
                    
                    console.error('HLS error:', data);
                    if (showMessageCallback && data.fatal) { 
                         showMessageCallback(errorMsg, true);
                    }

                    if (hlsPlayer && data.fatal) {
                        hlsPlayer.destroy();
                        hlsPlayer = null;
                    }
                });
            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                showPlayerMessage("Loading video...", true);
                videoPlayer.src = m3u8Url;
                videoPlayer.addEventListener('loadedmetadata', () => {
                    videoPlayer.play().catch(e => {
                        console.warn("Autoplay prevented (native HLS):", e);
                        showPlayerMessage("Tap to play", false);
                        handlePause();
                    })
                });
                qualitySelector.style.display = 'none';
                videoPlayer.addEventListener('error', (e) => {
                    const errorDetail = videoPlayer.error ? videoPlayer.error.message : 'Unknown error';
                    showPlayerMessage(`Error playing video: ${errorDetail}`, false);
                    if (showMessageCallback) showMessageCallback('Error playing video with native HLS.', true);
                });
            } else {
                showPlayerMessage('HLS is not supported in your browser.', false);
                if (showMessageCallback) showMessageCallback('HLS is not supported in your browser.', true);
            }
        },
        resetPlayer: () => {
            if (hlsPlayer) { hlsPlayer.destroy(); hlsPlayer = null; }
            hidePlayerMessage();
            videoPlayer.src = '';
            videoPlayerContainer.style.display = 'none';
            qualitySelector.innerHTML = '';
            progressBarFilled.style.width = '0%';
            currentTimeDisplay.textContent = '0:00';
            totalDurationDisplay.textContent = '0:00';
            updatePlayPauseIcons(true);
            clearTimeout(playerControlsTimeout);
            clearTimeout(statusIconTimeout);
            customControls.classList.remove('visible-when-paused');
            centerControlsOverlay.classList.remove('visible-when-paused');
            videoPlayerContainer.classList.remove('user-interacting');
        }
    };
}