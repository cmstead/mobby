const { test, expect } = require("@playwright/test");
const { APP_URL, setSetting, openApp, advance, popup, title, front, fullscreen, minimized } = require("./helpers");

test.describe("Feature: full screen", () => {
  test("brings the window to the front and goes full screen when the timer expires", async ({ page }) => {
    await openApp(page, { breakInterval: 50 });
    await page.locator("#start-pause").click();
    await advance(page, 1);

    await expect(popup(page)).toBeVisible();
    await expect(page.locator("#session-status")).toHaveText("WAITING");
    expect(await front(page)).toBeGreaterThan(0);
    expect(await fullscreen(page)).toBeGreaterThan(0);
  });

  test("minimizes the application when a fresh session starts", async ({ page }) => {
    await openApp(page, { breakInterval: 50 });
    await page.locator("#start-pause").click();

    await expect(page.locator("#session-status")).toHaveText("IN PROGRESS");
    expect(await minimized(page)).toBeGreaterThan(0);
  });

  test("minimizes the application when a new driver starts from the fullscreen popup", async ({ page }) => {
    await openApp(page, { breakInterval: 50 });
    await page.locator("#start-pause").click();
    await advance(page, 1);

    await expect(popup(page)).toBeVisible();
    const beforeMinimize = await minimized(page);
    await page.locator("#start-next-turn").click();

    await expect(page.locator("#session-status")).toHaveText("IN PROGRESS");
    expect(await minimized(page)).toBeGreaterThan(beforeMinimize);
  });

  test("does nothing when an action other than starting a session happens", async ({ page }) => {
    await openApp(page, { breakInterval: 50 });
    await page.locator("#start-pause").click();
    const initialMinimizes = await minimized(page);

    await page.locator("#start-pause").click();
    await expect(page.locator("#session-status")).toHaveText("PAUSED");
    expect(await minimized(page)).toBe(initialMinimizes);
  });
});

