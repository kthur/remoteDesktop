/**
 * 메인 애플리케이션 UI 제어, 이벤트 바인딩 및 차트 렌더링 (배우자 1,2 금융소득 개별 연산 적용)
 */

/**
 * 디바운스 헬퍼 - 실시간 계산에 사용 (입력 후 delay ms 뒤에 fn 실행)
 */
function debounce(fn, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  // 1. 온보딩 스플릿 뷰 초기화
  const initOnboarding = () => {
    const btnPdf = document.getElementById('btn-ob-pdf');
    const btnManual = document.getElementById('btn-ob-manual');
    const onboardingContainer = document.getElementById('onboarding-container');
    const manualContainer = document.getElementById('manual-input-container');
    const fileInput = document.getElementById('pdf-file-input');

    if (btnPdf) {
      btnPdf.addEventListener('click', () => {
        fileInput.click();
      });
    }

    if (btnManual) {
      btnManual.addEventListener('click', () => {
        onboardingContainer.style.display = 'none';
        manualContainer.style.display = 'block';
      });
    }
  };

  // 2. 점진적 공개 (Advanced Fields) 초기화
  const initAdvancedToggles = () => {
    const toggleBtns = document.querySelectorAll('.btn-toggle-advanced');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const wrapper = btn.nextElementSibling;
        if (wrapper && wrapper.classList.contains('advanced-fields-wrapper')) {
          const isHidden = wrapper.style.display === 'none';
          wrapper.style.display = isHidden ? 'block' : 'none';
          
          const labelType = btn.dataset.labelType;
          if (labelType === 'income') {
            btn.innerHTML = isHidden ? '➖ 사업·금융·기타 소득 접기 ▲' : '➕ 사업·금융·기타 소득 펼치기 ▼';
          } else if (labelType === 'deduction') {
            btn.innerHTML = isHidden ? '➖ 추가 공제 항목 접기 ▲' : '➕ 추가 공제 항목 펼치기 ▼';
          } else {
            btn.innerHTML = isHidden ? '➖ 접기 ▲' : '➕ 펼치기 ▼';
          }
        }
      });
    });
  };

  // 노란우산공제 활성화 제어 (사업소득 매출액이 0원 초과일 때만 가능)
  const checkYellowUmbrellaState = () => {
    const checkSpouseYellow = (prefix) => {
      const revenueEl = document.getElementById(`inc-${prefix}-business-revenue`);
      const yellowEl = document.getElementById(`inc-${prefix}-yellow`);
      if (!revenueEl || !yellowEl) return;

      const revVal = parseInt(revenueEl.value.replace(/,/g, ''), 10) || 0;
      if (revVal <= 0) {
        yellowEl.disabled = true;
        yellowEl.placeholder = "사업소득 매출 입력 시 활성화";
        yellowEl.value = "";
        yellowEl.style.background = "rgba(255, 255, 255, 0.02)";
        yellowEl.style.cursor = "not-allowed";
      } else {
        yellowEl.disabled = false;
        yellowEl.placeholder = "연간 납입액 (최대 500만 원 공제)";
        yellowEl.style.background = "";
        yellowEl.style.cursor = "";
      }
    };

    ['a', 'b'].forEach(prefix => {
      checkSpouseYellow(prefix);
    });
  };

  const initYellowUmbrellaDisabler = () => {
    ['a', 'b'].forEach(prefix => {
      const revenueEl = document.getElementById(`inc-${prefix}-business-revenue`);
      if (revenueEl) {
        revenueEl.addEventListener('input', checkYellowUmbrellaState);
        revenueEl.addEventListener('change', checkYellowUmbrellaState);
      }
    });
    checkYellowUmbrellaState();
  };

  initOnboarding();
  initAdvancedToggles();
  initYellowUmbrellaDisabler();

  const parseVal = (idOrEl) => {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return 0;
    var raw = parseInt(el.value.replace(/,/g, ''), 10) || 0;
    var unit = el.dataset.unit || 'won';
    return raw * (unit === 'man' ? 10000 : unit === 'eok' ? 100000000 : 1);
  };

  const formatNumberWithCommas = (value) => {
    let numStr = String(value).replace(/,/g, '');
    if (numStr === '') return '';
    let hasMinus = numStr.startsWith('-');
    if (hasMinus) numStr = numStr.substring(1);
    
    numStr = numStr.replace(/[^0-9]/g, '');
    if (numStr === '') return hasMinus ? '-' : '';
    
    let formatted = parseInt(numStr, 10).toLocaleString('ko-KR');
    return hasMinus ? '-' + formatted : formatted;
  };

  // 🆕 P0-5: 결과값 업데이트 시 하이라이트 효과
  function updateResultWithHighlight(elId, value) {
    const el = document.getElementById(elId);
    if (!el) return;
    const formatted = typeof value === 'number' ? value.toLocaleString() + ' 원' : value;
    if (el.textContent !== formatted) {
      el.textContent = formatted;
      el.classList.remove('result-highlight');
      void el.offsetWidth;
      el.classList.add('result-highlight');
    }
  }

  // 🆕 P0-12: 토스트 메시지 표시
  function showToast(message, duration) {
    if (duration === undefined) duration = 2000;
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    var toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function() {
      toast.classList.add('out');
      setTimeout(function() { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 250);
    }, duration);
  }

  const formatInputOnEvent = (e) => {
    const el = e.target;
    let originalSelectionStart = el.selectionStart;
    let originalValue = el.value;
    
    let commasBeforeCursor = (originalValue.substring(0, originalSelectionStart).match(/,/g) || []).length;
    let digitsBeforeCursor = originalValue.substring(0, originalSelectionStart).replace(/[^0-9]/g, '').length;
    let isNegativeBefore = originalValue.substring(0, originalSelectionStart).includes('-');
    
    let cleanVal = originalValue.replace(/,/g, '');
    if (cleanVal === '') {
      el.value = '';
      return;
    }
    
    let formatted = formatNumberWithCommas(cleanVal);
    el.value = formatted;
    
    let newCursorPosition = 0;
    let digitCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (formatted[i] === '-') {
        if (isNegativeBefore) newCursorPosition++;
      } else if (formatted[i] !== ',') {
        digitCount++;
        newCursorPosition++;
        if (digitCount === digitsBeforeCursor) {
          break;
        }
      } else {
        newCursorPosition++;
      }
    }
    el.setSelectionRange(newCursorPosition, newCursorPosition);
  };

  const setAndFormatVal = (idOrEl, val) => {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return;
    el.value = formatNumberWithCommas(val);
  };

  function showInlineError(containerId, message) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.textContent = message;
    el.style.display = 'block';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function clearInlineErrors() {
    document.querySelectorAll('.form-error-inline').forEach(el => {
      el.textContent = '';
      el.style.display = 'none';
    });
  }

  function showAccordionSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.style.display = 'block';
    section.classList.add('active');
  }

  function hideAccordionSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (!section) return;
    section.style.display = 'none';
    section.classList.remove('active');
  }

  // 🆕 토스트 메시지 표시
  function showToast(message, duration) {
    duration = duration || 2500;
    let toast = document.getElementById('app-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'app-toast';
      toast.style.cssText = 'position:fixed; bottom:90px; left:50%; transform:translateX(-50%) translateY(20px); background:rgba(15,23,42,0.95); color:#fff; padding:10px 20px; border-radius:8px; font-size:0.85rem; font-weight:600; z-index:9999; opacity:0; transition:opacity 0.3s, transform 0.3s; pointer-events:none; white-space:nowrap; box-shadow:0 4px 20px rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.1);';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, duration);
  }

  function initAccordion() {
    document.querySelectorAll('.accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const section = header.closest('.accordion-section');
        if (section) section.classList.toggle('active');
      });
    });
  }



  function initStepSections() {
    document.querySelectorAll('.step-section-header').forEach(header => {
      header.addEventListener('click', () => {
        const targetId = header.dataset.target;
        const body = document.getElementById(targetId);
        if (!body) return;
        body.classList.toggle('collapsed');
        const arrow = header.querySelector('span:last-child');
        if (arrow) arrow.textContent = body.classList.contains('collapsed') ? '▼' : '▲';
      });
    });
  }


  function updateInputProgress() {
    const fields = [
      'inc-a-salary', 'inc-b-salary', 'inc-a-card', 'inc-b-card',
      'inc-a-pension', 'inc-b-pension', 'inc-a-financial-gen', 'inc-b-financial-gen',
      'inc-a-isa', 'inc-b-isa', 'inc-a-bond', 'inc-b-bond',
      'inc-a-venture', 'inc-b-venture', 'inc-a-housing-sub', 'inc-b-housing-sub'
    ];
    let filled = 0;
    fields.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const val = parseInt(el.value.replace(/,/g, ''), 10) || 0;
        if (val > 0) filled++;
      }
    });
    const pct = Math.round((filled / fields.length) * 100);
    const fill = document.getElementById('progress-fill');
    const label = document.getElementById('progress-label');
    const pctLabel = document.getElementById('progress-pct');
    if (fill) fill.style.width = pct + '%';
    if (pctLabel) pctLabel.textContent = pct + '%';
    if (label) {
      if (pct === 0) label.textContent = '입력해 주세요';
      else if (pct < 30) label.textContent = '기본 정보 입력 중';
      else if (pct < 60) label.textContent = '공제 항목 입력 중';
      else if (pct < 100) label.textContent = '추가 입력 가능';
      else label.textContent = '✅ 모든 항목 입력 완료!';
    }
  }

  function showCalcStatus(show) {
    const el = document.getElementById('calc-status-income');
    if (!el) return;
    el.classList.toggle('idle', !show);
  }

  function toggleEmptyState(hasData) {
    const el = document.getElementById('res-report-empty');
    if (!el) return;
    el.style.display = hasData ? 'none' : 'block';
    const resultCard = document.getElementById('inc-result-card');
    if (resultCard) {
      resultCard.classList.toggle('has-empty-state', !hasData);
    }
  }

  // Flag to prevent save-during-load loop
  let isLoadingState = false;

  // Local Storage Save & Load logic
  function saveStateToLocalStorage() {
    const state = {
      statics: {},
      dependents: []
    };

    // 🆕 P2: 저장 전 money-input 단위를 원으로 자동 변환
    document.querySelectorAll('.money-input[data-unit]').forEach(function(el) {
      var u = el.dataset.unit;
      if (u && u !== 'won') {
        var raw = parseInt(el.value.replace(/,/g, ''), 10) || 0;
        var wonVal = raw * (u === 'man' ? 10000 : 100000000);
        el.value = formatNumberWithCommas(wonVal);
        el.dataset.unit = 'won';
        // 토글 버튼도 리셋
        var group = el.parentNode.querySelector('.unit-toggle-group');
        if (group) {
          group.querySelectorAll('.unit-toggle-btn').forEach(function(b) { b.classList.remove('active'); });
          var firstBtn = group.querySelector('.unit-toggle-btn');
          if (firstBtn) firstBtn.classList.add('active');
        }
        // won-helper 업데이트
        var helper = el.parentNode.querySelector('.won-helper');
        if (helper) helper.textContent = convertToKoreanWon(el.value);
      }
    });

    // Save all static inputs and select elements that have an ID
    const staticElements = document.querySelectorAll('input[id], select[id]');
    staticElements.forEach(el => {
      if (el.type === 'checkbox' || el.type === 'radio') {
        state.statics[el.id] = el.checked;
      } else {
        state.statics[el.id] = el.value;
      }
    });

    // Save dynamic dependents
    const dependentCards = document.querySelectorAll('#inc-couple-ye-people .person-card');
    dependentCards.forEach(card => {
      state.dependents.push({
        name: card.querySelector('.opt-dep-name').value,
        relation: card.querySelector('.opt-dep-relation').value,
        card: card.querySelector('.opt-dep-card').value,
        medical: card.querySelector('.opt-dep-medical').value,
        edu: card.querySelector('.opt-dep-edu').value,
        studentLoan: card.querySelector('.opt-dep-student-loan').value,
        senior: card.querySelector('.opt-dep-senior').checked,
        disabled: card.querySelector('.opt-dep-disabled').checked,
        birth: card.querySelector('.opt-dep-birth').checked
      });
    });

    localStorage.setItem('tax_calculator_state', JSON.stringify(state));
  }

  function loadStateFromLocalStorage() {
    const savedStr = localStorage.getItem('tax_calculator_state');
    if (!savedStr) return;
    try {
      const state = JSON.parse(savedStr);
      if (!state) return;

      // Set flag to prevent save-during-load loop
      isLoadingState = true;

      // Restore static elements
      if (state.statics) {
        for (const id in state.statics) {
          const el = document.getElementById(id);
          if (!el) continue;
          if (el.type === 'checkbox' || el.type === 'radio') {
            el.checked = state.statics[id];
            // Directly apply UI changes without dispatching events to avoid save loop
            if (id === 'vat-use-agri') {
              const _agriEl = document.getElementById('group-agri-amt');
              if (_agriEl) _agriEl.style.display = el.checked ? 'block' : 'none';
            } else if (id === 'vat-use-cardsales') {
              const _cardEl = document.getElementById('group-cardsales-amt');
              if (_cardEl) _cardEl.style.display = el.checked ? 'block' : 'none';
            }
          } else {
            el.value = state.statics[id];
            // Directly apply UI state for selects
            if (id === 'vat-type') {
              const _bizTypeEl = document.getElementById('group-business-type');
              if (_bizTypeEl) _bizTypeEl.style.display = el.value === 'simplified' ? 'block' : 'none';
            } else if (id === 'capital-type') {
              const _reEl = document.getElementById('form-real-estate');
              const _stEl = document.getElementById('form-stock');
              if (_reEl) _reEl.style.display = el.value === 'real_estate' ? 'block' : 'none';
              if (_stEl) _stEl.style.display = el.value === 'real_estate' ? 'none' : 'block';
            }
          }
        }
      }

      // Restore dynamic dependents
      if (state.dependents && state.dependents.length > 0) {
        const container = document.getElementById('inc-couple-ye-people');
        if (container) {
          container.innerHTML = '';
          state.dependents.forEach((dep, idx) => {
            const card = document.createElement('div');
            card.className = 'person-card';
            card.dataset.id = idx + 1;
            card.innerHTML = `
              <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span class="person-name">부양가족 ${idx + 1}</span>
                  <button class="btn-remove-person">✖</button>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
                  <div class="form-group" style="margin-bottom:0;">
                    <label>가족 이름</label>
                    <input type="text" class="form-input opt-dep-name" value="${dep.name}" placeholder="예: 홍길동">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>관계 설정</label>
                    <select class="form-input opt-dep-relation">
                      <option value="child" ${dep.relation === 'child' ? 'selected' : ''}>자녀 (8세 이상)</option>
                      <option value="parent" ${dep.relation === 'parent' ? 'selected' : ''}>부모 (기본공제)</option>
                      <option value="other" ${dep.relation === 'other' ? 'selected' : ''}>기타</option>
                    </select>
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>가족 카드사용액 <span class="tooltip-icon" data-tooltip="부양가족 명의의 신용카드/체크카드 사용액입니다. 기본공제를 받는 배우자에게 자동으로 합산되어 한도 내 소득공제됩니다.">?</span></label>
                    <input type="text" inputmode="numeric" class="form-input money-input opt-dep-card" value="${dep.card}" placeholder="연간 합계(원)">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>가족 의료비 <span class="tooltip-icon" data-tooltip="해당 가족을 위해 지출한 연간 의료비입니다. 의료비 세액공제는 총급여의 3% 초과 지출액부터 15% 공제 혜택이 적용됩니다.">?</span></label>
                    <input type="text" inputmode="numeric" class="form-input money-input opt-dep-medical" value="${dep.medical}" placeholder="연간 합계(원)">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>가족 교육비 <span class="tooltip-icon" data-tooltip="가족의 학원비, 학교 등록금 등 교육 비용입니다. 취학전아동/초중고생 1인당 연 300만원, 대학생 연 900만원 한도로 15% 공제됩니다.">?</span></label>
                    <input type="text" inputmode="numeric" class="form-input money-input opt-dep-edu" value="${dep.edu}" placeholder="연간 합계(원)">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>학자금 대출 상환 <span class="tooltip-icon" data-tooltip="본인 또는 부양가족 명의의 학자금 대출 상환 원리금입니다. 연 한도 없이 15% 세액공제를 받습니다.">?</span></label>
                    <input type="text" inputmode="numeric" class="form-input money-input opt-dep-student-loan" value="${dep.studentLoan}" placeholder="연간 합계(원)">
                  </div>
                </div>
                <div style="display:flex; gap:15px; margin-top:5px; font-size:0.8rem;">
                  <label><input type="checkbox" class="opt-dep-senior" ${dep.senior ? 'checked' : ''}> 경로우대(70세+)</label>
                  <label><input type="checkbox" class="opt-dep-disabled" ${dep.disabled ? 'checked' : ''}> 장애인 공제</label>
                  <label><input type="checkbox" class="opt-dep-birth" ${dep.birth ? 'checked' : ''}> 출산/입양</label>
                </div>
              </div>
            `;
            container.appendChild(card);
            card.querySelector('.btn-remove-person').addEventListener('click', () => {
              card.remove();
              saveStateToLocalStorage();
            });
            card.querySelectorAll('.money-input').forEach(input => {
              input.addEventListener('input', formatInputOnEvent);
            });
          });
        }
      }

      // Reformat restored money input values
      document.querySelectorAll('.money-input').forEach(input => {
        input.value = formatNumberWithCommas(input.value);
      });
      
      // Sync Spouse B toggle display
      if (enableSpouseBCheckbox) {
        const isEnabled = enableSpouseBCheckbox.checked;
        const bSegmentBtn = document.querySelector('.profile-segment-wrapper .segment-btn[data-segment="profile-b"]');
        if (bSegmentBtn) bSegmentBtn.style.display = isEnabled ? 'inline-block' : 'none';
        const bMobileOption = document.querySelector('#mobile-spouse-select option[value="profile-b"]');
        if (bMobileOption) bMobileOption.style.display = isEnabled ? 'block' : 'none';
        const bTaxCard = document.getElementById('res-b-tax-report-card');
        const bFinCard = document.getElementById('res-b-financial-report-card');
        if (bTaxCard) bTaxCard.style.display = isEnabled ? 'block' : 'none';
        if (bFinCard) bFinCard.style.display = isEnabled ? 'block' : 'none';
      }

      // Sync yellow umbrella input field state
      checkYellowUmbrellaState();

      // Sync visibility of conditional fields
      const isaMatured = document.getElementById('isa-matured');
      if (isaMatured) {
        const pGroup = document.getElementById('isa-pension-group');
        if (pGroup) pGroup.style.display = isaMatured.checked ? 'block' : 'none';
      }
      const inheritCoresident = document.getElementById('inherit-coresident');
      if (inheritCoresident) {
        const cGroup = document.getElementById('inherit-coresident-group');
        if (cGroup) cGroup.style.display = inheritCoresident.checked ? 'block' : 'none';
      }
      const deemedHouse = document.getElementById('deemed-house-count');
      if (deemedHouse) {
        const hpGroup = document.getElementById('deemed-highprice-group');
        if (hpGroup) hpGroup.style.display = deemedHouse.value >= '2' ? 'block' : 'none';
      }
      const hiType = document.getElementById('hi-type');
      if (hiType) {
        const isEmployee = hiType.value === 'employee';
        const empFields = document.getElementById('hi-employee-fields');
        const regFields = document.getElementById('hi-regional-fields');
        if (empFields) empFields.style.display = isEmployee ? 'block' : 'none';
        if (regFields) regFields.style.display = isEmployee ? 'none' : 'block';
      }
      const optGsType = document.getElementById('opt-gs-type');
      if (optGsType) {
        const warning = document.getElementById('gs-stock-warning');
        if (warning) warning.style.display = optGsType.value === 'stock' ? 'block' : 'none';
      }
    } catch (e) {
      console.error("Error loading state from localStorage", e);
    } finally {
      // Always clear the loading flag
      isLoadingState = false;
    }
  }

  // Korean Currency Helper
  function convertToKoreanWon(value) {
    const num = Math.floor(parseFloat(String(value).replace(/,/g, '')) || 0);
    if (num === 0) return '0원';
    
    let result = '';
    const eok = Math.floor(num / 100000000);
    const man = Math.floor((num % 100000000) / 10000);
    const won = num % 10000;
    
    if (eok > 0) {
      result += `${eok}억 `;
    }
    if (man > 0) {
      result += `${man.toLocaleString('ko-KR')}만 `;
    }
    if (won > 0 && eok === 0 && man === 0) {
      result += `${won.toLocaleString('ko-KR')}`;
    }
    
    return result.trim() + ' 원';
  }

  // 🆕 P2: 단위 변환 맵
  var unitFactors = { won: 1, man: 10000, eok: 100000000 };

  function setupKoreanUnitHelpers() {
    const targetIds = [
      'inc-a-salary', 'inc-b-salary', 'inc-a-card', 'inc-b-card',
      'vat-sales', 'vat-purchases', 'capital-purchase', 'capital-sell',
      'stock-gain', 'opt-gs-purchase', 'opt-gs-current',
      'expense-revenue', 'hi-earned-income', 'hi-other-income',
      'prop-public-price', 'prop-market-price', 'gift-amount', 'gift-past',
      'stock-exchange-rate', 'inc-a-irp', 'inc-b-irp',
      'pension-salary', 'pension-amount', 'pension-irp-amount',
      'card-salary', 'card-usage-amount', 'card-cash-amount', 'card-traditional', 'card-transit', 'card-book',
      'inherit-total-asset', 'inherit-spouse-share', 'inherit-coresident-value', 'inherit-financial', 'inherit-gift-past',
      'mg-amount', 'mg-past',
      'sports-salary', 'sports-fee',
      'hometown-amount',
      'isa-annual', 'isa-salary', 'isa-pension-transfer',
      'deemed-deposit', 'deemed-small',
      'insurance-premium', 'rent-salary', 'rent-amount',
      'donation-income', 'donation-statutory', 'donation-designated', 'donation-religious',
      'hi-regional-income', 'hi-regional-property',
      'standard-itemized', 'ecocar-price',
      'housing-salary', 'housing-sub-amount', 'housing-jeonse-repay', 'housing-mortgage-interest',
      'se-revenue', 'se-other-income', 'se-financial-income'
    ];
    
    targetIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      // 모바일 숫자 키패드 지원 및 간편 클리어 버튼 래퍼 구성
      el.setAttribute('inputmode', 'decimal');
      const wrapper = document.createElement('div');
      wrapper.className = 'input-clear-wrapper';
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'input-clear-btn';
      clearBtn.textContent = '✖';
      wrapper.appendChild(clearBtn);

      const toggleClearBtnVisibility = () => {
        const val = el.value.trim();
        if (val !== '' && val !== '0') {
          clearBtn.classList.add('visible');
        } else {
          clearBtn.classList.remove('visible');
        }
      };

      clearBtn.addEventListener('click', () => {
        el.value = '0';
        clearBtn.classList.remove('visible');
        updateHelper();
        el.dispatchEvent(new Event('input', { bubbles: true }));
      });

      el.addEventListener('input', toggleClearBtnVisibility);

      // 원래 won-helper (한글 읽기)
      const helper = document.createElement('div');
      helper.className = 'won-helper';
      helper.style.fontSize = '0.8rem';
      helper.style.color = 'var(--accent-secondary)';
      helper.style.marginTop = '4px';
      helper.style.fontWeight = 'bold';
      wrapper.parentNode.insertBefore(helper, wrapper.nextSibling);
      
      const updateHelper = () => {
        helper.textContent = convertToKoreanWon(el.value);
      };
      el.addEventListener('input', updateHelper);
      updateHelper();
      toggleClearBtnVisibility();

      // 🆕 P2: 단위 토글 버튼
      var unitGroup = document.createElement('div');
      unitGroup.className = 'unit-toggle-group';
      var units = ['won', 'man', 'eok'];
      var unitLabels = { won: '원', man: '만원', eok: '억원' };
      var currentUnit = 'won';
      el.dataset.unit = 'won';

      units.forEach(function(u) {
        var btn = document.createElement('button');
        btn.className = 'unit-toggle-btn' + (u === 'won' ? ' active' : '');
        btn.textContent = unitLabels[u];
        btn.addEventListener('click', function() {
          if (currentUnit === u) return;
          // Convert displayed value between units
          var rawVal = parseInt(el.value.replace(/,/g, ''), 10) || 0;
          var wonVal = rawVal * unitFactors[currentUnit];
          var newVal = wonVal / unitFactors[u];
          el.value = formatNumberWithCommas(Math.floor(newVal));
          currentUnit = u;
          el.dataset.unit = u;
          unitGroup.querySelectorAll('.unit-toggle-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          updateHelper();
          el.dispatchEvent(new Event('input', { bubbles: true }));
        });
        unitGroup.appendChild(btn);
      });

      wrapper.parentNode.insertBefore(unitGroup, helper.nextSibling);

      // 🆕 P2: 포커스 시 한글 읽기 툴팁
      var koreanReading = document.createElement('div');
      koreanReading.className = 'korean-reading';
      wrapper.parentNode.insertBefore(koreanReading, unitGroup.nextSibling);
      
      el.addEventListener('focus', function() {
        var rawVal = parseInt(el.value.replace(/,/g, ''), 10) || 0;
        var wonVal = rawVal * unitFactors[currentUnit];
        koreanReading.textContent = '읽기: ' + convertToKoreanWon(wonVal);
        koreanReading.classList.add('visible');
      });
      el.addEventListener('blur', function() {
        koreanReading.classList.remove('visible');
        // 단위 유지 — localStorage 저장 시에만 원 단위로 변환
      });
    });
  }

  // Bind input listeners to money inputs
  document.querySelectorAll('.money-input').forEach(input => {
    input.addEventListener('input', formatInputOnEvent);
    if (input.value) {
      input.value = formatNumberWithCommas(input.value);
    }
  });

  // ✅ PDF 업로드 — 홈택스 자동 입력
  const dropzone = document.getElementById('pdf-dropzone');
  const fileInput = document.getElementById('pdf-file-input');
  const pdfStatus = document.getElementById('pdf-status');

  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
    dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files.length > 0) processPDF(e.dataTransfer.files[0]);
    });
    if (fileInput) {
      dropzone.addEventListener('click', () => { fileInput.click(); });
    }
  }
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) processPDF(e.target.files[0]);
    });
  }

  async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    return { text: fullText, pdf };
  }

  async function ocrPDFPages(pdf, onProgress) {
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2.0 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (onProgress) onProgress(i, pdf.numPages);
      const result = await Tesseract.recognize(canvas, 'kor+eng', {
        logger: m => {
          if (m.status === 'recognizing text' && onProgress) onProgress(i, pdf.numPages, m.progress);
        }
      });
      fullText += result.data.text + '\n';
    }
    return fullText;
  }

  function parseTaxData(text) {
    const clean = text.replace(/\s+/g, ' ');
    // 국세청 PDF 서식 대응 — 패턴을 관대하게
    const patterns = [
      // 총급여: "총급여액 70,000,000" / "총급여 70,000,000" / "총급여액\n70,000,000" 
      { key: 'totalSalary',   regex: /총급여(?:액)?\s*[:\s]*(?:￦|원)?\s*\[?\s*([\d,]+)\s*\]?/, id: 'inc-a-salary' },
      // 신용카드: "신용카드사용액" 붙여쓰기 대응
      { key: 'creditCard',    regex: /신용카드\s*사용액\s*[:\s]*(?:￦|원)?\s*\[?\s*([\d,]+)\s*\]?/, id: 'inc-a-card' },
      // 체크카드/현금
      { key: 'cashReceipt',   regex: /(?:체크카드|현금영수증|직불카드)\s*(?:사용액)?\s*[:\s]*(?:￦|원)?\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // 연금저축
      { key: 'pension',       regex: /연금(?:저축|계좌)\s*(?:납입액)?\s*[:\s]*(?:￦|원)?\s*\[?\s*([\d,]+)\s*\]?/, id: 'inc-a-pension' },
      // 의료비
      { key: 'medical',       regex: /의료비\s*(?:지출액)?\s*[:\s]*(?:￦|원)?\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // 보험료
      { key: 'insurance',     regex: /(?:보장성\s*보험료|보험료)\s*[:\s]*(?:￦|원)?\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // 교육비
      { key: 'education',     regex: /교육비\s*(?:공제)?\s*[:\s]*(?:￦|원)?\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // 주택자금
      { key: 'housing',       regex: /주택자금\s*(?:공제)?\s*[:\s]*(?:￦|원)?\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // 기부금
      { key: 'donation',      regex: /기부금\s*[:\s]*(?:￦|원)?\s*\[?\s*([\d,]+)\s*\]?/, id: null },
    ];
    const result = {};
    const filledFields = [];
    for (const { key, regex, id } of patterns) {
      const match = clean.match(regex);
      const val = match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
      result[key] = val;
      if (id && val > 0) {
        const el = document.getElementById(id);
        if (el) {
          el.value = String(val);
          el.classList.add('pdf-filled-field');
          filledFields.push({ id, label: key, value: val });
          // 하이라이트 3초 후 제거
          setTimeout(() => el.classList.remove('pdf-filled-field'), 3000);
        }
      }
    }
    result._filledFields = filledFields;
    return result;
  }

  async function processPDF(file) {
    if (file.type !== 'application/pdf') { alert('PDF 파일만 업로드 가능합니다.'); return; }
    pdfStatus.style.display = 'block';
    pdfStatus.innerHTML = '⏳ PDF 텍스트 추출 중...';
    pdfStatus.style.color = '';
    try {
      if (!window.pdfjsLib) {
        pdfStatus.innerHTML = '❌ PDF 라이브러리(pdf.min.js)를 찾을 수 없습니다. 프로젝트 폴더에 <code>pdf.min.js</code>와 <code>pdf.worker.min.js</code>가 있는지 확인해 주세요.';
        pdfStatus.style.color = 'var(--accent-warning)';
        return;
      }
      const extracted = await extractTextFromPDF(file);
      let extractedText = extracted.text;
      const cleanText = extractedText.replace(/\s+/g, ' ').trim();
      // 텍스트가 100자 미만이면 스캔(이미지) PDF → OCR fallback
      if (cleanText.length < 100) {
        if (typeof Tesseract !== 'undefined') {
          pdfStatus.innerHTML = '🔍 텍스트 레이어가 부족하여 OCR을 시작합니다...<br><span style="font-size:0.72rem;">첫 실행 시 한국어+영어 언어 데이터(~4MB) 다운로드가 필요합니다</span>';
          try {
            const ocrText = await ocrPDFPages(extracted.pdf, (page, total, progress) => {
              const pct = progress !== undefined ? Math.round(progress * 100) : Math.round(page / total * 100);
              pdfStatus.innerHTML = `🔍 OCR 페이지 ${page}/${total} 인식 중... ${pct}%<br><span style="font-size:0.72rem;"><span style="display:block; width:${pct}%; height:4px; background:var(--accent-secondary); border-radius:2px; transition:width 0.3s;"></span></span>`;
            });
            extractedText = ocrText;
            pdfStatus.innerHTML = '✅ OCR 인식 완료! 데이터 분석 중...';
          } catch (ocrErr) {
            console.error(ocrErr);
            pdfStatus.innerHTML = '❌ OCR 인식에 실패했습니다. 텍스트 레이어가 있는 PDF를 사용해 주세요.';
            pdfStatus.style.color = 'var(--accent-warning)';
            return;
          }
        } else {
          pdfStatus.innerHTML = '⚠️ OCR 라이브러리(Tesseract.js)가 로드되지 않았습니다.<br><span style="font-size:0.72rem;">인터넷 연결을 확인하거나 텍스트 레이어가 있는 PDF를 사용해 주세요.</span>';
          pdfStatus.style.color = 'var(--accent-warning)';
          return;
        }
      }
      const parsedData = parseTaxData(extractedText);
      const filledCount = Object.values(parsedData).filter(v => v > 0).length;
      if (filledCount > 0) {
        document.querySelectorAll('.money-input').forEach(el => {
          if (el.value) el.value = formatNumberWithCommas(el.value);
        });
        pdfStatus.innerHTML = `✅ PDF 분석 완료! <strong>${filledCount}개 항목</strong>이 자동 입력되었습니다.`;
        pdfStatus.style.color = 'var(--accent-secondary)';
        // 🆕 P0: PDF 리뷰 모달 표시
        showPDFReviewModal(parsedData._filledFields || [], filledCount);
      } else {
        const preview = extractedText.replace(/\s+/g, ' ').substring(0, 200);
        pdfStatus.innerHTML = `⚠️ 텍스트를 추출했으나 일치하는 항목이 없습니다.<br>
          <span style="font-size:0.72rem;opacity:0.7;">추출된 텍스트 미리보기: "${preview}..."</span><br>
          <span style="font-size:0.72rem;opacity:0.7;">PDF가 국세청 연말정산 간소화 PDF 또는 종합소득세 신고서인지 확인하세요. 암호(생년월일)가 걸려있으면 홈택스에서 재다운로드 후 시도해 주세요.</span>`;
        pdfStatus.style.color = 'var(--accent-warning)';
      }
    } catch (err) {
      console.error(err);
      if (err.name === 'PasswordException') {
        pdfStatus.innerHTML = '🔒 암호가 걸린 PDF입니다. 홈택스에서 "암호 설정" 체크를 해제하고 다시 다운로드해 주세요.';
      } else {
        pdfStatus.innerHTML = '❌ PDF를 읽을 수 없습니다. 파일이 손상되지 않았는지 확인해 주세요.';
      }
      pdfStatus.style.color = 'var(--accent-warning)';
    }
  }

  // 🆕 P0: PDF 리뷰 모달
  function showPDFReviewModal(filledFields, count) {
    const modal = document.getElementById('pdf-review-modal');
    const content = document.getElementById('pdf-review-content');
    if (!modal || !content) return;
    const fieldLabels = {
      totalSalary: '총급여', creditCard: '신용카드 사용액',
      cashReceipt: '체크카드/현금', pension: '연금저축',
      medical: '의료비', insurance: '보험료',
      education: '교육비', housing: '주택자금', donation: '기부금'
    };
    let html = `<div style="font-weight:700; margin-bottom:8px;">📄 <strong>${count}개</strong> 항목이 자동 입력되었습니다.</div>`;
    filledFields.forEach(f => {
      html += `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <span>${fieldLabels[f.label] || f.label}</span>
        <span style="font-weight:600; color:var(--accent-secondary);">${f.value.toLocaleString()} 원</span>
      </div>`;
    });
    content.innerHTML = html;
    modal.style.display = 'flex';
    document.getElementById('pdf-review-close').onclick = () => {
      modal.style.display = 'none';
      // 자동 계산 실행
      const btn = document.getElementById('btn-calc-income-integrated');
      if (btn) btn.click();
      // 통합 리포트 탭으로 자동 이동 및 포커스
      const reportTabBtn = document.querySelector('.tab-btn[data-tab="report"]');
      if (reportTabBtn) reportTabBtn.click();
    };
  }


  // ──────────────────────────────────────────────
  // 🆕 P0: 실시간 세무 경고, ISA 유형 검증 및 총급여 동기화 로직
  // ──────────────────────────────────────────────

  function syncDependentSalaries() {
    const spouseASalary = document.getElementById('inc-a-salary')?.value || '0';
    const spouseBSalary = document.getElementById('inc-b-salary')?.value || '0';

    // Pension
    const pensionTarget = document.getElementById('pension-target')?.value || 'a';
    const pensionSalaryEl = document.getElementById('pension-salary');
    if (pensionSalaryEl) {
      pensionSalaryEl.value = pensionTarget === 'a' ? spouseASalary : spouseBSalary;
      pensionSalaryEl.dispatchEvent(new Event('input'));
    }

    // Card
    const cardTarget = document.getElementById('card-target')?.value || 'a';
    const cardSalaryEl = document.getElementById('card-salary');
    if (cardSalaryEl) {
      cardSalaryEl.value = cardTarget === 'a' ? spouseASalary : spouseBSalary;
      cardSalaryEl.dispatchEvent(new Event('input'));
    }

    // Sports
    const sportsTarget = document.getElementById('sports-target')?.value || 'a';
    const sportsSalaryEl = document.getElementById('sports-salary');
    if (sportsSalaryEl) {
      sportsSalaryEl.value = sportsTarget === 'a' ? spouseASalary : spouseBSalary;
      sportsSalaryEl.dispatchEvent(new Event('input'));
    }

    // ISA
    const isaTarget = document.getElementById('isa-target')?.value || 'a';
    const isaSalaryEl = document.getElementById('isa-salary');
    if (isaSalaryEl) {
      isaSalaryEl.value = isaTarget === 'a' ? spouseASalary : spouseBSalary;
      isaSalaryEl.dispatchEvent(new Event('input'));
    }
  }

  function checkSpouseIncomeWarnings(spouse) {
    const suffix = spouse === 'a' ? 'a' : 'b';
    const salary = parseVal(`inc-${suffix}-salary`) || 0;
    const bizRevenue = parseVal(`inc-${suffix}-business-revenue`) || 0;
    const bizExpense = parseVal(`inc-${suffix}-business-expense`) || 0;
    const pension = parseVal(`inc-${suffix}-pension-income`) || 0;
    const otherRevenue = parseVal(`inc-${suffix}-other-revenue`) || 0;
    const otherExpense = parseVal(`inc-${suffix}-other-expense`) || 0;
    const finGen = parseVal(`inc-${suffix}-financial-gen`) || 0;
    const finOverseas = parseVal(`inc-${suffix}-financial-overseas`) || 0;

    const bizIncome = Math.max(0, bizRevenue - bizExpense);
    const otherIncome = Math.max(0, otherRevenue - otherExpense);
    const finIncome = finGen + finOverseas;
    const nonWageIncome = bizIncome + pension + otherIncome + finIncome;

    const warningDiv = document.getElementById(`spouse-${suffix}-income-warning`);
    if (!warningDiv) return;

    let warningHtml = '';
    let hasWarning = false;

    if (nonWageIncome > 20000000) {
      hasWarning = true;
      warningHtml += `<div>⚠️ <strong>소득월액보험료 부과 대상</strong>: 직장 건강보험 외 근로소득외 소득이 2,000만 원을 초과하여 추가 건강보험료(월액)가 부과될 수 있습니다. (초과분의 7.15% 추가 납부)</div>`;
    }

    const isWageOnly = (bizIncome === 0 && pension === 0 && otherIncome === 0 && finIncome === 0);
    const depLimit = isWageOnly ? 50000000 : 34000000;
    const totalIncomeForDep = salary + nonWageIncome;
    if (totalIncomeForDep > depLimit) {
      hasWarning = true;
      warningHtml += `<div style="margin-top:4px;">❌ <strong>피부양자 자격 상실 위험</strong>: 종합소득 합산액(${totalIncomeForDep.toLocaleString()}원)이 피부양자 소득요건(${depLimit.toLocaleString()}원)을 초과하여 건강보험 피부양자 자격이 상실되고 지역가입자로 전환될 위험이 있습니다.</div>`;
    }

    if (hasWarning) {
      warningDiv.style.display = 'block';
      warningDiv.style.background = 'rgba(255, 107, 107, 0.08)';
      warningDiv.style.border = '1px solid rgba(255, 107, 107, 0.2)';
      warningDiv.style.color = '#ff6b6b';
      warningDiv.style.borderRadius = '8px';
      warningDiv.style.padding = '10px';
      warningDiv.style.marginTop = '10px';
      warningDiv.innerHTML = warningHtml;
    } else {
      warningDiv.style.display = 'none';
    }
  }

  function validateIsaOption(spouse) {
    const suffix = spouse === 'a' ? 'a' : 'b';
    const salary = parseVal(`inc-${suffix}-salary`) || 0;
    
    // Check currently selected spouse in ISA target
    const isaTarget = document.getElementById('isa-target')?.value || 'a';
    if (isaTarget === suffix) {
      const isaTypeSelect = document.getElementById('isa-type-select');
      if (isaTypeSelect) {
        const subOption = isaTypeSelect.querySelector('option[value="sub"]');
        if (subOption) {
          if (salary > 50000000) {
            subOption.disabled = true;
            if (isaTypeSelect.value === 'sub') {
              isaTypeSelect.value = 'general';
              // Trigger input event to update calculations
              isaTypeSelect.dispatchEvent(new Event('change'));
              
              // Show notification
              const resultContainer = document.getElementById('isa-opt-result');
              if (resultContainer) {
                resultContainer.style.display = 'block';
                document.getElementById('isa-opt-content').innerHTML = `
                  <div style="color:#ff6b6b; font-weight:bold; padding:8px; background:rgba(255,107,107,0.06); border-radius:6px; margin-bottom:8px;">
                    ⚠️ 총급여 5,000만 원 초과로 서민형 ISA 가입이 불가하여 일반형으로 자동 조정되었습니다. (가족 프로필 연동)
                  </div>
                `;
              }
            }
          } else {
            subOption.disabled = false;
          }
        }
      }
    }
  }

  // Sync Target Selectors
  const targetSelectors = [
    { id: 'pension-target', salary: 'pension-salary', amount: 'pension-amount' },
    { id: 'card-target', salary: 'card-salary', amount: 'card-usage-amount' },
    { id: 'sports-target', salary: 'sports-salary', amount: 'sports-fee' },
    { id: 'hometown-target', amount: 'hometown-amount' }, // only has amount, no salary
    { id: 'isa-target', salary: 'isa-salary', amount: 'isa-annual' },
    { id: 'rent-target', salary: 'rent-salary', amount: 'rent-amount' },
    { id: 'insurance-target', amount: 'insurance-premium' },
    { id: 'housing-target', salary: 'housing-salary', amount: 'housing-sub-amount' }
  ];

  targetSelectors.forEach(config => {
    const sel = document.getElementById(config.id);
    if (!sel) return;
    sel.addEventListener('change', (e) => {
      const spouse = e.target.value; // 'a' or 'b'
      if (config.salary) {
        const baseSalary = document.getElementById(`inc-${spouse}-salary`);
        if (baseSalary) {
          document.getElementById(config.salary).value = baseSalary.value;
        }
      }
      
      // Try to auto-fill amount if there's a corresponding field in base input
      if (config.amount) {
        let baseAmountId = null;
        if (config.id === 'pension-target') baseAmountId = `inc-${spouse}-pension`;
        if (config.id === 'card-target') baseAmountId = `inc-${spouse}-card`;
        if (config.id === 'isa-target') baseAmountId = `inc-${spouse}-isa`;
        
        if (baseAmountId) {
          const baseAmount = document.getElementById(baseAmountId);
          if (baseAmount) {
            document.getElementById(config.amount).value = baseAmount.value;
          }
        }
      }
      
      // Dynamic validation of ISA when target spouse changes
      if (config.id === 'isa-target') {
        validateIsaOption(spouse);
      }
      
      // Trigger calculation
      sel.dispatchEvent(new Event('input'));
    });
  });

  // 1. 테마 토글
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    themeToggleBtn.querySelector('.theme-icon').textContent = isLight ? '☀️' : '🌙';
    themeToggleBtn.querySelector('.theme-text').textContent = isLight ? '다크 모드로 전환' : '라이트 모드로 전환';
  });

  // 🆕 P2-4: breadcrumb 업데이트
  function updateBreadcrumb(tabKey, subKey) {
    var bc = document.getElementById('breadcrumb');
    if (!bc) return;
    var labels = {
      profile: '프로필', income: '소득·연말', business: '사업·자산',
      capital: '양도·증여·상속', report: '통합 리포트'
    };
    var subLabels = {
      transfer: '양도소득', holding: '보유세', gift: '증여·상속',
      'profile-a': '배우자A', 'profile-b': '배우자B', 'profile-dep': '부양가족'
    };
    var parts = [];
    parts.push('<span class="breadcrumb-item active">TAX NAVI</span>');
    parts.push('<span class="breadcrumb-sep">›</span>');
    parts.push('<span class="breadcrumb-item active">' + (labels[tabKey] || tabKey) + '</span>');
    if (subKey && subLabels[subKey]) {
      parts.push('<span class="breadcrumb-sep">›</span>');
      parts.push('<span class="breadcrumb-item active">' + subLabels[subKey] + '</span>');
    }
    bc.innerHTML = parts.join('');
  }

  // 2. 대분류 탭 전환 (종합소득세 / 양도소득세)
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.calculator-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-selected', 'false');
      });
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      btn.setAttribute('aria-selected', 'true');
      const targetPanel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
      updateBreadcrumb(btn.dataset.tab);
    });
  });

  // 3. 양도소득세 탭 입력 전환 제어 (부동산 vs 주식)
  // 1-2. 양도/증여/상속 세그먼트 컨트롤 클릭 바인딩
  // Profile Segment Toggle & Mobile Select Sync
  const profileSegmentBtns = document.querySelectorAll('.profile-segment-wrapper .segment-btn');
  const profileGroups = document.querySelectorAll('.profile-segment-group');
  const mobileSpouseSelect = document.getElementById('mobile-spouse-select');

  // Step Navigation Logic (1: Spouse A, 2: Spouse B, 3: Dependents)
  let currentStep = 1;

  function goToStep(stepNum) {
    const isSpouseBEnabled = document.getElementById('enable-spouse-b')?.checked;
    
    // Boundary checks & skip Spouse B if disabled
    if (stepNum < 1) stepNum = 1;
    if (stepNum === 2 && !isSpouseBEnabled) {
      // If moving forward to 2, skip to 3. If moving backward to 2, skip to 1.
      stepNum = (currentStep === 1) ? 3 : 1;
    }
    if (stepNum > 3) stepNum = 3;
    
    currentStep = stepNum;
    
    // Determine the active segment based on currentStep
    let segmentKey = 'profile-a';
    if (currentStep === 2) segmentKey = 'profile-b';
    if (currentStep === 3) segmentKey = 'profile-dep';
    
    selectProfileGroup(segmentKey);
    
    // Update Stepper buttons state
    const prevBtn = document.getElementById('stepper-prev');
    const nextBtn = document.getElementById('stepper-next');
    if (prevBtn) prevBtn.disabled = (currentStep === 1);
    if (nextBtn) {
      if (currentStep === 3) {
        nextBtn.textContent = '계산하기 🎯';
      } else {
        nextBtn.textContent = '다음 ▶';
      }
    }
  }

  // Stepper Button Listeners
  const prevBtn = document.getElementById('stepper-prev');
  const nextBtn = document.getElementById('stepper-next');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      goToStep(currentStep - 1);
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (currentStep === 3) {
        // Trigger comprehensive integrated calculation
        btnCalcIncomeIntegrated.click();
        
        // Only show report tab if validation succeeded (no error displayed)
        const errorEl = document.getElementById('income-form-error');
        if (errorEl && errorEl.style.display === 'block') {
          return;
        }
        
        // Show report tab
        const reportTabBtn = document.querySelector('.tab-btn[data-tab="report"]');
        if (reportTabBtn) reportTabBtn.click();
      } else {
        goToStep(currentStep + 1);
      }
    });
  }

  // Spouse B Toggle Change Handler
  const enableSpouseBCheckbox = document.getElementById('enable-spouse-b');
  if (enableSpouseBCheckbox) {
    enableSpouseBCheckbox.addEventListener('change', (e) => {
      const isEnabled = e.target.checked;
      
      const bSegmentBtn = document.querySelector('.profile-segment-wrapper .segment-btn[data-segment="profile-b"]');
      if (bSegmentBtn) {
        bSegmentBtn.style.display = isEnabled ? 'inline-block' : 'none';
      }
      const bMobileOption = document.querySelector('#mobile-spouse-select option[value="profile-b"]');
      if (bMobileOption) {
        bMobileOption.style.display = isEnabled ? 'block' : 'none';
      }
      
      // Toggle results page elements
      const bTaxCard = document.getElementById('res-b-tax-report-card');
      const bFinCard = document.getElementById('res-b-financial-report-card');
      if (bTaxCard) bTaxCard.style.display = isEnabled ? 'block' : 'none';
      if (bFinCard) bFinCard.style.display = isEnabled ? 'block' : 'none';
      
      // If we are currently on Spouse B step and it is being disabled, switch to step 1
      if (!isEnabled && currentStep === 2) {
        goToStep(1);
      }
      
      // Auto-recalculate when Spouse B toggle state changes
      btnCalcIncomeIntegrated.click();
    });
  }

  function selectProfileGroup(targetGroup) {
    if (targetGroup === 'profile-b') {
      const checkbox = document.getElementById('enable-spouse-b');
      if (checkbox && !checkbox.checked) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
      }
    }
    const isSpouseBEnabled = document.getElementById('enable-spouse-b')?.checked;
    if (targetGroup === 'profile-b' && !isSpouseBEnabled) {
      targetGroup = 'profile-a';
    }

    profileSegmentBtns.forEach(btn => {
      const isActive = btn.dataset.segment === targetGroup;
      btn.classList.toggle('active', isActive);
      if (isActive) {
        btn.style.background = 'var(--accent-primary)';
        btn.style.color = '#fff';
      } else {
        btn.style.background = 'transparent';
        btn.style.color = 'var(--text-secondary-dark)';
      }
    });

    if (mobileSpouseSelect && mobileSpouseSelect.value !== targetGroup) {
      mobileSpouseSelect.value = targetGroup;
    }

    profileGroups.forEach(group => {
      if (group.dataset.group === targetGroup) {
        group.style.display = 'block';
      } else {
        group.style.display = 'none';
      }
    });
    
    // Sync currentStep state when segments are clicked manually
    if (targetGroup === 'profile-a') currentStep = 1;
    else if (targetGroup === 'profile-b') currentStep = 2;
    else if (targetGroup === 'profile-dep') currentStep = 3;
    
    // Update stepper buttons disabled/text state
    const prevBtn = document.getElementById('stepper-prev');
    const nextBtn = document.getElementById('stepper-next');
    if (prevBtn) prevBtn.disabled = (currentStep === 1);
    if (nextBtn) {
      if (currentStep === 3) {
        nextBtn.textContent = '계산하기 🎯';
      } else {
        nextBtn.textContent = '다음 ▶';
      }
    }

    // Show/hide the "Add Dependent" button `#btn-add-couple-dep` dynamically
    const btnAddCoupleDep = document.getElementById('btn-add-couple-dep');
    if (btnAddCoupleDep) {
      btnAddCoupleDep.style.display = (targetGroup === 'profile-dep') ? 'block' : 'none';
    }
  }

  profileSegmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      selectProfileGroup(btn.dataset.segment);
    });
  });

  if (mobileSpouseSelect) {
    mobileSpouseSelect.addEventListener('change', () => {
      selectProfileGroup(mobileSpouseSelect.value);
    });
  }

  // Capital Segment Toggle
  const capitalSegmentBtns = document.querySelectorAll('.segment-control-wrapper:not(.profile-segment-wrapper) .segment-btn');
  const segmentGroups = document.querySelectorAll('.segment-group-capital');

  capitalSegmentBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      capitalSegmentBtns.forEach(b => {
        b.classList.remove('active');
        b.style.background = 'transparent';
        b.style.color = 'var(--text-secondary-dark)';
      });
      btn.classList.add('active');
      btn.style.background = 'var(--accent-primary)';
      btn.style.color = '#fff';

      const activeSegment = btn.dataset.segment;
      segmentGroups.forEach(group => {
        if (group.classList.contains(activeSegment + '-group')) {
          group.style.display = '';
        } else {
          group.style.display = 'none';
        }
      });
      updateBreadcrumb('capital', activeSegment);
    });
  });

  // 2-2. 모바일 전용 배우자 내부 탭 스위칭 로직
  const spouseTabButtons = document.querySelectorAll('.spouse-tab-btn');
  const spouseContainers = document.querySelectorAll('.spouse-container-box');

  spouseTabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      spouseTabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const targetSpouse = btn.dataset.spouse;
      spouseContainers.forEach(container => {
        if (container.id === 'spouse-' + targetSpouse + '-container') {
          container.classList.add('active');
        } else {
          container.classList.remove('active');
        }
      });
    });
  });

  // 2-3. 모바일 Bottom Sheet 결과창 노출 및 요약 리포트 복사 동기화
  const floatingBarBtn = document.getElementById('floating-bar-btn');
  const bottomSheetDim = document.getElementById('mobile-result-bottom-sheet-dim');
  const bottomSheet = document.getElementById('mobile-result-bottom-sheet');
  const bottomSheetCloseBtn = document.getElementById('bottom-sheet-close-btn');
  const bottomSheetBody = document.getElementById('bottom-sheet-body');
  const originResultCard = document.getElementById('inc-result-card');

  if (floatingBarBtn && bottomSheet && bottomSheetDim && bottomSheetCloseBtn && bottomSheetBody && originResultCard) {
    const openBottomSheet = () => {
      // 결과 리포트 콘텐츠 복제 및 동기화 (상세 리포트 + 요약 브리핑)
      const reportMainCard = document.getElementById('report-main-card');
      bottomSheetBody.innerHTML = originResultCard.innerHTML + (reportMainCard ? reportMainCard.innerHTML : '');
      
      // 복사된 헤더 영역 제거 (Bottom Sheet 자체 헤더가 있으므로)
      bottomSheetBody.querySelectorAll('.card-title').forEach(copiedHeader => {
        if (copiedHeader) copiedHeader.remove();
      });

      // 복사된 리포트 내 공유 버튼 이벤트 재매핑
      const copyBtn = bottomSheetBody.querySelector('#btn-share-report');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const originCopyBtn = document.getElementById('btn-share-report');
          if (originCopyBtn) originCopyBtn.click();
        });
      }

      bottomSheetDim.style.display = 'block';
      bottomSheet.style.display = 'block';
      setTimeout(() => {
        bottomSheet.classList.add('active');
      }, 10);
    };

    const closeBottomSheet = () => {
      bottomSheet.classList.remove('active');
      setTimeout(() => {
        bottomSheet.style.display = 'none';
        bottomSheetDim.style.display = 'none';
      }, 300);
    };

    floatingBarBtn.addEventListener('click', openBottomSheet);
    bottomSheetCloseBtn.addEventListener('click', closeBottomSheet);
    bottomSheetDim.addEventListener('click', closeBottomSheet);
  }

  const capitalTypeSelect = document.getElementById('capital-type');
  const formRealEstate = document.getElementById('form-real-estate');
  const formStock = document.getElementById('form-stock');

  capitalTypeSelect.addEventListener('change', () => {
    if (capitalTypeSelect.value === 'real_estate') {
      formRealEstate.style.display = 'block';
      formStock.style.display = 'none';
    } else {
      formRealEstate.style.display = 'none';
      formStock.style.display = 'block';
    }
  });

  // 4. 부가가치세 의제매입 및 카드발행 세액공제 토글
  const checkUseAgri = document.getElementById('vat-use-agri');
  const groupAgriAmt = document.getElementById('group-agri-amt');
  const checkUseCardSales = document.getElementById('vat-use-cardsales');
  const groupCardSalesAmt = document.getElementById('group-cardsales-amt');
  const vatTypeSelect = document.getElementById('vat-type');
  const groupBusinessType = document.getElementById('group-business-type');

  vatTypeSelect.addEventListener('change', () => {
    groupBusinessType.style.display = vatTypeSelect.value === 'simplified' ? 'block' : 'none';
  });

  checkUseAgri.addEventListener('change', () => {
    groupAgriAmt.style.display = checkUseAgri.checked ? 'block' : 'none';
  });

  checkUseCardSales.addEventListener('change', () => {
    groupCardSalesAmt.style.display = checkUseCardSales.checked ? 'block' : 'none';
  });

  // 🏛️ 상속세 계산
  document.getElementById('btn-calc-inheritance').addEventListener('click', () => {
    const totalAsset = parseVal('inherit-total-asset');
    const childCount = parseInt(document.getElementById('inherit-child-count').value) || 0;
    const hasLivingSpouse = document.getElementById('inherit-has-spouse').checked;
    const spouseShare = parseVal('inherit-spouse-share');
    const isCoResidentHouse = document.getElementById('inherit-coresident').checked;
    const coResidentHouseValue = parseVal('inherit-coresident-value');
    const financialAssetValue = parseVal('inherit-financial');
    const giftPast10Years = parseVal('inherit-gift-past');

    const result = TaxCalculator.calculateInheritanceTax({
      totalAsset, childCount, hasLivingSpouse, spouseShare,
      isCoResidentHouse, coResidentHouseValue, financialAssetValue, giftPast10Years
    });

    document.getElementById('inherit-result').style.display = 'block';
    const isTaxFree = result.isTaxFree;
    document.getElementById('inherit-result-content').innerHTML = `
      <div>상속세 과세가액: <strong>${result.grossEstate.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-info);">📋 공제 내역</div>
      <div>· 인적공제(기초${result.basicDeduction.toLocaleString()} + 자녀${result.childDeduction.toLocaleString()}): <strong>${result.personDeduction.toLocaleString()} 원</strong></div>
      <div>· 배우자 상속공제: <strong>${result.spouseDeduction.toLocaleString()} 원</strong> ${result.spouseDeduction > 500000000 ? '(법정지분 한도)' : '(최소공제)'}</div>
      ${result.coResidentDeduction > 0 ? `<div>· 동거주택 상속공제: <strong>${result.coResidentDeduction.toLocaleString()} 원</strong></div>` : ''}
      ${result.financialDeduction > 0 ? `<div>· 금융재산 상속공제: <strong>${result.financialDeduction.toLocaleString()} 원</strong></div>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>공제 합계: <strong>${result.totalDeductions.toLocaleString()} 원</strong></div>
      <div>과세표준: <strong>${result.taxableEstate.toLocaleString()} 원</strong></div>
      <div>세율: ${result.rate}%</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      ${isTaxFree
        ? '<div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">✅ 상속세 비과세! (면세한도 ' + result.exemptionLimit.toLocaleString() + '원)</div>'
        : `<div style="font-size:0.9rem;font-weight:bold;color:var(--accent-primary);">상속세: ${result.tax.toLocaleString()} 원</div>
           <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-warning);">지방세: ${result.localTax.toLocaleString()} 원</div>
           <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">💵 총 납부세액: ${result.totalTax.toLocaleString()} 원</div>`
      }
      <div style="margin-top:8px;padding:8px;background:rgba(0,212,170,0.08);border-radius:6px;font-size:0.75rem;line-height:1.3;">
        📌 개정 반영: 자녀공제 1인당 5억 원(10배↑) · 최고세율 40%(50% 구간 삭제) · 동거주택 최대 6억 · 금융재산 20%
      </div>
    `;
  });

  // 동거주택 체크박스 토글
  document.getElementById('inherit-coresident').addEventListener('change', function() {
    document.getElementById('inherit-coresident-group').style.display = this.checked ? 'block' : 'none';
  });

  // 💍 혼인·출산 증여재산공제
  document.getElementById('btn-calc-marriage-gift').addEventListener('click', () => {
    const giftAmount = parseVal('mg-amount');
    const reason = document.getElementById('mg-reason').value;
    const past10YrsGift = parseVal('mg-past');
    const result = TaxCalculator.calculateMarriageBirthGiftTax({ giftAmount, reason, past10YrsGift });

    document.getElementById('mg-result').style.display = 'block';
    document.getElementById('mg-result-content').innerHTML = `
      <div>증여 금액: <strong>${giftAmount.toLocaleString()} 원</strong></div>
      <div>최근 10년 누계: ${result.cumulative.toLocaleString()} 원</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-secondary);">✅ 기본공제: ${result.basicExemption.toLocaleString()} 원</div>
      <div style="color:var(--accent-gold);">🎉 혼인·출산 특별공제: <strong>${result.specialExemption.toLocaleString()} 원</strong></div>
      <div>총 공제 한도: <strong>${result.totalExemption.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      ${result.isTaxFree
        ? '<div style="font-weight:bold;color:var(--accent-secondary);font-size:1.05rem;">✅ 증여세 전액 면제!</div>'
        : `<div>과세표준: ${result.taxableGift.toLocaleString()} 원</div>
           <div>세율: ${result.rate}%</div>
           <div style="font-weight:bold;color:var(--accent-primary);">증여세: ${result.tax.toLocaleString()} 원</div>
           <div style="font-weight:bold;color:var(--accent-warning);">지방세: ${result.localTax.toLocaleString()} 원</div>
           <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">💵 총 세액: ${result.totalTax.toLocaleString()} 원</div>`
      }
      <div style="margin-top:8px;padding:8px;background:rgba(0,212,170,0.06);border-radius:6px;font-size:0.75rem;">
        💡 양가(친정+시댁) 각각 1.5억 원씩 총 3억 원까지 증여세 없이 이전 가능합니다.
      </div>
    `;
  });

  // 🏟️ 체육시설 이용료 소득공제
  document.getElementById('btn-calc-sports').addEventListener('click', () => {
    const totalSalary = parseVal('sports-salary');
    const facilityFee = parseVal('sports-fee');
    const hasPT = document.getElementById('sports-has-pt').checked;
    const result = TaxCalculator.calculateSportsDeduction({ totalSalary, facilityFee, hasPT });

    document.getElementById('sports-result').style.display = 'block';
    if (!result.isEligible) {
      document.getElementById('sports-result-content').innerHTML = `
        <div style="color:var(--accent-warning);font-weight:bold;">❌ ${result.reason}</div>
      `;
      return;
    }
    document.getElementById('sports-result-content').innerHTML = `
      <div>총급여: ${result.totalSalary.toLocaleString()} 원</div>
      <div>시설 이용료: ${result.facilityFee.toLocaleString()} 원</div>
      ${result.hasPT ? `<div>PT 포함 → 50%만 인정: <strong>${result.eligibleAmount.toLocaleString()} 원</strong></div>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>공제 대상 금액: ${result.eligibleAmount.toLocaleString()} 원 (한도 ${result.deductionLimit.toLocaleString()}원)</div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">
        💰 소득공제액 (30%): <strong>${result.deduction.toLocaleString()} 원</strong>
      </div>
      <div style="margin-top:8px;font-size:0.75rem;opacity:0.7;">※ 1:1 PT, 기구 필라테스 등 고가 맞춤형 강습비는 공제 제외</div>
    `;
  });

  // 🎁 고향사랑기부제 최적화
  document.getElementById('btn-calc-hometown').addEventListener('click', () => {
    const donationAmount = parseVal('hometown-amount');
    const isDisasterArea = document.getElementById('hometown-disaster').checked;
    const result = TaxCalculator.calculateHometownDonation({ donationAmount, isDisasterArea });

    document.getElementById('hometown-result').style.display = 'block';
    document.getElementById('hometown-result-content').innerHTML = `
      <div>기부 금액: <strong>${result.donationAmount.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>· 10만 원까지 100%: <strong>${result.creditFirst100k.toLocaleString()} 원</strong></div>
      ${result.donationAmount > 100000 ? `<div>· 10~20만 원 44%: <strong>${result.creditSecondBracket.toLocaleString()} 원</strong></div>` : ''}
      ${result.donationAmount > 200000 ? `<div>· 20만 초과 ${isDisasterArea ? '33%' : '16.5%'}: <strong>${(result.creditThirdBracket || 0).toLocaleString()} 원</strong></div>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>총 세액공제액: <strong>${result.totalCredit.toLocaleString()} 원</strong></div>
      <div>답례품 가치(30%): <strong>${result.giftValue.toLocaleString()} 원</strong></div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">
        🎁 총 체감 혜택: <strong>${result.totalBenefit.toLocaleString()} 원</strong>
        (실질 환원율 ${result.effectiveReturnRate}%)
      </div>
      <div style="margin-top:8px;padding:8px;background:rgba(0,212,170,0.1);border-radius:6px;font-size:0.8rem;">
        💡 <strong>최적 전략:</strong> 20만 원 기부 시 14.4만 원 환급 + 6만 원 답례품 = <strong>20.4만 원 혜택</strong> (원금 상회!)<br>
        <span style="font-size:0.7rem;">상/하반기 10만 원씩 분할 기부하여 시즌별 답례품 2회 수령 가능</span>
      </div>
    `;
  });

  // 💰 ISA 최적화
  document.getElementById('isa-matured').addEventListener('change', function() {
    document.getElementById('isa-pension-group').style.display = this.checked ? 'block' : 'none';
  });
  document.getElementById('btn-calc-isa-opt').addEventListener('click', () => {
    const annualIncome = parseVal('isa-annual');
    const isaType = document.getElementById('isa-type-select').value;
    const totalIncome = parseVal('isa-salary');
    const isFinancialCompTax = document.getElementById('isa-financial-comp-tax').checked;
    const isMatured = document.getElementById('isa-matured').checked;
    const pensionTransfer = parseVal('isa-pension-transfer');
    const isDomesticType = isaType === 'domestic';

    const result = TaxCalculator.calculateISAOptimization({
      annualIncome, totalIncome, incomeType: 'wage',
      isFinancialCompTax, currentIsaType: isaType === 'domestic' ? 'general' : isaType,
      isaBalance: annualIncome, isMatured, pensionTransfer, isDomesticType
    });

    document.getElementById('isa-opt-result').style.display = 'block';
    document.getElementById('isa-opt-content').innerHTML = `
      <div>📌 ISA 유형: <strong>${result.isaType === 'sub' ? '서민형' : result.isaType === 'domestic' ? '국내투자형' : '일반형'}</strong></div>
      <div>연 납입 한도: <strong>${result.annualLimit.toLocaleString()} 원</strong> (2026년 개편: 2배↑)</div>
      <div>비과세 한도: <strong>${result.taxfreeLimit.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      ${result.isDomesticType
        ? `<div style="color:var(--accent-info);">국내투자형 ISA → ${result.domesticSeparatedRate}% 분리과세 (종합과세 회피)</div>
           <div style="font-weight:bold;color:var(--accent-secondary);">분리과세 세액: ${result.domesticTax.toLocaleString()} 원</div>`
        : `<div>비과세 적용: <strong>${result.normalTaxfree.toLocaleString()} 원</strong></div>
           <div>초과분 분리과세(9.9%): ${result.normalSeparatedTax.toLocaleString()} 원</div>`
      }
      ${result.pensionTransferCredit > 0
        ? `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
           <div style="color:var(--accent-gold);">🔄 ISA→연금 전환 세액공제: <strong>${result.pensionTransferCredit.toLocaleString()} 원</strong></div>`
        : ''}
      <div style="margin-top:8px;padding:8px;background:rgba(56,189,248,0.08);border-radius:6px;font-size:0.75rem;">
        ${result.summary}
      </div>
    `;
  });

  // 🏠 간주임대료 계산
  document.getElementById('deemed-house-count').addEventListener('change', function() {
    const show = this.value >= '2';
    document.getElementById('deemed-highprice-group').style.display = show ? 'block' : 'none';
  });
  // 초기 상태 (2주택 기본)
  document.getElementById('deemed-highprice-group').style.display = 'block';
  document.getElementById('btn-calc-deemed-rent').addEventListener('click', () => {
    const houseCount = parseInt(document.getElementById('deemed-house-count').value) || 0;
    const jeonseDeposits = parseVal('deemed-deposit');
    const hasHighPriceHouse = document.getElementById('deemed-highprice').value === 'yes';
    const smallHouseExclusion = parseVal('deemed-small');

    const result = TaxCalculator.calculateDeemedRent({ houseCount, jeonseDeposits, hasHighPriceHouse, smallHouseExclusion });

    document.getElementById('deemed-result').style.display = 'block';
    if (!result.isTaxable) {
      document.getElementById('deemed-result-content').innerHTML = `
        <div style="color:var(--accent-secondary);font-weight:bold;">✅ ${result.reason}</div>
      `;
      return;
    }
    document.getElementById('deemed-result-content').innerHTML = `
      <div>보유 주택 수: <strong>${result.houseCount}주택</strong></div>
      <div>전세보증금 합계: ${result.jeonseDeposits.toLocaleString()} 원</div>
      ${result.warningMsg ? `<div style="color:var(--accent-warning);">⚠️ ${result.warningMsg}</div>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>공제 기준: ${result.deductionBase.toLocaleString()} 원</div>
      <div>초과 보증금: ${result.excessDeposit.toLocaleString()} 원</div>
      <div>간주임대료: <strong>${result.deemedRent.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-warning);">예상 종합소득세: ${result.incomeTax.toLocaleString()} 원</div>
      <div style="color:var(--accent-warning);">지방소득세: ${result.localTax.toLocaleString()} 원</div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">
        💵 연간 추가 세액: <strong>${result.totalTax.toLocaleString()} 원</strong>
      </div>
    `;
  });

  // 5. 부양가족 동적 추가/삭제
  const optCoupleYePeople = document.getElementById('inc-couple-ye-people');
  const btnAddCoupleDep = document.getElementById('btn-add-couple-dep');

  if (optCoupleYePeople) {
    optCoupleYePeople.querySelectorAll('.person-card').forEach(card => {
      const removeBtn = card.querySelector('.btn-remove-person');
      if (removeBtn) {
        removeBtn.addEventListener('click', () => {
          card.remove();
          saveStateToLocalStorage();
        });
      }
    });
  }

  btnAddCoupleDep.addEventListener('click', () => {
    const currentCount = optCoupleYePeople.querySelectorAll('.person-card').length;
    if (currentCount >= 5) {
      showInlineError("income-form-error", "부양가족은 최대 5명까지 설정할 수 있습니다.");
      return;
    }
    const nextId = currentCount + 1;
    const card = document.createElement('div');
    card.className = 'person-card';
    card.dataset.id = nextId;
    card.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="person-name">부양가족 ${nextId}</span>
          <button class="btn-remove-person">✖</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
          <div class="form-group" style="margin-bottom:0;">
            <label>가족 이름</label>
            <input type="text" class="form-input opt-dep-name" value="" placeholder="예: 홍길동">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>관계 설정</label>
            <select class="form-input opt-dep-relation">
              <option value="child">자녀 (8세 이상)</option>
              <option value="parent">부모 (기본공제)</option>
              <option value="other">기타</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>가족 카드사용액 <span class="tooltip-icon" data-tooltip="부양가족 명의의 신용카드/체크카드 사용액입니다. 기본공제를 받는 배우자에게 자동으로 합산되어 한도 내 소득공제됩니다.">?</span></label>
            <input type="text" inputmode="numeric" class="form-input money-input opt-dep-card" value="0" placeholder="연간 합계(원)">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>가족 의료비 <span class="tooltip-icon" data-tooltip="해당 가족을 위해 지출한 연간 의료비입니다. 의료비 세액공제는 총급여의 3% 초과 지출액부터 15% 공제 혜택이 적용됩니다.">?</span></label>
            <input type="text" inputmode="numeric" class="form-input money-input opt-dep-medical" value="0" placeholder="연간 합계(원)">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>가족 교육비 <span class="tooltip-icon" data-tooltip="가족의 학원비, 학교 등록금 등 교육 비용입니다. 취학전아동/초중고생 1인당 연 300만원, 대학생 연 900만원 한도로 15% 공제됩니다.">?</span></label>
            <input type="text" inputmode="numeric" class="form-input money-input opt-dep-edu" value="0" placeholder="연간 합계(원)">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>학자금 대출 상환 <span class="tooltip-icon" data-tooltip="본인 또는 부양가족 명의의 학자금 대출 상환 원리금입니다. 연 한도 없이 15% 세액공제를 받습니다.">?</span></label>
            <input type="text" inputmode="numeric" class="form-input money-input opt-dep-student-loan" value="0" placeholder="연간 합계(원)">
          </div>
        </div>
        <div style="display:flex; gap:15px; margin-top:5px; font-size:0.8rem;">
          <label><input type="checkbox" class="opt-dep-senior"> 경로우대(70세+)</label>
          <label><input type="checkbox" class="opt-dep-disabled"> 장애인 공제</label>
          <label><input type="checkbox" class="opt-dep-birth"> 출산/입양</label>
        </div>
      </div>
    `;
    optCoupleYePeople.appendChild(card);

    card.querySelectorAll('.money-input').forEach(input => {
      input.addEventListener('input', formatInputOnEvent);
    });

    card.querySelector('.btn-remove-person').addEventListener('click', () => {
      card.remove();
      saveStateToLocalStorage();
    });

    saveStateToLocalStorage();
  });

  /* ==========================================
     버튼 이벤트 바인딩 및 원스톱 최적화
     ========================================== */

  // ── Helper functions for income integrated calculation ──

  function parseIncomeInputs() {
    var aBizRev = parseVal("inc-a-business-revenue");
    var bBizRev = parseVal("inc-b-business-revenue");
    const isSpouseBEnabled = document.getElementById('enable-spouse-b')?.checked;
    const aIsHouseholder = document.getElementById("inc-a-is-householder") ? document.getElementById("inc-a-is-householder").checked : true;

    if (!isSpouseBEnabled) {
      return {
        aSalary: parseVal("inc-a-salary"),
        aBusinessRevenue: aBizRev,
        aBusinessExpense: parseVal("inc-a-business-expense"),
        aPensionIncome: parseVal("inc-a-pension-income"),
        aOtherRevenue: parseVal("inc-a-other-revenue"),
        aOtherExpense: parseVal("inc-a-other-expense"),
        aCard: parseVal("inc-a-card"),
        aYellow: parseVal("inc-a-yellow"),
        aPension: parseVal("inc-a-pension"),
        aIrp: parseVal("inc-a-irp"),
        aMedical: parseVal("inc-a-medical"),
        aFinancialGen: parseVal("inc-a-financial-gen"),
        aFinancialOverseas: parseVal("inc-a-financial-overseas"),
        aIsaIncome: parseVal("inc-a-isa"),
        aIsaType: document.getElementById("inc-a-isa-type").value,
        aBondSeparated: parseVal("inc-a-bond"),
        aType: aBizRev > 0 ? 'business' : 'wage',
        bSalary: 0,
        bBusinessRevenue: 0,
        bBusinessExpense: 0,
        bPensionIncome: 0,
        bOtherRevenue: 0,
        bOtherExpense: 0,
        bCard: 0,
        bYellow: 0,
        bPension: 0,
        bIrp: 0,
        bMedical: 0,
        bFinancialGen: 0,
        bFinancialOverseas: 0,
        bIsaIncome: 0,
        bIsaType: 'general',
        bBondSeparated: 0,
        bType: 'wage',
        aVentureInvestment: parseVal("inc-a-venture"),
        aHousingSubscription: parseVal("inc-a-housing-sub"),
        aHousingLoanRepay: parseVal("inc-a-housing-loan"),
        aIsHouseholder: aIsHouseholder,
        bVentureInvestment: 0,
        bHousingSubscription: 0,
        bHousingLoanRepay: 0
      };
    }

    return {
      aSalary: parseVal("inc-a-salary"),
      aBusinessRevenue: aBizRev,
      aBusinessExpense: parseVal("inc-a-business-expense"),
      aPensionIncome: parseVal("inc-a-pension-income"),
      aOtherRevenue: parseVal("inc-a-other-revenue"),
      aOtherExpense: parseVal("inc-a-other-expense"),
      aCard: parseVal("inc-a-card"),
      aYellow: parseVal("inc-a-yellow"),
      aPension: parseVal("inc-a-pension"),
      aIrp: parseVal("inc-a-irp"),
      aMedical: parseVal("inc-a-medical"),
      aFinancialGen: parseVal("inc-a-financial-gen"),
      aFinancialOverseas: parseVal("inc-a-financial-overseas"),
      aIsaIncome: parseVal("inc-a-isa"),
      aIsaType: document.getElementById("inc-a-isa-type").value,
      aBondSeparated: parseVal("inc-a-bond"),
      aType: aBizRev > 0 ? 'business' : 'wage',
      bSalary: parseVal("inc-b-salary"),
      bBusinessRevenue: bBizRev,
      bBusinessExpense: parseVal("inc-b-business-expense"),
      bPensionIncome: parseVal("inc-b-pension-income"),
      bOtherRevenue: parseVal("inc-b-other-revenue"),
      bOtherExpense: parseVal("inc-b-other-expense"),
      bCard: parseVal("inc-b-card"),
      bYellow: parseVal("inc-b-yellow"),
      bPension: parseVal("inc-b-pension"),
      bIrp: parseVal("inc-b-irp"),
      bMedical: parseVal("inc-b-medical"),
      bFinancialGen: parseVal("inc-b-financial-gen"),
      bFinancialOverseas: parseVal("inc-b-financial-overseas"),
      bIsaIncome: parseVal("inc-b-isa"),
      bIsaType: document.getElementById("inc-b-isa-type").value,
      bBondSeparated: parseVal("inc-b-bond"),
      bType: bBizRev > 0 ? 'business' : 'wage',
      aVentureInvestment: parseVal("inc-a-venture"),
      aHousingSubscription: parseVal("inc-a-housing-sub"),
      aHousingLoanRepay: parseVal("inc-a-housing-loan"),
      aIsHouseholder: aIsHouseholder,
      bVentureInvestment: parseVal("inc-b-venture"),
      bHousingSubscription: parseVal("inc-b-housing-sub"),
      bHousingLoanRepay: parseVal("inc-b-housing-loan")
    };
  }

  function validateIncomeInputs(d) {
    clearInlineErrors();
    const isSpouseBEnabled = document.getElementById('enable-spouse-b')?.checked;
    
    if (d.aSalary < 0 || (isSpouseBEnabled && d.bSalary < 0)) { showInlineError("income-form-error", "소득금액은 0원 이상이어야 합니다."); return false; }
    if (d.aIsaType === "sub" && d.aSalary > 50000000) { showInlineError("income-form-error", "배우자 A ISA 서민형 자격 없음 (급여 5,000만 초과)"); return false; }
    if (isSpouseBEnabled && d.bIsaType === "sub" && d.bSalary > 50000000) { showInlineError("income-form-error", "배우자 B ISA 서민형 자격 없음 (급여 5,000만 초과)"); return false; }
    const allNonNeg = [d.aCard, d.bCard, d.aYellow, d.bYellow, d.aPension, d.bPension,
      d.aFinancialGen, d.aFinancialOverseas, d.aIsaIncome, d.aBondSeparated,
      d.bFinancialGen, d.bFinancialOverseas, d.bIsaIncome, d.bBondSeparated,
      d.aVentureInvestment, d.aHousingSubscription, d.aHousingLoanRepay,
      d.bVentureInvestment, d.bHousingSubscription, d.bHousingLoanRepay];
    if (allNonNeg.some(v => v < 0)) { showInlineError("income-form-error", "모든 입력금액은 0원 이상이어야 합니다."); return false; }
    return true;
  }

  function collectDependents() {
    const cards = optCoupleYePeople.querySelectorAll(".person-card");
    const dependents = [];
    const depNames = [];
    for (const card of cards) {
      let name = (card.querySelector(".opt-dep-name").value || "").trim();
      if (!name) {
        name = card.querySelector(".person-name")?.textContent || "부양가족";
      }
      if (depNames.includes(name)) { showInlineError("income-form-error", "중복된 부양가족 이름: " + name); return null; }
      depNames.push(name);
      const cardVal = parseVal(card.querySelector(".opt-dep-card"));
      const medicalVal = parseVal(card.querySelector(".opt-dep-medical"));
      const eduVal = parseVal(card.querySelector(".opt-dep-edu"));
      const studentLoanRepayVal = parseVal(card.querySelector(".opt-dep-student-loan"));
      if (cardVal < 0 || medicalVal < 0 || eduVal < 0 || studentLoanRepayVal < 0) { showInlineError("income-form-error", "부양가족 지출액은 0원 이상이어야 합니다."); return null; }
      dependents.push({
        name, relation: card.querySelector(".opt-dep-relation").value,
        card: cardVal, medical: medicalVal, edu: eduVal,
        studentLoanRepay: studentLoanRepayVal,
        senior: card.querySelector(".opt-dep-senior").checked,
        disabled: card.querySelector(".opt-dep-disabled").checked,
        birth: card.querySelector(".opt-dep-birth").checked, birthOrder: 1
      });
    }
    return dependents;
  }

  function buildSpouseCalcOpts(d, prefix) {
    const isA = prefix === "a";
    const sal = isA ? d.aSalary : d.bSalary;
    const bizRev = isA ? d.aBusinessRevenue : d.bBusinessRevenue;
    const bizExp = isA ? d.aBusinessExpense : d.bBusinessExpense;
    const type = bizRev > 0 ? 'business' : 'wage';
    const totalIncome = type === 'wage' ? sal : bizRev;
    const expense = type === 'business' ? bizExp : 0;
    return {
      totalIncome: totalIncome,
      incomeType: type,
      expense: expense,
      yellowUmbrella: isA ? d.aYellow : d.bYellow,
      pensionSavings: isA ? d.aPension : d.bPension,
      irpSavings: isA ? d.aIrp : d.bIrp,
      financialGeneral: isA ? d.aFinancialGen : d.bFinancialGen,
      financialOverseas: isA ? d.aFinancialOverseas : d.bFinancialOverseas,
      isaIncome: isA ? d.aIsaIncome : d.bIsaIncome,
      isaType: isA ? d.aIsaType : d.bIsaType,
      bondSeparated: isA ? d.aBondSeparated : d.bBondSeparated,
      ventureInvestment: isA ? d.aVentureInvestment : d.bVentureInvestment
    };
  }

  function renderSpouseResults(id, result) {
    updateResultWithHighlight("res-" + id + "-expense", (result.salaryDeduction || result.expense || 0).toLocaleString() + " 원");
    updateResultWithHighlight("res-" + id + "-person", (result.personDeduction || 0).toLocaleString() + " 원");
    updateResultWithHighlight("res-" + id + "-taxable", result.taxableIncome.toLocaleString() + " 원");
    updateResultWithHighlight("res-" + id + "-rate", result.bracketRate + "%");
    updateResultWithHighlight("res-" + id + "-total", result.totalTax.toLocaleString() + " 원");
  }

  function renderFinancialDetails(id, result) {
    updateResultWithHighlight("res-" + id + "-isa-free", (result.isaTaxfreeAmount || 0).toLocaleString() + " 원");
    updateResultWithHighlight("res-" + id + "-isa-tax", (result.isaSeparatedTax || 0).toLocaleString() + " 원");
    updateResultWithHighlight("res-" + id + "-bond-tax", (result.bondSeparatedTax || 0).toLocaleString() + " 원");
    updateResultWithHighlight("res-" + id + "-financial-comp", (result.financialCompAmount || 0).toLocaleString() + " 원");
  }

  let currentCustomAssignment = null;
  let isCustomDeductionApplied = false;

  function renderDeductionAssigner(d, dependents, best) {
    const container = document.getElementById("deduction-assigner-section");
    const listContainer = document.getElementById("deduction-assigner-list");
    if (!container || !listContainer) return;

    if (dependents.length === 0) {
      container.style.display = "none";
      return;
    }

    container.style.display = "block";

    if (!currentCustomAssignment) {
      currentCustomAssignment = {
        deps: {},
        medical: best ? best.medicalTarget : 'a'
      };
      dependents.forEach(dep => {
        if (best && best.bDeps.includes(dep.name)) {
          currentCustomAssignment.deps[dep.name] = 'b';
        } else {
          currentCustomAssignment.deps[dep.name] = 'a';
        }
      });
    }

    let html = '';

    dependents.forEach(dep => {
      const selectedValue = currentCustomAssignment.deps[dep.name] || 'a';
      const recommendedValue = (best && best.bDeps.includes(dep.name)) ? 'b' : 'a';
      
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(255,255,255,0.01); border-bottom:1px solid rgba(255,255,255,0.03);">
          <div>
            <strong>👥 ${dep.name}</strong> <span style="font-size:0.75rem; opacity:0.6;">(${dep.relation === 'child' ? '자녀' : dep.relation === 'parent' ? '부모' : '기타'})</span>
            <div style="font-size:0.7rem; opacity:0.7; margin-top:2px;">
              인적공제 150만 ${dep.medical > 0 ? ` · 의료비 ${dep.medical.toLocaleString()}원` : ''} ${dep.edu > 0 ? ` · 교육비 ${dep.edu.toLocaleString()}원` : ''}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.7rem; color:var(--accent-secondary); font-weight:bold;">
              ${recommendedValue === 'a' ? 'A 권장' : 'B 권장'}
            </span>
            <select class="form-input custom-dep-assign" data-dep-name="${dep.name}" style="padding:4px 8px; font-size:0.8rem; width:auto; margin-bottom:0;">
              <option value="a" ${selectedValue === 'a' ? 'selected' : ''}>배우자 A</option>
              <option value="b" ${selectedValue === 'b' ? 'selected' : ''}>배우자 B</option>
            </select>
          </div>
        </div>
      `;
    });

    const totalMedical = dependents.reduce((s, dep) => s + dep.medical, 0);
    if (totalMedical > 0) {
      const selectedMed = currentCustomAssignment.medical;
      const recommendedMed = best ? best.medicalTarget : 'a';
      html += `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px; background:rgba(255,255,255,0.01); border-bottom:1px solid rgba(255,255,255,0.03);">
          <div>
            <strong>🏥 의료비 몰아주기 (합계: ${totalMedical.toLocaleString()}원)</strong>
            <div style="font-size:0.7rem; opacity:0.7; margin-top:2px;">
              의료비 세액공제는 부부 중 한 사람에게 몰아주는 것이 유리합니다.
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.7rem; color:var(--accent-secondary); font-weight:bold;">
              ${recommendedMed === 'a' ? 'A 권장' : 'B 권장'}
            </span>
            <select class="form-input" id="custom-medical-assign" style="padding:4px 8px; font-size:0.8rem; width:auto; margin-bottom:0;">
              <option value="a" ${selectedMed === 'a' ? 'selected' : ''}>배우자 A</option>
              <option value="b" ${selectedMed === 'b' ? 'selected' : ''}>배우자 B</option>
            </select>
          </div>
        </div>
      `;
    }

    listContainer.innerHTML = html;
  }

  function runOptimizerAndRender(d, dependents) {
    const personAOptData = {
      totalSalary: d.aSalary,
      businessRevenue: d.aBusinessRevenue,
      businessExpense: d.aBusinessExpense,
      pensionIncome: d.aPensionIncome,
      otherRevenue: d.aOtherRevenue,
      otherExpense: d.aOtherExpense,
      financialGeneral: d.aFinancialGen,
      financialOverseas: d.aFinancialOverseas,
      isaIncome: d.aIsaIncome,
      isaType: d.aIsaType,
      bondSeparated: d.aBondSeparated,
      card: d.aCard, cash: 0, pensionSavings: d.aPension, irpSavings: d.aIrp, yellowUmbrella: d.aYellow, SME: false,
      housingSubscription: d.aHousingSubscription, housingLoanRepay: d.aHousingLoanRepay, ventureInvestment: d.aVentureInvestment,
      isHouseholder: d.aIsHouseholder, spouseHousingSubscription: d.bHousingSubscription,
      medicalExpense: d.aMedical
    };
    const personBOptData = {
      totalSalary: d.bSalary,
      businessRevenue: d.bBusinessRevenue,
      businessExpense: d.bBusinessExpense,
      pensionIncome: d.bPensionIncome,
      otherRevenue: d.bOtherRevenue,
      otherExpense: d.bOtherExpense,
      financialGeneral: d.bFinancialGen,
      financialOverseas: d.bFinancialOverseas,
      isaIncome: d.bIsaIncome,
      isaType: d.bIsaType,
      bondSeparated: d.bBondSeparated,
      card: d.bCard, cash: 0, pensionSavings: d.bPension, irpSavings: d.bIrp, yellowUmbrella: d.bYellow, SME: false,
      housingSubscription: d.bHousingSubscription, housingLoanRepay: d.bHousingLoanRepay, ventureInvestment: d.bVentureInvestment,
      isHouseholder: false, spouseHousingSubscription: d.aHousingSubscription,
      medicalExpense: d.bMedical
    };
    const optResult = TaxOptimizer.optimizeCoupleYearEnd({ personA: personAOptData, personB: personBOptData, dependents });
    const best = optResult.best;

    renderDeductionAssigner(d, dependents, best);

    let activeAssignment = best;

    if (isCustomDeductionApplied && currentCustomAssignment) {
      const aDeps = [];
      const bDeps = [];
      let aCardSum = personAOptData.card;
      let bCardSum = personBOptData.card;
      let aMedicalSum = personAOptData.medicalExpense || 0;
      let bMedicalSum = personBOptData.medicalExpense || 0;
      let aEduSum = 0;
      let bEduSum = 0;
      let aChildCount = 0;
      let bChildCount = 0;
      let aSenior = false, bSenior = false;
      let aDisabled = false, bDisabled = false;
      let aBirth = false, bBirth = false;

      dependents.forEach(dep => {
        const target = currentCustomAssignment.deps[dep.name] || 'a';
        if (target === 'b') {
          bDeps.push(dep);
          bCardSum += dep.card;
          bMedicalSum += dep.medical;
          bEduSum += dep.edu;
          if (dep.relation === 'child') bChildCount++;
          if (dep.senior) bSenior = true;
          if (dep.disabled) bDisabled = true;
          if (dep.birth) bBirth = true;
        } else {
          aDeps.push(dep);
          aCardSum += dep.card;
          aMedicalSum += dep.medical;
          aEduSum += dep.edu;
          if (dep.relation === 'child') aChildCount++;
          if (dep.senior) aSenior = true;
          if (dep.disabled) aDisabled = true;
          if (dep.birth) aBirth = true;
        }
      });

      const medTarget = currentCustomAssignment.medical;
      const totalMedical = aMedicalSum + bMedicalSum;
      const customMed = {
        aMed: medTarget === 'a' ? totalMedical : 0,
        bMed: medTarget === 'b' ? totalMedical : 0
      };

      const customAResult = TaxCalculator.calculateYearEndTax({
        ...personAOptData,
        dependents: aDeps.length,
        cardUsage: aCardSum,
        medicalExpense: customMed.aMed,
        educationExpense: aEduSum,
        childrenCount: aChildCount,
        hasSeniorDependent: aSenior,
        hasDisabledDependent: aDisabled,
        hasBirthOrAdoption: aBirth,
        birthOrder: 1
      });

      const customBResult = TaxCalculator.calculateYearEndTax({
        ...personBOptData,
        dependents: bDeps.length,
        cardUsage: bCardSum,
        medicalExpense: customMed.bMed,
        educationExpense: bEduSum,
        childrenCount: bChildCount,
        hasSeniorDependent: bSenior,
        hasDisabledDependent: bDisabled,
        hasBirthOrAdoption: bBirth,
        birthOrder: 1
      });

      activeAssignment = {
        combinationIndex: -1,
        medicalTarget: medTarget,
        aDeps: aDeps.map(d => d.name),
        bDeps: bDeps.map(d => d.name),
        aTax: customAResult.totalTax,
        bTax: customBResult.totalTax,
        totalTax: customAResult.totalTax + customBResult.totalTax,
        aResult: customAResult,
        bResult: customBResult
      };

      document.getElementById("res-couple-ye-desc").innerHTML = [
        "<div style='background:rgba(255,217,61,0.06); padding:8px 12px; border-radius:6px; border:1px solid rgba(255,217,61,0.2); margin-bottom:10px; font-size:0.78rem; color:var(--accent-gold);'>⚠️ <strong>사용자 지정 배정</strong>이 적용된 상태입니다.</div>",
        "배우자 A 배정 부양가족: <strong>[" + (activeAssignment.aDeps.join(", ") || "없음") + "]</strong><br>",
        "배우자 B 배정 부양가족: <strong>[" + (activeAssignment.bDeps.join(", ") || "없음") + "]</strong><br>",
        "사용자 지정 시 부부 합산 세액: <strong style='color:var(--accent-secondary); font-size:1.05rem;'>" + activeAssignment.totalTax.toLocaleString() + " 원</strong><br>",
        "<span style='font-size:0.8rem; opacity:0.8;'>* 의료비 공제는 <strong>" + (activeAssignment.medicalTarget === "a" ? "배우자 A" : "배우자 B") + "</strong> 밑으로 청구됩니다.</span>"
      ].join("");

      renderSpouseResults("a", activeAssignment.aResult);
      renderSpouseResults("b", activeAssignment.bResult);

      const worstTax = Math.max(optResult.allATax, optResult.allBTax);
      const customTax = activeAssignment.totalTax;
      const savings = Math.max(0, worstTax - customTax);
      document.getElementById("comp-worst-val").textContent = worstTax.toLocaleString() + " 원";
      document.getElementById("comp-opt-val").textContent = customTax.toLocaleString() + " 원";
      document.getElementById("comp-savings-val").textContent = savings.toLocaleString() + " 원";
      if (worstTax > 0) {
        document.getElementById("comp-worst-bar").style.width = "100%";
        document.getElementById("comp-opt-bar").style.width = Math.max(5, Math.min(100, Math.round((customTax / worstTax) * 100))) + "%";
      }
    } else {
      if (best) {
        document.getElementById("res-couple-ye-desc").innerHTML = [
          "배우자 A 배정 부양가족: <strong>[" + (best.aDeps.join(", ") || "없음") + "]</strong><br>",
          "배우자 B 배정 부양가족: <strong>[" + (best.bDeps.join(", ") || "없음") + "]</strong><br>",
          "최적 배정 시 부부 합산 세액: <strong style='color:var(--accent-secondary); font-size:1.05rem;'>" + best.totalTax.toLocaleString() + " 원</strong> (단독 몰아주기 대비 <strong style='color:var(--accent-secondary);'>약 " + optResult.savings.toLocaleString() + " 원 절약</strong>)<br>",
          "<span style='font-size:0.8rem; opacity:0.8;'>* 의료비 공제는 <strong>" + (best.medicalTarget === "a" ? "배우자 A" : "배우자 B") + "</strong> 밑으로 수렴하는 것이 절세에 최적입니다.</span>"
        ].join("");
        renderSpouseResults("a", best.aResult);
        renderSpouseResults("b", best.bResult);
        const worstTax = Math.max(optResult.allATax, optResult.allBTax);
        const bestTax = best.totalTax;
        const savings = Math.max(0, worstTax - bestTax);
        document.getElementById("comp-worst-val").textContent = worstTax.toLocaleString() + " 원";
        document.getElementById("comp-opt-val").textContent = bestTax.toLocaleString() + " 원";
        document.getElementById("comp-savings-val").textContent = savings.toLocaleString() + " 원";
        if (worstTax > 0) {
          document.getElementById("comp-worst-bar").style.width = "100%";
          document.getElementById("comp-opt-bar").style.width = Math.max(5, Math.min(100, Math.round((bestTax / worstTax) * 100))) + "%";
        } else {
          document.getElementById("comp-worst-bar").style.width = "0%";
          document.getElementById("comp-opt-bar").style.width = "0%";
        }
      }
    }
    return { optResult, best: activeAssignment };
  }

  function renderAdviceSection(d, aResult) {
    const incomeAdvice = TaxAdvisor.getIncomeTaxAdvice({
      totalIncome: d.aSalary, expense: d.aBusinessExpense, incomeType: "integrated",
      yellowUmbrella: d.aYellow, pensionSavings: d.aPension, financialGeneral: d.aFinancialGen,
      financialOverseas: d.aFinancialOverseas, isaIncome: d.aIsaIncome, isaType: d.aIsaType, bondSeparated: d.aBondSeparated, ventureInvestment: d.aVentureInvestment
    }, aResult);
    const yearEndAdvice = TaxAdvisor.getYearEndAdvice({
      totalSalary: d.aSalary, pensionSavings: d.aPension, irpSavings: 0,
      monthlyRent: 0, studentLoanRepay: 0, localDonation: 0, ventureInvestment: d.aVentureInvestment
    }, { finalTax: aResult.totalTax });
    renderAdvice("income-advice-list", [...incomeAdvice, ...yearEndAdvice], (id, val) => {
      let targetElement = null;
      let targetTab = "profile"; // Default target tab

      if (id === "income_yellow_umbrella") { setAndFormatVal("inc-a-yellow", val); targetElement = document.getElementById("inc-a-yellow"); }
      else if (id === "income_pension") { setAndFormatVal("inc-a-pension", val); targetElement = document.getElementById("inc-a-pension"); }
      else if (id === "income_venture_investment") { setAndFormatVal("inc-a-venture", val); targetElement = document.getElementById("inc-a-venture"); }
      else if (id === "income_isa_switch") { 
        setAndFormatVal("inc-a-isa", val); 
        setAndFormatVal("inc-a-financial-gen", Math.max(0, d.aFinancialGen - val)); 
        targetElement = document.getElementById("inc-a-isa"); 
      }
      else if (id === "income_financial_split") {
        targetTab = "capital";
        const optGsType = document.getElementById("opt-gs-type");
        if (optGsType) optGsType.value = "stock";
        setAndFormatVal("opt-gs-current", val * 25);
        setAndFormatVal("opt-gs-purchase", val * 15);
        targetElement = document.getElementById("opt-gs-type");
      } 
      else if (id === "yearend_venture_invest") { setAndFormatVal("inc-a-venture", val); targetElement = document.getElementById("inc-a-venture"); }
      else if (id === "yearend_student_loan") {
        const el = document.querySelector("#inc-couple-ye-people .opt-dep-student-loan");
        if (el) { setAndFormatVal(el, val); targetElement = el; }
      }

      // Switch to the appropriate tab
      const tabBtn = document.querySelector(`.tab-btn[data-tab="${targetTab}"]`);
      if (tabBtn) tabBtn.click();
      
      // Expand advanced fields wrapper if the target element is inside one
      if (targetElement) {
        const wrapper = targetElement.closest('.advanced-fields-wrapper');
        if (wrapper && wrapper.style.display === 'none') {
          wrapper.style.display = 'block';
          const toggleBtn = wrapper.previousElementSibling;
          if (toggleBtn && toggleBtn.classList.contains('btn-toggle-advanced')) {
            toggleBtn.innerHTML = '➖ 사업/금융/기타 소득 및 추가 공제 접기 ▲';
          }
        }
        targetElement.scrollIntoView({ behavior: "smooth", block: "center" });
        targetElement.focus();
        
        // Add a brief highlight effect
        targetElement.style.transition = 'background-color 0.5s ease';
        targetElement.style.backgroundColor = 'rgba(0, 212, 170, 0.3)';
        setTimeout(() => {
          targetElement.style.backgroundColor = '';
        }, 1500);
      }
    });
  }

  function renderCardNavigation(d) {
    const isSpouseBEnabled = document.getElementById('enable-spouse-b')?.checked;
    
    const aMix = TaxCalculator.calculateCardOptimalMix({
      totalSalary: d.aSalary,
      cardUsage: d.aCard,
      cashUsage: 0,
      traditionalMarket: 0,
      publicTransit: 0,
      bookPerformance: 0
    });
    
    let html = `
      <div style="margin-bottom: 12px; padding: 10px; background: rgba(56,189,248,0.06); border-radius: 8px;">
        <h5 style="margin: 0 0 6px 0; color: var(--accent-primary); font-size: 0.88rem;">👤 배우자 A 카드 소비 최적화 가이드</h5>
        <div>문턱(25%): <strong>${aMix.threshold.toLocaleString()}원</strong> | 현재 사용액: <strong>${aMix.totalUsage.toLocaleString()}원</strong></div>
        <div style="margin-top: 4px; font-size: 0.8rem; line-height: 1.4;">
    `;
    
    if (aMix.remainingToThreshold > 0) {
      html += `🚩 배우자 A 카드 사용액이 문턱까지 <strong>${aMix.remainingToThreshold.toLocaleString()}원</strong> 부족합니다. 이 금액만큼은 혜택이 많은 <strong>신용카드</strong>를 우선 사용하세요.`;
    } else if (!aMix.isLimitReached) {
      html += `✅ 배우자 A 카드공제 문턱 달성! 남은 한도(${aMix.limit.toLocaleString()}원)를 채우기 위해 <strong>체크카드/현금</strong>으로 <strong>${aMix.additionalCashNeeded.toLocaleString()}원</strong>을 더 사용하시는 것이 유리합니다 (공제율 30% 적용).`;
    } else {
      html += `🎉 배우자 A 카드공제 한도 도달! 기본 공제 한도(<strong>${aMix.limit.toLocaleString()}원</strong>)에 도달했습니다. 추가 한도(전통시장, 대중교통 등)를 적극 활용하세요.`;
    }
    html += `</div></div>`;
    
    if (isSpouseBEnabled) {
      const bMix = TaxCalculator.calculateCardOptimalMix({
        totalSalary: d.bSalary,
        cardUsage: d.bCard,
        cashUsage: 0,
        traditionalMarket: 0,
        publicTransit: 0,
        bookPerformance: 0
      });
      html += `
        <div style="padding: 10px; background: rgba(0, 212, 170, 0.06); border-radius: 8px;">
          <h5 style="margin: 0 0 6px 0; color: var(--accent-secondary); font-size: 0.88rem;">👤 배우자 B 카드 소비 최적화 가이드</h5>
          <div>문턱(25%): <strong>${bMix.threshold.toLocaleString()}원</strong> | 현재 사용액: <strong>${bMix.totalUsage.toLocaleString()}원</strong></div>
          <div style="margin-top: 4px; font-size: 0.8rem; line-height: 1.4;">
      `;
      if (bMix.remainingToThreshold > 0) {
        html += `🚩 배우자 B 카드 사용액이 문턱까지 <strong>${bMix.remainingToThreshold.toLocaleString()}원</strong> 부족합니다. 이 금액만큼은 혜택이 많은 <strong>신용카드</strong>를 우선 사용하세요.`;
      } else if (!bMix.isLimitReached) {
        html += `✅ 배우자 B 카드공제 문턱 달성! 남은 한도(${bMix.limit.toLocaleString()}원)를 채우기 위해 <strong>체크카드/현금</strong>으로 <strong>${bMix.additionalCashNeeded.toLocaleString()}원</strong>을 더 사용하시는 것이 유리합니다 (공제율 30% 적용).`;
      } else {
        html += `🎉 배우자 B 카드공제 한도 도달! 기본 공제 한도(<strong>${bMix.limit.toLocaleString()}원</strong>)에 도달했습니다. 추가 한도(전통시장, 대중교통 등)를 적극 활용하세요.`;
      }
      html += `</div></div>`;
    }
    
    document.getElementById("res-card-nav-content").innerHTML = html;
    showAccordionSection("acc-card-nav");
  }

  function renderMedicalComparison(d, dependents) {
    const isSpouseBEnabled = document.getElementById('enable-spouse-b')?.checked;
    if (!isSpouseBEnabled) {
      hideAccordionSection("acc-medical");
      return;
    }
    const totalMedical = dependents.reduce((s, dep) => s + dep.medical, 0) + (d.aMedical || 0) + (d.bMedical || 0);
    if (totalMedical <= 0) {
      hideAccordionSection("acc-medical");
      return;
    }
    const aMed = Math.max(0, Math.floor((totalMedical - Math.floor(d.aSalary * 0.03)) * 0.15));
    const bMed = Math.max(0, Math.floor((totalMedical - Math.floor(d.bSalary * 0.03)) * 0.15));
    const maxMed = Math.max(aMed, bMed, 1);
    document.getElementById("med-bar-a").style.width = (aMed / maxMed * 100) + "%";
    document.getElementById("med-bar-b").style.width = (bMed / maxMed * 100) + "%";
    document.getElementById("med-tax-a").textContent = aMed.toLocaleString() + " 원";
    document.getElementById("med-tax-b").textContent = bMed.toLocaleString() + " 원";
    document.getElementById("res-medical-desc").textContent = aMed > bMed ? "배우자 A 청구 유리" : bMed > aMed ? "배우자 B 청구 유리" : "차이 없음";
    showAccordionSection("acc-medical");
  }

  function renderFamilySummary(d, aResult, bResult, best, optResult, dependents) {
    const aDed = aResult.salaryDeduction || aResult.expense || 0;
    const bDed = bResult.salaryDeduction || bResult.expense || 0;
    const totalTax = best ? best.totalTax : aResult.totalTax + bResult.totalTax;
    const savings = best ? optResult.savings : 0;
    document.getElementById("res-family-summary-content").innerHTML =
      '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center; margin:8px 0;">' +
      '<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">' +
      '<div style="font-size:0.7rem; opacity:0.7;">부부 합산 총급여</div>' +
      '<div style="font-weight:bold; font-size:1rem;">' + (d.aSalary + d.bSalary).toLocaleString() + ' 원</div></div>' +
      '<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">' +
      '<div style="font-size:0.7rem; opacity:0.7;">최적화 합산 세액</div>' +
      '<div style="font-weight:bold; font-size:1rem; color:var(--accent-secondary);">' + totalTax.toLocaleString() + ' 원</div></div>' +
      '<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">' +
      '<div style="font-size:0.7rem; opacity:0.7;">예상 절감액</div>' +
      '<div style="font-weight:bold; font-size:1rem; color:var(--accent-gold);">' + savings.toLocaleString() + ' 원</div></div></div>' +
      '<div style="font-size:0.78rem; opacity:0.7; line-height:1.5;">부양가족 ' + dependents.length + '명 · 배우자 A 세율 ' + aResult.bracketRate + '% · 배우자 B 세율 ' + bResult.bracketRate + '%<br>' +
      '소득공제 합계: ' + (aDed + bDed).toLocaleString() + '원 · 결정세액 합계: ' + (best ? best.aResult.totalTax + best.bResult.totalTax : aResult.totalTax + bResult.totalTax).toLocaleString() + '원</div>';
    showAccordionSection("acc-family");
  }

  // 1. 종합소득세 & 연말정산 원스톱 대통합 계산
  const btnCalcIncomeIntegrated = document.getElementById("btn-calc-income-integrated");
  btnCalcIncomeIntegrated.addEventListener("click", () => {
    const d = parseIncomeInputs();
    if (!validateIncomeInputs(d)) return;
    const dependents = collectDependents();
    if (!dependents) return;

    showCalcStatus(true);
    toggleEmptyState(false);

    const aResult = TaxCalculator.calculateComprehensiveIncome(buildSpouseCalcOpts(d, "a"));
    const bResult = TaxCalculator.calculateComprehensiveIncome(buildSpouseCalcOpts(d, "b"));

    renderSpouseResults("a", aResult);
    renderSpouseResults("b", bResult);
    renderFinancialDetails("a", aResult);
    renderFinancialDetails("b", bResult);

    const { optResult, best } = runOptimizerAndRender(d, dependents);

    renderAdviceSection(d, aResult);
    renderCardNavigation(d);
    renderMedicalComparison(d, dependents);
    renderFamilySummary(d, aResult, bResult, best, optResult, dependents);

    showCalcStatus(false);
    updateFloatingBar(best, d);
  });

  // Custom Deduction Assigner Click Handlers
  const btnApplyCustom = document.getElementById("btn-apply-custom-assignment");
  if (btnApplyCustom) {
    btnApplyCustom.addEventListener("click", () => {
      const customDepAssignSelects = document.querySelectorAll(".custom-dep-assign");
      const customDeps = {};
      customDepAssignSelects.forEach(select => {
        customDeps[select.dataset.depName] = select.value;
      });
      const customMedicalSelect = document.getElementById("custom-medical-assign");
      const customMedical = customMedicalSelect ? customMedicalSelect.value : 'a';

      currentCustomAssignment = {
        deps: customDeps,
        medical: customMedical
      };
      isCustomDeductionApplied = true;

      // Re-trigger calculation
      const d = parseIncomeInputs();
      if (!validateIncomeInputs(d)) return;
      const dependents = collectDependents();
      if (!dependents) return;

      showCalcStatus(true);
      const aResult = TaxCalculator.calculateComprehensiveIncome(buildSpouseCalcOpts(d, "a"));
      const bResult = TaxCalculator.calculateComprehensiveIncome(buildSpouseCalcOpts(d, "b"));
      const { optResult, best } = runOptimizerAndRender(d, dependents);
      renderFamilySummary(d, aResult, bResult, best, optResult, dependents);
      showCalcStatus(false);
      updateFloatingBar(best, d);
    });
  }

  const btnApplyOptimal = document.getElementById("btn-apply-optimal-assignment");
  if (btnApplyOptimal) {
    btnApplyOptimal.addEventListener("click", () => {
      isCustomDeductionApplied = false;
      currentCustomAssignment = null;

      // Re-trigger calculation to default optimal
      btnCalcIncomeIntegrated.click();
    });
  }

  function updateFloatingBar(best, d) {
    const bar = document.getElementById('floating-result-bar');
    const amtEl = document.getElementById('floating-bar-amount');
    if (!bar || !amtEl) return;
    const totalTax = best ? best.totalTax : 0;
    if (totalTax > 0) {
      amtEl.textContent = totalTax.toLocaleString() + ' 원';
      bar.classList.add('active');
      document.body.classList.add('floating-bar-visible');
    } else {
      bar.classList.remove('active');
      document.body.classList.remove('floating-bar-visible');
    }
  }

  // 🆕 P0: 플로팅 바 "결과 보기" → 스크롤
  document.getElementById('floating-bar-btn').addEventListener('click', () => {
    const resultCard = document.getElementById('inc-result-card');
    if (resultCard) {
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // 📤 리포트 복사하기
  document.getElementById('btn-share-report').addEventListener('click', () => {
    const summaryText = document.getElementById('res-family-summary-content').innerText;
    const navText = document.getElementById('res-card-nav-content').innerText;
    const totalText = `[TAX NAVI 가족 절세 리포트]\n\n${summaryText}\n\n[소비 네비게이션]\n${navText}\n\n👉 https://kthur.github.io/tax_calculator/`;
    navigator.clipboard.writeText(totalText).then(() => {
      showToast('✅ 리포트가 클립보드에 복사되었습니다');
    }).catch(() => { showToast('❌ 복사 실패. 직접 복사해 주세요.', 3000); });
  });

  // 📅 10년 주기 증여 타임라인
  document.getElementById('btn-calc-gift-timeline').addEventListener('click', () => {
    const childName = document.getElementById('gift-child-name').value || '자녀';
    const childAge = parseInt(document.getElementById('gift-child-age').value) || 0;
    const timeline = [];
    let age = childAge;
    const limits = [
      { maxAge: 19, limit: 20000000, label: '미성년자 증여한도' },
      { maxAge: Infinity, limit: 50000000, label: '성인 증여한도' }
    ];
    while (age < 60) {
      const bracket = limits.find(l => age < l.maxAge) || limits[1];
      timeline.push({ age, limit: bracket.limit, label: bracket.label });
      age += 10;
    }
    let html = `<strong>${childName}</strong> 님 비과세 증여 플랜 (10년 주기 리셋)<br><br>`;
    timeline.forEach((item, i) => {
      html += `<span style="display:inline-block; width:20px; height:20px; border-radius:50%; background:var(--accent-secondary); text-align:center; line-height:20px; font-size:0.7rem; color:#0f172a; margin-right:6px;">${i + 1}</span>`;
      html += `<strong>만 ${item.age}세</strong> → ${item.limit.toLocaleString()}원 ${item.label} <br>`;
    });
    html += `<br>💰 <strong>총 비과세 증여 가능액: ${timeline.reduce((s, t) => s + t.limit, 0).toLocaleString()}원</strong>`;
    document.getElementById('gift-timeline-content').innerHTML = html;
    document.getElementById('gift-timeline-result').style.display = 'block';
  });

  // 🧾 증여세 실계산
  document.getElementById('btn-calc-gift-tax').addEventListener('click', () => {
    const giftAmount = parseVal('gift-amount');
    const recipient = document.getElementById('gift-recipient').value;
    const giftPast10Years = parseVal('gift-past');
    const assetType = document.getElementById('gift-asset-type').value;
    const result = TaxCalculator.calculateGiftTax({ giftAmount, recipient, giftPast10Years });
    document.getElementById('gift-tax-result').style.display = 'block';
    let html = `
      <div>증여 금액: <strong>${giftAmount.toLocaleString()} 원</strong></div>
      <div>과거 10년 증여: ${giftPast10Years.toLocaleString()} 원</div>
      <div>10년 누계: <strong>${result.cumulative.toLocaleString()} 원</strong></div>
      <div>면제 한도: ${result.exemption.toLocaleString()} 원</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>과세표준: <strong>${result.taxableGift.toLocaleString()} 원</strong></div>
      <div>세율: <strong>${result.rate}%</strong></div>
      <div style="font-size:0.9rem;font-weight:bold;margin-top:6px;color:var(--accent-primary);">증여세: ${result.tax.toLocaleString()} 원</div>
      <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-warning);">지방교육세: ${result.localTax.toLocaleString()} 원</div>
      <div style="font-size:1rem;font-weight:bold;margin-top:6px;color:var(--accent-secondary);">💵 총 납부세액: ${result.totalTax.toLocaleString()} 원</div>
    `;
    if (result.totalTax === 0) {
      html += `<div style="margin-top:8px;padding:6px;background:rgba(0,212,170,0.1);border-radius:6px;font-weight:bold;">✅ 비과세 증여 가능!</div>`;
    }
    if (assetType === 'etf' && recipient === 'adult_child') {
      html += `<div style="margin-top:8px;padding:6px;background:rgba(56,189,248,0.08);border-radius:6px;font-size:0.78rem;">
        💡 미국 ETF 증여 시: 수증자가 증여받은 ETF를 매도할 때 <strong>해외주식 양도소득세(22%)</strong>가 발생할 수 있습니다.
        증여 당시 평가액을 취득가액으로 인정받아 양도차익을 줄일 수 있어 현금 증여 대비 절세 효과가 있습니다.
      </div>`;
    }
    document.getElementById('gift-tax-content').innerHTML = html;
  });

  // 💰 연금저축/IRP 세액공제 최적화
  document.getElementById('btn-calc-pension-opt').addEventListener('click', function () {
    var target = document.getElementById('pension-target').value;
    var salary = parseVal('pension-salary');
    var pension = parseVal('pension-amount');
    var irp = parseVal('pension-irp-amount');
    var result = TaxCalculator.calculatePensionOptimization({
      totalSalary: salary,
      currentPension: pension,
      currentIrp: irp
    });
    document.getElementById('pension-opt-result').style.display = 'block';
    var statusIcon = result.reachedLimit ? '✅' : '📌';
    var statusText = result.reachedLimit ? '연250만 한도 도달!' : '추가 납입 가능';
    var recommendationHtml = '';
    if (!result.reachedLimit) {
      recommendationHtml = '<div style="margin-top:8px;padding:10px;background:rgba(0,212,170,0.12);border-radius:8px;border-left:3px solid var(--accent-secondary);">' +
        '💡 <strong>IRP 계좌</strong>를 개설(또는 추가 납입)하여 <strong>' + result.remaining.toLocaleString() + '원</strong>을 더 채우면<br>' +
        '연말정산 때 <strong style="color:var(--accent-secondary);font-size:1rem;">' + result.additionalCredit.toLocaleString() + '원</strong>을 추가 환급받습니다!' +
        '</div>';
    }
    document.getElementById('pension-opt-content').innerHTML =
      '<div>' + statusIcon + ' 현재 합계: <strong>' + result.currentTotal.toLocaleString() + '원</strong> / ' + result.maxLimit.toLocaleString() + '원 (' + statusText + ')</div>' +
      '<div>연금저축: ' + result.currentPension.toLocaleString() + '원 | IRP: ' + result.currentIrp.toLocaleString() + '원</div>' +
      '<div>세액공제율: <strong>' + result.rate.toFixed(1) + '%</strong> (총급여 ' + salary.toLocaleString() + '원 기준)</div>' +
      '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">' +
      '<div>현재 세액공제액: ' + result.currentCredit.toLocaleString() + '원</div>' +
      '<div style="font-weight:bold;color:var(--accent-secondary);font-size:0.95rem;">최대 세액공제액: ' + result.potentialCredit.toLocaleString() + '원</div>' +
      recommendationHtml;
  });

  // 💳 신용카드 vs 체크카드 황금비율 계산기
  document.getElementById('btn-calc-card-ratio').addEventListener('click', function () {
    var salary = parseVal('card-salary');
    var card = parseVal('card-usage-amount');
    var cash = parseVal('card-cash-amount');
    var traditional = parseVal('card-traditional');
    var transit = parseVal('card-transit');
    var book = parseVal('card-book');
    var target = document.getElementById('card-target').value;
    var result = TaxCalculator.calculateCardOptimalMix({
      totalSalary: salary,
      cardUsage: card,
      cashUsage: cash,
      traditionalMarket: traditional,
      publicTransit: transit,
      bookPerformance: book
    });
    document.getElementById('card-ratio-result').style.display = 'block';
    var thresholdPct = Math.round(result.threshold / salary * 100);
    var progressToThreshold = Math.min(100, Math.round(result.totalUsage / result.threshold * 100));
    var progressBar = '<div style="background:rgba(255,255,255,0.06);height:8px;border-radius:4px;overflow:hidden;margin:6px 0;">' +
      '<div style="background:var(--accent-info);width:' + progressToThreshold + '%;height:100%;transition:width 0.3s;"></div></div>';
    var html = '<div>📊 총급여: <strong>' + salary.toLocaleString() + '원</strong></div>' +
      '<div>공제 문턱(' + thresholdPct + '%): <strong>' + result.threshold.toLocaleString() + '원</strong>' +
      (result.remainingToThreshold > 0 ? ' (🚩 <strong>' + result.remainingToThreshold.toLocaleString() + '원</strong> 부족)' : '') + '</div>' +
      progressBar +
      '<div>신용카드: ' + card.toLocaleString() + '원 | 체크/현금: ' + cash.toLocaleString() + '원</div>' +
      '<div>합계 사용액: <strong>' + result.totalUsage.toLocaleString() + '원</strong></div>';
    if (result.overThreshold) {
      html += '<div>공제 대상 초과분: <strong>' + (result.totalUsage - result.threshold).toLocaleString() + '원</strong></div>';
      html += '<div>기본 공제 예상액: <strong>' + result.baseDeduction.toLocaleString() + '원</strong> / 한도 ' + result.limit.toLocaleString() + '원</div>';
    }
    // 추가 공제 내역
    if (result.tradDeduction > 0 || result.transitDeduction > 0 || result.bookDeduction > 0) {
      html += '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">';
      html += '<div style="font-size:0.8rem;color:var(--accent-info);font-weight:bold;">➕ 추가 공제 내역 (별도 한도)</div>';
      if (result.tradDeduction > 0) html += '<div>🏪 전통시장(30%): <strong>' + result.tradDeduction.toLocaleString() + '원</strong></div>';
      if (result.transitDeduction > 0) html += '<div>🚌 대중교통(40%): <strong>' + result.transitDeduction.toLocaleString() + '원</strong></div>';
      if (result.bookDeduction > 0) html += '<div>📚 도서·공연(30%): <strong>' + result.bookDeduction.toLocaleString() + '원</strong></div>';
    }
    var totalDed = result.baseDeduction + result.tradDeduction + result.transitDeduction + result.bookDeduction;
    html += '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">' +
      '<div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">💰 총 카드 공제액: <strong>' + totalDed.toLocaleString() + '원</strong></div>';
    html += '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:8px 0;">';
    // 추천 메시지
    if (result.remainingToThreshold > 0) {
      html += '<div style="padding:8px;background:rgba(56,189,248,0.12);border-radius:6px;">' +
        '📌 현재 총급여의 25%인 <strong>' + result.threshold.toLocaleString() + '원</strong>까지,<br>' +
        '앞으로 <strong>' + result.remainingToThreshold.toLocaleString() + '원</strong>만 <strong>신용카드</strong>(포인트 혜택)로 더 쓰세요.<br>' +
        '문턱을 넘은 후에는 <strong>체크카드/현금영수증</strong>으로 전환해야 30% 공제율을 받을 수 있습니다.<br>' +
        '<span style="font-size:0.75rem;opacity:0.7;">문턱 이하 구간은 카드 종류와 무관하게 세액공제 혜택이 없으므로, 신용카드 포인트를 받는 것이 유리합니다.</span></div>';
    } else if (!result.isLimitReached) {
      html += '<div style="padding:8px;background:rgba(0,212,170,0.12);border-radius:6px;border-left:3px solid var(--accent-secondary);">' +
        '✅ 문턱(25%) 도달! 앞으로 <strong>체크카드/현금</strong>으로 <strong>' + result.additionalCashNeeded.toLocaleString() + '원</strong>을 더 사용하면<br>' +
        '최대 한도 ' + result.limit.toLocaleString() + '원까지 추가 공제 가능합니다.<br>' +
        '<span style="font-size:0.75rem;opacity:0.7;">신용카드는 15% 공제율이므로, 초과분은 체크카드(30%)가 2배 효과적입니다.</span></div>';
    } else {
      html += '<div style="padding:8px;background:rgba(255,217,61,0.1);border-radius:6px;">' +
        '✅ 기본 공제 한도(<strong>' + result.limit.toLocaleString() + '원</strong>)에 이미 도달했습니다.<br>' +
        '<span style="font-size:0.75rem;opacity:0.7;">추가로 전통시장(30%), 대중교통(40%), 도서공연(30%)도 별도 한도 내에서 공제 가능합니다.</span></div>';
    }
    // 추가 공제 활용 팁
    if (result.tradDeduction < result.addLimitTraditional && result.tradDeduction < Math.floor(traditional * 0.3)) {
      html += '<div style="margin-top:6px;padding:6px;background:rgba(56,189,248,0.06);border-radius:6px;font-size:0.75rem;">' +
        '💡 전통시장 추가 사용 시 최대 ' + (result.addLimitTraditional - result.tradDeduction).toLocaleString() + '원까지 30% 추가 공제 가능</div>';
    }
    document.getElementById('card-ratio-content').innerHTML = html;
  });

  // 🧮 N잡러 경비율 비교
  document.getElementById('btn-calc-expense-ratio').addEventListener('click', () => {
    const bizCode = document.getElementById('expense-biz-code').value;
    const revenue = parseVal('expense-revenue');
    const declaredType = document.getElementById('expense-declared-type').value;
    const result = TaxCalculator.compareExpenseRatios(bizCode, revenue, declaredType);
    document.getElementById('expense-ratio-result').style.display = 'block';
    var rec = result.recommended === 'simple' ? '단순경비율 (추계신고)' : '기준경비율 (장부 작성)';
    var recColor = result.recommended === declaredType ? 'var(--accent-secondary)' : 'var(--accent-warning)';
    document.getElementById('expense-ratio-content').innerHTML = `
      <div>업종: <strong>${result.bizName}</strong></div>
      <div style="margin-top:6px;"><strong>단순경비율</strong>: ${(result.simpleRate * 100).toFixed(1)}% → 경비 ${result.simpleExpense.toLocaleString()}원</div>
      <div><strong>기준경비율</strong>: ${(result.standardRate * 100).toFixed(1)}% → 경비 ${result.standardExpense.toLocaleString()}원</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-weight:bold;color:${recColor};">🏆 추천: <strong>${rec}</strong></div>
      <div style="font-size:0.78rem;opacity:0.7;margin-top:4px;">
        ${result.isSimpleBetter ? '단순경비율 적용 시 경비가 더 많이 인정됩니다. 별도 장부 미작성 가능.' : '기준경비율(장부 작성) 시 추가 경비 인정으로 절세 효과가 있습니다.'}
        (세액 차이는 과세표준 구간에 따라 달라집니다)
      </div>
    `;
  });

  // 🏥 건강보험료 시뮬레이터
  const hiTypeEl = document.getElementById('hi-type');
  if (hiTypeEl) {
    hiTypeEl.addEventListener('change', function () {
      const isEmployee = this.value === 'employee';
      const empFields = document.getElementById('hi-employee-fields');
      const regFields = document.getElementById('hi-regional-fields');
      if (empFields) empFields.style.display = isEmployee ? 'block' : 'none';
      if (regFields) regFields.style.display = isEmployee ? 'none' : 'block';
    });
  }

  // 🛡️ 보장성 보험료 세액공제
  document.getElementById('btn-calc-insurance-credit').addEventListener('click', () => {
    const premium = parseVal('insurance-premium');
    const result = TaxCalculator.calculateInsuranceCredit({ totalPremium: premium });
    document.getElementById('insurance-result').style.display = 'block';
    document.getElementById('insurance-result-content').innerHTML = `
      <div>연간 보험료 납입액: <strong>${result.totalPremium.toLocaleString()} 원</strong></div>
      <div>공제 한도: ${result.limit.toLocaleString()} 원</div>
      <div>공제 대상 금액: <strong>${result.eligibleAmount.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>세액공제율: ${result.creditRate}%</div>
      <div style="font-weight:bold;color:var(--accent-primary);font-size:0.95rem;">세액공제액: <strong>${result.credit.toLocaleString()} 원</strong></div>
      <div style="color:var(--accent-warning);">지방소득세: ${result.localTax.toLocaleString()} 원</div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">💰 총 혜택: <strong>${result.totalBenefit.toLocaleString()} 원</strong></div>
      ${result.isMaxed ? '<div style="margin-top:6px;padding:6px;background:rgba(0,212,170,0.08);border-radius:6px;font-size:0.78rem;">✅ 보험료 한도(100만 원)에 도달했습니다. 추가 납입 시 세액공제 혜택이 없습니다.</div>' : `<div style="margin-top:6px;font-size:0.78rem;opacity:0.7;">📌 한도까지 ${Math.max(0, result.limit - result.totalPremium).toLocaleString()} 원 추가 가능</div>`}
    `;
  });

  // 🏠 월세 세액공제
  document.getElementById('btn-calc-rent-credit').addEventListener('click', () => {
    const totalSalary = parseVal('rent-salary');
    const annualRent = parseVal('rent-amount');
    const result = TaxCalculator.calculateRentCredit({ totalSalary, annualRent });
    document.getElementById('rent-result').style.display = 'block';
    if (!result.isEligible) {
      document.getElementById('rent-result-content').innerHTML = `
        <div style="color:var(--accent-warning);font-weight:bold;">❌ ${result.reason}</div>
      `;
      return;
    }
    document.getElementById('rent-result-content').innerHTML = `
      <div>총급여: ${result.totalSalary.toLocaleString()} 원</div>
      <div>연간 월세 납입액: <strong>${result.annualRent.toLocaleString()} 원</strong></div>
      <div>공제 한도: ${result.limit.toLocaleString()} 원</div>
      <div>공제 대상 금액: <strong>${result.eligibleAmount.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>세액공제율: ${result.creditRate}%${result.totalSalary <= 55000000 ? ' (총급여 5,500만 이하 15%)' : ' (총급여 5,500만 초과 12%)'}</div>
      <div style="font-weight:bold;color:var(--accent-primary);font-size:0.95rem;">세액공제액: <strong>${result.credit.toLocaleString()} 원</strong></div>
      <div style="color:var(--accent-warning);">지방소득세: ${result.localTax.toLocaleString()} 원</div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">💰 총 혜택: <strong>${result.totalBenefit.toLocaleString()} 원</strong></div>
      ${result.isMaxed ? '<div style="margin-top:6px;padding:6px;background:rgba(0,212,170,0.08);border-radius:6px;font-size:0.78rem;">✅ 월세 한도(750만 원)에 도달했습니다.</div>' : ''}
    `;
  });

  // 💝 일반 기부금 세액공제
  document.getElementById('btn-calc-donation-credit').addEventListener('click', () => {
    const totalIncome = parseVal('donation-income');
    const statutoryDonation = parseVal('donation-statutory');
    const designatedDonation = parseVal('donation-designated');
    const religiousDonation = parseVal('donation-religious');
    const result = TaxCalculator.calculateDonationCredit({ totalIncome, statutoryDonation, designatedDonation, religiousDonation });
    document.getElementById('donation-result').style.display = 'block';
    document.getElementById('donation-result-content').innerHTML = `
      <div>연간 총소득: <strong>${result.totalIncome.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>📌 기부 내역</div>
      <div>· 법정기부금: ${result.statutoryDonation.toLocaleString()} 원</div>
      <div>· 지정기부금: ${result.designatedDonation.toLocaleString()} 원</div>
      <div>· 종교단체 기부금: ${result.religiousDonation.toLocaleString()} 원</div>
      <div>· 기부 합계: <strong>${result.totalDonation.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-info);">📋 공제 명세</div>
      <div>· 지정기부금 한도(소득의 30%): ${result.incomeLimit.toLocaleString()} 원</div>
      <div>· 법정기부금 세액공제(100%): <strong>${result.statutoryCredit.toLocaleString()} 원</strong></div>
      <div>· 지정기부금 세액공제(30%): <strong>${result.designatedCredit.toLocaleString()} 원</strong> (대상 ${result.designatedEligible.toLocaleString()}원)</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-weight:bold;color:var(--accent-primary);font-size:0.95rem;">총 세액공제액: <strong>${result.totalCredit.toLocaleString()} 원</strong></div>
      <div style="color:var(--accent-warning);">지방소득세: ${result.localTax.toLocaleString()} 원</div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">💰 총 혜택: <strong>${result.totalBenefit.toLocaleString()} 원</strong></div>
    `;
  });

  // 🏥 건강보험료 계산
  const btnCalcHi = document.getElementById('btn-calc-health-insurance');
  if (btnCalcHi) {
    btnCalcHi.addEventListener('click', () => {
      const isEmployee = (document.getElementById('hi-type')?.value || 'employee') === 'employee';
      let opts = { isEmployee };
      if (isEmployee) {
        opts.earnedIncome = parseVal('hi-earned-income');
        opts.otherIncome = parseVal('hi-other-income');
      } else {
        opts.regionalIncome = parseVal('hi-regional-income');
        opts.regionalPropertyValue = parseVal('hi-regional-property');
      }
      const hi = TaxCalculator.calculateHealthInsurance(opts);
      const hiResult = document.getElementById('hi-result');
      if (hiResult) hiResult.style.display = 'block';
      let html = '';
      if (hi.type === 'employee') {
        html = `
          <div>월평균 근로소득: ${hi.earnedMonthly.toLocaleString()} 원</div>
          <div>직장 건강보험료 (월): <strong>${hi.workedPremium.toLocaleString()} 원</strong></div>
          <div>장기요양보험료 (월): <strong>${hi.longTermCare.toLocaleString()} 원</strong></div>
          ${hi.incomeMonthlyPremium > 0 ? `<div style="color:var(--accent-warning);">⚠️ 소득월액보험료 (월): <strong>${hi.incomeMonthlyPremium.toLocaleString()} 원</strong> (기타소득 2,000만 초과)</div>` : '<div>소득월액보험료: 없음 (기타소득 2,000만 이하)</div>'}
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
          <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-secondary);">월 보험료 합계: ${hi.monthlyPremium.toLocaleString()} 원</div>
          <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-primary);">연 보험료 합계: <strong>${hi.annualPremium.toLocaleString()} 원</strong></div>
        `;
      } else {
        html = `
          <div>소득점수: ${hi.details.incomeScore.toLocaleString()}</div>
          <div>재산점수: ${hi.details.propertyScore.toLocaleString()}</div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
          <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-secondary);">월 보험료 합계: ${hi.monthlyPremium.toLocaleString()} 원</div>
          <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-primary);">연 보험료 합계: <strong>${hi.annualPremium.toLocaleString()} 원</strong></div>
        `;
      }
      const checkDependentEl = document.getElementById('hi-dependent-check');
      const checkDependent = checkDependentEl ? checkDependentEl.checked : false;
      if (checkDependent && isEmployee) {
        const depResult = TaxCalculator.checkDependentStatus({ otherIncome: opts.otherIncome, isWageOnly: true, isPropertyOwner: false });
        html += `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;"><div style="font-weight:bold;">🔍 피부양자 자격: ${depResult.isEligible ? '✅ 유지' : '❌ 상실'}</div><div style="font-size:0.78rem;opacity:0.7;">${depResult.reason}</div>`;
      }
      const hiResultContent = document.getElementById('hi-result-content');
      if (hiResultContent) hiResultContent.innerHTML = html;
    });
  }

  // 📋 표준세액공제
  document.getElementById('btn-calc-standard-credit').addEventListener('click', () => {
    const itemizedTotal = parseVal('standard-itemized');
    const result = TaxCalculator.calculateStandardCredit({ itemizedTotal });
    document.getElementById('standard-result').style.display = 'block';
    document.getElementById('standard-result-content').innerHTML = `
      <div>항목별 세액공제 합계: <strong>${result.itemizedTotal.toLocaleString()} 원</strong></div>
      <div>표준세액공제: <strong>${result.standardCredit.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:0.95rem;font-weight:bold;color:${result.isStandardBetter ? 'var(--accent-secondary)' : 'var(--accent-info)'};">
        ${result.isStandardBetter ? '✅ 표준세액공제(13만 원) 선택!' : 'ℹ️ 항목별 공제 선택 (표준공제보다 ' + result.difference.toLocaleString() + '원 큼)'}
      </div>
      <div style="margin-top:6px;padding:8px;background:rgba(0,212,170,0.06);border-radius:6px;font-size:0.78rem;">
        💡 ${result.recommendation}
      </div>
    `;
  });

  // 🚗 전기차·친환경차 세액공제
  document.getElementById('btn-calc-ecocar').addEventListener('click', () => {
    const carPrice = parseVal('ecocar-price');
    const carType = document.getElementById('ecocar-type').value;
    const result = TaxCalculator.calculateEcoCarCredit({ carPrice, carType });
    document.getElementById('ecocar-result').style.display = 'block';
    document.getElementById('ecocar-result-content').innerHTML = `
      <div>차량 유형: <strong>${result.carTypeLabel}</strong></div>
      <div>차량 가격: ${result.carPrice.toLocaleString()} 원</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-info);">개별소비세 감면: <strong>${result.individualConsumeTax.toLocaleString()} 원</strong></div>
      <div style="color:var(--accent-info);">취득세 감면: <strong>${result.acquisitionTax.toLocaleString()} 원</strong></div>
      <div style="color:var(--accent-warning);">교육세 감면: ${result.eduTax.toLocaleString()} 원</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">💰 총 세제 혜택: <strong>${result.totalBenefit.toLocaleString()} 원</strong></div>
      <div style="margin-top:6px;padding:6px;background:rgba(0,212,170,0.06);border-radius:6px;font-size:0.75rem;">
        📌 2025~2026년 기준 감면 한도 적용. 국고보조금·지방보조금은 별도입니다.
      </div>
    `;
  });

  // 🏠 주택자금 공제
  document.getElementById('btn-calc-housing-fund').addEventListener('click', () => {
    const totalSalary = parseVal('housing-salary');
    const subscriptionAmount = parseVal('housing-sub-amount');
    const jeonseLoanRepay = parseVal('housing-jeonse-repay');
    const mortgageInterest = parseVal('housing-mortgage-interest');
    const result = TaxCalculator.calculateHousingFundDeduction({ totalSalary, subscriptionAmount, jeonseLoanRepay, mortgageInterest });
    document.getElementById('housing-result').style.display = 'block';
    document.getElementById('housing-result-content').innerHTML = `
      <div>총급여: <strong>${result.totalSalary.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>📌 주택청약종합저축</div>
      <div>· 납입액: ${result.subscriptionAmount.toLocaleString()} 원</div>
      ${result.subscriptionLimit > 0 ? `<div>· 공제 한도: ${result.subscriptionLimit.toLocaleString()} 원</div><div>· 소득공제: <strong>${result.subscriptionDeduction.toLocaleString()} 원</strong></div>` : '<div style="color:var(--accent-warning);">· 총급여 7,000만 초과로 공제 불가</div>'}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.04);margin:6px 0;">
      <div>📌 전세자금대출 원리금</div>
      <div>· 상환액: ${result.jeonseLoanRepay.toLocaleString()} 원</div>
      <div>· 소득공제: <strong>${result.jeonseDeduction.toLocaleString()} 원</strong> (한도 ${result.jeonseLimit.toLocaleString()}원)</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.04);margin:6px 0;">
      <div>📌 장기주택저당차입금 이자</div>
      <div>· 이자액: ${result.mortgageInterest.toLocaleString()} 원</div>
      <div>· 소득공제: <strong>${result.mortgageDeduction.toLocaleString()} 원</strong> (한도 ${result.mortgageLimit.toLocaleString()}원)</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:0.95rem;font-weight:bold;color:var(--accent-primary);">총 소득공제액: <strong>${result.totalDeduction.toLocaleString()} 원</strong></div>
      <div style="font-size:0.95rem;font-weight:bold;color:var(--accent-secondary);">💰 예상 절세액: <strong>${result.estimatedTaxSavings.toLocaleString()} 원</strong> (세율 ${(result.taxRate * 100).toFixed(0)}% 적용)</div>
    `;
  });

  // 🧮 개인사업자 종합소득세 간편 계산
  document.getElementById('btn-calc-self-employed-tax').addEventListener('click', () => {
    const totalRevenue = parseVal('se-revenue');
    const bizCode = document.getElementById('se-biz-code').value;
    const declaredType = document.getElementById('se-declared-type').value;
    const otherIncome = parseVal('se-other-income');
    const financialIncome = parseVal('se-financial-income');
    const result = TaxCalculator.calculateSelfEmployedTax({ totalRevenue, bizCode, declaredType, otherIncome, financialIncome });
    document.getElementById('se-result').style.display = 'block';
    document.getElementById('se-result-content').innerHTML = `
      <div>업종: <strong>${result.bizCodeLabel}</strong></div>
      <div>연간 매출: ${result.totalRevenue.toLocaleString()} 원</div>
      <div>경비율: ${(result.expenseRate * 100).toFixed(0)}% (${result.declaredType === 'simple' ? '단순경비율' : '기준경비율'})</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>사업소득: <strong>${result.bizIncome.toLocaleString()} 원</strong> (매출 ${result.totalRevenue.toLocaleString()} × ${((1 - result.expenseRate) * 100).toFixed(0)}%)</div>
      <div>기타소득: ${result.otherIncome.toLocaleString()} 원</div>
      <div>금융소득: ${result.financialIncome.toLocaleString()} 원</div>
      <div>종합소득 합계: <strong>${result.totalIncome.toLocaleString()} 원</strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>근로소득공제: ${result.salaryDeduction.toLocaleString()} 원</div>
      <div>기본공제: ${result.basicDeduction.toLocaleString()} 원</div>
      <div>과세표준: <strong>${result.taxableIncome.toLocaleString()} 원</strong></div>
      <div>세율: ${(result.taxRate * 100).toFixed(0)}%</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:0.9rem;color:var(--accent-primary);">소득세: <strong>${result.incomeTax.toLocaleString()} 원</strong></div>
      <div style="color:var(--accent-warning);">지방소득세: ${result.localTax.toLocaleString()} 원</div>
      <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">💰 총 예상 세액: <strong>${result.totalTax.toLocaleString()} 원</strong></div>
      <div style="font-size:0.78rem;opacity:0.7;">실효세율: ${result.effectiveRate}% (종합소득 대비)</div>
      <div style="margin-top:6px;padding:6px;background:rgba(0,212,170,0.06);border-radius:6px;font-size:0.75rem;">
        📌 실제 세액은 부양가족·기부금·연금 등 추가 공제에 따라 달라집니다.
      </div>
    `;
  });

  // 🏠 부동산 보유세
  document.getElementById('prop-house-count').addEventListener('input', function () {
    document.getElementById('prop-one-house').checked = parseInt(this.value) === 1;
  });
  document.getElementById('btn-calc-property-tax').addEventListener('click', () => {
    const publicPrice = parseVal('prop-public-price');
    const marketPrice = parseVal('prop-market-price') || publicPrice;
    const houseCount = parseInt(document.getElementById('prop-house-count').value) || 1;
    const isOneHouse = document.getElementById('prop-one-house').checked;
    const result = TaxCalculator.calculatePropertyTax({ publicPrice, marketPrice, houseCount, isOneHouse });
    document.getElementById('prop-result').style.display = 'block';
    document.getElementById('prop-result-content').innerHTML = `
      <div>공시가격: ${publicPrice.toLocaleString()} 원</div>
      <div>과세표준 (공시×60%): ${result.taxableProperty.toLocaleString()} 원</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-info);">🏠 재산세: <strong>${result.propertyTax.toLocaleString()} 원</strong></div>
      <div style="color:var(--accent-warning);">🏢 종합부동산세: <strong>${result.comprehensiveTax.toLocaleString()} 원</strong></div>
      <div style="font-size:0.78rem;opacity:0.7;">종부세 공제: ${isOneHouse ? '12억 (1주택자)' : '9억 (다주택자)'} · 과표 ${result.compTaxable.toLocaleString()}원</div>
      <div style="color:var(--accent-warning);font-size:0.78rem;">농어촌특별세: ${result.specialTax.toLocaleString()} 원</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">💰 연간 보유세 합계: <strong>${result.totalTax.toLocaleString()} 원</strong></div>
    `;
  });

  // 2. 부가가치세 계산
  const btnCalcVat = document.getElementById('btn-calc-vat');
  btnCalcVat.addEventListener('click', () => {
    const type = vatTypeSelect.value;
    const sales = parseVal('vat-sales');
    const purchases = parseVal('vat-purchases');
    const businessType = document.getElementById('vat-business-type').value;
    const useAgriPurchase = checkUseAgri.checked;
    const agriPurchaseAmount = parseVal('vat-agri-amt');
    const hasCardSales = checkUseCardSales.checked;
    const cardSalesAmount = parseVal('vat-cardsales-amt');

    const results = TaxCalculator.calculateVAT({ 
      type, sales, purchases, businessType, useAgriPurchase, agriPurchaseAmount, hasCardSales, cardSalesAmount 
    });

    document.getElementById('vat-res-sales').textContent = results.salesTax.toLocaleString() + ' 원';
    document.getElementById('vat-res-purchases').textContent = results.purchaseTax.toLocaleString() + ' 원';
    document.getElementById('vat-res-card-credit').textContent = (results.cardCredit || 0).toLocaleString() + ' 원';
    document.getElementById('vat-res-total').textContent = results.totalPayable.toLocaleString() + ' 원';

    const advice = TaxAdvisor.getVATAdvice({ 
      type, sales, purchases, businessType, useAgriPurchase, agriPurchaseAmount, hasCardSales, cardSalesAmount 
    }, results);

    renderAdvice('vat-advice-list', advice, (id, val) => {
      if (id === 'vat_switch_type') {
        vatTypeSelect.value = val;
        vatTypeSelect.dispatchEvent(new Event('change'));
      } else if (id === 'vat_agri_deduction') {
        checkUseAgri.checked = true;
        checkUseAgri.dispatchEvent(new Event('change'));
        setAndFormatVal('vat-agri-amt', 10000000);
      } else if (id === 'vat_card_sales_ded') {
        checkUseCardSales.checked = true;
        checkUseCardSales.dispatchEvent(new Event('change'));
        setAndFormatVal('vat-cardsales-amt', 20000000);
      }
      // btnCalcVat.click();
    });
  });

  // 3. 양도소득세 계산
  const btnCalcCapital = document.getElementById('btn-calc-capital');
  btnCalcCapital.addEventListener('click', () => {
    const type = capitalTypeSelect.value;
    let inputs = {};

    if (type === 'real_estate') {
      inputs = {
        type,
        purchasePrice: parseVal('capital-purchase'),
        sellPrice: parseVal('capital-sell'),
        holdingPeriodMonths: parseInt(document.getElementById('capital-period').value) || 0,
        houseCount: parseInt(document.getElementById('capital-houses').value) || 0
      };
    } else {
      inputs = {
        type,
        stockType: document.getElementById('stock-type').value,
        stockGain: parseVal('stock-gain')
      };
    }

    const results = TaxCalculator.calculateCapitalGains(inputs);

    document.getElementById('cap-res-gain').textContent = results.gain.toLocaleString() + ' 원';
    document.getElementById('cap-res-special').textContent = (results.specialDeduction || 0).toLocaleString() + ' 원';
    document.getElementById('cap-res-base').textContent = (results.baseDeduction || 0).toLocaleString() + ' 원';
    document.getElementById('cap-res-taxable').textContent = results.taxableIncome.toLocaleString() + ' 원';
    document.getElementById('cap-res-total').textContent = results.totalTax.toLocaleString() + ' 원';
    document.getElementById('cap-res-warning').textContent = results.warningMsg || '';

    const advice = TaxAdvisor.getCapitalGainsAdvice(inputs, results);
    renderAdvice('capital-advice-list', advice, (id, val) => {
      if (id === 'real_estate_hold' || id === 'real_estate_special') {
        document.getElementById('capital-period').value = val;
        // btnCalcCapital.click();
      }
    });
  });

  // 증여 대상 자산 변경 시 주식 경고문 토글
  document.getElementById('opt-gs-type').addEventListener('change', function() {
    document.getElementById('gs-stock-warning').style.display = this.value === 'stock' ? 'block' : 'none';
  });
  // 초기 상태
  if (document.getElementById('opt-gs-type').value === 'stock') {
    document.getElementById('gs-stock-warning').style.display = 'block';
  }

  // 4. 자산 이전 절세 시뮬레이션
  const btnCalcOptGs = document.getElementById('btn-calc-opt-gs');
  btnCalcOptGs.addEventListener('click', () => {
    const type = document.getElementById('opt-gs-type').value;
    const originalPurchasePrice = parseVal('opt-gs-purchase');
    const currentPrice = parseVal('opt-gs-current');
    const years = parseInt(document.getElementById('opt-gs-years').value) || 0;

    const result = TaxOptimizer.optimizeGiftAndSell({ type, originalPurchasePrice, currentPrice, years });
    
    const resultCard = document.getElementById('opt-gs-result-card');
    const resultDetails = document.getElementById('opt-gs-result-details');
    resultCard.style.display = 'block';

    let warningDetail = '';
    if (result.isCarryoverTaxApplied) {
      if (type === 'stock') {
        warningDetail = '<br><span style="color:var(--accent-warning); font-weight:bold;">🚨 [경고] 배우자 증여 후 1년 미만 매도로 인해 이월과세(취득가액 이월)가 적용됩니다. 이에 따라 취득가액이 최초 본인의 취득 가격으로 계산되므로 절세 효과가 발생하지 않습니다. 최소 1년 이상 보유 후 매도하십시오.</span>';
      } else {
        warningDetail = '<br><span style="color:var(--accent-warning); font-weight:bold;">🚨 [경고] 부동산 증여 후 10년 미만 매도로 인해 이월과세가 적용됩니다. 이에 따라 취득가액이 최초 본인의 취득 가격으로 계산되므로 절세 효과가 발생하지 않습니다. 최소 10년 이상 보유 후 매도하십시오.</span>';
      }
    } else {
      if (type === 'stock') {
        warningDetail = '<br><span style="color:var(--accent-secondary); font-weight:bold;">✅ 보유 기간 1년 이상으로 이월과세 미적용 요건을 충족합니다. 배우자 증여 6억 한도로 세액 절감이 극대화됩니다.</span>';
      } else {
        warningDetail = '<br><span style="color:var(--accent-secondary); font-weight:bold;">✅ 보유 기간 10년 이상으로 이월과세 미적용 요건을 충족합니다. 배우자 증여 6억 한도로 세액 절감이 극대화됩니다.</span>';
      }
    }

    resultDetails.innerHTML = `
      <p style="margin-bottom:8px;">최초 양도차익: ${result.originalGain.toLocaleString()} 원</p>
      <p style="margin-bottom:8px;">이전 전 예상 양도세: ${result.originalTax.toLocaleString()} 원</p>
      <p style="margin-bottom:8px; font-weight:bold; color:var(--accent-secondary);">배우자 증여 후 예상 세금: ${result.afterGiftTax.toLocaleString()} 원</p>
      <p style="font-weight:bold; font-size:1.05rem; margin-top:12px; color:${result.savings > 0 ? 'var(--accent-secondary)' : 'var(--accent-warning)'};">
        🎯 총 예상 절세 금액: 약 +${result.savings.toLocaleString()} 원
      </p>
      <p style="font-size:0.75rem; opacity:0.7; margin-top:8px; line-height:1.3;">
        * 증여재산가액 한도 6억 원을 적용한 취득가액 갱신 시뮬레이션입니다. ${warningDetail}
      </p>
      ${type === 'stock' ? '<p style="font-size:0.7rem; margin-top:6px; padding:6px 8px; background:rgba(255,107,107,0.08); border-radius:4px; line-height:1.4; color:var(--accent-warning);">⚠️ 해외주식 증여 후 <strong>1년 이내 매도</strong>하고 양도소득이 실질적으로 증여자에게 귀속되면 <strong>부당행위계산부인</strong>이 적용될 수 있습니다. 증여 후 자금이 증여자 계좌로 환류되지 않도록 주의하세요.</p>' : ''}
    `;
  });

  // Setup Korean unit helpers
  setupKoreanUnitHelpers();

  // Load state from local storage (if any)
  loadStateFromLocalStorage();

  // Bind auto-save listeners on all inputs/selects (디바운스 500ms로 중복 저장 방지)
  const debouncedSave = debounce(function () { if (!isLoadingState) saveStateToLocalStorage(); }, 500);
  document.addEventListener('input', debouncedSave);
  document.addEventListener('change', debouncedSave);

  // Wire TaxStore into calculation flow: external set() triggers debounced recalc
  if (window.TaxStore) {
    TaxStore.subscribe(function () {
      if (!isLoadingState) btnCalcIncomeIntegrated.click();
    });
  }

  // 새 섹션 input 초기화 (money-input 포맷 적용)
  var newMoneyFields = [
      'expense-revenue','hi-earned-income','hi-other-income','hi-regional-income','hi-regional-property',
      'prop-public-price','prop-market-price','gift-amount','gift-past','stock-exchange-rate',
      'inc-a-irp','inc-b-irp','pension-salary','pension-amount','pension-irp-amount',
      'card-salary','card-usage-amount','card-cash-amount',
      'card-traditional','card-transit','card-book'
    ];
  newMoneyFields.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', formatInputOnEvent);
      if (el.value) el.value = formatNumberWithCommas(el.value);
    }
  });

  // ==========================================
  // ⚡ 실시간 계산 - 입력값 변경 시 자동 재계산 (디바운스 400ms)
  // ==========================================
  const debouncedIncome   = debounce(() => { if (!isLoadingState) btnCalcIncomeIntegrated.click(); });
  const debouncedVat      = debounce(() => { if (!isLoadingState) btnCalcVat.click(); });
  const debouncedCapital  = debounce(() => { if (!isLoadingState) btnCalcCapital.click(); });
  const debouncedGiftSell = debounce(() => { if (!isLoadingState) btnCalcOptGs.click(); });

  // 종합소득세 실시간
  [
    'inc-a-salary','inc-a-card','inc-a-yellow','inc-a-pension','inc-a-irp',
    'inc-a-financial-gen','inc-a-financial-overseas','inc-a-isa','inc-a-isa-type','inc-a-bond',
    'inc-a-business-revenue','inc-a-business-expense','inc-a-pension-income','inc-a-other-revenue','inc-a-other-expense',
    'inc-b-salary','inc-b-card','inc-b-yellow','inc-b-pension','inc-b-irp',
    'inc-b-financial-gen','inc-b-financial-overseas','inc-b-isa','inc-b-isa-type','inc-b-bond',
    'inc-b-business-revenue','inc-b-business-expense','inc-b-pension-income','inc-b-other-revenue','inc-b-other-expense',
    'inc-a-venture','inc-a-housing-sub','inc-a-housing-loan',
    'inc-b-venture','inc-b-housing-sub','inc-b-housing-loan'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedIncome); el.addEventListener('change', debouncedIncome); }
  });
  // 부양가족 카드 실시간 (동적 추가 포함)
  optCoupleYePeople.addEventListener('input', debouncedIncome);
  optCoupleYePeople.addEventListener('change', debouncedIncome);

  // 부가가치세 실시간
  [
    'vat-type','vat-sales','vat-purchases','vat-business-type',
    'vat-use-agri','vat-agri-amt','vat-use-cardsales','vat-cardsales-amt'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedVat); el.addEventListener('change', debouncedVat); }
  });

  // 양도소득세 실시간
  [
    'capital-type','capital-purchase','capital-sell','capital-period','capital-houses',
    'stock-type','stock-gain','stock-exchange-rate'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedCapital); el.addEventListener('change', debouncedCapital); }
  });

  // 자산이전 시뮬레이터 실시간
  ['opt-gs-type','opt-gs-purchase','opt-gs-current','opt-gs-years'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedGiftSell); el.addEventListener('change', debouncedGiftSell); }
  });

  // 🏠 간주임대료 실시간
  const debouncedDeemedRent = debounce(() => {
    if (!isLoadingState) {
      const btn = document.getElementById('btn-calc-deemed-rent');
      if (btn) btn.click();
    }
  });
  ['deemed-house-count','deemed-deposit','deemed-highprice','deemed-small'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedDeemedRent); el.addEventListener('change', debouncedDeemedRent); }
  });

  // 🏥 건강보험료 실시간
  const debouncedHealthIns = debounce(() => {
    if (!isLoadingState) {
      const btn = document.getElementById('btn-calc-health-insurance');
      if (btn) btn.click();
    }
  });
  ['hi-type','hi-earned-income','hi-other-income','hi-regional-income','hi-regional-property','hi-dependent-check'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedHealthIns); el.addEventListener('change', debouncedHealthIns); }
  });

  // 🏠 부동산 보유세 실시간
  const debouncedPropertyTax = debounce(() => {
    if (!isLoadingState) {
      const btn = document.getElementById('btn-calc-property-tax');
      if (btn) btn.click();
    }
  });
  ['prop-public-price','prop-market-price','prop-house-count','prop-one-house'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedPropertyTax); el.addEventListener('change', debouncedPropertyTax); }
  });

  // 🏟️ 체육시설 공제 실시간
  const debouncedSports = debounce(() => {
    if (!isLoadingState) {
      const btn = document.getElementById('btn-calc-sports');
      if (btn) btn.click();
    }
  });
  ['sports-salary','sports-fee','sports-has-pt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedSports); el.addEventListener('change', debouncedSports); }
  });

  // 🎁 고향사랑기부제 실시간
  const debouncedHometown = debounce(() => {
    if (!isLoadingState) {
      const btn = document.getElementById('btn-calc-hometown');
      if (btn) btn.click();
    }
  });
  ['hometown-amount','hometown-disaster'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedHometown); el.addEventListener('change', debouncedHometown); }
  });

  // 💰 ISA 최적화 실시간
  const debouncedISA = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-isa-opt').click(); });
  ['isa-annual','isa-type-select','isa-salary','isa-financial-comp-tax','isa-matured','isa-pension-transfer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedISA); el.addEventListener('change', debouncedISA); }
  });

  // 🧮 경비율 비교 실시간
  const debouncedExpense = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-expense-ratio').click(); });
  ['expense-biz-code','expense-revenue','expense-declared-type'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedExpense); el.addEventListener('change', debouncedExpense); }
  });

  // 💰 연금저축 최적화 실시간
  const debouncedPension = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-pension-opt').click(); });
  ['pension-target','pension-salary','pension-amount','pension-irp-amount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedPension); el.addEventListener('change', debouncedPension); }
  });

  // 💳 카드 황금비율 실시간
  const debouncedCardRatio = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-card-ratio').click(); });
  ['card-target','card-salary','card-usage-amount','card-cash-amount','card-traditional','card-transit','card-book'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedCardRatio); el.addEventListener('change', debouncedCardRatio); }
  });

  // 💍 혼인·출산 증여 실시간
  const debouncedMarriageGift = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-marriage-gift').click(); });
  ['mg-reason','mg-amount','mg-past'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedMarriageGift); el.addEventListener('change', debouncedMarriageGift); }
  });

  // 🏛️ 상속세 실시간
  const debouncedInherit = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-inheritance').click(); });
  ['inherit-total-asset','inherit-child-count','inherit-has-spouse','inherit-spouse-share','inherit-coresident','inherit-coresident-value','inherit-financial','inherit-gift-past'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedInherit); el.addEventListener('change', debouncedInherit); }
  });

  // 🎁 증여세 실시간
  const debouncedGiftTax = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-gift-tax').click(); });
  ['gift-recipient','gift-amount','gift-past','gift-asset-type'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedGiftTax); el.addEventListener('change', debouncedGiftTax); }
  });

  // 📅 증여 타임라인 실시간
  const debouncedGiftTimeline = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-gift-timeline').click(); });
  ['gift-child-name','gift-child-age'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedGiftTimeline); el.addEventListener('change', debouncedGiftTimeline); }
  });

  // Register warnings and sync
  function initRealtimeWarningsAndSync() {
    const spouses = ['a', 'b'];
    
    spouses.forEach(spouse => {
      // Salary inputs change triggers sync, ISA validation, and warnings
      const salaryEl = document.getElementById(`inc-${spouse}-salary`);
      if (salaryEl) {
        ['input', 'change'].forEach(evt => {
          salaryEl.addEventListener(evt, () => {
            syncDependentSalaries();
            validateIsaOption(spouse);
            checkSpouseIncomeWarnings(spouse);
          });
        });
      }
      
      // Other income inputs change triggers warnings
      const incomeFields = [
        `inc-${spouse}-business-revenue`,
        `inc-${spouse}-business-expense`,
        `inc-${spouse}-pension-income`,
        `inc-${spouse}-other-revenue`,
        `inc-${spouse}-other-expense`,
        `inc-${spouse}-financial-gen`,
        `inc-${spouse}-financial-overseas`
      ];
      
      incomeFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
          ['input', 'change'].forEach(evt => {
            el.addEventListener(evt, () => {
              checkSpouseIncomeWarnings(spouse);
            });
          });
        }
      });
    });

    // Also run validation and warnings initially
    syncDependentSalaries();
    validateIsaOption('a');
    validateIsaOption('b');
    checkSpouseIncomeWarnings('a');
    checkSpouseIncomeWarnings('b');

    // Register click handlers for profile edit buttons beside readonly inputs
    document.querySelectorAll('.btn-edit-profile-salary').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Go to tab-profile
        const profileTabBtn = document.querySelector('.tab-btn[data-tab="profile"]');
        if (profileTabBtn) profileTabBtn.click();
        
        // Get target spouse ('a' or 'b')
        const targetSelId = btn.dataset.spouseId;
        const targetSel = document.getElementById(targetSelId);
        const spouse = targetSel ? targetSel.value : 'a';
        
        // Sync with stepper step & segmented control
        const stepNum = spouse === 'a' ? 1 : 2;
        goToStep(stepNum);
        
        // Focus and select input
        const salaryInput = document.getElementById(`inc-${spouse}-salary`);
        if (salaryInput) {
          salaryInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => {
            salaryInput.focus();
            salaryInput.select();
          }, 300);
        }
      });
    });
  }

  // 아코디언 초기화
  initAccordion();

  // 단계형 섹션 초기화
  initStepSections();
  
  // 초기 배우자 B 탭 버튼 가시성 설정 (체크박스 상태에 따라)
  (function initSpouseBVisibility() {
    const chk = document.getElementById('enable-spouse-b');
    const isEnabled = chk ? chk.checked : true;
    const bSegmentBtn = document.querySelector('.profile-segment-wrapper .segment-btn[data-segment="profile-b"]');
    if (bSegmentBtn) bSegmentBtn.style.display = isEnabled ? 'inline-block' : 'none';
    const bMobileOption = document.querySelector('#mobile-spouse-select option[value="profile-b"]');
    if (bMobileOption) bMobileOption.style.display = isEnabled ? 'block' : 'none';
    const bTaxCard = document.getElementById('res-b-tax-report-card');
    const bFinCard = document.getElementById('res-b-financial-report-card');
    if (bTaxCard) bTaxCard.style.display = isEnabled ? 'block' : 'none';
    if (bFinCard) bFinCard.style.display = isEnabled ? 'block' : 'none';
  })();
  
  goToStep(1);
  updateInputProgress();
  initRealtimeWarningsAndSync();

  // 접근성: 툴팁에 role/tabindex 부여 및 aria-describedby 연결
  document.querySelectorAll('.tooltip-icon').forEach((tip, idx) => {
    tip.setAttribute('role', 'tooltip');
    tip.setAttribute('tabindex', '0');
    const uniqueId = 'tip-' + idx;
    tip.id = tip.id || uniqueId;
    const parentLabel = tip.closest('label');
    if (parentLabel) {
      const input = parentLabel.querySelector('input, select');
      if (input) input.setAttribute('aria-describedby', tip.id);
    }
  });

  // 진행률 업데이트를 인컴 입력 변경에 연결
  const progressInputs = [
    'inc-a-salary','inc-b-salary','inc-a-card','inc-b-card',
    'inc-a-yellow','inc-b-yellow','inc-a-pension','inc-b-pension','inc-a-irp','inc-b-irp',
    'inc-a-financial-gen','inc-b-financial-gen','inc-a-financial-overseas','inc-b-financial-overseas',
    'inc-a-isa','inc-b-isa','inc-a-bond','inc-b-bond',
    'inc-a-venture','inc-b-venture','inc-a-housing-sub','inc-b-housing-sub','inc-a-housing-loan','inc-b-housing-loan'
  ];
  progressInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', updateInputProgress); el.addEventListener('change', updateInputProgress); }
  });

  // 초기 실행 - use setTimeout to ensure DOM is fully settled after localStorage restore
  setTimeout(() => {
    btnCalcIncomeIntegrated.click();
    btnCalcVat.click();
    // safely click capital and opt-gs
    const _btnCapital = document.getElementById('btn-calc-capital');
    if (_btnCapital) _btnCapital.click();
    const _btnOptGs = document.getElementById('btn-calc-opt-gs');
    if (_btnOptGs) _btnOptGs.click();

    // Trigger sub-calculators click to ensure their outputs are computed immediately
    [
      'btn-calc-inheritance',
      'btn-calc-marriage-gift',
      'btn-calc-isa-opt',
      'btn-calc-hometown',
      'btn-calc-sports',
      'btn-calc-deemed-rent',
      'btn-calc-health-insurance',
      'btn-calc-property-tax',
      'btn-calc-pension-opt',
      'btn-calc-card-ratio',
      'btn-calc-expense-ratio',
      'btn-calc-gift-timeline',
      'btn-calc-gift-tax'
    ].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.click();
    });
  }, 0);
});

