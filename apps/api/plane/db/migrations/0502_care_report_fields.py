# DBWCARE: Add customer contact and report fields to ProjectCareSubscription

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0501_dbwcare_project_level"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectcaresubscription",
            name="customer_name",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Customer display name for reports (e.g. company name)",
                max_length=200,
            ),
        ),
        migrations.AddField(
            model_name="projectcaresubscription",
            name="customer_email",
            field=models.EmailField(
                blank=True,
                default="",
                help_text="Customer email address for monthly report delivery",
                max_length=254,
            ),
        ),
        migrations.AddField(
            model_name="projectcaresubscription",
            name="report_enabled",
            field=models.BooleanField(
                default=True,
                help_text="Whether to send automatic monthly reports to the customer",
            ),
        ),
    ]
