"use client";

import type { UseFormReturn } from "react-hook-form";
import type { WizardFormData } from "@/lib/campanii/validations/wizard";
import { EmailEditorPane } from "./EmailEditorPane";
import { EmailPreviewPane } from "./EmailPreviewPane";
import { AiAssistant } from "./AiAssistant";
import { FormFieldsSummary } from "./FormFieldsSummary";

interface StepEmailProps {
  form: UseFormReturn<WizardFormData>;
  usedVariables: string[];
  previewSubject: string;
  previewBody: string;
  recipientCount: number;
  onInsertTag: (variableKey: string, target: "subject" | "body") => void;
  emailBodyRef: React.RefObject<HTMLTextAreaElement | null>;
  emailSubjectRef: React.RefObject<HTMLTextAreaElement | null>;
  // AI
  onGenerateEmail: (params: {
    causeDescription: string;
    tone: "formal" | "empatic" | "urgent";
    keyPoints: string[];
    recipientContext: string;
  }) => Promise<void>;
  aiLoading: boolean;
  aiError: string | null;
}

export function StepEmail({
  form,
  usedVariables,
  previewSubject,
  previewBody,
  recipientCount,
  onInsertTag,
  emailBodyRef,
  emailSubjectRef,
  onGenerateEmail,
  aiLoading,
  aiError,
}: StepEmailProps) {
  const watchedBody = form.watch("email_body") || "";
  const watchedSignature = form.watch("email_signature") || "";
  const causeDescription = form.watch("long_description") || form.watch("short_description") || "";

  return (
    <div className="space-y-4">
      {/* AI Assistant */}
      <AiAssistant
        defaultCauseDescription={causeDescription}
        onGenerate={onGenerateEmail}
        loading={aiLoading}
        error={aiError}
        hasExistingEmail={watchedBody.length > 20}
      />

      {/* Split view: Editor | Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Editor */}
        <div className="space-y-4">
          <EmailEditorPane
            form={form}
            usedVariables={usedVariables}
            onInsertTag={onInsertTag}
            bodyRef={emailBodyRef}
            subjectRef={emailSubjectRef}
          />
        </div>

        {/* Right: Preview + Field Summary */}
        <div className="space-y-4">
          <div className="lg:sticky lg:top-4 space-y-4">
            <EmailPreviewPane
              subject={previewSubject}
              body={previewBody}
              signature={watchedSignature}
              recipientCount={recipientCount}
            />

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
              <FormFieldsSummary usedVariables={usedVariables} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
