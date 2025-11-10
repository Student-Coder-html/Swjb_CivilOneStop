const GITHUB_CONFIG = {
    owner: 'Special-Srit',
    repo: 'Swjb_CivilOneStop',
    branch: 'main',
    path: '',
    token: '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' // read token from env
};

let allComponents = [];
let currentCategory = 'all';
let totalFilesToLoad = 0;
let loadedFiles = 0;

function updateLoadingProgress(loaded, total) {
    const detailsEl = document.getElementById('loadingDetails');
    const progressBar = document.getElementById('loadingProgressBar');

    if (detailsEl) {
        detailsEl.textContent = `Loaded ${loaded} / ${total} files`;
    }

    if (progressBar && total > 0) {
        const percentage = (loaded / total) * 100;
        progressBar.style.width = percentage + '%';
    }
}

function detectCategory(path) {
    const lowerPath = path.toLowerCase();
    if (lowerPath.includes('component')) return 'components';
    if (lowerPath.includes('page')) return 'pages';
    if (lowerPath.includes('template')) return 'templates';
    return 'components';
}

function getIconForFile(name) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('header') || lowerName.includes('nav')) return '🧭';
    if (lowerName.includes('footer')) return '🔻';
    if (lowerName.includes('form')) return '📝';
    if (lowerName.includes('table') || lowerName.includes('data')) return '📊';
    if (lowerName.includes('modal') || lowerName.includes('dialog')) return '💬';
    if (lowerName.includes('search')) return '🔍';
    if (lowerName.includes('card')) return '🎴';
    if (lowerName.includes('button')) return '🔘';
    if (lowerName.includes('menu')) return '☰';
    if (lowerName.includes('login') || lowerName.includes('auth')) return '🔐';
    return '📄';
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

async function fetchRepoContents(path = '', isInitialScan = false) {
    const headers = {
        'Accept': 'application/vnd.github.v3+json'
    };

    if (GITHUB_CONFIG.token) {
        headers['Authorization'] = `token ${GITHUB_CONFIG.token}`;
    }

    const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${path}`;

    try {
        const response = await fetch(url, { headers });

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let htmlFiles = [];

        // Count total files on initial scan
        if (isInitialScan) {
            totalFilesToLoad = await countTotalItems(data);
            updateLoadingProgress(0, totalFilesToLoad);
        }

        for (const item of data) {
            if (item.type === 'file' && item.name.endsWith('.html')) {
                htmlFiles.push({
                    name: item.name.replace('.html', ''),
                    path: item.path,
                    size: item.size,
                    url: item.html_url,
                    downloadUrl: item.download_url,
                    category: detectCategory(item.path),
                    icon: getIconForFile(item.name)
                });
                loadedFiles++;
                updateLoadingProgress(loadedFiles, totalFilesToLoad);
            } else if (item.type === 'dir') {
                const subFiles = await fetchRepoContents(item.path, false);
                htmlFiles = htmlFiles.concat(subFiles);
            } else {
                // Non-HTML file encountered
                loadedFiles++;
                updateLoadingProgress(loadedFiles, totalFilesToLoad);
            }
        }

        return htmlFiles;
    } catch (error) {
        console.error('Error fetching repository contents:', error);
        throw error;
    }
}

async function countTotalItems(items) {
    let count = items.length;
    for (const item of items) {
        if (item.type === 'dir') {
            try {
                const headers = {
                    'Accept': 'application/vnd.github.v3+json'
                };
                if (GITHUB_CONFIG.token) {
                    headers['Authorization'] = `token ${GITHUB_CONFIG.token}`;
                }
                const url = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/contents/${item.path}`;
                const response = await fetch(url, { headers });
                if (response.ok) {
                    const subItems = await response.json();
                    count += await countTotalItems(subItems);
                }
            } catch (error) {
                console.error('Error counting items:', error);
            }
        }
    }
    return count;
}

