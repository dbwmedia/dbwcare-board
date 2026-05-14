# DBWCARE Time-Tracking & Customer Quota — Initial Migration

import uuid
import django.core.validators
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0121_alter_estimate_type"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkspaceCareSubscription",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("monthly_hours", models.DecimalField(decimal_places=2, default=8.0, max_digits=5, validators=[django.core.validators.MinValueValidator(0)])),
                ("package_label", models.CharField(blank=True, default="", max_length=50)),
                ("started_at", models.DateField()),
                ("is_active", models.BooleanField(default=True)),
                ("workspace", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="care_subscription", to="db.workspace")),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_created_by", to=settings.AUTH_USER_MODEL, verbose_name="Created By")),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_updated_by", to=settings.AUTH_USER_MODEL, verbose_name="Last Modified By")),
            ],
            options={
                "verbose_name": "Workspace Care Subscription",
                "verbose_name_plural": "Workspace Care Subscriptions",
                "db_table": "workspace_care_subscriptions",
            },
        ),
        migrations.CreateModel(
            name="WorkspaceMonthlyBalance",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("year", models.IntegerField()),
                ("month", models.IntegerField(validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(12)])),
                ("base_hours", models.DecimalField(decimal_places=2, max_digits=5)),
                ("rolled_over_minutes", models.IntegerField(default=0)),
                ("borrowed_minutes", models.IntegerField(default=0)),
                ("consumed_minutes", models.IntegerField(default=0)),
                ("is_closed", models.BooleanField(default=False)),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="monthly_balances", to="db.workspace")),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_created_by", to=settings.AUTH_USER_MODEL, verbose_name="Created By")),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_updated_by", to=settings.AUTH_USER_MODEL, verbose_name="Last Modified By")),
            ],
            options={
                "verbose_name": "Workspace Monthly Balance",
                "verbose_name_plural": "Workspace Monthly Balances",
                "db_table": "workspace_monthly_balances",
            },
        ),
        migrations.AddConstraint(
            model_name="workspacemonthlybalance",
            constraint=models.UniqueConstraint(
                condition=models.Q(("deleted_at__isnull", True)),
                fields=("workspace", "year", "month"),
                name="unique_workspace_year_month_when_not_deleted",
            ),
        ),
        migrations.AddIndex(
            model_name="workspacemonthlybalance",
            index=models.Index(fields=["workspace", "-year", "-month"], name="balance_ws_year_month_idx"),
        ),
        migrations.CreateModel(
            name="WorklogEntry",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("description", models.TextField(blank=True, default="")),
                ("duration_minutes", models.PositiveIntegerField(default=0, validators=[django.core.validators.MinValueValidator(0)])),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("ended_at", models.DateTimeField(blank=True, null=True)),
                ("is_running", models.BooleanField(default=False)),
                ("entry_type", models.CharField(choices=[("tracked", "Tracked"), ("manual", "Manual")], default="manual", max_length=20)),
                ("billing_status", models.CharField(choices=[("billable", "Billable"), ("gift", "Gift"), ("self_caused", "Self Caused")], default="billable", max_length=20)),
                ("gift_reason", models.TextField(blank=True, default="")),
                ("workspace", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="workspace_worklogentry", to="db.workspace")),
                ("project", models.ForeignKey(null=True, on_delete=django.db.models.deletion.CASCADE, related_name="project_worklogentry", to="db.project")),
                ("issue", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="worklog_entries", to="db.issue")),
                ("logged_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="worklog_entries", to=settings.AUTH_USER_MODEL)),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_created_by", to=settings.AUTH_USER_MODEL, verbose_name="Created By")),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_updated_by", to=settings.AUTH_USER_MODEL, verbose_name="Last Modified By")),
            ],
            options={
                "verbose_name": "Worklog Entry",
                "verbose_name_plural": "Worklog Entries",
                "db_table": "worklog_entries",
                "ordering": ("-created_at",),
            },
        ),
        migrations.AddIndex(
            model_name="worklogentry",
            index=models.Index(fields=["workspace", "started_at"], name="worklog_ws_started_idx"),
        ),
        migrations.AddIndex(
            model_name="worklogentry",
            index=models.Index(fields=["issue", "started_at"], name="worklog_issue_started_idx"),
        ),
        migrations.AddIndex(
            model_name="worklogentry",
            index=models.Index(fields=["logged_by", "is_running"], name="worklog_user_running_idx"),
        ),
        migrations.CreateModel(
            name="IssueRecurrence",
            fields=[
                ("created_at", models.DateTimeField(auto_now_add=True, verbose_name="Created At")),
                ("updated_at", models.DateTimeField(auto_now=True, verbose_name="Last Modified At")),
                ("deleted_at", models.DateTimeField(blank=True, null=True, verbose_name="Deleted At")),
                ("id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ("recurrence_type", models.CharField(choices=[("monthly_date", "Monthly Date"), ("interval_days", "Interval Days")], max_length=20)),
                ("day_of_month", models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1), django.core.validators.MaxValueValidator(31)])),
                ("interval_days", models.IntegerField(blank=True, null=True, validators=[django.core.validators.MinValueValidator(1)])),
                ("estimated_minutes", models.PositiveIntegerField(default=60)),
                ("next_occurrence_at", models.DateTimeField()),
                ("is_active", models.BooleanField(default=True)),
                ("last_generated_at", models.DateTimeField(blank=True, null=True)),
                ("template_issue", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="recurrence", to="db.issue")),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_created_by", to=settings.AUTH_USER_MODEL, verbose_name="Created By")),
                ("updated_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="%(class)s_updated_by", to=settings.AUTH_USER_MODEL, verbose_name="Last Modified By")),
            ],
            options={
                "verbose_name": "Issue Recurrence",
                "verbose_name_plural": "Issue Recurrences",
                "db_table": "issue_recurrences",
            },
        ),
    ]
