let companyProfitRows = [];
let companyPaymentRows = [];

function buildEmptyCompanyProfitRow() {
  return {
    id: crypto.randomUUID(),
    category_type: "공정",
    item_name: "",
    customer_amount: 0,
    labor_vendor_amount: 0,
    material_vendor_amount: 0,
    expense_vendor_amount: 0,
    estimated_cost_amount: 0,
    payout_amount: 0,
    estimated_profit_amount: 0,
    actual_profit_amount: 0,
    note: ""
  };
}

function buildEmptyPaymentRow() {
  return {
    id: crypto.randomUUID(),
    payment_type: "가계약금",
    payment_round: "",
    amount: 0,
    payment_date: "",
    note: ""
  };
}

function calcCompanyProfitRow(row) {
  row.customer_amount = toNum(row.customer_amount);
  row.labor_vendor_amount = toNum(row.labor_vendor_amount);
  row.material_vendor_amount = toNum(row.material_vendor_amount);
  row.expense_vendor_amount = toNum(row.expense_vendor_amount);
  row.payout_amount = toNum(row.payout_amount);

  row.estimated_cost_amount =
    row.labor_vendor_amount +
    row.material_vendor_amount +
    row.expense_vendor_amount;

  row.estimated_profit_amount =
    row.customer_amount - row.estimated_cost_amount;

  row.actual_profit_amount =
    row.customer_amount - row.payout_amount;
}

function addCompanyProfitRow() {
  companyProfitRows.push(buildEmptyCompanyProfitRow());
  renderCompanyProfitRows();
  refreshCompanySummary();
}

function removeCompanyProfitRow(id) {
  companyProfitRows = companyProfitRows.filter(row => row.id !== id);
  if (companyProfitRows.length === 0) {
    companyProfitRows.push(buildEmptyCompanyProfitRow());
  }
  renderCompanyProfitRows();
  refreshCompanySummary();
}

function updateCompanyProfitRow(id, key, value) {
  const row = companyProfitRows.find(r => r.id === id);
  if (!row) return;

  if ([
    "customer_amount",
    "labor_vendor_amount",
    "material_vendor_amount",
    "expense_vendor_amount",
    "payout_amount"
  ].includes(key)) {
    row[key] = toNum(value);
  } else {
    row[key] = value;
  }

  calcCompanyProfitRow(row);
  renderCompanyProfitRows();
  refreshCompanySummary();
}

