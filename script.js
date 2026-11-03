// ===== Water Drop: a charity: water inspired game =====

// ----- Difficulty modes -----
// Each mode changes the goal, the time, the speed and how risky the drops are.
const DIFFICULTY = {
  easy: {
    label: "Easy", seconds: 40, goal: 15, dirtyChance: 0.15, penalty: 1,
    startDelay: 950, minDelay: 550, startFall: 5.0, minFall: 3.4,
  },
  normal: {
    label: "Normal", seconds: 30, goal: 20, dirtyChance: 0.25, penalty: 2,
    startDelay: 850, minDelay: 420, startFall: 4.4, minFall: 2.4,
  },
  hard: {
    label: "Hard", seconds: 25, goal: 30, dirtyChance: 0.35, penalty: 3,
    startDelay: 650, minDelay: 330, startFall: 3.4, minFall: 1.9,
  },
};

const CAN_CHANCE = 0.05; // chance of a golden jerry can
const CAN_POINTS = 5;
const CLEAN_POINTS = 1;

// ----- LevelUp: milestone messages (shown at a fraction of the goal) -----
const MILESTONES = [
  { at: 0.25, text: "Great start! charity: water was founded in 2006 to bring clean water to people who need it." },
  { at: 0.5, text: "Halfway there! About 2 billion people around the world still lack safely managed drinking water." },
  { at: 0.75, text: "Almost there! Many families, often women and girls, spend hours every day walking to collect water." },
  { at: 1, text: "Goal reached! Clean water changes everything: health, school, and income for a whole community." },
];

// Messages for the end of the game. One is picked at random.
const winMessages = [
  "You did it! Every drop counts, and you caught plenty.",
  "Clean water for everyone! That was an amazing round.",
  "Goal reached! You are a true water hero.",
  "Incredible catching! Communities need champions like you.",
];
const loseMessages = [
  "So close! Give it another try and catch more clean drops.",
  "Not quite there this time. Dodge the polluted drops and go again!",
  "Keep going! Every drop you catch makes a difference.",
  "Almost! Aim for the golden jerry cans, they are worth 5.",
];

// ----- Elements -----
const container = document.getElementById("game-container");
const scoreEl = document.getElementById("score");
const timeEl = document.getElementById("time");
const goalEl = document.getElementById("goal");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
const muteBtn = document.getElementById("mute-btn");
const messageEl = document.getElementById("message");
const progressBar = document.getElementById("progress-bar");
const endScreen = document.getElementById("end-screen");
const endTitle = document.getElementById("end-title");
const endText = document.getElementById("end-text");
const finalScoreEl = document.getElementById("final-score");
const bestScoreEl = document.getElementById("best-score");
const playAgainBtn = document.getElementById("play-again");
const modeInfoEl = document.getElementById("mode-info");
const penaltyLabel = document.getElementById("penalty-label");
const modeInputs = document.querySelectorAll('input[name="difficulty"]');

// ----- Game state -----
let mode = "normal";
let cfg = DIFFICULTY[mode];
let gameRunning = false;
let score = 0;
let timeLeft = cfg.seconds;
let dropTimer; // setTimeout id for the next drop
let countdownTimer; // setInterval id for the clock
let milestonesHit = [];

// ----- LevelUp: sound effects (made with the Web Audio API, no audio files needed) -----
let audioCtx = null;
let muted = false;

function getAudio() {
  if (muted) return null;
  try {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  } catch (err) {
    return null;
  }
}

// Plays one short tone
function tone(freq, duration, type, volume, delay) {
  const ctx = getAudio();
  if (!ctx) return;
  const start = ctx.currentTime + (delay || 0);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freq, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume || 0.15, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

const sounds = {
  collect() { tone(660, 0.12, "sine", 0.15); tone(880, 0.14, "sine", 0.12, 0.07); },
  dirty() { tone(160, 0.25, "sawtooth", 0.12); tone(110, 0.3, "sawtooth", 0.1, 0.08); },
  can() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, "triangle", 0.14, i * 0.07)); },
  click() { tone(500, 0.07, "square", 0.06); },
  win() { [523, 659, 784, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, "triangle", 0.15, i * 0.12)); },
  lose() { [392, 330, 262].forEach((f, i) => tone(f, 0.28, "sine", 0.14, i * 0.16)); },
  miss() { tone(220, 0.08, "sine", 0.04); },
};