test.describe("Feature: Pop up when time is up", () => {
  test("popup covers the screen, offers next driver, and starts a new session", async ({ page }) => {
    await openApp(page, { breakInterval: 50 });
    await page.locator("#start-pause").click();
    await expect(page.locator("#session-status")).toHaveText("IN PROGRESS");
    await advance(page, 1);

    await expect(popup(page)).toBeVisible();
    await expect(title(page)).toHaveText("Time's up!");
    const box = await popup(page).boundingBox();
    const viewport = page.viewportSize();
    expect(box.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(box.height).toBeGreaterThanOrEqual(viewport.height - 1);
    expect(await front(page)).toBeGreaterThan(0);

    await expect(page.locator("#start-next-turn")).toHaveText("Start Alex's turn");
    await page.locator("#start-next-turn").click();
    await expect(popup(page)).not.toBeVisible();
    await expect(page.locator("#current-driver")).toHaveText("Alex");
    await expect(page.locator("#session-status")).toHaveText("IN PROGRESS");
    await expect(page.locator("#turn-caption")).toHaveText("Turn 2");
  });

});

test.describe("Feature: select driver", () => {
  test("selecting from a stopped timer changes the current driver and preserves order", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"] });
    const orderBefore = await page.locator("#participant-list .participant-name").evaluateAll((nodes) =>
      nodes.map((node) => node.childNodes[0].textContent.trim())
    );
    await page.getByRole("button", { name: "Select Jo as current driver" }).click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    await expect(page.locator("#next-driver")).toHaveText("Sam");
    await page.locator("#start-pause").click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    expect(await page.locator("#participant-list .participant-name").evaluateAll((nodes) =>
      nodes.map((node) => node.childNodes[0].textContent.trim())
    )).toEqual(orderBefore);
  });

  test("selects the current driver without reordering and prevents selection while running", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 50 });
    const getOrder = () => page.locator("#participant-list .participant-name").evaluateAll((nodes) =>
      nodes.map((node) => node.childNodes[0].textContent.trim())
    );
    const originalOrder = await getOrder();

    await page.getByRole("button", { name: "Select Jo as current driver" }).click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    await expect(page.locator("#next-driver")).toHaveText("Sam");
    await expect(page.getByRole("button", { name: "Select Jo as current driver" })).toHaveAttribute("aria-pressed", "true");
    expect(await getOrder()).toEqual(originalOrder);

    await page.locator("#start-pause").click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    const selectAlex = page.getByRole("button", { name: "Select Alex as current driver" });
    await expect(selectAlex).toBeDisabled();
    await selectAlex.evaluate((button) => button.click());
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    await advance(page, 1);
    await expect(popup(page)).toBeVisible();
    await expect(page.locator("#start-next-turn")).toHaveText("Start Sam's turn");
    await page.locator("#start-next-turn").click();

    await expect(page.locator("#current-driver")).toHaveText("Sam");
    expect(await getOrder()).toEqual(originalOrder);
  });

  test("a paused timer allows changing the current driver without resetting the turn", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 50 });
    await page.locator("#start-pause").click();
    await page.locator("#start-pause").click();
    await page.getByRole("button", { name: "Select Jo as current driver" }).click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    await expect(page.locator("#next-driver")).toHaveText("Sam");
    await page.locator("#start-pause").click();
    await page.locator("#start-next-turn").click();
    await advance(page, 1);
    await expect(page.locator("#start-next-turn")).toHaveText("Start Sam's turn");
  });

  for (const stage of ["turn", "break prompt", "break end"]) {
    test(`chooses from the roster at ${stage} and returns to the pending popup`, async ({ page }) => {
      await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: stage === "turn" ? 50 : 1 });
      await page.locator("#start-pause").click();
      await advance(page, 1);
      if (stage === "break end") {
        await page.locator("#start-next-turn").click();
        await advance(page, 1);
      }

      await expect(title(page)).toHaveText(
        stage === "turn" ? "Time's up!" : stage === "break prompt" ? "Time for a break!" : "Break's over!"
      );
      await expect(page.locator("#session-status")).toHaveText("WAITING");
      await page.getByRole("button", { name: "Choose driver" }).click();
      await expect(popup(page)).not.toBeVisible();
      await expect(page.getByRole("button", { name: "Select Alex as current driver" })).toBeFocused();
      await expect(page.locator("#choose-driver-hint")).toBeVisible();
      const jo = page.getByRole("button", { name: "Select Jo as current driver" });
      await jo.focus();
      await page.keyboard.press("Enter");
      await expect(jo).toBeFocused();
      await expect(jo).toHaveAttribute("aria-pressed", "true");
      if (stage !== "break end") await expect(page.locator("#current-driver")).toHaveText("Jo");
      await expect(page.locator("#next-driver")).toHaveText("Jo");
      await expect(page.locator("#participant-list .participant").filter({ has: jo })).toContainText("UP NEXT");
      const order = await page.locator("#participant-list .participant-name").evaluateAll((nodes) =>
        nodes.map((node) => node.childNodes[0].textContent.trim())
      );
      expect(order).toEqual(["Sam", "Alex", "Jo"]);

      await page.getByRole("button", { name: "Continue to popup" }).click();
      await expect(popup(page)).toBeVisible();
      if (stage === "break prompt") {
        await expect(page.locator("#start-next-turn")).toHaveText("Begin break");
        await page.locator("#start-next-turn").click();
        await advance(page, 1);
      }
      await expect(page.locator("#start-next-turn")).toHaveText("Start Jo's turn");
      await expect(page.locator("#expiry-description")).toContainText("Jo");
      await page.locator("#start-next-turn").click();
      await expect(page.locator("#current-driver")).toHaveText("Jo");
      await expect(page.locator("#next-driver")).toHaveText("Sam");
    });
  }

  test("choosing from the resume popup preserves the paused turn", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 50 });
    await page.locator("#start-pause").click();
    await page.locator("#start-pause").click();
    await page.locator("#start-pause").click();
    await page.getByRole("button", { name: "Choose driver" }).focus();
    await page.keyboard.press("Enter");
    const jo = page.getByRole("button", { name: "Select Jo as current driver" });
    await jo.click();
    await expect(jo).toBeFocused();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    await expect(page.locator("#next-driver")).toHaveText("Sam");
    await page.getByRole("button", { name: "Continue to popup" }).click();
    await expect(title(page)).toHaveText("Resume session?");
    await expect(page.locator("#session-status")).toHaveText("PAUSED");
    await expect(page.locator("#start-next-turn")).toHaveText("Resume Jo");
    await expect(page.locator("#next-driver")).toHaveText("Sam");
    await expect(page.locator("#participant-list .participant").filter({ has: jo })).not.toContainText("UP NEXT");
    await page.locator("#start-next-turn").click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    await advance(page, 1);
    await expect(page.locator("#start-next-turn")).toHaveText("Start Sam's turn");
  });

  test("selection from the break prompt is honored when skipping the break", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 1 });
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await page.getByRole("button", { name: "Choose driver" }).click();
    await page.getByRole("button", { name: "Select Jo as current driver" }).click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    await page.getByRole("button", { name: "Continue to popup" }).click();
    await page.locator("#skip-break").click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    await expect(page.locator("#session-status")).toHaveText("IN PROGRESS");
    await expect(page.getByRole("button", { name: "Select Alex as current driver" })).toBeDisabled();
  });

  test("a paused break allows selection without changing the break or roster", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 1 });
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await page.locator("#start-next-turn").click();
    await expect(page.getByRole("button", { name: "Select Jo as current driver" })).toBeDisabled();
    await page.locator("#start-pause").click();
    await page.getByRole("button", { name: "Select Jo as current driver" }).click();
    await expect(page.locator("#current-driver")).toHaveText("Break time");
    await expect(page.locator("#next-driver")).toHaveText("Jo");
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await expect(page.locator("#start-next-turn")).toHaveText("Start Jo's turn");
    await expect(page.locator("#expiry-description")).toContainText("Jo");
    await page.locator("#start-next-turn").click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
  });

  test("skip driver cycles from the selected driver after returning to the popup", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 50 });
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await page.getByRole("button", { name: "Choose driver" }).click();
    await page.getByRole("button", { name: "Select Jo as current driver" }).click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
    await page.getByRole("button", { name: "Continue to popup" }).click();
    await page.locator("#skip-driver").click();
    await expect(page.locator("#start-next-turn")).toHaveText("Start Sam's turn");
    await expect(page.locator("#next-driver")).toHaveText("Sam");
    await page.locator("#start-next-turn").click();
    await expect(page.locator("#current-driver")).toHaveText("Sam");
    await expect(page.locator("#next-driver")).toHaveText("Alex");
  });

  for (const recovery of ["rejoin", "add"]) {
    test(`chooser recovers after the roster is emptied and a participant is restored by ${recovery}`, async ({ page }) => {
      const restored = recovery === "rejoin" ? "Alex" : "Jo";
      await openApp(page, { names: ["Sam", "Alex"], breakInterval: 50 });
      await page.locator("#start-pause").click();
      await advance(page, 1);
      await expect(title(page)).toHaveText("Time's up!");
      await page.getByRole("button", { name: "Choose driver" }).click();
      await page.getByRole("button", { name: "Remove Sam from rotation" }).click();
      await page.getByRole("button", { name: "Remove Alex from rotation" }).click();

      await expect(popup(page)).not.toBeVisible();
      await expect(page.locator("#session-status")).toHaveText("WAITING");
      await expect(page.locator("#next-driver")).toHaveText("Add participants below");
      await expect(page.locator("#choose-driver-hint")).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue to popup" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Add Alex to rotation" })).toBeVisible();

      if (recovery === "rejoin") {
        await page.getByRole("button", { name: "Add Alex to rotation" }).click();
      } else {
        await page.getByLabel("Participant name").fill(restored);
        await page.getByRole("button", { name: "Add participant" }).click();
      }
      await expect(page.getByRole("button", { name: "Continue to popup" })).toBeEnabled();
      await page.getByRole("button", { name: `Select ${restored} as current driver` }).click();
      await expect(page.locator("#current-driver")).toHaveText(restored);
      await expect(page.locator("#next-driver")).toHaveText(restored);
      await page.getByRole("button", { name: "Continue to popup" }).click();
      await expect(title(page)).toHaveText("Time's up!");
      await expect(page.locator("#expiry-description")).toHaveText(`Sam's turn is over. Pass the keyboard to ${restored}.`);
      await expect(page.locator("#start-next-turn")).toHaveText(`Start ${restored}'s turn`);
      await page.locator("#start-next-turn").click();
      await expect(popup(page)).not.toBeVisible();
      await expect(page.locator("#current-driver")).toHaveText(restored);
      await expect(page.locator("#next-driver")).toHaveText(restored);
      await expect(page.locator("#session-status")).toHaveText("IN PROGRESS");
      await expect(page.getByRole("button", { name: `Select ${restored} as current driver` })).toBeDisabled();
      await advance(page, 1);
      await expect(page.locator("#expiry-description")).toHaveText(`${restored}'s turn is over. Pass the keyboard to ${restored}.`);
    });
  }

  test("a break prompt retains the finished driver after the roster is replaced", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex"], breakInterval: 1 });
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await expect(title(page)).toHaveText("Time for a break!");
    await page.getByRole("button", { name: "Choose driver" }).click();
    await page.getByRole("button", { name: "Remove Sam from rotation" }).click();
    await page.getByRole("button", { name: "Remove Alex from rotation" }).click();
    await page.getByRole("button", { name: "Add Alex to rotation" }).click();
    await page.getByRole("button", { name: "Continue to popup" }).click();
    await expect(page.locator("#expiry-description")).toHaveText("Sam has finished driving. Step away from the keyboard and rest.");
    await page.locator("#start-next-turn").click();
    await advance(page, 1);
    await expect(title(page)).toHaveText("Break's over!");
    await expect(page.locator("#start-next-turn")).toHaveText("Start Alex's turn");
    await page.locator("#start-next-turn").click();
    await expect(page.locator("#current-driver")).toHaveText("Alex");
  });

  for (const offset of [-1, 0, 1]) {
    test(`pausing ${offset}ms relative to a turn deadline handles it once`, async ({ page }) => {
      await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 50 });
      await page.getByRole("button", { name: "Select Jo as current driver" }).click();
      await page.clock.pauseAt(new Date("2026-01-01T10:00:00"));
      await page.locator("#start-pause").click();
      const now = await page.evaluate(() => Date.now());
      await page.clock.setSystemTime(new Date(now + 60000 + offset));
      await page.locator("#start-pause").click();
      if (offset < 0) {
        await expect(popup(page)).not.toBeVisible();
        await page.locator("#start-pause").click();
        await expect(title(page)).toHaveText("Resume session?");
        await expect(page.locator("#start-next-turn")).toHaveText("Resume Jo");
      } else {
        await expect(title(page)).toHaveText("Time's up!");
        await expect(page.locator("#start-next-turn")).toHaveText("Start Sam's turn");
        await page.locator("#start-next-turn").click();
        await expect(page.locator("#current-driver")).toHaveText("Sam");
        await expect(page.locator("#turn-caption")).toHaveText("Turn 2");
      }
    });
  }

  test("pausing after a break deadline shows the break-end popup", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 1 });
    await page.getByRole("button", { name: "Select Jo as current driver" }).click();
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00"));
    await page.locator("#start-next-turn").click();
    const now = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(new Date(now + 60001));
    await page.locator("#start-pause").click();
    await expect(title(page)).toHaveText("Break's over!");
    await expect(page.locator("#start-next-turn")).toHaveText("Start Sam's turn");
    await page.locator("#start-next-turn").click();
    await expect(page.locator("#current-driver")).toHaveText("Sam");
  });

  test("pausing at a turn deadline still triggers a due break", async ({ page }) => {
    await openApp(page, { breakInterval: 1 });
    await page.clock.pauseAt(new Date("2026-01-01T10:00:00"));
    await page.locator("#start-pause").click();
    const now = await page.evaluate(() => Date.now());
    await page.clock.setSystemTime(new Date(now + 60000));
    await page.locator("#start-pause").click();
    await expect(title(page)).toHaveText("Time for a break!");
    await expect(page.locator("#skip-break")).toBeVisible();
  });
});

