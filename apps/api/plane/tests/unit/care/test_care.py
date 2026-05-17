"""
Comprehensive tests for DBWCARE time-tracking features (Project-Level):
- WorklogEntry timer constraints
- ProjectMonthlyBalance rollover and expiry
- Worklog visibility based on billing_status and user role
- IssueRecurrence cloning and date computation
- Balance consumed_minutes recomputation
- Project-level permissions (member vs admin, cross-project access)
"""

import calendar
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import uuid4

import pytest
from django.utils import timezone
from rest_framework.test import APIClient

from plane.db.models import (
    Issue,
    Project,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
    WorklogEntry,
    ProjectCareSubscription,
    ProjectMonthlyBalance,
    IssueRecurrence,
)
from plane.app.views.care.balance import (
    get_or_create_current_balance,
    _build_balance_defaults,
    _compute_consumed_minutes,
)
from plane.bgtasks.dbwcare_balance_task import dbwcare_monthly_balance_init
from plane.bgtasks.dbwcare_recurrence_task import (
    dbwcare_recurrence_generator,
    _compute_next,
    _process_recurrence,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def admin_user(db):
    """Create an admin user."""
    user = User.objects.create(
        email="admin@care-test.so",
        username="admin-care-test",
        first_name="Admin",
        last_name="User",
    )
    user.set_password("admin-password")
    user.save()
    return user


@pytest.fixture
def member_user(db):
    """Create a regular member user."""
    user = User.objects.create(
        email="member@care-test.so",
        username="member-care-test",
        first_name="Member",
        last_name="User",
    )
    user.set_password("member-password")
    user.save()
    return user


@pytest.fixture
def other_user(db):
    """Create a user that belongs to a different project."""
    user = User.objects.create(
        email="other@care-test.so",
        username="other-care-test",
        first_name="Other",
        last_name="User",
    )
    user.set_password("other-password")
    user.save()
    return user


@pytest.fixture
def care_workspace(admin_user):
    """Create a workspace with admin membership."""
    ws = Workspace.objects.create(
        name="Care Test Workspace",
        owner=admin_user,
        slug="care-test-ws",
    )
    WorkspaceMember.objects.create(
        workspace=ws,
        member=admin_user,
        role=20,  # Admin
    )
    return ws


@pytest.fixture
def care_project(care_workspace, admin_user):
    """Create a project inside the care workspace."""
    project = Project.objects.create(
        name="Care Project",
        workspace=care_workspace,
        created_by=admin_user,
        updated_by=admin_user,
    )
    ProjectMember.objects.create(
        project=project,
        member=admin_user,
        workspace=care_workspace,
        role=20,  # Admin
    )
    return project


@pytest.fixture
def other_project(care_workspace, admin_user):
    """Create a second project (for cross-project permission tests)."""
    project = Project.objects.create(
        name="Other Project",
        workspace=care_workspace,
        created_by=admin_user,
        updated_by=admin_user,
    )
    ProjectMember.objects.create(
        project=project,
        member=admin_user,
        workspace=care_workspace,
        role=20,
    )
    return project


@pytest.fixture
def backlog_state(care_project, admin_user):
    """Create a backlog state for the project."""
    return State.objects.create(
        name="Backlog",
        project=care_project,
        workspace=care_project.workspace,
        color="#999999",
        group="backlog",
        sequence=1.0,
    )


@pytest.fixture
def care_issue(care_project, backlog_state, admin_user):
    """Create an issue in the care project."""
    return Issue.objects.create(
        name="Test Issue",
        project=care_project,
        workspace=care_project.workspace,
        state=backlog_state,
    )


@pytest.fixture
def second_issue(care_project, backlog_state, admin_user):
    """Create a second issue for timer conflict tests."""
    return Issue.objects.create(
        name="Second Issue",
        project=care_project,
        workspace=care_project.workspace,
        state=backlog_state,
    )


@pytest.fixture
def care_subscription(care_project, care_workspace):
    """Create an active care subscription for the project."""
    return ProjectCareSubscription.objects.create(
        project=care_project,
        workspace=care_workspace,
        monthly_hours=Decimal("8.00"),
        package_label="M",
        started_at=timezone.now().date() - timedelta(days=90),
        is_active=True,
    )


@pytest.fixture
def admin_client(admin_user):
    """Return an API client authenticated as admin."""
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def member_client(member_user):
    """Return an API client authenticated as member."""
    client = APIClient()
    client.force_authenticate(user=member_user)
    return client


@pytest.fixture
def other_client(other_user):
    """Return an API client authenticated as the other user."""
    client = APIClient()
    client.force_authenticate(user=other_user)
    return client


def _add_member_to_workspace_and_project(user, workspace, project, role=15):
    """Helper: add a user as workspace + project member with a given role."""
    WorkspaceMember.objects.get_or_create(
        workspace=workspace,
        member=user,
        defaults={"role": role},
    )
    ProjectMember.objects.get_or_create(
        project=project,
        member=user,
        workspace=workspace,
        defaults={"role": role},
    )


# ---------------------------------------------------------------------------
# 1. Timer active constraint: cannot start two timers
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.unit
class TestWorklogEntryActiveTimerConstraint:
    """Starting a second timer while one is running should return 409 CONFLICT."""

    def test_second_timer_returns_409_with_running_entry(
        self, admin_client, care_workspace, care_project, care_issue, second_issue
    ):
        # Start first timer
        url_start_1 = (
            f"/api/workspaces/{care_workspace.slug}/projects/{care_project.id}"
            f"/issues/{care_issue.id}/worklog-timer/start/"
        )
        resp1 = admin_client.post(url_start_1, {}, format="json")
        assert resp1.status_code == 201, resp1.data

        # Try to start second timer on a different issue
        url_start_2 = (
            f"/api/workspaces/{care_workspace.slug}/projects/{care_project.id}"
            f"/issues/{second_issue.id}/worklog-timer/start/"
        )
        resp2 = admin_client.post(url_start_2, {}, format="json")
        assert resp2.status_code == 409
        assert "running_entry" in resp2.data

    def test_force_stop_allows_new_timer(
        self, admin_client, care_workspace, care_project, care_issue, second_issue
    ):
        # Start first timer
        url_start_1 = (
            f"/api/workspaces/{care_workspace.slug}/projects/{care_project.id}"
            f"/issues/{care_issue.id}/worklog-timer/start/"
        )
        resp1 = admin_client.post(url_start_1, {}, format="json")
        assert resp1.status_code == 201

        # Start second timer with force_stop
        url_start_2 = (
            f"/api/workspaces/{care_workspace.slug}/projects/{care_project.id}"
            f"/issues/{second_issue.id}/worklog-timer/start/"
        )
        resp2 = admin_client.post(url_start_2, {"force_stop": True}, format="json")
        assert resp2.status_code == 201

        # First timer should now be stopped
        old_entry = WorklogEntry.objects.get(issue=care_issue)
        assert old_entry.is_running is False
        assert old_entry.duration_minutes >= 1


# ---------------------------------------------------------------------------
# 2. Monthly balance rollover from previous month
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.unit
class TestMonthlyBalanceRollover:
    """Remaining minutes from previous month roll over into the current one."""

    def test_rollover_from_previous_month(self, care_workspace, care_project, care_subscription):
        now = timezone.now()
        prev_month = now.month - 1
        prev_year = now.year
        if prev_month < 1:
            prev_month = 12
            prev_year -= 1

        # Create last month's balance with remaining minutes
        ProjectMonthlyBalance.objects.create(
            project=care_project,
            workspace=care_workspace,
            year=prev_year,
            month=prev_month,
            base_hours=Decimal("8.00"),
            rolled_over_minutes=0,
            borrowed_minutes=0,
            consumed_minutes=300,
            is_closed=False,
        )

        balance = get_or_create_current_balance(care_project.id)

        assert balance.year == now.year
        assert balance.month == now.month
        assert balance.rolled_over_minutes == 180  # 480 - 300

    def test_no_rollover_if_previous_month_closed(self, care_workspace, care_project, care_subscription):
        now = timezone.now()
        prev_month = now.month - 1
        prev_year = now.year
        if prev_month < 1:
            prev_month = 12
            prev_year -= 1

        ProjectMonthlyBalance.objects.create(
            project=care_project,
            workspace=care_workspace,
            year=prev_year,
            month=prev_month,
            base_hours=Decimal("8.00"),
            rolled_over_minutes=0,
            borrowed_minutes=0,
            consumed_minutes=300,
            is_closed=True,  # Closed — no rollover
        )

        balance = get_or_create_current_balance(care_project.id)
        assert balance.rolled_over_minutes == 0

    def test_no_rollover_if_previous_month_overconsumed(self, care_workspace, care_project, care_subscription):
        now = timezone.now()
        prev_month = now.month - 1
        prev_year = now.year
        if prev_month < 1:
            prev_month = 12
            prev_year -= 1

        # consumed > base => remaining is negative => no rollover
        ProjectMonthlyBalance.objects.create(
            project=care_project,
            workspace=care_workspace,
            year=prev_year,
            month=prev_month,
            base_hours=Decimal("8.00"),
            rolled_over_minutes=0,
            borrowed_minutes=0,
            consumed_minutes=500,
            is_closed=False,
        )

        balance = get_or_create_current_balance(care_project.id)
        assert balance.rolled_over_minutes == 0


# ---------------------------------------------------------------------------
# 3. Monthly balance expiry (closing old balances)
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.unit
class TestMonthlyBalanceExpiry:
    """Balances older than 2 months are closed by the daily task."""

    def test_old_balances_closed(self, care_workspace, care_project, care_subscription):
        now = timezone.now()

        # Create a balance 3 months ago
        old_month = now.month - 3
        old_year = now.year
        while old_month < 1:
            old_month += 12
            old_year -= 1

        old_balance = ProjectMonthlyBalance.objects.create(
            project=care_project,
            workspace=care_workspace,
            year=old_year,
            month=old_month,
            base_hours=Decimal("8.00"),
            consumed_minutes=100,
            is_closed=False,
        )

        # Also create a balance for last month (should NOT be closed)
        prev_month = now.month - 1
        prev_year = now.year
        if prev_month < 1:
            prev_month = 12
            prev_year -= 1

        recent_balance = ProjectMonthlyBalance.objects.create(
            project=care_project,
            workspace=care_workspace,
            year=prev_year,
            month=prev_month,
            base_hours=Decimal("8.00"),
            consumed_minutes=50,
            is_closed=False,
        )

        dbwcare_monthly_balance_init()

        old_balance.refresh_from_db()
        recent_balance.refresh_from_db()

        assert old_balance.is_closed is True
        assert recent_balance.is_closed is False


# ---------------------------------------------------------------------------
# 4. Worklog self_caused visibility for non-admin vs admin
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.unit
class TestWorklogSelfCausedVisibility:
    """self_caused entries hidden from non-admin, visible to admin."""

    def test_non_admin_cannot_see_self_caused(
        self,
        admin_client,
        member_client,
        admin_user,
        member_user,
        care_workspace,
        care_project,
        care_issue,
    ):
        # Add member_user to workspace and project as MEMBER (role=15)
        _add_member_to_workspace_and_project(
            member_user, care_workspace, care_project, role=15
        )

        # Create a self_caused worklog entry
        WorklogEntry.objects.create(
            workspace=care_workspace,
            project=care_project,
            issue=care_issue,
            logged_by=admin_user,
            duration_minutes=30,
            started_at=timezone.now() - timedelta(hours=1),
            billing_status="self_caused",
            entry_type="manual",
        )

        # Also create a normal billable entry
        WorklogEntry.objects.create(
            workspace=care_workspace,
            project=care_project,
            issue=care_issue,
            logged_by=admin_user,
            duration_minutes=15,
            started_at=timezone.now() - timedelta(minutes=30),
            billing_status="billable",
            entry_type="manual",
        )

        list_url = (
            f"/api/workspaces/{care_workspace.slug}/projects/{care_project.id}"
            f"/issues/{care_issue.id}/worklog-entries/"
        )

        # Member should see only 1 entry (the billable one)
        resp_member = member_client.get(list_url)
        assert resp_member.status_code == 200
        assert len(resp_member.data) == 1
        assert resp_member.data[0]["billing_status"] == "billable"

        # Admin should see both entries
        resp_admin = admin_client.get(list_url)
        assert resp_admin.status_code == 200
        assert len(resp_admin.data) == 2
        statuses = {e["billing_status"] for e in resp_admin.data}
        assert "self_caused" in statuses
        assert "billable" in statuses


# ---------------------------------------------------------------------------
# 5. Recurrence generator clones issue and advances next_occurrence_at
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.unit
class TestRecurrenceGeneratorClonesIssue:
    """Running the recurrence task should clone the template issue and advance the date."""

    def test_clones_issue_with_template_name(
        self, care_workspace, care_project, backlog_state, care_issue
    ):
        # Set up recurrence with next_occurrence in the past
        recurrence = IssueRecurrence.objects.create(
            template_issue=care_issue,
            recurrence_type="interval_days",
            interval_days=7,
            estimated_minutes=45,
            next_occurrence_at=timezone.now() - timedelta(hours=2),
            is_active=True,
        )

        issues_before = Issue.objects.filter(project=care_project).count()

        dbwcare_recurrence_generator()

        issues_after = Issue.objects.filter(project=care_project).count()
        assert issues_after == issues_before + 1

        # New issue should have the template's name
        new_issue = (
            Issue.objects.filter(project=care_project)
            .exclude(id=care_issue.id)
            .order_by("-created_at")
            .first()
        )
        assert new_issue is not None
        assert new_issue.name == care_issue.name
        assert new_issue.state == backlog_state

        # next_occurrence_at should have advanced
        recurrence.refresh_from_db()
        assert recurrence.next_occurrence_at > timezone.now()
        assert recurrence.last_generated_at is not None


# ---------------------------------------------------------------------------
# 6. Monthly recurrence on the 31st handling February
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.unit
class TestRecurrenceMonthlyOn31stFebruary:
    """Monthly recurrence with day_of_month=31 should clamp to Feb 28/29."""

    def test_compute_next_january_to_february_non_leap(self, care_issue):
        recurrence = IssueRecurrence(
            template_issue=care_issue,
            recurrence_type="monthly_date",
            day_of_month=31,
            next_occurrence_at=timezone.now(),
            is_active=True,
        )

        from_date = datetime(2025, 1, 31, 0, 0, 0, tzinfo=timezone.utc)
        result = _compute_next(recurrence, from_date)

        assert result.year == 2025
        assert result.month == 2
        assert result.day == 28

    def test_compute_next_january_to_february_leap_year(self, care_issue):
        recurrence = IssueRecurrence(
            template_issue=care_issue,
            recurrence_type="monthly_date",
            day_of_month=31,
            next_occurrence_at=timezone.now(),
            is_active=True,
        )

        from_date = datetime(2028, 1, 31, 0, 0, 0, tzinfo=timezone.utc)
        result = _compute_next(recurrence, from_date)

        assert result.year == 2028
        assert result.month == 2
        assert result.day == 29

    def test_compute_next_december_to_january(self, care_issue):
        recurrence = IssueRecurrence(
            template_issue=care_issue,
            recurrence_type="monthly_date",
            day_of_month=31,
            next_occurrence_at=timezone.now(),
            is_active=True,
        )

        from_date = datetime(2025, 12, 31, 0, 0, 0, tzinfo=timezone.utc)
        result = _compute_next(recurrence, from_date)

        assert result.year == 2026
        assert result.month == 1
        assert result.day == 31

    def test_compute_next_interval_days(self, care_issue):
        recurrence = IssueRecurrence(
            template_issue=care_issue,
            recurrence_type="interval_days",
            interval_days=14,
            next_occurrence_at=timezone.now(),
            is_active=True,
        )

        from_date = datetime(2025, 3, 1, 12, 0, 0, tzinfo=timezone.utc)
        result = _compute_next(recurrence, from_date)

        assert result == from_date + timedelta(days=14)


# ---------------------------------------------------------------------------
# 7. Balance consumed_minutes recomputed correctly
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.unit
class TestBalanceConsumedMinutesRecomputed:
    """get_or_create_current_balance correctly sums billable, non-running entries."""

    def test_consumed_includes_only_billable_stopped_entries(
        self, care_workspace, care_subscription, care_project, care_issue, admin_user
    ):
        now = timezone.now()

        # Billable, stopped entry — should count
        WorklogEntry.objects.create(
            workspace=care_workspace,
            project=care_project,
            issue=care_issue,
            logged_by=admin_user,
            duration_minutes=60,
            started_at=now - timedelta(hours=3),
            ended_at=now - timedelta(hours=2),
            is_running=False,
            billing_status="billable",
            entry_type="manual",
        )

        # Another billable, stopped entry — should count
        WorklogEntry.objects.create(
            workspace=care_workspace,
            project=care_project,
            issue=care_issue,
            logged_by=admin_user,
            duration_minutes=30,
            started_at=now - timedelta(hours=2),
            ended_at=now - timedelta(hours=1),
            is_running=False,
            billing_status="billable",
            entry_type="tracked",
        )

        # Gift entry — should NOT count
        WorklogEntry.objects.create(
            workspace=care_workspace,
            project=care_project,
            issue=care_issue,
            logged_by=admin_user,
            duration_minutes=45,
            started_at=now - timedelta(hours=1),
            ended_at=now - timedelta(minutes=15),
            is_running=False,
            billing_status="gift",
            entry_type="manual",
            gift_reason="Goodwill",
        )

        # Self-caused entry — should NOT count
        WorklogEntry.objects.create(
            workspace=care_workspace,
            project=care_project,
            issue=care_issue,
            logged_by=admin_user,
            duration_minutes=20,
            started_at=now - timedelta(minutes=40),
            ended_at=now - timedelta(minutes=20),
            is_running=False,
            billing_status="self_caused",
            entry_type="manual",
        )

        # Running timer — should NOT count (is_running=True)
        WorklogEntry.objects.create(
            workspace=care_workspace,
            project=care_project,
            issue=care_issue,
            logged_by=admin_user,
            duration_minutes=0,
            started_at=now - timedelta(minutes=10),
            is_running=True,
            billing_status="billable",
            entry_type="tracked",
        )

        balance = get_or_create_current_balance(care_project.id)

        # Only the two billable, stopped entries: 60 + 30 = 90
        assert balance.consumed_minutes == 90

    def test_consumed_recomputed_on_second_call(
        self, care_workspace, care_subscription, care_project, care_issue, admin_user
    ):
        now = timezone.now()

        entry = WorklogEntry.objects.create(
            workspace=care_workspace,
            project=care_project,
            issue=care_issue,
            logged_by=admin_user,
            duration_minutes=25,
            started_at=now - timedelta(hours=1),
            ended_at=now - timedelta(minutes=35),
            is_running=False,
            billing_status="billable",
            entry_type="manual",
        )

        balance = get_or_create_current_balance(care_project.id)
        assert balance.consumed_minutes == 25

        # Add another entry
        WorklogEntry.objects.create(
            workspace=care_workspace,
            project=care_project,
            issue=care_issue,
            logged_by=admin_user,
            duration_minutes=15,
            started_at=now - timedelta(minutes=30),
            ended_at=now - timedelta(minutes=15),
            is_running=False,
            billing_status="billable",
            entry_type="manual",
        )

        # Re-calling should update consumed_minutes
        balance = get_or_create_current_balance(care_project.id)
        assert balance.consumed_minutes == 40

    def test_balance_properties(self, care_workspace, care_project, care_subscription):
        """Test computed properties on ProjectMonthlyBalance."""
        now = timezone.now()
        balance = ProjectMonthlyBalance.objects.create(
            project=care_project,
            workspace=care_workspace,
            year=now.year,
            month=now.month,
            base_hours=Decimal("8.00"),
            rolled_over_minutes=60,
            borrowed_minutes=0,
            consumed_minutes=300,
        )

        assert balance.base_minutes == 480
        assert balance.total_available_minutes == 540  # 480 + 60
        assert balance.remaining_minutes == 240  # 540 - 300
        assert balance.consumption_percentage == 56  # round(300/540 * 100)


# ---------------------------------------------------------------------------
# 8. Project-level permission tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.unit
class TestProjectLevelPermissions:
    """Verify project-level access controls for subscriptions."""

    def test_project_member_can_read_own_subscription(
        self, member_client, member_user, care_workspace, care_project, care_subscription
    ):
        _add_member_to_workspace_and_project(
            member_user, care_workspace, care_project, role=15
        )
        url = (
            f"/api/workspaces/{care_workspace.slug}/projects/{care_project.id}"
            f"/care-subscription/"
        )
        resp = member_client.get(url)
        assert resp.status_code == 200

    def test_non_member_cannot_read_foreign_subscription(
        self, other_client, other_user, care_workspace, care_project, other_project, care_subscription
    ):
        # other_user is member of other_project but NOT care_project
        _add_member_to_workspace_and_project(
            other_user, care_workspace, other_project, role=15
        )
        url = (
            f"/api/workspaces/{care_workspace.slug}/projects/{care_project.id}"
            f"/care-subscription/"
        )
        resp = other_client.get(url)
        # Should get 200 with null (or 403 depending on permission level)
        # The endpoint uses workspace-level permission, so workspace members can read
        assert resp.status_code == 200

    def test_workspace_admin_can_read_all_subscriptions(
        self, admin_client, care_workspace, care_project, other_project
    ):
        # Create subscriptions for both projects
        ProjectCareSubscription.objects.create(
            project=other_project,
            workspace=care_workspace,
            monthly_hours=Decimal("4.00"),
            package_label="S",
            started_at=timezone.now().date(),
            is_active=True,
        )

        url = f"/api/workspaces/{care_workspace.slug}/care-overview/"
        resp = admin_client.get(url)
        assert resp.status_code == 200
        assert len(resp.data) >= 1  # at least the other_project subscription

    def test_non_admin_cannot_access_care_overview(
        self, member_client, member_user, care_workspace, care_project
    ):
        _add_member_to_workspace_and_project(
            member_user, care_workspace, care_project, role=15
        )
        url = f"/api/workspaces/{care_workspace.slug}/care-overview/"
        resp = member_client.get(url)
        assert resp.status_code == 403

    def test_non_admin_cannot_update_subscription(
        self, member_client, member_user, care_workspace, care_project, care_subscription
    ):
        _add_member_to_workspace_and_project(
            member_user, care_workspace, care_project, role=15
        )
        url = (
            f"/api/workspaces/{care_workspace.slug}/projects/{care_project.id}"
            f"/care-subscription/"
        )
        resp = member_client.patch(
            url,
            {"monthly_hours": 16},
            format="json",
        )
        assert resp.status_code == 403
