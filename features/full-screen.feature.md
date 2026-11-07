# Feature: full screen

### Scenario: full screen when timer is up
* Given the timer is up
* When it is time to switch drivers
* Then bring the window to the front
* And make it full screen

### Scenario: Minimize on session start
* Given the timer is not running
* When a new driver starts the timer
* Then start the session
* And minimize the application

### Scenario: Minimize on next driver start
* Given the timer is full screen
* When a new driver starts the timer
* Then start the session
* And minimize the application

### Scenario: Do nothing
* Given the application is open
* When anything other than a session is started
* Then leave the application as it is