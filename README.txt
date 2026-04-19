# AK디자인 ERP 재정비본

기준축:
- 상담
- 견적상세
- 견적요약
- 저장
- 불러오기

구조:
- js/core/app-core.js : 세션/공통 상태/유틸
- js/quote/quote-main.js : 견적 입력/계산/저장/불러오기/자재 반영
- js/print/print-main.js : 인쇄/자동저장/PDF
- js/contract/contract.js : 계약서/상담일지 연동
- js/company/company.js : 회사관리
- js/patches/baseline-stabilize.js : 화면/요약/상담/계약 동기화 안정화
- legacy_backup : 원본 백업

보존 규칙:
- 저장 시 materials 생성/연결 로직 유지
- 인쇄/자동저장은 기존 출력 형태 최대 유지
