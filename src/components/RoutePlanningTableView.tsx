import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BookmarkCheck,
  Boxes,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Filter,
  GitCompare,
  Layers,
  MapPin,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Truck,
  Waypoints,
  X,
  Zap,
} from 'lucide-react';
import {
  Facility,
  PlannedVehicleLine,
  PlanningExecutionResult,
} from '../types/logistics';

interface RoutePlanningTableViewProps {
  result: PlanningExecutionResult;
  facilities: Facility[];
  activeMode: PlanningExecutionResult['mode'];
  onChangeMode: (mode: PlanningExecutionResult['mode']) => void;
  onSaveApprovedPlan: (customName?: string) => void;
  onExportExcel: () => void;
}

export const RoutePlanningTableView: React.FC<RoutePlanningTableViewProps> = ({
  result,
  facilities,
  activeMode,
  onChangeMode,
  onSaveApprovedPlan,
  onExportExcel,
}) => {
  // 6 Required Table Filters (Section 12)
  const [originFilter, setOriginFilter] = useState<string>('ALL');
  const [destFilter, setDestFilter] = useState<string>('ALL');
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>('ALL');
  const [routeCategoryFilter, setRouteCategoryFilter] = useState<string>('ALL');
  const [transferHubFilter, setTransferHubFilter] = useState<string>('ALL');
  const [planStatusFilter, setPlanStatusFilter] = useState<string>('ALL');
  const [fillRateFilter, setFillRateFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // 1. Faz Ek Kurallar Hızlı Filtresi & 17 Alanlık Araç İnceleme Modalı
  const [phase1Filter, setPhase1Filter] = useState<string>('ALL');
  const [selectedVehicleForModal, setSelectedVehicleForModal] =
    useState<PlannedVehicleLine | null>(null);

  // Section 11 interactive states
  const [showBaselineAnalysis, setShowBaselineAnalysis] = useState<boolean>(false);
  const [showComparisonDiffOnly, setShowComparisonDiffOnly] = useState<boolean>(false);
  const [savedBannerMessage, setSavedBannerMessage] = useState<string | null>(null);

  const filteredLines = useMemo(() => {
    return result.lines.filter((line) => {
      if (originFilter !== 'ALL' && line.originFacilityId !== originFilter) return false;
      if (destFilter !== 'ALL' && line.destinationFacilityId !== destFilter) return false;
      if (vehicleTypeFilter === 'TANIMSIZ') {
        if (!line.isMissingVehicleType && line.vehicleType !== 'TANIMSIZ') return false;
      } else if (vehicleTypeFilter !== 'ALL' && line.vehicleType !== vehicleTypeFilter) {
        return false;
      }

      if (routeCategoryFilter === 'DIREKT_ONLY') {
        if (
          line.routeCategory !== 'DIREKT' &&
          line.routeCategory !== 'MEVCUT_HAT'
        ) {
          return false;
        }
      } else if (routeCategoryFilter === 'CROSS_DOCK_ONLY') {
        if (
          line.routeCategory !== 'ANKARA_CROSS_DOCK' &&
          line.routeCategory !== 'GEBZE_CROSS_DOCK' &&
          line.routeCategory !== 'AKSARAY_CROSS_DOCK' &&
          line.routeCategory !== 'GAZIANTEP_CROSS_DOCK' &&
          line.routeCategory !== 'AFYON_CROSS_DOCK'
        ) {
          return false;
        }
      } else if (
        routeCategoryFilter !== 'ALL' &&
        line.routeCategory !== routeCategoryFilter
      ) {
        return false;
      }

      if (transferHubFilter !== 'ALL') {
        if (transferHubFilter === 'ANKARA_CD' && line.routeCategory !== 'ANKARA_CROSS_DOCK') return false;
        if (transferHubFilter === 'GEBZE_CD' && line.routeCategory !== 'GEBZE_CROSS_DOCK') return false;
        if (transferHubFilter === 'AKSARAY_CD' && line.routeCategory !== 'AKSARAY_CROSS_DOCK') return false;
        if (transferHubFilter === 'GAZIANTEP_CD' && line.routeCategory !== 'GAZIANTEP_CROSS_DOCK') return false;
        if (
          transferHubFilter === 'AFYON_FEEDER' &&
          line.routeCategory !== 'AFYON_UZERINDEN' &&
          line.routeCategory !== 'AFYON_CROSS_DOCK'
        ) {
          return false;
        }
        if (transferHubFilter === 'ERZURUM_HUB' && line.routeCategory !== 'ERZURUM_UZERINDEN') return false;
        if (transferHubFilter === 'SAMSUN_HUB' && line.routeCategory !== 'SAMSUN_UZERINDEN') return false;
      }

      if (planStatusFilter !== 'ALL' && line.planStatus !== planStatusFilter) return false;

      if (fillRateFilter === 'HIGH_85' && line.fillRate < 85) return false;
      if (fillRateFilter === 'MID_65_85' && (line.fillRate < 65 || line.fillRate >= 85))
        return false;
      if (fillRateFilter === 'LOW_65' && line.fillRate >= 65) return false;

      if (showComparisonDiffOnly && line.comparison.changeType === 'KORUNDU') {
        return false;
      }

      // 1. Faz Ek Kurallar Hızlı Filtreleri
      if (phase1Filter === '1_GUN_SEVK') {
        if (!line.sameDayPriorityEnforced && line.delivery.deliveryDaysCategory !== 1 && line.planStatus !== 'AYNI_GUN_EK_ARAC') return false;
      } else if (phase1Filter === 'SABIT_2200') {
        if (line.originFacilityId !== 'ANKARA TM' || line.departureTime !== '22:00') return false;
      } else if (phase1Filter === 'KAYSERI_15K') {
        if (line.originFacilityId !== 'ANKARA TM' || line.destinationFacilityId !== 'KAYSERİ TM') return false;
      } else if (phase1Filter === 'SAMSUN_3') {
        if (line.originFacilityId !== 'ANKARA TM' || !line.destinationFacilityId.includes('SAMSUN TM')) return false;
      } else if (phase1Filter === 'PALETLI_AMAZON') {
        if (!line.isPalletized && line.vehicleScheduleType !== 'PALETLI_AMAZON_ARACI') return false;
      } else if (phase1Filter === 'UGRAMALI') {
        if (!line.waypoints || line.waypoints.length === 0) return false;
      } else if (phase1Filter === 'EK_ARAC') {
        if (line.vehicleScheduleType !== 'EK_ARAC' && line.planStatus !== 'AYNI_GUN_EK_ARAC') return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toUpperCase();
        const matchOrigin = line.originFacilityName.toUpperCase().includes(q);
        const matchDest = line.destinationFacilityName.toUpperCase().includes(q);
        const matchCode = line.lineCode.toUpperCase().includes(q);
        const matchLoaded = line.loadedSegments.some((s) =>
          s.sourceFacilityName.toUpperCase().includes(q)
        );
        if (!matchOrigin && !matchDest && !matchCode && !matchLoaded) return false;
      }

      return true;
    });
  }, [
    result.lines,
    originFilter,
    destFilter,
    vehicleTypeFilter,
    routeCategoryFilter,
    transferHubFilter,
    planStatusFilter,
    fillRateFilter,
    phase1Filter,
    showComparisonDiffOnly,
    searchQuery,
  ]);

  // Group filtered lines by Origin Facility while preserving order so same origin's vehicles are visually grouped
  const groupedByOrigin = useMemo(() => {
    const groups: { originId: string; originName: string; lines: PlannedVehicleLine[] }[] = [];
    const map = new Map<string, PlannedVehicleLine[]>();

    for (const line of filteredLines) {
      const existing = map.get(line.originFacilityId);
      if (existing) {
        existing.push(line);
      } else {
        const arr = [line];
        map.set(line.originFacilityId, arr);
        groups.push({
          originId: line.originFacilityId,
          originName: line.originFacilityName,
          lines: arr,
        });
      }
    }
    return groups;
  }, [filteredLines]);

  // Dynamic Summary Metrics for the filtered view (Section 12 spec)
  const filteredMetrics = useMemo(() => {
    const totalVehicles = filteredLines.length;
    const totalDesi = filteredLines.reduce((s, l) => s + l.totalDesi, 0);
    const totalTir = filteredLines.filter((l) => l.vehicleType === 'TIR').length;
    const totalKamyon = filteredLines.filter((l) => l.vehicleType === 'KAMYON').length;
    const totalPanelvan = filteredLines.filter((l) => l.vehicleType === 'PANELVAN').length;
    const missingVehicleCount = filteredLines.filter((l) => l.isMissingVehicleType).length;
    const directDesi = filteredLines
      .filter((l) => l.routeCategory === 'DIREKT' || l.routeCategory === 'MEVCUT_HAT')
      .reduce((s, l) => s + l.totalDesi, 0);
    const crossDockDesi = filteredLines
      .filter((l) => l.routeCategory === 'ANKARA_CROSS_DOCK' || l.routeCategory === 'GEBZE_CROSS_DOCK')
      .reduce((s, l) => s + l.totalDesi, 0);
    const avgFill =
      totalVehicles > 0
        ? Number(
            (filteredLines.reduce((s, l) => s + l.fillRate, 0) / totalVehicles).toFixed(1)
          )
        : 0;
    const unplannedDesi = result.summary.unplannedDesi;

    return {
      totalVehicles,
      totalDesi,
      totalTir,
      totalKamyon,
      totalPanelvan,
      missingVehicleCount,
      directDesi,
      crossDockDesi,
      avgFill,
      unplannedDesi,
    };
  }, [filteredLines, result.summary.unplannedDesi]);

  const handleSavePlan = () => {
    onSaveApprovedPlan();
    setSavedBannerMessage(
      `"${result.planName}" onaylandı ve Planlama Geçmişine kalıcı olarak kaydedildi.`
    );
    setTimeout(() => setSavedBannerMessage(null), 4000);
  };

  const resetFilters = () => {
    setOriginFilter('ALL');
    setDestFilter('ALL');
    setVehicleTypeFilter('ALL');
    setRouteCategoryFilter('ALL');
    setTransferHubFilter('ALL');
    setPlanStatusFilter('ALL');
    setFillRateFilter('ALL');
    setSearchQuery('');
    setShowComparisonDiffOnly(false);
  };

  return (
    <div className="space-y-5">
      {/* Section 11 Action Bar: Mevcut Planı Göster, Analiz Et, Optimize Et, Alternatif Plan, Karşılaştır, Onayla */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Tek Tablolu Hat Planlama Ekranı · Mevcut Hat Çıkış Planı Koruma ve Optimizasyon Motoru
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              Bütün Tesisler ve Araçlar – Birleşik Hat Planlama Tablosu
            </h1>
          </div>

          {/* 6 Operational Plan Actions (Section 11) */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => onChangeMode('MEVCUT_PLAN')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeMode === 'MEVCUT_PLAN'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Mevcut Planı Göster</span>
            </button>

            <button
              onClick={() => setShowBaselineAnalysis((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showBaselineAnalysis
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Mevcut Planı Analiz Et</span>
            </button>

            <button
              onClick={() => onChangeMode('OPTIMIZE_PLAN')}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeMode === 'OPTIMIZE_PLAN'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 hover:bg-blue-100'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              <span>Planı Optimize Et</span>
            </button>

            <button
              onClick={() =>
                onChangeMode(
                  activeMode === 'ALTERNATIF_YUKSEK_DOLULUK'
                    ? 'ALTERNATIF_HIZLI_TESLIMAT'
                    : 'ALTERNATIF_YUKSEK_DOLULUK'
                )
              }
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeMode === 'ALTERNATIF_YUKSEK_DOLULUK' ||
                activeMode === 'ALTERNATIF_HIZLI_TESLIMAT'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>
                {activeMode === 'ALTERNATIF_YUKSEK_DOLULUK'
                  ? 'Alternatif: Hızlı Teslimat'
                  : 'Alternatif Plan Oluştur'}
              </span>
            </button>

            <button
              onClick={() => setShowComparisonDiffOnly((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                showComparisonDiffOnly
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
              }`}
            >
              <GitCompare className="w-3.5 h-3.5" />
              <span>Değişiklikleri Karşılaştır</span>
            </button>

            <button
              onClick={handleSavePlan}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              <span>Onaylanan Planı Kaydet</span>
            </button>

            <button
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Excel İndir</span>
            </button>
          </div>
        </div>

        {savedBannerMessage && (
          <div className="p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{savedBannerMessage}</span>
          </div>
        )}

        {/* Collapsible Baseline Plan Analysis Panel */}
        {showBaselineAnalysis && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Mevcut Hat Çıkış Planı ve Optimizasyon Karşılaştırma Analizi
              </h3>
              <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                Korunan Hat: {result.summary.preservedBaselineLinesCount} · Optimize Edilen / Kısıt Uygulanan: {result.summary.optimizedLinesCount}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  1. Bursa TM & İzmir TM Varış Kısıtı Düzeltmeleri
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Mevcut planda Ankara → İzmir (19.910 desi) ve Ankara → Bursa (16.401 desi) için tanımlı TIR hatları, Bursa ve İzmir yalnızca Kamyon kabul ettiği için otomatik olarak 12.500 desi Kamyon + Cross Dock yapısına dönüştürüldü.
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  2. Marmara TM (Max 1 TIR) ve Ankara TM (Max 6 TIR) Kotası
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Marmara TM çıkışlı tek TIR hakkı en yüksek hacimli Marmara → Avrupa (108.192 desi) hattında kullanıldı; Marmara → Ankara (52.708 desi) hattındaki mevcut TIR, kısıt gereği Kamyon + Gebze/Ankara Cross Dock ile optimize edildi.
                </p>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg">
                <div className="font-semibold text-slate-900 dark:text-slate-100">
                  3. 12.500–16.000 Desi Kuralı ve Direkt Önceliği
                </div>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Avrupa → Afyon (15.777 desi), Gaziantep → Marmara (14.815 desi), Kayseri → Ankara (13.789 desi) ve Konya → Avrupa (13.863 desi) hatlarında 1 tam Kamyon (12.500 desi) korunup kalan yük Cross Dock’a aktarıldı.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Missing / Verification Warning Banner (Section 6 & 16) */}
        {result.summary.missingVehicleTypeRoutesCount > 0 && (
          <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 rounded-xl flex items-start gap-2.5 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold flex items-center gap-2">
                <span>Eksik / Doğrulanması Gereken Araç Tipi Uyarısı</span>
                <span className="px-1.5 py-0.5 bg-amber-200 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded text-[10px] font-mono">
                  {result.summary.missingVehicleTypeRoutesCount} Hat
                </span>
              </div>
              <div>
                <strong>Aksaray TM → Ankara TM</strong> hattında operasyonel araç tipi tanımlanmamıştır. Sistem otomatik araç türü atamamış olup operatör onayı beklemektedir. Ayrıca <strong>Ankara TM → Kocaeli TM</strong> hattında tanımlı araç tipinin operasyonel doğrulaması gerekmektedir.
              </div>
            </div>
          </div>
        )}

        {/* Section 12 Top Metrics Bar: Toplam Desi, Toplam Araç, Kamyon, TIR, Panelvan, Direkt Desi, Cross Dock Desisi, Ort. Doluluk, Planlanamayan Desi */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Toplam Desi</div>
            <div className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
              {filteredMetrics.totalDesi.toLocaleString('tr-TR')}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Toplam Araç</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {filteredMetrics.totalVehicles}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Kamyon Sayısı</div>
            <div className="text-lg font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">
              {filteredMetrics.totalKamyon}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">TIR Sayısı</div>
            <div className="text-lg font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
              {filteredMetrics.totalTir}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Panelvan Sayısı</div>
            <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
              {filteredMetrics.totalPanelvan}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Direkt Desi</div>
            <div className="text-lg font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
              {filteredMetrics.directDesi.toLocaleString('tr-TR')}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Cross Dock Desisi</div>
            <div className="text-lg font-bold font-mono tabular-nums text-purple-600 dark:text-purple-400 mt-0.5">
              {filteredMetrics.crossDockDesi.toLocaleString('tr-TR')}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Ort. Doluluk</div>
            <div className="text-lg font-bold font-mono tabular-nums text-teal-600 dark:text-teal-400 mt-0.5">
              %{filteredMetrics.avgFill.toFixed(1)}
            </div>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Planlanamayan Desi</div>
            <div className={`text-lg font-bold font-mono tabular-nums mt-0.5 ${filteredMetrics.unplannedDesi > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}>
              {filteredMetrics.unplannedDesi.toLocaleString('tr-TR')}
            </div>
          </div>
        </div>

        {/* 1. FAZ EK KURALLAR – HIZLI FİLTRE VE DENETİM PANELİ */}
        <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                1. Faz Ek Kurallar: Teslimat Süresi, Aynı Gün Sevk & Ankara 22:00 Operasyon Paneli
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Bölüm 1 - 7 Kuralları Tam Uyumlu
            </span>
          </div>

          {/* Quick Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setPhase1Filter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                phase1Filter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              Tüm Hatlar ({result.lines.length})
            </button>

            <button
              onClick={() => setPhase1Filter('1_GUN_SEVK')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                phase1Filter === '1_GUN_SEVK'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>1 Günlük Paketler (Aynı Gün Sevk Zorunlu)</span>
            </button>

            <button
              onClick={() => setPhase1Filter('SABIT_2200')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                phase1Filter === 'SABIT_2200'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Ankara 22:00 Sabit Araçlar</span>
            </button>

            <button
              onClick={() => setPhase1Filter('KAYSERI_15K')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                phase1Filter === 'KAYSERI_15K'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Kayseri TIR (15.000 d Sınırı)</span>
            </button>

            <button
              onClick={() => setPhase1Filter('SAMSUN_3')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                phase1Filter === 'SAMSUN_3'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100'
              }`}
            >
              <Boxes className="w-3.5 h-3.5" />
              <span>Samsun 3 Ayrı Araç Planı</span>
            </button>

            <button
              onClick={() => setPhase1Filter('PALETLI_AMAZON')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                phase1Filter === 'PALETLI_AMAZON'
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-300 border border-violet-200 dark:border-violet-800 hover:bg-violet-100'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Paletli Amazon Araçları</span>
            </button>

            <button
              onClick={() => setPhase1Filter('UGRAMALI')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                phase1Filter === 'UGRAMALI'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'bg-teal-50 dark:bg-teal-950/40 text-teal-800 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-100'
              }`}
            >
              <Waypoints className="w-3.5 h-3.5" />
              <span>Güzergâh Uğramaları</span>
            </button>

            <button
              onClick={() => setPhase1Filter('EK_ARAC')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                phase1Filter === 'EK_ARAC'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800 hover:bg-rose-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Aynı Gün Ek Araçlar</span>
            </button>
          </div>
        </div>

        {/* Section 12 Filters: Çıkış, Gerçek Varış, Araç Türü, Direkt/Cross Dock, Aktarma Merkezi, Plan Durumu, Doluluk Oranı */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2.5 pt-2">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Çıkış Tesisi
            </label>
            <select
              value={originFilter}
              onChange={(e) => setOriginFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">Tüm Çıkış Tesisleri</option>
              {facilities
                .filter((f) => f.isActive)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Gerçek Varış Tesisi
            </label>
            <select
              value={destFilter}
              onChange={(e) => setDestFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">Tüm Varış Tesisleri</option>
              {facilities
                .filter((f) => f.isActive && !f.isCrossDockOnly)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Araç Türü
            </label>
            <select
              value={vehicleTypeFilter}
              onChange={(e) => setVehicleTypeFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">Tümü (TIR, Kamyon, Panelvan)</option>
              <option value="TIR">Yalnızca TIR (22.500)</option>
              <option value="KAMYON">Yalnızca Kamyon (12.500)</option>
              <option value="PANELVAN">Yalnızca Panelvan (3.500)</option>
              <option value="TANIMSIZ">Tanımsız / Eksik Araç</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Direkt / Cross Dock
            </label>
            <select
              value={routeCategoryFilter}
              onChange={(e) => setRouteCategoryFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">Tüm Hat Türleri</option>
              <option value="DIREKT_ONLY">Direkt Hatlar</option>
              <option value="CROSS_DOCK_ONLY">Cross Dock Hatları</option>
              <option value="ANKARA_CROSS_DOCK">Ankara Cross Dock</option>
              <option value="GEBZE_CROSS_DOCK">Gebze Cross Dock</option>
              <option value="LOKAL_DAGITIM">Tesis İçi / Lokal</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Aktarma Merkezi
            </label>
            <select
              value={transferHubFilter}
              onChange={(e) => setTransferHubFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">Tüm Aktarmalar</option>
              <option value="ANKARA_CD">Ankara Cross Dock</option>
              <option value="GEBZE_CD">Gebze Cross Dock</option>
              <option value="AKSARAY_CD">Aksaray Özel Cross Dock</option>
              <option value="GAZIANTEP_CD">Gaziantep Cross Dock / Ortak</option>
              <option value="AFYON_FEEDER">Afyon Adana CD & Besleme</option>
              <option value="ERZURUM_HUB">Erzurum Hub (Van)</option>
              <option value="SAMSUN_HUB">Samsun Hub (Merzifon/Trabzon)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Plan Durumu
            </label>
            <select
              value={planStatusFilter}
              onChange={(e) => setPlanStatusFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">Tüm Durumlar</option>
              <option value="MEVCUT_KORUNDU">Mevcut Hat Korundu</option>
              <option value="OPTIMIZE_EDILDI">Optimize Edildi</option>
              <option value="CROSS_DOCK_BIRLESTIRME">Cross Dock Birleştirme</option>
              <option value="OZEL_OPERASYON">Faz 1 Özel Operasyon</option>
              <option value="KURAL_ONAYI_GEREKLI">Kural Onayı Gerekli</option>
              <option value="KISIT_UYGULANDI">Tesis Kısıtı Uygulandı</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
              Doluluk Oranı
            </label>
            <select
              value={fillRateFilter}
              onChange={(e) => setFillRateFilter(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
            >
              <option value="ALL">Tüm Doluluk Oranları</option>
              <option value="HIGH_85">%85 ve Üzeri (Yüksek)</option>
              <option value="MID_65_85">%65 – %85 Arası (Normal)</option>
              <option value="LOW_65">%65 Altı (Zorunlu Direkt)</option>
            </select>
          </div>

          <div className="flex items-end gap-1.5">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1">
                Hızlı Arama
              </label>
              <input
                type="text"
                placeholder="Hat veya tesis..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
              />
            </div>
            <button
              onClick={resetFilters}
              title="Filtreleri Sıfırla"
              className="p-1.5 text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* SINGLE UNIFIED WIDE LINEHAUL TABLE (Section 12: 11 Columns) */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="w-full text-left border-collapse min-w-[1340px]">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200 border-b-2 border-slate-300 dark:border-slate-700">
              <tr>
                <th className="py-3 px-3.5 w-[150px] border-r border-slate-200 dark:border-slate-700">
                  Çıkış Tesisi
                </th>
                <th className="py-3 px-3 w-[120px] border-r border-slate-200 dark:border-slate-700">
                  Araç / Hat
                </th>
                <th className="py-3 px-3 w-[145px] border-r border-slate-200 dark:border-slate-700">
                  Araç Hakkı
                </th>
                <th className="py-3 px-3.5 min-w-[230px] border-r border-slate-200 dark:border-slate-700">
                  Yükleme Yapılacak Tesisler
                </th>
                <th className="py-3 px-3 w-[135px] border-r border-slate-200 dark:border-slate-700">
                  Gerçek Varış Tesisi
                </th>
                <th className="py-3 px-3 w-[105px] text-right border-r border-slate-200 dark:border-slate-700">
                  Toplam Desi
                </th>
                <th className="py-3 px-3 w-[100px] text-right border-r border-slate-200 dark:border-slate-700">
                  Kapasite
                </th>
                <th className="py-3 px-3 w-[120px] border-r border-slate-200 dark:border-slate-700">
                  Doluluk
                </th>
                <th className="py-3 px-3 w-[95px] text-right border-r border-slate-200 dark:border-slate-700">
                  Mesafe (km)
                </th>
                <th className="py-3 px-3 w-[105px] border-r border-slate-200 dark:border-slate-700">
                  Tahmini Süre
                </th>
                <th className="py-3 px-3 w-[125px] border-r border-slate-200 dark:border-slate-700">
                  Taşıma Türü
                </th>
                <th className="py-3 px-3.5 min-w-[210px]">
                  Plan Durumu & Değişiklik Nedeni
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 text-xs">
              {groupedByOrigin.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-12 text-center text-slate-500 dark:text-slate-400">
                    Seçilen filtre kriterlerine uygun araç hattı bulunamadı. Filtreleri sıfırlayarak tüm hatları görüntüleyebilirsiniz.
                  </td>
                </tr>
              ) : (
                groupedByOrigin.map((group) =>
                  group.lines.map((line, idxInGroup) => {
                    const isFirstInOrigin = idxInGroup === 0;
                    const groupTotalDesi = group.lines.reduce((s, l) => s + l.totalDesi, 0);
                    const groupTirCount = group.lines.filter((l) => l.vehicleType === 'TIR').length;
                    const groupKamyonCount = group.lines.filter(
                      (l) => l.vehicleType === 'KAMYON'
                    ).length;
                    const groupPanelvanCount = group.lines.filter(
                      (l) => l.vehicleType === 'PANELVAN'
                    ).length;

                    const isCrossDockLine =
                      line.routeCategory === 'ANKARA_CROSS_DOCK' ||
                      line.routeCategory === 'GEBZE_CROSS_DOCK';

                    return (
                      <tr
                        key={line.id}
                        className={`transition-colors ${
                          isFirstInOrigin
                            ? 'border-t-2 border-slate-300 dark:border-slate-700'
                            : ''
                        } ${
                          isCrossDockLine
                            ? 'bg-indigo-50/25 dark:bg-indigo-950/15 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
                            : 'hover:bg-slate-50/90 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Grouped Yellow/Orange Outbound Facility Cell (Excel visual logic preserved) */}
                        {isFirstInOrigin && (
                          <td
                            rowSpan={group.lines.length}
                            className="align-top py-3 px-3.5 bg-amber-50/90 dark:bg-amber-950/30 border-r border-slate-200 dark:border-slate-700"
                          >
                            <div className="font-bold text-orange-700 dark:text-amber-300 text-sm tracking-tight">
                              {group.originName}
                            </div>
                            <div className="mt-1.5 space-y-0.5 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400">
                              <div>Toplam Hat: {group.lines.length}</div>
                              <div>
                                {groupTirCount > 0 && `${groupTirCount} TIR `}
                                {groupKamyonCount > 0 && `${groupKamyonCount} Kamyon `}
                                {groupPanelvanCount > 0 && `${groupPanelvanCount} Panelvan`}
                              </div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {groupTotalDesi.toLocaleString('tr-TR')} desi
                              </div>
                            </div>
                          </td>
                        )}

                        {/* Vehicle / Line Code */}
                        <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 font-mono tabular-nums">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {line.lineCode}
                          </div>
                          <div
                            className={`text-[11px] font-semibold mt-0.5 ${
                              line.isMissingVehicleType
                                ? 'text-rose-600 dark:text-rose-400 font-bold'
                                : line.vehicleType === 'TIR'
                                ? 'text-blue-600 dark:text-blue-400'
                                : line.vehicleType === 'PANELVAN'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {line.isMissingVehicleType
                              ? 'TANIMSIZ (!)'
                              : line.vehicleType === 'TIR'
                              ? 'TIR · Çekici'
                              : line.vehicleType === 'PANELVAN'
                              ? 'PANELVAN'
                              : 'KAMYON'}
                          </div>
                        </td>

                        {/* Araç Hakkı (Section 16 Spec) */}
                        <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800">
                          {line.isMissingVehicleType ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                              <AlertTriangle className="w-3 h-3 shrink-0" />
                              Eksik Araç Tanımı
                            </span>
                          ) : line.isAntalyaSpecialTir ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                              Antalya Özel TIR (+1)
                            </span>
                          ) : line.isAnkaraCdFixedTir ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300 dark:border-indigo-800">
                              Ankara CD Sabit TIR
                            </span>
                          ) : line.isAnkaraCdAdditionalTir ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800">
                              Ankara CD İlave TIR
                            </span>
                          ) : line.vehicleType === 'PANELVAN' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                              Panelvan
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              {line.vehicleQuotaLabel || 'Sabit Hat Aracı'}
                            </span>
                          )}
                          {line.requiresVerification && (
                            <div className="mt-1">
                              <span
                                className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                                  line.requiresRuleApproval
                                    ? 'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/50 border-rose-300'
                                    : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/50 border-amber-300'
                                }`}
                              >
                                {line.requiresRuleApproval ? 'Kural Onayı Gerekli' : 'Doğrulanmalı'}
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Loaded Facilities in a Single Cell */}
                        <td className="py-2.5 px-3.5 border-r border-slate-100 dark:border-slate-800">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {line.loadedSegments.map((seg, sIdx) => (
                              <React.Fragment key={seg.segmentId}>
                                {sIdx > 0 && (
                                  <span className="text-slate-400 font-bold">+</span>
                                )}
                                <span className="inline-flex items-baseline gap-1">
                                  <strong className="font-semibold text-slate-800 dark:text-slate-200">
                                    {seg.sourceFacilityName}
                                  </strong>
                                  <span className="font-mono tabular-nums text-slate-500 dark:text-slate-400">
                                    ({seg.desi.toLocaleString('tr-TR')} d)
                                  </span>
                                  {seg.isFromCrossDock && (
                                    <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                                      [
                                      {seg.crossDockFacilityId === 'GEBZE TM'
                                        ? 'Gebze CD'
                                        : seg.crossDockFacilityId === 'AKSARAY TM'
                                        ? 'Aksaray CD'
                                        : seg.crossDockFacilityId === 'GAZİANTEP TM'
                                        ? 'Gaziantep CD'
                                        : seg.crossDockFacilityId === 'AFYON TM'
                                        ? 'Afyon CD'
                                        : 'Ankara CD'}
                                      ]
                                    </span>
                                  )}
                                </span>
                              </React.Fragment>
                            ))}
                          </div>
                        </td>

                        {/* Destination Facility */}
                        <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {line.destinationFacilityName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {line.routeCategory === 'ANKARA_CROSS_DOCK'
                              ? 'Ankara CD Aktarmalı'
                              : line.routeCategory === 'GEBZE_CROSS_DOCK'
                              ? 'Gebze CD Aktarmalı'
                              : line.routeCategory === 'AKSARAY_CROSS_DOCK'
                              ? 'Aksaray CD Aktarmalı'
                              : line.routeCategory === 'GAZIANTEP_CROSS_DOCK'
                              ? 'Gaziantep CD / Ortak'
                              : line.routeCategory === 'AFYON_CROSS_DOCK'
                              ? 'Afyon Adana Özel CD'
                              : line.routeCategory === 'ARA_HAT'
                              ? 'Faz 1 Ara Hat / Özel'
                              : line.routeCategory === 'LOKAL_DAGITIM'
                              ? 'Tesis İçi / Lokal'
                              : 'Direkt Sevkiyat'}
                          </div>
                        </td>

                        {/* Total Desi */}
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800">
                          {line.totalDesi.toLocaleString('tr-TR')}
                          <div className="text-[10px] font-normal text-slate-500">
                            {line.totalPackages.toLocaleString('tr-TR')} pkt
                          </div>
                        </td>

                        {/* Capacity */}
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-slate-800">
                          {line.capacityDesi.toLocaleString('tr-TR')}
                        </td>

                        {/* Fill Rate Bar */}
                        <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800">
                          <div className="flex items-center justify-between font-mono tabular-nums text-xs">
                            <span
                              className={`font-bold ${
                                line.totalDesi > line.capacityDesi
                                  ? 'text-red-600 dark:text-red-400'
                                  : line.fillRate >= 85
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : line.fillRate >= 65
                                  ? 'text-blue-600 dark:text-blue-400'
                                  : 'text-amber-600 dark:text-amber-400'
                              }`}
                            >
                              %{line.fillRate.toFixed(1)}
                            </span>
                            {line.totalDesi > line.capacityDesi && (
                              <span className="text-[10px] font-semibold text-red-600">
                                AŞIM!
                              </span>
                            )}
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                line.totalDesi > line.capacityDesi
                                  ? 'bg-red-600'
                                  : line.fillRate >= 85
                                  ? 'bg-emerald-600'
                                  : line.fillRate >= 65
                                  ? 'bg-blue-600'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${Math.min(100, line.fillRate)}%` }}
                            />
                          </div>
                        </td>

                        {/* Mesafe (km) */}
                        <td className="py-2.5 px-3 text-right border-r border-slate-100 dark:border-slate-800 font-mono tabular-nums">
                          {line.delivery.hasMissingDistance ? (
                            <span className="text-red-600 dark:text-red-400 font-bold text-[11px]">
                              Eksik!
                            </span>
                          ) : (
                            <div className="font-semibold text-slate-800 dark:text-slate-200">
                              {line.delivery.distanceKm} km
                            </div>
                          )}
                        </td>

                        {/* Tahmini Süre */}
                        <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800 font-mono tabular-nums">
                          {line.delivery.hasMissingDistance ? (
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400 font-sans font-semibold text-[11px]">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>Mesafe Eksik</span>
                            </div>
                          ) : (
                            <div>
                              <div className="flex items-center gap-1">
                                <span className="font-bold text-slate-900 dark:text-slate-100">
                                  {line.delivery.totalEstimatedDays} Gün
                                </span>
                                {line.delivery.deliveryDaysCategory && (
                                  <span className={`text-[9px] font-bold px-1 py-0.2 rounded ${
                                    line.delivery.deliveryDaysCategory === 2
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                                      : line.delivery.deliveryDaysCategory === 3
                                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  }`}>
                                    {line.delivery.deliveryDaysCategory}G
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                Çıkış {line.delivery.departureTime}
                              </div>
                              {line.delivery.inboundLeg && (
                                <div className="mt-1 pt-1 border-t border-slate-200 dark:border-slate-800 text-[9px] leading-tight text-slate-500 font-sans space-y-0.5">
                                  <div title="Giriş Ayağı">
                                    <span className="font-medium text-slate-700 dark:text-slate-300">Giriş:</span> {line.delivery.inboundLeg.distanceKm} km ({line.delivery.inboundLeg.estimatedDays}g)
                                  </div>
                                  <div title="Aktarma Beklemesi">
                                    <span className="font-medium text-indigo-600 dark:text-indigo-400">Aktarma:</span> +{line.delivery.transferBufferHours || 4} sa bekleme
                                  </div>
                                  {line.delivery.mainLeg && (
                                    <div title="Ana Hat Ayağı">
                                      <span className="font-medium text-slate-700 dark:text-slate-300">Ana Hat:</span> {line.delivery.mainLeg.distanceKm} km ({line.delivery.mainLeg.estimatedDays}g)
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </td>

                        {/* Taşıma Türü */}
                        <td className="py-2.5 px-3 border-r border-slate-100 dark:border-slate-800">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold whitespace-nowrap ${
                              line.routeCategory === 'DIREKT' || line.routeCategory === 'MEVCUT_HAT'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                                : line.routeCategory === 'ANKARA_CROSS_DOCK'
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                                : line.routeCategory === 'GEBZE_CROSS_DOCK'
                                ? 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800'
                                : line.routeCategory === 'AFYON_UZERINDEN'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                : line.routeCategory === 'ERZURUM_UZERINDEN' || line.routeCategory === 'SAMSUN_UZERINDEN'
                                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                            }`}
                          >
                            {line.transportTypeLabel || (
                              line.routeCategory === 'ANKARA_CROSS_DOCK'
                                ? 'Ankara Cross Dock'
                                : line.routeCategory === 'GEBZE_CROSS_DOCK'
                                ? 'Gebze Cross Dock'
                                : line.routeCategory === 'AFYON_UZERINDEN'
                                ? 'Afyon üzerinden'
                                : line.routeCategory === 'ERZURUM_UZERINDEN'
                                ? 'Erzurum üzerinden'
                                : line.routeCategory === 'SAMSUN_UZERINDEN'
                                ? 'Samsun üzerinden'
                                : line.routeCategory === 'LOKAL_DAGITIM'
                                ? 'Lokal Dağıtım'
                                : 'Direkt'
                            )}
                          </span>
                        </td>

                        {/* Plan Status & Vehicle Details (Section 6 Spec) */}
                        <td className="py-2.5 px-3.5 space-y-1">
                          <div className="flex flex-wrap items-center gap-1">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {line.planStatus === 'MEVCUT_KORUNDU' && 'Mevcut Hat Korundu'}
                              {line.planStatus === 'OPTIMIZE_EDILDI' && 'Optimize Edildi'}
                              {line.planStatus === 'CROSS_DOCK_BIRLESTIRME' && 'Cross Dock Birleştirme'}
                              {line.planStatus === 'OZEL_OPERASYON' && 'Faz 1 Özel Operasyon'}
                              {line.planStatus === 'ARA_HAT_OPERASYONU' && 'Ara Hat Operasyonu'}
                              {line.planStatus === 'AYNI_GUN_EK_ARAC' && 'Aynı Gün Ek Araç'}
                              {line.planStatus === 'PALETLI_AMAZON_SEVK' && 'Paletli Amazon Sevk'}
                              {line.planStatus === 'SEHIR_UGRAMALI' && 'Şehir Uğramalı Hat'}
                              {line.planStatus === 'KURAL_ONAYI_GEREKLI' && (
                                <span className="text-rose-600 dark:text-rose-400 font-bold">
                                  Kural Onayı Gerekli (!)
                                </span>
                              )}
                              {line.planStatus === 'KISIT_UYGULANDI' && 'Tesis Kısıtı Uygulandı'}
                              {line.planStatus === 'KAPASITE_UYARISI' && 'Kapasite Uyarısı'}
                              {line.planStatus === 'BAGLI_TESIS_AKTARIMI' && 'Bağlı Tesis Aktarımı'}
                            </span>

                            {line.vehicleScheduleLabel && (
                              <span
                                className={`px-1.5 py-0.5 text-[9px] font-bold rounded ${
                                  line.vehicleScheduleType === 'PALETLI_AMAZON_ARACI'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                                    : line.vehicleScheduleType === 'GECE_TUTULAN_ARAC'
                                    ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                    : line.vehicleScheduleType === 'EK_ARAC'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                    : line.vehicleScheduleType === 'UGRAMALI_ARAC'
                                    ? 'bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300'
                                    : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'
                                }`}
                              >
                                {line.vehicleScheduleLabel}
                              </span>
                            )}
                          </div>

                          {(line.localCollectionDesi !== undefined || line.crossDockDesi !== undefined) && (
                            <div className="text-[10px] text-slate-600 dark:text-slate-400 font-mono space-x-1.5">
                              <span>Toplama: {(line.localCollectionDesi ?? 0).toLocaleString('tr-TR')} d</span>
                              <span>·</span>
                              <span>Cross Dock: {(line.crossDockDesi ?? 0).toLocaleString('tr-TR')} d</span>
                              <span>·</span>
                              <span>Boş: {((line.remainingCapacityDesi ?? (line.capacityDesi - line.totalDesi))).toLocaleString('tr-TR')} d</span>
                            </div>
                          )}

                          {line.waypoints && line.waypoints.length > 0 && (
                            <div className="text-[10px] text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 p-1 rounded border border-teal-200 dark:border-teal-800">
                              <strong>Uğrama:</strong> {line.waypoints.map((w) => `${w.facilityName} (+${w.extraKm} km, ${w.droppedDesi.toLocaleString('tr-TR')} d)`).join(', ')}
                            </div>
                          )}

                          {line.isPalletized && line.palletizedInfo && (
                            <div className="text-[10px] text-purple-800 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 p-1 rounded border border-purple-200 dark:border-purple-800">
                              <strong>Paletleme:</strong> {line.palletizedInfo.palletDesi.toLocaleString('tr-TR')} desi (Amazon araç seçeneği, karar eşiği: {line.palletizedInfo.decisionThresholdDesi.toLocaleString('tr-TR')} d)
                            </div>
                          )}

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                            {line.planningJustification || line.comparison.explanation}
                          </div>

                          <div className="pt-1 flex items-center justify-end">
                            <button
                              onClick={() => setSelectedVehicleForModal(line)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 border border-blue-200 dark:border-blue-800 rounded cursor-pointer transition-colors"
                              title="Bölüm 6: 17 Alanlık Araç ve Hat Planlama Raporunu İncele"
                            >
                              <Eye className="w-3 h-3 shrink-0" />
                              <span>17 Alanlık Araç Raporu</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 6.2 & 16: Pending / Unplanned Shipments Table (Zero Silent Loss Guarantee) */}
      {result.unplannedShipments.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-800 rounded-xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Bekleyen / Planlanamayan Gönderi Listesi (Kapasite ve Kısıt Koruma Raporu)
              </h2>
            </div>
            <div className="text-xs font-mono tabular-nums font-semibold text-amber-700 dark:text-amber-300">
              Toplam Bekleyen: {result.summary.unplannedDesi.toLocaleString('tr-TR')} desi ({result.unplannedShipments.length} Kayıt)
            </div>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Bölüm 6.2 ve Bölüm 8 kuralları gereği Ankara Cross Dock üzerinden her bir varış tesisi için en fazla 1 Kamyon + 1 TIR planlanabilir ve Ankara TM çıkışlı toplam TIR sayısı 6’yı aşamaz. Kapasiteyi aşan araç oluşturulmamış ve hiçbir gönderi sessizce silinmemiştir:
          </p>

          <div className="overflow-x-auto max-h-[260px] overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-b border-amber-200 dark:border-amber-800">
                <tr>
                  <th className="py-2 px-3">Kaynak Tesis</th>
                  <th className="py-2 px-3">Gerçek Varış Tesisi</th>
                  <th className="py-2 px-3">Beklediği Aktarma Merkezi</th>
                  <th className="py-2 px-3 text-right">Desi</th>
                  <th className="py-2 px-3 text-right">Paket</th>
                  <th className="py-2 px-3">Kısıt / Bekleme Nedeni</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {result.unplannedShipments.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {u.originFacilityName}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {u.trueDestinationName}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                      {u.currentLocationId}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-amber-700 dark:text-amber-400">
                      {u.desi.toLocaleString('tr-TR')}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                      {u.packages.toLocaleString('tr-TR')}
                    </td>
                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                      {u.explanation}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bölüm 6: 17 Alanlık Detaylı Araç ve Hat Planlama Raporu Modalı */}
      {selectedVehicleForModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-4xl w-full p-6 shadow-2xl space-y-6 my-8 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 text-xs font-bold font-mono rounded bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    {selectedVehicleForModal.lineCode}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Bölüm 6: 17 Alanlık Detaylı Araç ve Hat Planlama Raporu
                  </span>
                </div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-1">
                  {selectedVehicleForModal.originFacilityName} → {selectedVehicleForModal.destinationFacilityName}
                </h2>
              </div>
              <button
                onClick={() => setSelectedVehicleForModal(null)}
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Special Operational Callouts (Kayseri 15.000, Samsun 3 Araç, Paletleme, Uğrama) */}
            {selectedVehicleForModal.maxLoadLimitDesi && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-amber-900 dark:text-amber-200 block">
                    Bölüm 3.9 & 7: Kayseri 15.000 Desi Yükleme Tavanı Kuralı Uygulanmıştır
                  </span>
                  <span className="text-amber-800 dark:text-amber-300 mt-0.5 block">
                    Genel TIR kapasitesi (22.500 desi) korunarak, Kayseri TIR’ına en fazla 15.000 desi yükleme sınırı kuralı işletilmiştir. Taşan paketler gece tutulan ek araca yönlendirilmiştir.
                  </span>
                </div>
              </div>
            )}

            {selectedVehicleForModal.destinationFacilityId.includes('SAMSUN TM') && (
              <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-300 dark:border-purple-800 rounded-xl flex items-start gap-3">
                <Boxes className="w-5 h-5 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-purple-900 dark:text-purple-200 block">
                    Bölüm 3.5 & 7: Ankara → Samsun 3 Ayrı Araç Planı
                  </span>
                  <span className="text-purple-800 dark:text-purple-300 mt-0.5 block">
                    Samsun yönünde 1 Sabit TIR, 1 Sabit Kamyon ve gece Cross Dock için 1 Kamyon olmak üzere toplam 3 ayrı araç planlanmış; Samsun Cross Dock paketleri ve Ankara toplaması kapasite sınırları içinde mükerrersiz dağıtılmıştır.
                  </span>
                </div>
              </div>
            )}

            {selectedVehicleForModal.isPalletized && selectedVehicleForModal.palletizedInfo && (
              <div className="p-3.5 bg-violet-50 dark:bg-violet-950/40 border border-violet-300 dark:border-violet-800 rounded-xl flex items-start gap-3">
                <Truck className="w-5 h-5 text-violet-600 dark:text-violet-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-violet-900 dark:text-violet-200 block">
                    Bölüm 4 & 7: Paletleme Karar Eşiği ve Amazon Entegrasyonu
                  </span>
                  <span className="text-violet-800 dark:text-violet-300 mt-0.5 block">
                    {selectedVehicleForModal.palletizedInfo.explanation} (Karar Eşiği: {selectedVehicleForModal.palletizedInfo.decisionThresholdDesi.toLocaleString('tr-TR')} desi — Araç kapasitesi değildir).
                  </span>
                </div>
              </div>
            )}

            {selectedVehicleForModal.waypoints && selectedVehicleForModal.waypoints.length > 0 && (
              <div className="p-3.5 bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 rounded-xl flex items-start gap-3">
                <Waypoints className="w-5 h-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold text-teal-900 dark:text-teal-200 block">
                    Bölüm 1.2: Güzergâh Üzeri Şehir Uğraması Kuralı
                  </span>
                  <span className="text-teal-800 dark:text-teal-300 mt-0.5 block">
                    Ana güzergâh üzerindeki yakın şehre kalan paketler ({selectedVehicleForModal.waypoints.map((w) => `${w.facilityName} - ${w.droppedDesi.toLocaleString('tr-TR')} desi, +${w.extraKm} km`).join(', ')}) araç kapasitesi aşılmadan yüklenmiş ve ek süre hesaplanmıştır.
                  </span>
                </div>
              </div>
            )}

            {/* 17 Alanlık Standart Tablo / Izgara */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {/* 1. Araç Çıkış Tesisi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  1. Araç Çıkış Tesisi
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedVehicleForModal.originFacilityName}
                </div>
              </div>

              {/* 2. Nihai Güzergâh */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  2. Nihai Güzergâh
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedVehicleForModal.destinationFacilityName}
                </div>
              </div>

              {/* 3. Araç Tipi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  3. Araç Tipi
                </div>
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-0.5">
                  {selectedVehicleForModal.vehicleType} · {selectedVehicleForModal.capacityDesi.toLocaleString('tr-TR')} Desi
                </div>
              </div>

              {/* 4. Sabit veya Ek Araç Bilgisi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  4. Sabit / Ek Araç Bilgisi
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedVehicleForModal.vehicleScheduleLabel || selectedVehicleForModal.vehicleQuotaLabel}
                </div>
              </div>

              {/* 5. Çıkış Saati */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  5. Çıkış Saati
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedVehicleForModal.departureTime || selectedVehicleForModal.delivery.departureTime || '22:00'}
                </div>
              </div>

              {/* 6. Araç Kapasitesi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  6. Araç Kapasitesi
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedVehicleForModal.capacityDesi.toLocaleString('tr-TR')} Desi
                  {selectedVehicleForModal.maxLoadLimitDesi && (
                    <span className="text-xs font-normal text-amber-600 ml-1.5">
                      (Yükleme Sınırı: {selectedVehicleForModal.maxLoadLimitDesi.toLocaleString('tr-TR')} d)
                    </span>
                  )}
                </div>
              </div>

              {/* 7. Yüklenen Toplam Desi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  7. Yüklenen Toplam Desi
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {selectedVehicleForModal.totalDesi.toLocaleString('tr-TR')} Desi
                  <span className="text-xs font-normal text-slate-500 ml-1.5">
                    ({selectedVehicleForModal.totalPackages.toLocaleString('tr-TR')} paket)
                  </span>
                </div>
              </div>

              {/* 8. Kalan Kapasite */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  8. Kalan Kapasite
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                  {((selectedVehicleForModal.remainingCapacityDesi ?? (selectedVehicleForModal.capacityDesi - selectedVehicleForModal.totalDesi))).toLocaleString('tr-TR')} Desi
                </div>
              </div>

              {/* 9. Araç Doluluk Yüzdesi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  9. Araç Doluluk Yüzdesi
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-0.5">
                  %{selectedVehicleForModal.fillRate.toFixed(1)}
                </div>
              </div>

              {/* 11. Cross Dock'tan Gelen Paket Desisi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  11. Cross Dock’tan Gelen Desi
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-purple-600 dark:text-purple-400 mt-0.5">
                  {(selectedVehicleForModal.crossDockDesi ?? 0).toLocaleString('tr-TR')} Desi
                </div>
              </div>

              {/* 12. Tesisin Kendi Toplama Desisi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  12. Tesisin Kendi Toplama Desisi
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
                  {(selectedVehicleForModal.localCollectionDesi ?? selectedVehicleForModal.totalDesi).toLocaleString('tr-TR')} Desi
                </div>
              </div>

              {/* 14. Ek Mesafe */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  14. Ek Güzergâh Mesafesi
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-teal-600 dark:text-teal-400 mt-0.5">
                  {selectedVehicleForModal.extraRouteKm ? `+${selectedVehicleForModal.extraRouteKm} km` : '0 km (Direkt Hat)'}
                </div>
              </div>

              {/* 15. Tahmini Teslimat Süresi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  15. Tahmini Teslimat Süresi
                </div>
                <div className="text-sm font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedVehicleForModal.delivery.totalEstimatedDays} Gün
                  <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 ml-1.5">
                    {selectedVehicleForModal.delivery.deliveryDaysCategory ?? 1}G Teslimat
                  </span>
                </div>
              </div>

              {/* 16. Paletleme Bilgisi */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  16. Paletleme Bilgisi
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedVehicleForModal.isPalletized && selectedVehicleForModal.palletizedInfo
                    ? `Paletlendi (${selectedVehicleForModal.palletizedInfo.palletDesi.toLocaleString('tr-TR')} d)`
                    : 'Paletleme Yok (Doğrudan Yükleme)'}
                </div>
              </div>

              {/* 13. Uğrama Yapılan Şehirler */}
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  13. Uğrama Yapılan Şehirler
                </div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                  {selectedVehicleForModal.waypoints && selectedVehicleForModal.waypoints.length > 0
                    ? selectedVehicleForModal.waypoints.map((w) => w.facilityName).join(', ')
                    : 'Uğrama Yok (Tek Nokta Varış)'}
                </div>
              </div>
            </div>

            {/* 17. Araç Planlama Gerekçesi */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-xl space-y-1">
              <div className="text-xs font-bold text-slate-700 dark:text-slate-300">
                17. Araç Planlama Gerekçesi ve Operasyonel Dayanak
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {selectedVehicleForModal.planningJustification || selectedVehicleForModal.comparison.explanation}
              </p>
              <div className="text-[11px] text-slate-500 font-mono pt-1">
                Kural Etiketi: {selectedVehicleForModal.phase1RuleTag || 'Standart Hat Optimizasyonu'} · Taşıma: {selectedVehicleForModal.transportTypeLabel}
              </div>
            </div>

            {/* 10. Yüklenen Paketlerin Gerçek Varış Tesisleri (Ayrıntılı Kırılım Tablosu) */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  10. Yüklenen Paketlerin Gerçek Varış Tesisleri ve Kaynak Dağılımı ({selectedVehicleForModal.loadedSegments.length} Segment)
                </div>
                <div className="text-xs font-mono tabular-nums text-slate-500">
                  Gerçek Varışlar Kesin Olarak Korunmaktadır
                </div>
              </div>

              <div className="overflow-x-auto max-h-[220px] overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-2 px-3">Kaynak Tesis</th>
                      <th className="py-2 px-3">Gerçek Varış Tesisi</th>
                      <th className="py-2 px-3">Tür</th>
                      <th className="py-2 px-3 text-right">Desi</th>
                      <th className="py-2 px-3 text-right">Paket</th>
                      <th className="py-2 px-3">Açıklama / Aktarma Nedeni</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {selectedVehicleForModal.loadedSegments.map((seg) => (
                      <tr key={seg.segmentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                          {seg.sourceFacilityName}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                          {seg.trueDestinationName}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            seg.isFromCrossDock
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}>
                            {seg.isFromCrossDock ? 'Cross Dock' : 'Kendi Toplaması'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                          {seg.desi.toLocaleString('tr-TR')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                          {seg.packages.toLocaleString('tr-TR')}
                        </td>
                        <td className="py-2 px-3 text-slate-500 dark:text-slate-400">
                          {seg.transferReason || 'Doğrudan hat sevkiyatı'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 font-mono">
                Logistics AI · 1. Faz Ek Kurallar Denetim Motoru
              </span>
              <button
                onClick={() => setSelectedVehicleForModal(null)}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer transition-colors"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
