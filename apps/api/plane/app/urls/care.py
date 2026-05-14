# DBWCARE URL patterns

from django.urls import path

from plane.app.views import (
    WorkspaceCareSubscriptionEndpoint,
    WorkspaceCareBalanceEndpoint,
    WorkspaceCareBalanceHistoryEndpoint,
    WorklogEntryViewSet,
    WorklogTimerStartEndpoint,
    WorklogTimerStopEndpoint,
    ActiveTimerEndpoint,
    IssueRecurrenceEndpoint,
)

urlpatterns = [
    # Subscription
    path(
        "workspaces/<str:slug>/care-subscription/",
        WorkspaceCareSubscriptionEndpoint.as_view(),
        name="care-subscription",
    ),
    # Balance
    path(
        "workspaces/<str:slug>/care-balance/",
        WorkspaceCareBalanceEndpoint.as_view(),
        name="care-balance",
    ),
    path(
        "workspaces/<str:slug>/care-balance/history/",
        WorkspaceCareBalanceHistoryEndpoint.as_view(),
        name="care-balance-history",
    ),
    # Worklog entries
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/worklog-entries/",
        WorklogEntryViewSet.as_view({"get": "list", "post": "create"}),
        name="worklog-entries",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/worklog-entries/<uuid:pk>/",
        WorklogEntryViewSet.as_view({"patch": "partial_update", "delete": "destroy"}),
        name="worklog-entry-detail",
    ),
    # Timer
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/worklog-timer/start/",
        WorklogTimerStartEndpoint.as_view(),
        name="worklog-timer-start",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/worklog-timer/stop/",
        WorklogTimerStopEndpoint.as_view(),
        name="worklog-timer-stop",
    ),
    path(
        "workspaces/<str:slug>/active-timer/",
        ActiveTimerEndpoint.as_view(),
        name="active-timer",
    ),
    # Recurrence
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/recurrence/",
        IssueRecurrenceEndpoint.as_view(),
        name="issue-recurrence",
    ),
]
