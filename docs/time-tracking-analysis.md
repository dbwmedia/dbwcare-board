# Time Tracking -- Architektur-Analyse

## TL;DR

Plane hat **bereits eine Time-Tracking/Worklog-Architektur vorbereitet** -- das Backend-Model `Project` hat ein `is_time_tracking_enabled`-Flag (Zeile 98), das Frontend hat leere Worklog-Stub-Komponenten im `ce/`-Ordner, und die Activity-Types enthalten `WORKLOG`. Die eigentliche Logik ist hinter der Paywall (Plane Pro/EE, closed-source `plane-web` vs. `ce`). Wir muessen "nur" die leeren Stubs mit Leben fuellen. Die Architektur-Konvention ist durch das Estimate-Feature komplett dokumentierbar (Model -> Serializer -> ViewSet -> URLs -> Service -> MobX Store -> Komponenten). Geschaetzter Aufwand: **8-12 Personentage** fuer eine MVP-Version. Groesstes Risiko: Upstream-Merges koennten unsere `ce/`-Stubs ueberschreiben, wenn Plane Pro-Features in die CE wandern.

---

## Phase 1: Bestandsaufnahme

### 1.1 Existierende Time-Tracking-Infrastruktur (bereits im Repo!)

**Backend:**

| Fund | Pfad | Zeile | Beschreibung |
|------|------|-------|-------------|
| Feature-Flag auf Project | `apps/api/plane/db/models/project.py` | 98 | `is_time_tracking_enabled = models.BooleanField(default=False)` |
| Migration dafuer | `apps/api/plane/db/migrations/0070_...` | 39 | `AddField model_name='project', name='is_time_tracking_enabled'` |
| Serializer-Feld | `apps/api/plane/api/serializers/project.py` | 94 | Feld ist in der API exponiert |

**Frontend -- Leere CE-Stubs (Goldgrube!):**

| Stub | Pfad | Beschreibung |
|------|------|-------------|
| Worklog Property (Issue-Sidebar) | `apps/web/ce/components/issues/worklog/property/root.tsx` | `IssueWorklogProperty` -- leere Komponente, wird in Issue-Detail-Sidebar eingebunden (Zeile 262-267 von `sidebar.tsx`) |
| Worklog Activity | `apps/web/ce/components/issues/worklog/activity/root.tsx` | `IssueActivityWorklog` -- leere Komponente |
| Worklog Create Button | `apps/web/ce/components/issues/worklog/activity/worklog-create-button.tsx` | `IssueActivityWorklogCreateButton` -- leere Komponente |
| Activity Filter Root | `apps/web/ce/components/issues/worklog/activity/filter-root.tsx` | `ActivityFilterRoot` -- CE-Version ohne Worklog-Filter |

**Frontend -- Referenzen auf die Stubs:**

| Datei | Zeile | Was passiert |
|-------|-------|-------------|
| `apps/web/core/components/issues/issue-detail/sidebar.tsx` | 44, 262-267 | Importiert und rendert `IssueWorklogProperty` via `@/plane-web/components/issues/worklog/property` |
| `apps/web/core/components/issues/issue-detail/issue-activity/root.tsx` | 25-26 | Importiert `ActivityFilterRoot` und `IssueActivityWorklogCreateButton` |
| `apps/web/core/components/issues/issue-detail/issue-activity/activity-comment-root.tsx` | (referenziert) | Nutzt Worklog-Activity-Komponente |
| `apps/web/core/components/issues/peek-overview/properties.tsx` | (referenziert) | Worklog auch in Peek-Overview |

**i18n -- Bereits uebersetzt in 20+ Sprachen:**

| Key | Beispiel (DE) | Pfad |
|-----|--------------|------|
| `time_tracking` | "Zeiterfassung" | `packages/i18n/src/locales/de/translations.ts:394` |
| `time_tracking_description` | "Erfassen Sie die auf Arbeitselemente und Projekte verwendete Zeit." | `packages/i18n/src/locales/de/translations.ts:406` |

**UI-Assets:**

| Asset | Pfad |
|-------|------|
| Worklog Empty-State Illustration | `packages/propel/src/empty-state/assets/horizontal-stack/worklog.tsx` |
| Timer Icon (Activity) | `apps/web/core/components/common/activity/helper.tsx:72` (`is_time_tracking_enabled: Timer`) |
| Activity-Text | `apps/web/core/components/common/activity/helper.tsx:280-282` |

**Types:**

| Type | Pfad | Zeile |
|------|------|-------|
| Activity-Type `WORKLOG` | `packages/types/src/issues/activity/base.ts` | 82 |
| `worklog` Asset-Type | `packages/propel/src/empty-state/assets/asset-types.ts` | 28 |

**Exporter-Support:**

