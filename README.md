# Mission Control Mobile

The phone app for [Mission Control](https://github.com/hicka/missioncontrol): one
agent in your pocket, and what it is really doing in plain sight.

![Home, Chat, Inbox and Tasks on the phone, on sample data](docs/screens.png)

- **Home** is how things stand: the lead and what it is waiting on, what needs you, the
  work under way with each step as it lands, and the team. Every profile is drawn as a
  body of its own colour that moves the way the profile is: breathing at rest, circled
  while it thinks, lit round its rim while it works, sending out rings when it needs you.
- **Chat** is the one conversation. The work it hands out shows between the messages as
  it is done, and a task's course can be changed from its card. A held command appears
  in it whole and can be answered there.
- **Inbox** is everything waiting on you: held commands in full, questions from tasks,
  jobs asking to start, proposed changes and lessons.
- **Tasks** shows the work under way and what finished lately, each with its steps and
  how many of its checks are confirmed. A task opens to its reports and every step. Step
  in, stop it or restart it from there.
- **Settings** has its profiles with their direct lines, the schedule, knowledge, what
  it has learned, everything that reached it, and every setting on the Mac.

Everything comes from the server's own record rather than anything the agent said. It
needs a Mission Control server, and holds nothing of its own beyond the address and
token. Light and dark follow the phone, or pick one under Settings > Appearance.
"Look around with sample data" on the first screen shows every page without a Mac, and
the screenshots use it.

## Connect securely

1. On the machine running Mission Control, open Settings >
   Integrations > Mobile access: turn it on and copy the access token.
   Restart Mission Control once.
2. Put both devices on the same private network. The recommended way,
   which also works from anywhere, is [Tailscale](https://tailscale.com)
   on both the server machine and your phone.
3. In this app, enter the server address, e.g.
   `http://your-machine.tailnet.ts.net:8899`, paste the token, Connect.

Security model: the server trusts local requests only; every remote
request (including this app's) must carry the bearer token, which is
checked with a constant-time compare. The token is stored on the phone
in the system keychain via expo-secure-store. Do not expose the server
port to the open internet; keep it on a LAN or a VPN like Tailscale.

The app allows plain HTTP, because a server on your own network rarely has a
certificate. That is another reason to keep it on a LAN or a VPN. For what agents can
do on your machine, see the server's
[SECURITY.md](https://github.com/hicka/missioncontrol/blob/master/SECURITY.md).

If a Tailscale name will not connect from the phone, use the machine's Tailscale IP
address instead. A name with Funnel turned on resolves to public relays.

## Build your own

You can build and sign your own. You need Node 20 or newer
and an [Expo](https://expo.dev) account, plus an Apple Developer account for iOS.

The identifiers in the repo belong to the maintainer's builds, so change these first:

| File | Change |
| --- | --- |
| `app.json` | `expo.ios.bundleIdentifier`, `expo.android.package` and `expo.owner` |
| `app.json` | Remove `expo.extra.eas.projectId`, then run `eas init` for your own |
| `eas.json` | `submit.production.ios.ascAppId`, your app in App Store Connect |

```bash
npm install
eas build --platform ios --profile production
```

Add `--auto-submit` to send the build to TestFlight.

## Develop

```bash
npm install
npx expo start
```

Build a dev client (`npx expo run:ios`) or install a build from EAS: voice and push need
native modules that Expo Go does not carry. The app is Expo SDK 58 with
Expo Router: the system's own tab bar (`expo-router/native-tabs`), a native stack in each
tab, and every other page opening over the tabs. A profile's presence is plain vector
shapes moved by natively driven transforms, and holds still when the phone asks for
reduced motion.

`.maestro/` holds [Maestro](https://maestro.dev) flows that walk every tab on the sample
data; `store.yaml` takes the App Store pictures.

## Layout

| Path | What it holds |
| --- | --- |
| `app/` | The routes: `_layout.js` (theme, stored connection, notifications), `(tabs)/` and the pages over them |
| `src/api.js` | The Mission Control client (URL and bearer token) |
| `src/harness.js` | What a task's state may honestly claim, and how a profile is. Read this before changing a label |
| `src/store.js` | One shared picture of the server, kept current by live events |
| `src/theme.js`, `src/ui.js` | Design tokens and building blocks |
| `src/screens/` | Home, Chat, Inbox, Tasks, Settings, a task and the rest, with `config/` for settings |
| `src/components/` | A profile's presence, the work card, tasks, decisions and messages |
| `src/demo/` | The sample data, captured from a real server and moved forward in time |

## Status and contributing

This is young software, built for one person's daily use. It is used on iOS. The Android
settings are there, but it has not been tested on Android. There are no automated tests
yet, so describe how you checked a change. Issues and pull requests are welcome.

Please report security problems privately, as the server's
[SECURITY.md](https://github.com/hicka/missioncontrol/blob/master/SECURITY.md) describes.

## License

[MIT](LICENSE)
