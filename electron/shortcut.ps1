# Creates Desktop and Start Menu shortcuts that open the temporary Zyninote desktop shell from this repo.
$repo = Split-Path -Parent $PSScriptRoot
$exe = Join-Path $repo "node_modules\electron\dist\electron.exe"
if (-not (Test-Path $exe)) { Write-Error "Not found: $exe (run npm install first)"; exit 1 }

$shell = New-Object -ComObject WScript.Shell
$targets = @(
  [Environment]::GetFolderPath("Desktop"),
  (Join-Path ([Environment]::GetFolderPath("StartMenu")) "Programs")
)
foreach ($dir in $targets) {
  $lnk = $shell.CreateShortcut((Join-Path $dir "Zyninote.lnk"))
  $lnk.TargetPath = $exe
  $lnk.Arguments = "`"$repo`""
  $lnk.WorkingDirectory = $repo
  $lnk.IconLocation = "$exe,0"
  $lnk.Description = "Zyninote"
  $lnk.Save()
  Write-Output "Created $(Join-Path $dir 'Zyninote.lnk')"
}