function renderCompanyProfitRows() {
  const body = document.getElementById("companyProfitBody");
  if (!body) return;

  body.innerHTML = "";

  companyProfitRows.forEach((row, idx) => {
    calcCompanyProfitRow(row);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="align-center">${idx + 1}</td>
      <td>
        <select onchange="updateCompanyProfitRow('${row.id}','category_type',this.value)">
          <option value="공정" ${row.category_type === "공정" ? "selected" : ""}>공정</option>
          <option value="기타공사비" ${row.category_type === "기타공사비" ? "selected" : ""}>기타공사비</option>
          <option value="폐기물비" ${row.category_type === "폐기물비" ? "selected" : ""}>폐기물비</option>
          <option value="산재비용" ${row.category_type === "산재비용" ? "selected" : ""}>산재비용</option>
          <option value="현장직접관리비" ${row.category_type === "현장직접관리비" ? "selected" : ""}>현장직접관리비</option>
          <option value="회사배부관리비" ${row.category_type === "회사배부관리비" ? "selected" : ""}>회사배부관리비</option>
        </select>
      </td>
      <td><input value="${escapeHtml(row.item_name)}" onchange="updateCompanyProfitRow('${row.id}','item_name',this.value)" /></td>
      <td><input type="number" value="${row.customer_amount}" onchange="updateCompanyProfitRow('${row.id}','customer_amount',this.value)" /></td>
<td><input type="number" value="${row.labor_vendor_amount}" onchange="updateCompanyProfitRow('${row.id}','labor_vendor_amount',this.value)" /></td>
<td><input type="number" value="${row.material_vendor_amount}" onchange="updateCompanyProfitRow('${row.id}','material_vendor_amount',this.value)" /></td>
<td><input type="number" value="${row.expense_vendor_amount}" onchange="updateCompanyProfitRow('${row.id}','expense_vendor_amount',this.value)" /></td>
<td><input type="number" value="${row.payout_amount}" onchange="updateCompanyProfitRow('${row.id}','payout_amount',this.value)" /></td>
      <td class="align-right">${formatWon(row.estimated_profit_amount)}</td>
      <td class="align-right">${formatWon(row.actual_profit_amount)}</td>
      <td><input value="${escapeHtml(row.note)}" onchange="updateCompanyProfitRow('${row.id}','note',this.value)" /></td>
      <td><button class="table-btn delete-btn" onclick="removeCompanyProfitRow('${row.id}')">삭제</button></td>
    `;
    body.appendChild(tr);
  });
}

function addPaymentRow() {
  companyPaymentRows.push(buildEmptyPaymentRow());
  renderPaymentRows();
  refreshCompanySummary();
}

function removePaymentRow(id) {
  companyPaymentRows = companyPaymentRows.filter(row => row.id !== id);
  if (companyPaymentRows.length === 0) {
    companyPaymentRows.push(buildEmptyPaymentRow());
  }
  renderPaymentRows();
  refreshCompanySummary();
}

function updatePaymentRow(id, key, value) {
  const row = companyPaymentRows.find(r => r.id === id);
  if (!row) return;

  if (key === "amount") {
    row[key] = toNum(value);
  } else {
    row[key] = value;
  }

  renderPaymentRows();
  refreshCompanySummary();
}

function renderPaymentRows() {
  const body = document.getElementById("companyPaymentBody");
  if (!body) return;

  body.innerHTML = "";

  companyPaymentRows.forEach((row, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="align-center">${idx + 1}</td>
      <td>
        <select onchange="updatePaymentRow('${row.id}','payment_type',this.value)">
          <option value="가계약금" ${row.payment_type === "가계약금" ? "selected" : ""}>가계약금</option>
          <option value="본계약금" ${row.payment_type === "본계약금" ? "selected" : ""}>본계약금</option>
          <option value="중도금" ${row.payment_type === "중도금" ? "selected" : ""}>중도금</option>
          <option value="추가금" ${row.payment_type === "추가금" ? "selected" : ""}>추가금</option>
          <option value="잔금" ${row.payment_type === "잔금" ? "selected" : ""}>잔금</option>
        </select>
      </td>
     <td><input type="number" min="1" max="5" value="${row.payment_round}" onchange="updatePaymentRow('${row.id}','payment_round',this.value)" /></td>
<td><input type="number" value="${row.amount}" onchange="updatePaymentRow('${row.id}','amount',this.value)" /></td>
      <td><input type="date" value="${row.payment_date}" onchange="updatePaymentRow('${row.id}','payment_date',this.value)" /></td>
      <td><input value="${escapeHtml(row.note)}" onchange="updatePaymentRow('${row.id}','note',this.value)" /></td>
      <td><button class="table-btn delete-btn" onclick="removePaymentRow('${row.id}')">삭제</button></td>
    `;
    body.appendChild(tr);
  });
}

function refreshCompanySummary() {
  const totalSales = companyProfitRows.reduce((sum, row) => sum + toNum(row.customer_amount), 0);
  const totalEstimatedCost = companyProfitRows.reduce((sum, row) => sum + toNum(row.estimated_cost_amount), 0);
  const totalActualCost = companyProfitRows.reduce((sum, row) => sum + toNum(row.payout_amount), 0);
  const totalEstimatedProfit = companyProfitRows.reduce((sum, row) => sum + toNum(row.estimated_profit_amount), 0);
  const totalActualProfit = companyProfitRows.reduce((sum, row) => sum + toNum(row.actual_profit_amount), 0);
  const totalReceived = companyPaymentRows.reduce((sum, row) => sum + toNum(row.amount), 0);

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = formatWon(value);
  };

  setText("companyTotalSales", totalSales);
  setText("companyTotalEstimatedCost", totalEstimatedCost);
  setText("companyTotalActualCost", totalActualCost);
  setText("companyTotalEstimatedProfit", totalEstimatedProfit);
  setText("companyTotalActualProfit", totalActualProfit);
  setText("companyTotalReceived", totalReceived);
}

