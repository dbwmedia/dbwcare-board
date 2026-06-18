# DBWCARE Quota Exhausted Notification Task
# Triggered when a project's monthly quota is fully consumed.
# Sends a friendly email to the customer informing them that
# further work will be deducted from the next month's quota.

import logging
import os

from celery import shared_task
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string

from plane.license.utils.instance_value import get_email_configuration
from plane.utils.email import generate_plain_text_from_html
from plane.utils.exception_logger import log_exception

logger = logging.getLogger(__name__)

GERMAN_MONTHS = [
    "", "Januar", "Februar", "Maerz", "April", "Mai", "Juni",
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
def dbwcare_quota_exhausted_notification(balance_id):
    """
    Send a quota-exhausted notification email for a specific monthly balance.
    Called asynchronously when consumed_minutes crosses total_available_minutes.
    """
    from plane.db.models import ProjectMonthlyBalance, ProjectCareSubscription

    try:
        balance = ProjectMonthlyBalance.objects.select_related(
            "project", "project__workspace"
        ).get(id=balance_id, deleted_at__isnull=True)
    except ProjectMonthlyBalance.DoesNotExist:
        logger.warning(f"DBWCARE quota notification: balance {balance_id} not found")
        return

    project = balance.project
    workspace = balance.project.workspace

    try:
        sub = ProjectCareSubscription.objects.get(
            project=project, is_active=True, deleted_at__isnull=True
        )
    except ProjectCareSubscription.DoesNotExist:
        logger.warning(
            f"DBWCARE quota notification: no active subscription for project {project.id}"
        )
        return

    # Only send if report_enabled and customer_email is set
    if not sub.report_enabled or not sub.customer_email.strip():
        logger.info(
            f"DBWCARE quota notification: skipped for {project.name} "
            f"(report_enabled={sub.report_enabled}, email={'set' if sub.customer_email.strip() else 'empty'})"
        )
        return

    # Get email configuration
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
        logger.error(f"DBWCARE quota notification: failed to get email config: {e}")
        return

    month_label = f"{GERMAN_MONTHS[balance.month]} {balance.year}"
    site_url = os.environ.get("WEB_URL", "https://care.dbw-media.de").rstrip("/")
    project_url = f"{site_url}/{workspace.slug}/projects/{project.id}/issues"

    context = {
        "customer_name": sub.customer_name or project.name,
        "month_label": month_label,
        "package_label": sub.package_label or "-",
        "available_formatted": format_minutes(balance.total_available_minutes),
        "consumed_formatted": format_minutes(balance.consumed_minutes),
        "project_url": project_url,
    }

    html_content = render_to_string("emails/care/quota_exhausted.html", context)
    text_content = generate_plain_text_from_html(html_content)

    subject = (
        f"dbwCARE – Kontingent aufgebraucht – "
        f"{month_label} – {sub.customer_name or project.name}"
    )

    to_emails = [e.strip() for e in sub.customer_email.split(",") if e.strip()]
    bcc_emails = [e.strip() for e in (sub.report_bcc or "").split(",") if e.strip()]

    connection = get_connection(
        host=EMAIL_HOST,
        port=int(EMAIL_PORT),
        username=EMAIL_HOST_USER,
        password=EMAIL_HOST_PASSWORD,
        use_tls=EMAIL_USE_TLS == "1",
        use_ssl=EMAIL_USE_SSL == "1",
    )

    msg = EmailMultiAlternatives(
        subject=subject,
        body=text_content,
        from_email=EMAIL_FROM,
        to=to_emails,
        bcc=bcc_emails,
        connection=connection,
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send()

    logger.info(
        f"DBWCARE quota exhausted notification sent to {', '.join(to_emails)} "
        f"(bcc: {', '.join(bcc_emails) or 'none'}) for "
        f"project {project.name} ({month_label})"
    )
