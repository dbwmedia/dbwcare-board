# DBWCARE Guest Issue Confirmation
# Sends a confirmation email to the customer when they create an issue.

import logging
import os

from celery import shared_task
from django.core.mail import EmailMultiAlternatives, get_connection
from django.template.loader import render_to_string

from plane.license.utils.instance_value import get_email_configuration
from plane.utils.email import generate_plain_text_from_html
from plane.utils.exception_logger import log_exception

logger = logging.getLogger(__name__)


@shared_task
def dbwcare_guest_issue_confirmation(
    issue_name, project_name, actor_display_name, actor_email
):
    """
    Send a confirmation email to the customer after they created an issue.
    """
    if not actor_email:
        logger.info("DBWCARE guest confirmation: no actor_email, skipping")
        return

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
        logger.error(f"DBWCARE guest confirmation: failed to get email config: {e}")
        return

    site_url = os.environ.get("WEB_URL", "https://care.dbw-media.de").rstrip("/")

    context = {
        "issue_name": issue_name,
        "project_name": project_name,
        "actor_display_name": actor_display_name,
        "site_url": site_url,
    }

    html_content = render_to_string("emails/care/guest_issue_confirmation.html", context)
    text_content = generate_plain_text_from_html(html_content)

    subject = f"Deine Aufgabe wurde erstellt: {issue_name}"

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
        to=[actor_email],
        connection=connection,
    )
    msg.attach_alternative(html_content, "text/html")
    msg.send()

    logger.info(
        f"DBWCARE guest confirmation sent to {actor_email} "
        f"for issue '{issue_name}' in project '{project_name}'"
    )
