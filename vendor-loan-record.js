// ---------------------------
// vendor-loan-record.js (FIXED)
// ---------------------------

document.addEventListener("DOMContentLoaded", () => {
  console.log("📄 vendor-loan-record.js loaded.");

  const barcodeInput = document.getElementById("product-barcode");
  if (barcodeInput) {
    barcodeInput.addEventListener("keypress", handleVendorLoanBarcode);
  }

  const productSelect = document.getElementById("product-select");
  if (productSelect) {
    productSelect.addEventListener("change", handleVendorLoanProductSelect);
  }

  const form = document.getElementById("add-loan-record-form");
  if (form) {
    form.addEventListener("submit", addLoanRecord);
  } else {
    console.warn("❌ add-loan-record-form not found");
  }
});

/* ---------------------------------------------------------
   A. BARCODE → Load product & batches
---------------------------------------------------------- */
async function handleVendorLoanBarcode(e) {
  if (e.key !== "Enter") return;
  e.preventDefault();

  const barcode = e.target.value.trim();
  if (!barcode) return;

  try {
    const supabase = await ensureSupabaseClient();

    const { data: product } = await supabase
      .from("products")
      .select("id, name, barcode, price")
      .eq("barcode", barcode)
      .maybeSingle();

    if (!product) {
      document.getElementById("stock-display").textContent = "Product not found";
      return;
    }

    const res = await loadProductAndBatches(product.id, false);

    document.getElementById("product-select").value = product.id;
    document.getElementById("selling-price").value = product.price || 0;

    applyVendorBatchLogic(res);
    e.target.value = "";

  } catch (err) {
    console.error("handleVendorLoanBarcode error:", err);
  }
}

/* ---------------------------------------------------------
   B. PRODUCT SELECT → Load batches
---------------------------------------------------------- */
async function handleVendorLoanProductSelect(e) {
  const productId = e.target.value;
  if (!productId) return;

  const res = await loadProductAndBatches(productId, false);
  applyVendorBatchLogic(res);
}

/* ---------------------------------------------------------
   Batch logic
---------------------------------------------------------- */
function applyVendorBatchLogic(res) {
  const batchEl = document.getElementById("batch-no");
  const stockDisplay = document.getElementById("stock-display");

  if (!batchEl) return;

  let batches = (res?.batches || []).filter(
    b => (b.remaining_quantity ?? 0) > 0
  );

  batchEl.innerHTML = batches
    .map(b =>
      `<option value="${b.id}">${b.batch_number} (Stock: ${b.remaining_quantity})</option>`
    )
    .join("");

  if (batches.length !== 1) {
    batchEl.insertAdjacentHTML(
      "afterbegin",
      `<option value="" disabled selected>-- Select Batch No. --</option>`
    );
  } else {
    batchEl.value = batches[0].id;
  }

  if (stockDisplay) {
    const total = batches.reduce((s, b) => s + b.remaining_quantity, 0);
    stockDisplay.textContent = `Stock: ${total}`;
  }
}

/* ---------------------------------------------------------
   ADD LOAN RECORD (FIXED)
---------------------------------------------------------- */
async function addLoanRecord(e) {
  e.preventDefault();

  const supabase = await ensureSupabaseClient();

  const vendorId = parseInt(document.getElementById("vendor-name").value, 10);
  const productId = parseInt(document.getElementById("product-select").value, 10);
  const batchId = parseInt(document.getElementById("batch-no").value, 10);
  const quantity = parseInt(document.getElementById("quantity").value, 10);
  const price = parseFloat(document.getElementById("selling-price").value);
  const loanDate = document.getElementById("loan-date").value;

  if (!vendorId || !productId || !batchId || quantity <= 0) {
    showError("Invalid input.");
    return;
  }

  // 1️⃣ Fetch batch stock
  const { data: batch, error: batchErr } = await supabase
    .from("product_batches")
    .select("remaining_quantity")
    .eq("id", batchId)
    .single();

  if (batchErr || !batch) {
    showError("Batch not found.");
    return;
  }

  if (quantity > batch.remaining_quantity) {
    showError("Not enough stock.");
    return;
  }

  // 2️⃣ INSERT (MATCHES NEW SCHEMA)
  const { error: loanErr } = await supabase
    .from("vendor_loans")
    .insert([{
      vendor_id: vendorId,
      product_id: productId,
      batch_id: batchId,
      quantity,
      selling_price: price,
      loan_date: loanDate
    }]);

  if (loanErr) {
    console.error("Insert error:", loanErr);
    showError(loanErr.message);
    return;
  }

  // 3️⃣ Update stock
  await supabase
    .from("product_batches")
    .update({
      remaining_quantity: batch.remaining_quantity - quantity
    })
    .eq("id", batchId);

  showMessage("✅ Loan added successfully");

  await loadLoanRecords();
}
