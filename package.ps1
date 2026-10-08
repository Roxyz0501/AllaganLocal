param([switch]$SkipBuild)
$ErrorActionPreference='Stop'
if(-not $SkipBuild){dotnet build (Join-Path $PSScriptRoot 'AllaganLocalPlugin.csproj') -c Release;if($LASTEXITCODE){throw 'Build failed'}}
$site=Join-Path $PSScriptRoot 'web'
$stage=Join-Path $PSScriptRoot ('artifacts/package-'+(Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Force $stage,(Join-Path $stage 'web'),(Join-Path $stage 'runtime') | Out-Null
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'bin/Release/AllaganLocalPlugin.dll'),(Join-Path $PSScriptRoot 'bin/Release/AllaganLocalPlugin.json') -Destination $stage
Get-ChildItem -LiteralPath $site -Filter '*.mjs' -File | Where-Object { $_.Name -notlike '*.test.mjs' } | Copy-Item -Destination (Join-Path $stage 'web')
Copy-Item -LiteralPath (Join-Path $site 'package.json'),(Join-Path $site 'public') -Destination (Join-Path $stage 'web') -Recurse
# Do not include data, icons, portraits, logs, config, character IDs or history.
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'runtime/node.exe'),(Join-Path $PSScriptRoot 'runtime/LICENSE') -Destination (Join-Path $stage 'runtime')
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README.md'),(Join-Path $PSScriptRoot 'LICENSE'),(Join-Path $PSScriptRoot 'THIRD_PARTY_NOTICES.md') -Destination $stage
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'images') -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'fonts') -Destination $stage -Recurse
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'README.ja.md'),(Join-Path $PSScriptRoot 'LOCALIZATION_IMPLEMENTATION.md') -Destination $stage
$zip=Join-Path $PSScriptRoot 'artifacts/AllaganLocalPlugin-0.2.0.0.zip'
Compress-Archive -Path ($stage+'/*') -DestinationPath $zip -Force
Write-Output $zip
