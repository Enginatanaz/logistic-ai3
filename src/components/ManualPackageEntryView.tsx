import React, { useRef, useState } from 'react';
import {
  Calculator,
  Download,
  RotateCcw,
  Sliders,
  Undo2,
  Upload,
} from 'lucide-react';
import {
  calculateMatrixTotals,
  getStandardMatrixFacilities,
} from '../engines/shipmentCalculationEngine';
import {
  ExcelImportAnalysis,
  analyzeUploadedExcelFile,
} from '../services/excelImportExportService';
import { Facility, MatrixData } from '../types/logistics';

interface ManualPackageEntryViewProps {
  facilities: Facility[];
  packageMatrix: MatrixData;
  desiMatrix: MatrixData;
  canUndo: boolean;
  onUpdateCell: (
    mode: 'DESI' | 'PACKAGE',
    originId: string,
    destId: string,
    newValue: number
  ) => void;
  onApplyEstimatedPackagesModel: (targetTotalPackages: number, desiScaleFactor: number) => void;
  onBulkUpdateOriginOrDest: (
    targetType: 'ORIGIN' | 'DESTINATION',
    facilityId: string,
    multiplierPct: number
  ) => void;
  onUndo: () => void;
  onResetToReferenceExcel: () => void;
  onApplyImportedExcel: (
    analysis: ExcelImportAnalysis,
    importMode: 'UPDATE' | 'MERGE' | 'NEW_SCENARIO'
  ) => void;
  onExportExcel: () => void;
}

