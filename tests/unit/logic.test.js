const { test, describe } = require("node:test");
const assert = require("node:assert/strict");
const logic = require("../../src/logic");

function make(overrides = {}) {
  const state = logic.createState({
    participants: ["Sam", "Alex", "Jo"],
    potential: [],
    duration: 5,
    breakInterval: 10,
    breakDuration: 2
  });
  return Object.assign(state, overrides);
}

describe("session parsing and persistence", () => {
  test("defaults: 5 minute turns, 10 minute break every 50 minutes", () => {
    const s = logic.parseSavedSession(null);
    assert.equal(s.duration, 5);
    assert.equal(s.breakDuration, 10);
    assert.equal(s.breakInterval, 50);
    assert.deepEqual(s.participants, []);
  });

  test("invalid JSON falls back to defaults", () => {
    assert.equal(logic.parseSavedSession("{nope").breakInterval, 50);
  });

  test("out-of-range or non-integer minutes fall back to defaults", () => {
    const s = logic.parseSavedSession(JSON.stringify({ duration: 0, breakInterval: 999, breakDuration: 1.5 }));
    assert.equal(s.duration, 5);
    assert.equal(s.breakInterval, 50);
    assert.equal(s.breakDuration, 10);
  });

  test("blank and non-string names are dropped", () => {
    assert.deepEqual(logic.readNames(["Sam", " ", 3, "Alex"]), ["Sam", "Alex"]);
    assert.deepEqual(logic.readNames("nope"), []);
  });

  test("serialize round-trips configurable settings and rosters", () => {
    const state = make({ potential: ["Pat"] });
    const back = logic.parseSavedSession(logic.serializeSession(state));
    assert.deepEqual(back.participants, ["Sam", "Alex", "Jo"]);
    assert.deepEqual(back.potential, ["Pat"]);
    assert.equal(back.breakInterval, 10);
    assert.equal(back.breakDuration, 2);
  });
});

describe("formatTime", () => {
  test("formats mm:ss, rounds up, and clamps negatives", () => {
    assert.equal(logic.formatTime(300), "05:00");
    assert.equal(logic.formatTime(59.2), "01:00");
    assert.equal(logic.formatTime(-4), "00:00");
  });
});

describe("Feature: Pop up when time is up", () => {
  test("expired turn shows the next-driver popup and stops remaining time", () => {
    const s = make();
    logic.expireTurn(s);
    assert.equal(s.popup, "next");
    assert.equal(s.remainingSeconds, 0);
  });

  test("accepting the popup starts a new session with the next driver", () => {
    const s = make();
    logic.expireTurn(s);
    assert.equal(logic.acceptPopup(s), true);
    assert.equal(s.currentIndex, 1);
    assert.equal(s.turnNumber, 2);
    assert.equal(s.remainingSeconds, 300);
    assert.equal(s.phase, "driving");
  });

  test("driver order wraps around", () => {
    const s = make({ currentIndex: 2 });
    assert.equal(logic.candidateIndex(s), 0);
  });

  test("accepting does nothing without participants", () => {
    const s = make({ participants: [] });
    assert.equal(logic.acceptPopup(s), false);
  });
});

