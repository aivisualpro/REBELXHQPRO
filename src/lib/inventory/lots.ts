import dbConnect from '@/lib/mongoose';
import OpeningBalance from '@/models/OpeningBalance';
import PurchaseOrder from '@/models/PurchaseOrder';
import Manufacturing from '@/models/Manufacturing';
import AuditAdjustment from '@/models/AuditAdjustment';

export interface LotBalance {
    lotNumber: string;
    balance: number;
    cost: number;
    source: string;
    date: Date;
}

// Get available lots with positive balances for specific SKUs (FIFO order)
export async function getAvailableLotsForSkus(skuIds: string[]): Promise<Map<string, LotBalance[]>> {
    await dbConnect();
    
    // lotBalances: Map<skuId, Map<lotNumber, LotBalance>>
    const skuLotMap = new Map<string, Map<string, LotBalance>>();

    const getLotMap = (skuId: string) => {
        if (!skuLotMap.has(skuId)) {
            skuLotMap.set(skuId, new Map<string, LotBalance>());
        }
        return skuLotMap.get(skuId)!;
    };

    // 1. Opening Balances
    const obs = await OpeningBalance.find({ sku: { $in: skuIds } }).lean();
    obs.forEach((ob: any) => {
        if (ob.lotNumber && ob.sku) {
            const lotMap = getLotMap(ob.sku.toString());
            const existing = lotMap.get(ob.lotNumber);
            lotMap.set(ob.lotNumber, {
                lotNumber: ob.lotNumber,
                balance: (existing?.balance || 0) + (ob.qty || 0),
                cost: ob.cost || existing?.cost || 0,
                source: 'Opening Balance',
                date: existing?.date || ob.createdAt
            });
        }
    });

    // 2. Purchase Orders (Received)
    const pos = await PurchaseOrder.find({ 'lineItems.sku': { $in: skuIds }, status: 'Received' }).lean();
    pos.forEach((po: any) => {
        po.lineItems?.forEach((li: any) => {
            if (li.sku && skuIds.includes(li.sku.toString()) && li.lotNumber && li.qtyReceived > 0) {
                const lotMap = getLotMap(li.sku.toString());
                const existing = lotMap.get(li.lotNumber);
                lotMap.set(li.lotNumber, {
                    lotNumber: li.lotNumber,
                    balance: (existing?.balance || 0) + (li.qtyReceived || 0),
                    cost: li.cost || existing?.cost || 0,
                    source: 'Purchase Order',
                    date: existing?.date || li.receivedDate || po.createdAt
                });
            }
        });
    });

    // 3. Manufacturing (Produced)
    const mos = await Manufacturing.find({ sku: { $in: skuIds }, status: 'Completed' }).lean();
    mos.forEach((mo: any) => {
        const lot = mo.lotNumber || mo.label;
        if (mo.sku && lot) {
            const lotMap = getLotMap(mo.sku.toString());
            const existing = lotMap.get(lot);
            lotMap.set(lot, {
                lotNumber: lot,
                balance: (existing?.balance || 0) + (mo.qty || 0),
                cost: existing?.cost || 0, // COGM should be calculated elsewhere or stored
                source: 'Manufacturing',
                date: existing?.date || mo.scheduledFinish || mo.createdAt
            });
        }
    });

    // 4. Audit Adjustments
    const adjs = await AuditAdjustment.find({ sku: { $in: skuIds } }).lean();
    adjs.forEach((adj: any) => {
        if (adj.lotNumber && adj.sku) {
            const lotMap = getLotMap(adj.sku.toString());
            const existing = lotMap.get(adj.lotNumber);
            lotMap.set(adj.lotNumber, {
                lotNumber: adj.lotNumber,
                balance: (existing?.balance || 0) + (adj.qty || 0),
                cost: adj.cost || existing?.cost || 0,
                source: existing?.source || 'Audit',
                date: existing?.date || adj.createdAt
            });
        }
    });

    // Convert Maps to sorted Arrays
    const result = new Map<string, LotBalance[]>();
    for (const [skuId, lotMap] of skuLotMap.entries()) {
        const lots = Array.from(lotMap.values())
            .filter(l => l.balance > 0)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        result.set(skuId, lots);
    }

    return result;
}

export async function getAvailableLots(skuId: string): Promise<LotBalance[]> {
    const map = await getAvailableLotsForSkus([skuId]);
    return map.get(skuId) || [];
}
