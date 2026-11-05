import * as XLSX from 'xlsx';
import {
  DistanceMatrix,
  Facility,
  MatrixData,
  PlanningExecutionResult,
} from '../types/logistics';
import { getStandardMatrixFacilities } from '../engines/shipmentCalculationEngine';

export interface ExcelImportAnalysis {
  fileName: string;
  sheetNames: string[];
  detectedEstimatedPackages: number | null;
  detectedTotalDesi: number | null;
  detectedPackageMatrix: MatrixData | null;
  detectedDesiMatrix: MatrixData | null;
  matchedFacilitiesCount: number;
  warnings: string[];
  isValid: boolean;
}

/**
 * Parses a Turkish-formatted or standard numeric cell (e.g. "25.979" -> 25979 or 25979 -> 25979).
 */
function parseTurkishNumber(val: unknown): number | null {
  if (typeof val === 'number' && !Number.isNaN(val)) {
    // Note: In CSV imports where "1.820" is parsed by some locales as 1.82 instead of 1820:
    // If it has 3 decimal places and is small, check string representation
    return Math.round(val);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    // Remove thousand separator dots and replace comma with dot
    const normalized = trimmed.replace(/\./g, '').replace(',', '.');
    const num = Number(normalized);
    if (!Number.isNaN(num)) {
      return Math.round(num);
    }
  }
  return null;
}

/**
 * Analyzes an uploaded Excel (.xlsx/.xls) or CSV file and extracts Package and Desi matrices.
 */
export async function analyzeUploadedExcelFile(
  file: File,
  facilities: Facility[]
): Promise<ExcelImportAnalysis> {
  const buffer = await file.arrayBuffer();
  // Use raw: true so strings like "1.820" in CSV are not turned into float 1.82
  const workbook = XLSX.read(buffer, { type: 'array', raw: true });
  const activeFacilities = getStandardMatrixFacilities(facilities);
  const facilityNamesSet = new Set(activeFacilities.map((f) => f.id));

  let detectedEstimatedPackages: number | null = null;
  let detectedTotalDesi: number | null = null;
  let detectedPackageMatrix: MatrixData | null = null;
  let detectedDesiMatrix: MatrixData | null = null;
  const warnings: string[] = [];
  const matchedFacilities = new Set<string>();

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

    // Scan rows for metadata and matrix headers
    let currentSection: 'PACKAGE' | 'DESI' | 'UNKNOWN' = 'UNKNOWN';
    let columnHeaders: string[] = [];

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (!Array.isArray(row) || row.length === 0) continue;

      const firstCell = String(row[0] ?? '').trim().toUpperCase();

      if (firstCell.includes('TAHMİNİ PAKET') || firstCell.includes('TAHMINI PAKET')) {
        const pkgNum = parseTurkishNumber(row[1]);
        if (pkgNum && pkgNum > 0) detectedEstimatedPackages = pkgNum;
        for (let c = 2; c < row.length; c++) {
          const cellText = String(row[c] ?? '').toUpperCase();
          if (cellText.includes('DESİ') || cellText.includes('DESI')) {
            const desiNum = parseTurkishNumber(row[c + 1]);
            if (desiNum && desiNum > 0) detectedTotalDesi = desiNum;
          }
        }
        continue;
      }

      if (firstCell.includes('PAKET DAĞILIM MATRİSİ') || firstCell.includes('PAKET DAGILIM')) {
        currentSection = 'PACKAGE';
        continue;
      }

      if (firstCell.includes('DESİ DAĞILIM MATRİSİ') || firstCell.includes('DESI DAGILIM')) {
        currentSection = 'DESI';
        continue;
      }

      // Check if this row is a header row containing facility names
      const rowStrings = row.map((c) => String(c ?? '').trim().toUpperCase());
      const matchingHeaderCols = rowStrings.filter((s) => facilityNamesSet.has(s));
      if (matchingHeaderCols.length >= 5) {
        columnHeaders = rowStrings;
        if (currentSection === 'UNKNOWN') {
          currentSection = detectedPackageMatrix ? 'DESI' : 'PACKAGE';
        }
        continue;
      }

      // Check if firstCell is a facility name in an active matrix block
      if (facilityNamesSet.has(firstCell) && columnHeaders.length > 0) {
        matchedFacilities.add(firstCell);
        const targetMatrix =
          currentSection === 'PACKAGE'
            ? (detectedPackageMatrix ??= {})
            : (detectedDesiMatrix ??= {});

        if (!targetMatrix[firstCell]) {
          targetMatrix[firstCell] = {};
        }

        for (let c = 1; c < columnHeaders.length; c++) {
          const colFacility = columnHeaders[c];
          if (facilityNamesSet.has(colFacility)) {
            const val = parseTurkishNumber(row[c]);
            targetMatrix[firstCell][colFacility] = val !== null && val >= 0 ? val : 0;
          }
        }
      }
    }
  }

  // If only one matrix was found, derive the other using the 4 desi/package ratio
  if (detectedDesiMatrix && !detectedPackageMatrix) {
    warnings.push(
      'Dosyada yalnızca Desi matrisi tespit edildi; Paket matrisi ortalama katsayı ile otomatik oluşturuldu.'
    );
    detectedPackageMatrix = {};
    for (const o of activeFacilities) {
      detectedPackageMatrix[o.id] = {};
      for (const d of activeFacilities) {
        const desiVal = detectedDesiMatrix[o.id]?.[d.id] ?? 0;
        detectedPackageMatrix[o.id][d.id] = Math.round(desiVal / 4);
      }
    }
  } else if (detectedPackageMatrix && !detectedDesiMatrix) {
    warnings.push(
      'Dosyada yalnızca Paket matrisi tespit edildi; Desi matrisi ortalama katsayı (4) ile otomatik oluşturuldu.'
    );
    detectedDesiMatrix = {};
    for (const o of activeFacilities) {
      detectedDesiMatrix[o.id] = {};
      for (const d of activeFacilities) {
        const pkgVal = detectedPackageMatrix[o.id]?.[d.id] ?? 0;
        detectedDesiMatrix[o.id][d.id] = Math.round(pkgVal * 4);
      }
    }
  }

  if (matchedFacilities.size < activeFacilities.length && matchedFacilities.size > 0) {
    warnings.push(
      `Aktif ${activeFacilities.length} tesisten ${matchedFacilities.size} tanesi dosyada eşleşti. Eksik tesisler için mevcut değerler korunacaktır.`
    );
  }

  const isValid = Boolean(
    (detectedDesiMatrix || detectedPackageMatrix) && matchedFacilities.size > 0
  );

  if (!isValid) {
    warnings.push(
      'Yüklenen dosyada geçerli bir 19x19 tesis paket/desi dağılım matrisi bulunamadı.'
    );
  }

  return {
    fileName: file.name,
    sheetNames: workbook.SheetNames,
    detectedEstimatedPackages,
    detectedTotalDesi,
    detectedPackageMatrix,
    detectedDesiMatrix,
    matchedFacilitiesCount: matchedFacilities.size,
    warnings,
    isValid,
  };
}

