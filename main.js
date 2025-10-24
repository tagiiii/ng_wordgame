const DEFAULT_DURATION = 60;
const TimerState = {
  Idle: "idle",
  Running: "running",
  Paused: "paused",
};

const elements = {
  dataStatus: document.querySelector("#data-status"),
  drawTopic: document.querySelector("#draw-topic"),
  redrawTopic: document.querySelector("#redraw-topic"),
  topicTitle: document.querySelector("#topic-title"),
  topicCategory: document.querySelector("#topic-category"),
  topicGrade: document.querySelector("#topic-grade"),
  topicDifficulty: document.querySelector("#topic-difficulty"),
  topicNotes: document.querySelector("#topic-notes"),
  banList: document.querySelector("#ban-list"),
  pickedBanList: document.querySelector("#picked-ban-list"),
  copyDm: document.querySelector("#copy-dm"),
  showAnswer: document.querySelector("#show-answer"),
  answerWrap: document.querySelector("#answer-display"),
  answerText: document.querySelector("#answer-text"),
  timerValue: document.querySelector("#timer-value"),
  timerStart: document.querySelector("#timer-start"),
  timerStop: document.querySelector("#timer-stop"),
  timerReset: document.querySelector("#timer-reset"),
  roundInput: document.querySelector("#round-input"),
  errorDialog: document.querySelector("#error-dialog"),
  errorMessage: document.querySelector("#error-message"),
  dialogClose: document.querySelector("#dialog-close"),
  dmTemplate: document.querySelector("#dm-template"),
};

/** @type {Topic[]} */
let topics = [];
/** @type {Topic | null} */
let currentTopic = null;
/** @type {string[]} */
let currentNgWords = [];

let timerState = TimerState.Idle;
let remainingSeconds = DEFAULT_DURATION;
let timerHandle = null;
let endTimestamp = null;
let audioContext = null;

async function loadTopics() {
  updateStatus("読み込み中…");
  try {
    const response = await fetch("topics.json", { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    /** @type {Topic[]} */
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("お題データが見つかりません");
    }
    topics = data;
    updateStatus(`お題 ${topics.length} 件`);
    elements.drawTopic.disabled = false;
    elements.redrawTopic.disabled = false;
  } catch (error) {
    console.error(error);
    updateStatus("読み込み失敗");
    elements.drawTopic.disabled = true;
    elements.redrawTopic.disabled = true;
    showError("トピックデータの読み込みに失敗しました。ページを再読み込みしてください。");
  }
}

function updateStatus(text) {
  elements.dataStatus.textContent = text;
}

function showError(message) {
  elements.errorMessage.textContent = message;
  if (typeof elements.errorDialog.showModal === "function") {
    elements.errorDialog.showModal();
  } else {
    alert(message);
  }
}

function closeDialog() {
  if (elements.errorDialog.open) {
    elements.errorDialog.close();
  }
}

elements.dialogClose.addEventListener("click", closeDialog);

document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement) {
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    toggleTimer();
  }
  if (event.code === "KeyR") {
    event.preventDefault();
    resetTimer();
  }
});

elements.drawTopic.addEventListener("click", () => {
  drawNewTopic();
});

elements.redrawTopic.addEventListener("click", () => {
  drawNewTopic();
});

elements.copyDm.addEventListener("click", () => {
  if (!currentTopic) return;
  const dmText = formatDmText(currentTopic, currentNgWords);
  attemptCopy(dmText);
});

elements.showAnswer.addEventListener("click", () => {
  if (!currentTopic) return;
  elements.answerText.textContent = currentTopic.topic;
  elements.answerWrap.hidden = false;
});

elements.timerStart.addEventListener("click", () => startTimer());
elements.timerStop.addEventListener("click", () => stopTimer());
elements.timerReset.addEventListener("click", () => resetTimer());

elements.roundInput.addEventListener("change", () => {
  const value = Math.max(1, Number(elements.roundInput.value) || 1);
  elements.roundInput.value = value;
});

function drawNewTopic() {
  if (topics.length === 0) return;
  const topic = pickTopic(topics, currentTopic?.id);
  if (!topic) {
    showError("有効なお題が見つかりませんでした。");
    return;
  }
  currentTopic = topic;
  currentNgWords = pickNgWords(topic.bans);
  renderTopic(topic, currentNgWords);
  elements.copyDm.disabled = false;
  elements.showAnswer.disabled = false;
  elements.answerWrap.hidden = true;
  resetTimer();
}

/**
 * @param {Topic[]} list
 * @param {string | undefined} lastId
 * @returns {Topic | null}
 */
function pickTopic(list, lastId) {
  const valid = list.filter((item) => Array.isArray(item.bans) && item.bans.length >= 3);
  if (valid.length === 0) {
    return null;
  }
  if (valid.length === 1) {
    return valid[0];
  }
  let candidate;
  do {
    candidate = valid[Math.floor(Math.random() * valid.length)];
  } while (candidate.id === lastId);
  return candidate;
}

/**
 * @param {string[]} bans
 * @returns {string[]}
 */
function pickNgWords(bans) {
  if (!Array.isArray(bans) || bans.length < 3) {
    return [];
  }
  if (bans.length < 6) {
    showError("NG候補が6語未満のお題があります。データを確認してください。");
  }
  const shuffled = [...bans].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, 3);
}

