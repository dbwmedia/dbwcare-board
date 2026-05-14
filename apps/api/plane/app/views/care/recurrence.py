# DBWCARE Recurrence ViewSet

import calendar
from datetime import datetime, timedelta

from django.utils import timezone

from rest_framework.response import Response
from rest_framework import status

from plane.app.views.base import BaseAPIView
from plane.app.permissions.base import allow_permission, ROLE
from plane.db.models import IssueRecurrence
from plane.app.serializers import IssueRecurrenceSerializer


def compute_next_occurrence(recurrence_type, day_of_month=None, interval_days=None, from_date=None):
    """Compute the next occurrence datetime."""
    if from_date is None:
        from_date = timezone.now()

    if recurrence_type == "monthly_date":
        # Next month, on day_of_month (or last day of month if shorter)
        year = from_date.year
        month = from_date.month + 1
        if month > 12:
            month = 1
            year += 1
        _, last_day = calendar.monthrange(year, month)
        actual_day = min(day_of_month, last_day)
        return datetime(year, month, actual_day, 0, 0, 0, tzinfo=from_date.tzinfo or timezone.utc)

    elif recurrence_type == "interval_days":
        return from_date + timedelta(days=interval_days)

    return from_date


class IssueRecurrenceEndpoint(BaseAPIView):
    """CRUD for issue recurrence config."""

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def get(self, request, slug, project_id, issue_id):
        try:
            recurrence = IssueRecurrence.objects.get(
                template_issue_id=issue_id,
                deleted_at__isnull=True,
            )
        except IssueRecurrence.DoesNotExist:
            return Response(None, status=status.HTTP_200_OK)

        serializer = IssueRecurrenceSerializer(recurrence)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def post(self, request, slug, project_id, issue_id):
        # Check if already exists
        if IssueRecurrence.objects.filter(
            template_issue_id=issue_id,
            deleted_at__isnull=True,
        ).exists():
            return Response(
                {"error": "Recurrence already exists for this issue"},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = IssueRecurrenceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        next_at = compute_next_occurrence(
            recurrence_type=serializer.validated_data["recurrence_type"],
            day_of_month=serializer.validated_data.get("day_of_month"),
            interval_days=serializer.validated_data.get("interval_days"),
        )

        recurrence = IssueRecurrence.objects.create(
            template_issue_id=issue_id,
            next_occurrence_at=next_at,
            **serializer.validated_data,
        )

        return Response(
            IssueRecurrenceSerializer(recurrence).data,
            status=status.HTTP_201_CREATED,
        )

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def patch(self, request, slug, project_id, issue_id):
        try:
            recurrence = IssueRecurrence.objects.get(
                template_issue_id=issue_id,
                deleted_at__isnull=True,
            )
        except IssueRecurrence.DoesNotExist:
            return Response(
                {"error": "Recurrence not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = IssueRecurrenceSerializer(
            recurrence, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()

            # Recompute next occurrence if type/params changed
            if any(k in request.data for k in ["recurrence_type", "day_of_month", "interval_days"]):
                next_at = compute_next_occurrence(
                    recurrence_type=recurrence.recurrence_type,
                    day_of_month=recurrence.day_of_month,
                    interval_days=recurrence.interval_days,
                )
                recurrence.next_occurrence_at = next_at
                recurrence.save(update_fields=["next_occurrence_at"])

            return Response(
                IssueRecurrenceSerializer(recurrence).data,
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER])
    def delete(self, request, slug, project_id, issue_id):
        try:
            recurrence = IssueRecurrence.objects.get(
                template_issue_id=issue_id,
                deleted_at__isnull=True,
            )
        except IssueRecurrence.DoesNotExist:
            return Response(
                {"error": "Recurrence not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        recurrence.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
