@echo off
echo ========================================
echo   AwayKey - Authentication Debug Logs
echo ========================================
echo.
echo Filtering for authentication-related logs...
echo Press Ctrl+C to stop
echo ========================================
echo.

REM Clear old logs
C:\Users\MAVOC\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat -c

REM Show only auth-related logs with emoji indicators
C:\Users\MAVOC\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat -v time | findstr /C:"LoginScreen" /C:"SignUpScreen" /C:"RoleContext" /C:"RootNavigator" /C:"auth" /C:"token"
