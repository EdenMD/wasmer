// --- User-provided Constants ---
const DB_NAME = 'Gen1DB';
const DB_VERSION = 1;
const PROJECTS_STORE_NAME = 'projects';
const FILES_STORE_NAME = 'projectFiles';

const CURRENT_PROJECT_ID_LS_KEY = 'gen1_current_project_id';
const THEME_STORAGE_KEY = 'gen1_theme';
const CONVERSATION_FILENAME = 'conversations.json';
const FILE_OPS_ENABLED_KEY = 'gen1_file_ops_enabled';
const CUSTOM_MARKDOWN_INSTRUCTION_KEY = 'gen1_custom_markdown_instruction';
const DIRECTORY_MARKER = '__GEN1_DIRECTORY__';

// --- End User-provided Constants ---

const GITHUB_PAT_KEY = 'gen1_github_pat';
const GITHUB_OWNER_KEY = 'gen1_github_owner'; // New: For storing owner
const GITHUB_REPO_KEY = 'gen1_github_repo';   // New: For storing repo
const JOB_RESULTS_FILENAME = 'project.xgr';

// Global IndexedDB instance
let db = null;
let currentProjectId = null;
let fileOperationsEnabled = false;

// Global variable to hold the current project's files data
let projectFilesData = {};

const body = document.body;
const themeToggleButton = document.getElementById('themeToggleButton');

// --- Theme Functions ---
function loadTheme() {
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'dark') {
        body.classList.add('dark-theme');
        themeToggleButton.querySelector('i').className = 'fas fa-sun';
    } else {
        body.classList.remove('dark-theme');
        themeToggleButton.querySelector('i').className = 'fas fa-moon';
    }
}

function toggleTheme() {
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        localStorage.setItem(THEME_STORAGE_KEY, 'light');
        themeToggleButton.querySelector('i').className = 'fas fa-moon';
    } else {
        body.classList.add('dark-theme');
        localStorage.setItem(THEME_STORAGE_KEY, 'dark');
        themeToggleButton.querySelector('i').className = 'fas fa-sun';
    }
    const themeTextSpan = themeToggleButton.querySelector('span');
    if (themeTextSpan && window.innerWidth <= 768) {
        themeTextSpan.textContent = body.classList.contains('dark-theme') ? 'Light' : 'Dark';
    }
}
// --- End Theme Functions ---

// Utility function to clean string for HTTP headers
function cleanStringForHeaders(str) {
    if (!str) return '';
    return str
        .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
        .replace(/[^\x20-\x7E]/g, '')
        .trim();
}

// Helper to display messages (errors, success, info, warning or status)
function showStatus(message, type = 'info', elementId = 'statusMessage') {
    const element = document.getElementById(elementId);
    if (element) {
        const existingIcon = element.querySelector('i');
        if (existingIcon) {
            existingIcon.remove();
        }
        let iconClass = '';
        if (type === 'error') iconClass = 'fas fa-times-circle';
        else if (type === 'success') iconClass = 'fas fa-check-circle';
        else if (type === 'warning') iconClass = 'fas fa-exclamation-triangle';
        else iconClass = 'fas fa-info-circle';
        const icon = document.createElement('i');
        icon.className = iconClass;
        element.prepend(icon);
        let pTag = element.querySelector('p');
        if (!pTag) {
            pTag = document.createElement('p');
            element.appendChild(pTag);
        }
        pTag.textContent = message;
        element.className = `message-box ${type}`;
        element.style.display = 'flex';
        console.log(`[Status ${type.toUpperCase()} - ${elementId}]`, message);
    }
}

// Helper to clear messages and status
function clearMessage(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '';
        element.className = 'message-box';
        element.style.display = 'none';
    }
}

