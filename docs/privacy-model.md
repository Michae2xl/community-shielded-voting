# Privacy Model

## What the system protects well

### Public observers
- do not see the selected option by voter
- do not see a public mapping of voter identity to receipt
- only see reconciled poll results on the public board

### Admin UI operators
- can see who completed voting
- cannot see which answer a completed voter selected from the normal admin interface

### Chain observers
- vote transport uses shielded transfers rather than transparent addresses

## What the system does not fully solve yet

- a privileged operator with app, database, and collector access can still correlate more than a public observer
- eligibility is still invite-based and identity-aware
- this is not yet a membership-proof system
- this is not yet a trustless tally system

## Current positioning

This project should be described as:

**shielded voting for community pilots**

It should not yet be described as:

**fully trustless anonymous voting against a privileged operator**

## v2 direction

The next privacy-hardening path is:
- identity layer separated from vote core
- pseudonymous subject references
- encrypted sensitive mappings
- stronger collector isolation
- later, membership-proof eligibility
