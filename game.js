// Configuration du jeu
const COLORS = ['green', 'red', 'yellow', 'blue'];
const SOUND_FREQUENCIES = {
    green: 392,   // Sol
    red: 330,     // Mi
    yellow: 262,  // Do
    blue: 523     // Do aigu
};

// État du jeu
let sequence = [];
let playerSequence = [];
let level = 0;
let score = 0;
let highscore = parseInt(localStorage.getItem('simonHighscore')) || 0;
let nickname = localStorage.getItem('simonNickname') || null;
let isPlaying = false;
let isShowingSequence = false;

const API_URL = '/Antigravity/p/petit-simon/api';

// Éléments DOM
const buttons = document.querySelectorAll('.simon-btn');
const startBtn = document.getElementById('start-btn');
const scoreDisplay = document.getElementById('score');
const highscoreDisplay = document.getElementById('highscore');
const levelDisplay = document.getElementById('level');
const messageDisplay = document.getElementById('message');
const bgGlow = document.getElementById('bg-glow');

// Leaderboard DOM Elements
const highestValue = document.getElementById('highest-value');
const highestPill = document.getElementById('highest-pill');
const leaderboardModal = document.getElementById('leaderboard-modal');
const leaderboardList = document.getElementById('leaderboard-list');
const closeLeaderboard = document.getElementById('close-modal');

// Nickname DOM Elements
const nicknameModal = document.getElementById('nickname-modal');
const nicknameInput = document.getElementById('nickname-input');
const saveNicknameBtn = document.getElementById('save-nickname');
const cancelNicknameBtn = document.getElementById('cancel-nickname');

// Couleurs de lueur (RGBS)
const GLOW_COLORS = {
    green: 'rgba(34, 197, 94, 0.15)',
    red: 'rgba(239, 68, 68, 0.15)',
    yellow: 'rgba(250, 204, 21, 0.15)',
    blue: 'rgba(59, 130, 246, 0.15)',
    default: 'rgba(250, 204, 21, 0.05)'
};

// Audio Context pour les sons
let audioContext;
let audioReady = false;

async function initAudio() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // iOS Safari requires resume after user interaction
    if (audioContext.state === 'suspended') {
        try {
            await audioContext.resume();
        } catch (e) {
            console.warn('AudioContext resume failed:', e);
        }
    }
    audioReady = audioContext.state === 'running';
    return audioReady;
}

function playSound(color, duration = 300) {
    // Ensure audio context exists and is running
    if (!audioContext || audioContext.state !== 'running') {
        initAudio();
    }

    // Don't try to play if context is still not running
    if (!audioContext || audioContext.state !== 'running') {
        console.warn('AudioContext not ready, sound skipped');
        return;
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sine';
    oscillator.frequency.value = SOUND_FREQUENCIES[color];

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration / 1000);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration / 1000);
}

function playErrorSound() {
    if (!audioContext) initAudio();

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.type = 'sawtooth';
    oscillator.frequency.value = 100;

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
}

// Initialisation
function init() {
    highscoreDisplay.textContent = highscore;
    buttons.forEach(btn => {
        btn.addEventListener('click', handleButtonClick);
        btn.disabled = true;
    });
    startBtn.addEventListener('click', startGame);

    // Global Score Events
    highestPill.addEventListener('click', handleHighestClick);
    closeLeaderboard.addEventListener('click', () => leaderboardModal.classList.remove('active'));
    cancelNicknameBtn.addEventListener('click', () => nicknameModal.classList.remove('active'));
    saveNicknameBtn.addEventListener('click', handleSaveNickname);

    // Fetch initial global score
    fetchHighestScore();
}

async function fetchHighestScore() {
    try {
        const response = await fetch(`${API_URL}/scores`);
        const data = await response.json();
        if (data.highest) {
            highestValue.textContent = `${data.highest.score} - ${data.highest.nickname}`;
        } else {
            updateHighestDisplay();
        }
    } catch (e) {
        console.error('Failed to fetch highest score:', e);
        updateHighestDisplay();
    }
}

function updateHighestDisplay() {
    if (nickname) {
        highestValue.textContent = `${highscore} - ${nickname}`;
    } else {
        highestValue.textContent = '0 - share your best';
    }
}

function handleHighestClick() {
    if (!nickname || highestValue.textContent === '0 - share your best') {
        nicknameModal.classList.add('active');
        nicknameInput.value = '';
        nicknameInput.focus();
    } else {
        showLeaderboard();
    }
}

async function handleSaveNickname() {
    const newNickname = nicknameInput.value.trim();
    if (!newNickname) return;

    nickname = newNickname;
    localStorage.setItem('simonNickname', nickname);
    nicknameModal.classList.remove('active');
    updateHighestDisplay();

    // Share current highscore if exists
    if (highscore > 0) {
        await shareScore(highscore);
    }
}

