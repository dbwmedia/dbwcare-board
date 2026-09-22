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

import math
from datetime import timedelta

from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response

from plane.app.views.care.balance import get_or_create_current_balance
from plane.db.models import Issue, WorklogEntry, Workspace, WorkspaceMember
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


# ---------------------------------------------------------------------------
# Care timer for the DBW OS clock (os.dbw-media.de, since v0.8.0).
#
# The OS clock measures attendance all day. A Care timer is customer work:
# when one starts, the OS switches its running stretch to "Care · <project>:
# <issue>"; when the person switches in the OS (calendar ▶, ClickUp timer,
# pause), the OS stops the Care timer so Care does not keep counting quota
# for other work.
#
# The OS acts for every team member with ONE token, so the token user must
# be a workspace ADMIN (role 20) - WorkSpaceAdminPermission also admits
# members. The person is addressed by e-mail and must be an active admin
# or member of the workspace; guests (customers) never have timers here.
# ---------------------------------------------------------------------------


ADMIN_ROLE = 20
MEMBER_ROLE = 15
STOP_DESCRIPTION_MIN = 3  # same rule as the in-app stop (WorklogTimerStopEndpoint)


def _care_timer_payload(entry):
    return {
        "id": str(entry.id),
        "issue_id": str(entry.issue_id),
        "issue_name": entry.issue.name if entry.issue else "",
        "project_id": str(entry.project_id),
        "project_name": entry.project.name if entry.project else "",
        "started_at": entry.started_at.isoformat() if entry.started_at else None,
        "description": entry.description,
    }


class CareTimerAPIEndpoint(BaseAPIView):
    """GET ?email=: the person's running timer. POST {email}: stop it."""

    use_read_replica = False

    def _resolve(self, request, slug, email):
        """(member_user, error_response)."""
        if not WorkspaceMember.objects.filter(
            member=request.user,
            workspace__slug=slug,
            role=ADMIN_ROLE,
            is_active=True,
        ).exists():
            return None, Response(
                {"error": "Token user must be a workspace admin"},
                status=status.HTTP_403_FORBIDDEN,
            )
        email = (email or "").strip().lower()
        if not email:
            return None, Response({"error": "email is required"}, status=status.HTTP_400_BAD_REQUEST)
        membership = (
            WorkspaceMember.objects.filter(
                workspace__slug=slug,
                member__email__iexact=email,
                role__in=[ADMIN_ROLE, MEMBER_ROLE],
                is_active=True,
            )
            .select_related("member")
            .first()
        )
        if not membership:
            return None, Response({"error": "No team member with this email"}, status=status.HTTP_404_NOT_FOUND)
        return membership.member, None

    def _running(self, slug, user):
        return (
            WorklogEntry.objects.filter(
                workspace__slug=slug,
                logged_by=user,
                is_running=True,
                deleted_at__isnull=True,
            )
            .select_related("issue", "project")
            .first()
        )

    def get(self, request, slug):
        user, error = self._resolve(request, slug, request.query_params.get("email"))
        if error:
            return error
        entry = self._running(slug, user)
        return Response({"running": _care_timer_payload(entry) if entry else None}, status=status.HTTP_200_OK)

    def post(self, request, slug):
        user, error = self._resolve(request, slug, request.data.get("email"))
        if error:
            return error
        entry = self._running(slug, user)
        if not entry:
            return Response({"stopped": None}, status=status.HTTP_200_OK)

        # Customers read the description in their reports. A stop from the
        # OS has no text of its own, so it keeps what the person typed and
        # falls back to the issue title - never an empty line, never an
        # OS-internal label.
        description = (entry.description or "").strip()
        if len(description) < STOP_DESCRIPTION_MIN:
            description = (entry.issue.name if entry.issue else "")[:255]
        if len(description.strip()) < STOP_DESCRIPTION_MIN:
            description = "Arbeit an der Aufgabe"

        now = timezone.now()
        entry.ended_at = now
        entry.duration_minutes = max(1, math.ceil((now - entry.started_at).total_seconds() / 60))
        entry.is_running = False
        entry.description = description
        entry.save()

        from plane.app.views.care.balance import get_or_create_current_balance

        try:
            get_or_create_current_balance(entry.project_id)
        except Exception:
            pass  # the stop must not fail over a balance refresh

        payload = _care_timer_payload(entry)
        payload["duration_minutes"] = entry.duration_minutes
        return Response({"stopped": payload}, status=status.HTTP_200_OK)