| Fund | Pfad | Zeile |
|------|------|-------|
| Export-Typ `issue_worklogs` | `apps/api/plane/db/models/exporter.py` | 31 |

**Pricing/Plans:**

| Fund | Pfad | Zeile |
|------|------|-------|
| "Time Tracking + Worklogs" als Pro-Feature | `apps/web/core/constants/plans.tsx` | 183 |
| "Limited time tracking" (One Plan) | `apps/web/core/constants/plans.tsx` | 1305 |
| "Full Time Tracking" (Pro Plan) | `apps/web/core/constants/plans.tsx` | 1306 |

### 1.2 Was NICHT da ist

- **Kein `TimeEntry`-Model** im CE-Backend -- das ist der Kern, den wir bauen muessen
- **Kein `WorkspaceTimeQuota`-Model** -- das ist unser Custom-Feature, nicht Plane-Standard
- **Keine API-Endpoints** fuer Time-Entries in der CE
- **Keine MobX-Stores** fuer Time-Tracking im `ce/`-Ordner (nur leere Stubs auf Komponenten-Ebene)
- **Kein Timer-UI** -- die Stubs sind leer

### 1.3 `plane-web` Alias-Mechanismus (kritisch fuer unsere Strategie)

```
// apps/web/tsconfig.json Zeile 9:
"@/plane-web/*": ["./ce/*"]
```

Das bedeutet: Imports wie `@/plane-web/components/issues/worklog/property` werden auf `./ce/components/issues/worklog/property` aufgeloest. In der Pro/EE-Version zeigt dieser Alias auf einen anderen Ordner mit echten Implementierungen. **Unsere Strategie: Wir fuellen die `ce/`-Stubs mit unseren Implementierungen.**

---

## Phase 2: Architektur-Vorbild (Estimates Feature)

Das Estimate-Feature ist der perfekte Blaupause-Kandidat. Hier der komplette vertikale Stack:

### 2.1 Backend

#### Model (`apps/api/plane/db/models/estimate.py`)

```python
class Estimate(ProjectBaseModel):        # Zeile 18
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    type = models.CharField(max_length=255, choices=EstimateType.choices)
    last_used = models.BooleanField(default=False)

class EstimatePoint(ProjectBaseModel):   # Zeile 43
    estimate = models.ForeignKey("db.Estimate", on_delete=CASCADE, related_name="points")
    key = models.IntegerField(default=0)
    description = models.TextField(blank=True)
    value = models.CharField(max_length=255)
```

Beide erben von `ProjectBaseModel` (`apps/api/plane/db/models/project.py:180`), die automatisch `project` und `workspace` FKs bereitstellt.

**Basis-Modell-Hierarchie:**
```
SoftDeleteModel + TimeAuditModel + UserAuditModel
    -> AuditModel (apps/api/plane/db/mixins.py:85)
        -> BaseModel (apps/api/plane/db/models/base.py:17) -- adds UUID pk
            -> ProjectBaseModel (project.py:180) -- adds project + workspace FK
            -> WorkspaceBaseModel (workspace.py:185) -- adds workspace + optional project FK
```

Jedes Model bekommt automatisch: `id` (UUID), `created_at`, `updated_at`, `created_by`, `updated_by`, `deleted_at` (Soft-Delete).

#### Serializer (`apps/api/plane/app/serializers/estimate.py`)

```python
class EstimateSerializer(BaseSerializer):           # Zeile 13 - Write
class EstimatePointSerializer(BaseSerializer):      # Zeile 20 - Write mit Validation
class EstimateReadSerializer(BaseSerializer):       # Zeile 35 - Read mit nested Points
class WorkspaceEstimateSerializer(BaseSerializer):  # Zeile 44 - Read fuer Workspace-Kontext
```

Pattern: Separate Read- und Write-Serializer. Read-Serializer inkludiert nested Related-Objects.

#### ViewSet (`apps/api/plane/app/views/estimate/base.py`)

```python
class ProjectEstimatePointEndpoint(BaseAPIView):     # Zeile 34 - GET only
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])     # Decorator-basiertes Permission

class BulkEstimatePointEndpoint(BaseViewSet):        # Zeile 49 - CRUD
    permission_classes = [ProjectEntityPermission]    # Class-basiertes Permission

class EstimatePointEndpoint(BaseViewSet):            # Zeile 153 - CRUD fuer einzelne Points
    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
```

Pattern: `BaseViewSet` (aus `apps/api/plane/app/views/base.py:48`) erbt von `ModelViewSet + BasePaginator`. Permissions via `permission_classes` oder `@allow_permission` Decorator.

#### URL-Routing (`apps/api/plane/app/urls/estimate.py`)

