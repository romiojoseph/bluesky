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
    const videoPlayerMessageSpan = videoPlayerMessageOverlay ? videoPlayerMessageOverlay.querySelector('span') : null;
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
            showPlayerMessage("Changing quality...");
            hlsPlayer.currentLevel = parseInt(qualitySelector.value);
        }
        handleInteractionStart();
    });

    function showPlayerMessage(message) {
        if (videoPlayerMessageOverlay && videoPlayerMessageSpan) {
            videoPlayerMessageSpan.textContent = message;
            videoPlayerMessageOverlay.style.display = 'flex';
        }
    }

    function hidePlayerMessage() {
        if (videoPlayerMessageOverlay) {
            videoPlayerMessageOverlay.style.display = 'none';
        }
    }


    function handleVideoAreaClick(event) {
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
        handleInteractionStart();
    }

    function seekVideo(e) {
        if (!videoPlayer.duration || !isFinite(videoPlayer.duration)) return;
        const rect = progressBarWrapper.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        videoPlayer.currentTime = (offsetX / rect.width) * videoPlayer.duration;
        handleInteractionStart();
    }

    function seekRelative(seconds) {
        if (!videoPlayer.duration || !isFinite(videoPlayer.duration)) return;
        videoPlayer.currentTime = Math.max(0, Math.min(videoPlayer.duration, videoPlayer.currentTime + seconds));
        handleInteractionStart();
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement && !document.webkitFullscreenElement) {
            if (videoPlayerContainer.requestFullscreen) videoPlayerContainer.requestFullscreen();
            else if (videoPlayerContainer.webkitRequestFullscreen) videoPlayerContainer.webkitRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
        }
        handleInteractionStart();
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
        }, 700);
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
        hidePlayerMessage();
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
        playerControlsTimeout = setTimeout(hidePlayerControls, 1000);
    }

    updateMuteButtonVisuals();
    updateFullscreenUi();
    updatePlayPauseIcons(true);

    return {
        loadVideoSource: (m3u8Url, showMessageCallback) => {
            videoPlayerContainer.style.display = 'block';
            if (Hls.isSupported()) {
                if (hlsPlayer) hlsPlayer.destroy();
                showPlayerMessage("Initializing video...");
                hlsPlayer = new Hls({});
                hlsPlayer.loadSource(m3u8Url);
                hlsPlayer.attachMedia(videoPlayer);

                hlsPlayer.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    showPlayerMessage("Video loaded, setting quality...");
                    videoPlayer.play().catch(e => {
                        console.warn("Autoplay prevented:", e);
                        hidePlayerMessage();
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
                    hidePlayerMessage();
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
                    hidePlayerMessage();
                    if (data.fatal) {
                        let errorMsg = `Error loading video: ${data.details}`;
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                errorMsg = `Network error (check CORS/URL): ${data.details}`;
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                errorMsg = `Media error: ${data.details}`;
                                if (data.reason === 'bufferStalledError' && hlsPlayer) {
                                    hlsPlayer.recoverMediaError();
                                }
                                break;
                        }
                        if (showMessageCallback) showMessageCallback(errorMsg, true);
                        console.error('Fatal HLS error:', data);
                        if (hlsPlayer && data.fatal) {
                            hlsPlayer.destroy();
                            hlsPlayer = null;
                        }
                    } else {
                        console.warn('Non-fatal HLS error:', data);
                    }
                });
            } else if (videoPlayer.canPlayType('application/vnd.apple.mpegurl')) {
                showPlayerMessage("Loading video...");
                videoPlayer.src = m3u8Url;
                videoPlayer.addEventListener('loadedmetadata', () => {
                    hidePlayerMessage();
                    videoPlayer.play().catch(e => {
                        console.warn("Autoplay prevented (native HLS):", e);
                        handlePause();
                    })
                });
                qualitySelector.style.display = 'none';
                videoPlayer.addEventListener('error', (e) => {
                    hidePlayerMessage();
                    if (showMessageCallback) showMessageCallback('Error playing video with native HLS.', true);
                });
            } else {
                hidePlayerMessage();
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