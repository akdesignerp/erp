(function(){
  const DEFAULT_PAYMENTS = [
    { label: "1차", rate: 10, note: "계약시" },
    { label: "2차", rate: 30, note: "중간 지급" },
    { label: "3차", rate: 30, note: "중간 지급" },
    { label: "잔금", rate: 30, note: "공사 완료후" }
  ];
  let contractPayments = [];
  let latestCounselRows = [];

  function q(id){ return document.getElementById(id); }
  function toNumSafe(v){ return Number(String(v ?? "").replace(/[^\d.-]/g, "").trim()) || 0; }
  function formatWonSafe(num){ return "₩ " + Number(num || 0).toLocaleString("ko-KR"); }
  function setText(id, value){ const el=q(id); if(el) el.textContent = value ?? ""; }
  function setValue(id, value){ const el=q(id); if(el) el.value = value ?? ""; }
  function escapeHtml(v){
    return String(v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }
  function todayStrLocal(){
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth()+1).padStart(2,"0");
    const dd = String(d.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }
  function formatPlainNumber(num){ return Number(num || 0).toLocaleString("ko-KR"); }
  function getCurrentAmountsSafe(){
    try { if (typeof getCurrentAmounts === "function") return getCurrentAmounts(); } catch(e){}
    return { supplyAmount: 0, vatAmount: 0, totalAmount: 0 };
  }
  function getManualContractTotal(){
    const raw = String(q("contract_total_amount_input")?.value || "").replace(/[^\d]/g, "").trim();
    return raw ? toNumSafe(raw) : null;
  }
  function getEstimatedContractBaseTotal(){
    try {
      if (typeof currentQuoteDbTotalAmount !== "undefined" && toNumSafe(currentQuoteDbTotalAmount) > 0) {
        return toNumSafe(currentQuoteDbTotalAmount);
      }
    } catch(e){}
    const amounts = getCurrentAmountsSafe();
    return toNumSafe(amounts.totalAmount);
  }
  function getContractBaseTotal(){
    return getEstimatedContractBaseTotal();
  }
  function formatDateLabel(dateStr){
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
  }
  function setStatusBox(msg, isErr){
    const box = q("statusBox");
    if (!box) return;
    box.textContent = msg;
    box.style.color = isErr ? "#b91c1c" : "#111827";
  }
  function resetContractPayments(){
    contractPayments = DEFAULT_PAYMENTS.map(x => ({...x}));
    buildContractPaymentRows();
  }
  function renumberContractLabels(){
    const lastIndex = contractPayments.length - 1;
    contractPayments.forEach((row, idx) => {
      row.label = idx === lastIndex ? "잔금" : `${idx+1}차`;
    });
  }
  function findLargestRateIndex(){
    let bestIdx = contractPayments.length ? contractPayments.length - 1 : -1;
    let bestRate = -1;
    contractPayments.forEach((row, idx) => {
      if (idx === contractPayments.length - 1) return;
      const rate = toNumSafe(row.rate);
      if (rate > bestRate) { bestRate = rate; bestIdx = idx; }
    });
    return bestIdx;
  }
  function autoBalanceContractRates(changedIdx){
    const lastIdx = contractPayments.length - 1;
    if (changedIdx === lastIdx) return;
    let sumExceptLast = 0;
    contractPayments.forEach((row, idx) => {
      if (idx === lastIdx) return;
      row.rate = Math.max(0, toNumSafe(row.rate));
      sumExceptLast += row.rate;
    });
    const remain = Math.max(0, 100 - sumExceptLast);
    contractPayments[lastIdx].rate = remain;
    const lastInput = document.querySelector(`.contract-pay-rate[data-idx="${lastIdx}"]`);
    if (lastInput) lastInput.value = String(remain);
  }
  window.recalcContractPayments = function(){
    const total = getContractBaseTotal();
    let allocated = 0;
    let rateSum = 0;
    contractPayments.forEach((row, idx) => {
      const rate = Math.max(0, toNumSafe(row.rate));
      row.rate = rate;
      rateSum += rate;
      let amount = Math.round(total * (rate / 100));
      if (idx === contractPayments.length - 1) amount = total - allocated;
      else allocated += amount;
      setText(`contract_payment_amount_${idx}`, formatWonSafe(amount));
    });
    setStatusBox(rateSum === 100 ? "계약 비율 합계 100% 입니다." : `계약 비율 합계 ${rateSum}% 입니다.`, rateSum !== 100);
  };
  function buildContractPaymentRows(){
    const body = q("contractPaymentBody");
    if (!body) return;
    const totalRow = body.querySelector(".contract-total-row");
    body.innerHTML = "";
    if (totalRow) body.appendChild(totalRow);
    contractPayments.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><input class="contract-pay-label" data-idx="${idx}" value="${escapeHtml(row.label)}"></td>
        <td id="contract_payment_amount_${idx}">₩ 0</td>
        <td><div class="contract-rate-wrap"><input class="contract-pay-rate" data-idx="${idx}" type="text" inputmode="numeric" value="${Number(row.rate || 0)}"><span class="contract-rate-unit">%</span></div></td>
        <td>
          <div style="display:flex; gap:8px; align-items:center;">
            <input class="contract-pay-note" data-idx="${idx}" type="text" value="${escapeHtml(row.note)}" style="flex:1;">
            ${idx === contractPayments.length - 1 ? "" : `<button class="btn btn-light screen-only" type="button" onclick="removeContractPaymentRow(${idx})">삭제</button>`}
          </div>
        </td>`;
      body.appendChild(tr);
    });
    body.querySelectorAll(".contract-pay-rate").forEach(el => {
      const handler = (e) => {
        const idx = Number(e.target.dataset.idx);
        e.target.value = String(e.target.value || '').replace(/[^\d.]/g, '');
        contractPayments[idx].rate = toNumSafe(e.target.value);
        autoBalanceContractRates(idx);
        recalcContractPayments();
      };
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });
    body.querySelectorAll(".contract-pay-note").forEach(el => el.addEventListener("input", e => contractPayments[Number(e.target.dataset.idx)].note = e.target.value));
    body.querySelectorAll(".contract-pay-label").forEach(el => el.addEventListener("input", e => contractPayments[Number(e.target.dataset.idx)].label = e.target.value));
    recalcContractPayments();
  }
  window.addContractPaymentRow = function(){
    if (!contractPayments.length) resetContractPayments();
    const targetIndex = findLargestRateIndex();
    if (targetIndex < 0) {
      contractPayments.splice(Math.max(contractPayments.length - 1, 0), 0, { label: `${contractPayments.length}차`, rate: 0, note: "" });
      buildContractPaymentRows();
      return;
    }
    const target = contractPayments[targetIndex];
    const splitRate = Math.floor(Number(target.rate || 0) / 2);
    target.rate = Number(target.rate || 0) - splitRate;
    contractPayments.splice(targetIndex, 0, { label: `${contractPayments.length}차`, rate: splitRate, note: "추가 분할" });
    renumberContractLabels();
    buildContractPaymentRows();
  };
  window.removeContractPaymentRow = function(idx){
    if (idx < 0 || idx >= contractPayments.length - 1) return;
    const removed = contractPayments.splice(idx, 1)[0];
    const largest = findLargestRateIndex();
    if (largest >= 0) contractPayments[largest].rate = toNumSafe(contractPayments[largest].rate) + toNumSafe(removed.rate);
    renumberContractLabels();
    buildContractPaymentRows();
  };

  function getContractStoragePayload(){
    return {
      quote_no: q("quote_no")?.value || "",
      vat_type: q("contract_vat_type")?.value || "10",
      start_date: q("contract_start_date_input")?.value || "",
      end_date: q("contract_end_date_input")?.value || "",
      manual_total: getManualContractTotal(),
      payments: contractPayments,
      account_info: q("contract_account_info")?.textContent || "",
      scope_text: q("contract_scope_text")?.textContent || "",
      saved_at: new Date().toISOString()
    };
  }
  async function saveContractToDb(payload){
    if (typeof db === "undefined" || !payload.quote_no) return false;
    const { error } = await db.from("quote_contracts").upsert([{ quote_no: payload.quote_no, vat_type: payload.vat_type, start_date: payload.start_date || null, end_date: payload.end_date || null, manual_total: payload.manual_total || 0, payments_json: payload.payments, account_info: payload.account_info, scope_text: payload.scope_text, updated_at: new Date().toISOString() }], { onConflict: "quote_no" });
    if (error) throw error;
    return true;
  }
  async function loadContractFromDb(quoteNo){
    if (typeof db === "undefined" || !quoteNo) return null;
    const { data, error } = await db.from("quote_contracts").select("*").eq("quote_no", quoteNo).maybeSingle();
    if (error) throw error;
    return data || null;
  }
  function saveContractToLocal(payload){ if (payload.quote_no) localStorage.setItem(`ak_contract_${payload.quote_no}`, JSON.stringify(payload)); }
  function loadContractFromLocal(quoteNo){ try { return JSON.parse(localStorage.getItem(`ak_contract_${quoteNo}`) || "null"); } catch(e){ return null; } }
  function applyContractPayload(row){
    if (!row) return;
    setValue("contract_vat_type", row.vat_type || "10");
    setValue("contract_start_date_input", row.start_date || "");
    setValue("contract_end_date_input", row.end_date || "");
    setValue("contract_total_amount_input", row.manual_total ? formatPlainNumber(row.manual_total) : "");
    if (row.account_info) setText("contract_account_info", row.account_info);
    if (row.scope_text) setText("contract_scope_text", row.scope_text);
    contractPayments = Array.isArray(row.payments_json) ? row.payments_json.map(x => ({...x})) : Array.isArray(row.payments) ? row.payments.map(x => ({...x})) : DEFAULT_PAYMENTS.map(x => ({...x}));
    if (!contractPayments.length) contractPayments = DEFAULT_PAYMENTS.map(x => ({...x}));
    renumberContractLabels();
    buildContractPaymentRows();
  }
  window.saveContract = async function(){
    syncContractFromEstimate(false);
    setStatusBox("계약서 값 수정 저장은 사용하지 않습니다. 견적 불러오기 값으로 표시합니다.");
  };
  window.loadContractByQuoteNo = async function(quoteNo){
    if (!quoteNo) return;
    resetContractPayments();
    syncContractFromEstimate(false);
  };
  window.syncContractFromEstimate = function(updateStatus = true){
    if (!contractPayments.length) resetContractPayments();
    setValue("contract_quote_no_input", q("quote_no")?.value || "");
    setText("contract_vat_label", (q("contract_vat_type")?.value || "10") === "0" ? "부가가치세 불포함" : "부가가치세 포함");
    const estimatedTotal = getEstimatedContractBaseTotal();
    setValue("contract_total_amount_input", formatPlainNumber(estimatedTotal));
    const totalInputEl = q("contract_total_amount_input");
    if (totalInputEl) totalInputEl.setAttribute("readonly", "readonly");
    setText("contract_site_address", q("site_address")?.value || "-");
    setText("contract_start_date", formatDateLabel(q("contract_start_date_input")?.value || ""));
    setText("contract_end_date", formatDateLabel(q("contract_end_date_input")?.value || ""));
    setText("contract_customer_name", q("customer_name")?.value || "-");
    setText("contract_customer_phone", q("customer_phone")?.value || "-");
    setText("contract_customer_address", q("customer_address")?.value || q("site_address")?.value || "-");
    const today = new Date();
    setText("contract_sign_year", today.getFullYear());
    setText("contract_sign_month", today.getMonth() + 1);
    setText("contract_sign_day", today.getDate());
    setText("contract_company_phone", "010-3677-0454");
    recalcContractPayments();
    if (updateStatus) setStatusBox("현재 견적 내용을 계약서에 반영했습니다.");
  };

  function setCounselStatus(msg, isErr){
    const box = q("counselStatusBox");
    if (!box) return;
    box.textContent = msg;
    box.style.color = isErr ? "#b91c1c" : "#111827";
  }
  window.syncCounselFromEstimate = function(updateStatus = true){
    setValue("counsel_date", q("quote_date")?.value || todayStrLocal());
    setValue("counsel_name", q("customer_name")?.value || "");
    setValue("counsel_phone", q("customer_phone")?.value || "");
    setValue("counsel_site_name", q("site_name")?.value || "");
    setValue("counsel_site_address", q("site_address")?.value || "");
    if (updateStatus) setCounselStatus("현재 견적 정보로 상담일지를 채웠습니다.");
  };
  function pickCounselDate(row){ return row?.counsel_date || row?.quote_date || row?.consult_date || row?.date || row?.created_at || row?.updated_at || ""; }
  function pickCounselMemo(row){ return row?.counsel_note || row?.memo || row?.content || row?.note || row?.description || ""; }
  function sameAddress(a,b){ const aa = String(a || '').trim(), bb = String(b || '').trim(); return !!aa && !!bb && (aa === bb || aa.includes(bb) || bb.includes(aa)); }
  async function fetchCounselRowsRaw(){
    const result = await db.from("quote_counsel_logs").select("*").limit(500);
    if (result.error) throw result.error;
    const rows = Array.isArray(result.data) ? result.data : [];
    return rows.filter(r => r && (r.site_address || r.site_name || r.customer_name)).sort((a,b) => String(pickCounselDate(b)).localeCompare(String(pickCounselDate(a))));
  }
  function renderCounselList(rows){
    const box = q("counselListBox");
    const address = (q("counsel_site_address")?.value || q("site_address")?.value || "").trim();
    if (!box) return;
    if (!rows.length) {
      box.innerHTML = `<div class="empty">${address ? `해당 현장주소(${escapeHtml(address)})의 상담일지가 없습니다.` : '저장된 상담일지가 없습니다.'}</div>`;
      return;
    }
    box.innerHTML = rows.map((row, idx) => {
      const date = String(pickCounselDate(row) || '').slice(0,10) || '-';
      return `<button type="button" class="counsel-list-item" onclick="loadCounselLogByIndex(${idx})"><div class="counsel-list-top"><span>${date}</span><span>${escapeHtml(row.quote_status || row.status || '')}</span></div><div class="counsel-list-sub">${escapeHtml(row.customer_name || '-')}</div></button>`;
    }).join("");
  }
  function applyCounselRow(row){
    if (!row) return;
    setValue("counsel_date", String(pickCounselDate(row) || "").slice(0,10));
    setValue("counsel_name", row.customer_name || "");
    setValue("counsel_phone", row.customer_phone || row.phone || "");
    setValue("counsel_site_name", row.site_name || q("site_name")?.value || "");
    setValue("counsel_site_address", row.site_address || "");
    setValue("counsel_memo", pickCounselMemo(row));
    setCounselStatus("상담일지를 불러왔습니다.");
  }
  window.loadCounselLogByIndex = function(idx){ applyCounselRow(latestCounselRows[idx]); };
  window.loadCounselLogList = async function(){
    try {
      const currentAddress = (q("counsel_site_address")?.value || q("site_address")?.value || "").trim();
      const rows = await fetchCounselRowsRaw();
      latestCounselRows = currentAddress ? rows.filter(row => sameAddress(row.site_address, currentAddress)) : rows;
      renderCounselList(latestCounselRows);
    } catch (err) {
      console.error(err);
      setCounselStatus("상담일지 목록 불러오기 실패: " + err.message, true);
    }
  };
  function buildCounselPayload(){
    const selectedStatus = q("quote_status")?.value || q("topQuoteStatus")?.textContent || "";
    return { quote_no: q("quote_no")?.value || "", customer_name: q("counsel_name")?.value || "", customer_phone: q("counsel_phone")?.value || "", phone: q("counsel_phone")?.value || "", site_name: q("counsel_site_name")?.value || "", site_address: q("counsel_site_address")?.value || "", counsel_date: q("counsel_date")?.value || null, memo: q("counsel_memo")?.value || "", quote_status: selectedStatus, updated_at: new Date().toISOString(), created_at: new Date().toISOString() };
  }
  window.saveCounselLog = async function(){
    try {
      const payload = buildCounselPayload();
      if (!payload.quote_no) throw new Error("견적번호가 없습니다.");
      if (!payload.site_address) throw new Error("현장주소가 없습니다.");
      if (!payload.counsel_date) throw new Error("상담일자를 입력하세요.");
      const rows = await fetchCounselRowsRaw();
      const existing = rows.find(r => String(r.quote_no || "").trim() === payload.quote_no && String(pickCounselDate(r) || "").slice(0,10) === payload.counsel_date && sameAddress(r.site_address, payload.site_address));
      const result = existing ? await db.from("quote_counsel_logs").update(payload).eq("id", existing.id) : await db.from("quote_counsel_logs").insert([payload]);
      if (result.error) throw result.error;
      setCounselStatus(existing ? "같은 현장/같은 날짜 상담일지를 수정 저장했습니다." : "상담일지를 저장했습니다.");
      await loadCounselLogList();
    } catch (err) {
      console.error(err);
      setCounselStatus("상담일지 저장 실패: " + err.message, true);
    }
  };

  document.addEventListener("DOMContentLoaded", () => {
    resetContractPayments();
    syncContractFromEstimate(false);
    syncCounselFromEstimate(false);
    loadCounselLogList().catch(() => {});
    ["contract_total_amount_input","contract_vat_type","contract_start_date_input","contract_end_date_input","quote_date","quote_no","customer_name","customer_phone","customer_address","site_address","site_name","vat_type","quote_status"].forEach(id => {
      const el = q(id);
      if (!el || el.dataset.contractBound) return;
      el.dataset.contractBound = "1";
      el.addEventListener("input", () => { syncContractFromEstimate(false); syncCounselFromEstimate(false); });
      el.addEventListener("change", () => { syncContractFromEstimate(false); syncCounselFromEstimate(false); if (id === "site_address") loadCounselLogList().catch(() => {}); });
    });
    const totalInput = q("contract_total_amount_input");
    if (totalInput) {
      totalInput.addEventListener("input", () => { totalInput.value = String(totalInput.value || "").replace(/[^\d]/g, ""); recalcContractPayments(); });
      totalInput.addEventListener("blur", () => { totalInput.value = formatPlainNumber(toNumSafe(totalInput.value)); recalcContractPayments(); });
    }
  });
})();
