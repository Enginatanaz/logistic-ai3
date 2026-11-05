import {
  CrossDockMovement,
  DistanceMatrix,
  Facility,
  LoadedShipmentSegment,
  OptimizationParameters,
  PlannedVehicleLine,
  UnplannedShipment,
  VehicleCategory,
} from '../types/logistics';
import { calculateRouteDeliveryEstimate } from './distanceCalculationEngine';

export interface CrossDockCandidate {
  id: string;
  sourceFacilityId: string;
  sourceFacilityName: string;
  operationalOriginId?: string;
  operationalOriginName?: string;
  trueDestinationId: string;
  trueDestinationName: string;
  desi: number;
  packages: number;
  directDays?: number | null; // Kural 1 & 2: Gerçek teslimat süresi (gün)
  deliveryDaysCategory?: 1 | 2 | 3; // Kural 3 & 5: 1, 2 veya 3 günlük teslimat süresi
  reasonType:
    | '12500_16000_ARTIGI'
    | 'DUSUK_HACIM_BIRLESTIRME'
    | 'TIR_KAPASITE_ARTIGI'
    | 'MARMARA_KOCAELI_AVRUPA_KONSOLIDASYON'
    | 'KISIT_ARTIGI'
    | 'PASIF_TESIS_ALTERNATIFI';
  reasonDetail: string;
  eligibleForGebze: boolean;
}

/**
 * Splits a group of CrossDockCandidates into a vehicle load of at most `maxDesi`
 * and returns the loaded segments, consumed candidates, and leftover candidates.
 * Guarantees exact conservation of both `desi` and `packages`.
 */
function takeDesiFromCandidates(
  candidates: CrossDockCandidate[],
  maxDesi: number,
  hubId: 'ANKARA TM' | 'GEBZE TM'
): {
  loadedSegments: LoadedShipmentSegment[];
  loadedMovements: CrossDockMovement[];
  remainingCandidates: CrossDockCandidate[];
  totalLoadedDesi: number;
  totalLoadedPackages: number;
} {
  const loadedSegments: LoadedShipmentSegment[] = [];
  const loadedMovements: CrossDockMovement[] = [];
  const remainingCandidates: CrossDockCandidate[] = [];

  let neededDesi = maxDesi;
  let totalLoadedDesi = 0;
  let totalLoadedPackages = 0;

  for (const cand of candidates) {
    if (cand.desi <= 0) continue;

    if (neededDesi <= 0) {
      remainingCandidates.push(cand);
      continue;
    }

    const opOriginId = cand.operationalOriginId || cand.sourceFacilityId;
    const opOriginName = cand.operationalOriginName || cand.sourceFacilityName;

    if (cand.desi <= neededDesi) {
      // Take entire candidate
      neededDesi -= cand.desi;
      totalLoadedDesi += cand.desi;
      totalLoadedPackages += cand.packages;

      loadedSegments.push({
        segmentId: `SEG-${hubId}-${cand.id}`,
        sourceFacilityId: cand.sourceFacilityId,
        sourceFacilityName: cand.sourceFacilityName,
        operationalOriginId: opOriginId,
        operationalOriginName: opOriginName,
        trueDestinationId: cand.trueDestinationId,
        trueDestinationName: cand.trueDestinationName,
        packages: cand.packages,
        desi: cand.desi,
        isFromCrossDock: true,
        crossDockFacilityId: hubId,
        crossDockFacilityName: hubId,
        transferReason: cand.reasonDetail,
      });

      loadedMovements.push({
        id: `CDM-${hubId}-${cand.id}`,
        hubFacilityId: hubId,
        sourceFacilityId: cand.sourceFacilityId,
        sourceFacilityName: cand.sourceFacilityName,
        trueDestinationId: cand.trueDestinationId,
        trueDestinationName: cand.trueDestinationName,
        desi: cand.desi,
        packages: cand.packages,
        reasonType: cand.reasonType,
        reasonDetail: cand.reasonDetail,
        status: 'PLANLANDI',
      });
    } else {
      // Partial take so vehicle capacity is NEVER exceeded
      const takeDesi = neededDesi;
      const leaveDesi = cand.desi - takeDesi;
      const takePkg = Math.max(1, Math.min(cand.packages - 1, Math.round((cand.packages * takeDesi) / cand.desi)));
      const leavePkg = Math.max(1, cand.packages - takePkg);

      neededDesi = 0;
      totalLoadedDesi += takeDesi;
      totalLoadedPackages += takePkg;

      loadedSegments.push({
        segmentId: `SEG-${hubId}-${cand.id}-PART1`,
        sourceFacilityId: cand.sourceFacilityId,
        sourceFacilityName: cand.sourceFacilityName,
        operationalOriginId: opOriginId,
        operationalOriginName: opOriginName,
        trueDestinationId: cand.trueDestinationId,
        trueDestinationName: cand.trueDestinationName,
        packages: takePkg,
        desi: takeDesi,
        isFromCrossDock: true,
        crossDockFacilityId: hubId,
        crossDockFacilityName: hubId,
        transferReason: `${cand.reasonDetail} (${takeDesi.toLocaleString('tr-TR')} desi yüklendi)`,
      });

      loadedMovements.push({
        id: `CDM-${hubId}-${cand.id}-PART1`,
        hubFacilityId: hubId,
        sourceFacilityId: cand.sourceFacilityId,
        sourceFacilityName: cand.sourceFacilityName,
        trueDestinationId: cand.trueDestinationId,
        trueDestinationName: cand.trueDestinationName,
        desi: takeDesi,
        packages: takePkg,
        reasonType: cand.reasonType,
        reasonDetail: cand.reasonDetail,
        status: 'PLANLANDI',
      });

      remainingCandidates.push({
        ...cand,
        id: `${cand.id}-REM`,
        desi: leaveDesi,
        packages: leavePkg,
      });
    }
  }

  return {
    loadedSegments,
    loadedMovements,
    remainingCandidates,
    totalLoadedDesi,
    totalLoadedPackages,
  };
}

