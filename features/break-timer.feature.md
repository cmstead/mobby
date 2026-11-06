# Feature: break time

## Rules:
* break duration defaults to 10 minutes
* break duration should be configurable in minutes
* duration between breaks defaults to 50 minutes
* duration between breaks should be configurable in minutes

### Scenario: Break begins
* Given driver has finished driving
* When the duration between breaks is complete
* Then display a popup with a button to begin break
* And bring timer to the front of all windows

### Scenario: Break ends
* Given the break timer is running
* When the timer duration is up
* Then display a popup with a button to start the next driver session
* And bring timer to the front of all windows

### Scenario: Duration between breaks incomplete
* Given the duration between breaks has not completed
* When a driver session has completed
* Then show the next session popup as expected