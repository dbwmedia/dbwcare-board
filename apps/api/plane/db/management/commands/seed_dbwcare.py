"""
seed_dbwcare – Django Management Command
Creates demo data for local DBWCARE development:
- Test user (dev@dbwcare.test / dev12345)
- Workspace with CareSubscription (8h/month, Paket M)
- Project with sample issues
- Sample worklog entries
- Monthly balance for current month

Usage: python manage.py seed_dbwcare [--settings=plane.settings.local]
"""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand
from django.db.models import Sum
from django.utils import timezone


class Command(BaseCommand):
    help = "Seed DBWCARE demo data for local development"

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            default="dev@dbwcare.test",
            help="Email for the test user (default: dev@dbwcare.test)",
        )
        parser.add_argument(
            "--password",
            default="dev12345",
            help="Password for the test user (default: dev12345)",
        )

    def handle(self, *args, **options):
        email = options["email"]
        password = options["password"]

        self._ensure_instance()
        user = self._create_user(email, password)
        workspace = self._create_workspace(user, "dbwcare-test")
        subscription = self._create_subscription(workspace)
        project = self._create_project(workspace, user)
        issues = self._create_issues(project, workspace, user)
        self._create_worklogs(issues, workspace, user)
        self._create_balance(workspace, subscription)

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS("=== DBWCARE Seed abgeschlossen ==="))
        self.stdout.write(f"  Login: {email} / {password}")
        self.stdout.write(f"  Workspace: {workspace.name} ({workspace.slug})")
        self.stdout.write(f"  Projekt: {project.name}")
        self.stdout.write(f"  Issues: {len(issues)}")
        self.stdout.write(f"  Subscription: {subscription.monthly_hours}h/Monat (Paket {subscription.package_label})")
        self.stdout.write("")

    def _ensure_instance(self):
        """Ensure Instance exists (required for Plane to function)."""
        from plane.license.models import Instance

        if not Instance.objects.exists():
            self.stdout.write("  Instance existiert noch nicht – wird vom API-Entrypoint erstellt.")
            self.stdout.write("  Falls Login fehlschlaegt: erst API einmal starten lassen, dann seed erneut.")

    def _create_user(self, email, password):
        from plane.db.models import User

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "username": email,
                "first_name": "Dev",
                "last_name": "User",
                "is_active": True,
                "is_email_verified": True,
                "is_password_autoset": False,
            },
        )
        if created:
            user.set_password(password)
            user.save()
            self.stdout.write(self.style.SUCCESS(f"  User erstellt: {email}"))
        else:
            self.stdout.write(f"  User existiert bereits: {email}")
        return user

    def _create_workspace(self, user, slug):
        from plane.db.models import Workspace, WorkspaceMember

        workspace, created = Workspace.objects.get_or_create(
            slug=slug,
            defaults={
                "name": "DBWCARE Test",
                "owner": user,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f"  Workspace erstellt: {slug}"))
        else:
            self.stdout.write(f"  Workspace existiert bereits: {slug}")

        # Ensure user is a member (idempotent)
        _, member_created = WorkspaceMember.objects.get_or_create(
            workspace=workspace,
            member=user,
            defaults={"role": 20},  # Admin
        )
        if member_created:
            self.stdout.write(self.style.SUCCESS(f"  WorkspaceMember erstellt fuer {user.email}"))

        return workspace

    def _create_subscription(self, workspace):
        from plane.db.models import WorkspaceCareSubscription

        sub, created = WorkspaceCareSubscription.objects.get_or_create(
            workspace=workspace,
            defaults={
                "monthly_hours": Decimal("8.00"),
                "package_label": "M",
                "started_at": timezone.now().date().replace(day=1),
                "is_active": True,
            },
        )
        if created:
            self.stdout.write(self.style.SUCCESS("  CareSubscription erstellt: 8h/Monat (Paket M)"))
        else:
            self.stdout.write("  CareSubscription existiert bereits")
        return sub

    def _create_project(self, workspace, user):
        from plane.db.models import Project, ProjectMember

        project, created = Project.objects.get_or_create(
            workspace=workspace,
            identifier="CARE",
            defaults={
                "name": "DBWCARE Demo-Projekt",
                "description": "Demo-Projekt fuer lokale Entwicklung",
                "network": 2,  # Secret
                "created_by": user,
            },
        )
        if created:
            ProjectMember.objects.create(
                project=project,
                workspace=workspace,
                member=user,
                role=20,  # Admin
            )
            self.stdout.write(self.style.SUCCESS(f"  Projekt erstellt: {project.name}"))
        else:
            self.stdout.write(f"  Projekt existiert bereits: {project.name}")
        return project

    def _create_issues(self, project, workspace, user):
        from plane.db.models import Issue, State

        # Get or create a default state
        state, _ = State.objects.get_or_create(
            project=project,
            workspace=workspace,
            group="started",
            defaults={
                "name": "In Progress",
                "color": "#F59E0B",
                "created_by": user,
            },
        )
        backlog_state, _ = State.objects.get_or_create(
            project=project,
            workspace=workspace,
            group="backlog",
            defaults={
                "name": "Backlog",
                "color": "#A3A3A3",
                "created_by": user,
            },
        )

        issue_data = [
            {
                "name": "Website-Update: Neue Landingpage",
                "description_stripped": "Neue Landingpage gemaess Figma-Design umsetzen",
                "state": state,
                "priority": "high",
                "sequence_id": 1,
            },
            {
                "name": "SSL-Zertifikat erneuern",
                "description_stripped": "Let's Encrypt Zertifikat fuer Kunden-Domain erneuern",
                "state": backlog_state,
                "priority": "urgent",
                "sequence_id": 2,
            },
            {
                "name": "Monatsreport erstellen",
                "description_stripped": "Monatlichen Wartungsreport fuer Kunden zusammenstellen",
                "state": backlog_state,
                "priority": "medium",
                "sequence_id": 3,
            },
        ]

        issues = []
        for data in issue_data:
            issue, created = Issue.objects.get_or_create(
                project=project,
                workspace=workspace,
                name=data["name"],
                defaults={
                    "description_stripped": data["description_stripped"],
                    "state": data["state"],
                    "priority": data["priority"],
                    "sequence_id": data["sequence_id"],
                    "sort_order": data["sequence_id"] * 65535,
                    "created_by": user,
                },
            )
            issues.append(issue)
            if created:
                self.stdout.write(self.style.SUCCESS(f"  Issue erstellt: {data['name']}"))

        return issues

    def _create_worklogs(self, issues, workspace, user):
        from plane.db.models import WorklogEntry

        if not issues:
            return

        now = timezone.now()

        worklog_data = [
            {
                "issue": issues[0],
                "description": "Header-Komponente gebaut",
                "duration_minutes": 90,
                "started_at": now - timedelta(days=2, hours=3),
                "billing_status": "billable",
            },
            {
                "issue": issues[0],
                "description": "Responsive Anpassungen",
                "duration_minutes": 45,
                "started_at": now - timedelta(days=1, hours=2),
                "billing_status": "billable",
            },
            {
                "issue": issues[1],
                "description": "Zertifikat-Check & Renewal-Script",
                "duration_minutes": 30,
                "started_at": now - timedelta(hours=5),
                "billing_status": "gift",
                "gift_reason": "Automatisierung als Service-Geschenk",
            },
        ]

        for data in worklog_data:
            _, created = WorklogEntry.objects.get_or_create(
                issue=data["issue"],
                workspace=workspace,
                logged_by=user,
                description=data["description"],
                defaults={
                    "duration_minutes": data["duration_minutes"],
                    "started_at": data["started_at"],
                    "ended_at": data["started_at"] + timedelta(minutes=data["duration_minutes"]),
                    "entry_type": "manual",
                    "billing_status": data["billing_status"],
                    "gift_reason": data.get("gift_reason", ""),
                    "created_by": user,
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"  Worklog erstellt: {data['description']}"))

    def _create_balance(self, workspace, subscription):
        from plane.db.models import WorkspaceMonthlyBalance, WorklogEntry

        now = timezone.now()
        year, month = now.year, now.month

        # Sum up billable minutes for this month
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        consumed = (
            WorklogEntry.objects.filter(
                workspace=workspace,
                billing_status="billable",
                started_at__gte=month_start,
                deleted_at__isnull=True,
            ).aggregate(total=Sum("duration_minutes"))["total"]
            or 0
        )

        balance, created = WorkspaceMonthlyBalance.objects.get_or_create(
            workspace=workspace,
            year=year,
            month=month,
            defaults={
                "base_hours": subscription.monthly_hours,
                "rolled_over_minutes": 0,
                "borrowed_minutes": 0,
                "consumed_minutes": consumed,
                "is_closed": False,
            },
        )
        if created:
            self.stdout.write(
                self.style.SUCCESS(
                    f"  MonthlyBalance erstellt: {year}-{month:02d}, "
                    f"{consumed}min verbraucht von {subscription.monthly_hours}h"
                )
            )
        else:
            self.stdout.write(f"  MonthlyBalance existiert bereits: {year}-{month:02d}")
