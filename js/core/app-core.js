
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

   
