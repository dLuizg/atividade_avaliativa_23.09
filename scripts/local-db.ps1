param(
    [Parameter(Mandatory = $true)]
    [ValidateSet('start', 'stop')]
    [string]$Action
)

$ErrorActionPreference = 'Stop'
$instanceDir = Join-Path $env:LOCALAPPDATA 'AppointmentApi\mysql'
$serverConfig = Join-Path $instanceDir 'my.ini'
$clientConfig = Join-Path $instanceDir 'admin-client.ini'
$mysqlBin = 'C:\Program Files\MySQL\MySQL Server 8.0\bin'

if (!(Test-Path -LiteralPath $serverConfig) -or !(Test-Path -LiteralPath $clientConfig)) {
    throw 'A instância local do MySQL não foi configurada neste computador. Consulte SETUP.md.'
}

function Test-Instance {
    $ErrorActionPreference = 'Continue'
    # Uma consulta autenticada também detecta credenciais incorretas.
    & "$mysqlBin\mysql.exe" "--defaults-extra-file=$clientConfig" --connect-timeout=2 --batch --skip-column-names --execute='SELECT 1;' 2>$null | Out-Null
    return $LASTEXITCODE -eq 0
}

if ($Action -eq 'stop') {
    & "$mysqlBin\mysqladmin.exe" "--defaults-extra-file=$clientConfig" --connect-timeout=2 shutdown
    if ($LASTEXITCODE -ne 0) { throw 'Não foi possível encerrar a instância local do MySQL.' }
    Write-Output 'MySQL local encerrado.'
    exit 0
}

if (Test-Instance) {
    Write-Output 'O MySQL local já está em execução em 127.0.0.1:3307.'
    exit 0
}

Start-Process -FilePath "$mysqlBin\mysqld.exe" -ArgumentList "--defaults-file=`"$serverConfig`"" -WindowStyle Hidden | Out-Null
for ($attempt = 0; $attempt -lt 40; $attempt++) {
    Start-Sleep -Milliseconds 500
    if (Test-Instance) {
        Write-Output 'MySQL local iniciado em 127.0.0.1:3307.'
        exit 0
    }
}
throw "O MySQL não iniciou. Consulte $instanceDir\mysql.err."
