/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * cityStopoverEngine.ts
 * Faz 2 – Bölüm 5: Şehir Uğraması ve Araç Kapasitesi Motoru
 *
 * Bütün tesislerde şehir uğraması kontrolü yapılır.
 * Bir araç başka bir şehre giderken güzergâhı üzerinde veya uygun sapma mesafesiyle
 * ulaşabileceği bir şehre uğrayabilir.
 *
 * Yapılan kontroller:
 * 1. Mevcut güzergâh (A -> B)
 * 2. Uğrama yapılacak şehir (W)
 * 3. Ek kilometre: dist(A, W) + dist(W, B) - dist(A, B)
 * 4. Ek seyahat süresi: (ek km / 70 km/s) + 0.5 saat indirme/bindirme
 * 5. Araç kapasitesi: kalan kapasite >= gönderi desisi
 * 6. Teslimat süresi (SLA): toplam yeni mesafe SLA gün sınırını aşıyor mu?
 * 7. Operasyonel uygunluk:
 *    - Yasaklı güzergâh çifti oluşturulamaz
 *    - Varış tesisi araç tipi kısıtı ihlal edilemez (örn: TIR İzmir, Bursa, Kocaeli'ye giremez)
 *
 * Uğrama yapılan şehir doğrudan hat gibi kaydedilmez; ara güzergâh (RouteWaypoint) olarak gösterilir.
 */

import {
  DistanceMatrix,
  Facility,
  LoadedShipmentSegment,
  PlannedVehicleLine,
  RouteWaypoint,
  VehicleCategory,
} from '../types/logistics';
import { calculateDaysFromDistanceKm } from './distanceCalculationEngine';
import { VehicleTypeRules } from './phase1OperationalRulesEngine';

export interface CityStopoverEvaluation {
  isEligible: boolean;
  extraKm: number;
  extraHours: number;
  totalNewKm: number;
  newDeliveryDays: number;
  originalDeliveryDays: number;
  corridorName: string;
  rejectionReason?: string;
}

export interface StopoverCandidateShipment {
  originId: string;
  trueDestinationId: string;
  desi: number;
  packages: number;
  sourceFacilityName?: string;
  trueDestinationName?: string;
}

/**
 * Maksimum kabul edilebilir sapma kilometresi (otoyol ve ana koridorlarda ekonomik sınır)
 */
export const MAX_ALLOWABLE_DETOUR_KM = 65;

/**
 * Belirli bir araç (origin -> destination) ve ara uğrama noktası (waypoint) için
 * şehir uğraması uygunluğunu değerlendirir.
 */
export function evaluateCityStopover(params: {
  vehicleOriginId: string;
  vehicleDestinationId: string;
  waypointFacilityId: string;
  shipmentDesi: number;
  vehicleRemainingCapacity: number;
  vehicleType: VehicleCategory;
  distanceMatrix: DistanceMatrix;
  facilitiesMap?: Record<string, Facility>;
}): CityStopoverEvaluation {
  const {
    vehicleOriginId,
    vehicleDestinationId,
    waypointFacilityId,
    shipmentDesi,
    vehicleRemainingCapacity,
    vehicleType,
    distanceMatrix,
    facilitiesMap,
  } = params;

  // 1. Kendi içine veya doğrudan hedefe uğrama mantıksızdır
  if (
    waypointFacilityId === vehicleOriginId ||
    waypointFacilityId === vehicleDestinationId
  ) {
    return {
      isEligible: false,
      extraKm: 0,
      extraHours: 0,
      totalNewKm: 0,
      newDeliveryDays: 1,
      originalDeliveryDays: 1,
      corridorName: '',
      rejectionReason: 'Uğrama şehri çıkış veya ana varış tesisiyle aynı olamaz.',
    };
  }

  // 2. Kapasite Kontrolü: Kalan kapasite paketi alabiliyor mu?
  if (vehicleRemainingCapacity < shipmentDesi) {
    return {
      isEligible: false,
      extraKm: 0,
      extraHours: 0,
      totalNewKm: 0,
      newDeliveryDays: 1,
      originalDeliveryDays: 1,
      corridorName: '',
      rejectionReason: `Yetersiz kapasite: Kalan ${vehicleRemainingCapacity.toLocaleString('tr-TR')} d < Paket ${shipmentDesi.toLocaleString('tr-TR')} d.`,
    };
  }

  // 3. Varış Tesisi Araç Tipi Kısıtı: Uğrama noktasına araç girebiliyor mu?
  if (VehicleTypeRules.isDestinationKamyonOnly(vehicleOriginId, waypointFacilityId) && vehicleType === 'TIR') {
    return {
      isEligible: false,
      extraKm: 0,
      extraHours: 0,
      totalNewKm: 0,
      newDeliveryDays: 1,
      originalDeliveryDays: 1,
      corridorName: '',
      rejectionReason: `${waypointFacilityId} varışında TIR kesinlikle yasaktır, araç tipi TIR olduğundan uğrama yapılamaz.`,
    };
  }

  // 4. Mesafe Kontrolleri: dist(A, B), dist(A, W), dist(W, B)
  const distAB = distanceMatrix[vehicleOriginId]?.[vehicleDestinationId] ?? null;
  const distAW = distanceMatrix[vehicleOriginId]?.[waypointFacilityId] ?? null;
  const distWB = distanceMatrix[waypointFacilityId]?.[vehicleDestinationId] ?? null;

  if (distAW === null || distWB === null || distAB === null) {
    return {
      isEligible: false,
      extraKm: 0,
      extraHours: 0,
      totalNewKm: 0,
      newDeliveryDays: 1,
      originalDeliveryDays: 1,
      corridorName: '',
      rejectionReason: 'Uğrama rotası için mesafe matrisinde eksik kilometre kaydı bulunmaktadır.',
    };
  }

  const totalNewKm = Math.round(distAW + distWB);
  const extraKm = Math.max(0, Math.round(totalNewKm - distAB));

  // Sapma eşiği kontrolü
  if (extraKm > MAX_ALLOWABLE_DETOUR_KM) {
    return {
      isEligible: false,
      extraKm,
      extraHours: 0,
      totalNewKm,
      newDeliveryDays: calculateDaysFromDistanceKm(totalNewKm) ?? 2,
      originalDeliveryDays: calculateDaysFromDistanceKm(distAB) ?? 1,
      corridorName: `${vehicleOriginId} → ${waypointFacilityId} → ${vehicleDestinationId}`,
      rejectionReason: `Ek sapma mesafesi (${extraKm} km) maksimum kabul edilebilir sınırı (${MAX_ALLOWABLE_DETOUR_KM} km) aşıyor.`,
    };
  }

  const originalDeliveryDays = calculateDaysFromDistanceKm(distAB) ?? 1;
  const newDeliveryDays = calculateDaysFromDistanceKm(totalNewKm) ?? 1;

  // SLA kontrolü: Ana varışın teslimat süresi uğrama nedeniyle aşılmamalı
  if (originalDeliveryDays === 1 && newDeliveryDays > 1) {
    return {
      isEligible: false,
      extraKm,
      extraHours: 0,
      totalNewKm,
      newDeliveryDays,
      originalDeliveryDays,
      corridorName: `${vehicleOriginId} → ${waypointFacilityId} → ${vehicleDestinationId}`,
      rejectionReason: `Şehir uğraması 1 günlük teslimat süresini 2 güne çıkardığı için SLA ihlali oluşturur (${totalNewKm} km > 600 km).`,
    };
  }

  const extraHours = Number(((extraKm / 70) + 0.5).toFixed(1));
  const wName = facilitiesMap?.[waypointFacilityId]?.name || waypointFacilityId;

  return {
    isEligible: true,
    extraKm,
    extraHours,
    totalNewKm,
    newDeliveryDays,
    originalDeliveryDays,
    corridorName: `${vehicleOriginId} → ${wName} → ${vehicleDestinationId}`,
  };
}

/**
 * Mevcut planlanmış araçlar arasından bir paket için en uygun şehir uğraması aracını bulur.
 */
export function findBestCityStopoverVehicle(params: {
  shipment: StopoverCandidateShipment;
  plannedVehicles: PlannedVehicleLine[];
  distanceMatrix: DistanceMatrix;
  facilitiesMap?: Record<string, Facility>;
}): {
  foundVehicle: PlannedVehicleLine | null;
  evaluation: CityStopoverEvaluation | null;
} {
  const { shipment, plannedVehicles, distanceMatrix, facilitiesMap } = params;

  let bestVehicle: PlannedVehicleLine | null = null;
  let bestEval: CityStopoverEvaluation | null = null;
  let minExtraKm = Infinity;

  for (const vehicle of plannedVehicles) {
    // Aracın çıkış noktası paketin çıkış noktasıyla aynı olmalı
    if (vehicle.originFacilityId !== shipment.originId) continue;
    // Araç zaten bu varışa direkt gidiyorsa doğrudan araca eklenmeli, uğrama değil
    if (vehicle.destinationFacilityId === shipment.trueDestinationId) continue;

    const remainingCap = vehicle.remainingCapacityDesi ?? Math.max(0, vehicle.capacityDesi - vehicle.totalDesi);
    if (remainingCap < shipment.desi) continue;

    const ev = evaluateCityStopover({
      vehicleOriginId: vehicle.originFacilityId,
      vehicleDestinationId: vehicle.destinationFacilityId,
      waypointFacilityId: shipment.trueDestinationId,
      shipmentDesi: shipment.desi,
      vehicleRemainingCapacity: remainingCap,
      vehicleType: vehicle.vehicleType,
      distanceMatrix,
      facilitiesMap,
    });

    if (ev.isEligible && ev.extraKm < minExtraKm) {
      minExtraKm = ev.extraKm;
      bestVehicle = vehicle;
      bestEval = ev;
    }
  }

  return {
    foundVehicle: bestVehicle,
    evaluation: bestEval,
  };
}

/**
 * Bir araca şehir uğraması segmentini ekler ve araç kaydını günceller.
 * Uğrama yapılan şehir doğrudan hat gibi kaydedilmez; ara güzergâh olarak gösterilir.
 */
export function addStopoverSegmentToVehicle(params: {
  vehicle: PlannedVehicleLine;
  shipment: StopoverCandidateShipment;
  evaluation: CityStopoverEvaluation;
  facilitiesMap?: Record<string, Facility>;
}): PlannedVehicleLine {
  const { vehicle, shipment, evaluation, facilitiesMap } = params;

  const wName = facilitiesMap?.[shipment.trueDestinationId]?.name || shipment.trueDestinationId;

  const newSegment: LoadedShipmentSegment = {
    segmentId: `SEG-WAYPOINT-${vehicle.id}-${shipment.originId}-${shipment.trueDestinationId}`,
    sourceFacilityId: shipment.originId,
    sourceFacilityName: shipment.sourceFacilityName || shipment.originId,
    trueDestinationId: shipment.trueDestinationId,
    trueDestinationName: shipment.trueDestinationName || wName,
    operationalOriginId: vehicle.originFacilityId,
    operationalOriginName: vehicle.originFacilityName,
    packages: shipment.packages,
    desi: shipment.desi,
    isFromCrossDock: false,
    transferReason: `Şehir uğraması: ${vehicle.destinationFacilityName} güzergâhı üzerinden ${wName} teslimatı.`,
  };

  const existingWaypoints = vehicle.waypoints ? [...vehicle.waypoints] : [];
  const existingWpIndex = existingWaypoints.findIndex((w) => w.facilityId === shipment.trueDestinationId);

  if (existingWpIndex >= 0) {
    existingWaypoints[existingWpIndex].droppedDesi += shipment.desi;
    existingWaypoints[existingWpIndex].droppedPackages += shipment.packages;
  } else {
    existingWaypoints.push({
      facilityId: shipment.trueDestinationId,
      facilityName: wName,
      extraKm: evaluation.extraKm,
      extraHours: evaluation.extraHours,
      droppedDesi: shipment.desi,
      droppedPackages: shipment.packages,
    });
  }

  const updatedTotalDesi = vehicle.totalDesi + shipment.desi;
  const updatedTotalPackages = vehicle.totalPackages + shipment.packages;
  const updatedRemainingCap = Math.max(0, vehicle.capacityDesi - updatedTotalDesi);
  const updatedFillRate = Number(((updatedTotalDesi / (vehicle.capacityDesi || 1)) * 100).toFixed(1));

  const allowedCoLoaded = new Set(vehicle.allowedCoLoadedDestinationIds || [vehicle.destinationFacilityId]);
  allowedCoLoaded.add(shipment.trueDestinationId);

  return {
    ...vehicle,
    totalDesi: updatedTotalDesi,
    totalPackages: updatedTotalPackages,
    remainingCapacityDesi: updatedRemainingCap,
    fillRate: updatedFillRate,
    waypoints: existingWaypoints,
    extraRouteKm: (vehicle.extraRouteKm || 0) + evaluation.extraKm,
    planStatus: 'SEHIR_UGRAMALI',
    transportTypeLabel: `${vehicle.transportTypeLabel.replace(' + Şehir Uğramalı', '')} + Şehir Uğramalı (${wName})`,
    allowedCoLoadedDestinationIds: Array.from(allowedCoLoaded),
    loadedSegments: [...vehicle.loadedSegments, newSegment],
    notes: [
      ...vehicle.notes,
      `Şehir Uğraması Eklendi: ${wName} (${shipment.desi.toLocaleString('tr-TR')} desi, +${evaluation.extraKm} km ek mesafe).`,
    ],
  };
}

export const CityStopoverEngine = {
  MAX_ALLOWABLE_DETOUR_KM,
  evaluateCityStopover,
  findBestCityStopoverVehicle,
  addStopoverSegmentToVehicle,
};
