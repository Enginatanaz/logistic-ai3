import { Facility, MatrixData, ShipmentCell } from '../types/logistics';

export interface MatrixTotalsSummary {
  rowPackageTotals: Record<string, number>;
  colPackageTotals: Record<string, number>;
  rowDesiTotals: Record<string, number>;
  colDesiTotals: Record<string, number>;
  grandTotalPackages: number;
  grandTotalDesi: number;
  intercityDesi: number;
  selfRouteDesi: number;
  effectiveDesiPerPackage: number;
}

/**
 * Returns only active non-Cross-Dock-Only facilities (the 19 operational facilities + any user-added normal facilities).
 * Gebze TM is strictly excluded from standard origin/destination shipment rows.
 */
export function getStandardMatrixFacilities(facilities: Facility[]): Facility[] {
  return facilities.filter((f) => f.isActive && !f.isCrossDockOnly);
}

/**
 * Calculates row, column, and grand totals for both package and desi matrices.
 */
export function calculateMatrixTotals(
  facilities: Facility[],
  packageMatrix: MatrixData,
  desiMatrix: MatrixData
): MatrixTotalsSummary {
  const activeFacilities = getStandardMatrixFacilities(facilities);
  const rowPackageTotals: Record<string, number> = {};
  const colPackageTotals: Record<string, number> = {};
  const rowDesiTotals: Record<string, number> = {};
  const colDesiTotals: Record<string, number> = {};

  let grandTotalPackages = 0;
  let grandTotalDesi = 0;
  let intercityDesi = 0;
  let selfRouteDesi = 0;

  for (const f of activeFacilities) {
    rowPackageTotals[f.id] = 0;
    colPackageTotals[f.id] = 0;
    rowDesiTotals[f.id] = 0;
    colDesiTotals[f.id] = 0;
  }

  for (const origin of activeFacilities) {
    for (const dest of activeFacilities) {
      const pkg = Math.max(0, Math.round(packageMatrix[origin.id]?.[dest.id] ?? 0));
      const desi = Math.max(0, Math.round(desiMatrix[origin.id]?.[dest.id] ?? 0));

      rowPackageTotals[origin.id] = (rowPackageTotals[origin.id] ?? 0) + pkg;
      colPackageTotals[dest.id] = (colPackageTotals[dest.id] ?? 0) + pkg;
      rowDesiTotals[origin.id] = (rowDesiTotals[origin.id] ?? 0) + desi;
      colDesiTotals[dest.id] = (colDesiTotals[dest.id] ?? 0) + desi;

      grandTotalPackages += pkg;
      grandTotalDesi += desi;

      if (origin.id === dest.id) {
        selfRouteDesi += desi;
      } else {
        intercityDesi += desi;
      }
    }
  }

  const effectiveDesiPerPackage =
    grandTotalPackages > 0 ? Number((grandTotalDesi / grandTotalPackages).toFixed(3)) : 4;

  return {
    rowPackageTotals,
    colPackageTotals,
    rowDesiTotals,
    colDesiTotals,
    grandTotalPackages,
    grandTotalDesi,
    intercityDesi,
    selfRouteDesi,
    effectiveDesiPerPackage,
  };
}

/**
 * Re-computes the Package and Desi matrices from the Three-Volume Shared Coefficient Model
 * ("Üç Hacim Ortak Katsayı Modeli") when the user changes total estimated packages or global desi multiplier.
 * If targetTotalPackages === 650000 and desiMultiplierScale === 1, it reproduces the exact reference Excel integers.
 */
export function recalculateMatricesFromCoefficients(params: {
  facilities: Facility[];
  targetTotalPackages: number;
  packageShareMatrix: MatrixData;
  desiPerPackageMatrix: MatrixData;
  desiScaleFactor?: number;
}): { packageMatrix: MatrixData; desiMatrix: MatrixData } {
  const {
    facilities,
    targetTotalPackages,
    packageShareMatrix,
    desiPerPackageMatrix,
    desiScaleFactor = 1,
  } = params;

  const activeFacilities = getStandardMatrixFacilities(facilities);
  const packageMatrix: MatrixData = {};
  const desiMatrix: MatrixData = {};

  for (const origin of activeFacilities) {
    packageMatrix[origin.id] = {};
    desiMatrix[origin.id] = {};
    for (const dest of activeFacilities) {
      const coeff = packageShareMatrix[origin.id]?.[dest.id] ?? 0;
      const cellDesiPerPkg = desiPerPackageMatrix[origin.id]?.[dest.id] ?? 4;
      const pkg = Math.max(0, Math.round(targetTotalPackages * coeff));
      const desi = Math.max(0, Math.round(pkg * cellDesiPerPkg * desiScaleFactor));
      packageMatrix[origin.id][dest.id] = pkg;
      desiMatrix[origin.id][dest.id] = desi;
    }
  }

  return { packageMatrix, desiMatrix };
}

/**
 * Extracts flat list of non-zero ShipmentCells for the optimization engine.
 */
export function extractActiveShipmentCells(
  facilities: Facility[],
  packageMatrix: MatrixData,
  desiMatrix: MatrixData,
  packageShareMatrix: MatrixData,
  desiPerPackageMatrix: MatrixData
): ShipmentCell[] {
  const activeFacilities = getStandardMatrixFacilities(facilities);
  const cells: ShipmentCell[] = [];

  for (const origin of activeFacilities) {
    for (const dest of activeFacilities) {
      const desi = Math.max(0, Math.round(desiMatrix[origin.id]?.[dest.id] ?? 0));
      const packages = Math.max(0, Math.round(packageMatrix[origin.id]?.[dest.id] ?? 0));
      if (desi <= 0 && packages <= 0) continue;

      cells.push({
        originId: origin.id,
        destinationId: dest.id,
        packages: packages > 0 ? packages : Math.max(1, Math.round(desi / 4)),
        desi,
        packageCoefficient: packageShareMatrix[origin.id]?.[dest.id] ?? 0,
        desiPerPackageRatio: desiPerPackageMatrix[origin.id]?.[dest.id] ?? 4,
      });
    }
  }

  return cells;
}
