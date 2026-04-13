
    const SUPABASE_URL = "https://rzbqiytumnwvjlmbljbp.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_G7L9_UDamWpmHL6r1pnqLg_7_FLUg4G";
    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function showApp() {
  document.getElementById("loginGate").classList.add("hidden");
  document.getElementById("appWrap").classList.remove("hidden");
}

function showLogin() {
  document.getElementById("loginGate").classList.remove("hidden");
  document.getElementById("appWrap").classList.add("hidden");
}

async function checkSessionAndStart() {
  const { data, error } = await db.auth.getSession();

  if (error) {
    alert("세션 확인 실패: " + error.message);
    showLogin();
    return;
  }

  if (!data.session) {
    showLogin();
    return;
  }

  showApp();
  await initApp();
}

async function login() {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value.trim();

  if (!email || !password) {
    alert("이메일과 비밀번호를 입력하세요.");
    return;
  }

  const { error } = await db.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("로그인 실패: " + error.message);
    return;
  }

  showApp();
  await initApp();
}

async function logout() {
  await db.auth.signOut();
  showLogin();
}

document.addEventListener("keydown", (e) => {
  const loginGateVisible = !document.getElementById("loginGate").classList.contains("hidden");
  if (loginGateVisible && e.key === "Enter") {
    login();
  }
});


    let detailRows = [];
    let customersCache = [];
    let sitesCache = [];
    let workTypesCache = [];
    let materialsCache = [];
    let autoAppendGuard = false;
    let quoteSearchCache = [];

    const WORK_DISPLAY_ORDER = [
      "철거", "설비", "전기조명", "목공사", "타일", "욕실", "필름", "도장",
      "바닥", "도배", "도어", "가구싱크대", "샷시", "실리콘", "확장공사", "외부공사"
    ];

    function todayStr() {
      return new Date().toISOString().substring(0, 10);
    }

    function newQuoteNo() {
      const d = new Date();
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      const ss = String(d.getSeconds()).padStart(2, "0");
      return `Q${yyyy}${mm}${dd}-${hh}${mi}${ss}`;
    }

    function formatWon(num) {
      return "₩ " + Number(num || 0).toLocaleString("ko-KR");
    }

    function toNum(v) {
      return Number(String(v ?? "").replace(/,/g, "").trim()) || 0;
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function normalizeWorkName(name) {
      return String(name || "").replace(/\s+/g, "").trim();
    }

    function getWorkOrderIndex(name) {
      const normalized = normalizeWorkName(name);
      const idx = WORK_DISPLAY_ORDER.findIndex(x => normalizeWorkName(x) === normalized);
      return idx === -1 ? 9999 : idx;
    }

    function showTab(tabName) {
      document.getElementById("tab-write").classList.add("hidden");
      document.getElementById("tab-summary").classList.add("hidden");
      document.getElementById("tab-detail").classList.add("hidden");
      document.getElementById("tab-company").classList.add("hidden");
      document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));

      if (tabName === "write") {
        document.getElementById("tab-write").classList.remove("hidden");
        document.querySelectorAll(".tab-btn")[0].classList.add("active");
      } else if (tabName === "summary") {
        document.getElementById("tab-summary").classList.remove("hidden");
        document.querySelectorAll(".tab-btn")[1].classList.add("active");
      } else if (tabName === "detail") {
        document.getElementById("tab-detail").classList.remove("hidden");
        document.querySelectorAll(".tab-btn")[2].classList.add("active");
    } else if (tabName === "company") {
  document.getElementById("tab-company").classList.remove("hidden");
  document.querySelectorAll(".tab-btn")[3].classList.add("active");
  if (typeof initCompanyTab === "function") {
    initCompanyTab();
  }
}

    function buildEmptyRow() {
      return {
        id: crypto.randomUUID(),
        work_type_id: "",
        material_id: "",
        work_name: "",
        item_name: "",
        spec: "",
        unit: "",
        qty: 0,
        cost_material: 0,
        cost_labor: 0,
        cost_expense: 0,
        unit_price: 0,
        line_amount: 0,
        note: ""
      };
    }

    function isMeaningfulRow(row) {
      return !!(
        String(row.work_name || "").trim() ||
        String(row.item_name || "").trim() ||
        String(row.spec || "").trim() ||
        String(row.unit || "").trim() ||
        toNum(row.qty) > 0 ||
        toNum(row.cost_material) > 0 ||
        toNum(row.cost_labor) > 0 ||
        toNum(row.cost_expense) > 0 ||
        String(row.note || "").trim()
      );
    }

    function updateComputedAmounts(row) {
      const qty = toNum(row.qty);
      const costMaterial = toNum(row.cost_material);
      const costLabor = toNum(row.cost_labor);
      const costExpense = toNum(row.cost_expense);

      row.qty = qty;
      row.cost_material = costMaterial;
      row.cost_labor = costLabor;
      row.cost_expense = costExpense;
      row.unit_price = costMaterial + costLabor + costExpense;
      row.line_amount = qty * row.unit_price;
    }

    function maybeAutoAppendRow(currentRowId) {
      if (autoAppendGuard) return;
      const lastRow = detailRows[detailRows.length - 1];
      if (!lastRow) return;
      if (lastRow.id !== currentRowId) return;
      if (!isMeaningfulRow(lastRow)) return;

      autoAppendGuard = true;
      detailRows.push(buildEmptyRow());
      renderDetailRows();
      calculateAll();
      autoAppendGuard = false;
    }

    function addQuoteRow() {
      detailRows.push(buildEmptyRow());
      renderDetailRows();
      calculateAll();
    }

    function removeQuoteRow(id) {
      detailRows = detailRows.filter(r => r.id !== id);
      if (detailRows.length === 0) detailRows.push(buildEmptyRow());
      renderDetailRows();
      calculateAll();
    }

    function updateRowValue(id, key, value) {
      const row = detailRows.find(r => r.id === id);
      if (!row) return;

      if (["qty", "cost_material", "cost_labor", "cost_expense"].includes(key)) {
        row[key] = toNum(value);
      } else {
        row[key] = value;
      }

      updateComputedAmounts(row);
      const amountEl = document.getElementById(`line_amount_${row.id}`);
      if (amountEl) amountEl.textContent = formatWon(row.line_amount);

      renderPreviewTables();
      calculateAll();
    }

    function handleWorkTypeChange(id, workTypeId) {
      const row = detailRows.find(r => r.id === id);
      if (!row) return;

      row.work_type_id = workTypeId;
      const wt = workTypesCache.find(x => String(x.id) === String(workTypeId));
      row.work_name = wt ? wt.work_name : row.work_name;

      renderDetailRows();
      calculateAll();
      maybeAutoAppendRow(id);
    }

    function handleMaterialChange(id, materialId) {
      const row = detailRows.find(r => r.id === id);
      if (!row) return;

      row.material_id = materialId;
      const material = materialsCache.find(x => String(x.id) === String(materialId));

      if (!material) {
        renderDetailRows();
        calculateAll();
        maybeAutoAppendRow(id);
        return;
      }

      row.item_name = material.item_name || row.item_name;
      row.spec = material.spec || row.spec;
      row.unit = material.unit || row.unit;
      row.cost_material = toNum(material.cost_material);
      row.cost_labor = toNum(material.cost_labor);
      row.cost_expense = toNum(material.cost_expense);

      if (!row.work_type_id && material.work_type_id) {
        row.work_type_id = material.work_type_id;
        const wt = workTypesCache.find(x => String(x.id) === String(material.work_type_id));
        row.work_name = wt ? wt.work_name : row.work_name;
      }

      updateComputedAmounts(row);
      renderDetailRows();
      calculateAll();
      maybeAutoAppendRow(id);
    }

    function makeWorkTypeOptions(selectedId) {
      let html = `<option value="">공종 선택</option>`;
      workTypesCache.forEach(w => {
        html += `<option value="${w.id}" ${String(selectedId) === String(w.id) ? "selected" : ""}>${escapeHtml(w.work_name)}</option>`;
      });
      return html;
    }

    function makeMaterialOptions(selectedId, rowWorkTypeId) {
      let html = `<option value="">품목 선택</option>`;
      let list = materialsCache;
      if (rowWorkTypeId) {
        list = list.filter(m => String(m.work_type_id ?? "") === String(rowWorkTypeId));
      }
      list.forEach(m => {
        html += `<option value="${m.id}" ${String(selectedId) === String(m.id) ? "selected" : ""}>${escapeHtml(m.item_name)}</option>`;
      });
      return html;
    }

    function renderDetailRows() {
      const body = document.getElementById("quoteDetailBody");
      body.innerHTML = "";

      detailRows.forEach((row, idx) => {
        updateComputedAmounts(row);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="row-no">${idx + 1}</td>
          <td>
            <select onchange="handleWorkTypeChange('${row.id}', this.value)">
              ${makeWorkTypeOptions(row.work_type_id)}
            </select>
          </td>
          <td>
            <select onchange="handleMaterialChange('${row.id}', this.value)">
              ${makeMaterialOptions(row.material_id, row.work_type_id)}
            </select>
          </td>
          <td><input value="${escapeHtml(row.work_name)}" onchange="updateRowValue('${row.id}','work_name',this.value); maybeAutoAppendRow('${row.id}');" placeholder="공종명" /></td>
          <td><input value="${escapeHtml(row.item_name)}" onchange="updateRowValue('${row.id}','item_name',this.value); maybeAutoAppendRow('${row.id}');" placeholder="품목명" /></td>
          <td><input value="${escapeHtml(row.spec)}" onchange="updateRowValue('${row.id}','spec',this.value); maybeAutoAppendRow('${row.id}');" placeholder="규격" /></td>
          <td><input type="text" value="${escapeHtml(row.unit)}" onchange="updateRowValue('${row.id}','unit',this.value); maybeAutoAppendRow('${row.id}');" placeholder="단위" /></td>
          <td><input type="number" value="${row.qty}" oninput="updateRowValue('${row.id}','qty',this.value)" /></td>
          <td><input type="number" value="${row.cost_material}" oninput="updateRowValue('${row.id}','cost_material',this.value)" /></td>
          <td><input type="number" value="${row.cost_labor}" oninput="updateRowValue('${row.id}','cost_labor',this.value)" /></td>
          <td><input type="number" value="${row.cost_expense}" oninput="updateRowValue('${row.id}','cost_expense',this.value)" /></td>
          <td class="align-right" style="min-width:140px;"><strong id="line_amount_${row.id}">${formatWon(row.line_amount)}</strong></td>
          <td><textarea onchange="updateRowValue('${row.id}','note',this.value)" placeholder="비고">${escapeHtml(row.note)}</textarea></td><td><button class="table-btn delete-btn" onclick="removeQuoteRow('${row.id}')">삭제</button></td>
    `;
    body.appendChild(tr);
  });

  renderPreviewTables();
}

function renderPreviewTables() {
  const previewBody = document.getElementById("detailPreviewBody");
  previewBody.innerHTML = "";

  const meaningfulRows = detailRows.filter(isMeaningfulRow).map(row => {
    updateComputedAmounts(row);
    return row;
  });

  if (meaningfulRows.length === 0) {
    previewBody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center;">입력된 견적상세가 없습니다.</td>
      </tr>
    `;
    return;
  }

  const groupedMap = new Map();
  meaningfulRows.forEach(row => {
    const workName = String(row.work_name || "미분류").trim() || "미분류";
    if (!groupedMap.has(workName)) groupedMap.set(workName, []);
    groupedMap.get(workName).push(row);
  });

  const groupedEntries = Array.from(groupedMap.entries()).sort((a, b) => {
    const orderA = getWorkOrderIndex(a[0]);
    const orderB = getWorkOrderIndex(b[0]);
    if (orderA !== orderB) return orderA - orderB;
    return a[0].localeCompare(b[0], "ko");
  });

  groupedEntries.forEach(([workName, rows]) => {
    let subtotal = 0;

    previewBody.insertAdjacentHTML(
      "beforeend",
      `
      <tr class="preview-group-row">
        <td colspan="7">${escapeHtml(workName)}</td>
      </tr>
      `
    );

    rows.forEach((row, idx) => {
      subtotal += toNum(row.line_amount);
      previewBody.insertAdjacentHTML(
        "beforeend",
        `
        <tr>
          <td class="align-center">${idx + 1}</td>
          <td class="align-center">${escapeHtml(row.item_name || "-")}</td>
          <td class="align-center">${escapeHtml(row.spec || "-")}</td>
          <td class="align-center">${escapeHtml(row.unit || "-")}</td>
          <td class="align-right">${toNum(row.qty).toLocaleString("ko-KR")}</td>
          <td class="align-right">${formatWon(row.line_amount)}</td>
          <td>${escapeHtml(row.note || "")}</td>
        </tr>
        `
      );
    });

    previewBody.insertAdjacentHTML(
      "beforeend",
      `
      <tr class="preview-subtotal-row">
        <td colspan="5" class="align-right">${escapeHtml(workName)} 소계</td>
        <td class="align-right">${formatWon(subtotal)}</td>
        <td></td>
      </tr>
      `
    );
  });
}

function calculateAll() {
  let directCost = 0;
  let workSummary = {};

  detailRows.forEach(row => {
    updateComputedAmounts(row);
    const line = toNum(row.line_amount);
    directCost += line;

    const workName = row.work_name || "미분류";
    if (!workSummary[workName]) workSummary[workName] = 0;
    workSummary[workName] += line;
  });

  const extraCost = toNum(document.getElementById("extra_cost").value);
  const wasteCost = toNum(document.getElementById("waste_cost").value);
  const insuranceCost = toNum(document.getElementById("insurance_cost").value);
  const siteManageCost = toNum(document.getElementById("site_manage_cost").value);
  const vatType = toNum(document.getElementById("vat_type").value);

  const indirectCost = extraCost + wasteCost + insuranceCost + siteManageCost;
  const supplyAmount = directCost + indirectCost;
  const vatAmount = Math.round(supplyAmount * (vatType / 100));
  const totalAmount = supplyAmount + vatAmount;

  document.getElementById("direct_cost_display").textContent = formatWon(directCost);
  document.getElementById("indirect_cost_display").textContent = formatWon(indirectCost);
  document.getElementById("supply_amount_display").textContent = formatWon(supplyAmount);
  document.getElementById("vat_amount_display").textContent = formatWon(vatAmount);
  document.getElementById("total_amount_display").textContent = formatWon(totalAmount);

  const workSummaryList = document.getElementById("workSummaryList");
  const summaryTabList = document.getElementById("summaryTabList");
  workSummaryList.innerHTML = "";
  summaryTabList.innerHTML = "";

  const keys = Object.keys(workSummary).filter(k => workSummary[k] !== 0);
  if (keys.length === 0) {
    const emptyHtml = `<div class="work-summary-item"><span>입력된 공종이 없습니다</span><strong>₩ 0</strong></div>`;
    workSummaryList.innerHTML = emptyHtml;
    summaryTabList.innerHTML = emptyHtml;
  } else {
    keys.forEach(key => {
      const html = `<div class="work-summary-item"><span>${escapeHtml(key)}</span><strong>${formatWon(workSummary[key])}</strong></div>`;
      workSummaryList.insertAdjacentHTML("beforeend", html);
      summaryTabList.insertAdjacentHTML("beforeend", html);
    });
  }
}

function syncTopSummary() {
  document.getElementById("topWriteDate").textContent = document.getElementById("quote_date").value || "미입력";
  document.getElementById("topCustomerName").textContent = document.getElementById("customer_name").value || "미입력";
  document.getElementById("topSiteName").textContent = document.getElementById("site_name").value || "미입력";
  document.getElementById("topWorkType").textContent = document.getElementById("work_type").value || "미입력";
  document.getElementById("topRevision").textContent = (document.getElementById("revision_no").value || "1") + "차";
  document.getElementById("topQuoteStatus").textContent = document.getElementById("quote_status").value || "미입력";
}

function bindBasicEvents() {
  [
    "quote_date", "customer_name", "site_name", "work_type",
    "revision_no", "quote_status", "extra_cost", "waste_cost",
    "insurance_cost", "site_manage_cost", "vat_type"
  ].forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener("input", () => { syncTopSummary(); calculateAll(); });
    el.addEventListener("change", () => { syncTopSummary(); calculateAll(); });
  });
}

