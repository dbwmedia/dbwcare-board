# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Python imports
import os
import logging

# Third party imports
from celery import Celery
from pythonjsonlogger.jsonlogger import JsonFormatter
from celery.signals import after_setup_logger, after_setup_task_logger
from celery.schedules import crontab

# Module imports
from plane.settings.redis import redis_instance

# Set the default Django settings module for the 'celery' program.
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "plane.settings.production")

ri = redis_instance()

app = Celery("plane")

# Using a string here means the worker will not have to
# pickle the object when using Windows.
app.config_from_object("django.conf:settings", namespace="CELERY")

app.conf.beat_schedule = {
    # Intra day recurring jobs
    "check-every-five-minutes-to-send-email-notifications": {
        "task": "plane.bgtasks.email_notification_task.stack_email_notification",
        "schedule": crontab(minute="*/5"),  # Every 5 minutes
    },
    "run-every-6-hours-for-instance-trace": {
        "task": "plane.license.bgtasks.tracer.instance_traces",
        "schedule": crontab(hour="*/6", minute=0),  # Every 6 hours
    },
    # Occurs once every day
    "check-every-day-to-delete-hard-delete": {
        "task": "plane.bgtasks.deletion_task.hard_delete",
        "schedule": crontab(hour=0, minute=0),  # UTC 00:00
    },
    "check-every-day-to-archive-and-close": {
        "task": "plane.bgtasks.issue_automation_task.archive_and_close_old_issues",
        "schedule": crontab(hour=1, minute=0),  # UTC 01:00
    },
    "check-every-day-to-delete_exporter_history": {
        "task": "plane.bgtasks.exporter_expired_task.delete_old_s3_link",
        "schedule": crontab(hour=1, minute=30),  # UTC 01:30
    },
    "check-every-day-to-delete-file-asset": {
        "task": "plane.bgtasks.file_asset_task.delete_unuploaded_file_asset",
        "schedule": crontab(hour=2, minute=0),  # UTC 02:00
    },
    "check-every-day-to-delete-api-logs": {
        "task": "plane.bgtasks.cleanup_task.delete_api_logs",
        "schedule": crontab(hour=2, minute=30),  # UTC 02:30
    },
    "check-every-day-to-delete-email-notification-logs": {
        "task": "plane.bgtasks.cleanup_task.delete_email_notification_logs",
        "schedule": crontab(hour=2, minute=45),  # UTC 02:45
    },
    "check-every-day-to-delete-page-versions": {
        "task": "plane.bgtasks.cleanup_task.delete_page_versions",
        "schedule": crontab(hour=3, minute=0),  # UTC 03:00
    },
    "check-every-day-to-delete-issue-description-versions": {
        "task": "plane.bgtasks.cleanup_task.delete_issue_description_versions",
        "schedule": crontab(hour=3, minute=15),  # UTC 03:15
    },
    "check-every-day-to-delete-webhook-logs": {
        "task": "plane.bgtasks.cleanup_task.delete_webhook_logs",
        "schedule": crontab(hour=3, minute=30),  # UTC 03:30
    },
    "check-every-day-to-delete-exporter-history": {
        "task": "plane.bgtasks.exporter_expired_task.delete_old_s3_link",
        "schedule": crontab(hour=3, minute=45),  # UTC 03:45
    },
    # DBWCARE tasks
    "dbwcare-monthly-balance-init": {
        "task": "plane.bgtasks.dbwcare_balance_task.dbwcare_monthly_balance_init",
        "schedule": crontab(hour=0, minute=5),  # UTC 00:05
    },
    "dbwcare-recurrence-generator": {
        "task": "plane.bgtasks.dbwcare_recurrence_task.dbwcare_recurrence_generator",
        "schedule": crontab(hour=0, minute=15),  # UTC 00:15
    },
    "dbwcare-monthly-report": {
        "task": "plane.bgtasks.dbwcare_monthly_report_task.dbwcare_monthly_report",
        "schedule": crontab(day_of_month=2, hour=8, minute=0),  # 2nd of month, 08:00 UTC
    },
    "dbwcare-weekly-report": {
        "task": "plane.bgtasks.dbwcare_weekly_report_task.dbwcare_weekly_report",
        "schedule": crontab(day_of_week=1, hour=8, minute=0),  # Monday, 08:00 UTC
    },
}


# Setup logging
@after_setup_logger.connect
def setup_loggers(logger, *args, **kwargs):
    formatter = JsonFormatter('"%(levelname)s %(asctime)s %(module)s %(name)s %(message)s')
    handler = logging.StreamHandler()
    handler.setFormatter(fmt=formatter)
    logger.addHandler(handler)


@after_setup_task_logger.connect
def setup_task_loggers(logger, *args, **kwargs):
    formatter = JsonFormatter('"%(levelname)s %(asctime)s %(module)s %(name)s %(message)s')
    handler = logging.StreamHandler()
    handler.setFormatter(fmt=formatter)
    logger.addHandler(handler)


# Load task modules from all registered Django app configs.
app.autodiscover_tasks()

# Ensure DBWCARE scheduled tasks are registered in the worker.
# autodiscover_tasks() only finds tasks.py inside INSTALLED_APPS.
# app.conf.include tells Celery to import these modules after Django is ready.
app.conf.include = [
    "plane.bgtasks.dbwcare_balance_task",
    "plane.bgtasks.dbwcare_recurrence_task",
    "plane.bgtasks.dbwcare_monthly_report_task",
    "plane.bgtasks.dbwcare_weekly_report_task",
    "plane.bgtasks.dbwcare_guest_issue_notification_task",
    "plane.bgtasks.dbwcare_guest_issue_confirmation_task",
    "plane.bgtasks.dbwcare_quota_exhausted_task",
]

app.conf.beat_scheduler = "django_celery_beat.schedulers.DatabaseScheduler"