export const ManualPackageEntryView: React.FC<ManualPackageEntryViewProps> = ({
  facilities,
  packageMatrix,
  desiMatrix,
  canUndo,
  onUpdateCell,
  onApplyEstimatedPackagesModel,
  onBulkUpdateOriginOrDest,
  onUndo,
  onResetToReferenceExcel,
  onApplyImportedExcel,
  onExportExcel,
}) => {
  const [activeMatrixTab, setActiveMatrixTab] = useState<'DESI' | 'PACKAGE'>('DESI');
  const [targetPackagesInput, setTargetPackagesInput] = useState<string>('650000');
  const [desiScaleInput, setDesiScaleInput] = useState<string>('1.00');
  const [bulkTargetType, setBulkTargetType] = useState<'ORIGIN' | 'DESTINATION'>('ORIGIN');
  const [bulkFacilityId, setBulkFacilityId] = useState<string>('AVRUPA TM');
  const [bulkPercent, setBulkPercent] = useState<string>('110');
  const [showBulkPanel, setShowBulkPanel] = useState<boolean>(false);

  const [importAnalysis, setImportAnalysis] = useState<ExcelImportAnalysis | null>(null);
  const [importMode, setImportMode] = useState<'UPDATE' | 'MERGE' | 'NEW_SCENARIO'>('UPDATE');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeFacilities = getStandardMatrixFacilities(facilities);
  const totals = calculateMatrixTotals(facilities, packageMatrix, desiMatrix);

  const currentMatrix = activeMatrixTab === 'DESI' ? desiMatrix : packageMatrix;
  const rowTotals = activeMatrixTab === 'DESI' ? totals.rowDesiTotals : totals.rowPackageTotals;
  const colTotals = activeMatrixTab === 'DESI' ? totals.colDesiTotals : totals.colPackageTotals;
  const grandTotal =
    activeMatrixTab === 'DESI' ? totals.grandTotalDesi : totals.grandTotalPackages;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const analysis = await analyzeUploadedExcelFile(file, facilities);
    setImportAnalysis(analysis);
    e.target.value = '';
  };

  return (
    <div className="space-y-5">
      {/* Header & Three-Volume Model Controls */}
      <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              Manuel Paket Girişi · Üç Hacim Ortak Katsayı Modeli (19×19 Matris)
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100 mt-0.5">
              Tesisler Arası Paket ve Desi Dağılım Matrisi
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              Hücre değerlerini doğrudan düzenleyebilir, toplam tahmini paket sayısından katsayı modeliyle dağılım üretebilir veya Excel/CSV içe aktarabilirsiniz.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* Matrix Switcher */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
              <button
                onClick={() => setActiveMatrixTab('DESI')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeMatrixTab === 'DESI'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Desi Dağılım Matrisi
              </button>
              <button
                onClick={() => setActiveMatrixTab('PACKAGE')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeMatrixTab === 'PACKAGE'
                    ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                Paket Dağılım Matrisi
              </button>
            </div>

            <button
              onClick={() => setShowBulkPanel((v) => !v)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Toplu Veri Girişi</span>
            </button>

            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                canUndo
                  ? 'text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer'
                  : 'text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-slate-800/40 cursor-not-allowed'
              }`}
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Geri Al</span>
            </button>

            <button
              onClick={onResetToReferenceExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Referans Excel’e Sıfırla</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Excel / CSV İçe Aktar</span>
            </button>

            <button
              onClick={onExportExcel}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Dışa Aktar</span>
            </button>
          </div>
        </div>

        {/* Summary Metrics & Coefficient Model Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-xs text-slate-500 dark:text-slate-400">Tahmini Toplam Paket</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              {totals.grandTotalPackages.toLocaleString('tr-TR')}
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-xs text-slate-500 dark:text-slate-400">Tahmini Toplam Desi</div>
            <div className="text-lg font-bold font-mono tabular-nums text-blue-600 dark:text-blue-400 mt-0.5">
              {totals.grandTotalDesi.toLocaleString('tr-TR')}
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div className="text-xs text-slate-500 dark:text-slate-400">Genel / Efektif Desi Oranı</div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-slate-100 mt-0.5">
              4 (Efektif: {totals.effectiveDesiPerPackage})
            </div>
          </div>
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex items-center justify-between gap-2">
            <div className="space-y-1 flex-1">
              <label className="block text-[11px] font-medium text-slate-600 dark:text-slate-300">
                Hedef Paket Hacmi ile Dağıt:
              </label>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1000}
                  step={10000}
                  value={targetPackagesInput}
                  onChange={(e) => setTargetPackagesInput(e.target.value)}
                  className="w-28 px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded text-slate-900 dark:text-slate-100"
                />
                <button
                  onClick={() => {
                    const pkg = Number(targetPackagesInput);
                    const scale = Number(desiScaleInput) || 1;
                    if (pkg > 0) {
                      onApplyEstimatedPackagesModel(pkg, scale);
                    }
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Calculator className="w-3 h-3" />
                  <span>Hesapla</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Bulk Data Entry Bar */}
        {showBulkPanel && (
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                İşlem Yönü
              </label>
              <select
                value={bulkTargetType}
                onChange={(e) => setBulkTargetType(e.target.value as 'ORIGIN' | 'DESTINATION')}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
              >
                <option value="ORIGIN">Çıkış Tesisi (Tüm Satır)</option>
                <option value="DESTINATION">Varış Tesisi (Tüm Sütun)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Tesis Seçimi
              </label>
              <select
                value={bulkFacilityId}
                onChange={(e) => setBulkFacilityId(e.target.value)}
                className="px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
              >
                {activeFacilities.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Hacim Oranı (% olarak, örn: 120 = +%20 artış, 0 = Sıfırla)
              </label>
              <input
                type="number"
                min={0}
                max={500}
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
                className="w-28 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-md"
              />
            </div>
            <button
              onClick={() => {
                const pct = Number(bulkPercent);
                if (!Number.isNaN(pct) && pct >= 0) {
                  onBulkUpdateOriginOrDest(bulkTargetType, bulkFacilityId, pct);
                }
              }}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer"
            >
              Toplu Güncellemeyi Uygula
            </button>
          </div>
        )}
      </div>

      {/* Excel Import Confirmation Modal */}
      {importAnalysis && (
        <div className="p-5 bg-white dark:bg-slate-900 border-2 border-blue-600 dark:border-blue-500 rounded-xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Excel / CSV Veri İçe Aktarma Analizi: {importAnalysis.fileName}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Algılanan Sayfalar: {importAnalysis.sheetNames.join(', ')} · Eşleşen Tesis Sayısı:{' '}
                <strong className="font-mono">{importAnalysis.matchedFacilitiesCount}</strong>
              </p>
            </div>
            <button
              onClick={() => setImportAnalysis(null)}
              className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
            >
              İptal Et
            </button>
          </div>

          {importAnalysis.warnings.length > 0 && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-800 dark:text-amber-300 space-y-1">
              {importAnalysis.warnings.map((w, i) => (
                <div key={i}>• {w}</div>
              ))}
            </div>
          )}

          {importAnalysis.isValid && (
            <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  Aktarım Yöntemi:
                </span>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'UPDATE'}
                    onChange={() => setImportMode('UPDATE')}
                  />
                  <span>Mevcut Verileri Güncelle</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'MERGE'}
                    onChange={() => setImportMode('MERGE')}
                  />
                  <span>Mevcut Verilerle Birleştir (Üzerine Ekle)</span>
                </label>
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    checked={importMode === 'NEW_SCENARIO'}
                    onChange={() => setImportMode('NEW_SCENARIO')}
                  />
                  <span>Mevcut Planı Geçmişe Kaydet ve Yeni Senaryo Oluştur</span>
                </label>
              </div>

              <button
                onClick={() => {
                  onApplyImportedExcel(importAnalysis, importMode);
                  setImportAnalysis(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer"
              >
                Onayla ve Veri Motoruna Aktar
              </button>
            </div>
          )}
        </div>
      )}

      {/* 19x19 Interactive Spreadsheet Grid */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
            {activeMatrixTab === 'DESI'
              ? 'DESİ DAĞILIM MATRİSİ (Satırlar: Çıkış Tesisi · Sütunlar: Varış Tesisi)'
              : 'PAKET DAĞILIM MATRİSİ (Satırlar: Çıkış Tesisi · Sütunlar: Varış Tesisi)'}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Toplam: {grandTotal.toLocaleString('tr-TR')}{' '}
            {activeMatrixTab === 'DESI' ? 'desi' : 'paket'}
          </div>
        </div>

        <div className="overflow-x-auto max-h-[640px] overflow-y-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700">
              <tr>
                <th className="sticky left-0 z-30 bg-amber-100 dark:bg-amber-950/90 text-amber-950 dark:text-amber-200 py-2.5 px-3 text-left font-bold border-r border-slate-300 dark:border-slate-700 min-w-[140px]">
                  Çıkış \ Varış
                </th>
                {activeFacilities.map((dest) => (
                  <th
                    key={dest.id}
                    className="py-2 px-2 text-right font-semibold whitespace-nowrap border-r border-slate-200 dark:border-slate-700/70 min-w-[92px]"
                  >
                    {dest.name.replace(' TM', '')}
                  </th>
                ))}
                <th className="py-2 px-3 text-right font-bold bg-slate-200/80 dark:bg-slate-700/80 whitespace-nowrap min-w-[110px]">
                  Çıkış Toplamı
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {activeFacilities.map((origin) => (
                <tr
                  key={origin.id}
                  className="hover:bg-blue-50/30 dark:hover:bg-slate-800/40 transition-colors"
                >
                  <td className="sticky left-0 z-10 bg-amber-50 dark:bg-slate-900 font-bold text-slate-900 dark:text-amber-300 py-1.5 px-3 border-r border-slate-300 dark:border-slate-700 whitespace-nowrap">
                    {origin.name}
                  </td>
                  {activeFacilities.map((dest) => {
                    const val = currentMatrix[origin.id]?.[dest.id] ?? 0;
                    const isSelf = origin.id === dest.id;
                    const isHighVolume =
                      activeMatrixTab === 'DESI' && val > 16000 && !isSelf;
                    const isMidSplitVolume =
                      activeMatrixTab === 'DESI' &&
                      val > 12500 &&
                      val <= 16000 &&
                      !isSelf;

                    return (
                      <td
                        key={dest.id}
                        className={`p-0.5 border-r border-slate-100 dark:border-slate-800 ${
                          isSelf
                            ? 'bg-slate-100/70 dark:bg-slate-800/50'
                            : isHighVolume
                            ? 'bg-blue-50/40 dark:bg-blue-950/20'
                            : isMidSplitVolume
                            ? 'bg-amber-50/40 dark:bg-amber-950/20'
                            : ''
                        }`}
                      >
                        <input
                          type="number"
                          min={0}
                          value={val}
                          onChange={(e) => {
                            const parsed = Math.max(0, Math.round(Number(e.target.value) || 0));
                            onUpdateCell(activeMatrixTab, origin.id, dest.id, parsed);
                          }}
                          className="w-full text-right font-mono tabular-nums px-1.5 py-1 bg-transparent focus:bg-white dark:focus:bg-slate-800 focus:outline-1 focus:outline-blue-600 rounded text-slate-800 dark:text-slate-200"
                        />
                      </td>
                    );
                  })}
                  <td className="py-1.5 px-3 text-right font-mono tabular-nums font-bold bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100">
                    {(rowTotals[origin.id] ?? 0).toLocaleString('tr-TR')}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-20 bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-300 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100">
              <tr>
                <td className="sticky left-0 z-30 bg-slate-200 dark:bg-slate-800 py-2.5 px-3 border-r border-slate-300 dark:border-slate-700">
                  Varış Toplamı
                </td>
                {activeFacilities.map((dest) => (
                  <td
                    key={dest.id}
                    className="py-2.5 px-2 text-right font-mono tabular-nums border-r border-slate-200 dark:border-slate-700"
                  >
                    {(colTotals[dest.id] ?? 0).toLocaleString('tr-TR')}
                  </td>
                ))}
                <td className="py-2.5 px-3 text-right font-mono tabular-nums bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                  {grandTotal.toLocaleString('tr-TR')}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};
