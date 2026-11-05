/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * facilityScheduleEngine.ts
 * Tesislerin operasyonel çalışma saatlerini ve araç çıkış takvimlerini yöneten motor.
 * 
 * Çalışma Düzeni (Bölüm 2):
 * 1. Normal Tesisler: Operasyona 16:00'da başlar, 22:00'da araç çıkışlarını tamamlar.
 * 2. Ankara TM: 24 saat çalışır.
 *    - Akşam sabit araç operasyonu (22:00 çıkış)
 *    - Gece Cross Dock operasyonu (Gelen araçların boşaltılması, ayrıştırılması, gece araçlarına yüklenmesi)
 * 3. Gebze TM: Gece operasyonu yürütür ve sabah 08:00'e kadar çalışır.
 *    - Gebze Cross Dock'a gelen araçların boşaltılması, ayrıştırılması ve konsolidasyonu gece boyunca devam eder.
 *    - Avrupa, Marmara ve Kocaeli besleme araçları bu takvime göre planlanır.
 */

export interface FacilityScheduleConfig {
  facilityId: string;
  facilityName: string;
  is24Hours: boolean;
  operationStartTime: string;
  operationEndTime: string;
  defaultDepartureTime: string;
  notes: string;
}

export const FACILITY_SCHEDULES: Record<string, FacilityScheduleConfig> = {
  'ANKARA TM': {
    facilityId: 'ANKARA TM',
    facilityName: 'Ankara TM',
    is24Hours: true,
    operationStartTime: '00:00',
    operationEndTime: '23:59',
    defaultDepartureTime: '22:00',
    notes: '24 saat kesintisiz operasyon. Akşam sabit araçlar 22:00, gece Cross Dock araçları 03:00 - 05:00 arasında çıkar.',
  },
  'GEBZE TM': {
    facilityId: 'GEBZE TM',
    facilityName: 'Gebze TM',
    is24Hours: false,
    operationStartTime: '22:00',
    operationEndTime: '08:00',
    defaultDepartureTime: '06:00',
    notes: 'Gece Cross Dock operasyon merkezi. Sabah 08:00’e kadar araç boşaltma, ayrıştırma ve konsolidasyon devam eder.',
  },
};

export function getFacilitySchedule(facilityId: string): FacilityScheduleConfig {
  if (FACILITY_SCHEDULES[facilityId]) {
    return FACILITY_SCHEDULES[facilityId];
  }
  return {
    facilityId,
    facilityName: facilityId,
    is24Hours: false,
    operationStartTime: '16:00',
    operationEndTime: '22:00',
    defaultDepartureTime: '22:00',
    notes: 'Standart operasyon takvimi: 16:00 toplama başlangıcı, 22:00 araç çıkışı.',
  };
}

export const FacilityScheduleEngine = {
  getFacilitySchedule,
  FACILITY_SCHEDULES,
};
