
import { NextResponse } from 'next/server';
import OpenAI from "openai";

const groq = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    let context, prompt;
    
    try {
        const body = await req.json();
        context = body.context;
        prompt = body.prompt; 
    } catch (e) {
        return NextResponse.json({ text: "Invalid request body." }, { status: 400 });
    }

    const systemPrompt = `You are the "Neural Board" for RebelX HQ Pro.
    You consist of 6 Agents, each providing a critical specific insight:
    1. SALES DIRECTOR (Revenue trends, Top Products)
    2. CFO (Profit, Margins, Spend analysis)
    3. MARKETING LEAD (Web Orders vs Manual, Client Growth)
    4. OPS CO-PILOT (Efficiency, Ticket bottlenecks)
    5. INVENTORY MANAGER (Low stock alerts, Stock velocity)
    6. WORKFORCE ANALYST (Employee performance, Team retention)

    Context:
    ${JSON.stringify(context, null, 2)}

    Instructions:
    - You must offer specific strategic insights based on the numbers.
    - If the user provides a specific prompt, answer it directly as the "CEO".
    
    CRITICAL: If the user prompt is "GENERATE_DASHBOARD_INSIGHTS", you must return a VALID JSON object (no markdown formatting) with this exact structure:
    {
        "cards": [
            {
                "role": "Sales Director",
                "title": "Revenue Signal",
                "insight": "...",
                "status": "positive" | "warning" | "neutral"
            },
            {
                "role": "CFO",
                "title": "Capital Efficiency",
                "insight": "...",
                "status": "positive" | "warning" | "neutral"
            },
            {
                "role": "Marketing Lead",
                "title": "Customer Pulse",
                "insight": "...",
                "status": "positive" | "warning" | "neutral"
            },
             {
                "role": "Ops Co-Pilot",
                "title": "Operational Load",
                "insight": "...",
                "status": "positive" | "warning" | "neutral"
            },
            {
                "role": "Inventory Manager",
                "title": "Stock Health",
                "insight": "...",
                "status": "positive" | "warning" | "neutral"
            },
             {
                "role": "Workforce Analyst",
                "title": "Team Performance",
                "insight": "...",
                "status": "positive" | "warning" | "neutral"
            }
        ]
    }
    `;

    const userPrompt = prompt || "GENERATE_DASHBOARD_INSIGHTS";

    try {
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile", // Using a powerful Groq model
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.6,
            max_tokens: 1024,
            response_format: { type: "json_object" }
        });

        const content = completion.choices[0]?.message?.content;
        
        if (content) {
            if (userPrompt === "GENERATE_DASHBOARD_INSIGHTS") {
                try {
                    const json = JSON.parse(content);
                    return NextResponse.json(json);
                } catch (e) {
                     return NextResponse.json({ 
                         text: content,
                         isRaw: true
                     });
                }
            }
            return NextResponse.json({ text: content });
        }
        
    } catch (error: any) {
        console.error("Groq AI Error:", error);
        return NextResponse.json(
            { text: `My neural link is unstable. (Error: ${error.message})` },
            { status: 500 }
        );
    }

    return NextResponse.json(
        { text: "No response generated." },
        { status: 500 }
    );
}
