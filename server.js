const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const app = express();
// Render 會自動分配 PORT，若本地執行則使用 3000
const PORT = process.env.PORT || 3000;

// ================= 中介軟體設定 (Middleware) =================
app.use(cors());
app.use(bodyParser.json());
// 設定靜態檔案資料夾 (讓 public 裡面的 html, css, js 可以被讀取)
app.use(express.static(path.join(__dirname, 'public')));

// ================= 資料庫設定 (SQLite) =================
// 建立或連接本地資料庫檔案 database.db
const db = new sqlite3.Database('./database.db', (err) => {
    if (err) {
        console.error('資料庫連接失敗:', err.message);
    } else {
        console.log('已連接到 SQLite 資料庫');
    }
});

// 初始化資料表：如果 game_records 不存在就建立
// 包含欄位：id, player_name (玩家名稱), score (分數), rating (評分), timestamp (時間)
db.run(`CREATE TABLE IF NOT EXISTS game_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_name TEXT,
    score INTEGER,
    rating INTEGER,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// ================= 一般遊戲 API =================

// 1. 取得排行榜 (前 10 名)
app.get('/api/leaderboard', (req, res) => {
    db.all("SELECT player_name, score FROM game_records ORDER BY score DESC LIMIT 10", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ data: rows });
    });
});

// 2. 提交分數與評價
app.post('/api/submit', (req, res) => {
    const { player_name, score, rating } = req.body;
    
    // 防呆：確保資料完整
    if (!player_name || score === undefined || !rating) {
        return res.status(400).json({ error: "資料不完整" });
    }

    const stmt = db.prepare("INSERT INTO game_records (player_name, score, rating) VALUES (?, ?, ?)");
    stmt.run(player_name, score, rating, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: "成績上傳成功", id: this.lastID });
    });
    stmt.finalize();
});

// ================= 後台管理 API (密碼保護) =================
// 請將密碼 '1234' 改成你自己想要的密碼

// 3. 【後台】查看資料庫所有內容 (HTML 表格模式)
// 網址: https://你的網址/admin/view-db?pwd=1234
app.get('/admin/view-db', (req, res) => {
    const password = req.query.pwd;
    if (password !== '1234') return res.status(403).send("<h1>禁止進入：密碼錯誤</h1>");

    db.all("SELECT * FROM game_records ORDER BY id DESC", [], (err, rows) => {
        if (err) return res.status(500).send("讀取錯誤: " + err.message);

        let html = `
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>資料庫後台</title>
                <style>
                    body { font-family: sans-serif; padding: 20px; background: #f4f4f9; }
                    h1 { color: #333; text-align: center; }
                    .container { max-width: 800px; margin: 0 auto; background: white; padding: 20px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { padding: 12px; border-bottom: 1px solid #ddd; text-align: center; }
                    th { background-color: #2a9d8f; color: white; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    tr:hover { background-color: #f1f1f1; }
                    .btn { display: inline-block; margin: 5px; padding: 10px 15px; text-decoration: none; color: white; border-radius: 5px; font-size: 14px; }
                    .btn-down { background-color: #3498db; }
                    .btn-del { background-color: #e74c3c; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📊 佛大學權捍衛戰 - 資料庫</h1>
                    <div style="text-align: center;">
                        <a href="/admin/download-db?pwd=${password}" class="btn btn-down">📥 下載備份 (.db)</a>
                        <a href="/api/admin/reset?pwd=${password}" class="btn btn-del" onclick="return confirm('確定要清空所有資料嗎？')">🗑️ 清空所有資料</a>
                    </div>
                    <p>目前總筆數: <b>${rows.length}</b></p>
                    <table>
                        <tr>
                            <th>ID</th>
                            <th>玩家代號</th>
                            <th>分數</th>
                            <th>評價</th>
                            <th>時間</th>
                        </tr>
        `;

        rows.forEach(row => {
            html += `
                <tr>
                    <td>${row.id}</td>
                    <td>${row.player_name}</td>
                    <td>${row.score}</td>
                    <td>${row.rating} ⭐</td>
                    <td>${row.timestamp}</td>
                </tr>
            `;
        });

        html += `</table></div></body></html>`;
        res.send(html);
    });
});

// 4. 【後台】下載資料庫檔案 (.db)
// 網址: https://你的網址/admin/download-db?pwd=1234
app.get('/admin/download-db', (req, res) => {
    const password = req.query.pwd;
    if (password !== '1234') return res.status(403).send("密碼錯誤");

    const file = path.join(__dirname, 'database.db');
    res.download(file, 'game_records_backup.db', (err) => {
        if (err) {
            console.error(err);
            res.status(500).send("找不到資料庫檔案（可能剛重啟被清空，或尚未建立）");
        }
    });
});

// 5. 【後台】清空排行榜 (危險操作)
// 網址: https://你的網址/api/admin/reset?pwd=1234
app.get('/api/admin/reset', (req, res) => {
    const password = req.query.pwd;
    if (password !== '1234') return res.status(403).json({ error: "密碼錯誤" });

    db.serialize(() => {
        db.run("DELETE FROM game_records"); // 刪除資料
        db.run("DELETE FROM sqlite_sequence WHERE name='game_records'"); // 重置 ID 計數
    });

    res.send(`
        <h1>已清空</h1>
        <p>資料庫已重置。</p>
        <a href="/admin/view-db?pwd=${password}">返回後台</a>
    `);
});

// ================= 啟動伺服器 =================
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});