# DBWCARE Board – Changelog

Alle wesentlichen Änderungen am DBWCARE-Fork von Plane.

---

## v0.5.0 – 2026-05-31

### Guest-Issue-Notification

- **E-Mail an care@dbw-media.de** wenn ein Kunde (Guest) eine neue Aufgabe erstellt
- Celery-Task `dbwcare_guest_issue_notification` — wird sofort aus `IssueViewSet.create()` getriggert
- E-Mail-Template im DBWCARE-Design: Projektname, Issue-Titel, Kundenname, Direktlink
- Immer aktiv (kein Toggle), feuert nur bei `role=5` (Guest)

### Optionaler Wochenbericht

- **Neues Feld:** `weekly_report_enabled` auf `ProjectCareSubscription` (Default: False)
- **Migration:** `0504_care_weekly_report`
- **Celery-Beat-Task:** `dbwcare_weekly_report` — jeden Montag 08:00 UTC
- **Logik:** Nur senden wenn Worklog-Eintraege in den letzten 7 Tagen vorhanden, sonst schweigen
- **Template:** Kompakter Wochenbericht im gleichen DBWCARE-Design wie Monatsbericht
- **Inhalt:** Intro-Text mit Gesamt-Zeit, optionaler Monatsstand-Balken, Leistungen + Geschenke gruppiert nach Issue
- **Settings-UI:** Toggle + Beschreibung in DBWCARE Project Settings (Sektion "Monatsbericht & Kundendaten")
- **i18n:** Keys `weekly_report_enabled` und `weekly_report_desc` in EN + DE

### Version & Build

- **Version:** DBWCARE v0.5.0
- **Edition-Badge:** Refactored — Version-Konstanten aus `ce/constants/version.ts` statt `package.json`

---

## v0.4.0 – 2026-05-31

### Experten-Team Feature

- **Model:** `expert_ids` JSONField auf `ProjectCareSubscription` — Liste zugewiesener Experten pro Kunde (z.B. `["dennis", "robin", "lara"]`)
- **Migration:** `0503_care_expert_ids`
- **Bilder:** Mitarbeiter-Fotos (Dennis, Robin, Lara) mit Gradient-Ring als statische Assets
- **Admin-Settings:** Neue Sektion "Dein Experten-Team" in DBWCARE Project Settings — Experten per Klick zuweisen/entfernen, visuelle Karten mit Foto
- **Expert-Bar (Guest):** Fixierte Bottom-Bar nur fuer Gast-Nutzer:
  - Links: "Deine Experten" + "Wir beraten dich gerne!" + runde Profilbilder
  - Rechts: Gradient "Neue Aufgabe"-Button (oeffnet Create-Issue-Modal)
  - Glas-Hintergrund (`backdrop-blur-xl`), keine Border
  - Eingebunden im Workspace-Layout (`(projects)/layout.tsx`)

### Guest-Permissions erweitert

- **Issue-Bearbeitung:** `ROLE.GUEST` in `IssueViewSet.partial_update` — Guests koennen Issues bearbeiten
- **Kanban Drag & Drop:** `canEditProperties` in Kanban- und List-Layout inkludiert jetzt `GUEST` — Guests koennen Issues zwischen Spalten verschieben
- **Create-Issue-Modal:** `fetchProjectsWithCreatePermissions` filtert auf `>= GUEST` (war `>= MEMBER`) — Modal oeffnet sich jetzt fuer Guests
- **Guest-Sichtbarkeit:** `guest_view_all_features` Default auf `True` geaendert — Guests sehen alle Issues im Projekt, nicht nur selbst erstellte
- **Sidebar bereinigt:** "Neue Aufgabe"-Button oben links fuer Guests ausgeblendet (jetzt in Expert-Bar)

### App-Defaults

- **Light Theme:** Default-Theme fuer neue User auf `light` geaendert (war `system`), bestehende User migriert
- **Montag als Wochenstart:** Backend `start_of_the_week` Default auf `MONDAY` geaendert (war `SUNDAY`), bestehende User migriert
- **Frontend Fallback:** `defaultTheme="light"` in `root.tsx`, Store-Wrapper Fallback auf `"light"` statt `"system"`

### Recurring Issues — Template-Variablen

- **Template-Variablen:** Issue-Name beim Klonen unterstuetzt jetzt `{monat}` (deutscher Monatsname), `{jahr}` (Jahreszahl), `{monat_nr}` (zweistellig)
- **Beispiel:** Template "Sicherheitsupdates {monat} {jahr}" erzeugt "Sicherheitsupdates Juni 2026"
- **Recurrence-UI Fix:** Komponente wird jetzt auch angezeigt bevor die Subscription vollstaendig geladen ist

### Versionierung

- **Eigene Versionierung:** DBWCARE nutzt `0.x.y` bis zum 1.0 Launch, unabhaengig von Plane-Upstream
- **Plane-Basis:** `planeUpstreamVersion` Feld in `package.json` — wird bei Upstream-Merge aktualisiert
- **Footer:** "von dbw media v0.4.0 (Plane 1.3.1)" — zeigt beide Versionen

