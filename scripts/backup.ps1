$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskBackupDir = Join-Path $taskRoot 'backups'
New-Item -ItemType Directory -Path $taskBackupDir -Force | Out-Null
$taskName = 'autoblog-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
$taskTarget = Join-Path $taskBackupDir $taskName
docker compose -f (Join-Path $taskRoot 'docker-compose.yml') exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/autoblog-backup.dump'
if ($LASTEXITCODE -ne 0) { throw 'Database backup failed.' }
docker compose -f (Join-Path $taskRoot 'docker-compose.yml') cp postgres:/tmp/autoblog-backup.dump $taskTarget
if ($LASTEXITCODE -ne 0) { throw 'Copying backup failed.' }
Write-Output ('Backup created: ' + $taskTarget)
Write-Output 'Keep an encrypted offline copy of .env and TOKEN_ENCRYPTION_KEY separately. Never commit backups.'
