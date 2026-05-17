# DBWCARE Subscription ViewSet — Project Level

from datetime import date

from rest_framework.response import Response
from rest_framework import status

from plane.app.views.base import BaseAPIView
from plane.app.permissions.base import allow_permission, ROLE
from plane.db.models import ProjectCareSubscription, Project
from plane.app.serializers import ProjectCareSubscriptionSerializer


class ProjectCareSubscriptionEndpoint(BaseAPIView):
    """
    GET: Retrieve care subscription for a project (project members).
    PATCH: Update/create subscription (workspace admin only).
    """

    @allow_permission([ROLE.ADMIN, ROLE.MEMBER, ROLE.GUEST], level="WORKSPACE")
    def get(self, request, slug, project_id):
        try:
            subscription = ProjectCareSubscription.objects.select_related("project").get(
                project_id=project_id,
                workspace__slug=slug,
            )
        except ProjectCareSubscription.DoesNotExist:
            return Response(None, status=status.HTTP_200_OK)

        serializer = ProjectCareSubscriptionSerializer(subscription)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def patch(self, request, slug, project_id):
        try:
            project = Project.objects.get(
                id=project_id,
                workspace__slug=slug,
            )
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        subscription, created = ProjectCareSubscription.objects.get_or_create(
            project=project,
            defaults={
                "workspace": project.workspace,
                "started_at": request.data.get("started_at") or date.today(),
                "monthly_hours": request.data.get("monthly_hours", 8),
                "package_label": request.data.get("package_label", ""),
            },
        )

        serializer = ProjectCareSubscriptionSerializer(
            subscription, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
