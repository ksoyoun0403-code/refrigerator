@echo off
setlocal EnableExtensions EnableDelayedExpansion
title MyDish USB Debug Launcher

set "PROJECT_ROOT=%~dp0"
set "FRONT_DIR=%PROJECT_ROOT%front"
set "BACK_DIR=%PROJECT_ROOT%back"
set "APP_PACKAGE=io.github.ksoyoun0403code.mydish"
set "METRO_URL=http://127.0.0.1:8081/status"
set "BACKEND_URL=http://127.0.0.1:3000/v1/health"
set "DEBUG_URL=exp+mydish://expo-development-client/?url=http%%3A%%2F%%2F127.0.0.1%%3A8081"
set "CHANGE_SCRIPT=%PROJECT_ROOT%scripts\prepare-mydish-debug.ps1"
set "CHANGE_FLAGS=%PROJECT_ROOT%.mydish-debug-state\launcher-flags.cmd"

echo.
echo ============================================================
echo   MyDish USB Debug - One Click Launcher
echo ============================================================
echo.

where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js or npm.cmd was not found.
  goto :failed
)

where curl.exe >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Windows curl.exe was not found.
  goto :failed
)

set "ADB_EXE="
if defined ANDROID_HOME set "ADB_EXE=%ANDROID_HOME%\platform-tools\adb.exe"
if not exist "!ADB_EXE!" if defined ANDROID_SDK_ROOT set "ADB_EXE=%ANDROID_SDK_ROOT%\platform-tools\adb.exe"
if not exist "!ADB_EXE!" set "ADB_EXE=%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe"

if not exist "!ADB_EXE!" (
  echo [ERROR] adb.exe was not found.
  echo Install Android SDK platform-tools and try again.
  goto :failed
)

echo [1/8] Checking the USB debugging device...
"!ADB_EXE!" start-server >nul 2>&1

rem A broken ADB server can block `adb devices` indefinitely. Probe it with
rem an 8-second limit and restart ADB only when the probe actually hangs.
set "MYDISH_ADB=!ADB_EXE!"
powershell.exe -NoProfile -Command "$p = Start-Process -FilePath $env:MYDISH_ADB -ArgumentList 'devices' -PassThru -WindowStyle Hidden; if (-not $p.WaitForExit(8000)) { Stop-Process -Id $p.Id -Force; exit 124 }; exit $p.ExitCode" >nul 2>&1
if "!ERRORLEVEL!"=="124" (
  echo       ADB was not responding. Restarting it automatically.
  taskkill.exe /F /IM adb.exe >nul 2>&1
  ping 127.0.0.1 -n 2 >nul
  "!ADB_EXE!" start-server >nul 2>&1
)

set /a "DEVICE_WAIT_COUNT=0"
:find_device
set "DEVICE_SERIAL="
set "UNAUTHORIZED_SERIAL="
for /f "skip=1 tokens=1,2" %%A in ('"!ADB_EXE!" devices') do (
  if "%%B"=="device" if not defined DEVICE_SERIAL set "DEVICE_SERIAL=%%A"
  if "%%B"=="unauthorized" if not defined UNAUTHORIZED_SERIAL set "UNAUTHORIZED_SERIAL=%%A"
)

if defined DEVICE_SERIAL goto :device_ready

if defined UNAUTHORIZED_SERIAL if !DEVICE_WAIT_COUNT! equ 0 (
  echo       Waiting for USB debugging authorization on the phone...
  echo       Select "Always allow from this computer" and tap Allow.
)

set /a "DEVICE_WAIT_COUNT+=1"
if !DEVICE_WAIT_COUNT! geq 45 (
  if defined UNAUTHORIZED_SERIAL (
    echo [ERROR] USB debugging was not authorized within 45 seconds.
  ) else (
    echo [ERROR] No USB-connected Android device was found within 45 seconds.
    echo Check the USB cable and the USB debugging setting on the phone.
  )
  goto :failed
)
ping 127.0.0.1 -n 2 >nul
goto :find_device

