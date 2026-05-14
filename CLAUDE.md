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

## Lokale Entwicklung (empfohlen)

Frontend lokal mit Hot-Reload, Backend auf dem Hetzner-Server.

```bash
# 1. Dev-Server starten (web, admin, space mit Hot-Reload)
./dev.sh

# 2. Browser oeffnen
#    web:   http://localhost:3000
#    admin: http://localhost:3001/god-mode
#    space: http://localhost:3002/spaces

# 3. Code aendern → sofort im Browser sichtbar (Hot-Reload)

# 4. Wenn fertig: pushen → CI/CD deployed automatisch
git push origin preview
```

**Voraussetzungen:**
- Node.js >= 22.18.0, pnpm 10.x
- `.env.local.dev` im Repo-Root (bereits erstellt, gitignored)
- CORS auf dem Server erlaubt localhost (bereits konfiguriert)

**Env-Variablen:** `.env.local.dev` zeigt `VITE_API_BASE_URL` auf `https://care.dbw-media.de`.

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
