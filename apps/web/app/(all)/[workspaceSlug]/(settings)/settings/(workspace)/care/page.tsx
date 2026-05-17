import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams, Link } from "react-router";
import { useTranslation } from "@plane/i18n";
import { ArrowUpDown, ArrowRight } from "lucide-react";
import { useCare } from "@/hooks/store/use-care";
import { useUserPermissions } from "@/hooks/store/user";
import type { ICareOverviewItem } from "@plane/types";

const formatMinutes = (minutes: number) => {
  const abs = Math.abs(minutes);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  const sign = minutes < 0 ? "-" : "";
  if (h === 0) return `${sign}${m}min`;
  return `${sign}${h}h ${m}min`;
};

type SortKey = "project_name" | "consumption_percentage" | "remaining_minutes";

const CareOverviewPage = observer(function CareOverviewPage() {
  const { workspaceSlug } = useParams<{ workspaceSlug: string }>();
  const { t } = useTranslation();
  const care = useCare();
  const { getWorkspaceRoleByWorkspaceSlug } = useUserPermissions();

  const [sortKey, setSortKey] = useState<SortKey>("consumption_percentage");
  const [sortAsc, setSortAsc] = useState(false);

  const userRole = getWorkspaceRoleByWorkspaceSlug(workspaceSlug || "");
  const isAdmin = userRole === 20;

  useEffect(() => {
    if (workspaceSlug && isAdmin) {
      care.fetchCareOverview(workspaceSlug);
    }
  }, [workspaceSlug, isAdmin, care]);

  if (!isAdmin) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-tertiary">{t("dbwcare.managed_by_team")}</p>
      </div>
    );
  }

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(key === "project_name");
    }
  };

  const sortedOverview = [...care.overview].toSorted((a, b) => {
    // Always keep inactive projects at the bottom
    if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
    if (!a.has_subscription && !b.has_subscription) return a.project_name.localeCompare(b.project_name);
    if (!a.has_subscription) return 1;
    if (!b.has_subscription) return -1;

    let cmp = 0;
    if (sortKey === "project_name") {
      cmp = a.project_name.localeCompare(b.project_name);
    } else {
      cmp = (a[sortKey] ?? 0) - (b[sortKey] ?? 0);
    }
    return sortAsc ? cmp : -cmp;
  });

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-6">
      <div className="max-w-4xl space-y-6">
        <h4 className="text-lg font-medium">{t("dbwcare.mission_control")}</h4>
        <p className="text-body-sm-regular text-tertiary">{t("dbwcare.mission_control_desc")}</p>

        {sortedOverview.length === 0 ? (
          <div className="rounded-lg border border-subtle p-8 text-center text-tertiary">
            {t("dbwcare.no_projects")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-body-sm-regular">
              <thead>
                <tr className="border-b border-subtle text-left text-tertiary">
                  <th className="py-2 pr-4">
                    <button
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={() => toggleSort("project_name")}
                    >
                      {t("dbwcare.project")}
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="py-2 pr-4">{t("dbwcare.package_label")}</th>
                  <th className="py-2 pr-4">{t("dbwcare.monthly_hours")}</th>
                  <th className="py-2 pr-4">{t("dbwcare.consumed")}</th>
                  <th className="py-2 pr-4">
                    <button
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={() => toggleSort("remaining_minutes")}
                    >
                      {t("dbwcare.remaining")}
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                  <th className="py-2 pr-4">
                    <button
                      className="flex items-center gap-1 hover:text-primary"
                      onClick={() => toggleSort("consumption_percentage")}
                    >
                      {t("dbwcare.utilization")}
                      <ArrowUpDown className="size-3" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedOverview.map((item) => (
                  <ProjectRow key={item.project_id} item={item} workspaceSlug={workspaceSlug!} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
});

function ProjectRow({ item, workspaceSlug }: { item: ICareOverviewItem; workspaceSlug: string }) {
  const { t } = useTranslation();
  const careSettingsUrl = `/${workspaceSlug}/settings/projects/${item.project_id}/care`;

  if (!item.has_subscription) {
    return (
      <tr className="border-b border-subtle">
        <td className="py-2 pr-4">
          <span className="font-medium text-tertiary">{item.project_name}</span>
        </td>
        <td colSpan={4} className="py-2 pr-4">
          <span className="text-body-xs-regular text-tertiary">{t("dbwcare.no_subscription_yet")}</span>
        </td>
        <td className="py-2 pr-4">
          <Link
            to={careSettingsUrl}
            className="inline-flex items-center gap-1 text-body-xs-medium text-primary hover:underline"
          >
            {t("dbwcare.activate")}
            <ArrowRight className="size-3" />
          </Link>
        </td>
      </tr>
    );
  }

  const pct = item.consumption_percentage;
  let barColor = "bg-green-500";
  if (pct >= 90) barColor = "bg-red-500";
  else if (pct >= 75) barColor = "bg-yellow-500";

  return (
    <tr className="border-b border-subtle hover:bg-layer-transparent-hover">
      <td className="py-2 pr-4">
        <Link to={careSettingsUrl} className="font-medium text-primary hover:underline">
          {item.project_name}
        </Link>
      </td>
      <td className="py-2 pr-4">{item.package_label || "-"}</td>
      <td className="py-2 pr-4">{item.monthly_hours}h</td>
      <td className="py-2 pr-4">{formatMinutes(item.consumed_minutes)}</td>
      <td className="py-2 pr-4">{formatMinutes(item.remaining_minutes)}</td>
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <div className="h-2 w-20 rounded-full bg-layer-3">
            <div
              className={`h-full rounded-full ${barColor} transition-all duration-300`}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
          </div>
          <span className="text-body-xs-regular text-tertiary">{pct}%</span>
        </div>
      </td>
    </tr>
  );
}

export default CareOverviewPage;
