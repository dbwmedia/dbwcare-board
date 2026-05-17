/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { UserPlus } from "lucide-react";
// plane imports
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Button } from "@plane/ui";
// components
import { NotAuthorizedView } from "@/components/auth-screens/not-authorized-view";
import { PageHead } from "@/components/core/page-title";
import { ProjectMemberList } from "@/components/project/member-list";
import { ProjectSettingsMemberDefaults } from "@/components/project/project-settings-member-defaults";
import { SettingsContentWrapper } from "@/components/settings/content-wrapper";
import { SettingsHeading } from "@/components/settings/heading";
// hooks
import { useMember } from "@/hooks/store/use-member";
import { useProject } from "@/hooks/store/use-project";
import { useUserPermissions } from "@/hooks/store/user";
// plane web imports
import { ProvisionCustomerModal } from "@/plane-web/components/projects/provision-customer-modal";
import { ProjectTeamspaceList } from "@/plane-web/components/projects/teamspaces/teamspace-list";
// local imports
import type { Route } from "./+types/page";
import { MembersProjectSettingsHeader } from "./header";

function MembersSettingsPage({ params }: Route.ComponentProps) {
  // router
  const { workspaceSlug, projectId } = params;
  // plane hooks
  const { t } = useTranslation();
  // store hooks
  const { currentProjectDetails } = useProject();
  const { workspaceUserInfo, allowPermissions } = useUserPermissions();
  const {
    project: { fetchProjectMembers },
    workspace: { fetchWorkspaceMembers },
  } = useMember();
  // local state
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  // derived values
  const pageTitle = currentProjectDetails?.name ? `${currentProjectDetails?.name} - Members` : undefined;
  const isProjectMemberOrAdmin = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.PROJECT
  );
  const isWorkspaceAdmin = allowPermissions([EUserPermissions.ADMIN], EUserPermissionsLevel.WORKSPACE);
  const canPerformProjectMemberActions = isProjectMemberOrAdmin || isWorkspaceAdmin;

  if (workspaceUserInfo && !canPerformProjectMemberActions) {
    return <NotAuthorizedView section="settings" isProjectView className="h-auto" />;
  }

  return (
    <SettingsContentWrapper header={<MembersProjectSettingsHeader />} hugging>
      <PageHead title={pageTitle} />
      <div className="flex items-center justify-between">
        <SettingsHeading title={t("common.members")} />
        {isWorkspaceAdmin && (
          <Button
            variant="primary"
            size="sm"
            prependIcon={<UserPlus className="size-3.5" />}
            onClick={() => setIsProvisionModalOpen(true)}
          >
            {t("dbwcare.provision_customer")}
          </Button>
        )}
      </div>
      <ProjectSettingsMemberDefaults projectId={projectId} workspaceSlug={workspaceSlug} />
      <ProjectTeamspaceList projectId={projectId} workspaceSlug={workspaceSlug} />
      <ProjectMemberList projectId={projectId} workspaceSlug={workspaceSlug} />
      {isWorkspaceAdmin && (
        <ProvisionCustomerModal
          isOpen={isProvisionModalOpen}
          onClose={() => setIsProvisionModalOpen(false)}
          onSuccess={async () => {
            await fetchWorkspaceMembers(workspaceSlug);
            await fetchProjectMembers(workspaceSlug, projectId);
          }}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
        />
      )}
    </SettingsContentWrapper>
  );
}

export default observer(MembersSettingsPage);
