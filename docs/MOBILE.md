# Kelo-1 World on iPhone, iPad and Android

The phone apps are the same game as the website, wrapped with [Capacitor 8](https://capacitorjs.com/).
Nothing about the website (GitHub Pages) or the Windows app changes: they keep using the files in the
repo root.

## How it fits together

| Piece | What it is |
|---|---|
| `scripts/build-web.mjs` (`npm run build:web`) | Copies the game into `www/` and makes it work offline: local three.js r128 and OrbitControls, Phosphor icons, the Inter / Newsreader / JetBrains Mono fonts, and Tailwind compiled to one stylesheet (same Tailwind 3.4.17 the website loads from its CDN). It also swaps in a strict Content-Security-Policy for the app (scripts only from the app itself). `www/` is rebuilt every time and is not committed. |
| `js/native.js`, `css/native.css` | Loaded only inside the apps. Keeps his memory as files in the app's private storage, keeps AI keys in the iOS Keychain / Android Keystore, makes room for the notch and home bar, closes the viewer / settings / menu with Android's back button, hides the splash screen, adds a gentle vibration for news and an optional "keep the screen on" switch (Settings → On this phone), and saves brain backups to the Files app (iOS) or Documents (Android). |
| `capacitor.config.json` | App id `io.github.jeremiahaguirre.kelo1world`, name "Kelo-1 World", splash and status bar settings. |
| `android/`, `ios/` | The native projects. Open them in Android Studio and Xcode. Build outputs, copied web files and keystores are git-ignored. |
| `resources/` | The app icon (`icon.svg`, drawn for this project) and splash pictures. `scripts/make-icons.mjs` re-renders them. |
| `.github/workflows/mobile.yml` | Builds both apps on GitHub (see "Building on GitHub" below). |
| `privacy.html` | The privacy policy. Both stores ask for its link: `https://jeremiahaguirre.github.io/Kelo-bot-1/privacy.html` |

Every time you change the game, run `npm run cap:sync` (it rebuilds `www/` and copies it into both
projects) before building an app.

## 1. What you need

| | Android | iPhone / iPad |
|---|---|---|
| Computer | Windows, Mac or Linux | **A Mac** (Apple only allows iOS apps to be built with Xcode). Or use the GitHub workflow, which builds on a Mac in the cloud. |
| Software | [Node.js 22](https://nodejs.org/), [Android Studio](https://developer.android.com/studio) (it brings the Android SDK and Java 21) | Node.js 22, **Xcode 26** from the Mac App Store |
| To publish | A [Google Play Console](https://play.google.com/console/signup) account (one-time US$25) | The [Apple Developer Program](https://developer.apple.com/programs/enroll/) (US$99 a year) |

Then, in the project folder:

```bash
npm install
npm run cap:sync
```

## 2. Try it on your phone

### Android
1. On the phone: **Settings → About phone**, tap **Build number** seven times, then turn on
   **Developer options → USB debugging**. Plug it in and allow the computer.
2. `npm run android:open` opens the project in Android Studio. Pick your phone at the top and press ▶ Run.

No Android Studio at hand? Download the **Kelo-1-World-Android-debug** APK from a run of the GitHub
workflow, copy it to the phone and open it (allow "install unknown apps" when asked).

### iPhone / iPad (Mac)
1. `npm run ios:open` opens Xcode.
2. Click **App** in the left column → **Signing & Capabilities** → tick *Automatically manage signing*
   and pick your **Team** (a free Apple ID works for your own phone; the paid program is needed for
   the App Store and TestFlight).
3. Plug in the iPhone, choose it at the top, press ▶ Run. The first time, on the phone go to
   **Settings → General → VPN & Device Management** and trust your developer certificate, and turn on
   **Settings → Privacy & Security → Developer Mode**.

## 3. Release builds

### Android: make your upload key (once, and keep it safe)

```bash
keytool -genkeypair -v -keystore kelo-release.jks -alias kelo -keyalg RSA -keysize 4096 -validity 10000
```

Store `kelo-release.jks` and its passwords somewhere safe **outside the repo** (a password manager).
Never commit it: `*.jks`, `*.keystore` and `keystore.properties` are git-ignored. Google Play App
Signing (on by default) keeps the real signing key, so if you lose this upload key you can ask Google
to reset it.

To build a signed bundle on your own computer, create `android/keystore.properties`:

```properties
storeFile=/full/path/to/kelo-release.jks
storePassword=...
keyAlias=kelo
keyPassword=...
```

then run `npm run android:release`. The bundle is `android/app/build/outputs/bundle/release/app-release.aab`.
Each upload to Google Play needs a higher version code: set `KELO_VERSION_CODE` (and
`KELO_VERSION_NAME`, e.g. `1.0.1`) in the environment, or let the GitHub workflow use its run number.

### iOS: archive and upload from Xcode
1. In Xcode: **App → General**, set *Version* (e.g. 1.0.0) and *Build* (1, 2, 3… must go up each upload).
2. Choose **Any iOS Device (arm64)** at the top, then **Product → Archive**.
3. In the Organizer window: **Distribute App → App Store Connect → Upload**. It appears in
   App Store Connect → TestFlight after processing (10–30 minutes).

## 4. Building on GitHub (no Mac needed)

**Actions → Build phone apps → Run workflow.** It also runs on pushes to `main` that touch the app
files, and on `v*` tags. Download the results from the run's **Artifacts**.

- **Android** always builds a debug APK. With the four Android secrets it also builds the signed
  **release AAB** for Google Play.
- **iOS** always builds the app unsigned (proof that it compiles). With the iOS secrets, and the
  *Upload to TestFlight* box ticked when you run it, it signs the app and uploads it to App Store Connect.

Add secrets in **GitHub → Settings → Secrets and variables → Actions → New repository secret**:

| Secret | What to put in it |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | The keystore as base64: `base64 -w0 kelo-release.jks` (Linux) or `base64 -i kelo-release.jks` (Mac) or `[Convert]::ToBase64String([IO.File]::ReadAllBytes("kelo-release.jks"))` (PowerShell) |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password |
| `ANDROID_KEY_ALIAS` | The alias (`kelo` above) |
| `ANDROID_KEY_PASSWORD` | The key password |
| `IOS_TEAM_ID` | Your 10-character Apple Team ID ([developer.apple.com/account](https://developer.apple.com/account) → Membership details) |
| `APPSTORE_API_KEY_ID` | App Store Connect → Users and Access → Integrations → **App Store Connect API** → generate a key with the **App Manager** role (Admin also works); this is its Key ID |
| `APPSTORE_API_ISSUER_ID` | The Issuer ID shown on that same page |
| `APPSTORE_API_KEY_P8_BASE64` | The downloaded `AuthKey_XXXX.p8` file as base64 (you can only download it once) |

The iOS upload uses Xcode's automatic signing with that API key, so no certificate or provisioning
profile files are needed. Before the first upload, create the app record in App Store Connect
(**Apps → + → New App**, bundle ID `io.github.jeremiahaguirre.kelo1world`; register the bundle ID first
under Certificates, Identifiers & Profiles → Identifiers if it isn't offered).

## 5. Store listing checklist

**Both stores**
- [ ] Privacy policy URL: `https://jeremiahaguirre.github.io/Kelo-bot-1/privacy.html` (publish the site first).
- [ ] Support URL: e.g. `https://github.com/jeremiahaguirre/Kelo-bot-1/issues`.
- [ ] Description, short description / subtitle, keywords, category **Games → Simulation** (or Casual).
- [ ] Icon: `resources/icon-only.png` (1024×1024, no transparency).
- [ ] Screenshots of the real game (the Brain, Talk and Post tabs, the valley, the workshop).

**Google Play (Play Console → your app)**
- [ ] Phone screenshots: at least 2, 1080×1920 (or 1920×1080) PNG/JPEG, up to 8.
- [ ] 7" and 10" tablet screenshots (recommended, needed to be featured on tablets).
- [ ] Feature graphic 1024×500.
- [ ] **Data safety** form: no data collected or shared by the developer. Mention that, if the user adds their own AI key, what they type is sent to Google Gemini / Anthropic (user-initiated, not stored by you), and that lookups go to Wikipedia, Wiktionary and DuckDuckGo. Data is encrypted in transit (HTTPS). No account, so no deletion request flow is needed.
- [ ] Content rating questionnaire (IARC): no violence, no user-to-user chat, no purchases, no location sharing. Answer "yes" to *the app lets users interact with AI-generated content* if asked. Usually rated Everyone / PEGI 3.
- [ ] Target audience: choose 13+ (not "designed for children") because of the optional AI chat.
- [ ] New personal developer accounts must run a **closed test with at least 12 testers for 14 days** before they can publish to production.

**App Store (App Store Connect)**
- [ ] Screenshots: 6.9" iPhone (1320×2868 or 1290×2796) is required; 13" iPad (2064×2752 or 2048×2732) because the app supports iPad. Xcode's Simulator → File → Save Screen makes them.
- [ ] **App Privacy** ("nutrition label"): *Data Not Collected* (you collect nothing; the AI services are contacted with the user's own key at their request — describe that in the review notes).
- [ ] Age rating questionnaire: no objectionable content; answer the questions about unrestricted web access / user-generated or AI content honestly (the AI chat is optional and needs the user's own key). Expect 9+ or 12+.
- [ ] Export compliance: already answered in `Info.plist` (`ITSAppUsesNonExemptEncryption = NO`, the app only uses HTTPS).
- [ ] App Review notes: "No login needed. AI keys are optional; without one, the robot uses a built-in brain. Settings (gear icon) → AI brain to add a key."

## 6. App Store guideline 4.2 (minimum functionality)

Apple rejects apps that are "just a website in a wrapper". Kelo-1 World stands on its own:
- It is a full offline game: the 3D engine, art, icons and fonts are inside the app; it runs with no internet at all.
- It keeps his whole life on the device (no account, no server), with native storage instead of browser storage.
- AI keys are kept in the iOS Keychain.
- Native touches: haptics for news, keep-the-screen-on switch, safe-area layout for the notch and Dynamic Island, both orientations and iPad, backups saved to the Files app, a real launch screen and icon.

Mention these in the review notes. If a reviewer still pushes back, adding more device features
(e.g. notifications when he writes you a letter) is the usual next step.

## 7. Changing the icon or splash

Edit `resources/icon.svg`, then:

```bash
npm install --no-save sharp
node scripts/make-icons.mjs
npx @capacitor/assets generate --assetPath resources --iconBackgroundColor '#0b1026' --iconBackgroundColorDark '#0b1026' --splashBackgroundColor '#020617' --splashBackgroundColorDark '#020617' --android --ios
```

## 8. Updating Capacitor

`npm install` the new versions of every `@capacitor/*` package together (and the other plugins:
`@capacitor-community/keep-awake`, `@aparajita/capacitor-secure-storage`), then `npx cap sync`.
For a new major version, follow Capacitor's upgrade guide (`npx cap migrate`).

## Good to know
- Memory lives in the app: deleting the app deletes him. Use **Brain → Export** for a backup file (Files app / Documents) and **Import** to restore it, also across devices and the website.
- Android's automatic backup (Google Drive) includes his memory files; AI keys are tied to the device and are not restored on a new phone, so you'll add them again.
- The **Open his shop** button opens the published shop on GitHub Pages in the phone's browser.
- The apps fetch the latest `brain/growth.json` (his dreams) from GitHub Pages and fall back to the copy inside the app when offline.
