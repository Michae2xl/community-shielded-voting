# Threat Model

## In scope for the current system

- protect the selected option from the public board
- protect the selected option from the normal admin interface
- prevent duplicate valid votes from the same ticket
- require one-block confirmation before final receipt delivery
- ensure invite-based access is scoped to the intended poll flow

## Out of scope for the current system

- anonymous membership proofs
- trustless public tally verification
- full resistance against a privileged operator with combined app, DB, and collector access

## Main operational risks

### Collector trust concentration
The collector wallet is a sensitive component. Whoever operates it has stronger visibility than a public observer.

### Identity correlation in the backend
Eligibility is still represented as invite-based voter access rows, so the app layer remains identity-aware.

### Infrastructure security
Compromise of app secrets, database credentials, or collector RPC credentials can undermine privacy and integrity.

## Mitigations in the current system

- public board uses reconciled results only
- duplicate protection is applied before public display
- invite-opened state is tied to successful login rather than raw link open
- browser write routes require a trusted same-origin request
- deploy no longer seeds predictable credentials automatically