muteBtn.addEventListener("click", () => {
  muted = !muted;
  muteBtn.innerHTML = muted ? "&#128263;" : "&#128266;";
  muteBtn.setAttribute("aria-pressed", String(muted));
  muteBtn.setAttribute("aria-label", muted ? "Sound off" : "Sound on");
  muteBtn.title = muted ? "Sound off" : "Sound on";
  sounds.click();
});

// ----- Best score (saved in the browser, one per difficulty) -----
function bestKey() {
  return "waterDropBest_" + mode;
}
function getBest() {
  try {
    return Number(localStorage.getItem(bestKey())) || 0;
  } catch (err) {
    return 0;
  }
}
function saveBest(value) {
  try {
    localStorage.setItem(bestKey(), String(value));
  } catch (err) {
    /* storage not available, ignore */
  }
}

// ----- Small helpers -----
function showMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = "message" + (type ? " " + type : "");
}

function updateScoreDisplay(flashClass) {
  scoreEl.textContent = score;
  progressBar.style.width = Math.min((score / cfg.goal) * 100, 100) + "%";
  progressBar.classList.toggle("done", score >= cfg.goal);
  if (flashClass) {
    scoreEl.classList.remove("flash-good", "flash-bad");
    void scoreEl.offsetWidth; // restart the animation
    scoreEl.classList.add(flashClass);
  }
}

function showPop(text, type, x, y) {
  const pop = document.createElement("div");
  pop.className = "pop " + type;
  pop.textContent = text;
  pop.style.left = x + "px";
  pop.style.top = y + "px";
  container.appendChild(pop);
  pop.addEventListener("animationend", () => pop.remove());
}

// Updates every label that depends on the chosen difficulty
function applyMode() {
  cfg = DIFFICULTY[mode];
  goalEl.textContent = cfg.goal;
  timeEl.textContent = cfg.seconds;
  penaltyLabel.textContent = cfg.penalty;
  modeInfoEl.textContent =
    cfg.label + ": reach " + cfg.goal + " points in " + cfg.seconds + " seconds. Polluted drops cost " + cfg.penalty + ".";
  bestScoreEl.textContent = getBest();
}

modeInputs.forEach((input) => {
  input.addEventListener("change", () => {
    if (gameRunning) return;
    mode = input.value;
    sounds.click();
    resetGame();
  });
});

function lockModes(locked) {
  modeInputs.forEach((input) => (input.disabled = locked));
}

// ----- Starting, resetting and ending -----
function startGame() {
  if (gameRunning) return; // stop two games from running at once
  clearBoard();
  gameRunning = true;
  score = 0;
  timeLeft = cfg.seconds;
  milestonesHit = [];
  endScreen.hidden = true;
  startBtn.disabled = true;
  lockModes(true);
  timeEl.textContent = timeLeft;
  updateScoreDisplay();
  sounds.click();
  showMessage("Go! Catch the clean drops and dodge the brown ones.");

  countdownTimer = setInterval(tick, 1000);
  scheduleDrop();
}

function tick() {
  timeLeft--;
  timeEl.textContent = timeLeft;
  if (timeLeft <= 0) endGame();
}

function clearBoard() {
  clearTimeout(dropTimer);
  clearInterval(countdownTimer);
  container.querySelectorAll(".water-drop, .pop").forEach((el) => el.remove());
}

// Reset button: stop everything and go back to the start screen
function resetGame() {
  gameRunning = false;
  clearBoard();
  score = 0;
  milestonesHit = [];
  endScreen.hidden = true;
  startBtn.disabled = false;
  lockModes(false);
  applyMode();
  timeLeft = cfg.seconds;
  updateScoreDisplay();
  showMessage("Ready? Pick a difficulty and tap Start Game.");
}

function endGame() {
  gameRunning = false;
  clearBoard();
  startBtn.disabled = false;
  lockModes(false);
  timeEl.textContent = 0;

  const won = score >= cfg.goal;
  const pool = won ? winMessages : loseMessages;
  const randomMessage = pool[Math.floor(Math.random() * pool.length)];

  let best = getBest();
  const newBest = score > best;
  if (newBest) {
    best = score;
    saveBest(best);
  }

  endTitle.textContent = won ? "You Win! 🎉" : "Time's Up!";
  endText.textContent = randomMessage + (newBest && score > 0 ? " New best score!" : "");
  finalScoreEl.textContent = score;
  bestScoreEl.textContent = best;
  endScreen.hidden = false;
  playAgainBtn.focus();

  showMessage(won ? "You reached the goal on " + cfg.label + " mode!" : "Time is up. Try again!", won ? "good" : "bad");
  if (won) {
    sounds.win();
    launchConfetti();
  } else {
    sounds.lose();
  }
}