function getCurrentAmounts() {
  let directCost = 0;
  detailRows.forEach(row => {
    updateComputedAmounts(row);
    directCost += toNum(row.line_amount);
  });

  const extraCost = toNum(document.getElementById("extra_cost").value);
  const wasteCost = toNum(document.getElementById("waste_cost").value);
  const insuranceCost = toNum(document.getElementById("insurance_cost").value);
  const siteManageCost = toNum(document.getElementById("site_manage_cost").value);
  const vatType = toNum(document.getElementById("vat_type").value);

  const indirectCost = extraCost + wasteCost + insuranceCost + siteManageCost;
  const supplyAmount = directCost + indirectCost;
  const vatAmount = Math.round(supplyAmount * (vatType / 100));
  const totalAmount = supplyAmount + vatAmount;

  return { supplyAmount, vatAmount, totalAmount };
}

async function loadCustomers() {
  try {
    const { data, error } = await db.from("customers").select("*").order("customer_name", { ascending: true });
    if (error) throw error;
    customersCache = data || [];
    const sel = document.getElementById("customer_select");
    const current = sel.value;
    sel.innerHTML = `<option value="">고객 선택</option>`;
    customersCache.forEach(c => {
      sel.innerHTML += `<option value="${c.id}">${escapeHtml(c.customer_name)}</option>`;
    });
    if (current) sel.value = current;
  } catch (err) {
    alert("고객 불러오기 실패: " + err.message);
  }
}

