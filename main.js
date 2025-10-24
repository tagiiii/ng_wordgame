const DEFAULT_DURATION = 60;
const WARNING_THRESHOLD = 5;

const elements = {
  statusText: document.querySelector("#status-text"),
  drawButton: document.querySelector("#btn-draw"),
  redrawButton: document.querySelector("#btn-redraw"),
  copyButton: document.querySelector("#btn-copy"),
  answerButton: document.querySelector("#btn-answer"),
  topicTitle: document.querySelector("#topic-title"),
  topicCategory: document.querySelector("#topic-category"),
  topicGrade: document.querySelector("#topic-grade"),
  topicDifficulty: document.querySelector("#topic-difficulty"),
  topicNotes: document.querySelector("#topic-notes"),
  ngCandidates: document.querySelector("#ng-candidates"),
  ngPicked: document.querySelector("#ng-picked"),
  timerDisplay: document.querySelector("#timer-display"),
  timerContainer: document.querySelector(".timer"),
  startButton: document.querySelector("#btn-start"),
  stopButton: document.querySelector("#btn-stop"),
  resetButton: document.querySelector("#btn-reset"),
  answerBox: document.querySelector("#answer-box"),
  answerText: document.querySelector("#answer-text"),
  copyFeedback: document.querySelector("#copy-feedback"),
  roundInput: document.querySelector("#round-number"),
};

/** @type {Topic[]} */
let topics = [];
/** @type {Topic | null} */
let currentTopic = null;
/** @type {string[]} */
let currentNgWords = [];

let remainingSeconds = DEFAULT_DURATION;
let timerId = null;
let timerTarget = null;

loadTopics();
setupEventHandlers();
resetTimer();
updateCopyFeedback("");

async function loadTopics() {
  try {
    const response = await fetch("topics.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    /** @type {Topic[]} */
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("データが空です");
    }
    topics = data.filter((item) => Array.isArray(item.bans) && item.bans.length >= 3);
    if (topics.length === 0) {
      throw new Error("有効なお題がありません");
    }
    elements.statusText.textContent = `お題 ${topics.length} 件`;
    elements.drawButton.disabled = false;
    elements.redrawButton.disabled = false;
  } catch (error) {
    console.error(error);
    elements.statusText.textContent = "読み込み失敗";
    elements.drawButton.disabled = true;
    elements.redrawButton.disabled = true;
    updateCopyFeedback("トピックデータを読み込めませんでした。再読み込みしてください。");
  }
}

function setupEventHandlers() {
  elements.drawButton.addEventListener("click", () => {
    drawTopic();
  });

  elements.redrawButton.addEventListener("click", () => {
    drawTopic();
  });

  elements.copyButton.addEventListener("click", () => {
    if (!currentTopic) return;
    const dmText = formatCopyText(currentTopic, currentNgWords);
    attemptCopy(dmText);
  });

  elements.answerButton.addEventListener("click", () => {
    if (!currentTopic) return;
    elements.answerText.textContent = currentTopic.topic;
    elements.answerBox.hidden = false;
  });

  elements.startButton.addEventListener("click", startTimer);
  elements.stopButton.addEventListener("click", stopTimer);
  elements.resetButton.addEventListener("click", resetTimer);

  elements.roundInput.addEventListener("change", () => {
    const value = Math.max(1, Number(elements.roundInput.value) || 1);
    elements.roundInput.value = value;
  });

  document.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLInputElement) return;

    if (event.code === "Space") {
      event.preventDefault();
      if (timerId) {
        stopTimer();
      } else {
        startTimer();
      }
    }

    if (event.code === "KeyR") {
      event.preventDefault();
      resetTimer();
    }
  });
}

function drawTopic() {
  if (topics.length === 0) return;
  const index = Math.floor(Math.random() * topics.length);
  currentTopic = topics[index];
  currentNgWords = pickNgWords(currentTopic.bans);
  renderTopic();
  resetTimer();
  elements.copyButton.disabled = false;
  elements.answerButton.disabled = false;
  elements.answerBox.hidden = true;
}

