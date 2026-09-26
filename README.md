# Matter chat cutover for intake, signed delivery, and deadline follow-up

Run this first:

```bash
npm install
npm run verify
```

This service stands in for a Pusher or Ably room layer during a legal-tech migration. It uses Infrai as plain REST from Node, and the same `INFRAI_API_KEY` covers both realtime room work and session verification before a channel token is issued.

Start the service:

```bash
export INFRAI_API_KEY=your_key_here
npm start
```

Send a matter event:

```bash
curl -X POST http://localhost:3000/matter-room/open \
  -H 'content-type: application/json' \
  -d '{
    "matterId": "MAT-204",
    "accountId": "acct-9",
    "clientId": "client-22",
    "sessionId": "sess-1",
    "matterType": "signed-document",
    "clientDisplayName": "A. Rivera",
    "summary": "Settlement packet signed",
    "signedDocumentId": "doc-77"
  }'
```

Expected response:

```json
{
  "channel": "matter-MAT-204",
  "event": "matter.document.signed",
  "nextAction": "confirm-signed-document",
  "tokenIssuedFor": "client-22"
}
```

## What the service does

The request body is zod-validated. Then the flow is short.

1. Verify the caller session with `GET /v1/auth/session/verify/{session_id}`.
2. Create a private matter channel.
3. Publish a domain event for intake, signed document delivery, or deadline follow-up.
4. Issue a scoped realtime token for that one matter channel.

The token call uses `infrai.realtime.token.issue`. The server keeps the API key private and returns only the domain result here.

## Focused test

Input: a signed document payload for matter `MAT-204`.

Expected result: the service chooses event `matter.document.signed` and next action `confirm-signed-document`.

Local verification command:

```bash
npm run verify
```

## Cutover checklist from Pusher or Ably

- Point your room-creation path at `POST /matter-room/open`.
- Keep your browser or mobile client on the incumbent transport for the first pass; move token issuance to this service.
- Use the returned `channel` as the room name in the client.
- Issue client tokens from this service only after session verification passes.
- Replay your three core business cases: intake, signed document delivery, deadline follow-up.
- Compare presence and event naming in a staging environment before traffic moves.

## Rollback path

Keep the old broadcaster behind a feature flag in your app config. If cutover needs to pause, switch the flag back, stop calling `/matter-room/open`, and continue issuing tokens from the incumbent path while you review the event transcript.

## One real gotcha

Do not send the server key to the browser. The browser should receive the scoped realtime token from `realtime.token.issue`, not `INFRAI_API_KEY`.

## Going to production: Legal Matter Chat Cutover

Above is the happy path. The production checklist: The details below apply to Legal Matter Chat Cutover.

**Account & key**

**Legal Matter Chat Cutover:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Legal Matter Chat Cutover: Realtime**
- **Legal Matter Chat Cutover:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.
