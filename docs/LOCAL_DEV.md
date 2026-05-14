# Lokale Full-Stack-Entwicklung (DBWCARE Board)

Lokales Backend (Django API, Postgres, Redis, Minio, RabbitMQ, Celery, Live) neben dem bestehenden Hetzner-Setup.

## Quickstart (5 Schritte)

```bash
# 1. Env-Datei anlegen
cp .env.dbwcare-local.example .env.dbwcare-local

# 2. Backend + Frontend starten
./dev-local.sh up

# 3. Browser oeffnen
#    http://localhost:3000

# 4. Demo-Daten anlegen (in neuem Terminal)
./dev-local.sh seed

# 5. Login mit: dev@dbwcare.test / dev12345
```

## Architektur: Lokal vs. Hetzner

| Aspekt | `./dev.sh` (Hetzner-Backend) | `./dev-local.sh` (Lokales Backend) |
|--------|------------------------------|-------------------------------------|
| Frontend | lokal (pnpm dev, Hot-Reload) | lokal (pnpm dev, Hot-Reload) |
| API | care.dbw-media.de (remote) | localhost:8000 (Docker) |
| Datenbank | Hetzner Postgres | localhost:5432 (Docker) |
| Live-Service | care.dbw-media.de | localhost:3100 (pnpm dev) |
| Daten | Produktions-Daten | Eigene lokale Test-Daten |
| Migrations | Nur auf Server | Lokal testbar |

## Zwischen Hetzner und Lokal wechseln

```bash
# Gegen Hetzner arbeiten (wie bisher)
./dev.sh

# Gegen lokales Backend arbeiten
./dev-local.sh up

# Lokales Backend stoppen (Frontend laeuft nicht weiter)
./dev-local.sh down
```

Beide Scripts schreiben `apps/{web,admin,space}/.env` mit dem jeweiligen API-Target. Nur eines gleichzeitig nutzen.

## dev-local.sh Befehle

| Befehl | Beschreibung |
|--------|-------------|
| `up` | Backend (Docker) + Frontend (pnpm dev) starten |
| `down` | Backend stoppen |
| `logs [service]` | Logs anzeigen (z.B. `logs api`, `logs worker`) |
| `migrate` | Django-Migrations ausfuehren |
| `shell` | Django-Shell oeffnen |
| `seed` | Demo-Daten anlegen (User, Workspace, Subscription, Issues, Worklogs) |
| `reset` | Alle Volumes loeschen & komplett neu starten |

## Services & Ports

| Service | Port | Beschreibung |
|---------|------|-------------|
| web | 3000 | Next.js Frontend (pnpm, nicht Docker) |
| admin | 3001 | Admin/God-Mode (pnpm) |
| space | 3002 | Space/Public Pages (pnpm) |
| api | 8000 | Django API (Docker) |
| live | 3100 | Realtime/Collaboration (Docker) |
| postgres | 5432 | Datenbank (Docker) |
| redis | 6379 | Cache & Queues (Docker) |
| rabbitmq | 5672/15672 | Message Broker (Docker, Management UI auf 15672) |
| minio | 9000/9090 | S3-Storage (Docker, Console auf 9090) |

## Troubleshooting

### API startet nicht / Migrations-Fehler
```bash
# Logs pruefen
./dev-local.sh logs api

# Migrations manuell ausfuehren
./dev-local.sh migrate
```

### Port-Konflikte
Falls Port 5432/6379/8000 schon belegt:
```bash
# Pruefen was den Port nutzt
lsof -i :5432
# Entweder den anderen Prozess stoppen oder Ports in
# docker-compose.dbwcare-local.yml anpassen
```

### "Permission denied" bei Postgres-Volume
```bash
# Volume komplett neu anlegen
./dev-local.sh reset
```

### ARM64-Images
Alle verwendeten Images (postgres, valkey, rabbitmq, minio, python:alpine, node:alpine) haben offizielle ARM64-Manifeste. Auf Apple Silicon laufen sie nativ ohne QEMU.

### Frontend kann API nicht erreichen
- CORS ist auf `http://localhost:3000,3001,3002,3100` konfiguriert
- `VITE_API_BASE_URL` muss LEER sein (Vite-Proxy leitet weiter)
- `DEV_API_PROXY_TARGET=http://localhost:8000` wird von dev-local.sh gesetzt

### Seed schlaegt fehl
```bash
# API muss laufen und Migrations durchgelaufen sein
./dev-local.sh logs migrator
# Dann erneut:
./dev-local.sh seed
```

## Was NICHT deployed wird

Alle lokalen Dateien sind klar als "local" / "dev" benannt:
- `docker-compose.dbwcare-local.yml` (gitignored: nein, aber harmlos)
- `.env.dbwcare-local` (gitignored)
- `.env.dbwcare-local.example` (darf ins Repo)
- `dev-local.sh` (darf ins Repo)

Die CI/CD-Pipeline (`.github/workflows/build.yml`) wird NICHT beeinflusst:
- Keine Aenderungen an produktiven Dockerfiles
- Keine Aenderungen an `docker-compose.yml`
- Keine Aenderungen an `.github/workflows/*`
- Der bestehende `./dev.sh`-Workflow funktioniert weiterhin