function calcMonthlyCompanyCost() {
  const staff = toNum(document.getElementById("monthlyStaffSalary")?.value);
  const insurance = toNum(document.getElementById("monthlyFixedInsurance")?.value);
  const rent = toNum(document.getElementById("monthlyRent")?.value);
  const other = toNum(document.getElementById("monthlyOtherExpense")?.value);
  const owner = toNum(document.getElementById("monthlyOwnerSalary")?.value);

  const total = staff + insurance + rent + other + owner;
  const totalBox = document.getElementById("monthlyTotalCompanyCost");
  if (totalBox) totalBox.value = formatWon(total);
}

function getCurrentQuoteStatus() {
  return document.getElementById("quote_status")?.value || "";
}

function getCurrentContractDate() {
  return document.getElementById("contract_date")?.value || "";
}

function getCurrentQuoteNo() {
  return document.getElementById("quote_no")?.value.trim() || "";
}

function normalizeWorkName(name) {
  return String(name || "").replace(/\s+/g, "").trim();
}

function buildCompanyRowsFromDetail() {
  const grouped = new Map();

  detailRows
    .filter(isMeaningfulRow)
    .forEach(row => {
      updateComputedAmounts(row);

      const workName = normalizeWorkName(row.work_name || "미분류") || "미분류";

      if (!grouped.has(workName)) {
        grouped.set(workName, {
          id: crypto.randomUUID(),
          category_type: "공정",
          item_name: workName,
          customer_amount: 0,
          labor_vendor_amount: 0,
          material_vendor_amount: 0,
          expense_vendor_amount: 0,
          estimated_cost_amount: 0,
          payout_amount: 0,
          estimated_profit_amount: 0,
          actual_profit_amount: 0,
          note: ""
        });
      }

      const item = grouped.get(workName);
      const qty = toNum(row.qty);

      item.customer_amount += toNum(row.line_amount);
      item.labor_vendor_amount += toNum(row.cost_labor) * qty;
      item.material_vendor_amount += toNum(row.cost_material) * qty;
      item.expense_vendor_amount += toNum(row.cost_expense) * qty;
    });

  const rows = Array.from(grouped.values());

  rows.forEach(calcCompanyProfitRow);

  rows.sort((a, b) => {
    const orderA = typeof getWorkOrderIndex === "function" ? getWorkOrderIndex(a.item_name) : 9999;
    const orderB = typeof getWorkOrderIndex === "function" ? getWorkOrderIndex(b.item_name) : 9999;
    if (orderA !== orderB) return orderA - orderB;
    return a.item_name.localeCompare(b.item_name, "ko");
  });

  return rows;
}

function importCompanyRowsFromDetail() {
  const imported = buildCompanyRowsFromDetail();

  if (!imported.length) {
    alert("견적상세에 불러올 공정이 없습니다.");
    return;
  }

  companyProfitRows = imported;
  renderCompanyProfitRows();
  refreshCompanySummary();
  alert("견적상세 공정 불러오기 완료");
}

async function saveMonthlyCompanyCost() {
  try {
    const monthValue = document.getElementById("companyCostMonth").value;
    if (!monthValue) {
      alert("기준월을 선택하세요.");
      return;
    }

    const costMonth = `${monthValue}-01`;
    const staff = toNum(document.getElementById("monthlyStaffSalary").value);
    const insurance = toNum(document.getElementById("monthlyFixedInsurance").value);
    const rent = toNum(document.getElementById("monthlyRent").value);
    const other = toNum(document.getElementById("monthlyOtherExpense").value);
    const owner = toNum(document.getElementById("monthlyOwnerSalary").value);
    const total = staff + insurance + rent + other + owner;

    const { error } = await db
      .from("company_monthly_costs")
      .upsert([{
        cost_month: costMonth,
        staff_salary_amount: staff,
        fixed_insurance_amount: insurance,
        monthly_rent_amount: rent,
        other_expense_amount: other,
        owner_salary_amount: owner,
        total_company_cost_amount: total,
        note: ""
      }], { onConflict: "cost_month" });

    if (error) throw error;

    calcMonthlyCompanyCost();
    alert("월고정비 저장 완료");
  } catch (err) {
    console.error(err);
    alert("월고정비 저장 실패: " + err.message);
  }
}

