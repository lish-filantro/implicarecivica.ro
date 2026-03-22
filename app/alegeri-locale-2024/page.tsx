"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
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

interface PCJEntry extends ResultEntry {}

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

const TABS: { key: TabKey; label: string; desc: string }[] = [
  { key: "primari", label: "Primari", desc: "Cursa pentru primar în fiecare localitate" },
  { key: "consiliu_local", label: "Consilii Locale", desc: "Diferența dintre primele două partide/alianțe" },
  { key: "presedinte_cj", label: "Consilii Județene", desc: "Cursa pentru președinte de consiliu județean" },
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
        className="text-gray-400 hover:text-blue-600 transition-colors"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
      >
        <Info size={14} />
      </button>
      {show && (
        <span className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl leading-relaxed">
          {text}
        </span>
      )}
    </span>
  );
}

/* ─── Section wrapper with explanation ──────────────────────────── */

function Section({
  title,
  explanation,
  children,
}: {
  title: string;
  explanation: string | React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-xl font-bold text-gray-900 mb-2">{title}</h2>
      <div className="text-sm text-gray-600 mb-5 max-w-3xl leading-relaxed">
        {typeof explanation === "string" ? <p>{explanation}</p> : explanation}
      </div>
      {children}
    </section>
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

  useEffect(() => {
    fetch("/data/alegeri-2024/summary.json")
      .then((r) => r.json())
      .then((d) => {
        setSummary(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (activeTab === "presedinte_cj") return;
    if (tabData[activeTab]) return;
    setLoading(true);
    fetch(`/data/alegeri-2024/${activeTab}.json`)
      .then((r) => r.json())
      .then((d) => {
        setTabData((prev) => ({ ...prev, [activeTab]: d }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [activeTab, tabData]);

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
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-500">Se incarca datele electorale...</p>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-red-600 font-medium">Eroare la incarcarea datelor.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 pt-20">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="font-heading text-3xl md:text-4xl font-bold text-gray-900">
            Alegeri Locale 2024
          </h1>
          <p className="mt-3 text-lg text-gray-700 max-w-3xl leading-relaxed">
            Cat de strans s-a castigat in fiecare localitate din Romania?
            Aceasta pagina analizeaza <strong>diferenta de voturi</strong> dintre
            castigator si locul 2, la alegerile locale din 9 iunie 2024.
          </p>
          <p className="mt-2 text-sm text-gray-500 max-w-3xl leading-relaxed">
            <strong>De ce conteaza?</strong> Daca diferenta e mica, inseamna ca
            un numar mic de cetateni care nu au votat ar fi putut schimba
            rezultatul. Cu cat diferenta e mai mica, cu atat fiecare vot a
            contat mai mult.
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Sursa datelor: Autoritatea Electorala Permanenta (AEP) — 9 iunie 2024
          </p>
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div className="bg-white border-b border-gray-200 sticky top-14 z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Tab description ── */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <p className="text-sm text-gray-500 italic">
          {TABS.find((t) => t.key === activeTab)?.desc}
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 space-y-12">
        {isPCJ && <PCJView data={summary.presedinteCJ} />}

        {!isPCJ && currentSummary && (
          <>
            <HeroSection summary={currentSummary} isPrimari={isPrimari} />
            <FunnelSection summary={currentSummary} isPrimari={isPrimari} />
            <HistogramSection
              summary={currentSummary}
              histMode={histMode}
              setHistMode={setHistMode}
              isPrimari={isPrimari}
            />
            <CategoriesSection summary={currentSummary} isPrimari={isPrimari} />

            {/* ── DETAIL TABLE ── */}
            <Section
              title={`Toate ${isPrimari ? "localitățile" : "consiliile locale"} — tabel detaliat`}
              explanation={
                isPrimari ? (
                  <p>
                    Fiecare rand reprezinta o localitate (comuna, oras sau municipiu).
                    <strong> Castigatorul</strong> e candidatul cu cele mai multe voturi,
                    iar <strong>Locul 2</strong> e urmatorul clasat.
                    Coloana <strong>Diferenta</strong> (evidentiata) arata cate voturi au
                    despartit primii doi. Poti sorta, filtra dupa judet sau categorie, si
                    cauta dupa nume.
                  </p>
                ) : (
                  <p>
                    Fiecare rand arata diferenta dintre <strong>primele doua partide sau
                    aliante</strong> ca numar total de voturi la nivel de localitate.
                    Nu e vorba de mandate, ci de voturile brute. Diferenta mica inseamna
                    ca o mobilizare minima ar fi schimbat echilibrul de forte in consiliu.
                  </p>
                )
              }
            >
              {/* Filters */}
              <div className="flex flex-wrap gap-2 mb-3">
                <div className="relative">
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Cauta localitate sau candidat..."
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setPage(1);
                    }}
                    className="pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                  />
                </div>
                <select
                  value={filterJudet}
                  onChange={(e) => { setFilterJudet(e.target.value); setPage(1); }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option value="">Toate judetele</option>
                  {summary.judete.map((j) => (
                    <option key={j} value={j}>{j}</option>
                  ))}
                </select>
                <select
                  value={filterSizeCat}
                  onChange={(e) => { setFilterSizeCat(e.target.value); setPage(1); }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  <option value="">Toate categoriile</option>
                  {summary.sizeCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={filterMargin}
                  onChange={(e) => { setFilterMargin(e.target.value); setPage(1); }}
                  className="px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white text-gray-900"
                >
                  {MARGIN_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <p className="text-xs text-gray-500 mb-2">
                {fmtNum(filtered.length)} rezultate din {fmtNum(currentData.length)}
              </p>

              {/* Column legend */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-gray-700 space-y-1">
                <p className="font-semibold text-blue-800 mb-1">Ce inseamna coloanele:</p>
                <p><strong>Diferenta</strong> — numarul de voturi care au despartit castigatorul de locul 2.
                  <span className="text-red-600 font-semibold"> Rosu</span> = sub 100 voturi (extrem de strans),
                  <span className="text-amber-600 font-semibold"> portocaliu</span> = sub 500 voturi (strans).</p>
                <p><strong>% Elig.</strong> — diferenta ca procent din toti alegatorii inscrisi. Ex: 0.5% inseamna ca doar 1 din 200 de cetateni a facut diferenta.</p>
                <p><strong>% Absenti</strong> — diferenta ca procent din cei care <em>nu au votat</em>. Daca e 2%, inseamna ca daca doar 2% din absentii la vot ar fi venit, rezultatul se putea schimba.</p>
                <p><strong>Eligibili</strong> — toti cetatenii cu drept de vot din acea localitate. <strong>Prezenta</strong> — procentul celor care au votat efectiv.</p>
              </div>

              {/* Table */}
              <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700 text-left">
                      <SortTh col="judet" current={sortCol} dir={sortDir} onSort={handleSort}>
                        Judet
                      </SortTh>
                      <SortTh col="uat" current={sortCol} dir={sortDir} onSort={handleSort}>
                        Localitate
                      </SortTh>
                      <th className="px-2 py-2.5 font-medium text-gray-500 hidden lg:table-cell">Categorie</th>
                      <th className="px-2 py-2.5 font-medium">
                        {isPrimari ? "Castigator" : "Locul 1"}
                      </th>
                      <SortTh col="firstVotes" current={sortCol} dir={sortDir} onSort={handleSort} className="text-right">
                        Voturi
                      </SortTh>
                      <th className="px-2 py-2.5 font-medium">Locul 2</th>
                      <SortTh col="secondVotes" current={sortCol} dir={sortDir} onSort={handleSort} className="text-right">
                        Voturi
                      </SortTh>
                      <SortTh col="margin" current={sortCol} dir={sortDir} onSort={handleSort} className="text-right bg-yellow-50">
                        Diferenta
                      </SortTh>
                      <SortTh col="marginPctElig" current={sortCol} dir={sortDir} onSort={handleSort} className="text-right hidden md:table-cell">
                        % Elig.
                      </SortTh>
                      <SortTh col="marginPctNonVoters" current={sortCol} dir={sortDir} onSort={handleSort} className="text-right hidden md:table-cell">
                        % Absenti
                      </SortTh>
                      <SortTh col="eligible" current={sortCol} dir={sortDir} onSort={handleSort} className="text-right hidden lg:table-cell">
                        Eligibili
                      </SortTh>
                      <SortTh col="prezenta" current={sortCol} dir={sortDir} onSort={handleSort} className="text-right hidden lg:table-cell">
                        Prezenta
                      </SortTh>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {paginated.map((r, i) => (
                      <tr key={`${r.judet}-${r.uat}-${i}`} className="hover:bg-blue-50/50 bg-white">
                        <td className="px-2 py-2 text-gray-600">{r.judet}</td>
                        <td className="px-2 py-2 font-medium text-gray-900">{r.uat}</td>
                        <td className="px-2 py-2 text-gray-400 text-xs hidden lg:table-cell">{r.sizeCat}</td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <PartyBadge abbrev={r.firstAbbrev} color={r.firstColor} />
                            <span className="text-gray-900 truncate max-w-[140px]">
                              {isPrimari ? formatCandName(r.firstCand) : r.firstParty}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums font-medium text-gray-800">
                          {fmtNum(r.firstVotes)}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1.5">
                            <PartyBadge abbrev={r.secondAbbrev} color={r.secondColor} />
                            <span className="text-gray-700 truncate max-w-[140px]">
                              {isPrimari ? formatCandName(r.secondCand) : r.secondParty}
                            </span>
                          </div>
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-700">
                          {fmtNum(r.secondVotes)}
                        </td>
                        <td className={`px-2 py-2 text-right tabular-nums font-bold bg-yellow-50 ${
                          r.margin <= 100 ? "text-red-700" : r.margin <= 500 ? "text-amber-700" : "text-gray-900"
                        }`}>
                          {fmtNum(r.margin)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-600 hidden md:table-cell">
                          {fmtPct(r.marginPctElig)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-600 hidden md:table-cell">
                          {fmtPct(r.marginPctNonVoters)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 hidden lg:table-cell">
                          {fmtNum(r.eligible)}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-gray-500 hidden lg:table-cell">
                          {r.prezenta}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-4">
                  <PagBtn onClick={() => setPage(1)} disabled={page === 1}>
                    <ChevronsLeft size={16} />
                  </PagBtn>
                  <PagBtn onClick={() => setPage(page - 1)} disabled={page === 1}>
                    <ChevronLeft size={16} />
                  </PagBtn>
                  <span className="px-3 py-1 text-sm text-gray-600">
                    Pagina {page} din {totalPages}
                  </span>
                  <PagBtn onClick={() => setPage(page + 1)} disabled={page === totalPages}>
                    <ChevronRight size={16} />
                  </PagBtn>
                  <PagBtn onClick={() => setPage(totalPages)} disabled={page === totalPages}>
                    <ChevronsRight size={16} />
                  </PagBtn>
                </div>
              )}
            </Section>
          </>
        )}
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8 mt-10">
        <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500 space-y-2">
          <p>
            Date oficiale:{" "}
            <a href="https://www.roaep.ro/" target="_blank" rel="noopener" className="text-blue-600 hover:underline">
              Autoritatea Electorala Permanenta
            </a>{" "}
            — Alegeri locale 9 iunie 2024
          </p>
          <p className="text-xs text-gray-400">
            Aceasta pagina afiseaza date publice. Diferenta = voturile castigatorului minus voturile locului 2.
            Nu include turul 2 sau alegerile din Bucuresti.
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ────────────────────────────────────────────── */

function formatCandName(name: string): string {
  if (!name) return "";
  const parts = name.split(" ");
  if (parts.length === 0) return name;
  const surname = parts[0].charAt(0) + parts[0].slice(1).toLowerCase();
  const initials = parts.slice(1).map((p) => p.charAt(0) + ".").join("");
  return `${surname} ${initials}`;
}

function SortTh({
  col, current, dir, onSort, children, className = "",
}: {
  col: string; current: string; dir: 1 | -1; onSort: (col: string) => void;
  children: React.ReactNode; className?: string;
}) {
  const isActive = current === col;
  return (
    <th
      className={`px-2 py-2.5 font-medium cursor-pointer select-none hover:text-blue-700 ${className}`}
      onClick={() => onSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {isActive ? (
          <span className="text-blue-600">{dir === 1 ? "▲" : "▼"}</span>
        ) : (
          <ArrowUpDown size={12} className="text-gray-300" />
        )}
      </span>
    </th>
  );
}

function PagBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-1.5 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
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
  const under5PctNonVot = summary.globalPctNonVoters.find((x) => x.threshold === 5);

  return (
    <Section
      title="La un pas de altfel"
      explanation={
        isPrimari
          ? "Aceste cifre arata cat de strans a fost rezultatul in multe localitati. O diferenta mica inseamna ca un numar foarte mic de cetateni — uneori doar cateva familii — au decis cine va fi primarul pentru urmatorii 4 ani."
          : "Aceste cifre arata cat de strans a fost clasamentul pe partide. O diferenta mica de voturi putea schimba echilibrul de forte in consiliul local."
      }
    >
      <div className="grid md:grid-cols-3 gap-4">
        <HeroCard
          icon={<BarChart3 className="text-red-500" size={28} />}
          value={under500 ? fmtPct((under500.count / total) * 100) : "—"}
          valueDetail={under500 ? `(${fmtNum(under500.count)} din ${fmtNum(total)})` : ""}
          desc={isPrimari ? "Primari castigati cu sub 500 de voturi" : "Consilii decise cu sub 500 de voturi diferenta"}
          sub={isPrimari
            ? "Intr-o comuna tipica, un sat mic ar fi putut schimba primarul"
            : "Suficient de putin incat cateva familii din sat ar fi facut diferenta"}
          accent="red"
        />
        <HeroCard
          icon={<Users className="text-amber-500" size={28} />}
          value={under100 ? fmtNum(under100.count) + " localitati" : "—"}
          valueDetail={under100 ? `(${fmtPct((under100.count / total) * 100)} din total)` : ""}
          desc={isPrimari ? "Decise de sub 100 de voturi" : "Diferenta sub 100 de voturi"}
          sub="Mai putin decat elevii unei singure scoli"
          accent="amber"
        />
        <HeroCard
          icon={<TrendingUp className="text-blue-500" size={28} />}
          value={under5PctNonVot ? fmtPct((under5PctNonVot.count / total) * 100) : "—"}
          valueDetail={under5PctNonVot ? `(${fmtNum(under5PctNonVot.count)} localitati)` : ""}
          desc="Diferenta sub 5% din cei care nu au votat"
          sub={isPrimari
            ? "Daca doar 1 din 20 de absenti venea la vot, primarul putea fi altul"
            : "Daca doar 1 din 20 de absenti venea la vot, rezultatul se schimba"}
          accent="blue"
        />
      </div>
    </Section>
  );
}

function HeroCard({
  icon, value, valueDetail, desc, sub, accent,
}: {
  icon: React.ReactNode; value: string; valueDetail: string;
  desc: string; sub: string; accent: string;
}) {
  const border = accent === "red" ? "border-red-200" : accent === "amber" ? "border-amber-200" : "border-blue-200";
  const bg = accent === "red" ? "bg-red-50" : accent === "amber" ? "bg-amber-50" : "bg-blue-50";

  return (
    <div className={`${bg} rounded-xl border ${border} p-5`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">{icon}</div>
        <div>
          <div className="text-3xl font-bold text-gray-900">{value}</div>
          {valueDetail && <div className="text-xs text-gray-500 mt-0.5">{valueDetail}</div>}
          <div className="text-sm font-medium text-gray-800 mt-1.5">{desc}</div>
          <div className="text-xs text-gray-500 mt-1 italic">{sub}</div>
        </div>
      </div>
    </div>
  );
}

/* ─── Funnel Section ────────────────────────────────────────────── */

function FunnelSection({ summary, isPrimari }: { summary: Summary; isPrimari: boolean }) {
  return (
    <Section
      title={`Cate ${isPrimari ? "localitati" : "consilii"} au fost decise la limita?`}
      explanation={
        <>
          <p>
            Citeste asa: &quot;&lt; 50 voturi&quot; inseamna ca diferenta dintre castigator
            si locul 2 a fost de cel mult 49 de voturi. Practic, daca doar 26 de oameni
            ar fi votat diferit (de la un candidat la celalalt), rezultatul se schimba.
          </p>
          <p className="mt-1">
            <strong>Analogiile</strong> din paranteze iti arata cat de putini oameni
            sunt in joc — o familie, o ulita, o clasa de elevi.
          </p>
        </>
      }
    >
      <div className="space-y-2">
        {FUNNEL_THRESHOLDS.map((t) => {
          const item = summary.globalAbsolute.find((x) => x.threshold === t);
          if (!item) return null;
          const analogy = FUNNEL_ANALOGIES[t];
          return (
            <div key={t} className="relative bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
              <div
                className="absolute inset-y-0 left-0 bg-blue-100"
                style={{ width: `${Math.max(item.pct, 2)}%` }}
              />
              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-900 min-w-[110px]">
                    &lt; {fmtNum(t)} voturi
                  </span>
                  {analogy && (
                    <span className="text-xs text-gray-500 italic hidden sm:inline">
                      ({analogy})
                    </span>
                  )}
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-blue-700">{fmtNum(item.count)}</span>
                  <span className="text-xs text-gray-500 ml-1.5">({item.pct}%)</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ─── Histogram Section ─────────────────────────────────────────── */

function HistogramSection({
  summary, histMode, setHistMode, isPrimari,
}: {
  summary: Summary; histMode: string;
  setHistMode: (m: "absolute" | "pctElig" | "pctNonVot") => void; isPrimari: boolean;
}) {
  const chartData = useMemo(() => {
    if (histMode === "absolute") {
      return {
        labels: summary.histogram.map((h) => h.label),
        values: summary.histogram.map((h) => h.count),
      };
    }
    const source = histMode === "pctElig" ? summary.globalPctElig : summary.globalPctNonVoters;
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
    { key: "absolute" as const, label: "Nr. voturi", help: "Diferenta bruta in voturi" },
    { key: "pctElig" as const, label: "% din eligibili", help: "Raportata la toti alegatorii" },
    { key: "pctNonVot" as const, label: "% din absenti", help: "Raportata la cei care nu au votat" },
  ];

  return (
    <Section
      title="Distributia diferentelor"
      explanation={
        <>
          <p>
            Graficul arata <strong>cate {isPrimari ? "localitati" : "consilii"}</strong> (axa verticala)
            au avut o anumita diferenta de voturi (axa orizontala). Bara cea mai inalta
            indica intervalul cel mai frecvent.
          </p>
          <p className="mt-1.5">
            <strong>Mediana:</strong> jumatate din {isPrimari ? "primari" : "consilii"} au
            castigat cu mai putin de <strong>{fmtNum(summary.medianMargin)} voturi</strong> diferenta.
          </p>
          <p className="mt-1.5">
            Schimba perspectiva cu butoanele de mai jos:
          </p>
          <ul className="mt-1 ml-4 list-disc space-y-0.5">
            <li><strong>Nr. voturi</strong> — diferenta bruta (cate voturi au despartit primii doi)</li>
            <li><strong>% din eligibili</strong> — diferenta raportata la toti cetatenii cu drept de vot.
              Arata ce procent din populatie a fost de fapt decisiv.</li>
            <li><strong>% din absenti</strong> — diferenta raportata la cei care nu au votat.
              Daca e mic (ex: 2%), inseamna ca o mobilizare minima a absentilor schimba totul.</li>
          </ul>
        </>
      }
    >
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
        <div className="flex flex-wrap gap-1 mb-4">
          {modeButtons.map((m) => (
            <button
              key={m.key}
              onClick={() => setHistMode(m.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                histMode === m.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title={m.help}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className="h-64">
          <Bar
            data={{
              labels: chartData.labels,
              datasets: [{
                label: "Localitati",
                data: chartData.values,
                backgroundColor: "rgba(37, 99, 235, 0.4)",
                borderColor: "rgba(37, 99, 235, 1)",
                borderWidth: 1,
                borderRadius: 4,
              }],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                tooltip: {
                  backgroundColor: "#1f2937",
                  titleColor: "#fff",
                  bodyColor: "#e5e7eb",
                  callbacks: {
                    title: (ctx) => {
                      const label = ctx[0].label;
                      return histMode === "absolute"
                        ? `Diferenta: ${label} voturi`
                        : histMode === "pctElig"
                        ? `Diferenta: ${label} din eligibili`
                        : `Diferenta: ${label} din absenti`;
                    },
                    label: (ctx) => `${(ctx.parsed.y ?? 0).toLocaleString("ro-RO")} localitati`,
                  },
                },
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: "rgba(0,0,0,0.06)" },
                  ticks: { color: "#6b7280" },
                  title: { display: true, text: "Nr. localitati", color: "#374151", font: { size: 12 } },
                },
                x: {
                  grid: { display: false },
                  ticks: { color: "#6b7280" },
                  title: {
                    display: true,
                    text: histMode === "absolute" ? "Diferenta (nr. voturi)" : histMode === "pctElig" ? "Diferenta (% din eligibili)" : "Diferenta (% din absenti)",
                    color: "#374151",
                    font: { size: 12 },
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </Section>
  );
}

/* ─── Categories Section ────────────────────────────────────────── */

function CategoriesSection({ summary, isPrimari }: { summary: Summary; isPrimari: boolean }) {
  return (
    <Section
      title="Conteaza diferit in functie de marimea localitatii"
      explanation={
        <>
          <p>
            O diferenta de 100 de voturi e uriasa intr-o comuna mica (unde sunt 800 de alegatori),
            dar nesemnificativa intr-un municipiu mare (cu 200.000 de alegatori).
          </p>
          <p className="mt-1.5">
            De aceea, localitățile sunt grupate in 10 categorii de marime. Pragurile din tabel
            sunt adaptate la fiecare categorie:
          </p>
          <ul className="mt-1 ml-4 list-disc space-y-0.5">
            <li><span className="text-red-700 font-semibold">Extrem de strans</span> — diferenta sub ~1% din eligibili</li>
            <li><span className="text-amber-700 font-semibold">Foarte strans</span> — diferenta sub ~3% din eligibili</li>
            <li><span className="text-green-700 font-semibold">Strans</span> — diferenta sub ~5% din eligibili</li>
            <li><span className="text-gray-500 font-semibold">Confortabil</span> — diferenta sub ~10% din eligibili</li>
          </ul>
          <p className="mt-1.5">
            <strong>Mediana dif.</strong> = jumatate din localitatile din categoria respectiva
            au o diferenta mai mica decat aceasta valoare.
          </p>
        </>
      }
    >
      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700">
              <th className="px-3 py-2.5 text-left font-medium">Categorie</th>
              <th className="px-3 py-2.5 text-right font-medium">Nr. localitati</th>
              <th className="px-3 py-2.5 text-right font-medium hidden sm:table-cell">
                Media eligibili
                <InfoTip text="Media numarului de cetateni cu drept de vot din localitatile din aceasta categorie." />
              </th>
              <th className="px-3 py-2.5 text-right font-medium hidden sm:table-cell">
                Prezenta medie
                <InfoTip text="Ce procent din cetateni au votat, in medie, in localitatile din aceasta categorie." />
              </th>
              <th className="px-3 py-2.5 text-right font-medium bg-yellow-50">
                Mediana dif.
                <InfoTip text="Jumatate din localitati au diferenta mai mica decat aceasta valoare, jumatate mai mare." />
              </th>
              <th className="px-3 py-2.5 text-right font-medium text-red-700 hidden md:table-cell">Extrem de strans</th>
              <th className="px-3 py-2.5 text-right font-medium text-amber-700 hidden md:table-cell">Foarte strans</th>
              <th className="px-3 py-2.5 text-right font-medium text-green-700 hidden md:table-cell">Strans</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-500 hidden md:table-cell">Confortabil</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {summary.categories.map((cat) => (
              <tr key={cat.name} className="bg-white hover:bg-blue-50/40">
                <td className="px-3 py-2.5 font-medium text-gray-900 whitespace-nowrap">{cat.name}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmtNum(cat.count)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 hidden sm:table-cell">
                  {fmtNum(cat.avgEligible)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 hidden sm:table-cell">
                  {cat.avgPrezenta}%
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-bold text-gray-900 bg-yellow-50">
                  {fmtNum(cat.medianMargin)} voturi
                </td>
                {cat.adaptiveThresholds.map((t, i) => (
                  <td
                    key={t.threshold}
                    className={`px-3 py-2.5 text-right tabular-nums hidden md:table-cell ${
                      i === 0 ? "text-red-700" : i === 1 ? "text-amber-700" : i === 2 ? "text-green-700" : "text-gray-500"
                    }`}
                  >
                    <div className="text-[10px] text-gray-400">&lt;{fmtNum(t.threshold)} vot.</div>
                    <div className="font-semibold">{t.pct}%</div>
                    <div className="text-[10px] text-gray-400">({t.count})</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}

/* ─── PCJ View ──────────────────────────────────────────────────── */

function PCJView({ data }: { data: { total: number; results: PCJEntry[] } }) {
  return (
    <Section
      title="Presedinte Consiliu Judetean — Toate judetele"
      explanation={
        <>
          <p>
            Tabelul arata cursa pentru presedintia fiecarui consiliu judetean, ordonata
            de la cel mai strans rezultat la cel mai confortabil. <strong>Diferenta</strong> =
            voturile castigatorului minus voturile locului 2, la nivel de judet intreg.
          </p>
          <p className="mt-1.5">
            <strong>% Elig.</strong> = diferenta ca procent din toti alegatorii din judet.
            <strong> % Absenti</strong> = diferenta raportata la cei care nu au votat.
            Daca e mic, inseamna ca un numar foarte mic de absenti ar fi putut rasturna rezultatul.
          </p>
        </>
      }
    >
      <p className="text-sm text-gray-500 mb-3">
        {data.total} judete analizate
      </p>

      {/* Column legend for PCJ */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-xs text-gray-700 space-y-1">
        <p className="font-semibold text-blue-800 mb-1">Ce inseamna coloanele:</p>
        <p><strong>Diferenta</strong> — numarul de voturi care au despartit castigatorul de locul 2.
          <span className="text-red-600 font-semibold"> Rosu</span> = sub 5.000 voturi (strans pentru un judet),
          <span className="text-amber-600 font-semibold"> portocaliu</span> = sub 20.000 voturi.</p>
        <p><strong>% Elig.</strong> — diferenta ca procent din toti alegatorii inscrisi in judet.</p>
        <p><strong>% Absenti</strong> — diferenta ca procent din cetatenii care nu au votat. Cu cat e mai mic, cu atat era mai usor de schimbat rezultatul.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-gray-700 text-left">
              <th className="px-3 py-2.5 font-medium">Judet</th>
              <th className="px-3 py-2.5 font-medium">Castigator</th>
              <th className="px-3 py-2.5 text-right font-medium">Voturi</th>
              <th className="px-3 py-2.5 font-medium">Locul 2</th>
              <th className="px-3 py-2.5 text-right font-medium">Voturi</th>
              <th className="px-3 py-2.5 text-right font-medium bg-yellow-50">Diferenta</th>
              <th className="px-3 py-2.5 text-right font-medium hidden md:table-cell">% Elig.</th>
              <th className="px-3 py-2.5 text-right font-medium hidden md:table-cell">% Absenti</th>
              <th className="px-3 py-2.5 text-right font-medium hidden lg:table-cell">Eligibili</th>
              <th className="px-3 py-2.5 text-right font-medium hidden lg:table-cell">Prezenta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.results.map((r) => (
              <tr key={r.judet} className="bg-white hover:bg-blue-50/40">
                <td className="px-3 py-2.5 font-medium text-gray-900">{r.judet}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <PartyBadge abbrev={r.firstAbbrev} color={r.firstColor} />
                    <span className="text-gray-900 truncate max-w-[160px]">{formatCandName(r.firstCand)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium text-gray-800">{fmtNum(r.firstVotes)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1.5">
                    <PartyBadge abbrev={r.secondAbbrev} color={r.secondColor} />
                    <span className="text-gray-700 truncate max-w-[160px]">{formatCandName(r.secondCand)}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{fmtNum(r.secondVotes)}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums font-bold bg-yellow-50 ${
                  r.margin <= 5000 ? "text-red-700" : r.margin <= 20000 ? "text-amber-700" : "text-gray-900"
                }`}>
                  {fmtNum(r.margin)}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 hidden md:table-cell">{fmtPct(r.marginPctElig)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-600 hidden md:table-cell">{fmtPct(r.marginPctNonVoters)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 hidden lg:table-cell">{fmtNum(r.eligible)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums text-gray-500 hidden lg:table-cell">{r.prezenta}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
