import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const shop = searchParams.get('shop') || 'grhkratom.myshopify.com';

    const clientId = process.env.SHOPIFY_API_KEY || 'YOUR_SHOPIFY_CLIENT_ID';
    const clientSecret = process.env.SHOPIFY_API_SECRET || 'YOUR_SHOPIFY_CLIENT_SECRET';

    // 1. Initial Visit -> Redirect to Shopify Auth Check
    if (!code) {
        const scopes = 'read_products,write_products,read_orders,read_all_orders';
        const redirectUri = `https://www.rebelxbrandscrm.com/api/debug/shopify-auth`;
        const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=nonce123`;
        
        return NextResponse.redirect(authUrl);
    }

    // 2. Callback Visit -> Exchange code for permanent token
    let rawText = '';
    try {
        const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json' 
            },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code
            })
        });

        rawText = await tokenRes.text(); // Grab raw text first to avoid JSON parse crashes!
        return NextResponse.json(JSON.parse(rawText));

    } catch (err: any) {
        // Return exactly what the Shopify server spat back out so we can debug it
        return NextResponse.json({ 
            error: "Failed to parse Shopify response", 
            statusCodeText: err.message, 
            rawShopifyResponse: rawText 
        }, { status: 500 });
    }
}
