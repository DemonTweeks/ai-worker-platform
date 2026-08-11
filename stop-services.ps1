[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [int[]]$FrontendPorts = @(3000),
    [int[]]$BackendPorts = @(8000)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
$targetPorts = @($FrontendPorts + $BackendPorts | Sort-Object -Unique)

function Get-TargetListeners {
    try {
        return @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $_.LocalPort -in $targetPorts })
    } catch {
        Write-Warning "Get-NetTCPConnection is unavailable; using netstat.exe. $($_.Exception.Message)"
    }

    $windowsRoot = if ($env:SystemRoot) { $env:SystemRoot } else { 'C:\Windows' }
    $netstatLines = @(& (Join-Path $windowsRoot 'System32\netstat.exe') -ano -p tcp)
    if ($LASTEXITCODE -ne 0) { throw "netstat.exe failed with exit code $LASTEXITCODE." }

    return @(
        foreach ($line in $netstatLines) {
            if ($line -match '^\s*TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)\s*$') {
                $localPort = [int]$Matches[1]
                if ($localPort -in $targetPorts) {
                    [PSCustomObject]@{ LocalPort = $localPort; OwningProcess = [int]$Matches[2] }
                }
            }
        }
    )
}

$listeners = @(Get-TargetListeners)
if ($listeners.Count -eq 0) {
    Write-Host 'No matching frontend or backend listeners are running.' -ForegroundColor Green
    exit 0
}

$failed = $false
foreach ($listenerGroup in ($listeners | Group-Object OwningProcess)) {
    $processId = [int]$listenerGroup.Name
    $ports = @($listenerGroup.Group.LocalPort | Sort-Object -Unique)

    try {
        $process = Get-Process -Id $processId -ErrorAction Stop
    } catch {
        Write-Warning "PID $processId stopped before it could be inspected."
        continue
    }

    if ($process.ProcessName -ne 'node') {
        Write-Warning "Skipping non-Node process '$($process.ProcessName)' (PID $processId) on port(s) $($ports -join ', ')."
        $failed = $true
        continue
    }

    $description = "AI Worker Platform Node process PID $processId on port(s) $($ports -join ', ')"
    if ($PSCmdlet.ShouldProcess($description, 'Stop')) {
        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
            Write-Host "Stopped $description." -ForegroundColor Green
        } catch {
            Write-Error "Failed to stop $description. $($_.Exception.Message)"
            $failed = $true
        }
    }
}

Start-Sleep -Milliseconds 500
if (@(Get-TargetListeners).Count -gt 0) {
    Write-Warning 'One or more targeted listeners remain.'
    $failed = $true
}

if ($failed) { exit 1 }
