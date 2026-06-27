'use strict';

/* ============================================================
   데이터 정의
   ============================================================ */
const CONTRACT_DB = {
  'CONT-2024-00892': {
    name: '(주)에이스유통 — 서울시 강남구 역삼동 B동 502호',
    period: '2022.01.01 ~ 2024.12.31',
    expiry: '2024.12.31',
    deposit: '₩ 50,000,000',
    lastChg: '2025-01-03 09:12',
    counts: { cash: 3, tax: 2, receipt: 5, bill: 7, refund: 1 },
    initialStatus: { cash: 'red', tax: 'red', receipt: 'yellow', bill: 'yellow', refund: 'green' },
  },
  'CONT-2023-00441': {
    name: '(주)한라테크 — 서울시 서초구 방배동 A동 301호',
    period: '2021.06.01 ~ 2023.12.31',
    expiry: '2023.12.31',
    deposit: '₩ 30,000,000',
    lastChg: '2024-01-05 14:30',
    counts: { cash: 1, tax: 1, receipt: 3, bill: 4, refund: 1 },
    initialStatus: { cash: 'red', tax: 'yellow', receipt: 'yellow', bill: 'yellow', refund: 'green' },
  },
};

/* 역순 롤백 순서: 이 순서대로 처리해야 함 */
const ROLLBACK_ORDER = ['cash', 'tax', 'receipt', 'bill'];

/* ============================================================
   상태
   ============================================================ */
let state = {
  contractKey: 'CONT-2024-00892',
  itemStatus: {},   // key → 'red' | 'yellow' | 'green'
  openDetail: null, // 현재 열린 detail key
  logs: [],
};

/* ============================================================
   DOM 참조
   ============================================================ */
const $ = (id) => document.getElementById(id);
const contractInput = $('contractInput');
const searchBtn     = $('searchBtn');
const unlockBtn     = $('unlockBtn');
const infoBox       = $('infoBox');
const infoText      = $('infoText');
const logList       = $('logList');
const clearLogBtn   = $('clearLogBtn');
const modalBackdrop = $('modalBackdrop');
const modalClose    = $('modalClose');
const modalContractId = $('modalContractId');
const modalMeta     = $('modalMeta');
const step3El       = $('step3');
const step4El       = $('step4');

/* ============================================================
   초기화
   ============================================================ */
function init() {
  loadContract(state.contractKey);
  bindEvents();
}

/* ============================================================
   계약 로드
   ============================================================ */
function loadContract(key) {
  const data = CONTRACT_DB[key];
  if (!data) {
    alert(`계약번호 "${key}"를 찾을 수 없습니다.\n사용 가능: CONT-2024-00892, CONT-2023-00441`);
    return;
  }
  state.contractKey = key;
  state.itemStatus = { ...data.initialStatus };
  state.openDetail = null;
  state.logs = [];

  // 계약 정보 업데이트
  $('contractId').textContent   = `계약번호 ${key} · re_cont_master`;
  $('contractName').textContent = data.name;
  $('metaPeriod').textContent   = data.period;
  $('metaExpiry').textContent   = data.expiry;
  $('metaDeposit').textContent  = data.deposit;
  $('metaLastChg').textContent  = data.lastChg;

  // 건수 업데이트
  Object.entries(data.counts).forEach(([k, v]) => {
    const el = $(`count-${k}`);
    if (el) el.textContent = `${v}건`;
  });

  renderAll();
}

/* ============================================================
   렌더링
   ============================================================ */
function renderAll() {
  renderTree();
  renderGuide();
  renderUnlock();
  renderLogs();
}

/* --- 트리 아이템 상태 렌더링 --- */
function renderTree() {
  const items = document.querySelectorAll('.tree-item[data-key]');
  items.forEach((item) => {
    const key    = item.dataset.key;
    const status = state.itemStatus[key];
    const dot    = item.querySelector('.item-status');
    const btn    = item.querySelector('.btn-action');
    const detail = item.querySelector('.item-detail');

    // 상태 dot
    dot.className = `item-status ${status}`;

    // 열린 detail 처리
    if (detail) {
      detail.classList.toggle('open', state.openDetail === key);
    }

    // 버튼 상태
    if (status === 'green') {
      btn.disabled = true;
      btn.className = 'btn-action btn-done';
      btn.innerHTML = '<i class="ti ti-circle-check" aria-hidden="true"></i> 취소 완료';
    } else {
      btn.disabled = false;
      if (status === 'red') {
        btn.className = 'btn-action btn-del';
      } else {
        btn.className = 'btn-action btn-check';
      }
    }
  });
}

/* --- 가이드 완료 표시 --- */
function renderGuide() {
  const guideMap = { cash: 'gs-cash', tax: 'gs-tax', receipt: 'gs-receipt', bill: 'gs-bill' };
  Object.entries(guideMap).forEach(([key, gsId]) => {
    const el = $(gsId);
    if (!el) return;
    if (state.itemStatus[key] === 'green') {
      el.classList.add('completed');
      const num = el.querySelector('.gs-num');
      num.className = 'gs-num gs-green';
      num.innerHTML = '<i class="ti ti-check" aria-hidden="true"></i>';
    } else {
      el.classList.remove('completed');
      const num = el.querySelector('.gs-num');
      // 원래 색상 복원
      const colorMap = { cash: 'gs-red', tax: 'gs-red', receipt: 'gs-yellow', bill: 'gs-yellow' };
      num.className = `gs-num ${colorMap[key]}`;
      const numMap = { cash: '1', tax: '2', receipt: '3', bill: '4' };
      num.textContent = numMap[key];
    }
  });
}

