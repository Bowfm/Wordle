/* ==========================================
   WORDLE CLONE - GAME LOGIC
   ========================================== */


// ─── Game Constants ────────────────────────
const MAX_GUESSES = 6;
const WORD_LENGTH = 5;
const FLIP_DELAY = 300;       // ms between each tile flip
const BOUNCE_DELAY = 100;     // ms between each tile bounce on win

// ─── Game State ────────────────────────────
let targetWord = "";
let currentRow = 0;
let currentCol = 0;
let currentGuess = "";
let gameOver = false;
let isProcessing = false;
let currentScore = 0;
let currentStreak = 0;
let currentGameMode = null;
let bestScore = parseInt(localStorage.getItem("wordleBestScore") || "0");
let bestStreak = parseInt(localStorage.getItem("wordleBestStreak") || "0");

// ─── DOM References ────────────────────────
const notificationEl = document.getElementById("notification-message");
const gridEl = document.getElementById("guess-grid");
const scoreEl = document.getElementById("score-value");
const streakEl = document.getElementById("streak-value");
const inGameActionContainer = document.getElementById("in-game-action-container");
const inGameActionBtn = document.getElementById("in-game-action-btn");

// ─── Initialize Game / Reset ───────────────────────
function resetBoard() {
    // Pick a word based on mode
    const savedClassicWord = localStorage.getItem("wordleClassicTargetWord");

    if (currentGameMode === "daily") {
        const now = new Date();
        const epochDays = Math.floor((now.getTime() - (now.getTimezoneOffset() * 60000)) / 86400000);
        const index = ANSWERS.length > 0 ? epochDays % ANSWERS.length : 0;
        targetWord = ANSWERS.length > 0 ? ANSWERS[index].toUpperCase() : "HELLO";
    } else if (currentGameMode === "classic" && savedClassicWord) {
        targetWord = savedClassicWord;
    } else {
        const randomWord = ANSWERS.length > 0 ? ANSWERS[Math.floor(Math.random() * ANSWERS.length)] : "HELLO";
        targetWord = randomWord.toUpperCase();
    }

    currentRow = 0;
    currentCol = 0;
    currentGuess = "";
    gameOver = false;
    isProcessing = false;
    inGameActionContainer.style.display = "none";

    // Reset tiles
    document.querySelectorAll("#guess-grid .grid-tile").forEach(tile => {
        tile.textContent = "";
        tile.removeAttribute("data-state");
        tile.classList.remove("flip", "bounce");
    });

    // Reset rows
    document.querySelectorAll("#guess-grid .grid-row").forEach(row => {
        row.classList.remove("shake");
    });

    // Reset keyboard
    document.querySelectorAll("#keyboard .key").forEach(key => {
        key.removeAttribute("data-state");
    });

    // Clear keyboard state
    for (let key in keyboardState) {
        delete keyboardState[key];
    }

    document.getElementById("classic-answer").style.display = "none";

    console.log("🟩 New game started. (Hint: check targetWord)");
}

// ─── Notification System ───────────────────
let notificationTimeout = null;

function showNotification(message, duration = 1500) {
    clearTimeout(notificationTimeout);
    notificationEl.textContent = message;
    notificationEl.classList.add("show");

    if (duration > 0) {
        notificationTimeout = setTimeout(() => {
            notificationEl.classList.remove("show");
        }, duration);
    }
}

// ─── Input Handling ────────────────────────
function handleKeyPress(key) {
    if (gameOver) return;

    if (key === "Enter") {
        submitGuess();
    } else if (key === "Backspace") {
        deleteLetter();
    } else if (/^[A-Z]$/.test(key)) {
        addLetter(key);
    }
}

function addLetter(letter) {
    if (currentCol >= WORD_LENGTH) return;

    const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
    tile.textContent = letter;
    tile.setAttribute("data-state", "tbd");
    currentGuess += letter;
    currentCol++;
}

function deleteLetter() {
    if (currentCol <= 0) return;

    currentCol--;
    const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
    tile.textContent = "";
    tile.removeAttribute("data-state");
    currentGuess = currentGuess.slice(0, -1);
}

