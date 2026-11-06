# Feature: Skip break

## Rules:
* Any break can be skipped.
* Skipping the break resets the time until next break

### Scenario: skip break
* Given the time to next break has completed
* When the break popup appears
* Then a button will be offered next to take a break
* And the button will be called "skip break"
* And when clicked it skips the break and starts a new session