async function loadMonthlyCompanyCostForCurrentMonth() {
  try {
    const monthValue = document.getElementById("companyCostMonth")?.value;
    if (!monthValue) return;

    const costMonth = `${monthValue}-01`;

    const { data, error } = await db
      .from("company_monthly_costs")
      .select("*")
      .eq("cost_month", costMonth)
      .maybeSingle();

    if (error) throw error;
    if (!data) return;

    document.getElementById("monthlyStaffSalary").value = toNum(data.staff_salary_amount);
    document.getElementById("monthlyFixedInsurance").value = toNum(data.fixed_insurance_amount);
    document.getElementById("monthlyRent").value = toNum(data.monthly_rent_amount);
    document.getElementById("monthlyOtherExpense").value = toNum(data.other_expense_amount);
    document.getElementById("monthlyOwnerSalary").value = toNum(data.owner_salary_amount);

    calcMonthlyCompanyCost();
  } catch (err) {
    console.error(err);
  }
}

async function allocateMonthlyCompanyCost() {
  try {
    const monthValue = document.getElementById("companyCostMonth")?.value;
    if (!monthValue) {
      alert("기준월을 선택하세요.");
      return;
    }

    const costMonth = `${monthValue}-01`;
    const allocationMethod = document.getElementById("companyAllocationMethod")?.value || "매출비례";

    const { data: monthlyCost, error: monthlyError } = await db
      .from("company_monthly_costs")
      .select("*")
      .eq("cost_month", costMonth)
      .maybeSingle();

    if (monthlyError) throw monthlyError;
    if (!monthlyCost) {
      alert("먼저 해당 월의 회사고정비를 저장하세요.");
      return;
    }

    const { data: masters, error: mastersError } = await db
      .from("profit_master")
      .select(`
        *,
        quotes (
          quote_status,
          contract_date
        )
      `);

    if (mastersError) throw mastersError;

    const validRows = (masters || []).filter(row => {
      const status = row.quotes?.quote_status || "";
      const contractDate = row.contract_date || row.quotes?.contract_date || "";
      return (
        (status === "확정견적" || status === "공사완료") &&
        String(contractDate).substring(0, 7) === monthValue
      );
    });

    if (!validRows.length) {
      alert("해당 월에 배부할 확정견적/공사완료 현장이 없습니다.");
      return;
    }

    const totalSalesBasis = validRows.reduce((sum, row) => sum + toNum(row.total_sales_amount), 0);

    const { error: deleteAllocError } = await db
      .from("company_cost_allocations")
      .delete()
      .eq("cost_month", costMonth);

    if (deleteAllocError) throw deleteAllocError;

    const payloads = validRows.map(row => {
      let rate = 0;

      if (allocationMethod === "균등배부") {
        rate = 1 / validRows.length;
      } else if (allocationMethod === "매출비례") {
        rate = totalSalesBasis === 0 ? 0 : toNum(row.total_sales_amount) / totalSalesBasis;
      } else {
        rate = 0;
      }

      const allocatedStaff = Math.round(toNum(monthlyCost.staff_salary_amount) * rate);
      const allocatedInsurance = Math.round(toNum(monthlyCost.fixed_insurance_amount) * rate);
      const allocatedRent = Math.round(toNum(monthlyCost.monthly_rent_amount) * rate);
      const allocatedOther = Math.round(toNum(monthlyCost.other_expense_amount) * rate);
      const allocatedOwner = Math.round(toNum(monthlyCost.owner_salary_amount) * rate);

      return {
        cost_month: costMonth,
        quote_id: row.quote_id,
        site_id: row.site_id,
        allocation_method: allocationMethod,
        sales_basis_amount: toNum(row.total_sales_amount),
        allocation_rate: rate,
        allocated_staff_salary_amount: allocatedStaff,
        allocated_fixed_insurance_amount: allocatedInsurance,
        allocated_monthly_rent_amount: allocatedRent,
        allocated_other_expense_amount: allocatedOther,
        allocated_owner_salary_amount: allocatedOwner,
        total_allocated_amount:
          allocatedStaff +
          allocatedInsurance +
          allocatedRent +
          allocatedOther +
          allocatedOwner
      };
    });

    const { error: insertAllocError } = await db
      .from("company_cost_allocations")
      .insert(payloads);

    if (insertAllocError) throw insertAllocError;

    alert("회사배부관리비 자동 배부 완료");
  } catch (err) {
    console.error(err);
    alert("회사배부관리비 자동 배부 실패: " + err.message);
  }
}