// ─── Guess Evaluation ──────────────────────
function submitGuess(isInstant = false) {
    if (currentGuess.length < WORD_LENGTH) {
        if (!isInstant) {
            shakeRow(currentRow);
            showNotification("Not enough letters");
        }
        return;
    }

    isProcessing = true;

    // Check if the word exists in the word list
    const guessLower = currentGuess.toLowerCase();
    if (ANSWERS.length > 0 || GUESSES.length > 0) {
        if (!GUESSES.includes(guessLower) && !ANSWERS.includes(guessLower)) {
            if (!isInstant) {
                shakeRow(currentRow);
                showNotification("Word not found");
                setTimeout(() => {
                    isProcessing = false;
                }, 600);
            } else {
                isProcessing = false;
            }
            return;
        }
    }

    // Evaluate guess
    const evaluation = evaluateGuess(currentGuess, targetWord);
    revealTiles(currentRow, evaluation, isInstant);
}

function evaluateGuess(guess, target) {
    const result = Array(WORD_LENGTH).fill("absent");
    const targetLetters = target.split("");
    const guessLetters = guess.split("");

    // First pass: find correct positions
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guessLetters[i] === targetLetters[i]) {
            result[i] = "correct";
            targetLetters[i] = null; // Mark as used
            guessLetters[i] = null;
        }
    }

    // Second pass: find present letters
    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guessLetters[i] === null) continue;

        const targetIndex = targetLetters.indexOf(guessLetters[i]);
        if (targetIndex !== -1) {
            result[i] = "present";
            targetLetters[targetIndex] = null; // Mark as used
        }
    }

    return result;
}

// ─── Tile Animation ────────────────────────
function revealTiles(row, evaluation, isInstant = false) {
    const tiles = [];
    for (let col = 0; col < WORD_LENGTH; col++) {
        tiles.push(document.getElementById(`tile-${row}-${col}`));
    }

    const currentGuessCopy = currentGuess; // Store current guess before reset

    if (isInstant) {
        tiles.forEach((tile, index) => {
            tile.textContent = currentGuessCopy[index];
            tile.setAttribute("data-state", evaluation[index]);
            updateKeyboard(currentGuessCopy[index], evaluation[index]);
        });
        finishReveal(row, evaluation, isInstant, currentGuessCopy);
    } else {
        tiles.forEach((tile, index) => {
            setTimeout(() => {
                tile.classList.add("flip");
                setTimeout(() => {
                    tile.setAttribute("data-state", evaluation[index]);
                }, 250);
            }, index * FLIP_DELAY);
        });

        const totalFlipTime = WORD_LENGTH * FLIP_DELAY + 500;
        setTimeout(() => {
            const guessLetters = currentGuessCopy.split("");
            guessLetters.forEach((letter, index) => {
                updateKeyboard(letter, evaluation[index]);
            });
            finishReveal(row, evaluation, isInstant, currentGuessCopy);
        }, totalFlipTime);
    }
}

function finishReveal(row, evaluation, isInstant, guess) {
    // Check for win
    if (evaluation.every(e => e === "correct")) {
        handleWin(row, isInstant);
        isProcessing = false;
        return;
    }

    // Check for loss
    if (row === MAX_GUESSES - 1) {
        handleLoss(isInstant);
        isProcessing = false;
        return;
    }

    // Advance to next row
    currentRow++;
    currentCol = 0;
    currentGuess = "";
    isProcessing = false;
}

function shakeRow(row) {
    const rowEl = document.getElementById(`row-${row}`);
    rowEl.classList.remove("shake");
    // Trigger reflow so the animation restarts
    void rowEl.offsetWidth;
    rowEl.classList.add("shake");
}

// ─── Keyboard State Management ─────────────
const keyboardState = {};

function updateKeyboard(letter, state) {
    const keyEl = document.getElementById(`key-${letter}`);
    if (!keyEl) return;

    const currentState = keyboardState[letter];

    // Priority: correct > present > absent
    const priority = { correct: 3, present: 2, absent: 1 };

    if (!currentState || priority[state] > priority[currentState]) {
        keyboardState[letter] = state;
        keyEl.setAttribute("data-state", state);
    }
}

