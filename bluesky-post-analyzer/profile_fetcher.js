// profile_fetcher.js

const PROFILE_FETCH_BATCH_SIZE = 25; // Max allowed by API
const PROFILE_FETCH_RATE_LIMIT_DELAY = 100; // Same as other API calls

async function rateLimitProfileFetch() {
    await rateLimit("getProfiles"); // Reuse the existing rate limiter
}

// --- Centralized Loading State Management (for the modal) ---
function setProfileLoadingState(isLoading, message = "", action = "") {
    const loaderContainer = document.getElementById('profile-loader'); // Use the modal's loader
    const progressMessage = document.getElementById('profile-progress-message');
    const progressAction = document.getElementById('profile-progress-action');

    if (isLoading) {
        loaderContainer.style.display = 'block';
        progressMessage.textContent = message;
        progressAction.textContent = action;
    } else {
        loaderContainer.style.display = 'none';
        progressMessage.textContent = '';
        progressAction.textContent = '';
    }
}

async function getProfiles(dids) {
    let allProfiles = [];
    let cursor = null;
    let didChunks = [];

    // Split DIDs into chunks of PROFILE_FETCH_BATCH_SIZE
    for (let i = 0; i < dids.length; i += PROFILE_FETCH_BATCH_SIZE) {
        didChunks.push(dids.slice(i, i + PROFILE_FETCH_BATCH_SIZE));
    }

    let totalProfiles = 0; // Keep track of fetched profiles
    for (const chunk of didChunks) {
        await rateLimitProfileFetch();
        const params = new URLSearchParams();
        chunk.forEach(did => params.append("actors", did));

        setProfileLoadingState(true, "Fetching profiles...", `Fetched ${totalProfiles} profiles`); // Update progress


        try {
            const response = await fetch(`${BASE_URL}/app.bsky.actor.getProfiles?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            const newProfiles = data.profiles || [];
            allProfiles = allProfiles.concat(newProfiles);
            totalProfiles += newProfiles.length;  //Increment total
            setProfileLoadingState(true, "Fetching profiles...", `Fetched ${totalProfiles} profiles`); // Update progress

        } catch (error) {
            console.error("Error fetching profiles:", error);
            // Consider showing a user-friendly error message.

        }
    }
    setProfileLoadingState(false); // Hide loader after all chunks are processed
    return allProfiles;
}


function createProfileTable(profiles, tableId) {
    const table = document.getElementById(tableId);
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = ''; // Clear previous content

    profiles.forEach(profile => {
        const row = tbody.insertRow();
        const handleCell = row.insertCell(0);
        const handleLink = document.createElement('a');
        handleLink.href = `https://bsky.app/profile/${profile.did}`;
        handleLink.textContent = profile.handle;
        handleLink.target = "_blank";
        handleCell.appendChild(handleLink);


        row.insertCell(1).textContent = profile.followersCount;
        row.insertCell(2).textContent = profile.followsCount;
        row.insertCell(3).textContent = profile.postsCount;
        row.insertCell(4).textContent = profile.labels && profile.labels[0] && profile.labels[0].val ? profile.labels[0].val : "N/A"; // Handle missing labels gracefully
        row.insertCell(5).textContent = formatDate(profile.createdAt);  // Reuse formatDate
    });
}



function showProfileModal(likes, reposts) {
    const modal = document.getElementById('profile-modal');
    modal.style.display = 'block';
    document.body.classList.add('modal-open'); // Prevent background scrolling

    // --- Mixed Tab ---
    const mixedDids = likes.filter(likeDid => reposts.includes(likeDid));
    const likesOnlyDids = likes.filter(likeDid => !reposts.includes(likeDid));
    const repostsOnlyDids = reposts.filter(repostDid => !likes.includes(repostDid));

    // Fetch and display mixed profiles immediately
    setProfileLoadingState(true, "Fetching profiles..."); // Initial loader
    getProfiles(mixedDids).then(profiles => {
        createProfileTable(profiles, 'mixed-profiles-table');
        setProfileLoadingState(false); //hide loader
    });


    // --- Tab Switching Logic ---
    function showProfileTab(tabName) {
        const tabContents = document.querySelectorAll('#profile-modal .tab-content');
        tabContents.forEach(content => content.style.display = 'none');

        const tabs = document.querySelectorAll('#profile-modal .tab');
        tabs.forEach(tab => tab.classList.remove('active'));

        document.getElementById(`${tabName}-profiles`).style.display = 'block';
        document.querySelector(`#profile-modal .tab[data-tab="${tabName}"]`).classList.add('active');


        // Fetch profiles for the selected tab *only* when the tab is clicked
        if (tabName === 'liked' && !document.getElementById('liked-profiles-table').querySelector('tbody').hasChildNodes()) {
            setProfileLoadingState(true, "Fetching profiles...");
            getProfiles(likesOnlyDids).then(profiles => {
                createProfileTable(profiles, 'liked-profiles-table');
                setProfileLoadingState(false);
            });
        } else if (tabName === 'reposted' && !document.getElementById('reposted-profiles-table').querySelector('tbody').hasChildNodes()) {
            setProfileLoadingState(true, "Fetching profiles...");
            getProfiles(repostsOnlyDids).then(profiles => {
                createProfileTable(profiles, 'reposted-profiles-table');
                setProfileLoadingState(false);
            });
        }
    }

    // Event listeners for tab switching
    const modalTabs = document.querySelectorAll('#profile-modal .tab');
    modalTabs.forEach(tab => {
        tab.addEventListener('click', (event) => {
            showProfileTab(event.target.dataset.tab); // Use data-tab attribute
        });
    });

    //Initial tab
    showProfileTab('mixed');
}


// --- Close Modal ---
function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    modal.style.display = 'none';
    document.body.classList.remove('modal-open');

    // Clear table data and loader
    document.getElementById('mixed-profiles-table').querySelector('tbody').innerHTML = '';
    document.getElementById('liked-profiles-table').querySelector('tbody').innerHTML = '';
    document.getElementById('reposted-profiles-table').querySelector('tbody').innerHTML = '';
    setProfileLoadingState(false); // Ensure loader is hidden
}

// Close modal when clicking outside
window.addEventListener('click', (event) => {
    const modal = document.getElementById('profile-modal');
    if (event.target === modal) {
        closeProfileModal();
    }
});


// --- Search Functionality ---
function searchProfileTable(tableId, inputId) {
    const filter = document.getElementById(inputId).value.toUpperCase();
    const table = document.getElementById(tableId);
    const rows = table.getElementsByTagName('tr');

    for (let i = 1; i < rows.length; i++) { // Skip header row
        let rowVisible = false;
        const cells = rows[i].getElementsByTagName('td');
        for (let j = 0; j < cells.length; j++) {
            const cellText = cells[j].textContent || cells[j].innerText;
            if (cellText.toUpperCase().indexOf(filter) > -1) {
                rowVisible = true;
                break;
            }
        }
        rows[i].style.display = rowVisible ? "" : "none";
    }
}

// --- Event Listeners for Search Boxes ---
document.getElementById('mixed-profiles-search').addEventListener('keyup', () => {
    searchProfileTable('mixed-profiles-table', 'mixed-profiles-search');
});

document.getElementById('liked-profiles-search').addEventListener('keyup', () => {
    searchProfileTable('liked-profiles-table', 'liked-profiles-search');
});

document.getElementById('reposted-profiles-search').addEventListener('keyup', () => {
    searchProfileTable('reposted-profiles-table', 'reposted-profiles-search');
});