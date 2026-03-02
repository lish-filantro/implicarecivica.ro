"use client";

import { forwardRef } from "react";
import type { UseFormReturn } from "react-hook-form";
import type { WizardFormData } from "@/lib/campanii/validations/wizard";
import { TagPalette } from "./TagPalette";

interface EmailEditorPaneProps {
  form: UseFormReturn<WizardFormData>;
  usedVariables: string[];
  onInsertTag: (variableKey: string, target: "subject" | "body") => void;
  bodyRef: React.RefObject<HTMLTextAreaElement | null>;
  subjectRef: React.RefObject<HTMLTextAreaElement | null>;
}

export const EmailEditorPane = forwardRef<HTMLDivElement, EmailEditorPaneProps>(
  function EmailEditorPane(
    { form, usedVariables, onInsertTag, bodyRef, subjectRef },
    ref
  ) {
    const {
      register,
      formState: { errors },
    } = form;

    const { ref: subjectRegRef, ...subjectRegProps } = register("email_subject");
    const { ref: bodyRegRef, ...bodyRegProps } = register("email_body");

    return (
      <div ref={ref} className="space-y-4">
        {/* Subject */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Subiect email *
          </label>
          <textarea
            {...subjectRegProps}
            ref={(el) => {
              subjectRegRef(el);
              if (subjectRef && "current" in subjectRef) {
                (subjectRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
              }
            }}
            className="input-modern font-mono text-sm resize-none"
            rows={2}
            placeholder="Subiectul emailului..."
          />
          {errors.email_subject && (
            <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">
              {errors.email_subject.message}
            </p>
          )}
        </div>

        {/* Tag palette (compact, inline) */}
        <div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-1.5">
            Click pe o variabilă pentru a o insera la cursor:
          </p>
          <TagPalette
            usedVariables={usedVariables}
            onInsert={(key) => onInsertTag(key, "body")}
            compact
          />
        </div>

        {/* Body */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Corp email *
          </label>
          <textarea
            {...bodyRegProps}
            ref={(el) => {
              bodyRegRef(el);
              if (bodyRef && "current" in bodyRef) {
                (bodyRef as React.MutableRefObject<HTMLTextAreaElement | null>).current = el;
              }
            }}
            className="input-modern min-h-[300px] font-mono text-sm"
            placeholder="Scrie corpul emailului aici... Folosește variabilele de mai sus pentru personalizare."
          />
          {errors.email_body && (
            <p className="text-sm text-protest-red-500 dark:text-protest-red-400 mt-1">
              {errors.email_body.message}
            </p>
          )}
        </div>

        {/* Signature */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Semnătură (opțional)
          </label>
          <textarea
            {...register("email_signature")}
            className="input-modern min-h-[60px] font-mono text-sm"
            placeholder="Cu stimă,&#10;{nume_participant}"
          />
        </div>
      </div>
    );
  }
);
