import React, { useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  Cpu,
  Layers,
  ShieldCheck,
  Truck,
} from 'lucide-react';
import { CrossDockHubId, PlanningExecutionResult } from '../types/logistics';
import { INITIAL_CROSS_DOCK_HUBS } from '../data/referenceDataset';

interface CrossDockManagementViewProps {
  result: PlanningExecutionResult;
  forcedHub?: CrossDockHubId;
}

export const CrossDockManagementView: React.FC<CrossDockManagementViewProps> = ({
  result,
  forcedHub,
}) => {
  const [selectedHub, setSelectedHub] = useState<CrossDockHubId>(
    forcedHub || 'ANKARA TM'
  );
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [showUniversalRules, setShowUniversalRules] = useState<boolean>(true);
  const [showEngineAudit, setShowEngineAudit] = useState<boolean>(true);

  // Sync if forcedHub prop changes via tab navigation
  React.useEffect(() => {
    if (forcedHub) {
      setSelectedHub(forcedHub);
    }
  }, [forcedHub]);

  const ankaraLines = result.lines.filter(
    (l) => l.routeCategory === 'ANKARA_CROSS_DOCK'
  );
  const gebzeLines = result.lines.filter(
    (l) => l.routeCategory === 'GEBZE_CROSS_DOCK'
  );
  const aksarayLines = result.lines.filter(
    (l) => l.routeCategory === 'AKSARAY_CROSS_DOCK'
  );
  const gaziantepLines = result.lines.filter(
    (l) =>
      l.routeCategory === 'GAZIANTEP_CROSS_DOCK' ||
      l.phase1RuleTag?.includes('GAZIANTEP')
  );
  const afyonLines = result.lines.filter(
    (l) =>
      l.routeCategory === 'AFYON_CROSS_DOCK' ||
      l.routeCategory === 'AFYON_UZERINDEN'
  );

  const hubLinesMap: Record<CrossDockHubId, typeof result.lines> = {
    'ANKARA TM': ankaraLines,
    'GEBZE TM': gebzeLines,
    'AKSARAY TM': aksarayLines,
    'GAZİANTEP TM': gaziantepLines,
    'AFYON TM': afyonLines,
  };

  const activeLines = hubLinesMap[selectedHub] || [];
  const activeMovements = result.crossDockMovements.filter(
    (m) =>
      m.hubFacilityId === selectedHub &&
      (reasonFilter === 'ALL' || m.reasonType === reasonFilter)
  );

  const activeFeederLines = (result.feederLines || []).filter((fl) =>
    selectedHub === 'GEBZE TM'
      ? fl.destinationFacilityId === 'GEBZE TM'
      : selectedHub === 'ANKARA TM'
      ? fl.destinationFacilityId === 'ANKARA TM'
      : true
  );

  const activeConfig = INITIAL_CROSS_DOCK_HUBS.find(
    (h) => h.hubFacilityId === selectedHub
  );

  const hubTabs: Array<{
    id: CrossDockHubId;
    shortLabel: string;
    linesCount: number;
    totalDesi: number;
  }> = [
    {
      id: 'ANKARA TM',
      shortLabel: 'Ankara CD',
      linesCount: ankaraLines.length,
      totalDesi: ankaraLines.reduce((s, l) => s + l.totalDesi, 0),
    },
    {
      id: 'GEBZE TM',
      shortLabel: 'Gebze CD',
      linesCount: gebzeLines.length,
      totalDesi: gebzeLines.reduce((s, l) => s + l.totalDesi, 0),
    },
    {
      id: 'AKSARAY TM',
      shortLabel: 'Aksaray Özel CD',
      linesCount: aksarayLines.length,
      totalDesi: aksarayLines.reduce((s, l) => s + l.totalDesi, 0),
    },
    {
      id: 'GAZİANTEP TM',
      shortLabel: 'Gaziantep CD / Ortak',
      linesCount: gaziantepLines.length,
      totalDesi: gaziantepLines.reduce((s, l) => s + l.totalDesi, 0),
    },
    {
      id: 'AFYON TM',
      shortLabel: 'Afyon Adana CD & Havuz',
      linesCount: afyonLines.length,
      totalDesi: afyonLines.reduce((s, l) => s + l.totalDesi, 0),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header & 5-Hub Switcher */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              1. Faz Operasyonel Hat ve Cross Dock Kuralları · 5 Merkezli Konsolidasyon Motoru
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              Cross Dock, Ara Hat ve Özel Operasyon Merkezleri Yönetimi
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Ankara, Gebze, Aksaray, Gaziantep ve Afyon Cross Dock merkezlerinin kabul/birleştirme kuralları, besleme araçları ve bacak bazlı teslimat süreleri gerçek hesaplama motorunda işletilmektedir.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              onClick={() => setShowEngineAudit((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                showEngineAudit
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Bölüm 16: 10 Noktalı Motor Denetimi</span>
            </button>

            <button
              onClick={() => setShowUniversalRules((v) => !v)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
                showUniversalRules
                  ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700'
                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Bölüm 15: 10 Ortak Kural</span>
            </button>
          </div>
        </div>

        {/* 5 Cross Dock Hub Selector Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {hubTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedHub(tab.id)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                selectedHub === tab.id
                  ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
              }`}
            >
              {tab.shortLabel} ({tab.linesCount} Araç · {tab.totalDesi.toLocaleString('tr-TR')} d)
            </button>
          ))}
        </div>
      </div>

      {/* Section 16: 6 Rule Modules & 10 Mandatory Engine Audit Checks */}
      {showEngineAudit && result.ruleAuditChecks && (
        <div className="p-5 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-900/60 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                  Bölüm 16: Hesaplama Motoru 6 Kural Modülü & 10 Zorunlu Operasyonel Kontrol
                </h2>
                <p className="text-[11px] text-slate-500">
                  FacilityRoutingRules · VehicleTypeRules · CrossDockRules · ConsolidationRules · SpecialOperationRules · DeliveryTimeRules
                </p>
              </div>
            </div>
            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              {result.ruleAuditChecks.filter((c) => c.passed).length} / {result.ruleAuditChecks.length} Kontrol Doğrulandı
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
            {result.ruleAuditChecks.map((chk) => (
              <div
                key={chk.id}
                className="p-2.5 bg-slate-50 dark:bg-slate-800/70 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1"
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    #{chk.checkNo} · {chk.moduleName}
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                </div>
                <div className="font-bold text-slate-900 dark:text-slate-100 text-[11px]">
                  {chk.question}
                </div>
                <div className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {chk.statusLabel}
                </div>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-snug">
                  {chk.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 15: 10 Common Cross Dock Principles */}
      {showUniversalRules && (
        <div className="p-5 bg-gradient-to-r from-slate-50 via-blue-50/30 to-indigo-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 border border-blue-200 dark:border-blue-900/60 rounded-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Bölüm 15: Cross Dock Ortak Prensipleri (Ankara, Gebze, Gaziantep, Aksaray ve Afyon)
              </h2>
            </div>
            <span className="text-[11px] font-semibold text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              10/10 Ortak Kural Aktif
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
            {[
              { no: 1, title: '2 Günlük Teslimat Odaklı', desc: 'Cross Dock’un temel amacı 2 günlük teslimat süresine sahip paketleri uygun merkezde birleştirmektir.' },
              { no: 2, title: 'Ayrı Kaynak & Varış İzinleri', desc: 'Merkezin kabul edebileceği kaynak tesisler ve gönderebileceği varış tesisleri ayrı ayrı tanımlanır.' },
              { no: 3, title: 'Aynı Gerçek Varış Birleştirme', desc: 'Aynı gerçek varış tesisine giden paketler birleştirilebilir.' },
              { no: 4, title: 'Özel Ortak Yükleme İzni', desc: 'Farklı varış tesisleri yalnızca açıkça tanımlanmış özel bir araç birleştirme kuralı varsa aynı araca yüklenebilir.' },
              { no: 5, title: 'Gerçek Varış Değiştirilemez', desc: 'Cross Dock işlemi paketin gerçek varış tesisini hiçbir koşulda değiştiremez.' },
              { no: 6, title: 'Doğrudan Hat Önceliği', desc: 'Doğrudan hat daha uygun ve operasyonel olarak mümkünse gereksiz Cross Dock yapılmaz.' },
              { no: 7, title: 'Ayrı Ayak Süre Hesabı', desc: 'Cross Dock giriş ayağı, ana sevkiyat ayağı ve aktarma bekleme süresi ayrı hesaplanır.' },
              { no: 8, title: 'Teslimat Süresi Korunumu', desc: 'Cross Dock nedeniyle teslimat süresi kuralları ihlal edilmemelidir.' },
              { no: 9, title: 'Taşan Paketlerin Planlanması', desc: 'Araç kapasitesi aşılırsa taşan paketler kaybolmaz; ayrı araçta planlanır.' },
              { no: 10, title: 'Sıfır Kayıp & Sıfır Mükerrer', desc: 'Paketler hiçbir aşamada kaybolmamalı veya iki farklı araçta mükerrer planlanmamalıdır.' },
            ].map((r) => (
              <div
                key={r.no}
                className="p-2.5 bg-white/85 dark:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-700 space-y-1"
              >
                <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5 text-[11px]">
                  <span className="w-4 h-4 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 flex items-center justify-center text-[10px] font-black shrink-0">
                    {r.no}
                  </span>
                  {r.title}
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[10px] leading-snug">
                  {r.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Hub Whitelist, Acceptance Profile & Phase 1 Special Rules Card */}
      {activeConfig && (
        <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {activeConfig.hubFacilityName} – Yetkili Tesis İzin Listesi & 1. Faz Kuralları
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span>Aktarma Süresi: <strong className="text-slate-700 dark:text-slate-300">{activeConfig.handlingHours} saat</strong></span>
              <span>Odak Teslimat: <strong className="text-blue-600 dark:text-blue-400">{activeConfig.primaryDeliveryDays.join(', ')} Gün</strong></span>
            </div>
          </div>

          <p className="text-xs text-slate-600 dark:text-slate-400">
            {activeConfig.description}
          </p>

          {activeConfig.specialRulesSummary && activeConfig.specialRulesSummary.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
              {activeConfig.specialRulesSummary.map((ruleText, idx) => (
                <div
                  key={idx}
                  className="p-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <span>{ruleText}</span>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Kabul Edilen Çıkış Tesisleri ({activeConfig.acceptedOriginIds.length}):
              </span>
              <div className="flex flex-wrap gap-1">
                {activeConfig.acceptedOriginIds.map((orig) => (
                  <span
                    key={orig}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800"
                  >
                    {orig}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Kabul Edilen Hedef Tesisler ({activeConfig.acceptedDestinationIds.length}):
              </span>
              <div className="flex flex-wrap gap-1">
                {activeConfig.acceptedDestinationIds.map((dest) => (
                  <span
                    key={dest}
                    className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                  >
                    {dest}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Consolidated Outbound Vehicles from Selected Cross Dock */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {selectedHub} Üzerinden Oluşturulan Birleştirilmiş / Özel Operasyon Araçları ({activeLines.length} Araç)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Farklı çıkış tesislerinden gelip gerçek varış noktası korunarak birleştirilen araçlar
            </p>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[360px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Hat Kodu</th>
                <th className="py-2.5 px-3">Araç Türü</th>
                <th className="py-2.5 px-3">Araç Hakkı / Kural</th>
                <th className="py-2.5 px-3">Gerçek Varış Tesisi</th>
                <th className="py-2.5 px-3">Birleştirilen Kaynak Tesisler ve Desileri</th>
                <th className="py-2.5 px-3 text-right">Toplam Desi</th>
                <th className="py-2.5 px-3 text-right">Kapasite</th>
                <th className="py-2.5 px-3 text-right">Doluluk</th>
                <th className="py-2.5 px-3">Tahmini Süre (Bacak Detaylı)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeLines.map((line) => (
                <tr key={line.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 px-3 font-mono font-bold text-slate-900 dark:text-slate-100">
                    {line.lineCode}
                  </td>
                  <td className="py-2.5 px-3 font-semibold">
                    <span
                      className={
                        line.vehicleType === 'TIR'
                          ? 'text-blue-600 dark:text-blue-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }
                    >
                      {line.vehicleType}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    {line.requiresRuleApproval ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300">
                        Kural Onayı Gerekli
                      </span>
                    ) : line.isAntalyaSpecialTir ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300">
                        Antalya Özel TIR
                      </span>
                    ) : line.isAnkaraCdFixedTir ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-300">
                        Ankara CD Sabit TIR
                      </span>
                    ) : line.isAnkaraCdAdditionalTir ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300">
                        Ankara CD İlave TIR
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200">
                        {line.transportTypeLabel || line.vehicleQuotaLabel}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-slate-100">
                    {line.destinationFacilityName}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {line.loadedSegments.map((seg, i) => (
                        <React.Fragment key={seg.segmentId}>
                          {i > 0 && <span className="text-slate-400">+</span>}
                          <span className="text-slate-800 dark:text-slate-200">
                            <strong>{seg.sourceFacilityName}</strong>{' '}
                            <span className="font-mono text-slate-500">
                              ({seg.desi.toLocaleString('tr-TR')} d)
                            </span>
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100">
                    {line.totalDesi.toLocaleString('tr-TR')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-500">
                    {line.capacityDesi.toLocaleString('tr-TR')}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums font-bold text-emerald-600 dark:text-emerald-400">
                    %{line.fillRate.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {line.delivery.totalEstimatedDays} Gün
                      </span>
                      {line.delivery.deliveryDaysCategory && (
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            line.delivery.deliveryDaysCategory === 2
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : line.delivery.deliveryDaysCategory === 3
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          }`}
                        >
                          {line.delivery.deliveryDaysCategory}G
                        </span>
                      )}
                    </div>
                    {line.delivery.inboundLeg ? (
                      <div className="text-[10px] text-slate-500 font-sans mt-0.5 space-y-0.5">
                        <div>
                          Giriş: {line.delivery.inboundLeg.distanceKm} km ({line.delivery.inboundLeg.estimatedDays}g)
                        </div>
                        <div className="text-indigo-600 dark:text-indigo-400 font-medium">
                          +{line.delivery.transferBufferHours || 4} sa Aktarma Bekleme
                        </div>
                        {line.delivery.mainLeg && (
                          <div>
                            Ana Hat: {line.delivery.mainLeg.distanceKm} km ({line.delivery.mainLeg.estimatedDays}g)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                        {line.delivery.summaryText}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Phase 1 Feeder / Collection Vehicles Section (Bursa 2 Kamyons, Konya->Ankara, Afyon->Ankara TIR, İzmir->Ankara, Kocaeli->Gebze/Ankara, Erzurum->Ankara) */}
      {(selectedHub === 'ANKARA TM' || selectedHub === 'GEBZE TM') && activeFeederLines.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  1. Faz Özel Besleme ve Toplama Araçları ({activeFeederLines.length} Araç)
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Bursa 1. Kamyon (Dış Paketler) & 2. Kamyon (İç Paketler), Konya→Ankara, Afyon→Ankara TIR, İzmir→Ankara Kamyon, Kocaeli→Gebze/Ankara ve Erzurum→Ankara besleme hatları
                </p>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="py-2.5 px-3">Besleme Kodu</th>
                  <th className="py-2.5 px-3">Çıkış Tesisi</th>
                  <th className="py-2.5 px-3">Sevk Noktası</th>
                  <th className="py-2.5 px-3">Araç Tipi</th>
                  <th className="py-2.5 px-3">Operasyonel Kural Tanımı</th>
                  <th className="py-2.5 px-3">Taşınan Gerçek Varış Tesisleri (Korundu)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {activeFeederLines.map((fl) => (
                  <tr key={fl.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="py-2.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                      {fl.lineCode}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                      {fl.originFacilityName}
                    </td>
                    <td className="py-2.5 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                      {fl.destinationFacilityId}
                    </td>
                    <td className="py-2.5 px-3 font-bold">
                      {fl.vehicleType} ({fl.capacityDesi.toLocaleString('tr-TR')} d)
                    </td>
                    <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300 font-medium">
                      {fl.transportTypeLabel}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
                      <div className="flex flex-wrap gap-1">
                        {fl.loadedSegments.map((s) => (
                          <span
                            key={s.segmentId}
                            className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-mono"
                          >
                            {s.trueDestinationName}: {s.desi.toLocaleString('tr-TR')} d
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detailed Shipment-by-Shipment Transfer Trace Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {selectedHub} Gönderi Bazlı Aktarma Nedenleri ve İzlenebilirlik Tablosu ({activeMovements.length} Hareket)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Kaynak tesis, aktarma merkezi ve nihai gerçek varış tesisi bazında izleme
            </p>
          </div>

          <select
            value={reasonFilter}
            onChange={(e) => setReasonFilter(e.target.value)}
            className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg"
          >
            <option value="ALL">Tüm Aktarma Nedenleri</option>
            <option value="12500_16000_ARTIGI">12.500–16.000 Desi Kuralı Artığı</option>
            <option value="DUSUK_HACIM_BIRLESTIRME">Düşük Hacim Birleştirme</option>
            <option value="TIR_KAPASITE_ARTIGI">22.500 TIR Kapasite Artığı</option>
            <option value="MARMARA_KOCAELI_AVRUPA_KONSOLIDASYON">
              Avrupa/Marmara/Kocaeli Gebze Konsolidasyonu
            </option>
            <option value="AKSARAY_OZEL_KONSOLIDASYON">
              Bölüm 6: Aksaray Özel Konsolidasyon (Adana-Kayseri-Konya)
            </option>
            <option value="GAZIANTEP_DIYARBAKIR_ORTAK">
              Bölüm 4 & 5: Gaziantep Cross Dock & Diyarbakır Ortak Araç
            </option>
            <option value="AFYON_ADANA_OZEL_CD">
              Bölüm 11.3: Afyon Adana Özel Cross Dock
            </option>
            <option value="KISIT_ARTIGI">Tesis Araç Kısıtı Artığı</option>
          </select>
        </div>

        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="py-2.5 px-3">Kaynak Çıkış Tesisi</th>
                <th className="py-2.5 px-3">Aktarma Merkezi</th>
                <th className="py-2.5 px-3">Gerçek Varış Noktası (Korundu)</th>
                <th className="py-2.5 px-3 text-right">Aktarılan Desi</th>
                <th className="py-2.5 px-3 text-right">Paket</th>
                <th className="py-2.5 px-3">Aktarma Kuralı / Nedeni</th>
                <th className="py-2.5 px-3">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {activeMovements.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="py-2 px-3 font-semibold text-slate-900 dark:text-slate-100">
                    {m.sourceFacilityName}
                  </td>
                  <td className="py-2 px-3 font-semibold text-indigo-600 dark:text-indigo-400">
                    {m.hubFacilityId}
                  </td>
                  <td className="py-2 px-3 font-bold text-slate-900 dark:text-slate-100">
                    {m.trueDestinationName}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900 dark:text-slate-100">
                    {m.desi.toLocaleString('tr-TR')}
                  </td>
                  <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-500">
                    {m.packages.toLocaleString('tr-TR')}
                  </td>
                  <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                    {m.reasonDetail}
                  </td>
                  <td className="py-2 px-3 font-semibold">
                    {m.status === 'PLANLANDI' ? (
                      <span className="text-emerald-600 dark:text-emerald-400">
                        Araca Yüklendi ({m.outboundVehicleLineId?.replace('LINE-', '')})
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400">
                        Bekleyen Liste (Kota Sınırı)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
