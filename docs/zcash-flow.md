# Zcash Flow

This system uses Zcash as the transport rail for votes, not just as a payment reference.

## Calls used

- `z_sendmany`
  - submit the anchor transaction for a poll
- `z_getaddressforaccount`
  - allocate unique shielded addresses for vote requests
- `z_listunspent(minconf=0)`
  - detect incoming notes quickly and hide the QR
- `z_listunspent(minconf=1)`
  - confirm the note and finalize the vote receipt
- `z_getoperationstatus`
  - track async anchor completion

## Voting sequence

```mermaid
sequenceDiagram
  participant App
  participant Zallet
  participant Zcash
  participant Wallet

  App->>Zallet: z_getaddressforaccount
  Zallet-->>App: shielded address for vote request
  App-->>Wallet: ZIP-321 QR with address + amount + memo

  Wallet->>Zcash: shielded transfer
  Zcash->>Zallet: note received in collector account

  App->>Zallet: z_listunspent(minconf=0)
  Zallet-->>App: note observed
  App->>App: lock or hide QR quickly

  App->>Zallet: z_listunspent(minconf=1)
  Zallet-->>App: confirmed note
  App->>App: reconcile, dedupe, mark VOTED, send receipt
```

## Important behavior

- one vote request uses one unique shielded destination
- the voter sees one locked QR after confirming their choice
- duplicate sends from the same ticket are reconciled and ignored in the valid tally
- the public board uses reconciled results, not collector-raw counts
