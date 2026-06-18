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
    WorkspaceMember,
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
        old_consumed = balance.consumed_minutes
        balance.consumed_minutes = consumed
        balance.save(update_fields=["consumed_minutes"], disable_auto_set_user=True)

        # Check if quota was just exhausted (crossed the threshold)
        _check_quota_exhausted(balance, old_consumed)

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

    # Compute rollover/borrowing from previous month
    rolled_over = 0
    borrowed = 0
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
        if not prev_balance.is_closed:
            remaining = prev_balance.remaining_minutes
            if remaining < 0:
                # Over-consumed: borrow from this month
                borrowed = abs(remaining)
            elif remaining > 0:
                # Under-consumed: only carry forward base remainder
                # (previously rolled-over minutes expire — depot lives 1 month max)
                # Consumption eats rollover first (use it or lose it)
                rollover_used = min(
                    prev_balance.consumed_minutes,
                    prev_balance.rolled_over_minutes,
                )
                base_consumed = prev_balance.consumed_minutes - rollover_used
                base_remaining = prev_balance.base_minutes - base_consumed
                rolled_over = max(0, base_remaining)
    except ProjectMonthlyBalance.DoesNotExist:
        pass

    return {
        "workspace_id": workspace_id,
        "base_hours": base_hours,
        "rolled_over_minutes": rolled_over,
        "borrowed_minutes": borrowed,
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
    GET: Admin-only overview of ALL projects in the workspace.
    Projects with active subscription show balance data.
    Projects without subscription show has_subscription=false.
    """

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def get(self, request, slug):
        from plane.db.models import Workspace, Project

        try:
            workspace = Workspace.objects.get(slug=slug)
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        now = timezone.now()
        year, month = now.year, now.month

        # Get ALL projects in workspace
        projects = Project.objects.filter(
            workspace=workspace,
            deleted_at__isnull=True,
        ).order_by("name")

        # Build subscription lookup
        subscriptions = {
            sub.project_id: sub
            for sub in ProjectCareSubscription.objects.filter(
                workspace=workspace,
            ).select_related("project")
        }

        overview = []
        for project in projects:
            sub = subscriptions.get(project.id)

            item = {
                "project_id": str(project.id),
                "project_name": project.name,
                "has_subscription": sub is not None,
                "is_active": sub.is_active if sub else False,
                "package_label": sub.package_label if sub else "",
                "monthly_hours": float(sub.monthly_hours) if sub else 0,
            }

            if sub and sub.is_active:
                try:
                    balance = get_or_create_current_balance(project.id)
                    item.update({
                        "base_minutes": balance.base_minutes,
                        "total_available_minutes": balance.total_available_minutes,
                        "consumed_minutes": balance.consumed_minutes,
                        "remaining_minutes": balance.remaining_minutes,
                        "consumption_percentage": balance.consumption_percentage,
                        "year": balance.year,
                        "month": balance.month,
                    })
                except Exception:
                    item.update({
                        "base_minutes": 0,
                        "total_available_minutes": 0,
                        "consumed_minutes": 0,
                        "remaining_minutes": 0,
                        "consumption_percentage": 0,
                        "year": year,
                        "month": month,
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

        # Sort: active subscriptions first (by consumption desc), then inactive (by name)
        overview.sort(
            key=lambda x: (
                0 if x["is_active"] else 1,
                -x["consumption_percentage"] if x["is_active"] else 0,
                x["project_name"],
            )
        )

        return Response(overview, status=status.HTTP_200_OK)


class ProjectCareMonthWorklogsEndpoint(BaseAPIView):
    """GET: Worklog entries for a project in a specific month, grouped by issue."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, project_id, year, month):
        import calendar
        from collections import OrderedDict
        from datetime import datetime

        if month < 1 or month > 12:
            return Response(
                {"error": "Invalid month"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _, last_day = calendar.monthrange(year, month)
        start = datetime(year, month, 1)
        end = datetime(year, month, last_day, 23, 59, 59)

        is_admin = WorkspaceMember.objects.filter(
            member=request.user,
            workspace__slug=slug,
            role=20,
            is_active=True,
        ).exists()

        entries = (
            WorklogEntry.objects.filter(
                project_id=project_id,
                is_running=False,
                started_at__gte=start,
                started_at__lte=end,
                deleted_at__isnull=True,
            )
            .select_related("logged_by", "issue")
            .order_by("started_at")
        )

        if not is_admin:
            entries = entries.exclude(billing_status="self_caused")

        issues = OrderedDict()
        for entry in entries:
            issue_id = str(entry.issue_id)
            if issue_id not in issues:
                issues[issue_id] = {
                    "issue_id": issue_id,
                    "issue_title": entry.issue.name if entry.issue else "Unbekannt",
                    "entries": [],
                    "total_minutes": 0,
                }
            issues[issue_id]["entries"].append({
                "id": str(entry.id),
                "description": entry.description,
                "duration_minutes": entry.duration_minutes,
                "billing_status": entry.billing_status,
                "gift_reason": entry.gift_reason,
                "logged_by": {
                    "id": str(entry.logged_by.id),
                    "display_name": entry.logged_by.display_name,
                }
                if entry.logged_by
                else None,
                "started_at": entry.started_at.isoformat() if entry.started_at else None,
            })
            issues[issue_id]["total_minutes"] += entry.duration_minutes

        return Response(list(issues.values()), status=status.HTTP_200_OK)


def _check_quota_exhausted(balance, old_consumed):
    """
    If consumed_minutes just crossed total_available_minutes,
    send a one-time notification email to the customer.
    Resets the flag if consumption drops back below the threshold.
    """
    total = balance.total_available_minutes
    now_exhausted = balance.consumed_minutes >= total and total > 0
    was_exhausted = old_consumed >= total and total > 0

    if now_exhausted and not was_exhausted and not balance.quota_exhausted_notified:
        # Quota just crossed the threshold — send notification
        balance.quota_exhausted_notified = True
        balance.save(
            update_fields=["quota_exhausted_notified"],
            disable_auto_set_user=True,
        )
        try:
            from plane.bgtasks.dbwcare_quota_exhausted_task import (
                dbwcare_quota_exhausted_notification,
            )
            dbwcare_quota_exhausted_notification.delay(str(balance.id))
        except Exception:
            pass  # Don't fail the main operation

    elif not now_exhausted and balance.quota_exhausted_notified:
        # Consumption dropped back below threshold (e.g. entry deleted)
        balance.quota_exhausted_notified = False
        balance.save(
            update_fields=["quota_exhausted_notified"],
            disable_auto_set_user=True,
        )


def compute_carryover_for_next_month(balance):
    """
    Given a completed month's balance, compute what carries to the next month.
    Returns (rolled_over, borrowed) tuple in minutes.
    Used by report tasks to display depot/borrowing info.
    """
    remaining = balance.remaining_minutes
    if remaining < 0:
        return 0, abs(remaining)
    elif remaining > 0:
        rollover_used = min(balance.consumed_minutes, balance.rolled_over_minutes)
        base_consumed = balance.consumed_minutes - rollover_used
        base_remaining = balance.base_minutes - base_consumed
        return max(0, base_remaining), 0
    return 0, 0
