// ===== Water Drop: a charity: water inspired game =====

// ----- Game settings -----
const GAME_SECONDS = 30; // how long one round lasts
const GOAL = 20; // score needed to win
const POINTS = { clean: 1, dirty: -2, can: 5 }; // what each item is worth
const BEST_KEY = "waterDropBestScore";

// Facts shown when the player passes a milestone score
const MILESTONES = [
  { score: 5, fact: "Nice start! charity: water was founded in 2006 to bring clean water to people who need it." },
  { score: 10, fact: "Halfway there! About 2 billion people around the world still lack safely managed drinking water." },
  { score: 15, fact: "Almost there! Many families, often women and girls, spend hours every day walking to collect water." },
  { score: 20, fact: "Goal reached! Clean water changes everything: health, school, and income for a whole community." },
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
  "Not quite 20 this time. Dodge the polluted drops and go again!",
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
const messageEl = document.getElementById("message");
const progressBar = document.getElementById("progress-bar");
const endScreen = document.getElementById("end-screen");
const endTitle = document.getElementById("end-title");
const endText = document.getElementById("end-text");
const finalScoreEl = document.getElementById("final-score");
const bestScoreEl = document.getElementById("best-score");
const playAgainBtn = document.getElementById("play-again");

// ----- Game state -----
let gameRunning = false;
let score = 0;
let timeLeft = GAME_SECONDS;
let dropTimer; // setTimeout id for the next drop
let countdownTimer; // setInterval id for the clock
let milestonesHit = [];

goalEl.textContent = GOAL;

// ----- Best score (saved in the browser) -----
function getBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch (err) {
    return 0;
  }
}
function saveBest(value) {
  try {
    localStorage.setItem(BEST_KEY, String(value));
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
  progressBar.style.width = Math.min((score / GOAL) * 100, 100) + "%";
  progressBar.classList.toggle("done", score >= GOAL);
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

// ----- Starting, resetting and ending -----
function startGame() {
  if (gameRunning) return; // stop two games from running at once
  clearBoard();
  gameRunning = true;
  score = 0;
  timeLeft = GAME_SECONDS;
  milestonesHit = [];
  endScreen.hidden = true;
  startBtn.disabled = true;
  timeEl.textContent = timeLeft;
  updateScoreDisplay();
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
  timeLeft = GAME_SECONDS;
  milestonesHit = [];
  endScreen.hidden = true;
  startBtn.disabled = false;
  timeEl.textContent = timeLeft;
  updateScoreDisplay();
  showMessage("Game reset. Tap Start Game when you are ready.");
}

function endGame() {
  gameRunning = false;
  clearBoard();
  startBtn.disabled = false;
  timeEl.textContent = 0;

  const won = score >= GOAL;
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

  showMessage(won ? "You reached the goal!" : "Time is up. Try again!", won ? "good" : "bad");
  if (won) launchConfetti();
}

// ----- Making drops -----
function scheduleDrop() {
  if (!gameRunning) return;
  createDrop();
  // Drops come faster as the round goes on
  const elapsed = GAME_SECONDS - timeLeft;
  const delay = Math.max(420, 850 - elapsed * 14);
  dropTimer = setTimeout(scheduleDrop, delay);
}

// Picks what kind of item to drop: 70% clean, 25% polluted, 5% golden jerry can
function pickType() {
  const roll = Math.random();
  if (roll < 0.05) return "can";
  if (roll < 0.3) return "dirty";
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
  const elapsed = GAME_SECONDS - timeLeft;
  const duration = Math.max(2.4, 4.4 - elapsed * 0.05) * (type === "can" ? 0.8 : 1);
  drop.style.setProperty("--fall", container.clientHeight + 30 + "px");
  drop.style.animationDuration = duration + "s";

  // Click or tap the drop
  drop.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    catchDrop(drop, type, event);
  });

  // Drops that reach the bottom just disappear
  drop.addEventListener("animationend", () => drop.remove());

  container.appendChild(drop);
}

// ----- Catching drops -----
function catchDrop(drop, type, event) {
  if (!gameRunning || drop.dataset.caught) return;
  drop.dataset.caught = "true";

  const rect = container.getBoundingClientRect();
  const x = event.clientX - rect.left - 10;
  const y = event.clientY - rect.top - 20;

  const points = POINTS[type];
  score = Math.max(0, score + points); // the score never goes below zero
  drop.remove();

  if (type === "dirty") {
    showPop("−2", "minus", x, y);
    updateScoreDisplay("flash-bad");
    showMessage("Oops, polluted water! That costs you 2 points.", "bad");
    container.classList.remove("shake");
    void container.offsetWidth;
    container.classList.add("shake");
  } else if (type === "can") {
    showPop("+5", "plus gold", x, y);
    updateScoreDisplay("flash-good");
    showMessage("Golden jerry can! +5 points!", "good");
  } else {
    showPop("+1", "plus", x, y);
    updateScoreDisplay("flash-good");
  }

  checkMilestones();
}

// Shows a charity: water fact the first time each milestone is passed
function checkMilestones() {
  for (const m of MILESTONES) {
    if (score >= m.score && !milestonesHit.includes(m.score)) {
      milestonesHit.push(m.score);
      showMessage(m.fact, "fact");
    }
  }
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
resetBtn.addEventListener("click", resetGame);
playAgainBtn.addEventListener("click", startGame);

// Show the saved best score on the first screen
bestScoreEl.textContent = getBest();
