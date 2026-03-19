# Debug APK + Local Backend

Debug builds are configured to use your **local backend** by default so you don't need to change `.env` for development.

## Run with instant refresh (recommended for development)

1. Start your backend: `cd backend && npm run dev` (or your usual command).
2. From `mobile-app` run:
   ```bash
   npm run android:debug
   ```
   This runs the app in debug mode with **Metro** so code changes reflect instantly (fast refresh).

- **Android emulator**: App uses `http://10.0.2.2:3009/api` (your machine’s localhost).
- **Physical device**: Set your PC’s IP in **Settings → Developer → Local server URL** (e.g. `http://192.168.1.100:3009/api`), or set `BACKEND_API_URL` in `.env` to that URL before building.

## Build debug APK only

To generate a debug APK (e.g. to install on a device without Metro):

```bash
npm run android:debug-apk
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`

- **Emulator**: Install this APK; it will use `10.0.2.2:3009` as the backend.
- **Physical device**: Either enable **Dev Mode** in the app and set your PC IP, or set `BACKEND_API_URL` in `.env` to `http://YOUR_PC_IP:3009/api` before running the command above.

## Summary

| Goal                    | Command              |
|-------------------------|----------------------|
| Run app + instant refresh | `npm run android:debug` |
| Build debug APK        | `npm run android:debug-apk` |

Ensure your backend is running on port 3009 (or the port in your URL).
