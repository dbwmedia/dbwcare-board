# DBWCARE Balance ViewSet — Project Level

from django.utils import timezone

from rest_framework.response import Response
from rest_framework import status

from plane.app.views.base import BaseAPIView
from plane.app.permissions.base import allow_permission, ROLE
from plane.db.models import (
    ProjectCareSubscription,
    ProjectMonthlyBalance,
    WorklogEntry,
)
from plane.app.serializers import ProjectMonthlyBalanceSerializer


def get_or_create_current_balance(project_id):
    """Get or create balance for current month, computing consumed_minutes."""
    now = timezone.now()
    year, month = now.year, now.month

    # Get workspace_id from project
    from plane.db.models import Project
    project = Project.objects.get(id=project_id)

    balance, created = ProjectMonthlyBalance.objects.get_or_create(
        project_id=project_id,
        year=year,
        month=month,
        deleted_at__isnull=True,
        defaults=_build_balance_defaults(project_id, project.workspace_id, year, month),
    )

    # Always recompute consumed_minutes from actual worklog entries
    consumed = _compute_consumed_minutes(project_id, year, month)
    if balance.consumed_minutes != consumed:
        balance.consumed_minutes = consumed
        balance.save(update_fields=["consumed_minutes"], disable_auto_set_user=True)

    return balance


def _build_balance_defaults(project_id, workspace_id, year, month):
    """Build defaults for a new monthly balance record."""
    try:
        sub = ProjectCareSubscription.objects.get(
            project_id=project_id, is_active=True
        )
        base_hours = sub.monthly_hours
    except ProjectCareSubscription.DoesNotExist:
        base_hours = 0

    # Compute rollover from previous month
    rolled_over = 0
    prev_month = month - 1
    prev_year = year
    if prev_month < 1:
        prev_month = 12
        prev_year = year - 1

    try:
        prev_balance = ProjectMonthlyBalance.objects.get(
            project_id=project_id,
            year=prev_year,
            month=prev_month,
            deleted_at__isnull=True,
        )
        remaining = prev_balance.remaining_minutes
        if remaining > 0 and not prev_balance.is_closed:
            rolled_over = remaining
    except ProjectMonthlyBalance.DoesNotExist:
        pass

    return {
        "workspace_id": workspace_id,
        "base_hours": base_hours,
        "rolled_over_minutes": rolled_over,
        "borrowed_minutes": 0,
        "consumed_minutes": 0,
    }


def _compute_consumed_minutes(project_id, year, month):
    """Sum billable worklog entries for a given project and month."""
    from django.db.models import Sum
    import calendar
    from datetime import datetime

    start = datetime(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    end = datetime(year, month, last_day, 23, 59, 59)

    result = (
        WorklogEntry.objects.filter(
            project_id=project_id,
            billing_status="billable",
            is_running=False,
            started_at__gte=start,
            started_at__lte=end,
            deleted_at__isnull=True,
        )
        .aggregate(total=Sum("duration_minutes"))
    )
    return result["total"] or 0


class ProjectCareBalanceEndpoint(BaseAPIView):
    """GET: Current month balance for a project."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, project_id):
        from plane.db.models import Project

        try:
            project = Project.objects.get(id=project_id, workspace__slug=slug)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if subscription exists
        if not hasattr(project, "care_subscription"):
            return Response(None, status=status.HTTP_200_OK)

        try:
            project.care_subscription
        except ProjectCareSubscription.DoesNotExist:
            return Response(None, status=status.HTTP_200_OK)

        balance = get_or_create_current_balance(project.id)
        serializer = ProjectMonthlyBalanceSerializer(balance)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ProjectCareBalanceHistoryEndpoint(BaseAPIView):
    """GET: Historical balances for a project."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, project_id):
        months = int(request.query_params.get("months", 12))

        balances = (
            ProjectMonthlyBalance.objects.filter(
                project_id=project_id,
                workspace__slug=slug,
                deleted_at__isnull=True,
            )
            .select_related("project")
            .order_by("-year", "-month")[:months]
        )

        serializer = ProjectMonthlyBalanceSerializer(balances, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CareOverviewEndpoint(BaseAPIView):
    """
    GET: Admin-only overview of ALL project balances in the workspace.
    Used for the "Mission Control" page.
    """

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def get(self, request, slug):
        from plane.db.models import Workspace

        try:
            workspace = Workspace.objects.get(slug=slug)
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Get all active subscriptions with current month balance
        now = timezone.now()
        year, month = now.year, now.month

        subscriptions = (
            ProjectCareSubscription.objects.filter(
                workspace=workspace,
                is_active=True,
            )
            .select_related("project")
        )

        overview = []
        for sub in subscriptions:
            # Get or create current balance
            try:
                balance = get_or_create_current_balance(sub.project_id)
            except Exception:
                balance = None

            item = {
                "project_id": str(sub.project_id),
                "project_name": sub.project.name,
                "package_label": sub.package_label,
                "monthly_hours": float(sub.monthly_hours),
                "is_active": sub.is_active,
            }

            if balance:
                item.update({
                    "base_minutes": balance.base_minutes,
                    "total_available_minutes": balance.total_available_minutes,
                    "consumed_minutes": balance.consumed_minutes,
                    "remaining_minutes": balance.remaining_minutes,
                    "consumption_percentage": balance.consumption_percentage,
                    "year": balance.year,
                    "month": balance.month,
                })
            else:
                item.update({
                    "base_minutes": 0,
                    "total_available_minutes": 0,
                    "consumed_minutes": 0,
                    "remaining_minutes": 0,
                    "consumption_percentage": 0,
                    "year": year,
                    "month": month,
                })

            overview.append(item)

        # Sort by consumption_percentage descending (most consumed first)
        overview.sort(key=lambda x: x["consumption_percentage"], reverse=True)

        return Response(overview, status=status.HTTP_200_OK)
