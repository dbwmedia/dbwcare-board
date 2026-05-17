import { useState, useCallback, useEffect } from "react";
import { observer } from "mobx-react";
import { RefreshCw, Copy, Check, AlertTriangle } from "lucide-react";
import { useTranslation } from "@plane/i18n";
import { Button, Input, ModalCore } from "@plane/ui";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import careService from "@/plane-web/services/care.service";

// Characters without ambiguous glyphs (0/O, l/I/1)
const CHARSET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generatePassword(length = 14): string {
  const parts: string[] = [];
  for (let i = 0; i < length; i++) {
    if (i > 0 && i % 4 === 0) parts.push("-");
    parts.push(CHARSET[Math.floor(Math.random() * CHARSET.length)]);
  }
  return parts.join("");
}

type Props = {
  isOpen: boolean;
  onClose: () => void;
  workspaceSlug: string;
  projectId: string;
};

type SuccessData = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
};

export const ProvisionCustomerModal = observer(function ProvisionCustomerModal(props: Props) {
  const { isOpen, onClose, workspaceSlug, projectId } = props;
  const { t } = useTranslation();

  // Form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [manualPassword, setManualPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Success state
  const [successData, setSuccessData] = useState<SuccessData | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword(generatePassword());
      setManualPassword(false);
      setFieldErrors({});
      setSuccessData(null);
      setCopied(false);
    }
  }, [isOpen]);

  const handleRegenerate = useCallback(() => {
    setPassword(generatePassword());
  }, []);

  const handleSubmit = async () => {
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      await careService.provisionCustomer(workspaceSlug, projectId, {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        password,
      });

      setSuccessData({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });
    } catch (err: any) {
      const data = err?.response?.data;
      if (data && typeof data === "object" && !data.error) {
        setFieldErrors(data);
      } else {
        const message = data?.error || t("dbwcare.save_error");
        setToast({ type: TOAST_TYPE.ERROR, title: message });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyAll = async () => {
    if (!successData) return;
    const text = `Hallo ${successData.firstName},

hier sind deine Zugangsdaten für unser Projekt-Board:

URL:      care.dbw-media.de
E-Mail:   ${successData.email}
Passwort: ${successData.password}

Du kannst das Passwort jederzeit unter Profil-Einstellungen ändern.`;

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    // Clear password from memory
    setPassword("");
    setSuccessData(null);
    onClose();
  };

  // Success state
  if (successData) {
    return (
      <ModalCore isOpen={isOpen} handleClose={handleClose}>
        <div className="max-w-md p-5">
          <div className="flex items-center gap-2 text-success-primary">
            <Check className="size-5" />
            <h3 className="text-lg font-medium">{t("dbwcare.provision_success")}</h3>
          </div>

          <p className="mt-3 text-body-sm-regular text-secondary">
            {successData.firstName} {successData.lastName} {t("dbwcare.provision_can_login")}
          </p>

          <div className="font-mono mt-4 space-y-1 rounded-md border border-subtle bg-layer-1 p-3 text-body-xs-regular">
            <div>
              <span className="text-tertiary">URL:</span> <span>care.dbw-media.de</span>
            </div>
            <div>
              <span className="text-tertiary">E-Mail:</span> <span>{successData.email}</span>
            </div>
            <div>
              <span className="text-tertiary">Passwort:</span> <span>{successData.password}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-1 text-body-xs-regular text-warning-primary">
              <AlertTriangle className="size-3.5" />
              <span>{t("dbwcare.provision_credentials_warning")}</span>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-2">
            <Button variant="neutral-primary" size="sm" onClick={handleCopyAll}>
              {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              <span className="ml-1">{t("dbwcare.provision_copy_all")}</span>
            </Button>
            <Button variant="primary" size="sm" onClick={handleClose}>
              {t("dbwcare.provision_done")}
            </Button>
          </div>
        </div>
      </ModalCore>
    );
  }

  // Form state
  return (
    <ModalCore isOpen={isOpen} handleClose={handleClose}>
      <div className="max-w-md p-5">
        <h3 className="text-lg font-medium">{t("dbwcare.provision_title")}</h3>

        <div className="mt-4 space-y-3">
          {/* First name */}
          <div>
            <label className="text-body-xs-medium text-tertiary">{t("dbwcare.provision_first_name")} *</label>
            <Input
              id="provision-first-name"
              name="first_name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="mt-1 w-full"
              hasError={!!fieldErrors.first_name}
            />
            {fieldErrors.first_name && (
              <p className="mt-0.5 text-body-xs-regular text-danger-primary">{fieldErrors.first_name}</p>
            )}
          </div>

          {/* Last name */}
          <div>
            <label className="text-body-xs-medium text-tertiary">{t("dbwcare.provision_last_name")} *</label>
            <Input
              id="provision-last-name"
              name="last_name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="mt-1 w-full"
              hasError={!!fieldErrors.last_name}
            />
            {fieldErrors.last_name && (
              <p className="mt-0.5 text-body-xs-regular text-danger-primary">{fieldErrors.last_name}</p>
            )}
          </div>

          {/* Email */}
          <div>
            <label className="text-body-xs-medium text-tertiary">{t("dbwcare.provision_email")} *</label>
            <Input
              id="provision-email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full"
              hasError={!!fieldErrors.email}
            />
            {fieldErrors.email && (
              <p className="mt-0.5 text-body-xs-regular text-danger-primary">{fieldErrors.email}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="text-body-xs-medium text-tertiary">{t("dbwcare.provision_password")} *</label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                id="provision-password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="font-mono flex-1"
                readOnly={!manualPassword}
                hasError={!!fieldErrors.password}
              />
              <button
                type="button"
                onClick={handleRegenerate}
                className="rounded p-1.5 text-tertiary transition-colors hover:bg-layer-transparent-hover hover:text-primary"
                title={t("dbwcare.provision_regenerate")}
              >
                <RefreshCw className="size-4" />
              </button>
            </div>
            {fieldErrors.password && (
              <p className="mt-0.5 text-body-xs-regular text-danger-primary">{fieldErrors.password}</p>
            )}
            <label className="mt-2 flex cursor-pointer items-center gap-1.5 text-body-xs-regular text-tertiary">
              <input
                type="checkbox"
                checked={manualPassword}
                onChange={(e) => setManualPassword(e.target.checked)}
                className="accent-primary"
              />
              {t("dbwcare.provision_manual_password")}
            </label>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="neutral-primary" size="sm" onClick={handleClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" onClick={handleSubmit} loading={isSubmitting}>
            {t("dbwcare.provision_create")}
          </Button>
        </div>
      </div>
    </ModalCore>
  );
});
