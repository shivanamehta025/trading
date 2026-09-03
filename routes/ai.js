const express = require("express");
const router = express.Router();

const { getPool, sql } = require("../config/db");
const { askAI } = require("../services/aiService");


router.get("/test", (req, res) => {

    res.json({
        success: true,
        message: "Q AI route is working"
    });

});

// ======================================================
// POST /api/ai/ask
// ======================================================

router.post("/ask", async (req, res) => {

    try {

        const {
            userId,
            databaseName,
            question
        } = req.body;


        // ==================================================
        // VALIDATION
        // ==================================================

        if (!userId) {

            return res.status(400).json({
                success: false,
                message: "userId is required"
            });

        }


        if (!databaseName) {

            return res.status(400).json({
                success: false,
                message: "databaseName is required"
            });

        }


        if (!question || !question.trim()) {

            return res.status(400).json({
                success: false,
                message: "question is required"
            });

        }


        console.log("======================================");
        console.log("Q AI REQUEST");
        console.log("User ID       :", userId);
        console.log("Database Name :", databaseName);
        console.log("Question      :", question);
        console.log("======================================");


        // ==================================================
        // DETECT INTENT
        // ==================================================

        const intent = detectIntent(question);

        console.log("Detected Intent:", intent);


        // ==================================================
        // GET DATA FROM SQL SERVER
        // ==================================================

        const rawData = await executeBusinessQuery(
            intent,
            userId,
            databaseName
        );


        console.log("SQL Result Received");


        // ==================================================
        // NORMALIZE DATA FOR AI
        // ==================================================

       const normalizedData = normalizeData(intent, rawData);

const aiData = prepareAIData(
    intent,
    normalizedData,
    question
);

console.log("======================================");
console.log("NORMALIZED AI DATA");
console.log(JSON.stringify(aiData, null, 2));
console.log("======================================");
        console.log("AI Data Prepared");

        if (intent === "NEW_CUSTOMERS") {
            console.log("NEW CUSTOMERS COUNT:", normalizedData?.newCustomers);
        }

        if (intent === "CUSTOMER_DUE_BILLS") {
            console.log(
                "Outstanding customers:",
                aiData.customers?.length || 0,
                "Total outstanding:",
                aiData.totalOutstanding || 0
            );
        }


        // ==================================================
        // SEND DATA TO AI SERVICE
        // ==================================================

        // ==================================================
        // CUSTOMER FOLLOW-UP
        // Deterministic final answer.
        //
        // Do NOT let Groq choose which customers to include.
        // Monthly and Quarterly remain completely separate.
        // ==================================================

        let answer;


if (intent === "NEW_CUSTOMERS") {

    const count = Number(aiData?.newCustomers ?? 0);

    answer = count > 0
        ? `**New customers:** ${count}`
        : "There are no new customers in the current customer-health period.";

} else if (intent === "CUSTOMER_FOLLOW_UP") {

    answer = buildCustomerFollowUpAnswer(aiData);

} else if (intent === "PRODUCT_DECLINE") {

    answer = buildProductDeclineAnswer(
        question,
        aiData
    );

}else if (intent === "CUSTOMER_GROWTH") {

    answer = buildCustomerGrowthAnswer(
        question,
        aiData
    );

} else if (intent === "PRODUCT_COLLECTION") {

    // Deterministic calculation. Never send the full collection
    // dataset to Groq.
    const collections = Array.isArray(aiData?.collections)
        ? aiData.collections
        : [];

    const totals = {};

    for (const row of collections) {
        const product = String(row.product || "Unknown Product").trim();
        const amount = Number(row.amountReceived || 0);

        totals[product] = (totals[product] || 0) + amount;
    }

    const ranking = Object.entries(totals)
        .map(([product, collectedAmount]) => ({
            product,
            collectedAmount
        }))
        .sort((a, b) => b.collectedAmount - a.collectedAmount);

    if (!ranking.length) {

        answer = "No product collection data is available.";

        aiData.productCollection = {
            highestProduct: null,
            ranking: []
        };

    } else {

        const top = ranking[0];

        answer =
            `**Product with the highest collection:**\n\n` +
            `- **Product:** ${top.product}\n` +
            `- **Collected amount:** ₹${Number(top.collectedAmount).toLocaleString("en-IN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })}`;

        aiData.productCollection = {
            highestProduct: top,
            ranking
        };
    }

} else if (intent === "TOP_CUSTOMERS") {

    answer = buildTopCustomersAnswer(
        question,
        aiData
    );

}   else if (intent === "CUSTOMER_DUE_BILLS") {

    answer = buildCustomerDueBillsAnswer(
        question,
        aiData
    );
}
 else if (intent === "SALES") {

    answer = buildSalesAnswer(
        question,
        aiData
    );
} else if (intent === "COLLECTION_HISTORY") {

    // IMPORTANT: calculate collections locally.
    // Do NOT send the complete collection dataset to Groq.
    const collectionResult = analyzeCollectionQuestion(
        question,
        aiData.collections || []
    );

    answer = collectionResult?.answer ||
        "No collection data is available.";

    if (collectionResult?.data) {
        aiData.collectionAnalysis = collectionResult.data;
    }

} else {

    answer = await askAI({
        question: question,
        intent: intent,
        data: aiData
    });
}


        // ==================================================
        // FINAL RESPONSE
        // ==================================================

        return res.json({

            success: true,

            question: question,

            intent: intent,

            answer: answer,

            data: aiData,

            // Keep this temporarily for debugging.
            // We can remove it after AI is stable.
            rawData: rawData

        });

    }
    catch (error) {

        console.error("======================================");
        console.error("Q AI ERROR");
        console.error(error);
        console.error("======================================");


        return res.status(500).json({

            success: false,

            message: "AI request failed",

            error: error.message

        });

    }

});


// ======================================================
 // BUILD CUSTOMER FOLLOW-UP ANSWER
 // ======================================================

 function buildCustomerFollowUpAnswer(data) {

    const monthly = sortFollowUpCustomers(
    Array.isArray(data?.monthlyFollowUp)
        ? data.monthlyFollowUp
        : []
);

const quarterly = sortFollowUpCustomers(
    Array.isArray(data?.quarterlyFollowUp)
        ? data.quarterlyFollowUp
        : []
);


     const renderRows = (rows, period) => {

         if (!rows.length) {
             return "No follow-up records available.";
         }

         const lines = [];

         rows.forEach((row, index) => {

             const name = row.customerName || "Unknown customer";
             const product = row.productName
                 ? ` — ${row.productName}`
                 : "";

             const status = row.followUpStatus || "Unknown";
             const growth = Number(row.qtyGrowthPercent ?? 0);

             let metric;

             if (period === "monthly") {
                 metric =
                     `Last month: ${Number(row.lastMonthQty ?? 0)}, ` +
                     `Current month: ${Number(row.currentMonthQty ?? 0)}, ` +
                     `Change: ${growth}%`;
             } else {
                 metric =
                     `Last quarter avg: ${Number(row.lastQuarterAvgQty ?? 0)}, ` +
                     `Current quarter avg: ${Number(row.currentQuarterAvgQty ?? 0)}, ` +
                     `Change: ${growth}%`;
             }

             lines.push(
                 `${index + 1}. ${name}${product} — ${status} — ${metric}`
             );
         });

         return lines.join("\\n");
     };


     const sections = [];

     if (monthly.length) {
         sections.push(
             "### Monthly Follow-up\\n" +
             renderRows(monthly, "monthly")
         );
     }

     if (quarterly.length) {
         sections.push(
             "### Quarterly Follow-up\\n" +
             renderRows(quarterly, "quarterly")
         );
     }

     if (!sections.length) {
         return "No customer follow-up records are available.";
     }

     return (
         "**Customers requiring follow-up:**\\n\\n" +
         sections.join("\\n\\n") +
         "\\n\\n*Priority is based on FollowUpStatus first, then decline magnitude within the same period and status.*"
     );
 }
// ======================================================
// BUILD PRODUCT ATTENTION ANSWER
// ======================================================