// --- IndexedDB Functions ---
function openIndexedDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(PROJECTS_STORE_NAME)) {
                // FIX: Schema now uses string keys, matching the project creation script.
                const projectsStore = db.createObjectStore(PROJECTS_STORE_NAME, { keyPath: 'id' });
                projectsStore.createIndex('name', 'name', { unique: false });
            }
            if (db.objectStoreNames.contains(FILES_STORE_NAME)) {
                db.deleteObjectStore(FILES_STORE_NAME);
            }
            db.createObjectStore(FILES_STORE_NAME, { keyPath: 'projectId' });
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            showStatus(`IndexedDB error: ${event.target.error.message}`, 'error', 'fileOpsStatus');
            reject(event.target.error);
        };
    });
}

async function initializeProjectContext() {
    try {
        await openIndexedDB();
        showStatus('IndexedDB initialized.', 'info', 'projectStatus');
        let storedProjectId = localStorage.getItem(CURRENT_PROJECT_ID_LS_KEY);
        let projectExists = false;

        if (storedProjectId) {
            const transaction = db.transaction([PROJECTS_STORE_NAME], 'readonly');
            const store = transaction.objectStore(PROJECTS_STORE_NAME);
            const project = await new Promise((resolve) => {
                // FIX: Removed parseInt(). Project ID is a string, not a number.
                const getRequest = store.get(storedProjectId);
                getRequest.onsuccess = (e) => resolve(e.target.result);
                getRequest.onerror = () => resolve(null);
            });

            if (project) {
                currentProjectId = project.id;
                projectExists = true;
                showStatus(`Project "${project.name}" (ID: ${currentProjectId}) loaded.`, 'success', 'projectStatus');
                await loadProjectFilesIntoMemory(currentProjectId);
            }
        }

        if (!projectExists) {
            showStatus('No valid project found. Creating a default project...', 'info', 'projectStatus');
            const newProject = { name: 'GitHub Job Results', createdAt: new Date().toISOString() };
            const transaction = db.transaction([PROJECTS_STORE_NAME], 'readwrite');
            const store = transaction.objectStore(PROJECTS_STORE_NAME);
            
            // This path needs adjustment as we no longer auto-increment
            const newProjectId = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            newProject.id = newProjectId;
            const addRequest = store.add(newProject);

            await new Promise((resolve, reject) => {
                addRequest.onsuccess = (event) => {
                    currentProjectId = newProjectId; // The key itself
                    localStorage.setItem(CURRENT_PROJECT_ID_LS_KEY, currentProjectId);
                    showStatus(`Default project "GitHub Job Results" (ID: ${currentProjectId}) created and set as current.`, 'success', 'projectStatus');
                    projectFilesData = {};
                    resolve();
                };
                addRequest.onerror = (event) => {
                    console.error('Failed to create default project:', event.target.error);
                    showStatus(`Failed to create default project: ${event.target.error.message}`, 'error', 'projectStatus');
                    reject(event.target.error);
                };
            });
        }
    } catch (error) {
        console.error('Failed to initialize project context:', error);
        showStatus(`Failed to initialize project context: ${error.message}`, 'error', 'projectStatus');
    }
}


async function loadProjectFilesIntoMemory(projectId) {
    return new Promise((resolve, reject) => {
        if (!db || !projectId) {
            projectFilesData = {};
            resolve();
            return;
        }
        const transaction = db.transaction([FILES_STORE_NAME], 'readonly');
        const store = transaction.objectStore(FILES_STORE_NAME);
        const request = store.get(projectId);

        request.onsuccess = (event) => {
            const entry = event.target.result;
            projectFilesData = (entry && entry.files) ? entry.files : {};
            resolve();
        };
        request.onerror = (event) => {
            console.error("Failed to load project files into memory:", event.target.error);
            projectFilesData = {};
            reject(event.target.error);
        };
    });
}

function getSizeString(content) {
    const sizeInBytes = new TextEncoder().encode(content).length;
    if (sizeInBytes < 1024) return `${sizeInBytes} bytes`;
    return `${(sizeInBytes / 1024).toFixed(2)} KB`;
}

