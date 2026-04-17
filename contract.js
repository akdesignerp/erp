
/* 계약서 + 회사관리 비밀번호 확장 */
let contractPayments = [];
let companyAdminVerified = false;
let companyPasswordMode = "verify";

function setStatus(message, isError = false) {
  const box = document.getElementById("statusBox");
  if (!box) return;
  box.textContent = message;
  box.style.color = isError ? "#b91c1c" : "#111827";
}

function setCompanyPasswordStatus(message, isError = false, targetId = "companyAdminPasswordStatus") {
  const el = document.getElementById(targetId);
  if (!el) return;
  el.textContent = message;
  el.style.color = isError ? "#b91c1c" : "#111827";
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value ?? "";
}

function formatDateLikeContract(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
}

function todayStrSafe() {
  return new Date().toISOString().substring(0, 10);
}

function getContractTotalAmount() {
  if (typeof getQuoteTotals !== "function") return 0;
  const totals = getQuoteTotals();
  const vatType = document.getElementById("contract_vat_type")?.value || "include";
  return vatType === "exclude" ? toNum(totals.totalConstruction) : toNum(totals.finalTotal);
}

function applyContractVatLabel() {
  const vatType = String(document.getElementById("contract_vat_type")?.value || "include").trim();
  const labelEl = document.getElementById("contract_vat_label");
  if (!labelEl) return;
  labelEl.textContent = vatType === "exclude" ? "부가가치세 불포함" : "부가가치세 포함";
}

function buildDefaultContractPayments() {
  return [
    { label: "1차", rate: 10, note: "계약 직후" },
    { label: "2차", rate: 30, note: "철거 시작시" },
    { label: "3차", rate: 30, note: "중간 공정 완료시" },
    { label: "잔금", rate: 30, note: "공사 완료후" }
  ];
}

function normalizeContractPaymentLabels() {
  contractPayments.forEach((row, idx) => {
    row.isBalance = idx === contractPayments.length - 1;
    row.label = row.isBalance ? "잔금" : `${idx + 1}차`;
  });
}

function renderContractPayments() {
  const body = document.getElementById("contractPaymentBody");
  if (!body) return;
  normalizeContractPaymentLabels();
  const total = getContractTotalAmount();

  body.innerHTML = contractPayments.map((row, idx) => {
    const amount = Math.round(total * (toNum(row.rate) / 100));
    const readonly = row.isBalance ? "readonly" : "";
    const deleteBtn = row.isBalance ? "" : `<button class="btn btn-light table-btn" type="button" onclick="removeContractPaymentRow(${idx})">삭제</button>`;
    return `
      <tr>
        <td>${row.label}</td>
        <td id="contract_payment_amount_${idx}" class="td-right">${formatWon(amount)}</td>
        <td><input type="number" min="0" max="100" step="0.1" value="${toNum(row.rate)}" ${readonly} oninput="updateContractPaymentRate(${idx}, this.value)" /> %</td>
        <td><input type="text" value="${escapeHtml(row.note || "")}" oninput="updateContractPaymentNote(${idx}, this.value)" /></td>
        <td class="screen-only">${deleteBtn}</td>
      </tr>
    `;
  }).join("");

  recalcContractPayments();
}

function recalcContractPayments() {
  const total = getContractTotalAmount();
  normalizeContractPaymentLabels();

  contractPayments.forEach((row, idx) => {
    const amountEl = document.getElementById(`contract_payment_amount_${idx}`);
    if (amountEl) {
      const amount = Math.round(total * (toNum(row.rate) / 100));
      amountEl.textContent = formatWon(amount);
    }
  });
}

function rebalanceBalancePayment() {
  normalizeContractPaymentLabels();
  if (!contractPayments.length) return;
  const balanceIndex = contractPayments.length - 1;
  const othersSum = contractPayments.slice(0, balanceIndex).reduce((sum, row) => sum + toNum(row.rate), 0);
  contractPayments[balanceIndex].rate = Math.max(0, Math.round((100 - othersSum) * 100) / 100);
}

function updateContractPaymentRate(idx, value) {
  if (!contractPayments[idx]) return;
  if (contractPayments[idx].isBalance) return;
  contractPayments[idx].rate = Math.max(0, Math.round(toNum(value) * 100) / 100);
  rebalanceBalancePayment();
  renderContractPayments();
}

function updateContractPaymentNote(idx, value) {
  if (!contractPayments[idx]) return;
  contractPayments[idx].note = value;
}