function buildProductAttentionAnswer(data) {

    const products = Array.isArray(data?.products)
        ? [...data.products]
        : [];

    if (!products.length) {
        return "No product attention data is available.";
    }

    // Business priority
    // Critical     = highest priority
    // Needs Push   = second priority
    // No Sale      = third priority
    const statusPriority = {
        "Critical": 1,
        "Needs Push": 2,
        "No Sale": 3
    };

    const attentionProducts = products
        .filter(product =>
            product.productStatus === "Critical" ||
            product.productStatus === "Needs Push" ||
            product.productStatus === "No Sale"
        )
        .sort((a, b) => {

            const priorityA =
                statusPriority[a.productStatus] ?? 99;

            const priorityB =
                statusPriority[b.productStatus] ?? 99;

            // Status is primary
            if (priorityA !== priorityB) {
                return priorityA - priorityB;
            }

            // Within same status:
            // larger gap = greater attention
            return (
                Number(b.gapToAverage ?? 0) -
                Number(a.gapToAverage ?? 0)
            );
        });

    const lines = attentionProducts
        .slice(0, 10)
        .map((product, index) => {

            const name =
                product.productName || "Unknown product";

            const status =
                product.productStatus || "Unknown";

            const gap =
                Number(product.gapToAverage ?? 0);

            return (
                `${index + 1}. **${name}** — ` +
                `${status} — ` +
                `Gap to average: ${gap}`
            );
        });

    return (
        "**Products needing attention:**\n\n" +
        lines.join("\n")
    );
}
function buildProductDeclineAnswer(question, data) {

    const products = Array.isArray(data?.products)
        ? [...data.products]
        : [];

    if (!products.length) {
        return "No product decline data is available.";
    }

    const q = String(question || "")
        .toLowerCase()
        .trim();

    // ==================================================
    // QUESTION TYPE
    // ==================================================

    const isSmallest =
        q.includes("smallest decline") ||
        q.includes("lowest decline") ||
        q.includes("least decline") ||
        q.includes("minimum decline") ||
        q.includes("smallest drop") ||
        q.includes("lowest drop") ||
        q.includes("least drop") ||
        q.includes("minimum drop");

    const isLargest =
        q.includes("largest decline") ||
        q.includes("highest decline") ||
        q.includes("biggest decline") ||
        q.includes("most decline") ||
        q.includes("largest drop") ||
        q.includes("highest drop") ||
        q.includes("biggest drop") ||
        q.includes("most drop");

    // ==================================================
    // SMALL / LARGE DECLINE
    // ==================================================

    if (isSmallest || isLargest) {

        products.sort((a, b) => {

            const aGap =
                Number(a.gapToAverage ?? 0);

            const bGap =
                Number(b.gapToAverage ?? 0);

            return isSmallest
                ? aGap - bGap
                : bGap - aGap;
        });

        const product = products[0];

        const label = isSmallest
            ? "smallest decline"
            : "largest decline";

        return (
            `- **${product.productName}** has the ${label} ` +
            `with a GapToAverage of ${product.gapToAverage}.`
        );
    }

    // ==================================================
    // NEEDS ATTENTION
    // ==================================================

    const needsAttention =
        q.includes("need attention") ||
        q.includes("needs attention") ||
        q.includes("need improvement") ||
        q.includes("needs improvement") ||
        q.includes("underperforming") ||
        q.includes("underperform") ||
        q.includes("weak product") ||
        q.includes("weak products") ||
        q.includes("problem product") ||
        q.includes("problem products");

    if (needsAttention) {

        const priority = {
            "Critical": 1,
            "Needs Push": 2,
            "No Sale": 3
        };

        const attentionProducts =
            products
                .filter(p =>
                    p.productStatus === "Critical" ||
                    p.productStatus === "Needs Push" ||
                    p.productStatus === "No Sale"
                )
                .sort((a, b) => {

                    const priorityA =
                        priority[a.productStatus] ?? 99;

                    const priorityB =
                        priority[b.productStatus] ?? 99;

                    if (priorityA !== priorityB) {
                        return priorityA - priorityB;
                    }

                    return (
                        Number(b.gapToAverage ?? 0) -
                        Number(a.gapToAverage ?? 0)
                    );
                });

        if (!attentionProducts.length) {
            return "No products currently require attention.";
        }

        return [
            "**Products needing attention:**",
            "",
            ...attentionProducts
                .slice(0, 10)
                .map((p, index) =>
                    `${index + 1}. **${p.productName}** — ` +
                    `${p.productStatus} — ` +
                    `Gap to average: ${p.gapToAverage}`
                )
        ].join("\n");
    }

    // ==================================================
    // DEFAULT — LARGEST DECLINE
    // ==================================================

    products.sort((a, b) =>
        Number(b.gapToAverage ?? 0) -
        Number(a.gapToAverage ?? 0)
    );

    return [
        "**Products with the largest shortfall:**",
        "",
        ...products
            .slice(0, 10)
            .map((p, index) =>
                `${index + 1}. **${p.productName}** — ` +
                `Gap to average: ${p.gapToAverage}`
            )
    ].join("\n");
}


function buildCustomerGrowthAnswer(question, data) {

    const customers = Array.isArray(data?.customers)
        ? [...data.customers]
        : [];

    if (!customers.length) {
        return "No customer growth data is available.";
    }

    const q = String(question || "")
        .toLowerCase()
        .trim();

    const isLowest =
        q.includes("lowest growth") ||
        q.includes("smallest growth") ||
        q.includes("least growth") ||
        q.includes("minimum growth");

    const isHighest =
        q.includes("highest growth") ||
        q.includes("largest growth") ||
        q.includes("greatest growth") ||
        q.includes("maximum growth") ||
        q.includes("fastest growing") ||
        q.includes("fastest growth");

    customers.sort((a, b) => {

        const aGrowth =
            Number(a.growthPercent ?? 0);

        const bGrowth =
            Number(b.growthPercent ?? 0);

        return isLowest
            ? aGrowth - bGrowth
            : bGrowth - aGrowth;
    });

    const customer = customers[0];

    if (isLowest) {

        return (
            `- **${customer.customerName}** has the lowest growth ` +
            `at ${customer.growthPercent}%.`
        );
    }

    return (
        `- **${customer.customerName}** has the highest growth ` +
        `at ${customer.growthPercent}%.`
    );
}

function buildTopCustomersAnswer(question, data) {

    const customers = Array.isArray(data?.customers)
        ? [...data.customers]
        : [];

    if (!customers.length) {
        return "No customer data is available.";
    }

    // TOP_CUSTOMERS is ranked ONLY by CurrentMonthQty
    const rankedCustomers = customers
        .filter(customer =>
            Number(customer.currentMonthQty ?? 0) > 0
        )
        .sort((a, b) =>
            Number(b.currentMonthQty ?? 0) -
            Number(a.currentMonthQty ?? 0)
        );

    if (!rankedCustomers.length) {
        return "No customers with current-month quantity are available.";
    }

    const top = rankedCustomers.slice(0, 10);

    return [
        "**Top customers by current-month quantity:**",
        "",
        ...top.map((customer, index) =>
            `${index + 1}. **${customer.customerName}** — ` +
            `Current month: ${customer.currentMonthQty}`
        )
    ].join("\n");
}

function sortFollowUpCustomers(rows) {

    const priority = {
        "Critical": 1,
        "Needs Follow-up": 2,
        "No Purchase": 3,
        "Normal": 4
    };

    return [...rows].sort((a, b) => {

        // ------------------------------------------
        // 1. Follow-up status priority
        // ------------------------------------------

        const statusA =
            priority[a.followUpStatus] ?? 99;

        const statusB =
            priority[b.followUpStatus] ?? 99;

        if (statusA !== statusB) {
            return statusA - statusB;
        }

        // ------------------------------------------
        // 2. More negative growth = higher priority
        // ------------------------------------------

        const growthA =
            Number(a.qtyGrowthPercent ?? 0);

        const growthB =
            Number(b.qtyGrowthPercent ?? 0);

        if (growthA !== growthB) {
            return growthA - growthB;
        }

        // ------------------------------------------
        // 3. If same growth, larger quantity loss first
        // ------------------------------------------

        const differenceA =
            Number(a.qtyDifference ?? 0);

        const differenceB =
            Number(b.qtyDifference ?? 0);

        return differenceB - differenceA;
    });
}

// ======================================================
// BUILD CUSTOMER OUTSTANDING / DUE BILLS ANSWER
// ======================================================

// ======================================================
// BUILD CUSTOMER OUTSTANDING / DUE BILLS ANSWER
// ======================================================

function buildCustomerDueBillsAnswer(question, data) {

    const customers = Array.isArray(data?.customers)
        ? [...data.customers]
        : [];

    if (!customers.length) {
        return "No customer outstanding data is available.";
    }

    const q = String(question || "")
        .toLowerCase()
        .trim();

    // ==================================================
    // ONLY CUSTOMERS WITH A KNOWN DUE AMOUNT
    // ==================================================

    const validCustomers = customers.filter(customer => {

        if (
            customer.totalDueAmount === null ||
            customer.totalDueAmount === undefined
        ) {
            return false;
        }

        return Number.isFinite(
            Number(customer.totalDueAmount)
        );
    });

    if (!validCustomers.length) {
        return "No customer outstanding amounts are available.";
    }

    // ==================================================
    // HIGHEST OUTSTANDING FIRST
    // ==================================================

    validCustomers.sort((a, b) =>
        Number(b.totalDueAmount) -
        Number(a.totalDueAmount)
    );

    // ==================================================
    // SINGLE CUSTOMER QUESTIONS
    // ==================================================

    const isHighestQuestion =
        q.includes("who owes us the most") ||
        q.includes("owes us the most") ||
        q.includes("highest outstanding") ||
        q.includes("largest outstanding") ||
        q.includes("highest due") ||
        q.includes("largest due") ||
        q.includes("most outstanding");

    if (isHighestQuestion) {

        const customer = validCustomers[0];

        return [
            `**${customer.customerName}** has the highest outstanding amount.`,
            "",
            `- Outstanding: ${formatINR(customer.totalDueAmount)}`,
            `- Pending invoices: ${
                customer.pendingInvoices ?? "Unavailable"
            }`,
            `- Oldest due date: ${
                customer.oldestDueDate ?? "Unavailable"
            }`,
            `- Due days: ${
                customer.dueDays ?? "Unavailable"
            }`
        ].join("\n");
    }

    // ==================================================
    // CUSTOMER OUTSTANDING LIST
    // ==================================================

    return [
        "**Customers with outstanding amounts:**",
        "",
        ...validCustomers
            .slice(0, 10)
            .map((customer, index) =>
                `${index + 1}. **${customer.customerName}** — ` +
                `${formatINR(customer.totalDueAmount)}`
            )
    ].join("\n");
}