// ─── Stats UI Update ───────────────────────
function updateStatsUI() {
    scoreEl.textContent = currentScore;
    streakEl.textContent = currentStreak;

    scoreEl.classList.add("updated");
    streakEl.classList.add("updated");

    setTimeout(() => {
        scoreEl.classList.remove("updated");
        streakEl.classList.remove("updated");
    }, 300);
}

// ─── Win / Loss Handlers ───────────────────
const WIN_MESSAGES = [
    "Genius!",       // 1 guess
    "Magnificent!",  // 2 guesses
    "Impressive!",   // 3 guesses
    "Splendid!",     // 4 guesses
    "Great!",        // 5 guesses
    "Phew!"          // 6 guesses
];

function handleWin(row, isInstant = false) {
    gameOver = true;

    let isNewBestScore = false;
    let isNewBestStreak = false;

    if (currentGameMode === "classic") {
        currentStreak++;
        currentScore += (MAX_GUESSES - row);

        if (currentStreak > bestStreak) {
            bestStreak = currentStreak;
            localStorage.setItem("wordleBestStreak", bestStreak);
            isNewBestStreak = true;
        }

        if (currentScore > bestScore) {
            bestScore = currentScore;
            localStorage.setItem("wordleBestScore", bestScore);
            isNewBestScore = true;
        }

        if (!isInstant) {
            const guesses = [];
            for (let r = 0; r <= row; r++) {
                let guess = "";
                for (let c = 0; c < WORD_LENGTH; c++) {
                    guess += document.getElementById(`tile-${r}-${c}`).textContent;
                }
                guesses.push(guess);
            }
            localStorage.setItem("wordleClassicGuesses", JSON.stringify(guesses));
            localStorage.setItem("wordleClassicStatus", "win");
            localStorage.setItem("wordleClassicTargetWord", targetWord);
        }
    } else if (currentGameMode === "daily" && !isInstant) {
        const guesses = [];
        for (let r = 0; r <= row; r++) {
            let guess = "";
            for (let c = 0; c < WORD_LENGTH; c++) {
                guess += document.getElementById(`tile-${r}-${c}`).textContent;
            }
            guesses.push(guess);
        }
        localStorage.setItem("wordleDailyLastPlayed", new Date().toDateString());
        localStorage.setItem("wordleDailyGuesses", JSON.stringify(guesses));
        localStorage.setItem("wordleDailyStatus", "win");
    }

    updateStatsUI();

    if (!isInstant) {
        // Bounce tiles
        for (let col = 0; col < WORD_LENGTH; col++) {
            const tile = document.getElementById(`tile-${row}-${col}`);
            setTimeout(() => {
                tile.classList.add("bounce");
            }, col * BOUNCE_DELAY);
        }

        setTimeout(() => {
            showGameOverModal(true, currentScore, currentStreak, isNewBestScore, isNewBestStreak);
        }, WORD_LENGTH * BOUNCE_DELAY + 400);
    }
}

function handleLoss(isInstant = false) {
    gameOver = true;

    let finalScore = currentScore;
    let finalStreak = currentStreak;

    if (currentGameMode === "daily" && !isInstant) {
        const guesses = [];
        for (let r = 0; r < MAX_GUESSES; r++) {
            let guess = "";
            for (let c = 0; c < WORD_LENGTH; c++) {
                guess += document.getElementById(`tile-${r}-${c}`).textContent;
            }
            guesses.push(guess);
        }
        localStorage.setItem("wordleDailyLastPlayed", new Date().toDateString());
        localStorage.setItem("wordleDailyGuesses", JSON.stringify(guesses));
        localStorage.setItem("wordleDailyStatus", "loss");
    } else if (currentGameMode === "classic") {
        // Reset Stats
        currentStreak = 0;
        currentScore = 0;
        updateStatsUI();

        if (!isInstant) {
            const guesses = [];
            for (let r = 0; r < MAX_GUESSES; r++) {
                let guess = "";
                for (let c = 0; c < WORD_LENGTH; c++) {
                    guess += document.getElementById(`tile-${r}-${c}`).textContent;
                }
                guesses.push(guess);
            }
            localStorage.setItem("wordleClassicGuesses", JSON.stringify(guesses));
            localStorage.setItem("wordleClassicStatus", "loss");
            localStorage.setItem("wordleClassicTargetWord", targetWord);
        }
    }

    if (!isInstant) {
        showGameOverModal(false, finalScore, finalStreak, false, false);
    }
}

