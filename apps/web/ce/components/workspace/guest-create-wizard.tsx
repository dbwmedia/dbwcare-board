// Guest-friendly multi-step issue creation wizard
// Replaces the standard create-issue modal for guests
import { useState, useCallback, useRef, useEffect } from "react";
import { observer } from "mobx-react";
import { useParams } from "react-router";
import { X, ChevronLeft, Bug, Sparkles, FileText, HelpCircle, Upload, Trash2, Loader2, Check } from "lucide-react";
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
  affectedPage: string;
  currentBehavior: string;
  expectedBehavior: string;
  featureLocation: string;
  featureDescription: string;
  contentPage: string;
  contentChange: string;
  questionDetail: string;
  priority: "none" | "low" | "medium" | "high" | "urgent";
  dueDate: string;
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

const CATEGORIES: { id: IssueCategory; icon: typeof Bug; label: string; description: string; color: string; bgHover: string; bgSelected: string; borderSelected: string }[] = [
  { id: "bug", icon: Bug, label: "Fehlverhalten", description: "Etwas funktioniert nicht richtig", color: "text-red-500", bgHover: "hover:bg-red-50 dark:hover:bg-red-500/5", bgSelected: "bg-red-50 dark:bg-red-500/10", borderSelected: "border-red-400" },
  { id: "feature", icon: Sparkles, label: "Erweiterung", description: "Neue Funktion oder Anpassung", color: "text-violet-500", bgHover: "hover:bg-violet-50 dark:hover:bg-violet-500/5", bgSelected: "bg-violet-50 dark:bg-violet-500/10", borderSelected: "border-violet-400" },
  { id: "content", icon: FileText, label: "Inhalt \u00e4ndern", description: "Texte, Bilder oder Daten anpassen", color: "text-blue-500", bgHover: "hover:bg-blue-50 dark:hover:bg-blue-500/5", bgSelected: "bg-blue-50 dark:bg-blue-500/10", borderSelected: "border-blue-400" },
  { id: "question", icon: HelpCircle, label: "Frage", description: "Beratung oder R\u00fcckfrage", color: "text-amber-500", bgHover: "hover:bg-amber-50 dark:hover:bg-amber-500/5", bgSelected: "bg-amber-50 dark:bg-amber-500/10", borderSelected: "border-amber-400" },
];

const PRIORITIES: { id: WizardData["priority"]; label: string; description: string; selectedBg: string; selectedBorder: string; selectedText: string }[] = [
  { id: "low", label: "Kann warten", description: "Kein Zeitdruck", selectedBg: "bg-neutral-100 dark:bg-neutral-700", selectedBorder: "border-neutral-400", selectedText: "text-neutral-700 dark:text-neutral-200" },
  { id: "medium", label: "Normal", description: "Regul\u00e4re Bearbeitung", selectedBg: "bg-blue-50 dark:bg-blue-500/10", selectedBorder: "border-blue-400", selectedText: "text-blue-700 dark:text-blue-300" },
  { id: "high", label: "Wichtig", description: "Bald erledigen", selectedBg: "bg-orange-50 dark:bg-orange-500/10", selectedBorder: "border-orange-400", selectedText: "text-orange-700 dark:text-orange-300" },
  { id: "urgent", label: "Dringend", description: "So schnell wie m\u00f6glich", selectedBg: "bg-red-50 dark:bg-red-500/10", selectedBorder: "border-red-400", selectedText: "text-red-700 dark:text-red-300" },
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
      if (data.affectedPage) sections.push(`<p><strong>Betroffene Seite / Bereich:</strong> ${esc(data.affectedPage)}</p>`);
      if (data.currentBehavior) sections.push(`<p><strong>Aktuelles Verhalten (Ist):</strong><br/>${esc(data.currentBehavior)}</p>`);
      if (data.expectedBehavior) sections.push(`<p><strong>Erwartetes Verhalten (Soll):</strong><br/>${esc(data.expectedBehavior)}</p>`);
      break;
    case "feature":
      if (data.featureLocation) sections.push(`<p><strong>Bereich:</strong> ${esc(data.featureLocation)}</p>`);
      if (data.featureDescription) sections.push(`<p><strong>Beschreibung:</strong><br/>${esc(data.featureDescription)}</p>`);
      break;
    case "content":
      if (data.contentPage) sections.push(`<p><strong>Betroffene Seite:</strong> ${esc(data.contentPage)}</p>`);
      if (data.contentChange) sections.push(`<p><strong>Gew\u00fcnschte \u00c4nderung:</strong><br/>${esc(data.contentChange)}</p>`);
      break;
    case "question":
      if (data.questionDetail) sections.push(`<p>${esc(data.questionDetail)}</p>`);
      break;
  }

  return sections.length > 0 ? sections.join("") : "<p></p>";
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>");
}

