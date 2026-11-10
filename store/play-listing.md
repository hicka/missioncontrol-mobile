# Google Play listing

Paste these into Play Console. The feature graphic is `play-feature.png` (1024×500), the icon `play/icon-512.png`, and
the phone screenshots `play/*.png` (1434×2868, the 2:1 Play allows at most).

**App name** (30): Mission Control: AI Agent

**Short description** (80): Watch and steer the AI agent on your computer: what it does, asks, every task.

**Full description**

Mission Control is a free, open-source agent that runs on your own computer,
Mac or Windows. This app is its companion: one agent, in your pocket.

See what it is doing. The home screen shows how things stand: what needs you, the work under
way with each step as it lands, and the team. Each profile is a body of its own colour that
moves the way it is: breathing at rest, circled while it thinks, lit while it works.

Decide what it asks. A command it wants to run, a question from a task, a job asking to
start: each waits in your Inbox, shown in full, and runs only when you say so.

Follow every task. Each one has a finish line, the checks that make up what you asked for,
and is only reported done when every check is done and shown. Open a task to read every
step it took, and step in.

Talk to it. Type or speak, and read the reply as it is written.

Requires Mission Control running on your Mac or PC, reachable from your phone on the same network
or through Tailscale. There is no account, and nothing goes through our servers: the phone
talks to your computer directly. Tap "Look around with sample data" to see the app without a computer.

**Category**: Tools. **Contact**: the support page,
https://hicka.github.io/missioncontrol/support.html.
**Privacy policy**: https://hicka.github.io/missioncontrol/privacy.html

## App access (for review)

All functionality needs the user's own computer. For review, on the first screen tap
"Look around with sample data": every screen then shows a realistic sample, and actions that
would change something on the computer say that nothing ran. No login is needed.

## Data safety

- The app collects nothing for the developer. The one third party is Expo's push service:
  when notifications are on, the phone gets a push token from Expo and gives it to the
  user's computer, which sends notifications through Expo. Declare it as "Device or other IDs",
  collected for app functionality, not shared, and optional. Android notifications are not
  set up yet (no Firebase project), so this build sends no token at all.
- What it stores stays on the phone: the computer's address and access token, in the system keystore.
- It sends data only to the user's own computer: messages typed or spoken, attachments the user
  picks, and the phone's push token so the computer can send notifications.
- Speech is recognised on the device where the phone supports it.
- Data in transit: the user chooses the connection. Over Tailscale it is encrypted; on a local
  network it may be plain HTTP.
- No account, so no account deletion; deleting the app removes everything it stored.

## Content rating

A utility with no user-to-user content, no ads, no purchases, and no location data.