// ─── Event Listeners ───────────────────────

// Physical keyboard
document.addEventListener("keydown", (e) => {
    if (isProcessing || gameOver) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    let key = e.key;
    if (key === "Enter" || key === "Backspace") {
        handleKeyPress(key);
    } else if (/^[a-zA-Z]$/.test(key)) {
        handleKeyPress(key.toUpperCase());
    }
});

// Virtual keyboard
document.getElementById("keyboard").addEventListener("click", (e) => {
    if (isProcessing || gameOver) return;
    const keyButton = e.target.closest(".key");
    if (!keyButton) return;

    const key = keyButton.dataset.key;
    if (key) {
        handleKeyPress(key === "Enter" || key === "Backspace" ? key : key.toUpperCase());
    }
});

// ─── Lobby ─────────────────────────────────
const lobbyScreen = document.getElementById("lobby-screen");
const btnClassic = document.getElementById("btn-classic");
const btnDaily = document.getElementById("btn-daily");
const backBtn = document.getElementById("back-btn");
const dailyResultModal = document.getElementById("daily-result-modal");
const dailyResultText = document.getElementById("daily-result-text");
const closeDailyResultBtn = document.getElementById("close-daily-result");

function showLobby() {
    backBtn.style.display = "none";
    dailyResultModal.style.display = "none";
    lobbyScreen.classList.add("visible");

    const todayObj = new Date();
    const today = todayObj.toDateString();
    document.getElementById("lobby-daily-date").textContent = todayObj.getDate() + "/" + (todayObj.getMonth() + 1) + "/" + todayObj.getFullYear();

    const status = localStorage.getItem("wordleDailyStatus");
    const lastPlayed = localStorage.getItem("wordleDailyLastPlayed");
    const dailyBtn = document.getElementById("btn-daily");
    const dailyIcon = document.getElementById("daily-status-icon");

    if (lastPlayed === today && status === "win") {
        dailyBtn.classList.add("won");
        dailyIcon.style.display = "inline";
    } else {
        dailyBtn.classList.remove("won");
        dailyIcon.style.display = "none";
    }
}

function startGame(mode) {
    if (currentGameMode === mode && !gameOver) {
        lobbyScreen.classList.remove("visible");
        backBtn.style.display = "flex";
        return;
    }

    currentGameMode = mode;
    lobbyScreen.classList.remove("visible");
    backBtn.style.display = "flex";

    resetBoard();

    if (mode === "daily") {
        document.getElementById("classic-stats").style.display = "none";
        document.getElementById("daily-stats").style.display = "flex";
        const todayObj = new Date();
        document.getElementById("daily-date-value").textContent = todayObj.getDate() + "/" + (todayObj.getMonth() + 1) + "/" + todayObj.getFullYear();
        
        const guesses = JSON.parse(localStorage.getItem("wordleDailyGuesses") || "[]");
        guesses.forEach(guess => {
            currentGuess = guess;
            submitGuess(true);
        });
    } else if (mode === "classic") {
        document.getElementById("classic-stats").style.display = "flex";
        document.getElementById("daily-stats").style.display = "none";

        const guesses = JSON.parse(localStorage.getItem("wordleClassicGuesses") || "[]");
        guesses.forEach(guess => {
            currentGuess = guess;
            submitGuess(true);
        });
    }
}

btnClassic.addEventListener("click", () => {
    const status = localStorage.getItem("wordleClassicStatus");
    startGame("classic");
    if (status === "win" || status === "loss") {
        inGameActionBtn.textContent = status === "win" ? "Next" : "Start Over";
        inGameActionBtn.style.background = "rgba(83, 141, 78, 1)";
        inGameActionContainer.style.display = "flex";
        gameOver = true;

        if (status === "loss") {
            const classicAnswer = document.getElementById("classic-answer");
            const classicAnswerWord = document.getElementById("classic-answer-word");
            classicAnswerWord.textContent = targetWord;
            classicAnswer.style.display = "block";
        }
    }
});