async function shareScore(scoreToShare) {
    if (!nickname) return;
    try {
        await fetch(`${API_URL}/score`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nickname, score: scoreToShare })
        });
        fetchHighestScore();
    } catch (e) {
        console.error('Failed to share score:', e);
    }
}

async function showLeaderboard() {
    try {
        const response = await fetch(`${API_URL}/scores`);
        const data = await response.json();

        leaderboardList.innerHTML = '';
        data.top_15.forEach(entry => {
            const li = document.createElement('li');
            li.innerHTML = `<span class="name">${entry.nickname}</span><span class="score">${entry.score}</span>`;
            leaderboardList.appendChild(li);
        });

        leaderboardModal.classList.add('active');
    } catch (e) {
        console.error('Failed to fetch leaderboard:', e);
    }
}

async function startGame() {
    // Wait for audio to be ready before starting
    await initAudio();

    sequence = [];
    playerSequence = [];
    level = 0;
    score = 0;
    isPlaying = true;

    updateDisplay();
    setMessage('Get ready...', '');
    startBtn.disabled = true;
    startBtn.textContent = 'Playing...';

    nextRound();
}

function nextRound() {
    level++;
    playerSequence = [];

    // Ajouter une couleur aléatoire à la séquence
    const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];
    sequence.push(randomColor);

    levelDisplay.textContent = level;
    setMessage('Watch the sequence...', '');

    // Désactiver les boutons pendant la démonstration
    disableButtons();

    // Montrer la séquence après un court délai
    setTimeout(() => {
        showSequence();
    }, 500);
}

async function showSequence() {
    isShowingSequence = true;

    for (let i = 0; i < sequence.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 400));
        await flashButton(sequence[i]);
    }

    isShowingSequence = false;
    enableButtons();
    setMessage('Your turn!', 'success');
}

function flashButton(color, duration = 400) {
    return new Promise(resolve => {
        const btn = document.getElementById(`btn-${color}`);
        btn.classList.add('active');
        playSound(color, duration);

        // Background glow effect
        if (bgGlow) {
            bgGlow.style.background = `radial-gradient(circle, ${GLOW_COLORS[color]} 0%, transparent 70%)`;
        }

        setTimeout(() => {
            btn.classList.remove('active');
            if (bgGlow) {
                bgGlow.style.background = `radial-gradient(circle, ${GLOW_COLORS.default} 0%, transparent 70%)`;
            }
            resolve();
        }, duration);
    });
}

function handleButtonClick(e) {
    if (!isPlaying || isShowingSequence) return;

    const color = e.target.dataset.color;
    playerSequence.push(color);

    flashButton(color, 200);

    // Vérifier si la couleur est correcte
    const currentIndex = playerSequence.length - 1;

    if (playerSequence[currentIndex] !== sequence[currentIndex]) {
        // Erreur !
        gameOver();
        return;
    }

    // Vérifier si la séquence est complète
    if (playerSequence.length === sequence.length) {
        // Succès !
        score += level * 10;
        updateDisplay();
        disableButtons();
        setMessage('Perfect! 🎉', 'success');

        setTimeout(() => {
            nextRound();
        }, 1000);
    }
}

function gameOver() {
    isPlaying = false;
    playErrorSound();

    // Animation d'erreur sur tous les boutons
    buttons.forEach(btn => btn.classList.add('active'));
    setTimeout(() => {
        buttons.forEach(btn => btn.classList.remove('active'));
    }, 500);

    // Mettre à jour le highscore
    if (score > highscore) {
        highscore = score;
        localStorage.setItem('simonHighscore', highscore);
        highscoreDisplay.textContent = highscore;
        setMessage(`New Record: ${score}! 🏆`, 'error');

        // Auto-share if nickname registered
        if (nickname) {
            shareScore(highscore);
        } else {
            updateHighestDisplay();
        }
    } else {
        setMessage(`Game Over. Score: ${score}`, 'error');
    }

    levelDisplay.textContent = '!';

    // Réactiver le bouton start
    disableButtons();
    startBtn.disabled = false;
    startBtn.textContent = 'Retry';
}

function enableButtons() {
    buttons.forEach(btn => btn.disabled = false);
}

function disableButtons() {
    buttons.forEach(btn => btn.disabled = true);
}

function updateDisplay() {
    scoreDisplay.textContent = score;
}

function setMessage(text, type) {
    messageDisplay.textContent = text;
    messageDisplay.className = 'message';
    if (type) {
        messageDisplay.classList.add(type);
    }
}

// Démarrer le jeu
init();