async function loadSites() {
  try {
    const { data, error } = await db.from("sites").select("*").order("site_address", { ascending: true });
    if (error) throw error;
    sitesCache = data || [];
    const sel = document.getElementById("site_select");
    const current = sel.value;
    sel.innerHTML = `<option value="">현장 선택</option>`;
    sitesCache.forEach(s => {
      const label = `${s.site_name || "현장명없음"} / ${s.site_address || ""}`;
      sel.innerHTML += `<option value="${s.id}">${escapeHtml(label)}</option>`;
    });
    if (current) sel.value = current;
  } catch (err) {
    alert("현장 불러오기 실패: " + err.message);
  }
}

async function loadWorkTypes() {
  try {
    const { data, error } = await db.from("work_types").select("*").eq("is_active", true).order("sort_no", { ascending: true });
    if (error) throw error;
    workTypesCache = data || [];
    renderDetailRows();
  } catch (err) {
    alert("공종 불러오기 실패: " + err.message);
  }
}

async function loadMaterials() {
  try {
    const { data, error } = await db.from("materials").select("*").eq("is_active", true).order("item_name", { ascending: true });
    if (error) throw error;
    materialsCache = data || [];
    renderDetailRows();
  } catch (err) {
    alert("품목 불러오기 실패: " + err.message);
  }
}

