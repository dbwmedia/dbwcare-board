import { useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { Button, Input, ModalCore } from "@plane/ui";
import { useCare } from "@/hooks/store/use-care";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

export const WorklogTimerStopModal = observer(function WorklogTimerStopModal(props: Props) {
  const { isOpen, onClose, workspaceSlug, projectId, issueId } = props;
  const { t } = useTranslation();
  const care = useCare();
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleStop = async () => {
    if (description.trim().length < 3) {
      setError(t("dbwcare.description_min_length"));
      return;
    }
    setIsSubmitting(true);
    try {
      await care.stopTimer(workspaceSlug, projectId, issueId, description.trim());
      setDescription("");
      setError("");
      onClose();
    } catch {
      setError(t("dbwcare.stop_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={() => {}}>
      <div className="p-5">
        <h3 className="text-lg font-medium">{t("dbwcare.stop_timer")}</h3>
        <p className="mt-1 text-body-sm-regular text-tertiary">
          {t("dbwcare.stop_timer_description")}
        </p>
        <div className="mt-4">
          <Input
            id="worklog-description"
            name="description"
            placeholder={t("dbwcare.description_placeholder")}
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              if (error) setError("");
            }}
            className="w-full"
          />
          {error && <p className="mt-1 text-body-xs-regular text-danger-primary">{error}</p>}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="neutral-primary" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleStop}
            loading={isSubmitting}
          >
            {t("dbwcare.stop_and_save")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
