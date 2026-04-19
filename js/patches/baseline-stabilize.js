(function(){
  function runSafely(fn){ try { return fn(); } catch(err){ console.error(err); } }
  function syncHeaderAndViews(){
    runSafely(() => { if (typeof syncTopSummary === 'function') syncTopSummary(); });
    runSafely(() => { if (typeof renderPreviewTables === 'function') renderPreviewTables(); });
    runSafely(() => { if (typeof renderMobileDetailCards === 'function') renderMobileDetailCards(); });
    runSafely(() => { if (typeof refreshCompanySummary === 'function') refreshCompanySummary(typeof currentQuoteDbTotalAmount !== 'undefined' ? currentQuoteDbTotalAmount : null); });
  }

  const bindIds = [
    'quote_date','customer_name','customer_phone','customer_address','site_name','site_address','area_size','work_type',
    'revision_no','quote_status','vat_type','extra_cost','waste_cost','insurance_cost','site_manage_cost','quote_memo'
  ];

  function bindBaselineRefresh(){
    bindIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el || el.dataset.baselineBound) return;
      el.dataset.baselineBound = '1';
      const handler = () => {
        syncHeaderAndViews();
        runSafely(() => { if (typeof syncCounselFromEstimate === 'function') syncCounselFromEstimate(false); });
        runSafely(() => { if (typeof syncContractFromEstimate === 'function') syncContractFromEstimate(false); });
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  window.erpBaselineRefresh = function(){
    bindBaselineRefresh();
    syncHeaderAndViews();
    runSafely(() => { if (typeof syncCounselFromEstimate === 'function') syncCounselFromEstimate(false); });
    runSafely(() => { if (typeof syncContractFromEstimate === 'function') syncContractFromEstimate(false); });
  };

  if (typeof saveQuote === 'function' && !saveQuote.__baselineWrapped) {
    const originalSaveQuote = saveQuote;
    saveQuote = async function(){
      window.erpBaselineRefresh();
      const result = await originalSaveQuote.apply(this, arguments);
      window.erpBaselineRefresh();
      return result;
    };
    saveQuote.__baselineWrapped = true;
  }

  if (typeof selectQuoteFromSearch === 'function' && !selectQuoteFromSearch.__baselineWrapped) {
    const originalSelect = selectQuoteFromSearch;
    selectQuoteFromSearch = async function(){
      const result = await originalSelect.apply(this, arguments);
      window.erpBaselineRefresh();
      return result;
    };
    selectQuoteFromSearch.__baselineWrapped = true;
  }

  if (typeof resetQuoteForm === 'function' && !resetQuoteForm.__baselineWrapped) {
    const originalReset = resetQuoteForm;
    resetQuoteForm = function(){
      const result = originalReset.apply(this, arguments);
      window.erpBaselineRefresh();
      return result;
    };
    resetQuoteForm.__baselineWrapped = true;
  }

  document.addEventListener('DOMContentLoaded', function(){
    bindBaselineRefresh();
    setTimeout(() => { if (typeof window.erpBaselineRefresh === 'function') window.erpBaselineRefresh(); }, 800);
  });
})();
