
(function(){
  const DEFAULT_PAYMENTS = [
    { label: "1차", rate: 10, note: "계약시" },
    { label: "2차", rate: 30, note: "중간 지급" },
    { label: "3차", rate: 30, note: "중간 지급" },
    { label: "잔금", rate: 30, note: "공사 완료후" }
  ];

  let contractPayments = [];

  function q(id){ return document.getElementById(id); }
  function safeText(v){ return (v ?? "").toString(); }
  function toNumPatch(v){ return Number(String(v ?? "").replace(/[^\d.-]/g, "").trim()) || 0; }
  function formatWonPatch(num){ return "₩ " + Number(num || 0).toLocaleString("ko-KR"); }
  function setText(id, value){ const el = q(id); if (el) el.textContent = value ?? ""; }
  function setValue(id, value){ const el = q(id); if (el) el.value = value ?? ""; }

  function allTabs(){
    return ["write","summary","detail","contract","counsel","company"];
  }

  function activateTabBtn(tabName){
    document.querySelectorAll(".tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });
  }

  function hideAllTabs(){
    allTabs().forEach(name => q("tab-" + name)?.classList.add("hidden"));
  }

  async function renderCommonTab(tabName){
    hideAllTabs();
    q("tab-" + tabName)?.classList.remove("hidden");
    activateTabBtn(tabName);
    if (tabName === "summary" || tabName === "detail") {
      if (typeof renderPreviewTables === "function") renderPreviewTables();
    }
    if (tabName === "contract") syncContractFromEstimate();
    if (tabName === "counsel") { syncCounselFromEstimate(false); loadCounselLogList(); }
  }

  window.showTab = async function(tabName){
    if (tabName === "company") {
      requestCompanyAccess();
      return;
    }
    await renderCommonTab(tabName);
  };

  window.requestCompanyAccess = function(){
    q("companyAuthModal")?.classList.add("show");
    setValue("companyAuthPassword", "");
    setValue("companyOldPassword", "");
    setValue("companyNewPassword", "");
    closeCompanyPasswordChangeView();
    setCompanyAuthStatus("회사관리 비밀번호를 입력하세요.");
  };

  window.closeCompanyAuthModal = function(){
    q("companyAuthModal")?.classList.remove("show");
  };

  window.openCompanyPasswordChangeView = function(){
    q("companyAuthLoginView")?.classList.add("hidden");
    q("companyAuthChangeView")?.classList.remove("hidden");
    setCompanyAuthStatus("기존 비밀번호 확인 후 새 비밀번호를 저장합니다.");
  };

  window.closeCompanyPasswordChangeView = function(){
    q("companyAuthChangeView")?.classList.add("hidden");
    q("companyAuthLoginView")?.classList.remove("hidden");
  };

  function setCompanyAuthStatus(msg, isErr){
    const box = q("companyAuthStatus");
    if (!box) return;
    box.textContent = msg;
    box.style.color = isErr ? "#b91c1c" : "#111827";
  }

  async function getCompanyPasswordRow(){
    if (typeof db === "undefined") throw new Error("DB 연결이 없습니다.");
    let data = null;
    let error = null;
    ({ data, error } = await db.from("company_admin_auth").select("*").limit(1).maybeSingle());
    if (error) {
      const retry = await db.from("company_admin_auth").select("*");
      if (retry.error) throw retry.error;
      data = Array.isArray(retry.data) ? (retry.data[0] || null) : (retry.data || null);
    }
    return data;
  }

  window.submitCompanyAuth = async function(){
    try {
      const row = await getCompanyPasswordRow();
      if (!row) throw new Error("company_admin_auth 테이블에 비밀번호가 없습니다.");
      const input = q("companyAuthPassword")?.value || "";
      if (!input) return setCompanyAuthStatus("비밀번호를 입력하세요.", true);
      if (String(row.password_plain || "") !== input) return setCompanyAuthStatus("비밀번호가 일치하지 않습니다.", true);
      closeCompanyAuthModal();
      await renderCommonTab("company");
      if (typeof initCompanyTab === "function") initCompanyTab();
    } catch (err) {
      console.error(err);
      setCompanyAuthStatus("회사관리 인증 실패: " + err.message, true);
    }
  };

  window.changeCompanyPassword = async function(){
    try {
      const row = await getCompanyPasswordRow();
      if (!row) throw new Error("기존 비밀번호 정보가 없습니다.");
      const oldPw = q("companyOldPassword")?.value || "";
      const newPw = q("companyNewPassword")?.value || "";
      if (!oldPw || !newPw) return setCompanyAuthStatus("기존 비밀번호와 새 비밀번호를 모두 입력하세요.", true);
      if (String(row.password_plain || "") !== oldPw) return setCompanyAuthStatus("기존 비밀번호가 틀렸습니다.", true);

      let result = await db.from("company_admin_auth").update({
        password_plain: newPw
      }).eq("id", row.id);
      if (result.error && !String(result.error.message || '').includes('updated_at')) throw result.error;
      setCompanyAuthStatus("비밀번호를 변경했습니다.");
      closeCompanyPasswordChangeView();
      q("companyAuthPassword").value = "";
      q("companyOldPassword").value = "";
      q("companyNewPassword").value = "";
    } catch (err) {
      console.error(err);
      setCompanyAuthStatus("비밀번호 변경 실패: " + err.message, true);
    }
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
        contractPayments[idx].rate = toNumPatch(e.target.value);
        autoBalanceContractRates(idx);
        recalcContractPayments();
      };
      el.addEventListener("input", handler);
      el.addEventListener("change", handler);
    });
    body.querySelectorAll(".contract-pay-note").forEach(el => {
      el.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.idx);
        contractPayments[idx].note = e.target.value;
      });
    });
    body.querySelectorAll(".contract-pay-label").forEach(el => {
      el.addEventListener("input", (e) => {
        const idx = Number(e.target.dataset.idx);
        contractPayments[idx].label = e.target.value;
      });
    });
    recalcContractPayments();
  }

  function escapeHtml(v){
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  window.addContractPaymentRow = function(){
    if (contractPayments.length === 0) resetContractPayments();
    const targetIndex = findLargestRateIndex();
    if (targetIndex < 0) {
      contractPayments.splice(Math.max(contractPayments.length - 1, 0), 0, { label: nextPaymentLabel(), rate: 0, note: "" });
      buildContractPaymentRows();
      return;
    }
    const target = contractPayments[targetIndex];
    const splitRate = Math.floor(Number(target.rate || 0) / 2);
    const remain = Number(target.rate || 0) - splitRate;
    target.rate = remain;
    contractPayments.splice(targetIndex, 0, { label: nextPaymentLabel(), rate: splitRate, note: "추가 분할" });
    renumberContractLabels();
    buildContractPaymentRows();
  };

  window.removeContractPaymentRow = function(idx){
    if (idx < 0 || idx >= contractPayments.length - 1) return;
    const removed = contractPayments.splice(idx, 1)[0];
    const largest = findLargestRateIndex();
    if (largest >= 0) contractPayments[largest].rate = toNumPatch(contractPayments[largest].rate) + toNumPatch(removed.rate);
    renumberContractLabels();
    buildContractPaymentRows();
  };

  function resetContractPayments(){
    contractPayments = DEFAULT_PAYMENTS.map(x => ({...x}));
    buildContractPaymentRows();
  }

  function renumberContractLabels(){
    const lastIndex = contractPayments.length - 1;
    contractPayments.forEach((row, idx) => {
      if (idx === lastIndex) row.label = "잔금";
      else row.label = `${idx+1}차`;
    });
  }

  function nextPaymentLabel(){
    return `${contractPayments.length}차`;
  }

  function findLargestRateIndex(){
    let bestIdx = -1;
    let bestRate = -1;
    contractPayments.forEach((row, idx) => {
      if (idx === contractPayments.length - 1) return;
      const rate = toNumPatch(row.rate);
      if (rate > bestRate) { bestRate = rate; bestIdx = idx; }
    });
    if (bestIdx === -1 && contractPayments.length) bestIdx = contractPayments.length - 1;
    return bestIdx;
  }

  function autoBalanceContractRates(changedIdx){
    if (!contractPayments.length) return;
    const lastIdx = contractPayments.length - 1;
    if (changedIdx === lastIdx) return;

    let sumExceptLast = 0;
    contractPayments.forEach((row, idx) => {
      if (idx === lastIdx) return;
      row.rate = Math.max(0, toNumPatch(row.rate));
      sumExceptLast += row.rate;
    });

    const remain = Math.max(0, 100 - sumExceptLast);
    contractPayments[lastIdx].rate = remain;

    const lastInput = document.querySelector(`.contract-pay-rate[data-idx="${lastIdx}"]`);
    if (lastInput) lastInput.value = String(remain);
  }

  window.recalcContractPayments = function(){
    const total = getContractBaseTotal();
    let rateSum = 0;
    let allocated = 0;
    contractPayments.forEach((row, idx) => {
      const rate = Math.max(0, toNumPatch(row.rate));
      row.rate = rate;
      rateSum += rate;
      let amount = Math.round(total * (rate / 100));
      if (idx === contractPayments.length - 1) {
        amount = total - allocated;
      } else {
        allocated += amount;
      }
      setText(`contract_payment_amount_${idx}`, formatWonPatch(amount));
      const input = document.querySelector(`.contract-pay-rate[data-idx="${idx}"]`);
      if (input && document.activeElement !== input) input.value = String(rate);
    });
    setStatusBox(rateSum === 100 ? "계약 비율 합계 100% 입니다." : `계약 비율 합계 ${rateSum}% 입니다.`, rateSum !== 100);
  };

  function setStatusBox(msg, isErr){
    const box = q("statusBox");
    if (!box) return;
    box.textContent = msg;
    box.style.color = isErr ? "#b91c1c" : "#111827";
  }

  function currentAmountsSafe(){
    try {
      if (typeof getCurrentAmounts === "function") return getCurrentAmounts();
    } catch (e) {}
    return { totalAmount: 0, supplyAmount: 0, vatAmount: 0 };
  }


  function formatPlainNumber(num){
    return Number(num || 0).toLocaleString("ko-KR");
  }

  function getContractTotalInput(){
    return q("contract_total_amount_input");
  }

  function getManualContractTotal(){
    const el = getContractTotalInput();
    if (!el) return null;
    const raw = String(el.value || "").replace(/[^\d]/g, "").trim();
    if (!raw) return null;
    return toNumPatch(raw);
  }

  function setManualContractTotal(value){
    const el = getContractTotalInput();
    if (!el) return;
    const num = toNumPatch(value);
    el.value = num ? formatPlainNumber(num) : "";
  }

  function getEstimatedContractBaseTotal(){
    const amounts = currentAmountsSafe();
    const vatType = q("contract_vat_type")?.value || "10";
    return vatType === "0" ? toNumPatch(amounts.supplyAmount) : toNumPatch(amounts.totalAmount);
  }

  function getContractBaseTotal(){
    const manual = getManualContractTotal();
    if (manual !== null) return toNumPatch(manual);
    return getEstimatedContractBaseTotal();
  }

  function formatDateLabel(dateStr){
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return dateStr;
    return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일`;
  }

  function syncContractCore(){
    const amounts = currentAmountsSafe();
    const total = getEstimatedContractBaseTotal();
    if (getManualContractTotal() === null) setManualContractTotal(total);
    setText("contract_vat_label", (q("contract_vat_type")?.value || "10") === "0" ? "부가가치세 불포함" : "부가가치세 포함");
    setValue("contract_quote_no_input", q("quote_no")?.value || "");
    setText("contract_site_address", q("site_address")?.value || "-");
    setText("contract_start_date", formatDateLabel(q("contract_start_date_input")?.value || ""));
    setText("contract_end_date", formatDateLabel(q("contract_end_date_input")?.value || ""));
    setText("contract_customer_name", q("customer_name")?.value || "-");
    setText("contract_customer_phone", q("customer_phone")?.value || "-");
    setText("contract_customer_address", q("customer_address")?.value || q("site_address")?.value || "-");
    const quoteDate = q("quote_date")?.value || new Date().toISOString().slice(0,10);
    const d = new Date(quoteDate);
    if (!Number.isNaN(d.getTime())) {
      setText("contract_sign_year", d.getFullYear());
      setText("contract_sign_month", d.getMonth()+1);
      setText("contract_sign_day", d.getDate());
    }
    recalcContractPayments();
  }

  window.syncContractFromEstimate = function(){
    if (!contractPayments.length) resetContractPayments();
    bindContractInputEvents();
    syncContractCore();
    setStatusBox("현재 견적 내용을 계약서에 반영했습니다.");
  };

  window.buildContractPrintHtml = function(){
    syncContractCore();
    const vatLabel = q("contract_vat_label")?.textContent || "부가가치세 포함";
    const totalAmount = formatWonPatch(getContractBaseTotal());
    const rows = contractPayments.map((row, idx) => {
      const amount = q(`contract_payment_amount_${idx}`)?.textContent || formatWonPatch(Math.round(getContractBaseTotal() * (toNumPatch(row.rate)/100)));
      return `<tr>
        <td>${escapeHtml(row.label || "-")}</td>
        <td>${escapeHtml(amount)}</td>
        <td>${escapeHtml(String(toNumPatch(row.rate)))}%</td>
        <td>${escapeHtml(row.note || "")}</td>
      </tr>`;
    }).join("");
    return `
    <div class="contract-sheet">
      <div class="contract-title">실내인테리어 표준계약서</div>

      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제1조(목적)</strong><br>
이 계약서는 실내건축·창호 공사를 의뢰한 소비자와 시공업자와 사이에 체결된 공사 계약상의 권리·의무 및 책임에 관한 사항을 규정함을 목적으로 한다.</p>
      </div>

      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제2조(계약서 제공·설명 의무)</strong><br>
“시공업자”는 계약체결 시 소비자에게 상호 및 대표자 성명, 영업소재지 주소(“소비자”의 불만을 처리할 수 있는 곳의 주소 포함)를 기재한 본 계약서, 공사면허 등을 소비자에게 제공하고 다음 각 호의 규정을 “소비자”가 이해할 수 있도록 설명하여야 한다.</p>
      </div>

      <div class="contract-card contract-card-section">
        <div class="contract-subtitle">제3조(계약내용)</div>

        <div class="contract-card contract-card-subsection compact">
          <div class="contract-subtitle">1. 시공장소 및 공사일정</div>
          <table class="contract-info-table"><tbody>
            <tr><th style="width:160px;">공사장소</th><td>${escapeHtml(q("contract_site_address")?.textContent || "-")}</td></tr>
            <tr><th>착 공 일</th><td>${escapeHtml(q("contract_start_date")?.textContent || "-")}</td></tr>
            <tr><th>공사완료</th><td>${escapeHtml(q("contract_end_date")?.textContent || "-")}</td></tr>
          </tbody></table>
        </div>

        <div class="contract-card contract-card-subsection compact">
          <div class="contract-subtitle">2. 공사비 및 지급방법</div>
          <table class="contract-pay-table">
            <thead><tr><th style="width:28%;">항목</th><th style="width:22%;">금액</th><th style="width:12%;">비율</th><th style="width:38%;">조건</th></tr></thead>
            <tbody>
              <tr class="contract-total-row"><td>총 공사금액</td><td>${escapeHtml(totalAmount)}</td><td></td><td>${escapeHtml(vatLabel)}</td></tr>
              ${rows}
            </tbody>
          </table>
          <div class="contract-note">${escapeHtml(q("contract_account_info")?.textContent || "").split("\n").join("<br>")}</div>
        </div>

        <div class="contract-card contract-card-subsection compact">
          <div class="contract-subtitle">3. 공사의 범위 및 공사의 내역</div>
          <div class="contract-note">${escapeHtml(q("contract_scope_text")?.textContent || "").split("\n").join("<br>")}</div>
        </div>
      </div>

      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제4조(“시공업자”의 의무)</strong><br>
① “시공업자”는 제3조의 계약내용을 준수하여 공사를 완료하여야 한다.<br>
② “시공업자”는 공사완료 후 당초 설계서에 의한 공사내용이 계약내용과 이상이 없음을 “소비자”에게 확인시켜야 한다.<br>
③ “시공업자”는 제10조 규정에 따라 하자보수의 책임을 진다.</p>
      </div>
      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제5조(“소비자”의 의무)</strong><br>
① “소비자”는 제3조 제3항의 공사금액을 정해진 기일에 “시공업자”에게 지급하여야 한다.<br>
② “소비자”는 공사금액을 지급함에 있어 하자가 발견되었을 경우 “소비자”는 하자의 보수나 하자보수에 갈음하는 금액을 “시공업자”에게 청구할 수 있으며, 이를 청구한 경우 “시공업자”가 하자를 보수하거나 하자보수에 갈음하는 금액을 지급 할 때까지 그에 상응하는 공사금액의 지급을 거절할 수 있다.</p>
      </div>
      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제6조(지연배상)</strong><br>
① “소비자”가 공사금액의 지급을 지연한 경우 “소비자”는 연체일로부터 실제 지급일까지 ( 5 )%의 연체이율을 적용한 지연손해금을 “시공업자”에게 지급하여야 한다.<br>
② “시공업자”가 계약서에서 정한 공사완료 일자를 준수하지 않을 경우 “시공업자”는 “소비자”가 공사완료 이전까지 지급한 금액에 대하여 공사지연일로부터 최종 공사완공일까지 기간에 전항의 연체이율을 적용한 지연손해금을 “소비자”에게 지급하여야 한다.</p>
      </div>
      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제7조(계약해제 및 위약금)</strong><br>
① “소비자” 또는 “시공업자”는 다음 각 호의 어느 하나에 해당하는 경우 상대방에게 서면으로 즉시 계약을 해제할 수 있다.<br>
1. “시공업자”의 책임 있는 사유로 공사완료일 내에 공사를 완성할 가능성이 없음이 명백한 경우<br>
2. “소비자” 또는 “시공업자”가 계약조건을 위반하여 그 위반으로 계약의 목적을 달성할 수 없을 경우<br>
② “소비자”는 “시공업자”가 정당한 사유 없이 착공을 지연한 경우 상당한 기간을 정하여 서면으로 계약의 이행을 최고한 후 동 기간 내에 계약이 이행되지 아니한 때 계약을 해제할 수 있다.<br>
③ “소비자” 또는 “시공업자”의 귀책사유로 계약이 해제된 경우 “소비자” 또는 “시공업자”는 다음 각 호의 규정에 의한 위약금을 상대방에게 지급하여야 한다.</p>
      </div>
      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제8조(공사변경 및 책임)</strong><br>
① “시공업자”는 공사의 설계 및 자재변경 등으로 인하여 계약한 제품의 공급이 불가능할 경우 변경 시공할 내역을 “소비자”에게 통보하고, “소비자”와 협의한 후 동질․동가의 제품으로 시공할 수 있다.<br>
② “소비자”의 사정에 의하여 공사내용이 변경되는 경우 “소비자”와 “시공업자”는 협의하여 변경할 수 있고, 공사에 발생하는 추가비용 및 불법적 요소의 공사는 “소비자”가 책임진다.</p>
      </div>
      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제9조(양도양수)</strong><br>
① “소비자”는 매매 등 계약의 이행에 영향을 미치는 사유가 발생하였을 때에는 “시공업자”에게 서면으로 통지하여야 한다.<br>
② “소비자”의 건축물에 대한 매매 등 소유권 이전이 발생한 경우 “소비자”와 “시공업자”는 본 계약이 소유권을 이전받는 자에게 승계되도록 노력하여야 한다.</p>
      </div>
      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제10조(하자보수)</strong><br>
① “시공업자”는 공사완료 후, 균열, 누수, 파손 등의 하자가 발생하였을 때 무상 수리기간 내에는 무상 수리를 해주어야 한다.<br>
무상수리 기간 : 공사 종료 후 1년 (전등, 수전등 소모품등 1년, 화장실 누수 3년)<br>
② 무상 수리기간이 지난 후 발생한 하자에 대하여는 유상수리 할 수 있다.<br>
③ 계약서상의 규격에 미달할 경우 교체시공이나 공사금액 차액 환급 등의 손해배상을 청구할 수 있다.</p>
      </div>
      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제11조(분쟁의 해결)</strong><br>
이 계약서에서 규정하지 않은 사항과 해석에 관하여는 관계법령 또는 상관례에 따른다.</p>
      </div>
      <div class="contract-card contract-card-article">
        <p class="contract-paragraph"><strong>제12조(관할법원)</strong><br>
이 계약과 관련된 분쟁에 관한 소송은 민사소송법상의 관할법원에 제기하여야 한다.</p>
      </div>

      <div class="contract-card contract-card-sign">
        <div class="contract-date-row">${escapeHtml(q("contract_sign_year")?.textContent || "-")}년 ${escapeHtml(q("contract_sign_month")?.textContent || "-")}월 ${escapeHtml(q("contract_sign_day")?.textContent || "-")}일</div>
        <table class="contract-sign-table"><tbody>
          <tr><th style="width:50%;">소비자</th><th style="width:50%;">시공업체</th></tr>
          <tr><td>성명 : ${escapeHtml(q("contract_customer_name")?.textContent || "-")}</td><td>상호 : 에이케이디자인</td></tr>
          <tr><td>주소 : ${escapeHtml(q("contract_customer_address")?.textContent || "-")}</td><td>사업자번호 : 143-12-01221</td></tr>
          <tr><td>전화 : ${escapeHtml(q("contract_customer_phone")?.textContent || "-")}</td><td>대표자 : 김민석</td></tr>
        </tbody></table>
      </div>
    </div>`;
  }

  window.printContractOnly = function(){
    syncContractFromEstimate();
    const w = window.open("", "_blank");
    const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="UTF-8"><title>계약서</title>
      <base href="${location.href.replace(/[^/]*$/, '')}">
      <link rel="stylesheet" href="contract.css">
      <style>
        body{margin:0;padding:8mm;background:#fff;}
        .screen-only{display:none !important;}
        .contract-sheet{box-shadow:none;border:none;max-width:none;padding:0;margin:0;overflow:visible !important;height:auto !important;page-break-inside:auto !important;break-inside:auto !important;background:#fff !important;}
        .contract-paragraph,.contract-note,.contract-info-table td,.contract-pay-table td,.contract-sign-table td{white-space:pre-wrap !important;word-break:break-word !important;overflow-wrap:anywhere !important;}
        @media print{
          @page{size:A4;margin:6mm;}
          body{padding:0;}
          .contract-sheet{font-size:9.2px !important;line-height:1.28 !important;}
          .contract-title{font-size:16px !important;margin:0 0 8px !important;}
        }
      </style>
      </head><body>${buildContractPrintHtml()}
      <script>
        let __printed = false;
        function runPrint(){
          if(__printed) return;
          __printed = true;
          setTimeout(() => { try { window.print(); } catch(e) {} }, 250);
        }
        window.addEventListener('load', runPrint, { once:true });
        window.addEventListener('afterprint', () => { try { window.close(); } catch(e) {} });
      <\/script>
      </body></html>`;
    if (!w) return alert("팝업이 차단되어 인쇄창을 열 수 없습니다.");
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
  };

  function bindContractInputEvents(){
    const totalInput = getContractTotalInput();
    if (totalInput && !totalInput.dataset.bound) {
      totalInput.dataset.bound = "1";
      totalInput.addEventListener("input", () => {
        totalInput.value = String(totalInput.value || "").replace(/[^\d]/g, "");
        recalcContractPayments();
      });
      totalInput.addEventListener("blur", () => {
        totalInput.value = formatPlainNumber(toNumPatch(totalInput.value));
        recalcContractPayments();
      });
      totalInput.addEventListener("focus", () => {
        totalInput.select();
      });
    }

    const vatSelect = q("contract_vat_type");
    if (vatSelect && !vatSelect.dataset.bound) {
      vatSelect.dataset.bound = "1";
      vatSelect.addEventListener("change", () => {
        if (getManualContractTotal() === null) setManualContractTotal(getEstimatedContractBaseTotal());
        syncContractCore();
      });
    }

    ["contract_start_date_input","contract_end_date_input","customer_name","customer_phone","customer_address","site_address","quote_date","quote_no"].forEach(id => {
      const el = q(id);
      if (el && !el.dataset.contractSyncBound) {
        el.dataset.contractSyncBound = "1";
        el.addEventListener("input", () => syncContractCore());
        el.addEventListener("change", () => syncContractCore());
      }
    });
  }

  window.syncCounselFromEstimate = function(updateStatus=true){
    setValue("counsel_date", q("quote_date")?.value || new Date().toISOString().slice(0,10));
    setValue("counsel_name", q("customer_name")?.value || "");
    setValue("counsel_phone", q("customer_phone")?.value || "");
    setValue("counsel_site_name", q("site_name")?.value || "");
    setValue("counsel_site_address", q("site_address")?.value || "");
    if (updateStatus) setCounselStatus("현재 견적 정보로 상담일지를 채웠습니다.");
  };

  function setCounselStatus(msg, isErr){
    const box = q("counselStatusBox");
    if (!box) return;
    box.textContent = msg;
    box.style.color = isErr ? "#b91c1c" : "#111827";
  }

  function getCurrentCounselValues(){
    const selectedStatus = q("quote_status")?.value || q("topQuoteStatus")?.textContent || "";
    return {
      quote_no: q("quote_no")?.value || "",
      customer_name: q("counsel_name")?.value || "",
      phone: q("counsel_phone")?.value || "",
      customer_phone: q("counsel_phone")?.value || "",
      site_name: q("counsel_site_name")?.value || "",
      site_address: q("counsel_site_address")?.value || "",
      counsel_date: q("counsel_date")?.value || null,
      quote_date: q("counsel_date")?.value || null,
      consult_date: q("counsel_date")?.value || null,
      date: q("counsel_date")?.value || null,
      memo: q("counsel_memo")?.value || "",
      counsel_note: q("counsel_memo")?.value || "",
      content: q("counsel_memo")?.value || "",
      note: q("counsel_memo")?.value || "",
      quote_status: selectedStatus,
      status: selectedStatus,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    };
  }

  function buildCounselPayload(options = {}){
    const fields = new Set(options.fields || []);
    const payload = {};
    const values = getCurrentCounselValues();
    fields.forEach((field) => { payload[field] = values[field] ?? null; });
    return payload;
  }

  async function tryCounselMutation(method, quoteNo){
    const variants = [
      ["customer_name","customer_phone","site_name","site_address","quote_date","counsel_note","quote_status","quote_no"],
      ["customer_name","customer_phone","site_name","site_address","quote_date","counsel_note","quote_no"],
      ["customer_name","customer_phone","site_name","site_address","quote_date","memo","quote_status","quote_no"],
      ["customer_name","phone","site_name","site_address","counsel_date","memo","quote_status","quote_no"],
      ["customer_name","phone","site_name","site_address","quote_date","memo","quote_status","quote_no"],
      ["customer_name","phone","site_name","site_address","consult_date","memo","quote_no"],
      ["customer_name","phone","site_name","site_address","date","memo","quote_no"],
      ["customer_name","phone","site_name","site_address","counsel_date","content","quote_no"],
      ["customer_name","phone","site_name","site_address","counsel_date","note","quote_no"],
      ["customer_name","phone","site_name","site_address","memo"],
      ["customer_name","phone","site_address","memo"],
      ["customer_name","customer_phone","site_address","counsel_note"],
      ["customer_name","customer_phone","site_address","memo"],
      ["customer_name","phone","site_address","content"],
      ["customer_name","phone","site_address","note"],
      ["customer_name","site_address","memo"],
      ["customer_name","site_address","counsel_note"],
      ["customer_name","site_address","content"],
      ["customer_name","site_address","note"],
      ["site_address","memo"],
      ["site_address","counsel_note"],
      ["site_address","content"],
      ["site_address","note"],
      ["customer_name","site_address","counsel_date"],
      ["customer_name","site_address","quote_date"],
      ["customer_name","site_address","consult_date"],
      ["customer_name","site_address","date"],
      ["customer_name","site_address"],
      ["site_address"]
    ];
    let lastError = null;
    for (const fields of variants) {
      const payload = buildCounselPayload({ fields });
      let result;
      if (method === "update") {
        if (String(quoteNo || '').match(/^\d+$/)) {
          result = await db.from("quote_counsel_logs").update(payload).eq("id", Number(quoteNo));
        } else {
          result = await db.from("quote_counsel_logs").update(payload).eq("quote_no", quoteNo);
        }
      } else {
        result = await db.from("quote_counsel_logs").insert([payload]);
      }
      if (!result.error) return true;
      lastError = result.error;
      const msg = String(result.error.message || "").toLowerCase();
      if (!(msg.includes('column') || msg.includes('schema cache') || msg.includes('could not find') || msg.includes('record') || msg.includes('unknown') || msg.includes('updated_at') || msg.includes('created_at'))) {
        throw result.error;
      }
    }
    throw lastError || new Error("상담일지 저장에 실패했습니다.");
  }

  function pickCounselDate(row){
    return row?.counsel_date || row?.quote_date || row?.consult_date || row?.date || row?.created_at || row?.updated_at || "";
  }

  function pickCounselMemo(row){
    return row?.counsel_note || row?.memo || row?.content || row?.note || row?.description || "";
  }

  function sortCounselRows(rows){
    return [...rows].sort((a,b) => {
      const av = pickCounselDate(a) || a?.created_at || a?.updated_at || a?.id || "";
      const bv = pickCounselDate(b) || b?.created_at || b?.updated_at || b?.id || "";
      return String(bv).localeCompare(String(av), 'ko');
    });
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
      const name = escapeHtml(row.customer_name || '-');
      const phone = escapeHtml(row.customer_phone || row.phone || '');
      const status = escapeHtml(row.quote_status || row.status || '');
      return `
        <button type="button" class="counsel-list-item" onclick="loadCounselLogByIndex(${idx})">
          <div class="counsel-list-top">
            <span>${date}</span>
            ${status ? `<span>${status}</span>` : ''}
          </div>
          <div class="counsel-list-sub">${name}${phone ? ' · ' + phone : ''}</div>
        </button>`;
    }).join('');
  }

  let latestCounselRows = [];

  function applyCounselRow(row){
    if (!row) return;
    setValue("counsel_date", String(pickCounselDate(row) || '').slice(0,10));
    setValue("counsel_name", row.customer_name || "");
    setValue("counsel_phone", row.customer_phone || row.phone || "");
    setValue("counsel_site_name", row.site_name || q("site_name")?.value || "");
    setValue("counsel_site_address", row.site_address || "");
    setValue("counsel_memo", pickCounselMemo(row));
    setCounselStatus(`상담일지를 불러왔습니다. (${String(pickCounselDate(row) || '').slice(0,10) || '-'})`);
  }

  function sameAddress(a,b){
    const aa = String(a || '').trim();
    const bb = String(b || '').trim();
    return !!aa && !!bb && (aa === bb || aa.includes(bb) || bb.includes(aa));
  }

  async function fetchCounselRowsRaw(){
    const result = await db.from("quote_counsel_logs").select("*").limit(500);
    if (result.error) throw result.error;
    let rows = Array.isArray(result.data) ? result.data : [];
    rows = rows.filter(row => row && (row.site_address || row.site_name || row.customer_name));
    return sortCounselRows(rows);
  }

  function filterCounselRowsByCurrentSite(rows){
    const currentAddress = (q("counsel_site_address")?.value || q("site_address")?.value || "").trim();
    if (!currentAddress) return rows;
    return rows.filter(row => sameAddress(row.site_address, currentAddress));
  }

  async function findExistingCounselRow(rows){
    const quoteNo = (q("quote_no")?.value || '').trim();
    const date = (q("counsel_date")?.value || '').trim();
    const siteAddress = (q("counsel_site_address")?.value || q("site_address")?.value || '').trim();
    return rows.find(row => {
      const rowDate = String(pickCounselDate(row) || '').slice(0,10);
      return String(row.quote_no || '').trim() === quoteNo && rowDate === date && sameAddress(row.site_address, siteAddress);
    }) || null;
  }

  window.loadCounselLogByIndex = function(idx){
    const row = latestCounselRows[idx];
    if (!row) return;
    applyCounselRow(row);
  };

  window.loadCounselLogList = async function(){
    try{
      const rows = filterCounselRowsByCurrentSite(await fetchCounselRowsRaw());
      latestCounselRows = rows;
      renderCounselList(rows);
      const currentAddress = (q("counsel_site_address")?.value || q("site_address")?.value || '').trim();
      if (currentAddress) {
        setCounselStatus(rows.length ? `현장주소 기준 날짜별 상담일지 ${rows.length}건을 불러왔습니다.` : `현장주소 기준 상담일지가 없습니다. (${currentAddress})`);
      }
    }catch(err){
      console.error(err);
      const box = q("counselListBox");
      if (box) box.innerHTML = `<div class="empty" style="color:#b91c1c;">목록 불러오기 실패: ${escapeHtml(err.message || '오류')}</div>`;
    }
  };

  window.saveCounselLog = async function(){
    try{
      const quoteNo = (q("quote_no")?.value || "").trim();
      const siteAddress = (q("counsel_site_address")?.value || q("site_address")?.value || '').trim();
      const counselDate = (q("counsel_date")?.value || '').trim();
      if (!quoteNo) throw new Error("견적번호가 없습니다.");
      if (!siteAddress) throw new Error("현장주소가 없습니다.");
      if (!counselDate) throw new Error("상담일자를 입력하세요.");

      const rawRows = await fetchCounselRowsRaw();
      const existing = await findExistingCounselRow(rawRows);
      await tryCounselMutation(existing ? "update" : "insert", existing?.id || quoteNo);
      setCounselStatus(existing ? "같은 현장/같은 날짜 상담일지를 수정 저장했습니다." : "오늘 상담일지를 저장했습니다.");
      await loadCounselLogList();
    }catch(err){
      console.error(err);
      const msg = String(err.message || '');
      if (msg.includes('quote_counsel_logs_quote_no_key') || msg.includes('duplicate key value violates unique constraint')) {
        setCounselStatus("상담일지 저장 실패: 현재 DB는 quote_no 1건만 저장되도록 묶여 있습니다. 동봉한 SQL을 먼저 실행해 주세요.", true);
        return;
      }
      setCounselStatus("상담일지 저장 실패: " + err.message, true);
    }
  };

  window.loadLatestCounselLog = async function(){
    try{
      if (!latestCounselRows.length) await loadCounselLogList();
      const row = latestCounselRows[0];
      if (!row) return setCounselStatus("불러올 상담일지가 없습니다.", true);
      applyCounselRow(row);
      setCounselStatus("현재 현장의 최근 상담일지를 불러왔습니다.");
    }catch(err){
      console.error(err);
      setCounselStatus("상담일지 불러오기 실패: " + err.message, true);
    }
  };

  function bindEstimateToContractAndCounsel(){
    ["quote_date","customer_name","customer_phone","customer_address","site_name","site_address","vat_type","extra_cost","waste_cost","insurance_cost","site_manage_cost","quote_status"].forEach(id => {
      q(id)?.addEventListener("input", () => {
        syncContractCore();
        syncCounselFromEstimate(false);
      });
      q(id)?.addEventListener("change", () => {
        syncContractCore();
        syncCounselFromEstimate(false);
        if (id === "site_address") loadCounselLogList();
      });
    });
    q("contract_vat_type")?.addEventListener("change", syncContractCore);
    q("contract_start_date_input")?.addEventListener("change", syncContractCore);
    q("contract_end_date_input")?.addEventListener("change", syncContractCore);
  }

  function patchCalculateAllHook(){
    if (typeof calculateAll === "function" && !window.__contractCalcHookPatched) {
      const originalCalculateAll = calculateAll;
      window.calculateAll = function(){
        const result = originalCalculateAll.apply(this, arguments);
        try { syncContractCore(); } catch(e) {}
        return result;
      };
      window.__contractCalcHookPatched = true;
    }
  }

  function patchAfterLoadHooks(){
    if (typeof selectQuoteFromSearch === "function" && !window.__selectQuotePatched) {
      const original = selectQuoteFromSearch;
      window.selectQuoteFromSearch = async function(quoteId){
        await original(quoteId);
        syncContractFromEstimate();
        syncCounselFromEstimate();
      };
      window.__selectQuotePatched = true;
    }
    if (typeof resetQuoteForm === "function" && !window.__resetQuotePatched) {
      const originalReset = resetQuoteForm;
      window.resetQuoteForm = function(){
        originalReset();
        syncContractFromEstimate();
        syncCounselFromEstimate(false);
      };
      window.__resetQuotePatched = true;
    }
  }

  document.addEventListener("DOMContentLoaded", function(){
    resetContractPayments();
    bindContractInputEvents();
    bindEstimateToContractAndCounsel();
    patchCalculateAllHook();
    patchAfterLoadHooks();
    setTimeout(() => {
      syncContractFromEstimate();
      syncCounselFromEstimate(false);
    }, 500);
  });
})();