// ─── Game Over Modal ───────────────────────
const gameOverModal = document.getElementById("game-over-modal");
const gomHeader = document.getElementById("gom-header");
const gomTitle = document.getElementById("gom-title");
const gomContent = document.getElementById("gom-content");
const gomBtnPrimary = document.getElementById("gom-btn-primary");
const gomBtnSecondary = document.getElementById("gom-btn-secondary");

function showGameOverModal(isWin, finalScore, finalStreak, isNewBestScore, isNewBestStreak) {
    gomHeader.classList.remove("win", "loss");
    gomHeader.classList.add(isWin ? "win" : "loss");

    gomContent.innerHTML = "";
    gomBtnPrimary.style.display = "none";
    gomBtnSecondary.style.display = "none";

    if (currentGameMode === "classic") {
        if (isWin) {
            gomTitle.textContent = "You Won 😊";
            gomContent.innerHTML = `
                <div style="display: flex; justify-content: space-between; gap: 15px;">
                    <div style="flex: 1; background: var(--bg-secondary); padding: 15px 10px; border-radius: 10px; border: 1px solid var(--border-default);">
                        <div style="font-size: 0.85rem; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Score</div>
                        <div style="font-size: 1.8rem; font-weight: bold; color: var(--color-correct);">${finalScore}</div>
                        ${isNewBestScore ? '<div style="font-size: 0.85rem; color: var(--color-correct); margin-top: 8px; font-weight: bold;">New Best Score!</div>' : `<div style="font-size: 0.8rem; color: var(--color-text-dim); margin-top: 5px;">Best: ${bestScore}</div>`}
                    </div>
                    <div style="flex: 1; background: var(--bg-secondary); padding: 15px 10px; border-radius: 10px; border: 1px solid var(--border-default);">
                        <div style="font-size: 0.85rem; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Streak</div>
                        <div style="font-size: 1.8rem; font-weight: bold; color: var(--color-correct);">${finalStreak}</div>
                        ${isNewBestStreak ? '<div style="font-size: 0.85rem; color: var(--color-correct); margin-top: 8px; font-weight: bold;">New Best Streak!</div>' : `<div style="font-size: 0.8rem; color: var(--color-text-dim); margin-top: 5px;">Best: ${bestStreak}</div>`}
                    </div>
                </div>
            `;
            gomBtnPrimary.textContent = "Next";
            gomBtnPrimary.style.display = "flex";
            gomBtnPrimary.onclick = () => {
                localStorage.removeItem("wordleClassicGuesses");
                localStorage.removeItem("wordleClassicStatus");
                localStorage.removeItem("wordleClassicTargetWord");
                gameOverModal.style.display = "none";
                resetBoard();
            };
        } else {
            gomTitle.textContent = "You Lost 😢";
            gomContent.innerHTML = `
                <div style="margin-bottom: 25px; font-size: 1.1rem;">
                    The word was:<br>
                    <strong style="font-size: 2.2rem; color: var(--color-text); letter-spacing: 4px; display: inline-block; margin-top: 10px; text-transform: uppercase;">${targetWord}</strong>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 15px;">
                    <div style="flex: 1; background: var(--bg-secondary); padding: 15px 10px; border-radius: 10px; border: 1px solid var(--border-default);">
                        <div style="font-size: 0.85rem; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Score</div>
                        <div style="font-size: 1.8rem; font-weight: bold;">${finalScore}</div>
                        <div style="font-size: 0.8rem; color: var(--color-text-dim); margin-top: 5px;">Best: ${bestScore}</div>
                    </div>
                    <div style="flex: 1; background: var(--bg-secondary); padding: 15px 10px; border-radius: 10px; border: 1px solid var(--border-default);">
                        <div style="font-size: 0.85rem; color: var(--color-text-dim); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px;">Streak</div>
                        <div style="font-size: 1.8rem; font-weight: bold;">${finalStreak}</div>
                        <div style="font-size: 0.8rem; color: var(--color-text-dim); margin-top: 5px;">Best: ${bestStreak}</div>
                    </div>
                </div>
            `;
            gomBtnPrimary.textContent = "Start Over";
            gomBtnPrimary.style.display = "flex";
            gomBtnPrimary.onclick = () => {
                localStorage.removeItem("wordleClassicGuesses");
                localStorage.removeItem("wordleClassicStatus");
                localStorage.removeItem("wordleClassicTargetWord");
                gameOverModal.style.display = "none";
                resetBoard();
            };
        }
    } else if (currentGameMode === "daily") {
        if (isWin) {
            gomTitle.textContent = "You Won 😊";
            gomContent.innerHTML = `
                <div style="font-size: 1.1rem; margin-bottom: 10px;">
                    Today's word is:<br>
                    <strong style="font-size: 2.5rem; color: var(--color-correct); letter-spacing: 4px; display: inline-block; margin-top: 15px; text-transform: uppercase;">${targetWord}</strong>
                </div>
            `;
        } else {
            gomTitle.textContent = "You Lost 😢";
            gomContent.innerHTML = `
                <div style="margin-bottom: 25px; font-size: 1.1rem;">
                    You didn't get it this time. Try again to solve today's puzzle!
                </div>
            `;

            gomBtnPrimary.textContent = "Try Again";
            gomBtnPrimary.style.display = "flex";
            gomBtnPrimary.onclick = () => {
                localStorage.removeItem("wordleDailyLastPlayed");
                localStorage.removeItem("wordleDailyGuesses");
                localStorage.removeItem("wordleDailyStatus");
                gameOverModal.style.display = "none";
                resetBoard();
            };
        }
    }

    // Shared Close Button Behavior
    gomBtnSecondary.textContent = "Close";
    gomBtnSecondary.style.display = "flex";
    gomBtnSecondary.onclick = () => {
        gameOverModal.style.display = "none";
        if (currentGameMode === "classic") {
            inGameActionBtn.textContent = isWin ? "Next" : "Start Over";
            inGameActionBtn.style.background = "rgba(83, 141, 78, 1)";
            inGameActionContainer.style.display = "flex";

            if (!isWin) {
                const classicAnswer = document.getElementById("classic-answer");
                const classicAnswerWord = document.getElementById("classic-answer-word");
                classicAnswerWord.textContent = targetWord;
                classicAnswer.style.display = "block";
            }
        } else if (currentGameMode === "daily") {
            if (isWin) {
                showLobby();
                renderDailyResultGrid();
                dailyResultModal.style.display = "flex";
                backBtn.style.display = "flex";
            } else {
                inGameActionBtn.textContent = "Try Again";
                inGameActionBtn.style.background = "rgba(83, 141, 78, 1)";
                inGameActionContainer.style.display = "flex";
            }
        }
    };

    gameOverModal.style.display = "flex";
}

