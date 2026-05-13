// Local search against the database array from database.js
const searchInput = document.getElementById('searchInput');
const viewport = document.getElementById('mainViewport');
const resultArea = document.getElementById('result-area');

let debounceTimeout = null;
let currentEditEntry = null; // track which entry is being edited
let isAuthenticated = false; // track if user already entered password this session

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
        }, 200);

    } else {
        viewport.classList.remove('searching');
        resultArea.innerHTML = "";
    }
});

function performSearch(query) {
    const q = query.toLowerCase();

    const exactMatch = database.find(entry =>
        entry.word.toLowerCase() === q ||
        entry.word.toLowerCase().startsWith(q) ||
        (entry.meaning && entry.meaning.toLowerCase().includes(q)) ||
        (entry.khowar_script && entry.khowar_script.includes(query))
    );

    if (exactMatch) {
        renderWord(exactMatch);
        return;
    }

    const results = database.filter(entry =>
        entry.word.toLowerCase().includes(q) ||
        (entry.meaning && entry.meaning.toLowerCase().includes(q)) ||
        (entry.khowar_script && entry.khowar_script.includes(query)) ||
        (entry.example_english && entry.example_english.toLowerCase().includes(q))
    );

    if (results.length > 0) {
        renderWord(results[0]);
    } else {
        findSuggestion(query);
    }
}

function findSuggestion(query) {
    const prefix = query.substring(0, 2).toLowerCase();
    const suggestion = database.find(entry =>
        entry.word.toLowerCase().startsWith(prefix)
    );

    if (suggestion) {
        resultArea.innerHTML = `
            <div class="suggestion-box">
                No exact match. Did you mean <span class="suggest-link" onclick="autoFill('${suggestion.word}')">${suggestion.word}</span>?
            </div>`;
    } else {
        resultArea.innerHTML = `<div class="suggestion-box">No results found for "${query}".</div>`;
    }
}

function autoFill(word) {
    searchInput.value = word;
    performSearch(word);
}

function renderWord(data) {
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
                <button class="edit-btn" onclick="handleEditClick('${data.word.replace(/'/g, "\\'")}')">✏️ Edit</button>
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

function handleEditClick(word) {
    currentEditEntry = database.find(e => e.word === word);
    if (!currentEditEntry) return;

    if (isAuthenticated) {
        showEditForm();
    } else {
        showPasswordDialog();
    }
}

function showPasswordDialog() {
    // Remove any existing modal
    closeModal();

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalOverlay';
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    overlay.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2>🔒 Authentication Required</h2>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>
            <p style="color: #888; margin: 0 0 20px;">Enter the admin password to edit entries.</p>
            <input type="password" id="passwordInput" class="modal-input" placeholder="Enter password..." autofocus />
            <div id="passwordError" class="modal-error"></div>
            <div class="modal-actions">
                <button class="btn-cancel" onclick="closeModal()">Cancel</button>
                <button class="btn-primary" onclick="verifyPassword()">Unlock</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));

    // Allow Enter key
    setTimeout(() => {
        const input = document.getElementById('passwordInput');
        if (input) {
            input.focus();
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') verifyPassword();
            });
        }
    }, 100);
}

function verifyPassword() {
    const input = document.getElementById('passwordInput');
    const errorEl = document.getElementById('passwordError');
    const password = input.value;

    if (!password) {
        errorEl.textContent = 'Please enter a password.';
        return;
    }

    // We'll do a quick test request to the server to verify the password
    fetch('/api/update-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            password: password,
            originalWord: currentEditEntry.word,
            updatedEntry: currentEditEntry  // same data, just verifying password
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error === 'Incorrect password') {
            errorEl.textContent = '❌ Incorrect password. Try again.';
            input.value = '';
            input.focus();
        } else {
            // Password correct — remember for session
            isAuthenticated = true;
            window.__adminPass = password;
            closeModal();
            showEditForm();
        }
    })
    .catch(() => {
        errorEl.textContent = '⚠️ Server error. Is the server running?';
    });
}

function showEditForm() {
    closeModal();
    const e = currentEditEntry;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'modalOverlay';
    overlay.onclick = (ev) => { if (ev.target === overlay) closeModal(); };

    overlay.innerHTML = `
        <div class="modal modal-wide">
            <div class="modal-header">
                <h2>✏️ Edit Entry</h2>
                <button class="modal-close" onclick="closeModal()">✕</button>
            </div>

            <div class="edit-form">
                <div class="form-row">
                    <div class="form-group">
                        <label>Word (Romanized)</label>
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
                    <label>Khowar Example</label>
                    <input type="text" id="editExampleKhowar" class="modal-input rtl-input" value="${escapeAttr(e.example_khowar || '')}" />
                </div>

                <div class="form-group">
                    <label>English Translation</label>
                    <textarea id="editExampleEnglish" class="modal-input modal-textarea">${escapeHtml(e.example_english || '')}</textarea>
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
                <button class="btn-primary" id="updateBtn" onclick="saveEdit()">💾 Update</button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('active'));
}

function saveEdit() {
    const btn = document.getElementById('updateBtn');
    const errorEl = document.getElementById('editError');
    const successEl = document.getElementById('editSuccess');
    errorEl.textContent = '';
    successEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '⏳ Saving...';

    const updatedEntry = {
        word: document.getElementById('editWord').value,
        khowar_script: document.getElementById('editKhowarScript').value,
        grammar: document.getElementById('editGrammar').value,
        meaning: document.getElementById('editMeaning').value,
        example_khowar: document.getElementById('editExampleKhowar').value,
        example_english: document.getElementById('editExampleEnglish').value,
        audio_url: document.getElementById('editAudioUrl').value
    };

    fetch('/api/update-entry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            password: window.__adminPass,
            originalWord: currentEditEntry.word,
            updatedEntry
        })
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) {
            errorEl.textContent = '❌ ' + data.error;
            btn.disabled = false;
            btn.textContent = '💾 Update';
            return;
        }

        // Update local database array so UI reflects changes immediately
        const idx = database.findIndex(e => e.word === currentEditEntry.word);
        if (idx !== -1) {
            database[idx] = updatedEntry;
        }
        currentEditEntry = updatedEntry;

        successEl.textContent = '✅ Entry updated successfully!';
        btn.textContent = '✅ Saved';

        // Re-render the card behind the modal
        renderWord(updatedEntry);

        // Close after a moment
        setTimeout(() => closeModal(), 1200);
    })
    .catch(err => {
        errorEl.textContent = '⚠️ Network error. Is the server running?';
        btn.disabled = false;
        btn.textContent = '💾 Update';
    });
}

function closeModal() {
    const overlay = document.getElementById('modalOverlay');
    if (overlay) {
        overlay.classList.remove('active');
        setTimeout(() => overlay.remove(), 300);
    }
}

// Utility: escape HTML for textarea content
function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Utility: escape for attribute values
function escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}