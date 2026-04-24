
    const SUPABASE_URL = "https://rzbqiytumnwvjlmbljbp.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_G7L9_UDamWpmHL6r1pnqLg_7_FLUg4G";
    const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.sessionStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

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
  showTab("write");
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
  showTab("write");
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
    let quoteSearchFiltered = [];
    let quoteSearchPage = 1;
    const QUOTE_SEARCH_PAGE_SIZE = 6;
    let currentQuoteDbTotalAmount = 0;

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
      return Number(String(v ?? "").replace(/[^\d.-]/g, "").trim()) || 0;
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


    function getQuoteTotals() {
      let directTotal = 0;

      (detailRows || []).forEach(row => {
        if (!isMeaningfulRow(row)) return;
        updateComputedAmounts(row);
        directTotal += toNum(row.line_amount);
      });

      const extraCost = toNum(document.getElementById("extra_cost")?.value);
      const wasteCost = toNum(document.getElementById("waste_cost")?.value);
      const insuranceCost = toNum(document.getElementById("insurance_cost")?.value);
      const siteManageCost = toNum(document.getElementById("site_manage_cost")?.value);
      const vatType = toNum(document.getElementById("vat_type")?.value || 10);

      const indirectTotal = extraCost + wasteCost + insuranceCost + siteManageCost;
      const totalConstruction = directTotal + indirectTotal;
      const vat = Math.round(totalConstruction * (vatType / 100));
      const finalTotal = totalConstruction + vat;

      return {
        directTotal,
        indirectTotal,
        totalConstruction,
        vat,
        finalTotal,
        extraCost,
        wasteCost,
        insuranceCost,
        siteManageCost
      };
    }

    function getWorkSummaryData() {
      const groupedMap = new Map();

      (detailRows || [])
        .filter(isMeaningfulRow)
        .forEach(row => {
          updateComputedAmounts(row);

          const workName = String(row.work_name || "미분류").trim() || "미분류";
          if (!groupedMap.has(workName)) groupedMap.set(workName, 0);
          groupedMap.set(workName, groupedMap.get(workName) + toNum(row.line_amount));
        });

      return Array.from(groupedMap.entries()).sort((a, b) => {
        const orderA = getWorkOrderIndex(a[0]);
        const orderB = getWorkOrderIndex(b[0]);
        if (orderA !== orderB) return orderA - orderB;
        return a[0].localeCompare(b[0], "ko");
      });
    }

    function getDetailPreviewData() {
      const groupedMap = new Map();

      (detailRows || [])
        .filter(isMeaningfulRow)
        .forEach(row => {
          updateComputedAmounts(row);
          const workName = String(row.work_name || "미분류").trim() || "미분류";
          if (!groupedMap.has(workName)) groupedMap.set(workName, []);
          groupedMap.get(workName).push(row);
        });

      return Array.from(groupedMap.entries()).sort((a, b) => {
        const orderA = getWorkOrderIndex(a[0]);
        const orderB = getWorkOrderIndex(b[0]);
        if (orderA !== orderB) return orderA - orderB;
        return a[0].localeCompare(b[0], "ko");
      });
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
    renderPreviewTables();
  } else if (tabName === "detail") {
    document.getElementById("tab-detail").classList.remove("hidden");
    document.querySelectorAll(".tab-btn")[2].classList.add("active");
    renderPreviewTables();
  } else if (tabName === "company") {
    document.getElementById("tab-company").classList.remove("hidden");
    document.querySelectorAll(".tab-btn")[3].classList.add("active");

    if (typeof initCompanyTab === "function") {
      initCompanyTab();
    }
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
if (typeof syncContractFromEstimate === "function") syncContractFromEstimate(false);
      autoAppendGuard = false;
    }

    function addQuoteRow() {
      detailRows.push(buildEmptyRow());
      renderDetailRows();
      calculateAll();
    }

    function removeQuoteRow(id) {
      const row = detailRows.find(r => r.id === id);
      if (!row) return;

      const itemName = String(row.item_name || "").trim();
      if (itemName) {
        const typed = prompt(`삭제하려면 품목명 [${itemName}] 을(를) 입력하세요.`, "");
        if (typed === null) return;
        if (String(typed).trim() !== itemName) {
          alert("품목명이 일치하지 않아 삭제하지 않았습니다.");
          return;
        }
      } else {
        const ok = confirm("이 행은 품목명이 없습니다. 이 행을 삭제하시겠습니까?");
        if (!ok) return;
      }

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
      if (typeof refreshCompanySummary === "function") refreshCompanySummary();
    }


    function isMobileDetailMode() {
      return window.innerWidth <= 768;
    }

    function handleWorkTypeChange(id, workTypeId) {
      const row = detailRows.find(r => r.id === id);
      if (!row) return;

      row.work_type_id = workTypeId;
      const wt = workTypesCache.find(x => String(x.id) === String(workTypeId));
      row.work_name = wt ? wt.work_name : row.work_name;

      updateComputedAmounts(row);
      calculateAll();
      maybeAutoAppendRow(id);

      if (!isMobileDetailMode()) {
        renderDetailRows();
      }
    }

    function handleMaterialChange(id, materialId) {
      const row = detailRows.find(r => r.id === id);
      if (!row) return;

      row.material_id = materialId;
      const material = materialsCache.find(x => String(x.id) === String(materialId));

      if (!material) {
        updateComputedAmounts(row);
        calculateAll();
        maybeAutoAppendRow(id);

        if (!isMobileDetailMode()) {
          renderDetailRows();
        }
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
      calculateAll();
      maybeAutoAppendRow(id);

      if (!isMobileDetailMode()) {
        renderDetailRows();
      }
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

    let comboState = {
      type: "",
      rowId: ""
    };

    let materialSearchState = {
      query: "",
      open: false
    };

    function normalizeComboText(value) {
      return String(value || "").trim().toLowerCase();
    }

    function setComboState(type, rowId) {
      comboState = {
        type: type || "",
        rowId: rowId || ""
      };
    }

    function isComboOpen(type, rowId) {
      return comboState.type === type && String(comboState.rowId) === String(rowId);
    }

    function closeAllCombos() {
      setComboState("", "");
      if (typeof renderDetailRows === "function") renderDetailRows();
      if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
    }

    function bindComboOutsideCloseOnce() {
      if (window.__akComboOutsideBound) return;
      window.__akComboOutsideBound = true;
      document.addEventListener("click", (event) => {
        if (event.target.closest(".erp-combo")) return;
        if (!comboState.type || !comboState.rowId) return;
        closeAllCombos();
      });
    }

    function getWorkTypeMatches(query) {
      const q = normalizeComboText(query);
      let list = [...(workTypesCache || [])];
      if (q) {
        list = list.filter(w => normalizeComboText(w.work_name).includes(q));
      }
      return list.slice(0, 20);
    }

    function getMaterialMatches(query, rowWorkTypeId) {
      const q = normalizeComboText(query);
      let list = [...(materialsCache || [])];
      if (rowWorkTypeId) {
        list = list.filter(m => String(m.work_type_id ?? "") === String(rowWorkTypeId));
      }
      if (q) {
        list = list.filter(m => {
          const itemName = normalizeComboText(m.item_name);
          const spec = normalizeComboText(m.spec);
          const unit = normalizeComboText(m.unit);
          return itemName.includes(q) || spec.includes(q) || unit.includes(q);
        });
      }
      return list.slice(0, 20);
    }

    function openWorkTypeCombo(rowId) {
      setComboState("work", rowId);
      if (typeof renderDetailRows === "function") renderDetailRows();
      if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
    }

    function openMaterialCombo(rowId) {
      setComboState("material", rowId);
      if (typeof renderDetailRows === "function") renderDetailRows();
      if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
    }

    function handleWorkTypeComboInput(rowId, value) {
      updateRowValue(rowId, 'work_name', value);
      openWorkTypeCombo(rowId);
      maybeAutoAppendRow(rowId);
    }

    function handleMaterialComboInput(rowId, value) {
      updateRowValue(rowId, 'item_name', value);
      openMaterialCombo(rowId);
      maybeAutoAppendRow(rowId);
    }

    function selectWorkTypeFromCombo(rowId, workTypeId) {
      handleWorkTypeChange(rowId, workTypeId);
      setComboState("", "");
      renderDetailRows();
      if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
    }

    function selectMaterialFromCombo(rowId, materialId) {
      handleMaterialChange(rowId, materialId);
      setComboState("", "");
      renderDetailRows();
      if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
    }

    function handleWorkTypeComboBlur(rowId) {
      setTimeout(() => {
        const row = detailRows.find(r => String(r.id) === String(rowId));
        if (!row) return;
        const typed = normalizeComboText(row.work_name);
        if (typed) {
          const exact = (workTypesCache || []).find(w => normalizeComboText(w.work_name) === typed);
          if (exact) {
            handleWorkTypeChange(rowId, exact.id);
            setComboState("", "");
            renderDetailRows();
            if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
            return;
          }
        }
        if (comboState.type === "work" && String(comboState.rowId) === String(rowId)) {
          setComboState("", "");
          renderDetailRows();
          if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
        }
      }, 150);
    }

    function handleMaterialComboBlur(rowId) {
      setTimeout(() => {
        const row = detailRows.find(r => String(r.id) === String(rowId));
        if (!row) return;
        const typed = normalizeComboText(row.item_name);
        const list = getMaterialMatches(row.item_name, row.work_type_id);
        if (typed) {
          const exact = list.find(m => normalizeComboText(m.item_name) === typed);
          if (exact) {
            handleMaterialChange(rowId, exact.id);
            setComboState("", "");
            renderDetailRows();
            if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
            return;
          }
        }
        if (comboState.type === "material" && String(comboState.rowId) === String(rowId)) {
          setComboState("", "");
          renderDetailRows();
          if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
        }
      }, 150);
    }

    function renderComboItems(items, type, rowId) {
      if (!items.length) {
        return `<div class="combo-empty">검색 결과 없음</div>`;
      }

      if (type === "work") {
        return items.map(item => `
          <button type="button" class="combo-item" onclick="selectWorkTypeFromCombo('${rowId}', '${item.id}')">${escapeHtml(item.work_name || '')}</button>
        `).join("");
      }

      return items.map(item => `
        <button type="button" class="combo-item" onclick="selectMaterialFromCombo('${rowId}', '${item.id}')">
          <span class="combo-item-title">${escapeHtml(item.item_name || '')}</span>
          <span class="combo-item-sub">${escapeHtml([item.spec || '-', item.unit || '-'].join(' / '))}</span>
        </button>
      `).join("");
    }

    function renderWorkTypeCombo(row, mobileMode = false) {
      const items = getWorkTypeMatches(row.work_name);
      const openClass = isComboOpen("work", row.id) ? " open" : "";
      return `
        <div class="erp-combo${openClass} ${mobileMode ? 'mobile-combo' : ''}">
          <input
            type="text"
            value="${escapeHtml(row.work_name || '')}"
            onfocus="openWorkTypeCombo('${row.id}')"
            oninput="handleWorkTypeComboInput('${row.id}', this.value)"
            onchange="updateRowValue('${row.id}','work_name',this.value); maybeAutoAppendRow('${row.id}');"
            onblur="handleWorkTypeComboBlur('${row.id}')"
            placeholder="공종명 검색 또는 입력"
            autocomplete="off"
          />
          <button type="button" class="combo-toggle" onclick="openWorkTypeCombo('${row.id}')">▾</button>
          ${isComboOpen("work", row.id) ? `<div class="combo-menu">${renderComboItems(items, 'work', row.id)}</div>` : ''}
        </div>
      `;
    }

    function renderMaterialCombo(row, mobileMode = false) {
      const items = getMaterialMatches(row.item_name, row.work_type_id);
      const openClass = isComboOpen("material", row.id) ? " open" : "";
      return `
        <div class="erp-combo${openClass} ${mobileMode ? 'mobile-combo' : ''}">
          <input
            type="text"
            value="${escapeHtml(row.item_name || '')}"
            onfocus="openMaterialCombo('${row.id}')"
            oninput="handleMaterialComboInput('${row.id}', this.value)"
            onchange="updateRowValue('${row.id}','item_name',this.value); maybeAutoAppendRow('${row.id}');"
            onblur="handleMaterialComboBlur('${row.id}')"
            placeholder="품목명 검색 또는 입력"
            autocomplete="off"
          />
          <button type="button" class="combo-toggle" onclick="openMaterialCombo('${row.id}')">▾</button>
          ${isComboOpen("material", row.id) ? `<div class="combo-menu">${renderComboItems(items, 'material', row.id)}</div>` : ''}
        </div>
      `;
    }

    function getMaterialWorkName(material) {
      const wt = (workTypesCache || []).find(x => String(x.id) === String(material.work_type_id ?? ""));
      return material.work_name || (wt ? wt.work_name : "");
    }

    function getMaterialSearchMatches(query) {
      const q = normalizeComboText(query);

      // 검색어가 없으면 전체 품목을 보여주지 않는다.
      // 입력한 내용과 비슷한 품목만 전부 보여준다. 개수 제한 없음.
      if (!q) return [];

      return [...(materialsCache || [])].filter(m => {
        const workName = normalizeComboText(getMaterialWorkName(m));
        const itemName = normalizeComboText(m.item_name);
        const spec = normalizeComboText(m.spec);
        const unit = normalizeComboText(m.unit);
        const keyword = normalizeComboText(m.keyword || m.keywords || m.search_text || "");
        return (
          itemName.includes(q) ||
          workName.includes(q) ||
          spec.includes(q) ||
          unit.includes(q) ||
          keyword.includes(q)
        );
      });
    }

    function renderMaterialSearchItems(items) {
      if (!items.length) return `<div class="material-search-empty">검색 결과 없음</div>`;
      return items.map(m => {
        const workName = getMaterialWorkName(m) || "공종없음";
        const priceText = [
          `자재 ${formatWon(toNum(m.cost_material))}`,
          `노무 ${formatWon(toNum(m.cost_labor))}`,
          `경비 ${formatWon(toNum(m.cost_expense))}`
        ].join(" / ");
        return `
          <button type="button" class="material-search-item" onclick="selectMaterialFromSearchPanel('${m.id}')">
            <span class="material-search-title">${escapeHtml(m.item_name || '')}</span>
            <span class="material-search-meta">${escapeHtml(workName)} · ${escapeHtml(m.spec || '-')} · ${escapeHtml(m.unit || '-')}</span>
            <span class="material-search-price">${priceText}</span>
          </button>
        `;
      }).join("");
    }

    function renderMaterialSearchPanel() {
      const panel = document.getElementById("materialSearchPanel");
      if (!panel) return;
      panel.innerHTML = `
        <div class="material-search-head">
          <h4>품목명 검색</h4>
          <div id="materialSearchCount" class="material-search-count hidden"></div>
        </div>
        <div class="material-search-box">
          <input
            id="materialQuickSearchInput"
            type="text"
            value="${escapeHtml(materialSearchState.query || '')}"
            placeholder="품목명 검색"
            onfocus="openMaterialSearchPanel()"
            oninput="handleMaterialSearchInput(this.value)"
            autocomplete="off"
            inputmode="search"
          />
        </div>
        <div id="materialSearchListWrap" class="material-search-list hidden"></div>
      `;
      updateMaterialSearchResults();
    }

    function updateMaterialSearchResults() {
      const query = (materialSearchState.query || "").trim();
      const listWrap = document.getElementById("materialSearchListWrap");
      const countBox = document.getElementById("materialSearchCount");
      if (!listWrap || !countBox) return;

      if (!materialSearchState.open || !query) {
        listWrap.classList.add("hidden");
        listWrap.innerHTML = "";
        countBox.classList.add("hidden");
        countBox.textContent = "";
        return;
      }

      const items = getMaterialSearchMatches(query);
      countBox.classList.remove("hidden");
      countBox.textContent = `검색결과 ${items.length}건`;
      listWrap.classList.remove("hidden");
      listWrap.innerHTML = `
        <div class="material-search-list-title">검색 목록</div>
        ${renderMaterialSearchItems(items)}
      `;
    }

    function openMaterialSearchPanel() {
      materialSearchState.open = true;
      updateMaterialSearchResults();
    }

    function handleMaterialSearchInput(value) {
      materialSearchState.query = value || "";
      materialSearchState.open = true;
      updateMaterialSearchResults();
    }

    function getMaterialInsertTargetRow() {
      let lastRow = detailRows[detailRows.length - 1];
      if (!lastRow) {
        lastRow = buildEmptyRow();
        detailRows.push(lastRow);
      }
      if (isMeaningfulRow(lastRow)) {
        lastRow = buildEmptyRow();
        detailRows.push(lastRow);
      }
      return lastRow;
    }

    function applyMaterialToRow(row, material) {
      if (!row || !material) return;
      row.material_id = material.id;
      row.work_type_id = material.work_type_id || row.work_type_id || "";
      row.work_name = getMaterialWorkName(material) || row.work_name || "";
      row.item_name = material.item_name || row.item_name || "";
      row.spec = material.spec || "";
      row.unit = material.unit || "";
      row.cost_material = toNum(material.cost_material);
      row.cost_labor = toNum(material.cost_labor);
      row.cost_expense = toNum(material.cost_expense);
      if (!toNum(row.qty)) row.qty = toNum(material.default_qty || material.qty || 1) || 1;
      updateComputedAmounts(row);
    }

    function selectMaterialFromSearchPanel(materialId) {
      const material = (materialsCache || []).find(x => String(x.id) === String(materialId));
      if (!material) return;
      const row = getMaterialInsertTargetRow();
      applyMaterialToRow(row, material);
      const lastRow = detailRows[detailRows.length - 1];
      if (lastRow && String(lastRow.id) === String(row.id) && isMeaningfulRow(row)) {
        detailRows.push(buildEmptyRow());
      }
      materialSearchState.query = "";
      materialSearchState.open = false;
      renderDetailRows();
      if (typeof renderMobileDetailCards === "function") renderMobileDetailCards();
      calculateAll();
      if (typeof refreshCompanySummary === "function") refreshCompanySummary();
      if (typeof syncContractFromEstimate === "function") syncContractFromEstimate(false);
      setTimeout(() => {
        const input = document.getElementById("materialQuickSearchInput");
        if (input) input.focus();
      }, 0);
    }

    function renderDetailRows() {
      bindComboOutsideCloseOnce();
      renderMaterialSearchPanel();

      const body = document.getElementById("quoteDetailBody");
      if (!body) return;
      body.innerHTML = "";

      detailRows.forEach((row, idx) => {
        updateComputedAmounts(row);

        const tr = document.createElement("tr");
        tr.innerHTML = `
          <td class="row-no">${idx + 1}</td>
          <td><input value="${escapeHtml(row.work_name)}" onchange="updateRowValue('${row.id}','work_name',this.value); maybeAutoAppendRow('${row.id}');" placeholder="공종명" /></td>
          <td><input value="${escapeHtml(row.item_name)}" onchange="updateRowValue('${row.id}','item_name',this.value); maybeAutoAppendRow('${row.id}');" placeholder="품목명" /></td>
          <td><input value="${escapeHtml(row.spec)}" onchange="updateRowValue('${row.id}','spec',this.value); maybeAutoAppendRow('${row.id}');" placeholder="규격" /></td>
          <td><input type="text" value="${escapeHtml(row.unit)}" onchange="updateRowValue('${row.id}','unit',this.value); maybeAutoAppendRow('${row.id}');" placeholder="단위" /></td>
          <td><input type="number" value="${row.qty}" oninput="updateRowValue('${row.id}','qty',this.value)" /></td>
          <td><input type="number" value="${row.cost_material}" oninput="updateRowValue('${row.id}','cost_material',this.value)" /></td>
          <td><input type="number" value="${row.cost_labor}" oninput="updateRowValue('${row.id}','cost_labor',this.value)" /></td>
          <td><input type="number" value="${row.cost_expense}" oninput="updateRowValue('${row.id}','cost_expense',this.value)" /></td>
          <td class="align-right" style="min-width:140px;"><strong id="line_amount_${row.id}">${formatWon(row.line_amount)}</strong></td>
          <td><textarea onchange="updateRowValue('${row.id}','note',this.value)" placeholder="비고">${escapeHtml(row.note)}</textarea></td>
          <td>
            <div style="display:flex; gap:3px; flex-direction:column;">
              <button class="table-btn delete-btn" onclick="removeQuoteRow('${row.id}')">D</button>
              <button class="table-btn" onclick="updateMaterialMasterFromRow('${row.id}')">E</button>
            </div>
          </td>`;
        body.appendChild(tr);
      });

      renderPreviewTables();
    }

function renderPreviewTables() {
  const summaryPreviewBody = document.getElementById("summaryPreviewBody");
  const summaryTotalsBox = document.getElementById("summaryTotalsBox");
  const previewBody = document.getElementById("detailPreviewBody");

  const summaryData = getWorkSummaryData();
  const groupedEntries = getDetailPreviewData();
  const totals = getQuoteTotals();

  // 견적요약
  if (summaryPreviewBody) {
    summaryPreviewBody.innerHTML = "";

    if (!summaryData.length) {
      summaryPreviewBody.innerHTML = `
        <tr>
          <td colspan="2" class="align-center">견적 요약 내역이 없습니다.</td>
        </tr>
      `;
    } else {
      summaryData.forEach(([workName, amount]) => {
        summaryPreviewBody.insertAdjacentHTML("beforeend", `
          <tr>
            <td>${escapeHtml(workName)}</td>
            <td class="align-right">${formatWon(amount)}</td>
          </tr>
        `);
      });
    }
  }

  if (summaryTotalsBox) {
    const quoteMemoValue = (document.getElementById("quote_memo")?.value || "").trim();
    const quoteMemoHtml = quoteMemoValue
      ? `
  <div class="summary-memo-card">
    <div class="summary-memo-title">메모</div>
    <div class="summary-memo-content">${escapeHtml(quoteMemoValue).replace(/\n/g, "<br>")}</div>
  </div>`
      : "";

    summaryTotalsBox.innerHTML = `
  <div class="detail-total-row">
    <span>직접공사비</span>
    <strong>${formatWon(totals.directTotal)}</strong>
  </div>
  <div class="detail-total-row">
    <span>간접공사비</span>
    <strong>${formatWon(totals.indirectTotal)}</strong>
  </div>
  <div class="detail-total-row">
    <span>공급가액</span>
    <strong>${formatWon(totals.totalConstruction)}</strong>
  </div>
  <div class="detail-total-row">
    <span>VAT</span>
    <strong>${formatWon(totals.vat)}</strong>
  </div>
  <div class="detail-total-row grand">
    <span>총 합 계</span>
    <strong>${formatWon(totals.finalTotal)}</strong>
  </div>
  ${quoteMemoHtml}
`;
  }
  if (previewBody) {
    previewBody.innerHTML = "";

    if (!groupedEntries.length) {
      previewBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align:center;">입력된 견적상세가 없습니다.</td>
        </tr>
      `;
      return;
    }

    groupedEntries.forEach(([workName, rows]) => {
      let subtotal = 0;

      previewBody.insertAdjacentHTML("beforeend", `
        <tr class="preview-group-row">
          <td colspan="7">${escapeHtml(workName)}</td>
        </tr>
      `);

      rows.forEach((row, idx) => {
        subtotal += toNum(row.line_amount);

        previewBody.insertAdjacentHTML("beforeend", `
          <tr>
            <td class="align-center">${idx + 1}</td>
            <td>${escapeHtml(row.item_name || "-")}</td>
            <td class="align-center">${escapeHtml(row.spec || "-")}</td>
            <td class="align-center">${escapeHtml(row.unit || "-")}</td>
            <td class="align-right">${toNum(row.qty).toLocaleString("ko-KR")}</td>
            <td class="align-right">${formatWon(row.line_amount)}</td>
            <td class="align-center">${escapeHtml(row.note || "")}</td>
          </tr>
        `);
      });

      previewBody.insertAdjacentHTML("beforeend", `
        <tr class="preview-subtotal-row">
          <td colspan="5" class="align-right">${escapeHtml(workName)} 소계</td>
          <td class="align-right">${formatWon(subtotal)}</td>
          <td></td>
        </tr>
      `);
    });

    previewBody.insertAdjacentHTML("beforeend", `
      <tr class="preview-divider-row">
        <td colspan="7"></td>
      </tr>

      <tr class="preview-subtotal-row">
        <td colspan="5" class="align-right">직접공사비</td>
        <td class="align-right">${formatWon(totals.directTotal)}</td>
        <td></td>
      </tr>
      <tr class="preview-subtotal-row">
        <td colspan="5" class="align-right">기타공사비</td>
        <td class="align-right">${formatWon(totals.extraCost)}</td>
        <td></td>
      </tr>
      <tr class="preview-subtotal-row">
        <td colspan="5" class="align-right">폐기물비용</td>
        <td class="align-right">${formatWon(totals.wasteCost)}</td>
        <td></td>
      </tr>
      <tr class="preview-subtotal-row">
        <td colspan="5" class="align-right">산재보험비</td>
        <td class="align-right">${formatWon(totals.insuranceCost)}</td>
        <td></td>
      </tr>
      <tr class="preview-subtotal-row">
        <td colspan="5" class="align-right">현장관리비</td>
        <td class="align-right">${formatWon(totals.siteManageCost)}</td>
        <td></td>
      </tr>
      <tr class="preview-subtotal-row">
        <td colspan="5" class="align-right">공급가액</td>
        <td class="align-right">${formatWon(totals.totalConstruction)}</td>
        <td></td>
      </tr>
      <tr class="preview-subtotal-row">
        <td colspan="5" class="align-right">VAT</td>
        <td class="align-right">${formatWon(totals.vat)}</td>
        <td></td>
      </tr>
      <tr class="preview-subtotal-row">
        <td colspan="5" class="align-right"><strong>총 합 계</strong></td>
        <td class="align-right"><strong>${formatWon(totals.finalTotal)}</strong></td>
        <td></td>
      </tr>
    `);
  }
}


function calculateAll() {
  const totals = getQuoteTotals();
  const workSummary = Object.fromEntries(getWorkSummaryData());

  document.getElementById("direct_cost_display").textContent = formatWon(totals.directTotal);
  document.getElementById("indirect_cost_display").textContent = formatWon(totals.indirectTotal);
  document.getElementById("supply_amount_display").textContent = formatWon(totals.totalConstruction);
  document.getElementById("vat_amount_display").textContent = formatWon(totals.vat);
  document.getElementById("total_amount_display").textContent = formatWon(totals.finalTotal);
  document.getElementById("total_amount_display").dataset.value = String(totals.finalTotal);

  renderPreviewTables();
}

function normalizeQuoteStatusValue(value) {
  const v = String(value || "").trim();
  return v === "보류" ? "공사마감" : v;
}

function syncTopSummary() {
  document.getElementById("topWriteDate").textContent = document.getElementById("quote_date").value || "미입력";
  document.getElementById("topCustomerName").textContent = document.getElementById("customer_name").value || "미입력";
  document.getElementById("topSiteName").textContent = document.getElementById("site_name").value || "미입력";
  document.getElementById("topWorkType").textContent = document.getElementById("work_type").value || "미입력";
  document.getElementById("topRevision").textContent = (document.getElementById("revision_no").value || "1") + "차";
  document.getElementById("topQuoteStatus").textContent = normalizeQuoteStatusValue(document.getElementById("quote_status").value) || "미입력";
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
  const customerAddressEl = document.getElementById("customer_address");
  if (customerAddressEl) customerAddressEl.value = customer.address || "";
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
      const customerAddressEl = document.getElementById("customer_address");
  if (customerAddressEl) customerAddressEl.value = customer.address || "";
    }
  }
  syncTopSummary();
}

async function saveCustomerMaster() {
  try {
    const customer_name = document.getElementById("customer_name").value.trim();
    const phone = document.getElementById("customer_phone").value.trim();
    const address = document.getElementById("customer_address")?.value.trim() || "";
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
  const address = document.getElementById("customer_address")?.value.trim() || "";
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
    const quote_status = normalizeQuoteStatusValue(document.getElementById("quote_status").value);
    const memo = document.getElementById("quote_memo").value.trim();

    if (!quote_no) return alert("견적번호가 없습니다.");
    if (!quote_date) return alert("견적일자를 입력하세요.");

   const customerName = document.getElementById("customer_name").value.trim();
const customerSelectValue = document.getElementById("customer_select")?.value || "";

if (!customerName && !customerSelectValue) {
  return alert("고객명을 입력하세요.");
}

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
extra_cost: toNum(document.getElementById("extra_cost").value),
waste_cost: toNum(document.getElementById("waste_cost").value),
insurance_cost: toNum(document.getElementById("insurance_cost").value),
site_manage_cost: toNum(document.getElementById("site_manage_cost").value),
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

   await loadSites();

await loadWorkTypes();

await loadMaterials();



await syncConfirmedSiteAddressToOrderDb(
  quote_no,
  quote_status,
  document.getElementById("site_address").value.trim()
);

if (typeof saveCompanyDataFromQuote === "function") {
  await saveCompanyDataFromQuote();
}

if (typeof savePaymentsFromQuote === "function") {
  await savePaymentsFromQuote();
}

currentQuoteDbTotalAmount = toNum(amounts.totalAmount);
if (typeof syncContractFromEstimate === "function") syncContractFromEstimate(false);
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
  quoteSearchPage = 1;
  fetchQuoteSearchList()
    .then(() => renderQuoteSearchResults("", 1))
    .catch(err => alert("검색 목록 불러오기 실패: " + err.message));
}

function closeLoadModal() {
  document.getElementById("loadModal").classList.remove("show");
}

function clearQuoteSearch() {
  document.getElementById("loadSearchInput").value = "";
  quoteSearchPage = 1;
  renderQuoteSearchResults("", 1);
}

function searchQuotes() {
  const keyword = document.getElementById("loadSearchInput").value.trim();
  quoteSearchPage = 1;
  renderQuoteSearchResults(keyword, 1);
}

function moveQuoteSearchPage(direction) {
  const totalPages = Math.max(1, Math.ceil(quoteSearchFiltered.length / QUOTE_SEARCH_PAGE_SIZE));
  quoteSearchPage = Math.min(totalPages, Math.max(1, quoteSearchPage + direction));
  const keyword = document.getElementById("loadSearchInput").value.trim();
  renderQuoteSearchResults(keyword, quoteSearchPage);
}

function renderQuoteSearchResults(keyword, page = quoteSearchPage) {
  const body = document.getElementById("loadSearchBody");
  const emptyBox = document.getElementById("loadSearchEmpty");
  const pager = document.getElementById("loadSearchPager");
  const pageInfo = document.getElementById("loadSearchPageInfo");
  body.innerHTML = "";

  const normalized = keyword.toLowerCase();
  quoteSearchFiltered = quoteSearchCache.filter(row => {
    if (!normalized) return true;
    const customerName = String(row.customers?.customer_name || "").toLowerCase();
    const siteName = String(row.sites?.site_name || "").toLowerCase();
    const siteAddress = String(row.sites?.site_address || "").toLowerCase();
    const quoteNo = String(row.quote_no || "").toLowerCase();
    return customerName.includes(normalized) || siteName.includes(normalized) || siteAddress.includes(normalized) || quoteNo.includes(normalized);
  });

  if (!quoteSearchFiltered.length) {
    emptyBox.classList.remove("hidden");
    if (pager) pager.classList.add("hidden");
    return;
  }
  emptyBox.classList.add("hidden");
  if (pager) pager.classList.remove("hidden");

  const totalPages = Math.max(1, Math.ceil(quoteSearchFiltered.length / QUOTE_SEARCH_PAGE_SIZE));
  quoteSearchPage = Math.min(totalPages, Math.max(1, page));
  const startIndex = (quoteSearchPage - 1) * QUOTE_SEARCH_PAGE_SIZE;
  const visibleRows = quoteSearchFiltered.slice(startIndex, startIndex + QUOTE_SEARCH_PAGE_SIZE);

  if (pageInfo) pageInfo.textContent = `${quoteSearchPage} / ${totalPages}`;

  visibleRows.forEach(row => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(row.quote_date || "")}</td>
      <td>${escapeHtml(row.customers?.customer_name || "")}</td>
      <td>${escapeHtml(row.sites?.site_address || "")}</td>
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
    const customerAddressEl3 = document.getElementById("customer_address");
    if (customerAddressEl3) customerAddressEl3.value = quote.customers?.address || "";
    document.getElementById("site_name").value = quote.sites?.site_name || "";
    document.getElementById("site_address").value = quote.sites?.site_address || "";
    document.getElementById("area_size").value = quote.sites?.area_size || "";
    document.getElementById("work_type").value = quote.sites?.work_type || "본공사";
    document.getElementById("quote_status").value = normalizeQuoteStatusValue(quote.quote_status) || "가견적";
    document.getElementById("vat_type").value = (quote.vat_type === "0" || quote.vat_type === 0 || quote.vat_type === "10" || quote.vat_type === 10) ? String(quote.vat_type) : "10";
    document.getElementById("quote_memo").value = quote.memo || "";

document.getElementById("extra_cost").value = toNum(quote.extra_cost);
document.getElementById("waste_cost").value = toNum(quote.waste_cost);
document.getElementById("insurance_cost").value = toNum(quote.insurance_cost);
document.getElementById("site_manage_cost").value = toNum(quote.site_manage_cost);
    currentQuoteDbTotalAmount = toNum(quote.total_amount);

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

if (typeof loadCompanyProfitByCurrentQuote === "function") {
  await syncCompanyDataAfterQuoteLoad();
}

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

  const summaryData = getWorkSummaryData();

  if (!summaryData.length) {
    body.innerHTML = `<tr><td colspan="2" class="center">견적 요약 내역이 없습니다.</td></tr>`;
    return;
  }

  summaryData.forEach(([workName, amount]) => {
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

  const groupedEntries = getDetailPreviewData();
  const totals = getQuoteTotals();

  if (!groupedEntries.length) {
    pdfBody.innerHTML = `<tr><td colspan="7" class="center">견적 상세 내역이 없습니다.</td></tr>`;
    return;
  }

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

  // 하단 구분선
  pdfBody.insertAdjacentHTML("beforeend", `
    <tr class="pdf-divider-row">
      <td colspan="7"></td>
    </tr>
  `);

  // 하단 합계영역
  pdfBody.insertAdjacentHTML("beforeend", `
    <tr class="pdf-subtotal-row">
      <td colspan="5" class="right">직접공사비</td>
      <td class="right pdf-amount">${formatWon(totals.directTotal)}</td>
      <td></td>
    </tr>
    <tr class="pdf-subtotal-row">
      <td colspan="5" class="right">기타공사비</td>
      <td class="right pdf-amount">${formatWon(totals.extraCost)}</td>
      <td></td>
    </tr>
    <tr class="pdf-subtotal-row">
      <td colspan="5" class="right">폐기물비용</td>
      <td class="right pdf-amount">${formatWon(totals.wasteCost)}</td>
      <td></td>
    </tr>
    <tr class="pdf-subtotal-row">
      <td colspan="5" class="right">산재보험비</td>
      <td class="right pdf-amount">${formatWon(totals.insuranceCost)}</td>
      <td></td>
    </tr>
    <tr class="pdf-subtotal-row">
      <td colspan="5" class="right">현장관리비</td>
      <td class="right pdf-amount">${formatWon(totals.siteManageCost)}</td>
      <td></td>
    </tr>
    <tr class="pdf-subtotal-row">
      <td colspan="5" class="right">공급가액</td>
      <td class="right pdf-amount">${formatWon(totals.totalConstruction)}</td>
      <td></td>
    </tr>
    <tr class="pdf-subtotal-row">
      <td colspan="5" class="right">VAT</td>
      <td class="right pdf-amount">${formatWon(totals.vat)}</td>
      <td></td>
    </tr>
    <tr class="pdf-subtotal-row pdf-detail-total-final">
      <td colspan="5" class="right"><strong>총 합 계</strong></td>
      <td class="right pdf-amount"><strong>${formatWon(totals.finalTotal)}</strong></td>
      <td></td>
    </tr>
  `);
}

function fillPdfData() {
  const amounts = getQuoteTotals();

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

  // 직접공사비는 다시 더하지 말고 getQuoteTotals 값 그대로 사용
  document.getElementById("pdf_direct_cost").textContent = formatWon(amounts.directTotal);
  document.getElementById("pdf_extra_cost").textContent = formatWon(amounts.indirectTotal);


  // 여기 이름을 getQuoteTotals 반환값에 맞춰야 함
  document.getElementById("pdf_supply_amount").textContent = formatWon(amounts.totalConstruction);
  document.getElementById("pdf_vat_amount").textContent = formatWon(amounts.vat);
  document.getElementById("pdf_total_amount").textContent = formatWon(amounts.finalTotal);

  document.getElementById("pdf_quote_memo").textContent = memo;

  buildPdfSummaryTable();
  buildPdfDetailTable();
}


function buildCounselPrintSheet() {
  const date = document.getElementById("counsel_date")?.value || document.getElementById("quote_date")?.value || "-";
  const name = document.getElementById("counsel_name")?.value || document.getElementById("customer_name")?.value || "-";
  const phone = document.getElementById("counsel_phone")?.value || document.getElementById("customer_phone")?.value || "-";
  const siteName = document.getElementById("counsel_site_name")?.value || document.getElementById("site_name")?.value || "-";
  const siteAddress = document.getElementById("counsel_site_address")?.value || document.getElementById("site_address")?.value || "-";
  const memo = document.getElementById("counsel_memo")?.value || "-";
  const status = normalizeQuoteStatusValue(document.getElementById("quote_status")?.value || document.getElementById("topQuoteStatus")?.textContent) || "-";
  return `
    <div class="pdf-sheet pdf-summary-sheet">
      <div class="pdf-section-title">상담일지</div>
      <div class="pdf-meta-line">
        <div>상담일자 : <strong>${date || '-'}</strong></div>
        <div>성함 : <strong>${name || '-'}</strong></div>
        <div>전화번호 : <strong>${phone || '-'}</strong></div>
      </div>
      <div class="pdf-meta-line">
        <div>현장명 : <strong>${siteName || '-'}</strong></div>
        <div>현장주소 : <strong>${siteAddress || '-'}</strong></div>
      </div>
      <div class="pdf-meta-line">
        <div>견적상태 : <strong>${status || '-'}</strong></div>
      </div>
      <div class="pdf-memo-box">
        <div class="pdf-memo-title">상담내용</div>
        <div class="pdf-memo-content">${(memo || "-").split("\n").join("<br>")}</div>
      </div>
    </div>`;
}

function ensurePdfExtraSheets() {
  const area = document.getElementById("pdfPrintArea");
  if (!area) return null;
  let extra = document.getElementById("pdfExtraSheets");
  if (!extra) {
    extra = document.createElement("div");
    extra.id = "pdfExtraSheets";
    area.appendChild(extra);
  }
  return extra;
}

function printQuote() {
  try {
    ensurePrintAreaReady();
    window.print();
  } catch (err) {
    console.error(err);
    alert("PDF 인쇄 오류: " + err.message);
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
  const customerAddressEl4 = document.getElementById("customer_address");
  if (customerAddressEl4) customerAddressEl4.value = "";
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

document.getElementById("extra_cost").value = 0;
document.getElementById("waste_cost").value = 0;
document.getElementById("insurance_cost").value = 0;
document.getElementById("site_manage_cost").value = 0;

  detailRows = [buildEmptyRow()];
  renderDetailRows();
  syncTopSummary();
  calculateAll();
  showTab("write");
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
  showTab("write");
}

document.addEventListener("DOMContentLoaded", () => {
checkSessionAndStart();
});

async function updateMaterialMasterFromRow(rowId) {
  try {
    const row = detailRows.find(r => r.id === rowId);
    if (!row) {
      alert("행을 찾을 수 없습니다.");
      return;
    }

    if (!row.material_id) {
      alert("기존 등록 품목만 단가수정 가능합니다.\n신규 품목이면 먼저 견적 저장 후 수정하세요.");
      return;
    }

    const itemName = String(row.item_name || "").trim();
    if (!itemName) {
      alert("품목명이 없습니다.");
      return;
    }

    const materialCost = toNum(row.cost_material);
    const laborCost = toNum(row.cost_labor);
    const expenseCost = toNum(row.cost_expense);

    const ok = confirm(
      `[${itemName}] 마스터 단가를 수정하시겠습니까?\n\n` +
      `자재비: ${materialCost.toLocaleString("ko-KR")}\n` +
      `노무비: ${laborCost.toLocaleString("ko-KR")}\n` +
      `경비: ${expenseCost.toLocaleString("ko-KR")}\n\n` +
      `이 변경은 앞으로 신규 작성부터 적용됩니다.\n기존 견적서는 변경되지 않습니다.`
    );

    if (!ok) return;

    const payload = {
      item_name: row.item_name || "",
      spec: row.spec || "",
      unit: row.unit || "",
      cost_material: materialCost,
      cost_labor: laborCost,
      cost_expense: expenseCost,
      customer_price: materialCost + laborCost + expenseCost,
      note: row.note || "",
      updated_at: new Date().toISOString()
    };

    const { error } = await db
      .from("materials")
      .update(payload)
      .eq("id", row.material_id);

    if (error) throw error;

    await loadMaterials();
    alert("단가수정 완료\n앞으로 신규 작성부터 적용됩니다.");
  } catch (err) {
    console.error(err);
    alert("단가수정 실패: " + err.message);
  }
}


const ORDER_DB_URL = "https://gmqjbkqttkkotvvjnsiz.supabase.co";
const ORDER_DB_KEY = "sb_publishable_NGNO5UWtbkgCWQQ6jwTe6Q_4evcuVD9";
const orderDb = window.supabase.createClient(ORDER_DB_URL, ORDER_DB_KEY);


async function syncConfirmedSiteAddressToOrderDb(quoteNo, quoteStatus, siteAddress) {
  try {
  

     const normalizedStatus = String(quoteStatus || "").trim();
    const normalizedAddress = String(siteAddress || "").trim();
    const normalizedQuoteNo = String(quoteNo || "").trim();

    if (normalizedStatus !== "확정견적" && normalizedStatus !== "공사마감") {
           return;
    }

    if (!normalizedAddress) {
           return;
    }

    const payload = {
      estimate_quote_no: String(quoteNo || "").trim(),
      site_address: normalizedAddress,
      updated_at: new Date().toISOString()
    };

   

    const { data, error } = await orderDb
      .from("order_sites")
      .upsert([payload], { onConflict: "estimate_quote_no" })
      .select();

    if (error) {
      alert("upsert 에러: " + error.message);
      throw error;
    }

    
    console.log("order_sites 저장 결과", data);

  } catch (err) {
    console.error("발주 DB 주소 동기화 실패:", err);
    alert("발주 DB 주소 저장 실패: " + err.message);
  }
}

function syncAll() {
  renderDetailInputTable();     // PC용
  renderMobileDetailCards();    // 모바일용
  renderPreviewTables();        // 요약/상세
  refreshCompanySummary();      // 회사관리
}


function renderMobileDetailCards() {
  const wrap = document.getElementById("mobileDetailInput");
  if (!wrap) return;

  wrap.innerHTML = "";

  detailRows.forEach((row, index) => {

    updateComputedAmounts(row);

    wrap.insertAdjacentHTML("beforeend", `
      <div class="detail-card">
        
        <div class="detail-card-title">
          ${escapeHtml(row.work_name || "공정")}
        </div>

        <div class="detail-card-row">
          <input placeholder="품목명"
            value="${escapeHtml(row.item_name || "")}"
            onchange="updateDetailRow(${index}, 'item_name', this.value)">
        </div>

        <div class="detail-card-row">
          <input placeholder="규격"
            value="${escapeHtml(row.spec || "")}"
            onchange="updateDetailRow(${index}, 'spec', this.value)">
          
          <input placeholder="단위"
            value="${escapeHtml(row.unit || "")}"
            onchange="updateDetailRow(${index}, 'unit', this.value)">
        </div>

        <div class="detail-card-row">
          <input type="number" placeholder="수량"
            value="${row.qty || 0}"
            oninput="updateDetailRow(${index}, 'qty', this.value)">
        </div>

        <div class="detail-card-row">
          <input type="number" placeholder="자재비"
            value="${row.cost_material || 0}"
            oninput="updateDetailRow(${index}, 'cost_material', this.value)">
          
          <input type="number" placeholder="노무비"
            value="${row.cost_labor || 0}"
            oninput="updateDetailRow(${index}, 'cost_labor', this.value)">
          
          <input type="number" placeholder="경비"
            value="${row.cost_expense || 0}"
            oninput="updateDetailRow(${index}, 'cost_expense', this.value)">
        </div>

        <div class="detail-card-amount">
          ${formatWon(row.line_amount)}
        </div>

        <div class="detail-card-delete">
          <button onclick="removeDetailRow(${index})">삭제</button>
        </div>

      </div>
    `);
  });
}

function addDetailRow() {
  detailRows.push(buildEmptyDetailRow());
  syncAll();
}

function removeDetailRow(index) {
  detailRows.splice(index, 1);
  syncAll();
}


function buildEmptyDetailRow() {
  return typeof buildEmptyRow === "function" ? buildEmptyRow() : {
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

function updateDetailRow(index, key, value) {
  const row = detailRows[index];
  if (!row) return;
  if (["qty", "cost_material", "cost_labor", "cost_expense"].includes(key)) {
    row[key] = toNum(value);
  } else {
    row[key] = value;
  }
  if (typeof updateComputedAmounts === "function") updateComputedAmounts(row);
  syncAll();
}

function renderDetailInputTable() {
  if (typeof renderDetailRows === "function") renderDetailRows();
}





/* ===== ERP REBUILD APP OVERRIDES ===== */
function showTab(tabName) {
  const tabs = ["counsel", "write", "summary", "detail", "contract", "company"];
  tabs.forEach(name => {
    const el = document.getElementById(`tab-${name}`);
    if (el) el.classList.add("hidden");
  });
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));

  if (tabName === "company") {
    if (typeof requestCompanyAccess === "function") requestCompanyAccess();
    return;
  }

  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.remove("hidden");

  const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabName}"]`);
  if (activeBtn) activeBtn.classList.add("active");

  if (tabName === "summary" || tabName === "detail") renderPreviewTables();
  if (tabName === "contract" && typeof syncContractFromEstimate === "function") syncContractFromEstimate(false);
  if (tabName === "counsel" && typeof syncCounselFromEstimate === "function") {
    syncCounselFromEstimate(false);
    if (typeof loadCounselLogList === "function") loadCounselLogList();
  }
}

function buildPrintSection(title, innerHtml, extraClass = "") {
  return `<section class="print-block ${extraClass}"><div class="print-page"><div class="print-delete-title">${title}</div>${innerHtml}</div></section>`;
}

function stripPrintUnneededTitles(html) {
  return String(html || "")
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, function(match) {
      return /screen-only/.test(match) ? "" : match;
    });
}

function buildPrintCoverHtml() {
  const quoteNo = document.getElementById("quote_no")?.value || "-";
  const quoteDate = document.getElementById("quote_date")?.value || "-";
  const customerName = document.getElementById("customer_name")?.value || "-";
  const customerPhone = document.getElementById("customer_phone")?.value || "-";
  const siteName = document.getElementById("site_name")?.value || "-";
  const siteAddress = document.getElementById("site_address")?.value || "-";
  const workType = document.getElementById("work_type")?.value || "본공사";

  const companyName = document.getElementById("contract_company_name")?.textContent?.trim() || "AK디자인";
  const companyBiz = document.getElementById("contract_company_bizno")?.textContent?.trim() || "143-12-01221";
  const companyCeo = document.getElementById("contract_company_ceo")?.textContent?.trim() || "김민석";
  const companyPhone = document.getElementById("contract_company_phone")?.textContent?.trim() || "010-3677-0454";
  const companyAddress = document.getElementById("contract_company_address")?.textContent?.trim() || "경기도 광명시 일직로99번안길 7 103호 AK디자인";

  const infoRows = [
    ["견적번호", quoteNo],
    ["작성일", quoteDate],
    ["고객명", customerName],
    ["연락처", customerPhone],
    ["현장명", siteName],
    ["현장주소", siteAddress],
    ["공사구분", workType]
  ];

  const companyRows = [
    ["상호", companyName],
    ["사업자번호", companyBiz],
    ["대표", companyCeo],
    ["전화번호", companyPhone],
    ["주소", companyAddress]
  ];

  const renderRows = (rows) => rows.map(([label, value]) => `
    <div class="print-cover-info-row">
      <div class="print-cover-info-label">${escapeHtml(label)}</div>
      <div class="print-cover-info-value">${escapeHtml(value || "-")}</div>
    </div>
  `).join("");

  return `
    <div class="print-cover-sheet">
      <div class="print-cover-title-main">AK디자인 견적서</div>
      <div class="print-cover-stack">
        <section class="print-cover-box print-cover-primary">
          ${renderRows(infoRows)}
        </section>
        <section class="print-cover-box print-cover-company-box2">
          <div class="print-cover-company-header">회사 정보</div>
          ${renderRows(companyRows)}
        </section>
      </div>
    </div>
  `;
}

function buildCounselPrintHtml() {
  const get = (id, fallback = "") => document.getElementById(id)?.value || fallback;
  return `
    <div class="card print-card-shell">
      <div class="card-header">상담일지</div>
      <div class="card-body">
        <div class="form-grid-4 print-form-grid-4">
          <div class="field"><label>상담일자</label><input value="${escapeHtml(get("counsel_date", get("quote_date")))}" readonly></div>
          <div class="field"><label>성함</label><input value="${escapeHtml(get("counsel_name", get("customer_name")))}" readonly></div>
          <div class="field"><label>전화번호</label><input value="${escapeHtml(get("counsel_phone", get("customer_phone")))}" readonly></div>
          <div class="field"><label>현장명</label><input value="${escapeHtml(get("counsel_site_name", get("site_name")))}" readonly></div>
          <div class="field" style="grid-column: span 4;"><label>현장주소</label><input value="${escapeHtml(get("counsel_site_address", get("site_address")))}" readonly></div>
          <div class="field memo-box" style="grid-column: span 4;"><label>상담내용</label><textarea readonly>${escapeHtml(get("counsel_memo") || "-")}</textarea></div>
        </div>
      </div>
    </div>
  `;
}

function cloneHtmlWithLiveFormValues(sourceEl) {
  if (!sourceEl) return "";
  const clone = sourceEl.cloneNode(true);
  const srcFields = sourceEl.querySelectorAll("input, textarea, select");
  const cloneFields = clone.querySelectorAll("input, textarea, select");

  srcFields.forEach((src, idx) => {
    const dest = cloneFields[idx];
    if (!dest) return;

    if (src.tagName === "TEXTAREA") {
      dest.textContent = src.value || "";
      return;
    }

    if (src.tagName === "SELECT") {
      const options = dest.querySelectorAll("option");
      options.forEach((opt, optIdx) => {
        const srcOpt = src.options[optIdx];
        if (!srcOpt) return;
        if (srcOpt.selected) opt.setAttribute("selected", "selected");
        else opt.removeAttribute("selected");
      });
      return;
    }

    const type = (src.getAttribute("type") || "").toLowerCase();
    if (type === "checkbox" || type === "radio") {
      if (src.checked) dest.setAttribute("checked", "checked");
      else dest.removeAttribute("checked");
    } else {
      dest.setAttribute("value", src.value || "");
    }
  });

  return clone.outerHTML;
}

function renderMobileDetailCards() {
  bindComboOutsideCloseOnce();

  const wrap = document.getElementById("mobileDetailInput");
  if (!wrap) return;

  wrap.innerHTML = "";

  detailRows.forEach((row, index) => {
    updateComputedAmounts(row);

    wrap.insertAdjacentHTML("beforeend", `
      <div class="detail-mobile-card">
        <div class="detail-mobile-head">
          <div class="detail-mobile-no">상세 ${index + 1}</div>
          <div class="detail-mobile-amount">${formatWon(row.line_amount)}</div>
        </div>

        <div class="detail-mobile-grid detail-mobile-grid-2">
          <div class="field">
            <label>공종명</label>
            <input value="${escapeHtml(row.work_name || "")}" onchange="updateRowValue('${row.id}','work_name',this.value); maybeAutoAppendRow('${row.id}');" placeholder="공종명" />
          </div>
          <div class="field">
            <label>품목명</label>
            <input value="${escapeHtml(row.item_name || "")}" onchange="updateRowValue('${row.id}','item_name',this.value); maybeAutoAppendRow('${row.id}');" placeholder="품목명" />
          </div>
        </div>

        <div class="detail-mobile-grid detail-mobile-grid-2">
          <div class="field">
            <label>규격</label>
            <input value="${escapeHtml(row.spec || "")}" onchange="updateRowValue('${row.id}','spec',this.value); maybeAutoAppendRow('${row.id}');" placeholder="규격" />
          </div>
          <div class="field">
            <label>단위</label>
            <input value="${escapeHtml(row.unit || "")}" onchange="updateRowValue('${row.id}','unit',this.value); maybeAutoAppendRow('${row.id}');" placeholder="단위" />
          </div>
        </div>

        <div class="detail-mobile-grid detail-mobile-grid-2 detail-mobile-grid-compact">
          <div class="field">
            <label>수량</label>
            <input type="number" value="${row.qty || 0}" oninput="updateRowValue('${row.id}','qty',this.value);" />
          </div>
          <div class="field">
            <label>자재비</label>
            <input type="number" value="${row.cost_material || 0}" oninput="updateRowValue('${row.id}','cost_material',this.value);" />
          </div>
          <div class="field">
            <label>노무비</label>
            <input type="number" value="${row.cost_labor || 0}" oninput="updateRowValue('${row.id}','cost_labor',this.value);" />
          </div>
          <div class="field">
            <label>경비</label>
            <input type="number" value="${row.cost_expense || 0}" oninput="updateRowValue('${row.id}','cost_expense',this.value);" />
          </div>
        </div>

        <div class="field detail-mobile-note">
          <label>비고</label>
          <textarea onchange="updateRowValue('${row.id}','note',this.value);" placeholder="비고">${escapeHtml(row.note || "")}</textarea>
        </div>

        <div class="detail-mobile-actions">
          <button type="button" class="table-btn" onclick="updateMaterialMasterFromRow('${row.id}')">단가수정</button>
          <button type="button" class="table-btn delete-btn" onclick="removeQuoteRow('${row.id}'); renderMobileDetailCards();">삭제</button>
        </div>
      </div>
    `);
  });
}

function syncAll() {
  renderDetailInputTable();
  renderMobileDetailCards();
  renderPreviewTables();
  calculateAll();
  if (typeof refreshCompanySummary === "function") refreshCompanySummary();
}

function renderDetailInputTable() {
  if (typeof renderDetailRows === "function") renderDetailRows();
}

function sanitizeFilePart(value, fallback = "미지정") {
  const cleaned = String(value || "").trim().replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return cleaned || fallback;
}

function ensurePrintAreaReady() {
  renderPreviewTables();
  if (typeof syncCounselFromEstimate === "function") syncCounselFromEstimate(false);
  if (typeof syncContractFromEstimate === "function") syncContractFromEstimate(false);

  const area = document.getElementById("printArea");
  if (!area) throw new Error("printArea를 찾을 수 없습니다.");

  const summary = document.querySelector("#tab-summary .card");
  const detail = document.querySelector("#tab-detail .card");
  const contract = document.getElementById("contractSheet");

  area.innerHTML = [
    buildPrintSection("겉지", buildPrintCoverHtml(), "print-cover-block"),
    buildPrintSection("견적요약", stripPrintUnneededTitles(summary ? cloneHtmlWithLiveFormValues(summary) : ""), "print-summary-block"),
    buildPrintSection("견적상세", stripPrintUnneededTitles(detail ? cloneHtmlWithLiveFormValues(detail) : ""), "print-detail-block"),
    buildPrintSection("상담일지", buildCounselPrintHtml(), "print-counsel-block"),
    buildPrintSection("계약서", stripPrintUnneededTitles(contract ? cloneHtmlWithLiveFormValues(contract) : ""), "print-contract-block")
  ].join("");
  return area;
}

function printQuote() {
  try {
    ensurePrintAreaReady();
    window.print();
  } catch (err) {
    console.error(err);
    alert("PDF 인쇄 오류: " + err.message);
  }
}

const __originalSelectQuoteFromSearch = selectQuoteFromSearch;
selectQuoteFromSearch = async function(quoteId) {
  await __originalSelectQuoteFromSearch(quoteId);
  syncAll();
  if (typeof syncCounselFromEstimate === "function") syncCounselFromEstimate(false);
  if (typeof loadCounselLogList === "function") await loadCounselLogList();
  if (typeof loadContractByQuoteNo === "function") await loadContractByQuoteNo(document.getElementById("quote_no")?.value || "");
  if (typeof syncContractFromEstimate === "function") syncContractFromEstimate(false);
};

const __originalResetQuoteForm = resetQuoteForm;
resetQuoteForm = function() {
  __originalResetQuoteForm();
  currentQuoteDbTotalAmount = 0;
  ["counsel_date","counsel_name","counsel_phone","counsel_site_name","counsel_site_address","counsel_memo"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  const status = document.getElementById("counselStatusBox");
  if (status) status.textContent = "상담일지를 새로 작성할 수 있습니다.";
  if (typeof resetContractPayments === "function") resetContractPayments();
  if (typeof syncCounselFromEstimate === "function") syncCounselFromEstimate(false);
  if (typeof syncContractFromEstimate === "function") syncContractFromEstimate(false);
  if (typeof loadCounselLogList === "function") loadCounselLogList();
  syncAll();
};

const __originalInitApp = initApp;
initApp = async function() {
  await __originalInitApp();
  showTab("counsel");
  if (typeof syncCounselFromEstimate === "function") syncCounselFromEstimate(false);
  if (typeof loadCounselLogList === "function") await loadCounselLogList();
  if (typeof loadContractByQuoteNo === "function") await loadContractByQuoteNo(document.getElementById("quote_no")?.value || "");
  if (typeof syncContractFromEstimate === "function") syncContractFromEstimate(false);
  syncAll();
};
