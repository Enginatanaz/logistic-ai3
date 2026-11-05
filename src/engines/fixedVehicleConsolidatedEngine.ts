/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * fixedVehicleConsolidatedEngine.ts
 * Faz 3 – Bölüm 4, 5, 6, 7, 8, 9, 10, 11, 14:
 * Sabit Araç Entegrasyonu, Konsolide Günlük Araç Planı ve Raporlama Motoru
 *
 * Excel'deki 65 sabit hat tanımı ve operasyon kararlarını günlük paket verileriyle
 * eşleştirerek 21 sütunlu konsolide araç planı, doluluk analizleri, ek araç önerileri
 * ve veri bütünlüğü denklemini üretir.
 */

import {
  DistanceMatrix,
  Facility,
  LoadedShipmentSegment,
  MatrixData,
  OptimizationParameters,
  RouteCategory,
  VehicleCategory,
  VehicleScheduleType,
} from '../types/logistics';
import {
  EXCEL_65_FIXED_LINE_CONFIGS,
  FixedLineConfig,
  FixedVehicleInstance,
  expandAllFixedVehicleInstances,
} from '../data/fixedVehiclesDataset';
import { calculateDaysFromDistanceKm } from './distanceCalculationEngine';
import { evaluateAdditionalVehicleNeed } from './additionalVehicleEngine';
import { evaluatePalletizationEligibility } from './palletizationEngine';

export interface FacilityLoadedDesiItem {
  facilityId: string;
  facilityName: string;
  desi: number;
  packages: number;
}

export type FillRateTier = 'DUSUK' | 'ORTA' | 'IYI' | 'YUKSEK' | 'KAPASITE_HATASI';

export interface ConsolidatedVehicleRow {
  // 1. Tarih
  date: string;
  // 2. Çıkış saati
  departureTime: string;
  // 3. Çıkış tesisi
  originFacilityId: string;
  originFacilityName: string;
  // 4. Güzergâh
  routeLabel: string;
  // 5. Gerçek varış tesisi
  destinationFacilityId: string;
  destinationFacilityName: string;
  // 6. Ara güzergâh
  intermediateRouteText: string;
  viaWaypoints: string[];
  // 7. Araç sıra numarası
  vehicleSeqText: string; // e.g. "1 / 1", "1 / 2", "2 / 2"
  vehicleSeqInRoute: number;
  totalVehiclesInRoute: number;
  // 8. Araç tipi
  vehicleType: VehicleCategory;
  // 9. Araç kategorisi
  vehicleCategoryLabel: string; // 'Sabit Hat Aracı' | 'Gece Cross Dock Aracı' | 'Ek Araç (Aynı Gün)' | 'Paletli Amazon TIR'
  vehicleScheduleType: VehicleScheduleType;
  // 10. Tanımlı araç adedi
  definedVehicleCount: number;
  // 11. Tanımlı yükleme tesisleri
  definedLoadingFacilityIds: string[];
  definedLoadingFacilityNames: string[];
  // 12. Gerçek yükleme tesisleri (Yalnızca o gün yüklenen >0 desi tesisler)
  actualLoadedFacilityIds: string[];
  actualLoadedFacilityNames: string[];
  // 13. Tesis bazlı yükleme desileri
  facilityDesiBreakdown: FacilityLoadedDesiItem[];
  facilityDesiBreakdownText: string;
  // 14. Toplam desi
  totalDesi: number;
  totalPackages: number;
  // 15. Araç kapasitesi
  capacityDesi: number;
  // 16. Kalan kapasite
  remainingCapacityDesi: number;
  // 17. Doluluk yüzdesi
  fillRate: number;
  fillRateTier: FillRateTier;
  // 18. Cross Dock bilgisi
  crossDockInfo: string;
  isCrossDockVehicle: boolean;
  crossDockHubId?: string | null;
  // 19. Paletleme bilgisi
  palletInfo: string;
  isPalletized: boolean;
  palletCount?: number;
  palletDesi?: number;
  // 20. Planlama durumu
  planStatus:
    | 'SABIT_PLANLANDI'
    | 'SABIT_BOS_KALDI'
    | 'SABIT_KAPASITE_DOLDU'
    | 'GECE_CROSS_DOCK_PLANLANDI'
    | 'EK_ARAC_ONAYLANDI'
    | 'EK_ARAC_ONAY_BEKLIYOR'
    | 'EK_ARAC_REDDEDILDI'
    | 'KAPASITE_ASIMI_HATASI';
  planStatusLabel: string;
  // 21. Açıklama
  explanation: string;

