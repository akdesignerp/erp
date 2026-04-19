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
            <label>공종선택</label>
            <select onchange="handleWorkTypeChange('${row.id}', this.value)">
              ${makeWorkTypeOptions(row.work_type_id)}
            </select>
          </div>
          <div class="field">
            <label>공종명</label>
            <input value="${escapeHtml(row.work_name || "")}" onchange="updateRowValue('${row.id}','work_name',this.value); renderMobileDetailCards(); maybeAutoAppendRow('${row.id}');" placeholder="공종명" />
          </div>
        </div>

        <div class="detail-mobile-grid detail-mobile-grid-2">
          <div class="field">
            <label>품목선택</label>
            <select onchange="handleMaterialChange('${row.id}', this.value); renderMobileDetailCards();">
              ${makeMaterialOptions(row.material_id, row.work_type_id)}
            </select>
          </div>
          <div class="field">
            <label>품목명</label>
            <input value="${escapeHtml(row.item_name || "")}" onchange="updateRowValue('${row.id}','item_name',this.value); renderMobileDetailCards(); maybeAutoAppendRow('${row.id}');" placeholder="품목명" />
          </div>
        </div>

        <div class="detail-mobile-grid detail-mobile-grid-2">
          <div class="field">
            <label>규격</label>
            <input value="${escapeHtml(row.spec || "")}" onchange="updateRowValue('${row.id}','spec',this.value); renderMobileDetailCards(); maybeAutoAppendRow('${row.id}');" placeholder="규격" />
          </div>
          <div class="field">
            <label>단위</label>
            <input value="${escapeHtml(row.unit || "")}" onchange="updateRowValue('${row.id}','unit',this.value); renderMobileDetailCards(); maybeAutoAppendRow('${row.id}');" placeholder="단위" />
          </div>
        </div>

        <div class="detail-mobile-grid detail-mobile-grid-2 detail-mobile-grid-compact">
          <div class="field">
            <label>수량</label>
            <input type="number" value="${row.qty || 0}" oninput="updateRowValue('${row.id}','qty',this.value); renderMobileDetailCards();" />
          </div>
          <div class="field">
            <label>자재비</label>
            <input type="number" value="${row.cost_material || 0}" oninput="updateRowValue('${row.id}','cost_material',this.value); renderMobileDetailCards();" />
          </div>
          <div class="field">
            <label>노무비</label>
            <input type="number" value="${row.cost_labor || 0}" oninput="updateRowValue('${row.id}','cost_labor',this.value); renderMobileDetailCards();" />
          </div>
          <div class="field">
            <label>경비</label>
            <input type="number" value="${row.cost_expense || 0}" oninput="updateRowValue('${row.id}','cost_expense',this.value); renderMobileDetailCards();" />
          </div>
        </div>

        <div class="field detail-mobile-note">
          <label>비고</label>
          <textarea onchange="updateRowValue('${row.id}','note',this.value); renderMobileDetailCards();" placeholder="비고">${escapeHtml(row.note || "")}</textarea>
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

