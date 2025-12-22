// server.js
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public'))); // 讓 public 資料夾變為靜態資源

// 初始化 SQLite 資料庫
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error(err.message);
    console.log('Connected to the SQLite database.');
});

// 建立資料表 (如果不存在)
db.run(`CREATE TABLE IF NOT EXISTS game_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT,
    score INTEGER,
    rating INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// API: 取得排行榜 (分數由大到小，取前 10 名)
app.get('/api/leaderboard', (req, res) => {
    const sql = `SELECT player_name, score FROM game_records ORDER BY score DESC LIMIT 10`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// API: 提交分數與評價
app.post('/api/submit', (req, res) => {
    const { player_name, score, rating } = req.body;
    const sql = `INSERT INTO game_records (player_name, score, rating) VALUES (?, ?, ?)`;
    db.run(sql, [player_name, score, rating], function(err) {
        if (err) {
            res.status(400).json({ error: err.message });
            return;
        }
        res.json({ message: "Success", id: this.lastID });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});