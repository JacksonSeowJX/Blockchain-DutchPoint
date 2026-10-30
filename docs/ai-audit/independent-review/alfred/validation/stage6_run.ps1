$ErrorActionPreference = 'Continue'
$PSNativeCommandUseErrorActionPreference = $false
$outputRoot = Join-Path $PSScriptRoot 'stage6'
New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
function Invoke-AuditCommand {
    param([string]$Name, [string]$Command, [scriptblock]$Action)
    $log = Join-Path $outputRoot ($Name + '.txt')
    @("UTC $([DateTime]::UtcNow.ToString('o'))", "COMMAND $Command", "CWD $((Get-Location).Path)") | Set-Content $log
    $global:LASTEXITCODE = 0
    & $Action 2>&1 | Tee-Object -FilePath $log -Append
    $code = $LASTEXITCODE
    "EXIT_CODE $code" | Tee-Object -FilePath $log -Append
}
Invoke-AuditCommand '01_environment' 'node --version; npm --version; git rev-parse HEAD; tool and dependency discovery' {
    node --version
    npm --version
    git rev-parse HEAD
    foreach ($name in @('node','npm','slither','solc','forge','tsc','vite')) {
        $tool = Get-Command $name -ErrorAction SilentlyContinue
        if ($tool) { "$name $($tool.Source)" } else { "$name NOT_FOUND_ON_PATH" }
    }
    "node_modules exists: $(Test-Path node_modules)"
}
Invoke-AuditCommand '02_cache' 'npm cache ls hardhat ethers react typescript vite' { npm cache ls hardhat ethers react typescript vite }
Invoke-AuditCommand '03_hardhat_resolution' 'node --input-type=module -e "console.log(import.meta.resolve(''hardhat''))"' {
    node --input-type=module -e "console.log(import.meta.resolve('hardhat'))"
}
Invoke-AuditCommand '04_build' 'npm run build' { npm run build }
Invoke-AuditCommand '05_stage5_recheck' 'node ai_audit_report/validation/stage5_checks.mjs' { node ai_audit_report/validation/stage5_checks.mjs }
Invoke-AuditCommand '06_math_tests' 'node --test ai_audit_report/validation/stage6_math.test.mjs' { node --test ai_audit_report/validation/stage6_math.test.mjs }