```
workspaces/<str:slug>/projects/<uuid:project_id>/project-estimates/
workspaces/<str:slug>/projects/<uuid:project_id>/estimates/
workspaces/<str:slug>/projects/<uuid:project_id>/estimates/<uuid:estimate_id>/
workspaces/<str:slug>/projects/<uuid:project_id>/estimates/<uuid:estimate_id>/estimate-points/
workspaces/<str:slug>/projects/<uuid:project_id>/estimates/<uuid:estimate_id>/estimate-points/<id>/
```

URL-Registration: `apps/api/plane/app/urls/__init__.py` importiert und merged alle URL-Listen.

### 2.2 Frontend

#### Service Layer (`apps/web/core/services/estimate.service.ts`)

```typescript
class EstimateService extends APIService {
    fetchWorkspaceEstimates(workspaceSlug)
    fetchProjectEstimates(workspaceSlug, projectId)
    fetchEstimateById(workspaceSlug, projectId, estimateId)
    createEstimate(workspaceSlug, projectId, payload)
    deleteEstimate(workspaceSlug, projectId, estimateId)
    createEstimatePoint(...)
    updateEstimatePoint(...)
}
```

Pattern: Klasse erbt von `APIService`, Methoden wrappen `this.get/post/patch/delete`.

#### MobX Store (`apps/web/core/store/estimates/project-estimate.store.ts`)

```typescript
class ProjectEstimateStore implements IProjectEstimateStore {
    loader: TEstimateLoader
    estimates: Record<string, IEstimate>  // estimate_id -> Estimate instance
    error: TErrorCodes | undefined

    // computed
    currentActiveEstimateId, areEstimateEnabledByProjectId, ...

    // actions
    getWorkspaceEstimates, getProjectEstimates, createEstimate, deleteEstimate
}
```

Registriert in `apps/web/core/store/root.store.ts:127`: `this.projectEstimate = new ProjectEstimateStore(this)`.

Entity-Store (`apps/web/ce/store/estimates/estimate.ts`):
```typescript
class Estimate implements IEstimate {
    // alle Felder als observable
    estimatePoints: Record<string, IEstimatePoint>

    constructor(public store: CoreRootStore, public data: IEstimateType) {
        makeObservable(this, { /* ... */ })
    }
}
```

#### Types (`packages/types/src/estimate.ts`)

```typescript
interface IEstimatePoint { id, key, value, description, workspace, project, estimate, ... }
interface IEstimate { id, name, description, type, points, workspace, project, last_used, ... }
interface IEstimateFormData { estimate?, estimate_points[] }
```

#### Komponenten

| Komponente | Pfad |
|-----------|------|
| Estimate Dropdown (Issue-Sidebar) | `apps/web/core/components/dropdowns/estimate.tsx` |
| Estimate List (Project-Settings) | `apps/web/core/components/estimates/estimate-list.tsx` |
| Estimate List Item | `apps/web/core/components/estimates/estimate-list-item.tsx` |
| Estimate Disable Switch | `apps/web/core/components/estimates/estimate-disable-switch.tsx` |
| Estimate Search | `apps/web/core/components/estimates/estimate-search.tsx` |
| Estimate Column (Spreadsheet) | `apps/web/core/components/issues/issue-layouts/spreadsheet/columns/estimate-column.tsx` |
| Estimate Activity Action | `apps/web/core/components/issues/issue-detail/issue-activity/activity/actions/estimate.tsx` |
| Estimate Icon | `packages/propel/src/icons/properties/estimate-icon.tsx` |

#### Hooks

| Hook | Pfad |
|------|------|
| `useProjectEstimates` | `apps/web/core/hooks/store/estimates/use-project-estimate.ts` |
| `useEstimate` | `apps/web/core/hooks/store/estimates/use-estimate.ts` |
| `useEstimatePoint` | `apps/web/core/hooks/store/estimates/use-estimate-point.ts` |

---

## Phase 3: Daten-Modell

### 3.1 `TimeEntry` (Kern-Tabelle)

