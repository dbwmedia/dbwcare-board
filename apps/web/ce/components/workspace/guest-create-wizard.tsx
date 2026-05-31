// Guest-friendly multi-step issue creation wizard
// Replaces the standard create-issue modal for guests
import { useState, useCallback, useRef } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { X, ChevronLeft, Bug, Sparkles, FileText, HelpCircle, Upload, Trash2, Loader2 } from "lucide-react";
import { EIssuesStoreType } from "@plane/types";
import { TOAST_TYPE, setToast } from "@plane/propel/toast";
import { useIssuesActions } from "@/hooks/use-issues-actions";
import { IssueAttachmentService } from "@/services/issue/issue_attachment.service";

const attachmentService = new IssueAttachmentService();

// --- Types ---

type IssueCategory = "bug" | "feature" | "content" | "question";

interface WizardData {
  category: IssueCategory | null;
  summary: string;
  // Bug fields
  affectedPage: string;
  currentBehavior: string;
  expectedBehavior: string;
  // Feature fields
  featureLocation: string;
  featureDescription: string;
  // Content fields
  contentPage: string;
  contentChange: string;
  // Question fields
  questionDetail: string;
  // Priority & date
  priority: "none" | "low" | "medium" | "high" | "urgent";
  dueDate: string;
  // Files
  files: File[];
}

const INITIAL_DATA: WizardData = {
  category: null,
  summary: "",
  affectedPage: "",
  currentBehavior: "",
  expectedBehavior: "",
  featureLocation: "",
  featureDescription: "",
  contentPage: "",
  contentChange: "",
  questionDetail: "",
  priority: "none",
  dueDate: "",
  files: [],
};

const CATEGORIES: { id: IssueCategory; icon: typeof Bug; label: string; description: string; color: string }[] = [
  { id: "bug", icon: Bug, label: "Fehlverhalten", description: "Etwas funktioniert nicht richtig", color: "text-red-500" },
  { id: "feature", icon: Sparkles, label: "Erweiterung", description: "Neue Funktion oder Anpassung", color: "text-violet-500" },
  { id: "content", icon: FileText, label: "Inhalt \u00e4ndern", description: "Texte, Bilder oder Daten anpassen", color: "text-blue-500" },
  { id: "question", icon: HelpCircle, label: "Frage", description: "Beratung oder R\u00fcckfrage", color: "text-amber-500" },
];

const PRIORITIES: { id: WizardData["priority"]; label: string; description: string; color: string }[] = [
  { id: "low", label: "Kann warten", description: "Kein Zeitdruck", color: "border-gray-300 bg-gray-50 text-gray-700" },
  { id: "medium", label: "Normal", description: "Regul\u00e4re Bearbeitung", color: "border-blue-300 bg-blue-50 text-blue-700" },
  { id: "high", label: "Wichtig", description: "Bald erledigen", color: "border-orange-300 bg-orange-50 text-orange-700" },
  { id: "urgent", label: "Dringend", description: "So schnell wie m\u00f6glich", color: "border-red-300 bg-red-50 text-red-700" },
];

const CATEGORY_PREFIX: Record<IssueCategory, string> = {
  bug: "Fix",
  feature: "Feature",
  content: "Content",
  question: "Frage",
};

// --- Helper: Build description HTML ---

function buildDescription(data: WizardData): string {
  const sections: string[] = [];

  switch (data.category) {
    case "bug":
      if (data.affectedPage) sections.push(`<h3>Betroffene Seite / Bereich</h3><p>${esc(data.affectedPage)}</p>`);
      if (data.currentBehavior) sections.push(`<h3>Aktuelles Verhalten (Ist)</h3><p>${esc(data.currentBehavior)}</p>`);
      if (data.expectedBehavior) sections.push(`<h3>Erwartetes Verhalten (Soll)</h3><p>${esc(data.expectedBehavior)}</p>`);
      break;
    case "feature":
      if (data.featureLocation) sections.push(`<h3>Wo soll die \u00c4nderung hin?</h3><p>${esc(data.featureLocation)}</p>`);
      if (data.featureDescription) sections.push(`<h3>Beschreibung</h3><p>${esc(data.featureDescription)}</p>`);
      break;
    case "content":
      if (data.contentPage) sections.push(`<h3>Betroffene Seite</h3><p>${esc(data.contentPage)}</p>`);
      if (data.contentChange) sections.push(`<h3>Was soll ge\u00e4ndert werden?</h3><p>${esc(data.contentChange)}</p>`);
      break;
    case "question":
      if (data.questionDetail) sections.push(`<h3>Frage</h3><p>${esc(data.questionDetail)}</p>`);
      break;
  }

  return sections.length > 0 ? sections.join("") : "<p></p>";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
}

// --- Component ---

