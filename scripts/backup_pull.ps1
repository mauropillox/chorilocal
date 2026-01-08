# ============================================================================
# Chorizaurio Backup Pull Script for Windows
# ============================================================================
# 
# Purpose: Download latest database backup from production API
# Schedule: Run via Windows Task Scheduler at 22:00 (America/Montevideo)
#
# Setup:
#   1. Edit the variables below (API_URL, USERNAME, PASSWORD)
#   2. Test manually: powershell -ExecutionPolicy Bypass -File backup_pull.ps1
#   3. Schedule in Task Scheduler:
#      - Open Task Scheduler
#      - Create Basic Task
#      - Trigger: Daily at 22:00
#      - Action: Start a program
#        - Program: powershell.exe
#        - Arguments: -ExecutionPolicy Bypass -File "C:\path\to\backup_pull.ps1"
#
# ============================================================================

# --- Configuration ---
$API_URL = "https://api.pedidosfriosur.com/api"
$USERNAME = "admin"
$PASSWORD = "CHANGE_ME"  # Set your admin password here (or use env var)
$BACKUP_DIR = "$env:USERPROFILE\Documents\ChorizaurioBackups"
$RETENTION_COUNT = 10  # Keep last N backups locally
$LOG_FILE = "$BACKUP_DIR\backup_pull.log"

# --- Functions ---
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LOG_FILE -Value $logMessage -ErrorAction SilentlyContinue
}

function Get-AuthToken {
    Write-Log "Authenticating..."
    
    $body = @{
        username = $USERNAME
        password = $PASSWORD
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$API_URL/login" -Method Post -Body $body
        return $response.access_token
    }
    catch {
        Write-Log "ERROR: Authentication failed - $($_.Exception.Message)"
        return $null
    }
}

function Get-BackupList {
    param([string]$Token)
    
    $headers = @{
        Authorization = "Bearer $Token"
    }
    
    try {
        $response = Invoke-RestMethod -Uri "$API_URL/admin/backups" -Method Get -Headers $headers
        return $response.backups
    }
    catch {
        Write-Log "ERROR: Failed to get backup list - $($_.Exception.Message)"
        return $null
    }
}

function Download-Backup {
    param(
        [string]$Token,
        [string]$Filename
    )
    
    $headers = @{
        Authorization = "Bearer $Token"
    }
    
    $destPath = Join-Path $BACKUP_DIR $Filename
    
    try {
        Write-Log "Downloading $Filename..."
        Invoke-WebRequest -Uri "$API_URL/admin/backups/$Filename" -Method Get -Headers $headers -OutFile $destPath
        
        $size = (Get-Item $destPath).Length
        $sizeKB = [math]::Round($size / 1024, 2)
        Write-Log "Downloaded: $Filename ($sizeKB KB)"
        return $true
    }
    catch {
        Write-Log "ERROR: Failed to download $Filename - $($_.Exception.Message)"
        return $false
    }
}

function Remove-OldBackups {
    Write-Log "Cleaning old backups (keeping last $RETENTION_COUNT)..."
    
    $backups = Get-ChildItem -Path $BACKUP_DIR -Filter "ventas_*.db" | Sort-Object LastWriteTime -Descending
    
    if ($backups.Count -gt $RETENTION_COUNT) {
        $toDelete = $backups | Select-Object -Skip $RETENTION_COUNT
        foreach ($file in $toDelete) {
            Remove-Item $file.FullName -Force
            Write-Log "Deleted old backup: $($file.Name)"
        }
    }
}

# --- Main ---
Write-Log "========================================="
Write-Log "Starting backup pull..."

# Ensure backup directory exists
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR -Force | Out-Null
    Write-Log "Created backup directory: $BACKUP_DIR"
}

# Get auth token
$token = Get-AuthToken
if (-not $token) {
    Write-Log "FAILED: Could not authenticate"
    exit 1
}

# Get backup list
$backups = Get-BackupList -Token $token
if (-not $backups -or $backups.Count -eq 0) {
    Write-Log "FAILED: No backups available"
    exit 1
}

# Get latest backup
$latest = $backups[0]
$latestFilename = $latest.filename
$latestSize = $latest.size_human

Write-Log "Latest backup: $latestFilename ($latestSize)"

# Check if we already have this backup
$localPath = Join-Path $BACKUP_DIR $latestFilename
if (Test-Path $localPath) {
    Write-Log "Backup already exists locally, skipping download"
}
else {
    # Download latest backup
    $success = Download-Backup -Token $token -Filename $latestFilename
    if (-not $success) {
        Write-Log "FAILED: Download failed"
        exit 1
    }
}

# Rotate old backups
Remove-OldBackups

Write-Log "Backup pull completed successfully"
Write-Log "========================================="
exit 0
