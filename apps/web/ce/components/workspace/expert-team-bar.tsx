import { useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { useTranslation } from "@plane/i18n";
import { useCare } from "@/hooks/store/use-care";
import { useUserPermissions } from "@/hooks/store/user";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { EXPERTS_BY_ID } from "@/plane-web/constants/experts";

export const ExpertTeamBar = observer(function ExpertTeamBar() {
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const { t } = useTranslation();
  const care = useCare();
  const { allowPermissions } = useUserPermissions();

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
    <div className="fixed right-0 bottom-0 left-0 z-50 border-t border-subtle bg-layer-1/95 backdrop-blur-sm">
      <div className="flex items-center justify-center gap-6 px-4 py-3">
        <span className="text-body-xs-medium whitespace-nowrap text-tertiary">{t("dbwcare.expert_team")}</span>
        <div className="flex items-center -space-x-1">
          {experts.map((expert) => (
            <div key={expert.id} className="group relative flex flex-col items-center">
              <div className="ring-layer-1 size-11 flex-shrink-0 overflow-hidden rounded-full ring-2 transition-transform group-hover:scale-110">
                <img src={expert.image} alt={expert.name} className="size-full object-cover" />
              </div>
              <span className="text-caption-xs absolute -bottom-4 text-tertiary opacity-0 transition-opacity group-hover:opacity-100">
                {expert.name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});
