# community-shielded-voting · ZAL sprint proposal draft

This file is adapted to the current `Sprint Proposal` issue template in `ZcashApplicationsLab/lab`.

## Issue-ready draft

**Pitch**

`community-shielded-voting` is a live reference implementation of invite-based shielded voting on Zcash for community pilots. It already supports poll creation, staged `Open poll` execution, temporary voter credentials, single locked QR voting via ZIP-321, duplicate protection, public reconciled results, and one-block receipt delivery. This matters because it turns Zcash shielded transfers into a working voting product that real communities can run now, while also creating a concrete base for future privacy upgrades such as stronger operator separation and membership-proof voting.

**Who is leading it?**

`@Michae2xl`

**How long?**

`3 weeks`

**Vertical**

`Private Voting & DAO Governance`

**Planned start**

`whenever the repo is ready`

**What happens after the sprint?**

Keep running community pilots, publish the repo and writeup as a reusable reference implementation, and use the shipped artifact to scope a v2 focused on privacy hardening and later membership-proof voting.

**Anything else worth knowing?**

- Public repo: [Michae2xl/community-shielded-voting](https://github.com/Michae2xl/community-shielded-voting)
- The system is already live and has already been tested end-to-end with the team.
- Current flow already includes:
  - admin review-first poll creation
  - staged `Open poll`
  - invite email delivery
  - poll-scoped login
  - choice lock before QR generation
  - one QR per ticket
  - fast note detection
  - one-block confirmed receipt email
  - public reconciled poll board
- Zcash pieces already in use:
  - `z_sendmany`
  - `z_getaddressforaccount`
  - `z_listunspent`
  - ZIP-321 QR requests
  - `zallet` as collector RPC bridge
- The project is best framed as a strong community pilot rail and reference implementation, not yet a final trustless voting primitive.
- Key docs:
  - [README](../README.md)
  - [Architecture](./architecture.md)
  - [Zcash Flow](./zcash-flow.md)
  - [Privacy Model](./privacy-model.md)
  - [Threat Model](./threat-model.md)
  - [Roadmap](./roadmap.md)

## Diagram links to highlight in the issue

- [Architecture diagram](./architecture.md)
- [Zcash voting flow diagram](./zcash-flow.md)

## Optional shorter version

If you want a tighter issue body, use this:

**Pitch**

`community-shielded-voting` is a live invite-based shielded voting system on Zcash for community pilots. It already supports admin poll creation and opening, temporary voter credentials, single locked QR voting via ZIP-321, duplicate protection, reconciled public results, and one-block receipt delivery. The sprint would package, document, and harden it as a reusable Lab reference implementation for private community voting on Zcash.

**Who is leading it?**

`@Michae2xl`

**How long?**

`3 weeks`

**Vertical**

`Private Voting & DAO Governance`

**Planned start**

`whenever the repo is ready`

**What happens after the sprint?**

Publish it as a reusable reference implementation, keep running pilots, and use the result to define a privacy-hardening v2.

**Anything else worth knowing?**

Live repo: [Michae2xl/community-shielded-voting](https://github.com/Michae2xl/community-shielded-voting)  
Docs and diagrams: [README](../README.md), [Architecture](./architecture.md), [Zcash Flow](./zcash-flow.md)
