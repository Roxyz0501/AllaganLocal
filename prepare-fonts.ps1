$ErrorActionPreference='Stop'
$fontSource=Join-Path $PSScriptRoot 'artifacts/font-source'
New-Item -ItemType Directory -Force $fontSource | Out-Null
$revision='f8d157532fbfaeda587e826d4cd5b21a49186f7c'
$inputs=@(
 @('jp','Japanese','JP','68a3fc98800b2a27b371f2fb79991daf3633bd89309d4ffaa6946fd587f375b5'),
 @('kr','Korean','KR','6bcb2a0703aa137e874fc2dffa85f6c21ba9a67fa329e81b8c801663af7e992a'),
 @('sc','SimplifiedChinese','SC','2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b'),
 @('tc','TraditionalChinese','TC','dce08bd4fd91aa8aa76ed8fea4b694c2dfb8550f67871e326843212ddbeb88b4')
)
foreach($font in $inputs){
 $file=Join-Path $fontSource ($font[0]+'.otf')
 if(-not (Test-Path -LiteralPath $file)){Invoke-WebRequest -Uri "https://raw.githubusercontent.com/notofonts/noto-cjk/$revision/Sans/OTF/$($font[1])/NotoSansCJK$($font[2])-Regular.otf" -OutFile $file}
 if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $font[3]){throw "Unexpected font checksum: $($font[0])"}
}
# Install fontTools 4.66.1 into a private venv or artifacts/python-libs first.
Push-Location $PSScriptRoot
try{python subset-fonts.py;if($LASTEXITCODE){throw 'Font generation failed'}}finally{Pop-Location}
