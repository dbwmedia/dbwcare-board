# DBWCARE Weekly Report Task
# Runs every Monday at 08:00 UTC.
# For each subscription with weekly_report_enabled=True:
# - Checks if there were any worklog entries in the past 7 days
# - If yes, sends a compact weekly summary to the customer
# - If no, skips silently (no spam)

import logging
import os
from datetime import timedelta

from celery import shared_task
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string
from django.utils import timezone

from plane.license.utils.instance_value import get_email_configuration
from plane.utils.email import generate_plain_text_from_html
from plane.utils.exception_logger import log_exception

logger = logging.getLogger(__name__)

GERMAN_WEEKDAYS = [
    "Montag", "Dienstag", "Mittwoch", "Donnerstag",
    "Freitag", "Samstag", "Sonntag",
]


def format_minutes(minutes):
    """Format minutes as 'Xh Ymin' string."""
    if minutes is None:
        minutes = 0
    abs_min = abs(minutes)
    h = abs_min // 60
    m = abs_min % 60
    sign = "-" if minutes < 0 else ""
    if h == 0:
        return f"{sign}{m}min"
    if m == 0:
        return f"{sign}{h}h"
    return f"{sign}{h}h {m}min"


@shared_task
def dbwcare_weekly_report():
    """
    Weekly report task: for each active subscription with weekly_report_enabled=True
    and a valid customer_email, generate and send the past week's summary.
    Only sends if there were actual worklog entries.
    """
    from plane.db.models import (
        ProjectCareSubscription,
        ProjectMonthlyBalance,
        WorklogEntry,
    )

    now = timezone.now()
    week_end = now
    week_start = now - timedelta(days=7)

    # Date range labels
    start_label = week_start.strftime("%d.%m.")
    end_label = week_end.strftime("%d.%m.%Y")
    week_label = f"{start_label} – {end_label}"

    # Get email configuration once
    try:
        (
            EMAIL_HOST,
            EMAIL_HOST_USER,
            EMAIL_HOST_PASSWORD,
            EMAIL_PORT,
            EMAIL_USE_TLS,
            EMAIL_USE_SSL,
            EMAIL_FROM,
        ) = get_email_configuration()
    except Exception as e:
        logger.error(f"DBWCARE weekly report: failed to get email config: {e}")
        return

    connection = get_connection(
        host=EMAIL_HOST,
        port=int(EMAIL_PORT),
        username=EMAIL_HOST_USER,
        password=EMAIL_HOST_PASSWORD,
        use_tls=EMAIL_USE_TLS == "1",
        use_ssl=EMAIL_USE_SSL == "1",
    )

    subscriptions = ProjectCareSubscription.objects.filter(
        is_active=True,
        weekly_report_enabled=True,
        deleted_at__isnull=True,
    ).exclude(
        customer_email=""
    ).select_related("project", "workspace")

    sent_count = 0
    skipped_count = 0
    error_count = 0

    for sub in subscriptions:
        try:
            was_sent = _send_weekly_for_subscription(
                sub, week_start, week_end, week_label,
                connection, EMAIL_FROM,
            )
            if was_sent:
                sent_count += 1
            else:
                skipped_count += 1
        except Exception as e:
            error_count += 1
            logger.error(
                f"DBWCARE weekly report: failed for project {sub.project_id} "
                f"({sub.customer_email}): {e}"
            )
            log_exception(e)

    logger.info(
        f"DBWCARE weekly report completed: {sent_count} sent, "
        f"{skipped_count} skipped (no entries), {error_count} errors "
        f"for {week_label}"
    )