/* --- 잠금 해제 버튼 상태 --- */
function renderUnlock() {
  const blockingItems = ROLLBACK_ORDER.filter((k) => state.itemStatus[k] !== 'green');
  const allClear = blockingItems.length === 0;

  unlockBtn.disabled = !allClear;
  unlockBtn.classList.toggle('ready', allClear);

  if (allClear) {
    infoBox.className = 'info-box success';
    infoText.textContent = '모든 하위 데이터 취소 완료. 계약만료 잠금 해제가 가능합니다.';
    step3El.className = 'step step-completed';
    step3El.querySelector('.step-num').innerHTML = '<i class="ti ti-check" aria-hidden="true"></i>';
    step4El.className = 'step step-active';
  } else {
    infoBox.className = 'info-box';
    const remaining = blockingItems.map(labelOf).join(', ');
    infoText.textContent = `${remaining} 취소 완료 후 잠금 해제가 활성화됩니다.`;
    step3El.className = 'step step-active';
    step3El.querySelector('.step-num').textContent = '3';
    step4El.className = 'step step-pending';
    step4El.querySelector('.step-num').textContent = '4';
  }
}

/* --- 이력 로그 렌더링 --- */
function renderLogs() {
  if (state.logs.length === 0) {
    logList.innerHTML = '<div class="log-empty">처리 완료 항목이 여기에 기록됩니다.</div>';
    return;
  }
  logList.innerHTML = state.logs
    .slice()
    .reverse()
    .map(
      (l) =>
        `<div class="log-entry">
          <span class="log-dot"></span>
          <span class="log-time">${l.time}</span>
          <span class="log-msg">${l.msg}</span>
        </div>`
    )
    .join('');
}

/* ============================================================
   이벤트 바인딩
   ============================================================ */
function bindEvents() {
  // 계약 조회
  searchBtn.addEventListener('click', handleSearch);
  contractInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // 트리 아이템 클릭 (detail 토글 & 버튼)
  document.getElementById('treeItems').addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-action');
    if (btn) {
      e.stopPropagation();
      handleActionBtn(btn.dataset.key);
      return;
    }
    const confirmBtn = e.target.closest('.btn-confirm');
    if (confirmBtn) {
      e.stopPropagation();
      handleConfirm(confirmBtn.dataset.key);
      return;
    }
    const row = e.target.closest('.item-row');
    if (row) {
      const item = row.closest('.tree-item[data-key]');
      if (!item) return;
      const key = item.dataset.key;
      toggleDetail(key);
    }
  });

  // 잠금 해제
  unlockBtn.addEventListener('click', handleUnlock);

  // 모달 닫기
  modalClose.addEventListener('click', closeModal);
  modalBackdrop.addEventListener('click', (e) => {
    if (e.target === modalBackdrop) closeModal();
  });

  // 로그 초기화
  clearLogBtn.addEventListener('click', () => {
    state.logs = [];
    renderLogs();
  });
}

/* ============================================================
   핸들러
   ============================================================ */
function handleSearch() {
  const key = contractInput.value.trim().toUpperCase();
  loadContract(key);
}

function handleActionBtn(key) {
  if (state.itemStatus[key] === 'green') return;

  // 역순 처리 순서 검증
  const idx = ROLLBACK_ORDER.indexOf(key);
  if (idx > 0) {
    const prev = ROLLBACK_ORDER[idx - 1];
    if (state.itemStatus[prev] !== 'green') {
      alert(`[처리 순서 오류]\n먼저 '${labelOf(prev)}'를 취소 처리해야 합니다.\n\n역순 롤백 순서: 현금영수증 → 세금계산서 → 수납 → 청구`);
      return;
    }
  }

  // detail 토글 (액션 버튼 클릭 시)
  toggleDetail(key);
}

function handleConfirm(key) {
  state.itemStatus[key] = 'green';
  state.openDetail = null;

  addLog(`[${labelOf(key)}] 취소 처리 완료 확인 — ${state.contractKey}`);

  renderAll();
}

function toggleDetail(key) {
  if (state.itemStatus[key] === 'green') return;
  state.openDetail = state.openDetail === key ? null : key;
  renderTree();
}

function handleUnlock() {
  if (unlockBtn.disabled) return;

  const now = new Date();
  const ts  = formatDateTime(now);

  modalContractId.textContent = state.contractKey;
  modalMeta.innerHTML =
    `date_chg      : ${ts}<br>` +
    `date_last_chg : ${ts}<br>` +
    `updated_by    : ADMIN`;

  modalBackdrop.style.display = 'flex';
  addLog(`[계약만료 잠금 해제] re_cont_master date_chg 업데이트 — ${state.contractKey}`);
  step4El.className = 'step step-completed';
  step4El.querySelector('.step-num').innerHTML = '<i class="ti ti-check" aria-hidden="true"></i>';
  renderLogs();
}

function closeModal() {
  modalBackdrop.style.display = 'none';
}

/* ============================================================
   유틸리티
   ============================================================ */
function labelOf(key) {
  const map = {
    cash:    '현금영수증',
    tax:     '세금계산서',
    receipt: '수납 데이터',
    bill:    '청구 데이터',
    refund:  '보증금 정산',
  };
  return map[key] || key;
}

function addLog(msg) {
  state.logs.push({ time: formatTime(new Date()), msg });
}

function formatTime(d) {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatDateTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${formatTime(d)}`;
}

function pad(n) {
  return String(n).padStart(2, '0');
}

/* ============================================================
   시작
   ============================================================ */
document.addEventListener('DOMContentLoaded', init);
