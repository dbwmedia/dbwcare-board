# DBWCARE stats for the DBW OS cockpit.

from django.urls import path

from plane.api.views import CareStatsAPIEndpoint, CareTimerAPIEndpoint

urlpatterns = [
    path(
        "workspaces/<str:slug>/care-stats/",
        CareStatsAPIEndpoint.as_view(http_method_names=["get"]),
        name="care-stats",
    ),
    path(
        "workspaces/<str:slug>/care-timer/",
        CareTimerAPIEndpoint.as_view(http_method_names=["get", "post"]),
        name="care-timer",
    ),
]
