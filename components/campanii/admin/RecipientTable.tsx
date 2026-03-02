"use client";

import { useState, useCallback } from "react";
import type { CampaignRecipient } from "@/lib/campanii/types/campaign";
import { Plus, Trash2, Upload, ToggleLeft, ToggleRight } from "lucide-react";

interface RecipientTableProps {
  campaignSlug?: string;
  initialRecipients: CampaignRecipient[];
  onRecipientsChange?: (recipients: CampaignRecipient[]) => void;
}

export function RecipientTable({ campaignSlug, initialRecipients, onRecipientsChange }: RecipientTableProps) {
  const localMode = !campaignSlug;
  const [recipients, setRecipientsState] = useState(initialRecipients);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const setRecipients = useCallback((newRecipients: CampaignRecipient[]) => {
    setRecipientsState(newRecipients);
    onRecipientsChange?.(newRecipients);
  }, [onRecipientsChange]);

  const refresh = useCallback(async () => {
    if (localMode) return;
    const res = await fetch(`/api/campanii/${campaignSlug}/recipients`);
    if (res.ok) {
      const data = await res.json();
      setRecipientsState(data);
      onRecipientsChange?.(data);
    }
  }, [campaignSlug, localMode, onRecipientsChange]);

  const addRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (localMode) {
      const newRecipient: CampaignRecipient = {
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        campaign_id: "",
        name,
        role: role || null,
        email,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      setRecipients([...recipients, newRecipient]);
      setName("");
      setRole("");
      setEmail("");
      setShowAddForm(false);
      return;
    }
    setLoading(true);
    const res = await fetch(`/api/campanii/${campaignSlug}/recipients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, role: role || null, email }),
    });
    if (res.ok) {
      setName("");
      setRole("");
      setEmail("");
      setShowAddForm(false);
      await refresh();
    }
    setLoading(false);
  };

  const importCsv = async () => {
    if (localMode) {
      // Parse CSV locally for local mode
      const lines = csvText.split("\n").filter((l) => l.trim());
      const newRecipients: CampaignRecipient[] = [];
      for (const line of lines) {
        const delimiter = line.includes(";") ? ";" : ",";
        const parts = line.split(delimiter).map((p) => p.trim());
        if (parts.length >= 2) {
          newRecipients.push({
            id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            campaign_id: "",
            name: parts[0],
            role: parts.length === 3 ? parts[1] : null,
            email: parts[parts.length - 1],
            is_active: true,
            created_at: new Date().toISOString(),
          });
        }
      }
      setRecipients([...recipients, ...newRecipients]);
      setMessage(`${newRecipients.length} destinatari adăugați.`);
      setCsvText("");
      setShowCsvImport(false);
      return;
    }
    setLoading(true);
    setMessage(null);
    const res = await fetch(`/api/campanii/${campaignSlug}/recipients`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: csvText }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`${data.inserted} destinatari importați.${data.errors?.length ? ` ${data.errors.length} erori.` : ""}`);
      setCsvText("");
      setShowCsvImport(false);
      await refresh();
    } else {
      setMessage(data.error || "Eroare la import");
    }
    setLoading(false);
  };

  const toggleActive = async (id: string, currentActive: boolean) => {
    if (localMode) {
      setRecipients(
        recipients.map((r) =>
          r.id === id ? { ...r, is_active: !currentActive } : r
        )
      );
      return;
    }
    await fetch(`/api/campanii/${campaignSlug}/recipients`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !currentActive }),
    });
    await refresh();
  };

  const deleteRecipient = async (id: string) => {
    if (!confirm("Sigur vrei să ștergi acest destinatar?")) return;
    if (localMode) {
      setRecipients(recipients.filter((r) => r.id !== id));
      return;
    }
    await fetch(`/api/campanii/${campaignSlug}/recipients?id=${id}`, {
      method: "DELETE",
    });
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => { setShowAddForm(!showAddForm); setShowCsvImport(false); }}
          className="btn-civic flex items-center gap-2 text-sm py-2"
        >
          <Plus className="w-4 h-4" /> Adaugă destinatar
        </button>
        <button
          onClick={() => { setShowCsvImport(!showCsvImport); setShowAddForm(false); }}
          className="btn-activist flex items-center gap-2 text-sm py-2"
        >
          <Upload className="w-4 h-4" /> Import CSV
        </button>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {recipients.length} destinatari ({recipients.filter((r) => r.is_active).length} activi)
        </span>
      </div>

      {message && (
        <div className="bg-civic-blue-50 dark:bg-civic-blue-900/20 border border-civic-blue-200 dark:border-civic-blue-800 p-3 rounded-lg text-sm text-gray-700 dark:text-gray-300">
          {message}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={addRecipient} className="flex items-end gap-3 bg-gray-50 dark:bg-gray-800/50 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Nume *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-modern py-1.5" required />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Funcție</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} className="input-modern py-1.5" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">Email *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input-modern py-1.5" type="email" required />
          </div>
          <button type="submit" disabled={loading} className="btn-activist py-1.5 px-4 text-sm">
            Adaugă
          </button>
        </form>
      )}

      {showCsvImport && (
        <div className="bg-gray-50 dark:bg-gray-800/50 p-4 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Lipește CSV-ul cu coloanele: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Nume, Funcție, Email</code> (sau <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">Nume, Email</code>)
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            className="input-modern min-h-[100px] font-mono text-sm"
            placeholder="Ion Popescu, Consilier General, ion@pmb.ro"
          />
          <button onClick={importCsv} disabled={loading || !csvText.trim()} className="btn-activist py-1.5 px-4 text-sm">
            {loading ? "Se importă..." : "Importă"}
          </button>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Nume</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Funcție</th>
                <th className="text-left py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Email</th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Activ</th>
                <th className="text-center py-2.5 px-4 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">Acțiuni</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map((r) => (
                <tr key={r.id} className={`border-b border-gray-100 dark:border-gray-700/50 ${!r.is_active ? "opacity-50" : ""}`}>
                  <td className="py-2 px-4 text-gray-900 dark:text-white">{r.name}</td>
                  <td className="py-2 px-4 text-gray-500 dark:text-gray-400">{r.role || "\u2014"}</td>
                  <td className="py-2 px-4 font-mono text-xs text-gray-700 dark:text-gray-300">{r.email}</td>
                  <td className="py-2 px-4 text-center">
                    <button onClick={() => toggleActive(r.id, r.is_active)}>
                      {r.is_active ? (
                        <ToggleRight className="w-6 h-6 text-grassroots-green-500" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                      )}
                    </button>
                  </td>
                  <td className="py-2 px-4 text-center">
                    <button onClick={() => deleteRecipient(r.id)} className="text-protest-red-500 hover:text-protest-red-700 dark:text-protest-red-400 dark:hover:text-protest-red-300">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {recipients.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-gray-400 dark:text-gray-500">
                    Niciun destinatar adăugat încă
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
