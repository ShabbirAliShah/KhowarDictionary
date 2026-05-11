const searchInput = document.getElementById('searchInput');
const viewport = document.getElementById('mainViewport');
const resultArea = document.getElementById('result-area');

// Listen for typing
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    
    if (query.length > 0) {
        viewport.classList.add('searching');
        performSearch(query);
    } else {
        viewport.classList.remove('searching');
        resultArea.innerHTML = "";
    }
});

function performSearch(query) {
    // Search Word, Script, and Meaning
    const results = dictionary.filter(item => 
        item.word.toLowerCase().includes(query) || 
        item.khowar_script.includes(query) || 
        item.meaning.toLowerCase().includes(query)
    );

    if (results.length > 0) {
        renderWord(results[0]);
    } else {
        findSuggestion(query);
    }
}

function findSuggestion(query) {
    const suggestion = dictionary.find(item => 
        item.word.toLowerCase().startsWith(query.substring(0, 2))
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
    performSearch(word.toLowerCase());
}

function renderWord(data) {
    resultArea.innerHTML = `
        <div class="card">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 20px;">
                <div>
                    <h1 style="margin:0; font-size: 2.2rem; color: #1a1a1a;">${data.word}</h1>
                    <p style="color:var(--accent); font-style:italic; margin: 5px 0;">${data.grammar}</p>
                </div>
                <div class="khowar-script">${data.khowar_script}</div>
            </div>

            ${data.audio_url ? `<button class="audio-btn" onclick="new Audio('${data.audio_url}').play()">🔊 Listen</button>` : ''}

            <span class="label">English Meaning</span>
            <p style="font-size:1.2rem; margin: 10px 0; line-height: 1.5;">${data.meaning}</p>

            <span class="label">Khowar Example</span>
            <p class="khowar-script" style="font-size: 1.4rem; margin: 10px 0;">${data.example_khowar}</p>
            
            <span class="label">Translation</span>
            <p style="color: #666; margin: 10px 0;"><em>${data.example_english}</em></p>
        </div>
    `;
}