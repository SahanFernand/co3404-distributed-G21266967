/**
 * Joke Service - Frontend JavaScript
 * Student ID: G21266967
 */

// DOM Elements
const jokeTypeSelect = document.getElementById('jokeType');
const refreshTypesBtn = document.getElementById('refreshTypes');
const getJokeBtn = document.getElementById('getJoke');
const jokeDisplay = document.getElementById('jokeDisplay');
const setupEl = document.getElementById('setup');
const punchlineEl = document.getElementById('punchline');
const revealBtn = document.getElementById('revealBtn');
const jokeTypeDisplay = document.getElementById('jokeTypeDisplay');
const loadingEl = document.getElementById('loading');
const errorEl = document.getElementById('error');
const statusEl = document.getElementById('status');
const statusBadge = document.getElementById('statusBadge');

// API Base URL
// Detect base path from current URL for Kong gateway routing
const API_BASE = window.location.pathname.replace(/\/$/, '') || '';

async function fetchTypes() {
    try {
        const res = await fetch(`${API_BASE}/types`);
        if (!res.ok) throw new Error('Failed to fetch types');
        const types = await res.json();

        jokeTypeSelect.innerHTML = '<option value="any">Any Type</option>';
        types.forEach(type => {
            const opt = document.createElement('option');
            opt.value = type;
            opt.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            jokeTypeSelect.appendChild(opt);
        });
    } catch (e) {
        console.error('Error fetching types:', e);
    }
}

async function getJoke() {
    const type = jokeTypeSelect.value;

    loadingEl.classList.remove('hidden');
    jokeDisplay.classList.add('hidden');
    errorEl.classList.add('hidden');

    try {
        const res = await fetch(`${API_BASE}/joke/${type}`);

        if (!res.ok) {
            if (res.status === 404) {
                throw new Error(`No jokes found for type: ${type}`);
            }
            throw new Error('Failed to fetch joke');
        }

        const joke = await res.json();

        loadingEl.classList.add('hidden');
        jokeDisplay.classList.remove('hidden');

        setupEl.textContent = joke.setup;
        punchlineEl.classList.add('hidden');
        punchlineEl.textContent = joke.punchline;
        revealBtn.classList.remove('hidden');
        jokeTypeDisplay.textContent = `Type: ${joke.type}`;

        statusBadge.textContent = 'Loaded';

    } catch (e) {
        console.error('Error:', e);
        loadingEl.classList.add('hidden');
        errorEl.textContent = e.message;
        errorEl.classList.remove('hidden');
    }
}

function revealPunchline() {
    punchlineEl.classList.remove('hidden');
    revealBtn.classList.add('hidden');
}

async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) {
            const health = await res.json();
            statusEl.textContent = `Online (${health.database})`;
            statusEl.className = 'status online';
        } else {
            throw new Error('Health check failed');
        }
    } catch (e) {
        statusEl.textContent = 'Offline';
        statusEl.className = 'status offline';
    }
}

// Event listeners
getJokeBtn.addEventListener('click', getJoke);
refreshTypesBtn.addEventListener('click', fetchTypes);
revealBtn.addEventListener('click', revealPunchline);

document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') getJoke();
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchTypes();
    checkHealth();
    setInterval(checkHealth, 30000);
});
