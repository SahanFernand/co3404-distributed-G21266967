/**
 * Submit Service - Frontend JavaScript
 * Student ID: G21266967
 */

// DOM Elements
const jokeForm = document.getElementById('jokeForm');
const setupInput = document.getElementById('setup');
const punchlineInput = document.getElementById('punchline');
const jokeTypeSelect = document.getElementById('jokeType');
const newTypeInput = document.getElementById('newType');
const submitBtn = document.getElementById('submitBtn');
const btnText = submitBtn.querySelector('.btn-text');
const btnLoading = submitBtn.querySelector('.btn-loading');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const statusEl = document.getElementById('status');
const queueStatusEl = document.getElementById('queueStatus');
const statusBadge = document.getElementById('statusBadge');

// API Base URL
// Detect base path from current URL for Kong gateway routing
const API_BASE = window.location.pathname.replace(/\/$/, '') || '';

function setLoading(loading) {
    submitBtn.disabled = loading;
    btnText.classList.toggle('hidden', loading);
    btnLoading.classList.toggle('hidden', !loading);
}

function showSuccess() {
    successMessage.classList.remove('hidden');
    errorMessage.classList.add('hidden');
    jokeForm.reset();
    if (statusBadge) statusBadge.textContent = 'Submitted';
    setTimeout(() => {
        successMessage.classList.add('hidden');
        if (statusBadge) statusBadge.textContent = 'Ready';
    }, 5000);
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.classList.remove('hidden');
    successMessage.classList.add('hidden');
}

function hideMessages() {
    successMessage.classList.add('hidden');
    errorMessage.classList.add('hidden');
}

async function fetchTypes() {
    try {
        const res = await fetch(`${API_BASE}/types`);
        if (!res.ok) throw new Error('Failed to fetch types');
        const types = await res.json();

        jokeTypeSelect.innerHTML = '<option value="">Select type...</option>';
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

async function submitJoke(e) {
    e.preventDefault();
    hideMessages();

    let type = jokeTypeSelect.value;
    if (!type && newTypeInput.value.trim()) {
        type = newTypeInput.value.trim();
    }

    if (!setupInput.value.trim()) {
        showError('Please enter a joke setup');
        return;
    }

    if (!punchlineInput.value.trim()) {
        showError('Please enter a punchline');
        return;
    }

    if (!type) {
        showError('Please select a type or enter a new one');
        return;
    }

    setLoading(true);

    try {
        const res = await fetch(`${API_BASE}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                setup: setupInput.value.trim(),
                punchline: punchlineInput.value.trim(),
                type: type.toLowerCase()
            })
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.error || 'Failed to submit joke');
        }

        showSuccess();
        fetchTypes();

    } catch (error) {
        console.error('Error submitting joke:', error);
        showError(error.message);
    } finally {
        setLoading(false);
    }
}

async function checkHealth() {
    try {
        const res = await fetch(`${API_BASE}/health`);
        if (res.ok) {
            const health = await res.json();
            statusEl.textContent = 'Online';
            statusEl.className = 'status online';
            if (queueStatusEl) queueStatusEl.textContent = health.rabbitMQ;
        } else {
            throw new Error('Health check failed');
        }
    } catch (error) {
        statusEl.textContent = 'Offline';
        statusEl.className = 'status offline';
        if (queueStatusEl) queueStatusEl.textContent = 'Unknown';
    }
}

// Event listeners
jokeForm.addEventListener('submit', submitJoke);

jokeTypeSelect.addEventListener('change', () => {
    if (jokeTypeSelect.value) newTypeInput.value = '';
});

newTypeInput.addEventListener('input', () => {
    if (newTypeInput.value) jokeTypeSelect.value = '';
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchTypes();
    checkHealth();
    setInterval(checkHealth, 30000);
    setInterval(fetchTypes, 60000);
});
