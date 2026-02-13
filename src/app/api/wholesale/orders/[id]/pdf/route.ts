import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import SaleOrder from '@/models/SaleOrder';
import { generatePdfFromTemplate } from '@/lib/google-docs';

export const dynamic = 'force-dynamic';

const TEMPLATE_ID = '1wAtench6ZMQOyaBiQvfxuVMgkBMBSc0lLnRp5g4Cv1Y';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        await dbConnect();
        const { id } = await context.params;

        // Fetch the sale order with populated refs
        const order = await SaleOrder.findById(id)
            .populate('clientId', 'name addresses')
            .populate('lineItems.sku', 'name')
            .lean() as any;

        if (!order) {
            return NextResponse.json({ error: 'Order not found' }, { status: 404 });
        }

        // Build shipping address string
        const shippingAddr = [
            order.shippingAddress,
            order.city,
            order.state
        ].filter(Boolean).join(', ');

        // Format date
        const formatDate = (d: any) => {
            if (!d) return '-';
            return new Date(d).toLocaleDateString('en-US', { 
                month: '2-digit', day: '2-digit', year: 'numeric' 
            });
        };

        // Format currency
        const formatCurrency = (val: number) => {
            return '$' + (val || 0).toLocaleString(undefined, { 
                minimumFractionDigits: 2, maximumFractionDigits: 2 
            });
        };

        // Get client name
        const clientName = typeof order.clientId === 'object' && order.clientId
            ? order.clientId.name || ''
            : '';

        // Get sales rep name
        const salesRepName = order.salesRep || '';

        // Simple replacements (header fields)
        const replacements: Record<string, string> = {
            '{{label}}': order.label || '',
            '{{date}}': formatDate(order.createdAt),
            '{{clientId.name}}': clientName,
            '{{shippingAddress}}': shippingAddr || '-',
            '{{salesRep.name}}': salesRepName,
            '{{paymentMethod}}': order.paymentMethod || '-',
            '{{shippingMethod}}': order.shippingMethod || '-',
            '{{shippingDate}}': formatDate(order.shippedDate),
        };

        // Line item rows
        const tableRows = (order.lineItems || []).map((item: any) => {
            const skuName = typeof item.sku === 'object' && item.sku 
                ? item.sku.name || '' 
                : '';
            return {
                '{{lineItems.sku.name}}': skuName,
                '{{lineItems.productDescription}}': item.productDescription || '',
                '{{lineItems.lotNumber}}': item.lotNumber || '',
                '{{lineItems.qtyShipped}}': String(item.qtyShipped || 0),
                '{{lineItems.uom}}': item.uom || '',
                '{{lineItems.price}}': formatCurrency(item.price || 0),
                '{{lineItems.total}}': formatCurrency((item.qtyShipped || 0) * (item.price || 0)),
            };
        });

        const pdfBuffer = await generatePdfFromTemplate(TEMPLATE_ID, replacements, tableRows);

        // Return PDF with proper headers
        const fileName = `${order.label || 'SaleOrder'}.pdf`;
        return new NextResponse(new Uint8Array(pdfBuffer), {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition': `attachment; filename="${fileName}"`,
                'Content-Length': String(pdfBuffer.length),
            },
        });
    } catch (error: any) {
        console.error('Error generating sale order PDF:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to generate PDF' },
            { status: 500 }
        );
    }
}
