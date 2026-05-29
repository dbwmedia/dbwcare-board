# DBWCARE Direct Customer Provisioning

import uuid

from django.db import transaction
from django.core.validators import validate_email
from django.core.exceptions import ValidationError as DjangoValidationError

from rest_framework.response import Response
from rest_framework import status
from rest_framework.throttling import UserRateThrottle

from plane.app.views.base import BaseAPIView
from plane.app.permissions.base import allow_permission, ROLE
from plane.db.models import User, Workspace, WorkspaceMember, Project, ProjectMember


class ProvisioningThrottle(UserRateThrottle):
    rate = "10/min"


class ProvisionCustomerEndpoint(BaseAPIView):
    """
    POST: Create a customer account directly (workspace admin only).
    Creates the user, adds to workspace and project — no email sent.
    """

    throttle_classes = [ProvisioningThrottle]

    @allow_permission([ROLE.ADMIN], level="WORKSPACE")
    def post(self, request, slug, project_id):
        # --- Validate input ---
        email = (request.data.get("email") or "").strip().lower()
        first_name = (request.data.get("first_name") or "").strip()
        last_name = (request.data.get("last_name") or "").strip()
        password = request.data.get("password") or ""

        errors = {}
        if not email:
            errors["email"] = "This field is required."
        else:
            try:
                validate_email(email)
            except DjangoValidationError:
                errors["email"] = "Enter a valid email address."

        if not first_name:
            errors["first_name"] = "This field is required."
        if not last_name:
            errors["last_name"] = "This field is required."
        if len(password) < 8:
            errors["password"] = "Password must be at least 8 characters."

        if errors:
            return Response(errors, status=status.HTTP_400_BAD_REQUEST)

        # --- Resolve workspace and project ---
        try:
            workspace = Workspace.objects.get(slug=slug)
        except Workspace.DoesNotExist:
            return Response(
                {"error": "Workspace not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        try:
            project = Project.objects.get(id=project_id, workspace=workspace)
        except Project.DoesNotExist:
            return Response(
                {"error": "Project not found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        with transaction.atomic():
            # --- User ---
            user, user_created = User.objects.get_or_create(
                email=email,
                defaults={
                    "username": uuid.uuid4().hex,
                    "first_name": first_name,
                    "last_name": last_name,
                    "display_name": f"{first_name} {last_name}".strip(),
                    "is_active": True,
                    "is_password_autoset": True,
                    "is_email_verified": True,
                },
            )

            if user_created:
                user.set_password(password)
                user.save(update_fields=["password"])

            # --- Workspace membership ---
            WorkspaceMember.objects.get_or_create(
                workspace=workspace,
                member=user,
                defaults={"role": 5},  # Guest (customer)
            )

            # --- Project membership ---
            pm, pm_created = ProjectMember.objects.get_or_create(
                project=project,
                member=user,
                defaults={"role": 5},  # Guest (customer)
            )

            if not pm_created:
                return Response(
                    {"error": "User is already a member of this project."},
                    status=status.HTTP_409_CONFLICT,
                )

        return Response(
            {
                "user_id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
                "workspace_member": True,
                "project_member": True,
                "created": user_created,
            },
            status=status.HTTP_201_CREATED,
        )
