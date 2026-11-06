# Feature: Pop up when time is up

### Scenario: display popup

* Given the timer is running
* When the time for a driver is up
* Then display a notification popup

#### Popup details

* popup should cover screen
* popup should provide a button for the next driver to begin
* when next driver button is pressed, start a new session