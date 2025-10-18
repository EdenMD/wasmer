const THEME_STORAGE_KEY = 'gen1_theme';
const FIRST_RUN_STORAGE_KEY = 'hasSeenStarterPage';

// Define the specific starter page and the redirect target
const STARTER_PAGE_FILENAME ='mainx.html'; // Make sure this exactly matches your starter page file name (case-sensitive if on Linux servers)
const REDIRECT_TARGET_PAGE = 'Welcome.html'; // The page to redirect to after the first run

/**
 * Loads the saved theme preference from localStorage.
 * Defaults to 'dark-theme' if no specific preference ('light') is set.
 */
function loadTheme() {
    const body = document.body;
    if (!body) {
        console.error("Document body not found, cannot load theme.");
        return;
    }
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    // Default to dark theme if no preference is saved, or if it's explicitly 'dark'
    if (savedTheme === 'light') {
        body.classList.remove('dark-theme');
    } else { // This covers 'dark', null, or any other value, making dark the default
        body.classList.add('dark-theme');
    }
}

/**
 * Marks the "first run" as seen in localStorage.
 * This function should be called when the user completes the 'Starter.html' process
 * (e.g., clicks a "Get Started" button).
 */
function markFirstRunPageAsSeen() {
    localStorage.setItem(FIRST_RUN_STORAGE_KEY, 'true');
    console.log("First run marked as seen in localStorage.");
}

/**
 * Handles the redirection logic for the starter page.
 * If the current page is STARTER_PAGE_FILENAME and the first run flag is set,
 * it redirects to REDIRECT_TARGET_PAGE.
 *
 * @returns {boolean} True if a redirect occurred, false otherwise.
 */
function handleStarterPageRedirect() {
    const currentFileName = window.location.pathname.split('/').pop();

    // Check if we are precisely on the STARTER_PAGE_FILENAME
    if (currentFileName === STARTER_PAGE_FILENAME) {
        // Check if the user has already seen the starter page
        if (localStorage.getItem(FIRST_RUN_STORAGE_KEY) === 'true') {
            console.log(`On ${STARTER_PAGE_FILENAME} and first run already seen. Redirecting to ${REDIRECT_TARGET_PAGE}.`);
            // Use replace() to prevent the starter page from being in the browser history
            window.location.replace(REDIRECT_TARGET_PAGE);
            return true; // Indicate that a redirect happened
        } else {
            console.log(`On ${STARTER_PAGE_FILENAME} for the first time. Will not redirect.`);
        }
    }
    return false; // No redirect happened
}

// Expose functions globally under 'window.htu' for external access
window.htu = window.htu || {};
window.htu.loadTheme = loadTheme;
window.htu.markFirstRunPageAsSeen = markFirstRunPageAsSeen;

// Main execution block when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // **PRIORITY 1: Attempt to handle redirection immediately.**
    // If a redirect happens, further script execution for the current page is stopped.
    const redirected = handleStarterPageRedirect();

    // **PRIORITY 2: If no redirect occurred, proceed to load the theme.**
    if (!redirected) {
        loadTheme();
    }
});
