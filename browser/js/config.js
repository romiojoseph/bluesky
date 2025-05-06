let appConfig = [];

async function loadConfig() {
    try {
        const response = await fetch('assets/config.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        appConfig = await response.json();
    } catch (error) {
        console.error("Failed to load config.json:", error);
        // Handle error appropriately, maybe show a message to the user
        document.body.innerHTML = '<h1>Error loading configuration. Please check config.json</h1>';
    }
}

function getConfig() {
    return appConfig;
}