function rebalanceContractByLargest() {
  if (contractPayments.length < 2) return;
  normalizeContractPaymentLabels();
  const candidates = contractPayments.slice(0, -1);
  if (!candidates.length) return;

  let targetIndex = 0;
  let largestRate = -1;
  candidates.forEach((row, idx) => {
    const rate = toNum(row.rate);
    if (rate > largestRate) {
      largestRate = rate;
      targetIndex = idx;
    }
  });

  const targetRate = toNum(contractPayments[targetIndex].rate);
  if (targetRate <= 0) {
    rebalanceBalancePayment();
    renderContractPayments();
    return;
  }

  const splitRate = Math.round((targetRate / 2) * 100) / 100;
  contractPayments[targetIndex].rate = Math.round((targetRate - splitRate) * 100) / 100;

  const insertIndex = contractPayments.length - 1;
  contractPayments.splice(insertIndex, 0, {
    label: "",
    rate: splitRate,
    note: `${targetIndex + 1}차 분할`
  });

  rebalanceBalancePayment();
  renderContractPayments();
  setStatus("비율이 가장 큰 차수를 기준으로 새 행을 자동 분할했습니다.");
}

function addContractPaymentRow() {
  if (!contractPayments.length) {
    contractPayments = buildDefaultContractPayments();
    renderContractPayments();
    return;
  }
  rebalanceContractByLargest();
}

function removeContractPaymentRow(idx) {
  if (idx < 0 || idx >= contractPayments.length) return;
  if (contractPayments[idx].isBalance) return;
  contractPayments.splice(idx, 1);
  rebalanceBalancePayment();
  renderContractPayments();
}

function fillContractFromRecord(quote, customer, site) {
  const quoteNo = quote?.quote_no || document.getElementById("quote_no")?.value || "";
  const quoteDate = quote?.quote_date || document.getElementById("quote_date")?.value || todayStrSafe();
  const customerName = customer?.customer_name || customer?.name || document.getElementById("customer_name")?.value || "";
  const customerPhone = customer?.phone || document.getElementById("customer_phone")?.value || "";
  const customerAddress = customer?.address || document.getElementById("customer_address")?.value || site?.site_address || "";
  const siteAddress = site?.site_address || document.getElementById("site_address")?.value || customerAddress || "";
  const contractTotal = getContractTotalAmount();

  const contractQuoteInput = document.getElementById("contract_quote_no_input");
  if (contractQuoteInput) contractQuoteInput.value = quoteNo;

  setText("contract_site_address", siteAddress || "-");
  setText("contract_start_date", formatDateLikeContract(document.getElementById("contract_start_date_input")?.value || ""));
  setText("contract_end_date", formatDateLikeContract(document.getElementById("contract_end_date_input")?.value || ""));
  setText("contract_total_amount", formatWon(contractTotal));

  const d = new Date(quoteDate || todayStrSafe());
  if (!Number.isNaN(d.getTime())) {
    setText("contract_sign_year", d.getFullYear());
    setText("contract_sign_month", d.getMonth() + 1);
    setText("contract_sign_day", d.getDate());
  }

  setText("contract_customer_address", customerAddress || "-");
  setText("contract_customer_phone", customerPhone || "-");
  setText("contract_customer_name", customerName || "-");

  applyContractVatLabel();
  recalcContractPayments();
}

function syncContractFromQuote() {
  try {
    const quote = {
      quote_no: document.getElementById("quote_no")?.value || "",
      quote_date: document.getElementById("quote_date")?.value || todayStrSafe()
    };
    const customer = {
      customer_name: document.getElementById("customer_name")?.value || document.getElementById("topCustomerName")?.textContent || "",
      phone: document.getElementById("customer_phone")?.value || "",
      address: document.getElementById("customer_address")?.value || ""
    };
    const site = {
      site_address: document.getElementById("site_address")?.value || ""
    };

    fillContractFromRecord(quote, customer, site);
    setStatus("현재 견적 입력값을 계약서에 반영했습니다.");
  } catch (err) {
    console.error(err);
    setStatus("계약서 반영 실패: " + err.message, true);
  }
}