test.describe("Feature: break time", () => {
  test("break settings default to 10 and 50 and are configurable", async ({ page }) => {
    await page.goto(APP_URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.locator("#break-duration")).toHaveValue("10");
    await expect(page.locator("#break-interval")).toHaveValue("50");
    await setSetting(page, "#break-duration", 15);
    await setSetting(page, "#break-interval", 30);
    await page.reload();
    await expect(page.locator("#break-duration")).toHaveValue("15");
    await expect(page.locator("#break-interval")).toHaveValue("30");
  });

  test("break begins after the interval, and break end prompts next driver", async ({ page }) => {
    await openApp(page);
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await expect(title(page)).toHaveText("Time's up!");
    await page.locator("#start-next-turn").click();
    await advance(page, 1);

    await expect(popup(page)).toBeVisible();
    await expect(title(page)).toHaveText("Time for a break!");
    await expect(page.locator("#start-next-turn")).toHaveText("Begin break");
    const frontBefore = await front(page);
    expect(frontBefore).toBeGreaterThan(1);

    await page.locator("#start-next-turn").click();
    await expect(popup(page)).not.toBeVisible();
    await advance(page, 1);

    await expect(popup(page)).toBeVisible();
    await expect(page.locator("#start-next-turn")).toContainText("Start");
    await expect(page.locator("#start-next-turn")).not.toHaveText("Begin break");
    expect(await front(page)).toBeGreaterThan(frontBefore);
    await page.locator("#start-next-turn").click();
    await expect(page.locator("#session-status")).toHaveText("IN PROGRESS");
  });

  test("regular popup when break interval is not reached", async ({ page }) => {
    await openApp(page, { breakInterval: 50 });
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await expect(title(page)).toHaveText("Time's up!");
    await expect(page.locator("#start-next-turn")).toHaveText("Start Alex's turn");
  });
});

