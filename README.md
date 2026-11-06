# Mob Timer

A lightweight desktop timer for mob programming sessions. Add your team, choose
how long each driver has, then start the rotation.

## Run

1. Install Node.js 22.12 or newer.
2. From this folder, run `npm install`.
3. Run `npm start`.

When a turn ends, a full-window prompt announces the next driver and brings the
app in front of other windows. Click the button to begin their turn.

## Build

Installers are written to `dist/` using [electron-builder](https://www.electron.build/).

| Script | Output |
| --- | --- |
| `npm run build:win` | Windows NSIS installer (`.exe`) |
| `npm run build:mac` | macOS disk image (`.dmg`) |
| `npm run build:linux` | Linux `.AppImage` and `.tar.gz` |

Builds target the architecture of the machine running them. The installers are
unsigned and use the default Electron icon.

## Rotation list

- **Sit out:** moves a mobber from the rotation to the "Potential mobbers" list
  without deleting them. If they were driving, the next mobber takes over.
- **Rejoin:** moves a potential mobber back to the end of the rotation.
- **×:** deletes a mobber entirely, from either list.

Both lists are saved locally.

## Skipping drivers

- **At the next-driver popup:** press "Skip <name>" to pass over the selected
  driver. Each press moves to the following person in the rotation, then start
  the turn with the driver you want.
- **When resuming a paused timer:** pressing Start/Resume asks whether to
  resume the current driver or skip them (the next driver starts a fresh turn).
  "Keep paused" or Esc leaves the timer paused.

## Breaks

- Time between breaks defaults to 50 minutes and break length defaults to 10
  minutes; both are configurable in minutes.
- Once the driving time since the last break reaches the break interval, the
  next time a driver finishes, the prompt offers a break instead of the next
  driver. Otherwise the regular next-driver prompt appears.
- When the break ends, a prompt (also brought to the front) starts the next
  driver's session.

Your participant list and timer settings are saved locally in the app.
