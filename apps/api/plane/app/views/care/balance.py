# DBWCARE Balance ViewSet

from django.utils import timezone

from rest_framework.response import Response
from rest_framework import status

from plane.app.views.base import BaseAPIView
from plane.app.permissions import WorkspaceViewerPermission
from plane.db.models import (
    WorkspaceCareSubscription,
    WorkspaceMonthlyBalance,
    WorklogEntry,
)
from plane.app.serializers import WorkspaceMonthlyBalanceSerializer


def get_or_create_current_balance(workspace_id):
    """Get or create balance for current month, computing consumed_minutes."""
    now = timezone.now()
    year, month = now.year, now.month

    balance, created = WorkspaceMonthlyBalance.objects.get_or_create(
        workspace_id=workspace_id,
        year=year,
        month=month,
        deleted_at__isnull=True,
        defaults=_build_balance_defaults(workspace_id, year, month),
    )

    # Always recompute consumed_minutes from actual worklog entries
    consumed = _compute_consumed_minutes(workspace_id, year, month)
    if balance.consumed_minutes != consumed:
        balance.consumed_minutes = consumed
        balance.save(update_fields=["consumed_minutes"], disable_auto_set_user=True)

    return balance


def _build_balance_defaults(workspace_id, year, month):
    """Build defaults for a new monthly balance record."""
    try:
        sub = WorkspaceCareSubscription.objects.get(
            workspace_id=workspace_id, is_active=True
        )
        base_hours = sub.monthly_hours
    except WorkspaceCareSubscription.DoesNotExist:
        base_hours = 0

    # Compute rollover from previous month
    rolled_over = 0
    prev_month = month - 1
    prev_year = year
    if prev_month < 1:
        prev_month = 12
        prev_year = year - 1

    try:
        prev_balance = WorkspaceMonthlyBalance.objects.get(
            workspace_id=workspace_id,
            year=prev_year,
            month=prev_month,
            deleted_at__isnull=True,
        )
        remaining = prev_balance.remaining_minutes
        if remaining > 0 and not prev_balance.is_closed:
            rolled_over = remaining
    except WorkspaceMonthlyBalance.DoesNotExist:
        pass

    return {
        "base_hours": base_hours,
        "rolled_over_minutes": rolled_over,
        "borrowed_minutes": 0,
        "consumed_minutes": 0,
    }


def _compute_consumed_minutes(workspace_id, year, month):
    """Sum billable worklog entries for a given workspace and month."""
    from django.db.models import Sum
    import calendar
    from datetime import datetime

    start = datetime(year, month, 1)
    _, last_day = calendar.monthrange(year, month)
    end = datetime(year, month, last_day, 23, 59, 59)

    result = (
        WorklogEntry.objects.filter(
            workspace_id=workspace_id,
            billing_status="billable",
            is_running=False,
            started_at__gte=start,
            started_at__lte=end,
            deleted_at__isnull=True,
        )
        .aggregate(total=Sum("duration_minutes"))
    )
    return result["total"] or 0


class WorkspaceCareBalanceEndpoint(BaseAPIView):
    """GET: Current month balance for workspace."""

    permission_classes = [WorkspaceViewerPermission]

    def get(self, request, slug):
        from plane.db.models import Workspace

        try:
            workspace = Workspace.objects.get(slug=slug)
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if subscription exists
        if not hasattr(workspace, "care_subscription"):
            return Response(None, status=status.HTTP_200_OK)

        balance = get_or_create_current_balance(workspace.id)
        serializer = WorkspaceMonthlyBalanceSerializer(balance)
        return Response(serializer.data, status=status.HTTP_200_OK)


class WorkspaceCareBalanceHistoryEndpoint(BaseAPIView):
    """GET: Historical balances for workspace."""

    permission_classes = [WorkspaceViewerPermission]

    def get(self, request, slug):
        from plane.db.models import Workspace

        months = int(request.query_params.get("months", 12))

        try:
            workspace = Workspace.objects.get(slug=slug)
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        balances = (
            WorkspaceMonthlyBalance.objects.filter(
                workspace=workspace,
                deleted_at__isnull=True,
            )
            .order_by("-year", "-month")[:months]
        )

        serializer = WorkspaceMonthlyBalanceSerializer(balances, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
