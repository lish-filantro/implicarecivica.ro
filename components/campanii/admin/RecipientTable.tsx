"use client";

import { useState, useCallback } from "react";
import type { CampaignRecipient } from "@/lib/campanii/types/campaign";
import { Plus, Trash2, Upload, ToggleLeft, ToggleRight } from "lucide-react";

interface RecipientTableProps {
  campaignSlug: string;
  initialRecipients: CampaignRecipient[];
}

export function RecipientTable({ campaignSlug, initialRecipients }: RecipientTableProps) {
  const [recipients, setRecipients] = useState(initialRecipients);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showCsvImport, setShowCsvImport] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [email, setEmail] = useState("");
  const [csvText, setCsvText] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/campanii/${campaignSlug}/recipients`);
    if (res.ok) {
      setRecipients(await res.json());
    }
  }, [campaignSlug]);

  const addRecipient = async (e: React.FormEvent) => {
    e.preventDefault();
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
    await fetch(`/api/campanii/${campaignSlug}/recipients`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !currentActive }),
    });
    await refresh();
  };

  const deleteRecipient = async (id: string) => {
    if (!confirm("Sigur vrei să ștergi acest destinatar?")) return;
    await fetch(`/api/campanii/${campaignSlug}/recipients?id=${id}`, {
      method: "DELETE",
    });
    await refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setShowAddForm(!showAddForm); setShowCsvImport(false); }}
          className="btn-civic flex items-center gap-2 text-sm py-2"
        >
          <Plus className="w-4 h-4" /> Adaugă destinatar
        </button>
        <button
          onClick={() => { setShowCsvImport(!showCsvImport); setShowAddForm(false); }}
          className="btn-civic flex items-center gap-2 text-sm py-2 bg-urban-gray-600 hover:bg-urban-gray-700 border-urban-gray-700"
        >
          <Upload className="w-4 h-4" /> Import CSV
        </button>
        <span className="text-sm text-urban-gray-500">
          {recipients.length} destinatari ({recipients.filter((r) => r.is_active).length} activi)
        </span>
      </div>

      {message && (
        <div className="bg-civic-blue-50 border border-civic-blue-200 p-3 rounded text-sm">
          {message}
        </div>
      )}

      {showAddForm && (
        <form onSubmit={addRecipient} className="flex items-end gap-3 bg-urban-gray-50 p-4 border rounded">
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1">Nume *</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input-modern py-1.5" required />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1">Funcție</label>
            <input value={role} onChange={(e) => setRole(e.target.value)} className="input-modern py-1.5" />
          </div>
          <div className="flex-1">
            <label className="block text-xs font-semibold mb-1">Email *</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className="input-modern py-1.5" type="email" required />
          </div>
          <button type="submit" disabled={loading} className="btn-activist py-1.5 px-4 text-sm">
            Adaugă
          </button>
        </form>
      )}

      {showCsvImport && (
        <div className="bg-urban-gray-50 p-4 border rounded space-y-3">
          <p className="text-sm text-urban-gray-600">
            Lipește CSV-ul cu coloanele: <code>Nume, Funcție, Email</code> (sau <code>Nume, Email</code>)
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b-2 border-black">
              <th className="text-left py-2 font-activist uppercase tracking-wide">Nume</th>
              <th className="text-left py-2 font-activist uppercase tracking-wide">Funcție</th>
              <th className="text-left py-2 font-activist uppercase tracking-wide">Email</th>
              <th className="text-center py-2 font-activist uppercase tracking-wide">Activ</th>
              <th className="text-center py-2 font-activist uppercase tracking-wide">Acțiuni</th>
            </tr>
          </thead>
          <tbody>
            {recipients.map((r) => (
              <tr key={r.id} className={`border-b ${!r.is_active ? "opacity-50" : ""}`}>
                <td className="py-2">{r.name}</td>
                <td className="py-2 text-urban-gray-500">{r.role || "\u2014"}</td>
                <td className="py-2 font-mono text-xs">{r.email}</td>
                <td className="py-2 text-center">
                  <button onClick={() => toggleActive(r.id, r.is_active)}>
                    {r.is_active ? (
                      <ToggleRight className="w-6 h-6 text-grassroots-green-500" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-urban-gray-400" />
                    )}
                  </button>
                </td>
                <td className="py-2 text-center">
                  <button onClick={() => deleteRecipient(r.id)} className="text-protest-red-500 hover:text-protest-red-700">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {recipients.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-urban-gray-400">
                  Niciun destinatar adăugat încă
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