function renderTopic() {
  if (!currentTopic) return;
  elements.topicTitle.textContent = currentTopic.topic;
  elements.topicCategory.textContent = currentTopic.category || "—";
  elements.topicGrade.textContent = currentTopic.grade_range || "—";
  elements.topicDifficulty.textContent = typeof currentTopic.difficulty === "number" ? String(currentTopic.difficulty) : "—";
  elements.topicNotes.textContent = currentTopic.notes ? currentTopic.notes : "";

  fillList(elements.ngCandidates, currentTopic.bans, 6);
  fillList(elements.ngPicked, currentNgWords, 3);
}

function fillList(listElement, items, expectedCount) {
  if (!listElement) return;
  listElement.innerHTML = "";
  const fragment = document.createDocumentFragment();
  const padded = [...items];
  while (padded.length < expectedCount) {
    padded.push("—");
  }
  padded.slice(0, expectedCount).forEach((text) => {
    const li = document.createElement("li");
    li.textContent = text;
    fragment.appendChild(li);
  });
  listElement.appendChild(fragment);
}

function pickNgWords(bans) {
  const copy = [...bans];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, 3);
}

function formatCopyText(topic, ngWords) {
  const ng = ngWords.join("・");
  return `【お題】${topic.topic}\n【NGワード】${ng}`;
}

function updateCopyFeedback(message, emphasize = false) {
  if (!elements.copyFeedback) return;
  elements.copyFeedback.textContent = message;
  elements.copyFeedback.style.color = emphasize ? "var(--accent-dark)" : "var(--muted)";
}

async function attemptCopy(text) {
  const canUseNavigator = navigator.clipboard && window.isSecureContext;
  if (canUseNavigator) {
    try {
      await navigator.clipboard.writeText(text);
      updateCopyFeedback("コピーしました", true);
      return;
    } catch (error) {
      console.warn("navigator.clipboard failed", error);
    }
  }

  const legacySuccess = legacyCopy(text);
  if (legacySuccess) {
    updateCopyFeedback("コピーしました", true);
  } else {
    alertFallback(text);
    updateCopyFeedback("自動コピーに失敗しました。内容を手動でコピーしてください。", false);
  }
}

function legacyCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "-1000px";
  textarea.style.left = "-1000px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let success = false;
  try {
    success = document.execCommand("copy");
  } catch (error) {
    console.warn("document.execCommand failed", error);
    success = false;
  }
  document.body.removeChild(textarea);
  return success;
}

function alertFallback(text) {
  const message = "以下の内容を選択してコピーしてください。";
  window.prompt(message, text);
}

function startTimer() {
  if (timerId) return;
  if (remainingSeconds <= 0) {
    remainingSeconds = DEFAULT_DURATION;
  }
  timerTarget = Date.now() + remainingSeconds * 1000;
  timerId = setInterval(tick, 100);
  elements.startButton.disabled = true;
  elements.stopButton.disabled = false;
  elements.resetButton.disabled = false;
}

function stopTimer() {
  if (!timerId) return;
  clearInterval(timerId);
  timerId = null;
  if (timerTarget) {
    remainingSeconds = Math.max(0, Math.ceil((timerTarget - Date.now()) / 1000));
  }
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
}

function resetTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  timerTarget = null;
  remainingSeconds = DEFAULT_DURATION;
  updateTimerDisplay(remainingSeconds);
  elements.startButton.disabled = false;
  elements.stopButton.disabled = true;
  elements.resetButton.disabled = true;
}

function tick() {
  if (!timerTarget) return;
  const diff = timerTarget - Date.now();
  const seconds = Math.max(0, Math.ceil(diff / 1000));
  if (seconds !== remainingSeconds) {
    remainingSeconds = seconds;
    updateTimerDisplay(remainingSeconds);
  }
  if (diff <= 0) {
    clearInterval(timerId);
    timerId = null;
    remainingSeconds = 0;
    updateTimerDisplay(remainingSeconds);
    elements.startButton.disabled = false;
    elements.stopButton.disabled = true;
  }
}

function updateTimerDisplay(value) {
  elements.timerDisplay.textContent = value.toString().padStart(2, "0");
  if (value <= WARNING_THRESHOLD) {
    elements.timerContainer?.classList.add("warning");
  } else {
    elements.timerContainer?.classList.remove("warning");
  }
}

/**
 * @typedef {Object} Topic
 * @property {string} id
 * @property {string} topic
 * @property {string} category
 * @property {string} grade_range
 * @property {number} difficulty
 * @property {string[]} bans
 * @property {string[]} [alias]
 * @property {string} [reading]
 * @property {string} [notes]
 */