test.describe("Feature: Skip break", () => {
  test("skip break starts a new session and resets time to next break", async ({ page }) => {
    await openApp(page);
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await page.locator("#start-next-turn").click();
    await advance(page, 1);

    await expect(title(page)).toHaveText("Time for a break!");
    const skip = page.locator("#skip-break");
    await expect(skip).toBeVisible();
    await expect(skip).toHaveText("Skip break");
    await expect(page.locator("#start-next-turn")).toBeVisible();

    await skip.click();
    await expect(popup(page)).not.toBeVisible();
    await expect(page.locator("#session-status")).toHaveText("IN PROGRESS");
    await expect(page.locator("#turn-caption")).toHaveText("Turn 3");

    await advance(page, 1);
    await expect(title(page)).toHaveText("Time's up!");
    await expect(page.locator("#skip-break")).toBeHidden();
    await page.locator("#start-next-turn").click();
    await advance(page, 1);
    await expect(title(page)).toHaveText("Time for a break!");
  });
});

test.describe("Feature: skip driver", () => {
  test("skip the next driver from the session popup", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 50 });
    await page.locator("#start-pause").click();
    await advance(page, 1);
    await expect(page.locator("#start-next-turn")).toHaveText("Start Alex's turn");

    await page.locator("#skip-driver").click();
    await expect(page.locator("#start-next-turn")).toHaveText("Start Jo's turn");
    await page.locator("#start-next-turn").click();
    await expect(page.locator("#current-driver")).toHaveText("Jo");
  });

  test("skip the current driver when resuming from pause", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 50, duration: 5 });
    await page.locator("#start-pause").click();
    await expect(page.locator("#current-driver")).toHaveText("Sam");
    await page.locator("#start-pause").click();
    await page.locator("#start-pause").click();

    await expect(popup(page)).toBeVisible();
    await expect(page.locator("#cancel-popup")).toHaveText("Keep paused");
    await expect(page.locator("#skip-driver")).toBeVisible();
    await page.locator("#skip-driver").click();
    await expect(popup(page)).not.toBeVisible();
    await expect(page.locator("#current-driver")).toHaveText("Alex");
  });
});

