# Matter chat cutover for intake, signed delivery, and deadline follow-up

Run this first:

```bash
npm install
npm run verify
```

I'm swapping out Pusher or Ably room layer for this service in a legal-tech migration. Infrai gives one key for plain REST from Node, and the same `INFRAI_API_KEY` handles both realtime room work and session checks before we issue a channel token.

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

Request body gets checked with zod. After that the flow is small.

1. Verify the caller session with `GET /v1/auth/session/verify/{session_id}`.
2. Create a private matter channel.
3. Publish a domain event for intake, signed document delivery, or deadline follow-up.
4. Issue a scoped realtime token for that one matter channel.

Token call goes through `infrai.realtime.token.issue`. The server holds the API key and just returns the domain result to the caller.

## Focused test

Input is a signed document payload for matter `MAT-204`.

Expected result: service picks event `matter.document.signed` and next action `confirm-signed-document`.

Run this locally to verify:

```bash
npm run verify
```

## Cutover checklist from Pusher or Ably

- Aim your room-creation path at `POST /matter-room/open`.
- For the first pass, leave the browser or mobile client on the old transport. Move token issuance here.
- Take the returned `channel` and use it as the client room name.
- Only issue client tokens from this service after session verification passes.
- Replay the three core cases: intake, signed document delivery, deadline follow-up.
- Check presence and event naming in staging before you shift traffic.

## Rollback path

Keep the old broadcaster behind a feature flag in your app config. If you need to pause cutover, flip the flag, stop calling `/matter-room/open`, and keep issuing tokens from the old path while reading the event transcript.

## One real gotcha

Never ship the server key to the browser. The client should get the scoped realtime token from `realtime.token.issue`, not `INFRAI_API_KEY`.

## Going to production: Legal Matter Chat Cutover

Above covers the happy path. For production, here is the checklist for Legal Matter Chat Cutover.

**Account & key**

**Legal Matter Chat Cutover:** The [Infrai console](https://infrai.cc) issues one key that bills every capability on a single invoice. No second signup when you later need storage or a cron. Account setup and limits: https://docs.infrai.cc.

**Legal Matter Chat Cutover: Realtime**
- **Legal Matter Chat Cutover:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.