async function performFileOperation(op, userInitiated = false) {
    if (!fileOperationsEnabled) {
        showStatus(`File operation failed: File saving to IndexedDB is currently disabled.`, 'error', 'fileOpsStatus');
        return false;
    }
    if (!db || !currentProjectId) {
        showStatus('File operation failed: No active project or database connection.', 'error', 'fileOpsStatus');
        return false;
    }
    showStatus(`Attempting to ${op.action} file '${op.path}'...`, 'info', 'fileOpsStatus');
    try {
        const transaction = db.transaction([FILES_STORE_NAME], 'readwrite');
        const store = transaction.objectStore(FILES_STORE_NAME);
        projectFilesData[op.path] = op.content;
        const dataToStore = {
            projectId: currentProjectId,
            files: projectFilesData,
            timestamp: new Date().toISOString()
        };
        await new Promise((resolve, reject) => {
            const putRequest = store.put(dataToStore);
            putRequest.onsuccess = resolve;
            putRequest.onerror = (e) => reject(e.target.error);
        });
        showStatus(`Successfully updated file '${op.path}'. Total project files data size: ${getSizeString(JSON.stringify(projectFilesData))}`, 'success', 'fileOpsStatus');
        return true;
    } catch (error) {
        console.error(`IndexedDB file operation failed for ${op.path}:`, error);
        showStatus(`Failed to ${op.action} file '${op.path}': ${error.message}`, 'error', 'fileOpsStatus');
        return false;
    }
}

// NEW: Finds all workflow files and populates a datalist for autocomplete.
async function findAndPopulateWorkflowFiles() {
    const workflowInput = document.getElementById('workflowFileName');
    if (!workflowInput) return;

    let datalist = document.getElementById('workflow-files-list');
    if (!datalist) {
        datalist = document.createElement('datalist');
        datalist.id = 'workflow-files-list';
        workflowInput.parentElement.appendChild(datalist);
        workflowInput.setAttribute('list', 'workflow-files-list');
    }
    datalist.innerHTML = ''; // Clear previous options

    try {
        const files = Object.keys(projectFilesData);
        const workflowFiles = files
            .filter(path => path.startsWith('.github/workflows/') && (path.endsWith('.yml') || path.endsWith('.yaml')))
            .map(path => path.split('/').pop()); // Get just the filename

        if (workflowFiles.length > 0) {
            workflowFiles.forEach(fileName => {
                const option = document.createElement('option');
                option.value = fileName;
                datalist.appendChild(option);
            });
            const mainYml = workflowFiles.find(name => name === 'main.yml');
            const currentValue = workflowInput.value.trim();
            if (!currentValue || !workflowFiles.includes(currentValue)) {
                workflowInput.value = mainYml || workflowFiles[0];
            }
            showStatus(`Auto-detected ${workflowFiles.length} workflow file(s).`, 'info', 'fileOpsStatus');
        } else {
            showStatus('No workflow file (.github/workflows/*.yml) found in project. Please enter manually.', 'info', 'fileOpsStatus');
        }
    } catch (error) {
        console.error("Error finding workflow files:", error);
        showStatus(`Error detecting workflow files: ${error.message}`, 'error', 'fileOpsStatus');
    }
}
// --- End IndexedDB Functions ---

function handlePatAction() {
    const tokenInput = document.getElementById('token');
    const patActionButton = document.getElementById('patActionButton');
    if (tokenInput.readOnly) {
        if (confirm('Are you sure you want to clear your GitHub PAT?')) {
            localStorage.removeItem(GITHUB_PAT_KEY);
            tokenInput.value = '';
            tokenInput.readOnly = false;
            patActionButton.innerHTML = '<i class="fas fa-save"></i> Save PAT';
            showStatus('PAT cleared from local storage.', 'info', 'patMessage');
        }
    } else {
        const pat = cleanStringForHeaders(tokenInput.value);
        if (pat) {
            localStorage.setItem(GITHUB_PAT_KEY, pat);
            tokenInput.readOnly = true;
            patActionButton.innerHTML = '<i class="fas fa-eraser"></i> Clear PAT';
            showStatus('PAT saved successfully to local storage.', 'success', 'patMessage');
        } else {
            showStatus('Please enter a valid PAT to save.', 'error', 'patMessage');
        }
    }
}