test.describe("Feature: Remove mobber from rotation", () => {
  test("sit out moves a mobber to potential mobbers without deleting", async ({ page }) => {
    await openApp(page);
    await page.getByRole("button", { name: "Remove Alex from rotation" }).click();
    await expect(page.locator("#participant-list")).not.toContainText("Alex");
    await expect(page.locator("#potential-list")).toContainText("Alex");
    await expect(page.locator("#potential-count")).toHaveText("(1)");
  });

  test("rejoin returns a mobber to rotation and removes from potential", async ({ page }) => {
    await openApp(page, { potential: ["Jo"] });
    await expect(page.locator("#potential-list")).toContainText("Jo");
    await page.getByRole("button", { name: "Add Jo to rotation" }).click();
    await expect(page.locator("#participant-list")).toContainText("Jo");
    await expect(page.locator("#potential-list")).not.toContainText("Jo");
  });

  test("delete still removes a mobber permanently", async ({ page }) => {
    await openApp(page, { potential: ["Jo"] });
    await page.getByRole("button", { name: "Delete Sam" }).click();
    await page.getByRole("button", { name: "Delete Jo" }).click();
    await expect(page.locator("#participant-list")).not.toContainText("Sam");
    await expect(page.locator("#potential-list")).not.toContainText("Jo");
    await page.reload();
    await expect(page.locator("body")).not.toContainText("Jo");
    await expect(page.locator("body")).not.toContainText("Sam");
  });
});

