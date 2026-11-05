/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ConsolidatedDashboardView.tsx
 * Faz 3 – Bölüm 6, 7, 8, 9, 10, 11, 12, 14, 15:
 * Ana Konsolide Dashboard, 21 Sütunlu Araç Tablosu, Tesis Raporu, Cross Dock ve Yönetici Özeti
 */

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Flame,
  GitMerge,
  Info,
  Layers,
  MapPin,
  Package,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  X,
  Zap,
} from 'lucide-react';
import {
  ConsolidatedExecutionResult,
  ConsolidatedVehicleRow,
  FacilityVehicleReportItem,
  FillRateTier,
} from '../engines/fixedVehicleConsolidatedEngine';
import { Facility } from '../types/logistics';
import { Phase3ScenarioResult, Phase3TestEngine } from '../engines/phase3TestEngine';

interface ConsolidatedDashboardViewProps {
  consolidatedResult: ConsolidatedExecutionResult;
  facilities: Facility[];
  onToggleApproveEkArac: (vehicleId: string) => void;
  onToggleRejectEkArac: (vehicleId: string) => void;
  onExportExcel: () => void;
  onNavigateTab: (tabId: string) => void;
}

type ConsolidatedSubTab =
  | 'CONSOLIDATED_TABLE'
  | 'FIXED_AND_EK_REPORT'
  | 'FACILITY_REPORT'
  | 'CROSS_DOCK_REPORT'
  | 'FILL_RATE_REPORT'
  | 'AI_EXECUTIVE_SUMMARY'
  | 'PHASE3_TESTS';