function renderAdvice(containerId, adviceList, actionCallback) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (adviceList.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 1.5rem; opacity:0.6; font-size:0.85rem;">
        🎉 이미 스마트한 절세 비율을 만족하고 계십니다!
      </div>
    `;
    return;
  }

  adviceList.sort((a, b) => b.saving - a.saving);

  // 🆕 P1: 총 절감액 배지
  var totalSavings = adviceList.reduce(function(sum, item) { return sum + (item.saving || 0); }, 0);
  if (totalSavings > 0) {
    var badge = document.createElement('div');
    badge.className = 'advice-total-savings-badge';
    badge.innerHTML = '<span class="savings-label">📊 모두 적용 시 예상 추가 절감</span><span class="savings-amount">+ ' + totalSavings.toLocaleString() + ' 원</span>';
    container.appendChild(badge);
  }

  // 🆕 P1: 상위 3개 스마트 피드 (태그 포함)
  var topN = Math.min(3, adviceList.length);
  var feed = document.createElement('div');
  feed.className = 'advice-smart-feed';
  for (var i = 0; i < topN; i++) {
    var item = adviceList[i];
    var tagHtml = '';
    if (item.saving >= 1000000) {
      tagHtml = '<span class="advice-tag high-value">💰 고수익</span>';
    } else if (item.saving >= 500000) {
      tagHtml = '<span class="advice-tag high-value">💰 중수익</span>';
    }
    if (item.type === 'warning' && item.saving > 0) {
      tagHtml += '<span class="advice-tag urgent">⚠️ 긴급</span>';
    }
    if (!tagHtml && item.actionText) {
      tagHtml = '<span class="advice-tag easy">✅ 간편</span>';
    }

    var card = document.createElement('div');
    card.className = 'advice-card ' + (item.type || 'info');
    card.innerHTML = [
      '<div class="advice-header">',
        '<span class="advice-title" style="font-size:0.9rem;">' + (i + 1) + '. ' + item.title + tagHtml + '</span>',
        item.saving > 0 ? '<span class="advice-saving" style="font-size:0.75rem;">약 +' + item.saving.toLocaleString() + '원</span>' : '',
      '</div>',
      '<p class="advice-desc" style="font-size:0.8rem; line-height:1.4; margin-bottom:8px;">' + item.desc + '</p>',
      item.actionText ? '<button class="advice-action-btn" style="padding:6px 10px; font-size:0.75rem;">' + item.actionText + ' ➔</button>' : ''
    ].join('');

    if (item.actionText) {
      card.querySelector('.advice-action-btn').addEventListener('click', function() {
        actionCallback(item.id, item.actionValue);
        // 🆕 딥링크 스크롤: 해당 입력 필드로 포커스
        var fieldId = item.fieldId || '';
        if (fieldId) {
          var el = document.getElementById(fieldId);
          if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.focus(); }
        }
      });
    }

    feed.appendChild(card);
  }
  container.appendChild(feed);

  // 남은 항목은 기존 캐러셀로
  var remaining = adviceList.slice(topN);
  if (remaining.length === 0) return;

  var totalSlides = remaining.length;
  var currentSlide = 0;

  var expandToggle = document.createElement('button');
  expandToggle.style.cssText = 'background:none; border:none; color:var(--accent-info); font-weight:700; font-size:0.78rem; cursor:pointer; padding:8px 0; width:100%; text-align:center;';
  expandToggle.textContent = '▼ 추가 가이드 ' + remaining.length + '개 더 보기';
  container.appendChild(expandToggle);

  var carousel = document.createElement('div');
  carousel.className = 'advice-carousel';
  carousel.style.display = 'none';

  var track = document.createElement('div');
  track.className = 'advice-carousel-track';

  remaining.forEach(function(item, index) {
    var slide = document.createElement('div');
    slide.className = 'advice-carousel-slide';
    slide.style.display = index === 0 ? 'block' : 'none';

    var card = document.createElement('div');
    card.className = 'advice-card ' + (item.type || 'info');
    card.innerHTML = [
      '<div class="advice-header">',
        '<span class="advice-title" style="font-size:0.9rem;">' + item.title + '</span>',
        item.saving > 0 ? '<span class="advice-saving" style="font-size:0.75rem;">약 +' + item.saving.toLocaleString() + '원 절감</span>' : '',
      '</div>',
      '<p class="advice-desc" style="font-size:0.8rem; line-height:1.4; margin-bottom:8px;">' + item.desc + '</p>',
      item.actionText ? '<button class="advice-action-btn" style="padding:6px 10px; font-size:0.75rem;">' + item.actionText + ' ➔</button>' : ''
    ].join('');

    if (item.actionText) {
      card.querySelector('.advice-action-btn').addEventListener('click', function() {
        actionCallback(item.id, item.actionValue);
      });
    }

    slide.appendChild(card);
    track.appendChild(slide);
  });

  carousel.appendChild(track);

  function showSlide(index) {
    var slides = track.querySelectorAll('.advice-carousel-slide');
    slides.forEach(function(s) { s.style.display = 'none'; });
    currentSlide = (index + totalSlides) % totalSlides;
    slides[currentSlide].style.display = 'block';
    var dots = carousel.querySelectorAll('.advice-carousel-dot');
    dots.forEach(function(d, i) { d.classList.toggle('active', i === currentSlide); });
    var counter = carousel.querySelector('.advice-carousel-counter');
    if (counter) counter.textContent = (currentSlide + 1) + ' / ' + totalSlides;
  }

  expandToggle.addEventListener('click', function() {
    var isHidden = carousel.style.display === 'none';
    carousel.style.display = isHidden ? 'block' : 'none';
    expandToggle.textContent = isHidden ? '▲ 접기' : '▼ 추가 가이드 ' + remaining.length + '개 더 보기';
  });

  var nav = document.createElement('div');
  nav.className = 'advice-carousel-nav';

  var prevBtn = document.createElement('button');
  prevBtn.className = 'advice-carousel-btn';
  prevBtn.innerHTML = '&#9664;';
  prevBtn.setAttribute('aria-label', '이전 가이드');
  prevBtn.addEventListener('click', function() { showSlide(currentSlide - 1); });

  var dotsContainer = document.createElement('div');
  dotsContainer.className = 'advice-carousel-dots';
  for (var i = 0; i < totalSlides; i++) {
    var dot = document.createElement('span');
    dot.className = 'advice-carousel-dot' + (i === 0 ? ' active' : '');
    dot.addEventListener('click', function(idx) { return function() { showSlide(idx); }; }(i));
    dotsContainer.appendChild(dot);
  }

  var counter = document.createElement('span');
  counter.className = 'advice-carousel-counter';
  counter.textContent = '1 / ' + totalSlides;

  var nextBtn = document.createElement('button');
  nextBtn.className = 'advice-carousel-btn';
  nextBtn.innerHTML = '&#9654;';
  nextBtn.setAttribute('aria-label', '다음 가이드');
  nextBtn.addEventListener('click', function() { showSlide(currentSlide + 1); });

  nav.appendChild(prevBtn);
  nav.appendChild(counter);
  nav.appendChild(dotsContainer);
  nav.appendChild(nextBtn);
  carousel.appendChild(nav);

  container.appendChild(carousel);

  // 🆕 브레드크럼 초기화
  const activeTab = document.querySelector('.tab-btn.active');
  if (activeTab) {
    updateBreadcrumb(activeTab.dataset.tab);
  }
}