/**
 * Section 7: GEBZE CROSS DOCK KURALLARI
 * Evaluates candidates originating from AVRUPA TM, MARMARA TM, and KOCAELİ TM.
 * Only consolidates at Gebze TM when:
 * - At least 2 distinct origins among {AVRUPA TM, MARMARA TM, KOCAELİ TM} have shipments to the exact same destination
 * - Destination is not in the Marmara/Gebze local cluster itself (not AVRUPA TM, MARMARA TM, KOCAELİ TM)
 * - Combined volume forms a complete or efficient single vehicle without leaving stranded remainders that would need a second Cross Dock
 */
export function runGebzeCrossDockEngine(params: {
  candidates: CrossDockCandidate[];
  facilitiesMap: Record<string, Facility>;
  optParams: OptimizationParameters;
  distanceMatrix: DistanceMatrix;
}): {
  gebzeLines: PlannedVehicleLine[];
  gebzeMovements: CrossDockMovement[];
  forwardedToAnkaraCandidates: CrossDockCandidate[];
} {
  const { candidates, facilitiesMap, optParams, distanceMatrix } = params;
  const gebzeLines: PlannedVehicleLine[] = [];
  const gebzeMovements: CrossDockMovement[] = [];
  const forwardedToAnkaraCandidates: CrossDockCandidate[] = [];

  // Kural: Gebze Cross Dock'a yalnızca Avrupa TM, Marmara TM ve Kocaeli TM çıkışlı araçlardan paket kabul edilir.
  const gebzeEligibleOrigins = new Set(['AVRUPA TM', 'MARMARA TM', 'KOCAELİ TM']);

  // Kural: Gebze Cross Dock üzerinden Adana TM, Gaziantep TM, Diyarbakır TM, Erzurum TM ve Samsun TM varışlı 2 günlük paketler değerlendirilir.
  const gebzeEligibleDestinations = new Set([
    'ADANA TM',
    'GAZİANTEP TM',
    'DİYARBAKIR TM',
    'ERZURUM TM',
    'SAMSUN TM',
  ]);

  // Separate candidates into potentially Gebze-eligible vs non-Gebze
  const byDestGebze: Record<string, CrossDockCandidate[]> = {};

  for (const c of candidates) {
    const isOriginEligible = gebzeEligibleOrigins.has(c.sourceFacilityId);
    const isDestEligible = gebzeEligibleDestinations.has(c.trueDestinationId);
    // Kural 1, 3: 2 günlük teslimat süresine sahip paketler değerlendirilir
    const isTwoDayPackage = c.deliveryDaysCategory !== 3;

    const canEvaluateAtGebze =
      c.eligibleForGebze &&
      isOriginEligible &&
      isDestEligible &&
      isTwoDayPackage &&
      c.trueDestinationId !== 'GEBZE TM';

    if (canEvaluateAtGebze) {
      if (!byDestGebze[c.trueDestinationId]) {
        byDestGebze[c.trueDestinationId] = [];
      }
      byDestGebze[c.trueDestinationId].push(c);
    } else {
      forwardedToAnkaraCandidates.push(c);
    }
  }

  let gebzeLineCounter = 1;

  for (const [destId, group] of Object.entries(byDestGebze)) {
    const distinctOrigins = new Set(group.map((g) => g.sourceFacilityId));
    const totalDesi = group.reduce((acc, item) => acc + item.desi, 0);
    const destFacility = facilitiesMap[destId];
    const isDestKamyonOnly =
      Boolean(destFacility?.inboundKamyonOnly) ||
      destId === 'BURSA TM' ||
      destId === 'İZMİR TM' ||
      destId === 'KOCAELİ TM';

    // Section 7.2, 7.3 & Faz 1 Bölüm 14.2:
    // Consolidate at Gebze if at least 2 origins from {Avrupa, Marmara, Kocaeli} share the same destination
    // AND totalDesi >= 6.500 desi (or second vehicle threshold >= 8.500 Kamyon / >= 16.500 TIR).
    if (distinctOrigins.size >= 2 && totalDesi >= 6500) {
      let vehicleType: VehicleCategory = 'KAMYON';
      let capacity = optParams.kamyonCapacityDesi;

      // Faz 1 Bölüm 14.2: TIR için en az 16.500 desi eşiği
      if (totalDesi >= 16500 && !isDestKamyonOnly) {
        vehicleType = 'TIR';
        capacity = optParams.tirCapacityDesi;
      }

      const allocation = takeDesiFromCandidates(
        group.map((g) => ({
          ...g,
          reasonType: 'MARMARA_KOCAELI_AVRUPA_KONSOLIDASYON',
          reasonDetail: `Avrupa/Marmara/Kocaeli çıkışlı ${destId} varışlı 2 günlük yükler Gebze Cross Dock'ta birleştirildi.`,
        })),
        capacity,
        'GEBZE TM'
      );

      const lineCode = `GBZ-CD-${String(gebzeLineCounter++).padStart(2, '0')}`;
      const representativeOrigin = allocation.loadedSegments[0]?.sourceFacilityId || 'AVRUPA TM';
      const delivery = calculateRouteDeliveryEstimate({
        originId: representativeOrigin,
        destinationId: destId,
        viaCrossDockId: 'GEBZE TM',
        distanceMatrix,
        crossDockHandlingHours: optParams.crossDockHandlingHours,
        departureTime: optParams.defaultDepartureTime,
      });

      const lineId = `LINE-${lineCode}`;
      allocation.loadedMovements.forEach((m) => {
        m.outboundVehicleLineId = lineId;
        gebzeMovements.push(m);
      });

      gebzeLines.push({
        id: lineId,
        lineCode,
        originFacilityId: 'GEBZE TM',
        originFacilityName: 'GEBZE TM (Cross Dock)',
        destinationFacilityId: destId,
        destinationFacilityName: destFacility?.name ?? destId,
        vehicleType,
        transportTypeLabel: 'Gebze Cross Dock',
        vehicleQuotaType: 'SABIT_HAT_ARACI',
        vehicleQuotaLabel: 'Sabit Hat Aracı',
        phase1RuleTag: 'BOLUM_14_2_GEBZE_CD',
        capacityDesi: capacity,
        totalDesi: allocation.totalLoadedDesi,
        totalPackages: allocation.totalLoadedPackages,
        fillRate: Number(((allocation.totalLoadedDesi / capacity) * 100).toFixed(1)),
        routeCategory: 'GEBZE_CROSS_DOCK',
        planStatus: 'CROSS_DOCK_BIRLESTIRME',
        loadedSegments: allocation.loadedSegments,
        delivery,
        comparison: {
          changeType: 'CROSS_DOCK_AKTARILDI',
          explanation: `${Array.from(distinctOrigins).join(' + ')} tesislerinden gelen ${destId} varışlı gönderiler Gebze Cross Dock üzerinde tek ${vehicleType} aracında birleştirildi.`,
        },
        notes: [
          `Gebze Cross Dock birleştirmesi (${Array.from(distinctOrigins).length} tesis ortak yükleme).`,
          'Bölüm 14.2: Gebze Avrupa, Marmara ve Kocaeli konsolidasyonu uygulandı.',
        ],
      });

      // Bölüm 14.2: Gebze'de ikinci araç çıkışı gerekiyorsa:
      // Kamyon: 8.500 desi seviyesinde ikinci araç değerlendirilir (en fazla 12.500 desi).
      // TIR: En az 16.500 desi seviyesinde ikinci TIR değerlendirilir (en fazla 22.500 desi).
      // İkinci araç çıkışı oluşmuyorsa paketler Ankara TM'ye sevk edilir.
      let remCandidates = allocation.remainingCandidates;
      const remTotalDesi = remCandidates.reduce((s, x) => s + x.desi, 0);

      if (remTotalDesi >= 8500) {
        const secondVehicleType: VehicleCategory =
          remTotalDesi >= 16500 && !isDestKamyonOnly ? 'TIR' : 'KAMYON';
        const secondCapacity =
          secondVehicleType === 'TIR'
            ? optParams.tirCapacityDesi
            : optParams.kamyonCapacityDesi;

        const secondAlloc = takeDesiFromCandidates(
          remCandidates,
          secondCapacity,
          'GEBZE TM'
        );

        const secondLineCode = `GBZ-CD-${String(gebzeLineCounter++).padStart(2, '0')}`;
        const secondLineId = `LINE-${secondLineCode}`;
        secondAlloc.loadedMovements.forEach((m) => {
          m.outboundVehicleLineId = secondLineId;
          gebzeMovements.push(m);
        });

        gebzeLines.push({
          id: secondLineId,
          lineCode: secondLineCode,
          originFacilityId: 'GEBZE TM',
          originFacilityName: 'GEBZE TM (Cross Dock - 2. Araç)',
          destinationFacilityId: destId,
          destinationFacilityName: destFacility?.name ?? destId,
          vehicleType: secondVehicleType,
          transportTypeLabel: 'Gebze Cross Dock (2. Araç)',
          vehicleQuotaType: 'SABIT_HAT_ARACI',
          vehicleQuotaLabel: 'Sabit Hat Aracı',
          phase1RuleTag: 'BOLUM_14_2_GEBZE_2_ARAC',
          capacityDesi: secondCapacity,
          totalDesi: secondAlloc.totalLoadedDesi,
          totalPackages: secondAlloc.totalLoadedPackages,
          fillRate: Number(
            ((secondAlloc.totalLoadedDesi / secondCapacity) * 100).toFixed(1)
          ),
          routeCategory: 'GEBZE_CROSS_DOCK',
          planStatus: 'CROSS_DOCK_BIRLESTIRME',
          loadedSegments: secondAlloc.loadedSegments,
          delivery,
          comparison: {
            changeType: 'CROSS_DOCK_AKTARILDI',
            explanation: `Bölüm 14.2: Gebze'de kalan ${remTotalDesi.toLocaleString('tr-TR')} desi, 2. araç eşiğini (Kamyon ≥ 8.500 / TIR ≥ 16.500) karşıladığından 2. ${secondVehicleType} çıkarıldı.`,
          },
          notes: [
            `Bölüm 14.2 Gebze 2. Araç Eşiği Sağlandı (${secondVehicleType}: ${secondAlloc.totalLoadedDesi.toLocaleString('tr-TR')} / ${secondCapacity.toLocaleString('tr-TR')} desi).`,
          ],
        });

        remCandidates = secondAlloc.remainingCandidates;
      }

      // Any remaining volume that does not meet the 8.500 desi second vehicle threshold goes to Ankara TM
      for (const rem of remCandidates) {
        forwardedToAnkaraCandidates.push(rem);
      }
    } else {
      // Not advantageous to consolidate at Gebze; forward directly to Ankara Cross Dock evaluation
      for (const item of group) {
        forwardedToAnkaraCandidates.push(item);
      }
    }
  }

  return {
    gebzeLines,
    gebzeMovements,
    forwardedToAnkaraCandidates,
  };
}