async function loadAllocationIntoCurrentQuote() {
  try {
    const quoteNo = getCurrentQuoteNo();
    const monthValue = document.getElementById("companyCostMonth")?.value;

    if (!quoteNo) {
      alert("현재 견적번호가 없습니다.");
      return;
    }
    if (!monthValue) {
      alert("기준월을 선택하세요.");
      return;
    }

    const costMonth = `${monthValue}-01`;

    const { data: quoteRow, error: quoteError } = await db
      .from("quotes")
      .select("*")
      .eq("quote_no", quoteNo)
      .maybeSingle();

    if (quoteError) throw quoteError;
    if (!quoteRow) {
      alert("해당 견적을 찾을 수 없습니다.");
      return;
    }

    const { data: allocRow, error: allocError } = await db
      .from("company_cost_allocations")
      .select("*")
      .eq("cost_month", costMonth)
      .eq("quote_id", quoteRow.id)
      .maybeSingle();

    if (allocError) throw allocError;
    if (!allocRow) {
      alert("해당 견적에 대한 회사배부관리비 배부내역이 없습니다.");
      return;
    }

    companyProfitRows = companyProfitRows.filter(row =>
      row.category_type !== "회사배부관리비"
    );

    const allocItems = [
      {
        id: crypto.randomUUID(),
        category_type: "회사배부관리비",
        item_name: "직원 월급",
        customer_amount: 0,
        labor_vendor_amount: 0,
        material_vendor_amount: 0,
        expense_vendor_amount: toNum(allocRow.allocated_staff_salary_amount),
        estimated_cost_amount: 0,
        payout_amount: toNum(allocRow.allocated_staff_salary_amount),
        estimated_profit_amount: 0,
        actual_profit_amount: 0,
        note: "자동배부"
      },
      {
        id: crypto.randomUUID(),
        category_type: "회사배부관리비",
        item_name: "고정보험료",
        customer_amount: 0,
        labor_vendor_amount: 0,
        material_vendor_amount: 0,
        expense_vendor_amount: toNum(allocRow.allocated_fixed_insurance_amount),
        estimated_cost_amount: 0,
        payout_amount: toNum(allocRow.allocated_fixed_insurance_amount),
        estimated_profit_amount: 0,
        actual_profit_amount: 0,
        note: "자동배부"
      },
      {
        id: crypto.randomUUID(),
        category_type: "회사배부관리비",
        item_name: "월 임대료",
        customer_amount: 0,
        labor_vendor_amount: 0,
        material_vendor_amount: 0,
        expense_vendor_amount: toNum(allocRow.allocated_monthly_rent_amount),
        estimated_cost_amount: 0,
        payout_amount: toNum(allocRow.allocated_monthly_rent_amount),
        estimated_profit_amount: 0,
        actual_profit_amount: 0,
        note: "자동배부"
      },
      {
        id: crypto.randomUUID(),
        category_type: "회사배부관리비",
        item_name: "기타지출비",
        customer_amount: 0,
        labor_vendor_amount: 0,
        material_vendor_amount: 0,
        expense_vendor_amount: toNum(allocRow.allocated_other_expense_amount),
        estimated_cost_amount: 0,
        payout_amount: toNum(allocRow.allocated_other_expense_amount),
        estimated_profit_amount: 0,
        actual_profit_amount: 0,
        note: "자동배부"
      },
      {
        id: crypto.randomUUID(),
        category_type: "회사배부관리비",
        item_name: "사장 급여",
        customer_amount: 0,
        labor_vendor_amount: 0,
        material_vendor_amount: 0,
        expense_vendor_amount: toNum(allocRow.allocated_owner_salary_amount),
        estimated_cost_amount: 0,
        payout_amount: toNum(allocRow.allocated_owner_salary_amount),
        estimated_profit_amount: 0,
        actual_profit_amount: 0,
        note: "자동배부"
      }
    ];

    allocItems.forEach(calcCompanyProfitRow);
    companyProfitRows = companyProfitRows.concat(allocItems);

    renderCompanyProfitRows();
    refreshCompanySummary();

    alert("현재 견적에 회사배부관리비 반영 완료");
  } catch (err) {
    console.error(err);
    alert("회사배부관리비 반영 실패: " + err.message);
  }
}

