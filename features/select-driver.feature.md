# Feature: select driver

## Rules:
* selecting a driver does not change the driver order
* selecting a driver can only be done while the timer is not running
* selecting a driver sets the current driver

### Scenario: Select a driver
* Given the timer is not running
* When a driver is selected from the list
* Then the selected driver is set as the current driver
* And the driver order is unchanged

### Scenario: Do not select a driver
* Given the timer is running
* When a driver is selected from the list
* Then do nothing.

### Scenario: Select from an expiry or break popup
* Given an expiry, break, or break-end popup is open
* When a driver is selected from the team list
* Then the selected driver is set as the current driver
* And continuing the popup starts that driver without advancing past them

### Scenario: Select from a resume popup
* Given the timer is paused
* When a driver is selected from the team list
* Then the selected driver is set as the current driver
* And resuming keeps the selected driver and the paused time remaining