function buildPdfFolderInfo() {
  const quoteDate = document.getElementById("quote_date")?.value || "";
  const now = new Date();
  const year = (quoteDate || now.toISOString().slice(0,10)).slice(0,4) || String(now.getFullYear());
  const siteNameRaw = document.getElementById("site_name")?.value || document.getElementById("site_address")?.value || "현장미지정";
  const customerNameRaw = document.getElementById("customer_name")?.value || "고객미지정";
  const siteName = sanitizeFilePart(siteNameRaw, "현장미지정");
  const customerName = sanitizeFilePart(customerNameRaw, "고객미지정");
  const siteNameShort = siteName.replace(/\s+/g, "").slice(0, 10) || "현장미지정";
  const yyyy = String(now.getFullYear());
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  const timestamp = `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
  const folderName = siteNameShort;
  const fileName = `${customerName}_${timestamp}.pdf`;
  return { year, folderName, fileName, siteNameShort, customerName, timestamp };
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

function openPrintChoiceModal() {
  const modal = document.getElementById("printChoiceModal");
  const status = document.getElementById("printChoiceStatus");
  if (status) {
    const info = buildPdfFolderInfo();
    status.textContent = `저장 경로: 기준폴더/${info.year}/${info.folderName}/${info.fileName}`;
  }
  modal?.classList.add("show");
}

function closePrintChoiceModal() {
  document.getElementById("printChoiceModal")?.classList.remove("show");
}

async function renderPrintAreaToPdfBlob() {
  const area = ensurePrintAreaReady();
  const { jsPDF } = window.jspdf || {};
  if (!window.html2canvas || !jsPDF) throw new Error("PDF 저장 라이브러리를 불러오지 못했습니다.");

  const previousStyle = area.getAttribute("style") || "";
  area.style.display = "block";
  area.style.position = "fixed";
  area.style.left = "-100000px";
  area.style.top = "0";
  area.style.width = "1240px";
  area.style.background = "#ffffff";
  area.style.zIndex = "-1";

  try {
    const pdf = new jsPDF("p", "mm", "a4");
    const pages = Array.from(area.querySelectorAll('.print-block'));
    if (!pages.length) throw new Error("출력 페이지가 없습니다.");

    for (let i = 0; i < pages.length; i++) {
      const pageEl = pages[i];
      const rect = pageEl.getBoundingClientRect();
      if (!rect.width || !rect.height) {
        throw new Error("출력 페이지 크기를 계산하지 못했습니다.");
      }

      const canvas = await window.html2canvas(pageEl, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
        windowWidth: 1240,
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
        scrollX: 0,
        scrollY: 0
      });

      if (!canvas.width || !canvas.height) {
        throw new Error("PDF 캔버스 생성에 실패했습니다.");
      }

      const imgData = canvas.toDataURL('image/jpeg', 0.98);
      const pageWidth = 210;
      const pageHeight = 297;
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      if (!Number.isFinite(imgHeight) || imgHeight <= 0) {
        throw new Error("PDF 페이지 높이 계산에 실패했습니다.");
      }
      if (i > 0) pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, Math.min(imgHeight, pageHeight));
    }
    return pdf.output('blob');
  } finally {
    area.setAttribute("style", previousStyle);
    if (!previousStyle) area.removeAttribute("style");
  }
}

function downloadPdfBlobFallback(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function savePdfWithAutoFolders() {
  const info = buildPdfFolderInfo();
  const blob = await renderPrintAreaToPdfBlob();

  if (!('showDirectoryPicker' in window) || !window.isSecureContext) {
    downloadPdfBlobFallback(blob, info.fileName);
    return { mode: 'download', path: info.fileName, reason: 'unsupported' };
  }

  try {
    let root = window.__akPdfRootDirHandle || null;
    if (!root) {
      root = await window.showDirectoryPicker({ mode: 'readwrite' });
      window.__akPdfRootDirHandle = root;
    }

    if (root.queryPermission) {
      let perm = await root.queryPermission({ mode: 'readwrite' });
      if (perm !== 'granted' && root.requestPermission) {
        perm = await root.requestPermission({ mode: 'readwrite' });
      }
      if (perm !== 'granted') {
        throw new Error('폴더 쓰기 권한이 허용되지 않았습니다.');
      }
    }

    const yearDir = await root.getDirectoryHandle(info.year, { create: true });
    const targetDir = await yearDir.getDirectoryHandle(info.folderName, { create: true });
    const fileHandle = await targetDir.getFileHandle(info.fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
    return { mode: 'folder', path: `${info.year}/${info.folderName}/${info.fileName}` };
  } catch (err) {
    console.warn('자동 폴더 저장 실패, 다운로드로 전환:', err);
    downloadPdfBlobFallback(blob, info.fileName);
    return { mode: 'download', path: info.fileName, reason: err?.message || 'save_failed' };
  }
}

async function handlePrintChoice(mode) {
  const modal = document.getElementById('printChoiceModal');
  const status = document.getElementById('printChoiceStatus');
  try {
    modal?.classList.add('print-saving');
    if (mode === 'save') {
      if (status) status.textContent = 'PDF 저장 중입니다...';
      const result = await savePdfWithAutoFolders();
      if (status) status.textContent = result.mode === 'folder' ? `저장 완료: ${result.path}` : `브라우저 다운로드로 저장 완료: ${result.path}`;
      setTimeout(() => closePrintChoiceModal(), 700);
      return;
    }
    if (status) status.textContent = '인쇄 화면을 여는 중입니다...';
    ensurePrintAreaReady();
    closePrintChoiceModal();
    window.print();
  } catch (err) {
    console.error(err);
    if (status) status.textContent = 'PDF 처리 실패: ' + err.message;
    else alert('PDF 처리 실패: ' + err.message);
  } finally {
    modal?.classList.remove('print-saving');
  }
}

function printQuote() {
  try {
    openPrintChoiceModal();
  } catch (err) {
    console.error(err);
    alert("PDF 출력 선택창 오류: " + err.message);
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
