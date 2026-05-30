# DBWCARE Monthly Report Task
# Runs on the 2nd of each month at 08:00 UTC.
# Generates a summary of the previous month's worklog entries
# and sends it to the customer email if report_enabled is True.

import calendar
import logging
import os
from datetime import date

from celery import shared_task
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string

from plane.license.utils.instance_value import get_email_configuration
from plane.utils.email import generate_plain_text_from_html
from plane.utils.exception_logger import log_exception

logger = logging.getLogger(__name__)

GERMAN_MONTHS = [
    "", "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
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
def dbwcare_monthly_report():
    """
    Monthly report task: for each active subscription with report_enabled=True
    and a valid customer_email, generate and send the previous month's report.
    """
    from plane.db.models import (
        ProjectCareSubscription,
        ProjectMonthlyBalance,
        WorklogEntry,
    )

    today = date.today()
    # Calculate previous month
    if today.month == 1:
        report_year = today.year - 1
        report_month = 12
    else:
        report_year = today.year
        report_month = today.month - 1

    month_label = f"{GERMAN_MONTHS[report_month]} {report_year}"

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
        logger.error(f"DBWCARE report: failed to get email config: {e}")
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
        report_enabled=True,
        deleted_at__isnull=True,
    ).exclude(
        customer_email=""
    ).select_related("project", "workspace")

    sent_count = 0
    error_count = 0

    for sub in subscriptions:
        try:
            _send_report_for_subscription(
                sub, report_year, report_month, month_label,
                connection, EMAIL_FROM,
            )
            sent_count += 1
        except Exception as e:
            error_count += 1
            logger.error(
                f"DBWCARE report: failed for project {sub.project_id} "
                f"({sub.customer_email}): {e}"
            )
            log_exception(e)

    logger.info(
        f"DBWCARE monthly report completed: {sent_count} sent, "
        f"{error_count} errors for {month_label}"
    )


def _send_report_for_subscription(
    sub, report_year, report_month, month_label, connection, email_from
):
    """Generate and send the monthly report for a single subscription."""
    from plane.db.models import ProjectMonthlyBalance, WorklogEntry

    project = sub.project
    workspace = sub.workspace

    # Get balance for the report month
    try:
        balance = ProjectMonthlyBalance.objects.get(
            project=project,
            year=report_year,
            month=report_month,
            deleted_at__isnull=True,
        )
    except ProjectMonthlyBalance.DoesNotExist:
        raise ValueError(
            f"Keine Balance-Daten für {GERMAN_MONTHS[report_month]} {report_year} vorhanden."
        )

    # Get all worklog entries for the report month
    from django.utils import timezone

    _, last_day = calendar.monthrange(report_year, report_month)
    month_start = timezone.make_aware(
        timezone.datetime(report_year, report_month, 1)
    )
    month_end = timezone.make_aware(
        timezone.datetime(report_year, report_month, last_day, 23, 59, 59)
    )

    entries = (
        WorklogEntry.objects.filter(
            issue__project=project,
            started_at__gte=month_start,
            started_at__lte=month_end,
            is_running=False,
            deleted_at__isnull=True,
        )
        .exclude(billing_status="self_caused")
        .select_related("issue")
        .order_by("started_at")
    )

    # Group entries by issue, split into billable and gift
    from collections import OrderedDict

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

    # Get previous month's balance for comparison
    if report_month == 1:
        prev_year = report_year - 1
        prev_month = 12
    else:
        prev_year = report_year
        prev_month = report_month - 1

    prev_month_consumed_formatted = None
    prev_month_label = None
    try:
        prev_balance = ProjectMonthlyBalance.objects.get(
            project=project,
            year=prev_year,
            month=prev_month,
            deleted_at__isnull=True,
        )
        prev_month_consumed_formatted = format_minutes(prev_balance.consumed_minutes)
        prev_month_label = f"{GERMAN_MONTHS[prev_month]} {prev_year}"
    except ProjectMonthlyBalance.DoesNotExist:
        pass

    # Build site URL from WEB_URL setting
    site_url = os.environ.get("WEB_URL", "https://care.dbw-media.de").rstrip("/")
    project_url = f"{site_url}/{workspace.slug}/projects/{project.id}/issues"

    remaining_minutes = balance.total_available_minutes - balance.consumed_minutes
    consumption_pct = balance.consumption_percentage

    context = {
        "customer_name": sub.customer_name or project.name,
        "project_name": project.name,
        "month_label": month_label,
        "package_label": sub.package_label or "-",
        "available_formatted": format_minutes(balance.total_available_minutes),
        "consumed_formatted": format_minutes(balance.consumed_minutes),
        "remaining_formatted": format_minutes(remaining_minutes),
        "remaining_minutes": remaining_minutes,
        "consumption_pct": consumption_pct,
        "consumption_pct_clamped": min(consumption_pct, 100),
        "billable_groups": billable_groups,
        "billable_total_formatted": format_minutes(billable_total),
        "gift_groups": gift_groups,
        "gift_total_formatted": format_minutes(gift_total),
        "prev_month_consumed_formatted": prev_month_consumed_formatted,
        "prev_month_label": prev_month_label,
        "project_url": project_url,
        "site_url": site_url,
    }

    html_content = render_to_string("emails/care/monthly_report.html", context)
    text_content = generate_plain_text_from_html(html_content)

    subject = f"dbwCARE Monatsbericht – {month_label} – {sub.customer_name or project.name}"

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
        f"DBWCARE report sent to {sub.customer_email} for "
        f"project {project.name} ({month_label})"
    )
