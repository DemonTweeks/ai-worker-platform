[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [int[]]$FrontendPorts = @(3000),
    [int[]]$BackendPorts = @(8000)
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$targetPorts = @($FrontendPorts + $BackendPorts | Sort-Object -Unique)

Write-Host 'AI Worker Platform service stop' -ForegroundColor Cyan
Write-Host "Frontend ports: $($FrontendPorts -join ', ')"
Write-Host "Backend ports:  $($BackendPorts -join ', ')"
Write-Host

try {
    $listeners = @(
        Get-NetTCPConnection -State Listen -ErrorAction Stop |
            Where-Object { $_.LocalPort -in $targetPorts }
    )
} catch {
    throw "Unable to inspect listening ports. Run PowerShell as Administrator and try again. $($_.Exception.Message)"
}

if ($listeners.Count -eq 0) {
    Write-Host 'No matching frontend or backend listeners are running.' -ForegroundColor Green
    exit 0
}

$failed = $false
$listenerGroups = $listeners | Group-Object OwningProcess

foreach ($listenerGroup in $listenerGroups) {
    $processId = [int]$listenerGroup.Name
    $ports = @($listenerGroup.Group.LocalPort | Sort-Object -Unique)
    $frontendMatches = @($ports | Where-Object { $_ -in $FrontendPorts })
    $backendMatches = @($ports | Where-Object { $_ -in $BackendPorts })

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

    $roles = @()
    if ($frontendMatches.Count -gt 0) { $roles += 'frontend' }
    if ($backendMatches.Count -gt 0) { $roles += 'backend' }
    $description = "$($roles -join '/') Node process PID $processId on port(s) $($ports -join ', ')"

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

$remaining = @(
    Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
        Where-Object { $_.LocalPort -in $targetPorts }
)

if ($remaining.Count -gt 0) {
    $remainingPorts = @($remaining.LocalPort | Sort-Object -Unique)
    Write-Warning "Listener(s) remain on port(s): $($remainingPorts -join ', ')."
    $failed = $true
} else {
    Write-Host 'All targeted AI Worker Platform ports are clear.' -ForegroundColor Green
}

if ($failed) {
    exit 1
}
