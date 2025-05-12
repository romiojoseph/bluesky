const ACCESS_TOKEN_KEY = 'bskyViewer_accessToken';
const REFRESH_TOKEN_KEY = 'bskyViewer_refreshToken';
const USER_HANDLE_KEY = 'bskyViewer_userHandle';
const USER_DID_KEY = 'bskyViewer_userDid';

let currentSession = null;

async function loginUser(handle, appPassword) {
    try {
        const sessionData = await createSession(handle, appPassword);
        localStorage.setItem(ACCESS_TOKEN_KEY, sessionData.accessJwt);
        localStorage.setItem(REFRESH_TOKEN_KEY, sessionData.refreshJwt);
        localStorage.setItem(USER_HANDLE_KEY, sessionData.handle);
        localStorage.setItem(USER_DID_KEY, sessionData.did);
        currentSession = sessionData;
        return sessionData;
    } catch (error) {
        console.error("Login failed:", error);
        logoutUser(false); // Clear local without server call attempt on login fail
        throw error;
    }
}

// Added attemptServerLogout flag
function logoutUser(attemptServerLogout = true) {
    const accessToken = localStorage.getItem(ACCESS_TOKEN_KEY); // Get current access token

    if (attemptServerLogout && accessToken) {
        // Best effort to delete session on server.
        // If accessToken is expired, this will likely fail, which is acceptable.
        // The primary goal of logout is clearing client-side tokens.
        deleteSession(accessToken) // Pass the current access token
            .then(() => console.log("Server session deletion attempted."))
            .catch(err => console.warn("Failed to delete server session on logout (this is often OK if token was expired):", err.message));
    }
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_HANDLE_KEY);
    localStorage.removeItem(USER_DID_KEY);
    currentSession = null;
}

function getStoredSession() {
    const accessJwt = localStorage.getItem(ACCESS_TOKEN_KEY);
    const refreshJwt = localStorage.getItem(REFRESH_TOKEN_KEY);
    const handle = localStorage.getItem(USER_HANDLE_KEY);
    const did = localStorage.getItem(USER_DID_KEY);

    if (accessJwt && refreshJwt && handle && did) {
        return { accessJwt, refreshJwt, handle, did };
    }
    return null;
}

async function initializeAuth() {
    const storedSession = getStoredSession();
    if (storedSession) {
        try {
            const sessionDetails = await getSession(storedSession.accessJwt);
            currentSession = { ...storedSession, ...sessionDetails };
        } catch (error) {
            console.warn("Access token might be expired or invalid, trying to refresh.", error.message);
            try {
                const refreshedData = await refreshSession(storedSession.refreshJwt);
                localStorage.setItem(ACCESS_TOKEN_KEY, refreshedData.accessJwt);
                localStorage.setItem(REFRESH_TOKEN_KEY, refreshedData.refreshJwt);
                currentSession = { ...refreshedData, handle: storedSession.handle, did: storedSession.did };
            } catch (refreshError) {
                console.error("Session refresh failed:", refreshError);
                logoutUser(false); // Clear invalid session without attempting server delete again
            }
        }
    }
    return currentSession;
}


function getCurrentSession() {
    return currentSession;
}

function isLoggedIn() {
    return currentSession !== null && currentSession.accessJwt !== null;
}