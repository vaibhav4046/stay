# Render text with an installed Windows speech voice (the same OneCore voices Chrome/Edge expose through speechSynthesis).
# Usage: powershell -File winrt-synth.ps1 -Voice Heera -Text "Hello" -Out out.wav      |      -List to print the voices
param([string]$Voice = '', [string]$Text = '', [string]$Out = '', [switch]$List)
Add-Type -AssemblyName System.Runtime.WindowsRuntime
[void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media.SpeechSynthesis, ContentType = WindowsRuntime]
if ($List) {
  [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | ForEach-Object { "$($_.DisplayName) | $($_.Language) | $($_.Gender)" }
  return
}
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($op, $type) { $t = $asTask.MakeGenericMethod($type).Invoke($null, @($op)); $t.Wait(-1) | Out-Null; $t.Result }
$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
$v = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices | Where-Object { $_.DisplayName -like "*$Voice*" } | Select-Object -First 1
if (-not $v) { Write-Error "voice not found: $Voice"; exit 2 }
$synth.Voice = $v
$stream = Await ($synth.SynthesizeTextToStreamAsync($Text)) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
$net = [System.IO.WindowsRuntimeStreamExtensions]::AsStreamForRead($stream)
$fs = [System.IO.File]::Create($Out)
$net.CopyTo($fs)
$fs.Close()
