# Mobile app APK for download

Place your built Teacher App APK here so the Settings page "Download Teacher App" link works.

- **Filename:** `app.apk`
- **Full path:** `backend/static/mobile/app.apk`

## How to build and copy

1. Open a terminal and go to the Flutter app: `cd mobile_app` (from project root).
2. Build the release APK: `flutter build apk` (or use the path to your Flutter SDK, e.g. `C:\Users\Denno\flutter\bin\flutter.bat build apk` on Windows).
3. Copy the built APK here:
   - **From:** `mobile_app/build/app/outputs/flutter-apk/app-release.apk`
   - **To:** `backend/static/mobile/app.apk`
4. Restart the backend if needed; the Download button will then serve this file.
