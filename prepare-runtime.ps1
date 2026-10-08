$ErrorActionPreference='Stop'
$version='24.21.0'
$expected='158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'
$work=Join-Path $PSScriptRoot ('runtime-download/'+[guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $work,(Join-Path $PSScriptRoot 'runtime') | Out-Null
$archive=Join-Path $work 'node.zip'
Invoke-WebRequest -Uri "https://nodejs.org/dist/v$version/node-v$version-win-x64.zip" -OutFile $archive
if((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected){throw 'Node archive checksum mismatch'}
Expand-Archive -LiteralPath $archive -DestinationPath $work
$source=Join-Path $work "node-v$version-win-x64"
Copy-Item -LiteralPath (Join-Path $source 'node.exe'),(Join-Path $source 'LICENSE') -Destination (Join-Path $PSScriptRoot 'runtime') -Force
Write-Output "Verified Node.js $version runtime prepared."