---

## v0.3.1 – 2026-05-30

### Zeiterfassung — Eintraege bearbeiten

- **Edit-Modal:** Pencil-Icon pro Worklog-Eintrag → Modal zum Bearbeiten von Dauer, Beschreibung, Abrechnungsstatus und Geschenk-Begruendung
- **Store:** `updateWorklogEntry` Action mit PATCH-API, automatisches Balance-Refresh nach Edit
- **UX:** Modals (Timer-Stop, Manual-Entry, Edit) schliessen sich nicht mehr bei Backdrop-Click — nur noch ueber Cancel-Button
- **i18n:** "Eintrag bearbeiten", "Aenderungen speichern"

### Rollen-System & Kunden-UI-Vereinfachung

- **Rollen umbenannt:** Guest → "Kunde", Member → "Entwickler", Admin → "Admin"
- **Provisioning:** Kunden werden als Guest (5) statt Member (15) angelegt
- **Issue-Erstellung:** Guests koennen jetzt Issues erstellen
- **Sidebar fuer Guests:** Nur "Neue Aufgabe"-Button, CARE-Widget, eigenes Projekt → "Aufgaben" — alles andere ausgeblendet (Home, Drafts, Your Work, Stickies, Workspace, Projects-Header, Footer)
- **CARE-Widget:** Gradient-Hintergrund (gruen/gelb/rot je nach Verbrauch), "**CARE**-Kontingent" mit Bold-Branding, Klick oeffnet eigene Uebersichtsseite
- **Care-Uebersichtsseite:** `/:workspace/projects/:projectId/care` — Hero mit grosser Zahl, Fortschrittsbalken, Stats, Monatsverlauf mit allen vergangenen Monaten
- **Default-Layout:** Kanban statt Liste fuer neue User
- **i18n:** "Work Items" → "Aufgaben", "New work item" → "Neue Aufgabe", sidebar-Block in EN hinzugefuegt

### Monthly Report & Kundendaten

- **Model:** 3 neue Felder auf `ProjectCareSubscription`: `customer_name`, `customer_email`, `report_enabled`
- **Migration:** `0502_care_report_fields`
- **Celery-Task:** `dbwcare_monthly_report` — generiert am 2. des Monats (08:00 UTC) den Bericht des Vormonats und versendet ihn per SMTP
- **E-Mail-Template:** dbwCARE Pill-Logo mit Gradient-Border, Gradient-Accent-Bar, Gradient-CTA-Button, gruppierte Leistungstabelle (nach Issue mit Subtotals), Geschenk-Sektion, Vormonats-Vergleich, Dankeschoen-Footer
- **Report-Logik:** Eintraege nach Issue gruppiert (Header + Einzelzeiten), `self_caused` ausgeblendet, `gift` in eigener Sektion
- **Manueller Versand:** Default = aktueller Monat, Monat-Dropdown mit nur Monaten die Daten haben
- **API:** `POST /projects/<pid>/care-report/send/` — manueller Report-Versand (Admin only), mit `year`/`month` Parameter
- **Frontend:** Sektion "Monatsbericht & Kundendaten" mit Kundenname, E-Mail, Report-Toggle, Monat-Auswahl, "Report senden"-Button

### i18n — Deutsch in EN-Translations

- Alle `dbwcare.*` Keys in der EN-Datei auf Deutsch gesetzt (Zeiterfassung, Provisioning, Reports, Settings)
- Hardcoded Datums-Labels auf Deutsch (heute, gestern, vor Xt)
- Schreibweisen: DBW**CARE** (Produkt), dbw media (Agentur, alles klein)

---

## v0.3.0 – 2026-05-27

### Direct Customer Provisioning

- **Backend:** `POST /projects/<pid>/provision-customer/` — erstellt User + Workspace/Project-Membership in einem Schritt (Admin only, throttled 10/min)
- **Frontend:** "Kunden-Account anlegen"-Button in Project Settings → Members, `ProvisionCustomerModal` mit Passwort-Generator
- **User-Flags:** `is_password_autoset=True` — Onboarding zeigt nur Profil-Setup (kein PW-Step), PW aenderbar ohne altes PW
- **Member-Refresh:** Nach Provisioning werden Workspace- und Project-Members neu geladen

### i18n Fixes

- **Nested Keys:** `dbwcare`-Keys von Flat-Strings (`"dbwcare.key": "value"`) auf verschachtelte Objekte (`dbwcare: { key: "value" }`) umgestellt — noetig weil Plane's TranslationStore `lodash.get()` nutzt

---

## v0.2.0 – 2026-05-20

### DBWCARE Project-Level Refactor