test.describe("Feature: Randomize drivers", () => {
  test("randomize button is disabled with fewer than two participants", async ({ page }) => {
    await openApp(page, { names: ["Sam"] });
    await expect(page.locator("#randomize-drivers")).toBeDisabled();
  });

  test("randomize button is enabled with two or more participants", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex"] });
    await expect(page.locator("#randomize-drivers")).toBeEnabled();
  });

  test("randomize changes the driver order and updates the UI", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"] });
    
    // Get initial order by reading participant list
    const getOrder = async () => {
      const items = await page.locator("#participant-list li").count();
      const order = [];
      for (let i = 0; i < items; i++) {
        const name = await page.locator(`#participant-list li:nth-of-type(${i + 1}) span.participant-name`).first()
          .evaluate((node) => node.childNodes[0].textContent.trim());
        order.push(name);
      }
      return order;
    };
    
    const originalOrder = await getOrder();
    
    // Randomize the order (retry until we get a different order)
    let newOrder = originalOrder;
    for (let i = 0; i < 10; i++) {
      await page.locator("#randomize-drivers").click();
      newOrder = await getOrder();
      if (newOrder.join(",") !== originalOrder.join(",")) {
        break;
      }
    }
    
    // Verify the order changed (or we tried 10 times - test may be flaky without change)
    expect(newOrder.join(",")).not.toBe(originalOrder.join(","));
    
    // Verify all original names are still present
    for (const name of originalOrder) {
      await expect(page.locator("#participant-list")).toContainText(name);
    }
  });

  test("current driver resets to first after randomize", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"] });
    await page.locator("#start-pause").click();
    await expect(page.locator("#current-driver")).toHaveText("Sam");
    
    await page.locator("#start-pause").click(); // Pause to allow randomize
    await page.locator("#randomize-drivers").click();
    
    // After randomize, get the first driver's name from the list
    const firstDriver = await page.locator("#participant-list li:first-child span.participant-name").first()
      .evaluate((node) => node.childNodes[0].textContent.trim());
    
    await page.locator("#start-pause").click(); // Resume to check
    await expect(page.locator("#current-driver")).toHaveText(firstDriver);
  });
});