/**
 * @param {Topic} topic
 * @param {string[]} ngWords
 */
function renderTopic(topic, ngWords) {
  elements.topicTitle.textContent = topic.topic;
  elements.topicCategory.textContent = topic.category || "—";
  elements.topicGrade.textContent = topic.grade_range || "—";
  elements.topicDifficulty.textContent = topic.difficulty?.toString() ?? "—";
  elements.topicNotes.textContent = topic.notes && topic.notes !== "—" ? topic.notes : "";
  renderList(elements.banList, topic.bans, 6);
  renderList(elements.pickedBanList, ngWords, 3, true);
}

function renderList(listEl, items, expectedLength, emphasize = false) {
  listEl.innerHTML = "";
  const filler = Math.max(0, expectedLength - items.length);
  items.forEach((item) => {
    const li = document.createElement("li");
    li.textContent = item;
    if (emphasize) {
      li.classList.add("highlight");
    }
    listEl.appendChild(li);
  });
  for (let i = 0; i < filler; i += 1) {
    const li = document.createElement("li");
    li.textContent = "—";
    listEl.appendChild(li);
  }
}

function formatDmText(topic, ngWords) {
  const template = elements.dmTemplate?.textContent ?? "【お題】{{topic}}\n【NGワード】{{ngWords}}";
  const ngText = ngWords.join("・");
  return template.replace("{{topic}}", topic.topic).replace("{{ngWords}}", ngText);
}

function showCopyFeedback() {
  elements.copyDm.textContent = "コピーしました";
  elements.copyDm.disabled = true;
  setTimeout(() => {
    elements.copyDm.textContent = "DMコピー";
    elements.copyDm.disabled = false;
  }, 1600);
}

function attemptCopy(text) {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showCopyFeedback();
      })
      .catch((error) => {
        console.warn("navigator.clipboard failed", error);
        fallbackCopy(text);
      });
    return;
  }
  fallbackCopy(text);
}

function fallbackCopy(text) {
  const success = legacyCopy(text);
  if (success) {
    showCopyFeedback();
  } else {
    manualCopyPrompt(text);
  }
}

function legacyCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.top = "0";
  textarea.style.left = "-9999px";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  let successful = false;
  try {
    successful = document.execCommand("copy");
  } catch (error) {
    console.warn("document.execCommand failed", error);
    successful = false;
  }
  document.body.removeChild(textarea);
  return successful;
}

function manualCopyPrompt(text) {
  const message = "コピーが自動で許可されていません。以下の内容を選択してコピーしてください。";
  window.prompt(message, text);
  console.warn("manual copy fallback invoked");
}

function toggleTimer() {
  if (timerState === TimerState.Running) {
    stopTimer();
  } else {
    startTimer();
  }
}

function startTimer() {
  if (timerState === TimerState.Running) return;
  if (remainingSeconds <= 0) {
    remainingSeconds = DEFAULT_DURATION;
  }
  timerState = TimerState.Running;
  const now = performance.now();
  endTimestamp = now + remainingSeconds * 1000;
  elements.timerStart.disabled = true;
  elements.timerStop.disabled = false;
  elements.timerReset.disabled = false;
  runTimerTick();
}

function stopTimer() {
  if (timerState !== TimerState.Running) return;
  timerState = TimerState.Paused;
  clearTimer();
  elements.timerStart.disabled = false;
  elements.timerStop.disabled = true;
}

function resetTimer() {
  clearTimer();
  timerState = TimerState.Idle;
  remainingSeconds = DEFAULT_DURATION;
  updateTimerDisplay(remainingSeconds);
  elements.timerStart.disabled = false;
  elements.timerStop.disabled = true;
  elements.timerReset.disabled = true;
}

function clearTimer() {
  if (timerHandle) {
    cancelAnimationFrame(timerHandle);
    timerHandle = null;
  }
}

function runTimerTick() {
  timerHandle = requestAnimationFrame(() => {
    const now = performance.now();
    const diff = Math.max(0, endTimestamp - now);
    const seconds = Math.ceil(diff / 1000);
    if (seconds !== remainingSeconds) {
      remainingSeconds = seconds;
      updateTimerDisplay(remainingSeconds);
    }
    if (diff <= 0) {
      finishTimer();
    } else {
      runTimerTick();
    }
  });
}

function finishTimer() {
  timerState = TimerState.Idle;
  clearTimer();
  remainingSeconds = 0;
  updateTimerDisplay(0);
  elements.timerStart.disabled = false;
  elements.timerStop.disabled = true;
  elements.timerReset.disabled = false;
  playChime();
}

function updateTimerDisplay(value) {
  elements.timerValue.textContent = value.toString().padStart(2, "0");
  if (value <= 5) {
    elements.timerValue.parentElement?.classList.add("warning");
  } else {
    elements.timerValue.parentElement?.classList.remove("warning");
  }
}

function playChime() {
  try {
    if (!audioContext) {
      audioContext = new AudioContext();
    }
    const duration = 0.4;
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    gain.gain.setValueAtTime(0.2, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (error) {
    console.warn("chime failed", error);
  }
}

resetTimer();
loadTopics();

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
