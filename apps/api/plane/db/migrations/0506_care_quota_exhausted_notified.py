# DBWCARE: Track whether quota-exhausted notification was sent

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("db", "0505_care_multi_email_bcc"),
    ]

    operations = [
        migrations.AddField(
            model_name="projectmonthlybalance",
            name="quota_exhausted_notified",
            field=models.BooleanField(
                default=False,
                help_text="Whether the customer was notified that the monthly quota is exhausted",
            ),
        ),
    ]