// ======================================================
// BUILD SALES ANSWER
// ======================================================

function buildSalesAnswer(question, data) {

    const sales = data?.sales || {};
    const performance = data?.performance || {};

    const q = String(question || "")
        .toLowerCase()
        .trim();

    const mtdSales =
        Number(performance.currentMTD ?? sales.mtdSales ?? 0);

    const qtdSales =
        Number(performance.currentQTD ?? 0);

    const ytdSales =
        Number(performance.currentYTD ?? 0);

    const mtdGrowth =
        performance.mtdGrowthPercent ?? null;

    const qtdGrowth =
        performance.qtdGrowthPercent ?? null;

    const ytdGrowth =
        performance.ytdGrowthPercent ?? null;


    // ==================================================
    // MTD
    // ==================================================

    const isMTD =
        q.includes("mtd") ||
        q.includes("month to date") ||
        q.includes("month-to-date") ||
        q.includes("this month");


    // ==================================================
    // QTD
    // ==================================================

    const isQTD =
        q.includes("qtd") ||
        q.includes("quarter to date") ||
        q.includes("quarter-to-date") ||
        q.includes("this quarter");


    // ==================================================
    // YTD
    // ==================================================

    const isYTD =
        q.includes("ytd") ||
        q.includes("year to date") ||
        q.includes("year-to-date") ||
        q.includes("this year");


    // ==================================================
    // SPECIFIC PERIOD
    // ==================================================

    if (isMTD) {

        return [
            `**MTD Sales:** ${formatINR(mtdSales)}`,
            `**Growth:** ${formatGrowth(mtdGrowth)}`
        ].join("\n");
    }


    if (isQTD) {

        return [
            `**QTD Sales:** ${formatINR(qtdSales)}`,
            `**Growth:** ${formatGrowth(qtdGrowth)}`
        ].join("\n");
    }


    if (isYTD) {

        return [
            `**YTD Sales:** ${formatINR(ytdSales)}`,
            `**Growth:** ${formatGrowth(ytdGrowth)}`
        ].join("\n");
    }


   // ======================================================
// GENERAL / PERFORMANCE SALES QUESTION
// ======================================================

const mtdStatus =
    Number(mtdGrowth) > 0
        ? "positive"
        : Number(mtdGrowth) < 0
            ? "declining"
            : "flat";

const qtdStatus =
    Number(qtdGrowth) > 0
        ? "positive"
        : Number(qtdGrowth) < 0
            ? "declining"
            : "flat";

const ytdStatus =
    Number(ytdGrowth) > 0
        ? "positive"
        : Number(ytdGrowth) < 0
            ? "declining"
            : "flat";


if (
    q.includes("performing") ||
    q.includes("performance") ||
    q.includes("increasing") ||
    q.includes("decreasing") ||
    q.includes("doing")
) {

    return [
        "**Sales Performance:** Mixed",

        `- **MTD Sales:** ${formatINR(mtdSales)} ` +
        `(${formatGrowth(mtdGrowth)}, ${mtdStatus})`,

        `- **QTD Sales:** ${formatINR(qtdSales)} ` +
        `(${formatGrowth(qtdGrowth)}, ${qtdStatus})`,

        `- **YTD Sales:** ${formatINR(ytdSales)} ` +
        `(${formatGrowth(ytdGrowth)}, ${ytdStatus})`,

        "",
        `Overall, MTD is ${mtdStatus}, while QTD and YTD are ${qtdStatus}.`
    ].join("\n");
}
}

function formatGrowth(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "Unavailable";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "Unavailable";
    }

    return `${number}%`;
}

function formatINR(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "Unavailable";
    }

    const number = Number(value);

    if (!Number.isFinite(number)) {
        return "Unavailable";
    }

    return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2
    }).format(number);
}

// ======================================================
// INTENT DETECTION
// ======================================================

