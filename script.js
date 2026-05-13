// script.js - Updated for Secure Vercel API
const searchInput = document.getElementById('searchInput');
const viewport = document.getElementById('mainViewport');
const resultArea = document.getElementById('result-area');

let debounceTimeout = null;
let currentEditEntry = null;
let isAuthenticated = false;

// Listen for typing
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (query.length > 0) {
        viewport.classList.add('searching');

        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }

        resultArea.innerHTML = `<div class="suggestion-box">Searching...</div>`;

        debounceTimeout = setTimeout(() => {
            performSearch(query);
        }, 300); // Slightly higher debounce for API calls

    } else {
        viewport.classList.remove('searching');
        resultArea.innerHTML = "";
    }
});

// NEW: Fetch search results from the Serverless API
async function performSearch(query) {
    try {
        // This calls the file in /api/database.js
        const response = await fetch(`/api/database?query=${encodeURIComponent(query)}`);
        const results = await response.json();

        if (results && results.length > 0) {
            // Check for exact match in the returned results
            const exactMatch = results.find(entry =>
                entry.word.toLowerCase() === query.toLowerCase()
            );
            renderWord(exactMatch || results[0]);
        } else {
            findSuggestion(query);
        }
    } catch (error) {
        console.error("Search error:", error);
        resultArea.innerHTML = `<div class="suggestion-box">⚠️ Connection error.</div>`;
    }
}

// NEW: Fetch suggestions from the API
async function findSuggestion(query) {
    const prefix = query.substring(0, 2).toLowerCase();
    try {
        const response = await fetch(`/api/database?query=${encodeURIComponent(prefix)}`);
        const results = await response.json();

        if (results && results.length > 0) {
            const suggestion = results[0];
            resultArea.innerHTML = `
                <div class="suggestion-box">
                    No exact match. Did you mean <span class="suggest-link" onclick="autoFill('${suggestion.word}')">${suggestion.word}</span>?
                </div>`;
        } else {
            resultArea.innerHTML = `<div class="suggestion-box">No results found for "${query}".</div>`;
        }
    } catch (error) {
        resultArea.innerHTML = `<div class="suggestion-box">No results found.</div>`;
    }
}

function autoFill(word) {
    searchInput.value = word;
    performSearch(word);
}

function renderWord(data) {
    // Store globally so the edit form can access the current view
    currentEditEntry = data;

    resultArea.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 20px;">
                <div>
                    <h1 style="margin:0; font-size: 2.2rem; color: #1a1a1a;">${data.word}</h1>
                    <p style="color:var(--accent); font-style:italic; margin: 5px 0;">${data.grammar || ''}</p>
                </div>
                <div class="khowar-script">${data.khowar_script || ''}</div>
            </div>

            <div class="action-buttons">
                ${data.audio_url ? `<button class="audio-btn" onclick="new Audio('${data.audio_url}').play()">🔊 Listen</button>` : ''}
                <button class="edit-btn" onclick="handleEditClick()">✏️ Edit</button>
            </div>

            <span class="label">English Meaning</span>
            <p style="font-size:1.2rem; margin: 10px 0; line-height: 1.5;">${data.meaning || ''}</p>

            ${data.example_khowar ? `
                <span class="label">Khowar Example</span>
                <p class="khowar-script" style="font-size: 1.4rem; margin: 10px 0;">${data.example_khowar}</p>
            ` : ''}
            
            ${data.example_english ? `
                <span class="label">Translation</span>
                <p style="color: #666; margin: 10px 0;"><em>${data.example_english}</em></p>
            ` : ''}
        </div>
    `;
}

// ─── Edit Flow ─────────────────────────────────────────

function handleEditClick() {
    if (!currentEditEntry) return;

    if (isAuthenticated) {
        showEditForm();
    } else {
        showPasswordDialog();
    }
}

function showPasswordDialog() {
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalOverlay';
    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>🔒 Admin Access</h2>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <p style="color: #888; margin: 0 0 20px;">Enter password to edit <b>${currentEditEntry.word}</b>.</p>
            <input type="password" id="passwordInput" class="modal-input" placeholder="Password..." autofocus />
            <div id="passwordError" class="modal-error"></div>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" onclick="verifyPassword()">Unlock</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
    setTimeout(() => overlay.classList.add('active'), 10);

    const input = document.getElementById('passwordInput');
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') verifyPassword(); });
    input.focus();
}

async function verifyPassword() {
    const input = document.getElementById('passwordInput');
    const errorEl = document.getElementById('passwordError');
    const password = input.value;

    try {
        const response = await fetch('/api/update-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: password,
                originalWord: currentEditEntry.word,
                updatedEntry: currentEditEntry
            })
        });
        const data = await response.json();

        if (data.error === 'Incorrect password') {
            errorEl.textContent = '❌ Incorrect password.';
        } else {
            isAuthenticated = true;
            window.__adminPass = password;
            showEditForm();
        }
    } catch (err) {
        errorEl.textContent = '⚠️ Server connection failed.';
    }
}

function showEditForm() {
    closeModal();
    const e = currentEditEntry;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay active';
    overlay.id = 'modalOverlay';
    overlay.innerHTML = `
        <div class="modal modal-wide">
            <div class="modal-header">
                <h2>✏️ Edit Entry</h2>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <div class="edit-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Word</label>
                        <input type="text" id="editWord" class="modal-input" value="${escapeAttr(e.word)}" />
                    </div>
                    <div class="form-group">
                        <label>Grammar</label>
                        <input type="text" id="editGrammar" class="modal-input" value="${escapeAttr(e.grammar || '')}" />
                    </div>
                </div>
                <div class="form-group">
                    <label>Khowar Script</label>
                    <input type="text" id="editKhowarScript" class="modal-input rtl-input" value="${escapeAttr(e.khowar_script || '')}" />
                </div>
                <div class="form-group">
                    <label>English Meaning</label>
                    <textarea id="editMeaning" class="modal-input modal-textarea">${escapeHtml(e.meaning || '')}</textarea>
                </div>
                <div class="form-group">
                    <label>Audio URL</label>
                    <input type="text" id="editAudioUrl" class="modal-input" value="${escapeAttr(e.audio_url || '')}" />
                </div>
            </div>
            <div id="editError" class="modal-error"></div>
            <div id="editSuccess" class="modal-success"></div>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" id="updateBtn" onclick="saveEdit()">💾 Save Changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);
}

async function saveEdit() {
    const btn = document.getElementById('updateBtn');
    const errorEl = document.getElementById('editError');
    const successEl = document.getElementById('editSuccess');

    btn.disabled = true;
    btn.textContent = '⏳ Saving...';

    const updatedEntry = {
        word: document.getElementById('editWord').value,
        khowar_script: document.getElementById('editKhowarScript').value,
        grammar: document.getElementById('editGrammar').value,
        meaning: document.getElementById('editMeaning').value,
        audio_url: document.getElementById('editAudioUrl').value
    };

    try {
        const response = await fetch('/api/update-entry', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                password: window.__adminPass,
                originalWord: currentEditEntry.word,
                updatedEntry
            })
        });
        const data = await response.json();

        if (data.error) {
            errorEl.textContent = '❌ ' + data.error;
            btn.disabled = false;
        } else {
            successEl.textContent = '✅ Updated!';
            renderWord(updatedEntry);
            setTimeout(() => closeModal(), 1000);
        }
    } catch (err) {
        errorEl.textContent = '⚠️ Error saving to server.';
        btn.disabled = false;
    }
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) overlay.remove();
}

function escapeHtml(str) { return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escapeAttr(str) { return str.replace(/"/g, '&quot;'); }