async function fetchWorkflowIdByName(owner, repo, workflowFileName, token) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFileName}`;
    const response = await fetch(apiUrl, {
        headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
        const data = await response.json();
        return data.id;
    }
    const errorText = await response.text();
    throw new Error(`Failed to get workflow ID for '${workflowFileName}'. Status: ${response.status}\nDetails: ${errorText}`);
}

async function fetchWorkflowRuns(owner, repo, workflowId, token) {
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs?per_page=10`;
    const response = await fetch(apiUrl, {
        headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
        const data = await response.json();
        return data.workflow_runs;
    }
    const errorText = await response.text();
    throw new Error(`Failed to get workflow runs for ID '${workflowId}'. Status: ${response.status}\nDetails: ${errorText}`);
}

async function cancelWorkflowRun(owner, repo, runId, token) {
    if (!confirm(`Are you sure you want to CANCEL workflow run ${runId}?`)) return;
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Cancelling run ${runId}...</span>`;
    loadingIndicator.style.display = 'flex';
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/cancel`, {
            method: 'POST',
            headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
            showStatus(`Workflow run ${runId} cancelled successfully! Refreshing list...`, 'success');
            await handleFetchWorkflowRuns(true);
        } else {
            const errorData = await response.json();
            showStatus(`Failed to cancel run ${runId}. Error: ${errorData.message || 'Unknown error.'}`, 'error');
        }
    } catch (error) {
        showStatus(`An error occurred while cancelling run ${runId}: ${error.message}`, 'error');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

async function deleteWorkflowRun(owner, repo, runId, token, itemElement) {
    if (!confirm(`Are you sure you want to DELETE workflow run ${runId} and all its logs? This is irreversible.`)) return;
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Deleting run ${runId}...</span>`;
    loadingIndicator.style.display = 'flex';
    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}`, {
            method: 'DELETE',
            headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${token}` }
        });
        if (response.ok || response.status === 204) {
            showStatus(`Workflow run ${runId} deleted successfully!`, 'success');
            itemElement.remove();
            if (document.getElementById('workflowRunsList').children.length === 0) {
                document.getElementById('workflowRunsList').innerHTML = '<p><i class="fas fa-info-circle"></i> No recent workflow runs found.</p>';
            }
        } else {
            const errorData = await response.json();
            showStatus(`Failed to delete run ${runId}. Error: ${errorData.message || 'Unknown error.'}`, 'error');
        }
    } catch (error) {
        showStatus(`An error occurred while deleting run ${runId}: ${error.message}`, 'error');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

function displayWorkflowRuns(owner, repo, token, runs) {
    const workflowRunsListDiv = document.getElementById('workflowRunsList');
    workflowRunsListDiv.innerHTML = '';
    if (!runs || runs.length === 0) {
        workflowRunsListDiv.innerHTML = '<p><i class="fas fa-info-circle"></i> No recent workflow runs found for this workflow.</p>';
        return;
    }
    runs.forEach(run => {
        const runItem = document.createElement('div');
        runItem.className = 'workflow-run-item';
        const runDetails = document.createElement('div');
        runDetails.className = 'workflow-run-details';

        let statusClass = '';
        if (run.conclusion === 'success') statusClass = 'status-success';
        else if (run.conclusion === 'failure') statusClass = 'status-failure';
        else if (['in_progress', 'queued', 'waiting', 'pending'].includes(run.status)) statusClass = 'status-pending';
        else if (run.conclusion === 'cancelled' || run.status === 'cancelled') statusClass = 'status-cancelled';

        const commitMessage = run.head_commit ? run.head_commit.message.split('\n')[0].substring(0, 70) + '...' : 'N/A';
        runDetails.innerHTML = `
            <span><strong>Run ID:</strong> <a href="${run.html_url}" target="_blank">${run.id} <i class="fas fa-external-link-alt"></i></a></span>
            <span><strong>Status:</strong> <span class="${statusClass}">${run.status.replace(/_/g, ' ')}</span>, <strong>Conclusion:</strong> <span class="${statusClass}">${run.conclusion ? run.conclusion.replace(/_/g, ' ') : 'N/A'}</span></span>
            <span><strong>Branch:</strong> <i class="fas fa-code-branch"></i> ${run.head_branch}</span>
            <span><strong>Commit:</strong> <i class="fas fa-code-commit"></i> ${commitMessage}</span>
            <span><strong>Started:</strong> <i class="fas fa-clock"></i> ${new Date(run.created_at).toLocaleString()}</span>`;

        const runActions = document.createElement('div');
        runActions.className = 'workflow-run-actions';
        const fetchJobsButton = document.createElement('button');
        fetchJobsButton.className = 'secondary';
        fetchJobsButton.innerHTML = '<i class="fas fa-tasks"></i> View Jobs';
        fetchJobsButton.onclick = () => fetchGitHubJobs(owner, repo, run.id, token);
        runActions.appendChild(fetchJobsButton);

        if (['in_progress', 'queued', 'waiting', 'pending'].includes(run.status)) {
            const cancelButton = document.createElement('button');
            cancelButton.className = 'cancel-btn';
            cancelButton.innerHTML = '<i class="fas fa-stop-circle"></i> Cancel Run';
            cancelButton.onclick = () => cancelWorkflowRun(owner, repo, run.id, token);
            runActions.appendChild(cancelButton);
        }
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.innerHTML = '<i class="fas fa-trash-alt"></i> Delete Run';
        deleteButton.onclick = () => deleteWorkflowRun(owner, repo, run.id, token, runItem);
        runActions.appendChild(deleteButton);

        runItem.appendChild(runDetails);
        runItem.appendChild(runActions);
        workflowRunsListDiv.appendChild(runItem);
    });
}

async function fetchGitHubJobs(owner, repo, runId, token) {
    const resultsDiv = document.getElementById('results');
    const loadingIndicator = document.getElementById('loadingIndicator');
    clearMessage('statusMessage');
    clearMessage('fileOpsStatus');
    resultsDiv.textContent = `Fetching jobs for run ID ${runId}...`;
    loadingIndicator.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Fetching jobs for run ID ${runId}...</span>`;
    loadingIndicator.style.display = 'flex';

    try {
        const cleanedToken = cleanStringForHeaders(token);
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/runs/${runId}/jobs`, {
            headers: { 'Accept': 'application/vnd.github+json', 'Authorization': `Bearer ${cleanedToken}` }
        });
        if (response.ok) {
            const data = await response.json();
            const jobContent = JSON.stringify(data, null, 2);
            resultsDiv.textContent = jobContent;
            await performFileOperation({ action: 'create', path: JOB_RESULTS_FILENAME, content: jobContent }, true);
        } else {
            const errorText = await response.text();
            showStatus(`Failed to get jobs for Run ID ${runId}. Status: ${response.status}\nDetails: ${errorText}`, 'error');
        }
    } catch (error) {
        showStatus(`Error fetching GitHub jobs: ${error.message}`, 'error');
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

async function handleFetchWorkflowRuns(refreshing = false) {
    const owner = document.getElementById('owner').value.trim();
    const repo = document.getElementById('repo').value.trim();
    const workflowFileName = document.getElementById('workflowFileName').value.trim();
    let token = localStorage.getItem(GITHUB_PAT_KEY);

    const workflowRunsListDiv = document.getElementById('workflowRunsList');
    const loadingIndicator = document.getElementById('loadingIndicator');
    clearMessage('statusMessage');
    clearMessage('patMessage');
    clearMessage('fileOpsStatus');
    workflowRunsListDiv.innerHTML = '<p><i class="fas fa-sync-alt fa-spin"></i> Loading workflow runs...</p>';
    loadingIndicator.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>Fetching workflow runs...</span>`;
    loadingIndicator.style.display = 'flex';

    if (!owner || !repo || !workflowFileName) {
        showStatus('Please fill in Owner, Repository, and Workflow File Name.', 'error');
        workflowRunsListDiv.innerHTML = '<p><i class="fas fa-info-circle"></i> Enter details and click "Fetch" to see recent runs.</p>';
        loadingIndicator.style.display = 'none';
        return;
    }

    // NEW: Save owner and repo to local storage
    localStorage.setItem(GITHUB_OWNER_KEY, owner);
    localStorage.setItem(GITHUB_REPO_KEY, repo);

    token = cleanStringForHeaders(token);
    if (!token) {
        showStatus('No PAT found. Please enter and save your GitHub PAT first.', 'error');
        workflowRunsListDiv.innerHTML = '<p><i class="fas fa-exclamation-circle"></i> A GitHub PAT is required.</p>';
        loadingIndicator.style.display = 'none';
        return;
    }
    try {
        const workflowId = await fetchWorkflowIdByName(owner, repo, workflowFileName, token);
        const runs = await fetchWorkflowRuns(owner, repo, workflowId, token);
        displayWorkflowRuns(owner, repo, token, runs);
        showStatus(refreshing ? 'Workflow runs list refreshed.' : 'Successfully fetched workflow runs.', refreshing ? 'info' : 'success');
    } catch (error) {
        showStatus(`Error fetching workflow details: ${error.message}`, 'error');
        workflowRunsListDiv.innerHTML = `<p><i class="fas fa-exclamation-circle"></i> Error fetching runs. Check console for details.</p>`;
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// --- Event Listeners and Initial Load ---
document.getElementById('fetchWorkflowRunsButton').addEventListener('click', () => handleFetchWorkflowRuns(false));
document.getElementById('patActionButton').addEventListener('click', handlePatAction);
themeToggleButton.addEventListener('click', toggleTheme);

const fileOpsEnabledToggle = document.getElementById('fileOpsEnabledToggle');
fileOpsEnabledToggle.addEventListener('change', async (event) => { // Made async
    fileOperationsEnabled = event.target.checked;
    localStorage.setItem(FILE_OPS_ENABLED_KEY, fileOperationsEnabled);
    if (fileOperationsEnabled) {
        showStatus('File saving to IndexedDB is now ENABLED.', 'success', 'fileOpsStatus');
        // NEW: Call updated function
        await findAndPopulateWorkflowFiles();
    } else {
        showStatus('File saving to IndexedDB is now DISABLED.', 'info', 'fileOpsStatus');
    }
});

document.addEventListener('DOMContentLoaded', async () => {
    loadTheme();
    const tokenInput = document.getElementById('token');
    const patActionButton = document.getElementById('patActionButton');
    const storedPat = localStorage.getItem(GITHUB_PAT_KEY);
    if (storedPat) {
        tokenInput.value = storedPat;
        tokenInput.readOnly = true;
        patActionButton.innerHTML = '<i class="fas fa-eraser"></i> Clear PAT';
        showStatus('PAT loaded from local storage.', 'success', 'patMessage');
    } else {
        showStatus('No PAT found. Please enter and save your GitHub PAT.', 'warning', 'patMessage');
    }

    // NEW: Load stored owner and repo
    const storedOwner = localStorage.getItem(GITHUB_OWNER_KEY);
    if (storedOwner) document.getElementById('owner').value = storedOwner;
    const storedRepo = localStorage.getItem(GITHUB_REPO_KEY);
    if (storedRepo) document.getElementById('repo').value = storedRepo;

    fileOperationsEnabled = localStorage.getItem(FILE_OPS_ENABLED_KEY) === 'true';
    fileOpsEnabledToggle.checked = fileOperationsEnabled;
    showStatus(`File saving is ${fileOperationsEnabled ? 'ENABLED' : 'DISABLED'}.`, 'info', 'fileOpsStatus');

    await initializeProjectContext();

    if (fileOperationsEnabled && currentProjectId) {
        // NEW: Call updated function
        await findAndPopulateWorkflowFiles();
    }
});

window.addEventListener('resize', () => {
    const themeTextSpan = themeToggleButton.querySelector('span');
    if (themeTextSpan) {
        if (window.innerWidth <= 768) {
            themeTextSpan.textContent = body.classList.contains('dark-theme') ? 'Light' : 'Dark';
            themeTextSpan.style.display = 'none';
        } else {
            themeTextSpan.textContent = 'Theme';
            themeTextSpan.style.display = 'inline';
        }
    }
});
window.dispatchEvent(new Event('resize'));