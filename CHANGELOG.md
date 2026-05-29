# DBWCARE Board – Changelog

Alle wesentlichen Änderungen am DBWCARE-Fork von Plane.

---

## [Unreleased] – 2026-05-29

### Rollen-System & Kunden-UI-Vereinfachung

- **Rollen umbenannt:** Guest → "Kunde", Member → "Entwickler", Admin → "Admin"
- **Provisioning:** Kunden werden als Guest (5) statt Member (15) angelegt
- **Issue-Erstellung:** Guests können jetzt Issues erstellen
- **Sidebar für Guests:** Nur "Neue Aufgabe"-Button, CARE-Widget, eigenes Projekt → "Aufgaben" — alles andere ausgeblendet (Home, Drafts, Your Work, Stickies, Workspace, Projects-Header, Footer)
- **CARE-Widget:** Gradient-Hintergrund (grün/gelb/rot je nach Verbrauch), "**CARE**-Kontingent" mit Bold-Branding, Klick öffnet eigene Übersichtsseite
- **Care-Übersichtsseite:** `/:workspace/projects/:projectId/care` — Hero mit großer Zahl, Fortschrittsbalken, Stats, Monatsverlauf mit allen vergangenen Monaten
- **i18n:** "Work Items" → "Aufgaben", "New work item" → "Neue Aufgabe", sidebar-Block in EN hinzugefügt

### Monthly Report & Kundendaten

- **Model:** 3 neue Felder auf `ProjectCareSubscription`: `customer_name`, `customer_email`, `report_enabled`
- **Migration:** `0502_care_report_fields`
- **Celery-Task:** `dbwcare_monthly_report` — generiert am 2. des Monats (08:00 UTC) den Bericht des Vormonats und versendet ihn per SMTP
- **E-Mail-Template:** `templates/emails/care/monthly_report.html` — professionelles deutsches HTML-Template mit Zusammenfassung, Fortschrittsbalken, Leistungstabelle (abrechenbar), geschenkte Leistungen (grün, mit Begründung), Vormonats-Vergleich
- **Report-Logik:** `self_caused`-Einträge werden ausgeblendet, `gift`-Einträge in eigener Sektion mit `gift_reason`
- **API:** `POST /projects/<pid>/care-report/send/` — manueller Report-Versand (Admin only), optional mit `year`/`month` Parameter
- **Frontend:** Neue Sektion "Monatsbericht & Kundendaten" in Project Care Settings mit Kundenname, E-Mail, Report-Toggle, Warnung bei fehlendem Empfänger, und "Report jetzt senden"-Button
- **i18n:** 10 neue Keys (DE + EN) für Report-Sektion

---

## 2026-05-27

### Direct Customer Provisioning

- **Backend:** `POST /projects/<pid>/provision-customer/` — erstellt User + Workspace/Project-Membership in einem Schritt (Admin only, throttled 10/min)
- **Frontend:** "Kunden-Account anlegen"-Button in Project Settings → Members, `ProvisionCustomerModal` mit Passwort-Generator
- **User-Flags:** `is_password_autoset=True` — Onboarding zeigt nur Profil-Setup (kein PW-Step), PW änderbar ohne altes PW
- **Member-Refresh:** Nach Provisioning werden Workspace- und Project-Members neu geladen

### i18n Fixes

- **Nested Keys:** `dbwcare`-Keys von Flat-Strings (`"dbwcare.key": "value"`) auf verschachtelte Objekte (`dbwcare: { key: "value" }`) umgestellt — nötig weil Plane's TranslationStore `lodash.get()` nutzt

---

## 2026-05-20

### DBWCARE Project-Level Refactor

- **Geschäftsmodell-Umstellung:** Subscription & Balance von Workspace-Ebene auf Project-Ebene migriert (1 Workspace = "DBW Care", 1 Projekt = 1 Kunde)
- **Models:** `WorkspaceCareSubscription` → `ProjectCareSubscription`, `WorkspaceMonthlyBalance` → `ProjectMonthlyBalance`
- **Migration 0501:** Automatische Datenmigration von alten Workspace-Tabellen auf Project-Ebene
- **API:** Neue Endpoints unter `/projects/<pid>/care-subscription/`, `/projects/<pid>/care-balance/`, `/care-overview/` (Admin Mission Control)
- **Frontend:** Project-Settings `/settings/projects/:pid/care`, Mission Control `/settings/care`
- **Store:** `subscriptions[projectId]`, `balances[projectId]` statt single `subscription`/`currentBalance`

