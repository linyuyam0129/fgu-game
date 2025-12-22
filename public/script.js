let score = 0;
let currentTime = 30;
let timerId = null;
let gameLoopId = null;
let selectedRating = 0;
let isPlaying = false;
let currentPlayerName = "";

// 音效設定
const bgm = new Audio('sounds/bgm.mp3');
bgm.loop = true; 
const hitSound = new Audio('sounds/hit.mp3');
const wrongSound = new Audio('sounds/wrong.mp3');

function playSound(audio) {
    audio.currentTime = 0;
    audio.play().catch(() => {});
}

// 遊戲文案
const badItems = [
    "宿舍\n無理漲價", 
    "黑箱\n會議", 
    "必修\n學分過多", 
    "無理\n扣考", 
    "漠視\n學生權益", 
    "設備\n老舊不修",
    "校車\n無限誤點",
    "宿舍\n牆壁發霉",
    "學餐\n又貴又雷",
    "行政\n互踢皮球",
    "選課\n系統崩潰",
    "校車\n班次減班",
    "莫名\n行政疏失",
    "Wi-Fi\n龜速斷線"
];
const goodItems = [
    "做好事",
    "說好話",
    "存好心",
    "熱心\n助教", 
    "選課\n自由", 
    "公開\n透明", 
    "學生\n自治", 
    "友善\n校園",
    "宿舍\n全面除濕",
    "校車\n準時發車",
    "經費\n流向公開",
    "師生\n溝通順暢",
    "設備\n光速報修",
    "性別\n友善廁所",
    "學餐\n俗擱大碗",
    "申訴\n管道暢通"
];
const randomPrefixes = ["積極的", "路過的", "佛光", "熬夜的", "早八", "爭取權益的"];
const randomNouns = ["同學", "學霸", "車神", "戰士", "勇者", "代表"];

document.addEventListener("DOMContentLoaded", () => {
    fetchLeaderboard();
    setupStars();
    document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
});

function showScreen(screenId) {
    document.querySelectorAll('.screen, .full-screen-game').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function fetchLeaderboard() {
    fetch('/api/leaderboard')
        .then(res => res.json())
        .then(data => {
            const list = document.getElementById('leaderboard-list');
            if(data.data.length === 0) {
                list.innerHTML = "<li>還沒有人挑戰，快來當第一名！</li>";
                return;
            }
            list.innerHTML = data.data.map((item, index) => {
                const rankIcon = index === 0 ? '🥇 ' : (index === 1 ? '🥈 ' : (index === 2 ? '🥉 ' : `${index+1}. `));
                return `<li><span>${rankIcon}${item.player_name}</span> <span>${item.score}分</span></li>`;
            }).join('');
        })
        .catch(err => console.error(err));
}

function startGame() {
    score = 0;
    currentTime = 30;
    selectedRating = 0;
    updateStars();

    document.getElementById('score').textContent = score;
    document.getElementById('time').textContent = currentTime;
    document.getElementById('game-area').innerHTML = '';
    
    const randomPre = randomPrefixes[Math.floor(Math.random() * randomPrefixes.length)];
    const randomNoun = randomNouns[Math.floor(Math.random() * randomNouns.length)];
    const randomSuffix = Math.floor(Math.random() * 999).toString().padStart(3, '0');
    currentPlayerName = `${randomPre}${randomNoun}#${randomSuffix}`;
    document.getElementById('player-id-display').textContent = `玩家代號: ${currentPlayerName}`;

    showScreen('game-screen');
    isPlaying = true;
    
    playSound(bgm);
    timerId = setInterval(countDown, 1000);
    gameLoop();
}

function countDown() {
    currentTime--;
    document.getElementById('time').textContent = currentTime;
    if (currentTime <= 0) {
        gameOver();
    }
}

function gameOver() {
    clearInterval(timerId);
    clearTimeout(gameLoopId);
    isPlaying = false;
    bgm.pause();
    bgm.currentTime = 0;
    
    document.getElementById('final-score').textContent = score;
    document.getElementById('game-area').innerHTML = '';
    showScreen('result-screen');
}

function gameLoop() {
    if (!isPlaying) return;
    spawnTarget();
    const nextSpawnTime = Math.random() * (800 - (30 - currentTime) * 15) + 300; 
    gameLoopId = setTimeout(gameLoop, Math.max(300, nextSpawnTime));
}

function spawnTarget() {
    const gameArea = document.getElementById('game-area');
    const targetSize = 100;
    const maxWidth = window.innerWidth - targetSize;
    const maxHeight = window.innerHeight - targetSize - 80;
    const safeTopMargin = 80;

    const randomX = Math.random() * maxWidth;
    const randomY = Math.random() * maxHeight + safeTopMargin;

    const isBad = Math.random() > 0.35; 
    const text = isBad 
        ? badItems[Math.floor(Math.random() * badItems.length)] 
        : goodItems[Math.floor(Math.random() * goodItems.length)];

    const mole = document.createElement('div');
    mole.classList.add('target-mole');
    mole.classList.add(isBad ? 'bad' : 'good');
    mole.innerText = text;
    mole.style.left = `${randomX}px`;
    mole.style.top = `${randomY}px`;

    let isClicked = false;

    const clickHandler = (e) => {
        e.preventDefault(); 
        if(isClicked) return;
        isClicked = true;
        mole.classList.add('hit');

        if (isBad) {
            score += 10;
            mole.innerText = "💥\n捍衛成功!";
            playSound(hitSound);
        } else {
            score -= 15;
            mole.innerText = "❌\n那是好的!";
            playSound(wrongSound);
        }
        document.getElementById('score').textContent = score;
        setTimeout(() => { if(mole.parentNode) mole.remove(); }, 200);
    };

    mole.addEventListener('mousedown', clickHandler);
    mole.addEventListener('touchstart', clickHandler);

    gameArea.appendChild(mole);

    const disappearTime = Math.random() * 1500 + 800;
    setTimeout(() => {
        if (mole.parentNode && !isClicked) {
            mole.style.opacity = 0;
            setTimeout(()=> { if(mole.parentNode) mole.remove(); }, 200);
        }
    }, disappearTime);
}

function setupStars() {
    const stars = document.querySelectorAll('#star-container span');
    stars.forEach(star => {
        star.addEventListener('click', (e) => {
            selectedRating = parseInt(e.target.dataset.value); // 確保轉成數字
            updateStars();
        });
    });
    updateStars();
}

function updateStars() {
    const stars = document.querySelectorAll('#star-container span');
    stars.forEach(star => {
        // 只有當星星的值 <= 選擇的值，且選擇的值大於0時才亮
        star.classList.toggle('selected', parseInt(star.dataset.value) <= selectedRating && selectedRating > 0);
    });
}

function submitAndHome() {
    // 【修改3】加入防呆檢查
    if (selectedRating === 0) {
        alert("覺得好玩嗎？請點擊星星給我們一個評價喔！⭐");
        return; // 這裡直接結束函式，不讓它往下執行
    }

    const btn = document.querySelector('#result-screen .btn-primary');
    btn.disabled = true;
    btn.innerText = "上傳中...";

    fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_name: currentPlayerName, score: score, rating: selectedRating })
    })
    .then(res => res.json())
    .then(() => {
        fetchLeaderboard();
        showScreen('home-screen');
    })
    .catch(err => alert("上傳失敗"))
    .finally(() => {
        btn.disabled = false;
        btn.innerText = "送出成績並返回";
    });
}