function detectIntent(question) {

    const q = question
        .toLowerCase()
        .trim();

    // ==================================================
    // 1. CUSTOMER OUTSTANDING / DUE BILLS
    // ==================================================

    if (
        q.includes("who owes") ||
        q.includes("customers owe") ||
        q.includes("money owed") ||
        q.includes("outstanding") ||
        q.includes("outstanding amount") ||
        q.includes("outstanding amounts") ||
        q.includes("overdue") ||
        q.includes("overdue payment") ||
        q.includes("overdue payments") ||
        q.includes("due payment") ||
        q.includes("due payments") ||
        q.includes("payment pending") ||
        q.includes("payments pending")
    ) {
        return "CUSTOMER_DUE_BILLS";
    }

    // ==================================================
    // 2. COLLECTION HISTORY
    // ==================================================


    // ==================================================
    // PRODUCT COLLECTION
    // ==================================================
    if (
        (
            q.includes("product") &&
            (
                q.includes("collection") ||
                q.includes("collected") ||
                q.includes("received")
            )
        ) ||
        q.includes("which product collected the most") ||
        q.includes("which product has the highest collection") ||
        q.includes("highest collection by product") ||
        q.includes("collection by product")
    ) {
        return "PRODUCT_COLLECTION";
    }

    if (
        q.includes("collection history") ||
        q.includes("payment history") ||
        q.includes("payments received") ||
        q.includes("amount collected") ||
        q.includes("how much collected") ||
        q.includes("how much have we collected") ||
        q.includes("how much did we collect") ||
        q.includes("how much was collected") ||
        q.includes("total collected") ||
        q.includes("total collection") ||
        q.includes("how much did we collect") ||
        q.includes("how much was collected") ||
        q.includes("total collected") ||
        q.includes("total collection") ||
        q.includes("which product has the highest collection") ||
        q.includes("highest collection") ||
        q.includes("which invoice has the highest collection") ||
        q.includes("which invoice had the longest collection delay") ||
        q.includes("longest collection delay") ||
        q.includes("which collections were delayed") ||
        q.includes("which collection was delayed") ||
        q.includes("show delayed collections") ||
        q.includes("delayed collections") ||
        q.includes("which product had the most delayed collections") ||
        q.includes("most delayed collections") ||
        q.includes("how much interest loss occurred") ||
        q.includes("interest loss from delayed collections") ||
        q.includes("which product caused the highest interest loss") ||
        q.includes("highest interest loss") ||
        q.includes("collection performance")
    ) {
        return "COLLECTION_HISTORY";
    }

    // ==================================================
    // 3. LOST / INACTIVE CUSTOMERS
    // ==================================================

    if (
        q.includes("lost customer") ||
        q.includes("lost customers") ||
        q.includes("inactive customer") ||
        q.includes("inactive customers") ||
        q.includes("stopped buying") ||
        q.includes("stop buying") ||
        q.includes("stopped purchase") ||
        q.includes("stopped purchasing") ||
        q.includes("stopped orders") ||
        q.includes("stopped ordering") ||
        q.includes("customers who stopped") ||
        q.includes("customers that stopped") ||
        q.includes("customers no longer buying") ||
        q.includes("customers not buying") ||
        q.includes("customers who are not buying") ||
        q.includes("who stopped buying") ||
        q.includes("who stopped purchasing") ||
        q.includes("who stopped ordering")
    ) {
        return "LOST_CUSTOMERS";
    }

    // ==================================================
    // 4. CUSTOMER FOLLOW-UP
    // ==================================================

    if (
        q.includes("follow up") ||
        q.includes("follow-up") ||
        q.includes("followup") ||
        q.includes("call today") ||
        q.includes("customers to call") ||
        q.includes("customer to call") ||
        q.includes("customer to visit") ||
        q.includes("customers to visit") ||
        q.includes("who should i call") ||
        q.includes("who should i visit")
    ) {
        return "CUSTOMER_FOLLOW_UP";
    }

// ======================================================
// PRODUCT PERFORMANCE
// ======================================================

// ======================================================
// PRODUCT PERFORMANCE
// ======================================================

const productPerformance =
    q.includes("product performance") ||
    q.includes("product performing") ||
    q.includes("products performing") ||
    q.includes("performing well") ||
    q.includes("performing good") ||
    q.includes("perform well") ||
    q.includes("perform good") ||
    q.includes("performance of product") ||
    q.includes("performance of products") ||
    q.includes("how are products performing") ||
    q.includes("how is product performance") ||
    q.includes("product performance report") ||
    q.includes("product performance summary");

if (productPerformance) {
    return "PRODUCT_PERFORMANCE";
}

   // ======================================================
// PRODUCT ATTENTION / DECLINE
// ======================================================

if (
    q.includes("product") &&
    (
        q.includes("need attention") ||
        q.includes("needs attention") ||
        q.includes("need to improve") ||
        q.includes("needs improvement") ||
        q.includes("underperforming") ||
        q.includes("underperform") ||
        q.includes("weak products") ||
        q.includes("weak product") ||
        q.includes("problem products") ||
        q.includes("problem product")
    )
) {
    return "PRODUCT_DECLINE";
}
    // ==================================================
    // NEW CUSTOMERS / CUSTOMER HEALTH
    // ==================================================
    // Uses the existing CUSTOMER_HEALTH SQL calculation.
    if (
        q === "new customer" ||
        q === "new customers" ||
        q.includes("new customer") ||
        q.includes("newly acquired customer") ||
        q.includes("newly acquired customers") ||
        q.includes("customers acquired") ||
        q.includes("customer acquisition")
    ) {
        return "NEW_CUSTOMERS";
    }


  // ======================================================
// 5. CUSTOMER GROWTH
// ======================================================

if (
    q.includes("customer") &&
    (
        q.includes("growth") ||
        q.includes("growing")
    ) &&
    (
        q.includes("highest") ||
        q.includes("lowest") ||
        q.includes("fastest") ||
        q.includes("maximum") ||
        q.includes("minimum") ||
        q.includes("most") ||
        q.includes("least") ||
        q.includes("largest") ||
        q.includes("smallest")
    )
) {
    return "CUSTOMER_GROWTH";
}
    // ==================================================
    // 5. FAST-GROWING CUSTOMERS
    // ==================================================

    if (
        q.includes("fast growing customers") ||
        q.includes("fast-growing customers") ||
        q.includes("customers growing fastest") ||
        q.includes("customers growing fast") ||
        q.includes("which customers are growing") ||
        q.includes("top growing customers")
    ) {
        return "FAST_GROWING_CUSTOMERS";
    }

    // ==================================================
    // 6. TOP 10 CUSTOMERS
    // ==================================================

    if (
        q.includes("top 10 customers") ||
        q.includes("top ten customers") ||
        q.includes("10 biggest customers") ||
        q.includes("ten biggest customers")
    ) {
        return "TOP10_CUSTOMERS";
    }

    // ==================================================
    // 7. TOP CUSTOMERS
    // ==================================================

    if (
        q.includes("top customers") ||
        q.includes("best customers") ||
        q.includes("biggest customers") ||
        q.includes("largest customers") ||
        q.includes("highest customers") ||
        q.includes("who are my biggest customers")
    ) {
        return "TOP_CUSTOMERS";
    }

    // ==================================================
    // 8. CUSTOMERS CONTRIBUTING 80% OF SALES
    // ==================================================

    if (
        q.includes("80% customers") ||
        q.includes("80 percent customers") ||
        q.includes("customers contributing 80") ||
        q.includes("customers responsible for 80") ||
        q.includes("80% of sales") ||
        q.includes("80 percent of sales")
    ) {
        return "80_PERCENT_SALES_CUSTOMER";
    }

    // ==================================================
    // 9. CUSTOMER PRODUCTS
    // ==================================================

    if (
        q.includes("what products does") ||
        q.includes("what products") ||
        q.includes("products does") ||
        q.includes("products bought by") ||
        q.includes("products purchased by") ||
        q.includes("customer products")
    ) {
        return "CUSTOMER_PRODUCTS";
    }

    // ==================================================
    // 10. PRODUCT-CUSTOMER INSIGHT
    // ==================================================

    if (
        q.includes("product customer insight") ||
        q.includes("who buys") ||
        q.includes("which customers buy") ||
        q.includes("customers buying product")
    ) {
        return "PRODUCT_CUSTOMER_INSIGHT";
    }

    // ==================================================
    // 11. PRODUCT-CUSTOMER MONTHLY TREND
    // ==================================================

    if (
        q.includes("monthly trend") ||
        q.includes("monthly product trend") ||
        q.includes("customer product trend") ||
        q.includes("product trend")
    ) {
        return "PRODUCT_CUSTOMER_MONTHLY_TREND";
    }

    // ==================================================
    // 12. PRODUCT CUSTOMER ANALYSIS
    // ==================================================

    if (
        q.includes("customer analysis") ||
        q.includes("customer performance") ||
        q.includes("customer sales") ||
        q.includes("customer purchase") ||
        q.includes("customer purchases")
    ) {
        return "PRODUCT_CUSTOMER_ANALYSIS";
    }

    // ==================================================
    // 13. PRODUCT TARGET
    // ==================================================

    if (
        q.includes("product target") ||
        q.includes("product targets") ||
        q.includes("sales target") ||
        q.includes("sales targets") ||
        q.includes("target achievement") ||
        q.includes("target achievement percentage") ||
        q.includes("achieving my target") ||
        q.includes("achieving my targets") ||
        q.includes("achieving product target") ||
        q.includes("achieving product targets") ||
        q.includes("meeting my target") ||
        q.includes("meeting my targets") ||
        q.includes("meeting product target") ||
        q.includes("meeting product targets") ||
        q.includes("target remaining") ||
        q.includes("target gap") ||
        q.includes("product target remaining") ||
        q.includes("product target gap") ||
        q.includes("how much target is remaining")
    ) {
        return "PRODUCT_TARGET";
    }

    // ==================================================
    // 14. PRODUCT DECLINE
    // ==================================================

   // ======================================================
// PRODUCT DECLINE
// ======================================================

if (
    q.includes("product") &&
    (
        q.includes("decline") ||
        q.includes("declining") ||
        q.includes("declined") ||
        q.includes("drop") ||
        q.includes("decrease") ||
        q.includes("decreased") ||
        q.includes("shortfall") ||
        q.includes("fall") ||
        q.includes("fallen")
    )
) {
    return "PRODUCT_DECLINE";
}

    // ==================================================
    // 15. PRODUCT GROWTH
    // ==================================================

    if (
        q.includes("product growth") ||
        q.includes("growing product") ||
        q.includes("growing products") ||
        q.includes("which products are growing") ||
        q.includes("fast growing product") ||
        q.includes("fast growing products") ||
        q.includes("product is growing") ||
        q.includes("products are growing")
    ) {
        return "PRODUCT_GROWTH";
    }

    // ==================================================
    // 16. GENERAL SALES / BUSINESS PERFORMANCE
    // Keep this AFTER specific customer/product intents.
    // ==================================================

    if (
        q.includes("sales") ||
        q.includes("sale") ||
        q.includes("turnover") ||
        q.includes("revenue") ||

        // MTD
        q.includes("month to date") ||
        q.includes("month-to-date") ||
        q.includes("mtd") ||
        q.includes("this month") ||

        // QTD
        q.includes("quarter performance") ||
        q.includes("current quarter") ||
        q.includes("this quarter") ||
        q.includes("quarter to date") ||
        q.includes("quarter-to-date") ||
        q.includes("qtd") ||

        // YTD
        q.includes("year performance") ||
        q.includes("business performing this year") ||
        q.includes("performance this year") ||
        q.includes("this year") ||
        q.includes("year to date") ||
        q.includes("year-to-date") ||
        q.includes("ytd") ||
        q.includes("financial year") ||
        q.includes("financial year performance") ||

        // General business performance
        q.includes("business performance") ||
        q.includes("business performing") ||
        q.includes("business doing") ||
        q.includes("how is my business") ||
        q.includes("how are we performing")
    ) {
        return "SALES";
    }

    // ==================================================
    // 17. GENERAL
    // ==================================================

    return "GENERAL";
}


// ======================================================
// EXECUTE BUSINESS QUERY
// ======================================================