const dailyResultGrid = document.getElementById("daily-result-grid");

function renderDailyResultGrid() {
    dailyResultGrid.innerHTML = "";
    const guesses = JSON.parse(localStorage.getItem("wordleDailyGuesses") || "[]");
    const status = localStorage.getItem("wordleDailyStatus");
    const retryActions = document.getElementById("daily-result-actions");
    const retryBtn = document.getElementById("daily-retry-btn");
    const resultMsg = document.getElementById("daily-result-message");
    const resultDate = document.getElementById("daily-result-date");

    const todayObj = new Date();
    if (resultDate) {
        resultDate.textContent = todayObj.getDate() + "/" + (todayObj.getMonth() + 1) + "/" + todayObj.getFullYear();
    }

    if (status === "loss") {
        resultMsg.textContent = "You didn't get it this time...";
        retryActions.style.display = "block";
        retryBtn.onclick = () => {
            localStorage.removeItem("wordleDailyLastPlayed");
            localStorage.removeItem("wordleDailyGuesses");
            localStorage.removeItem("wordleDailyStatus");
            dailyResultModal.style.display = "none";
            startGame("daily");
        };
    } else {
        resultMsg.textContent = "Come back tomorrow!";
        retryActions.style.display = "none";
    }

    // We need the daily target word to evaluate colors
    const now = new Date();
    const epochDays = Math.floor((now.getTime() - (now.getTimezoneOffset() * 60000)) / 86400000);
    const index = ANSWERS.length > 0 ? epochDays % ANSWERS.length : 0;
    const dailyWord = ANSWERS.length > 0 ? ANSWERS[index].toUpperCase() : "HELLO";

    for (let row = 0; row < MAX_GUESSES; row++) {
        const rowEl = document.createElement("div");
        rowEl.className = "grid-row";

        if (row < guesses.length) {
            const guess = guesses[row];
            const evaluation = evaluateGuess(guess, dailyWord);

            for (let col = 0; col < WORD_LENGTH; col++) {
                const tile = document.createElement("div");
                tile.className = "grid-tile";
                tile.textContent = guess[col];
                tile.setAttribute("data-state", evaluation[col]);
                rowEl.appendChild(tile);
            }
        } else {
            for (let col = 0; col < WORD_LENGTH; col++) {
                const tile = document.createElement("div");
                tile.className = "grid-tile";
                rowEl.appendChild(tile);
            }
        }

        dailyResultGrid.appendChild(rowEl);
    }
}

