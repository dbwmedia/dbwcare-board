# DBW Care Board

Selbst-gehosteter Fork von [Plane](https://github.com/makeplane/plane) (Kanban/Projektmanagement) mit eigenem Branding.

## Infrastruktur

| Was | Wert |
|-----|------|
| Fork-Repo | https://github.com/dbwmedia/dbwcare-board |
| Upstream | https://github.com/makeplane/plane |
| Live-URL | https://care.dbw-media.de |
| Server | root@168.119.122.191 (Hetzner, ARM64) |
| Stack-Pfad | /opt/stacks/dbwcare-board/ |
| Docker Images | ghcr.io/dbwmedia/dbwcare-board-{web,admin,space,live,backend,proxy} |
| Reverse Proxy | Host-nginx + Let's Encrypt, Plane-Proxy auf Port 8082 |
| Aktiver Branch | `preview` |

## Lokale Entwicklung

Vollstaendige Anleitung: **[docs/LOCAL_DEV.md](docs/LOCAL_DEV.md)**

Es gibt zwei Dev-Workflows:

### `./dev.sh` — Frontend lokal, Backend Hetzner (Standard)
Frontend mit Hot-Reload, API-Calls gehen via Vite-Proxy an `care.dbw-media.de`.
Nutzen wenn: reine Frontend-Arbeit, kein Backend-Code geaendert.

```bash
./dev.sh
# web: http://localhost:3000 | admin: http://localhost:3001/god-mode
```

**Voraussetzungen:** Node.js >= 22.18.0, pnpm 10.x, `.env.local.dev` im Repo-Root (gitignored).

### `./dev-local.sh` — Full-Stack lokal (Backend + Frontend)
Backend (Django API, Postgres, Redis, RabbitMQ, Minio, Celery) laeuft in Docker,
Frontend mit Hot-Reload gegen `localhost:8000`.
Nutzen wenn: Backend-Code, Migrations, Celery-Tasks oder neue Models testen.

```bash
cp .env.dbwcare-local.example .env.dbwcare-local   # einmalig
./dev-local.sh up                                    # Backend + Frontend
./dev-local.sh seed                                  # Demo-Daten (dev@dbwcare.test / dev12345)
./dev-local.sh migrate                               # Migrations ausfuehren
./dev-local.sh shell                                 # Django-Shell
./dev-local.sh reset                                 # Volumes loeschen & neu starten
```

## Build & Deploy

### CI/CD Pipeline (vollautomatisch)
```
git push preview
  → GitHub Actions: Detect Changes (path-filter pro Service)
  → GitHub Actions: Build & Push Images zu ghcr.io (nur geänderte)
  → GitHub Actions: SSH Deploy auf care.dbw-media.de
  → docker compose pull + up -d --remove-orphans
  → Live in ~10-15 Minuten
```

Workflow: `.github/workflows/build.yml`
- Trigger: Push auf `main`, `master` oder `preview`
- Baut 6 Docker Images parallel (web, admin, space, live, backend, proxy)
- Path-Filter: Jeder Service wird nur gebaut wenn sich relevante Dateien geändert haben
- Deploy-Job verbindet per SSH auf den Server und rollt neue Images aus
- Nutzt `GITHUB_TOKEN` für GHCR und `DEPLOY_SSH_KEY` Secret für SSH

### GitHub Secrets
| Secret | Zweck |
|--------|-------|
| `DEPLOY_SSH_KEY` | Ed25519 Private Key für SSH-Deploy auf den Server |
| `GITHUB_TOKEN` | Automatisch von GitHub bereitgestellt für GHCR-Push |

### Manuelles Deploy (Fallback)
```bash
ssh root@168.119.122.191
cd /opt/stacks/dbwcare-board
docker compose pull
docker compose up -d --remove-orphans
```

## Upstream-Updates von makeplane/plane

### Remotes
```
origin    → git@github.com:dbwmedia/dbwcare-board.git (unser Fork)
upstream  → https://github.com/makeplane/plane.git (Original)
```

### Update-Workflow
```bash
git fetch upstream
git checkout preview
git merge upstream/master
# Konflikte lösen (siehe Merge-Regeln unten)
git push origin preview
```

### Merge-Sicherheits-Regeln

**Erlaubt:**
- Neue Dateien hinzufügen (z.B. `/branding/`) → kein Konflikt möglich
- Logo-Dateien ersetzen (gleicher Pfad/Name) → selten Konflikt
- Zentrale Theme-Datei bearbeiten → gelegentlich, leicht lösbar

**Verboten:**
- Core-Komponenten direkt bearbeiten → fast immer Konflikt
- Business-Logik anfassen → nie ohne triftigen Grund

**Bei Konflikten:**
- Branding-Dateien (Logos, Farben, App-Name) → **unsere Version behalten**
- Core-Dateien (Logik, Komponenten) → **upstream nehmen**, unsere Änderung separat neu anwenden

## Branding-Dateien

### Logo-Dateien (durch eigene ersetzen, NICHT umbenennen)
```
apps/web/app/assets/plane-logos/
  ├── black-horizontal-with-blue-logo.png
  ├── blue-without-text.png
  ├── white-horizontal-with-blue-logo.png
  └── white-horizontal.svg

apps/space/app/assets/plane-logos/
  ├── black-horizontal-with-blue-logo.png
  ├── blue-without-text.png
  ├── blue-without-text-new.png
  ├── white-horizontal-with-blue-logo.png
  └── white-horizontal.svg

apps/space/app/assets/plane-logo.svg

apps/web/app/assets/favicon/
  ├── apple-touch-icon.png
  ├── favicon-16x16.png
  ├── favicon-32x32.png
  └── favicon.ico

apps/web/app/assets/icons/
  ├── icon-180x180.png
  └── icon-512x512.png

apps/web/public/plane-logos/plane-mobile-pwa.png
```

### SVG-Logo als React-Komponente
```
packages/propel/src/icons/brand/plane-logo.tsx
```

### Primärfarben
```
packages/tailwind-config/variables.css    → CSS Custom Properties (oklch)
packages/constants/src/themes.ts          → Theme-Optionen (#3F76FF = Primärblau)
apps/web/styles/globals.css               → Web-spezifische Overrides
apps/admin/styles/globals.css             → Admin-spezifische Overrides
apps/space/styles/globals.css             → Space-spezifische Overrides
```

### App-Name "Plane" (merge-safe zu ändern)
```
apps/web/app/root.tsx:67                  → <meta name="application-name">
apps/web/app/layout.tsx:70                → <meta name="application-name">
apps/web/public/site.webmanifest.json     → "name" + "short_name"
apps/web/public/manifest.json             → "name" + "short_name"
apps/web/manifest.json                    → "short_name"
apps/space/app/issues/[anchor]/layout.tsx → DEFAULT_TITLE
```

### Merge-sichere Branding-Strategie
- `/branding/` Ordner im Repo-Root enthält unsere Original-Assets (wird nie von upstream überschrieben)
- Logo-Dateien werden an Ort und Stelle ersetzt (gleicher Pfad, gleicher Name)
- Farben nur in zentralen Theme/Config-Dateien ändern, nie inline
- Keine Core-Komponenten direkt editieren

## Dockerfiles & Services

| Service | Dockerfile | Build-Context | Image |
|---------|-----------|---------------|-------|
| web (Frontend) | `apps/web/Dockerfile.web` | `.` (Root) | dbwcare-board-web |
| admin (God-Mode) | `apps/admin/Dockerfile.admin` | `.` (Root) | dbwcare-board-admin |
| space (Public Pages) | `apps/space/Dockerfile.space` | `.` (Root) | dbwcare-board-space |
| live (Collaboration) | `apps/live/Dockerfile.live` | `.` (Root) | dbwcare-board-live |
| backend (API/Worker/Beat/Migrator) | `apps/api/Dockerfile.api` | `apps/api/` | dbwcare-board-backend |
| proxy (Caddy) | `apps/proxy/Dockerfile.ce` | `apps/proxy/` | dbwcare-board-proxy |

Infrastruktur-Container (postgres, valkey, rabbitmq, minio) nutzen offizielle Images und werden nicht selbst gebaut.

## DBWCARE-spezifische Erweiterungen

Architektur-Details: **[docs/time-tracking-analysis.md](docs/time-tracking-analysis.md)**

### Backend (Django)
- **4 neue Models** in `apps/api/plane/db/models/care.py`:
  `WorkspaceCareSubscription`, `WorkspaceMonthlyBalance`, `WorklogEntry`, `IssueRecurrence`
- **Migration `0500_dbwcare_init`** — Nummer bewusst hochgewaehlt, um Upstream-Merge-Konflikte bei Plane-Migrations (0001-04xx) zu vermeiden
- **2 Celery-Beat-Tasks** in `apps/api/plane/bgtasks/`:
  - `dbwcare_balance_task.py` — Monatlicher Balance-Rollover (taeglich 00:05 UTC)
  - `dbwcare_recurrence_task.py` — Recurring-Issue-Generierung (taeglich 00:15 UTC)
- Beat-Schedule registriert in `apps/api/plane/celery.py`

### Frontend (React/Vite)
- DBWCARE-spezifischer Code lebt in `apps/web/ce/` (Alias: `@/plane-web/*` → `./ce/*`)
- Komponenten: `ce/components/workspace/care-balance-widget.tsx`, `ce/components/issues/worklog/`
- Store: `ce/store/care/index.ts`
- Service: `ce/services/care.service.ts`

## Branch-Status: `feature/dbwcare-time-tracking`

Implementiert und lokal testbar. Vor Merge auf `preview` muessen folgende Punkte adressiert werden:

- [ ] Backend-Tests (pytest) schreiben
- [ ] Frontend-Tests (Vitest) schreiben
- [ ] RecurrenceConfig-UI-Komponente im Issue-Detail bauen
- [ ] Widget-Position pruefen (aktuell Sidebar, evtl. Header)
- [ ] Route `/settings/care/` in `routes.ts` verifizieren

## Bekannte Fallstricke

### Pre-Commit Hook schlägt fehl bei root.tsx
Der husky-Hook führt `oxlint --deny-warnings` aus. `apps/web/app/root.tsx` enthält legitime Font-Side-Effect-Imports (z.B. `import "@fontsource-variable/inter"`), die oxlint mit `no-unassigned-import` anmahnt. Das ist ein False Positive – die Imports sind absichtlich ohne Zuweisung.

**Lösung:** `git commit --no-verify` verwenden wenn root.tsx im Commit enthalten ist und die Warnings nicht durch eigene Änderungen entstanden sind.
