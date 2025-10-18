async function handleGitHubSetSecret(secret_name, secret_value, repo_name = null, org_name = null) {
    if (!secret_name || !secret_value) {
        showStatus('Secret name and value are required to set a GitHub secret.', 'error', 5000);
        return false;
    }

    const headers = getGitHubAuthHeaders();
    const configuredRepoUrl = localStorage.getItem(GITHUB_REPO_URL_KEY);
    let owner, repo;

    if (repo_name) {
        // If repo_name is provided, try to parse it (e.g., "owner/repo" or just "repo-name")
        if (repo_name.includes('/')) {
            [owner, repo] = repo_name.split('/');
        } else {
            // Assume it's a user's repo if only name is given and no org_name
            const parsedConfiguredRepo = parseGithubRepoUrl(configuredRepoUrl);
            owner = parsedConfiguredRepo.owner; // Fallback to configured owner
            repo = repo_name;
        }
    } else if (configuredRepoUrl) {
        ({ owner, repo } = parseGithubRepoUrl(configuredRepoUrl));
    }

    if (!owner || !repo) {
        showStatus('Could not determine repository owner/name. Please configure a default repository or specify "repo_name" (e.g., "owner/repo-name").', 'error', 8000);
        return false;
    }

    showStatus(`Setting GitHub secret '${secret_name}' in ${owner}/${repo}...`, 'info', 0);

    try {
        // Step 1: Get the repository's public key for secret encryption
        const publicKeyUrl = `https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`;
        const publicKeyResponse = await fetch(publicKeyUrl, { headers });

        if (!publicKeyResponse.ok) {
            const errorBody = await publicKeyResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to get repository public key (${publicKeyResponse.status} ${publicKeyResponse.statusText}): ${errorData}`);
        }
        const publicKeyData = await publicKeyResponse.json();
        const { key_id, key } = publicKeyData;

        // Step 2: Encrypt the secret value using the public key
        const encryptedValue = await encryptSecretWithPublicKey(secret_value, key); // Use the new encryption function

        const putSecretBody = {
            encrypted_value: encryptedValue,
            key_id: key_id
        };

        // Step 3: Send the encrypted secret to GitHub
        const putSecretUrl = `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secret_name}`;
        const putSecretResponse = await fetch(putSecretUrl, {
            method: 'PUT',
            headers: headers,
            body: JSON.stringify(putSecretBody)
        });

        if (!putSecretResponse.ok) {
            const errorBody = await putSecretResponse.text();
            let errorData = errorBody;
            try { errorData = JSON.parse(errorBody); } catch (e) {}
            throw new Error(errorData.message || `Failed to set secret (${putSecretResponse.status} ${putSecretResponse.statusText}): ${errorData}`);
        }

        showStatus(`GitHub: Secret '${secret_name}' successfully set in ${owner}/${repo}.`, 'success', 3000);
        return true;

    } catch (error) {
        console.error(`GitHub Set Secret Error for ${secret_name}:`, error);
        showStatus(`GitHub: Failed to set secret '${secret_name}': ${error.message}`, 'error', 10000); // Longer duration for this critical error
        return false;
    }
}