```python
# apps/api/plane/db/models/time_entry.py

from django.db import models
from .workspace import WorkspaceBaseModel


class TimeEntry(WorkspaceBaseModel):
    """
    Einzelner Zeiteintrag zu einem Issue.
    Orientiert an Plane's WorkspaceBaseModel-Pattern (wie WorkspaceUserLink).
    WorkspaceBaseModel statt ProjectBaseModel, weil wir Workspace-weite Aggregation brauchen.
    """
    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="time_entries",
        null=True,
        blank=True,  # Erlaubt Workspace-Level-Eintraege ohne Issue
    )
    # WorkspaceBaseModel liefert: workspace (FK), project (FK, nullable)
    # BaseModel liefert: id (UUID), created_at, updated_at, created_by, updated_by, deleted_at

    description = models.TextField(blank=True, default="")

    # Timer-basiert (Start/Stop)
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)

    # Dauer in Minuten (berechnet bei Stop, oder manuell gesetzt)
    duration_minutes = models.PositiveIntegerField(default=0)

    # Ob der Timer gerade laeuft
    is_running = models.BooleanField(default=False)

    # Ob abrechenbar (fuer spaetere Erweiterung)
    is_billable = models.BooleanField(default=True)

    class Meta:
        db_table = "time_entries"
        ordering = ("-created_at",)
        verbose_name = "Time Entry"
        verbose_name_plural = "Time Entries"
        indexes = [
            # Query 1: Alle Eintraege eines Workspace im aktuellen Monat (Quota-Berechnung)
            models.Index(
                fields=["workspace", "started_at"],
                name="time_entry_ws_started_idx",
            ),
            # Query 2: Alle Eintraege eines Issues (Issue-Detail-Ansicht)
            models.Index(
                fields=["issue", "created_at"],
                name="time_entry_issue_created_idx",
            ),
            # Query 3: Laufende Timer eines Users
            models.Index(
                fields=["created_by", "is_running"],
                name="time_entry_user_running_idx",
            ),
        ]

    def __str__(self):
        return f"TimeEntry {self.id} - {self.duration_minutes}min"
```

### 3.2 `WorkspaceTimeQuota` (Kontingent-Tabelle)

```python
# apps/api/plane/db/models/time_entry.py (gleiche Datei)

class WorkspaceTimeQuota(BaseModel):
    """
    Monatliches Stundenkontingent pro Workspace.
    Orientiert an WorkspaceTheme-Pattern (workspace FK, einfaches Datenmodell).
    """
    workspace = models.OneToOneField(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="time_quota",
    )
    # Monatliches Kontingent in Minuten (z.B. 360 = 6 Stunden)
    monthly_minutes = models.PositiveIntegerField(default=360)

    # Ab wann wird gewarnt (Prozent, z.B. 80 = ab 80% verbraucht)
    warning_threshold_percent = models.PositiveIntegerField(default=80)

    class Meta:
        db_table = "workspace_time_quotas"
        verbose_name = "Workspace Time Quota"
        verbose_name_plural = "Workspace Time Quotas"

    def __str__(self):
        return f"Quota {self.workspace.name}: {self.monthly_minutes}min/month"
```

### 3.3 Migrations-Strategie

- **Eigene Migration** in `apps/api/plane/db/migrations/0122_time_entry_workspace_time_quota.py`
- Nummerierung: nach `0121_alter_estimate_type.py` (aktuell letzte)
- Keine Abhaengigkeiten von bestehenden Tabellen ausser `workspaces`, `projects`, `issues`, `users`
- **Idempotent**: Nur `CreateModel` -- kein Datenverlust, kein Downtime
- **Rueckwaerts-kompatibel**: Keine bestehenden Tabellen/Spalten geaendert
- **Model-Registration**: `TimeEntry` und `WorkspaceTimeQuota` in `apps/api/plane/db/models/__init__.py` hinzufuegen

### 3.4 Monatlicher Reset

Kein automatischer Reset noetig! Die Quota-Berechnung erfolgt per Query:

```sql
SELECT COALESCE(SUM(duration_minutes), 0)
FROM time_entries
WHERE workspace_id = %s
  AND started_at >= date_trunc('month', NOW())
  AND started_at < date_trunc('month', NOW()) + interval '1 month'
  AND deleted_at IS NULL
```

Die Differenz `monthly_minutes - consumed_minutes` ergibt das Restkontingent. Kein Cron-Job, kein Reset-Task.

---

## Phase 4: API

### 4.1 Time Entry CRUD

#### `GET /api/v1/workspaces/<slug>/time-entries/`

**Permission:** `WorkspaceEntityPermission` (alle Workspace-Members koennen lesen)

