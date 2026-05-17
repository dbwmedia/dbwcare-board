# DBWCARE — Migrate Subscription & Balance from Workspace to Project level
#
# This migration:
# 1. Creates new project_care_subscriptions and project_monthly_balances tables
# 2. Migrates existing data from workspace-level to the first project of each workspace
# 3. Drops old workspace-level tables
#
# IMPORTANT: Take a DB backup on Hetzner before deploying this migration!
# ssh root@168.119.122.191
# cd /opt/stacks/dbwcare-board
# docker compose exec -T plane-db pg_dumpall -U plane > /root/dbwcare-pre-refactor-$(date +%Y%m%d-%H%M%S).sql

import logging
import uuid
import django.core.validators
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion

logger = logging.getLogger(__name__)


def migrate_subscriptions_to_project(apps, schema_editor):
    """Migrate workspace subscriptions to the first project in each workspace."""
    OldSub = apps.get_model("db", "WorkspaceCareSubscription")
    NewSub = apps.get_model("db", "ProjectCareSubscription")
    Project = apps.get_model("db", "Project")

    for old_sub in OldSub.objects.all():
        # Skip if already migrated (idempotent)
        if NewSub.objects.filter(workspace_id=old_sub.workspace_id).exists():
            logger.info(
                f"Skipping workspace {old_sub.workspace_id} — already has project subscription"
            )
            continue

        # Find first project in this workspace
        project = (
            Project.objects.filter(
                workspace_id=old_sub.workspace_id,
                deleted_at__isnull=True,
            )
            .order_by("created_at")
            .first()
        )

        if project is None:
            logger.warning(
                f"Workspace {old_sub.workspace_id} has no projects — "
                f"discarding subscription {old_sub.id}"
            )
            continue

        NewSub.objects.create(
            id=uuid.uuid4(),
            project=project,
            workspace_id=old_sub.workspace_id,
            monthly_hours=old_sub.monthly_hours,
            package_label=old_sub.package_label,
            started_at=old_sub.started_at,
            is_active=old_sub.is_active,
            created_at=old_sub.created_at,
            updated_at=old_sub.updated_at,
        )
        logger.info(
            f"Migrated subscription from workspace {old_sub.workspace_id} "
            f"to project {project.id} ({project.name})"
        )


def migrate_balances_to_project(apps, schema_editor):
    """Migrate workspace balances to the same project as the subscription."""
    OldBalance = apps.get_model("db", "WorkspaceMonthlyBalance")
    NewBalance = apps.get_model("db", "ProjectMonthlyBalance")
    NewSub = apps.get_model("db", "ProjectCareSubscription")

    for old_bal in OldBalance.objects.all():
        # Find the project subscription for this workspace
        new_sub = (
            NewSub.objects.filter(workspace_id=old_bal.workspace_id)
            .first()
        )

        if new_sub is None:
            logger.warning(
                f"No project subscription found for workspace {old_bal.workspace_id} — "
                f"discarding balance {old_bal.id}"
            )
            continue

        # Skip if already migrated (idempotent)
        if NewBalance.objects.filter(
            project_id=new_sub.project_id,
            year=old_bal.year,
            month=old_bal.month,
        ).exists():
            logger.info(
                f"Skipping balance {old_bal.year}-{old_bal.month} for project "
                f"{new_sub.project_id} — already exists"
            )
            continue

        NewBalance.objects.create(
            id=uuid.uuid4(),
            project_id=new_sub.project_id,
            workspace_id=old_bal.workspace_id,
            year=old_bal.year,
            month=old_bal.month,
            base_hours=old_bal.base_hours,
            rolled_over_minutes=old_bal.rolled_over_minutes,
            borrowed_minutes=old_bal.borrowed_minutes,
            consumed_minutes=old_bal.consumed_minutes,
            is_closed=old_bal.is_closed,
            created_at=old_bal.created_at,
            updated_at=old_bal.updated_at,
        )
        logger.info(
            f"Migrated balance {old_bal.year}-{old_bal.month} to project {new_sub.project_id}"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0500_dbwcare_init"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # 1. Create new project-level tables
        migrations.CreateModel(
            name="ProjectCareSubscription",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("project", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="care_subscription", to="db.project")),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="care_subscriptions", to="db.workspace", help_text="Denormalized from project for fast admin-level aggregation")),
                ("monthly_hours", models.DecimalField(decimal_places=2, default=8.0, max_digits=5, validators=[django.core.validators.MinValueValidator(0)])),
                ("package_label", models.CharField(blank=True, default="", help_text='e.g. "S", "M", "L", "Custom"', max_length=50)),
                ("started_at", models.DateField(help_text="Contract start date, influences monthly reset")),
                ("is_active", models.BooleanField(default=True)),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_created_by", to=settings.AUTH_USER_MODEL, verbose_name="Created By")),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_updated_by", to=settings.AUTH_USER_MODEL, verbose_name="Last Modified By")),
            ],
            options={
                "verbose_name": "Project Care Subscription",
                "verbose_name_plural": "Project Care Subscriptions",
                "db_table": "project_care_subscriptions",
            },
        ),
        migrations.CreateModel(
            name="ProjectMonthlyBalance",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("project", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="monthly_balances", to="db.project")),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="monthly_balances", to="db.workspace", help_text="Denormalized from project for fast admin-level aggregation")),
                ("year", models.IntegerField()),
                ("month", models.IntegerField(validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(12)])),
                ("base_hours", models.DecimalField(decimal_places=2, help_text="Copied from subscription at time of creation", max_digits=5)),
                ("rolled_over_minutes", models.IntegerField(default=0, help_text="Carried over from previous month (max 2 month lifetime)")),
                ("borrowed_minutes", models.IntegerField(default=0, help_text="Borrowed from next month (max 50% of next month)")),
                ("consumed_minutes", models.IntegerField(default=0, help_text="Cached sum of billable WorklogEntries for this month")),
                ("is_closed", models.BooleanField(default=False, help_text="Month is finalized, no more bookings allowed")),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_created_by", to=settings.AUTH_USER_MODEL, verbose_name="Created By")),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_updated_by", to=settings.AUTH_USER_MODEL, verbose_name="Last Modified By")),
            ],
            options={
                "verbose_name": "Project Monthly Balance",
                "verbose_name_plural": "Project Monthly Balances",
                "db_table": "project_monthly_balances",
            },
        ),
        migrations.AddConstraint(
            model_name="projectmonthlybalance",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("project", "year", "month"),
                name="unique_project_year_month_when_not_deleted",
            ),
        ),
        migrations.AddIndex(
            model_name="projectmonthlybalance",
            index=models.Index(
                fields=["project", "-year", "-month"],
                name="balance_proj_year_month_idx",
            ),
        ),

        # 2. Migrate data from workspace-level to project-level
        migrations.RunPython(
            migrate_subscriptions_to_project,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.RunPython(
            migrate_balances_to_project,
            reverse_code=migrations.RunPython.noop,
        ),

        # 3. Drop old workspace-level tables
        migrations.DeleteModel(name="WorkspaceMonthlyBalance"),
        migrations.DeleteModel(name="WorkspaceCareSubscription"),
    ]