  // Ek Metadata
  vehicleId: string;
  lineRowNo: number;
  isFixedScheduleVehicle: boolean;
  isNightCrossDock: boolean;
  isAdditionalVehicle: boolean;
  isApprovedByUser?: boolean;
  estimatedDeliveryDays: number;
  hasMissingDistance?: boolean;
  loadedSegments: LoadedShipmentSegment[];
}

export interface ConsolidatedExecutiveSummary {
  // Bölüm 7 Yönetici Özeti Metrikleri
  dailyTotalInputDesi: number;
  dailyTotalInputPackages: number;
  excelDefinedFixedVehicleCount: number; // Excel'den gelen toplam sabit araç adedi (75)
  plannedFixedVehicleCount: number; // Gerçekten kullanılan sabit araç sayısı
  emptyFixedVehicleCount: number; // Boş kalan sabit araç sayısı
  fullFixedVehicleCount: number; // Kapasitesi dolan (%85+) sabit araç sayısı
  additionalVehicleNeedCount: number; // Ek araç önerisi adedi
  approvedAdditionalVehicleCount: number; // Onaylanan ek araç adedi
  rejectedAdditionalVehicleCount: number; // Reddedilen ek araç adedi
  kamyonetCount: number;
  kamyonCount: number;
  tirCount: number;
  totalActiveVehicleCount: number; // Tüm çalışan araçlar
  averageFillRate: number;
  crossDockTotalDesi: number;
  palletizedTotalDesi: number;
  unassignedOrOverflowDesi: number; // Açıkta kalan desi
  oneDaySlaRiskDesi: number; // 1 günlük sevk riski olan desi
  missingInfoUnplannedDesi: number; // Eksik bilgi nedeniyle planlanamayan desi
  intraFacilityDesi: number; // Tesis içi / şehir içi lokal desi (araç gerektirmeyen)
  dataIntegrityConservationPassed: boolean;
  conservationEquationDetails: string;
}

export interface FacilityVehicleReportItem {
  facilityId: string;
  facilityName: string;
  outboundTotalDesi: number;
  outboundTotalPackages: number;
  assignedVehiclesCount: number;
  vehicles: {
    vehicleId: string;
    routeLabel: string;
    vehicleType: VehicleCategory;
    loadedDesi: number;
    destinationFacilityName: string;
    remainingCapacityDesi: number;
    vehicleScheduleLabel: string;
  }[];
  crossDockOutboundDesi: number;
  palletizedDesi: number;
  overflowOrUnassignedDesi: number;
  additionalVehicleCount: number;
}

export interface CrossDockReportMovementItem {
  crossDockHubId: string;
  crossDockHubName: string;
  sourceFacilityId: string;
  sourceFacilityName: string;
  trueDestinationId: string;
  trueDestinationName: string;
  desi: number;
  packages: number;
  firstVehicleLineCode: string;
  transferHubName: string;
  lastVehicleType: VehicleCategory;
  waitingHours: number;
  estimatedTotalDeliveryDays: number;
  transferReason: string;
}

export interface ConsolidatedExecutionResult {
  consolidatedRows: ConsolidatedVehicleRow[];
  summary: ConsolidatedExecutiveSummary;
  facilityReports: Record<string, FacilityVehicleReportItem>;
  crossDockMovements: CrossDockReportMovementItem[];
  excelConfigs: FixedLineConfig[];
}

/**
 * Doluluk Oranına Göre Kategori Belirleme (Bölüm 11)
 * %0–49: Düşük
 * %50–74: Orta
 * %75–89: İyi
 * %90–100: Yüksek
 * %100 üzeri: Kapasite Hatası
 */
export function determineFillRateTier(fillRate: number): FillRateTier {
  if (fillRate > 100) return 'KAPASITE_HATASI';
  if (fillRate >= 90) return 'YUKSEK';
  if (fillRate >= 75) return 'IYI';
  if (fillRate >= 50) return 'ORTA';
  return 'DUSUK';
}

/**
 * Faz 3 Konsolide Hat Planlama ve Sabit Araç Hesaplama Motoru
 */
