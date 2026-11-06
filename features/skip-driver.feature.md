# Feature: skip driver

## Rules:
* A driver can be skipped during session popup
* A drivern can be skipped when the timer is paused

### Scenario: skip the next driver
* Given the next driver popup is displayed
* When choosing a new session
* Then allow the driver to skip the selected driver

### Scenario: skip the current driver
* Given the current driver is paused
* When choosing to unpause
* Then a driver may choose to skip the current driver