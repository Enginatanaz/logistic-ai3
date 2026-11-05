import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  GitMerge,
  Layers,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import {
  Facility,
  PlanningExecutionResult,
  RuleVerificationCase,
} from '../types/logistics';

interface DashboardViewProps {
  result: PlanningExecutionResult;
  facilities: Facility[];
  verificationCases: RuleVerificationCase[];
  onNavigate: (tab: string) => void;
  onExportExcel: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  result,
  facilities,
  verificationCases,
  onNavigate,
  onExportExcel,
}) => {
  const { summary, invariants, allInvariantsPassed } = result;
  const passedTestsCount = verificationCases.filter((c) => c.passed).length;

  // Group vehicle counts by origin facility (top 10 active origins)
  const originStats = facilities
    .filter((f) => f.isActive)
    .map((f) => {
      const lines = result.lines.filter((l) => l.originFacilityId === f.id);
      const tirCount = lines.filter((l) => l.vehicleType === 'TIR').length;
      const kamyonCount = lines.filter((l) => l.vehicleType === 'KAMYON').length;
      const totalDesi = lines.reduce((s, l) => s + l.totalDesi, 0);
      const avgFill =
        lines.length > 0
          ? Number((lines.reduce((s, l) => s + l.fillRate, 0) / lines.length).toFixed(1))
          : 0;
      return {
        facility: f,
        totalVehicles: lines.length,
        tirCount,
        kamyonCount,
        totalDesi,
        avgFill,
      };
    })
    .filter((st) => st.totalVehicles > 0)
    .sort((a, b) => b.totalDesi - a.totalDesi);

  const directSharePct =
    summary.totalPlannedDesi > 0
      ? Number(
          (
            ((summary.plannedDirectDesi + summary.plannedSelfRouteDesi) /
              summary.totalPlannedDesi) *
            100
          ).toFixed(1)
        )
      : 0;

  const crossDockSharePct =
    summary.totalPlannedDesi > 0
      ? Number(((summary.plannedCrossDockDesi / summary.totalPlannedDesi) * 100).toFixed(1))
      : 0;

  return (
    <div className="space-y-6">
      {/* Operational Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
        <div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Aktif Senaryo · {result.planName} · Üç Hacim Ortak Katsayı Modeli
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-1">
            Lojistik Operasyon ve Hat Optimizasyon Kontrol Merkezi
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            19 Standart Transfer Merkezi + Gebze Cross Dock ve Ankara Cross Dock kuralları bağımsız hesaplama motorunda gerçek zamanlı işletilmektedir.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            onClick={() => onNavigate('hat-planlama')}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Tek Tablolu Hat Planını Aç</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onExportExcel}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel Raporu İndir</span>
          </button>
        </div>
      </div>

      {/* 10 Core Operational KPIs (Section 13 - Ekran 1) */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Toplam Paket Desisi</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {summary.totalInputDesi.toLocaleString('tr-TR')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
            {summary.totalInputPackages.toLocaleString('tr-TR')} paket · Oran: {(summary.totalInputDesi / Math.max(1, summary.totalInputPackages)).toFixed(2)}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Toplam Planlanan Araç</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {summary.totalVehicles}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
            {summary.preservedBaselineLinesCount} Mevcut Hat Korundu · {summary.optimizedLinesCount} Optimize
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Toplam Kamyon (12.500 Desi)</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {summary.totalKamyon}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            Bursa & İzmir varışları %100 Kamyon
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Toplam TIR (22.500 Desi)</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-1">
            {summary.totalTir}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
            Ankara: {summary.ankaraOutboundTirCount}/6 · Marmara: {summary.marmaraOutboundTirCount}/1
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Ortalama Araç Doluluğu</div>
          <div className="text-2xl font-bold font-mono tabular-nums text-emerald-600 dark:text-emerald-400 mt-1">
            %{summary.averageFillRate.toFixed(1)}
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mt-2 overflow-hidden">
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
              style={{ width: `${Math.min(100, summary.averageFillRate)}%` }}
            />
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Direkt Taşınan Desi</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {(summary.plannedDirectDesi + summary.plannedSelfRouteDesi).toLocaleString('tr-TR')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
            Planlanan yükün %{directSharePct}’i (Direkt önceliği)
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Cross Dock Üzerinden Taşınan</div>
          <div className="text-xl font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400 mt-1">
            {summary.plannedCrossDockDesi.toLocaleString('tr-TR')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
            Planlanan yükün %{crossDockSharePct}’i (Ankara + Gebze CD)
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Planlanamayan / Bekleyen Desi</div>
          <div className="text-xl font-bold font-mono tabular-nums text-amber-600 dark:text-amber-400 mt-1">
            {summary.unplannedDesi.toLocaleString('tr-TR')}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 font-mono tabular-nums">
            {result.unplannedShipments.length} kayıt (Ankara CD araç/TIR kotası)
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Kapasite Aşımı Kontrolü</div>
          <div
            className={`text-xl font-bold font-mono tabular-nums mt-1 ${
              summary.capacityOverflowCount === 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {summary.capacityOverflowCount} Araç
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {summary.capacityOverflowCount === 0
              ? 'Hiçbir araçta kapasite aşımı yok'
              : 'Kapasite sınırı uyarısı mevcut'}
          </div>
        </div>

        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl">
          <div className="text-xs text-slate-500 dark:text-slate-400">Tahmini Teslimat Performansı</div>
          <div className="text-xl font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-1">
            {summary.estimatedAvgDeliveryDays.toFixed(2)} Gün
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">
            {summary.missingDistanceRoutesCount === 0
              ? 'Tüm aktif rotaların mesafesi tanımlı'
              : `${summary.missingDistanceRoutesCount} rotada mesafe eksik uyarısı`}
          </div>
        </div>
      </div>

      {/* Two-Column Verification & Facility Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Automatic Post-Planning Invariants & Verification Status */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Otomatik Hesaplama Doğrulama Sistemi
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Her planlama sonrası zorunlu 7 matematiksel ve operasyonel denklik kontrolü
                </p>
              </div>
              <span
                className={`text-xs font-semibold font-mono tabular-nums ${
                  allInvariantsPassed
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-amber-600 dark:text-amber-400'
                }`}
              >
                {invariants.filter((i) => i.passed).length}/{invariants.length} Doğrulandı
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800/70 mt-2">
              {invariants.map((inv) => (
                <div key={inv.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    {inv.passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                        {inv.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {inv.details}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-right text-slate-700 dark:text-slate-300 shrink-0">
                    {inv.actual}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>
                Bölüm 16 Kural Testleri: <strong className="font-mono">{passedTestsCount}/{verificationCases.length}</strong> Başarılı
              </span>
            </div>
            <button
              onClick={() => onNavigate('katsayi-kurallar')}
              className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Tüm Test Senaryolarını İncele →
            </button>
          </div>
        </div>

        {/* Right: Facility Vehicle Dispatch Table */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Tesis Bazlı Araç ve Yük Çıkış Özeti
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  19 Çıkış Tesisi + Gebze Cross Dock üzerinden planlanan TIR ve Kamyon dağılımı
                </p>
              </div>
              <button
                onClick={() => onNavigate('cross-dock')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Cross Dock Analizi</span>
              </button>
            </div>

            <div className="overflow-x-auto mt-2 max-h-[380px] overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800/90 text-xs font-semibold text-slate-600 dark:text-slate-300 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-2 px-3">Çıkış Tesisi</th>
                    <th className="py-2 px-3 text-right">Toplam Araç</th>
                    <th className="py-2 px-3 text-right">TIR (22.5K)</th>
                    <th className="py-2 px-3 text-right">Kamyon (12.5K)</th>
                    <th className="py-2 px-3 text-right">Planlanan Desi</th>
                    <th className="py-2 px-3 text-right">Ort. Doluluk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
                  {originStats.map((st) => (
                    <tr
                      key={st.facility.id}
                      className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                        {st.facility.name}
                        {st.facility.id === 'ANKARA TM' && (
                          <span className="text-slate-500 dark:text-slate-400 font-normal">
                            {' '}· Ana CD (Max 6 TIR)
                          </span>
                        )}
                        {st.facility.id === 'MARMARA TM' && (
                          <span className="text-slate-500 dark:text-slate-400 font-normal">
                            {' '}· Max 1 TIR
                          </span>
                        )}
                        {st.facility.id === 'GEBZE TM' && (
                          <span className="text-indigo-600 dark:text-indigo-400 font-normal">
                            {' '}· Özel Cross Dock
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-800 dark:text-slate-200">
                        {st.totalVehicles}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-blue-600 dark:text-blue-400">
                        {st.tirCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-600 dark:text-amber-400">
                        {st.kamyonCount}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-800 dark:text-slate-200">
                        {st.totalDesi.toLocaleString('tr-TR')}
                      </td>
                      <td className="py-2 px-3 text-right font-mono tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                        %{st.avgFill.toFixed(1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-slate-400" />
              <span>
                Direkt Hat: <strong className="font-mono text-slate-700 dark:text-slate-200">{result.lines.filter((l) => l.routeCategory !== 'ANKARA_CROSS_DOCK' && l.routeCategory !== 'GEBZE_CROSS_DOCK').length}</strong> Araç · Cross Dock Çıkışlı: <strong className="font-mono text-slate-700 dark:text-slate-200">{result.lines.filter((l) => l.routeCategory === 'ANKARA_CROSS_DOCK' || l.routeCategory === 'GEBZE_CROSS_DOCK').length}</strong> Araç
              </span>
            </div>
            <button
              onClick={() => onNavigate('manuel-giris')}
              className="inline-flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Desi Matrisini Düzenle →</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