**Query-Parameter:**
- `issue_id` (optional) -- Filter auf ein Issue
- `user_id` (optional) -- Filter auf einen User
- `start_date` / `end_date` (optional) -- Zeitraum-Filter
- `is_running` (optional) -- Nur laufende Timer

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "issue": "uuid",
      "project": "uuid",
      "workspace": "uuid",
      "description": "Bug-Analyse durchgefuehrt",
      "started_at": "2026-05-14T10:00:00Z",
      "ended_at": "2026-05-14T11:30:00Z",
      "duration_minutes": 90,
      "is_running": false,
      "is_billable": true,
      "created_by": "uuid",
      "created_at": "2026-05-14T10:00:00Z",
      "updated_at": "2026-05-14T11:30:00Z"
    }
  ]
}
```

#### `POST /api/v1/workspaces/<slug>/time-entries/`

**Permission:** `@allow_permission([ROLE.ADMIN, ROLE.MEMBER])`

**Request:**
```json
{
  "issue": "uuid",
  "description": "Feature-Entwicklung",
  "duration_minutes": 120,
  "started_at": "2026-05-14T09:00:00Z",
  "is_billable": true
}
```

#### `PATCH /api/v1/workspaces/<slug>/time-entries/<uuid:time_entry_id>/`

**Permission:** `@allow_permission([ROLE.ADMIN, ROLE.MEMBER])` + Nur eigene Eintraege (oder Admin)

#### `DELETE /api/v1/workspaces/<slug>/time-entries/<uuid:time_entry_id>/`

**Permission:** `@allow_permission([ROLE.ADMIN, ROLE.MEMBER])` + Nur eigene Eintraege (oder Admin)

### 4.2 Timer Start/Stop

#### `POST /api/v1/workspaces/<slug>/time-entries/timer/start/`

**Permission:** `@allow_permission([ROLE.ADMIN, ROLE.MEMBER])`

**Request:**
```json
{
  "issue": "uuid",
  "description": "Working on..."
}
```

**Logik:**
1. Pruefen ob User bereits einen laufenden Timer hat -> 400 wenn ja
2. `TimeEntry` erstellen mit `is_running=True`, `started_at=now()`
3. Response: der neue TimeEntry

#### `POST /api/v1/workspaces/<slug>/time-entries/timer/stop/`

**Permission:** `@allow_permission([ROLE.ADMIN, ROLE.MEMBER])`

**Logik:**
1. Laufenden Timer des Users finden (`is_running=True, created_by=request.user`)
2. `ended_at = now()`, `duration_minutes = diff`, `is_running=False`
3. Response: der aktualisierte TimeEntry

### 4.3 Time Quota

#### `GET /api/v1/workspaces/<slug>/time-quota/`

**Permission:** `WorkspaceViewerPermission` (alle Members koennen sehen)

**Response:**
```json
{
  "monthly_minutes": 360,
  "consumed_minutes": 210,
  "remaining_minutes": 150,
  "warning_threshold_percent": 80,
  "is_warning": true,
  "period_start": "2026-05-01T00:00:00Z",
  "period_end": "2026-05-31T23:59:59Z"
}
```

`consumed_minutes` wird on-the-fly per Aggregation berechnet (kein gespeicherter Wert).

#### `PATCH /api/v1/workspaces/<slug>/time-quota/`

**Permission:** `WorkspaceOwnerPermission` (nur Owner/Admin)

**Request:**
```json
{
  "monthly_minutes": 480,
  "warning_threshold_percent": 75
}
```

### 4.4 Backend-Dateien die erstellt/geaendert werden

| Aktion | Pfad |
|--------|------|
| **Neu** | `apps/api/plane/db/models/time_entry.py` |
| **Aendern** | `apps/api/plane/db/models/__init__.py` -- Import hinzufuegen |
| **Neu** | `apps/api/plane/db/migrations/0122_time_entry_workspace_time_quota.py` |
| **Neu** | `apps/api/plane/app/serializers/time_entry.py` |
| **Aendern** | `apps/api/plane/app/serializers/__init__.py` -- Import hinzufuegen |
| **Neu** | `apps/api/plane/app/views/time_entry/` (Ordner mit `__init__.py`, `base.py`) |
| **Aendern** | `apps/api/plane/app/views/__init__.py` -- Import hinzufuegen |
| **Neu** | `apps/api/plane/app/urls/time_entry.py` |
| **Aendern** | `apps/api/plane/app/urls/__init__.py` -- Import + merge |

---

## Phase 5: UI

### 5.1 Kontingent-Anzeige (Workspace-Header)

**Wo:** Die Hauptnavigation rendert einen `AppHeader` (`apps/web/core/components/core/app-header.tsx:22`), der `ExtendedAppHeader` rendert. Der eigentliche Page-Header wird per `header` Prop uebergeben (jede Page hat ihren eigenen).

**Besserer Ort:** Die **Sidebar** (`apps/web/core/components/workspace/sidebar/sidebar-menu-items.tsx`). Dort koennte ueber dem "Workspace"-Disclosure-Panel ein kompaktes Quota-Widget eingefuegt werden. Alternativ: unterhalb der statischen Navigationspunkte (Zeile 99-103).

**Widget-Entwurf:**
```
+------------------------------------+
| Zeitkontingent Mai 2026            |
| [=========-------] 58% verbraucht  |
| 3h 30min / 6h 00min               |
+------------------------------------+
```

- Progress-Bar mit Plane's Farben: `bg-primary-100` (Track), `bg-primary-500` (Fill)
- Ab `warning_threshold_percent`: Fill wechselt zu `bg-warning-500`
- Ab 100%: Fill wechselt zu `bg-danger-500`
- Hover: Tooltip mit Details (verbraucht / gesamt / Resttage im Monat)
- Klick: Link zu Workspace Settings -> Time Tracking

**Plane-Komponenten:**
- `@plane/ui` -> `Row`, `Tooltip`
- `@plane/utils` -> `cn` (className merge)
- Eigene `<TimeQuotaWidget />` Komponente

**Dateien:**

| Aktion | Pfad |
|--------|------|
| **Neu** | `apps/web/ce/components/workspace/time-quota-widget.tsx` |
| **Aendern** | `apps/web/core/components/workspace/sidebar/sidebar-menu-items.tsx` -- Widget importieren + rendern |

### 5.2 Zeit-Erfassung im Issue-Detail

**Wo:** Bereits vorbereitet! `IssueWorklogProperty` wird in `apps/web/core/components/issues/issue-detail/sidebar.tsx:262-267` gerendert. Aktuell leer (CE-Stub).

**Strategie:** Die leere `IssueWorklogProperty` in `apps/web/ce/components/issues/worklog/property/root.tsx` mit echtem UI fuellen.

**UI-Entwurf:**
```
[Clock Icon] Zeiterfassung
  [> Start]  oder  [|| 01:23:45 Stop]
  Gesamt: 4h 30min (3 Eintraege)
  [+ Manuell erfassen]
