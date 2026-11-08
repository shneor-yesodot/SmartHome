# Builds SmartHome.exe in the project root from launcher\SmartHome.cs.
# Uses the C# compiler that ships with Windows (.NET Framework 4), so nothing needs installing.
# Run from anywhere:  powershell -ExecutionPolicy Bypass -File launcher\build.ps1
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot
$root = Split-Path $here -Parent
$csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path $csc)) { $csc = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }

# The app icon, as an .ico that holds the PNG (supported since Windows Vista)
$png = [IO.File]::ReadAllBytes((Join-Path $root 'frontend\public\icons\icon-192.png'))
$ico = Join-Path $here 'SmartHome.ico'
$out = New-Object IO.MemoryStream
$w = New-Object IO.BinaryWriter($out)
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]1)            # header: icon, 1 image
$w.Write([byte]192); $w.Write([byte]192); $w.Write([byte]0); $w.Write([byte]0)
$w.Write([uint16]1); $w.Write([uint16]32); $w.Write([uint32]$png.Length); $w.Write([uint32]22)
$w.Write($png)
[IO.File]::WriteAllBytes($ico, $out.ToArray())

& $csc /nologo /target:winexe /optimize+ /codepage:65001 `
  "/out:$(Join-Path $root 'SmartHome.exe')" "/win32icon:$ico" `
  /reference:System.Windows.Forms.dll /reference:System.Drawing.dll `
  /reference:System.IO.Compression.dll /reference:System.IO.Compression.FileSystem.dll `
  (Join-Path $here 'SmartHome.cs')
if ($LASTEXITCODE -ne 0) { throw 'Build failed' }
Remove-Item $ico
Write-Host "Built $(Join-Path $root 'SmartHome.exe')"
