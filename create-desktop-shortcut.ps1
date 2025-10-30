# Create Desktop Shortcut for ViteCab Development

$currentPath = Get-Location
$desktopPath = [Environment]::GetFolderPath("Desktop")
$shortcutPath = "$desktopPath\ViteCab Development.lnk"

$WScriptShell = New-Object -ComObject WScript.Shell
$shortcut = $WScriptShell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = "powershell.exe"
$shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$currentPath\run-dev.ps1`""
$shortcut.WorkingDirectory = "$currentPath"
$shortcut.IconLocation = "shell32.dll,25"
$shortcut.Description = "Start ViteCab Development Server"
$shortcut.Save()

Write-Host "✅ Desktop shortcut created: ViteCab Development" -ForegroundColor Green
Write-Host "Double-click the shortcut to start the development server" -ForegroundColor Cyan