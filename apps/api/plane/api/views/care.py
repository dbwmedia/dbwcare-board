# DBWCARE stats for the DBW OS cockpit (os.dbw-media.de).
#
# Read-only aggregate over all active care subscriptions in a workspace:
# per-project quota balance (same numbers the internal CareOverview uses)
# plus recently created guest issues, so the cockpit can surface "Kunde
# hat etwas Neues angelegt".
#
# Auth: regular Plane API token (X-API-Key header, created under
# Workspace Settings → API tokens). The token user must be a workspace
# admin.

from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.views.care.balance import get_or_create_current_balance
from plane.db.models import Issue, Workspace, WorkspaceMember
from plane.utils.permissions import WorkSpaceAdminPermission

from .base import BaseAPIView

GUEST_ROLE = 5
GUEST_ISSUE_WINDOW_DAYS = 14


class CareStatsAPIEndpoint(BaseAPIView):
    """GET: care quota balances + recent guest issues for one workspace."""

    permission_classes = [WorkSpaceAdminPermission]
    use_read_replica = True

    def get(self, request, slug):
        from plane.db.models import ProjectCareSubscription

        try:
            workspace = Workspace.objects.get(slug=slug)
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        subscriptions = (
            ProjectCareSubscription.objects.filter(
                workspace=workspace,
                is_active=True,
                project__deleted_at__isnull=True,
            )
            .select_related("project")
            .order_by("project__name")
        )

        care = []
        for sub in subscriptions:
            balance = get_or_create_current_balance(sub.project_id)
            care.append(
                {
                    "project_id": str(sub.project_id),
                    "project_name": sub.project.name,
                    "package_label": sub.package_label,
                    "monthly_hours": float(sub.monthly_hours),
                    "year": balance.year,
                    "month": balance.month,
                    "base_minutes": balance.base_minutes,
                    "rolled_over_minutes": balance.rolled_over_minutes,
                    "borrowed_minutes": balance.borrowed_minutes,
                    "consumed_minutes": balance.consumed_minutes,
                    "total_available_minutes": balance.total_available_minutes,
                    "remaining_minutes": balance.remaining_minutes,
                    "consumption_percentage": balance.consumption_percentage,
                }
            )

        # Issues created by guests (= customers) in the last two weeks.
        since = timezone.now() - timedelta(days=GUEST_ISSUE_WINDOW_DAYS)
        guest_ids = WorkspaceMember.objects.filter(
            workspace=workspace,
            role=GUEST_ROLE,
            is_active=True,
        ).values_list("member_id", flat=True)

        guest_issues = (
            Issue.objects.filter(
                workspace=workspace,
                created_by_id__in=list(guest_ids),
                created_at__gte=since,
                deleted_at__isnull=True,
            )
            .select_related("project", "created_by")
            .order_by("-created_at")[:20]
        )

        issues = [
            {
                "project_name": issue.project.name,
                "title": issue.name,
                "created_at": issue.created_at.isoformat(),
                "author": issue.created_by.display_name if issue.created_by else "",
            }
            for issue in guest_issues
        ]

        return Response(
            {
                "generated_at": timezone.now().isoformat(),
                "source": "care.dbw-media.de",
                "workspace": slug,
                "care": care,
                "guest_issues": {
                    "window_days": GUEST_ISSUE_WINDOW_DAYS,
                    "count": len(issues),
                    "items": issues,
                },
            },
            status=status.HTTP_200_OK,
        )
