# DBWCARE Manual Report Trigger — Admin only

import logging
from datetime import date

from rest_framework.response import Response
from rest_framework import status

from plane.app.views.base import BaseAPIView
from plane.app.permissions.base import allow_permission, ROLE
from plane.db.models import ProjectCareSubscription

logger = logging.getLogger(__name__)


class CareReportSendEndpoint(BaseAPIView):
    """
    POST: Manually trigger the monthly report for a specific project.
    Sends the report for the previous month (or current month if no
    previous month balance exists).
    Admin only.
    """

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug, project_id):
        try:
            sub = ProjectCareSubscription.objects.select_related(
                "project", "workspace"
            ).get(
                project_id=project_id,
                workspace__slug=slug,
                deleted_at__isnull=True,
            )
        except ProjectCareSubscription.DoesNotExist:
            return Response(
                {"error": "Keine Care-Subscription für dieses Projekt gefunden."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not sub.customer_email:
            return Response(
                {"error": "Keine Kunden-E-Mail hinterlegt."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Determine report month: use request param or default to current month
        today = date.today()
        report_year = int(request.data.get("year", 0)) or None
        report_month = int(request.data.get("month", 0)) or None

        if not report_year or not report_month:
            report_year = today.year
            report_month = today.month

        GERMAN_MONTHS = [
            "", "Januar", "Februar", "März", "April", "Mai", "Juni",
            "Juli", "August", "September", "Oktober", "November", "Dezember",
        ]
        month_label = f"{GERMAN_MONTHS[report_month]} {report_year}"

        from plane.license.utils.instance_value import get_email_configuration
        from django.core.mail import get_connection
        from plane.bgtasks.dbwcare_monthly_report_task import (
            _send_report_for_subscription,
        )

        try:
            (
                EMAIL_HOST, EMAIL_HOST_USER, EMAIL_HOST_PASSWORD,
                EMAIL_PORT, EMAIL_USE_TLS, EMAIL_USE_SSL, EMAIL_FROM,
            ) = get_email_configuration()

            connection = get_connection(
                host=EMAIL_HOST,
                port=int(EMAIL_PORT),
                username=EMAIL_HOST_USER,
                password=EMAIL_HOST_PASSWORD,
                use_tls=EMAIL_USE_TLS == "1",
                use_ssl=EMAIL_USE_SSL == "1",
            )

            _send_report_for_subscription(
                sub, report_year, report_month, month_label,
                connection, EMAIL_FROM,
            )
        except Exception as e:
            logger.error(f"Manual report send failed: {e}")
            return Response(
                {"error": f"Versand fehlgeschlagen: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response(
            {
                "message": f"Bericht für {month_label} an {sub.customer_email} gesendet.",
                "customer_email": sub.customer_email,
                "month_label": month_label,
            },
            status=status.HTTP_200_OK,
        )
