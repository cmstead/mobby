# Feature: Remove mobber from rotation

## Rules:
* Removed mobber must not be deleted
* Delete mobber must remain as is

### Scenario: Remove mobber
* Given there is a mobber in the rotation list
* When a user selects them to be removed
* Then they are moved to a list of potential mobbers

### Scenario: Return mobber
* Given there is a mobber in the out of rotation list
* When they are selected to be added to the rotation
* They are added to the rotation list
* And removed from the potential mobber list