def _send_weekly_for_subscription(
    sub, week_start, week_end, week_label, connection, email_from
):
    """
    Generate and send the weekly report for a single subscription.
    Returns True if sent, False if skipped (no entries).
    """
    from collections import OrderedDict

    from plane.db.models import ProjectMonthlyBalance, WorklogEntry

    project = sub.project
    workspace = sub.workspace

    # Get all worklog entries for the past 7 days (excluding self_caused)
    entries = (
        WorklogEntry.objects.filter(
            issue__project=project,
            started_at__gte=week_start,
            started_at__lte=week_end,
            is_running=False,
            deleted_at__isnull=True,
        )
        .exclude(billing_status="self_caused")
        .select_related("issue")
        .order_by("started_at")
    )

    if not entries.exists():
        return False

    # Group entries by issue
    billable_by_issue = OrderedDict()
    gift_by_issue = OrderedDict()
    billable_total = 0
    gift_total = 0

    for entry in entries:
        issue_id = str(entry.issue_id)
        issue_title = entry.issue.name if entry.issue else "Unbekannt"
        entry_data = {
            "description": entry.description,
            "duration_minutes": entry.duration_minutes,
            "duration_formatted": format_minutes(entry.duration_minutes),
            "gift_reason": entry.gift_reason,
        }

        if entry.billing_status == "gift":
            if issue_id not in gift_by_issue:
                gift_by_issue[issue_id] = {
                    "issue_title": issue_title,
                    "total_minutes": 0,
                    "total_formatted": "",
                    "entries": [],
                }
            gift_by_issue[issue_id]["total_minutes"] += entry.duration_minutes
            gift_by_issue[issue_id]["entries"].append(entry_data)
            gift_total += entry.duration_minutes
        else:
            if issue_id not in billable_by_issue:
                billable_by_issue[issue_id] = {
                    "issue_title": issue_title,
                    "total_minutes": 0,
                    "total_formatted": "",
                    "entries": [],
                }
            billable_by_issue[issue_id]["total_minutes"] += entry.duration_minutes
            billable_by_issue[issue_id]["entries"].append(entry_data)
            billable_total += entry.duration_minutes

    # Compute formatted totals per issue
    for group in billable_by_issue.values():
        group["total_formatted"] = format_minutes(group["total_minutes"])
    for group in gift_by_issue.values():
        group["total_formatted"] = format_minutes(group["total_minutes"])

    billable_groups = list(billable_by_issue.values())
    gift_groups = list(gift_by_issue.values())

    # Get current balance for context
    now = timezone.now()
    balance = None
    try:
        balance = ProjectMonthlyBalance.objects.get(
            project=project,
            year=now.year,
            month=now.month,
            deleted_at__isnull=True,
        )
    except ProjectMonthlyBalance.DoesNotExist:
        pass

    site_url = os.environ.get("WEB_URL", "https://care.dbw-media.de").rstrip("/")
    project_url = f"{site_url}/{workspace.slug}/projects/{project.id}/issues"

    context = {
        "customer_name": sub.customer_name or project.name,
        "project_name": project.name,
        "week_label": week_label,
        "billable_groups": billable_groups,
        "billable_total_formatted": format_minutes(billable_total),
        "gift_groups": gift_groups,
        "gift_total_formatted": format_minutes(gift_total),
        "total_formatted": format_minutes(billable_total + gift_total),
        "project_url": project_url,
        "site_url": site_url,
    }

    # Add balance context if available
    if balance:
        remaining_minutes = balance.total_available_minutes - balance.consumed_minutes
        context.update({
            "has_balance": True,
            "consumed_formatted": format_minutes(balance.consumed_minutes),
            "remaining_formatted": format_minutes(remaining_minutes),
            "consumption_pct": balance.consumption_percentage,
            "consumption_pct_clamped": min(balance.consumption_percentage, 100),
            "available_formatted": format_minutes(balance.total_available_minutes),
            "package_label": sub.package_label or "-",
        })
    else:
        context["has_balance"] = False

    html_content = render_to_string("emails/care/weekly_report.html", context)
    text_content = generate_plain_text_from_html(html_content)

    subject = (
        f"dbwCARE Wochenbericht – {week_label} – "
        f"{sub.customer_name or project.name}"
    )

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=email_from,
        to=[sub.customer_email],
        connection=connection,
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send()

    logger.info(
        f"DBWCARE weekly report sent to {sub.customer_email} for "
        f"project {project.name} ({week_label})"
    )
    return True
