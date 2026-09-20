# Fallback Node.js installer for PCs without winget.
# Downloads the latest Node 22 LTS MSI from nodejs.org, verifies its SHA-256 against the
# published checksums, and installs it (Windows shows one permission prompt).
$ErrorActionPreference = 'Stop'
try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $arch = 'x64'
    if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { $arch = 'arm64' }
    if ($env:PROCESSOR_ARCHITECTURE -eq 'x86' -and -not $env:PROCESSOR_ARCHITEW6432) {
        throw '32-bit Windows is not supported by current Node.js releases.'
    }

    $base = 'https://nodejs.org/dist/latest-v22.x'
    Write-Host 'Looking up the latest Node.js 22 release...'
    $sums = (Invoke-WebRequest -UseBasicParsing -Uri ($base + '/SHASUMS256.txt')).Content
    $pattern = 'node-v[\d\.]+-' + $arch + '\.msi'
    $line = ($sums -split "`n") | Where-Object { $_ -match $pattern } | Select-Object -First 1
    if (-not $line) { throw 'Could not find a Node.js installer for this PC.' }
    $parts = $line.Trim() -split '\s+'
    $expected = $parts[0].ToUpper()
    $file = $parts[-1]

    $dest = Join-Path $env:TEMP $file
    Write-Host ('Downloading ' + $file + ' ...')
    Invoke-WebRequest -UseBasicParsing -Uri ($base + '/' + $file) -OutFile $dest

    $actual = (Get-FileHash -Path $dest -Algorithm SHA256).Hash.ToUpper()
    if ($actual -ne $expected) { throw 'Downloaded installer failed its checksum check. Aborting.' }

    Write-Host 'Installing (approve the Windows permission prompt)...'
    $msiArgs = '/i "' + $dest + '" /passive /norestart'
    $p = Start-Process -FilePath 'msiexec.exe' -ArgumentList $msiArgs -Verb RunAs -Wait -PassThru
    Remove-Item $dest -ErrorAction SilentlyContinue
    if ($p.ExitCode -ne 0 -and $p.ExitCode -ne 3010) { throw ('The installer exited with code ' + $p.ExitCode) }
    Write-Host 'Node.js installed.'
    exit 0
}
catch {
    Write-Host ('ERROR: ' + $_.Exception.Message)
    exit 1
}
