"use client";

import type { Campaign, CampaignRecipient } from "@/lib/campanii/types/campaign";
import { useCampaignWizard } from "@/lib/hooks/useCampaignWizard";
import { StepperBar } from "@/components/requests/StepperBar";
import { StepCauza } from "./StepCauza";
import { StepEmail } from "./StepEmail";
import { StepPreview } from "./StepPreview";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  Rocket,
  Eye,
} from "lucide-react";

const WIZARD_STEPS = [
  { number: 1, label: "Cauza & Destinatari" },
  { number: 2, label: "Compune emailul" },
  { number: 3, label: "Previzualizare" },
];

interface CampaignWizardProps {
  campaign?: Campaign;
  initialRecipients?: CampaignRecipient[];
}

export function CampaignWizard({
  campaign,
  initialRecipients,
}: CampaignWizardProps) {
  const wizard = useCampaignWizard({ campaign, initialRecipients });

  const handleNext = () => {
    if (wizard.currentStep === 1 && wizard.canProceedToStep2) {
      wizard.setStep(2);
    } else if (wizard.currentStep === 2 && wizard.canProceedToStep3) {
      wizard.setStep(3);
    }
  };

  const handleBack = () => {
    if (wizard.currentStep > 1) {
      wizard.setStep((wizard.currentStep - 1) as 1 | 2);
    }
  };

  const handlePublish = async () => {
    await wizard.publish();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Stepper */}
      <StepperBar currentStep={wizard.currentStep} steps={WIZARD_STEPS} />

      {/* Step content */}
      <div>
        {wizard.currentStep === 1 && (
          <StepCauza
            form={wizard.form}
            recipients={wizard.recipients}
            onRecipientsChange={wizard.setRecipients}
            campaignSlug={wizard.savedSlug}
            campaignEmail={campaign?.campaign_email}
            isEdit={!!campaign}
          />
        )}

        {wizard.currentStep === 2 && (
          <StepEmail
            form={wizard.form}
            usedVariables={wizard.usedVariables}
            previewSubject={wizard.previewSubject}
            previewBody={wizard.previewBody}
            recipientCount={wizard.recipients.filter((r) => r.is_active).length}
            onInsertTag={wizard.insertTag}
            emailBodyRef={wizard.emailBodyRef}
            emailSubjectRef={wizard.emailSubjectRef}
            onGenerateEmail={wizard.generateEmail}
            aiLoading={wizard.aiLoading}
            aiError={wizard.aiError}
          />
        )}

        {wizard.currentStep === 3 && (
          <StepPreview
            form={wizard.form}
            previewSubject={wizard.previewSubject}
            previewBody={wizard.previewBody}
            usedVariables={wizard.usedVariables}
            recipientCount={wizard.recipients.filter((r) => r.is_active).length}
          />
        )}
      </div>

      {/* Error */}
      {wizard.saveError && (
        <div className="bg-protest-red-100 dark:bg-protest-red-900/20 border border-protest-red-300 dark:border-protest-red-700 p-3 rounded-lg text-sm text-protest-red-700 dark:text-protest-red-400">
          {wizard.saveError}
        </div>
      )}

      {/* Navigation footer */}
      <div className="flex items-center justify-between border-t border-gray-200 dark:border-gray-700 pt-4">
        <div className="flex items-center gap-3">
          {wizard.currentStep > 1 && (
            <button
              type="button"
              onClick={handleBack}
              className="btn-civic flex items-center gap-2 text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              Înapoi
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Save draft — always visible */}
          <button
            type="button"
            onClick={() => wizard.saveDraft()}
            disabled={wizard.saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            <Save className="w-4 h-4" />
            {wizard.saving ? "Se salvează..." : "Salvează ciornă"}
          </button>

          {/* Next / Publish */}
          {wizard.currentStep < 3 ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={
                (wizard.currentStep === 1 && !wizard.canProceedToStep2) ||
                (wizard.currentStep === 2 && !wizard.canProceedToStep3)
              }
              className="btn-activist flex items-center gap-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuă
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={wizard.saving}
              className="btn-activist flex items-center gap-2 text-sm disabled:opacity-50"
            >
              <Rocket className="w-4 h-4" />
              {wizard.saving ? "Se publică..." : "Publică campania"}
            </button>
          )}

          {/* View public page (edit mode only) */}
          {campaign && campaign.status === "active" && (
            <a
              href={`/campanii/${campaign.slug}`}
              target="_blank"
              className="btn-civic flex items-center gap-2 text-sm"
            >
              <Eye className="w-4 h-4" />
              Pagina publică
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