// --- Success Overlay ---

function SuccessOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 2000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="mb-4 flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-emerald-500 shadow-lg shadow-green-200 dark:shadow-green-900/30">
        <Check className="size-8 text-white" strokeWidth={3} />
      </div>
      <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Aufgabe erstellt!</h3>
      <p className="mt-1 text-sm text-neutral-500">{"Wir k\u00fcmmern uns darum."}</p>
    </div>
  );
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
  const [showSuccess, setShowSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalSteps = 4;

  const update = useCallback((partial: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetAndClose = useCallback(() => {
    setStep(0);
    setData({ ...INITIAL_DATA });
    setShowSuccess(false);
    onClose();
  }, [onClose]);

  const canAdvance = (): boolean => {
    switch (step) {
      case 0:
        return data.category !== null;
      case 1:
        return data.summary.trim().length >= 3;
      case 2:
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

      if (response && data.files.length > 0) {
        await Promise.all(
          data.files.map((file) =>
            attachmentService
              .uploadIssueAttachment(workspaceSlug, projectId, response.id, file)
              .catch((err) => console.error("Attachment upload failed:", err))
          )
        );
      }

      setShowSuccess(true);
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
      <div className="relative z-10 mx-4 w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-neutral-900">
        {/* Success state */}
        {showSuccess ? (
          <SuccessOverlay onDone={resetAndClose} />
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4">
              <div className="flex items-center gap-3">
                {step > 0 && (
                  <button
                    type="button"
                    onClick={() => setStep((s) => s - 1)}
                    className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
                  >
                    <ChevronLeft className="size-4" />
                  </button>
                )}
                <div>
                  <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">Neue Aufgabe erstellen</h2>
                  <p className="text-xs text-neutral-400">
                    Schritt {step + 1} von {totalSteps}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetAndClose}
                className="rounded-full p-1.5 text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Progress bar */}
            <div className="h-1 w-full bg-neutral-100 dark:bg-neutral-800">
              <div
                className="h-full bg-gradient-to-r from-[#ea2b1f] via-[#ff4fdd] to-[#7e56ff] transition-all duration-500 ease-out"
                style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
              />
            </div>

            {/* Body */}
            <div className="max-h-[60vh] overflow-y-auto px-5 py-5">
              {/* Step 0: Category */}
              {step === 0 && (
                <div>
                  <p className="mb-4 text-sm font-medium text-neutral-600 dark:text-neutral-400">
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
                          className={`group flex flex-col items-start gap-2 rounded-xl border-2 p-4 text-left transition-all duration-150 ${
                            isSelected
                              ? `${cat.borderSelected} ${cat.bgSelected} shadow-sm`
                              : `border-neutral-200 ${cat.bgHover} hover:border-neutral-300 hover:shadow-sm dark:border-neutral-700 dark:hover:border-neutral-600`
                          }`}
                        >
                          <div className={`rounded-lg p-2 ${isSelected ? cat.bgSelected : "bg-neutral-100 group-hover:bg-neutral-50 dark:bg-neutral-800 dark:group-hover:bg-neutral-700"}`}>
                            <Icon className={`size-5 ${cat.color}`} />
                          </div>
                          <span className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">{cat.label}</span>
                          <span className="text-xs leading-relaxed text-neutral-500">{cat.description}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Step 1: Summary */}
              {step === 1 && (
                <div>
                  <label className="mb-3 block text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    Beschreibe dein Anliegen in einem Satz
                  </label>
                  <input
                    type="text"
                    autoFocus
                    value={data.summary}
                    onChange={(e) => update({ summary: e.target.value })}
                    placeholder={
                      data.category === "bug"
                        ? "z.B. Header wird auf dem Handy falsch angezeigt"
                        : data.category === "feature"
                          ? "z.B. Kontaktformular um Telefonnummer erweitern"
                          : data.category === "content"
                            ? "z.B. \u00d6ffnungszeiten auf der Startseite aktualisieren"
                            : "z.B. Kann man die Ladezeit der Seite verbessern?"
                    }
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-violet-500/20"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canAdvance()) setStep(2);
                    }}
                  />
                </div>
              )}

              {/* Step 2: Details + File Upload */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400">
                    {data.category === "bug"
                      ? "Hilf uns, das Problem zu verstehen"
                      : data.category === "feature"
                        ? "Beschreibe deine Idee genauer"
                        : data.category === "content"
                          ? "Was genau soll ge\u00e4ndert werden?"
                          : "Stelle deine Frage"}
                  </p>

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
                    <p className="mb-2 text-xs font-medium text-neutral-500">{"Screenshots hinzuf\u00fcgen (optional)"}</p>
                    <div
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                      className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-neutral-200 bg-neutral-50/50 px-4 py-5 text-center transition-all hover:border-violet-300 hover:bg-violet-50/30 dark:border-neutral-700 dark:bg-neutral-800/50 dark:hover:border-violet-500 dark:hover:bg-violet-500/5"
                    >
                      <Upload className="size-5 text-neutral-400" />
                      <p className="text-xs text-neutral-500">Klicken oder Dateien hierher ziehen</p>
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
                          <li key={`${file.name}-${i}`} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2 text-xs dark:bg-neutral-800">
                            <span className="truncate text-neutral-700 dark:text-neutral-300">{file.name}</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileRemove(i);
                              }}
                              className="ml-2 flex-shrink-0 rounded p-0.5 text-neutral-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
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
                    <p className="mb-3 text-sm font-medium text-neutral-600 dark:text-neutral-400">
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
                            className={`rounded-xl border-2 px-4 py-3 text-left transition-all duration-150 ${
                              isSelected
                                ? `${p.selectedBorder} ${p.selectedBg} ${p.selectedText} shadow-sm`
                                : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50 hover:shadow-sm dark:border-neutral-700 dark:hover:border-neutral-600 dark:hover:bg-neutral-800"
                            }`}
                          >
                            <span className={`text-sm font-semibold ${isSelected ? "" : "text-neutral-900 dark:text-neutral-100"}`}>{p.label}</span>
                            <br />
                            <span className={`text-xs ${isSelected ? "opacity-75" : "text-neutral-500"}`}>{p.description}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-600 dark:text-neutral-400">
                      Wunschtermin <span className="font-normal text-neutral-400">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={data.dueDate}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => update({ dueDate: e.target.value })}
                      className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 transition-colors focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-violet-500/20"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-neutral-100 px-5 py-3.5 dark:border-neutral-800">
              <button
                type="button"
                onClick={resetAndClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
              >
                Abbrechen
              </button>

              {step < totalSteps - 1 ? (
                <button
                  type="button"
                  disabled={!canAdvance()}
                  onClick={() => setStep((s) => s + 1)}
                  className="rounded-lg bg-gradient-to-r from-[#ea2b1f] via-[#ff4fdd] to-[#7e56ff] px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-40 disabled:shadow-none"
                >
                  Weiter
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleSubmit}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#ea2b1f] via-[#ff4fdd] to-[#7e56ff] px-6 py-2 text-sm font-medium text-white shadow-sm transition-all hover:shadow-md hover:brightness-110 disabled:opacity-60 disabled:shadow-none"
                >
                  {isSubmitting && <Loader2 className="size-4 animate-spin" />}
                  Aufgabe erstellen
                </button>
              )}
            </div>
          </>
        )}
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
    "w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 transition-colors focus:border-violet-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-violet-500/20";
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">{label}</label>
      {multiline ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${cls} resize-none`} />
      ) : (
        <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cls} />
      )}
    </div>
  );
}
