# DBWCARE: Allow multiple customer emails + BCC field for reports

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0504_care_weekly_report"),
    ]

    operations = [
        # Change customer_email from EmailField to TextField (comma-separated)
        migrations.AlterField(
            model_name="projectcaresubscription",
            name="customer_email",
            field=models.TextField(
                blank=True,
                default="",
                help_text="Customer email addresses for report delivery (comma-separated)",
            ),
        ),
        # Add BCC field
        migrations.AddField(
            model_name="projectcaresubscription",
            name="report_bcc",
            field=models.TextField(
                blank=True,
                default="",
                help_text="BCC email addresses for report delivery (comma-separated)",
            ),
        ),
    ]