/**
 * Section 6: ANKARA CROSS DOCK KURALLARI
 * Consolidates remaining shipments by their exact true destination (`trueDestinationId`).
 * Enforces:
 * - Section 6.1: Merge only shipments going to the exact same destination.
 * - Section 6.2: Max 1 Kamyon (12.500) and Max 1 TIR (22.500) per destination from Ankara Cross Dock.
 * - Section 6.3: 12.500–16.000 desi rule at Ankara CD (1 Kamyon + remainder cannot loop Ankara->Ankara, so reported in pending list).
 * - Section 8: Ankara TM global max 6 TIR outbound limit (shared with Ankara's own direct TIRs), Bursa & İzmir Kamyon-only rules.
 */
export function runAnkaraCrossDockEngine(params: {
  candidates: CrossDockCandidate[];
  facilitiesMap: Record<string, Facility>;
  optParams: OptimizationParameters;
  distanceMatrix: DistanceMatrix;
  currentAnkaraOutboundTirCount: number;
}): {
  ankaraCdLines: PlannedVehicleLine[];
  ankaraMovements: CrossDockMovement[];
  unplannedShipments: UnplannedShipment[];
  updatedAnkaraOutboundTirCount: number;
  ankaraCdFixedTirUsed: number;
  ankaraCdAdditionalTirUsed: number;
  ankaraCdAdditionalTirRemaining: number;
} {
  const {
    candidates,
    facilitiesMap,
    optParams,
    distanceMatrix,
    currentAnkaraOutboundTirCount,
  } = params;

  const ankaraCdLines: PlannedVehicleLine[] = [];
  const ankaraMovements: CrossDockMovement[] = [];
  const unplannedShipments: UnplannedShipment[] = [];

  let ankaraTirUsed = currentAnkaraOutboundTirCount;
  const maxAnkaraTir = optParams.ankaraMaxOutboundTir; // 6 normal TIR limit

  // Section 13: Ankara Cross Dock TIR Hakları
  // Sabit Cross Dock TIR hakkı: 3
  // Cross Dock kaynaklı ilave TIR hakkı: 3
  // Toplam Cross Dock TIR hakkı: 6
  let cdFixedTirUsed = 0;
  let cdAdditionalTirUsed = 0;
  const maxCdFixedTir = optParams.ankaraCdFixedTirQuota ?? 3;
  const maxCdAddTir = optParams.ankaraCdAdditionalTirQuota ?? 3;
  const totalMaxCdTir = maxCdFixedTir + maxCdAddTir;

  // Group candidates by trueDestinationId
  const byDest: Record<string, CrossDockCandidate[]> = {};
  for (const c of candidates) {
    if (!byDest[c.trueDestinationId]) {
      byDest[c.trueDestinationId] = [];
    }
    byDest[c.trueDestinationId].push(c);
  }

  // Sort destinations by total consolidated desi descending so Ankara's remaining TIR quota is assigned to the largest consolidations first
  const sortedDestEntries = Object.entries(byDest).sort((a, b) => {
    const sumA = a[1].reduce((s, x) => s + x.desi, 0);
    const sumB = b[1].reduce((s, x) => s + x.desi, 0);
    return sumB - sumA;
  });

  let ankaraCdCounter = 1;

  for (const [destId, group] of sortedDestEntries) {
    const destFacility = facilitiesMap[destId];
    // Section 12 destination constraints:
    // Bursa TM, İzmir TM, Kocaeli TM, and Marmara TM (Ankara -> Marmara cannot be TIR) are strictly Kamyon only!
    const isDestKamyonOnly =
      Boolean(destFacility?.inboundKamyonOnly) ||
      destId === 'BURSA TM' ||
      destId === 'İZMİR TM' ||
      destId === 'KOCAELİ TM' ||
      destId === 'MARMARA TM';

    // Section 14: Ankara Cross Dock Tesis Birleştirme Kuralı
    // "Ankara Cross Dock'ta yalnızca Antalya TM ve Afyon TM paketleri aynı araçta birleştirilebilir.
    // Bu iki merkezin dışındaki tesislerin paketleri bunlarla aynı araçta taşınamaz; diğer merkezler ayrı araçta planlanır."
    const antalyaAfyonGroup = group.filter(
      (c) => c.sourceFacilityId === 'ANTALYA TM' || c.sourceFacilityId === 'AFYON TM'
    );
    const otherFacilitiesGroup = group.filter(
      (c) => c.sourceFacilityId !== 'ANTALYA TM' && c.sourceFacilityId !== 'AFYON TM'
    );

    const subGroups: { candidates: CrossDockCandidate[]; isAntalyaAfyonOnly: boolean }[] = [];
    if (antalyaAfyonGroup.length > 0) {
      subGroups.push({ candidates: antalyaAfyonGroup, isAntalyaAfyonOnly: true });
    }
    if (otherFacilitiesGroup.length > 0) {
      subGroups.push({ candidates: otherFacilitiesGroup, isAntalyaAfyonOnly: false });
    }

    for (const subGroup of subGroups) {
      let remainingGroup = [...subGroup.candidates];
      let totalGroupDesi = remainingGroup.reduce((s, x) => s + x.desi, 0);
      if (totalGroupDesi <= 0) continue;

      let usedKamyonForDest = 0;
      let usedTirForDest = 0;

      // 1) If totalGroupDesi > 16.000, evaluate 1 TIR
      if (totalGroupDesi > optParams.splitUpperThresholdDesi) {
        const canUseTir =
          !isDestKamyonOnly &&
          usedTirForDest < optParams.ankaraCrossDockMaxTirPerDest &&
          (cdFixedTirUsed + cdAdditionalTirUsed) < totalMaxCdTir &&
          ankaraTirUsed < maxAnkaraTir;

        if (canUseTir) {
          const tirAlloc = takeDesiFromCandidates(
            remainingGroup,
            optParams.tirCapacityDesi,
            'ANKARA TM'
          );

          const isFixed = cdFixedTirUsed < maxCdFixedTir;
          if (isFixed) {
            cdFixedTirUsed += 1;
          } else {
            cdAdditionalTirUsed += 1;
          }

          const quotaType = isFixed ? 'ANKARA_CD_SABIT_TIR' : 'ANKARA_CD_ILAVE_TIR';
          const quotaLabel = isFixed ? 'Ankara Cross Dock Sabit TIR' : 'Ankara Cross Dock İlave TIR';

          const lineCode = `ANK-CD-${String(ankaraCdCounter++).padStart(2, '0')}`;
          const lineId = `LINE-${lineCode}`;
          const representativeOrigin = tirAlloc.loadedSegments[0]?.sourceFacilityId || 'ANKARA TM';
          const delivery = calculateRouteDeliveryEstimate({
            originId: representativeOrigin,
            destinationId: destId,
            viaCrossDockId: 'ANKARA TM',
            distanceMatrix,
            crossDockHandlingHours: optParams.crossDockHandlingHours,
            departureTime: optParams.defaultDepartureTime,
          });

          tirAlloc.loadedMovements.forEach((m) => {
            m.outboundVehicleLineId = lineId;
            ankaraMovements.push(m);
          });

          const distinctSources = Array.from(
            new Set(tirAlloc.loadedSegments.map((s) => s.sourceFacilityName))
          );

          ankaraCdLines.push({
            id: lineId,
            lineCode,
            originFacilityId: 'ANKARA TM',
            originFacilityName: 'ANKARA TM (Cross Dock)',
            destinationFacilityId: destId,
            destinationFacilityName: destFacility?.name ?? destId,
            vehicleType: 'TIR',
            transportTypeLabel: 'Ankara Cross Dock',
            vehicleQuotaType: quotaType,
            vehicleQuotaLabel: quotaLabel,
            isAnkaraCdFixedTir: isFixed,
            isAnkaraCdAdditionalTir: !isFixed,
            capacityDesi: optParams.tirCapacityDesi,
            totalDesi: tirAlloc.totalLoadedDesi,
            totalPackages: tirAlloc.totalLoadedPackages,
            fillRate: Number(
              ((tirAlloc.totalLoadedDesi / optParams.tirCapacityDesi) * 100).toFixed(1)
            ),
            routeCategory: 'ANKARA_CROSS_DOCK',
            planStatus: 'CROSS_DOCK_BIRLESTIRME',
            loadedSegments: tirAlloc.loadedSegments,
            delivery,
            comparison: {
              changeType: 'CROSS_DOCK_AKTARILDI',
              explanation: subGroup.isAntalyaAfyonOnly
                ? `Ankara Cross Dock'ta Antalya TM ve Afyon TM yükleri özel birleştirme kuralıyla tek ${quotaLabel} aracında toplandı (${tirAlloc.totalLoadedDesi.toLocaleString('tr-TR')} desi).`
                : `Ankara Cross Dock'ta ${distinctSources.length} tesisten gelen ${destId} varışlı yükler (${tirAlloc.totalLoadedDesi.toLocaleString('tr-TR')} desi > 16.000) birleştirilerek 1 ${quotaLabel} oluşturuldu.`,
            },
            notes: [
              subGroup.isAntalyaAfyonOnly
                ? `Bölüm 14 Özel Birleştirme: Yalnızca Antalya TM & Afyon TM ortak yüklendi → ${destId}`
                : `Ankara Cross Dock birleştirmesi: ${distinctSources.join(', ')} → ${destId}`,
              `Araç Hakkı: ${quotaLabel}`,
            ],
          });

          usedTirForDest += 1;
          ankaraTirUsed += 1;
          remainingGroup = tirAlloc.remainingCandidates;
          totalGroupDesi = remainingGroup.reduce((s, x) => s + x.desi, 0);
        }
      }

      // 2) If there is still volume, evaluate 1 Kamyon (12.500 desi)
      if (totalGroupDesi > 0 && usedKamyonForDest < optParams.ankaraCrossDockMaxKamyonPerDest) {
        const kamyonAlloc = takeDesiFromCandidates(
          remainingGroup,
          optParams.kamyonCapacityDesi,
          'ANKARA TM'
        );

        const lineCode = `ANK-CD-${String(ankaraCdCounter++).padStart(2, '0')}`;
        const lineId = `LINE-${lineCode}`;
        const representativeOrigin = kamyonAlloc.loadedSegments[0]?.sourceFacilityId || 'ANKARA TM';
        const delivery = calculateRouteDeliveryEstimate({
          originId: representativeOrigin,
          destinationId: destId,
          viaCrossDockId: 'ANKARA TM',
          distanceMatrix,
          crossDockHandlingHours: optParams.crossDockHandlingHours,
          departureTime: optParams.defaultDepartureTime,
        });

        kamyonAlloc.loadedMovements.forEach((m) => {
          m.outboundVehicleLineId = lineId;
          ankaraMovements.push(m);
        });

        const distinctSources = Array.from(
          new Set(kamyonAlloc.loadedSegments.map((s) => s.sourceFacilityName))
        );

        ankaraCdLines.push({
          id: lineId,
          lineCode,
          originFacilityId: 'ANKARA TM',
          originFacilityName: 'ANKARA TM (Cross Dock)',
          destinationFacilityId: destId,
          destinationFacilityName: destFacility?.name ?? destId,
          vehicleType: 'KAMYON',
          transportTypeLabel: 'Ankara Cross Dock',
          vehicleQuotaType: 'SABIT_HAT_ARACI',
          vehicleQuotaLabel: 'Sabit Hat Aracı',
          capacityDesi: optParams.kamyonCapacityDesi,
          totalDesi: kamyonAlloc.totalLoadedDesi,
          totalPackages: kamyonAlloc.totalLoadedPackages,
          fillRate: Number(
            ((kamyonAlloc.totalLoadedDesi / optParams.kamyonCapacityDesi) * 100).toFixed(1)
          ),
          routeCategory: 'ANKARA_CROSS_DOCK',
          planStatus: 'CROSS_DOCK_BIRLESTIRME',
          loadedSegments: kamyonAlloc.loadedSegments,
          delivery,
          comparison: {
            changeType: 'CROSS_DOCK_AKTARILDI',
            explanation: subGroup.isAntalyaAfyonOnly
              ? `Ankara Cross Dock'ta Antalya TM ve Afyon TM gönderileri özel birleştirme kuralıyla tek Kamyon aracında toplandı.`
              : `Ankara Cross Dock'ta ${distinctSources.length} tesisten gelen ${destId} varışlı gönderiler birleştirilerek 1 Kamyon oluşturuldu.`,
          },
          notes: [
            subGroup.isAntalyaAfyonOnly
              ? `Bölüm 14 Özel Birleştirme: Yalnızca Antalya TM & Afyon TM ortak yüklendi → ${destId}`
              : `Ankara Cross Dock kamyon birleştirmesi: ${distinctSources.join(', ')} → ${destId}`,
            'Araç Hakkı: Sabit Hat Aracı',
          ],
        });

        usedKamyonForDest += 1;
        remainingGroup = kamyonAlloc.remainingCandidates;
        totalGroupDesi = remainingGroup.reduce((s, x) => s + x.desi, 0);
      }

      // 3) Leftovers:
      for (const rem of remainingGroup) {
        if (rem.desi <= 0) continue;

        const hitAnkaraGlobalTirCap =
          !isDestKamyonOnly && usedTirForDest === 0 && (cdFixedTirUsed + cdAdditionalTirUsed >= totalMaxCdTir || ankaraTirUsed >= maxAnkaraTir);

        const explanation = hitAnkaraGlobalTirCap
          ? `Ankara TM toplam TIR kotası dolduğu ve ${destId} varışı için araç sınırı tamamlandığı için kalan ${rem.desi.toLocaleString('tr-TR')} desi bekleyen gönderi listesine alındı.`
          : isDestKamyonOnly && usedTirForDest === 0
          ? `${destId} varışlı hatlarda TIR yasaklı olduğu ve 1 Kamyon (12.500 desi) sınırı dolduğu için kalan ${rem.desi.toLocaleString('tr-TR')} desi bekleyen listesine alındı.`
          : `Ankara Cross Dock ${destId} varışı için maksimum araç sınırı (en fazla 1 Kamyon + 1 TIR) ve aktarma kuralı nedeniyle kalan ${rem.desi.toLocaleString('tr-TR')} desi bekleyen gönderi listesine alındı.`;

        ankaraMovements.push({
          id: `CDM-WAIT-${rem.id}`,
          hubFacilityId: 'ANKARA TM',
          sourceFacilityId: rem.sourceFacilityId,
          sourceFacilityName: rem.sourceFacilityName,
          trueDestinationId: rem.trueDestinationId,
          trueDestinationName: rem.trueDestinationName,
          desi: rem.desi,
          packages: rem.packages,
          reasonType: rem.reasonType,
          reasonDetail: explanation,
          status: 'BEKLEYEN_KOTA_ASIMI',
        });

        unplannedShipments.push({
          id: `UNP-${rem.id}`,
          originFacilityId: rem.sourceFacilityId,
          originFacilityName: rem.sourceFacilityName,
          trueDestinationId: rem.trueDestinationId,
          trueDestinationName: rem.trueDestinationName,
          currentLocationId: 'ANKARA TM',
          desi: rem.desi,
          packages: rem.packages,
          reasonCode: hitAnkaraGlobalTirCap ? 'ANKARA_TIR_KOTASI' : 'ANKARA_CD_ARAC_SINIRI',
          explanation,
        });
      }
    }
  }

  return {
    ankaraCdLines,
    ankaraMovements,
    unplannedShipments,
    updatedAnkaraOutboundTirCount: ankaraTirUsed,
    ankaraCdFixedTirUsed: cdFixedTirUsed,
    ankaraCdAdditionalTirUsed: cdAdditionalTirUsed,
    ankaraCdAdditionalTirRemaining: Math.max(0, maxCdAddTir - cdAdditionalTirUsed),
  };
}
