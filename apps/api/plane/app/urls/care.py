# DBWCARE URL patterns — Project Level

from django.urls import path

from plane.app.views import (
    ProjectCareSubscriptionEndpoint,
    ProjectCareBalanceEndpoint,
    ProjectCareBalanceHistoryEndpoint,
    ProjectCareMonthWorklogsEndpoint,
    CareOverviewEndpoint,
    WorklogEntryViewSet,
    WorklogTimerStartEndpoint,
    WorklogTimerStopEndpoint,
    ActiveTimerEndpoint,
    IssueRecurrenceEndpoint,
    ProvisionCustomerEndpoint,
    CareReportSendEndpoint,
)

urlpatterns = [
    # Project-level subscription
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/care-subscription/",
        ProjectCareSubscriptionEndpoint.as_view(),
        name="care-subscription",
    ),
    # Project-level balance
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/care-balance/",
        ProjectCareBalanceEndpoint.as_view(),
        name="care-balance",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/care-balance/history/",
        ProjectCareBalanceHistoryEndpoint.as_view(),
        name="care-balance-history",
    ),
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/care-balance/<int:year>/<int:month>/worklogs/",
        ProjectCareMonthWorklogsEndpoint.as_view(),
        name="care-month-worklogs",
    ),
    # Workspace-level admin overview (Mission Control)
    path(
        "workspaces/<str:slug>/care-overview/",
        CareOverviewEndpoint.as_view(),
        name="care-overview",
    ),
    # Worklog entries (unchanged URL structure)
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
    # Direct customer provisioning
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/provision-customer/",
        ProvisionCustomerEndpoint.as_view(),
        name="provision-customer",
    ),
    # Manual report trigger
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/care-report/send/",
        CareReportSendEndpoint.as_view(),
        name="care-report-send",
    ),
    # Recurrence
    path(
        "workspaces/<str:slug>/projects/<uuid:project_id>/issues/<uuid:issue_id>/recurrence/",
        IssueRecurrenceEndpoint.as_view(),
        name="issue-recurrence",
    ),
]
