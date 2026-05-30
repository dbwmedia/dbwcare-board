# DBWCARE: Add expert_ids field to ProjectCareSubscription

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0502_care_report_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectcaresubscription",
            name="expert_ids",
            field=models.JSONField(
                blank=True,
                default=list,
                help_text='List of expert identifiers assigned to this customer, e.g. ["dennis", "robin", "lara"]',
            ),
        ),
    ]