// ----- Making drops -----
function scheduleDrop() {
  if (!gameRunning) return;
  createDrop();
  // Drops come faster as the round goes on
  const progress = (cfg.seconds - timeLeft) / cfg.seconds;
  const delay = Math.max(cfg.minDelay, cfg.startDelay - progress * (cfg.startDelay - cfg.minDelay));
  dropTimer = setTimeout(scheduleDrop, delay);
}

// Picks what kind of item to drop (the chances depend on the difficulty)
function pickType() {
  const roll = Math.random();
  if (roll < CAN_CHANCE) return "can";
  if (roll < CAN_CHANCE + cfg.dirtyChance) return "dirty";
  return "clean";
}

function createDrop() {
  const type = pickType();
  const drop = document.createElement("div");
  drop.className = "water-drop " + type;
  drop.dataset.type = type;

  // Random size for variety (jerry cans are a bit bigger so they are easier to see)
  const base = type === "can" ? 100 : 88;
  const size = base * (Math.random() * 0.6 + 0.8);
  drop.style.width = drop.style.height = size + "px";

  // Random horizontal position, kept fully inside the game area
  const maxLeft = Math.max(container.clientWidth - size, 0);
  drop.style.left = Math.random() * maxLeft + "px";

  // Fall all the way to the bottom. Faster later in the round.
  const progress = (cfg.seconds - timeLeft) / cfg.seconds;
  const duration = (cfg.startFall - progress * (cfg.startFall - cfg.minFall)) * (type === "can" ? 0.8 : 1);
  drop.style.setProperty("--fall", container.clientHeight + 30 + "px");
  drop.style.animationDuration = duration + "s";

  // Click or tap the drop
  drop.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    catchDrop(drop, type, event);
  });

  // Drops that reach the bottom are removed from the page
  drop.addEventListener("animationend", () => {
    if (gameRunning && type === "clean") sounds.miss();
    drop.remove();
  });

  container.appendChild(drop);
}

// ----- Catching drops (the clicked element is removed from the DOM) -----
function catchDrop(drop, type, event) {
  if (!gameRunning || drop.dataset.caught) return;
  drop.dataset.caught = "true";

  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left - 10;
  const y = event.clientY - rect.top - 20;

  drop.remove(); // gone from the page as soon as it is caught

  if (type === "dirty") {
    score = Math.max(0, score - cfg.penalty); // the score never goes below zero
    showPop("−" + cfg.penalty, "minus", x, y);
    updateScoreDisplay("flash-bad");
    showMessage("Oops, polluted water! That costs you " + cfg.penalty + (cfg.penalty === 1 ? " point." : " points."), "bad");
    container.classList.remove("shake");
    void container.offsetWidth;
    container.classList.add("shake");
    sounds.dirty();
  } else if (type === "can") {
    score += CAN_POINTS;
    showPop("+" + CAN_POINTS, "plus gold", x, y);
    updateScoreDisplay("flash-good");
    showMessage("Golden jerry can! +" + CAN_POINTS + " points!", "good");
    sounds.can();
  } else {
    score += CLEAN_POINTS;
    showPop("+" + CLEAN_POINTS, "plus", x, y);
    updateScoreDisplay("flash-good");
    sounds.collect();
  }

  checkMilestones();
}

// Shows a message the first time each milestone is passed
function checkMilestones() {
  MILESTONES.forEach((m, index) => {
    const needed = Math.ceil(cfg.goal * m.at);
    if (score >= needed && !milestonesHit.includes(index)) {
      milestonesHit.push(index);
      showMessage(m.text, "fact");
    }
  });
}

// ----- Celebration -----
function launchConfetti() {
  const colors = ["#FFC907", "#2E9DF7", "#8BD1CB", "#F5402C", "#FF902A", "#4FCB53"];
  for (let i = 0; i < 90; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti";
    piece.style.left = Math.random() * 100 + "vw";
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.animationDuration = Math.random() * 2 + 2.5 + "s";
    piece.style.animationDelay = Math.random() * 0.8 + "s";
    piece.style.transform = "rotate(" + Math.random() * 360 + "deg)";
    document.body.appendChild(piece);
    piece.addEventListener("animationend", () => piece.remove());
  }
}

// ----- Buttons -----
startBtn.addEventListener("click", startGame);
resetBtn.addEventListener("click", () => {
  sounds.click();
  resetGame();
});
playAgainBtn.addEventListener("click", startGame);

// Set up the first screen
resetGame();
