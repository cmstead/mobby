(function (root) {
  const DEFAULT_DURATION = 5;
  const DEFAULT_BREAK_DURATION = 10;
  const DEFAULT_BREAK_INTERVAL = 50;
  const MAX_DURATION = 60;
  const MAX_BREAK_INTERVAL = 240;

  function readMinutes(value, fallback, max) {
    return Number.isInteger(value) && value >= 1 && value <= max ? value : fallback;
  }

  function readNames(value) {
    return Array.isArray(value)
      ? value.filter((name) => typeof name === "string" && name.trim())
      : [];
  }

  function defaultSession() {
    return {
      participants: [],
      potential: [],
      duration: DEFAULT_DURATION,
      breakInterval: DEFAULT_BREAK_INTERVAL,
      breakDuration: DEFAULT_BREAK_DURATION
    };
  }

  function parseSavedSession(json) {
    try {
      const saved = JSON.parse(json || "{}");
      return {
        participants: readNames(saved.participants),
        potential: readNames(saved.potential),
        duration: readMinutes(saved.duration, DEFAULT_DURATION, MAX_DURATION),
        breakInterval: readMinutes(saved.breakInterval, DEFAULT_BREAK_INTERVAL, MAX_BREAK_INTERVAL),
        breakDuration: readMinutes(saved.breakDuration, DEFAULT_BREAK_DURATION, MAX_DURATION)
      };
    } catch (error) {
      return defaultSession();
    }
  }

  function serializeSession(state) {
    return JSON.stringify({
      participants: state.participants,
      potential: state.potential,
      duration: state.durationSeconds / 60,
      breakInterval: state.breakIntervalSeconds / 60,
      breakDuration: state.breakSeconds / 60
    });
  }

  function formatTime(seconds) {
    const safeSeconds = Math.max(0, Math.ceil(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainder = safeSeconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
  }

  function createState(saved) {
    return {
      participants: saved.participants,
      potential: saved.potential,
      durationSeconds: saved.duration * 60,
      breakIntervalSeconds: saved.breakInterval * 60,
      breakSeconds: saved.breakDuration * 60,
      remainingSeconds: saved.duration * 60,
      phase: "driving",
      drivenSeconds: 0,
      popup: null,
      skipOffset: 0,
      paused: false,
      currentIndex: 0,
      currentDriverSelected: false,
      turnNumber: 1,
      running: false,
      deadline: null,
      tickHandle: null
    };
  }

  function phaseSeconds(state) {
    return state.phase === "break" ? state.breakSeconds : state.durationSeconds;
  }

  function currentRemainingSeconds(state, now) {
    if (!state.running || state.deadline === null) return state.remainingSeconds;
    return Math.max(0, Math.ceil((state.deadline - now) / 1000));
  }

  function candidateIndex(state) {
    return (state.currentIndex + 1 + state.skipOffset) % state.participants.length;
  }

  function selectCurrentDriver(state, index) {
    if (state.running || !Number.isInteger(index) || index < 0 || index >= state.participants.length) {
      return false;
    }
    state.currentIndex = index;
    state.currentDriverSelected = true;
    state.skipOffset = 0;
    return true;
  }

  // Decides which popup follows an expired timer.
  function expireTurn(state) {
    if (state.phase === "break") {
      state.popup = "afterBreak";
    } else {
      state.drivenSeconds += state.durationSeconds;
      state.popup = state.drivenSeconds >= state.breakIntervalSeconds ? "break" : "next";
      state.currentDriverSelected = false;
    }
    state.remainingSeconds = 0;
    state.skipOffset = 0;
  }

  function advanceTurn(state) {
    if (state.participants.length > 0) {
      state.currentIndex = candidateIndex(state);
    }
    state.currentDriverSelected = false;
    state.skipOffset = 0;
    state.paused = false;
    state.turnNumber += 1;
    state.remainingSeconds = state.durationSeconds;
  }

  function skipTurn(state, remainingSeconds) {
    if (state.participants.length < 2 || state.phase === "break") return false;
    state.drivenSeconds += state.durationSeconds - remainingSeconds;
    advanceTurn(state);
    return true;
  }

  // Caller starts the timer afterwards.
  function skipCurrentDriver(state) {
    state.drivenSeconds += state.durationSeconds - state.remainingSeconds;
    state.currentIndex = candidateIndex(state);
    state.currentDriverSelected = false;
    state.skipOffset = 0;
    state.turnNumber += 1;
    state.remainingSeconds = state.durationSeconds;
  }

  function cycleSkipOffset(state) {
    if (state.participants.length < 2) return false;
    if (state.popup === "next" || state.popup === "afterBreak") {
      if (state.currentDriverSelected) {
        state.currentDriverSelected = false;
        state.skipOffset = 0;
      } else {
        state.skipOffset = (state.skipOffset + 1) % state.participants.length;
      }
      return true;
    }
    return false;
  }

  function skipBreak(state) {
    if (state.popup !== "break" || state.participants.length < 1) return false;
    state.phase = "driving";
    state.drivenSeconds = 0;
    if (!state.currentDriverSelected) state.currentIndex = candidateIndex(state);
    state.currentDriverSelected = false;
    state.skipOffset = 0;
    state.turnNumber += 1;
    state.remainingSeconds = state.durationSeconds;
    return true;
  }

  // Applies the primary popup button; returns true when the timer should start.
  function acceptPopup(state) {
    if (state.participants.length < 1) return false;
    if (state.popup === "resume") {
      state.currentDriverSelected = false;
      return true;
    }
    if (state.popup === "break") {
      state.phase = "break";
      state.drivenSeconds = 0;
      state.remainingSeconds = state.breakSeconds;
    } else {
      state.phase = "driving";
      if (!state.currentDriverSelected) state.currentIndex = candidateIndex(state);
      state.currentDriverSelected = false;
      state.skipOffset = 0;
      state.turnNumber += 1;
      state.remainingSeconds = state.durationSeconds;
    }
    return true;
  }

  function resetState(state) {
    state.running = false;
    state.popup = null;
    state.paused = false;
    state.skipOffset = 0;
    state.currentDriverSelected = false;
    state.phase = "driving";
    state.drivenSeconds = 0;
    state.deadline = null;
    state.remainingSeconds = state.durationSeconds;
    state.currentIndex = 0;
    state.turnNumber = 1;
  }

  function leaveRotation(state, index) {
    const [name] = state.participants.splice(index, 1);
    if (state.currentDriverSelected && index === state.currentIndex) state.currentDriverSelected = false;
    if (index < state.currentIndex) state.currentIndex -= 1;
    if (state.currentIndex >= state.participants.length) state.currentIndex = 0;
    return name;
  }

  function sitOut(state, index) {
    state.potential.push(leaveRotation(state, index));
  }

  function rejoinRotation(state, index) {
    const [name] = state.potential.splice(index, 1);
    state.participants.push(name);
  }

  function deletePotential(state, index) {
    state.potential.splice(index, 1);
  }

  function applyDuration(state, seconds) {
    state.durationSeconds = seconds;
    if (state.phase === "driving") {
      state.remainingSeconds = seconds;
      state.paused = false;
      state.turnNumber = 1;
    }
  }

  function applyBreakInterval(state, seconds) {
    state.breakIntervalSeconds = seconds;
  }

  function applyBreakDuration(state, seconds) {
    state.breakSeconds = seconds;
    if (state.phase === "break") state.remainingSeconds = seconds;
  }

  function randomizeParticipants(state) {
    if (state.participants.length < 2) return;
    // Fisher-Yates shuffle algorithm
    for (let i = state.participants.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [state.participants[i], state.participants[j]] = [state.participants[j], state.participants[i]];
    }
    // Reset currentIndex to 0 after shuffling
    state.currentIndex = 0;
    state.currentDriverSelected = false;
    state.skipOffset = 0;
  }

  const api = {
    DEFAULT_DURATION, DEFAULT_BREAK_DURATION, DEFAULT_BREAK_INTERVAL, MAX_DURATION, MAX_BREAK_INTERVAL,
    readMinutes, readNames, parseSavedSession, serializeSession, formatTime, createState,
    phaseSeconds, currentRemainingSeconds, candidateIndex, expireTurn, advanceTurn, skipTurn, skipCurrentDriver,
    selectCurrentDriver, cycleSkipOffset, skipBreak, acceptPopup, resetState, leaveRotation, sitOut, rejoinRotation,
    deletePotential, applyDuration, applyBreakInterval, applyBreakDuration, randomizeParticipants
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.MobLogic = api;
})(typeof window !== "undefined" ? window : globalThis);
