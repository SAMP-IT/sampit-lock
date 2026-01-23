@echo off
echo ========================================
echo   AwayKey Mobile App - Log Viewer
echo ========================================
echo.
echo Connected Devices:
C:\Users\MAVOC\AppData\Local\Android\Sdk\platform-tools\adb.exe devices
echo.
echo Starting real-time log viewer...
echo Press Ctrl+C to stop
echo ========================================
echo.

REM Clear old logs
C:\Users\MAVOC\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat -c

REM Show only React Native logs with timestamps
C:\Users\MAVOC\AppData\Local\Android\Sdk\platform-tools\adb.exe logcat -v time -s ReactNativeJS:V
