# DBWCARE Serializers

from rest_framework import serializers

from .base import BaseSerializer
from plane.db.models import (
    ProjectCareSubscription,
    ProjectMonthlyBalance,
    WorklogEntry,
    IssueRecurrence,
)


class ProjectCareSubscriptionSerializer(BaseSerializer):
    project_name = serializers.SerializerMethodField()
    started_at = serializers.DateField(required=False)
    customer_name = serializers.CharField(required=False, allow_blank=True)
    customer_email = serializers.CharField(required=False, allow_blank=True)
    report_bcc = serializers.CharField(required=False, allow_blank=True)
    report_enabled = serializers.BooleanField(required=False)
    weekly_report_enabled = serializers.BooleanField(required=False)
    expert_ids = serializers.JSONField(required=False)

    class Meta:
        model = ProjectCareSubscription
        fields = "__all__"
        read_only_fields = ["project", "workspace"]

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None


class ProjectMonthlyBalanceSerializer(BaseSerializer):
    base_minutes = serializers.IntegerField(read_only=True)
    total_available_minutes = serializers.IntegerField(read_only=True)
    remaining_minutes = serializers.IntegerField(read_only=True)
    consumption_percentage = serializers.IntegerField(read_only=True)
    project_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMonthlyBalance
        fields = [
            "id",
            "project",
            "project_name",
            "workspace",
            "year",
            "month",
            "base_hours",
            "base_minutes",
            "rolled_over_minutes",
            "borrowed_minutes",
            "consumed_minutes",
            "total_available_minutes",
            "remaining_minutes",
            "consumption_percentage",
            "is_closed",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["project", "workspace", "year", "month", "consumed_minutes"]

    def get_project_name(self, obj):
        return obj.project.name if obj.project else None


class WorklogEntrySerializer(BaseSerializer):
    logged_by_detail = serializers.SerializerMethodField()

    class Meta:
        model = WorklogEntry
        fields = [
            "id",
            "workspace",
            "project",
            "issue",
            "logged_by",
            "logged_by_detail",
            "description",
            "duration_minutes",
            "started_at",
            "ended_at",
            "is_running",
            "entry_type",
            "billing_status",
            "gift_reason",
            "created_at",
            "updated_at",
            "created_by",
        ]
        read_only_fields = [
            "workspace",
            "project",
            "issue",
            "logged_by",
            "is_running",
            "entry_type",
            "created_by",
        ]

    def get_logged_by_detail(self, obj):
        if obj.logged_by:
            return {
                "id": str(obj.logged_by.id),
                "display_name": obj.logged_by.display_name,
                "avatar": obj.logged_by.avatar,
            }
        return None


class WorklogEntryCreateSerializer(BaseSerializer):
    class Meta:
        model = WorklogEntry
        fields = [
            "description",
            "duration_minutes",
            "started_at",
            "billing_status",
            "gift_reason",
        ]

    def validate_duration_minutes(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Duration must be greater than 0")
        return value

    def validate_description(self, value):
        if value is not None and len(value.strip()) < 3:
            raise serializers.ValidationError("Description must be at least 3 characters")
        return value


class IssueRecurrenceSerializer(BaseSerializer):
    class Meta:
        model = IssueRecurrence
        fields = [
            "id",
            "template_issue",
            "recurrence_type",
            "day_of_month",
            "interval_days",
            "estimated_minutes",
            "next_occurrence_at",
            "is_active",
            "last_generated_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "template_issue",
            "next_occurrence_at",
            "last_generated_at",
        ]

    def validate(self, data):
        recurrence_type = data.get("recurrence_type", getattr(self.instance, "recurrence_type", None))
        if recurrence_type == "monthly_date":
            if not data.get("day_of_month") and not getattr(self.instance, "day_of_month", None):
                raise serializers.ValidationError({"day_of_month": "Required for monthly_date recurrence"})
        elif recurrence_type == "interval_days":
            if not data.get("interval_days") and not getattr(self.instance, "interval_days", None):
                raise serializers.ValidationError({"interval_days": "Required for interval_days recurrence"})
        return data
