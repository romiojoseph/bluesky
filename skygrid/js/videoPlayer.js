// js/videoPlayer.js

const VideoPlayer = {
    hlsInstance: null,
    videoElement: null,
    containerElement: null,
    controlsOverlay: null,
    playPauseIcon: null,
    muteButton: null,
    muteIcon: null,
    progressBarContainer: null, // New
    progressBar: null,         // New
    fullscreenButton: null,    // New
    isPlaying: false,
    isInitialized: false,      // Flag to prevent multiple inits/cleanups

    init: (containerId, playlistUrl, thumbnailUrl, aspectRatio) => {
        if (VideoPlayer.isInitialized) {
            console.warn("VideoPlayer already initialized. Cleaning up first.");
            VideoPlayer.cleanup(); // Prevent multiple instances
        }
        VideoPlayer.isInitialized = true;

        VideoPlayer.containerElement = document.getElementById(containerId);
        if (!VideoPlayer.containerElement) {
            console.error(`Video container #${containerId} not found.`);
            VideoPlayer.isInitialized = false;
            return;
        }

        VideoPlayer.containerElement.innerHTML = ''; // Clear previous content
        VideoPlayer.containerElement.classList.remove('hidden');

        // Create video element
        VideoPlayer.videoElement = document.createElement('video');
        VideoPlayer.videoElement.poster = thumbnailUrl;
        VideoPlayer.videoElement.playsInline = true; // Important for mobile playback
        VideoPlayer.videoElement.preload = 'metadata'; // Load metadata for duration/size info
        VideoPlayer.videoElement.className = 'detail-video-element';
        // Start with sound ON
        VideoPlayer.videoElement.muted = false; // <<< CHANGE MADE HERE
        VideoPlayer.containerElement.appendChild(VideoPlayer.videoElement);

        // Create Controls Overlay Elements (Play/Pause Icon)
        VideoPlayer.controlsOverlay = document.createElement('div');
        VideoPlayer.controlsOverlay.className = 'video-controls-overlay';

        VideoPlayer.playPauseIcon = document.createElement('i');
        // Start with play icon visible initially
        VideoPlayer.playPauseIcon.className = 'ph ph-play video-play-pause-icon visible-icon';
        VideoPlayer.controlsOverlay.appendChild(VideoPlayer.playPauseIcon);
        VideoPlayer.containerElement.appendChild(VideoPlayer.controlsOverlay); // Add overlay first

        // Create Mute Button (appended later to ensure it's on top of overlay potentially)
        VideoPlayer.muteButton = document.createElement('button');
        VideoPlayer.muteButton.className = 'video-mute-button';
        VideoPlayer.muteButton.setAttribute('aria-label', 'Mute/Unmute');
        VideoPlayer.muteIcon = document.createElement('i');
        // Reflect default unmuted state
        VideoPlayer.muteIcon.className = 'ph ph-speaker-high'; // Start unmuted <<< CHANGE MADE HERE
        VideoPlayer.muteButton.appendChild(VideoPlayer.muteIcon);
        VideoPlayer.containerElement.appendChild(VideoPlayer.muteButton); // Append mute button

        // Create Progress Bar Elements
        VideoPlayer.progressBarContainer = document.createElement('div');
        VideoPlayer.progressBarContainer.className = 'video-progress-bar-container';
        VideoPlayer.progressBar = document.createElement('div');
        VideoPlayer.progressBar.className = 'video-progress-bar';
        VideoPlayer.progressBarContainer.appendChild(VideoPlayer.progressBar);
        VideoPlayer.containerElement.appendChild(VideoPlayer.progressBarContainer); // Append progress bar

        // Add Fullscreen Button
        VideoPlayer.fullscreenButton = document.createElement('button');
        VideoPlayer.fullscreenButton.className = 'video-fullscreen-button';
        VideoPlayer.fullscreenButton.setAttribute('aria-label', 'Toggle Fullscreen');
        const fullscreenIcon = document.createElement('i');
        fullscreenIcon.className = 'ph ph-corners-out'; // Start with expand icon
        VideoPlayer.fullscreenButton.appendChild(fullscreenIcon);
        VideoPlayer.containerElement.appendChild(VideoPlayer.fullscreenButton);

        // Set aspect ratio using padding-top trick for responsiveness
        if (aspectRatio && aspectRatio.width && aspectRatio.height && aspectRatio.width > 0) {
            const ratio = (aspectRatio.height / aspectRatio.width) * 100;
            // Add a sanity check for extreme ratios
            if (ratio > 10 && ratio < 200) { // e.g., filter out ratios like 1:20 or 20:1
                VideoPlayer.containerElement.style.paddingTop = `${ratio}%`;
            } else {
                VideoPlayer.containerElement.style.paddingTop = '56.25%'; // Default to 16:9 if ratio is weird
                console.warn("Unusual aspect ratio detected, defaulting to 16:9", aspectRatio);
            }
        } else {
            VideoPlayer.containerElement.style.paddingTop = '56.25%'; // Default to 16:9
        }


        // Initialize HLS.js
        if (Hls.isSupported()) {
            VideoPlayer.hlsInstance = new Hls({
                startLevel: -1,
                capLevelToPlayerSize: true,
            });
            VideoPlayer.hlsInstance.loadSource(playlistUrl);
            VideoPlayer.hlsInstance.attachMedia(VideoPlayer.videoElement);

            VideoPlayer.hlsInstance.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                // Manifest parsed logic (optional)
            });

            VideoPlayer.hlsInstance.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error('HLS fatal network error encountered:', data);
                            VideoPlayer.showPlayerError("Network Error");
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error('HLS fatal media error encountered:', data);
                            VideoPlayer.showPlayerError("Media Error");
                            break;
                        default:
                            console.error('HLS fatal error encountered, destroying instance:', data);
                            VideoPlayer.showPlayerError("Playback Error");
                            VideoPlayer.cleanup();
                            break;
                    }
                }
            });

        } else if (VideoPlayer.videoElement.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari, iOS)
            VideoPlayer.videoElement.src = playlistUrl;
            VideoPlayer.videoElement.addEventListener('error', (e) => {
                console.error("Native video playback error:", e, VideoPlayer.videoElement.error);
                VideoPlayer.showPlayerError("Playback Error");
            });
        } else {
            console.error("HLS playback not supported in this browser.");
            VideoPlayer.showPlayerError("Video playback not supported.");
            VideoPlayer.isInitialized = false;
            return;
        }

        // Add Event Listeners
        VideoPlayer.containerElement.addEventListener('click', VideoPlayer.handleContainerClick);
        VideoPlayer.muteButton.addEventListener('click', VideoPlayer.toggleMute);
        VideoPlayer.fullscreenButton.addEventListener('click', VideoPlayer.toggleFullscreen);
        document.addEventListener('fullscreenchange', VideoPlayer.updateFullscreenIcon);
        VideoPlayer.videoElement.addEventListener('play', VideoPlayer.handlePlay);
        VideoPlayer.videoElement.addEventListener('pause', VideoPlayer.handlePause);
        VideoPlayer.videoElement.addEventListener('ended', VideoPlayer.handleEnded);
        VideoPlayer.videoElement.addEventListener('timeupdate', VideoPlayer.updateProgressBar);
        VideoPlayer.videoElement.addEventListener('loadedmetadata', VideoPlayer.updateProgressBar);

    },

    showPlayerError: (message) => {
        if (!VideoPlayer.containerElement) return;
        const existingError = VideoPlayer.containerElement.querySelector('.video-error');
        if (existingError) existingError.remove();

        const errorElement = document.createElement('p');
        errorElement.className = 'video-error';
        errorElement.textContent = message;
        VideoPlayer.containerElement.appendChild(errorElement);

        if (VideoPlayer.controlsOverlay) VideoPlayer.controlsOverlay.style.display = 'none';
        if (VideoPlayer.muteButton) VideoPlayer.muteButton.style.display = 'none';
        if (VideoPlayer.fullscreenButton) VideoPlayer.fullscreenButton.style.display = 'none';
        if (VideoPlayer.progressBarContainer) VideoPlayer.progressBarContainer.style.display = 'none';
    },


    handleContainerClick: (event) => {
        if (event.target === VideoPlayer.muteButton || VideoPlayer.muteButton.contains(event.target) ||
            event.target === VideoPlayer.fullscreenButton || VideoPlayer.fullscreenButton.contains(event.target) ||
            event.target === VideoPlayer.progressBarContainer || VideoPlayer.progressBarContainer.contains(event.target)) {
            return;
        }
        VideoPlayer.togglePlayPause();
    },

    togglePlayPause: () => {
        if (!VideoPlayer.videoElement || !VideoPlayer.isInitialized || VideoPlayer.containerElement?.querySelector('.video-error')) {
            return;
        }

        if (VideoPlayer.videoElement.paused || VideoPlayer.videoElement.ended) {
            VideoPlayer.videoElement.play().then(() => {
                if (VideoPlayer.playPauseIcon) VideoPlayer.playPauseIcon.className = 'ph ph-pause video-play-pause-icon hidden-icon';
            }).catch(error => {
                console.error("Video play failed:", error);
                // Browsers often prevent autoplay with sound. If play fails initially, try muting and playing again.
                if (error.name === 'NotAllowedError' || error.name === 'NotSupportedError') {
                    console.warn("Autoplay with sound likely blocked. Trying muted.");
                    VideoPlayer.videoElement.muted = true; // Mute it
                    VideoPlayer.updateMuteIcon(); // Update icon
                    VideoPlayer.videoElement.play().catch(err2 => {
                        // If even muted play fails, show error
                        console.error("Muted video play also failed:", err2);
                        if (VideoPlayer.playPauseIcon) VideoPlayer.playPauseIcon.className = 'ph ph-play video-play-pause-icon visible-icon';
                        VideoPlayer.showPlayerError("Could not play video");
                    });
                } else {
                    // Handle other errors
                    if (VideoPlayer.playPauseIcon) VideoPlayer.playPauseIcon.className = 'ph ph-play video-play-pause-icon visible-icon';
                    VideoPlayer.showPlayerError("Could not play video");
                }
            });
        } else {
            VideoPlayer.videoElement.pause();
            if (VideoPlayer.playPauseIcon) VideoPlayer.playPauseIcon.className = 'ph ph-play video-play-pause-icon visible-icon';
        }
    },

    toggleMute: (event) => {
        event.stopPropagation();
        if (!VideoPlayer.videoElement || !VideoPlayer.isInitialized) return;
        VideoPlayer.videoElement.muted = !VideoPlayer.videoElement.muted;
        VideoPlayer.updateMuteIcon();
    },

    updateMuteIcon: () => {
        if (!VideoPlayer.muteIcon || !VideoPlayer.isInitialized) return;
        if (VideoPlayer.videoElement.muted) {
            VideoPlayer.muteIcon.className = 'ph ph-speaker-slash';
        } else {
            VideoPlayer.muteIcon.className = 'ph ph-speaker-high';
        }
    },

    toggleFullscreen: (event) => {
        event.stopPropagation();
        if (!VideoPlayer.containerElement || !VideoPlayer.isInitialized) return;

        if (!document.fullscreenElement) {
            VideoPlayer.containerElement.requestFullscreen()
                .catch(err => {
                    console.error(`Error attempting to enable fullscreen on container: ${err.message}`);
                    if (VideoPlayer.videoElement) {
                        VideoPlayer.videoElement.requestFullscreen().catch(err2 => {
                            console.error(`Error attempting to enable fullscreen on video element: ${err2.message}`);
                        });
                    }
                });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen()
                    .catch(err => console.error(`Error attempting to exit fullscreen: ${err.message}`));
            }
        }
    },

    updateFullscreenIcon: () => {
        const isFullscreen = document.fullscreenElement === VideoPlayer.containerElement || document.fullscreenElement === VideoPlayer.videoElement;

        if (!VideoPlayer.fullscreenButton) return;
        const icon = VideoPlayer.fullscreenButton.querySelector('i');
        if (!icon) return;

        if (isFullscreen) {
            icon.className = 'ph ph-corners-in';
        } else {
            icon.className = 'ph ph-corners-out';
        }
    },

    handlePlay: () => {
        if (!VideoPlayer.isInitialized) return;
        VideoPlayer.isPlaying = true;
        if (VideoPlayer.playPauseIcon) VideoPlayer.playPauseIcon.className = 'ph ph-pause video-play-pause-icon hidden-icon';
        VideoPlayer.updateMuteIcon(); // Ensure mute icon is correct based on actual muted state
        const existingError = VideoPlayer.containerElement?.querySelector('.video-error');
        if (existingError) existingError.remove();
        if (VideoPlayer.controlsOverlay) VideoPlayer.controlsOverlay.style.display = '';
        if (VideoPlayer.muteButton) VideoPlayer.muteButton.style.display = '';
        if (VideoPlayer.fullscreenButton) VideoPlayer.fullscreenButton.style.display = '';
        if (VideoPlayer.progressBarContainer) VideoPlayer.progressBarContainer.style.display = '';

    },

    handlePause: () => {
        if (!VideoPlayer.isInitialized) return;
        VideoPlayer.isPlaying = false;
        if (VideoPlayer.playPauseIcon) VideoPlayer.playPauseIcon.className = 'ph ph-play video-play-pause-icon visible-icon';
    },

    handleEnded: () => {
        if (!VideoPlayer.isInitialized) return;
        VideoPlayer.isPlaying = false;
        if (VideoPlayer.playPauseIcon) VideoPlayer.playPauseIcon.className = 'ph ph-play video-play-pause-icon visible-icon';
        if (VideoPlayer.progressBar) VideoPlayer.progressBar.style.width = '0%';
    },

    updateProgressBar: () => {
        if (!VideoPlayer.videoElement || !VideoPlayer.progressBar || !VideoPlayer.isInitialized || !isFinite(VideoPlayer.videoElement.duration)) {
            return;
        }
        const percentage = (VideoPlayer.videoElement.currentTime / VideoPlayer.videoElement.duration) * 100;
        VideoPlayer.progressBar.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
    },

    cleanup: () => {
        if (!VideoPlayer.isInitialized) return;
        if (VideoPlayer.hlsInstance) {
            VideoPlayer.hlsInstance.destroy();
            VideoPlayer.hlsInstance = null;
        }
        if (VideoPlayer.videoElement) {
            VideoPlayer.videoElement.removeEventListener('play', VideoPlayer.handlePlay);
            VideoPlayer.videoElement.removeEventListener('pause', VideoPlayer.handlePause);
            VideoPlayer.videoElement.removeEventListener('ended', VideoPlayer.handleEnded);
            VideoPlayer.videoElement.removeEventListener('timeupdate', VideoPlayer.updateProgressBar);
            VideoPlayer.videoElement.removeEventListener('loadedmetadata', VideoPlayer.updateProgressBar);
            VideoPlayer.videoElement.removeEventListener('error', VideoPlayer.showPlayerError);
            VideoPlayer.videoElement.removeAttribute('src');
            VideoPlayer.videoElement.poster = '';
            VideoPlayer.videoElement.pause();
            try { VideoPlayer.videoElement.load(); } catch (e) { console.warn("Error during video element load() on cleanup:", e) }
        }
        if (VideoPlayer.containerElement) {
            VideoPlayer.containerElement.removeEventListener('click', VideoPlayer.handleContainerClick);
            VideoPlayer.containerElement.innerHTML = '';
            VideoPlayer.containerElement.classList.add('hidden');
            VideoPlayer.containerElement.style.paddingTop = '';
        }
        if (VideoPlayer.muteButton) {
            VideoPlayer.muteButton.removeEventListener('click', VideoPlayer.toggleMute);
        }
        if (VideoPlayer.fullscreenButton) {
            VideoPlayer.fullscreenButton.removeEventListener('click', VideoPlayer.toggleFullscreen);
        }
        document.removeEventListener('fullscreenchange', VideoPlayer.updateFullscreenIcon);


        // Reset all state variables
        VideoPlayer.videoElement = null;
        VideoPlayer.containerElement = null;
        VideoPlayer.controlsOverlay = null;
        VideoPlayer.playPauseIcon = null;
        VideoPlayer.muteButton = null;
        VideoPlayer.muteIcon = null;
        VideoPlayer.progressBarContainer = null;
        VideoPlayer.progressBar = null;
        VideoPlayer.fullscreenButton = null;
        VideoPlayer.isPlaying = false;
        VideoPlayer.isInitialized = false;
    }
};