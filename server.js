const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;

// Password: khowar2026  (SHA-256 hashed)
const PASSWORD_HASH = crypto.createHash('sha256').update('khowar2026').digest('hex');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wav': 'audio/wav',
};

const server = http.createServer((req, res) => {
    // Handle API endpoint for updating entries
    if (req.method === 'POST' && req.url === '/api/update-entry') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const { password, originalWord, updatedEntry } = JSON.parse(body);

                // Verify password
                const inputHash = crypto.createHash('sha256').update(password).digest('hex');
                if (inputHash !== PASSWORD_HASH) {
                    res.writeHead(403, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Incorrect password' }));
                    return;
                }

                // Read current database.js
                const dbPath = path.join(__dirname, 'database.js');
                const dbContent = fs.readFileSync(dbPath, 'utf-8');

                // Parse the array from the file
                // database.js starts with "const database = [" and ends with "]"
                const arrayStart = dbContent.indexOf('[');
                const arrayEnd = dbContent.lastIndexOf(']') + 1;
                const arrayStr = dbContent.substring(arrayStart, arrayEnd);

                let database;
                try {
                    database = JSON.parse(arrayStr);
                } catch (parseErr) {
                    // Try eval as fallback for JS-style content
                    database = eval(arrayStr);
                }

                // Find and update the entry by original word
                const index = database.findIndex(entry => entry.word === originalWord);
                if (index === -1) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Entry not found' }));
                    return;
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

                // Write back to file
                const newContent = 'const database = ' + JSON.stringify(database, null, 2) + ';\n';
                fs.writeFileSync(dbPath, newContent, 'utf-8');

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, entry: database[index] }));

            } catch (err) {
                console.error('Update error:', err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Server error: ' + err.message }));
            }
        });
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, decodeURIComponent(filePath));

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`\n  ✅ Khowar Dictionary Server running at:\n\n     http://localhost:${PORT}\n`);
});
