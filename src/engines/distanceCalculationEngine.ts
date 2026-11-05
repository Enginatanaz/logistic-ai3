import { DeliveryEstimate, DistanceMatrix } from '../types/logistics';

/**
 * Section 9: Teslimat Süresi Hesaplama
 * Sınır değerleri kesin uygula:
 * - 0 - 600 km (600 km dahil) = 1 gün
 * - 600 km üzeri ve 1.000 km dahil = 2 gün
 * - 1.000 km üzeri = 3 gün
 *
 * Mesafe bulunmayan rotalarda kilometre uydurma; eksik mesafe uyarısı göster.
 * Direkt hat ile mesafe birbirinden bağımsızdır (örn: Ankara -> Gaziantep 740 km, direkt hat ve 2 gün).
 */
export function calculateDaysFromDistanceKm(km: number | null | undefined): number | null {
  if (km === null || km === undefined || Number.isNaN(km) || km < 0) {
    return null;
  }
  if (km <= 600) {
    return 1;
  }
  if (km <= 1000) {
    return 2;
  }
  return 3;
}

export function calculateRouteDeliveryEstimate(params: {
  originId: string;
  destinationId: string;
  viaCrossDockId?: string | null;
  viaIntermediateHubId?: string | null; // e.g. 'AFYON TM', 'ERZURUM TM', 'SAMSUN TM'
  distanceMatrix: DistanceMatrix;
  crossDockHandlingHours: number;
  departureTime: string;
  isDirectRouteConnection?: boolean;
}): DeliveryEstimate {
  const {
    originId,
    destinationId,
    viaCrossDockId,
    viaIntermediateHubId,
    distanceMatrix,
    crossDockHandlingHours,
    departureTime,
    isDirectRouteConnection = false,
  } = params;

  // Case 1: Pure Direct Route (no Cross Dock, no intermediate feeder)
  if (!viaCrossDockId && !viaIntermediateHubId) {
    const directKm = distanceMatrix[originId]?.[destinationId] ?? null;
    const directDays = calculateDaysFromDistanceKm(directKm);

    if (directKm === null || directDays === null) {
      return {
        distanceKm: null,
        directDays: null,
        crossDockAddedDays: 0,
        totalEstimatedDays: null,
        crossDockTransferHours: 0,
        waitingHours: 0,
        departureTime,
        hasMissingDistance: true,
        summaryText: 'Mesafe Eksik Uyarısı',
      };
    }

    const typeTag = isDirectRouteConnection ? 'Direkt Hat' : 'Direkt Taşıma';
    const deliveryDaysCategory: 1 | 2 | 3 = directDays >= 3 ? 3 : directDays === 2 ? 2 : 1;
    return {
      distanceKm: directKm,
      directDays,
      crossDockAddedDays: 0,
      totalEstimatedDays: directDays,
      crossDockTransferHours: 0,
      waitingHours: 2,
      departureTime,
      hasMissingDistance: false,
      summaryText: `${directDays} Gün (${directKm} km · ${typeTag})`,
      deliveryDaysCategory,
      mainLeg: {
        legName: 'Doğrudan Sevkiyat Hattı',
        fromFacilityId: originId,
        fromFacilityName: originId,
        toFacilityId: destinationId,
        toFacilityName: destinationId,
        distanceKm: directKm,
        estimatedDays: directDays,
      },
    };
  }

  // Case 2: Intermediate feeder hub (e.g., Antalya TM -> Afyon TM -> Destination, Van TM -> Erzurum TM -> Destination)
  if (viaIntermediateHubId && !viaCrossDockId) {
    const leg1Km = distanceMatrix[originId]?.[viaIntermediateHubId] ?? null;
    const leg2Km = distanceMatrix[viaIntermediateHubId]?.[destinationId] ?? null;

    if (leg1Km === null || leg2Km === null) {
      return {
        distanceKm: null,
        directDays: null,
        crossDockAddedDays: 1,
        totalEstimatedDays: null,
        crossDockTransferHours: 3,
        waitingHours: 3,
        departureTime,
        hasMissingDistance: true,
        summaryText: `Mesafe Eksik (${viaIntermediateHubId.replace(' TM', '')} Üzerinden)`,
      };
    }

    const totalKm = leg1Km + leg2Km;
    const leg1Days = calculateDaysFromDistanceKm(leg1Km) ?? 1;
    const leg2Days = calculateDaysFromDistanceKm(leg2Km) ?? 1;
    const totalEstimatedDays = Math.min(4, Math.max(leg1Days + leg2Days - 1, 2));
    const directDays = calculateDaysFromDistanceKm(distanceMatrix[originId]?.[destinationId]);
    const deliveryDaysCategory: 1 | 2 | 3 = totalEstimatedDays >= 3 ? 3 : totalEstimatedDays === 2 ? 2 : 1;

    return {
      distanceKm: totalKm,
      directDays,
      crossDockAddedDays: 1,
      totalEstimatedDays,
      crossDockTransferHours: 3,
      waitingHours: 3,
      departureTime,
      hasMissingDistance: false,
      summaryText: `${totalEstimatedDays} Gün (${totalKm} km · ${viaIntermediateHubId.replace(' TM', '')} üzerinden)`,
      deliveryDaysCategory,
      inboundLeg: {
        legName: 'Bağlı Merkez Besleme Ayağı',
        fromFacilityId: originId,
        fromFacilityName: originId,
        toFacilityId: viaIntermediateHubId,
        toFacilityName: viaIntermediateHubId,
        distanceKm: leg1Km,
        estimatedDays: leg1Days,
      },
      transferBufferHours: 3,
      mainLeg: {
        legName: 'Bağlı Merkez Ana Sevkiyat Ayağı',
        fromFacilityId: viaIntermediateHubId,
        fromFacilityName: viaIntermediateHubId,
        toFacilityId: destinationId,
        toFacilityName: destinationId,
        distanceKm: leg2Km,
        estimatedDays: leg2Days,
      },
    };
  }

  // Case 3: Cross Dock route (Ankara TM, Gebze TM, Aksaray TM, Gaziantep TM, Afyon TM)
  const hubId = viaCrossDockId!;
  const hubShortLabel = `${hubId.replace(' TM', '')} CD`;
  const hubToDestKm = distanceMatrix[hubId]?.[destinationId] ?? null;
  const leg1Km = originId === hubId ? 0 : (distanceMatrix[originId]?.[hubId] ?? null);

  if (hubToDestKm === null || (originId !== hubId && leg1Km === null)) {
    return {
      distanceKm: null,
      directDays: calculateDaysFromDistanceKm(distanceMatrix[originId]?.[destinationId]),
      crossDockAddedDays: 1,
      totalEstimatedDays: null,
      crossDockTransferHours: crossDockHandlingHours,
      waitingHours: 4,
      departureTime,
      hasMissingDistance: true,
      summaryText: `Mesafe Eksik (${hubShortLabel})`,
    };
  }

  const totalKm = (leg1Km ?? 0) + hubToDestKm;
  const baseHubDays = calculateDaysFromDistanceKm(totalKm) ?? 1;
  const crossDockAddedDays = originId === hubId ? 0 : 1;
  const totalEstimatedDays = Math.min(4, baseHubDays + crossDockAddedDays);
  const directDays = calculateDaysFromDistanceKm(distanceMatrix[originId]?.[destinationId]);
  const deliveryDaysCategory: 1 | 2 | 3 = totalEstimatedDays >= 3 ? 3 : totalEstimatedDays === 2 ? 2 : 1;

  const leg1Days = leg1Km !== null && leg1Km > 0 ? calculateDaysFromDistanceKm(leg1Km) : 0;
  const leg2Days = calculateDaysFromDistanceKm(hubToDestKm);

  return {
    distanceKm: totalKm,
    directDays,
    crossDockAddedDays,
    totalEstimatedDays,
    crossDockTransferHours: crossDockHandlingHours,
    waitingHours: 3,
    departureTime,
    hasMissingDistance: false,
    summaryText: `${totalEstimatedDays} Gün (${totalKm} km · ${hubShortLabel})`,
    deliveryDaysCategory,
    inboundLeg:
      originId !== hubId
        ? {
            legName: 'Cross Dock Giriş Ayağı (Inbound)',
            fromFacilityId: originId,
            fromFacilityName: originId,
            toFacilityId: hubId,
            toFacilityName: hubId,
            distanceKm: leg1Km,
            estimatedDays: leg1Days,
          }
        : undefined,
    transferBufferHours: crossDockHandlingHours,
    mainLeg: {
      legName: 'Cross Dock Ana Sevkiyat Ayağı (Main Outbound)',
      fromFacilityId: hubId,
      fromFacilityName: hubId,
      toFacilityId: destinationId,
      toFacilityName: destinationId,
      distanceKm: hubToDestKm,
      estimatedDays: leg2Days,
    },
  };
}