/**
 * Section 14: Exports the complete 8-sheet operational Excel workbook (.xlsx).
 */
export function exportPlanningResultToExcel(params: {
  result: PlanningExecutionResult;
  facilities: Facility[];
  packageMatrix: MatrixData;
  desiMatrix: MatrixData;
  distanceMatrix: DistanceMatrix;
}): void {
  const { result, facilities, packageMatrix, desiMatrix, distanceMatrix } = params;
  const wb = XLSX.utils.book_new();
  const activeFacilities = getStandardMatrixFacilities(facilities);

  // Sheet 1: Hat Planlama (Ana Tablo)
  const hatPlanlamaRows = result.lines.map((line, idx) => ({
    'Sıra': idx + 1,
    'Çıkış Tesisi': line.originFacilityName,
    'Araç / Hat Kodu': line.lineCode,
    'Araç Türü': line.vehicleType,
    'Yükleme Yapılan Tesisler': line.loadedSegments
      .map((s) => `${s.sourceFacilityName} (${s.desi.toLocaleString('tr-TR')} desi)`)
      .join(' + '),
    'Varış Tesisi': line.destinationFacilityName,
    'Hat Tipi':
      line.routeCategory === 'ANKARA_CROSS_DOCK'
        ? 'Ankara Cross Dock'
        : line.routeCategory === 'GEBZE_CROSS_DOCK'
        ? 'Gebze Cross Dock'
        : line.routeCategory === 'LOKAL_DAGITIM'
        ? 'Tesis İçi / Lokal'
        : 'Direkt Hat',
    'Toplam Paket': line.totalPackages,
    'Toplam Desi': line.totalDesi,
    'Araç Kapasitesi (Desi)': line.capacityDesi,
    'Doluluk Oranı (%)': line.fillRate,
    'Mesafe (km)': line.delivery.distanceKm ?? 'Eksik',
    'Tahmini Süre (Gün)': line.delivery.totalEstimatedDays ?? 'Mesafe Eksik',
    'Plan Durumu': line.planStatus,
    'Mevcut Plan Karşılaştırma': line.comparison.explanation,
  }));
  const wsHat = XLSX.utils.json_to_sheet(hatPlanlamaRows);
  XLSX.utils.book_append_sheet(wb, wsHat, 'Hat Planlama');

  // Sheet 2: Araç Listesi
  const aracListesiRows = result.lines.map((l) => ({
    'Hat Kodu': l.lineCode,
    'Araç Türü': l.vehicleType,
    'Çıkış': l.originFacilityName,
    'Varış': l.destinationFacilityName,
    'Kapasite (Desi)': l.capacityDesi,
    'Yüklü Desi': l.totalDesi,
    'Boş Kapasite (Desi)': Math.max(0, l.capacityDesi - l.totalDesi),
    'Doluluk (%)': l.fillRate,
    'Çıkış Saati': l.delivery.departureTime,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(aracListesiRows), 'Araç Listesi');

  // Sheet 3: Tesis Bazlı Yükleme
  const tesisBazliRows = activeFacilities.map((f) => {
    const outboundLines = result.lines.filter((l) => l.originFacilityId === f.id);
    const inboundLines = result.lines.filter((l) => l.destinationFacilityId === f.id);
    return {
      'Tesis Adı': f.name,
      'Çıkan Toplam Araç': outboundLines.length,
      'Çıkan TIR': outboundLines.filter((l) => l.vehicleType === 'TIR').length,
      'Çıkan Kamyon': outboundLines.filter((l) => l.vehicleType === 'KAMYON').length,
      'Çıkan Planlı Desi': outboundLines.reduce((s, l) => s + l.totalDesi, 0),
      'Varışlı Toplam Araç': inboundLines.length,
      'Varışlı TIR': inboundLines.filter((l) => l.vehicleType === 'TIR').length,
      'Varışlı Kamyon': inboundLines.filter((l) => l.vehicleType === 'KAMYON').length,
      'Varışlı Planlı Desi': inboundLines.reduce((s, l) => s + l.totalDesi, 0),
    };
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tesisBazliRows), 'Tesis Bazlı Yükleme');

  // Sheet 4: Desi Hesapları (19x19 Matris)
  const desiHeader = ['Çıkış \\ Varış', ...activeFacilities.map((f) => f.name), 'Çıkış Toplamı'];
  const desiMatrixAoA: (string | number)[][] = [
    ['MANUEL PAKET VE DESİ MATRİSİ RAPORU'],
    [],
    ['DESİ DAĞILIM MATRİSİ'],
    desiHeader,
  ];
  for (const o of activeFacilities) {
    let rowSum = 0;
    const rowCells: (string | number)[] = [o.name];
    for (const d of activeFacilities) {
      const v = desiMatrix[o.id]?.[d.id] ?? 0;
      rowSum += v;
      rowCells.push(v);
    }
    rowCells.push(rowSum);
    desiMatrixAoA.push(rowCells);
  }
  desiMatrixAoA.push([]);
  desiMatrixAoA.push(['PAKET DAĞILIM MATRİSİ']);
  desiMatrixAoA.push(desiHeader);
  for (const o of activeFacilities) {
    let rowSum = 0;
    const rowCells: (string | number)[] = [o.name];
    for (const d of activeFacilities) {
      const v = packageMatrix[o.id]?.[d.id] ?? 0;
      rowSum += v;
      rowCells.push(v);
    }
    rowCells.push(rowSum);
    desiMatrixAoA.push(rowCells);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(desiMatrixAoA), 'Desi Hesapları');

  // Sheet 5: Araç Doluluk Oranları
  const dolulukRows = result.lines
    .slice()
    .sort((a, b) => b.fillRate - a.fillRate)
    .map((l) => ({
      'Hat Kodu': l.lineCode,
      'Çıkış Tesisi': l.originFacilityName,
      'Varış Tesisi': l.destinationFacilityName,
      'Araç Türü': l.vehicleType,
      'Yüklü Desi': l.totalDesi,
      'Kapasite': l.capacityDesi,
      'Doluluk Oranı (%)': l.fillRate,
      'Verimlilik Sınıfı':
        l.fillRate >= 85 ? 'Yüksek Verimli' : l.fillRate >= 65 ? 'Normal' : 'Düşük Doluluk (Zorunlu Direkt)',
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dolulukRows), 'Araç Doluluk Oranları');

  // Sheet 6: Cross Dock Planı
  const cdRows = result.crossDockMovements.map((m) => ({
    'Aktarma Merkezi': m.hubFacilityId,
    'Kaynak Tesis': m.sourceFacilityName,
    'Gerçek Varış Tesisi': m.trueDestinationName,
    'Desi': m.desi,
    'Paket': m.packages,
    'Aktarma Nedeni': m.reasonType,
    'Detay Açıklama': m.reasonDetail,
    'Çıkış Araç Kodu': m.outboundVehicleLineId ?? 'Bekleyen Liste',
    'Durum': m.status,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(cdRows.length > 0 ? cdRows : [{ Bilgi: 'Cross Dock hareketi bulunmuyor' }]),
    'Cross Dock Planı'
  );

  // Sheet 7: Planlanamayan Gönderiler
  const unpRows = result.unplannedShipments.map((u) => ({
    'Kaynak Tesis': u.originFacilityName,
    'Gerçek Varış Tesisi': u.trueDestinationName,
    'Bulunduğu Merkez': u.currentLocationId,
    'Bekleyen Desi': u.desi,
    'Bekleyen Paket': u.packages,
    'Kısıt Kodu': u.reasonCode,
    'Açıklama': u.explanation,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      unpRows.length > 0 ? unpRows : [{ Durum: 'Planlanamayan gönderi yok; tüm gönderiler araçlara yüklendi.' }]
    ),
    'Planlanamayan Gönderiler'
  );

  // Sheet 8: Mesafe ve Teslimat Tahminleri
  const distHeader = ['Çıkış \\ Varış (km)', ...activeFacilities.map((f) => f.name)];
  const distAoA: (string | number)[][] = [distHeader];
  for (const o of activeFacilities) {
    const row: (string | number)[] = [o.name];
    for (const d of activeFacilities) {
      const km = distanceMatrix[o.id]?.[d.id];
      row.push(km !== null && km !== undefined ? km : 'EKSİK');
    }
    distAoA.push(row);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(distAoA), 'Mesafe ve Teslimat');

  const safeDate = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Logistics_AI_Hat_Planlama_${safeDate}.xlsx`);
}

/**
 * Faz 3 Bölüm 13: 21 Sütunlu Konsolide Araç Planı ve 8 Sayfalı Excel Dışa Aktarma Motoru
 */
export function exportConsolidatedExecutionToExcel(params: {
  consolidatedResult: import('../engines/fixedVehicleConsolidatedEngine').ConsolidatedExecutionResult;
  facilities: Facility[];
  packageMatrix: MatrixData;
  desiMatrix: MatrixData;
  distanceMatrix: DistanceMatrix;
}): void {
  const { consolidatedResult, facilities, packageMatrix, desiMatrix, distanceMatrix } = params;
  const { consolidatedRows, summary, facilityReports, crossDockMovements, excelConfigs } =
    consolidatedResult;
  const activeFacilities = getStandardMatrixFacilities(facilities);

  const wb = XLSX.utils.book_new();

  // Sayfa 1: 21 Sütunlu Konsolide Hat Planı (Bölüm 6)
  const konsolideRowsForExcel = consolidatedRows.map((r, i) => ({
    '#': i + 1,
    '1. Tarih': r.date,
    '2. Çıkış Saati': r.departureTime,
    '3. Çıkış Tesisi': r.originFacilityName,
    '4. Güzergâh': r.routeLabel,
    '5. Gerçek Varış Tesisi': r.destinationFacilityName,
    '6. Ara Güzergâh': r.intermediateRouteText,
    '7. Araç Sıra No': r.vehicleSeqText,
    '8. Araç Tipi': r.vehicleType === 'PANELVAN' ? 'KAMYONET' : r.vehicleType,
    '9. Araç Kategorisi': r.vehicleCategoryLabel,
    '10. Tanımlı Araç Adedi': r.definedVehicleCount,
    '11. Tanımlı Yükleme Tesisleri': r.definedLoadingFacilityNames.join(', '),
    '12. Gerçek Yükleme Tesisleri': r.actualLoadedFacilityNames.join(', ') || '-',
    '13. Tesis Bazlı Yükleme Desileri': r.facilityDesiBreakdownText,
    '14. Toplam Desi': r.totalDesi,
    '15. Araç Kapasitesi': r.capacityDesi,
    '16. Kalan Kapasite': r.remainingCapacityDesi,
    '17. Doluluk Oranı (%)': r.fillRate,
    '18. Cross Dock Bilgisi': r.crossDockInfo,
    '19. Paletleme Bilgisi': r.palletInfo,
    '20. Planlama Durumu': r.planStatusLabel,
    '21. Açıklama': r.explanation,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(konsolideRowsForExcel),
    'Konsolide Hat Planı'
  );

  // Sayfa 2: Excel Sabit Araçlar ve Yükleme Listeleri (Bölüm 2 & 5)
  const sabitAracRows = excelConfigs.map((c) => ({
    'Sıra No': c.rowNo,
    'Çıkış / Güzergâh': c.routeLabel,
    'Kamyonet Adedi': c.kamyonetCount,
    'Kamyon Adedi': c.kamyonCount,
    'TIR Adedi': c.tirCount,
    'Toplam Araç': c.kamyonetCount + c.kamyonCount + c.tirCount,
    'Tanımlı Yükleme Tesisleri': c.parsedLoadingFacilityIds.join(', '),
    'Ayraç Hatası Uyarısı': c.hasSeparatorAnomaly ? c.anomalyDetails : 'Sorunsuz',
    'Orijinal Excel Metni': c.rawLoadingText,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sabitAracRows), 'Sabit Araç Konfigürasyonu');

  // Sayfa 3: Ek Araç Raporu (Bölüm 8)
  const ekAracRows = consolidatedRows
    .filter((r) => r.isAdditionalVehicle)
    .map((ek) => ({
      'Araç ID': ek.vehicleId,
      'Çıkış Tesisi': ek.originFacilityName,
      'Hedef Varış': ek.destinationFacilityName,
      'Önerilen Araç Tipi': ek.vehicleType,
      'Taşan Desi': ek.totalDesi,
      'Araç Kapasitesi': ek.capacityDesi,
      'Doluluk (%)': ek.fillRate,
      'Onay Durumu': ek.planStatusLabel,
      'Gerekçe Açıklaması': ek.explanation,
    }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      ekAracRows.length > 0 ? ekAracRows : [{ Bilgi: 'Ek araç ihtiyacı bulunmamaktadır.' }]
    ),
    'Ek Araç Raporu'
  );

  // Sayfa 4: Tesis Bazlı Yükleme Raporu (Bölüm 9)
  const tesisRows = Object.values(facilityReports).map((t) => ({
    'Tesis Adı': t.facilityName,
    'Toplam Çıkan Desi': t.outboundTotalDesi,
    'Toplam Koli': t.outboundTotalPackages,
    'Yükleme Yapılan Araç Sayısı': t.assignedVehiclesCount,
    'Cross Dock Çıkış Desisi': t.crossDockOutboundDesi,
    'Paletli Sevk Desisi': t.palletizedDesi,
    'Ek Araç Sefer Adedi': t.additionalVehicleCount,
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(tesisRows), 'Tesis Bazlı Yükleme');

  // Sayfa 5: Cross Dock Raporu (Bölüm 10)
  const cdExportRows = crossDockMovements.map((m) => ({
    'Cross Dock Merkezi': m.crossDockHubName,
    'Kaynak Tesis': m.sourceFacilityName,
    'Gerçek Varış Tesisi': m.trueDestinationName,
    'Paket Desisi': m.desi,
    'Koli Adedi': m.packages,
    'İlk Araç Kodu': m.firstVehicleLineCode,
    'Ara Aktarma Merkezi': m.transferHubName,
    'Son Araç Tipi': m.lastVehicleType,
    'Bekleme Süresi (Saat)': m.waitingHours,
    'Toplam Süre (Gün)': m.estimatedTotalDeliveryDays,
    'Gerekçe': m.transferReason,
  }));
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.json_to_sheet(
      cdExportRows.length > 0 ? cdExportRows : [{ Bilgi: 'Cross Dock aktarması bulunmuyor.' }]
    ),
    'Cross Dock Raporu'
  );

  // Sayfa 6: Araç Doluluk ve Kapasite Raporu (Bölüm 11)
  const dolulukRows = consolidatedRows
    .slice()
    .sort((a, b) => b.fillRate - a.fillRate)
    .map((r) => ({
      'Araç Kodu': r.vehicleId,
      'Güzergâh': r.routeLabel,
      'Araç Tipi': r.vehicleType,
      'Araç Kategorisi': r.vehicleCategoryLabel,
      'Toplam Yüklü Desi': r.totalDesi,
      'Kapasite (Desi)': r.capacityDesi,
      'Kalan Kapasite (Desi)': r.remainingCapacityDesi,
      'Doluluk (%)': r.fillRate,
      'Doluluk Sınıfı':
        r.fillRateTier === 'YUKSEK'
          ? '%90-100 (Yüksek)'
          : r.fillRateTier === 'IYI'
          ? '%75-89 (İyi)'
          : r.fillRateTier === 'ORTA'
          ? '%50-74 (Orta)'
          : r.fillRateTier === 'KAPASITE_HATASI'
          ? '%100+ (Kapasite Hatası)'
          : '%0-49 (Düşük)',
    }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dolulukRows), 'Araç Doluluk ve Kapasite');

  // Sayfa 7: Yönetici Özeti ve Veri Bütünlüğü (Bölüm 7 & 14)
  const ozetRows = [
    { 'Metrik Adı': 'Günlük Giriş Desisi', 'Değer': summary.dailyTotalInputDesi.toLocaleString('tr-TR') },
    { 'Metrik Adı': 'Günlük Giriş Paket Adedi', 'Değer': summary.dailyTotalInputPackages.toLocaleString('tr-TR') },
    { 'Metrik Adı': 'Excel Tanımlı Sabit Araç Sayısı', 'Değer': summary.excelDefinedFixedVehicleCount },
    { 'Metrik Adı': 'Planlanan Sabit Araç Sayısı', 'Değer': summary.plannedFixedVehicleCount },
    { 'Metrik Adı': 'Boş Kalan Sabit Araç Sayısı', 'Değer': summary.emptyFixedVehicleCount },
    { 'Metrik Adı': 'Ek Araç İhtiyacı Sayısı', 'Değer': summary.additionalVehicleNeedCount },
    { 'Metrik Adı': 'Onaylanan Ek Araç Sayısı', 'Değer': summary.approvedAdditionalVehicleCount },
    { 'Metrik Adı': 'Kamyonet Sayısı (3.500 Desi)', 'Değer': summary.kamyonetCount },
    { 'Metrik Adı': 'Kamyon Sayısı (12.500 Desi)', 'Değer': summary.kamyonCount },
    { 'Metrik Adı': 'TIR Sayısı (22.500 Desi)', 'Değer': summary.tirCount },
    { 'Metrik Adı': 'Toplam Aktif Araç Sayısı', 'Değer': summary.totalActiveVehicleCount },
    { 'Metrik Adı': 'Ortalama Doluluk Oranı', 'Değer': `%${summary.averageFillRate}` },
    { 'Metrik Adı': 'Cross Dock Toplam Desisi', 'Değer': summary.crossDockTotalDesi.toLocaleString('tr-TR') },
    { 'Metrik Adı': 'Paletlenen Gönderi Desisi', 'Değer': summary.palletizedTotalDesi.toLocaleString('tr-TR') },
    { 'Metrik Adı': '1 Günlük SLA Sevk Riski Desisi', 'Değer': summary.oneDaySlaRiskDesi.toLocaleString('tr-TR') },
    { 'Metrik Adı': 'Bölüm 14 Veri Bütünlüğü Eşitliği', 'Değer': summary.conservationEquationDetails },
    { 'Metrik Adı': 'Veri Bütünlüğü Doğrulandı mı?', 'Değer': summary.dataIntegrityConservationPassed ? 'EVET (%100 Korundu)' : 'HAYIR' },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ozetRows), 'Yönetici Özeti');

  // Sayfa 8: Desi Dağılım Matrisi (19x19)
  const desiHeader = ['Çıkış \\ Varış Desi', ...activeFacilities.map((f) => f.name)];
  const desiAoA: (string | number)[][] = [desiHeader];
  for (const o of activeFacilities) {
    const row: (string | number)[] = [o.name];
    for (const d of activeFacilities) {
      row.push(desiMatrix[o.id]?.[d.id] ?? 0);
    }
    desiAoA.push(row);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(desiAoA), 'Desi Matrisi (19x19)');

  const safeDate = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `Logistics_AI_Faz3_Konsolide_Plan_${safeDate}.xlsx`);
}