function handleCustomerSelectChange() {
  const id = document.getElementById("customer_select").value;
  const customer = customersCache.find(c => String(c.id) === String(id));
  if (!customer) return;

  document.getElementById("customer_name").value = customer.customer_name || "";
  document.getElementById("customer_phone").value = customer.phone || "";
  document.getElementById("customer_address").value = customer.address || "";
  syncTopSummary();

  const firstSite = sitesCache.find(s => String(s.customer_id ?? "") === String(customer.id));
  if (firstSite) {
    document.getElementById("site_select").value = firstSite.id;
    handleSiteSelectChange();
  }
}

function handleSiteSelectChange() {
  const id = document.getElementById("site_select").value;
  const site = sitesCache.find(s => String(s.id) === String(id));
  if (!site) return;

  document.getElementById("site_name").value = site.site_name || "";
  document.getElementById("site_address").value = site.site_address || "";
  document.getElementById("area_size").value = site.area_size || "";
  if (site.work_type) document.getElementById("work_type").value = site.work_type;

  if (site.customer_id) {
    const customer = customersCache.find(c => String(c.id) === String(site.customer_id));
    if (customer) {
      document.getElementById("customer_select").value = customer.id;
      document.getElementById("customer_name").value = customer.customer_name || "";
      document.getElementById("customer_phone").value = customer.phone || "";
      document.getElementById("customer_address").value = customer.address || "";
    }
  }
  syncTopSummary();
}

