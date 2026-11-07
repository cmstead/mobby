const path = require("path");
const { pathToFileURL } = require("url");

const APP_URL = pathToFileURL(path.join(__dirname, "..", "src", "index.html")).href;

async function setSetting(page, selector, value) {
  await page.locator(selector).fill(String(value));
  await page.locator(selector).dispatchEvent("change");
}

async function addPerson(page, name) {
  await page.locator("#person-name").fill(name);
  await page.locator("#add-person-form").evaluate((f) => f.requestSubmit());
}

// Opens the app with a controllable clock, a recording window bridge, and a seeded roster.
async function openApp(page, { names = ["Sam", "Alex"], potential = [], duration = 1, breakInterval = 2, breakDuration = 1 } = {}) {
  await page.addInitScript(() => {
    window.__bridge = { front: 0, release: 0, fullScreen: 0, minimized: 0 };
    window.mobTimerWindow = {
      bringExpiryToFront: () => window.__bridge.front++,
      releaseExpiryToFront: () => window.__bridge.release++,
      setFullScreen: (value) => {
        window.__bridge.fullScreen += value ? 1 : 0;
      },
      minimizeWindow: () => window.__bridge.minimized++,
    };
  });
  await page.clock.install({ time: new Date("2026-01-01T09:00:00") });
  await page.goto(APP_URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await setSetting(page, "#duration", duration);
  await setSetting(page, "#break-interval", breakInterval);
  await setSetting(page, "#break-duration", breakDuration);
  for (const name of names) await addPerson(page, name);
  for (const name of potential) {
    await addPerson(page, name);
    await page.getByRole("button", { name: `Remove ${name} from rotation` }).click();
  }
}

async function advance(page, minutes) {
  await page.clock.fastForward(minutes * 60 * 1000 + 1000);
}

const popup = (page) => page.locator("#expiry-popup");
const title = (page) => page.locator("#expiry-title");
const front = (page) => page.evaluate(() => window.__bridge.front);
const fullscreen = (page) => page.evaluate(() => window.__bridge.fullScreen);
const minimized = (page) => page.evaluate(() => window.__bridge.minimized);

module.exports = { APP_URL, setSetting, openApp, advance, popup, title, front, fullscreen, minimized };
