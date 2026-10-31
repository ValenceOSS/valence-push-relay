# Valence Push Relay

Lets a self-hosted Valence server wake the Valence app on a phone, on iPhone and on Android,
without Valence's Apple and Firebase push keys ever leaving this service.

Only Apple's push service can wake an iPhone app, and only with a key tied to the app. That key
cannot be handed to every server, since whoever held it could push to every Valence user. So a
server asks the relay instead, and the relay asks Apple or Google.

## What the relay is told

Nothing a notification says. A server asks the relay to wake one phone, and sends exactly this:

| Field         | What it is                                                        |
| ------------- | ----------------------------------------------------------------- |
| `platform`    | `apple` or `android`                                              |
| `token`       | The phone's push token from Apple or Firebase                     |
| `environment` | `production` or `sandbox` (Apple only)                            |
| `deliveryId`  | An opaque identifier the server chose for this notification       |
| `collapseId`  | Optional: an opaque identifier so newer pushes replace older ones |

Any other field is refused, so a title, a film's name, a person's name or a server's address cannot
be sent through the relay, even by mistake.

The phone receives a push carrying the delivery identifier and the identifier this relay gave its
server. It reads what the notification actually says from its own server, which it is signed in
to. On iPhone a notification service extension does that before the banner shows; on Android the
app does it when it is woken. If the server cannot be reached, the phone shows a generic
"New notification".

## What the relay keeps

- **No database.** A server's credential is a statement signed by the relay, checked by its
  signature, so the relay keeps no record of servers.
- **For a day, in memory:** a one-way hash of each delivery, so a server retrying one it is unsure
  of does not wake a phone twice.
- **For a minute or an hour, in memory:** counts for rate limits, keyed by server, by a hash of the
  phone's token, and by the address that registered.
- **On disk:** the list of servers turned away for abuse.
- **No logs** of tokens, deliveries or addresses. Requests are not logged at all.

Apple and Google necessarily receive the phone's token and the generic push in order to deliver it.
Cloudflare sits in front of the relay and sees the traffic passing through it.

A server's administrator can turn the relay off entirely; the server then sends nothing here.

## The API

| Route                    | What it does                                                       |
| ------------------------ | ------------------------------------------------------------------ |
| `GET /health`            | Whether the relay is up, and which platforms it can reach          |
| `POST /v1/servers`       | Registers a server, answering an identifier and a credential       |
| `POST /v1/servers/renew` | Swaps a credential for a fresh one, up to 30 days after it ran out |
| `POST /v1/push`          | Wakes one phone                                                    |

A credential lasts 90 days and is sent as `Authorization: Bearer <credential>`. A push answers
`200` when sent or already sent, `410` when the phone's token is gone and should be forgotten, `422`
when Apple or Google refused it, `429` when rate limited and `502` when they could not be reached.

Limits: 10 registrations an hour from one address, 600 pushes a minute from one server, and 10 a
minute from one server to one phone. Each server's turns at a phone are counted apart, so one
server cannot use up another's and keep its notifications away.

## Running it

The relay is a Node service in a Docker image, published as
`ghcr.io/valenceoss/valence-push-relay`. It needs:

| Setting                         | What it is                                                          |
| ------------------------------- | ------------------------------------------------------------------- |
| `CREDENTIAL_KEYS`               | Comma-separated keys of 32+ characters; the first signs, all verify |
| `APPLE_KEY_FILE`                | Path to the APNs auth key (`.p8`)                                   |
| `APPLE_KEY_ID`, `APPLE_TEAM_ID` | The key's identifier and the Apple developer team                   |
| `APPLE_TOPIC`                   | The app's bundle identifier, `app.valence.ios` by default           |
| `FIREBASE_SERVICE_ACCOUNT_FILE` | Path to the Firebase service account JSON                           |
| `REVOKED_FILE`                  | Path to a file of turned-away server identifiers, one per line      |

A platform left unset is reported by `/health` and its pushes are refused. `deploy/` holds the
Compose file and Caddy configuration the hosted relay runs with, behind Cloudflare.

Anyone publishing their own build of the app, with their own bundle identifier and push keys, can
run their own relay and point their servers at it.

## Development

```sh
pnpm install
pnpm check
pnpm lint
pnpm test
```