async function executeBusinessQuery(
    intent,
    userId,
    databaseName
) {

    console.log("--------------------------------------");
    console.log("DATABASE CONNECTION");
    console.log("Database:", databaseName);
    console.log("--------------------------------------");


    // ==================================================
    // CONNECT TO SELECTED COMPANY DATABASE
    // ==================================================

    const pool = await getPool(databaseName);


    let what;


    // ==================================================
    // MAP INTENT TO STORED PROCEDURE @WHAT
    // ==================================================

switch (intent) {

    case "SALES":
        what = "SALES";
        break;

    case "CUSTOMER_FOLLOW_UP":
        what = "CUSTOMER_FOLLOW_UP";
        break;

    case "LOST_CUSTOMERS":
        what = "LOST_CUSTOMERS";
        break;
    case "NEW_CUSTOMERS":
        // CUSTOMER_HEALTH returns NewCustomers count.
        what = "CUSTOMER_HEALTH";
        break;



    case "CUSTOMER_GROWTH":
        // Customer growth uses the customer-growth result set.
        what = "TOP_GROWING_CUSTOMERS";
        break;

    case "FAST_GROWING_CUSTOMERS":
        what = "FAST_GROWING_CUSTOMERS";
        break;

    case "PRODUCT_GROWTH":
        what = "PRODUCT_GROWTH_DETAILS";
        break;

    case "PRODUCT_DECLINE":
        what = "PRODUCT_DECLINE";
        break;

    case "PRODUCT_TARGET":
        what = "CATEGORYWISE_TARGET";
        break;

    case "PRODUCT_PERFORMANCE":
    what = "PRODUCT_PERFORMANCE";
    break;

    case "TOP_CUSTOMERS":
        what = "TOP_CUSTOMERS";
        break;

    case "TOP10_CUSTOMERS":
        what = "TOP10_CUSTOMERS";
        break;

    case "80_PERCENT_SALES_CUSTOMER":
        what = "80PERCENT_SALES_CUSTOMER";
        break;

    case "TOP_GROWING_PRODUCTS":
        what = "TOP_GROWING_PRODUCTS";
        break;

    case "TOP_GROWING_CUSTOMER_PRODUCTS":
        what = "TOP_GROWING_CUSTOMER_PRODUCTS";
        break;

    case "CUSTOMER_PRODUCTS":
        what = "CUSTOMER_PRODUCTS";
        break;

    case "PRODUCT_CUSTOMER_INSIGHT":
        what = "PRODUCT_CUSTOMER_INSIGHT";
        break;

    case "PRODUCT_CUSTOMER_MONTHLY_TREND":
        what = "PRODUCT_CUSTOMER_MONTHLY_TREND";
        break;

    case "PRODUCT_CUSTOMER_ANALYSIS":
        what = "PRODUCT_CUSTOMER_ANALYSIS";
        break;

    case "CUSTOMER_DUE_BILLS":
        // Company-wide outstanding information is currently
        // available through the SALES branch.
        what = "SALES";
        break;

    case "COLLECTION_HISTORY":
        what = "COLLECTION_HISTORY";
        break;

    case "PRODUCT_COLLECTION":
        // Product collection uses the existing COLLECTION_HISTORY SQL result.
        what = "COLLECTION_HISTORY";
        break;

    case "CATEGORY_DECLINE":
        what = "CATEGORY_DECLINE";
        break;

    case "CATEGORY_TARGET_CUSTOMERS":
        what = "CATEGORY_TARGET_CUSTOMERS";
        break;

    case "CUSTOMER_TO_VISIT":
        what = "Customer_to_Visit";
        break;

    default:
        return {
            message: "This Q AI question is not configured yet."
        };
}


    console.log("--------------------------------------");
    console.log("EXECUTING STORED PROCEDURE");
    console.log("Procedure : A_SP_FOR_DASHBOARD_APP");
    console.log("@WHAT     :", what);
    console.log("@USERID   :", userId);
    console.log("@DATABASE :", databaseName);
    console.log("--------------------------------------");


    // ==================================================
    // CREATE SQL REQUEST
    // ==================================================

    const request = pool.request();


    // ==================================================
    // STORED PROCEDURE PARAMETERS
    // ==================================================

    request.input(
        "What",
        sql.NVarChar(200),
        what
    );


    request.input(
        "USERID",
        sql.NVarChar(50),
        userId
    );


    // ==================================================
    // EXECUTE STORED PROCEDURE
    // ==================================================

    const result = await request.execute(
        "A_SP_FOR_DASHBOARD_APP"
    );

if (
        intent === "PRODUCT_GROWTH" ||
        intent === "PRODUCT_DECLINE" ||
        intent === "CUSTOMER_DUE_BILLS" ||
    	intent === "LOST_CUSTOMERS"
    ) { 
        console.log("======================================");
        console.log(intent + " SQL RESULT");
        console.log("======================================");
        console.log(JSON.stringify(result.recordsets, null, 2));
        console.log("======================================");
    }

console.log("======================================");
    // ==================================================
    // RETURN SQL RESULT
    // ==================================================

    return {

        recordsets: result.recordsets || [],

        recordset: result.recordset || []

    };

}


// ======================================================
// NORMALIZE SQL DATA
// ======================================================

function findProductResultSet(recordsets) {

    return (recordsets || []).find(set =>
        Array.isArray(set) &&
        set.length > 0 &&
        set.some(row =>
            row &&
            (
                Object.prototype.hasOwnProperty.call(row, "ProductName") ||
                Object.prototype.hasOwnProperty.call(row, "productcode") ||
                Object.prototype.hasOwnProperty.call(row, "GrowthPercent")
            )
        )
    ) || [];
}



function findCustomerOutstandingResultSet(recordsets) {

    return (recordsets || []).find(set =>
        Array.isArray(set) &&
        set.length > 0 &&
        set.some(row =>
            row &&
            (
                Object.prototype.hasOwnProperty.call(row, "CustomerUnq") ||
                Object.prototype.hasOwnProperty.call(row, "CustomerName") ||
                Object.prototype.hasOwnProperty.call(row, "TotalDueAmount") ||
                Object.prototype.hasOwnProperty.call(row, "OldestBillNo")
            )
        )
    ) || [];
}


