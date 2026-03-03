// ---------------------------
// customer-sales.js
// ---------------------------

document.addEventListener("DOMContentLoaded", () => {
    console.log("📄 customer-sales.js loaded.");

    const barcodeInput = document.getElementById("product-barcode");
    if (barcodeInput) {
        barcodeInput.addEventListener("keypress", handleCustomerSalesBarcode);
    }

    const productSelect = document.getElementById("product-select");
    if (productSelect) {
        productSelect.addEventListener("change", handleCustomerSalesProductSelect);
    }
});

/* ---------------------------------------------------------
   A. BARCODE → Load product & batches (NO auto-add-to-cart)
---------------------------------------------------------- */
async function handleCustomerSalesBarcode(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();

    const barcode = e.target.value.trim();
    if (!barcode) return;

    try {
        const supabase = await ensureSupabaseClient();

        // Look up product
        const { data: product } = await supabase
            .from("products")
            .select("id, name, price, barcode")
            .eq("barcode", barcode)
            .limit(1)
            .maybeSingle();

        if (!product) {
            document.getElementById("stock-display").textContent = "Product not found";
            return;
        }

        // Load batches
        const res = await loadProductAndBatches(product.id, false);

        // Update product dropdown
        const productSelect = document.getElementById("product-select");
        if (productSelect) productSelect.value = product.id;

        // Fill price (but do not add to cart)
        const priceInput = document.getElementById("selling-price");
        if (priceInput) priceInput.value = product.price || 0;

        // Apply batch selection logic
        applyBatchSelectionLogic(res);

        // Clear barcode input
        e.target.value = "";

    } catch (error) {
        console.error("handleCustomerSalesBarcode error:", error);
    }
}

/* ---------------------------------------------------------
   B. PRODUCT SELECT → Load batches
---------------------------------------------------------- */
async function handleCustomerSalesProductSelect(e) {
    const productId = e.target.value;
    if (!productId) return;

    const res = await loadProductAndBatches(productId, false);
    applyBatchSelectionLogic(res);
}

/* ---------------------------------------------------------
   Common batch-selection logic
---------------------------------------------------------- */
function applyBatchSelectionLogic(res) {
    const batchEl = document.getElementById("batch-no");
    const stockDisplay = document.getElementById("stock-display");

    if (!batchEl) return;

    batchEl.innerHTML = "";

    let batches = res?.batches || [];

// 🔥 Filter out zero-stock batches
batches = batches.filter(b => (b.remaining_quantity ?? 0) > 0);

// Populate filtered batches
batchEl.innerHTML = batches
    .map(b => `<option value="${b.id}">${b.batch_number} (Stock: ${b.remaining_quantity})</option>`)
    .join("");

    // Auto-select only if EXACTLY ONE batch
    if (batches.length === 1) {
        batchEl.value = batches[0].id;
    } else {
        batchEl.insertAdjacentHTML(
            "afterbegin",
            `<option value="" disabled selected>-- Select Batch No. --</option>`
        );
    }

    // Stock display
    if (stockDisplay) {
        const total = batches.reduce((s, b) => s + (b.remaining_quantity || 0), 0);
        stockDisplay.textContent = `Stock: ${total}`;
    }
}
