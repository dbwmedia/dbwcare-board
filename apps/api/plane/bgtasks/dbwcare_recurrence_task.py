# DBWCARE Recurrence Generator Task
# Runs daily at 00:15 UTC. Clones issues for due recurrences.

import calendar
import logging
from datetime import datetime, timedelta

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def dbwcare_recurrence_generator():
    """
    Daily task: for each active IssueRecurrence where next_occurrence_at <= now(),
    clone the template issue and advance next_occurrence_at.
    """
    from plane.db.models import IssueRecurrence, Issue, State

    now = timezone.now()

    due_recurrences = IssueRecurrence.objects.filter(
        is_active=True,
        next_occurrence_at__lte=now,
        deleted_at__isnull=True,
    ).select_related("template_issue")

    for recurrence in due_recurrences:
        try:
            _process_recurrence(recurrence, now)
        except Exception as e:
            logger.error(
                f"Failed to process recurrence {recurrence.id} "
                f"for issue {recurrence.template_issue_id}: {e}"
            )

    logger.info(f"DBWCARE recurrence generator processed {due_recurrences.count()} recurrences")


def _process_recurrence(recurrence, now):
    """Clone the template issue and advance the recurrence."""
    from plane.db.models import Issue, State

    template = recurrence.template_issue

    # Find default state for the project (lowest sequence in Backlog group)
    default_state = (
        State.objects.filter(
            project_id=template.project_id,
            group="backlog",
            deleted_at__isnull=True,
        )
        .order_by("sequence")
        .first()
    )

    if not default_state:
        default_state = (
            State.objects.filter(
                project_id=template.project_id,
                deleted_at__isnull=True,
            )
            .order_by("sequence")
            .first()
        )

    if not default_state:
        logger.error(f"No state found for project {template.project_id}")
        return

    # Resolve template variables in issue name
    MONTH_NAMES_DE = [
        "", "Januar", "Februar", "März", "April", "Mai", "Juni",
        "Juli", "August", "September", "Oktober", "November", "Dezember",
    ]
    issue_name = template.name.replace("{monat}", MONTH_NAMES_DE[now.month])
    issue_name = issue_name.replace("{jahr}", str(now.year))
    issue_name = issue_name.replace("{monat_nr}", f"{now.month:02d}")

    # Clone the issue
    new_issue = Issue.objects.create(
        workspace_id=template.workspace_id,
        project_id=template.project_id,
        name=issue_name,
        description_html=template.description_html if hasattr(template, "description_html") else "",
        state=default_state,
        priority=template.priority,
        estimate_point=template.estimate_point,
    )

    # Advance recurrence
    recurrence.last_generated_at = now
    recurrence.next_occurrence_at = _compute_next(recurrence, now)
    recurrence.save(update_fields=["last_generated_at", "next_occurrence_at"])

    logger.info(
        f"Created issue {new_issue.id} from recurrence template {template.id}"
    )


def _compute_next(recurrence, from_date):
    """Compute next occurrence date."""
    if recurrence.recurrence_type == "monthly_date":
        year = from_date.year
        month = from_date.month + 1
        if month > 12:
            month = 1
            year += 1
        _, last_day = calendar.monthrange(year, month)
        actual_day = min(recurrence.day_of_month, last_day)
        return datetime(
            year, month, actual_day, 0, 0, 0,
            tzinfo=from_date.tzinfo or timezone.utc,
        )
    elif recurrence.recurrence_type == "interval_days":
        return from_date + timedelta(days=recurrence.interval_days)
    return from_date
