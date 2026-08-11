[CmdletBinding()]
param(
    [ValidateSet('local', 'production')]
    [string]$Profile = 'local',
    [switch]$InstallDependencies,
    [switch]$NoBrowser
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$profileName = $Profile.ToLowerInvariant()
$envFile = Join-Path $repoRoot "config\env\$profileName.env"

if (-not (Test-Path -LiteralPath $envFile -PathType Leaf)) {
    $templateFile = Join-Path $repoRoot "config\env\$profileName.env.example"
    throw "Runtime profile is missing: $envFile. Copy $templateFile and provide the required values."
}

$env:AI_WORKER_PROFILE = $profileName

Write-Host "AI Worker Platform profile: $profileName" -ForegroundColor Cyan
Write-Host "Repository: $repoRoot"
Write-Host "Environment: $envFile"

Push-Location $repoRoot
try {
    & git submodule sync --recursive
    if ($LASTEXITCODE -ne 0) { throw 'Submodule sync failed.' }
    & git submodule update --init --recursive
    if ($LASTEXITCODE -ne 0) { throw 'Submodule initialization failed.' }

    & node -e "require('./backend/src/config/env')"
    if ($LASTEXITCODE -ne 0) { throw "The $profileName environment profile failed validation." }

    if ($InstallDependencies) {
        & npm.cmd --prefix backend ci
        if ($LASTEXITCODE -ne 0) { throw 'Backend dependency installation failed.' }
        & npm.cmd --prefix frontend ci
        if ($LASTEXITCODE -ne 0) { throw 'Frontend dependency installation failed.' }

        $python = if (Test-Path -LiteralPath '.venv\Scripts\python.exe') {
            (Resolve-Path -LiteralPath '.venv\Scripts\python.exe').Path
        } else {
            'python'
        }

        & $python -m pip install -r requirements-worker.txt
        if ($LASTEXITCODE -ne 0) { throw 'Shared Python dependency installation failed.' }
        foreach ($skillDirectory in (Get-ChildItem -LiteralPath (Join-Path $repoRoot 'skills') -Directory)) {
            $requirementsFile = Join-Path $skillDirectory.FullName 'requirements.txt'
            if (Test-Path -LiteralPath $requirementsFile -PathType Leaf) {
                & $python -m pip install -r $requirementsFile
                if ($LASTEXITCODE -ne 0) {
                    throw "Skill dependency installation failed: $requirementsFile"
                }
            }
        }
    }

    if ($profileName -eq 'production') {
        & npm.cmd --prefix frontend run build
        if ($LASTEXITCODE -ne 0) { throw 'Production frontend build failed.' }

        $logDirectory = Join-Path $repoRoot 'storage\logs'
        New-Item -ItemType Directory -Force -Path $logDirectory | Out-Null

        $backendProcess = Start-Process `
            -FilePath 'npm.cmd' `
            -ArgumentList @('--prefix', 'backend', 'start') `
            -WorkingDirectory $repoRoot `
            -RedirectStandardOutput (Join-Path $logDirectory 'backend.stdout.log') `
            -RedirectStandardError (Join-Path $logDirectory 'backend.stderr.log') `
            -WindowStyle Hidden `
            -PassThru

        $frontendProcess = Start-Process `
            -FilePath 'npm.cmd' `
            -ArgumentList @('--prefix', 'frontend', 'run', 'preview') `
            -WorkingDirectory $repoRoot `
            -RedirectStandardOutput (Join-Path $logDirectory 'frontend.stdout.log') `
            -RedirectStandardError (Join-Path $logDirectory 'frontend.stderr.log') `
            -WindowStyle Hidden `
            -PassThru

        Write-Host "Production backend started as PID $($backendProcess.Id)." -ForegroundColor Green
        Write-Host "Production frontend preview started as PID $($frontendProcess.Id)." -ForegroundColor Green
        Write-Host "Configure Nginx with frontend/nginx.conf and open /fe/."
    } else {
        Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/k', 'npm.cmd --prefix backend run dev') -WorkingDirectory $repoRoot
        Start-Process -FilePath 'cmd.exe' -ArgumentList @('/d', '/k', 'npm.cmd --prefix frontend run dev') -WorkingDirectory $repoRoot
        Write-Host 'Local backend and frontend started in separate windows.' -ForegroundColor Green

        if (-not $NoBrowser) {
            Start-Process 'http://localhost:3000'
        }
    }
} finally {
    Pop-Location
}