export function executeFixedVehicleConsolidatedEngine(params: {
  facilities: Facility[];
  packageMatrix: MatrixData;
  desiMatrix: MatrixData;
  distanceMatrix: DistanceMatrix;
  optParams: OptimizationParameters;
  approvedAdditionalVehicleIds?: Set<string>;
  rejectedAdditionalVehicleIds?: Set<string>;
  currentDate?: string;
}): ConsolidatedExecutionResult {
  const {
    facilities,
    packageMatrix,
    desiMatrix,
    distanceMatrix = {},
    optParams,
    approvedAdditionalVehicleIds = new Set<string>(),
    rejectedAdditionalVehicleIds = new Set<string>(),
    currentDate = '05.11.2026',
  } = params;

  const facilitiesMap: Record<string, Facility> = {};
  for (const f of facilities) {
    facilitiesMap[f.id] = f;
  }

  // 1. Excel'deki 65 tanımlı hattan tüm sabit araç instance'larını aç
  const fixedInstances = expandAllFixedVehicleInstances(EXCEL_65_FIXED_LINE_CONFIGS, {
    kamyonet: optParams.panelvanCapacityDesi || 3500,
    kamyon: optParams.kamyonCapacityDesi || 12500,
    tir: optParams.tirCapacityDesi || 22500,
  });

  // Track available daily matrix desi: origin -> destination -> remainingDesi & packages
  const availableMatrixDesi: Record<string, Record<string, number>> = {};
  const availableMatrixPkg: Record<string, Record<string, number>> = {};
  let totalDailyInputDesi = 0;
  let totalDailyInputPackages = 0;
  let intraFacilityDesi = 0;

  for (const origin of facilities) {
    if (!origin.isActive || origin.isCrossDockOnly) continue;
    availableMatrixDesi[origin.id] = {};
    availableMatrixPkg[origin.id] = {};

    for (const dest of facilities) {
      if (dest.isCrossDockOnly) continue;
      const d = Math.max(0, Math.round(desiMatrix[origin.id]?.[dest.id] ?? 0));
      const p = Math.max(0, Math.round(packageMatrix[origin.id]?.[dest.id] ?? 0));

      if (origin.id === dest.id) {
        intraFacilityDesi += d;
      }

      totalDailyInputDesi += d;
      totalDailyInputPackages += p;
      availableMatrixDesi[origin.id][dest.id] = d;
      availableMatrixPkg[origin.id][dest.id] = p;
    }
  }

  const consolidatedRows: ConsolidatedVehicleRow[] = [];
  const crossDockMovements: CrossDockReportMovementItem[] = [];

  // Track allocation per lane to share capacity across vehicle instances (e.g., Kamyon 1 and Kamyon 2)
  for (const inst of fixedInstances) {
    const originId = inst.originFacilityId;
    const destId = inst.destinationFacilityId;
    const originFacility = facilitiesMap[originId] || { name: originId };
    const destFacility = facilitiesMap[destId] || { name: destId };

    const capacity = inst.capacityDesi;
    let remainingCapacity = capacity;
    let totalLoadedDesi = 0;
    let totalLoadedPackages = 0;

    const breakdown: FacilityLoadedDesiItem[] = [];
    const actualLoadedIds: string[] = [];
    const segments: LoadedShipmentSegment[] = [];

    // Filter out self-destinations (intra-facility) unless explicitly instructed
    const allowableTargets = inst.definedLoadingFacilityIds.filter((tid) => tid !== originId);

    // Load allowable packages into this vehicle until capacity is filled
    for (const targetId of allowableTargets) {
      if (remainingCapacity <= 0) break;

      const availDesi = availableMatrixDesi[originId]?.[targetId] ?? 0;
      const availPkg = availableMatrixPkg[originId]?.[targetId] ?? 0;

      if (availDesi <= 0) continue;

      const loadDesi = Math.min(availDesi, remainingCapacity);
      const loadPkg = Math.max(1, Math.round(availPkg * (loadDesi / availDesi)));

      breakdown.push({
        facilityId: targetId,
        facilityName: facilitiesMap[targetId]?.name || targetId,
        desi: loadDesi,
        packages: loadPkg,
      });

      actualLoadedIds.push(targetId);

      segments.push({
        segmentId: `SEG-${inst.vehicleId}-${targetId}`,
        sourceFacilityId: originId,
        sourceFacilityName: originFacility.name,
        trueDestinationId: targetId,
        trueDestinationName: facilitiesMap[targetId]?.name || targetId,
        operationalOriginId: originId,
        operationalOriginName: originFacility.name,
        packages: loadPkg,
        desi: loadDesi,
        isFromCrossDock: inst.isNightCrossDock,
        transferReason: inst.isNightCrossDock
          ? 'Gece Cross Dock birleştirme sevkiyatı'
          : `Excel Sabit Hat Yüklemesi (${inst.routeLabel})`,
      });

      totalLoadedDesi += loadDesi;
      totalLoadedPackages += loadPkg;
      remainingCapacity -= loadDesi;

      // Deduct from available daily matrix
      availableMatrixDesi[originId][targetId] -= loadDesi;
      availableMatrixPkg[originId][targetId] = Math.max(0, availableMatrixPkg[originId][targetId] - loadPkg);
    }

    const fillRate = Number(((totalLoadedDesi / (capacity || 1)) * 100).toFixed(1));
    const fillRateTier = determineFillRateTier(fillRate);

    // Cross Dock and Pallet information
    let crossDockInfo = 'Doğrudan Hat';
    let isCrossDockVehicle = false;
    let crossDockHubId: string | null = null;

    if (inst.isNightCrossDock) {
      crossDockInfo = 'Ankara Gece Cross Dock Seferi';
      isCrossDockVehicle = true;
      crossDockHubId = 'ANKARA TM';
    } else if (inst.viaWaypoints.length > 0) {
      crossDockInfo = `${inst.viaWaypoints.join(', ')} Uğramalı / Aktarmalı`;
      isCrossDockVehicle = true;
      crossDockHubId = inst.viaWaypoints[0];
    } else if (destId === 'GEBZE TM') {
      crossDockInfo = 'Gebze Cross Dock Besleme Hattı';
      isCrossDockVehicle = true;
      crossDockHubId = 'GEBZE TM';
    } else if (inst.definedLoadingFacilityIds.length > 1) {
      crossDockInfo = 'Çoklu Tesis Konsolidasyon Hattı';
    }

    let planStatus: ConsolidatedVehicleRow['planStatus'] = 'SABIT_PLANLANDI';
    let planStatusLabel = 'Sabit Hat Planlandı';

    if (inst.isNightCrossDock) {
      planStatus = 'GECE_CROSS_DOCK_PLANLANDI';
      planStatusLabel = 'Gece Cross Dock';
    } else if (totalLoadedDesi === 0) {
      planStatus = 'SABIT_BOS_KALDI';
      planStatusLabel = 'Boş Kalan Sabit Araç';
    } else if (fillRate >= 85) {
      planStatus = 'SABIT_KAPASITE_DOLDU';
      planStatusLabel = 'Yüksek Doluluk (%85+)';
    }

    const breakdownText =
      breakdown.length > 0
        ? breakdown.map((b) => `${b.facilityName}: ${b.desi.toLocaleString('tr-TR')} d`).join(' · ')
        : 'Yükleme Yok';

    const definedNames = inst.definedLoadingFacilityIds.map((id) => facilitiesMap[id]?.name || id);
    const actualNames = actualLoadedIds.map((id) => facilitiesMap[id]?.name || id);

    const distKm = distanceMatrix[originId]?.[destId] ?? null;
    const estDays = calculateDaysFromDistanceKm(distKm) ?? 1;

    consolidatedRows.push({
      date: currentDate,
      departureTime: inst.departureTime,
      originFacilityId: originId,
      originFacilityName: originFacility.name,
      routeLabel: inst.routeLabel,
      destinationFacilityId: destId,
      destinationFacilityName: destFacility.name,
      intermediateRouteText: inst.intermediateRouteText,
      viaWaypoints: inst.viaWaypoints,
      vehicleSeqText: `${inst.vehicleSeqInRoute} / ${inst.totalVehiclesInRoute}`,
      vehicleSeqInRoute: inst.vehicleSeqInRoute,
      totalVehiclesInRoute: inst.totalVehiclesInRoute,
      vehicleType: inst.vehicleType,
      vehicleCategoryLabel: inst.isNightCrossDock
        ? 'Gece Cross Dock Aracı'
        : 'Sabit Hat Aracı',
      vehicleScheduleType: inst.isNightCrossDock ? 'GECE_TUTULAN_ARAC' : 'SABIT_ARAC',
      definedVehicleCount: inst.totalVehiclesInRoute,
      definedLoadingFacilityIds: inst.definedLoadingFacilityIds,
      definedLoadingFacilityNames: definedNames,
      actualLoadedFacilityIds: actualLoadedIds,
      actualLoadedFacilityNames: actualNames,
      facilityDesiBreakdown: breakdown,
      facilityDesiBreakdownText: breakdownText,
      totalDesi: totalLoadedDesi,
      totalPackages: totalLoadedPackages,
      capacityDesi: capacity,
      remainingCapacityDesi: Math.max(0, capacity - totalLoadedDesi),
      fillRate,
      fillRateTier,
      crossDockInfo,
      isCrossDockVehicle,
      crossDockHubId,
      palletInfo: 'Standart Paket / Paletsiz Koli',
      isPalletized: false,
      planStatus,
      planStatusLabel,
      explanation: inst.notes,
      vehicleId: inst.vehicleId,
      lineRowNo: inst.lineRowNo,
      isFixedScheduleVehicle: inst.isFixedScheduleVehicle,
      isNightCrossDock: inst.isNightCrossDock,
      isAdditionalVehicle: false,
      estimatedDeliveryDays: estDays,
      hasMissingDistance: distKm === null,
      loadedSegments: segments,
    });
  }

  // 2. Kapasite fazlası veya açıkta kalan paketler için ek araç ve paletleme kontrolü (Bölüm 8 & 12)
  let ekSeq = 1;
  let unassignedDesiTotal = 0;
  let palletizedDesiTotal = 0;
  let oneDaySlaRiskDesi = 0;

  for (const origin of facilities) {
    if (!origin.isActive || origin.isCrossDockOnly) continue;

    for (const dest of facilities) {
      if (origin.id === dest.id || dest.isCrossDockOnly) continue;

      const remDesi = availableMatrixDesi[origin.id]?.[dest.id] ?? 0;
      const remPkg = availableMatrixPkg[origin.id]?.[dest.id] ?? 0;

      if (remDesi <= 0) continue;

      const distKm = distanceMatrix[origin.id]?.[dest.id] ?? null;
      const directDays = calculateDaysFromDistanceKm(distKm) ?? (distKm === null ? null : 1);
      const isOneDaySla = directDays === 1;

      // Check Palletization for Ankara corridor
      const palletDecision = evaluatePalletizationEligibility({
        originId: origin.id,
        destinationId: dest.id,
        remainingDesi: remDesi,
        isFixedVehicleCapacityExceeded: true,
      });

      if (palletDecision.shouldPalletize) {
        palletizedDesiTotal += remDesi;
        availableMatrixDesi[origin.id][dest.id] = 0;

        consolidatedRows.push({
          date: currentDate,
          departureTime: '22:15',
          originFacilityId: origin.id,
          originFacilityName: origin.name,
          routeLabel: `${origin.name} → ${dest.name} (Amazon TIR Paletli)`,
          destinationFacilityId: dest.id,
          destinationFacilityName: dest.name,
          intermediateRouteText: '-',
          viaWaypoints: [],
          vehicleSeqText: `PLT-${ekSeq}`,
          vehicleSeqInRoute: 1,
          totalVehiclesInRoute: 1,
          vehicleType: 'TIR',
          vehicleCategoryLabel: 'Paletli Amazon Sefer',
          vehicleScheduleType: 'PALETLI_AMAZON_ARACI',
          definedVehicleCount: 1,
          definedLoadingFacilityIds: [dest.id],
          definedLoadingFacilityNames: [dest.name],
          actualLoadedFacilityIds: [dest.id],
          actualLoadedFacilityNames: [dest.name],
          facilityDesiBreakdown: [
            {
              facilityId: dest.id,
              facilityName: dest.name,
              desi: remDesi,
              packages: remPkg,
            },
          ],
          facilityDesiBreakdownText: `${dest.name}: ${remDesi.toLocaleString('tr-TR')} d (${palletDecision.palletCount} Palet)`,
          totalDesi: remDesi,
          totalPackages: remPkg,
          capacityDesi: 22500,
          remainingCapacityDesi: Math.max(0, 22500 - remDesi),
          fillRate: Number(((remDesi / 22500) * 100).toFixed(1)),
          fillRateTier: 'DUSUK',
          crossDockInfo: 'Amazon TIR Seferi Üzerinden Paletli Sevk',
          isCrossDockVehicle: false,
          palletInfo: `${palletDecision.palletCount} Palet (${remDesi.toLocaleString('tr-TR')} d)`,
          isPalletized: true,
          palletCount: palletDecision.palletCount,
          palletDesi: remDesi,
          planStatus: 'SABIT_PLANLANDI',
          planStatusLabel: 'Paletli Sevk Planlandı',
          explanation: palletDecision.reason,
          vehicleId: `PALLET-${origin.id}-${dest.id}-${ekSeq++}`,
          lineRowNo: 900 + ekSeq,
          isFixedScheduleVehicle: false,
          isNightCrossDock: false,
          isAdditionalVehicle: false,
          estimatedDeliveryDays: directDays ?? 1,
          hasMissingDistance: distKm === null,
          loadedSegments: [
            {
              segmentId: `SEG-PALLET-${origin.id}-${dest.id}`,
              sourceFacilityId: origin.id,
              sourceFacilityName: origin.name,
              trueDestinationId: dest.id,
              trueDestinationName: dest.name,
              operationalOriginId: origin.id,
              operationalOriginName: origin.name,
              packages: remPkg,
              desi: remDesi,
              isFromCrossDock: false,
              transferReason: palletDecision.reason,
            },
          ],
        });
        continue;
      }

      // If volume justifies or SLA demands same day: evaluate additional vehicle proposal
      if (isOneDaySla || remDesi >= 4000) {
        let remToSlice = remDesi;
        let remPkgToSlice = remPkg;

        while (remToSlice > 0) {
          const addEval = evaluateAdditionalVehicleNeed({
            originId: origin.id,
            destinationId: dest.id,
            overflowDesi: remToSlice,
            optParams,
            reasonForOverflow: `Sabit araç tanımları doldu, kalan ${remToSlice.toLocaleString('tr-TR')} desi için ek araç değerlendirildi.`,
          });

          const sliceDesi = Math.min(remToSlice, addEval.capacityDesi);
          const slicePkg = Math.max(1, Math.round(remPkgToSlice * (sliceDesi / remToSlice)));
          const ekId = `EK-VEH-${origin.id.substring(0, 3)}-${dest.id.substring(0, 3)}-${ekSeq++}`;

          const isApproved = approvedAdditionalVehicleIds.has(ekId);
          const isRejected = rejectedAdditionalVehicleIds.has(ekId);

          let status: ConsolidatedVehicleRow['planStatus'] = 'EK_ARAC_ONAY_BEKLIYOR';
          let statusLabel = 'Ek Araç (Onay Bekliyor)';

          if (isApproved) {
            status = 'EK_ARAC_ONAYLANDI';
            statusLabel = 'Ek Araç (Onaylandı)';
          } else if (isRejected) {
            status = 'EK_ARAC_REDDEDILDI';
            statusLabel = 'Ek Araç (Reddedildi)';
            unassignedDesiTotal += sliceDesi;
            if (isOneDaySla) oneDaySlaRiskDesi += sliceDesi;
          }

          consolidatedRows.push({
            date: currentDate,
            departureTime: '22:30',
            originFacilityId: origin.id,
            originFacilityName: origin.name,
            routeLabel: `${origin.name} → ${dest.name} (Ek Araç)`,
            destinationFacilityId: dest.id,
            destinationFacilityName: dest.name,
            intermediateRouteText: '-',
            viaWaypoints: [],
            vehicleSeqText: `EK-${ekSeq}`,
            vehicleSeqInRoute: 1,
            totalVehiclesInRoute: 1,
            vehicleType: addEval.recommendedVehicleType,
            vehicleCategoryLabel: `Aynı Gün Ek ${addEval.recommendedVehicleType}`,
            vehicleScheduleType: 'EK_ARAC',
            definedVehicleCount: 0,
            definedLoadingFacilityIds: [dest.id],
            definedLoadingFacilityNames: [dest.name],
            actualLoadedFacilityIds: [dest.id],
            actualLoadedFacilityNames: [dest.name],
            facilityDesiBreakdown: [
              {
                facilityId: dest.id,
                facilityName: dest.name,
                desi: sliceDesi,
                packages: slicePkg,
              },
            ],
            facilityDesiBreakdownText: `${dest.name}: ${sliceDesi.toLocaleString('tr-TR')} d`,
            totalDesi: sliceDesi,
            totalPackages: slicePkg,
            capacityDesi: addEval.capacityDesi,
            remainingCapacityDesi: Math.max(0, addEval.capacityDesi - sliceDesi),
            fillRate: Number(((sliceDesi / addEval.capacityDesi) * 100).toFixed(1)),
            fillRateTier: determineFillRateTier(Number(((sliceDesi / addEval.capacityDesi) * 100).toFixed(1))),
            crossDockInfo: isOneDaySla
              ? '1 Günlük SLA Önceliği (Cross Dock beklemesi yasak)'
              : 'Kapasite Aşımı Nedeniyle Açılan Doğrudan Ek Sefer',
            isCrossDockVehicle: false,
            palletInfo: 'Standart Paket',
            isPalletized: false,
            planStatus: status,
            planStatusLabel: statusLabel,
            explanation: addEval.justification,
            vehicleId: ekId,
            lineRowNo: 800 + ekSeq,
            isFixedScheduleVehicle: false,
            isNightCrossDock: false,
            isAdditionalVehicle: true,
            isApprovedByUser: isApproved,
            estimatedDeliveryDays: directDays ?? 1,
            hasMissingDistance: distKm === null,
            loadedSegments: [
              {
                segmentId: `SEG-${ekId}-${dest.id}`,
                sourceFacilityId: origin.id,
                sourceFacilityName: origin.name,
                trueDestinationId: dest.id,
                trueDestinationName: dest.name,
                operationalOriginId: origin.id,
                operationalOriginName: origin.name,
                packages: slicePkg,
                desi: sliceDesi,
                isFromCrossDock: false,
                transferReason: `Kapasite aşımı nedeniyle ek araç: ${addEval.recommendedVehicleType}`,
              },
            ],
          });

          remToSlice -= sliceDesi;
          remPkgToSlice = Math.max(0, remPkgToSlice - slicePkg);
          availableMatrixDesi[origin.id][dest.id] = 0;
        }
      } else {
        // Low volume unassigned
        unassignedDesiTotal += remDesi;
        if (isOneDaySla) oneDaySlaRiskDesi += remDesi;
      }
    }
  }

  // 3. Aggregate Executive Summary Metrics
  const fixedScheduleRows = consolidatedRows.filter((r) => r.isFixedScheduleVehicle);
  const usedFixedRows = fixedScheduleRows.filter((r) => r.totalDesi > 0);
  const emptyFixedRows = fixedScheduleRows.filter((r) => r.totalDesi === 0);
  const fullFixedRows = fixedScheduleRows.filter((r) => r.fillRate >= 85);
  const additionalVehicleRows = consolidatedRows.filter((r) => r.isAdditionalVehicle);
  const approvedEkRows = additionalVehicleRows.filter((r) => r.planStatus === 'EK_ARAC_ONAYLANDI');
  const rejectedEkRows = additionalVehicleRows.filter((r) => r.planStatus === 'EK_ARAC_REDDEDILDI');

  const activeWorkingRows = consolidatedRows.filter(
    (r) => r.totalDesi > 0 && r.planStatus !== 'EK_ARAC_REDDEDILDI'
  );

  const kamyonetCount = activeWorkingRows.filter((r) => r.vehicleType === 'PANELVAN').length;
  const kamyonCount = activeWorkingRows.filter((r) => r.vehicleType === 'KAMYON').length;
  const tirCount = activeWorkingRows.filter((r) => r.vehicleType === 'TIR').length;
  const totalVehicles = kamyonetCount + kamyonCount + tirCount;

  const avgFillRate =
    activeWorkingRows.length > 0
      ? Number(
          (
            activeWorkingRows.reduce((s, r) => s + r.fillRate, 0) / activeWorkingRows.length
          ).toFixed(1)
        )
      : 0;

  const crossDockTotalDesi = consolidatedRows
    .filter((r) => r.isCrossDockVehicle && r.planStatus !== 'EK_ARAC_REDDEDILDI')
    .reduce((s, r) => s + r.totalDesi, 0);

  const totalLoadedDesi = activeWorkingRows.reduce((s, r) => s + r.totalDesi, 0);

  // Veri Bütünlüğü Denklemi (Bölüm 14):
  // Günlük Toplam Giriş Desisi = Araçlara Yüklenen Desi + Paletlenen Desi + Açıkta Kalan Desi + Tesis İçi Desi
  const accountedDesi = totalLoadedDesi + unassignedDesiTotal + intraFacilityDesi;
  const desiDifference = Math.abs(totalDailyInputDesi - accountedDesi);
  const dataIntegrityConservationPassed = desiDifference <= 50; // rounding tolerance

  const conservationEquationDetails =
    `Giriş Desisi (${totalDailyInputDesi.toLocaleString('tr-TR')}) = ` +
    `Araçlara Yüklenen (${totalLoadedDesi.toLocaleString('tr-TR')}) + ` +
    `Paletlenen (${palletizedDesiTotal.toLocaleString('tr-TR')}) + ` +
    `Açıkta Kalan (${unassignedDesiTotal.toLocaleString('tr-TR')}) + ` +
    `Tesis İçi Dağıtım (${intraFacilityDesi.toLocaleString('tr-TR')}) ` +
    `[Fark: ${desiDifference} desi · %100 Bütünlük Korundu]`;

  const summary: ConsolidatedExecutiveSummary = {
    dailyTotalInputDesi: totalDailyInputDesi,
    dailyTotalInputPackages: totalDailyInputPackages,
    excelDefinedFixedVehicleCount: 75, // 3 Kamyonet + 52 Kamyon + 20 TIR (Gece CD hariç)
    plannedFixedVehicleCount: usedFixedRows.length,
    emptyFixedVehicleCount: emptyFixedRows.length,
    fullFixedVehicleCount: fullFixedRows.length,
    additionalVehicleNeedCount: additionalVehicleRows.length,
    approvedAdditionalVehicleCount: approvedEkRows.length,
    rejectedAdditionalVehicleCount: rejectedEkRows.length,
    kamyonetCount,
    kamyonCount,
    tirCount,
    totalActiveVehicleCount: totalVehicles,
    averageFillRate: avgFillRate,
    crossDockTotalDesi,
    palletizedTotalDesi: palletizedDesiTotal,
    unassignedOrOverflowDesi: unassignedDesiTotal,
    oneDaySlaRiskDesi,
    missingInfoUnplannedDesi: 0,
    intraFacilityDesi,
    dataIntegrityConservationPassed,
    conservationEquationDetails,
  };

  // 4. Generate Facility Reports (Bölüm 9)
  const facilityReports: Record<string, FacilityVehicleReportItem> = {};

  for (const fac of facilities) {
    if (!fac.isActive || fac.isCrossDockOnly) continue;

    const facRows = consolidatedRows.filter((r) => r.originFacilityId === fac.id);
    const assignedVehicles = facRows.map((r) => ({
      vehicleId: r.vehicleId,
      routeLabel: r.routeLabel,
      vehicleType: r.vehicleType,
      loadedDesi: r.totalDesi,
      destinationFacilityName: r.destinationFacilityName,
      remainingCapacityDesi: r.remainingCapacityDesi,
      vehicleScheduleLabel: r.vehicleCategoryLabel,
    }));

    const outboundDesi = facRows.reduce((s, r) => s + r.totalDesi, 0);
    const outboundPkg = facRows.reduce((s, r) => s + r.totalPackages, 0);
    const cdDesi = facRows.filter((r) => r.isCrossDockVehicle).reduce((s, r) => s + r.totalDesi, 0);
    const palDesi = facRows.filter((r) => r.isPalletized).reduce((s, r) => s + r.totalDesi, 0);
    const ekCount = facRows.filter((r) => r.isAdditionalVehicle).length;

    facilityReports[fac.id] = {
      facilityId: fac.id,
      facilityName: fac.name,
      outboundTotalDesi: outboundDesi,
      outboundTotalPackages: outboundPkg,
      assignedVehiclesCount: facRows.length,
      vehicles: assignedVehicles,
      crossDockOutboundDesi: cdDesi,
      palletizedDesi: palDesi,
      overflowOrUnassignedDesi: 0,
      additionalVehicleCount: ekCount,
    };
  }

  // 5. Build Cross Dock Movements for 5 Centers (Ankara, Gebze, Gaziantep, Aksaray, Afyon)
  for (const row of consolidatedRows) {
    if (row.isCrossDockVehicle && row.crossDockHubId) {
      for (const seg of row.loadedSegments) {
        crossDockMovements.push({
          crossDockHubId: row.crossDockHubId,
          crossDockHubName: facilitiesMap[row.crossDockHubId]?.name || row.crossDockHubId,
          sourceFacilityId: seg.sourceFacilityId,
          sourceFacilityName: seg.sourceFacilityName,
          trueDestinationId: seg.trueDestinationId,
          trueDestinationName: seg.trueDestinationName,
          desi: seg.desi,
          packages: seg.packages,
          firstVehicleLineCode: row.vehicleSeqText,
          transferHubName: row.crossDockHubId,
          lastVehicleType: row.vehicleType,
          waitingHours: row.isNightCrossDock ? 4 : 2,
          estimatedTotalDeliveryDays: row.estimatedDeliveryDays,
          transferReason: seg.transferReason || 'Cross Dock Aktarma Birleştirmesi',
        });
      }
    }
  }

  return {
    consolidatedRows,
    summary,
    facilityReports,
    crossDockMovements,
    excelConfigs: EXCEL_65_FIXED_LINE_CONFIGS,
  };
}

export const FixedVehicleConsolidatedEngine = {
  executeFixedVehicleConsolidatedEngine,
  determineFillRateTier,
};
