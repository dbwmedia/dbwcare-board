# DBWCARE Monthly Balance Init Task
# Runs daily at 00:05 UTC. For every project with active subscription:
# - Creates balance for current month if not exists (with rollover)
# - Closes balances older than 2 months

import logging

from celery import shared_task
from django.utils import timezone

logger = logging.getLogger(__name__)


@shared_task
def dbwcare_monthly_balance_init():
    """
    Daily task: ensure current month balance exists for all active subscriptions.
    Also closes balances older than 2 months.
    """
    from plane.db.models import ProjectCareSubscription, ProjectMonthlyBalance
    from plane.app.views.care.balance import get_or_create_current_balance

    now = timezone.now()
    year, month = now.year, now.month

    active_subs = ProjectCareSubscription.objects.filter(is_active=True)

    for sub in active_subs:
        try:
            get_or_create_current_balance(sub.project_id)
        except Exception as e:
            logger.error(
                f"Failed to init balance for project {sub.project_id}: {e}"
            )

    # Close old balances (older than 2 months)
    close_month = month - 2
    close_year = year
    if close_month < 1:
        close_month += 12
        close_year -= 1

    ProjectMonthlyBalance.objects.filter(
        is_closed=False,
        deleted_at__isnull=True,
    ).exclude(
        year=year, month=month
    ).exclude(
        year=year if month > 1 else year - 1,
        month=month - 1 if month > 1 else 12,
    ).update(is_closed=True)

    logger.info(f"DBWCARE balance init completed for {active_subs.count()} projects")