:device_ready

echo       Device: !DEVICE_SERIAL!

echo [2/8] Configuring ADB reverse ports...
"!ADB_EXE!" -s "!DEVICE_SERIAL!" reverse tcp:8081 tcp:8081 >nul
if errorlevel 1 (
  echo [ERROR] Failed to reverse the Metro port.
  goto :failed
)
"!ADB_EXE!" -s "!DEVICE_SERIAL!" reverse tcp:3000 tcp:3000 >nul
if errorlevel 1 (
  echo [ERROR] Failed to reverse the backend port.
  goto :failed
)

echo [3/8] Detecting project changes...
if not exist "%CHANGE_SCRIPT%" (
  echo [ERROR] Change detection script was not found.
  goto :failed
)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CHANGE_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%." -Mode Prepare
if errorlevel 1 goto :failed
if not exist "%CHANGE_FLAGS%" (
  echo [ERROR] Change detection flags were not created.
  goto :failed
)
call "%CHANGE_FLAGS%"
if not "!MYDISH_STATE_READY!"=="1" (
  echo [ERROR] Change detection did not complete successfully.
  goto :failed
)

if "!MYDISH_RESTART_BACKEND!"=="1" echo       Backend changes detected: restart required.
if "!MYDISH_RESTART_METRO!"=="1" echo       Frontend environment or dependency changes detected: Metro restart required.
if "!MYDISH_REBUILD_ANDROID!"=="1" echo       Android native or frontend dependency changes detected: rebuild required.

echo [4/8] Checking the backend...
call :url_ready "%BACKEND_URL%"
if errorlevel 1 (
  echo       Starting the backend in a separate window.
  start "MyDish Backend" /min /D "%BACK_DIR%" cmd.exe /k npm.cmd run start:dev
  call :wait_for_url "%BACKEND_URL%" 45
  if errorlevel 1 (
    echo [ERROR] The backend did not become ready within 45 seconds.
    echo Check the "MyDish Backend" window for details.
    goto :failed
  )
) else (
  echo       Reusing the running backend.
)

echo [5/8] Checking the Android debug app...
"!ADB_EXE!" -s "!DEVICE_SERIAL!" shell pm path "%APP_PACKAGE%" 2>nul | findstr /b /c:"package:" >nul
set "ANDROID_APP_MISSING=!ERRORLEVEL!"
if "!MYDISH_REBUILD_ANDROID!"=="1" (
  set "ANDROID_BUILD_REQUIRED=1"
) else if not "!ANDROID_APP_MISSING!"=="0" (
  set "ANDROID_BUILD_REQUIRED=1"
) else (
  set "ANDROID_BUILD_REQUIRED=0"
)

if "!ANDROID_BUILD_REQUIRED!"=="1" (
  set "DEBUG_APK=%FRONT_DIR%\android\app\build\outputs\apk\debug\app-debug.apk"
  echo       Building the current Android debug app. This can take a few minutes.
  pushd "%FRONT_DIR%\android"
  call gradlew.bat app:assembleDebug -x lint -x test --configure-on-demand --build-cache -PreactNativeDevServerPort=8081 -PreactNativeArchitectures=arm64-v8a
  if errorlevel 1 (
    popd
    echo [ERROR] The Android debug build failed.
    goto :failed
  )
  popd

  echo       Installing the current debug app on the phone.
  "!ADB_EXE!" -s "!DEVICE_SERIAL!" install --no-incremental -r "!DEBUG_APK!"
  if errorlevel 1 (
    echo       APK transfer failed. Restarting ADB and retrying once.
    call :restart_adb_for_install
    if errorlevel 1 (
      echo [ERROR] Android device did not reconnect after the ADB restart.
      goto :failed
    )
    "!ADB_EXE!" -s "!DEVICE_SERIAL!" reverse tcp:8081 tcp:8081 >nul
    "!ADB_EXE!" -s "!DEVICE_SERIAL!" reverse tcp:3000 tcp:3000 >nul
    "!ADB_EXE!" -s "!DEVICE_SERIAL!" install --no-incremental -r "!DEBUG_APK!"
    if errorlevel 1 (
      echo [ERROR] Failed to install the Android debug app after the ADB retry.
      goto :failed
    )
  )
) else (
  echo       Reusing the installed debug app.
)

