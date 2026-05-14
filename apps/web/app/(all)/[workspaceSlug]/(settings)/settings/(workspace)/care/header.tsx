import { useTranslation } from "@plane/i18n";

export default function CareSettingsHeader() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center border-b border-subtle px-6 py-4">
      <h3 className="text-xl font-medium">{t("dbwcare.care_settings")}</h3>
    </div>
  );
}