function normalizeData(intent, rawData) {


// ==================================================
// PRODUCT GROWTH
// ==================================================

if (intent === "PRODUCT_GROWTH") {

        const products = findProductResultSet(
            rawData.recordsets
        );

        return {
            products: products.map(row => ({
                productCode: row.productcode ?? null,
                categoryName: row.CategoryName ?? null,
                productName: row.ProductName ?? null,

                previousQty: Number(row.PreviousQty ?? 0),
                currentQty: Number(row.CurrentQty ?? 0),
                differenceQty: Number(row.DifferenceQty ?? 0),
                growthPercent: Number(row.GrowthPercent ?? 0),

                previousAmount: Number(row.PreviousAmount ?? 0),
                currentAmount: Number(row.CurrentAmount ?? 0),
                differenceAmount: Number(row.DifferenceAmount ?? 0),

                status: row.Status ?? null,

                avgMonthlyQty: Number(row.AvgMonthlyQty ?? 0),
                currentMonthQty: Number(row.CurrentMonthQty ?? 0),
                vsMonthlyAvgPercent:
                    Number(row.VsMonthlyAvgPercent ?? 0),

                avgQuarterlyQty: Number(row.AvgQuarterlyQty ?? 0),
                currentQuarterQty: Number(row.CurrentQuarterQty ?? 0),
                vsQuarterlyAvgPercent:
                    Number(row.VsQuarterlyAvgPercent ?? 0),

                requiredMonthlyQty:
                    Number(row.RequiredMonthlyQty ?? 0),

                monthlyTargetGap:
                    Number(row.MonthlyTargetGap ?? 0),

                monthlyTargetAchievementPercent:
                    Number(row.MonthlyTargetAchievementPercent ?? 0)
            }))
        };
    }

    // ==================================================
    // PRODUCT DECLINE
    // Stored procedure returns a different schema for this intent.
    // ==================================================

 // ======================================================
// PRODUCT DECLINE
// ======================================================

if (intent === "PRODUCT_DECLINE") {

    const products = findProductResultSet(
        rawData.recordsets
    );

    const normalizedProducts = products.map(row => ({
        productId: row.ProductId ?? null,
        productName: row.ProductName ?? null,

        avgLast6Months:
            Number(row.AvgLast6Months ?? 0),

        bestMonthlyQty:
            Number(row.BestMonthlyQty ?? 0),

        bestMonth:
            row.BestMonth ?? null,

        bestMonthYear:
            row.BestMonthYear ?? null,

        bestMonthNumber:
            row.BestMonthNumber ?? null,

        currentMonthQty:
            Number(row.CurrentMonthQty ?? 0),

        gapToBest:
            Number(row.GapToBest ?? 0),

        gapToAverage:
            Number(row.GapToAverage ?? 0),

        productStatus:
            row.ProductStatus ?? null
    }));


    // ======================================================
    // IMPORTANT:
    // PRODUCT DECLINE RANKING
    // ======================================================
    //
    // Largest GapToAverage = largest decline.
    //
    // NEVER rank by:
    // - ProductStatus
    // - CurrentMonthQty
    // - GapToBest
    // - ProductName
    //
    // ======================================================

    normalizedProducts.sort((a, b) => {

        return (
            Number(b.gapToAverage || 0) -
            Number(a.gapToAverage || 0)
        );

    });


    console.log(
        "PRODUCT_DECLINE SORTED DATA:"
    );

    console.table(
        normalizedProducts.map((p, index) => ({
            Rank: index + 1,
            Product: p.productName,
            GapToAverage: p.gapToAverage,
            CurrentMonthQty: p.currentMonthQty,
            Status: p.productStatus
        }))
    );


    return {
        products: normalizedProducts.slice(0, 20)
    };
}

    // ==================================================
    // NEW CUSTOMERS
    // ==================================================
    if (intent === "NEW_CUSTOMERS") {
        const sets = rawData.recordsets || [];
        const health = sets.find(set =>
            Array.isArray(set) &&
            set.some(row =>
                row && Object.prototype.hasOwnProperty.call(row, "NewCustomers")
            )
        )?.[0] || {};

        return {
            newCustomers: Number(health.NewCustomers ?? 0),
            repeatCustomers: Number(health.RepeatCustomers ?? 0),
            reactivatedCustomers: Number(health.ReactivatedCustomers ?? 0),
            lostCustomers: Number(health.LostCustomers ?? 0)
        };
    }

if (intent === "CUSTOMER_GROWTH") {

    const customers = findCustomerGrowthResultSet(
        rawData.recordsets
    );

    return {
        customers: customers
            .slice(0, 50)
            .map(row => ({
                customerId:
                    row.CustomerId ?? null,

                customerName:
                    row.CustomerName ?? null,

                previousQty:
                    Number(row.PreviousQty ?? 0),

                currentQty:
                    Number(row.CurrentQty ?? 0),

                growthQty:
                    Number(row.GrowthQty ?? 0),

                growthPercent:
                    Number(row.GrowthPercent ?? 0)
            }))
    };
}

// ==================================================
// FAST GROWING CUSTOMERS
// ==================================================

if (intent === "FAST_GROWING_CUSTOMERS") {

    const sets = rawData.recordsets || [];

    const rows =
        sets.find(set =>
            Array.isArray(set) &&
            set.some(row =>
                row &&
                Object.prototype.hasOwnProperty.call(
                    row,
                    "CustomerName"
                ) &&
                Object.prototype.hasOwnProperty.call(
                    row,
                    "GrowthPercent"
                )
            )
        ) || [];

    return {
        customers: rows.map(row => ({
            customerName:
                row.CustomerName ?? null,

            productName:
                row.ProductName ?? null,

            averageQty:
                Number(row.AvgQty ?? 0),

            currentQty:
                Number(row.CurrentQty ?? 0),

            quantityIncrease:
                Number(row.QtyIncrease ?? 0),

            growthPercent:
                Number(row.GrowthPercent ?? 0)
        }))
    };
}

    // ==================================================
    // TOP CUSTOMERS
    // ==================================================

    if (intent === "TOP_CUSTOMERS") {

        const sets = rawData.recordsets || [];

        // Find the result set containing the TOP_CUSTOMERS schema.
        const customerRows =
            sets.find(set =>
                Array.isArray(set) &&
                set.some(row =>
                    row &&
                    Object.prototype.hasOwnProperty.call(row, "CustomerName") &&
                    Object.prototype.hasOwnProperty.call(row, "CurrentMonthQty")
                )
            ) || [];

        return {
            customers: customerRows.map(row => ({
                customerId: row.CustomerId ?? row.CustomerUnq ?? null,
                customerName: row.CustomerName ?? null,
                currentMonthQty: Number(row.CurrentMonthQty ?? 0),
                avgMonthlyQty: Number(row.AvgMonthlyQty ?? 0),
                qtyGap: Number(row.QtyGap ?? 0),
                qtyGrowthPercent: Number(row.QtyGrowthPercent ?? 0)
            }))
        };
    }

    if (
        intent === "SALES" ||
        intent === "CUSTOMER_DUE_BILLS"
    ) {

        const sets = rawData.recordsets || [];


        // ------------------------------------------------
        // TABLE 0
        // MTD SALES
        // ------------------------------------------------

        const mtd = sets[0]?.[0] || {};


        // ------------------------------------------------
        // TABLE 1
        // TODAY SALES
        // ------------------------------------------------

        const today = sets[1]?.[0] || {};


        // ------------------------------------------------
        // TABLE 2
        // TOTAL CHALLANS
        // ------------------------------------------------

        const challans = sets[2]?.[0] || {};


        // ------------------------------------------------
        // TABLE 3
        // CUSTOMERS
        // ------------------------------------------------

        const customers = sets[3]?.[0] || {};


        // ------------------------------------------------
        // TABLE 4
        // MONTH-WISE SALES
        // ------------------------------------------------

        const monthlySales = sets[4] || [];


        // ------------------------------------------------
        // TABLE 5
        // MTD / QTD / YTD
        // ------------------------------------------------

        const performance = sets[5]?.[0] || {};


        // ------------------------------------------------
        // TABLE 6
        // DUE AMOUNT
        // ------------------------------------------------

        const due = sets[6]?.[0] || {};


        // ------------------------------------------------
        // TABLE 7
        // CUSTOMER OUTSTANDING
        // ------------------------------------------------

        const customerOutstanding =
            findCustomerOutstandingResultSet(sets);


        // ------------------------------------------------
        // TABLE 16
        // TARGET INFORMATION
        // ------------------------------------------------

        const target = sets[16]?.[0] || {};


        // ==================================================
        // CUSTOMER OUTSTANDING NORMALIZATION
        // ==================================================

        const normalizedOutstanding =
            customerOutstanding.map(row => ({

                customerId:
                    row.CustomerUnq ?? row.CustomerId ?? null,

                customerName:
                    row.CustomerName ?? null,

                totalDueAmount:
                    row.TotalDueAmount !== null &&
                    row.TotalDueAmount !== undefined
                        ? Number(row.TotalDueAmount)
                        : null,

                pendingInvoices:
                    row.PendingInvoices !== null &&
                    row.PendingInvoices !== undefined
                        ? Number(row.PendingInvoices)
                        : 0,

                oldestDueDate:
                    row.OldestDueDate || null,

                dueDays:
                    row.DueDays !== null &&
                    row.DueDays !== undefined
                        ? Number(row.DueDays)
                        : 0,

                latestDueDate:
                    row.LatestDueDate || null,

                oldestBillAmount:
                    row.OldestBillAmount !== null &&
                    row.OldestBillAmount !== undefined
                        ? Number(row.OldestBillAmount)
                        : null,

                oldestBillNo:
                    row.OldestBillNo ?? null

            }));


        // ==================================================
        // RETURN CLEAN STRUCTURE
        // ==================================================

        return {

            // SQL DUEAMOUNT is authoritative; do not derive the company
            // total by summing the customer detail rows.
            totalOutstanding:
                due.DUEAMOUNT !== null && due.DUEAMOUNT !== undefined
                    ? Number(due.DUEAMOUNT)
                    : null,

            sales: {

                mtdSales:
                    Number(mtd.MTDSALES || 0),

                mtdSalesQty:
                    Number(mtd.MTDSALESQTY || 0),

                todaySales:
                    Number(today.TODAYSALES || 0),

                totalChallans:
                    Number(challans.TOTALCHALLANS || 0),

                customers:
                    Number(customers.CUSTOMERS || 0),

                // IMPORTANT:
                // Preserve SQL NULL instead of converting it to 0

                dueAmount:
                    due.DUEAMOUNT !== null &&
                    due.DUEAMOUNT !== undefined
                        ? Number(due.DUEAMOUNT)
                        : null

            },


            performance: {

                currentMTD:
                    Number(performance.CurrentMTD || 0),

                lastMTD:
                    Number(performance.LastMTD || 0),

                mtdGrowthPercent:
                    Number(performance.MTDGrowthPercent || 0),

                currentQTD:
                    Number(performance.CurrentQTD || 0),

                lastQTD:
                    Number(performance.LastQTD || 0),

                qtdGrowthPercent:
                    Number(performance.QTDGrowthPercent || 0),

                currentYTD:
                    Number(performance.CurrentYTD || 0),

                lastYTD:
                    Number(performance.LastYTD || 0),

                ytdGrowthPercent:
                    Number(performance.YTDGrowthPercent || 0),

                quarterNo:
                    performance.QuarterNo || null,

                currentQuarterStart:
                    performance.CurrentQuarterStart || null,

                currentQuarterEnd:
                    performance.CurrentQuarterEnd || null,

                previousQuarterStart:
                    performance.PreviousQuarterStart || null,

                previousQuarterEnd:
                    performance.PreviousQuarterEnd || null

            },


            monthlySales:
                monthlySales.map(row => ({

                    month:
                        row.MonthName,

                    currentFY:
                        Number(row.CurrentFY || 0),

                    previousFY:
                        Number(row.PreviousFY || 0)

                })),


            target: {

                currentQty:
                    Number(target.CurrentQty || 0),

                averageLast3MonthsQty:
                    Number(target.avgLast3MonthsQty || 0),

                targetQty:
                    Number(target.TargetQty || 0),

                remainingQty:
                    Number(target.RemainingQty || 0),

                excessQty:
                    Number(target.ExcessQty || 0),

                achievementPercent:
                    Number(target.AchievementPercent || 0)

            },


            // ==================================================
            // CUSTOMER OUTSTANDING
            // ==================================================

            customerOutstanding:
                normalizedOutstanding

        };

    }


   // ==================================================
// LOST / INACTIVE CUSTOMERS
// ==================================================

if (intent === "LOST_CUSTOMERS") {

    const sets = rawData.recordsets || [];

    // Find the resultset containing customer activity
    const customerRows =
        sets.find(set =>
            Array.isArray(set) &&
            set.some(row =>
                row &&
                Object.prototype.hasOwnProperty.call(
                    row,
                    "CustomerUnq"
                ) &&
                Object.prototype.hasOwnProperty.call(
                    row,
                    "CustomerStatus"
                )
            )
        ) || [];

    return {

        customers: customerRows.map(row => ({

            customerId:
                row.CustomerUnq || null,

            customerName:
                row.CustomerName || null,

            productName:
                row.ProductName || null,

            paymentTerms:
                row.PaymentTerms || null,

            lastSaleDate:
                row.LastSaleDate || null,

            lastSaleDays:
                Number(row.LastSaleDays || 0),

            lastSaleAmount:
                Number(row.LastSaleAmount || 0),

            lastInvoiceNo:
                row.LastInvoiceNo || null,

            customerStatus:
                row.CustomerStatus || null,

            mobileNo:
                row.MobileNo || null

        }))

    };
}

// ==================================================
// CUSTOMER FOLLOW-UP
// ==================================================

if (intent === "CUSTOMER_FOLLOW_UP") {

    const sets = rawData.recordsets || [];

    // ----------------------------------------------
    // MONTHLY FOLLOW-UP
    // ----------------------------------------------

    const monthlyRows = sets[0] || [];

    // ----------------------------------------------
    // QUARTERLY FOLLOW-UP
    // ----------------------------------------------

    const quarterlyRows = sets[1] || [];

    return {

        monthlyFollowUp: monthlyRows.map(row => ({

            customerId:
                row.CustomerUnq ??
                row.CustomerId ??
                null,

            customerName:
                row.CustomerName ?? null,

            productName:
                row.ProductName ?? null,

            lastMonthQty:
                Number(row.LastMonthQty ?? 0),

            currentMonthQty:
                Number(row.CurrentMonthQty ?? 0),

            qtyDifference:
                Number(row.QtyDifference ?? 0),

            qtyGrowthPercent:
                Number(row.QtyGrowthPercent ?? 0),

            followUpStatus:
                row.FollowUpStatus ?? null

        })),

        quarterlyFollowUp: quarterlyRows.map(row => ({

            customerId:
                row.CustomerUnq ??
                row.CustomerId ??
                null,

            customerName:
                row.CustomerName ?? null,

            productName:
                row.ProductName ?? null,

            lastQuarterAvgQty:
                Number(row.LastQuarterAvgQty ?? 0),

            currentQuarterAvgQty:
                Number(row.CurrentQuarterAvgQty ?? 0),

            qtyDifference:
                Number(row.QtyDifference ?? 0),

            qtyGrowthPercent:
                Number(row.QtyGrowthPercent ?? 0),

            followUpStatus:
                row.FollowUpStatus ?? null

        }))

    };
}

    
    // ==================================================
    // COLLECTION HISTORY
    // ==================================================
    if (intent === "COLLECTION_HISTORY") {

        const sets = rawData.recordsets || [];

        const collectionRows =
            sets.find(set =>
                Array.isArray(set) &&
                set.some(row =>
                    row &&
                    ("AmountReceived" in row || "amountReceived" in row) &&
                    ("Product" in row || "product" in row)
                )
            ) || [];

        return {
            collections: collectionRows.map(row => ({
                invoiceUNQID: row.InvoiceUNQID ?? row.InvoiceUnqid ?? row.invoiceUNQID ?? null,
                invoiceNo: row.InvoiceNo ?? row.invoiceNo ?? null,
                invoiceDate: row.InvoiceDate ?? row.invoiceDate ?? null,
                dueDate: row.DueDate ?? row.dueDate ?? null,
                creditDays: Number(row.CreditDays ?? row.creditDays ?? 0),
                invoiceAmount: Number(row.InvoiceAmount ?? row.invoiceAmount ?? 0),
                amountReceived: Number(row.AmountReceived ?? row.amountReceived ?? 0),
                receivedDate: row.ReceivedDate ?? row.receivedDate ?? null,
                delayDays: Number(row.DelayDays ?? row.delayDays ?? 0),
                interestLoss: Number(row.InterestLoss ?? row.interestLoss ?? 0),
                product: row.Product ?? row.product ?? null
            }))
        };
    }


    // ==================================================
    // PRODUCT COLLECTION
    // ==================================================
    if (intent === "PRODUCT_COLLECTION") {

        const sets = Array.isArray(rawData?.recordsets)
            ? rawData.recordsets
            : [];

        const collectionRows =
            sets.find(set =>
                Array.isArray(set) &&
                set.some(row =>
                    row &&
                    ("AmountReceived" in row || "amountReceived" in row) &&
                    ("Product" in row || "product" in row)
                )
            ) || [];

        return {
            collections: collectionRows.map(row => ({
                product: row.Product ?? row.product ?? null,
                amountReceived: Number(
                    row.AmountReceived ?? row.amountReceived ?? 0
                )
            }))
        };
    }

return rawData;

}
function findCustomerGrowthResultSet(recordsets) {

    if (!Array.isArray(recordsets)) {
        return [];
    }

    for (const rs of recordsets) {

        if (!Array.isArray(rs) || rs.length === 0) {
            continue;
        }

        const firstRow = rs[0];

        if (
            firstRow &&
            (
                "CustomerId" in firstRow ||
                "CustomerName" in firstRow
            ) &&
            "GrowthPercent" in firstRow
        ) {
            return rs;
        }
    }

    return [];
}
function prepareAIData(intent, normalizedData = {}, question = "") {

    // ==================================================
    // COLLECTION HISTORY
    // ==================================================
    if (intent === "COLLECTION_HISTORY") {

        const collections =
            Array.isArray(normalizedData?.collections)
                ? normalizedData.collections
                : [];

        return {
            collections: collections.map(c => ({
                invoiceNo: c.invoiceNo,
                invoiceDate: c.invoiceDate,
                dueDate: c.dueDate,
                creditDays: c.creditDays,
                invoiceAmount: c.invoiceAmount,
                amountReceived: c.amountReceived,
                receivedDate: c.receivedDate,
                delayDays: c.delayDays,
                interestLoss: c.interestLoss,
                product: c.product
            }))
        };
    }


// ==================================================
// NEW CUSTOMERS
// ==================================================
if (intent === "NEW_CUSTOMERS") {
    return {
        newCustomers: Number(normalizedData?.newCustomers ?? 0)
    };
}

// ==================================================
// FAST GROWING CUSTOMERS
// ==================================================

if (intent === "FAST_GROWING_CUSTOMERS") {

    const customers =
        normalizedData.customers || [];

    return {
        customers: customers
            .sort(
                (a, b) =>
                    Number(b.growthPercent || 0) -
                    Number(a.growthPercent || 0)
            )
            .slice(0, 20)
            .map(c => ({
                customerName:
                    c.customerName,

                productName:
                    c.productName,

                averageQty:
                    c.averageQty,

                currentQty:
                    c.currentQty,

                quantityIncrease:
                    c.quantityIncrease,

                growthPercent:
                    c.growthPercent
            }))
    };
}
    // ==================================================
    // TOP CUSTOMERS
    // Rank ONLY by current-month quantity.
    // ==================================================

    if (intent === "TOP_CUSTOMERS") {

        const customers = normalizedData.customers || [];

        return {
            customers: customers
                .filter(c => Number(c.currentMonthQty || 0) > 0)
                .sort((a, b) =>
                    Number(b.currentMonthQty || 0) -
                    Number(a.currentMonthQty || 0)
                )
                .slice(0, 20)
                .map(c => ({
                    customerId: c.customerId,
                    customerName: c.customerName,
                    currentMonthQty: c.currentMonthQty,
                    avgMonthlyQty: c.avgMonthlyQty,
                    qtyGap: c.qtyGap,
                    qtyGrowthPercent: c.qtyGrowthPercent
                }))
        };
    }

    // ==================================================
    // CUSTOMER OUTSTANDING / DUE BILLS
    // Keep this payload compact for Groq.
    // ==================================================

    if (intent === "CUSTOMER_DUE_BILLS") {

        const customers = normalizedData.customerOutstanding || [];

        return {
            // Use SQL's authoritative company-level DUEAMOUNT.
            totalOutstanding: normalizedData.totalOutstanding,

            customers: customers
                .filter(c => Number(c.totalDueAmount || 0) > 0)
                .sort(
                    (a, b) =>
                        Number(b.totalDueAmount || 0) -
                        Number(a.totalDueAmount || 0)
                )
                .slice(0, 50)
                .map(c => ({
                    customerId: c.customerId,
                    customerName: c.customerName,

                    totalDueAmount: c.totalDueAmount,
                    pendingInvoices: c.pendingInvoices,

                    oldestDueDate: c.oldestDueDate,
                    dueDays: c.dueDays,
                    latestDueDate: c.latestDueDate,

                    oldestBillAmount: c.oldestBillAmount,
                    oldestBillNo: c.oldestBillNo
                }))
        };
    }

// ==================================================
// LOST / INACTIVE CUSTOMERS
// ==================================================

if (intent === "LOST_CUSTOMERS") {

    const customers =
        normalizedData.customers || [];

    return {

        customers: customers

            // Most inactive/lost customers first
            .sort(
                (a, b) =>
                    Number(b.lastSaleDays || 0) -
                    Number(a.lastSaleDays || 0)
            )

            // Protect Groq from large datasets
            .slice(0, 50)

            .map(c => ({

                customerId:
                    c.customerId,

                customerName:
                    c.customerName,

                productName:
                    c.productName,

                paymentTerms:
                    c.paymentTerms,

                lastSaleDate:
                    c.lastSaleDate,

                daysSinceLastSale:
                    c.lastSaleDays,

                lastSaleAmount:
                    c.lastSaleAmount,

                lastInvoiceNo:
                    c.lastInvoiceNo,

                status:
                    c.customerStatus

            }))

    };
}

// ==================================================
// PRODUCT DECLINE
// ==================================================

if (intent === "PRODUCT_DECLINE") {

    const products =
        Array.isArray(normalizedData.products)
            ? [...normalizedData.products]
            : [];

    const q = String(question || "")
        .toLowerCase()
        .trim();

    const isSmallestDecline =
        q.includes("smallest decline") ||
        q.includes("lowest decline") ||
        q.includes("least decline") ||
        q.includes("minimum decline") ||
        q.includes("smallest drop") ||
        q.includes("lowest drop") ||
        q.includes("least drop") ||
        q.includes("minimum drop");

    if (isSmallestDecline) {

        products.sort((a, b) =>
            Number(a.gapToAverage || 0) -
            Number(b.gapToAverage || 0)
        );

    } else {

        products.sort((a, b) =>
            Number(b.gapToAverage || 0) -
            Number(a.gapToAverage || 0)
        );
    }

    const topProduct = products[0] || null;

    return {
        products: products
            .slice(0, 20)
            .map(p => ({
                productId: p.productId,
                productName: p.productName,
                avgLast6Months: p.avgLast6Months,
                currentMonthQty: p.currentMonthQty,
                gapToBest: p.gapToBest,
                gapToAverage: p.gapToAverage,
                productStatus: p.productStatus
            })),

        smallestDecline: isSmallestDecline
            ? topProduct
                ? {
                    productId: topProduct.productId,
                    productName: topProduct.productName,
                    gapToAverage: topProduct.gapToAverage
                }
                : null
            : null,

        largestDecline: !isSmallestDecline
            ? topProduct
                ? {
                    productId: topProduct.productId,
                    productName: topProduct.productName,
                    gapToAverage: topProduct.gapToAverage
                }
                : null
            : null
    };
}
  // ==================================================
// CUSTOMER FOLLOW-UP
// Deterministic priority before Groq.
// ==================================================

if (intent === "CUSTOMER_FOLLOW_UP") {

        const monthly =
            Array.isArray(normalizedData.monthlyFollowUp)
                ? normalizedData.monthlyFollowUp
                : [];

        const quarterly =
            Array.isArray(normalizedData.quarterlyFollowUp)
                ? normalizedData.quarterlyFollowUp
                : [];


        // ==================================================
        // FOLLOW-UP STATUS PRIORITY
        // ==================================================
        // Status is authoritative.
        //
        // Critical
        // Needs Follow-up
        // No Purchase
        // Normal
        //
        // IMPORTANT:
        // Monthly and Quarterly are sorted independently.
        // Never compare a monthly percentage with a quarterly
        // percentage.
        // ==================================================

        const statusPriority = {
            "Critical": 1,
            "Needs Follow-up": 2,
            "No Purchase": 3,
            "Normal": 4
        };


        const sortFollowUp = (rows) => {

            return [...rows].sort((a, b) => {

                const statusA =
                    statusPriority[a.followUpStatus] ?? 99;

                const statusB =
                    statusPriority[b.followUpStatus] ?? 99;

                // Status is ALWAYS primary.
                if (statusA !== statusB) {
                    return statusA - statusB;
                }

                // Within the SAME status only:
                // more negative growth = larger decline.
                const growthA =
                    Number(a.qtyGrowthPercent ?? 0);

                const growthB =
                    Number(b.qtyGrowthPercent ?? 0);

                if (growthA !== growthB) {
                    return growthA - growthB;
                }

                return String(a.customerName || "")
                    .localeCompare(
                        String(b.customerName || "")
                    );
            });
        };


        const sortedMonthly =
            sortFollowUp(monthly);

        const sortedQuarterly =
            sortFollowUp(quarterly);


        return {

            monthlyFollowUp:
                sortedMonthly
                    .slice(0, 20)
                    .map(row => ({
                        customerName:
                            row.customerName ?? null,

                        productName:
                            row.productName ?? null,

                        lastMonthQty:
                            Number(row.lastMonthQty ?? 0),

                        currentMonthQty:
                            Number(row.currentMonthQty ?? 0),

                        qtyDifference:
                            Number(row.qtyDifference ?? 0),

                        qtyGrowthPercent:
                            Number(row.qtyGrowthPercent ?? 0),

                        followUpStatus:
                            row.followUpStatus ?? null
                    })),

            quarterlyFollowUp:
                sortedQuarterly
                    .slice(0, 20)
                    .map(row => ({
                        customerName:
                            row.customerName ?? null,

                        productName:
                            row.productName ?? null,

                        lastQuarterAvgQty:
                            Number(row.lastQuarterAvgQty ?? 0),

                        currentQuarterAvgQty:
                            Number(row.currentQuarterAvgQty ?? 0),

                        qtyDifference:
                            Number(row.qtyDifference ?? 0),

                        qtyGrowthPercent:
                            Number(row.qtyGrowthPercent ?? 0),

                        followUpStatus:
                            row.followUpStatus ?? null
                    }))
        };
    }

// DEFAULT
    // ==================================================

    return normalizedData;
}