### Mission Control

- **Admin-Dashboard:** Übersicht aller Projekte mit Care-Subscriptions, Sortierung nach Auslastung/Name/Rest, Fortschrittsbalken (grün/gelb/rot)
- **Deep-Links:** Klick auf Projekt → direkt zu Project Care Settings

### Local Dev Improvements

- **`dev-local.sh`:** Full-Stack lokale Entwicklungsumgebung (Docker Backend + pnpm Frontend)
- **Seed-Daten:** `./dev-local.sh seed` → `dev@dbwcare.test` / `dev12345` mit Demo-Workspace + Subscription
- **Smoke-Check:** `./dev-local.sh check` prüft ob Frontend und Backend gegen gleiche Instanz laufen
- **Vite-Configs:** Proxy-Konfiguration für alle 3 Apps (web, admin, space)
- **Env-Pitfall gelöst:** `dev-local.sh` entfernt `.env.local` in App-Ordnern (Vite-Prioritäts-Problem)

---

## 2026-05-14

### CI/CD Pipeline

- **ARM64 Native Builds:** Docker Images werden jetzt auf nativen ARM64-Runnern gebaut (kein QEMU-Emulation mehr)
- **Path-Filter:** `dorny/paths-filter` — nur geänderte Services werden gebaut
- **Auto-Deploy:** SSH-Deploy nach erfolgreichem Build auf `care.dbw-media.de`
- **Build-Trigger-Trick:** Kommentar in `packages/tailwind-config/brand.css` ändern → `packages/**` Filter → alle Frontends werden gebaut

---

## 2026-05-08

### DBWCARE Time Tracking & Customer Quota Portal

- **4 neue Models:** `ProjectCareSubscription`, `ProjectMonthlyBalance`, `WorklogEntry`, `IssueRecurrence`
- **Migration 0500:** `dbwcare_init` — erstellt alle Tabellen
- **API-Endpoints:** Subscription CRUD, Balance (current + history), Worklog CRUD, Timer (start/stop/active), Recurrence CRUD
- **Timer-System:** Start/Stop-Timer pro Issue, system-weite Prüfung auf laufende Timer, optionaler `force_stop`
- **Billing-Status:** `billable`, `gift` (mit Begründung), `self_caused` (intern)
- **Celery-Tasks:** `dbwcare_monthly_balance_init` (täglich 00:05 UTC — Balance-Rollover), `dbwcare_recurrence_generator` (täglich 00:15 UTC — Issue-Klonen)
- **Frontend:** Care Balance Widget (Sidebar), Worklog-Liste pro Issue, Timer-UI, Manual Entry Modal, Timer-Stop Modal mit Billing-Status
- **Store:** MobX `CareStore` mit allen Actions und Computed Properties
- **Tests:** Backend (pytest) + Frontend (Vitest) Suiten

### Recurring Issues

- **Typen:** `monthly_date` (Tag X im Monat) und `interval_days` (alle N Tage)
- **Auto-Generierung:** Celery-Task klont Template-Issue in Default-State (Backlog)
- **UI:** RecurrenceConfig in Issue-Detail-Sidebar

---

## 2026-04-28

### Branding

- **Logo-Austausch:** Alle Plane-Logos durch DBWCARE-Logos ersetzt (web, admin, space, PWA)
- **Farbschema:** Primärblau angepasst in CSS Custom Properties (oklch) und Theme-Constants
- **App-Name:** "Plane" → "DBWCARE Board" in Meta-Tags, Manifests, Sidebar
- **Login-Screens:** Plane-Referenzen entfernt, Auth-Footer mit Plane-Logos entfernt
- **Sidebar:** Gradient angepasst, Quickstart-Copy geändert
- **OG-Meta:** Open Graph Tags auf DBWCARE gebrandet

### Infrastruktur-Setup

- **Server:** Hetzner ARM64 (168.119.122.191), Host-nginx + Let's Encrypt SSL
- **Docker Stack:** 6 Services (web, admin, space, live, backend, proxy) auf Port 8082
- **DNS:** `care.dbw-media.de` → A-Record
- **Git Remote:** `git@github.com:dbwmedia/dbwcare-board.git` (SSH only)
- **CLAUDE.md:** Dokumentation für Repo-Struktur, Dev-Workflow, Deploy, Branding-Strategie