async function saveCompanyProfit() {
  try {
    const quoteNo = getCurrentQuoteNo();
    if (!quoteNo) {
      alert("현재 견적번호가 없습니다.");
      return;
    }

    const { data: quoteRow, error: quoteError } = await db
      .from("quotes")
      .select("*")
      .eq("quote_no", quoteNo)
      .maybeSingle();

    if (quoteError) throw quoteError;
    if (!quoteRow) {
      alert("먼저 기본 견적 저장을 완료하세요.");
      return;
    }

    const totalSales = companyProfitRows.reduce((sum, row) => sum + toNum(row.customer_amount), 0);
    const totalEstimatedCost = companyProfitRows.reduce((sum, row) => sum + toNum(row.estimated_cost_amount), 0);
    const totalActualCost = companyProfitRows.reduce((sum, row) => sum + toNum(row.payout_amount), 0);
    const totalEstimatedProfit = companyProfitRows.reduce((sum, row) => sum + toNum(row.estimated_profit_amount), 0);
    const totalActualProfit = companyProfitRows.reduce((sum, row) => sum + toNum(row.actual_profit_amount), 0);
    const totalReceived = companyPaymentRows.reduce((sum, row) => sum + toNum(row.amount), 0);
    const outstanding = totalSales - totalReceived;
    const profitRate = totalSales === 0 ? 0 : (totalActualProfit / totalSales) * 100;

    const masterPayload = {
      quote_id: quoteRow.id,
      quote_no: quoteRow.quote_no,
      customer_id: quoteRow.customer_id,
      site_id: quoteRow.site_id,
      contract_date: quoteRow.contract_date,
      total_sales_amount: totalSales,
      total_estimated_cost: totalEstimatedCost,
      total_actual_cost: totalActualCost,
      total_estimated_profit: totalEstimatedProfit,
      total_actual_profit: totalActualProfit,
      total_received_amount: totalReceived,
      total_outstanding_amount: outstanding,
      total_profit_rate: profitRate,
      memo: ""
    };

    const { data: existingMaster, error: findMasterError } = await db
      .from("profit_master")
      .select("*")
      .eq("quote_id", quoteRow.id)
      .maybeSingle();

    if (findMasterError) throw findMasterError;

    let masterId;

    if (existingMaster) {
      const { error: updateMasterError } = await db
        .from("profit_master")
        .update(masterPayload)
        .eq("id", existingMaster.id);

      if (updateMasterError) throw updateMasterError;
      masterId = existingMaster.id;

      const { error: deleteItemsError } = await db
        .from("profit_items")
        .delete()
        .eq("profit_master_id", masterId);

      if (deleteItemsError) throw deleteItemsError;
    } else {
      const { data: insertedMaster, error: insertMasterError } = await db
        .from("profit_master")
        .insert([masterPayload])
        .select()
        .single();

      if (insertMasterError) throw insertMasterError;
      masterId = insertedMaster.id;
    }

    const itemPayloads = companyProfitRows.map((row, idx) => ({
      profit_master_id: masterId,
      line_no: idx + 1,
      category_type: row.category_type,
      item_name: row.item_name,
      customer_amount: toNum(row.customer_amount),
      labor_vendor_amount: toNum(row.labor_vendor_amount),
      material_vendor_amount: toNum(row.material_vendor_amount),
      expense_vendor_amount: toNum(row.expense_vendor_amount),
      estimated_cost_amount: toNum(row.estimated_cost_amount),
      payout_amount: toNum(row.payout_amount),
      estimated_profit_amount: toNum(row.estimated_profit_amount),
      actual_profit_amount: toNum(row.actual_profit_amount),
      note: row.note || ""
    }));

    if (itemPayloads.length > 0) {
      const { error: insertItemsError } = await db
        .from("profit_items")
        .insert(itemPayloads);

      if (insertItemsError) throw insertItemsError;
    }

    alert("회사수익 저장 완료");
    await loadCompanyDashboards();
  } catch (err) {
    console.error(err);
    alert("회사수익 저장 실패: " + err.message);
  }
}

