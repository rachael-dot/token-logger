@echo off
REM Batch wrapper script for copilot CLI that logs token usage to local filesystem
REM Usage: copilot-gather.bat [copilot options]
REM Or rename to copilot.bat and place earlier in PATH

REM Configuration
set "LOGS_BASE_DIR=.\logs"
set "COPILOT_BIN=copilot.exe"

REM Generate session info using timestamp with folder
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set "SESSION_ID=copilot_%datetime:~0,14%"
set "TIMESTAMP=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%T%datetime:~8,2%:%datetime:~10,2%:%datetime:~12,2%Z"
set "RUN_FOLDER=%datetime:~0,4%-%datetime:~4,2%-%datetime:~6,2%-%datetime:~8,2%%datetime:~10,2%%datetime:~12,2%"
set "LOGS_DIR=%LOGS_BASE_DIR%\%RUN_FOLDER%"

REM Create logs directory if it doesn't exist
if not exist "%LOGS_DIR%" mkdir "%LOGS_DIR%"

REM Create temporary file for output
set "TEMP_OUTPUT=%TEMP%\copilot_output_%RANDOM%.txt"

REM Record start time
set "START_TIME=%time%"

REM Run the actual copilot command and capture output
"%COPILOT_BIN%" --allow-all-tools %* > "%TEMP_OUTPUT%" 2>&1
set "EXIT_CODE=%ERRORLEVEL%"

REM Display the output
type "%TEMP_OUTPUT%"

REM Save output to run.log
copy "%TEMP_OUTPUT%" "%LOGS_DIR%\run.log" >nul

REM Parse token information from output if it contains usage stats
findstr /C:"Breakdown by AI model:" "%TEMP_OUTPUT%" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    REM Output contains token usage - parse it
    REM This is a simplified version - batch parsing is very limited
    REM For full token counting, cost calculation, and premium request tracking,
    REM please use the PowerShell version (copilot-gather.ps1)

    set "LOG_FILE=%LOGS_DIR%\copilot-gather.log"
    set "COMMAND_ARGS=%*"

    REM Log basic entry with session info
    echo ================================================================================ >> "%LOG_FILE%"
    echo Session ID: %SESSION_ID% >> "%LOG_FILE%"
    echo Timestamp:  %TIMESTAMP% >> "%LOG_FILE%"
    echo. >> "%LOG_FILE%"
    echo Command: %COMMAND_ARGS% >> "%LOG_FILE%"
    echo. >> "%LOG_FILE%"
    echo Note: For detailed token usage, costs, and premium request tracking, >> "%LOG_FILE%"
    echo       please use copilot-gather.ps1 (PowerShell version) >> "%LOG_FILE%"
    echo. >> "%LOG_FILE%"
)

REM Clean up temp file
del "%TEMP_OUTPUT%" >nul 2>&1

REM Exit with the same code as copilot
exit /b %EXIT_CODE%