```

**Komponenten-Hierarchie:**
```
IssueWorklogProperty (ce/components/issues/worklog/property/root.tsx)
  +-- TimeEntryTimer (Start/Stop/Laufzeit)
  +-- TimeEntrySummary (Gesamt-Zeit fuer dieses Issue)
  +-- TimeEntryManualButton (oeffnet Modal)
      +-- TimeEntryCreateModal
          +-- Dauer-Input (HH:MM)
          +-- Beschreibung
          +-- Datum-Picker (DateDropdown aus @/components/dropdowns/date)
          +-- Submit/Cancel
```

**Plane-Komponenten die wiederverwendet werden:**
- `SidebarPropertyListItem` (aus `@/components/common/layout/sidebar/property-list-item`)
- `DateDropdown` (aus `@/components/dropdowns/date`)
- `Button`, `Input`, `Modal` (aus `@plane/ui`)
- `Timer` Icon (aus `lucide-react`, bereits importiert in activity/helper)

**Dateien:**

| Aktion | Pfad |
|--------|------|
| **Aendern** | `apps/web/ce/components/issues/worklog/property/root.tsx` -- Echte Implementierung |
| **Neu** | `apps/web/ce/components/issues/worklog/property/timer.tsx` |
| **Neu** | `apps/web/ce/components/issues/worklog/property/summary.tsx` |
| **Neu** | `apps/web/ce/components/issues/worklog/property/manual-entry-modal.tsx` |

### 5.3 Worklog-Activity (Issue-Timeline)

**Wo:** Bereits vorbereitet! `IssueActivityWorklog` und `IssueActivityWorklogCreateButton` sind CE-Stubs.

**Dateien:**

| Aktion | Pfad |
|--------|------|
| **Aendern** | `apps/web/ce/components/issues/worklog/activity/root.tsx` -- Zeigt Worklog-Eintraege in der Timeline |
| **Aendern** | `apps/web/ce/components/issues/worklog/activity/worklog-create-button.tsx` -- Button zum Erfassen |
| **Aendern** | `apps/web/ce/components/issues/worklog/activity/filter-root.tsx` -- Worklog-Filter hinzufuegen |

### 5.4 Admin-Settings (Workspace)

**Wo:** Workspace-Settings haben eine Sidebar mit Kategorien (`packages/constants/src/settings/workspace.ts`). Die Kategorie "Features" ist aktuell **leer** (Zeile 72: `[WORKSPACE_SETTINGS_CATEGORY.FEATURES]: []`).

**Strategie:** Neuen Settings-Eintrag "Time Tracking" zur Features-Kategorie hinzufuegen.

**UI-Entwurf der Settings-Seite:**
```
Time Tracking

Monatliches Kontingent
[___360___] Minuten  (= 6 Stunden)

Warn-Schwelle
[___80____] %

Aktuelle Nutzung (Mai 2026)
[=========-------] 210 / 360 Minuten (58%)

