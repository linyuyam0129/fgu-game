const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ================= 環境變數與密碼設定 =================
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';

// 🔴 修改重點 1：將防禦外掛的「天花板」設為 450 分
const MAX_POSSIBLE_SCORE = 450; 

// 🔴 修改重點 2：後台一鍵掃除的標準也設為 450 分
const CHEAT_THRESHOLD = 450;

// ================= 中介軟體設定 =================
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// ================= 資料庫設定 =================
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) console.error('資料庫連接失敗:', err.message);
    else console.log('已連接到 SQLite 資料庫');
});

// 初始化資料表
db.run(`CREATE TABLE IF NOT EXISTS game_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT,
    score INTEGER,
    rating INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// ================= 遊戲 API =================

// 1. 取得排行榜 (前 10 名)
app.get('/api/leaderboard', (req, res) => {
    db.all("SELECT player_name, score FROM game_records ORDER BY score DESC LIMIT 10", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ data: rows });
    });
});

// 2. 提交分數 (含防外掛檢查)
app.post('/api/submit', (req, res) => {
    const { player_name, score, rating } = req.body;

    if (!player_name || score === undefined || !rating) {
        return res.status(400).json({ error: "資料不完整" });
    }

    // 🔴 檢查：超過 450 分直接擋掉
    if (score > MAX_POSSIBLE_SCORE) {
        console.log(`🚨 攔截作弊: ${player_name} 嘗試上傳 ${score} 分`);
        return res.status(400).json({ error: "分數異常，系統判定為外掛，拒絕寫入！" });
    }

    const stmt = db.prepare("INSERT INTO game_records (player_name, score, rating) VALUES (?, ?, ?)");
    stmt.run(player_name, score, rating, function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "成績上傳成功", id: this.lastID });
    });
    stmt.finalize();
});

// ================= 後台管理 API =================

// 3. 【後台】查看資料
app.get('/admin/view-db', (req, res) => {
    const password = req.query.pwd;
    if (password !== ADMIN_PASSWORD) return res.status(403).send("<h1>🔒 密碼錯誤</h1>");

    db.all("SELECT * FROM game_records ORDER BY score DESC", [], (err, rows) => {
        if (err) return res.status(500).send("讀取錯誤: " + err.message);

        let html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>後台管理</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; background: #f4f4f9; }
                    .container { max-width: 900px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    h1 { text-align: center; color: #2c3e50; }
                    .btn { display: inline-block; padding: 8px 12px; margin: 5px; text-decoration: none; color: white; border-radius: 5px; font-size: 14px; cursor: pointer;}
                    .btn-down { background-color: #3498db; }
                    .btn-clean { background-color: #e67e22; }
                    .btn-del { background-color: #e74c3c; font-weight: bold; }
                    .btn-del:hover { background-color: #c0392b; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: center; }
                    th { background-color: #2a9d8f; color: white; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    tr:hover { background-color: #f1f1f1; }
                    .cheat-score { color: #e74c3c; font-weight: bold; } /* 外掛分數標紅 */
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>🛡️ 佛大學權 - 後台管理</h1>
                    <div style="text-align: center; margin-bottom: 15px;">
                        <a href="/admin/download-db?pwd=${password}" class="btn btn-down">📥 下載資料庫 (.db)</a>
                        <a href="/api/admin/clean-cheaters?pwd=${password}" class="btn btn-clean" onclick="return confirm('確定要刪除所有超過 ${CHEAT_THRESHOLD} 分的紀錄嗎？')">🧹 一鍵掃除外掛 (>=${CHEAT_THRESHOLD}分)</a>
                        <a href="/api/admin/reset?pwd=${password}" class="btn btn-del" onclick="return confirm('⚠️ 警告：確定要清空「全部」資料嗎？')">🗑️ 清空所有資料</a>
                    </div>
                    
                    <p>目前總筆數: <b>${rows.length}</b></p>
                    
                    <table>
                        <tr>
                            <th>排名</th>
                            <th>玩家名稱</th>
                            <th>分數</th>
                            <th>評價</th>
                            <th>時間</th>
                            <th>操作</th>
                        </tr>
        `;

        rows.forEach((row, index) => {
            // 🔴 如果是舊資料且超過 450 分，標示為紅色
            const scoreClass = row.score >= CHEAT_THRESHOLD ? 'cheat-score' : '';
            
            html += `
                <tr>
                    <td>${index + 1}</td>
                    <td>${row.player_name}</td>
                    <td class="${scoreClass}">${row.score}</td>
                    <td>${row.rating} ⭐</td>
                    <td style="font-size: 12px; color: #777;">${row.timestamp}</td>
                    <td>
                        <a href="/api/admin/delete/${row.id}?pwd=${password}" 
                           class="btn btn-del" 
                           onclick="return confirm('確定要刪除 ${row.player_name} (${row.score}分) 嗎？')">
                           ❌ 刪除
                        </a>
                    </td>
                </tr>
            `;
        });

        html += `</table></div></body></html>`;
        res.send(html);
    });
});

// 4. 【後台】單筆刪除 API
app.get('/api/admin/delete/:id', (req, res) => {
    const password = req.query.pwd;
    if (password !== ADMIN_PASSWORD) return res.status(403).send("密碼錯誤");

    const id = req.params.id;
    db.run("DELETE FROM game_records WHERE id = ?", id, (err) => {
        if (err) return res.status(500).send("刪除失敗");
        res.redirect(`/admin/view-db?pwd=${password}`);
    });
});

// 5. 【後台】一鍵掃除外掛 (分數 >= 450)
app.get('/api/admin/clean-cheaters', (req, res) => {
    const password = req.query.pwd;
    if (password !== ADMIN_PASSWORD) return res.status(403).send("密碼錯誤");

    // 🔴 執行 SQL 刪除 450 分以上
    db.run("DELETE FROM game_records WHERE score >= ?", [CHEAT_THRESHOLD], function(err) {
        if (err) return res.status(500).send(err.message);
        res.send(`<h1>已掃除 ${this.changes} 筆外掛資料 (>=${CHEAT_THRESHOLD}分)！</h1><a href="/admin/view-db?pwd=${password}">回後台</a>`);
    });
});

// 6. 【後台】下載資料庫
app.get('/admin/download-db', (req, res) => {
    if (req.query.pwd !== ADMIN_PASSWORD) return res.status(403).send("密碼錯誤");
    res.download(path.join(__dirname, 'database.db'), 'backup.db');
});

// 7. 【後台】清空全部
app.get('/api/admin/reset', (req, res) => {
    if (req.query.pwd !== ADMIN_PASSWORD) return res.status(403).send("密碼錯誤");
    db.serialize(() => {
        db.run("DELETE FROM game_records");
        db.run("DELETE FROM sqlite_sequence WHERE name='game_records'");
    });
    res.send('已清空。<a href="/admin/view-db?pwd=' + ADMIN_PASSWORD + '">回後台</a>');
});

// ================= 啟動伺服器 =================
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