// ======================================================
// EXPORT ROUTER
// ======================================================


// ======================================================
// DETERMINISTIC COLLECTION ANALYSIS
// ======================================================
function analyzeCollectionQuestion(question, collections = []) {
    const q = String(question || "").toLowerCase();
    const rows = Array.isArray(collections) ? collections : [];

    const money = value =>
        Number(value || 0).toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });

    const delayed = rows
        .filter(r => Number(r.delayDays || 0) > 0)
        .sort((a, b) => Number(b.delayDays || 0) - Number(a.delayDays || 0));

    if (
        q.includes("how much have we collected") ||
        q.includes("how much did we collect") ||
        q.includes("how much was collected") ||
        q.includes("total collected") ||
        q.includes("total collection")
    ) {
        const total = rows.reduce(
            (sum, row) => sum + Number(row.amountReceived || 0),
            0
        );

        return {
            answer:
                "**Total collected:**\n\n" +
                `- **Amount collected:** ₹${money(total)}`,
            data: { totalCollected: total }
        };
    }

    if (
        q.includes("which product has the highest collection") ||
        q.includes("highest collection") && q.includes("product")
    ) {
        const totals = {};
        for (const row of rows) {
            const product = String(row.product || "Unknown Product").trim();
            totals[product] = (totals[product] || 0) + Number(row.amountReceived || 0);
        }

        const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
        if (!top) return null;

        return {
            answer:
                "**Product with the highest collection:**\\n\\n" +
                `**${top[0]}**\\n\\n` +
                `- **Collected amount:** ₹${money(top[1])}`,
            data: { product: top[0], amountReceived: top[1] }
        };
    }

    if (q.includes("which invoice has the highest collection")) {
        const top = [...rows].sort(
            (a, b) => Number(b.amountReceived || 0) - Number(a.amountReceived || 0)
        )[0];

        if (!top) return null;

        return {
            answer:
                "**Invoice with the highest collection:**\\n\\n" +
                `- **Invoice:** ${top.invoiceNo || "N/A"}\\n` +
                `- **Product:** ${top.product || "N/A"}\\n` +
                `- **Collected amount:** ₹${money(top.amountReceived)}`,
            data: top
        };
    }

    if (
        q.includes("which invoice had the longest collection delay") ||
        q.includes("longest collection delay")
    ) {
        const top = delayed[0];
        if (!top) return { answer: "No delayed collections were found.", data: null };

        return {
            answer:
                "**Longest collection delay:**\\n\\n" +
                `- **Invoice:** ${top.invoiceNo || "N/A"}\\n` +
                `- **Product:** ${top.product || "N/A"}\\n` +
                `- **Delay:** ${Number(top.delayDays || 0)} days\\n` +
                `- **Amount received:** ₹${money(top.amountReceived)}\\n` +
                `- **Interest loss:** ₹${money(top.interestLoss)}`,
            data: top
        };
    }

    if (
        q.includes("which product had the most delayed collections") ||
        q.includes("most delayed collections")
    ) {
        const counts = {};
        for (const row of delayed) {
            const product = String(row.product || "Unknown Product").trim();
            counts[product] = (counts[product] || 0) + 1;
        }

        const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
        if (!top) return { answer: "No delayed collections were found.", data: null };

        return {
            answer:
                "**Product with the most delayed collections:**\\n\\n" +
                `- **Product:** ${top[0]}\\n` +
                `- **Delayed collections:** ${top[1]}`,
            data: { product: top[0], delayedCollectionCount: top[1] }
        };
    }

    if (
        q.includes("which product caused the highest interest loss") ||
        (q.includes("highest interest loss") && q.includes("product"))
    ) {
        const totals = {};
        for (const row of rows) {
            const product = String(row.product || "Unknown Product").trim();
            totals[product] = (totals[product] || 0) + Number(row.interestLoss || 0);
        }

        const top = Object.entries(totals).sort((a, b) => b[1] - a[1])[0];
        if (!top) return null;

        return {
            answer:
                "**Product with the highest interest loss:**\\n\\n" +
                `- **Product:** ${top[0]}\\n` +
                `- **Interest loss:** ₹${money(top[1])}`,
            data: { product: top[0], interestLoss: top[1] }
        };
    }

    if (q.includes("how much interest loss occurred")) {
        const total = delayed.reduce(
            (sum, row) => sum + Number(row.interestLoss || 0), 0
        );

        return {
            answer:
                "**Interest loss from delayed collections:**\\n\\n" +
                `- **Delayed collections:** ${delayed.length}\\n` +
                `- **Interest loss:** ₹${money(total)}`,
            data: { delayedCollectionCount: delayed.length, interestLoss: total }
        };
    }

    if (
        q.includes("which collections were delayed") ||
        q.includes("which collection was delayed") ||
        q.includes("show delayed collections") ||
        q.includes("delayed collections")
    ) {
        const top = delayed.slice(0, 10);

        if (!top.length) {
            return {
                answer: "No delayed collections were found.",
                data: { delayedCollectionCount: 0, delayedCollections: [] }
            };
        }

        const lines = [
            "**Delayed Collections:**",
            "",
            `- **Total delayed collections:** ${delayed.length}`,
            "",
            "**Top delayed collections:**",
            ""
        ];

        top.forEach((row, index) => {
            lines.push(
                `${index + 1}. **Invoice ${row.invoiceNo || "N/A"}**`,
                `   - Product: ${row.product || "N/A"}`,
                `   - Invoice Date: ${row.invoiceDate || "N/A"}`,
                `   - Due Date: ${row.dueDate || "N/A"}`,
                `   - Received Date: ${row.receivedDate || "N/A"}`,
                `   - Amount Received: ₹${money(row.amountReceived)}`,
                `   - Delay: ${Number(row.delayDays || 0)} days`,
                `   - Interest Loss: ₹${money(row.interestLoss)}`,
                ""
            );
        });

        return {
            answer: lines.join("\\n"),
            data: {
                delayedCollectionCount: delayed.length,
                delayedCollections: delayed
            }
        };
    }

    return null;
}

module.exports = router;