(function(){
  window.openPrintChoiceModal = function openPrintChoiceModal() {
    try {
      window.ensurePrintAreaReady();
      window.print();
    } catch (err) {
      console.error(err);
      alert('PDF 인쇄 오류: ' + err.message);
    }
  };
  window.closePrintChoiceModal = function closePrintChoiceModal() {};
  window.handlePrintChoice = async function handlePrintChoice() {
    window.openPrintChoiceModal();
  };
})();
