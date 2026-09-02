const Groq = require("groq-sdk");
require("dotenv").config();


// ======================================================
// GROQ CLIENT
// ======================================================

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});


// ======================================================
// MODEL
// ======================================================

const MODEL =
    process.env.GROQ_MODEL ||
    "openai/gpt-oss-20b";


function formatINR(value) {
    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "₹0";
    }

    return "₹" + number.toLocaleString("en-IN", {
        maximumFractionDigits: 2
    });
}

// ======================================================
// MAIN AI FUNCTION
// ======================================================

async function askAI({
    question,
    intent,
    data
}) {

    console.log("======================================");
    console.log("Q TRADING AI REQUEST");
    console.log("Model    :", MODEL);
    console.log("Intent   :", intent);
    console.log("Question :", question);
    console.log("======================================");


    // ==================================================
    // COMPACT AI PAYLOAD
    // ==================================================
    // PRODUCT_DECLINE is already deterministically ranked in ai.js.
    // Send only the top 5 rows and required fields to reduce TPM.
    // ==================================================

    let aiData = data;

    if (intent === "SALES" && data) {
        const sales = data.sales || {};
        const performance = data.performance || {};

        aiData = {
            sales: {
                mtdSales: formatINR(sales.mtdSales),
                qtdSales: formatINR(performance.currentQTD),
                ytdSales: formatINR(performance.currentYTD),
                mtdGrowthPercent: Number(performance.mtdGrowthPercent ?? 0),
                qtdGrowthPercent: Number(performance.qtdGrowthPercent ?? 0),
                ytdGrowthPercent: Number(performance.ytdGrowthPercent ?? 0)
            }
        };
    }

    if (intent === "PRODUCT_DECLINE" && data) {
        aiData = {
            products: (data.products || [])
                .slice(0, 5)
                .map(p => ({
                    productName: p.productName,
                    productStatus: p.productStatus,
                    avgLast6Months: p.avgLast6Months,
                    currentMonthQty: p.currentMonthQty,
                    gapToAverage: p.gapToAverage
                }))
        };
    }

    // ==================================================
    // SYSTEM PROMPT
    // ==================================================

const commonRules = `
You are "Q AI", the business analyst inside Q Trading.

Use ONLY the verified business data supplied below.
Backend numbers are authoritative. Never invent sales, quantities,
customers, products, targets, percentages, dates, or outstanding amounts.
Null means unavailable; zero is a real business value.

Answer the user's question first. Use concise business language and
Indian money formatting (₹, lakh, crore). Understand MTD, QTD and YTD;
the financial year is April-March.

Do not invent causes or unsupported explanations. Separate facts,
analysis and recommendations. Recommend only when supported by data.

Do not mention SQL, stored procedures, APIs, JSON, Node.js, Groq,
prompts, or backend processing. You are read-only.

Never add, average, or combine percentages unless directly supported.
Never invent revenue when only quantity data is supplied.
`;

const intentRules = {
    SALES: `
SALES:
- Use MTD, QTD and YTD exactly as supplied.
- Negative growth is a decline.
- Do not contradict supplied totals.
- Monetary values are already formatted by JavaScript using Indian
  numbering. Preserve the supplied ₹ formatting exactly.
- Do not reformat, recalculate, or regroup monetary values.
- MTD/QTD/YTD sales are monetary values.
- MTD/QTD/YTD growth values are percentages, not money.
`,
    CUSTOMER_DUE_BILLS: `
OUTSTANDING: Use customerOutstanding as authoritative. For "Who owes us
money?", prioritize higher outstanding amount, then older overdue days.
Use customerName, totalDueAmount, pendingInvoices, oldestDueDate and
dueDays when available. Null due amount is unavailable, not zero.
Never invent payment reasons.
`,
    PRODUCT_GROWTH: `
PRODUCT GROWTH: Only Status="GROWTH" products qualify for fastest-growing
existing-product ranking; rank by GrowthPercent descending. Do not rank
NEW products against existing products using 100% growth. Present NEW
separately and do not rank DECLINE products as growing. Distinguish
PreviousQty and CurrentQty. Do not invent reasons or revenue.
`,
    TOP_CUSTOMERS: `
TOP CUSTOMERS: Rank ONLY by CurrentMonthQty descending and exclude zero.
AvgMonthlyQty, QtyGap and QtyGrowthPercent are supporting context only.
Do not rank by growth or call a customer top solely because of high growth.
Do not calculate company/customer share unless an explicit company total
is supplied. Do not assume returned rows are company totals.
`,
    CUSTOMER_FOLLOW_UP: `
CUSTOMER FOLLOW-UP: FollowUpStatus is authoritative. Priority:
Critical, Needs Follow-up, No Purchase, Normal. Within the same status,
more negative QtyGrowthPercent has higher priority. Do not use database
return order. Keep Monthly and Quarterly separate. Monthly uses
LastMonthQty/CurrentMonthQty; Quarterly uses LastQuarterAvgQty/
CurrentQuarterAvgQty. Never combine their percentages.

No Purchase means purchased in the comparison period but zero quantity in
the current period. Do not call it permanently lost. Do not invent
reasons, revenue, or an overall priority score.
`,
PRODUCT_DECLINE: `
PRODUCT DECLINE:

- Rank products ONLY by GapToAverage in descending order.
- Larger positive GapToAverage means a larger shortfall versus the
  historical 6-month average.
- GapToAverage is the PRIMARY ranking metric.
- Do NOT rank by ProductStatus.
- Do NOT rank by CurrentMonthQty.
- Do NOT rank by GapToBest.
- Do NOT rank by ProductName.
- ProductStatus is supporting context only.

- Clearly distinguish:
  - AvgLast6Months = historical 6-month average quantity
  - CurrentMonthQty = current-month quantity
  - GapToAverage = shortfall versus the historical average
  - GapToBest = shortfall versus the best historical month

- CurrentMonthQty = 0 may be described as "No Sale" only when
  ProductStatus supplied by the backend confirms "No Sale".

- Do not invent sales revenue when only quantity data is supplied.
- Do not calculate revenue from quantity.
- Do not calculate total decline unless an explicit total is supplied.
- Do not assume returned products represent all company products.
- Do not assume returned gaps represent total company/product decline.

- Do not invent reasons for a decline.
- Do not speculate about inventory, supply, pricing, demand,
  customers, market conditions, competition, sales effort,
  marketing, or any other cause unless explicitly supplied.

- Do not say that a product needs a particular action merely because
  it has a "Needs Push" or "Critical" status.
- You may report the supplied ProductStatus exactly as provided.
- If recommending action, keep it limited to reviewing/prioritizing
  the products based on the supplied data. Do not invent a specific
  cause or intervention.

- Do not describe GapToBest as the decline ranking metric.
- Do not confuse historical best quantity with historical average.
- GapToAverage, AvgLast6Months, CurrentMonthQty, GapToBest and
  BestMonthlyQty are quantity values, NOT monetary values.
- Never prefix these quantity metrics with ₹.
- Never describe quantity as revenue, sales value, or money.
- Use "units" only when the supplied data explicitly establishes
  the unit of measure; otherwise report the numeric quantity without
  inventing a unit.
When answering "which products are declining the most", present the
highest GapToAverage products first and clearly state that the ranking
is based on shortfall versus the 6-month average.

Use only the supplied data.
`,
    PRODUCT_PERFORMANCE: `
PRODUCT PERFORMANCE: Use supplied product metrics exactly as provided.
Distinguish monthly, quarterly, YTD and historical-average metrics.
Do not invent causes, revenue, targets or unsupported comparisons.
`,
    CUSTOMER_GROWTH: `
CUSTOMER GROWTH: Use the growth metric explicitly supplied for this
intent. Do not combine growth percentages or invent revenue/reasons.
`,
    GENERAL: `
GENERAL: Answer only from supplied data. If required information is not
present, say it is unavailable instead of guessing.
- Never use ₹ for a quantity, count, percentage, or non-monetary metric.
- Use ₹ only when the supplied data explicitly represents a monetary
  amount.
`
};

const systemPrompt = `
${commonRules}
${intentRules[intent] || intentRules.GENERAL}

======================================================
VERIFIED BUSINESS DATA
======================================================

${JSON.stringify(aiData, null, 2)}

======================================================
BUSINESS INTENT
======================================================

${intent}
`;



    // ==================================================
    // USER PROMPT
    // ==================================================

    const userPrompt = `
Answer the user's question using ONLY the verified data.

Requirements:
- Give the direct answer first.
- Be concise: maximum 5 bullet/numbered items.
- Do not repeat all supplied fields.
- Do not calculate unsupported totals or percentages.
- Do not invent causes, revenue, or recommendations.
- For PRODUCT_DECLINE, preserve the supplied product order exactly.
- For SALES, preserve the supplied Indian ₹ formatting exactly.
- Do not reformat monetary values.
- Do not explain your reasoning or internal instructions.

Question:
${question}
`;


    // ==================================================
    // CALL GROQ
    // ==================================================

    try {

       const completion =
    await groq.chat.completions.create({

        model: MODEL,

        messages: [

            {
                role: "system",
                content: systemPrompt
            },

            {
                role: "user",
                content: userPrompt
            }

        ],

        temperature: 0.1,

        reasoning_effort: "low",

        include_reasoning: false,

        max_completion_tokens: 700

    });


        // ==================================================
        // GET RESPONSE
        // ==================================================

        const choice =
            completion?.choices?.[0];

        const answer =
            choice?.message?.content ||
            "";

        console.log(
            "Groq finish reason:",
            choice?.finish_reason || "unknown"
        );

        if (!answer.trim()) {

            console.error(
                "Groq returned no visible answer."
            );

            console.error(
                "Groq choice:",
                JSON.stringify(choice, null, 2)
            );

            if (choice?.finish_reason === "length") {
                throw new Error(
                    "Groq response reached the completion limit. The request was intentionally kept concise; please retry."
                );
            }

            throw new Error(
                `Groq returned an empty response. Finish reason: ${
                    choice?.finish_reason || "unknown"
                }`
            );
        }


        console.log("======================================");
        console.log("Q TRADING AI RESPONSE RECEIVED");
        console.log("======================================");


        return answer.trim();

    }
    catch (error) {

        console.error("======================================");
        console.error("Q TRADING GROQ ERROR");
        console.error(error);
        console.error("======================================");

        throw new Error(
            `Groq AI request failed: ${error.message}`
        );

    }

}


// ======================================================
// EXPORT
// ======================================================

module.exports = {
    askAI
};