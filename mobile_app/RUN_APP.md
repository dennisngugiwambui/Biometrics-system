# Run the Teacher App on Your Android Emulator

## Prerequisites

1. **Android Studio** with a running emulator (you said it's already running).
2. **Flutter SDK** installed ([flutter.dev/docs/get-started/install](https://docs.flutter.dev/get-started/install)).

---

## If you see: "Waiting for another flutter command to release the startup lock"

Another Flutter process (or a previous run) is holding a lock. Do one of the following:

**Option 1 – Run the release script (easiest)**  
From PowerShell, in this folder (`mobile_app`):

```powershell
.\release_flutter_lock.ps1
```

Then run `flutter run -d emulator-5554` again.

**Option 2 – Delete the lock file manually**  
Remove the file:

`C:\Users\Denno\flutter\bin\cache\lockfile`

(If Flutter is installed elsewhere, remove `bin\cache\lockfile` inside that folder.)

**Option 3 – Close other Flutter/Dart processes**  
- Close any terminal where `flutter run` or `flutter pub get` is still running.  
- In Task Manager, end any **dart.exe** or **flutter** processes.  
- If you have two emulators, close one; then run the script above or delete the lock file and try again.

---

## Android platform was missing

If you saw **"AndroidManifest.xml could not be found"**, the Android platform has been recreated. Run from the `mobile_app` folder:

```bash
flutter create . --project-name school_biometric_mobile
```

(This was already done for you; you can now run the app.)

---

## Option A: Run from terminal (if Flutter is in PATH)

1. Open a terminal (PowerShell or Command Prompt).
2. Go to the mobile app folder:
   ```bash
   cd c:\Users\Denno\Desktop\school-biometric-system\mobile_app
   ```
3. Get dependencies and run on the default device (your emulator):
   ```bash
   flutter pub get
   flutter run
   ```
   Flutter will build the app and install it on the running emulator.

To pick a specific device if you have more than one:
```bash
flutter devices
flutter run -d <device_id>
```

---

## Option B: Use the run script (tries to find Flutter for you)

From PowerShell, in the project folder:

```powershell
cd c:\Users\Denno\Desktop\school-biometric-system\mobile_app
.\run_android.ps1
```

If the script can’t find Flutter, it will print where to install it or how to run from Android Studio.

---

## Option C: Run from Android Studio

1. Open **Android Studio**.
2. **File → Open** and select:
   ```
   c:\Users\Denno\Desktop\school-biometric-system\mobile_app
   ```
3. Wait for the project to load and Gradle/Flutter to sync.
4. In the device dropdown at the top, select your **running emulator**.
5. Click the green **Run** button (or press **Shift+F10**).

The app will build and launch on the emulator.

---

## After it’s running

- **First launch**: You’ll be asked for **School code** (e.g. the code from your dashboard, like `GPA001`). Enter it and continue.
- **Login**: Use a teacher’s **phone number** that’s registered for that school in the web dashboard.

Once it runs without errors in the emulator, you can use the **Download Teacher App** button on the website (Settings → Mobile App Distribution) to export/share the APK.