btnDaily.addEventListener("click", () => {
    const today = new Date().toDateString();
    const status = localStorage.getItem("wordleDailyStatus");
    
    if (localStorage.getItem("wordleDailyLastPlayed") === today) {
        if (status === "win") {
            renderDailyResultGrid();
            dailyResultModal.style.display = "flex";
            backBtn.style.display = "flex";
        } else {
            // User lost, show the board and the in-game Try Again button
            startGame("daily");
            // Since startGame re-submits guesses, the handleLoss() will eventually trigger the modal.
            // We want to immediately close it and show the in-game button.
            // However, handleLoss is called after animations. 
            // To make it feel "as it was", we can just show the button and set gameOver = true.
            inGameActionBtn.textContent = "Try Again";
            inGameActionBtn.style.background = "rgba(83, 141, 78, 1)";
            inGameActionContainer.style.display = "flex";
            gameOver = true;
            backBtn.style.display = "flex";
        }
    } else {
        startGame("daily");
    }
});

backBtn.addEventListener("click", () => {
    showLobby();
});

// ─── Start the Game ────────────────────────
showLobby();
updateStatsUI();

// ─── In-game Action Button Click ──────────
inGameActionBtn.addEventListener("click", () => {
    if (currentGameMode === "daily" && inGameActionBtn.textContent === "Try Again") {
        localStorage.removeItem("wordleDailyLastPlayed");
        localStorage.removeItem("wordleDailyGuesses");
        localStorage.removeItem("wordleDailyStatus");
    }
    if (currentGameMode === "classic") {
        localStorage.removeItem("wordleClassicGuesses");
        localStorage.removeItem("wordleClassicStatus");
        localStorage.removeItem("wordleClassicTargetWord");
    }
    resetBoard();
});

// ─── Theme Toggle ──────────────────────────
const themeToggle = document.getElementById("theme-toggle");
const iconSun = document.getElementById("icon-sun");
const iconMoon = document.getElementById("icon-moon");

themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("light-mode");
    if (document.body.classList.contains("light-mode")) {
        iconSun.style.display = "none";
        iconMoon.style.display = "block";
    } else {
        iconSun.style.display = "block";
        iconMoon.style.display = "none";
    }
});

// ─── How to Play Screen ─────────────────────
const howToPlayBtn = document.getElementById("how-to-play-btn");
const howToPlayScreen = document.getElementById("how-to-play-screen");
const iconHelp = document.getElementById("icon-help");
const iconCloseHelp = document.getElementById("icon-close-help");

function toggleHowToPlay() {
    const isVisible = howToPlayScreen.classList.toggle("visible");

    if (isVisible) {
        iconHelp.style.display = "none";
        iconCloseHelp.style.display = "block";
    } else {
        iconHelp.style.display = "block";
        iconCloseHelp.style.display = "none";
    }
}

function closeHowToPlay() {
    if (howToPlayScreen.classList.contains("visible")) {
        toggleHowToPlay();
    }
}

howToPlayBtn.addEventListener("click", toggleHowToPlay);

document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        closeHowToPlay();
    }
});
