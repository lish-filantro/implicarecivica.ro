"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip as ChartTooltip,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import {
  BarChart3,
  Users,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Info,
  ArrowUpDown,
} from "lucide-react";

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip);

/* ─── Types ─────────────────────────────────────────────────────── */

interface ResultEntry {
  judet: string;
  uat: string;
  locType: string;
  sizeCat: string;
  margin: number;
  marginPctElig: number;
  marginPctNonVoters: number;
  firstCand: string;
  firstParty: string;
  firstAbbrev: string;
  firstColor: string;
  firstVotes: number;
  secondCand: string;
  secondParty: string;
  secondAbbrev: string;
  secondColor: string;
  secondVotes: number;
  numCandidates: number;
  eligible: number;
  voted: number;
  validVotes: number;
  nonVoters: number;
  prezenta: number;
}

interface PCJEntry extends ResultEntry {
  // same shape but no uat
}

interface ThresholdItem {
  threshold: number;
  count: number;
  pct: number;
  analogy?: string;
  label?: string;
}

interface CategorySummary {
  name: string;
  locType: string;
  count: number;
  avgEligible: number;
  avgVoted: number;
  avgNonVoters: number;
  avgPrezenta: number;
  avgMargin: number;
  medianMargin: number;
  minMargin: number;
  adaptiveThresholds: ThresholdItem[];
  top5: ResultEntry[];
}

interface HistBin {
  lo: number;
  hi: number;
  label: string;
  count: number;
}

interface Summary {
  label: string;
  total: number;
  medianMargin: number;
  globalAbsolute: ThresholdItem[];
  globalPctElig: ThresholdItem[];
  globalPctNonVoters: ThresholdItem[];
  categories: CategorySummary[];
  histogram: HistBin[];
}

interface SummaryData {
  primari: Summary;
  consiliuLocal: Summary;
  presedinteCJ: { total: number; results: PCJEntry[] };
  judete: string[];
  sizeCategories: string[];
  partyColors: Record<string, string>;
}

type TabKey = "primari" | "consiliu_local" | "presedinte_cj";

/* ─── Helpers ───────────────────────────────────────────────────── */

const fmtNum = (n: number) => n.toLocaleString("ro-RO");
const fmtPct = (n: number) => n.toFixed(1) + "%";

const TABS: { key: TabKey; label: string }[] = [
  { key: "primari", label: "Primari" },
  { key: "consiliu_local", label: "Consilii Locale" },
  { key: "presedinte_cj", label: "Consilii Județene" },
];

const FUNNEL_THRESHOLDS = [5, 10, 50, 100, 500, 1000];

const FUNNEL_ANALOGIES: Record<number, string> = {
  5: "O singură familie",
  10: "Vecinii de pe o uliță",
  50: "O clasă de elevi",
  100: "Enoriașii de la o slujbă",
  500: "Un sat mic",
  1000: "Participanții la un târg comunal",
};

const MARGIN_OPTIONS = [
  { value: "", label: "Toate diferențele" },
  { value: "5", label: "< 5 voturi" },
  { value: "10", label: "< 10 voturi" },
  { value: "50", label: "< 50 voturi" },
  { value: "100", label: "< 100 voturi" },
  { value: "200", label: "< 200 voturi" },
  { value: "500", label: "< 500 voturi" },
  { value: "1000", label: "< 1.000 voturi" },
];

/* ─── Party Badge ───────────────────────────────────────────────── */

function PartyBadge({ abbrev, color }: { abbrev: string; color: string }) {
  if (!abbrev) return null;
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold text-white leading-none whitespace-nowrap"
      style={{ backgroundColor: color }}
    >
      {abbrev}
    </span>
  );
}

/* ─── Tooltip ───────────────────────────────────────────────────── */

function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative inline-block ml-1">
      <button
        type="button"
        className="text-gray-400 hover:text-civic-blue-500 transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >
        <Info size={14} />
      </button>
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg">
          {text}
        </span>
      )}
    </span>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────── */

