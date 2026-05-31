# DBWCARE: Add weekly_report_enabled field to ProjectCareSubscription

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0503_care_expert_ids"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectcaresubscription",
            name="weekly_report_enabled",
            field=models.BooleanField(
                default=False,
                help_text="Whether to send automatic weekly reports to the customer",
            ),
        ),
    ]