describe("Feature: break time", () => {
  test("popup is the regular one when the break interval is incomplete", () => {
    const s = make({ breakIntervalSeconds: 3000 });
    logic.expireTurn(s);
    assert.equal(s.popup, "next");
    assert.equal(s.drivenSeconds, 300);
  });

  test("break popup appears once driven time reaches the interval", () => {
    const s = make();
    logic.expireTurn(s);
    logic.acceptPopup(s);
    logic.expireTurn(s);
    assert.equal(s.popup, "break");
  });

  test("beginning the break runs the break duration and resets driven time", () => {
    const s = make({ popup: "break", drivenSeconds: 600 });
    assert.equal(logic.acceptPopup(s), true);
    assert.equal(s.phase, "break");
    assert.equal(s.remainingSeconds, 120);
    assert.equal(s.drivenSeconds, 0);
    assert.equal(s.currentIndex, 0);
    assert.equal(logic.phaseSeconds(s), 120);
  });

  test("break end shows a popup to start the next driver", () => {
    const s = make({ phase: "break" });
    logic.expireTurn(s);
    assert.equal(s.popup, "afterBreak");
    assert.equal(s.drivenSeconds, 0);
    logic.acceptPopup(s);
    assert.equal(s.phase, "driving");
    assert.equal(s.currentIndex, 1);
  });

  test("settings changes apply by phase", () => {
    const s = make();
    logic.applyBreakInterval(s, 1800);
    logic.applyBreakDuration(s, 900);
    assert.equal(s.breakIntervalSeconds, 1800);
    assert.equal(s.breakSeconds, 900);
    assert.equal(s.remainingSeconds, 300);

    const b = make({ phase: "break" });
    logic.applyBreakDuration(b, 900);
    assert.equal(b.remainingSeconds, 900);

    logic.applyDuration(s, 600);
    assert.equal(s.remainingSeconds, 600);
    assert.equal(s.turnNumber, 1);
  });
});

describe("Feature: Skip break", () => {
  test("skipping starts the next driver's session and resets the break clock", () => {
    const s = make({ popup: "break", drivenSeconds: 600 });
    assert.equal(logic.skipBreak(s), true);
    assert.equal(s.phase, "driving");
    assert.equal(s.drivenSeconds, 0);
    assert.equal(s.currentIndex, 1);
    assert.equal(s.turnNumber, 2);
    assert.equal(s.remainingSeconds, 300);
  });

  test("after skipping, the next expiry is not a break", () => {
    const s = make({ popup: "break", drivenSeconds: 600 });
    logic.skipBreak(s);
    logic.expireTurn(s);
    assert.equal(s.popup, "next");
  });

  test("cannot skip when the break popup is not showing", () => {
    const s = make({ popup: "next" });
    assert.equal(logic.skipBreak(s), false);
    assert.equal(s.turnNumber, 1);
  });
});

describe("Feature: skip driver", () => {
  test("skipping from the popup cycles to the following driver", () => {
    const s = make();
    logic.expireTurn(s);
    assert.equal(logic.cycleSkipOffset(s), true);
    assert.equal(logic.candidateIndex(s), 2);
    logic.acceptPopup(s);
    assert.equal(s.currentIndex, 2);
  });

  test("skip offset wraps and works after a break", () => {
    const s = make({ popup: "afterBreak" });
    logic.cycleSkipOffset(s);
    logic.cycleSkipOffset(s);
    assert.equal(logic.candidateIndex(s), 0);
  });

  test("skip offset is unavailable with one participant or other popups", () => {
    assert.equal(logic.cycleSkipOffset(make({ participants: ["Sam"], popup: "next" })), false);
    assert.equal(logic.cycleSkipOffset(make({ popup: "break" })), false);
  });

  test("expiry resets the skip offset", () => {
    const s = make({ skipOffset: 2 });
    logic.expireTurn(s);
    assert.equal(s.skipOffset, 0);
  });

  test("skipping the current driver while paused moves on and counts driven time", () => {
    const s = make({ paused: true, remainingSeconds: 100 });
    logic.skipCurrentDriver(s);
    assert.equal(s.currentIndex, 1);
    assert.equal(s.drivenSeconds, 200);
    assert.equal(s.remainingSeconds, 300);
    assert.equal(s.turnNumber, 2);
  });

  test("resume popup accepts without changing the driver", () => {
    const s = make({ popup: "resume", remainingSeconds: 100 });
    assert.equal(logic.acceptPopup(s), true);
    assert.equal(s.currentIndex, 0);
    assert.equal(s.remainingSeconds, 100);
  });

  test("skip turn advances the driver, and is blocked on break or with one mobber", () => {
    const s = make();
    assert.equal(logic.skipTurn(s, 120), true);
    assert.equal(s.currentIndex, 1);
    assert.equal(s.drivenSeconds, 180);
    assert.equal(logic.skipTurn(make({ phase: "break" }), 10), false);
    assert.equal(logic.skipTurn(make({ participants: ["Sam"] }), 10), false);
  });

  test("reset returns to the first driver and first turn", () => {
    const s = make({ currentIndex: 2, turnNumber: 4, drivenSeconds: 900, phase: "break", popup: "next", paused: true });
    logic.resetState(s);
    assert.equal(s.currentIndex, 0);
    assert.equal(s.turnNumber, 1);
    assert.equal(s.drivenSeconds, 0);
    assert.equal(s.phase, "driving");
    assert.equal(s.popup, null);
    assert.equal(s.paused, false);
    assert.equal(s.remainingSeconds, 300);
  });
});