async function hashCompanyPassword(password) {
  const enc = new TextEncoder().encode(String(password || ""));
  const buffer = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getCompanyAdminRow() {
  const { data, error } = await db
    .from("company_admin_auth")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

function openCompanyPasswordModal(mode = "verify") {
  companyPasswordMode = mode;
  const modal = document.getElementById("companyPasswordModal");
  if (!modal) return;
  modal.classList.add("show");

  const help = document.getElementById("companyPasswordHelp");
  if (help) {
    if (mode === "register") {
      help.textContent = "최초 비밀번호를 DB에 저장합니다. 새 비밀번호 입력 후 등록하세요.";
    } else if (mode === "change") {
      help.textContent = "기존 비밀번호 확인 후 새 비밀번호로 변경합니다.";
    } else {
      help.textContent = "DB 저장 비밀번호를 입력해 회사관리 탭을 여세요.";
    }
  }

  ["companyAdminCurrentPassword", "companyAdminNewPassword", "companyAdminConfirmPassword"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });

  setCompanyPasswordStatus("대기 중");
}

function closeCompanyPasswordModal() {
  const modal = document.getElementById("companyPasswordModal");
  if (modal) modal.classList.remove("show");
}

async function verifyCompanyAdminPassword() {
  try {
    const currentPw = document.getElementById("companyAdminCurrentPassword")?.value?.trim() || "";
    const newPw = document.getElementById("companyAdminNewPassword")?.value?.trim() || "";
    const confirmPw = document.getElementById("companyAdminConfirmPassword")?.value?.trim() || "";

    const row = await getCompanyAdminRow();

    if (companyPasswordMode === "register") {
      if (row?.password_hash) {
        setCompanyPasswordStatus("이미 등록된 비밀번호가 있습니다. 변경 기능을 사용하세요.", true);
        return;
      }
      if (!newPw || !confirmPw) {
        setCompanyPasswordStatus("새 비밀번호와 확인 비밀번호를 입력하세요.", true);
        return;
      }
      if (newPw !== confirmPw) {
        setCompanyPasswordStatus("새 비밀번호 확인이 일치하지 않습니다.", true);
        return;
      }

      const passwordHash = await hashCompanyPassword(newPw);
      const { error } = await db.from("company_admin_auth").upsert({
        id: 1,
        password_hash: passwordHash,
        updated_at: new Date().toISOString()
      });
      if (error) throw error;

      setCompanyPasswordStatus("최초 관리자 비밀번호를 저장했습니다.");
      setCompanyPasswordStatus("최초 관리자 비밀번호가 등록되었습니다.", false, "companyAdminDbStatus");
      companyAdminVerified = true;
      closeCompanyPasswordModal();
      showCompanyTabDirect();
      return;
    }

    if (!row?.password_hash) {
      setCompanyPasswordStatus("DB에 등록된 관리자 비밀번호가 없습니다. 최초등록을 먼저 진행하세요.", true);
      setCompanyPasswordStatus("company_admin_auth 테이블에 비밀번호가 없습니다. 최초등록이 필요합니다.", true, "companyAdminDbStatus");
      return;
    }

    if (!currentPw) {
      setCompanyPasswordStatus("현재 비밀번호를 입력하세요.", true);
      return;
    }

    const currentHash = await hashCompanyPassword(currentPw);
    if (currentHash !== row.password_hash) {
      setCompanyPasswordStatus("현재 비밀번호가 일치하지 않습니다.", true);
      return;
    }

    if (companyPasswordMode === "change") {
      if (!newPw || !confirmPw) {
        setCompanyPasswordStatus("새 비밀번호와 확인 비밀번호를 입력하세요.", true);
        return;
      }
      if (newPw !== confirmPw) {
        setCompanyPasswordStatus("새 비밀번호 확인이 일치하지 않습니다.", true);
        return;
      }

      const nextHash = await hashCompanyPassword(newPw);
      const { error } = await db.from("company_admin_auth").update({
        password_hash: nextHash,
        updated_at: new Date().toISOString()
      }).eq("id", 1);

      if (error) throw error;

      setCompanyPasswordStatus("관리자 비밀번호를 변경했습니다.");
      setCompanyPasswordStatus("관리자 비밀번호 변경 완료", false, "companyAdminDbStatus");
      companyAdminVerified = true;
      closeCompanyPasswordModal();
      showCompanyTabDirect();
      return;
    }

    companyAdminVerified = true;
    setCompanyPasswordStatus("관리자 비밀번호 확인 완료");
    setCompanyPasswordStatus("비밀번호 확인 완료. 회사관리 탭 접근 가능", false, "companyAdminDbStatus");
    closeCompanyPasswordModal();
    showCompanyTabDirect();
  } catch (err) {
    console.error(err);
    setCompanyPasswordStatus("비밀번호 처리 실패: " + err.message, true);
    setCompanyPasswordStatus("DB 테이블 확인 필요: company_admin_auth", true, "companyAdminDbStatus");
  }
}

function showCompanyTabDirect() {
  document.querySelectorAll("#tab-write,#tab-summary,#tab-detail,#tab-counsel,#tab-contract,#tab-company").forEach(el => el?.classList.add("hidden"));
  document.getElementById("tab-company")?.classList.remove("hidden");
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  if (typeof initCompanyTab === "function") initCompanyTab();
}

function renderCounselPdf() {
  setText("pdf_counsel_date", document.getElementById("counsel_date")?.value || "-");
  setText("pdf_counsel_type", document.getElementById("counsel_type")?.value || "-");
  setText("pdf_counsel_status", document.getElementById("counsel_status")?.value || "-");
  const note = [
    document.getElementById("counsel_note")?.value || "",
    document.getElementById("counsel_next_action")?.value ? `다음 일정: ${document.getElementById("counsel_next_action").value}` : ""
  ].filter(Boolean).join("\n\n");
  setText("pdf_counsel_note", note || "-");
}

function renderContractPdfClone() {
  syncContractFromQuote();
  const source = document.getElementById("contractSheet");
  const wrap = document.getElementById("pdfContractPrintWrap");
  if (!source || !wrap) return;
  wrap.innerHTML = source.outerHTML;
}

function initContractTab() {
  if (!contractPayments.length) {
    contractPayments = buildDefaultContractPayments();
    rebalanceBalancePayment();
  }

  const quoteNoInput = document.getElementById("contract_quote_no_input");
  if (quoteNoInput && !quoteNoInput.value) {
    quoteNoInput.value = document.getElementById("quote_no")?.value || "";
  }

  const startDateInput = document.getElementById("contract_start_date_input");
  if (startDateInput && !startDateInput.value) startDateInput.value = document.getElementById("quote_date")?.value || todayStrSafe();
  const endDateInput = document.getElementById("contract_end_date_input");
  if (endDateInput && !endDateInput.value) endDateInput.value = document.getElementById("quote_date")?.value || todayStrSafe();

  renderContractPayments();
  syncContractFromQuote();
}

const originalShowTab = typeof showTab === "function" ? showTab : null;
showTab = function(tabName) {
  const tabIds = ["write", "summary", "detail", "counsel", "contract", "company"];
  tabIds.forEach(name => document.getElementById(`tab-${name}`)?.classList.add("hidden"));
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));

  if (tabName === "company") {
    if (!companyAdminVerified) {
      openCompanyPasswordModal("verify");
      return;
    }
    showCompanyTabDirect();
    return;
  }

  document.getElementById(`tab-${tabName}`)?.classList.remove("hidden");
  document.querySelector(`.tab-btn[data-tab="${tabName}"]`)?.classList.add("active");

  if (tabName === "summary" || tabName === "detail") {
    if (typeof renderPreviewTables === "function") renderPreviewTables();
  }
  if (tabName === "contract") {
    initContractTab();
  }
};

