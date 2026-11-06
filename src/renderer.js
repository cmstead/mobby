const logic = window.MobLogic;
const STORAGE_KEY = "mob-timer-session";

const elements = {
  timeLeft: document.querySelector("#time-left"),
  currentDriver: document.querySelector("#current-driver"),
  nextDriver: document.querySelector("#next-driver"),
  turnCaption: document.querySelector("#turn-caption"),
  status: document.querySelector("#session-status"),
  progressFill: document.querySelector("#progress-fill"),
  startPause: document.querySelector("#start-pause"),
  skipTurn: document.querySelector("#skip-turn"),
  reset: document.querySelector("#reset-timer"),
  duration: document.querySelector("#duration"),
  breakInterval: document.querySelector("#break-interval"),
  breakDuration: document.querySelector("#break-duration"),
  driverLabel: document.querySelector("#driver-label"),
  addPersonForm: document.querySelector("#add-person-form"),
  personName: document.querySelector("#person-name"),
  participantList: document.querySelector("#participant-list"),
  teamCount: document.querySelector("#team-count"),
  teamHelper: document.querySelector("#team-helper"),
  potentialSection: document.querySelector("#potential-section"),
  potentialList: document.querySelector("#potential-list"),
  potentialCount: document.querySelector("#potential-count"),
  expiryPopup: document.querySelector("#expiry-popup"),
  expiryEyebrow: document.querySelector("#expiry-eyebrow"),
  expiryTitle: document.querySelector("#expiry-title"),
  expiryDescription: document.querySelector("#expiry-description"),
  startNextTurn: document.querySelector("#start-next-turn"),
  skipDriver: document.querySelector("#skip-driver"),
  skipBreak: document.querySelector("#skip-break"),
  cancelPopup: document.querySelector("#cancel-popup")
};

function loadSavedSession() {
  try {
    return logic.parseSavedSession(localStorage.getItem(STORAGE_KEY));
  } catch (error) {
    console.error("Could not load the saved mob timer session.", error);
    return logic.parseSavedSession(null);
  }
}

const savedSession = loadSavedSession();
const state = logic.createState(savedSession);

elements.duration.value = String(savedSession.duration);
elements.breakInterval.value = String(savedSession.breakInterval);
elements.breakDuration.value = String(savedSession.breakDuration);

function phaseSeconds() {
  return logic.phaseSeconds(state);
}

function persistSession() {
  try {
    localStorage.setItem(STORAGE_KEY, logic.serializeSession(state));
  } catch (error) {
    console.error("Could not save the mob timer session.", error);
  }
}

const formatTime = logic.formatTime;

function currentRemainingSeconds() {
  if (!state.running || state.deadline === null) return state.remainingSeconds;
  return Math.max(0, Math.ceil((state.deadline - Date.now()) / 1000));
}

function updateTimerDisplay() {
  const remaining = currentRemainingSeconds();
  elements.timeLeft.textContent = formatTime(remaining);
  elements.progressFill.style.transform = `scaleX(${phaseSeconds() === 0 ? 0 : remaining / phaseSeconds()})`;
  elements.turnCaption.textContent = state.phase === "break" ? "Break" : `Turn ${state.turnNumber}`;
  document.title = state.running ? `${formatTime(remaining)} · Mobby` : "Mobby";
}

