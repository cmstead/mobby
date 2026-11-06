const { test, expect } = require("@playwright/test");
const { APP_URL, setSetting, openApp, advance, popup, title, front } = require("./helpers");

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
  test("selects a next driver without reordering and prevents selection while running", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 50 });
    const getOrder = () => page.locator("#participant-list .participant-name").evaluateAll((nodes) =>
      nodes.map((node) => node.childNodes[0].textContent.trim())
    );
    const originalOrder = await getOrder();

    await page.getByRole("button", { name: "Set Jo as next driver" }).click();
    await expect(page.locator("#next-driver")).toHaveText("Jo");
    await expect(page.getByRole("button", { name: "Set Jo as next driver" })).toHaveAttribute("aria-pressed", "true");
    expect(await getOrder()).toEqual(originalOrder);

    await page.locator("#start-pause").click();
    await expect(page.locator("#current-driver")).toHaveText("Sam");
    const selectAlex = page.getByRole("button", { name: "Set Alex as next driver" });
    await expect(selectAlex).toBeDisabled();
    await selectAlex.evaluate((button) => button.click());
    await expect(page.locator("#next-driver")).toHaveText("Jo");
    await advance(page, 1);
    await expect(popup(page)).toBeVisible();
    await expect(page.locator("#start-next-turn")).toHaveText("Start Jo's turn");
    await page.locator("#start-next-turn").click();

    await expect(page.locator("#current-driver")).toHaveText("Jo");
    expect(await getOrder()).toEqual(originalOrder);
  });

  test("a paused timer allows changing the next driver", async ({ page }) => {
    await openApp(page, { names: ["Sam", "Alex", "Jo"], breakInterval: 50 });
    await page.locator("#start-pause").click();
    await page.locator("#start-pause").click();
    await page.getByRole("button", { name: "Set Jo as next driver" }).click();
    await expect(page.locator("#current-driver")).toHaveText("Sam");
    await expect(page.locator("#next-driver")).toHaveText("Jo");
    await page.locator("#start-pause").click();
    await page.locator("#start-next-turn").click();
    await advance(page, 1);
    await expect(page.locator("#start-next-turn")).toHaveText("Start Jo's turn");
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
        const name = await page.locator(`#participant-list li:nth-of-type(${i + 1}) span.participant-name`).first().textContent();
        order.push(name.replace(/DRIVING/, '').trim());
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
    const firstDriver = await page.locator("#participant-list li:first-child span.participant-name").first().textContent();
    
    await page.locator("#start-pause").click(); // Resume to check
    await expect(page.locator("#current-driver")).toHaveText(firstDriver.replace(/DRIVING/, '').trim());
  });
});
