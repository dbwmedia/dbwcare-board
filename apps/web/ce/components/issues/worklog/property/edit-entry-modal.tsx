import { useEffect, useState } from "react";
import { observer } from "mobx-react";
import { useTranslation } from "@plane/i18n";
import { Button, Input, ModalCore } from "@plane/ui";
import { useCare } from "@/hooks/store/use-care";
import type { IWorklogEntry } from "@plane/types";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  entry: IWorklogEntry | null;
  workspaceSlug: string;
  projectId: string;
  issueId: string;
};

export const WorklogEditEntryModal = observer(function WorklogEditEntryModal(props: Props) {
  const { isOpen, onClose, entry, workspaceSlug, projectId, issueId } = props;
  const { t } = useTranslation();
  const care = useCare();
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [description, setDescription] = useState("");
  const [billingStatus, setBillingStatus] = useState<"billable" | "gift">("billable");
  const [giftReason, setGiftReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (entry) {
      const h = Math.floor(entry.duration_minutes / 60);
      const m = entry.duration_minutes % 60;
      setHours(h > 0 ? String(h) : "");
      setMinutes(m > 0 ? String(m) : "");
      setDescription(entry.description);
      setBillingStatus(entry.billing_status === "gift" ? "gift" : "billable");
      setGiftReason(entry.gift_reason || "");
      setError("");
    }
  }, [entry]);

  const handleSubmit = async () => {
    if (!entry) return;
    const h = parseInt(hours || "0", 10);
    const m = parseInt(minutes || "0", 10);
    const totalMinutes = h * 60 + m;

    if (totalMinutes <= 0) {
      setError(t("dbwcare.duration_required"));
      return;
    }
    if (description.trim().length < 3) {
      setError(t("dbwcare.description_min_length"));
      return;
    }

    setIsSubmitting(true);
    try {
      await care.updateWorklogEntry(workspaceSlug, projectId, issueId, entry.id, {
        duration_minutes: totalMinutes,
        description: description.trim(),
        billing_status: billingStatus,
        gift_reason: billingStatus === "gift" ? giftReason.trim() : "",
      });
      onClose();
    } catch {
      setError(t("dbwcare.save_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ModalCore isOpen={isOpen} handleClose={() => {}}>
      <div className="p-5">
        <h3 className="text-lg font-medium">{t("dbwcare.edit_entry")}</h3>

        <div className="mt-4 space-y-3">
          {/* Duration */}
          <div>
            <label className="text-body-xs-medium text-tertiary">{t("dbwcare.duration")}</label>
            <div className="mt-1 flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Input
                  id="edit-hours"
                  name="hours"
                  type="number"
                  placeholder="0"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  min={0}
                  className="w-16"
                />
                <span className="text-body-xs-regular text-tertiary">h</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  id="edit-minutes"
                  name="minutes"
                  type="number"
                  placeholder="0"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  min={0}
                  max={59}
                  className="w-16"
                />
                <span className="text-body-xs-regular text-tertiary">min</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="text-body-xs-medium text-tertiary">{t("dbwcare.description")}</label>
            <Input
              id="edit-description"
              name="description"
              placeholder={t("dbwcare.description_placeholder")}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (error) setError("");
              }}
              className="mt-1 w-full"
            />
          </div>

          {/* Billing status */}
          <div>
            <label className="text-body-xs-medium text-tertiary">{t("dbwcare.billing_status")}</label>
            <div className="mt-1 flex items-center gap-3">
              <label className="flex cursor-pointer items-center gap-1.5 text-body-xs-regular">
                <input
                  type="radio"
                  name="edit_billing_status"
                  value="billable"
                  checked={billingStatus === "billable"}
                  onChange={() => setBillingStatus("billable")}
                  className="accent-primary"
                />
                {t("dbwcare.billable")}
              </label>
              <label className="flex cursor-pointer items-center gap-1.5 text-body-xs-regular">
                <input
                  type="radio"
                  name="edit_billing_status"
                  value="gift"
                  checked={billingStatus === "gift"}
                  onChange={() => setBillingStatus("gift")}
                  className="accent-primary"
                />
                {t("dbwcare.gift")}
              </label>
            </div>
          </div>

          {/* Gift reason */}
          {billingStatus === "gift" && (
            <div>
              <label className="text-body-xs-medium text-tertiary">{t("dbwcare.gift_reason")}</label>
              <Input
                id="edit-gift-reason"
                name="gift_reason"
                placeholder={t("dbwcare.gift_reason_placeholder")}
                value={giftReason}
                onChange={(e) => setGiftReason(e.target.value)}
                className="mt-1 w-full"
              />
            </div>
          )}

          {error && <p className="text-body-xs-regular text-danger-primary">{error}</p>}
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="neutral-primary" size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={isSubmitting}>
            {t("dbwcare.save_changes")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