describe("Feature: Remove mobber from rotation", () => {
  test("sitting out moves the mobber to potential mobbers, not deleted", () => {
    const s = make();
    logic.sitOut(s, 1);
    assert.deepEqual(s.participants, ["Sam", "Jo"]);
    assert.deepEqual(s.potential, ["Alex"]);
  });

  test("rejoining adds to the rotation and removes from potential", () => {
    const s = make({ potential: ["Pat", "Kim"] });
    logic.rejoinRotation(s, 0);
    assert.deepEqual(s.participants, ["Sam", "Alex", "Jo", "Pat"]);
    assert.deepEqual(s.potential, ["Kim"]);
  });

  test("deleting a potential mobber removes them entirely", () => {
    const s = make({ potential: ["Pat"] });
    logic.deletePotential(s, 0);
    assert.deepEqual(s.potential, []);
  });

  test("deleting from rotation (leaveRotation) does not add to potential", () => {
    const s = make();
    assert.equal(logic.leaveRotation(s, 0), "Sam");
    assert.deepEqual(s.potential, []);
  });

  test("current driver index stays on the same person when someone earlier leaves", () => {
    const s = make({ currentIndex: 2 });
    logic.sitOut(s, 0);
    assert.equal(s.participants[s.currentIndex], "Jo");
  });

  test("index wraps to zero when the last driver leaves", () => {
    const s = make({ currentIndex: 2 });
    logic.sitOut(s, 2);
    assert.equal(s.currentIndex, 0);
  });
});

describe("Feature: Randomize drivers", () => {
  test("randomizeParticipants shuffles the list", () => {
    const s = make();
    const original = [...s.participants];
    logic.randomizeParticipants(s);
    // The shuffled list should be a permutation of the original
    const sorted = s.participants.slice().sort();
    const originalSorted = original.slice().sort();
    assert.deepEqual(sorted, originalSorted);
  });

  test("randomizeParticipants resets currentIndex to 0", () => {
    const s = make({ currentIndex: 2 });
    logic.randomizeParticipants(s);
    assert.equal(s.currentIndex, 0);
  });

  test("randomizeParticipants does nothing with fewer than 2 participants", () => {
    const s = make({ participants: ["Sam"] });
    logic.randomizeParticipants(s);
    assert.deepEqual(s.participants, ["Sam"]);
  });

  test("randomizeParticipants does nothing with empty participants", () => {
    const s = make({ participants: [] });
    logic.randomizeParticipants(s);
    assert.deepEqual(s.participants, []);
  });

  test("randomizeParticipants produces different orders (probabilistic)", () => {
    // Create a state with many participants to increase likelihood of shuffle
    const participants = ["A", "B", "C", "D", "E", "F", "G", "H"];
    let differentOrderSeen = false;
    
    for (let i = 0; i < 10; i++) {
      const s = logic.createState({
        participants: [...participants],
        potential: [],
        duration: 5,
        breakInterval: 10,
        breakDuration: 2
      });
      logic.randomizeParticipants(s);
      if (s.participants.join(",") !== participants.join(",")) {
        differentOrderSeen = true;
        break;
      }
    }
    assert.equal(differentOrderSeen, true);
  });
});
