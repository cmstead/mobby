# Feature: select driver

## Rules:
* selecting a driver does not change the driver order
* selecting a driver can only be done while the timer is not running
* selecting a driver sets the next driver

### Scenario: Select a driver
* Given the timer is not running
* When a driver is selected from the list
* Then the selected driver is set as the next driver

### Scenario: Do not select a driver
* Given the timer is running
* When a driver is selected from the list
* Then do nothing.