echo [6/8] Checking Metro Bundler...
call :url_ready "%METRO_URL%"
if errorlevel 1 (
  echo       Starting Metro in a separate window.
  start "MyDish Metro" /D "%FRONT_DIR%" cmd.exe /k npx.cmd expo start --dev-client
  call :wait_for_url "%METRO_URL%" 90
  if errorlevel 1 (
    echo [ERROR] Metro did not become ready within 90 seconds.
    echo Check the "MyDish Metro" window for details.
    goto :failed
  )
) else (
  echo       Reusing the running Metro server.
)

echo [7/8] Launching MyDish on the phone...
"!ADB_EXE!" -s "!DEVICE_SERIAL!" shell am force-stop "%APP_PACKAGE%" >nul
"!ADB_EXE!" -s "!DEVICE_SERIAL!" shell am start -W -a android.intent.action.VIEW -d "%DEBUG_URL%" "%APP_PACKAGE%" >nul
if errorlevel 1 (
  echo [ERROR] Failed to launch MyDish on the phone.
  goto :failed
)

echo [8/8] Saving the successful change baseline...
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%CHANGE_SCRIPT%" -ProjectRoot "%PROJECT_ROOT%." -Mode Commit
if errorlevel 1 (
  echo [ERROR] The launcher state could not be saved.
  goto :failed
)

echo.
echo ============================================================
echo   READY: Check MyDish on the phone.
echo   Backend : http://127.0.0.1:3000
echo   Metro   : http://127.0.0.1:8081
echo ============================================================
echo.
echo This window will close automatically.
ping 127.0.0.1 -n 5 >nul
exit /b 0

:url_ready
curl.exe -fsS --max-time 2 "%~1" >nul 2>&1
if errorlevel 1 exit /b 1
exit /b 0

:wait_for_url
setlocal
set "WAIT_URL=%~1"
set /a "WAIT_LIMIT=%~2"
set /a "WAIT_COUNT=0"
:wait_for_url_loop
curl.exe -fsS --max-time 2 "%WAIT_URL%" >nul 2>&1
if not errorlevel 1 (
  endlocal
  exit /b 0
)
set /a "WAIT_COUNT+=1"
if !WAIT_COUNT! geq !WAIT_LIMIT! (
  endlocal
  exit /b 1
)
ping 127.0.0.1 -n 2 >nul
goto :wait_for_url_loop

:restart_adb_for_install
taskkill.exe /F /IM adb.exe >nul 2>&1
ping 127.0.0.1 -n 2 >nul
"!ADB_EXE!" start-server >nul 2>&1
setlocal EnableDelayedExpansion
set "RETRY_NOTICE_SHOWN=0"
for /L %%I in (1,1,45) do (
  set "RETRY_DEVICE="
  set "RETRY_UNAUTHORIZED="
  for /f "skip=1 tokens=1,2" %%A in ('"!ADB_EXE!" devices') do (
    if "%%B"=="device" if not defined RETRY_DEVICE set "RETRY_DEVICE=%%A"
    if "%%B"=="unauthorized" if not defined RETRY_UNAUTHORIZED set "RETRY_UNAUTHORIZED=%%A"
  )
  if defined RETRY_DEVICE (
    endlocal
    exit /b 0
  )
  if defined RETRY_UNAUTHORIZED if "!RETRY_NOTICE_SHOWN!"=="0" (
    echo       Re-authorize USB debugging on the phone to continue.
    set "RETRY_NOTICE_SHOWN=1"
  )
  ping 127.0.0.1 -n 2 >nul
)
endlocal
exit /b 1

:failed
echo.
echo Launch failed. Check the error above, then press any key.
pause >nul
exit /b 1