Letzte Eintraege
| User       | Issue      | Dauer   | Datum       |
|-----------|-----------|---------|-------------|
| Dennis    | CARE-42   | 1h 30m  | 14.05.2026  |
| ...       | ...       | ...     | ...         |
```

**Dateien:**

| Aktion | Pfad |
|--------|------|
| **Aendern** | `packages/constants/src/settings/workspace.ts` -- Eintrag in WORKSPACE_SETTINGS + GROUPED_WORKSPACE_SETTINGS |
| **Neu** | `apps/web/app/(all)/[workspaceSlug]/(settings)/settings/(workspace)/time-tracking/page.tsx` |
| **Neu** | `apps/web/app/(all)/[workspaceSlug]/(settings)/settings/(workspace)/time-tracking/header.tsx` |
| **Aendern** | `apps/web/core/components/settings/workspace/sidebar/item-icon.tsx` -- Icon fuer Time Tracking |

### 5.5 Reporting

Fuer das MVP: Die Settings-Seite (5.4) zeigt eine einfache Tabelle mit den letzten Eintraegen. Spaeter kann ein dedizierter "Time Reports"-Tab unter Analytics hinzugefuegt werden.

### 5.6 Frontend Services & Stores

| Aktion | Pfad |
|--------|------|
| **Neu** | `apps/web/core/services/time-entry.service.ts` |
| **Neu** | `apps/web/ce/store/time-tracking/time-entry.store.ts` -- Entity-Store |
| **Neu** | `apps/web/ce/store/time-tracking/time-quota.store.ts` -- Quota-Store |
| **Neu** | `apps/web/ce/store/time-tracking/index.ts` |
| **Aendern** | `apps/web/core/store/root.store.ts` -- Time-Tracking-Store registrieren |
| **Neu** | `apps/web/core/hooks/store/use-time-tracking.ts` |

### 5.7 Types

| Aktion | Pfad |
|--------|------|
| **Neu** | `packages/types/src/time-tracking.ts` |
| **Aendern** | `packages/types/src/index.ts` -- Export hinzufuegen |

```typescript
// packages/types/src/time-tracking.ts