async function saveCustomerMaster() {
  try {
    const customer_name = document.getElementById("customer_name").value.trim();
    const phone = document.getElementById("customer_phone").value.trim();
    const address = document.getElementById("customer_address").value.trim();
    if (!customer_name) {
      alert("고객명을 입력하세요.");
      return;
    }

    const { data: existing, error: findError } = await db.from("customers").select("*").eq("customer_name", customer_name).maybeSingle();
    if (findError) throw findError;

    if (existing) {
      const { error: updateError } = await db.from("customers").update({ phone, address, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (updateError) throw updateError;
      alert("기존 고객 수정 저장 완료");
    } else {
      const { error: insertError } = await db.from("customers").insert([{ customer_name, phone, address, updated_at: new Date().toISOString() }]);
      if (insertError) throw insertError;
      alert("신규 고객 저장 완료");
    }

    await loadCustomers();
    const matched = customersCache.find(c => c.customer_name === customer_name);
    if (matched) document.getElementById("customer_select").value = matched.id;
    syncTopSummary();
  } catch (err) {
    alert("고객 저장 실패: " + err.message);
  }
}

async function saveSiteMaster() {
  try {
    const customerId = document.getElementById("customer_select").value || null;
    const site_name = document.getElementById("site_name").value.trim();
    const site_address = document.getElementById("site_address").value.trim();
    const area_size = toNum(document.getElementById("area_size").value);
    const work_type = document.getElementById("work_type").value;

    if (!site_address) {
      alert("현장주소를 입력하세요.");
      return;
    }

    const { data: existing, error: findError } = await db.from("sites").select("*").eq("site_address", site_address).maybeSingle();
    if (findError) throw findError;

    if (existing) {
      const { error: updateError } = await db.from("sites").update({ customer_id: customerId, site_name, area_size, work_type, updated_at: new Date().toISOString() }).eq("id", existing.id);
      if (updateError) throw updateError;
      alert("기존 현장 수정 저장 완료");
    } else {
      const { error: insertError } = await db.from("sites").insert([{ customer_id: customerId, site_name, site_address, area_size, work_type, updated_at: new Date().toISOString() }]);
      if (insertError) throw insertError;
      alert("신규 현장 저장 완료");
    }

    await loadSites();
    const matched = sitesCache.find(s => s.site_address === site_address);
    if (matched) document.getElementById("site_select").value = matched.id;
    syncTopSummary();
  } catch (err) {
    alert("현장 저장 실패: " + err.message);
  }
}

async function upsertCustomer() {
  const customer_name = document.getElementById("customer_name").value.trim();
  const phone = document.getElementById("customer_phone").value.trim();
  const address = document.getElementById("customer_address").value.trim();
  if (!customer_name) return null;

  const { data: existing, error: findError } = await db.from("customers").select("*").eq("customer_name", customer_name).maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { error: updateError } = await db.from("customers").update({ phone, address, updated_at: new Date().toISOString() }).eq("id", existing.id);
    if (updateError) throw updateError;
    return existing.id;
  }

  const { data: inserted, error: insertError } = await db.from("customers").insert([{ customer_name, phone, address, updated_at: new Date().toISOString() }]).select().single();
  if (insertError) throw insertError;
  return inserted.id;
}

async function upsertSite(customerId) {
  const site_name = document.getElementById("site_name").value.trim();
  const site_address = document.getElementById("site_address").value.trim();
  const area_size = toNum(document.getElementById("area_size").value);
  const work_type = document.getElementById("work_type").value;
  if (!site_address) return null;

  const { data: existing, error: findError } = await db.from("sites").select("*").eq("site_address", site_address).maybeSingle();
  if (findError) throw findError;

  if (existing) {
    const { error: updateError } = await db.from("sites").update({ customer_id: customerId, site_name, area_size, work_type, updated_at: new Date().toISOString() }).eq("id", existing.id);
    if (updateError) throw updateError;
    return existing.id;
  }

  const { data: inserted, error: insertError } = await db.from("sites").insert([{ customer_id: customerId, site_name, site_address, area_size, work_type, updated_at: new Date().toISOString() }]).select().single();
  if (insertError) throw insertError;
  return inserted.id;
}

async function ensureWorkType(workName) {
  const name = String(workName || "").trim();
  if (!name) return null;

  const cacheFound = workTypesCache.find(x => String(x.work_name || "").trim() === name);
  if (cacheFound) return cacheFound.id;

  const { data: existing, error: findError } = await db.from("work_types").select("*").eq("work_name", name).maybeSingle();
  if (findError) throw findError;
  if (existing) {
    workTypesCache.push(existing);
    return existing.id;
  }

  const nextSortNo = (workTypesCache.length ? Math.max(...workTypesCache.map(x => toNum(x.sort_no))) : 0) + 1;
  const { data: inserted, error: insertError } = await db.from("work_types").insert([{ work_name: name, sort_no: nextSortNo, is_active: true, updated_at: new Date().toISOString() }]).select().single();
  if (insertError) throw insertError;
  workTypesCache.push(inserted);
  return inserted.id;
}

async function getNextMaterialCode() {
  const { data, error } = await db.from("materials").select("item_code").order("item_code", { ascending: false }).limit(1);
  if (error) throw error;
  if (!data || !data.length || !data[0].item_code) return "item_00001";

  const last = data[0].item_code;
  const num = parseInt(String(last).replace(/[^\d]/g, ""), 10) || 0;
  return "item_" + String(num + 1).padStart(5, "0");
}

async function ensureMaterial(row, workTypeId) {
  const itemName = String(row.item_name || "").trim();
  const spec = String(row.spec || "").trim();
  const unit = String(row.unit || "").trim();
  if (!itemName) return null;

  const cacheFound = materialsCache.find(x =>
    String(x.item_name || "").trim() === itemName &&
    String(x.spec || "").trim() === spec &&
    String(x.unit || "").trim() === unit &&
    String(x.work_type_id || "") === String(workTypeId || "")
  );
  if (cacheFound) return cacheFound.id;

  let query = db.from("materials").select("*").eq("item_name", itemName).eq("spec", spec).eq("unit", unit);
  if (workTypeId) query = query.eq("work_type_id", workTypeId);

  const { data: existingList, error: findError } = await query.limit(1);
  if (findError) throw findError;
  if (existingList && existingList.length > 0) {
    materialsCache.push(existingList[0]);
    return existingList[0].id;
  }

  const newItemCode = await getNextMaterialCode();
  const { data: inserted, error: insertError } = await db.from("materials").insert([{
    item_code: newItemCode,
    work_type_id: workTypeId,
    item_name: itemName,
    spec,
    unit,
    customer_price: toNum(row.cost_material) + toNum(row.cost_labor) + toNum(row.cost_expense),
    cost_material: toNum(row.cost_material),
    cost_labor: toNum(row.cost_labor),
    cost_expense: toNum(row.cost_expense),
    note: String(row.note || "").trim(),
    is_active: true,
    updated_at: new Date().toISOString()
  }]).select().single();

  if (insertError) throw insertError;
  materialsCache.push(inserted);
  return inserted.id;
}

async function saveQuote() {
  try {
    const quote_no = document.getElementById("quote_no").value.trim();
    const quote_date = document.getElementById("quote_date").value;
    const revision_no = toNum(document.getElementById("revision_no").value) || 1;
    const quote_status = document.getElementById("quote_status").value;
    const memo = document.getElementById("quote_memo").value.trim();

    if (!quote_no) return alert("견적번호가 없습니다.");
    if (!quote_date) return alert("견적일자를 입력하세요.");
    if (!document.getElementById("customer_name").value.trim()) return alert("고객명을 입력하세요.");
    if (!document.getElementById("site_address").value.trim()) return alert("현장주소를 입력하세요.");

    const validItems = detailRows.filter(isMeaningfulRow);
    if (validItems.length === 0) return alert("견적 상세 항목을 한 줄 이상 입력하세요.");

    const customerId = await upsertCustomer();
    const siteId = await upsertSite(customerId);
    const amounts = getCurrentAmounts();

    const quotePayload = {
      quote_no,
      quote_date,
      customer_id: customerId,
      site_id: siteId,
      revision_no,
      quote_status,
      supply_amount: amounts.supplyAmount,
      vat_amount: amounts.vatAmount,
      total_amount: amounts.totalAmount,
      memo,
      updated_at: new Date().toISOString()
    };

    const { data: existingQuote, error: quoteFindError } = await db.from("quotes").select("*").eq("quote_no", quote_no).maybeSingle();
    if (quoteFindError) throw quoteFindError;

    let quoteId = null;
    if (existingQuote) {
      const { error: quoteUpdateError } = await db.from("quotes").update(quotePayload).eq("id", existingQuote.id);
      if (quoteUpdateError) throw quoteUpdateError;
      quoteId = existingQuote.id;
      const { error: deleteItemsError } = await db.from("quote_items").delete().eq("quote_id", quoteId);
      if (deleteItemsError) throw deleteItemsError;
    } else {
      const { data: insertedQuote, error: quoteInsertError } = await db.from("quotes").insert([quotePayload]).select().single();
      if (quoteInsertError) throw quoteInsertError;
      quoteId = insertedQuote.id;
    }

    const itemPayloads = [];
    for (let idx = 0; idx < validItems.length; idx++) {
      const row = validItems[idx];
      let finalWorkTypeId = row.work_type_id || null;
      let finalMaterialId = row.material_id || null;

      if (!finalWorkTypeId && String(row.work_name || "").trim()) {
        finalWorkTypeId = await ensureWorkType(row.work_name);
        row.work_type_id = finalWorkTypeId;
      }

      if (!finalMaterialId && String(row.item_name || "").trim()) {
        finalMaterialId = await ensureMaterial(row, finalWorkTypeId);
        row.material_id = finalMaterialId;
      }

      if (finalWorkTypeId && !row.work_name) {
        const wt = workTypesCache.find(x => String(x.id) === String(finalWorkTypeId));
        if (wt) row.work_name = wt.work_name || "";
      }

      if (finalMaterialId && !row.item_name) {
        const mt = materialsCache.find(x => String(x.id) === String(finalMaterialId));
        if (mt) {
          row.item_name = mt.item_name || "";
          row.spec = row.spec || mt.spec || "";
          row.unit = row.unit || mt.unit || "";
        }
      }

      updateComputedAmounts(row);

      itemPayloads.push({
        quote_id: quoteId,
        line_no: idx + 1,
        work_type_id: finalWorkTypeId,
        material_id: finalMaterialId,
        work_name_snapshot: row.work_name || "",
        item_name_snapshot: row.item_name || "",
        spec_snapshot: row.spec || "",
        unit_snapshot: row.unit || "",
        qty: toNum(row.qty),
        unit_price: toNum(row.unit_price),
        line_amount: toNum(row.line_amount),
        cost_material: toNum(row.cost_material),
        cost_labor: toNum(row.cost_labor),
        cost_expense: toNum(row.cost_expense),
        note: row.note || "",
        updated_at: new Date().toISOString()
      });
    }

    const { error: itemsInsertError } = await db.from("quote_items").insert(itemPayloads);
    if (itemsInsertError) throw itemsInsertError;

    await loadCustomers();
    await loadSites();
    await loadWorkTypes();
    await loadMaterials();
    alert("견적 저장 완료");
  } catch (err) {
    console.error(err);
    alert("저장 실패: " + err.message);
  }
}

async function fetchQuoteSearchList() {
  const { data, error } = await db.from("quotes").select(`
    id,
    quote_no,
    quote_date,
    total_amount,
    customers ( customer_name ),
    sites ( site_name, site_address )
  `).order("quote_date", { ascending: false }).limit(200);
  if (error) throw error;
  quoteSearchCache = data || [];
}

function openLoadModal() {
  document.getElementById("loadModal").classList.add("show");
  document.getElementById("loadSearchInput").value = "";
  fetchQuoteSearchList()
    .then(() => renderQuoteSearchResults(""))
    .catch(err => alert("검색 목록 불러오기 실패: " + err.message));
}

function closeLoadModal() {
  document.getElementById("loadModal").classList.remove("show");
}

function clearQuoteSearch() {
  document.getElementById("loadSearchInput").value = "";
  renderQuoteSearchResults("");
}

function searchQuotes() {
  const keyword = document.getElementById("loadSearchInput").value.trim();
  renderQuoteSearchResults(keyword);
}

function renderQuoteSearchResults(keyword) {
  const body = document.getElementById("loadSearchBody");
  const emptyBox = document.getElementById("loadSearchEmpty");
  body.innerHTML = "";

  const normalized = keyword.toLowerCase();
  const filtered = quoteSearchCache.filter(row => {
    if (!normalized) return true;
    const customerName = String(row.customers?.customer_name || "").toLowerCase();
    const siteName = String(row.sites?.site_name || "").toLowerCase();
    const siteAddress = String(row.sites?.site_address || "").toLowerCase();
    const quoteNo = String(row.quote_no || "").toLowerCase();
    return customerName.includes(normalized) || siteName.includes(normalized) || siteAddress.includes(normalized) || quoteNo.includes(normalized);
  });

  if (!filtered.length) {
    emptyBox.classList.remove("hidden");
    return;
  }
  emptyBox.classList.add("hidden");

  filtered.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.quote_no || "")}</td>
      <td>${escapeHtml(row.quote_date || "")}</td>
      <td>${escapeHtml(row.customers?.customer_name || "")}</td>
      <td>${escapeHtml(row.sites?.site_name || "")}</td>
      <td>${escapeHtml(row.sites?.site_address || "")}</td>
      <td class="align-right">${formatWon(row.total_amount || 0)}</td>
      <td><button class="search-row-btn" onclick="selectQuoteFromSearch(${row.id})">불러오기</button></td>
    `;
    body.appendChild(tr);
  });
}

async function selectQuoteFromSearch(quoteId) {
  try {
    const { data: quote, error: quoteError } = await db.from("quotes").select(`
      *,
      customers ( id, customer_name, phone, address ),
      sites ( id, customer_id, site_name, site_address, area_size, work_type )
    `).eq("id", quoteId).single();
    if (quoteError) throw quoteError;

    const { data: items, error: itemsError } = await db.from("quote_items").select("*").eq("quote_id", quote.id).order("line_no", { ascending: true });
    if (itemsError) throw itemsError;

    document.getElementById("quote_no").value = quote.quote_no || "";
    document.getElementById("base_quote_no").value = quote.quote_no || "";
    document.getElementById("revision_no").value = quote.revision_no || 1;
    document.getElementById("quote_date").value = quote.quote_date || "";
    document.getElementById("customer_name").value = quote.customers?.customer_name || "";
    document.getElementById("customer_phone").value = quote.customers?.phone || "";
    document.getElementById("customer_address").value = quote.customers?.address || "";
    document.getElementById("site_name").value = quote.sites?.site_name || "";
    document.getElementById("site_address").value = quote.sites?.site_address || "";
    document.getElementById("area_size").value = quote.sites?.area_size || "";
    document.getElementById("work_type").value = quote.sites?.work_type || "본공사";
    document.getElementById("quote_status").value = quote.quote_status || "가견적";
    document.getElementById("quote_memo").value = quote.memo || "";

    if (quote.customers?.id) document.getElementById("customer_select").value = quote.customers.id;
    if (quote.sites?.id) document.getElementById("site_select").value = quote.sites.id;

    detailRows = (items || []).map(row => ({
      id: crypto.randomUUID(),
      work_type_id: row.work_type_id || "",
      material_id: row.material_id || "",
      work_name: row.work_name_snapshot || "",
      item_name: row.item_name_snapshot || "",
      spec: row.spec_snapshot || "",
      unit: row.unit_snapshot || "",
      qty: toNum(row.qty),
      cost_material: toNum(row.cost_material),
      cost_labor: toNum(row.cost_labor),
      cost_expense: toNum(row.cost_expense),
      unit_price: toNum(row.unit_price),
      line_amount: toNum(row.line_amount),
      note: row.note || ""
    }));

    if (detailRows.length === 0) detailRows = [buildEmptyRow()];
    else detailRows.push(buildEmptyRow());

    renderDetailRows();
    syncTopSummary();
    calculateAll();
    closeLoadModal();
    alert("견적 불러오기 완료");
  } catch (err) {
    console.error(err);
    alert("불러오기 실패: " + err.message);
  }
}

function buildPdfSummaryTable() {
  const body = document.getElementById("pdfSummaryBody");
  body.innerHTML = "";

  const meaningfulRows = (detailRows || []).filter(row => {
    updateComputedAmounts(row);
    return isMeaningfulRow(row);
  });

  if (!meaningfulRows.length) {
    body.innerHTML = `<tr><td colspan="2" class="center">견적 요약 내역이 없습니다.</td></tr>`;
    return;
  }

  const groupedMap = new Map();
  meaningfulRows.forEach(row => {
    const workName = String(row.work_name || "미분류").trim() || "미분류";
    if (!groupedMap.has(workName)) groupedMap.set(workName, 0);
    groupedMap.set(workName, groupedMap.get(workName) + toNum(row.line_amount));
  });

  const groupedEntries = Array.from(groupedMap.entries()).sort((a, b) => {
    const orderA = getWorkOrderIndex(a[0]);
    const orderB = getWorkOrderIndex(b[0]);
    if (orderA !== orderB) return orderA - orderB;
    return a[0].localeCompare(b[0], "ko");
  });

  groupedEntries.forEach(([workName, amount]) => {
    body.insertAdjacentHTML("beforeend", `
      <tr>
        <td>${escapeHtml(workName)}</td>
        <td>${formatWon(amount)}</td>
      </tr>
    `);
  });
}

function buildPdfDetailTable() {
  const pdfBody = document.getElementById("pdfDetailBody");
  pdfBody.innerHTML = "";

  const meaningfulRows = detailRows.filter(isMeaningfulRow).map(row => {
    updateComputedAmounts(row);
    return row;
  });

  if (meaningfulRows.length === 0) {
    pdfBody.innerHTML = `<tr><td colspan="7" class="center">견적 상세 내역이 없습니다.</td></tr>`;
    return;
  }

  const groupedMap = new Map();
  meaningfulRows.forEach(row => {
    const workName = String(row.work_name || "미분류").trim() || "미분류";
    if (!groupedMap.has(workName)) groupedMap.set(workName, []);
    groupedMap.get(workName).push(row);
  });

  const groupedEntries = Array.from(groupedMap.entries()).sort((a, b) => {
    const orderA = getWorkOrderIndex(a[0]);
    const orderB = getWorkOrderIndex(b[0]);
    if (orderA !== orderB) return orderA - orderB;
    return a[0].localeCompare(b[0], "ko");
  });

  groupedEntries.forEach(([workName, rows]) => {
    let subtotal = 0;

    pdfBody.insertAdjacentHTML("beforeend", `
      <tr class="pdf-group-row">
        <td colspan="7">${escapeHtml(workName)}</td>
      </tr>
    `);

    rows.forEach((row, idx) => {
      updateComputedAmounts(row);
      const itemName = escapeHtml(row.item_name || "-");
      const spec = escapeHtml(row.spec || "-");
      const unit = escapeHtml(row.unit || "-");
      const qty = toNum(row.qty).toLocaleString("ko-KR");
      const amount = formatWon(row.line_amount);
      const note = escapeHtml(row.note || "");
      subtotal += toNum(row.line_amount);

      pdfBody.insertAdjacentHTML("beforeend", `
        <tr>
          <td class="center">${idx + 1}</td>
          <td class="center pdf-item-name">${itemName}</td>
          <td class="center">${spec}</td>
          <td class="center">${unit}</td>
          <td class="right">${qty}</td>
          <td class="right pdf-amount">${amount}</td>
          <td class="pdf-note">${note}</td>
        </tr>
      `);
    });

    pdfBody.insertAdjacentHTML("beforeend", `
      <tr class="pdf-subtotal-row">
        <td></td>
        <td></td>
        <td></td>
        <td></td>
        <td class="right">${escapeHtml(workName)} 소계</td>
        <td class="right pdf-amount">${formatWon(subtotal)}</td>
        <td></td>
      </tr>
    `);
  });
}

function fillPdfData() {
  const amounts = getCurrentAmounts();

  const quoteNo = document.getElementById("quote_no").value || "-";
  const quoteDate = document.getElementById("quote_date").value || "-";
  const customerName = document.getElementById("customer_name").value || "-";
  const customerPhone = document.getElementById("customer_phone").value || "-";
  const siteName = document.getElementById("site_name").value || "-";
  const siteAddress = document.getElementById("site_address").value || "-";
  const workType = document.getElementById("work_type").value || "-";
  const workPeriod = document.getElementById("work_period").value || "-";
  const memo = document.getElementById("quote_memo").value || "-";

  document.getElementById("cover_quote_no").textContent = quoteNo;
  document.getElementById("cover_quote_date").textContent = quoteDate;
  document.getElementById("cover_customer_name").textContent = customerName;
document.getElementById("cover_customer_phone").textContent = customerPhone;
  document.getElementById("cover_site_name").textContent = siteName;
  document.getElementById("cover_site_address").textContent = siteAddress;
  document.getElementById("cover_work_type").textContent = workType;
  
document.getElementById("summary_customer_name").textContent = customerName;
  document.getElementById("summary_site_address").textContent = siteAddress;
 document.getElementById("summary_quote_no").textContent = quoteNo;
document.getElementById("summary_quote_date").textContent = quoteDate;


  document.getElementById("pdf_quote_no").textContent = quoteNo;
  document.getElementById("pdf_quote_date").textContent = quoteDate;
  document.getElementById("pdf_customer_name").textContent = customerName;
  
 
  document.getElementById("pdf_site_address").textContent = siteAddress;
  
  

  let directCost = 0;
  detailRows.filter(isMeaningfulRow).forEach(row => {
    updateComputedAmounts(row);
    directCost += toNum(row.line_amount);
  });

  document.getElementById("pdf_direct_cost").textContent = formatWon(directCost);
  document.getElementById("pdf_extra_cost").textContent = formatWon(toNum(document.getElementById("extra_cost").value));
  document.getElementById("pdf_waste_cost").textContent = formatWon(toNum(document.getElementById("waste_cost").value));
  document.getElementById("pdf_insurance_cost").textContent = formatWon(toNum(document.getElementById("insurance_cost").value));
  document.getElementById("pdf_site_manage_cost").textContent = formatWon(toNum(document.getElementById("site_manage_cost").value));
  document.getElementById("pdf_supply_amount").textContent = formatWon(amounts.supplyAmount);
  document.getElementById("pdf_vat_amount").textContent = formatWon(amounts.vatAmount);
  document.getElementById("pdf_total_amount").textContent = formatWon(amounts.totalAmount);
  document.getElementById("pdf_quote_memo").textContent = memo;

  buildPdfSummaryTable();
  buildPdfDetailTable();
}

function printQuote() {
  try {
    fillPdfData();
    window.print();
  } catch (err) {
    console.error("PDF 인쇄 오류:", err);
    alert("PDF 인쇄용 데이터 채우기 중 오류: " + err.message);
  }
}

function resetQuoteForm() {
  document.getElementById("quote_no").value = newQuoteNo();
  document.getElementById("base_quote_no").value = document.getElementById("quote_no").value;
  document.getElementById("revision_no").value = 1;
  document.getElementById("quote_date").value = todayStr();
  document.getElementById("customer_select").value = "";
  document.getElementById("customer_name").value = "";
  document.getElementById("customer_phone").value = "";
  document.getElementById("customer_address").value = "";
  document.getElementById("site_select").value = "";
  document.getElementById("site_name").value = "";
  document.getElementById("site_address").value = "";
  document.getElementById("area_size").value = "";
  document.getElementById("work_type").value = "본공사";
  document.getElementById("work_period").value = "";
  document.getElementById("quote_status").value = "가견적";
  document.getElementById("vat_type").value = "10";
  document.getElementById("extra_cost").value = 0;
  document.getElementById("waste_cost").value = 0;
  document.getElementById("insurance_cost").value = 0;
  document.getElementById("site_manage_cost").value = 0;
  document.getElementById("quote_memo").value = "";

  detailRows = [buildEmptyRow()];
  renderDetailRows();
  syncTopSummary();
  calculateAll();
}

async function initApp() {
  bindBasicEvents();
  document.getElementById("quote_date").value = todayStr();
  document.getElementById("quote_no").value = newQuoteNo();
  document.getElementById("base_quote_no").value = document.getElementById("quote_no").value;
  document.getElementById("revision_no").value = 1;

  await loadCustomers();
  await loadSites();
  await loadWorkTypes();
  await loadMaterials();

  detailRows = [buildEmptyRow()];
  renderDetailRows();
  syncTopSummary();
  calculateAll();
}

document.addEventListener("DOMContentLoaded", () => {
checkSessionAndStart();
});

