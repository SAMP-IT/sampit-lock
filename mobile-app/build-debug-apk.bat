@echo off
echo ========================================
echo Building Debug APK for Awakey Smart Lock
echo ========================================
echo.

cd mobile-app

echo Step 1: Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Failed to install dependencies
    pause
    exit /b 1
)

echo.
echo Step 2: Prebuilding Android project...
call npx expo prebuild --platform android --clean
if %errorlevel% neq 0 (
    echo Failed to prebuild
    pause
    exit /b 1
)

echo.
echo Step 3: Building debug APK...
cd android
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo Failed to build APK
    pause
    exit /b 1
)

echo.
echo ========================================
echo Build Complete!
echo ========================================
echo.
echo APK Location:
echo mobile-app\android\app\build\outputs\apk\debug\app-debug.apk
echo.
echo You can now install this APK on your Android device or emulator.
echo.
pause