function updateParticipants() {
  const count = state.participants.length;
  elements.teamCount.textContent = `(${count})`;
  elements.currentDriver.textContent = state.phase === "break"
    ? "Break time"
    : count ? state.participants[state.currentIndex] : "Add your team";
  elements.driverLabel.textContent = state.phase === "break" ? "STEP AWAY" : "CURRENT DRIVER";
  elements.nextDriver.textContent = count
    ? state.participants[(state.currentIndex + 1) % count]
    : "Add participants below";
  elements.teamHelper.textContent = count
    ? "Driver order follows the list. “Sit out” keeps a name for later; × deletes it."
    : "Add at least one driver to get started.";
  const skipDisabled = count < 2 || state.phase === "break";
  elements.skipTurn.disabled = skipDisabled;
  elements.skipTurn.setAttribute("aria-disabled", String(skipDisabled));
  elements.participantList.replaceChildren();

  state.participants.forEach((name, index) => {
    const item = document.createElement("li");
    const nameElement = document.createElement("span");
    nameElement.className = "participant-name";
    nameElement.textContent = name;

    if (count > 0 && index === state.currentIndex) {
      item.classList.add("is-current");
      const currentTag = document.createElement("span");
      currentTag.className = "participant-tag";
      currentTag.textContent = "DRIVING";
      nameElement.append(currentTag);
    }

    item.className = `participant${count > 0 && index === state.currentIndex ? " is-current" : ""}`;
    const sitOutButton = document.createElement("button");
    sitOutButton.className = "rotation-toggle";
    sitOutButton.type = "button";
    sitOutButton.textContent = "Sit out";
    sitOutButton.setAttribute("aria-label", `Remove ${name} from rotation`);
    sitOutButton.title = "Move to potential mobbers";
    sitOutButton.addEventListener("click", () => sitOut(index));
    const removeButton = document.createElement("button");
    removeButton.className = "remove-person";
    removeButton.type = "button";
    removeButton.setAttribute("aria-label", `Delete ${name}`);
    removeButton.title = "Delete";
    removeButton.textContent = "×";
    removeButton.addEventListener("click", () => removeParticipant(index));
    const actions = document.createElement("span");
    actions.className = "participant-actions";
    actions.append(sitOutButton, removeButton);
    item.append(nameElement, actions);
    elements.participantList.append(item);
  });

  elements.potentialSection.hidden = state.potential.length === 0;
  elements.potentialCount.textContent = `(${state.potential.length})`;
  elements.potentialList.replaceChildren();

  state.potential.forEach((name, index) => {
    const item = document.createElement("li");
    item.className = "participant";
    const nameElement = document.createElement("span");
    nameElement.className = "participant-name";
    nameElement.textContent = name;

    const rejoinButton = document.createElement("button");
    rejoinButton.className = "rotation-toggle";
    rejoinButton.type = "button";
    rejoinButton.textContent = "Rejoin";
    rejoinButton.setAttribute("aria-label", `Add ${name} to rotation`);
    rejoinButton.title = "Add to rotation";
    rejoinButton.addEventListener("click", () => rejoinRotation(index));
    const deleteButton = document.createElement("button");
    deleteButton.className = "remove-person";
    deleteButton.type = "button";
    deleteButton.setAttribute("aria-label", `Delete ${name}`);
    deleteButton.title = "Delete";
    deleteButton.textContent = "×";
    deleteButton.addEventListener("click", () => deletePotential(index));
    const actions = document.createElement("span");
    actions.className = "participant-actions";
    actions.append(rejoinButton, deleteButton);
    item.append(nameElement, actions);
    elements.potentialList.append(item);
  });
}

function updateControls() {
  const hasParticipants = state.participants.length > 0;
  elements.startPause.disabled = !hasParticipants;
  elements.startPause.textContent = state.running ? "Pause session" : "Start session";
  elements.status.textContent = state.running
    ? (state.phase === "break" ? "ON BREAK" : "IN PROGRESS")
    : "READY";
  elements.status.classList.toggle("is-running", state.running);
  elements.duration.disabled = state.running;
  elements.breakInterval.disabled = state.running;
  elements.breakDuration.disabled = state.running;
}

function render() {
  updateParticipants();
  updateControls();
  updateTimerDisplay();
  updateExpiryPopup();
}

function candidateIndex() {
  return logic.candidateIndex(state);
}

function updateExpiryPopup() {
  if (!state.popup) {
    if (elements.expiryPopup.open) {
      elements.expiryPopup.close();
      window.mobTimerWindow?.releaseExpiryToFront();
    }
    document.documentElement.classList.remove("modal-open");
    return;
  }

  const count = state.participants.length;
  const current = count ? state.participants[state.currentIndex] : "The driver";
  const next = count ? state.participants[candidateIndex()] : "the next driver";
  const canSkip = count >= 2 && state.popup !== "break";

  elements.skipDriver.hidden = !canSkip;
  elements.skipBreak.hidden = state.popup !== "break";
  elements.cancelPopup.hidden = state.popup !== "resume";

  if (state.popup === "break") {
    elements.expiryEyebrow.textContent = "BREAK TIME";
    elements.expiryTitle.textContent = "Time for a break!";
    elements.expiryDescription.textContent = `${current} has finished driving. Step away from the keyboard and rest.`;
    elements.startNextTurn.textContent = "Begin break";
  } else if (state.popup === "resume") {
    elements.expiryEyebrow.textContent = "PAUSED";
    elements.expiryTitle.textContent = "Resume session?";
    elements.expiryDescription.textContent = `${current} has ${formatTime(state.remainingSeconds)} left on their turn.`;
    elements.startNextTurn.textContent = `Resume ${current}`;
    elements.skipDriver.textContent = `Skip ${current}`;
  } else if (state.popup === "afterBreak") {
    elements.expiryEyebrow.textContent = "BREAK OVER";
    elements.expiryTitle.textContent = "Break's over!";
    elements.expiryDescription.textContent = `Welcome back! ${next} is up next at the keyboard.`;
    elements.startNextTurn.textContent = `Start ${next}'s turn`;
    elements.skipDriver.textContent = `Skip ${next}`;
  } else {
    elements.expiryEyebrow.textContent = "DRIVER ROTATION";
    elements.expiryTitle.textContent = "Time's up!";
    elements.expiryDescription.textContent = `${current}'s turn is over. Pass the keyboard to ${next}.`;
    elements.startNextTurn.textContent = `Start ${next}'s turn`;
    elements.skipDriver.textContent = `Skip ${next}`;
  }

  if (!elements.expiryPopup.open) {
    elements.expiryPopup.showModal();
    document.documentElement.classList.add("modal-open");
    if (state.popup !== "resume") window.mobTimerWindow?.bringExpiryToFront();
  }
}