export default function AlegeriLocalePage() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [tabData, setTabData] = useState<Record<string, ResultEntry[]>>({});
  const [activeTab, setActiveTab] = useState<TabKey>("primari");
  const [loading, setLoading] = useState(true);
  const [histMode, setHistMode] = useState<"absolute" | "pctElig" | "pctNonVot">("absolute");

  // Filters
  const [filterJudet, setFilterJudet] = useState("");
  const [filterSizeCat, setFilterSizeCat] = useState("");
  const [filterMargin, setFilterMargin] = useState("");
  const [searchText, setSearchText] = useState("");

  // Sort & pagination
  const [sortCol, setSortCol] = useState("margin");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [page, setPage] = useState(1);
  const perPage = 50;

  // Load summary on mount
  useEffect(() => {
    fetch("/data/alegeri-2024/summary.json")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d);
        setLoading(false);
      })
      .catch((e) => {
        console.error("Failed to load summary", e);
        setLoading(false);
      });
  }, []);

  // Load tab data
  useEffect(() => {
    if (activeTab === "presedinte_cj") return; // data is in summary
    if (tabData[activeTab]) return;

    setLoading(true);
    fetch(`/data/alegeri-2024/${activeTab}.json`)
      .then((r) => r.json())
      .then((d) => {
        setTabData((prev) => ({ ...prev, [activeTab]: d }));
        setLoading(false);
      })
      .catch((e) => {
        console.error(`Failed to load ${activeTab}`, e);
        setLoading(false);
      });
  }, [activeTab, tabData]);

  // Reset filters on tab change
  useEffect(() => {
    setFilterJudet("");
    setFilterSizeCat("");
    setFilterMargin("");
    setSearchText("");
    setPage(1);
    setSortCol("margin");
    setSortDir(1);
  }, [activeTab]);

  const currentSummary: Summary | null = useMemo(() => {
    if (!summary) return null;
    if (activeTab === "primari") return summary.primari;
    if (activeTab === "consiliu_local") return summary.consiliuLocal;
    return null;
  }, [summary, activeTab]);

  const currentData: ResultEntry[] = useMemo(() => {
    return tabData[activeTab] || [];
  }, [tabData, activeTab]);

  const isPrimari = activeTab === "primari";
  const isPCJ = activeTab === "presedinte_cj";

  // ── Filtered & sorted data ──

  const filtered = useMemo(() => {
    const maxMargin = filterMargin ? parseInt(filterMargin) : Infinity;
    const search = searchText.toLowerCase().trim();

    return currentData.filter((r) => {
      if (filterJudet && r.judet !== filterJudet) return false;
      if (filterSizeCat && r.sizeCat !== filterSizeCat) return false;
      if (r.margin >= maxMargin) return false;
      if (search) {
        return (
          r.uat.toLowerCase().includes(search) ||
          r.firstCand?.toLowerCase().includes(search) ||
          r.secondCand?.toLowerCase().includes(search) ||
          r.firstParty?.toLowerCase().includes(search) ||
          r.secondParty?.toLowerCase().includes(search)
        );
      }
      return true;
    });
  }, [currentData, filterJudet, filterSizeCat, filterMargin, searchText]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = (a as any)[sortCol];
      const vb = (b as any)[sortCol];
      if (typeof va === "string") return sortDir * va.localeCompare(vb);
      return sortDir * (va - vb);
    });
  }, [filtered, sortCol, sortDir]);

  const totalPages = Math.ceil(sorted.length / perPage);
  const paginated = sorted.slice((page - 1) * perPage, page * perPage);

  const handleSort = useCallback(
    (col: string) => {
      if (sortCol === col) {
        setSortDir((d) => (d === 1 ? -1 : 1));
      } else {
        setSortCol(col);
        setSortDir(1);
      }
      setPage(1);
    },
    [sortCol]
  );

  if (loading && !summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-civic-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Se încarcă datele electorale...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-red-500">Eroare la încărcarea datelor.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 pt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
            Alegeri Locale 2024
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400 max-w-3xl">
            Cât de strâns s-a câștigat în fiecare localitate? Analiză interactivă a
            diferențelor de voturi între câștigător și locul 2.
          </p>
          <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">
            Date oficiale: Autoritatea Electorală Permanentă — 9 iunie 2024
          </p>
        </div>
      </div>

      {/* Tab nav */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-14 z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-civic-blue-600 text-civic-blue-600 dark:text-civic-blue-400"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-10">
        {/* ─── PCJ special view ─── */}
        {isPCJ && <PCJView data={summary.presedinteCJ} />}

        {/* ─── Standard view (P / CL) ─── */}
        {!isPCJ && currentSummary && (
          <>
            {/* HERO CARDS */}
            <HeroSection summary={currentSummary} isPrimari={isPrimari} />

            {/* FUNNEL */}
            <FunnelSection summary={currentSummary} isPrimari={isPrimari} />

            {/* HISTOGRAM */}
            <HistogramSection
              summary={currentSummary}
              histMode={histMode}
              setHistMode={setHistMode}
              isPrimari={isPrimari}
            />

            {/* CATEGORIES */}
            <CategoriesSection summary={currentSummary} isPrimari={isPrimari} />

            {/* DETAIL TABLE */}
            <section>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                Toate {isPrimari ? "localitățile" : "localitățile"} — detaliu
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {isPrimari
                  ? "Fiecare rând reprezintă o localitate. Sortează sau filtrează pentru a găsi cele mai strânse curse."
                  : "Fiecare rând arată diferența dintre primele două partide ca număr total de voturi la nivel de localitate."}
              </p>

              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-3">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Caută localitate sau candidat..."
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-civic-blue-500 focus:border-transparent w-64"
                  />
                </div>
                <select
                  value={filterJudet}
                  onChange={(e) => {
                    setFilterJudet(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Toate județele</option>
                  {summary.judete.map((j) => (
                    <option key={j} value={j}>
                      {j}
                    </option>
                  ))}
                </select>
                <select
                  value={filterSizeCat}
                  onChange={(e) => {
                    setFilterSizeCat(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">Toate categoriile</option>
                  {summary.sizeCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <select
                  value={filterMargin}
                  onChange={(e) => {
                    setFilterMargin(e.target.value);
                    setPage(1);
                  }}
                  className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  {MARGIN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-gray-500 mb-2">
                {fmtNum(filtered.length)} rezultate din {fmtNum(currentData.length)}
              </p>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-left">
                      <SortTh col="judet" current={sortCol} dir={sortDir} onSort={handleSort}>
                        Județ
                      </SortTh>
                      <SortTh col="uat" current={sortCol} dir={sortDir} onSort={handleSort}>
                        Localitate
                      </SortTh>
                      <th className="px-2 py-2 font-medium hidden lg:table-cell">Categorie</th>
                      <th className="px-2 py-2 font-medium">
                        {isPrimari ? "Câștigător" : "Locul 1"}
                      </th>
                      <SortTh
                        col="firstVotes"
                        current={sortCol}
                        dir={sortDir}
                        onSort={handleSort}
                        className="text-right"
                      >
                        Voturi
                      </SortTh>
                      <th className="px-2 py-2 font-medium">Locul 2</th>
                      <SortTh
                        col="secondVotes"
                        current={sortCol}
                        dir={sortDir}
                        onSort={handleSort}
                        className="text-right"
                      >
                        Voturi
                      </SortTh>
                      <SortTh
                        col="margin"
                        current={sortCol}
                        dir={sortDir}
                        onSort={handleSort}
                        className="text-right"
                      >
                        Diferența
                      </SortTh>
                      <SortTh
                        col="marginPctElig"
                        current={sortCol}
                        dir={sortDir}
                        onSort={handleSort}
                        className="text-right hidden md:table-cell"
                      >
                        % Elig.
                        <InfoTip text="Diferența raportată la toți alegătorii înscriși. Cu cât e mai mic, cu atât mai puțini cetățeni au decis soarta alegerilor." />
                      </SortTh>
                      <SortTh
                        col="marginPctNonVoters"
                        current={sortCol}
                        dir={sortDir}
                        onSort={handleSort}
                        className="text-right hidden md:table-cell"
                      >
                        % Absenți
                        <InfoTip text="Procentul din cetățenii care nu au votat care ar fi fost suficient să schimbe rezultatul. Cu cât e mai mic, cu atât era mai ușor de schimbat." />
                      </SortTh>
                      <SortTh
                        col="eligible"
                        current={sortCol}
                        dir={sortDir}
                        onSort={handleSort}
                        className="text-right hidden lg:table-cell"
                      >
                        Eligibili
                      </SortTh>
                      <SortTh
                        col="prezenta"
                        current={sortCol}
                        dir={sortDir}
                        onSort={handleSort}
                        className="text-right hidden lg:table-cell"
                      >
                        Prezența
                      </SortTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {paginated.map((r, i) => (
                      <tr
                        key={`${r.judet}-${r.uat}-${i}`}
                        className="hover:bg-gray-50 dark:hover:bg-gray-900/50 bg-white dark:bg-gray-950"
                      >
                        <td className="px-2 py-2 text-gray-500">{r.judet}</td>
                        <td className="px-2 py-2 font-medium text-gray-900 dark:text-white">
                          {r.uat}
                        </td>
                        <td className="px-2 py-2 text-gray-400 text-xs hidden lg:table-cell">
                          {r.sizeCat}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <PartyBadge abbrev={r.firstAbbrev} color={r.firstColor} />
                            <span className="text-gray-900 dark:text-white truncate max-w-[140px]">
                              {isPrimari ? formatCandName(r.firstCand) : r.firstParty}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums font-medium">
                          {fmtNum(r.firstVotes)}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <PartyBadge abbrev={r.secondAbbrev} color={r.secondColor} />
                            <span className="text-gray-600 dark:text-gray-300 truncate max-w-[140px]">
                              {isPrimari ? formatCandName(r.secondCand) : r.secondParty}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums">
                          {fmtNum(r.secondVotes)}
                        </td>
                        <td
                          className={`px-2 py-2 text-right tabular-nums font-bold ${
                            r.margin <= 100
                              ? "text-red-600"
                              : r.margin <= 500
                              ? "text-amber-600"
                              : "text-gray-900 dark:text-white"
                          }`}
                        >
                          {fmtNum(r.margin)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">
                          {fmtPct(r.marginPctElig)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">
                          {fmtPct(r.marginPctNonVoters)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-400 hidden lg:table-cell">
                          {fmtNum(r.eligible)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-400 hidden lg:table-cell">
                          {r.prezenta}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-4">
                  <PagBtn onClick={() => setPage(1)} disabled={page === 1}>
                    <ChevronsLeft size={16} />
                  </PagBtn>
                  <PagBtn onClick={() => setPage(page - 1)} disabled={page === 1}>
                    <ChevronLeft size={16} />
                  </PagBtn>
                  <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                    {page} / {totalPages}
                  </span>
                  <PagBtn onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                    <ChevronRight size={16} />
                  </PagBtn>
                  <PagBtn onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                    <ChevronsRight size={16} />
                  </PagBtn>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-6 mt-10">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
          Date:{" "}
          <a
            href="https://www.roaep.ro/"
            target="_blank"
            rel="noopener"
            className="text-civic-blue-600 hover:underline"
          >
            Autoritatea Electorală Permanentă
          </a>{" "}
          — Alegeri locale 9 iunie 2024
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────── */

function formatCandName(name: string): string {
  if (!name) return "";
  // Convert "DRĂGUŞIN TEODOR-GEORGIAN" -> "Drăguşin T.-G."
  // Keep it simple: just title-case the surname
  const parts = name.split(" ");
  if (parts.length === 0) return name;
  const surname = parts[0].charAt(0) + parts[0].slice(1).toLowerCase();
  const initials = parts
    .slice(1)
    .map((p) => p.charAt(0) + ".")
    .join("");
  return `${surname} ${initials}`;
}

function SortTh({
  col,
  current,
  dir,
  onSort,
  children,
  className = "",
}: {
  col: string;
  current: string;
  dir: 1 | -1;
  onSort: (col: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const isActive = current === col;
  return (
    <th
      className={`px-2 py-2 font-medium cursor-pointer select-none hover:text-civic-blue-600 ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          <span className="text-civic-blue-600">{dir === 1 ? "▲" : "▼"}</span>
        ) : (
          <ArrowUpDown size={12} className="text-gray-300" />
        )}
      </span>
    </th>
  );
}

function PagBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-lg border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

/* ─── Hero Section ──────────────────────────────────────────────── */

function HeroSection({ summary, isPrimari }: { summary: Summary; isPrimari: boolean }) {
  const total = summary.total;
  const under500 = summary.globalAbsolute.find((x) => x.threshold === 500);
  const under100 = summary.globalAbsolute.find((x) => x.threshold === 100);
  const under5PctElig = summary.globalPctElig.find((x) => x.threshold === 5);

  const entityName = isPrimari ? "primari" : "consilii locale";
  const entitySg = isPrimari ? "primarul" : "consiliul";

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">La un pas de altfel</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Câte {isPrimari ? "funcții de primar" : "consilii locale"} s-au decis la diferențe minime de voturi
      </p>
      <div className="grid md:grid-cols-3 gap-4">
        <HeroCard
          icon={<BarChart3 className="text-red-500" size={28} />}
          value={under500 ? fmtPct((under500.count / total) * 100) : "—"}
          desc={`${isPrimari ? "Câștigate" : "Decise"} cu sub 500 de voturi`}
          sub={
            isPrimari
              ? "Într-o comună tipică, un sat mic ar fi putut schimba primarul"
              : "Suficient de puțin încât câteva familii din sat ar fi făcut diferența"
          }
          accent="red"
        />
        <HeroCard
          icon={<Users className="text-amber-500" size={28} />}
          value={under100 ? fmtNum(under100.count) : "—"}
          desc={`${isPrimari ? "Localități" : "Consilii"} decise de sub 100 de voturi`}
          sub="Mai puțin decât elevii unei singure școli"
          accent="amber"
        />
        <HeroCard
          icon={<TrendingUp className="text-civic-blue-500" size={28} />}
          value={under5PctElig ? fmtPct((under5PctElig.count / total) * 100) : "—"}
          desc="Diferență sub 5% din alegătorii înscriși"
          sub={`Dacă doar 1 din 20 de cetățeni ar fi votat diferit, ${entitySg} ar fi fost altul`}
          accent="blue"
        />
      </div>
    </section>
  );
}

function HeroCard({
  icon,
  value,
  desc,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  value: string;
  desc: string;
  sub: string;
  accent: string;
}) {
  const borderColor =
    accent === "red"
      ? "border-red-200 dark:border-red-900/50"
      : accent === "amber"
      ? "border-amber-200 dark:border-amber-900/50"
      : "border-civic-blue-200 dark:border-civic-blue-900/50";

  return (
    <div
      className={`bg-white dark:bg-gray-900 rounded-xl border ${borderColor} p-5`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">{value}</div>
          <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mt-1">{desc}</div>
          <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">{sub}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Funnel Section ────────────────────────────────────────────── */

function FunnelSection({ summary, isPrimari }: { summary: Summary; isPrimari: boolean }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
        Câte {isPrimari ? "localități" : "consilii"} au fost decise la limită?
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        O diferență de sub 50 de voturi înseamnă că dacă doar 26 de oameni ar fi votat diferit,
        rezultatul se schimba.
      </p>
      <div className="space-y-2">
        {FUNNEL_THRESHOLDS.map((t) => {
          const item = summary.globalAbsolute.find((x) => x.threshold === t);
          if (!item) return null;
          const analogy = FUNNEL_ANALOGIES[t];
          return (
            <div
              key={t}
              className="relative bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden"
            >
              <div
                className="absolute inset-y-0 left-0 bg-civic-blue-50 dark:bg-civic-blue-900/20"
                style={{ width: `${Math.max(item.pct, 2)}%` }}
              />
              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[100px]">
                    &lt; {fmtNum(t)} voturi
                  </span>
                  {analogy && (
                    <span className="text-xs text-gray-400 italic hidden sm:inline">
                      ({analogy})
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-civic-blue-600">
                    {fmtNum(item.count)}
                  </span>
                  <span className="text-xs text-gray-400 ml-1">({item.pct}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ─── Histogram Section ─────────────────────────────────────────── */

function HistogramSection({
  summary,
  histMode,
  setHistMode,
  isPrimari,
}: {
  summary: Summary;
  histMode: string;
  setHistMode: (m: "absolute" | "pctElig" | "pctNonVot") => void;
  isPrimari: boolean;
}) {
  const chartData = useMemo(() => {
    if (histMode === "absolute") {
      return {
        labels: summary.histogram.map((h) => h.label),
        values: summary.histogram.map((h) => h.count),
      };
    }
    const source =
      histMode === "pctElig" ? summary.globalPctElig : summary.globalPctNonVoters;
    let prev = 0;
    const labels: string[] = [];
    const values: number[] = [];
    source.forEach((item) => {
      labels.push(`< ${item.threshold}%`);
      values.push(item.count - prev);
      prev = item.count;
    });
    return { labels, values };
  }, [summary, histMode]);

  const modeButtons = [
    { key: "absolute" as const, label: "Nr. voturi" },
    { key: "pctElig" as const, label: "% eligibili" },
    { key: "pctNonVot" as const, label: "% absenți" },
  ];

  const dynamicTitle =
    histMode === "absolute"
      ? `Jumătate din ${isPrimari ? "primari" : "consilii"} au câștigat cu sub ${fmtNum(summary.medianMargin)} voturi diferență`
      : histMode === "pctElig"
      ? "Distribuția diferențelor ca procent din alegătorii înscriși"
      : "Distribuția diferențelor ca procent din cei care nu au votat";

  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
        Distribuția diferențelor
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{dynamicTitle}</p>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        {/* Legend */}
        <div className="mb-3 text-xs text-gray-500 dark:text-gray-400 space-y-1">
          <p>
            <strong>Nr. voturi</strong> — diferența brută între primii doi clasați
          </p>
          <p>
            <strong>% eligibili</strong> — diferența raportată la toți oamenii cu drept de vot
          </p>
          <p>
            <strong>% absenți</strong> — diferența raportată la cei care{" "}
            <em>nu au ieșit la vot</em>. Dacă e mic, o mică mobilizare suplimentară schimba
            rezultatul.
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex gap-1 mb-4">
          {modeButtons.map((m) => (
            <button
              key={m.key}
              onClick={() => setHistMode(m.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                histMode === m.key
                  ? "bg-civic-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="h-64">
          <Bar
            data={{
              labels: chartData.labels,
              datasets: [
                {
                  label: "Localități",
                  data: chartData.values,
                  backgroundColor: "rgba(26, 102, 204, 0.5)",
                  borderColor: "rgba(26, 102, 204, 1)",
                  borderWidth: 1,
                  borderRadius: 4,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${(ctx.parsed.y ?? 0).toLocaleString("ro-RO")} localități`,
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: "rgba(128,128,128,0.1)" },
                  ticks: { color: "#9ca3af" },
                },
                x: {
                  grid: { display: false },
                  ticks: { color: "#9ca3af" },
                },
              },
            }}
          />
        </div>
      </div>
    </section>
  );
}

/* ─── Categories Section ────────────────────────────────────────── */

function CategoriesSection({ summary, isPrimari }: { summary: Summary; isPrimari: boolean }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
        Contează diferit în funcție de mărimea localității
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        O diferență de 100 de voturi e uriașă într-o comună mică, dar nesemnificativă într-un
        municipiu. Pragurile de mai jos sunt adaptate la fiecare categorie.
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
              <th className="px-3 py-2 text-left font-medium">Categorie</th>
              <th className="px-3 py-2 text-right font-medium">Nr.</th>
              <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">
                Media elig.
              </th>
              <th className="px-3 py-2 text-right font-medium hidden sm:table-cell">Prezența</th>
              <th className="px-3 py-2 text-right font-medium">Mediană dif.</th>
              {["Extrem de strâns", "Foarte strâns", "Strâns", "Confortabil"].map((lbl, i) => (
                <th
                  key={lbl}
                  className={`px-3 py-2 text-right font-medium hidden md:table-cell ${
                    i === 0
                      ? "text-red-600"
                      : i === 1
                      ? "text-amber-600"
                      : i === 2
                      ? "text-green-600"
                      : "text-gray-400"
                  }`}
                >
                  {lbl}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {summary.categories.map((cat) => (
              <tr
                key={cat.name}
                className="bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900/50"
              >
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white whitespace-nowrap">
                  {cat.name}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{fmtNum(cat.count)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 hidden sm:table-cell">
                  {fmtNum(cat.avgEligible)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 hidden sm:table-cell">
                  {cat.avgPrezenta}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-gray-900 dark:text-white">
                  {fmtNum(cat.medianMargin)}
                </td>
                {cat.adaptiveThresholds.map((t, i) => (
                  <td
                    key={t.threshold}
                    className={`px-3 py-2 text-right tabular-nums hidden md:table-cell ${
                      i === 0
                        ? "text-red-600"
                        : i === 1
                        ? "text-amber-600"
                        : i === 2
                        ? "text-green-600"
                        : "text-gray-400"
                    }`}
                  >
                    <div className="text-xs">
                      &lt;{fmtNum(t.threshold)}v
                    </div>
                    <div className="font-medium">{t.pct}%</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ─── PCJ View ──────────────────────────────────────────────────── */

function PCJView({ data }: { data: { total: number; results: PCJEntry[] } }) {
  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
        Președinte Consiliu Județean — Toate județele
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        {data.total} județe, ordonate de la cel mai strâns rezultat la cel mai confortabil
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-left">
              <th className="px-3 py-2 font-medium">Județ</th>
              <th className="px-3 py-2 font-medium">Câștigător</th>
              <th className="px-3 py-2 text-right font-medium">Voturi</th>
              <th className="px-3 py-2 font-medium">Locul 2</th>
              <th className="px-3 py-2 text-right font-medium">Voturi</th>
              <th className="px-3 py-2 text-right font-medium">Diferența</th>
              <th className="px-3 py-2 text-right font-medium hidden md:table-cell">
                % Elig.
              </th>
              <th className="px-3 py-2 text-right font-medium hidden md:table-cell">
                % Absenți
              </th>
              <th className="px-3 py-2 text-right font-medium hidden lg:table-cell">
                Eligibili
              </th>
              <th className="px-3 py-2 text-right font-medium hidden lg:table-cell">
                Prezența
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {data.results.map((r) => (
              <tr
                key={r.judet}
                className="bg-white dark:bg-gray-950 hover:bg-gray-50 dark:hover:bg-gray-900/50"
              >
                <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">
                  {r.judet}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <PartyBadge abbrev={r.firstAbbrev} color={r.firstColor} />
                    <span className="text-gray-900 dark:text-white truncate max-w-[160px]">
                      {formatCandName(r.firstCand)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">
                  {fmtNum(r.firstVotes)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <PartyBadge abbrev={r.secondAbbrev} color={r.secondColor} />
                    <span className="text-gray-600 dark:text-gray-300 truncate max-w-[160px]">
                      {formatCandName(r.secondCand)}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {fmtNum(r.secondVotes)}
                </td>
                <td
                  className={`px-3 py-2 text-right tabular-nums font-bold ${
                    r.margin <= 5000
                      ? "text-red-600"
                      : r.margin <= 20000
                      ? "text-amber-600"
                      : "text-gray-900 dark:text-white"
                  }`}
                >
                  {fmtNum(r.margin)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">
                  {fmtPct(r.marginPctElig)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-500 hidden md:table-cell">
                  {fmtPct(r.marginPctNonVoters)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-400 hidden lg:table-cell">
                  {fmtNum(r.eligible)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-gray-400 hidden lg:table-cell">
                  {r.prezenta}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
