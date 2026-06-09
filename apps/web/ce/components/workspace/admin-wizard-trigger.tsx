// Floating button for admins/members to open the Guest Create Wizard
// Allows the team to create structured tasks on behalf of customers
import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { Wand2 } from "lucide-react";
import { EUserPermissions, EUserPermissionsLevel } from "@plane/constants";
import { useUserPermissions } from "@/hooks/store/user";
import { GuestCreateWizard } from "./guest-create-wizard";

export const AdminWizardTrigger = observer(function AdminWizardTrigger() {
  const { projectId } = useParams<{ projectId: string }>();
  const { allowPermissions } = useUserPermissions();
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const isAdminOrMember = allowPermissions(
    [EUserPermissions.ADMIN, EUserPermissions.MEMBER],
    EUserPermissionsLevel.WORKSPACE
  );

  // Only show for admins/members inside a project
  if (!isAdminOrMember || !projectId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setIsWizardOpen(true)}
        title="Kunden-Wizard: Aufgabe im Kundenformat erstellen"
        className="fixed right-5 bottom-5 z-20 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium text-white shadow-lg transition-all hover:shadow-xl hover:brightness-110 active:scale-95"
        style={{
          background: "linear-gradient(135deg, #ea2b1f, #ff3c6f, #ff4fdd, #7e56ff, #00b2ff)",
        }}
      >
        <Wand2 className="size-4" />
        <span>Kunden-Wizard</span>
      </button>
      <GuestCreateWizard isOpen={isWizardOpen} onClose={() => setIsWizardOpen(false)} />
    </>
  );
});
