document.addEventListener('DOMContentLoaded', () => {
    // Radio button event listeners
    document.querySelectorAll('input[name="option"]').forEach(radio => {
        radio.addEventListener('change', () => {
            const downloadSection = document.getElementById('downloadSection');
            const uploadSection = document.getElementById('uploadSection');

            if (radio.value === 'download') {
                downloadSection.style.display = 'block';
                uploadSection.style.display = 'none';
            } else {
                downloadSection.style.display = 'none';
                uploadSection.style.display = 'block';
            }
        });
    });

    // Content analysis tab switching
    const tabButtons = document.querySelectorAll('.tab-button[data-target]');
    const tabContents = document.querySelectorAll('.tab-content');

    function hideAllTabContents() {
        tabContents.forEach(content => {
            content.style.display = 'none';
        });
    }

    function showTabContent(targetId) {
        const content = document.getElementById(`${targetId}TableContainer`);
        if (content) {
            content.style.display = 'block';
        }
    }

    tabButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Prevent event bubbling
            e.stopPropagation();

            // Remove active class from all buttons
            tabButtons.forEach(btn => btn.classList.remove('active'));

            // Add active class to clicked button
            button.classList.add('active');

            // Hide all tab contents
            hideAllTabContents();

            // Show the target tab content
            const targetId = button.getAttribute('data-target');
            showTabContent(targetId);
        });
    });

    // Initialize default tab state
    hideAllTabContents();
    showTabContent('hashtags');
    document.querySelector('.tab-button[data-target="hashtags"]')?.classList.add('active');

    // Fetch button event listener
    const fetchBtn = document.getElementById('fetchBtn');
    if (fetchBtn) {
        fetchBtn.addEventListener('click', async () => { // Make the event listener async
            showLoadingScreen(); // Show loading screen before starting
            try {
                await fetchAndProcessRepository(); // Await the fetchAndProcessRepository function
            } finally {
                hideLoadingScreen(); // Hide loading screen after completion (or error)
            }
        });
    }
});


//Loading screen functions
function showLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'flex';
    document.getElementById('downloadSection').classList.add('hidden'); // Hide content
}

function hideLoadingScreen() {
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('downloadSection').classList.remove('hidden'); // Show content
}

function setLoadingMessage(message) {
    document.getElementById('loadingMessage').textContent = message;
}