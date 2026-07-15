# DBWCARE stats for the DBW OS cockpit.

from django.urls import path

from plane.api.views import CareStatsAPIEndpoint

urlpatterns = [
    path(
        "workspaces/<str:slug>/care-stats/",
        CareStatsAPIEndpoint.as_view(http_method_names=["get"]),
        name="care-stats",
    ),
]
