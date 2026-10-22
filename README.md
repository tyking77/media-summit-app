# Media Summit 2026 companion app

Live polls, screened audience questions, a projector view, a moderator view, and an attendance export for the 22nd annual Dr. Lewis B. O'Donnell Media Summit.

| Page | URL | Who |
| --- | --- | --- |
| Attendee | `…/#/` | Everyone in the room (phones) |
| Admin | `…/#/admin` | tyler.king@oswego.edu (password) |
| Broadcast | `…/#/broadcast` | Projector laptop, full screen (press F) |
| Moderator | `…/#/moderator` | Abbey's tablet or phone |

## One-time setup

### 1. Firebase

1. Create a Firebase project and add a **Web app**. Copy its config object into `src/firebase.ts`.
2. **Authentication → Sign-in method:** enable **Anonymous** and **Email/Password**.
3. **Authentication → Users → Add user:** create `tyler.king@oswego.edu` with a password. That account is the only way into `#/admin`. Create it before the app goes live, so nobody else can register that email first.
4. **Firestore Database → Create database:** production mode, US East.
5. Deploy the security rules from this folder:
   ```
   npm install -g firebase-tools
   firebase login
   firebase use --add        (pick the project)
   firebase deploy --only firestore:rules
   ```

No Google sign-in, consent screen, or authorized-domain setup is needed. Attendees type their first name, last name, and email; anyone using an @oswego.edu address is counted as a student.

### 2. GitHub Pages

1. Create a repo and push this folder to `main`.
2. **Settings → Pages → Source:** GitHub Actions. Each push to `main` builds and deploys.
3. The site lives at `https://YOUR-GITHUB-USERNAME.github.io/REPO-NAME/`.

### 3. WordPress

Point `mediasummit.org/app` at the GitHub Pages URL with a redirect (the Redirection plugin works). Don't embed it in an iframe; Google sign-in pop-ups are unreliable inside iframes. The QR code on screen points at `https://mediasummit.org/app` (change it in `src/config.ts`).

## Local development

```
npm install
npm run dev
```

## Event-day run of show

| Device | Open | Notes |
| --- | --- | --- |
| Projector laptop | `#/broadcast` | Press F for full screen. Cursor hides after 3 seconds. Wired ethernet if possible. |
| Moderator tablet | `#/moderator` | Tap "Keep screen on". |
| Your laptop | `#/admin` | Sign in with the admin password. Signing in replaces any attendee session in that browser, so test the attendee view on your phone or in a private window. |

**Before doors:**
- In Admin → Polls, click **Load seed polls** (safe to click twice).
- If you ran a dry run, go to Admin → Export & reset and clear the test data.

**Polls:** **Open + show** opens voting and puts the poll on the projector in one click. Opening a poll closes any other open poll. **Close voting** freezes the result and highlights the winner in gold. Adjustments (+1/−1/+10/−10) change the displayed numbers only; the "Real" column always shows actual votes.

**Questions:** New questions flash gold.
- **Approve** makes a question visible in the moderator's queue.
- **Set as up next** puts it at the top of the moderator's screen.
- **Push to screen** shows it on the projector.
- **Mark answered** removes it from the moderator's queue.
- Edits apply everywhere the question appears. Anonymous questions show "Anonymous" on screen, but you still see the real name.

**End of event:** Admin → Prize draw → Draw → (Re-draw anyone not in the room) → **Publish winners** → **Show Thank You screen**. Then Export → **Download attendance CSV**.

## What's where

- `src/config.ts`: admin email, short URL, QR target, thank-you text
- `src/data/speakers.json`: panel names, titles, bios, photo paths
- `src/data/seedPolls.json`: the four polls
- `public/brand/logo.jpg`: full-resolution logo. If it's missing, the app falls back to `logo-small.png`.
- `public/speakers/`: `abbey.jpg`, `andrew.jpg`, `ryan.jpg`, `evan.jpg`. A missing photo shows initials.
- `firestore.rules`: who can read and write what

## How the rules protect things

- Only the `tyler.king@oswego.edu` password account can write polls, the live screen state, approved questions, or delete anything.
- Attendees are anonymous. Their record is "student" only if the email they typed ends in @oswego.edu. Emails aren't verified, so the attendance list is honor-system.
- Votes are one document per device, writable only by that device, only while the poll is open, and only after the person has joined. The projector and moderator devices can't vote.
- Raw questions (with names) are readable only by the asker and the admin. The projector and moderator read sanitized copies in `screened`.
- If someone joins on two devices with the same email, the attendance export and prize draw merge them into one person.
