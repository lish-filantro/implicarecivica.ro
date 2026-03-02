"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, ImageIcon, Loader2 } from "lucide-react";

interface ImageUploadProps {
  value: string | null | undefined;
  onChange: (url: string) => void;
}

export function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/campanii/upload-image", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Eroare la încărcare");
          return;
        }

        onChange(data.url);
      } catch {
        setError("Eroare de conexiune");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Format acceptat: JPG, PNG sau WebP");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Imaginea nu poate depăși 5 MB");
      return;
    }
    upload(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleRemove = () => {
    onChange("");
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (value) {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
          Imagine copertă
        </label>
        <div className="relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          <img
            src={value}
            alt="Copertă campanie"
            className="w-full h-48 object-cover"
          />
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 hover:bg-black/70 text-white transition-colors"
            title="Șterge imaginea"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        Imagine copertă
      </label>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all
          ${
            dragOver
              ? "border-civic-blue-400 bg-civic-blue-50 dark:border-civic-blue-600 dark:bg-civic-blue-900/20"
              : "border-gray-300 dark:border-gray-600 hover:border-civic-blue-300 dark:hover:border-civic-blue-700 bg-gray-50 dark:bg-gray-800/50"
          }
          ${uploading ? "pointer-events-none opacity-70" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {uploading ? (
          <Loader2 className="w-8 h-8 text-civic-blue-500 animate-spin" />
        ) : (
          <div className="p-3 rounded-xl bg-civic-blue-50 dark:bg-civic-blue-900/20">
            <Upload className="w-6 h-6 text-civic-blue-500" />
          </div>
        )}

        <div className="text-center">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {uploading
              ? "Se încarcă..."
              : "Trage imaginea aici sau click pentru a selecta"}
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            JPG, PNG sau WebP &middot; max 5 MB
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700/50 px-3 py-1.5 rounded-full">
          <ImageIcon className="w-3 h-3" />
          <span>Recomandat: 1200 &times; 630 px (format 1.91:1)</span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-protest-red-500 dark:text-protest-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