async function savePayments() {
  try {
    const quoteNo = getCurrentQuoteNo();
    if (!quoteNo) {
      alert("현재 견적번호가 없습니다.");
      return;
    }

    const { data: quoteRow, error: quoteError } = await db
      .from("quotes")
      .select("*")
      .eq("quote_no", quoteNo)
      .maybeSingle();

    if (quoteError) throw quoteError;
    if (!quoteRow) {
      alert("먼저 기본 견적 저장을 완료하세요.");
      return;
    }

    const { error: deletePaymentsError } = await db
      .from("payments")
      .delete()
      .eq("quote_id", quoteRow.id);

    if (deletePaymentsError) throw deletePaymentsError;

    const paymentPayloads = companyPaymentRows.map(row => ({
      quote_id: quoteRow.id,
      payment_type: row.payment_type,
      payment_round: row.payment_type === "중도금" && row.payment_round ? toNum(row.payment_round) : null,
      amount: toNum(row.amount),
      payment_date: row.payment_date || null,
      note: row.note || ""
    }));

    if (paymentPayloads.length > 0) {
      const { error: insertPaymentsError } = await db
        .from("payments")
        .insert(paymentPayloads);

      if (insertPaymentsError) throw insertPaymentsError;
    }

    refreshCompanySummary();
    alert("입금내역 저장 완료");
  } catch (err) {
    console.error(err);
    alert("입금내역 저장 실패: " + err.message);
  }
}

async function loadCompanyProfitByCurrentQuote() {
  try {
    const quoteNo = getCurrentQuoteNo();
    if (!quoteNo) {
      alert("현재 견적번호가 없습니다.");
      return;
    }

    const { data: quoteRow, error: quoteError } = await db
      .from("quotes")
      .select("*")
      .eq("quote_no", quoteNo)
      .maybeSingle();

    if (quoteError) throw quoteError;
    if (!quoteRow) {
      alert("해당 견적이 없습니다.");
      return;
    }

    const { data: masterRow, error: masterError } = await db
      .from("profit_master")
      .select("*")
      .eq("quote_id", quoteRow.id)
      .maybeSingle();

    if (masterError) throw masterError;

    const { data: itemRows, error: itemsError } = await db
      .from("profit_items")
      .select("*")
      .eq("profit_master_id", masterRow?.id || 0)
      .order("line_no", { ascending: true });

    if (itemsError && masterRow) throw itemsError;

    const { data: paymentRows, error: paymentsError } = await db
      .from("payments")
      .select("*")
      .eq("quote_id", quoteRow.id)
      .order("payment_date", { ascending: true });

    if (paymentsError) throw paymentsError;

    companyProfitRows = (itemRows || []).map(row => ({
      id: crypto.randomUUID(),
      category_type: row.category_type || "공정",
      item_name: row.item_name || "",
      customer_amount: toNum(row.customer_amount),
      labor_vendor_amount: toNum(row.labor_vendor_amount),
      material_vendor_amount: toNum(row.material_vendor_amount),
      expense_vendor_amount: toNum(row.expense_vendor_amount),
      estimated_cost_amount: toNum(row.estimated_cost_amount),
      payout_amount: toNum(row.payout_amount),
      estimated_profit_amount: toNum(row.estimated_profit_amount),
      actual_profit_amount: toNum(row.actual_profit_amount),
      note: row.note || ""
    }));

    companyPaymentRows = (paymentRows || []).map(row => ({
      id: crypto.randomUUID(),
      payment_type: row.payment_type || "가계약금",
      payment_round: row.payment_round || "",
      amount: toNum(row.amount),
      payment_date: row.payment_date || "",
      note: row.note || ""
    }));

    if (companyProfitRows.length === 0) companyProfitRows = buildCompanyRowsFromDetail();
    if (companyProfitRows.length === 0) companyProfitRows = [buildEmptyCompanyProfitRow()];
    if (companyPaymentRows.length === 0) companyPaymentRows = [buildEmptyPaymentRow()];

    renderCompanyProfitRows();
    renderPaymentRows();
    refreshCompanySummary();

    alert("회사관리 불러오기 완료");
  } catch (err) {
    console.error(err);
    alert("회사관리 불러오기 실패: " + err.message);
  }
}

async function loadCompanyDashboards() {
  try {
    const { data: masters, error } = await db
      .from("profit_master")
      .select(`
        *,
        quotes (
          quote_status,
          contract_date
        ),
        sites (
          site_name
        )
      `);

    if (error) throw error;

    const validRows = (masters || []).filter(row => {
      const status = row.quotes?.quote_status || "";
      return (status === "확정견적" || status === "공사완료") && !!row.contract_date;
    });

    renderSiteSummary(validRows);
    renderMonthSummary(validRows);
    renderYearSummary(validRows);
  } catch (err) {
    console.error(err);
  }
}