- **Geschaeftsmodell-Umstellung:** Subscription & Balance von Workspace-Ebene auf Project-Ebene migriert (1 Workspace = "DBW Care", 1 Projekt = 1 Kunde)
- **Models:** `WorkspaceCareSubscription` → `ProjectCareSubscription`, `WorkspaceMonthlyBalance` → `ProjectMonthlyBalance`
- **Migration 0501:** Automatische Datenmigration von alten Workspace-Tabellen auf Project-Ebene
- **API:** Neue Endpoints unter `/projects/<pid>/care-subscription/`, `/projects/<pid>/care-balance/`, `/care-overview/` (Admin Mission Control)
- **Frontend:** Project-Settings `/settings/projects/:pid/care`, Mission Control `/settings/care`
- **Store:** `subscriptions[projectId]`, `balances[projectId]` statt single `subscription`/`currentBalance`

### Mission Control

- **Admin-Dashboard:** Uebersicht aller Projekte mit Care-Subscriptions, Sortierung nach Auslastung/Name/Rest, Fortschrittsbalken (gruen/gelb/rot)
- **Deep-Links:** Klick auf Projekt → direkt zu Project Care Settings

### Local Dev Improvements

- **`dev-local.sh`:** Full-Stack lokale Entwicklungsumgebung (Docker Backend + pnpm Frontend)
- **Seed-Daten:** `./dev-local.sh seed` → `dev@dbwcare.test` / `dev12345` mit Demo-Workspace + Subscription
- **Smoke-Check:** `./dev-local.sh check` prueft ob Frontend und Backend gegen gleiche Instanz laufen
- **Vite-Configs:** Proxy-Konfiguration fuer alle 3 Apps (web, admin, space)
- **Env-Pitfall geloest:** `dev-local.sh` entfernt `.env.local` in App-Ordnern (Vite-Prioritaets-Problem)

---

## v0.1.1 – 2026-05-14

### CI/CD Pipeline

- **ARM64 Native Builds:** Docker Images werden jetzt auf nativen ARM64-Runnern gebaut (kein QEMU-Emulation mehr)
- **Path-Filter:** `dorny/paths-filter` — nur geaenderte Services werden gebaut
- **Auto-Deploy:** SSH-Deploy nach erfolgreichem Build auf `care.dbw-media.de`
- **Build-Trigger-Trick:** Kommentar in `packages/tailwind-config/brand.css` aendern → `packages/**` Filter → alle Frontends werden gebaut

---

## v0.1.0 – 2026-05-08

### DBWCARE Time Tracking & Customer Quota Portal

- **4 neue Models:** `ProjectCareSubscription`, `ProjectMonthlyBalance`, `WorklogEntry`, `IssueRecurrence`
- **Migration 0500:** `dbwcare_init` — erstellt alle Tabellen
- **API-Endpoints:** Subscription CRUD, Balance (current + history), Worklog CRUD, Timer (start/stop/active), Recurrence CRUD
- **Timer-System:** Start/Stop-Timer pro Issue, system-weite Pruefung auf laufende Timer, optionaler `force_stop`
- **Billing-Status:** `billable`, `gift` (mit Begruendung), `self_caused` (intern)
- **Celery-Tasks:** `dbwcare_monthly_balance_init` (taeglich 00:05 UTC — Balance-Rollover), `dbwcare_recurrence_generator` (taeglich 00:15 UTC — Issue-Klonen)
- **Frontend:** Care Balance Widget (Sidebar), Worklog-Liste pro Issue, Timer-UI, Manual Entry Modal, Timer-Stop Modal mit Billing-Status
- **Store:** MobX `CareStore` mit allen Actions und Computed Properties

### Recurring Issues

- **Typen:** `monthly_date` (Tag X im Monat) und `interval_days` (alle N Tage)
- **Auto-Generierung:** Celery-Task klont Template-Issue in Default-State (Backlog)
- **UI:** RecurrenceConfig in Issue-Detail-Sidebar

---

## v0.1.0 – 2026-04-28

### Branding

- **Logo-Austausch:** Alle Plane-Logos durch DBWCARE-Logos ersetzt (web, admin, space, PWA)
- **Farbschema:** Primaerblau angepasst in CSS Custom Properties (oklch) und Theme-Constants
- **App-Name:** "Plane" → "DBWCARE Board" in Meta-Tags, Manifests, Sidebar
- **Login-Screens:** Plane-Referenzen entfernt, Auth-Footer mit Plane-Logos entfernt
- **Sidebar:** Gradient angepasst, Quickstart-Copy geaendert
- **OG-Meta:** Open Graph Tags auf DBWCARE gebrandet

### Infrastruktur-Setup

- **Server:** Hetzner ARM64 (168.119.122.191), Host-nginx + Let's Encrypt SSL
- **Docker Stack:** 6 Services (web, admin, space, live, backend, proxy) auf Port 8082
- **DNS:** `care.dbw-media.de` → A-Record
- **Git Remote:** `git@github.com:dbwmedia/dbwcare-board.git` (SSH only)
- **CLAUDE.md:** Dokumentation fuer Repo-Struktur, Dev-Workflow, Deploy, Branding-Strategie