const originalPrintQuote = typeof printQuote === "function" ? printQuote : null;
printQuote = function() {
  try {
    if (typeof fillPdfData === "function") fillPdfData();
    renderCounselPdf();
    renderContractPdfClone();
    window.print();
  } catch (err) {
    console.error("PDF 인쇄 오류:", err);
    alert("PDF 인쇄용 데이터 채우기 중 오류: " + err.message);
  }
};

const originalResetQuoteForm = typeof resetQuoteForm === "function" ? resetQuoteForm : null;
resetQuoteForm = function() {
  if (originalResetQuoteForm) originalResetQuoteForm();
  const counselDate = document.getElementById("counsel_date");
  if (counselDate) counselDate.value = todayStrSafe();
  const counselType = document.getElementById("counsel_type");
  if (counselType) counselType.value = "초기상담";
  const counselStatus = document.getElementById("counsel_status");
  if (counselStatus) counselStatus.value = "상담중";
  const nextAction = document.getElementById("counsel_next_action");
  if (nextAction) nextAction.value = "";
  const counselNote = document.getElementById("counsel_note");
  if (counselNote) counselNote.value = "";
  contractPayments = buildDefaultContractPayments();
  rebalanceBalancePayment();
  initContractTab();
};

document.addEventListener("DOMContentLoaded", () => {
  const counselDate = document.getElementById("counsel_date");
  if (counselDate && !counselDate.value) counselDate.value = todayStrSafe();
  initContractTab();
});