function stopTicking() {
  if (state.tickHandle !== null) {
    window.clearInterval(state.tickHandle);
    state.tickHandle = null;
  }
}

function pauseTimer() {
  state.remainingSeconds = currentRemainingSeconds();
  state.paused = state.phase === "driving" && state.participants.length > 0;
  state.running = false;
  state.deadline = null;
  stopTicking();
  render();
}

function tick() {
  if (currentRemainingSeconds() <= 0) {
    logic.expireTurn(state);
    state.running = false;
    state.deadline = null;
    stopTicking();
    render();
    elements.startNextTurn.focus();
    return;
  }
  updateTimerDisplay();
}

function startTimer() {
  if (state.participants.length === 0) return;
  if (state.remainingSeconds <= 0) state.remainingSeconds = phaseSeconds();
  state.popup = null;
  state.paused = false;
  state.skipOffset = 0;
  state.running = true;
  state.deadline = Date.now() + state.remainingSeconds * 1000;
  stopTicking();
  state.tickHandle = window.setInterval(tick, 200);
  render();
}

function resetTimer() {
  logic.resetState(state);
  stopTicking();
  render();
}

function refreshAfterRosterChange() {
  persistSession();
  if (state.participants.length === 0) pauseTimer();
  else render();
}

function removeParticipant(index) {
  logic.leaveRotation(state, index);
  refreshAfterRosterChange();
}

function sitOut(index) {
  logic.sitOut(state, index);
  refreshAfterRosterChange();
}

function rejoinRotation(index) {
  logic.rejoinRotation(state, index);
  refreshAfterRosterChange();
}

function deletePotential(index) {
  logic.deletePotential(state, index);
  refreshAfterRosterChange();
}

elements.startPause.addEventListener("click", () => {
  if (state.running) {
    pauseTimer();
  } else if (state.paused) {
    state.popup = "resume";
    render();
    elements.startNextTurn.focus();
  } else {
    startTimer();
  }
});

elements.skipTurn.addEventListener("click", () => {
  if (!logic.skipTurn(state, currentRemainingSeconds())) return;
  state.deadline = state.running ? Date.now() + state.remainingSeconds * 1000 : null;
  render();
});

function skipCurrentDriver() {
  logic.skipCurrentDriver(state);
  startTimer();
}

elements.skipDriver.addEventListener("click", () => {
  if (state.participants.length < 2) return;

  if (state.popup === "resume") {
    skipCurrentDriver();
  } else if (logic.cycleSkipOffset(state)) {
    render();
  }
});

elements.skipBreak.addEventListener("click", () => {
  if (logic.skipBreak(state)) startTimer();
});

elements.cancelPopup.addEventListener("click", () => {
  state.popup = null;
  render();
});

elements.expiryPopup.addEventListener("cancel", (event) => {
  event.preventDefault();
  if (state.popup === "resume") {
    state.popup = null;
    render();
  }
});

elements.startNextTurn.addEventListener("click", () => {
  if (logic.acceptPopup(state)) startTimer();
});

elements.reset.addEventListener("click", resetTimer);

function bindSetting(input, max, apply) {
  input.addEventListener("change", () => {
    const minutes = Number(input.value);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > max) {
      input.value = String(input.dataset.current);
      return;
    }
    apply(minutes * 60);
    input.dataset.current = String(minutes);
    persistSession();
    render();
  });
  input.dataset.current = input.value;
}

bindSetting(elements.duration, logic.MAX_DURATION, (seconds) => {
  logic.applyDuration(state, seconds);
});

bindSetting(elements.breakInterval, logic.MAX_BREAK_INTERVAL, (seconds) => {
  logic.applyBreakInterval(state, seconds);
});

bindSetting(elements.breakDuration, logic.MAX_DURATION, (seconds) => {
  logic.applyBreakDuration(state, seconds);
});

elements.addPersonForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = elements.personName.value.trim();
  if (!name) return;
  state.participants.push(name);
  elements.personName.value = "";
  persistSession();
  render();
  elements.personName.focus();
});

render();