export interface ITimeEntry {
  id: string;
  issue: string | null;
  project: string | null;
  workspace: string;
  description: string;
  started_at: string | null;
  ended_at: string | null;
  duration_minutes: number;
  is_running: boolean;
  is_billable: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ITimeEntryFormData {
  issue?: string;
  description?: string;
  duration_minutes?: number;
  started_at?: string;
  is_billable?: boolean;
}

export interface IWorkspaceTimeQuota {
  monthly_minutes: number;
  consumed_minutes: number;
  remaining_minutes: number;
  warning_threshold_percent: number;
  is_warning: boolean;
  period_start: string;
  period_end: string;
}

export interface IWorkspaceTimeQuotaFormData {
  monthly_minutes?: number;
  warning_threshold_percent?: number;
}
```

---

## Phase 6: Aufwand & Risiken

### 6.1 Aufwandsschaetzung

| Bereich | Aufwand | Beschreibung |
|---------|---------|-------------|
| Backend: Models + Migration | 0.5 PT | Straightforward, Pattern klar |
| Backend: Serializers + Views | 1.5 PT | CRUD + Timer-Logik + Quota-Aggregation |
| Backend: URLs + Permissions | 0.5 PT | Copy-Paste vom Estimate-Pattern |
| Frontend: Types + Service + Store | 1.5 PT | Pattern von Estimate uebernehmen |
| Frontend: Issue-Worklog-Property | 2 PT | Timer-UI, Manual-Entry-Modal, Anzeige |
| Frontend: Quota-Widget (Sidebar) | 1 PT | Progress-Bar + Live-Updates |
| Frontend: Workspace-Settings-Page | 1.5 PT | Quota-Config + Reporting-Tabelle |
| Frontend: Activity-Integration | 0.5 PT | Worklog in Issue-Timeline |
| Testing + Bugfixing | 1 PT | Manuelles Testing, Edge-Cases |
| **Gesamt** | **~10 PT** | |

### 6.2 Risiken

| Risiko | Level | Beschreibung | Mitigation |
|--------|-------|-------------|-----------|
| **Upstream-Merge-Konflikte** | **MITTEL** | Unsere `ce/`-Stubs koennten von Plane ueberschrieben werden, wenn Plane Time-Tracking in die CE bringt | Alle Aenderungen in `ce/` minimieren; Core-Logik in eigenen Dateien; bei Merge: unsere Version behalten |
| **Migration-Konflikte** | **NIEDRIG** | Neue Migration 0122 koennte mit Upstream kollidieren | Migration-Nummer bei Merge anpassen (standard Django-Workflow) |
| **`root.store.ts` Merge** | **MITTEL** | Store-Registration aendert eine Datei die Upstream haeufig aendert | Minimale Aenderung: nur 2 Zeilen (Import + Instanziierung) |
| **`workspace.ts` Settings** | **NIEDRIG** | Neue Settings-Eintraege sind additiv | Nur Array-Element hinzugefuegt |
| **Sidebar-Aenderung** | **MITTEL** | `sidebar-menu-items.tsx` wird von Upstream gepflegt | Widget als eigene Komponente, minimale Integration |
| **Performance Quota-Query** | **NIEDRIG** | Aggregation ueber time_entries pro Monat | Index auf `(workspace, started_at)` reicht |
| **Timer-Synchronisation** | **NIEDRIG** | Was bei Browser-Crash waehrend laufendem Timer? | Timer-Status im Backend, Frontend pollt/zeigt nur an |

### 6.3 Upstream-Konflikt-Hotspots

Dateien die wir aendern UND die Upstream haeufig aendert:

1. `apps/web/core/store/root.store.ts` -- **HOCH**: wird bei jedem neuen Feature geaendert
2. `apps/web/core/components/workspace/sidebar/sidebar-menu-items.tsx` -- **MITTEL**
3. `apps/api/plane/db/models/__init__.py` -- **MITTEL**: bei jedem neuen Model
4. `packages/constants/src/settings/workspace.ts` -- **NIEDRIG**: selten geaendert

**Minimierungs-Strategie:**
- Alle Aenderungen an Upstream-Dateien auf das absolute Minimum reduzieren (1-3 Zeilen pro Datei)
- Eigene Logik in eigenen Dateien die Upstream nicht kennt
- `ce/`-Ordner nutzen wo moeglich (dort landen unsere Custom-Features, Upstream hat dort nur Stubs)

---

## Phase 7: Empfehlung

### Go / No-Go: **GO**

**Warum Go:**
1. **Die Architektur ist vorbereitet.** Plane hat die Hooks fuer Time-Tracking bereits eingebaut (`is_time_tracking_enabled`, leere Worklog-Stubs, Activity-Type `WORKLOG`, i18n-Keys in 20+ Sprachen). Wir fuellen nur Luecken.
2. **Klares Pattern.** Das Estimate-Feature zeigt exakt wie ein neues Feature vertikal implementiert wird.
3. **Minimaler Upstream-Footprint.** Durch den `@/plane-web -> ./ce/` Alias-Mechanismus koennen wir unsere Implementierungen in `ce/` ablegen, ohne Core-Code zu aendern.
4. **Ueberschaubarer Aufwand.** ~10 Personentage fuer ein vollstaendiges Feature ist machbar.

**Warum NICHT n8n/externes Tool:**
- Externes Time-Tracking (Toggl, Clockify) kann nicht nativ in die Issue-Sidebar integriert werden
- n8n koennte nur Daten synchronisieren, nicht die UI bereitstellen
- Der Kontingent-Ansatz (pro Workspace) ist custom und passt in kein Standard-Tool

### Groesste Unbekannte

1. **Wie oft merged ihr Upstream?** Bei haeufigen Merges (monatlich) ist das Konflikt-Risiko ueberschaubar. Bei seltenen Merges (quartalsweise) koennten sich groessere Konflikte aufstauen.
2. **Braucht ihr Timer oder reicht manuell?** Timer-Logik (Start/Stop mit Backend-Sync) ist der komplexeste Teil. Nur manuelle Erfassung wuerde ~2 PT sparen.
3. **Wie soll das Kontingent fuer den Kunden sichtbar sein?** Nur intern (Admin sieht es) oder auch fuer den Kunden (Space/Deploy-Board)?

### Open Questions fuer Dennis

1. **Timer oder nur manuell?** Start/Stop-Timer ist nice-to-have aber komplex (Browser-Crash, Multi-Tab, etc.)
2. **Kontingent-Sichtbarkeit:** Soll der Kunde (Workspace-Gast) das Restkontingent sehen?
3. **Billable-Flag:** Brauchen wir die billable/non-billable Unterscheidung von Anfang an?
4. **Reporting-Tiefe:** Reicht eine einfache Tabelle oder brauchen wir Charts/Export?
5. **Benachrichtigungen:** Soll bei 80%/100% Kontingent eine Notification ausgeloest werden?

### Empfohlener erster PR (kleinster sinnvoller Schritt)

**PR 1: Backend-Foundation (2 PT)**
1. `TimeEntry` + `WorkspaceTimeQuota` Models
2. Migration
3. Serializers
4. ViewSets (CRUD + Quota-Endpoint, OHNE Timer)
5. URL-Routing
6. Types in `packages/types/`

Damit ist die API testbar (z.B. mit curl/Postman), ohne dass das Frontend angefasst wird. Das Backend kann unabhaengig reviewed und gemerged werden.

**PR 2: Frontend MVP (3-4 PT)**
1. Service + Store
2. `IssueWorklogProperty` mit manueller Erfassung
3. Quota-Widget in der Sidebar
4. Workspace-Settings-Page

**PR 3: Timer + Polish (2-3 PT)**
1. Start/Stop Timer API
2. Timer-UI im Issue-Detail
3. Activity-Integration
4. Edge-Cases + Testing
