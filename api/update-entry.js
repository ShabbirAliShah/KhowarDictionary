const crypto = require('crypto');

// Password: khowar2026 (SHA-256 hashed)
const PASSWORD_HASH = crypto.createHash('sha256').update('khowar2026').digest('hex');

// GitHub repo details
const GITHUB_OWNER = 'ShabbirAliShah';
const GITHUB_REPO = 'KhowarDictionary';
const GITHUB_FILE_PATH = 'database.js';
const GITHUB_BRANCH = 'main';

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { password, originalWord, updatedEntry } = req.body;

        // Verify password
        const inputHash = crypto.createHash('sha256').update(password || '').digest('hex');
        if (inputHash !== PASSWORD_HASH) {
            return res.status(403).json({ error: 'Incorrect password' });
        }

        // Get GitHub token from environment variable
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        if (!GITHUB_TOKEN) {
            return res.status(500).json({ error: 'GitHub token not configured on server.' });
        }

        const apiBase = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE_PATH}`;
        const headers = {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'KhowarDictionary-Editor'
        };

        // Step 1: Get current file from GitHub (need the SHA to update it)
        const getRes = await fetch(apiBase + `?ref=${GITHUB_BRANCH}`, { headers });
        if (!getRes.ok) {
            const errText = await getRes.text();
            return res.status(500).json({ error: 'Failed to fetch file from GitHub: ' + errText });
        }
        const fileData = await getRes.json();
        const currentSha = fileData.sha;

        // Step 2: Decode file content (base64 → UTF-8)
        const fileContent = Buffer.from(fileData.content, 'base64').toString('utf-8');

        // Step 3: Parse the database array
        const arrayStart = fileContent.indexOf('[');
        const arrayEnd = fileContent.lastIndexOf(']') + 1;
        const arrayStr = fileContent.substring(arrayStart, arrayEnd);

        let database;
        try {
            database = JSON.parse(arrayStr);
        } catch (e) {
            return res.status(500).json({ error: 'Failed to parse database.js' });
        }

        // Step 4: Find and update the entry
        const index = database.findIndex(entry => entry.word === originalWord);
        if (index === -1) {
            return res.status(404).json({ error: `Entry "${originalWord}" not found in database.` });
        }

        database[index] = {
            word: updatedEntry.word,
            khowar_script: updatedEntry.khowar_script,
            grammar: updatedEntry.grammar,
            meaning: updatedEntry.meaning,
            example_khowar: updatedEntry.example_khowar,
            example_english: updatedEntry.example_english,
            audio_url: updatedEntry.audio_url
        };

        // Step 5: Build new file content
        const newContent = 'const database = ' + JSON.stringify(database, null, 2) + ';\n';

        // Step 6: Commit updated file back to GitHub
        const updateRes = await fetch(apiBase, {
            method: 'PUT',
            headers: { ...headers, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: `Update entry: ${updatedEntry.word}`,
                content: Buffer.from(newContent, 'utf-8').toString('base64'),
                sha: currentSha,
                branch: GITHUB_BRANCH
            })
        });

        if (!updateRes.ok) {
            const errText = await updateRes.text();
            return res.status(500).json({ error: 'Failed to update file on GitHub: ' + errText });
        }

        return res.status(200).json({ success: true, entry: database[index] });

    } catch (err) {
        console.error('Update error:', err);
        return res.status(500).json({ error: 'Server error: ' + err.message });
    }
};