async function init() {
    try {
        const repoUrl = `https://github.com/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`;
        document.getElementById('githubLink').href = repoUrl;
        document.getElementById('githubHeaderLink').href = repoUrl;
        document.getElementById('issuesLink').href = `${repoUrl}/issues`;

        const repoInfoUrl = `https://api.github.com/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}`;
        const repoResponse = await fetch(repoInfoUrl);

        if (repoResponse.ok) {
            const repoData = await repoResponse.json();
            const repoInfoEl = document.getElementById('repoInfo');
            repoInfoEl.classList.remove('hidden');
            repoInfoEl.innerHTML = `
                <strong>Repository:</strong> 
                <a href="${repoData.html_url}" target="_blank">${repoData.full_name}</a>
                ${repoData.description ? `<br><small>${repoData.description}</small>` : ''}
            `;
        }

        allComponents = await fetchRepoContents(GITHUB_CONFIG.path, true);

        document.querySelector('.loading').style.display = 'none';
        document.getElementById('componentGrid').classList.remove('hidden');
        document.getElementById('statsBar').classList.remove('hidden');

        if (allComponents.length === 0) {
            document.getElementById('componentGrid').innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <div class="empty-state-title">No components found</div>
                    <p class="empty-state-text">Make sure your GitHub configuration is correct</p>
                </div>
            `;
        } else {
            updateStats(allComponents.length, allComponents.length);
            renderComponents(allComponents);
        }

    } catch (error) {
        document.querySelector('.loading').style.display = 'none';
        document.getElementById('content').innerHTML = `
            <div class="error-message">
                <h3>⚠️ Unable to load components</h3>
                <p><strong>Error:</strong> ${error.message}</p>
                <p>Please check the following:</p>
                <ul>
                    <li>GitHub repository settings are correct (owner, repo, branch)</li>
                    <li>Repository is public (or access token is provided for private repos)</li>
                    <li>Internet connection is stable</li>
                    <li>GitHub API rate limit not exceeded (60 requests/hour)</li>
                </ul>
                <div class="error-details">
                    <div>Owner: ${GITHUB_CONFIG.owner}</div>
                    <div>Repo: ${GITHUB_CONFIG.repo}</div>
                    <div>Branch: ${GITHUB_CONFIG.branch}</div>
                </div>
            </div>
        `;
    }
}

function updateStats(total, filtered) {
    document.getElementById('totalCount').textContent = total;
    document.getElementById('categoryCount').textContent = filtered;
}

function renderComponents(componentsToRender) {
    const grid = document.getElementById('componentGrid');
    grid.innerHTML = '';

    if (componentsToRender.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">🔍</div>
                <div class="empty-state-title">No results found</div>
                <p class="empty-state-text">Try adjusting your search or filter</p>
            </div>
        `;
        return;
    }

    componentsToRender.forEach(component => {
        const card = document.createElement('div');
        card.className = 'component-card';
        card.onclick = () => window.open(component.url, '_blank');

        card.innerHTML = `
            <div class="component-icon">${component.icon}</div>
            <div class="component-name">${component.name}</div>
            <div class="component-path">${component.path}</div>
            <div class="component-meta">
                <span class="component-tag">${component.category}</span>
                <span class="component-size">${formatSize(component.size)}</span>
            </div>
        `;

        grid.appendChild(card);
    });
}

function showCategory(category) {
    currentCategory = category;

    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    event.target.classList.add('active');

    const filtered = category === 'all'
        ? allComponents
        : allComponents.filter(c => c.category === category);

    updateStats(allComponents.length, filtered.length);
    renderComponents(filtered);
}

function searchComponents() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allComponents.filter(c =>
        c.name.toLowerCase().includes(searchTerm) ||
        c.path.toLowerCase().includes(searchTerm)
    );
    updateStats(allComponents.length, filtered.length);
    renderComponents(filtered);
}

document.getElementById('searchInput').addEventListener('input', searchComponents);

window.addEventListener('DOMContentLoaded', init);

async function fetchRepoContents() {
    try {
        const response = await fetch('Hub_resources/components.json');
        if (!response.ok) throw new Error('Failed to load component list');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error loading local component list:', error);
        throw error;
    }
}

