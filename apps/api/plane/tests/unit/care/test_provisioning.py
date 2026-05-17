"""
Tests for DBWCARE Direct Customer Provisioning endpoint.
POST /api/workspaces/<slug>/projects/<project_id>/provision-customer/
"""

from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core import mail
from rest_framework.test import APIClient

from plane.db.models import (
    Project,
    ProjectMember,
    User,
    Workspace,
    WorkspaceMember,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    user = User.objects.create(
        email="admin@prov-test.so",
        username="admin-prov-test",
        first_name="Admin",
        last_name="User",
    )
    user.set_password("admin-password")
    user.save()
    return user


@pytest.fixture
def member_user(db):
    user = User.objects.create(
        email="member@prov-test.so",
        username="member-prov-test",
        first_name="Member",
        last_name="User",
    )
    user.set_password("member-password")
    user.save()
    return user


@pytest.fixture
def workspace(admin_user):
    ws = Workspace.objects.create(
        name="Provisioning Test WS",
        owner=admin_user,
        slug="prov-test-ws",
    )
    WorkspaceMember.objects.create(workspace=ws, member=admin_user, role=20)
    return ws


@pytest.fixture
def project(workspace, admin_user):
    proj = Project.objects.create(
        name="Prov Project",
        identifier="PROV",
        workspace=workspace,
        created_by=admin_user,
        updated_by=admin_user,
    )
    ProjectMember.objects.create(
        project=proj,
        member=admin_user,
        workspace=workspace,
        role=20,
    )
    return proj


@pytest.fixture
def admin_client(admin_user):
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def member_client(member_user, workspace):
    WorkspaceMember.objects.create(workspace=workspace, member=member_user, role=15)
    client = APIClient()
    client.force_authenticate(user=member_user)
    return client


def _url(slug, project_id):
    return f"/api/workspaces/{slug}/projects/{project_id}/provision-customer/"


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestProvisionCustomer:
    def test_creates_user_and_memberships(self, admin_client, workspace, project):
        resp = admin_client.post(
            _url(workspace.slug, project.id),
            {
                "email": "pascal@bootsschule.de",
                "first_name": "Pascal",
                "last_name": "Gross",
                "password": "Xk9-mP2vL8-nQr3",
            },
            format="json",
        )
        assert resp.status_code == 201, resp.data
        data = resp.data

        assert data["email"] == "pascal@bootsschule.de"
        assert data["first_name"] == "Pascal"
        assert data["workspace_member"] is True
        assert data["project_member"] is True
        assert data["created"] is True

        # Verify DB state
        user = User.objects.get(email="pascal@bootsschule.de")
        assert user.check_password("Xk9-mP2vL8-nQr3")
        assert user.is_active is True
        assert user.is_password_autoset is True
        assert WorkspaceMember.objects.filter(workspace=workspace, member=user).exists()
        assert ProjectMember.objects.filter(project=project, member=user).exists()

    def test_no_email_sent(self, admin_client, workspace, project):
        mail.outbox = []

        with patch("django.core.mail.send_mail") as mock_send:
            admin_client.post(
                _url(workspace.slug, project.id),
                {
                    "email": "no-email@test.de",
                    "first_name": "No",
                    "last_name": "Email",
                    "password": "SecurePass123",
                },
                format="json",
            )
            mock_send.assert_not_called()

        assert len(mail.outbox) == 0

    def test_existing_user_added_to_project(self, admin_client, workspace, project):
        # Create user first
        existing = User.objects.create(
            email="existing@test.de",
            username="existing-user",
            first_name="Existing",
            last_name="User",
        )
        existing.set_password("OldPassword123")
        existing.save()

        resp = admin_client.post(
            _url(workspace.slug, project.id),
            {
                "email": "existing@test.de",
                "first_name": "Existing",
                "last_name": "User",
                "password": "NewPassword123",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["created"] is False

        # Password should NOT be changed for existing users
        existing.refresh_from_db()
        assert existing.check_password("OldPassword123")

        # But memberships should exist
        assert WorkspaceMember.objects.filter(workspace=workspace, member=existing).exists()
        assert ProjectMember.objects.filter(project=project, member=existing).exists()

    def test_already_member_returns_409(self, admin_client, workspace, project):
        # Create user and add to project
        user = User.objects.create(
            email="already@test.de",
            username="already-member",
            first_name="Already",
            last_name="Member",
        )
        WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
        ProjectMember.objects.create(
            project=project, member=user, workspace=workspace, role=15
        )

        resp = admin_client.post(
            _url(workspace.slug, project.id),
            {
                "email": "already@test.de",
                "first_name": "Already",
                "last_name": "Member",
                "password": "SomePass12345",
            },
            format="json",
        )
        assert resp.status_code == 409

    def test_requires_admin_role(self, member_client, workspace, project):
        resp = member_client.post(
            _url(workspace.slug, project.id),
            {
                "email": "shouldfail@test.de",
                "first_name": "Should",
                "last_name": "Fail",
                "password": "FailPass12345",
            },
            format="json",
        )
        assert resp.status_code == 403

    def test_validation_errors(self, admin_client, workspace, project):
        # Missing fields
        resp = admin_client.post(
            _url(workspace.slug, project.id),
            {"email": "", "first_name": "", "last_name": "", "password": "short"},
            format="json",
        )
        assert resp.status_code == 400
        assert "email" in resp.data
        assert "first_name" in resp.data
        assert "last_name" in resp.data
        assert "password" in resp.data

        # Invalid email
        resp = admin_client.post(
            _url(workspace.slug, project.id),
            {
                "email": "not-an-email",
                "first_name": "Test",
                "last_name": "User",
                "password": "ValidPass123",
            },
            format="json",
        )
        assert resp.status_code == 400
        assert "email" in resp.data
