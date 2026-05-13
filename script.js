// Local search against the database array from database.js
const searchInput = document.getElementById('searchInput');
const viewport = document.getElementById('mainViewport');
const resultArea = document.getElementById('result-area');

let debounceTimeout = null;

// Listen for typing
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();

    if (query.length > 0) {
        viewport.classList.add('searching');

        // Debounce
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

    // Exact / starts-with match first
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

    // Broader partial matches
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

            ${data.audio_url ? `<button class="audio-btn" onclick="new Audio('${data.audio_url}').play()">🔊 Listen</button>` : ''}

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