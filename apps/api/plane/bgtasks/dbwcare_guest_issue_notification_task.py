# DBWCARE Guest Issue Notification
# Sends an email to care@dbw-media.de when a Guest creates an issue.

import logging
import os

from celery import shared_task
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string

from plane.license.utils.instance_value import get_email_configuration
from plane.utils.email import generate_plain_text_from_html
from plane.utils.exception_logger import log_exception

logger = logging.getLogger(__name__)

CARE_NOTIFICATION_EMAIL = "care@dbw-media.de"


@shared_task
def dbwcare_guest_issue_notification(
    issue_id, issue_name, project_id, project_name, actor_display_name, actor_email
):
    """
    Send an email notification to the DBWCARE team when a guest creates an issue.
    Triggered from IssueViewSet.create() for users with GUEST role.
    """
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
        logger.error(f"DBWCARE guest notification: failed to get email config: {e}")
        return

    site_url = os.environ.get("WEB_URL", "https://care.dbw-media.de").rstrip("/")

    # We need to look up the workspace slug for the URL
    from plane.db.models import Project

    try:
        project = Project.objects.select_related("workspace").get(
            pk=project_id, deleted_at__isnull=True
        )
        workspace_slug = project.workspace.slug
    except Project.DoesNotExist:
        workspace_slug = ""

    issue_url = f"{site_url}/{workspace_slug}/projects/{project_id}/issues/{issue_id}"

    context = {
        "issue_name": issue_name,
        "project_name": project_name,
        "actor_display_name": actor_display_name,
        "actor_email": actor_email,
        "issue_url": issue_url,
        "site_url": site_url,
    }

    html_content = render_to_string("emails/care/guest_issue_notification.html", context)
    text_content = generate_plain_text_from_html(html_content)

    subject = f"Neue Kundenaufgabe: {issue_name} – {project_name}"

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
        to=[CARE_NOTIFICATION_EMAIL],
        connection=connection,
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send()

    logger.info(
        f"DBWCARE guest notification sent for issue '{issue_name}' "
        f"in project '{project_name}' by {actor_display_name}"
    )
