# DBWCARE Worklog ViewSet

import math
from django.db import transaction
from django.utils import timezone

from rest_framework.response import Response
from rest_framework import status

from plane.app.views.base import BaseViewSet, BaseAPIView
from plane.app.permissions import ProjectEntityPermission
from plane.app.permissions.base import allow_permission, ROLE
from plane.db.models import WorklogEntry, WorkspaceMember
from plane.app.serializers import (
    WorklogEntrySerializer,
    WorklogEntryCreateSerializer,
)


class WorklogEntryViewSet(BaseViewSet):
    """CRUD for worklog entries on an issue."""

    permission_classes = [ProjectEntityPermission]
    model = WorklogEntry
    serializer_class = WorklogEntrySerializer

    def get_queryset(self):
        return WorklogEntry.objects.filter(
            workspace__slug=self.kwargs["slug"],
            project_id=self.kwargs["project_id"],
            issue_id=self.kwargs["issue_id"],
        ).select_related("logged_by")

    def _is_admin(self, request, slug):
        return WorkspaceMember.objects.filter(
            member=request.user,
            workspace__slug=slug,
            role=20,  # Admin
            is_active=True,
        ).exists()

    def list(self, request, slug, project_id, issue_id):
        queryset = self.get_queryset()

        # Non-admins cannot see self_caused entries
        if not self._is_admin(request, slug):
            queryset = queryset.exclude(billing_status="self_caused")

        serializer = WorklogEntrySerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def create(self, request, slug, project_id, issue_id):
        create_serializer = WorklogEntryCreateSerializer(data=request.data)
        if not create_serializer.is_valid():
            return Response(create_serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        entry = WorklogEntry.objects.create(
            workspace_id=self._get_workspace_id(slug),
            project_id=project_id,
            issue_id=issue_id,
            logged_by=request.user,
            entry_type="manual",
            started_at=create_serializer.validated_data.get("started_at", timezone.now()),
            **{k: v for k, v in create_serializer.validated_data.items() if k != "started_at"},
        )

        # Update balance consumed_minutes
        self._refresh_balance(entry)

        serializer = WorklogEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def partial_update(self, request, slug, project_id, issue_id, pk):
        try:
            entry = WorklogEntry.objects.get(
                pk=pk,
                workspace__slug=slug,
                project_id=project_id,
                issue_id=issue_id,
            )
        except WorklogEntry.DoesNotExist:
            return Response(
                {"error": "Entry not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Non-admins can only edit their own entries
        if not self._is_admin(request, slug) and entry.logged_by != request.user:
            return Response(
                {"error": "You can only edit your own entries"},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = WorklogEntrySerializer(entry, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            self._refresh_balance(entry)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def destroy(self, request, slug, project_id, issue_id, pk):
        try:
            entry = WorklogEntry.objects.get(
                pk=pk,
                workspace__slug=slug,
                project_id=project_id,
                issue_id=issue_id,
            )
        except WorklogEntry.DoesNotExist:
            return Response(
                {"error": "Entry not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not self._is_admin(request, slug) and entry.logged_by != request.user:
            return Response(
                {"error": "You can only delete your own entries"},
                status=status.HTTP_403_FORBIDDEN,
            )

        entry.delete()
        self._refresh_balance(entry)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _get_workspace_id(self, slug):
        from plane.db.models import Workspace
        return Workspace.objects.get(slug=slug).id

    def _refresh_balance(self, entry):
        """Refresh consumed_minutes on the monthly balance."""
        from .balance import get_or_create_current_balance
        try:
            get_or_create_current_balance(entry.workspace_id)
        except Exception:
            pass  # Don't fail the main operation


class WorklogTimerStartEndpoint(BaseAPIView):
    """POST: Start a timer on an issue."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, issue_id):
        from plane.db.models import Workspace

        # Check for already running timer for this user (system-wide)
        running = WorklogEntry.objects.filter(
            logged_by=request.user,
            is_running=True,
            deleted_at__isnull=True,
        ).first()

        # If force_stop is set, stop existing timer first
        if running:
            if request.data.get("force_stop"):
                self._stop_timer(running)
            else:
                return Response(
                    {
                        "error": "Timer already running",
                        "running_entry": WorklogEntrySerializer(running).data,
                    },
                    status=status.HTTP_409_CONFLICT,
                )

        workspace = Workspace.objects.get(slug=slug)
        entry = WorklogEntry.objects.create(
            workspace=workspace,
            project_id=project_id,
            issue_id=issue_id,
            logged_by=request.user,
            entry_type="tracked",
            is_running=True,
            started_at=timezone.now(),
            description=request.data.get("description", ""),
        )

        serializer = WorklogEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def _stop_timer(self, entry):
        now = timezone.now()
        duration = (now - entry.started_at).total_seconds() / 60
        entry.ended_at = now
        entry.duration_minutes = max(1, math.ceil(duration))
        entry.is_running = False
        entry.save()

        # Refresh balance
        from .balance import get_or_create_current_balance
        try:
            get_or_create_current_balance(entry.workspace_id)
        except Exception:
            pass


class WorklogTimerStopEndpoint(BaseAPIView):
    """POST: Stop active timer on an issue."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, issue_id):
        try:
            entry = WorklogEntry.objects.get(
                logged_by=request.user,
                issue_id=issue_id,
                is_running=True,
                deleted_at__isnull=True,
            )
        except WorklogEntry.DoesNotExist:
            return Response(
                {"error": "No active timer on this issue"},
                status=status.HTTP_404_NOT_FOUND,
            )

        now = timezone.now()
        duration = (now - entry.started_at).total_seconds() / 60
        description = request.data.get("description", entry.description)

        if len(description.strip()) < 3:
            return Response(
                {"error": "Description must be at least 3 characters"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        entry.ended_at = now
        entry.duration_minutes = max(1, math.ceil(duration))
        entry.is_running = False
        entry.description = description
        entry.billing_status = request.data.get("billing_status", entry.billing_status)
        entry.save()

        # Refresh balance
        from .balance import get_or_create_current_balance
        try:
            get_or_create_current_balance(entry.workspace_id)
        except Exception:
            pass

        serializer = WorklogEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_200_OK)


class ActiveTimerEndpoint(BaseAPIView):
    """GET: Get the active timer for the current user in this workspace."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug):
        entry = WorklogEntry.objects.filter(
            workspace__slug=slug,
            logged_by=request.user,
            is_running=True,
            deleted_at__isnull=True,
        ).select_related("logged_by").first()

        if not entry:
            return Response(None, status=status.HTTP_200_OK)

        serializer = WorklogEntrySerializer(entry)
        return Response(serializer.data, status=status.HTTP_200_OK)
