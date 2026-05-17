# DBWCARE Time-Tracking & Customer Quota Models

import math
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

from .base import BaseModel
from .workspace import WorkspaceBaseModel


class BillingStatus(models.TextChoices):
    BILLABLE = "billable", "Billable"
    GIFT = "gift", "Gift"
    SELF_CAUSED = "self_caused", "Self Caused"


class EntryType(models.TextChoices):
    TRACKED = "tracked", "Tracked"
    MANUAL = "manual", "Manual"


class RecurrenceType(models.TextChoices):
    MONTHLY_DATE = "monthly_date", "Monthly Date"
    INTERVAL_DAYS = "interval_days", "Interval Days"


class ProjectCareSubscription(BaseModel):
    """
    One per Project. Represents the active DBWCARE subscription
    with monthly hour quota. Each project = one customer.
    """

    project = models.OneToOneField(
        "db.Project",
        on_delete=models.CASCADE,
        related_name="care_subscription",
    )
    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="care_subscriptions",
        help_text="Denormalized from project for fast admin-level aggregation",
    )
    monthly_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=8.00,
        validators=[MinValueValidator(0)],
    )
    package_label = models.CharField(
        max_length=50,
        blank=True,
        default="",
        help_text='e.g. "S", "M", "L", "Custom"',
    )
    started_at = models.DateField(
        help_text="Contract start date, influences monthly reset",
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "project_care_subscriptions"
        verbose_name = "Project Care Subscription"
        verbose_name_plural = "Project Care Subscriptions"

    def __str__(self):
        return f"CareSubscription {self.project.name}: {self.monthly_hours}h/month"


class ProjectMonthlyBalance(BaseModel):
    """
    Snapshot per Project per month. Created by Celery beat job
    on the 1st of each month.
    """

    project = models.ForeignKey(
        "db.Project",
        on_delete=models.CASCADE,
        related_name="monthly_balances",
    )
    workspace = models.ForeignKey(
        "db.Workspace",
        on_delete=models.CASCADE,
        related_name="monthly_balances",
        help_text="Denormalized from project for fast admin-level aggregation",
    )
    year = models.IntegerField()
    month = models.IntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    base_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        help_text="Copied from subscription at time of creation",
    )
    rolled_over_minutes = models.IntegerField(
        default=0,
        help_text="Carried over from previous month (max 2 month lifetime)",
    )
    borrowed_minutes = models.IntegerField(
        default=0,
        help_text="Borrowed from next month (max 50% of next month)",
    )
    consumed_minutes = models.IntegerField(
        default=0,
        help_text="Cached sum of billable WorklogEntries for this month",
    )
    is_closed = models.BooleanField(
        default=False,
        help_text="Month is finalized, no more bookings allowed",
    )

    class Meta:
        db_table = "project_monthly_balances"
        verbose_name = "Project Monthly Balance"
        verbose_name_plural = "Project Monthly Balances"
        constraints = [
            models.UniqueConstraint(
                fields=["project", "year", "month"],
                condition=models.Q(deleted_at__isnull=True),
                name="unique_project_year_month_when_not_deleted",
            )
        ]
        indexes = [
            models.Index(
                fields=["project", "-year", "-month"],
                name="balance_proj_year_month_idx",
            ),
        ]

    @property
    def base_minutes(self):
        return int(self.base_hours * 60)

    @property
    def total_available_minutes(self):
        return self.base_minutes + self.rolled_over_minutes

    @property
    def remaining_minutes(self):
        return self.total_available_minutes - self.consumed_minutes

    @property
    def consumption_percentage(self):
        total = self.total_available_minutes
        if total <= 0:
            return 100 if self.consumed_minutes > 0 else 0
        return min(round((self.consumed_minutes / total) * 100), 100)

    def __str__(self):
        return f"Balance {self.project.name}: {self.year}-{self.month:02d}"


class WorklogEntry(WorkspaceBaseModel):
    """
    Individual time entry on an Issue. Replaces the empty CE stubs.
    Name chosen to match Plane's existing WORKLOG activity type.
    """

    issue = models.ForeignKey(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="worklog_entries",
    )
    logged_by = models.ForeignKey(
        "db.User",
        on_delete=models.CASCADE,
        related_name="worklog_entries",
    )
    description = models.TextField(blank=True, default="")
    duration_minutes = models.PositiveIntegerField(
        default=0,
        validators=[MinValueValidator(0)],
    )
    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    is_running = models.BooleanField(default=False)
    entry_type = models.CharField(
        max_length=20,
        choices=EntryType.choices,
        default=EntryType.MANUAL,
    )
    billing_status = models.CharField(
        max_length=20,
        choices=BillingStatus.choices,
        default=BillingStatus.BILLABLE,
    )
    gift_reason = models.TextField(
        blank=True,
        default="",
        help_text="Reason for gift entry, shown to customer as tooltip",
    )

    class Meta:
        db_table = "worklog_entries"
        verbose_name = "Worklog Entry"
        verbose_name_plural = "Worklog Entries"
        ordering = ("-created_at",)
        indexes = [
            models.Index(
                fields=["workspace", "started_at"],
                name="worklog_ws_started_idx",
            ),
            models.Index(
                fields=["issue", "started_at"],
                name="worklog_issue_started_idx",
            ),
            models.Index(
                fields=["logged_by", "is_running"],
                name="worklog_user_running_idx",
            ),
        ]

    def __str__(self):
        return f"Worklog {self.id} - {self.duration_minutes}min on {self.issue_id}"


class IssueRecurrence(BaseModel):
    """
    Recurring issue template. When triggered, clones the template issue.
    """

    template_issue = models.OneToOneField(
        "db.Issue",
        on_delete=models.CASCADE,
        related_name="recurrence",
    )
    recurrence_type = models.CharField(
        max_length=20,
        choices=RecurrenceType.choices,
    )
    day_of_month = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(31)],
        help_text="For monthly_date: which day (31 → last day if month is shorter)",
    )
    interval_days = models.IntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(1)],
        help_text="For interval_days: how many days between occurrences",
    )
    estimated_minutes = models.PositiveIntegerField(
        default=60,
        help_text="Default estimate per recurrence in minutes",
    )
    next_occurrence_at = models.DateTimeField(
        help_text="When the next issue clone is due",
    )
    is_active = models.BooleanField(default=True)
    last_generated_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "issue_recurrences"
        verbose_name = "Issue Recurrence"
        verbose_name_plural = "Issue Recurrences"

    def __str__(self):
        return f"Recurrence for Issue {self.template_issue_id} ({self.recurrence_type})"