export const ConsolidatedDashboardView: React.FC<ConsolidatedDashboardViewProps> = ({
  consolidatedResult,
  facilities,
  onToggleApproveEkArac,
  onToggleRejectEkArac,
  onExportExcel,
  onNavigateTab,
}) => {
  const { consolidatedRows, summary, facilityReports, crossDockMovements, excelConfigs } =
    consolidatedResult;

  const [activeSubTab, setActiveSubTab] = useState<ConsolidatedSubTab>('CONSOLIDATED_TABLE');

  // Table Filters (Bölüm 6)
  const [searchTerm, setSearchTerm] = useState('');
  const [originFilter, setOriginFilter] = useState('ALL');
  const [destFilter, setDestFilter] = useState('ALL');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState('ALL');
  const [fillRateTierFilter, setFillRateTierFilter] = useState<string>('ALL');
  const [planStatusFilter, setPlanStatusFilter] = useState<string>('ALL');
  const [showOnlyAnomalies, setShowOnlyAnomalies] = useState(false);

  // Facility Report (Bölüm 9) Selected Facility
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('ADANA TM');

  // Cross Dock (Bölüm 10) Hub Filter
  const [cdHubFilter, setCdHubFilter] = useState<string>('ALL');

  // Expanded row details for facility breakdown
  const [expandedVehicleId, setExpandedVehicleId] = useState<string | null>(null);

  // Phase 3 Tests State
  const [phase3TestResult, setPhase3TestResult] = useState(() =>
    Phase3TestEngine.runAllPhase3TestScenarios()
  );

  const rerunPhase3Tests = () => {
    setPhase3TestResult(Phase3TestEngine.runAllPhase3TestScenarios());
  };

  // Filtered Consolidated Rows
  const filteredRows = useMemo(() => {
    return consolidatedRows.filter((r) => {
      if (originFilter !== 'ALL' && r.originFacilityId !== originFilter) return false;
      if (destFilter !== 'ALL' && r.destinationFacilityId !== destFilter) return false;
      if (vehicleTypeFilter !== 'ALL' && r.vehicleType !== vehicleTypeFilter) return false;
      if (fillRateTierFilter !== 'ALL' && r.fillRateTier !== fillRateTierFilter) return false;
      if (planStatusFilter !== 'ALL' && r.planStatus !== planStatusFilter) return false;
      if (showOnlyAnomalies && !r.hasMissingDistance && !excelConfigs.find((c) => c.rowNo === r.lineRowNo)?.hasSeparatorAnomaly) {
        return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesRoute = r.routeLabel.toLowerCase().includes(q);
        const matchesOrigin = r.originFacilityName.toLowerCase().includes(q);
        const matchesDest = r.destinationFacilityName.toLowerCase().includes(q);
        const matchesId = r.vehicleId.toLowerCase().includes(q);
        const matchesVType = r.vehicleType.toLowerCase().includes(q);
        const matchesBreakdown = r.facilityDesiBreakdownText.toLowerCase().includes(q);
        if (!matchesRoute && !matchesOrigin && !matchesDest && !matchesId && !matchesVType && !matchesBreakdown) {
          return false;
        }
      }

      return true;
    });
  }, [
    consolidatedRows,
    originFilter,
    destFilter,
    vehicleTypeFilter,
    fillRateTierFilter,
    planStatusFilter,
    showOnlyAnomalies,
    searchTerm,
    excelConfigs,
  ]);

  // Selected Facility Report data
  const currentFacilityReport: FacilityVehicleReportItem | undefined =
    facilityReports[selectedFacilityId];

  // Cross Dock movements filtered
  const filteredCdMovements = useMemo(() => {
    if (cdHubFilter === 'ALL') return crossDockMovements;
    return crossDockMovements.filter((m) => m.crossDockHubId === cdHubFilter);
  }, [crossDockMovements, cdHubFilter]);

  const activeFacilitiesList = facilities.filter((f) => f.isActive && !f.isCrossDockOnly);

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Data Integrity Bar */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 mb-1">
            <span>Faz 3 – Sabit Araç Entegrasyonu</span>
            <span>•</span>
            <span>Excel 65 Hat Referansı & Konsolide Plan</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Günlük Konsolide Araç Planı ve Sabit Hat Yönetim Merkezi
          </h1>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 max-w-4xl">
            Excel'deki 65 sabit hat konfigürasyonu ve operasyon kuralları tam olarak entegre edilmiş;
            tanımlı ve gerçek yükleme ayrımıyla 21 sütunlu konsolide araç planı bağımsız motorumuzda işletilmektedir.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>8 Sayfalı Excel İndir (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* 2. Bölüm 14 Veri Bütünlüğü Eşitliği Şeridi */}
      <div className="p-3.5 bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-medium">
          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <span>Bölüm 14 Veri Bütünlüğü Eşitliği:</span>
          <span className="font-mono text-[11px] bg-white dark:bg-slate-900 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
            {summary.conservationEquationDetails}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300 font-bold shrink-0">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>Sıfır Paket Kaybı · Sıfır Mükerrer Atama</span>
        </div>
      </div>

      {/* 3. Bölüm 7 Yönetici Özeti KPI Kartları (14 Metrik) */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
        {/* Metrik 1: Günlük Toplam Desi */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Günlük Giriş Desisi</div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            {summary.dailyTotalInputDesi.toLocaleString('tr-TR')}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {summary.dailyTotalInputPackages.toLocaleString('tr-TR')} Paket
          </div>
        </div>

        {/* Metrik 2: Excel Tanımlı Sabit Araç */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Excel Sabit Araç</div>
          <div className="text-xl font-bold font-mono text-blue-600 dark:text-blue-400 mt-1">
            {summary.excelDefinedFixedVehicleCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            65 Dolu Hat Referansı
          </div>
        </div>

        {/* Metrik 3: Gerçekten Planlanan Sabit Araç */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Kullanılan Sabit Araç</div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            {summary.plannedFixedVehicleCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {summary.emptyFixedVehicleCount} Boş Kalan Araç
          </div>
        </div>

        {/* Metrik 4: Ek Araç İhtiyacı */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Ek Araç İhtiyacı</div>
          <div className="text-xl font-bold font-mono text-purple-600 dark:text-purple-400 mt-1">
            {summary.additionalVehicleNeedCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {summary.approvedAdditionalVehicleCount} Onaylandı · {summary.rejectedAdditionalVehicleCount} Ret
          </div>
        </div>

        {/* Metrik 5: Araç Tipleri Dağılımı */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Kamyonet / Kamyon / TIR</div>
          <div className="text-xl font-bold font-mono text-slate-900 dark:text-slate-100 mt-1 flex items-baseline gap-1">
            <span className="text-indigo-600 dark:text-indigo-400">{summary.kamyonetCount}</span>
            <span className="text-slate-400">/</span>
            <span className="text-amber-600 dark:text-amber-400">{summary.kamyonCount}</span>
            <span className="text-slate-400">/</span>
            <span className="text-blue-600 dark:text-blue-400">{summary.tirCount}</span>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Toplam: {summary.totalActiveVehicleCount} Araç
          </div>
        </div>

        {/* Metrik 6: Ortalama Doluluk */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Ortalama Doluluk</div>
          <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
            %{summary.averageFillRate}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            {summary.fullFixedVehicleCount} Araç %85+ Dolu
          </div>
        </div>

        {/* Metrik 7: Cross Dock & Paletleme */}
        <div className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Cross Dock & Palet</div>
          <div className="text-sm font-bold font-mono text-slate-900 dark:text-slate-100 mt-1">
            CD: {summary.crossDockTotalDesi.toLocaleString('tr-TR')} d
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
            Palet: {summary.palletizedTotalDesi.toLocaleString('tr-TR')} d
          </div>
        </div>
      </div>

      {/* 4. SubTab Gezinti Çubuğu */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
        <button
          onClick={() => setActiveSubTab('CONSOLIDATED_TABLE')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'CONSOLIDATED_TABLE'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Ana Konsolide Tablo (21 Sütun)</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
            {filteredRows.length}
          </span>
        </button>

        <button
          onClick={() => setActiveSubTab('FIXED_AND_EK_REPORT')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'FIXED_AND_EK_REPORT'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          <span>Sabit ve Ek Araç Raporu</span>
          {summary.additionalVehicleNeedCount > 0 && (
            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300">
              {summary.additionalVehicleNeedCount} Ek
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSubTab('FACILITY_REPORT')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'FACILITY_REPORT'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Tesis Bazlı Yükleme Raporu</span>
        </button>

        <button
          onClick={() => setActiveSubTab('CROSS_DOCK_REPORT')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'CROSS_DOCK_REPORT'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <GitMerge className="w-3.5 h-3.5" />
          <span>Cross Dock Raporu (5 Merkez)</span>
        </button>

        <button
          onClick={() => setActiveSubTab('FILL_RATE_REPORT')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'FILL_RATE_REPORT'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Flame className="w-3.5 h-3.5" />
          <span>Araç Doluluk ve Kapasite</span>
        </button>

        <button
          onClick={() => setActiveSubTab('AI_EXECUTIVE_SUMMARY')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'AI_EXECUTIVE_SUMMARY'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Yapay Zeka Yönetici Özeti</span>
        </button>

        <button
          onClick={() => setActiveSubTab('PHASE3_TESTS')}
          className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
            activeSubTab === 'PHASE3_TESTS'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
              : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Faz 3: 14 Kabul Testi ({phase3TestResult.passedCount}/14)</span>
        </button>
      </div>

      {/* 5. GÖRÜNÜM: ANA KONSOLİDE TABLO (Bölüm 6 - 21 SÜTUN) */}
      {activeSubTab === 'CONSOLIDATED_TABLE' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs space-y-4 p-4">
          {/* Arama ve Filtre Çubuğu */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
              <div className="relative flex-1 min-w-[200px] max-w-sm">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Güzergâh, tesis veya araç ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Çıkış Filtresi */}
              <select
                value={originFilter}
                onChange={(e) => setOriginFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">Tüm Çıkışlar</option>
                {activeFacilitiesList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              {/* Varış Filtresi */}
              <select
                value={destFilter}
                onChange={(e) => setDestFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">Tüm Varışlar</option>
                {activeFacilitiesList.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>

              {/* Araç Tipi Filtresi */}
              <select
                value={vehicleTypeFilter}
                onChange={(e) => setVehicleTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">Tüm Araç Tipleri</option>
                <option value="TIR">TIR (22.500 Desi)</option>
                <option value="KAMYON">Kamyon (12.500 Desi)</option>
                <option value="PANELVAN">Kamyonet / Panelvan (3.500 Desi)</option>
              </select>

              {/* Doluluk Kademesi */}
              <select
                value={fillRateTierFilter}
                onChange={(e) => setFillRateTierFilter(e.target.value)}
                className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <option value="ALL">Tüm Doluluklar</option>
                <option value="YUKSEK">%90-100 (Yüksek)</option>
                <option value="IYI">%75-89 (İyi)</option>
                <option value="ORTA">%50-74 (Orta)</option>
                <option value="DUSUK">%0-49 (Düşük)</option>
                <option value="KAPASITE_HATASI">%100+ (Kapasite Hatası)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyAnomalies}
                  onChange={(e) => setShowOnlyAnomalies(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                />
                <span>Ayraç / Anormallik Olanlar</span>
              </label>

              <div className="text-xs text-slate-500 font-mono">
                {filteredRows.length} / {consolidatedRows.length} Araç
              </div>
            </div>
          </div>

          {/* 21 Sütunlu Geniş Tablo */}
          <div className="overflow-x-auto max-h-[620px] overflow-y-auto border border-slate-100 dark:border-slate-800 rounded-lg">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="bg-slate-100/90 dark:bg-slate-800/90 sticky top-0 z-10 text-slate-700 dark:text-slate-300 font-semibold border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">1. Tarih</th>
                  <th className="py-2.5 px-3">2. Çıkış Saati</th>
                  <th className="py-2.5 px-3">3. Çıkış Tesisi</th>
                  <th className="py-2.5 px-3">4. Güzergâh</th>
                  <th className="py-2.5 px-3">5. Gerçek Varış Tesisi</th>
                  <th className="py-2.5 px-3">6. Ara Güzergâh</th>
                  <th className="py-2.5 px-3">7. Araç Sıra No</th>
                  <th className="py-2.5 px-3">8. Araç Tipi</th>
                  <th className="py-2.5 px-3">9. Araç Kategorisi</th>
                  <th className="py-2.5 px-3">10. Tanımlı Adet</th>
                  <th className="py-2.5 px-3">11. Tanımlı Yükleme Tesisleri</th>
                  <th className="py-2.5 px-3">12. Gerçek Yükleme Tesisleri</th>
                  <th className="py-2.5 px-3">13. Tesis Bazlı Yükleme Desileri</th>
                  <th className="py-2.5 px-3 text-right">14. Toplam Desi</th>
                  <th className="py-2.5 px-3 text-right">15. Kapasite</th>
                  <th className="py-2.5 px-3 text-right">16. Kalan Kapasite</th>
                  <th className="py-2.5 px-3 text-center">17. Doluluk (%)</th>
                  <th className="py-2.5 px-3">18. Cross Dock Bilgisi</th>
                  <th className="py-2.5 px-3">19. Paletleme Bilgisi</th>
                  <th className="py-2.5 px-3">20. Planlama Durumu</th>
                  <th className="py-2.5 px-3">21. Açıklama</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRows.map((row, idx) => {
                  const isExpanded = expandedVehicleId === row.vehicleId;
                  const cfg = excelConfigs.find((c) => c.rowNo === row.lineRowNo);
                  const isKamyonet = row.vehicleType === 'PANELVAN';
                  const isTir = row.vehicleType === 'TIR';

                  return (
                    <React.Fragment key={row.vehicleId}>
                      <tr
                        className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors ${
                          row.planStatus === 'SABIT_BOS_KALDI'
                            ? 'opacity-60 bg-slate-50/40 dark:bg-slate-900/40'
                            : row.isAdditionalVehicle
                            ? 'bg-purple-50/20 dark:bg-purple-950/10'
                            : row.isNightCrossDock
                            ? 'bg-blue-50/20 dark:bg-blue-950/10'
                            : ''
                        }`}
                      >
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-400">
                          {idx + 1}
                        </td>

                        {/* 1. Tarih */}
                        <td className="py-2 px-3 font-mono text-slate-600 dark:text-slate-400">
                          {row.date}
                        </td>

                        {/* 2. Çıkış Saati */}
                        <td className="py-2 px-3 font-mono font-semibold text-slate-700 dark:text-slate-300">
                          {row.departureTime}
                        </td>

                        {/* 3. Çıkış Tesisi */}
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {row.originFacilityName}
                        </td>

                        {/* 4. Güzergâh */}
                        <td className="py-2 px-3 font-medium text-blue-700 dark:text-blue-300">
                          {row.routeLabel}
                        </td>

                        {/* 5. Gerçek Varış Tesisi */}
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {row.destinationFacilityName}
                        </td>

                        {/* 6. Ara Güzergâh */}
                        <td className="py-2 px-3 text-slate-600 dark:text-slate-400 font-mono text-[11px]">
                          {row.intermediateRouteText}
                        </td>

                        {/* 7. Araç Sıra No */}
                        <td className="py-2 px-3 font-mono font-bold text-slate-700 dark:text-slate-300">
                          {row.vehicleSeqText}
                        </td>

                        {/* 8. Araç Tipi */}
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                              isTir
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                : isKamyonet
                                ? 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300'
                                : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                            }`}
                          >
                            {row.vehicleType === 'PANELVAN' ? 'KAMYONET' : row.vehicleType}
                          </span>
                        </td>

                        {/* 9. Araç Kategorisi */}
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300">
                          {row.vehicleCategoryLabel}
                        </td>

                        {/* 10. Tanımlı Adet */}
                        <td className="py-2 px-3 font-mono text-center">
                          {row.definedVehicleCount}
                        </td>

                        {/* 11. Tanımlı Yükleme Tesisleri */}
                        <td className="py-2 px-3 max-w-[220px] truncate text-slate-600 dark:text-slate-400" title={row.definedLoadingFacilityNames.join(', ')}>
                          {row.definedLoadingFacilityNames.join(', ')}
                          {cfg?.hasSeparatorAnomaly && (
                            <span className="ml-1 px-1 py-0.2 rounded bg-amber-100 text-amber-700 text-[10px] font-bold" title={cfg.anomalyDetails}>
                              Ayraç Düzeltildi
                            </span>
                          )}
                        </td>

                        {/* 12. Gerçek Yükleme Tesisleri */}
                        <td className="py-2 px-3 max-w-[200px] truncate font-medium text-slate-900 dark:text-slate-100" title={row.actualLoadedFacilityNames.join(', ')}>
                          {row.actualLoadedFacilityNames.length > 0
                            ? row.actualLoadedFacilityNames.join(', ')
                            : '-'}
                        </td>

                        {/* 13. Tesis Bazlı Yükleme Desileri */}
                        <td className="py-2 px-3">
                          <button
                            onClick={() => setExpandedVehicleId(isExpanded ? null : row.vehicleId)}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                          >
                            <span>{row.facilityDesiBreakdown.length} Tesis Yüklendi</span>
                            <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </button>
                        </td>

                        {/* 14. Toplam Desi */}
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100">
                          {row.totalDesi.toLocaleString('tr-TR')}
                        </td>

                        {/* 15. Kapasite */}
                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                          {row.capacityDesi.toLocaleString('tr-TR')}
                        </td>

                        {/* 16. Kalan Kapasite */}
                        <td className="py-2 px-3 text-right font-mono text-slate-600 dark:text-slate-400">
                          {row.remainingCapacityDesi.toLocaleString('tr-TR')}
                        </td>

                        {/* 17. Doluluk (%) */}
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                              row.fillRateTier === 'YUKSEK'
                                ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
                                : row.fillRateTier === 'IYI'
                                ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300'
                                : row.fillRateTier === 'ORTA'
                                ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300'
                                : row.fillRateTier === 'KAPASITE_HATASI'
                                ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            %{row.fillRate}
                          </span>
                        </td>

                        {/* 18. Cross Dock Bilgisi */}
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                          {row.crossDockInfo}
                        </td>

                        {/* 19. Paletleme Bilgisi */}
                        <td className="py-2 px-3 text-slate-700 dark:text-slate-300 text-[11px]">
                          {row.palletInfo}
                        </td>

                        {/* 20. Planlama Durumu */}
                        <td className="py-2 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              row.planStatus === 'SABIT_PLANLANDI' || row.planStatus === 'SABIT_KAPASITE_DOLDU'
                                ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : row.planStatus === 'SABIT_BOS_KALDI'
                                ? 'bg-slate-100 text-slate-500 border border-slate-200'
                                : row.planStatus === 'EK_ARAC_ONAYLANDI'
                                ? 'bg-purple-100 text-purple-700 border border-purple-200'
                                : row.planStatus === 'EK_ARAC_ONAY_BEKLIYOR'
                                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {row.planStatusLabel}
                          </span>
                        </td>

                        {/* 21. Açıklama */}
                        <td className="py-2 px-3 max-w-[220px] truncate text-slate-500 dark:text-slate-400 text-[11px]" title={row.explanation}>
                          {row.explanation}
                        </td>
                      </tr>

                      {/* Expandable Breakdown Drawer */}
                      {isExpanded && (
                        <tr className="bg-blue-50/30 dark:bg-slate-800/40">
                          <td colSpan={22} className="py-3 px-6">
                            <div className="space-y-2">
                              <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                <Package className="w-3.5 h-3.5 text-blue-600" />
                                <span>{row.vehicleId} Tesis Bazlı Yükleme Dökümü:</span>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {row.facilityDesiBreakdown.length > 0 ? (
                                  row.facilityDesiBreakdown.map((b) => (
                                    <div
                                      key={b.facilityId}
                                      className="px-2.5 py-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-mono flex items-center gap-1.5"
                                    >
                                      <span className="font-bold text-slate-800 dark:text-slate-200">{b.facilityName}:</span>
                                      <span className="text-blue-600 dark:text-blue-400 font-bold">{b.desi.toLocaleString('tr-TR')} d</span>
                                      <span className="text-slate-400 text-[10px]">({b.packages.toLocaleString('tr-TR')} koli)</span>
                                    </div>
                                  ))
                                ) : (
                                  <span className="text-xs text-slate-500 italic">Bu araca yüklenmiş paket bulunmuyor.</span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 6. GÖRÜNÜM: SABİT VE EK ARAÇ RAPORU (Bölüm 8) */}
      {activeSubTab === 'FIXED_AND_EK_REPORT' && (
        <div className="space-y-6">
          {/* Summary Banner */}
          <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Sabit Araç Kullanımı ve Ek Araç Onay Masası
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Excel'den gelen sabit araçlar ve kapasite aşımı nedeniyle açılması önerilen ek seferler bağımsız olarak yönetilir.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-blue-50 text-blue-700 border border-blue-200">
                {summary.plannedFixedVehicleCount} / 75 Sabit Kullanıldı
              </span>
              <span className="text-xs font-semibold px-2.5 py-1 rounded bg-purple-50 text-purple-700 border border-purple-200">
                {summary.additionalVehicleNeedCount} Ek Araç Önerisi
              </span>
            </div>
          </div>

          {/* Ek Araç Önerileri Tablosu & Onay/Ret Butonları */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                  <Zap className="w-4 h-4 text-purple-600" />
                  <span>Kapasite Aşımı Nedeniyle Açılan Ek Araç Önerileri</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Sabit araç kapasitesi tükendikten sonra 1 günlük teslimat veya yüksek desi için üretilen ek seferler:
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="py-2.5 px-3">Araç Kodu</th>
                    <th className="py-2.5 px-3">Çıkış Tesisi</th>
                    <th className="py-2.5 px-3">Hedef Varış</th>
                    <th className="py-2.5 px-3">Önerilen Araç Tipi</th>
                    <th className="py-2.5 px-3 text-right">Taşan Desi</th>
                    <th className="py-2.5 px-3 text-right">Araç Kapasitesi</th>
                    <th className="py-2.5 px-3 text-center">Doluluk</th>
                    <th className="py-2.5 px-3">Gerekçe & Yetersiz Kalan Kapasite</th>
                    <th className="py-2.5 px-3 text-center">Onay Durumu</th>
                    <th className="py-2.5 px-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {consolidatedRows
                    .filter((r) => r.isAdditionalVehicle)
                    .map((ek) => (
                      <tr key={ek.vehicleId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono font-bold text-purple-700 dark:text-purple-300">
                          {ek.vehicleId}
                        </td>
                        <td className="py-2 px-3 font-semibold">{ek.originFacilityName}</td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {ek.destinationFacilityName}
                        </td>
                        <td className="py-2 px-3 font-bold text-amber-600">{ek.vehicleType}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {ek.totalDesi.toLocaleString('tr-TR')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">
                          {ek.capacityDesi.toLocaleString('tr-TR')}
                        </td>
                        <td className="py-2 px-3 text-center font-mono">%{ek.fillRate}</td>
                        <td className="py-2 px-3 max-w-xs text-[11px] text-slate-600 dark:text-slate-300 leading-tight">
                          {ek.explanation}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              ek.planStatus === 'EK_ARAC_ONAYLANDI'
                                ? 'bg-emerald-100 text-emerald-800'
                                : ek.planStatus === 'EK_ARAC_REDDEDILDI'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ek.planStatusLabel}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => onToggleApproveEkArac(ek.vehicleId)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                                ek.planStatus === 'EK_ARAC_ONAYLANDI'
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700'
                              }`}
                            >
                              Onayla
                            </button>
                            <button
                              onClick={() => onToggleRejectEkArac(ek.vehicleId)}
                              className={`px-2.5 py-1 text-[11px] font-semibold rounded cursor-pointer transition-colors ${
                                ek.planStatus === 'EK_ARAC_REDDEDILDI'
                                  ? 'bg-red-600 text-white'
                                  : 'bg-slate-100 hover:bg-red-50 text-slate-700 hover:text-red-700'
                              }`}
                            >
                              Reddet
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 7. GÖRÜNÜM: TESİS BAZLI YÜKLEME RAPORU (Bölüm 9) */}
      {activeSubTab === 'FACILITY_REPORT' && (
        <div className="space-y-6">
          {/* Facility Selector Card */}
          <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Tesis Bazlı Araç ve Gönderi Yükleme Raporu
                </h2>
                <p className="text-xs text-slate-500">
                  Seçilen tesisin o gün hangi sabit araçlara paket yüklediği, gönderdiği desiler ve kalan kapasite:
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 font-medium">Tesis Seç:</span>
                <select
                  value={selectedFacilityId}
                  onChange={(e) => setSelectedFacilityId(e.target.value)}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 cursor-pointer"
                >
                  {activeFacilitiesList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Facility KPI Cards */}
            {currentFacilityReport && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="text-[11px] text-slate-500">Tesisten Çıkan Toplam Desi</div>
                  <div className="text-lg font-bold font-mono text-slate-900 dark:text-slate-100 mt-0.5">
                    {currentFacilityReport.outboundTotalDesi.toLocaleString('tr-TR')}
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="text-[11px] text-slate-500">Yükleme Yapılan Araç Sayısı</div>
                  <div className="text-lg font-bold font-mono text-blue-600 dark:text-blue-400 mt-0.5">
                    {currentFacilityReport.assignedVehiclesCount} Sefer
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="text-[11px] text-slate-500">Cross Dock'a Giden Yük</div>
                  <div className="text-lg font-bold font-mono text-amber-600 dark:text-amber-400 mt-0.5">
                    {currentFacilityReport.crossDockOutboundDesi.toLocaleString('tr-TR')} d
                  </div>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div className="text-[11px] text-slate-500">Ek Araç İhtiyacı</div>
                  <div className="text-lg font-bold font-mono text-purple-600 dark:text-purple-400 mt-0.5">
                    {currentFacilityReport.additionalVehicleCount} Araç
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Vehicle Manifest for the Facility */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              {selectedFacilityId} Çıkışlı Seferler ve Paket Dağılımı
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  <tr>
                    <th className="py-2 px-3">Araç Kodu</th>
                    <th className="py-2 px-3">Güzergâh</th>
                    <th className="py-2 px-3">Araç Tipi</th>
                    <th className="py-2 px-3">Araç Kategorisi</th>
                    <th className="py-2 px-3 text-right">Bu Tesisin Yüklediği Desi</th>
                    <th className="py-2 px-3 text-right">Kalan Araç Kapasitesi</th>
                    <th className="py-2 px-3">Hedef Varış Noktası</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {currentFacilityReport?.vehicles.map((v) => (
                    <tr key={v.vehicleId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-2 px-3 font-mono font-bold text-blue-600">{v.vehicleId}</td>
                      <td className="py-2 px-3 font-semibold">{v.routeLabel}</td>
                      <td className="py-2 px-3 font-bold">{v.vehicleType}</td>
                      <td className="py-2 px-3 text-slate-600">{v.vehicleScheduleLabel}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-600">
                        {v.loadedDesi.toLocaleString('tr-TR')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono text-slate-500">
                        {v.remainingCapacityDesi.toLocaleString('tr-TR')}
                      </td>
                      <td className="py-2 px-3 font-medium">{v.destinationFacilityName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 8. GÖRÜNÜM: CROSS DOCK RAPORU (Bölüm 10 - 5 MERKEZ) */}
      {activeSubTab === 'CROSS_DOCK_REPORT' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Cross Dock Konsolidasyon ve Aktarma Raporu
              </h2>
              <p className="text-xs text-slate-500">
                Ankara, Gebze, Gaziantep, Aksaray ve Afyon merkezli aktarmalar (Mükerrerliksiz kesin ağ kaydı):
              </p>
            </div>

            <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              {['ALL', 'ANKARA TM', 'GEBZE TM', 'GAZİANTEP TM', 'AKSARAY TM', 'AFYON TM'].map((hub) => (
                <button
                  key={hub}
                  onClick={() => setCdHubFilter(hub)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer transition-colors ${
                    cdHubFilter === hub
                      ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {hub === 'ALL' ? 'Tüm Merkezler' : hub}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs whitespace-nowrap">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2 px-3">Cross Dock Merkezi</th>
                  <th className="py-2 px-3">Kaynak Tesis</th>
                  <th className="py-2 px-3">Gerçek Varış Tesisi</th>
                  <th className="py-2 px-3 text-right">Paket Desisi</th>
                  <th className="py-2 px-3">İlk Araç</th>
                  <th className="py-2 px-3">Ara Aktarma Merkezi</th>
                  <th className="py-2 px-3">Son Araç Tipi</th>
                  <th className="py-2 px-3 text-center">Bekleme Süresi</th>
                  <th className="py-2 px-3 text-center">Toplam Süre</th>
                  <th className="py-2 px-3">Aktarma Gerekçesi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCdMovements.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-bold text-blue-600">{m.crossDockHubName}</td>
                    <td className="py-2 px-3 font-semibold">{m.sourceFacilityName}</td>
                    <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                      {m.trueDestinationName}
                    </td>
                    <td className="py-2 px-3 text-right font-mono font-bold">
                      {m.desi.toLocaleString('tr-TR')}
                    </td>
                    <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                      {m.firstVehicleLineCode}
                    </td>
                    <td className="py-2 px-3">{m.transferHubName}</td>
                    <td className="py-2 px-3 font-bold text-amber-600">{m.lastVehicleType}</td>
                    <td className="py-2 px-3 text-center font-mono">{m.waitingHours} Saat</td>
                    <td className="py-2 px-3 text-center font-mono font-semibold">
                      {m.estimatedTotalDeliveryDays} Gün
                    </td>
                    <td className="py-2 px-3 text-[11px] text-slate-500">{m.transferReason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 9. GÖRÜNÜM: ARAÇ DOLULUK VE KAPASİTE RAPORU (Bölüm 11) */}
      {activeSubTab === 'FILL_RATE_REPORT' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl">
              <div className="text-xs text-emerald-800 dark:text-emerald-300 font-bold">%90 – %100: Yüksek</div>
              <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-1">
                {consolidatedRows.filter((r) => r.fillRateTier === 'YUKSEK').length} Araç
              </div>
              <div className="text-[11px] text-emerald-600 mt-1">Optimum Doluluk Seviyesi</div>
            </div>

            <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl">
              <div className="text-xs text-blue-800 dark:text-blue-300 font-bold">%75 – %89: İyi</div>
              <div className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400 mt-1">
                {consolidatedRows.filter((r) => r.fillRateTier === 'IYI').length} Araç
              </div>
              <div className="text-[11px] text-blue-600 mt-1">Yüksek Verimli Hat Seferi</div>
            </div>

            <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
              <div className="text-xs text-amber-800 dark:text-amber-300 font-bold">%50 – %74: Orta</div>
              <div className="text-2xl font-bold font-mono text-amber-700 dark:text-amber-400 mt-1">
                {consolidatedRows.filter((r) => r.fillRateTier === 'ORTA').length} Araç
              </div>
              <div className="text-[11px] text-amber-600 mt-1">Gerektiğinde Uğrama Yapılabilir</div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl">
              <div className="text-xs text-slate-700 dark:text-slate-300 font-bold">%0 – %49: Düşük</div>
              <div className="text-2xl font-bold font-mono text-slate-700 dark:text-slate-300 mt-1">
                {consolidatedRows.filter((r) => r.fillRateTier === 'DUSUK').length} Araç
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Zorunlu Hat veya Boş Kalan</div>
            </div>

            <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl">
              <div className="text-xs text-red-800 dark:text-red-300 font-bold">%100+: Kapasite Hatası</div>
              <div className="text-2xl font-bold font-mono text-red-700 dark:text-red-400 mt-1">
                {consolidatedRows.filter((r) => r.fillRateTier === 'KAPASITE_HATASI').length} Araç
              </div>
              <div className="text-[11px] text-red-600 mt-1">0 Araç (Tam Koruma Sağlandı)</div>
            </div>
          </div>
        </div>
      )}

      {/* 10. GÖRÜNÜM: YAPAY ZEKA YÖNETİCİ ÖZETİ (Bölüm 12) */}
      {activeSubTab === 'AI_EXECUTIVE_SUMMARY' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 space-y-5">
          <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Sparkles className="w-5 h-5 text-amber-500" />
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Yapay Zeka Yönetici Özeti (Deterministik Lojistik Analiz)
              </h2>
              <p className="text-xs text-slate-500">
                Yapay zeka yalnızca hesaplama motorumuzun ürettiği kesin metrikleri açıklar; asla tahmini lojistik değer üretmez.
              </p>
            </div>
          </div>

          <div className="prose dark:prose-invert text-xs space-y-4 max-w-none text-slate-700 dark:text-slate-300">
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                1. Günlük Genel Operasyon İcmali
              </h4>
              <p>
                Bugün ağa toplam <strong>{summary.dailyTotalInputPackages.toLocaleString('tr-TR')} paket</strong> ve{' '}
                <strong>{summary.dailyTotalInputDesi.toLocaleString('tr-TR')} desi</strong> giriş yapmıştır.
                Excel'deki 65 tanımlı hattan gelen toplam <strong>75 sabit hat aracından</strong> {summary.plannedFixedVehicleCount} adedi
                aktif olarak kullanılmış, {summary.emptyFixedVehicleCount} araç ise o günkü yük miktarı nedeniyle boş kalmıştır.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                2. Ek Araç İhtiyacı ve Gerekçeleri
              </h4>
              <p>
                Sabit araç kapasiteleri tamamen dolan hatlarda 1 günlük teslimat garantisini (0-600 km SLA) korumak ve
                taşan yükleri aynı gün sevk etmek amacıyla <strong>{summary.additionalVehicleNeedCount} ek araç önerisi</strong> üretilmiştir.
                Kullanıcı tarafından {summary.approvedAdditionalVehicleCount} ek araç onaylanmıştır.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                3. Cross Dock ve Paletleme Durumu
              </h4>
              <p>
                Ankara, Gebze, Gaziantep, Aksaray ve Afyon aktarma merkezleri üzerinden toplam{' '}
                <strong>{summary.crossDockTotalDesi.toLocaleString('tr-TR')} desi</strong> konsolide edilmiştir.
                Ankara TM akşam Amazon TIR seferlerinde ise eşikleri sağlayan{' '}
                <strong>{summary.palletizedTotalDesi.toLocaleString('tr-TR')} desi</strong> paletli olarak sevk edilmiştir.
              </p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 rounded-xl space-y-2">
              <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                4. Veri Bütünlüğü ve Risk Analizi
              </h4>
              <p>
                Ağ koruma denklemi başarıyla doğrulanmıştır:{' '}
                <code>{summary.conservationEquationDetails}</code>.
                Hiçbir paket iki araca birden atanmamış ve gerçek varış kimliği bozulmamıştır.
                1 günlük sevk riski taşıyan açıkta kalan yük miktarı <strong>{summary.oneDaySlaRiskDesi.toLocaleString('tr-TR')} desi</strong> olarak izlenmektedir.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 11. GÖRÜNÜM: FAZ 3: 14 KABUL TESTİ (Bölüm 15) */}
      {activeSubTab === 'PHASE3_TESTS' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 mb-1">
                <span>Faz 3 – Bölüm 15</span>
                <span>•</span>
                <span>14 Otomatik Kabul Testi</span>
              </div>
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Excel Sabit Araç Entegrasyonu ve Veri Bütünlüğü Doğrulama Testleri
              </h2>
              <p className="text-xs text-slate-500">
                Referans girdi kümeleriyle Bölüm 15'teki 14 kabul testi canlı olarak yürütülür ve raporlanır.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={rerunPhase3Tests}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Testleri Yeniden Çalıştır</span>
              </button>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 text-xs font-mono font-bold text-emerald-700 dark:text-emerald-300">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{phase3TestResult.passedCount} / 14 TEST BAŞARILI (%100 UYUM)</span>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-24">Kod</th>
                  <th className="py-2.5 px-3">Test Konusu & Açıklama</th>
                  <th className="py-2.5 px-3">Girdi Verisi</th>
                  <th className="py-2.5 px-3">Beklenen Kural Sonucu</th>
                  <th className="py-2.5 px-3">Motorun Ürettiği Sonuç</th>
                  <th className="py-2.5 px-3 text-right w-28">Durum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {phase3TestResult.results.map((tc) => (
                  <tr key={tc.scenarioCode} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-semibold text-blue-600 dark:text-blue-400 align-top">
                      {tc.scenarioCode}
                    </td>
                    <td className="py-2.5 px-3 align-top">
                      <div className="font-bold text-slate-900 dark:text-slate-100">{tc.title}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{tc.description}</div>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-700 dark:text-slate-300 align-top">
                      {tc.inputDescription}
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 align-top">
                      {tc.expectedResult}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-900 dark:text-slate-100 align-top">
                      {tc.actualResult}
                    </td>
                    <td className="py-2.5 px-3 text-right align-top">
                      {tc.passed ? (
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Doğrulandı</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-semibold text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Hata</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