interface GuestCreateWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GuestCreateWizard = observer(function GuestCreateWizard({ isOpen, onClose }: GuestCreateWizardProps) {
  const { workspaceSlug, projectId } = useParams<{ workspaceSlug: string; projectId: string }>();
  const { createIssue } = useIssuesActions(EIssuesStoreType.PROJECT);
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>({ ...INITIAL_DATA });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = 4;

  const update = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleClose = useCallback(() => {
    setStep(0);
    setData({ ...INITIAL_DATA });
    onClose();
  }, [onClose]);

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return data.category !== null;
      case 1:
        return data.summary.trim().length >= 3;
      case 2:
        return true; // details are optional
      case 3:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!workspaceSlug || !projectId || !data.category || !createIssue) return;
    setIsSubmitting(true);
    try {
      const title = `${CATEGORY_PREFIX[data.category]}: ${data.summary.trim()}`;
      const description_html = buildDescription(data);

      const issueData: Record<string, unknown> = {
        name: title,
        description_html,
        priority: data.priority,
      };
      if (data.dueDate) issueData.target_date = data.dueDate;

      const response = await createIssue(projectId, issueData);

      // Upload files if any
      if (response && data.files.length > 0) {
        await Promise.all(
          data.files.map((file) =>
            attachmentService
              .uploadIssueAttachment(workspaceSlug, projectId, response.id, file)
              .catch((err) => console.error("Attachment upload failed:", err))
          )
        );
      }

      setToast({
        type: TOAST_TYPE.SUCCESS,
        title: "Aufgabe erstellt",
        message: `"${title}" wurde erfolgreich angelegt.`,
      });
      handleClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Unbekannter Fehler";
      setToast({ type: TOAST_TYPE.ERROR, title: "Fehler", message: msg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileAdd = (newFiles: FileList | null) => {
    if (!newFiles) return;
    const combined = [...data.files, ...Array.from(newFiles)];
    // Max 5 files
    update({ files: combined.slice(0, 5) });
  };

  const handleFileRemove = (index: number) => {
    update({ files: data.files.filter((_, i) => i !== index) });
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      handleFileAdd(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.files]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Modal */}
      <div className="relative z-10 mx-4 w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-neutral-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-4 dark:border-neutral-700">
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
              >
                <ChevronLeft className="size-5" />
              </button>
            )}
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Neue Aufgabe erstellen</h2>
              <p className="text-xs text-neutral-500">
                Schritt {step + 1} von {totalSteps}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800">
          <div
            className="h-full bg-gradient-to-r from-[#ea2b1f] via-[#ff4fdd] to-[#7e56ff] transition-all duration-300"
            style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
          />
        </div>

        {/* Body */}
        <div className="px-5 py-5">
          {/* Step 0: Category */}
          {step === 0 && (
            <div>
              <p className="mb-4 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Worum geht es?
              </p>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const isSelected = data.category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        update({ category: cat.id });
                        setStep(1);
                      }}
                      className={`flex flex-col items-start gap-1.5 rounded-lg border-2 p-4 text-left transition-all ${
                        isSelected
                          ? "border-violet-500 bg-violet-50 dark:bg-violet-500/10"
                          : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                      }`}
                    >
                      <Icon className={`size-5 ${cat.color}`} />
                      <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{cat.label}</span>
                      <span className="text-xs text-neutral-500">{cat.description}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Step 1: Summary */}
          {step === 1 && (
            <div>
              <label className="mb-2 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                Beschreibe dein Anliegen in einem Satz
              </label>
              <input
                type="text"
                autoFocus
                value={data.summary}
                onChange={(e) => update({ summary: e.target.value })}
                placeholder={
                  data.category === "bug"
                    ? 'z.B. "Header wird auf dem Handy falsch angezeigt"'
                    : data.category === "feature"
                      ? 'z.B. "Kontaktformular um Telefonnummer erweitern"'
                      : data.category === "content"
                        ? 'z.B. "\u00d6ffnungszeiten auf der Startseite aktualisieren"'
                        : 'z.B. "Kann man die Ladezeit der Seite verbessern?"'
                }
                className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && canAdvance()) setStep(2);
                }}
              />
              <p className="mt-2 text-xs text-neutral-400">
                Daraus wird der Titel deiner Aufgabe: <span className="font-medium text-neutral-600 dark:text-neutral-300">{data.category ? `${CATEGORY_PREFIX[data.category]}: ${data.summary || "..."}` : ""}</span>
              </p>
            </div>
          )}

          {/* Step 2: Details + File Upload */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                {data.category === "bug"
                  ? "Hilf uns, das Problem zu verstehen"
                  : data.category === "feature"
                    ? "Beschreibe deine Idee genauer"
                    : data.category === "content"
                      ? "Was genau soll ge\u00e4ndert werden?"
                      : "Stelle deine Frage"}
              </p>

              {/* Bug fields */}
              {data.category === "bug" && (
                <>
                  <WizardField
                    label="Auf welcher Seite / in welchem Bereich?"
                    placeholder="z.B. Startseite, Kontaktformular, Blog..."
                    value={data.affectedPage}
                    onChange={(v) => update({ affectedPage: v })}
                  />
                  <WizardField
                    label="Was passiert aktuell?"
                    placeholder="Beschreibe das Fehlverhalten..."
                    value={data.currentBehavior}
                    onChange={(v) => update({ currentBehavior: v })}
                    multiline
                  />
                  <WizardField
                    label="Was sollte stattdessen passieren?"
                    placeholder="Beschreibe das erwartete Verhalten..."
                    value={data.expectedBehavior}
                    onChange={(v) => update({ expectedBehavior: v })}
                    multiline
                  />
                </>
              )}

              {/* Feature fields */}
              {data.category === "feature" && (
                <>
                  <WizardField
                    label="Wo soll die \u00c4nderung umgesetzt werden?"
                    placeholder="z.B. Startseite, Kontaktbereich, Navigation..."
                    value={data.featureLocation}
                    onChange={(v) => update({ featureLocation: v })}
                  />
                  <WizardField
                    label="Beschreibe genau, was du dir vorstellst"
                    placeholder="Je genauer, desto besser..."
                    value={data.featureDescription}
                    onChange={(v) => update({ featureDescription: v })}
                    multiline
                  />
                </>
              )}

              {/* Content fields */}
              {data.category === "content" && (
                <>
                  <WizardField
                    label="Auf welcher Seite?"
                    placeholder="z.B. Startseite, \u00dcber uns, Impressum..."
                    value={data.contentPage}
                    onChange={(v) => update({ contentPage: v })}
                  />
                  <WizardField
                    label="Was genau soll ge\u00e4ndert werden?"
                    placeholder="Beschreibe die gew\u00fcnschte \u00c4nderung..."
                    value={data.contentChange}
                    onChange={(v) => update({ contentChange: v })}
                    multiline
                  />
                </>
              )}

              {/* Question fields */}
              {data.category === "question" && (
                <WizardField
                  label="Deine Frage"
                  placeholder="Was m\u00f6chtest du wissen?"
                  value={data.questionDetail}
                  onChange={(v) => update({ questionDetail: v })}
                  multiline
                />
              )}

              {/* File Upload */}
              <div>
                <p className="mb-2 text-xs font-medium text-neutral-500">Screenshots hinzuf\u00fcgen (optional)</p>
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg border-2 border-dashed border-neutral-300 px-4 py-4 text-center transition-colors hover:border-violet-400 hover:bg-violet-50/50 dark:border-neutral-600 dark:hover:border-violet-500 dark:hover:bg-violet-500/5"
                >
                  <Upload className="size-5 text-neutral-400" />
                  <p className="text-xs text-neutral-500">
                    Klicken oder Dateien hierher ziehen
                  </p>
                  <p className="text-[10px] text-neutral-400">Max. 5 Dateien</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={(e) => handleFileAdd(e.target.files)}
                  />
                </div>
                {data.files.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {data.files.map((file, i) => (
                      <li key={`${file.name}-${i}`} className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-1.5 text-xs dark:bg-neutral-800">
                        <span className="truncate text-neutral-700 dark:text-neutral-300">{file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFileRemove(i);
                          }}
                          className="ml-2 flex-shrink-0 text-neutral-400 hover:text-red-500"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Priority + Due Date */}
          {step === 3 && (
            <div className="space-y-5">
              <div>
                <p className="mb-3 text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Wie dringend ist es?
                </p>
                <div className="grid grid-cols-2 gap-2.5">
                  {PRIORITIES.map((p) => {
                    const isSelected = data.priority === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => update({ priority: p.id })}
                        className={`rounded-lg border-2 px-3.5 py-2.5 text-left transition-all ${
                          isSelected
                            ? `${p.color} border-current ring-1 ring-current/30`
                            : "border-neutral-200 hover:border-neutral-300 dark:border-neutral-700"
                        }`}
                      >
                        <span className={`text-sm font-semibold ${isSelected ? "" : "text-neutral-900 dark:text-neutral-100"}`}>{p.label}</span>
                        <br />
                        <span className={`text-xs ${isSelected ? "opacity-80" : "text-neutral-500"}`}>{p.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  Wunschtermin <span className="font-normal text-neutral-400">(optional)</span>
                </label>
                <input
                  type="date"
                  value={data.dueDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => update({ dueDate: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-neutral-200 px-5 py-3.5 dark:border-neutral-700">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md px-3.5 py-2 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
          >
            Abbrechen
          </button>

          {step < totalSteps - 1 ? (
            <button
              type="button"
              disabled={!canAdvance()}
              onClick={() => setStep((s) => s + 1)}
              className="rounded-md bg-gradient-to-r from-[#ea2b1f] via-[#ff4fdd] to-[#7e56ff] px-5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Weiter
            </button>
          ) : (
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-md bg-gradient-to-r from-[#ea2b1f] via-[#ff4fdd] to-[#7e56ff] px-5 py-2 text-sm font-medium text-white shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {isSubmitting && <Loader2 className="size-4 animate-spin" />}
              Aufgabe erstellen
            </button>
          )}
        </div>
      </div>
    </div>
  );
});

// --- Reusable field component ---

function WizardField({
  label,
  placeholder,
  value,
  onChange,
  multiline,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  const cls =
    "w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100";
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-neutral-600 dark:text-neutral-400">{label}</label>
      {multiline ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} resize-none`} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  );
}
