# DBWCARE Subscription ViewSet

from rest_framework.response import Response
from rest_framework import status

from plane.app.views.base import BaseAPIView
from plane.app.permissions import WorkspaceOwnerPermission
from plane.db.models import WorkspaceCareSubscription
from plane.app.serializers import WorkspaceCareSubscriptionSerializer


class WorkspaceCareSubscriptionEndpoint(BaseAPIView):
    """
    GET: Retrieve care subscription for workspace (all members).
    PATCH: Update subscription (admin only).
    """

    permission_classes = [WorkspaceOwnerPermission]

    def get(self, request, slug):
        try:
            subscription = WorkspaceCareSubscription.objects.get(
                workspace__slug=slug,
            )
        except WorkspaceCareSubscription.DoesNotExist:
            return Response(None, status=status.HTTP_200_OK)

        serializer = WorkspaceCareSubscriptionSerializer(subscription)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def patch(self, request, slug):
        subscription, created = WorkspaceCareSubscription.objects.get_or_create(
            workspace__slug=slug,
            defaults={
                "workspace_id": self._get_workspace_id(slug),
                "started_at": request.data.get("started_at"),
                "monthly_hours": request.data.get("monthly_hours", 8),
            },
        )

        serializer = WorkspaceCareSubscriptionSerializer(
            subscription, data=request.data, partial=True
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def _get_workspace_id(self, slug):
        from plane.db.models import Workspace

        return Workspace.objects.get(slug=slug).id
