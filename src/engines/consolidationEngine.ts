/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { ConsolidationRules } from './phase1OperationalRulesEngine';

/**
 * consolidationEngine.ts
 * Cross Dock ve ara hat birleştirme (konsolidasyon) kurallarını yöneten bağımsız motor.
 * 
 * Temel Prensipler (Bölüm 6):
 * - Ankara Cross Dock: Yalnızca Antalya ve Afyon paketleri aynı araçta birleştirilebilir.
 * - Gebze Cross Dock: Avrupa, Marmara ve Kocaeli çıkışlı paketler Adana, Gaziantep, Diyarbakır, Erzurum, Samsun için konsolide edilir.
 * - Aksaray Cross Dock: Adana, Kayseri ve Konya arasındaki özel üçgen konsolidasyonu.
 * - Samsun TM: Samsun -> Marmara kamyonuna yer varsa Kocaeli ve Avrupa eklenebilir.
 * - Gaziantep TM: Diyarbakır + Gaziantep ortak Avrupa TIR'ı ve güneydoğu araçları.
 */

export function canCoLoadAtAnkaraCrossDock(sourceFacilityA: string, sourceFacilityB: string): boolean {
  return ConsolidationRules.canCoLoadAtAnkaraCrossDock(sourceFacilityA, sourceFacilityB);
}

export function isSamsunMarmaraCoLoadable(destinationFacilityId: string): boolean {
  return ConsolidationRules.samsunMarmaraCoLoadableDestinations.includes(destinationFacilityId);
}

export function isBursaJointSoutheastEligible(destinationFacilityId: string): boolean {
  return ConsolidationRules.bursaSoutheastJointDestinations.includes(destinationFacilityId);
}

export const ConsolidationEngine = {
  canCoLoadAtAnkaraCrossDock,
  isSamsunMarmaraCoLoadable,
  isBursaJointSoutheastEligible,
};
