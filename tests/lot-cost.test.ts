/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import { calculateJobCostPerUnit, durationToHours } from '@/lib/lot-cost';

describe('durationToHours', () => {
    it('converts HH:MM:SS format to hours', () => {
        expect(durationToHours('01:30:00')).toBeCloseTo(1.5);
        expect(durationToHours('00:45:00')).toBeCloseTo(0.75);
    });

    it('converts HH:MM format to hours', () => {
        expect(durationToHours('02:15')).toBeCloseTo(2.25);
    });

    it('handles empty strings', () => {
        expect(durationToHours('')).toBe(0);
    });
});

describe('calculateJobCostPerUnit', () => {
    it('returns 0 when no qty produced', () => {
        const job = { qty: 0, qtyDifference: 0, totalCost: 100 };
        expect(calculateJobCostPerUnit(job)).toBe(0);
    });

    it('uses totalCost if available', () => {
        const job = { qty: 10, qtyDifference: 0, totalCost: 50 };
        expect(calculateJobCostPerUnit(job)).toBe(5);
    });

    it('calculates cost from components (materials, labor, packaging)', () => {
        const job = {
            qty: 100,
            qtyDifference: 0,
            packagingCost: 50,
            lineItems: [
                { sku: 'sku1', recipeQty: 2, qtyExtra: 10, qtyScrapped: 0, obCost: 1.5, poCost: 0 }
            ], // consumed: (2 * 100) + 10 = 210. 210 * 1.5 = 315
            labor: [
                { duration: '02:00', hourlyRate: 20 }
            ] // labor cost: 2 * 20 = 40
        };
        // total cost = 315 (mat) + 40 (labor) + 50 (pkg) = 405
        // qty = 100
        // cost per unit = 4.05
        
        expect(calculateJobCostPerUnit(job)).toBeCloseTo(4.05);
    });
});
