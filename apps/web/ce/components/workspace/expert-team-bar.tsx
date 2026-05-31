// Expert team bottom bar — visible to guests only
import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { useTranslation } from "@plane/i18n";
import { Plus } from "lucide-react";
import { useCare } from "@/hooks/store/use-care";
import { useUserPermissions } from "@/hooks/store/user";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EXPERTS_BY_ID } from "@/plane-web/constants/experts";
import { GuestCreateWizard } from "./guest-create-wizard";

export const ExpertTeamBar = observer(function ExpertTeamBar() {
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const { t } = useTranslation();
  const care = useCare();
  const { allowPermissions } = useUserPermissions();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const isGuest = !allowPermissions([EUserPermissions.ADMIN, EUserPermissions.MEMBER], EUserPermissionsLevel.WORKSPACE);

  useEffect(() => {
    if (workspaceSlug && projectId) {
      care.fetchSubscription(workspaceSlug, projectId);
    }
  }, [workspaceSlug, projectId, care]);

  const subscription = projectId ? care.getSubscription(projectId) : null;

  if (!isGuest || !subscription?.is_active) return null;

  const expertIds = subscription.expert_ids || [];
  const experts = expertIds.map((id: string) => EXPERTS_BY_ID[id]).filter(Boolean);

  if (experts.length === 0) return null;

  return (
    <div className="fixed right-0 bottom-0 left-0 z-50 bg-white/70 backdrop-blur-xl dark:bg-neutral-900/70">
      <div className="mx-auto flex max-w-screen-xl items-center justify-between px-5 py-2.5">
        {/* Left: Expert team */}
        <div className="flex items-center gap-3">
          <div>
            <p className="text-body-xs-medium font-bold text-primary">{t("dbwcare.expert_team_title")}</p>
            <p className="text-caption-xs text-tertiary">{t("dbwcare.expert_team_subtitle")}</p>
          </div>
          <div className="flex items-center -space-x-2">
            {experts.map((expert) => (
              <div
                key={expert.id}
                className="relative size-9 flex-shrink-0 overflow-hidden rounded-full ring-2 ring-white transition-transform hover:z-10 hover:scale-110 dark:ring-neutral-900"
                title={expert.name}
              >
                <img src={expert.image} alt={expert.name} className="size-full object-cover" />
              </div>
            ))}
          </div>
        </div>

        {/* Right: New task button */}
        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          className="flex items-center gap-1.5 rounded-md bg-gradient-to-r from-[#ea2b1f] via-[#ff4fdd] to-[#7e56ff] px-4 py-2 text-body-xs-medium font-medium text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <Plus className="size-3.5" />
          {t("sidebar.new_work_item")}
        </button>
      </div>
      <GuestCreateWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </div>
  );
});
