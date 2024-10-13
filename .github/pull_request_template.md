- [ ] Specify tickets that should be closed when merged:
Closes #____

- Specify PRs that need to be:
  - [ ] deployed before this one: #____ / none
  - [ ] merged before this one: #____ / none

## Specify which kind of change this PR introduces (keep applicable)
<!-- START type -->
- [ ] Bugfix / Improvement / New feature / Refactor / Infrastructure / Other (please specify)
<!-- END type -->


## How would you describe the changes in the customer visible changelog (1-2 lines)?
<!-- START changelog -->
Description / no user visible changes
<!-- END changelog -->

## What was done

## How it was and should be tested

Approved PRs that have no QA_needed label are considered production ready with no further testing by QA.

- [ ] QA_needed label has been added / regression testing is not needed.

## REST API

- [ ] REST API Documentation has been update or is not needed.

## Risks

Please assess risk & follow up on deployment of this PR.

- [ ] Risk assessment: (remove not relevant and add notes)

<!-- START risk -->
 * Can not be easily reverted
 * Changes not covered by automated tests
 * Can break backwards compatibility
 * Touches central functionality
 * Feels risky
 * Non-trivial changes
<!-- END risk -->

## Reviewer Notes

- [ ] Approved and tested according to https://github.com/Mjoll/mimir/wiki/Review-checklist

## Deploy follow up
<!-- START follow_up -->
- [ ] Follow up deploy tasks are described here if needed. Describe if tasks need to be performed before or after the deploy and the urgency/timing of them, if relevant.
<!-- END follow_up -->
## QA - if regression testing was requested:

- [ ] QA has verified or no QA_needed label was present
