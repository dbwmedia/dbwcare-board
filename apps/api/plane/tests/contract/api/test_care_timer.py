# DBWCARE: care timer endpoint for the DBW OS clock.

from datetime import timedelta

import pytest
from django.utils import timezone
from rest_framework import status

from plane.db.models import Issue, Project, ProjectMember, User, WorklogEntry, WorkspaceMember

URL = "/api/v1/workspaces/{slug}/care-timer/"


@pytest.fixture
def project(db, workspace, create_user):
    project = Project.objects.create(name="berlin-bootsschule.de", identifier="BB", workspace=workspace, created_by=create_user)
    ProjectMember.objects.create(project=project, member=create_user, role=20, is_active=True)
    return project


@pytest.fixture
def issue(db, project, create_user):
    return Issue.objects.create(name="Seiten aufbauen", project=project, workspace=project.workspace, created_by=create_user)


@pytest.fixture
def lara(db, workspace):
    user = User.objects.create(email="lara@dbw-media.de", first_name="Lara", username="lara")
    WorkspaceMember.objects.create(workspace=workspace, member=user, role=15)
    return user


def _timer(workspace, project, issue, user, minutes_ago=14, description=""):
    return WorklogEntry.objects.create(
        workspace=workspace,
        project=project,
        issue=issue,
        logged_by=user,
        entry_type="tracked",
        is_running=True,
        started_at=timezone.now() - timedelta(minutes=minutes_ago),
        description=description,
    )


@pytest.mark.contract
@pytest.mark.django_db
class TestCareTimer:
    def test_no_timer(self, api_key_client, workspace, lara):
        r = api_key_client.get(URL.format(slug=workspace.slug), {"email": "lara@dbw-media.de"})
        assert r.status_code == status.HTTP_200_OK
        assert r.json() == {"running": None}

    def test_running_timer_of_another_member(self, api_key_client, workspace, project, issue, lara):
        _timer(workspace, project, issue, lara)
        r = api_key_client.get(URL.format(slug=workspace.slug), {"email": "LARA@dbw-media.de"})
        running = r.json()["running"]
        assert running["issue_name"] == "Seiten aufbauen"
        assert running["project_name"] == "berlin-bootsschule.de"
        assert running["started_at"]

    def test_stop_uses_issue_title_when_no_description(self, api_key_client, workspace, project, issue, lara):
        entry = _timer(workspace, project, issue, lara)
        r = api_key_client.post(URL.format(slug=workspace.slug), {"email": "lara@dbw-media.de"}, format="json")
        assert r.status_code == status.HTTP_200_OK
        assert r.json()["stopped"]["duration_minutes"] in (14, 15)
        entry.refresh_from_db()
        assert entry.is_running is False
        assert entry.description == "Seiten aufbauen"

    def test_stop_keeps_typed_description(self, api_key_client, workspace, project, issue, lara):
        entry = _timer(workspace, project, issue, lara, description="Header angepasst")
        api_key_client.post(URL.format(slug=workspace.slug), {"email": "lara@dbw-media.de"}, format="json")
        entry.refresh_from_db()
        assert entry.description == "Header angepasst"

    def test_stop_without_timer_is_not_an_error(self, api_key_client, workspace, lara):
        r = api_key_client.post(URL.format(slug=workspace.slug), {"email": "lara@dbw-media.de"}, format="json")
        assert r.status_code == status.HTTP_200_OK
        assert r.json() == {"stopped": None}

    def test_token_user_must_be_admin(self, api_key_client, workspace, create_user, lara):
        WorkspaceMember.objects.filter(workspace=workspace, member=create_user).update(role=15)
        r = api_key_client.get(URL.format(slug=workspace.slug), {"email": "lara@dbw-media.de"})
        assert r.status_code == status.HTTP_403_FORBIDDEN

    def test_guests_and_strangers_are_not_found(self, api_key_client, workspace):
        guest = User.objects.create(email="kunde@example.com", username="kunde")
        WorkspaceMember.objects.create(workspace=workspace, member=guest, role=5)
        for email in ("kunde@example.com", "niemand@example.com"):
            r = api_key_client.get(URL.format(slug=workspace.slug), {"email": email})
            assert r.status_code == status.HTTP_404_NOT_FOUND

    def test_email_required(self, api_key_client, workspace):
        r = api_key_client.post(URL.format(slug=workspace.slug), {}, format="json")
        assert r.status_code == status.HTTP_400_BAD_REQUEST
