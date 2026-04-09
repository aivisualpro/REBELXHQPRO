import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const shop = searchParams.get('shop') || 'grhkratom.myshopify.com';

    const clientId = process.env.SHOPIFY_API_KEY || 'YOUR_SHOPIFY_CLIENT_ID';
    const clientSecret = process.env.SHOPIFY_API_SECRET || 'YOUR_SHOPIFY_CLIENT_SECRET';

    // 1. Initial Visit -> Redirect to Shopify Auth Check
    if (!code) {
        // ADDED: read_orders, read_all_orders
        const scopes = 'read_products,write_products,read_orders,read_all_orders';
        const redirectUri = `https://www.rebelxbrandscrm.com/api/debug/shopify-auth`;
        const authUrl = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${redirectUri}&state=nonce123`;
        
        return NextResponse.redirect(authUrl);
    }

    // 2. Callback Visit -> Exchange code for permanent token
    try {
        const tokenRes = await fetch(`https://${shop}/admin/oauth/access_token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                client_id: clientId,
                client_secret: clientSecret,
                code
            })
        });

        const data = await tokenRes.json();

        return NextResponse.json({
            success: true,
            message: "NEW TOKEN GENERATED! Copy the access_token below into your .env.local as GRHKTATOM_SHOPIFY_ACCESS_TOKEN and in your Vercel environment variables.",
            access_token: data.access_token,
            scope: data.scope,
            shop
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
