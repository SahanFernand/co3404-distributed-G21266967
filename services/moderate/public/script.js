/**
 * Moderate Service - Frontend JavaScript
 * Student ID: G21266967
 */

// DOM Elements
const navLoginBtn = document.getElementById('navLoginBtn');
const navUser = document.getElementById('navUser');
const navUserName = document.getElementById('navUserName');
const landingPage = document.getElementById('landingPage');
const dashboardPage = document.getElementById('dashboardPage');
const queueCount = document.getElementById('queueCount');
const noJokes = document.getElementById('noJokes');
const moderationForm = document.getElementById('moderationForm');
const setupInput = document.getElementById('setup');
const punchlineInput = document.getElementById('punchline');
const jokeTypeSelect = document.getElementById('jokeType');
const customTypeInput = document.getElementById('customType');
const submittedAtEl = document.getElementById('submittedAt');
const approveBtn = document.getElementById('approveBtn');
const rejectBtn = document.getElementById('rejectBtn');
const loadingEl = document.getElementById('loading');
const messageEl = document.getElementById('message');
const statusEl = document.getElementById('status');
const approvedCountEl = document.getElementById('approvedCount');
const rejectedCountEl = document.getElementById('rejectedCount');

// State
let currentJoke = null;
let pollingInterval = null;
let approvedCount = 0;
let rejectedCount = 0;
let isAuthenticated = false;

// API Base URL
// Detect base path from current URL for Kong gateway routing
const API_BASE = window.location.pathname.replace(/\/$/, '') || '';

/**
 * Check authentication status and show appropriate page
 */
async function checkAuth() {
    try {
        const response = await fetch(`${API_BASE}/auth/status`);
        const data = await response.json();

        if (data.authenticated) {
            isAuthenticated = true;
            navUserName.textContent = data.user.name;
            navLoginBtn.classList.add('hidden');
            navUser.classList.remove('hidden');
            landingPage.classList.add('hidden');
            dashboardPage.classList.remove('hidden');
            return true;
        } else {
            isAuthenticated = false;
            navLoginBtn.classList.remove('hidden');
            navUser.classList.add('hidden');
            landingPage.classList.remove('hidden');
            dashboardPage.classList.add('hidden');
            return false;
        }
    } catch (error) {
        console.error('Error checking auth:', error);
        // Show landing page on error
        landingPage.classList.remove('hidden');
        dashboardPage.classList.add('hidden');
        return false;
    }
}

/**
 * Fetch joke types and populate dropdown
 */
async function fetchTypes() {
    try {
        const response = await fetch(`${API_BASE}/types`);
        const types = await response.json();

        jokeTypeSelect.innerHTML = '<option value="">Select type...</option>';
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            jokeTypeSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching types:', error);
    }
}

/**
 * Fetch next joke for moderation
 */
async function fetchJoke() {
    if (!isAuthenticated) return;

    try {
        const response = await fetch(`${API_BASE}/moderate`);

        if (response.status === 401) {
            showMessage('Please login to moderate jokes', 'error');
            return;
        }

        const data = await response.json();
        queueCount.textContent = data.queueSize || 0;

        if (data.joke) {
            displayJoke(data.joke);
            stopPolling();
        } else {
            showNoJokes();
            startPolling();
        }
    } catch (error) {
        console.error('Error fetching joke:', error);
        showMessage('Failed to fetch joke', 'error');
    }
}

/**
 * Display joke for moderation
 */
function displayJoke(joke) {
    currentJoke = joke;
    noJokes.classList.add('hidden');
    moderationForm.classList.remove('hidden');
    messageEl.classList.add('hidden');

    setupInput.value = joke.setup || '';
    punchlineInput.value = joke.punchline || '';

    const typeOption = Array.from(jokeTypeSelect.options).find(o => o.value === joke.type);
    if (typeOption) {
        jokeTypeSelect.value = joke.type;
        customTypeInput.value = '';
    } else {
        jokeTypeSelect.value = '';
        customTypeInput.value = joke.type || '';
    }

    if (joke.submittedAt) {
        const date = new Date(joke.submittedAt);
        submittedAtEl.textContent = `Submitted: ${date.toLocaleString()}`;
    } else {
        submittedAtEl.textContent = '';
    }
}

function showNoJokes() {
    currentJoke = null;
    noJokes.classList.remove('hidden');
    moderationForm.classList.add('hidden');
}

function startPolling() {
    if (pollingInterval) return;
    pollingInterval = setInterval(fetchJoke, 3000);
}

function stopPolling() {
    if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
    }
}

/**
 * Approve joke
 */
async function approveJoke(e) {
    e.preventDefault();
    if (!currentJoke) return;

    let type = jokeTypeSelect.value || customTypeInput.value.trim();
    if (!type) {
        showMessage('Please select or enter a joke type', 'error');
        return;
    }

    setLoading(true);

    try {
        const response = await fetch(`${API_BASE}/moderated`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                setup: setupInput.value.trim(),
                punchline: punchlineInput.value.trim(),
                type: type.toLowerCase(),
                _deliveryTag: currentJoke._deliveryTag
            })
        });

        const data = await response.json();

        if (response.ok) {
            approvedCount++;
            approvedCountEl.textContent = approvedCount;
            showMessage('Joke approved!', 'success');
            setTimeout(fetchJoke, 1000);
        } else {
            throw new Error(data.error || 'Failed to approve');
        }
    } catch (error) {
        console.error('Error approving joke:', error);
        showMessage(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

/**
 * Reject joke
 */
async function rejectJoke() {
    if (!currentJoke) return;
    if (!confirm('Are you sure you want to reject this joke?')) return;

    setLoading(true);

    try {
        const response = await fetch(`${API_BASE}/reject`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                _deliveryTag: currentJoke._deliveryTag,
                reason: 'Rejected by moderator'
            })
        });

        if (response.ok) {
            rejectedCount++;
            rejectedCountEl.textContent = rejectedCount;
            showMessage('Joke rejected', 'success');
            setTimeout(fetchJoke, 1000);
        } else {
            throw new Error('Failed to reject joke');
        }
    } catch (error) {
        console.error('Error rejecting joke:', error);
        showMessage(error.message, 'error');
    } finally {
        setLoading(false);
    }
}

function setLoading(loading) {
    loadingEl.classList.toggle('hidden', !loading);
    moderationForm.classList.toggle('hidden', loading);
    approveBtn.disabled = loading;
    rejectBtn.disabled = loading;
}

function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `toast ${type}`;
    messageEl.classList.remove('hidden');
    setTimeout(() => messageEl.classList.add('hidden'), 3000);
}

async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE}/health`);
        if (response.ok) {
            const health = await response.json();
            statusEl.textContent = `Online (${health.oidc})`;
            statusEl.className = 'status online';
        } else {
            throw new Error('Health check failed');
        }
    } catch (error) {
        statusEl.textContent = 'Offline';
        statusEl.className = 'status offline';
    }
}

// Event Listeners
moderationForm.addEventListener('submit', approveJoke);
rejectBtn.addEventListener('click', rejectJoke);
jokeTypeSelect.addEventListener('change', () => { if (jokeTypeSelect.value) customTypeInput.value = ''; });
customTypeInput.addEventListener('input', () => { if (customTypeInput.value) jokeTypeSelect.value = ''; });

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    const loggedIn = await checkAuth();
    await fetchTypes();
    await checkHealth();
    if (loggedIn) await fetchJoke();

    setInterval(checkHealth, 30000);
    setInterval(fetchTypes, 60000);
});

window.addEventListener('beforeunload', stopPolling);