function renderSiteSummary(rows) {
  const box = document.getElementById("siteSummaryList");
  if (!box) return;

  if (!rows.length) {
    box.innerHTML = "아직 집계 없음";
    return;
  }

  const map = new Map();

  rows.forEach(row => {
    const key = row.sites?.site_name || "현장명없음";
    if (!map.has(key)) {
      map.set(key, { sales: 0, cost: 0, profit: 0 });
    }
    const item = map.get(key);
    item.sales += toNum(row.total_sales_amount);
    item.cost += toNum(row.total_actual_cost);
    item.profit += toNum(row.total_actual_profit);
  });

  let html = "";
  for (const [name, val] of map.entries()) {
    html += `
      <div class="work-summary-item">
        <span>${escapeHtml(name)}</span>
        <strong>${formatWon(val.profit)}</strong>
      </div>
      <div style="font-size:12px; margin-bottom:10px;">
        매출 ${formatWon(val.sales)} / 매입 ${formatWon(val.cost)}
      </div>
    `;
  }
  box.innerHTML = html;
}

function renderMonthSummary(rows) {
  const box = document.getElementById("monthSummaryList");
  if (!box) return;

  if (!rows.length) {
    box.innerHTML = "아직 집계 없음";
    return;
  }

  const map = new Map();

  rows.forEach(row => {
    const d = row.contract_date;
    const key = String(d).substring(0, 7);
    if (!map.has(key)) {
      map.set(key, { sales: 0, cost: 0, profit: 0 });
    }
    const item = map.get(key);
    item.sales += toNum(row.total_sales_amount);
    item.cost += toNum(row.total_actual_cost);
    item.profit += toNum(row.total_actual_profit);
  });

  let html = "";
  Array.from(map.entries()).sort().forEach(([month, val]) => {
    html += `
      <div class="work-summary-item">
        <span>${month}</span>
        <strong>${formatWon(val.profit)}</strong>
      </div>
      <div style="font-size:12px; margin-bottom:10px;">
        매출 ${formatWon(val.sales)} / 매입 ${formatWon(val.cost)}
      </div>
    `;
  });

  box.innerHTML = html;
}

function renderYearSummary(rows) {
  const box = document.getElementById("yearSummaryList");
  if (!box) return;

  if (!rows.length) {
    box.innerHTML = "아직 집계 없음";
    return;
  }

  const map = new Map();

  rows.forEach(row => {
    const d = row.contract_date;
    const key = String(d).substring(0, 4);
    if (!map.has(key)) {
      map.set(key, { sales: 0, cost: 0, profit: 0 });
    }
    const item = map.get(key);
    item.sales += toNum(row.total_sales_amount);
    item.cost += toNum(row.total_actual_cost);
    item.profit += toNum(row.total_actual_profit);
  });

  let html = "";
  Array.from(map.entries()).sort().forEach(([year, val]) => {
    html += `
      <div class="work-summary-item">
        <span>${year}</span>
        <strong>${formatWon(val.profit)}</strong>
      </div>
      <div style="font-size:12px; margin-bottom:10px;">
        매출 ${formatWon(val.sales)} / 매입 ${formatWon(val.cost)}
      </div>
    `;
  });

  box.innerHTML = html;
}

function initCompanyTab() {
  if (companyProfitRows.length === 0) {
    const imported = buildCompanyRowsFromDetail();
    companyProfitRows = imported.length ? imported : [buildEmptyCompanyProfitRow()];
  }

  if (companyPaymentRows.length === 0) {
    companyPaymentRows = [buildEmptyPaymentRow()];
  }

  const costMonthInput = document.getElementById("companyCostMonth");
  if (costMonthInput && !costMonthInput.value) {
    const contractDate = getCurrentContractDate();
    if (contractDate) {
      costMonthInput.value = String(contractDate).substring(0, 7);
    } else {
      const now = new Date();
      costMonthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  renderCompanyProfitRows();
  renderPaymentRows();
  refreshCompanySummary();
  calcMonthlyCompanyCost();
  loadMonthlyCompanyCostForCurrentMonth();
  loadCompanyDashboards();
}