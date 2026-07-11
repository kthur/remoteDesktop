function getTargetSalary(targetId) {
  const el = document.getElementById(targetId);
  const t = el ? el.value : "a";
  return parseVal("inc-" + t + "-salary");
}
/**
 * 메인 ?�플리�??�션 UI ?�어, ?�벤??바인??�?차트 ?�더�?(배우??1,2 금융?�득 개별 ?�산 ?�용)
 */

/**
 * ?�바?�스 ?�퍼 - ?�시�?계산???�용 (?�력 ??delay ms ?�에 fn ?�행)
 */
function debounce(fn, delay = 400) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

document.addEventListener('DOMContentLoaded', () => {
  // IndexedDB Initialization for multi scenario storage (R4)
  let db;
  const dbRequest = indexedDB.open("TaxNaviDB", 1);
  dbRequest.onupgradeneeded = (e) => {
    const database = e.target.result;
    if (!database.objectStoreNames.contains("scenarios")) {
      database.createObjectStore("scenarios");
    }
  };
  dbRequest.onsuccess = (e) => {
    db = e.target.result;
    // Load scenarios when DB is ready
    if (typeof loadScenarios === 'function') loadScenarios();
  };
  dbRequest.onerror = (e) => {
    console.error("IndexedDB open failed", e);
  };
  // 1. ?�보???�플�?�?초기??
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

  // 2. ?�진??공개 (Advanced Fields) 초기??
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
            btn.innerHTML = isHidden ? '???�업·금융·기�? ?�득 ?�기 ?? : '???�업·금융·기�? ?�득 ?�치�???;
          } else if (labelType === 'deduction') {
            btn.innerHTML = isHidden ? '??추�? 공제 ??�� ?�기 ?? : '??추�? 공제 ??�� ?�치�???;
          } else {
            btn.innerHTML = isHidden ? '???�기 ?? : '???�치�???;
          }
        }
      });
    });
  };

  // ?��??�산공제 ?�성???�어 (?�업?�득 매출?�이 0??초과???�만 가??
  const checkYellowUmbrellaState = () => {
    const checkSpouseYellow = (prefix) => {
      const revenueEl = document.getElementById(`inc-${prefix}-business-revenue`);
      const yellowEl = document.getElementById(`inc-${prefix}-yellow`);
      if (!revenueEl || !yellowEl) return;

      const revVal = parseInt(revenueEl.value.replace(/,/g, ''), 10) || 0;
      if (revVal <= 0) {
        yellowEl.disabled = true;
        yellowEl.placeholder = "?�업?�득 매출 ?�력 ???�성??;
        yellowEl.value = "";
        yellowEl.style.background = "rgba(255, 255, 255, 0.02)";
        yellowEl.style.cursor = "not-allowed";
      } else {
        yellowEl.disabled = false;
        yellowEl.placeholder = "?�간 ?�입??(최�? 500�???공제)";
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
    // Remove all non-numeric characters to prevent letters, negative signs, etc.
    let clean = el.value.replace(/[^0-9]/g, '');
    var raw = parseInt(clean, 10) || 0;
    raw = Math.max(0, raw); // Ensure positive
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

  // ?�� P0-5: 결과�??�데?�트 ???�이?�이???�과
  function updateResultWithHighlight(elId, value) {
    const el = document.getElementById(elId);
    if (!el) return;
    const formatted = typeof value === 'number' ? value.toLocaleString() + ' ?? : value;
    if (el.textContent !== formatted) {
      el.textContent = formatted;
      el.classList.remove('result-highlight');
      void el.offsetWidth;
      el.classList.add('result-highlight');
    }
  }

  // ?�� P0-12: ?�스??메시지 ?�시
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

  // ?�� ?�스??메시지 ?�시
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
        if (arrow) arrow.textContent = body.classList.contains('collapsed') ? '?? : '??;
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
      if (pct === 0) label.textContent = '?�력??주세??;
      else if (pct < 30) label.textContent = '기본 ?�보 ?�력 �?;
      else if (pct < 60) label.textContent = '공제 ??�� ?�력 �?;
      else if (pct < 100) label.textContent = '추�? ?�력 가??;
      else label.textContent = '??모든 ??�� ?�력 ?�료!';
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

    // ?�� P2: ?�????money-input ?�위�??�으�??�동 변??
    document.querySelectorAll('.money-input[data-unit]').forEach(function(el) {
      var u = el.dataset.unit;
      if (u && u !== 'won') {
        var raw = parseInt(el.value.replace(/,/g, ''), 10) || 0;
        var wonVal = raw * (u === 'man' ? 10000 : 100000000);
        el.value = formatNumberWithCommas(wonVal);
        el.dataset.unit = 'won';
        // ?��? 버튼??리셋
        var group = el.parentNode.querySelector('.unit-toggle-group');
        if (group) {
          group.querySelectorAll('.unit-toggle-btn').forEach(function(b) { b.classList.remove('active'); });
          var firstBtn = group.querySelector('.unit-toggle-btn');
          if (firstBtn) firstBtn.classList.add('active');
        }
        // won-helper ?�데?�트
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
                  <span class="person-name">부?��?�?${idx + 1}</span>
                  <button class="btn-remove-person">??/button>
                </div>
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
                  <div class="form-group" style="margin-bottom:0;">
                    <label>가�??�름</label>
                    <input type="text" class="form-input opt-dep-name" value="${dep.name}" placeholder="?? ?�길??>
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>관�??�정</label>
                    <select class="form-input opt-dep-relation">
                      <option value="child" ${dep.relation === 'child' ? 'selected' : ''}>?��? (8???�상)</option>
                      <option value="parent" ${dep.relation === 'parent' ? 'selected' : ''}>부�?(기본공제)</option>
                      <option value="other" ${dep.relation === 'other' ? 'selected' : ''}>기�?</option>
                    </select>
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>가�?카드?�용??<span class="tooltip-icon" data-tooltip="부?��?�?명의???�용카드/체크카드 ?�용?�입?�다. 기본공제�?받는 배우?�에�??�동?�로 ?�산?�어 ?�도 ???�득공제?�니??">?</span></label>
                    <input type="text" inputmode="numeric" class="form-input money-input opt-dep-card" value="${dep.card}" placeholder="?�간 ?�계(??">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>가�??�료�?<span class="tooltip-icon" data-tooltip="?�당 가족을 ?�해 지출한 ?�간 ?�료비입?�다. ?�료�??�액공제??총급?�의 3% 초과 지출액부??15% 공제 ?�택???�용?�니??">?</span></label>
                    <input type="text" inputmode="numeric" class="form-input money-input opt-dep-medical" value="${dep.medical}" placeholder="?�간 ?�계(??">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>가�?교육�?<span class="tooltip-icon" data-tooltip="가족의 ?�원�? ?�교 ?�록�???교육 비용?�니?? 취학?�아??초중고생 1?�당 ??300만원, ?�?�생 ??900만원 ?�도�?15% 공제?�니??">?</span></label>
                    <input type="text" inputmode="numeric" class="form-input money-input opt-dep-edu" value="${dep.edu}" placeholder="?�간 ?�계(??">
                  </div>
                  <div class="form-group" style="margin-bottom:0;">
                    <label>?�자�??��??�환 <span class="tooltip-icon" data-tooltip="본인 ?�는 부?��?�?명의???�자�??��??�환 ?�리금입?�다. ???�도 ?�이 15% ?�액공제�?받습?�다.">?</span></label>
                    <input type="text" inputmode="numeric" class="form-input money-input opt-dep-student-loan" value="${dep.studentLoan}" placeholder="?�간 ?�계(??">
                  </div>
                </div>
                <div style="display:flex; gap:15px; margin-top:5px; font-size:0.8rem;">
                  <label><input type="checkbox" class="opt-dep-senior" ${dep.senior ? 'checked' : ''}> 경로?��?(70??)</label>
                  <label><input type="checkbox" class="opt-dep-disabled" ${dep.disabled ? 'checked' : ''}> ?�애??공제</label>
                  <label><input type="checkbox" class="opt-dep-birth" ${dep.birth ? 'checked' : ''}> 출산/?�양</label>
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
    if (num === 0) return '0??;
    
    let result = '';
    const eok = Math.floor(num / 100000000);
    const man = Math.floor((num % 100000000) / 10000);
    const won = num % 10000;
    
    if (eok > 0) {
      result += `${eok}??`;
    }
    if (man > 0) {
      result += `${man.toLocaleString('ko-KR')}�?`;
    }
    if (won > 0 && eok === 0 && man === 0) {
      result += `${won.toLocaleString('ko-KR')}`;
    }
    
    return result.trim() + ' ??;
  }

  // ?�� P2: ?�위 변??�?
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
      'card-usage-amount', 'card-cash-amount', 'card-traditional', 'card-transit', 'card-book',
      'inherit-total-asset', 'inherit-spouse-share', 'inherit-coresident-value', 'inherit-financial', 'inherit-gift-past',
      'mg-amount', 'mg-past',
      'sports-fee',
      'hometown-amount',
      'isa-annual', 'isa-salary', 'isa-pension-transfer',
      'deemed-deposit', 'deemed-small',
      'insurance-premium', 'rent-amount',
      'donation-income', 'donation-statutory', 'donation-designated', 'donation-religious',
      'hi-regional-income', 'hi-regional-property',
      'standard-itemized', 'ecocar-price',
      'housing-sub-amount', 'housing-jeonse-repay', 'housing-mortgage-interest',
      'se-revenue', 'se-other-income', 'se-financial-income',
      'bond-investment', 'venture-amount', 'venture-income',
      'yellow-business-income', 'yellow-payment'
    ];
    
    targetIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      // 모바???�자 ?�패??지??�?간편 ?�리??버튼 ?�퍼 구성
      el.setAttribute('inputmode', 'decimal');
      const wrapper = document.createElement('div');
      wrapper.className = 'input-clear-wrapper';
      el.parentNode.insertBefore(wrapper, el);
      wrapper.appendChild(el);

      const clearBtn = document.createElement('button');
      clearBtn.type = 'button';
      clearBtn.className = 'input-clear-btn';
      clearBtn.textContent = '??;
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

      // ?�래 won-helper (?��? ?�기)
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
      el.dataset.unit = 'won';
    });
  }

  // Bind input listeners to money inputs
  document.querySelectorAll('.money-input').forEach(input => {
    input.addEventListener('input', formatInputOnEvent);
    if (input.value) {
      input.value = formatNumberWithCommas(input.value);
    }
  });

  // ??PDF ?�로?????�택???�동 ?�력
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
    // �?���?PDF ?�식 ?�?????�턴??관?�?�게
    const patterns = [
      // 총급?? "총급?�액 70,000,000" / "총급??70,000,000" / "총급?�액\n70,000,000" 
      { key: 'totalSalary',   regex: /총급???:???\s*[:\s]*(?:�????\s*\[?\s*([\d,]+)\s*\]?/, id: 'inc-a-salary' },
      // ?�용카드: "?�용카드?�용?? 붙여?�기 ?�??
      { key: 'creditCard',    regex: /?�용카드\s*?�용??s*[:\s]*(?:�????\s*\[?\s*([\d,]+)\s*\]?/, id: 'inc-a-card' },
      // 체크카드/?�금
      { key: 'cashReceipt',   regex: /(?:체크카드|?�금?�수�?직불카드)\s*(?:?�용???\s*[:\s]*(?:�????\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // ?�금?��?
      { key: 'pension',       regex: /?�금(?:?��?계좌)\s*(?:?�입???\s*[:\s]*(?:�????\s*\[?\s*([\d,]+)\s*\]?/, id: 'inc-a-pension' },
      // ?�료�?
      { key: 'medical',       regex: /?�료�?s*(?:지출액)?\s*[:\s]*(?:�????\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // 보험�?
      { key: 'insurance',     regex: /(?:보장??s*보험�?보험�?\s*[:\s]*(?:�????\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // 교육�?
      { key: 'education',     regex: /교육�?s*(?:공제)?\s*[:\s]*(?:�????\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // 주택?�금
      { key: 'housing',       regex: /주택?�금\s*(?:공제)?\s*[:\s]*(?:�????\s*\[?\s*([\d,]+)\s*\]?/, id: null },
      // 기�?�?
      { key: 'donation',      regex: /기�?�?s*[:\s]*(?:�????\s*\[?\s*([\d,]+)\s*\]?/, id: null },
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
          // ?�이?�이??3�????�거
          setTimeout(() => el.classList.remove('pdf-filled-field'), 3000);
        }
      }
    }
    result._filledFields = filledFields;
    return result;
  }

  async function processPDF(file) {
    if (file.type !== 'application/pdf') { alert('PDF ?�일�??�로??가?�합?�다.'); return; }
    pdfStatus.style.display = 'block';
    pdfStatus.innerHTML = '??PDF ?�스??추출 �?..';
    pdfStatus.style.color = '';
    try {
      if (!window.pdfjsLib) {
        pdfStatus.innerHTML = '??PDF ?�이브러�?pdf.min.js)�?찾을 ???�습?�다. ?�로?�트 ?�더??<code>pdf.min.js</code>?� <code>pdf.worker.min.js</code>가 ?�는지 ?�인??주세??';
        pdfStatus.style.color = 'var(--accent-warning)';
        return;
      }
      const extracted = await extractTextFromPDF(file);
      let extractedText = extracted.text;
      const cleanText = extractedText.replace(/\s+/g, ' ').trim();
      // ?�스?��? 100??미만?�면 ?�캔(?��?지) PDF ??OCR fallback
      if (cleanText.length < 100) {
        if (typeof Tesseract !== 'undefined') {
          pdfStatus.innerHTML = '?�� ?�스???�이?��? 부족하??OCR???�작?�니??..<br><span style="font-size:0.72rem;">�??�행 ???�국???�어 ?�어 ?�이??~4MB) ?�운로드가 ?�요?�니??/span>';
          try {
            const ocrText = await ocrPDFPages(extracted.pdf, (page, total, progress) => {
              const pct = progress !== undefined ? Math.round(progress * 100) : Math.round(page / total * 100);
              pdfStatus.innerHTML = `?�� OCR ?�이지 ${page}/${total} ?�식 �?.. ${pct}%<br><span style="font-size:0.72rem;"><span style="display:block; width:${pct}%; height:4px; background:var(--accent-secondary); border-radius:2px; transition:width 0.3s;"></span></span>`;
            });
            extractedText = ocrText;
            pdfStatus.innerHTML = '??OCR ?�식 ?�료! ?�이??분석 �?..';
          } catch (ocrErr) {
            console.error(ocrErr);
            pdfStatus.innerHTML = '??OCR ?�식???�패?�습?�다. ?�스???�이?��? ?�는 PDF�??�용??주세??';
            pdfStatus.style.color = 'var(--accent-warning)';
            return;
          }
        } else {
          pdfStatus.innerHTML = '?�️ OCR ?�이브러�?Tesseract.js)가 로드?��? ?�았?�니??<br><span style="font-size:0.72rem;">?�터???�결???�인?�거???�스???�이?��? ?�는 PDF�??�용??주세??</span>';
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
        pdfStatus.innerHTML = `??PDF 분석 ?�료! <strong>${filledCount}�???��</strong>???�동 ?�력?�었?�니??`;
        pdfStatus.style.color = 'var(--accent-secondary)';
        // ?�� P0: PDF 리뷰 모달 ?�시
        showPDFReviewModal(parsedData._filledFields || [], filledCount);
      } else {
        const preview = extractedText.replace(/\s+/g, ' ').substring(0, 200);
        pdfStatus.innerHTML = `?�️ ?�스?��? 추출?�으???�치?�는 ??��???�습?�다.<br>
          <span style="font-size:0.72rem;opacity:0.7;">추출???�스??미리보기: "${preview}..."</span><br>
          <span style="font-size:0.72rem;opacity:0.7;">PDF가 �?���??�말?�산 간소??PDF ?�는 종합?�득???�고?�인지 ?�인?�세?? ?�호(?�년?�일)가 걸려?�으�??�택?�에???�다?�로?????�도??주세??</span>`;
        pdfStatus.style.color = 'var(--accent-warning)';
      }
    } catch (err) {
      console.error(err);
      if (err.name === 'PasswordException') {
        pdfStatus.innerHTML = '?�� ?�호가 걸린 PDF?�니?? ?�택?�에??"?�호 ?�정" 체크�??�제?�고 ?�시 ?�운로드??주세??';
      } else {
        pdfStatus.innerHTML = '??PDF�??�을 ???�습?�다. ?�일???�상?��? ?�았?��? ?�인??주세??';
      }
      pdfStatus.style.color = 'var(--accent-warning)';
    }
  }

  // ?�� P0: PDF 리뷰 모달
  function showPDFReviewModal(filledFields, count) {
    const modal = document.getElementById('pdf-review-modal');
    const content = document.getElementById('pdf-review-content');
    if (!modal || !content) return;
    const fieldLabels = {
      totalSalary: '총급??, creditCard: '?�용카드 ?�용??,
      cashReceipt: '체크카드/?�금', pension: '?�금?��?,
      medical: '?�료�?, insurance: '보험�?,
      education: '교육�?, housing: '주택?�금', donation: '기�?�?
    };
    let html = `<div style="font-weight:700; margin-bottom:8px;">?�� <strong>${count}�?/strong> ??��???�동 ?�력?�었?�니??</div>`;
    filledFields.forEach(f => {
      html += `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.04);">
        <span>${fieldLabels[f.label] || f.label}</span>
        <span style="font-weight:600; color:var(--accent-secondary);">${f.value.toLocaleString()} ??/span>
      </div>`;
    });
    content.innerHTML = html;
    modal.style.display = 'flex';
    document.getElementById('pdf-review-close').onclick = () => {
      modal.style.display = 'none';
      const nextTab = document.querySelector('[data-tab=\"salary\"]');
      if(nextTab) nextTab.click();
      // ?�동 계산 ?�행
      const btn = document.getElementById('btn-calc-income-integrated');
      if (btn) btn.click();
      // ?�합 리포????���??�동 ?�동 �??�커??
      const reportTabBtn = document.querySelector('.nav-step-btn[data-tab="report"]');
      if (reportTabBtn) reportTabBtn.click();
    };
  }


  // ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�
  // ?�� P0: ?�시�??�무 경고, ISA ?�형 검�?�?총급???�기??로직
  // ?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�?�

  function syncDependentSalaries() {
    const spouseASalary = document.getElementById('inc-a-salary')?.value || '0';
    const spouseBSalary = document.getElementById('inc-b-salary')?.value || '0';

    // Pension
    const pensionTarget = document.getElementById('pension-target')?.value || 'a';
    
    if (pensionSalaryEl) {
      pensionSalaryEl.value = pensionTarget === 'a' ? spouseASalary : spouseBSalary;
      pensionSalaryEl.dispatchEvent(new Event('input'));
    }

    // Card
    const cardTarget = document.getElementById('card-target')?.value || 'a';
    
    if (cardSalaryEl) {
      cardSalaryEl.value = cardTarget === 'a' ? spouseASalary : spouseBSalary;
      cardSalaryEl.dispatchEvent(new Event('input'));
    }

    // Sports
    const sportsTarget = document.getElementById('sports-target')?.value || 'a';
    
    if (sportsSalaryEl) {
      sportsSalaryEl.value = sportsTarget === 'a' ? spouseASalary : spouseBSalary;
      sportsSalaryEl.dispatchEvent(new Event('input'));
    }

    // ISA
    const isaTarget = document.getElementById('isa-target')?.value || 'a';
    
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
      warningHtml += `<div>?�️ <strong>?�득?�액보험�?부�??�??/strong>: 직장 건강보험 ??근로?�득???�득??2,000�??�을 초과?�여 추�? 건강보험�??�액)가 부과될 ???�습?�다. (초과분의 7.15% 추�? ?��?)</div>`;
    }

    const isWageOnly = (bizIncome === 0 && pension === 0 && otherIncome === 0 && finIncome === 0);
    const depLimit = isWageOnly ? 50000000 : 34000000;
    const totalIncomeForDep = salary + nonWageIncome;
    if (totalIncomeForDep > depLimit) {
      hasWarning = true;
      warningHtml += `<div style="margin-top:4px;">??<strong>?��??�자 ?�격 ?�실 ?�험</strong>: 종합?�득 ?�산??${totalIncomeForDep.toLocaleString()}?????��??�자 ?�득?�건(${depLimit.toLocaleString()}????초과?�여 건강보험 ?��??�자 ?�격???�실?�고 지????�자�??�환???�험???�습?�다.</div>`;
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
                    ?�️ 총급??5,000�???초과�??��???ISA 가?�이 불�??�여 ?�반?�으�??�동 조정?�었?�니?? (가�??�로???�동)
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
    { id: 'card-target', salary: amount: 'card-usage-amount' },
    { id: 'sports-target', salary: amount: 'sports-fee' },
    { id: 'hometown-target', amount: 'hometown-amount' }, // only has amount, no salary
    { id: 'isa-target', salary: 'isa-salary', amount: 'isa-annual' },
    { id: 'rent-target', salary: amount: 'rent-amount' },
    { id: 'insurance-target', amount: 'insurance-premium' },
    { id: 'housing-target', salary: amount: 'housing-sub-amount' }
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

  // 1. ?�마 ?��?
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    themeToggleBtn.querySelector('.theme-icon').textContent = isLight ? '?��? : '?��';
    themeToggleBtn.querySelector('.theme-text').textContent = isLight ? '?�크 모드�??�환' : '?�이??모드�??�환';
  });

  // ?�� P2-4: breadcrumb ?�데?�트
  function updateBreadcrumb(tabKey, subKey) {
    var bc = document.getElementById('breadcrumb');
    if (!bc) return;
    var labels = {
      profile: '???�보 ?�력', income: '?�득·?�말',
      capital: '?�속·증여·?�도', report: '종합 리포??,
      salary: '직장?�·연말정??, business: '?�업·?�자·?�세'
    };
    var subLabels = {
      transfer: '?�도?�득', holding: '보유??, gift: '증여·?�속',
      'profile-a': '배우?�A', 'profile-b': '배우?�B', 'profile-dep': '부?��?�?
    };
    var parts = [];
    parts.push('<span class="breadcrumb-item active">TAX NAVI</span>');
    parts.push('<span class="breadcrumb-sep">??/span>');
    parts.push('<span class="breadcrumb-item active">' + (labels[tabKey] || tabKey) + '</span>');
    if (subKey && subLabels[subKey]) {
      parts.push('<span class="breadcrumb-sep">??/span>');
      parts.push('<span class="breadcrumb-item active">' + subLabels[subKey] + '</span>');
    }
    bc.innerHTML = parts.join('');
  }

  // 2. ?�분류 ???�환 (종합?�득??/ ?�도?�득??
  const tabButtons = document.querySelectorAll('.nav-step-btn');
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

  // 3. ?�도?�득?????�력 ?�환 ?�어 (부?�산 vs 주식)
  // 1-2. ?�도/증여/?�속 ?�그먼트 컨트�??�릭 바인??
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
        nextBtn.textContent = '계산?�기 ?��';
      } else {
        nextBtn.textContent = '?�음 ??;
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
        const reportTabBtn = document.querySelector('.nav-step-btn[data-tab="report"]');
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
        nextBtn.textContent = '계산?�기 ?��';
      } else {
        nextBtn.textContent = '?�음 ??;
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

  // 2-2. 모바???�용 배우???��? ???�위�?로직
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

  // 2-3. 모바??Bottom Sheet 결과�??�출 �??�약 리포??복사 ?�기??
  const floatingBarBtn = document.getElementById('floating-bar-btn');
  const bottomSheetDim = document.getElementById('mobile-result-bottom-sheet-dim');
  const bottomSheet = document.getElementById('mobile-result-bottom-sheet');
  const bottomSheetCloseBtn = document.getElementById('bottom-sheet-close-btn');
  const bottomSheetBody = document.getElementById('bottom-sheet-body');
  const originResultCard = document.getElementById('inc-result-card');

  if (floatingBarBtn && bottomSheet && bottomSheetDim && bottomSheetCloseBtn && bottomSheetBody && originResultCard) {
    const openBottomSheet = () => {
      // 결과 리포??콘텐�?복제 �??�기??(?�세 리포??+ ?�약 브리??
      const reportMainCard = document.getElementById('report-main-card');
      bottomSheetBody.innerHTML = originResultCard.innerHTML + (reportMainCard ? reportMainCard.innerHTML : '');
      
      // 복사???�더 ?�역 ?�거 (Bottom Sheet ?�체 ?�더가 ?�으므�?
      bottomSheetBody.querySelectorAll('.card-title').forEach(copiedHeader => {
        if (copiedHeader) copiedHeader.remove();
      });

      // 복사??리포????공유 버튼 ?�벤???�매??
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

  // 4. 부가가치세 ?�제매입 �?카드발행 ?�액공제 ?��?
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

  // ?���??�속??계산
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
      <div>?�속??과세가?? <strong>${result.grossEstate.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-info);">?�� 공제 ?�역</div>
      <div>· ?�적공제(기초${result.basicDeduction.toLocaleString()} + ?��?${result.childDeduction.toLocaleString()}): <strong>${result.personDeduction.toLocaleString()} ??/strong></div>
      <div>· 배우???�속공제: <strong>${result.spouseDeduction.toLocaleString()} ??/strong> ${result.spouseDeduction > 500000000 ? '(법정지�??�도)' : '(최소공제)'}</div>
      ${result.coResidentDeduction > 0 ? `<div>· ?�거주택 ?�속공제: <strong>${result.coResidentDeduction.toLocaleString()} ??/strong></div>` : ''}
      ${result.financialDeduction > 0 ? `<div>· 금융?�산 ?�속공제: <strong>${result.financialDeduction.toLocaleString()} ??/strong></div>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>공제 ?�계: <strong>${result.totalDeductions.toLocaleString()} ??/strong></div>
      <div>과세?��?: <strong>${result.taxableEstate.toLocaleString()} ??/strong></div>
      <div>?�율: ${result.rate}%</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      ${isTaxFree
        ? '<div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">???�속??비과?? (면세?�도 ' + result.exemptionLimit.toLocaleString() + '??</div>'
        : `<div style="font-size:0.9rem;font-weight:bold;color:var(--accent-primary);">?�속?? ${result.tax.toLocaleString()} ??/div>
           <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-warning);">지방세: ${result.localTax.toLocaleString()} ??/div>
           <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">?�� �??��??�액: ${result.totalTax.toLocaleString()} ??/div>`
      }
      <div style="margin-top:8px;padding:8px;background:rgba(0,212,170,0.08);border-radius:6px;font-size:0.75rem;line-height:1.3;">
        ?�� 개정 반영: ?��?공제 1?�당 5????10배↑) · 최고?�율 40%(50% 구간 ??��) · ?�거주택 최�? 6??· 금융?�산 20%
      </div>
    `;
  });

  // ?�거주택 체크박스 ?��?
  document.getElementById('inherit-coresident').addEventListener('change', function() {
    document.getElementById('inherit-coresident-group').style.display = this.checked ? 'block' : 'none';
  });

  // ?�� ?�인·출산 증여?�산공제
  document.getElementById('btn-calc-marriage-gift').addEventListener('click', () => {
    const giftAmount = parseVal('mg-amount');
    const reason = document.getElementById('mg-reason').value;
    const past10YrsGift = parseVal('mg-past');
    const result = TaxCalculator.calculateMarriageBirthGiftTax({ giftAmount, reason, past10YrsGift });

    document.getElementById('mg-result').style.display = 'block';
    document.getElementById('mg-result-content').innerHTML = `
      <div>증여 금액: <strong>${giftAmount.toLocaleString()} ??/strong></div>
      <div>최근 10???�계: ${result.cumulative.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-secondary);">??기본공제: ${result.basicExemption.toLocaleString()} ??/div>
      <div style="color:var(--accent-gold);">?�� ?�인·출산 ?�별공제: <strong>${result.specialExemption.toLocaleString()} ??/strong></div>
      <div>�?공제 ?�도: <strong>${result.totalExemption.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      ${result.isTaxFree
        ? '<div style="font-weight:bold;color:var(--accent-secondary);font-size:1.05rem;">??증여???�액 면제!</div>'
        : `<div>과세?��?: ${result.taxableGift.toLocaleString()} ??/div>
           <div>?�율: ${result.rate}%</div>
           <div style="font-weight:bold;color:var(--accent-primary);">증여?? ${result.tax.toLocaleString()} ??/div>
           <div style="font-weight:bold;color:var(--accent-warning);">지방세: ${result.localTax.toLocaleString()} ??/div>
           <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">?�� �??�액: ${result.totalTax.toLocaleString()} ??/div>`
      }
      <div style="margin-top:8px;padding:8px;background:rgba(0,212,170,0.06);border-radius:6px;font-size:0.75rem;">
        ?�� ?��?(친정+?�댁) 각각 1.5???�씩 �?3???�까지 증여???�이 ?�전 가?�합?�다.
      </div>
    `;
  });

  // ?���?체육?�설 ?�용�??�득공제
  document.getElementById('btn-calc-sports').addEventListener('click', () => {
    const totalSalary = getTargetSalary('sports-target');
    const facilityFee = parseVal('sports-fee');
    const hasPT = document.getElementById('sports-has-pt').checked;
    const result = TaxCalculator.calculateSportsDeduction({ totalSalary, facilityFee, hasPT });

    document.getElementById('sports-result').style.display = 'block';
    if (!result.isEligible) {
      document.getElementById('sports-result-content').innerHTML = `
        <div style="color:var(--accent-warning);font-weight:bold;">??${result.reason}</div>
      `;
      return;
    }
    document.getElementById('sports-result-content').innerHTML = `
      <div>총급?? ${result.totalSalary.toLocaleString()} ??/div>
      <div>?�설 ?�용�? ${result.facilityFee.toLocaleString()} ??/div>
      ${result.hasPT ? `<div>PT ?�함 ??50%�??�정: <strong>${result.eligibleAmount.toLocaleString()} ??/strong></div>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>공제 ?�??금액: ${result.eligibleAmount.toLocaleString()} ??(?�도 ${result.deductionLimit.toLocaleString()}??</div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">
        ?�� ?�득공제??(30%): <strong>${result.deduction.toLocaleString()} ??/strong>
      </div>
      <div style="margin-top:8px;font-size:0.75rem;opacity:0.7;">??1:1 PT, 기구 ?�라?�스 ??고�? 맞춤??강습비는 공제 ?�외</div>
    `;
  });

  // ?�� 고향?�랑기�???최적??
  document.getElementById('btn-calc-hometown').addEventListener('click', () => {
    const donationAmount = parseVal('hometown-amount');
    const isDisasterArea = document.getElementById('hometown-disaster').checked;
    const result = TaxCalculator.calculateHometownDonation({ donationAmount, isDisasterArea });

    document.getElementById('hometown-result').style.display = 'block';
    document.getElementById('hometown-result-content').innerHTML = `
      <div>기�? 금액: <strong>${result.donationAmount.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>· 10�??�까지 100%: <strong>${result.creditFirst100k.toLocaleString()} ??/strong></div>
      ${result.donationAmount > 100000 ? `<div>· 10~20�???44%: <strong>${result.creditSecondBracket.toLocaleString()} ??/strong></div>` : ''}
      ${result.donationAmount > 200000 ? `<div>· 20�?초과 ${isDisasterArea ? '33%' : '16.5%'}: <strong>${(result.creditThirdBracket || 0).toLocaleString()} ??/strong></div>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>�??�액공제?? <strong>${result.totalCredit.toLocaleString()} ??/strong></div>
      <div>?��???가�?30%): <strong>${result.giftValue.toLocaleString()} ??/strong></div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">
        ?�� �?체감 ?�택: <strong>${result.totalBenefit.toLocaleString()} ??/strong>
        (?�질 ?�원??${result.effectiveReturnRate}%)
      </div>
      <div style="margin-top:8px;padding:8px;background:rgba(0,212,170,0.1);border-radius:6px;font-size:0.8rem;">
        ?�� <strong>최적 ?�략:</strong> 20�???기�? ??14.4�????�급 + 6�????��???= <strong>20.4�????�택</strong> (?�금 ?�회!)<br>
        <span style="font-size:0.7rem;">???�반�?10�??�씩 분할 기�??�여 ?�즌�??��???2???�령 가??/span>
      </div>
    `;
  });

  // ?�� ISA 최적??
  document.getElementById('isa-matured').addEventListener('change', function() {
    document.getElementById('isa-pension-group').style.display = this.checked ? 'block' : 'none';
  });
  document.getElementById('btn-calc-isa-opt').addEventListener('click', () => {
    const annualIncome = parseVal('isa-annual');
    const isaType = document.getElementById('isa-type-select').value;
    const totalIncome = getTargetSalary('isa-target');
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
      <div>?�� ISA ?�형: <strong>${result.isaType === 'sub' ? '?��??? : result.isaType === 'domestic' ? '�?��?�자?? : '?�반??}</strong></div>
      <div>???�입 ?�도: <strong>${result.annualLimit.toLocaleString()} ??/strong> (2026??개편: 2배↑)</div>
      <div>비과???�도: <strong>${result.taxfreeLimit.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      ${result.isDomesticType
        ? `<div style="color:var(--accent-info);">�?��?�자??ISA ??${result.domesticSeparatedRate}% 분리과세 (종합과세 ?�피)</div>
           <div style="font-weight:bold;color:var(--accent-secondary);">분리과세 ?�액: ${result.domesticTax.toLocaleString()} ??/div>`
        : `<div>비과???�용: <strong>${result.normalTaxfree.toLocaleString()} ??/strong></div>
           <div>초과�?분리과세(9.9%): ${result.normalSeparatedTax.toLocaleString()} ??/div>`
      }
      ${result.pensionTransferCredit > 0
        ? `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
           <div style="color:var(--accent-gold);">?�� ISA?�연�??�환 ?�액공제: <strong>${result.pensionTransferCredit.toLocaleString()} ??/strong></div>`
        : ''}
      <hr style=\"border:none;border-top:1px solid rgba(255,255,255,0.06);margin:8px 0;\">
      <div style=\"font-size:1.05rem;font-weight:900;color:var(--accent-primary);margin-top:4px;\">
        🏆 세후 실현 수익금액: <strong> 원</strong>
      </div>
      <div style="margin-top:8px;padding:8px;background:rgba(56,189,248,0.08);border-radius:6px;font-size:0.75rem;">
        ${result.summary}
      </div>
    `;
  });

  // ?�� 간주?��?�?계산
  document.getElementById('deemed-house-count').addEventListener('change', function() {
    const show = this.value >= '2';
    document.getElementById('deemed-highprice-group').style.display = show ? 'block' : 'none';
  });
  // 초기 ?�태 (2주택 기본)
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
        <div style="color:var(--accent-secondary);font-weight:bold;">??${result.reason}</div>
      `;
      return;
    }
    document.getElementById('deemed-result-content').innerHTML = `
      <div>보유 주택 ?? <strong>${result.houseCount}주택</strong></div>
      <div>?�세보증�??�계: ${result.jeonseDeposits.toLocaleString()} ??/div>
      ${result.warningMsg ? `<div style="color:var(--accent-warning);">?�️ ${result.warningMsg}</div>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>공제 기�?: ${result.deductionBase.toLocaleString()} ??/div>
      <div>초과 보증�? ${result.excessDeposit.toLocaleString()} ??/div>
      <div>간주?��?�? <strong>${result.deemedRent.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-warning);">?�상 종합?�득?? ${result.incomeTax.toLocaleString()} ??/div>
      <div style="color:var(--accent-warning);">지방소?�세: ${result.localTax.toLocaleString()} ??/div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">
        ?�� ?�간 추�? ?�액: <strong>${result.totalTax.toLocaleString()} ??/strong>
      </div>
    `;
  });

  // 5. 부?��?�??�적 추�?/??��
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
      showInlineError("income-form-error", "부?��?족�? 최�? 5명까지 ?�정?????�습?�다.");
      return;
    }
    const nextId = currentCount + 1;
    const card = document.createElement('div');
    card.className = 'person-card';
    card.dataset.id = nextId;
    card.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="person-name">부?��?�?${nextId}</span>
          <button class="btn-remove-person">??/button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
          <div class="form-group" style="margin-bottom:0;">
            <label>가�??�름</label>
            <input type="text" class="form-input opt-dep-name" value="" placeholder="?? ?�길??>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>관�??�정</label>
            <select class="form-input opt-dep-relation">
              <option value="child">?��? (8???�상)</option>
              <option value="parent">부�?(기본공제)</option>
              <option value="other">기�?</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>가�?카드?�용??<span class="tooltip-icon" data-tooltip="부?��?�?명의???�용카드/체크카드 ?�용?�입?�다. 기본공제�?받는 배우?�에�??�동?�로 ?�산?�어 ?�도 ???�득공제?�니??">?</span></label>
            <input type="text" inputmode="numeric" class="form-input money-input opt-dep-card" value="0" placeholder="?�간 ?�계(??">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>가�??�료�?<span class="tooltip-icon" data-tooltip="?�당 가족을 ?�해 지출한 ?�간 ?�료비입?�다. ?�료�??�액공제??총급?�의 3% 초과 지출액부??15% 공제 ?�택???�용?�니??">?</span></label>
            <input type="text" inputmode="numeric" class="form-input money-input opt-dep-medical" value="0" placeholder="?�간 ?�계(??">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>가�?교육�?<span class="tooltip-icon" data-tooltip="가족의 ?�원�? ?�교 ?�록�???교육 비용?�니?? 취학?�아??초중고생 1?�당 ??300만원, ?�?�생 ??900만원 ?�도�?15% 공제?�니??">?</span></label>
            <input type="text" inputmode="numeric" class="form-input money-input opt-dep-edu" value="0" placeholder="?�간 ?�계(??">
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label>?�자�??��??�환 <span class="tooltip-icon" data-tooltip="본인 ?�는 부?��?�?명의???�자�??��??�환 ?�리금입?�다. ???�도 ?�이 15% ?�액공제�?받습?�다.">?</span></label>
            <input type="text" inputmode="numeric" class="form-input money-input opt-dep-student-loan" value="0" placeholder="?�간 ?�계(??">
          </div>
        </div>
        <div style="display:flex; gap:15px; margin-top:5px; font-size:0.8rem;">
          <label><input type="checkbox" class="opt-dep-senior"> 경로?��?(70??)</label>
          <label><input type="checkbox" class="opt-dep-disabled"> ?�애??공제</label>
          <label><input type="checkbox" class="opt-dep-birth"> 출산/?�양</label>
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
     버튼 ?�벤??바인??�??�스??최적??
     ========================================== */

  // ?�?� Helper functions for income integrated calculation ?�?�

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
    
    if (d.aSalary < 0 || (isSpouseBEnabled && d.bSalary < 0)) { showInlineError("income-form-error", "?�득금액?� 0???�상?�어???�니??"); return false; }
    if (d.aIsaType === "sub" && d.aSalary > 50000000) { showInlineError("income-form-error", "배우??A ISA ?��????�격 ?�음 (급여 5,000�?초과)"); return false; }
    if (isSpouseBEnabled && d.bIsaType === "sub" && d.bSalary > 50000000) { showInlineError("income-form-error", "배우??B ISA ?��????�격 ?�음 (급여 5,000�?초과)"); return false; }
    const allNonNeg = [d.aCard, d.bCard, d.aYellow, d.bYellow, d.aPension, d.bPension,
      d.aFinancialGen, d.aFinancialOverseas, d.aIsaIncome, d.aBondSeparated,
      d.bFinancialGen, d.bFinancialOverseas, d.bIsaIncome, d.bBondSeparated,
      d.aVentureInvestment, d.aHousingSubscription, d.aHousingLoanRepay,
      d.bVentureInvestment, d.bHousingSubscription, d.bHousingLoanRepay];
    if (allNonNeg.some(v => v < 0)) { showInlineError("income-form-error", "모든 ?�력금액?� 0???�상?�어???�니??"); return false; }
    return true;
  }

  function collectDependents() {
    const cards = optCoupleYePeople.querySelectorAll(".person-card");
    const dependents = [];
    const depNames = [];
    for (const card of cards) {
      let name = (card.querySelector(".opt-dep-name").value || "").trim();
      if (!name) {
        name = card.querySelector(".person-name")?.textContent || "부?��?�?;
      }
      if (depNames.includes(name)) { showInlineError("income-form-error", "중복??부?��?�??�름: " + name); return null; }
      depNames.push(name);
      const cardVal = parseVal(card.querySelector(".opt-dep-card"));
      const medicalVal = parseVal(card.querySelector(".opt-dep-medical"));
      const eduVal = parseVal(card.querySelector(".opt-dep-edu"));
      const studentLoanRepayVal = parseVal(card.querySelector(".opt-dep-student-loan"));
      if (cardVal < 0 || medicalVal < 0 || eduVal < 0 || studentLoanRepayVal < 0) { showInlineError("income-form-error", "부?��?�?지출액?� 0???�상?�어???�니??"); return null; }
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
    updateResultWithHighlight("res-" + id + "-expense", (result.salaryDeduction || result.expense || 0).toLocaleString() + " ??);
    updateResultWithHighlight("res-" + id + "-person", (result.personDeduction || 0).toLocaleString() + " ??);
    updateResultWithHighlight("res-" + id + "-taxable", result.taxableIncome.toLocaleString() + " ??);
    updateResultWithHighlight("res-" + id + "-rate", result.bracketRate + "%");
    updateResultWithHighlight("res-" + id + "-total", result.totalTax.toLocaleString() + " ??);
  }

  function renderFinancialDetails(id, result) {
    updateResultWithHighlight("res-" + id + "-isa-free", (result.isaTaxfreeAmount || 0).toLocaleString() + " ??);
    updateResultWithHighlight("res-" + id + "-isa-tax", (result.isaSeparatedTax || 0).toLocaleString() + " ??);
    updateResultWithHighlight("res-" + id + "-bond-tax", (result.bondSeparatedTax || 0).toLocaleString() + " ??);
    updateResultWithHighlight("res-" + id + "-financial-comp", (result.financialCompAmount || 0).toLocaleString() + " ??);
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
            <strong>?�� ${dep.name}</strong> <span style="font-size:0.75rem; opacity:0.6;">(${dep.relation === 'child' ? '?��?' : dep.relation === 'parent' ? '부�? : '기�?'})</span>
            <div style="font-size:0.7rem; opacity:0.7; margin-top:2px;">
              ?�적공제 150�?${dep.medical > 0 ? ` · ?�료�?${dep.medical.toLocaleString()}?? : ''} ${dep.edu > 0 ? ` · 교육�?${dep.edu.toLocaleString()}?? : ''}
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.7rem; color:var(--accent-secondary); font-weight:bold;">
              ${recommendedValue === 'a' ? 'A 권장' : 'B 권장'}
            </span>
            <select class="form-input custom-dep-assign" data-dep-name="${dep.name}" style="padding:4px 8px; font-size:0.8rem; width:auto; margin-bottom:0;">
              <option value="a" ${selectedValue === 'a' ? 'selected' : ''}>배우??A</option>
              <option value="b" ${selectedValue === 'b' ? 'selected' : ''}>배우??B</option>
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
            <strong>?�� ?�료�?몰아주기 (?�계: ${totalMedical.toLocaleString()}??</strong>
            <div style="font-size:0.7rem; opacity:0.7; margin-top:2px;">
              ?�료�??�액공제??부부 �????�람?�게 몰아주는 것이 ?�리?�니??
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:0.7rem; color:var(--accent-secondary); font-weight:bold;">
              ${recommendedMed === 'a' ? 'A 권장' : 'B 권장'}
            </span>
            <select class="form-input" id="custom-medical-assign" style="padding:4px 8px; font-size:0.8rem; width:auto; margin-bottom:0;">
              <option value="a" ${selectedMed === 'a' ? 'selected' : ''}>배우??A</option>
              <option value="b" ${selectedMed === 'b' ? 'selected' : ''}>배우??B</option>
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
        "<div style='background:rgba(255,217,61,0.06); padding:8px 12px; border-radius:6px; border:1px solid rgba(255,217,61,0.2); margin-bottom:10px; font-size:0.78rem; color:var(--accent-gold);'>?�️ <strong>?�용??지??배정</strong>???�용???�태?�니??</div>",
        "배우??A 배정 부?��?�? <strong>[" + (activeAssignment.aDeps.join(", ") || "?�음") + "]</strong><br>",
        "배우??B 배정 부?��?�? <strong>[" + (activeAssignment.bDeps.join(", ") || "?�음") + "]</strong><br>",
        "?�용??지????부부 ?�산 ?�액: <strong style='color:var(--accent-secondary); font-size:1.05rem;'>" + activeAssignment.totalTax.toLocaleString() + " ??/strong><br>",
        "<span style='font-size:0.8rem; opacity:0.8;'>* ?�료�?공제??<strong>" + (activeAssignment.medicalTarget === "a" ? "배우??A" : "배우??B") + "</strong> 밑으�?�?��?�니??</span>"
      ].join("");

      renderSpouseResults("a", activeAssignment.aResult);
      renderSpouseResults("b", activeAssignment.bResult);

      const worstTax = Math.max(optResult.allATax, optResult.allBTax);
      const customTax = activeAssignment.totalTax;
      const savings = Math.max(0, worstTax - customTax);
      document.getElementById("comp-worst-val").textContent = worstTax.toLocaleString() + " ??;
      document.getElementById("comp-opt-val").textContent = customTax.toLocaleString() + " ??;
      document.getElementById("comp-savings-val").textContent = savings.toLocaleString() + " ??;
      if (worstTax > 0) {
        document.getElementById("comp-worst-bar").style.width = "100%";
        document.getElementById("comp-opt-bar").style.width = Math.max(5, Math.min(100, Math.round((customTax / worstTax) * 100))) + "%";
      }
    } else {
      if (best) {
        document.getElementById("res-couple-ye-desc").innerHTML = [
          "배우??A 배정 부?��?�? <strong>[" + (best.aDeps.join(", ") || "?�음") + "]</strong><br>",
          "배우??B 배정 부?��?�? <strong>[" + (best.bDeps.join(", ") || "?�음") + "]</strong><br>",
          "최적 배정 ??부부 ?�산 ?�액: <strong style='color:var(--accent-secondary); font-size:1.05rem;'>" + best.totalTax.toLocaleString() + " ??/strong> (?�독 몰아주기 ?��?<strong style='color:var(--accent-secondary);'>??" + optResult.savings.toLocaleString() + " ???�약</strong>)<br>",
          "<span style='font-size:0.8rem; opacity:0.8;'>* ?�료�?공제??<strong>" + (best.medicalTarget === "a" ? "배우??A" : "배우??B") + "</strong> 밑으�??�렴?�는 것이 ?�세??최적?�니??</span>"
        ].join("");
        renderSpouseResults("a", best.aResult);
        renderSpouseResults("b", best.bResult);
        const worstTax = Math.max(optResult.allATax, optResult.allBTax);
        const bestTax = best.totalTax;
        const savings = Math.max(0, worstTax - bestTax);
        document.getElementById("comp-worst-val").textContent = worstTax.toLocaleString() + " ??;
        document.getElementById("comp-opt-val").textContent = bestTax.toLocaleString() + " ??;
        document.getElementById("comp-savings-val").textContent = savings.toLocaleString() + " ??;
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
        monthlyRent: 0, studentLoanRepay: 0, localDonation: 0, ventureInvestment: d.aVentureInvestment,
        creditCard: d.aCard || 0, cashReceipt: d.aCash || 0
      }, { finalTax: aResult.totalTax, bracketRate: aResult.bracketRate, totalTaxCalculated: aResult.totalTax });
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
      const tabBtn = document.querySelector(`.nav-step-btn[data-tab="${targetTab}"]`);
      if (tabBtn) tabBtn.click();
      
      // Expand advanced fields wrapper if the target element is inside one
      if (targetElement) {
        const wrapper = targetElement.closest('.advanced-fields-wrapper');
        if (wrapper && wrapper.style.display === 'none') {
          wrapper.style.display = 'block';
          const toggleBtn = wrapper.previousElementSibling;
          if (toggleBtn && toggleBtn.classList.contains('btn-toggle-advanced')) {
            toggleBtn.innerHTML = '???�업/금융/기�? ?�득 �?추�? 공제 ?�기 ??;
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
        <h5 style="margin: 0 0 6px 0; color: var(--accent-primary); font-size: 0.88rem;">?�� 배우??A 카드 ?�비 최적??가?�드</h5>
        <div>문턱(25%): <strong>${aMix.threshold.toLocaleString()}??/strong> | ?�재 ?�용?? <strong>${aMix.totalUsage.toLocaleString()}??/strong></div>
        <div style="margin-top: 4px; font-size: 0.8rem; line-height: 1.4;">
    `;
    
    if (aMix.remainingToThreshold > 0) {
      html += `?�� 배우??A 카드 ?�용?�이 문턱까�? <strong>${aMix.remainingToThreshold.toLocaleString()}??/strong> 부족합?�다. ??금액만큼?� ?�택??많�? <strong>?�용카드</strong>�??�선 ?�용?�세??`;
    } else if (!aMix.isLimitReached) {
      html += `??배우??A 카드공제 문턱 ?�성! ?��? ?�도(${aMix.limit.toLocaleString()}??�?채우�??�해 <strong>체크카드/?�금</strong>?�로 <strong>${aMix.additionalCashNeeded.toLocaleString()}??/strong>?????�용?�시??것이 ?�리?�니??(공제??30% ?�용).`;
    } else {
      html += `?�� 배우??A 카드공제 ?�도 ?�달! 기본 공제 ?�도(<strong>${aMix.limit.toLocaleString()}??/strong>)???�달?�습?�다. 추�? ?�도(?�통?�장, ?�중교????�??�극 ?�용?�세??`;
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
          <h5 style="margin: 0 0 6px 0; color: var(--accent-secondary); font-size: 0.88rem;">?�� 배우??B 카드 ?�비 최적??가?�드</h5>
          <div>문턱(25%): <strong>${bMix.threshold.toLocaleString()}??/strong> | ?�재 ?�용?? <strong>${bMix.totalUsage.toLocaleString()}??/strong></div>
          <div style="margin-top: 4px; font-size: 0.8rem; line-height: 1.4;">
      `;
      if (bMix.remainingToThreshold > 0) {
        html += `?�� 배우??B 카드 ?�용?�이 문턱까�? <strong>${bMix.remainingToThreshold.toLocaleString()}??/strong> 부족합?�다. ??금액만큼?� ?�택??많�? <strong>?�용카드</strong>�??�선 ?�용?�세??`;
      } else if (!bMix.isLimitReached) {
        html += `??배우??B 카드공제 문턱 ?�성! ?��? ?�도(${bMix.limit.toLocaleString()}??�?채우�??�해 <strong>체크카드/?�금</strong>?�로 <strong>${bMix.additionalCashNeeded.toLocaleString()}??/strong>?????�용?�시??것이 ?�리?�니??(공제??30% ?�용).`;
      } else {
        html += `?�� 배우??B 카드공제 ?�도 ?�달! 기본 공제 ?�도(<strong>${bMix.limit.toLocaleString()}??/strong>)???�달?�습?�다. 추�? ?�도(?�통?�장, ?�중교????�??�극 ?�용?�세??`;
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
    document.getElementById("med-tax-a").textContent = aMed.toLocaleString() + " ??;
    document.getElementById("med-tax-b").textContent = bMed.toLocaleString() + " ??;
    document.getElementById("res-medical-desc").textContent = aMed > bMed ? "배우??A �?�� ?�리" : bMed > aMed ? "배우??B �?�� ?�리" : "차이 ?�음";
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
      '<div style="font-size:0.7rem; opacity:0.7;">부부 ?�산 총급??/div>' +
      '<div style="font-weight:bold; font-size:1rem;">' + (d.aSalary + d.bSalary).toLocaleString() + ' ??/div></div>' +
      '<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">' +
      '<div style="font-size:0.7rem; opacity:0.7;">최적???�산 ?�액</div>' +
      '<div style="font-weight:bold; font-size:1rem; color:var(--accent-secondary);">' + totalTax.toLocaleString() + ' ??/div></div>' +
      '<div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">' +
      '<div style="font-size:0.7rem; opacity:0.7;">?�상 ?�감??/div>' +
      '<div style="font-weight:bold; font-size:1rem; color:var(--accent-gold);">' + savings.toLocaleString() + ' ??/div></div></div>' +
      '<div style="font-size:0.78rem; opacity:0.7; line-height:1.5;">부?��?�?' + dependents.length + '�?· 배우??A ?�율 ' + aResult.bracketRate + '% · 배우??B ?�율 ' + bResult.bracketRate + '%<br>' +
      '?�득공제 ?�계: ' + (aDed + bDed).toLocaleString() + '??· 결정?�액 ?�계: ' + (best ? best.aResult.totalTax + best.bResult.totalTax : aResult.totalTax + bResult.totalTax).toLocaleString() + '??/div>';
    showAccordionSection("acc-family");
  }

  // 1. 종합?�득??& ?�말?�산 ?�스???�?�합 계산
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

    // [🆕 Hook: Dashboard & Nudges]
    if (window.updateDashboardSummary) window.updateDashboardSummary(d);
    if (window.updateNudgeBadges) window.updateNudgeBadges(d);
    
    // [🆕 Hook: Next-Step Enhancements]
    const finalTax = best ? best.totalTax : aResult.comprehensiveTotal + bResult.comprehensiveTotal;
    if (window.renderDashboardCharts) window.renderDashboardCharts(d, finalTax);
    if (window.updateActionChecklist) window.updateActionChecklist(d);

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
      amtEl.textContent = totalTax.toLocaleString() + ' ??;
      bar.classList.add('active');
      document.body.classList.add('floating-bar-visible');
    } else {
      bar.classList.remove('active');
      document.body.classList.remove('floating-bar-visible');
    }
  }

  // ?�� P0: ?�로??�?"결과 보기" ???�크�?
  document.getElementById('floating-bar-btn').addEventListener('click', () => {
    const resultCard = document.getElementById('inc-result-card');
    if (resultCard) {
      resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  // ?�� 리포??복사?�기
  document.getElementById('btn-share-report').addEventListener('click', () => {
    const summaryText = document.getElementById('res-family-summary-content').innerText;
    const navText = document.getElementById('res-card-nav-content').innerText;
    const totalText = `[TAX NAVI 가�??�세 리포??\n\n${summaryText}\n\n[?�비 ?�비게이??\n${navText}\n\n?�� https://kthur.github.io/tax_calculator/`;
    navigator.clipboard.writeText(totalText).then(() => {
      showToast('??리포?��? ?�립보드??복사?�었?�니??);
    }).catch(() => { showToast('??복사 ?�패. 직접 복사??주세??', 3000); });
  });

  // ?�� 10??주기 증여 ?�?�라??
  document.getElementById('btn-calc-gift-timeline').addEventListener('click', () => {
    const childName = document.getElementById('gift-child-name').value || '?��?';
    const childAge = parseInt(document.getElementById('gift-child-age').value) || 0;
    const timeline = [];
    let age = childAge;
    const limits = [
      { maxAge: 19, limit: 20000000, label: '미성?�자 증여?�도' },
      { maxAge: Infinity, limit: 50000000, label: '?�인 증여?�도' }
    ];
    while (age < 60) {
      const bracket = limits.find(l => age < l.maxAge) || limits[1];
      timeline.push({ age, limit: bracket.limit, label: bracket.label });
      age += 10;
    }
    let html = `<strong>${childName}</strong> ??비과??증여 ?�랜 (10??주기 리셋)<br><br>`;
    timeline.forEach((item, i) => {
      html += `<span style="display:inline-block; width:20px; height:20px; border-radius:50%; background:var(--accent-secondary); text-align:center; line-height:20px; font-size:0.7rem; color:#0f172a; margin-right:6px;">${i + 1}</span>`;
      html += `<strong>�?${item.age}??/strong> ??${item.limit.toLocaleString()}??${item.label} <br>`;
    });
    html += `<br>?�� <strong>�?비과??증여 가?�액: ${timeline.reduce((s, t) => s + t.limit, 0).toLocaleString()}??/strong>`;
    document.getElementById('gift-timeline-content').innerHTML = html;
    document.getElementById('gift-timeline-result').style.display = 'block';
  });

  // ?�� 증여???�계??
  document.getElementById('btn-calc-gift-tax').addEventListener('click', () => {
    const giftAmount = parseVal('gift-amount');
    const recipient = document.getElementById('gift-recipient').value;
    const giftPast10Years = parseVal('gift-past');
    const assetType = document.getElementById('gift-asset-type').value;
    const result = TaxCalculator.calculateGiftTax({ giftAmount, recipient, giftPast10Years });
    document.getElementById('gift-tax-result').style.display = 'block';
    let html = `
      <div>증여 금액: <strong>${giftAmount.toLocaleString()} ??/strong></div>
      <div>과거 10??증여: ${giftPast10Years.toLocaleString()} ??/div>
      <div>10???�계: <strong>${result.cumulative.toLocaleString()} ??/strong></div>
      <div>면제 ?�도: ${result.exemption.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>과세?��?: <strong>${result.taxableGift.toLocaleString()} ??/strong></div>
      <div>?�율: <strong>${result.rate}%</strong></div>
      <div style="font-size:0.9rem;font-weight:bold;margin-top:6px;color:var(--accent-primary);">증여?? ${result.tax.toLocaleString()} ??/div>
      <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-warning);">지방교?�세: ${result.localTax.toLocaleString()} ??/div>
      <div style="font-size:1rem;font-weight:bold;margin-top:6px;color:var(--accent-secondary);">?�� �??��??�액: ${result.totalTax.toLocaleString()} ??/div>
    `;
    if (result.totalTax === 0) {
      html += `<div style="margin-top:8px;padding:6px;background:rgba(0,212,170,0.1);border-radius:6px;font-weight:bold;">??비과??증여 가??</div>`;
    }
    if (assetType === 'etf' && recipient === 'adult_child') {
      html += `<div style="margin-top:8px;padding:6px;background:rgba(56,189,248,0.08);border-radius:6px;font-size:0.78rem;">
        ?�� 미국 ETF 증여 ?? ?�증?��? 증여받�? ETF�?매도????<strong>?�외주식 ?�도?�득??22%)</strong>가 발생?????�습?�다.
        증여 ?�시 ?��??�을 취득가?�으�??�정받아 ?�도차익??줄일 ???�어 ?�금 증여 ?��??�세 ?�과가 ?�습?�다.
      </div>`;
    }
    document.getElementById('gift-tax-content').innerHTML = html;
  });

  // ?�� ?�금?��?IRP ?�액공제 최적??
  document.getElementById('btn-calc-pension-opt').addEventListener('click', function () {
    var target = document.getElementById('pension-target').value;
    var salary = getTargetSalary('pension-target');
    var pension = parseVal('pension-amount');
    var irp = parseVal('pension-irp-amount');
    var result = TaxCalculator.calculatePensionOptimization({
      totalSalary: salary,
      currentPension: pension,
      currentIrp: irp
    });
    document.getElementById('pension-opt-result').style.display = 'block';
    var statusIcon = result.reachedLimit ? '?? : '?��';
    var statusText = result.reachedLimit ? '??50�??�도 ?�달!' : '추�? ?�입 가??;
    var recommendationHtml = '';
    if (!result.reachedLimit) {
      recommendationHtml = '<div style="margin-top:8px;padding:10px;background:rgba(0,212,170,0.12);border-radius:8px;border-left:3px solid var(--accent-secondary);">' +
        '?�� <strong>IRP 계좌</strong>�?개설(?�는 추�? ?�입)?�여 <strong>' + result.remaining.toLocaleString() + '??/strong>????채우�?br>' +
        '?�말?�산 ??<strong style="color:var(--accent-secondary);font-size:1rem;">' + result.additionalCredit.toLocaleString() + '??/strong>??추�? ?�급받습?�다!' +
        '</div>';
    }
    document.getElementById('pension-opt-content').innerHTML =
      '<div>' + statusIcon + ' ?�재 ?�계: <strong>' + result.currentTotal.toLocaleString() + '??/strong> / ' + result.maxLimit.toLocaleString() + '??(' + statusText + ')</div>' +
      '<div>?�금?��? ' + result.currentPension.toLocaleString() + '??| IRP: ' + result.currentIrp.toLocaleString() + '??/div>' +
      '<div>?�액공제?? <strong>' + result.rate.toFixed(1) + '%</strong> (총급??' + salary.toLocaleString() + '??기�?)</div>' +
      '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">' +
      '<div>?�재 ?�액공제?? ' + result.currentCredit.toLocaleString() + '??/div>' +
      '<div style="font-weight:bold;color:var(--accent-secondary);font-size:0.95rem;">최�? ?�액공제?? ' + result.potentialCredit.toLocaleString() + '??/div>' +
      recommendationHtml;
  });

  // ?�� ?�용카드 vs 체크카드 ?�금비율 계산�?
  document.getElementById('btn-calc-card-ratio').addEventListener('click', function () {
    var salary = getTargetSalary('card-target');
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
    var html = '<div>?�� 총급?? <strong>' + salary.toLocaleString() + '??/strong></div>' +
      '<div>공제 문턱(' + thresholdPct + '%): <strong>' + result.threshold.toLocaleString() + '??/strong>' +
      (result.remainingToThreshold > 0 ? ' (?�� <strong>' + result.remainingToThreshold.toLocaleString() + '??/strong> 부�?' : '') + '</div>' +
      progressBar +
      '<div>?�용카드: ' + card.toLocaleString() + '??| 체크/?�금: ' + cash.toLocaleString() + '??/div>' +
      '<div>?�계 ?�용?? <strong>' + result.totalUsage.toLocaleString() + '??/strong></div>';
    if (result.overThreshold) {
      html += '<div>공제 ?�??초과�? <strong>' + (result.totalUsage - result.threshold).toLocaleString() + '??/strong></div>';
      html += '<div>기본 공제 ?�상?? <strong>' + result.baseDeduction.toLocaleString() + '??/strong> / ?�도 ' + result.limit.toLocaleString() + '??/div>';
    }
    // 추�? 공제 ?�역
    if (result.tradDeduction > 0 || result.transitDeduction > 0 || result.bookDeduction > 0) {
      html += '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">';
      html += '<div style="font-size:0.8rem;color:var(--accent-info);font-weight:bold;">??추�? 공제 ?�역 (별도 ?�도)</div>';
      if (result.tradDeduction > 0) html += '<div>?�� ?�통?�장(30%): <strong>' + result.tradDeduction.toLocaleString() + '??/strong></div>';
      if (result.transitDeduction > 0) html += '<div>?�� ?�중교??40%): <strong>' + result.transitDeduction.toLocaleString() + '??/strong></div>';
      if (result.bookDeduction > 0) html += '<div>?�� ?�서·공연(30%): <strong>' + result.bookDeduction.toLocaleString() + '??/strong></div>';
    }
    var totalDed = result.baseDeduction + result.tradDeduction + result.transitDeduction + result.bookDeduction;
    html += '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">' +
      '<div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">?�� �?카드 공제?? <strong>' + totalDed.toLocaleString() + '??/strong></div>';
    html += '<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:8px 0;">';
    // 추천 메시지
    if (result.remainingToThreshold > 0) {
      html += '<div style="padding:8px;background:rgba(56,189,248,0.12);border-radius:6px;">' +
        '?�� ?�재 총급?�의 25%??<strong>' + result.threshold.toLocaleString() + '??/strong>까�?,<br>' +
        '?�으�?<strong>' + result.remainingToThreshold.toLocaleString() + '??/strong>�?<strong>?�용카드</strong>(?�인???�택)�????�세??<br>' +
        '문턱???��? ?�에??<strong>체크카드/?�금?�수�?/strong>?�로 ?�환?�야 30% 공제?�을 받을 ???�습?�다.<br>' +
        '<span style="font-size:0.75rem;opacity:0.7;">문턱 ?�하 구간?� 카드 종류?� 무�??�게 ?�액공제 ?�택???�으므�? ?�용카드 ?�인?��? 받는 것이 ?�리?�니??</span></div>';
    } else if (!result.isLimitReached) {
      html += '<div style="padding:8px;background:rgba(0,212,170,0.12);border-radius:6px;border-left:3px solid var(--accent-secondary);">' +
        '??문턱(25%) ?�달! ?�으�?<strong>체크카드/?�금</strong>?�로 <strong>' + result.additionalCashNeeded.toLocaleString() + '??/strong>?????�용?�면<br>' +
        '최�? ?�도 ' + result.limit.toLocaleString() + '?�까지 추�? 공제 가?�합?�다.<br>' +
        '<span style="font-size:0.75rem;opacity:0.7;">?�용카드??15% 공제?�이므�? 초과분�? 체크카드(30%)가 2�??�과?�입?�다.</span></div>';
    } else {
      html += '<div style="padding:8px;background:rgba(255,217,61,0.1);border-radius:6px;">' +
        '??기본 공제 ?�도(<strong>' + result.limit.toLocaleString() + '??/strong>)???��? ?�달?�습?�다.<br>' +
        '<span style="font-size:0.75rem;opacity:0.7;">추�?�??�통?�장(30%), ?�중교??40%), ?�서공연(30%)??별도 ?�도 ?�에??공제 가?�합?�다.</span></div>';
    }
    // 추�? 공제 ?�용 ??
    if (result.tradDeduction < result.addLimitTraditional && result.tradDeduction < Math.floor(traditional * 0.3)) {
      html += '<div style="margin-top:6px;padding:6px;background:rgba(56,189,248,0.06);border-radius:6px;font-size:0.75rem;">' +
        '?�� ?�통?�장 추�? ?�용 ??최�? ' + (result.addLimitTraditional - result.tradDeduction).toLocaleString() + '?�까지 30% 추�? 공제 가??/div>';
    }
    document.getElementById('card-ratio-content').innerHTML = html;
  });

  // ?�� N?�러 경비??비교
  document.getElementById('btn-calc-expense-ratio').addEventListener('click', () => {
    const bizCode = document.getElementById('expense-biz-code').value;
    const revenue = parseVal('expense-revenue');
    const declaredType = document.getElementById('expense-declared-type').value;
    const result = TaxCalculator.compareExpenseRatios(bizCode, revenue, declaredType);
    document.getElementById('expense-ratio-result').style.display = 'block';
    var rec = result.recommended === 'simple' ? '?�순경비??(추계?�고)' : '기�?경비??(?��? ?�성)';
    var recColor = result.recommended === declaredType ? 'var(--accent-secondary)' : 'var(--accent-warning)';
    document.getElementById('expense-ratio-content').innerHTML = `
      <div>?�종: <strong>${result.bizName}</strong></div>
      <div style="margin-top:6px;"><strong>?�순경비??/strong>: ${(result.simpleRate * 100).toFixed(1)}% ??경비 ${result.simpleExpense.toLocaleString()}??/div>
      <div><strong>기�?경비??/strong>: ${(result.standardRate * 100).toFixed(1)}% ??경비 ${result.standardExpense.toLocaleString()}??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-weight:bold;color:${recColor};">?�� 추천: <strong>${rec}</strong></div>
      <div style="font-size:0.78rem;opacity:0.7;margin-top:4px;">
        ${result.isSimpleBetter ? '?�순경비???�용 ??경비가 ??많이 ?�정?�니?? 별도 ?��? 미작??가??' : '기�?경비???��? ?�성) ??추�? 경비 ?�정?�로 ?�세 ?�과가 ?�습?�다.'}
        (?�액 차이??과세?��? 구간???�라 ?�라집니??
      </div>
    `;
  });

  // ?�� 건강보험�??��??�이??
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

  // ?���?보장??보험�??�액공제
  document.getElementById('btn-calc-insurance-credit').addEventListener('click', () => {
    const premium = parseVal('insurance-premium');
    const result = TaxCalculator.calculateInsuranceCredit({ totalPremium: premium });
    document.getElementById('insurance-result').style.display = 'block';
    document.getElementById('insurance-result-content').innerHTML = `
      <div>?�간 보험�??�입?? <strong>${result.totalPremium.toLocaleString()} ??/strong></div>
      <div>공제 ?�도: ${result.limit.toLocaleString()} ??/div>
      <div>공제 ?�??금액: <strong>${result.eligibleAmount.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>?�액공제?? ${result.creditRate}%</div>
      <div style="font-weight:bold;color:var(--accent-primary);font-size:0.95rem;">?�액공제?? <strong>${result.credit.toLocaleString()} ??/strong></div>
      <div style="color:var(--accent-warning);">지방소?�세: ${result.localTax.toLocaleString()} ??/div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">?�� �??�택: <strong>${result.totalBenefit.toLocaleString()} ??/strong></div>
      ${result.isMaxed ? '<div style="margin-top:6px;padding:6px;background:rgba(0,212,170,0.08);border-radius:6px;font-size:0.78rem;">??보험�??�도(100�??????�달?�습?�다. 추�? ?�입 ???�액공제 ?�택???�습?�다.</div>' : `<div style="margin-top:6px;font-size:0.78rem;opacity:0.7;">?�� ?�도까�? ${Math.max(0, result.limit - result.totalPremium).toLocaleString()} ??추�? 가??/div>`}
    `;
  });

  // ?�� ?�세 ?�액공제
  document.getElementById('btn-calc-rent-credit').addEventListener('click', () => {
    const totalSalary = getTargetSalary('rent-target');
    const annualRent = parseVal('rent-amount');
    const result = TaxCalculator.calculateRentCredit({ totalSalary, annualRent });
    document.getElementById('rent-result').style.display = 'block';
    if (!result.isEligible) {
      document.getElementById('rent-result-content').innerHTML = `
        <div style="color:var(--accent-warning);font-weight:bold;">??${result.reason}</div>
      `;
      return;
    }
    document.getElementById('rent-result-content').innerHTML = `
      <div>총급?? ${result.totalSalary.toLocaleString()} ??/div>
      <div>?�간 ?�세 ?�입?? <strong>${result.annualRent.toLocaleString()} ??/strong></div>
      <div>공제 ?�도: ${result.limit.toLocaleString()} ??/div>
      <div>공제 ?�??금액: <strong>${result.eligibleAmount.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>?�액공제?? ${result.creditRate}%${result.totalSalary <= 55000000 ? ' (총급??5,500�??�하 15%)' : ' (총급??5,500�?초과 12%)'}</div>
      <div style="font-weight:bold;color:var(--accent-primary);font-size:0.95rem;">?�액공제?? <strong>${result.credit.toLocaleString()} ??/strong></div>
      <div style="color:var(--accent-warning);">지방소?�세: ${result.localTax.toLocaleString()} ??/div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">?�� �??�택: <strong>${result.totalBenefit.toLocaleString()} ??/strong></div>
      ${result.isMaxed ? '<div style="margin-top:6px;padding:6px;background:rgba(0,212,170,0.08);border-radius:6px;font-size:0.78rem;">???�세 ?�도(750�??????�달?�습?�다.</div>' : ''}
    `;
  });

  // ?�� ?�반 기�?�??�액공제
  document.getElementById('btn-calc-donation-credit').addEventListener('click', () => {
    const totalIncome = parseVal('donation-income');
    const statutoryDonation = parseVal('donation-statutory');
    const designatedDonation = parseVal('donation-designated');
    const religiousDonation = parseVal('donation-religious');
    const result = TaxCalculator.calculateDonationCredit({ totalIncome, statutoryDonation, designatedDonation, religiousDonation });
    document.getElementById('donation-result').style.display = 'block';
    document.getElementById('donation-result-content').innerHTML = `
      <div>?�간 총소?? <strong>${result.totalIncome.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>?�� 기�? ?�역</div>
      <div>· 법정기�?�? ${result.statutoryDonation.toLocaleString()} ??/div>
      <div>· 지?�기부�? ${result.designatedDonation.toLocaleString()} ??/div>
      <div>· 종교?�체 기�?�? ${result.religiousDonation.toLocaleString()} ??/div>
      <div>· 기�? ?�계: <strong>${result.totalDonation.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-info);">?�� 공제 명세</div>
      <div>· 지?�기부�??�도(?�득??30%): ${result.incomeLimit.toLocaleString()} ??/div>
      <div>· 법정기�?�??�액공제(100%): <strong>${result.statutoryCredit.toLocaleString()} ??/strong></div>
      <div>· 지?�기부�??�액공제(30%): <strong>${result.designatedCredit.toLocaleString()} ??/strong> (?�??${result.designatedEligible.toLocaleString()}??</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-weight:bold;color:var(--accent-primary);font-size:0.95rem;">�??�액공제?? <strong>${result.totalCredit.toLocaleString()} ??/strong></div>
      <div style="color:var(--accent-warning);">지방소?�세: ${result.localTax.toLocaleString()} ??/div>
      <div style="font-weight:bold;color:var(--accent-secondary);font-size:1rem;">?�� �??�택: <strong>${result.totalBenefit.toLocaleString()} ??/strong></div>
    `;
  });

  // ?�� 건강보험�?계산
  const btnCalcHi = document.getElementById('btn-calc-health-insurance');
  if (btnCalcHi) {
    btnCalcHi.addEventListener('click', () => {
      const isEmployee = (document.getElementById('hi-type')?.value || 'employee') === 'employee';
      let opts = { isEmployee };
      if (isEmployee) {
        opts.earnedIncome = parseVal('inc-a-salary');
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
          <div>?�평�?근로?�득: ${hi.earnedMonthly.toLocaleString()} ??/div>
          <div>직장 건강보험�?(??: <strong>${hi.workedPremium.toLocaleString()} ??/strong></div>
          <div>?�기?�양보험�?(??: <strong>${hi.longTermCare.toLocaleString()} ??/strong></div>
          ${hi.incomeMonthlyPremium > 0 ? `<div style="color:var(--accent-warning);">?�️ ?�득?�액보험�?(??: <strong>${hi.incomeMonthlyPremium.toLocaleString()} ??/strong> (기�??�득 2,000�?초과)</div>` : '<div>?�득?�액보험�? ?�음 (기�??�득 2,000�??�하)</div>'}
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
          <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-secondary);">??보험�??�계: ${hi.monthlyPremium.toLocaleString()} ??/div>
          <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-primary);">??보험�??�계: <strong>${hi.annualPremium.toLocaleString()} ??/strong></div>
        `;
      } else {
        html = `
          <div>?�득?�수: ${hi.details.incomeScore.toLocaleString()}</div>
          <div>?�산?�수: ${hi.details.propertyScore.toLocaleString()}</div>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
          <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-secondary);">??보험�??�계: ${hi.monthlyPremium.toLocaleString()} ??/div>
          <div style="font-size:0.9rem;font-weight:bold;color:var(--accent-primary);">??보험�??�계: <strong>${hi.annualPremium.toLocaleString()} ??/strong></div>
        `;
      }
      const checkDependentEl = document.getElementById('hi-dependent-check');
      const checkDependent = checkDependentEl ? checkDependentEl.checked : false;
      if (checkDependent && isEmployee) {
        const depResult = TaxCalculator.checkDependentStatus({ otherIncome: opts.otherIncome, isWageOnly: true, isPropertyOwner: false });
        html += `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;"><div style="font-weight:bold;">?�� ?��??�자 ?�격: ${depResult.isEligible ? '???��?' : '???�실'}</div><div style="font-size:0.78rem;opacity:0.7;">${depResult.reason}</div>`;
      }
      const hiResultContent = document.getElementById('hi-result-content');
      if (hiResultContent) hiResultContent.innerHTML = html;
    });
  }

  // ?�� ?��??�액공제
  document.getElementById('btn-calc-standard-credit').addEventListener('click', () => {
    const itemizedTotal = parseVal('standard-itemized');
    const result = TaxCalculator.calculateStandardCredit({ itemizedTotal });
    document.getElementById('standard-result').style.display = 'block';
    document.getElementById('standard-result-content').innerHTML = `
      <div>??���??�액공제 ?�계: <strong>${result.itemizedTotal.toLocaleString()} ??/strong></div>
      <div>?��??�액공제: <strong>${result.standardCredit.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:0.95rem;font-weight:bold;color:${result.isStandardBetter ? 'var(--accent-secondary)' : 'var(--accent-info)'};">
        ${result.isStandardBetter ? '???��??�액공제(13�??? ?�택!' : '?�️ ??���?공제 ?�택 (?��?공제보다 ' + result.difference.toLocaleString() + '????'}
      </div>
      <div style="margin-top:6px;padding:8px;background:rgba(0,212,170,0.06);border-radius:6px;font-size:0.78rem;">
        ?�� ${result.recommendation}
      </div>
    `;
  });

  // ?�� ?�기차·친?�경�??�액공제
  document.getElementById('btn-calc-ecocar').addEventListener('click', () => {
    const carPrice = parseVal('ecocar-price');
    const carType = document.getElementById('ecocar-type').value;
    const result = TaxCalculator.calculateEcoCarCredit({ carPrice, carType });
    document.getElementById('ecocar-result').style.display = 'block';
    document.getElementById('ecocar-result-content').innerHTML = `
      <div>차량 ?�형: <strong>${result.carTypeLabel}</strong></div>
      <div>차량 가�? ${result.carPrice.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-info);">개별?�비??감면: <strong>${result.individualConsumeTax.toLocaleString()} ??/strong></div>
      <div style="color:var(--accent-info);">취득??감면: <strong>${result.acquisitionTax.toLocaleString()} ??/strong></div>
      <div style="color:var(--accent-warning);">교육??감면: ${result.eduTax.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">?�� �??�제 ?�택: <strong>${result.totalBenefit.toLocaleString()} ??/strong></div>
      <div style="margin-top:6px;padding:6px;background:rgba(0,212,170,0.06);border-radius:6px;font-size:0.75rem;">
        ?�� 2025~2026??기�? 감면 ?�도 ?�용. �?��보조금·�?방보조금?� 별도?�니??
      </div>
    `;
  });

  // ?�� 주택?�금 공제
  document.getElementById('btn-calc-housing-fund').addEventListener('click', () => {
    const totalSalary = getTargetSalary('housing-target');
    const subscriptionAmount = parseVal('housing-sub-amount');
    const jeonseLoanRepay = parseVal('housing-jeonse-repay');
    const mortgageInterest = parseVal('housing-mortgage-interest');
    const result = TaxCalculator.calculateHousingFundDeduction({ totalSalary, subscriptionAmount, jeonseLoanRepay, mortgageInterest });
    document.getElementById('housing-result').style.display = 'block';
    document.getElementById('housing-result-content').innerHTML = `
      <div>총급?? <strong>${result.totalSalary.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>?�� 주택�?��종합?��?/div>
      <div>· ?�입?? ${result.subscriptionAmount.toLocaleString()} ??/div>
      ${result.subscriptionLimit > 0 ? `<div>· 공제 ?�도: ${result.subscriptionLimit.toLocaleString()} ??/div><div>· ?�득공제: <strong>${result.subscriptionDeduction.toLocaleString()} ??/strong></div>` : '<div style="color:var(--accent-warning);">· 총급??7,000�?초과�?공제 불�?</div>'}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.04);margin:6px 0;">
      <div>?�� ?�세?�금?��??�리�?/div>
      <div>· ?�환?? ${result.jeonseLoanRepay.toLocaleString()} ??/div>
      <div>· ?�득공제: <strong>${result.jeonseDeduction.toLocaleString()} ??/strong> (?�도 ${result.jeonseLimit.toLocaleString()}??</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.04);margin:6px 0;">
      <div>?�� ?�기주택?�?�차?�금 ?�자</div>
      <div>· ?�자?? ${result.mortgageInterest.toLocaleString()} ??/div>
      <div>· ?�득공제: <strong>${result.mortgageDeduction.toLocaleString()} ??/strong> (?�도 ${result.mortgageLimit.toLocaleString()}??</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:0.95rem;font-weight:bold;color:var(--accent-primary);">�??�득공제?? <strong>${result.totalDeduction.toLocaleString()} ??/strong></div>
      <div style="font-size:0.95rem;font-weight:bold;color:var(--accent-secondary);">?�� ?�상 ?�세?? <strong>${result.estimatedTaxSavings.toLocaleString()} ??/strong> (?�율 ${(result.taxRate * 100).toFixed(0)}% ?�용)</div>
    `;
  });

  // ?�� 개인?�업??종합?�득??간편 계산
  document.getElementById('btn-calc-self-employed-tax').addEventListener('click', () => {
    const totalRevenue = parseVal('se-revenue');
    const bizCode = document.getElementById('se-biz-code').value;
    const declaredType = document.getElementById('se-declared-type').value;
    const otherIncome = parseVal('se-other-income');
    const financialIncome = parseVal('se-financial-income');
    const result = TaxCalculator.calculateSelfEmployedTax({ totalRevenue, bizCode, declaredType, otherIncome, financialIncome });
    document.getElementById('se-result').style.display = 'block';
    document.getElementById('se-result-content').innerHTML = `
      <div>?�종: <strong>${result.bizCodeLabel}</strong></div>
      <div>?�간 매출: ${result.totalRevenue.toLocaleString()} ??/div>
      <div>경비?? ${(result.expenseRate * 100).toFixed(0)}% (${result.declaredType === 'simple' ? '?�순경비?? : '기�?경비??})</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>?�업?�득: <strong>${result.bizIncome.toLocaleString()} ??/strong> (매출 ${result.totalRevenue.toLocaleString()} × ${((1 - result.expenseRate) * 100).toFixed(0)}%)</div>
      <div>기�??�득: ${result.otherIncome.toLocaleString()} ??/div>
      <div>금융?�득: ${result.financialIncome.toLocaleString()} ??/div>
      <div>종합?�득 ?�계: <strong>${result.totalIncome.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>근로?�득공제: ${result.salaryDeduction.toLocaleString()} ??/div>
      <div>기본공제: ${result.basicDeduction.toLocaleString()} ??/div>
      <div>과세?��?: <strong>${result.taxableIncome.toLocaleString()} ??/strong></div>
      <div>?�율: ${(result.taxRate * 100).toFixed(0)}%</div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:0.9rem;color:var(--accent-primary);">?�득?? <strong>${result.incomeTax.toLocaleString()} ??/strong></div>
      <div style="color:var(--accent-warning);">지방소?�세: ${result.localTax.toLocaleString()} ??/div>
      <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">?�� �??�상 ?�액: <strong>${result.totalTax.toLocaleString()} ??/strong></div>
      <div style="font-size:0.78rem;opacity:0.7;">?�효?�율: ${result.effectiveRate}% (종합?�득 ?��?</div>
      <div style="margin-top:6px;padding:6px;background:rgba(0,212,170,0.06);border-radius:6px;font-size:0.75rem;">
        ?�� ?�제 ?�액?� 부?��?족·기부금·연�???추�? 공제???�라 ?�라집니??
      </div>
    `;
  });

  // ?�� ?�기채권 분리과세 ?�세 계산�?
  document.getElementById('btn-calc-bond').addEventListener('click', () => {
    const investment = parseVal('bond-investment');
    const bondType = document.getElementById('bond-type').value;
    const userTaxRate = parseFloat(document.getElementById('bond-tax-rate').value);
    const isFinancialCompTax = document.getElementById('bond-financial-comp').checked;
    const result = TaxCalculator.calculateBondDeduction({ investment, bondType, userTaxRate, isFinancialCompTax });
    document.getElementById('bond-result').style.display = 'block';
    document.getElementById('bond-result-content').innerHTML = `
      <div>채권 ?�형: <strong>${result.bondTypeLabel}</strong></div>
      <div>?�자 금액: ${result.investment.toLocaleString()} ??/div>
      <div>추정 ?�이??(4%): <strong>${result.estimatedInterest.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-primary);">?�� 분리과세</div>
      <div>· ?�천?? ${result.separatedTax.toLocaleString()} ??/div>
      <div>· 지방소?�세: ${result.separatedLocalTax.toLocaleString()} ??/div>
      <div style="font-weight:bold;">· ?�계: <strong>${result.separatedTotal.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.04);margin:6px 0;">
      <div style="color:var(--accent-secondary);">?�� 종합과세 (가?? ?�율 ${(result.comprehensiveTotal > 0 ? Math.round(result.comprehensiveTotal / result.estimatedInterest * 10000) / 100 : 0)}%)</div>
      <div>· ?�득?? ${result.comprehensiveTax.toLocaleString()} ??/div>
      <div>· 지방소?�세: ${result.comprehensiveLocalTax.toLocaleString()} ??/div>
      <div style="font-weight:bold;">· ?�계: <strong>${result.comprehensiveTotal.toLocaleString()} ??/strong></div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:0.95rem;font-weight:bold;color:${result.isSeparatedBetter ? 'var(--accent-secondary)' : 'var(--accent-info)'};">
        ${result.isSeparatedBetter ? '??분리과세(30%)가 ?�리?�니?? : '?�️ 종합과세가 ?�리?�니??}
      </div>
      ${result.savings > 0 ? `<div style="font-size:0.85rem;margin-top:4px;">?�세 차이: <strong>${result.savings.toLocaleString()} ??/strong></div>` : ''}
      <div style="margin-top:6px;padding:6px;background:rgba(108,99,255,0.06);border-radius:6px;font-size:0.75rem;">
        ?�� ${result.recommendation}
      </div>
    `;
  });

  // ?? 벤처?�자 ?�득공제 ?��??�이??
  document.getElementById('btn-calc-venture').addEventListener('click', () => {
    const ventureAmount = parseVal('venture-amount');
    const annualIncome = parseVal('venture-income');
    const result = TaxCalculator.calculateVentureSimulation({ ventureAmount, annualIncome });
    document.getElementById('venture-result').style.display = 'block';
    document.getElementById('venture-result-content').innerHTML = `
      <div>벤처?�자 금액: <strong>${result.ventureAmount.toLocaleString()} ??/strong></div>
      <div>?�간 ?�득: ${result.annualIncome.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>?�득공제?? <strong>${result.deduction.toLocaleString()} ??/strong></div>
      ${result.hasLimitExceeded ? '<div style="color:var(--accent-warning);font-size:0.78rem;">?�️ 3,000�???초과분�? 70%�?공제?�니??</div>' : ''}
      <div>공제 ???�득: ${result.incomeAfterDeduction.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>공제 ???�율: ${(result.rateBefore * 100).toFixed(0)}%</div>
      <div>공제 ???�율: ${(result.rateAfter * 100).toFixed(0)}%</div>
      <div>?�득???�감: <strong>${result.taxSavings.toLocaleString()} ??/strong></div>
      <div>지방소?�세 ?�감: ${result.localTaxSavings.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">?�� �??�세 ?�과: <strong>${result.totalSavings.toLocaleString()} ??/strong></div>
      <div style="font-size:0.82rem;">?�자 ?��??�세?? ${result.effectiveSavingsRate}%</div>
      <div style="margin-top:6px;padding:6px;background:rgba(0,212,170,0.06);border-radius:6px;font-size:0.75rem;">
        ?�� ${result.recommendation}
      </div>
    `;
  });

  // ?�� ?��??�산공제 계산�?
  document.getElementById('btn-calc-yellow').addEventListener('click', () => {
    const businessIncome = parseVal('yellow-business-income');
    const payment = parseVal('yellow-payment');
    const result = TaxCalculator.calculateYellowUmbrellaSimulation({ businessIncome, payment });
    document.getElementById('yellow-result').style.display = 'block';
    document.getElementById('yellow-result-content').innerHTML = `
      <div>?�간 ?�업?�득: <strong>${result.businessIncome.toLocaleString()} ??/strong></div>
      <div>?�간 ?�입?? ${result.payment.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>공제 ?�도: <strong>${result.limit.toLocaleString()} ??/strong></div>
      <div>?�득공제?? <strong>${result.deduction.toLocaleString()} ??/strong></div>
      ${!result.isFullDeduction ? `<div style="color:var(--accent-warning);font-size:0.78rem;">?�️ 초과�?${result.unusedAmount.toLocaleString()}?��? 공제?��? ?�습?�다.</div>` : ''}
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div>?�용 ?�율: ${(result.taxRate * 100).toFixed(0)}%</div>
      <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">?�� ?�상 ?�세?? <strong>${result.estimatedTaxSavings.toLocaleString()} ??/strong></div>
      <div style="margin-top:6px;padding:6px;background:rgba(255,217,61,0.06);border-radius:6px;font-size:0.75rem;">
        ?�� ${result.recommendation}
      </div>
    `;
  });

  // ?�� 부?�산 보유??
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
      <div>공시가�? ${publicPrice.toLocaleString()} ??/div>
      <div>과세?��? (공시×60%): ${result.taxableProperty.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="color:var(--accent-info);">?�� ?�산?? <strong>${result.propertyTax.toLocaleString()} ??/strong></div>
      <div style="color:var(--accent-warning);">?�� 종합부?�산?? <strong>${result.comprehensiveTax.toLocaleString()} ??/strong></div>
      <div style="font-size:0.78rem;opacity:0.7;">종�???공제: ${isOneHouse ? '12??(1주택??' : '9??(?�주?�자)'} · 과표 ${result.compTaxable.toLocaleString()}??/div>
      <div style="color:var(--accent-warning);font-size:0.78rem;">?�어촌특별세: ${result.specialTax.toLocaleString()} ??/div>
      <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;">
      <div style="font-size:1rem;font-weight:bold;color:var(--accent-secondary);">?�� ?�간 보유???�계: <strong>${result.totalTax.toLocaleString()} ??/strong></div>
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

    document.getElementById('vat-res-sales').textContent = results.salesTax.toLocaleString() + ' ??;
    document.getElementById('vat-res-purchases').textContent = results.purchaseTax.toLocaleString() + ' ??;
    document.getElementById('vat-res-card-credit').textContent = (results.cardCredit || 0).toLocaleString() + ' ??;
    document.getElementById('vat-res-total').textContent = results.totalPayable.toLocaleString() + ' ??;

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

  // 3. ?�도?�득??계산
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

    document.getElementById('cap-res-gain').textContent = results.gain.toLocaleString() + ' ??;
    document.getElementById('cap-res-special').textContent = (results.specialDeduction || 0).toLocaleString() + ' ??;
    document.getElementById('cap-res-base').textContent = (results.baseDeduction || 0).toLocaleString() + ' ??;
    document.getElementById('cap-res-taxable').textContent = results.taxableIncome.toLocaleString() + ' ??;
    document.getElementById('cap-res-total').textContent = results.totalTax.toLocaleString() + ' ??;
    document.getElementById('cap-res-warning').textContent = results.warningMsg || '';

    const advice = TaxAdvisor.getCapitalGainsAdvice(inputs, results);
    renderAdvice('capital-advice-list', advice, (id, val) => {
      if (id === 'real_estate_hold' || id === 'real_estate_special') {
        document.getElementById('capital-period').value = val;
        // btnCalcCapital.click();
      }
    });
  });

  // 증여 ?�???�산 변�???주식 경고�??��?
  document.getElementById('opt-gs-type').addEventListener('change', function() {
    document.getElementById('gs-stock-warning').style.display = this.value === 'stock' ? 'block' : 'none';
  });
  // 초기 ?�태
  if (document.getElementById('opt-gs-type').value === 'stock') {
    document.getElementById('gs-stock-warning').style.display = 'block';
  }

  // 4. ?�산 ?�전 ?�세 ?��??�이??
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
        warningDetail = '<br><span style="color:var(--accent-warning); font-weight:bold;">?�� [경고] 배우??증여 ??1??미만 매도�??�해 ?�월과세(취득가???�월)가 ?�용?�니?? ?�에 ?�라 취득가?�이 최초 본인??취득 가격으�?계산?��?�??�세 ?�과가 발생?��? ?�습?�다. 최소 1???�상 보유 ??매도?�십?�오.</span>';
      } else {
        warningDetail = '<br><span style="color:var(--accent-warning); font-weight:bold;">?�� [경고] 부?�산 증여 ??10??미만 매도�??�해 ?�월과세가 ?�용?�니?? ?�에 ?�라 취득가?�이 최초 본인??취득 가격으�?계산?��?�??�세 ?�과가 발생?��? ?�습?�다. 최소 10???�상 보유 ??매도?�십?�오.</span>';
      }
    } else {
      if (type === 'stock') {
        warningDetail = '<br><span style="color:var(--accent-secondary); font-weight:bold;">??보유 기간 1???�상?�로 ?�월과세 미적???�건??충족?�니?? 배우??증여 6???�도�??�액 ?�감??극�??�됩?�다.</span>';
      } else {
        warningDetail = '<br><span style="color:var(--accent-secondary); font-weight:bold;">??보유 기간 10???�상?�로 ?�월과세 미적???�건??충족?�니?? 배우??증여 6???�도�??�액 ?�감??극�??�됩?�다.</span>';
      }
    }

    resultDetails.innerHTML = `
      <p style="margin-bottom:8px;">최초 ?�도차익: ${result.originalGain.toLocaleString()} ??/p>
      <p style="margin-bottom:8px;">?�전 ???�상 ?�도?? ${result.originalTax.toLocaleString()} ??/p>
      <p style="margin-bottom:8px; font-weight:bold; color:var(--accent-secondary);">배우??증여 ???�상 ?�금: ${result.afterGiftTax.toLocaleString()} ??/p>
      <p style="font-weight:bold; font-size:1.05rem; margin-top:12px; color:${result.savings > 0 ? 'var(--accent-secondary)' : 'var(--accent-warning)'};">
        ?�� �??�상 ?�세 금액: ??+${result.savings.toLocaleString()} ??
      </p>
      <p style="font-size:0.75rem; opacity:0.7; margin-top:8px; line-height:1.3;">
        * 증여?�산가???�도 6???�을 ?�용??취득가??갱신 ?��??�이?�입?�다. ${warningDetail}
      </p>
      ${type === 'stock' ? '<p style="font-size:0.7rem; margin-top:6px; padding:6px 8px; background:rgba(255,107,107,0.08); border-radius:4px; line-height:1.4; color:var(--accent-warning);">?�️ ?�외주식 증여 ??<strong>1???�내 매도</strong>?�고 ?�도?�득???�질?�으�?증여?�에�?귀?�되�?<strong>부?�행?�계?��???/strong>???�용?????�습?�다. 증여 ???�금??증여??계좌�??�류?��? ?�도�?주의?�세??</p>' : ''}
    `;
  });

  // Setup Korean unit helpers
  setupKoreanUnitHelpers();

  // Load state from local storage (if any)
  loadStateFromLocalStorage();

  // Bind auto-save listeners on all inputs/selects (?�바?�스 500ms�?중복 ?�??방�?)
  function updateStickyBar() {
      const aSalary = parseVal('inc-a-salary') || getTargetSalary();
      if (aSalary <= 0) {
        document.getElementById('sticky-tax-bar').style.display = 'none';
        return;
      }
      const currentTab = document.querySelector('.stepper-step[aria-selected=\"true\"]');
      if (currentTab && currentTab.dataset.tab === 'report') {
        document.getElementById('sticky-tax-bar').style.display = 'none';
        return;
      }
      document.getElementById('sticky-tax-bar').style.display = 'flex';
      
      const aDeps = Array.from(optCoupleYePeople.querySelectorAll('.person-card')).filter(c => c.dataset.assigned === 'a' || !c.dataset.assigned);
      const aOptData = {
        totalSalary: aSalary,
        dependents: aDeps.length,
        cardUsage: parseVal('card-usage-amount'),
        cashUsage: parseVal('card-cash-amount'),
        traditionalMarket: parseVal('card-traditional'),
        publicTransit: parseVal('card-transit'),
        bookPerformance: parseVal('card-book'),
        pensionSavings: parseVal('inc-a-pension'),
        irpSavings: parseVal('inc-a-irp'),
        medicalExpense: parseVal('expense-revenue'),
        educationExpense: 0,
        monthlyRent: 0,
        ventureInvestment: parseVal('venture-amount')
      };
      const aResult = TaxCalculator.calculateYearEndTax(aOptData);
      const bar = document.getElementById('sticky-tax-amount');
      if (aResult.totalTax > 0) {
        bar.textContent = formatNumberWithCommas(aResult.totalTax) + '원 (납부)';
        bar.style.color = '#ff6b6b';
      } else {
        bar.textContent = formatNumberWithCommas(Math.abs(aResult.totalTax)) + '원 (환급)';
        bar.style.color = 'var(--accent-primary)';
      }
    }

    const debouncedSave = debounce(function () { if (!isLoadingState) saveStateToLocalStorage(); }, 500);
    const debouncedStickyUpdate = debounce(function() { if (!isLoadingState) updateStickyBar(); }, 300);
    document.addEventListener('input', debouncedStickyUpdate);
    document.addEventListener('change', debouncedStickyUpdate);
  document.addEventListener('input', debouncedSave);
  document.addEventListener('change', debouncedSave);

  // Wire TaxStore into calculation flow: external set() triggers debounced recalc
  if (window.TaxStore) {
    TaxStore.subscribe(function () {
      if (!isLoadingState) btnCalcIncomeIntegrated.click();
    });
  }

  // ???�션 input 초기??(money-input ?�맷 ?�용)
  var newMoneyFields = [
      'expense-revenue','hi-earned-income','hi-other-income','hi-regional-income','hi-regional-property','bond-investment','venture-amount','venture-income','yellow-business-income','yellow-payment',
      'prop-public-price','prop-market-price','gift-amount','gift-past','stock-exchange-rate',
      'inc-a-irp','inc-b-irp','pension-salary','pension-amount','pension-irp-amount',
      'card-usage-amount','card-cash-amount',
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
  // ???�시�?계산 - ?�력�?변�????�동 ?�계??(?�바?�스 400ms)
  // ==========================================
  const debouncedIncome   = debounce(() => { if (!isLoadingState) btnCalcIncomeIntegrated.click(); });
  const debouncedVat      = debounce(() => { if (!isLoadingState) btnCalcVat.click(); });
  const debouncedCapital  = debounce(() => { if (!isLoadingState) btnCalcCapital.click(); });
  const debouncedGiftSell = debounce(() => { if (!isLoadingState) btnCalcOptGs.click(); });

  // 종합?�득???�시�?
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
  // 부?��?�?카드 ?�시�?(?�적 추�? ?�함)
  optCoupleYePeople.addEventListener('input', debouncedIncome);
  optCoupleYePeople.addEventListener('change', debouncedIncome);

  // 부가가치세 ?�시�?
  [
    'vat-type','vat-sales','vat-purchases','vat-business-type',
    'vat-use-agri','vat-agri-amt','vat-use-cardsales','vat-cardsales-amt'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedVat); el.addEventListener('change', debouncedVat); }
  });

  // ?�도?�득???�시�?
  [
    'capital-type','capital-purchase','capital-sell','capital-period','capital-houses',
    'stock-type','stock-gain','stock-exchange-rate'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedCapital); el.addEventListener('change', debouncedCapital); }
  });

  // ?�산?�전 ?��??�이???�시�?
  ['opt-gs-type','opt-gs-purchase','opt-gs-current','opt-gs-years'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedGiftSell); el.addEventListener('change', debouncedGiftSell); }
  });

  // ?�� 간주?��?�??�시�?
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

  // ?�� 건강보험�??�시�?
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

  // ?�� 부?�산 보유???�시�?
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

  // ?���?체육?�설 공제 ?�시�?
  const debouncedSports = debounce(() => {
    if (!isLoadingState) {
      const btn = document.getElementById('btn-calc-sports');
      if (btn) btn.click();
    }
  });
  ['sports-fee','sports-has-pt'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedSports); el.addEventListener('change', debouncedSports); }
  });

  // ?�� 고향?�랑기�????�시�?
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

  // ?�� ISA 최적???�시�?
  const debouncedISA = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-isa-opt').click(); });
  ['isa-annual','isa-type-select','isa-salary','isa-financial-comp-tax','isa-matured','isa-pension-transfer'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedISA); el.addEventListener('change', debouncedISA); }
  });

  // ?�� 경비??비교 ?�시�?
  const debouncedExpense = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-expense-ratio').click(); });
  ['expense-biz-code','expense-revenue','expense-declared-type'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedExpense); el.addEventListener('change', debouncedExpense); }
  });

  // ?�� ?�금?��?최적???�시�?
  const debouncedPension = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-pension-opt').click(); });
  ['pension-target','pension-salary','pension-amount','pension-irp-amount'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedPension); el.addEventListener('change', debouncedPension); }
  });

  // ?�� 카드 ?�금비율 ?�시�?
  const debouncedCardRatio = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-card-ratio').click(); });
  ['card-target','card-usage-amount','card-cash-amount','card-traditional','card-transit','card-book'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedCardRatio); el.addEventListener('change', debouncedCardRatio); }
  });

  // ?�� ?�인·출산 증여 ?�시�?
  const debouncedMarriageGift = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-marriage-gift').click(); });
  ['mg-reason','mg-amount','mg-past'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedMarriageGift); el.addEventListener('change', debouncedMarriageGift); }
  });

  // ?���??�속???�시�?
  const debouncedInherit = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-inheritance').click(); });
  ['inherit-total-asset','inherit-child-count','inherit-has-spouse','inherit-spouse-share','inherit-coresident','inherit-coresident-value','inherit-financial','inherit-gift-past'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedInherit); el.addEventListener('change', debouncedInherit); }
  });

  // ?�� 증여???�시�?
  const debouncedGiftTax = debounce(() => { if (!isLoadingState) document.getElementById('btn-calc-gift-tax').click(); });
  ['gift-recipient','gift-amount','gift-past','gift-asset-type'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener('input', debouncedGiftTax); el.addEventListener('change', debouncedGiftTax); }
  });

  // ?�� 증여 ?�?�라???�시�?
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
        const profileTabBtn = document.querySelector('.nav-step-btn[data-tab="profile"]');
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

  // ?�코?�언 초기??
  initAccordion();

  // ?�계???�션 초기??
  initStepSections();
  
  // 초기 배우??B ??버튼 가?�성 ?�정 (체크박스 ?�태???�라)
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

  // ?�근?? ?�팁??role/tabindex 부??�?aria-describedby ?�결
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

  // 진행�??�데?�트�??�컴 ?�력 변경에 ?�결
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

  // 초기 ?�행 - use setTimeout to ensure DOM is fully settled after localStorage restore
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

  // ==========================================
  // ?�� 배우???�동 ?�터 (Spouse Sync Center) 로직
  // ==========================================

  // XOR 기반???��?�� ???�호??복호???�퍼 (개인?�보 보호??
  function encryptDecrypt(input, key) {
    let output = "";
    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      output += String.fromCharCode(charCode);
    }
    return btoa(unescape(encodeURIComponent(output)));
  }

  function decrypt(ciphertext, key) {
    try {
      const raw = decodeURIComponent(escape(atob(ciphertext)));
      let output = "";
      for (let i = 0; i < raw.length; i++) {
        const charCode = raw.charCodeAt(i) ^ key.charCodeAt(i % key.length);
        output += String.fromCharCode(charCode);
      }
      return output;
    } catch (e) {
      return null;
    }
  }

  // 1. ?�보?�기???�태 직렬??
  function serializeState() {
    saveStateToLocalStorage();
    return localStorage.getItem('tax_calculator_state');
  }

  // 2. ?�태 ??��?�화 �?UI 반영
  function deserializeAndLoad(jsonStr, mode) {
    try {
      const importedState = JSON.parse(jsonStr);
      if (!importedState || !importedState.statics) {
        showToast('???�바르�? ?��? ?�이???�식?�니??');
        return false;
      }

      if (mode === 'merge') {
        const localSaved = localStorage.getItem('tax_calculator_state');
        const localState = localSaved ? JSON.parse(localSaved) : { statics: {}, dependents: [] };
        
        const mergedStatics = { ...localState.statics };
        
        for (const key in importedState.statics) {
          const isSpouseBField = key.startsWith('inc-b-') || key === 'enable-spouse-b';
          const isSpouseAField = key.startsWith('inc-a-');
          
          if (isSpouseBField || isSpouseAField) {
            const impVal = importedState.statics[key];
            const localVal = localState.statics[key];
            if (isSpouseBField) {
              mergedStatics[key] = impVal;
            } else if (isSpouseAField) {
              if (!localVal || localVal === "0" || localVal === 0) {
                mergedStatics[key] = impVal;
              }
            }
          } else {
            if (!mergedStatics[key] && importedState.statics[key]) {
              mergedStatics[key] = importedState.statics[key];
            }
          }
        }

        const mergedDependents = [ ...localState.dependents ];
        const localDepKeys = new Set(mergedDependents.map(d => d.name + '_' + d.relation));
        if (importedState.dependents) {
          importedState.dependents.forEach(dep => {
            const depKey = dep.name + '_' + dep.relation;
            if (!localDepKeys.has(depKey)) {
              mergedDependents.push(dep);
            }
          });
        }

        const mergedState = { statics: mergedStatics, dependents: mergedDependents };
        localStorage.setItem('tax_calculator_state', JSON.stringify(mergedState));
      } else {
        localStorage.setItem('tax_calculator_state', jsonStr);
      }

      loadStateFromLocalStorage();
      
      if (btnCalcIncomeIntegrated) btnCalcIncomeIntegrated.click();
      
      showToast('??배우???�이???�동 �??�기???�료!');
      
      const badge = document.getElementById('sync-status');
      if (badge) {
        badge.textContent = '?�동??;
        badge.className = 'sync-status-badge connected';
      }
      return true;
    } catch (e) {
      console.error(e);
      showToast('???�이???�기???�중 ?�류가 발생?�습?�다.');
      return false;
    }
  }

  // 3. UI 버튼 ?�벤??리스???�결
  const btnSyncGenerate = document.getElementById('btn-sync-generate');
  const btnSyncCopyCode = document.getElementById('btn-sync-copy-code');
  const btnSyncShowQr = document.getElementById('btn-sync-show-qr');
  const btnSyncConnect = document.getElementById('btn-sync-connect');
  const syncCodeDisplay = document.getElementById('sync-code-display');
  const syncCodeVal = document.getElementById('sync-code-val');
  const syncCodeInput = document.getElementById('sync-code-input');
  const syncQrWrapper = document.getElementById('sync-qr-wrapper');
  const syncQrImg = document.getElementById('sync-qr-img');

  const btnOfflineExport = document.getElementById('btn-offline-export');
  const btnOfflineImport = document.getElementById('btn-offline-import');

  if (btnOfflineExport) {
    btnOfflineExport.addEventListener('click', () => {
      const stateStr = serializeState();
      if (!stateStr) return;
      const compressed = btoa(encodeURIComponent(stateStr));
      navigator.clipboard.writeText(compressed).then(() => {
        showToast('?�� ?�동 ?�이??복사 ?�료 (?�립보드)');
      }).catch(() => {
        alert('복사 ?�패. ?�래 ?�스?��? 직접 복사?�세??\n\n' + compressed);
      });
    });
  }

  if (btnOfflineImport) {
    btnOfflineImport.addEventListener('click', () => {
      const inputCode = prompt('복사???�동 ?�이?��? ?�력??주세??');
      if (!inputCode) return;
      try {
        const decoded = decodeURIComponent(atob(inputCode.trim()));
        if (confirm('?�신???�이?�로 기존 ?�이?��? ?�동?�시겠습?�까?\n[?�인]: 배우???�이?�만 머�?\n[취소]: ?�체 ??��?�기')) {
          deserializeAndLoad(decoded, 'merge');
        } else {
          deserializeAndLoad(decoded, 'replace');
        }
      } catch (e) {
        showToast('???�못??코드 ?�식?�니??');
      }
    });
  }

  if (btnSyncGenerate) {
    btnSyncGenerate.addEventListener('click', () => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      syncCodeVal.textContent = code;
      syncCodeDisplay.style.display = 'block';

      if (syncQrImg) {
        const payloadStr = serializeState();
        const encrypted = encryptDecrypt(payloadStr, code);
        syncQrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(encrypted)}`;
      }

      const stateStr = serializeState();
      const encryptedData = encryptDecrypt(stateStr, code);

      fetch(`https://ntfy.sh/tax_sync_${code}`, {
        method: 'POST',
        headers: {
          'Title': 'Tax Data Sync',
          'Priority': '5'
        },
        body: encryptedData
      })
      .then(res => {
        if (res.ok) {
          showToast('?�� ?�동 코드가 ?�성?�었?�니??');
          const badge = document.getElementById('sync-status');
          if (badge) {
            badge.textContent = '코드 ?�기중';
            badge.className = 'sync-status-badge connected';
          }
        } else {
          showToast('???�동 ?�버 ?�신 ?�패 (?�프?�인 ?�동 권장)');
        }
      })
      .catch(err => {
        console.error(err);
        showToast('???�동 ?�패 (?�터???�결???�인?�세??');
      });
    });
  }

  if (btnSyncCopyCode) {
    btnSyncCopyCode.addEventListener('click', () => {
      const code = syncCodeVal.textContent;
      navigator.clipboard.writeText(code).then(() => {
        showToast('???�동 코드가 복사?�었?�니??');
      });
    });
  }

  if (btnSyncShowQr && syncQrWrapper) {
    btnSyncShowQr.addEventListener('click', () => {
      const isHidden = syncQrWrapper.style.display === 'none';
      syncQrWrapper.style.display = isHidden ? 'block' : 'none';
      btnSyncShowQr.textContent = isHidden ? 'QR ?�기' : 'QR 보기';
    });
  }

  if (btnSyncConnect) {
    btnSyncConnect.addEventListener('click', () => {
      const code = syncCodeInput.value.trim();
      if (code.length !== 6 || isNaN(code)) {
        showToast('???�바�?6?�리 ?�자�??�력?�세??');
        return;
      }

      showToast('?�� ?�이??가?�오??�?..');
      fetch(`https://ntfy.sh/tax_sync_${code}/json?poll=1`)
      .then(res => res.text())
      .then(text => {
        const lines = text.trim().split('\n');
        let latestMsg = null;
        for (let i = lines.length - 1; i >= 0; i--) {
          if (!lines[i]) continue;
          const msgObj = JSON.parse(lines[i]);
          if (msgObj.event === 'message' && msgObj.message) {
            latestMsg = msgObj.message;
            break;
          }
        }

        if (!latestMsg) {
          showToast('???�당 ?�동 코드�??�록???�이?��? 찾을 ???�습?�다.');
          return;
        }

        const decryptedJson = decrypt(latestMsg, code);
        if (!decryptedJson) {
          showToast('???�이??복호???�패. ?�바�?코드?��? ?�인??주세??');
          return;
        }

        if (confirm('가?�온 배우???�이?��? ?�동?�시겠습?�까?\n[?�인]: 배우???�이?�만 머�?\n[취소]: ?�체 ??��?�기')) {
          deserializeAndLoad(decryptedJson, 'merge');
        } else {
          deserializeAndLoad(decryptedJson, 'replace');
        }
      })
      .catch(err => {
        console.error(err);
        showToast('???�동 ?�패 (?�터???�결 ?�는 코드가 만료?�었?????�습?�다)');
      });
    });
  }
});

function renderAdvice(containerId, adviceList, actionCallback) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (adviceList.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 1.5rem; opacity:0.6; font-size:0.85rem;">
        ?�� ?��? ?�마?�한 ?�세 비율??만족?�고 계십?�다!
      </div>
    `;
    return;
  }

  adviceList.sort((a, b) => b.saving - a.saving);

  // ?�� P1: �??�감??배�?
  var totalSavings = adviceList.reduce(function(sum, item) { return sum + (item.saving || 0); }, 0);
  if (totalSavings > 0) {
    var badge = document.createElement('div');
    badge.className = 'advice-total-savings-badge';
    badge.innerHTML = '<span class="savings-label">?�� 모두 ?�용 ???�상 추�? ?�감</span><span class="savings-amount">+ ' + totalSavings.toLocaleString() + ' ??/span>';
    container.appendChild(badge);
  }

  // ?�� P1: ?�위 3�??�마???�드 (?�그 ?�함)
  var topN = Math.min(3, adviceList.length);
  var feed = document.createElement('div');
  feed.className = 'advice-smart-feed';
  for (var i = 0; i < topN; i++) {
    var item = adviceList[i];
    var tagHtml = '';
    if (item.saving >= 1000000) {
      tagHtml = '<span class="advice-tag high-value">?�� 고수??/span>';
    } else if (item.saving >= 500000) {
      tagHtml = '<span class="advice-tag high-value">?�� 중수??/span>';
    }
    if (item.type === 'warning' && item.saving > 0) {
      tagHtml += '<span class="advice-tag urgent">?�️ 긴급</span>';
    }
    if (!tagHtml && item.actionText) {
      tagHtml = '<span class="advice-tag easy">??간편</span>';
    }

    var card = document.createElement('div');
    card.className = 'advice-card ' + (item.type || 'info');
    card.innerHTML = [
      '<div class="advice-header">',
        '<span class="advice-title" style="font-size:0.9rem;">' + (i + 1) + '. ' + item.title + tagHtml + '</span>',
        item.saving > 0 ? '<span class="advice-saving" style="font-size:0.75rem;">??+' + item.saving.toLocaleString() + '??/span>' : '',
      '</div>',
      '<p class="advice-desc" style="font-size:0.8rem; line-height:1.4; margin-bottom:8px;">' + item.desc + '</p>',
      item.actionText ? '<button class="advice-action-btn" style="padding:6px 10px; font-size:0.75rem;">' + item.actionText + ' ??/button>' : ''
    ].join('');

    if (item.actionText) {
      card.querySelector('.advice-action-btn').addEventListener('click', function() {
        actionCallback(item.id, item.actionValue);
        // ?�� ?�링???�크�? ?�당 ?�력 ?�드�??�커??
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

  // ?��? ??��?� 기존 캐러?��?
  var remaining = adviceList.slice(topN);
  if (remaining.length === 0) return;

  var totalSlides = remaining.length;
  var currentSlide = 0;

  var expandToggle = document.createElement('button');
  expandToggle.style.cssText = 'background:none; border:none; color:var(--accent-info); font-weight:700; font-size:0.78rem; cursor:pointer; padding:8px 0; width:100%; text-align:center;';
  expandToggle.textContent = '??추�? 가?�드 ' + remaining.length + '�???보기';
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
        item.saving > 0 ? '<span class="advice-saving" style="font-size:0.75rem;">??+' + item.saving.toLocaleString() + '???�감</span>' : '',
      '</div>',
      '<p class="advice-desc" style="font-size:0.8rem; line-height:1.4; margin-bottom:8px;">' + item.desc + '</p>',
      item.actionText ? '<button class="advice-action-btn" style="padding:6px 10px; font-size:0.75rem;">' + item.actionText + ' ??/button>' : ''
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
    expandToggle.textContent = isHidden ? '???�기' : '??추�? 가?�드 ' + remaining.length + '�???보기';
  });

  var nav = document.createElement('div');
  nav.className = 'advice-carousel-nav';

  var prevBtn = document.createElement('button');
  prevBtn.className = 'advice-carousel-btn';
  prevBtn.innerHTML = '&#9664;';
  prevBtn.setAttribute('aria-label', '?�전 가?�드');
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
  nextBtn.setAttribute('aria-label', '?�음 가?�드');
  nextBtn.addEventListener('click', function() { showSlide(currentSlide + 1); });

  nav.appendChild(prevBtn);
  nav.appendChild(counter);
  nav.appendChild(dotsContainer);
  nav.appendChild(nextBtn);
  carousel.appendChild(nav);

  container.appendChild(carousel);

  // ?�� 브레?�크??초기??
  const activeTab = document.querySelector('.nav-step-btn.active');
  if (activeTab) {
    updateBreadcrumb(activeTab.dataset.tab);
  }

  // ?�� Profiling modal (�?방문 ??
  function initProfilingModal() {
    var modal = document.getElementById('profiling-modal');
    if (!modal) return;
    var done = localStorage.getItem('tax_profiling_done');
    if (done) return;
    modal.style.display = 'flex';

    function getSelected() {
      var checks = document.querySelectorAll('.profiling-check:checked');
      return Array.from(checks).map(function(c) { return c.value; });
    }

    document.getElementById('btn-profiling-submit').addEventListener('click', function() {
      var sel = getSelected();
      if (sel.length === 0) { sel = ['salary']; }
      localStorage.setItem('tax_profiling_done', '1');
      localStorage.setItem('tax_profiling_types', JSON.stringify(sel));
      modal.style.display = 'none';

      var msg = [];
      if (sel.indexOf('salary') >= 0) msg.push('?�� 직장????��???�말?�산·카드·?�세 최적??);
      if (sel.indexOf('business') >= 0) msg.push('?�� ?�업·?�자 ??��??부가?�·경비율·?��??�산');
      if (sel.indexOf('invest') >= 0) msg.push('?�� ?�업·?�자 ??��??ISA·채권·벤처?�자');
      if (sel.indexOf('property') >= 0) msg.push('?�� ?�속·증여 ??��??보유?�·양?�세');
      if (sel.indexOf('estate') >= 0) msg.push('?�� ?�속·증여 ??��??증여·?�속 ?�랜');

      var resultEl = document.getElementById('profiling-result');
      resultEl.style.display = 'block';
      resultEl.innerHTML = '???�택 ?�료! ?�래 ??�� 추천?�니??<br>??' + msg.join('<br>??');
      setTimeout(function() { resultEl.style.display = 'none'; }, 5000);
    });

    document.getElementById('btn-profiling-skip').addEventListener('click', function() {
      localStorage.setItem('tax_profiling_done', '1');
      modal.style.display = 'none';
    });
  }
    // 벤처투자 치트키 시뮬레이션
    const toggleVentureSim = document.getElementById('toggle-venture-sim');
    if (toggleVentureSim) {
      toggleVentureSim.addEventListener('change', (e) => {
        const ventureResultDiv = document.getElementById('venture-sim-result');
        if (!ventureResultDiv) return;
        
        if (e.target.checked) {
          // 기존 데이터 가져오기
          const aSalary = parseVal('inc-a-salary') || 0;
          const aPension = parseVal('inc-a-pension') || 0;
          const aCard = parseVal('inc-a-card') || 0;
          const aCash = parseVal('inc-a-cash') || 0;
          
          if (aSalary === 0) {
            alert("총급여를 먼저 입력해주세요.");
            e.target.checked = false;
            return;
          }
          
          // 벤처투자 전 세금
          const beforeResult = TaxCalculator.calculateYearEndTax({
            totalSalary: aSalary,
            creditCard: aCard,
            cashReceipt: aCash,
            pensionSavings: aPension,
            ventureInvestment: 0
          });
          
          // 벤처투자 후 세금 (3천만원 가정)
          const afterResult = TaxCalculator.calculateYearEndTax({
            totalSalary: aSalary,
            creditCard: aCard,
            cashReceipt: aCash,
            pensionSavings: aPension,
            ventureInvestment: 30000000
          });
          
          const saving = beforeResult.totalTax - afterResult.totalTax;
          
          document.getElementById('venture-before-tax').innerText = formatNumberWithCommas(beforeResult.totalTax) + ' 원';
          document.getElementById('venture-after-tax').innerText = formatNumberWithCommas(afterResult.totalTax) + ' 원';
          document.getElementById('venture-saving-tax').innerText = formatNumberWithCommas(saving) + ' 원';
          
          ventureResultDiv.style.display = 'block';
        } else {
          ventureResultDiv.style.display = 'none';
        }
      });
    }



  // ──────────────────────────────────────────────
  // 10대 절세 기능 고도화: 대시보드, 퀵 필터, 세율구간, 시나리오, 세금달력
  // ──────────────────────────────────────────────
  const initDashboardAndWidgets = () => {
    // 1. 퀵 필터 설정
    const filterChips = document.querySelectorAll('.filter-chip');
    filterChips.forEach(chip => {
      chip.addEventListener('click', (e) => {
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        applyQuickFilter(chip.dataset.filter);
      });
    });

    function applyQuickFilter(category) {
      const allCards = document.querySelectorAll('.input-card, .result-card, .category-section-header');
      const allTreeLinks = document.querySelectorAll('.nav-tree-link');
      
      if (category === 'all') {
        allCards.forEach(c => c.classList.remove('dimmed'));
        allTreeLinks.forEach(l => l.classList.remove('dimmed'));
        return;
      }

      // Keyword mapping for auto-tagging
      const keywordMap = {
        wage: ['카드', '체육시설', '월세', '보장성', '기부', '표준', '친환경', '주택', '연금저축/IRP', '연말정산', '가족 요약', '의료비'],
        business: ['부가가치세', '경비율', '종합소득세', '노란우산', '사업소득', '프리랜서'],
        investment: ['채권', '벤처', '금융소득', '투자자'],
        property: ['양도소득세', '보유세', '간주임대료', '부동산'],
        estate: ['상속세', '증여']
      };

      const keywords = keywordMap[category] || [];

      allCards.forEach(card => {
        // 정보 입력 카드(기본 정보)는 항상 제외
        if (card.querySelector('.card-title') && card.querySelector('.card-title').textContent.includes('정보 입력')) {
          card.classList.remove('dimmed');
          return;
        }
        
        let cardText = card.textContent || '';
        const isMatch = keywords.some(kw => cardText.includes(kw));
        if (isMatch) {
          card.classList.remove('dimmed');
        } else {
          card.classList.add('dimmed');
        }
      });

      // Sync with Sidebar Tree Links
      allTreeLinks.forEach(link => {
        let linkText = link.textContent || '';
        const isMatch = keywords.some(kw => linkText.includes(kw));
        if (isMatch) {
          link.classList.remove('dimmed');
        } else {
          link.classList.add('dimmed');
        }
      });
    }

    // 2. 세율 시각화 마커 위치 조절 함수
    window.updateTaxVisualizer = function(taxableIncome) {
      let percent = 0;
      let currentRate = "6%";
      if (taxableIncome <= 14000000) {
        percent = (taxableIncome / 14000000) * 14;
        currentRate = "6%";
      } else if (taxableIncome <= 50000000) {
        percent = 14 + ((taxableIncome - 14000000) / 36000000) * 16;
        currentRate = "15%";
      } else if (taxableIncome <= 88000000) {
        percent = 14 + 16 + ((taxableIncome - 50000000) / 38000000) * 15;
        currentRate = "24%";
      } else if (taxableIncome <= 150000000) {
        percent = 14 + 16 + 15 + ((taxableIncome - 88000000) / 62000000) * 15;
        currentRate = "35%";
      } else if (taxableIncome <= 300000000) {
        percent = 14 + 16 + 15 + 15 + ((taxableIncome - 150000000) / 150000000) * 12;
        currentRate = "38%";
      } else if (taxableIncome <= 500000000) {
        percent = 14 + 16 + 15 + 15 + 12 + ((taxableIncome - 300000000) / 200000000) * 10;
        currentRate = "40%";
      } else if (taxableIncome <= 1000000000) {
        percent = 14 + 16 + 15 + 15 + 12 + 10 + ((taxableIncome - 500000000) / 500000000) * 10;
        currentRate = "42%";
      } else {
        percent = 92 + Math.min(8, ((taxableIncome - 1000000000) / 1000000000) * 8);
        currentRate = "45%";
      }
      percent = Math.min(100, Math.max(0, percent));
      
      const pin = document.getElementById('tax-pin-marker');
      if (pin) pin.style.left = percent + '%';
      const label = document.getElementById('tax-pin-label');
      if (label) label.textContent = currentRate;
      
      const info = document.getElementById('tax-visual-info');
      if (info) {
        let nextLimit = "";
        let nextRate = "";
        if (taxableIncome <= 14000000) { nextLimit = "1,400만 원"; nextRate = "15%"; }
        else if (taxableIncome <= 50000000) { nextLimit = "5,000만 원"; nextRate = "24%"; }
        else if (taxableIncome <= 88000000) { nextLimit = "8,800만 원"; nextRate = "35%"; }
        else if (taxableIncome <= 150000000) { nextLimit = "1.5억 원"; nextRate = "38%"; }
        else if (taxableIncome <= 300000000) { nextLimit = "3억 원"; nextRate = "40%"; }
        else if (taxableIncome <= 500000000) { nextLimit = "5억 원"; nextRate = "42%"; }
        else if (taxableIncome <= 1000000000) { nextLimit = "10억 원"; nextRate = "45%"; }
        
        if (nextLimit) {
          info.innerHTML = `💡 과세표준 <b>${Math.floor(taxableIncome / 10000).toLocaleString()}만 원</b> 기준 구간입니다.<br>${nextLimit} 초과 시 <b>${nextRate}</b> 구간으로 상승합니다.`;
        } else {
          info.innerHTML = "🔥 최고 세율 구간(45%)에 진입하셨습니다. 추가 절세 방안을 총동원해 보세요.";
        }
      }
    };

    // 3. 실시간 대시보드 업데이트 함수
    window.updateDashboardSummary = function(d) {
      const hasSpouseB = document.getElementById('enable-spouse-b') ? document.getElementById('enable-spouse-b').checked : false;
      const summary = TaxCalculator.calculateDashboardSummary({
        aSalary: d.aSalary,
        aBusinessRev: d.aBusinessRevenue,
        aBusinessExp: d.aBusinessExpense,
        aFinancialGen: d.aFinancialGen,
        aFinancialOverseas: d.aFinancialOverseas,
        bSalary: d.bSalary,
        bBusinessRev: d.bBusinessRevenue,
        bBusinessExp: d.bBusinessExpense,
        bFinancialGen: d.bFinancialGen,
        bFinancialOverseas: d.bFinancialOverseas,
        hasSpouseB: hasSpouseB
      });

      document.getElementById('dash-total-tax').textContent = formatNumberWithCommas(summary.totalTax) + ' 원';
      document.getElementById('dash-effective-rate').textContent = summary.effectiveRate + '%';
      document.getElementById('dash-net-return').textContent = formatNumberWithCommas(summary.netReturn) + ' 원';
      
      updateTaxVisualizer(summary.primaryTaxableIncome);
    };

    // 4. 절세 기회 알림 배지 (Nudge System)
    window.updateNudgeBadges = function(d) {
      // Clean up previous badges
      document.querySelectorAll('.nudge-badge').forEach(b => b.remove());

      const nudges = [];
      
      // IRP/연금저축
      if (d.aSalary > 0 && d.aPension === 0 && d.aIrp === 0) {
        nudges.push({ tab: 'salary', text: '연금저축/IRP 공제 팁', selector: '[data-tab="salary"]', titleKeyword: '연금저축/IRP' });
      }
      
      // 노란우산공제
      if (d.aBusinessRevenue > 10000000 && d.aYellow === 0) {
        nudges.push({ tab: 'business', text: '노란우산공제 팁', selector: '[data-tab="business"]', titleKeyword: '노란우산공제' });
      }

      // 벤처투자
      if (d.aSalary > 80000000 && d.aVenture === 0) {
        nudges.push({ tab: 'business', text: '벤처투자 100% 공제', selector: '[data-tab="business"]', titleKeyword: '벤처투자' });
      }

      nudges.forEach(n => {
        // Add indicator badge to Tab button
        const topStepBtn = document.querySelector(`.nav-step-btn[data-tab="${n.tab}"]`);
        if (topStepBtn && !topStepBtn.querySelector('.nudge-badge')) {
          const badge = document.createElement('span');
          badge.className = 'nudge-badge';
          badge.textContent = '💡 팁';
          topStepBtn.appendChild(badge);
        }

        // Add indicator to left sidebar link
        const sidebarLink = Array.from(document.querySelectorAll('.nav-tree-link')).find(link => link.textContent.includes(n.titleKeyword));
        if (sidebarLink && !sidebarLink.querySelector('.nudge-badge')) {
          const badge = document.createElement('span');
          badge.className = 'nudge-badge info';
          badge.textContent = '💡';
          sidebarLink.appendChild(badge);
        }
      });
    };

    // 5. IndexedDB 기반 절세 시나리오 매니저 (R4)
    window.loadScenarios = () => {
      const select = document.getElementById('scenario-compare-select');
      if (!select) return;
      select.innerHTML = '<option value="">비교할 시나리오 선택...</option>';
      
      if (!db) return;
      const tx = db.transaction(["scenarios"], "readonly");
      const store = tx.objectStore("scenarios");
      const req = store.getAllKeys();
      req.onsuccess = () => {
        const keys = req.result;
        keys.forEach(key => {
          const opt = document.createElement('option');
          opt.value = key;
          opt.textContent = key;
          select.appendChild(opt);
        });
      };
    };

    document.getElementById('btn-save-scenario').addEventListener('click', () => {
      const name = document.getElementById('scenario-name-input').value.trim();
      if (!name) {
        alert("시나리오 이름을 입력해주세요.");
        return;
      }
      
      const currentState = localStorage.getItem('tax_calculator_state');
      if (!currentState) {
        alert("저장할 데이터 상태가 존재하지 않습니다.");
        return;
      }

      if (!db) {
        alert("데이터베이스가 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }

      const tx = db.transaction(["scenarios"], "readwrite");
      const store = tx.objectStore("scenarios");
      store.put(JSON.parse(currentState), name);
      
      tx.oncomplete = () => {
        document.getElementById('scenario-name-input').value = '';
        loadScenarios();
        showToast(`시나리오 "${name}" IndexedDB 저장 완료!`);
      };
    });

    document.getElementById('btn-delete-scenario').addEventListener('click', () => {
      const select = document.getElementById('scenario-compare-select');
      const name = select.value;
      if (!name) {
        alert("삭제할 시나리오를 선택해주세요.");
        return;
      }

      if (!db) return;

      const tx = db.transaction(["scenarios"], "readwrite");
      const store = tx.objectStore("scenarios");
      store.delete(name);
      
      tx.oncomplete = () => {
        loadScenarios();
        document.getElementById('scenario-compare-result').style.display = 'none';
        showToast(`시나리오 "${name}" 삭제 완료.`);
      };
    });

    document.getElementById('btn-compare-scenario').addEventListener('click', () => {
      const select = document.getElementById('scenario-compare-select');
      const name = select.value;
      if (!name) {
        alert("비교할 시나리오를 선택해주세요.");
        return;
      }

      if (!db) return;

      const tx = db.transaction(["scenarios"], "readonly");
      const store = tx.objectStore("scenarios");
      const req = store.get(name);
      
      req.onsuccess = () => {
        const savedState = req.result;
        const currentState = JSON.parse(localStorage.getItem('tax_calculator_state') || '{}');
        
        if (!savedState) return;

        // 간단 비교
        const savedTax = savedState.calculatedTax || 0;
        const currentTax = currentState.calculatedTax || 0;
        const diff = savedTax - currentTax;

        const resultBox = document.getElementById('scenario-compare-result');
        resultBox.style.display = 'block';
        if (diff > 0) {
          resultBox.innerHTML = `⚖️ <b>"${name}" 대비 현재 상태:</b><br>총 세금이 <b>\${formatNumberWithCommas(diff)}원</b> 더 절감됩니다! (세후 실수령액 증가)`;
        } else if (diff < 0) {
          resultBox.innerHTML = `⚖️ <b>"${name}" 대비 현재 상태:</b><br>총 세금이 <b>\${formatNumberWithCommas(Math.abs(diff))}원</b> 더 많이 청구됩니다. (이전안이 더 유리)`;
        } else {
          resultBox.innerHTML = `⚖️ <b>"${name}" 대비 현재 상태:</b><br>세액 변동이 없습니다. 동일한 절세 금액입니다.`;
        }
      };
    });

    // 6. 세금 달력 타임라인 렌더링 및 스무스 이동 가이드
    const renderTaxCalendar = () => {
      const calendarContainer = document.getElementById('tax-calendar-items');
      if (!calendarContainer) return;

      const currentMonth = new Date().getMonth() + 1;
      const schedules = [
        { month: 1, title: '💼 연말정산 서류 제출', desc: '홈택스 PDF 자동 입력을 사용해 보세요 👉', tabId: 'tab-profile', scrollKeyword: 'pdf-dropzone' },
        { month: 5, title: '🏭 종합소득세 신고기간', desc: '개인사업자 종합소득세 간편 계산기로 이동 👉', tabId: 'tab-business', scrollKeyword: '개인사업자 종합소득세' },
        { month: 7, title: '🏠 재산세 1기 납부', desc: '부동산 보유세 계산기로 이동 👉', tabId: 'tab-capital', scrollKeyword: '부동산 보유세' },
        { month: 9, title: '🏠 재산세 2기 납부', desc: '부동산 보유세 계산기로 이동 👉', tabId: 'tab-capital', scrollKeyword: '부동산 보유세' },
        { month: 11, title: '🏭 종합소득세 중간예납', desc: '종소세 간편 계산기로 이동 👉', tabId: 'tab-business', scrollKeyword: '개인사업자 종합소득세' },
        { month: 12, title: '🛡️ 연금저축/IRP 불입 마감', desc: '연금저축/IRP 세액공제 최적화 도구로 이동 👉', tabId: 'tab-salary', scrollKeyword: '연금저축/IRP' }
      ];

      let calendarHtml = '';
      schedules.forEach(s => {
        const isCurrent = s.month === currentMonth || (currentMonth === 2 && s.month === 1); // 1~2월 연말정산
        calendarHtml += `
          <div class="calendar-item \${isCurrent ? 'current' : ''}" data-nav-tab="\${s.tabId}" data-scroll-keyword="\${s.scrollKeyword}" style="cursor: pointer; transition: all 0.2s;">
            <div class="calendar-month">\${s.month}월</div>
            <div class="calendar-details">
              <div class="calendar-title">\${s.title}</div>
              <div class="calendar-desc" style="color:var(--accent-secondary); font-weight:600;">\${s.desc}</div>
            </div>
          </div>
        `;
      });
      calendarContainer.innerHTML = calendarHtml;

      // Add navigation handlers to calendar items
      calendarContainer.querySelectorAll('.calendar-item').forEach(item => {
        item.addEventListener('click', () => {
          const tabId = item.getAttribute('data-nav-tab');
          const scrollKeyword = item.getAttribute('data-scroll-keyword');
          
          // Switch to target tab
          const topStepBtn = document.querySelector(`.nav-step-btn[data-tab="\${tabId.replace('tab-', '')}"]`);
          if (topStepBtn) {
            topStepBtn.click();
          }

          // Scroll to matching card
          setTimeout(() => {
            const allHeaders = document.querySelectorAll('.card-title, #pdf-dropzone');
            let targetEl = null;
            allHeaders.forEach(el => {
              if (el.textContent.includes(scrollKeyword) || el.id === scrollKeyword) {
                targetEl = el.closest('.input-card, .result-card, .pdf-dropzone');
              }
            });

            if (targetEl) {
              targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
              
              // Flash animation
              const originalBg = targetEl.style.backgroundColor;
              targetEl.style.transition = 'background-color 0.5s';
              targetEl.style.backgroundColor = 'rgba(108, 99, 255, 0.2)';
              setTimeout(() => {
                targetEl.style.backgroundColor = originalBg;
              }, 1000);
            }
          }, 150);
        });
      });
    };

    loadScenarios();
    renderTaxCalendar();

    // 11. PWA 설치 배너 연동
    let deferredPrompt;
    const pwaBanner = document.getElementById('pwa-install-banner');
    const btnPwaInstall = document.getElementById('btn-pwa-install');

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (pwaBanner) pwaBanner.style.display = 'block';
    });

    if (btnPwaInstall) {
      btnPwaInstall.addEventListener('click', () => {
        if (!deferredPrompt) return;
        pwaBanner.style.display = 'none';
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('User accepted PWA installation');
          }
          deferredPrompt = null;
        });
      });
    }

    // 12. 글로벌 모의 시뮬레이션 상태 객체
    window.simulatedActions = {
      pension: false,
      donation: false,
      venture: false,
      yellow: false
    };

    // 13. 실시간 절세 체크리스트 생성 및 렌더링
    window.updateActionChecklist = function(d) {
      const container = document.getElementById('dashboard-checklist-container');
      if (!container) return;

      const items = [];

      // 연금저축/IRP 팁
      const currentPension = d.aPension + d.aIrp;
      if (d.aSalary > 0 && currentPension < 9000000) {
        items.push({
          id: 'pension',
          label: `연금저축/IRP 한도 채우기 (연 900만)`,
          saving: '최대 148.5만 원 환급',
          checked: window.simulatedActions.pension
        });
      }

      // 고향사랑기부제 팁
      if (d.aSalary > 0 && d.aHometown === undefined) { // Check if not optimal
        items.push({
          id: 'donation',
          label: '고향사랑기부금 20만 원 최적 납입',
          saving: '14.4만 세액공제 + 6만 답례품',
          checked: window.simulatedActions.donation
        });
      }

      // 벤처투자
      if (d.aSalary > 80000000 && d.aVenture === 0) {
        items.push({
          id: 'venture',
          label: '벤처투자 100% 소득공제 (3,000만)',
          saving: '한도 내 최대 1,155만 원 절세',
          checked: window.simulatedActions.venture
        });
      }

      // 노란우산
      if (d.aBusinessRevenue > 10000000 && d.aYellow === 0) {
        items.push({
          id: 'yellow',
          label: '노란우산공제 최대 납입 (연 500만)',
          saving: '최대 115만 원 소득공제',
          checked: window.simulatedActions.yellow
        });
      }

      if (items.length === 0) {
        container.innerHTML = `<div style="font-size:0.75rem; text-align:center; opacity:0.6; padding:10px;">🎉 현재 상황에서 가능한 절세 액션을 모두 완료했습니다!</div>`;
        return;
      }

      let checklistHtml = '';
      items.forEach(item => {
        checklistHtml += `
          <div class="checklist-item \${item.checked ? 'checked' : ''}" data-action-id="\${item.id}">
            <input type="checkbox" class="checklist-checkbox" \${item.checked ? 'checked' : ''} />
            <div class="checklist-label-group" style="flex:1;">
              <div class="checklist-label">\${item.label}</div>
              <div class="checklist-saving-badge">\${item.saving}</div>
            </div>
          </div>
        `;
      });
      container.innerHTML = checklistHtml;

      // Bind checklist click handlers
      container.querySelectorAll('.checklist-item').forEach(item => {
        item.addEventListener('click', (e) => {
          // If clicking background or label
          const checkbox = item.querySelector('.checklist-checkbox');
          if (e.target !== checkbox) {
            checkbox.checked = !checkbox.checked;
          }
          
          const actionId = item.getAttribute('data-action-id');
          window.simulatedActions[actionId] = checkbox.checked;
          
          // Re-trigger calculation to apply simulation
          const btnCalc = document.getElementById("btn-calc-income-integrated");
          if (btnCalc) btnCalc.click();
        });
      });
    };

    // 14. SVG 자산 배분 도넛 차트 렌더링
    window.renderDashboardCharts = function(d, totalTax) {
      const chartSection = document.getElementById('acc-asset-chart');
      if (!chartSection) return;

      const hasSpouseB = document.getElementById('enable-spouse-b') ? document.getElementById('enable-spouse-b').checked : false;
      const totalIncome = d.aSalary + Math.max(0, d.aBusinessRevenue - d.aBusinessExpense) + d.aFinancialGen + d.aFinancialOverseas +
                          (hasSpouseB ? (d.bSalary + Math.max(0, d.bBusinessRevenue - d.bBusinessExpense) + d.bFinancialGen + d.bFinancialOverseas) : 0);
      
      if (totalIncome <= 0) {
        chartSection.style.display = 'none';
        return;
      }

      chartSection.style.display = 'block';

      // 저축액 집계 (연금저축/IRP/벤처투자/노란우산 등)
      const savings = d.aPension + d.aIrp + d.aVenture + d.aYellow +
                      (hasSpouseB ? (d.bPension + d.bIrp + d.bVenture + d.bYellow) : 0);
      
      const taxAmount = totalTax;
      const spendAmount = Math.max(0, totalIncome - taxAmount - savings);

      const taxRatio = taxAmount / totalIncome;
      const savingsRatio = savings / totalIncome;
      const spendRatio = spendAmount / totalIncome;

      const taxPercent = Math.round(taxRatio * 100);
      const savingsPercent = Math.round(savingsRatio * 100);
      const spendPercent = Math.round(spendRatio * 100);
      const netReturnPercent = Math.round((1 - taxRatio) * 100);

      // Circle Circumference = 2 * PI * r = 2 * 3.14159 * 80 = 502
      const circumference = 502;
      
      // Update label percents
      document.getElementById('chart-net-percent').textContent = netReturnPercent + '%';
      document.getElementById('chart-lbl-tax').textContent = taxPercent + '%';
      document.getElementById('chart-lbl-saving').textContent = savingsPercent + '%';
      document.getElementById('chart-lbl-spend').textContent = spendPercent + '%';

      // Segments Dash Offset Calculation
      const taxOffset = circumference - (circumference * taxRatio);
      const savingOffset = circumference - (circumference * savingsRatio);
      const spendOffset = circumference - (circumference * spendRatio);

      const arcTax = document.getElementById('chart-arc-tax');
      const arcSaving = document.getElementById('chart-arc-saving');
      const arcSpend = document.getElementById('chart-arc-spend');

      // Set dash offsets
      if (arcTax) {
        arcTax.style.strokeDashoffset = taxOffset;
        arcTax.setAttribute('transform', `rotate(-90 100 100)`);
      }
      if (arcSaving) {
        arcSaving.style.strokeDashoffset = savingOffset;
        // Rotate offset starts after Tax arc
        const savingRotation = -90 + (taxRatio * 360);
        arcSaving.setAttribute('transform', `rotate(\${savingRotation} 100 100)`);
      }
      if (arcSpend) {
        arcSpend.style.strokeDashoffset = spendOffset;
        // Rotate offset starts after Tax + Saving arcs
        const spendRotation = -90 + ((taxRatio + savingsRatio) * 360);
        arcSpend.setAttribute('transform', `rotate(\${spendRotation} 100 100)`);
      }
    };

    // 7. 가상자산(코인) 과세 계산기 연동
    const btnCalcCrypto = document.getElementById('btn-calc-crypto');
    const cryptoGainInput = document.getElementById('crypto-gain');
    const cryptoResultDiv = document.getElementById('crypto-result');
    const cryptoResultContent = document.getElementById('crypto-result-content');

    if (btnCalcCrypto && cryptoGainInput) {
      // Add formatting listener to crypto gain input
      cryptoGainInput.addEventListener('input', formatInputOnEvent);
      cryptoGainInput.addEventListener('change', formatInputOnEvent);

      // Bind formatting to crypto loss input as well
      const cryptoLossInput = document.getElementById('crypto-loss');
      if (cryptoLossInput) {
        cryptoLossInput.addEventListener('input', formatInputOnEvent);
        cryptoLossInput.addEventListener('change', formatInputOnEvent);
      }

      btnCalcCrypto.addEventListener('click', () => {
        const gainVal = parseVal('crypto-gain');
        const lossVal = parseVal('crypto-loss');
        const res = TaxCalculator.calculateCryptoTax(gainVal, lossVal);
        
        cryptoResultContent.innerHTML = `
          <div style="margin-bottom: 8px;">💵 총 양도차익: <b>\${formatNumberWithCommas(res.gain)} 원</b></div>
          \${res.carryoverLoss > 0 ? `<div style="margin-bottom: 8px;">📉 이월결손금 공제: <b>\${formatNumberWithCommas(res.carryoverLoss)} 원</b></div>` : ''}
          <div style="margin-bottom: 8px;">🛡️ 가상자산 기본공제: <b>\${formatNumberWithCommas(res.deduction)} 원</b></div>
          <div style="margin-bottom: 8px;">과세표준: <b>\${formatNumberWithCommas(res.taxableAmount)} 원</b></div>
          <div style="margin-bottom: 8px; color: var(--accent-secondary); font-size: 0.95rem;">
            <b>예상 납부세액: \${formatNumberWithCommas(res.totalTax)} 원</b> (지방세 10% 포함)
          </div>
          <p style="margin: 8px 0 0 0; font-size: 0.75rem; opacity: 0.8; line-height: 1.4;">
            💡 \${res.recommendation}
          </p>
        `;
        cryptoResultDiv.style.display = 'block';
      });

      // Hook up to debounced updates if desired
      cryptoGainInput.addEventListener('input', debounce(() => {
        if (!isLoadingState && cryptoGainInput.value) {
          btnCalcCrypto.click();
        }
      }, 500));
    }


    // 7.1 금융투자소득세(금투세) 심화 시뮬레이터 연동 (R2)
    const btnCalcFit = document.getElementById('btn-calc-fit');
    const fitStockGain = document.getElementById('fit-stock-gain');
    const fitOtherGain = document.getElementById('fit-other-gain');
    const fitLoss = document.getElementById('fit-loss');
    const fitResultDiv = document.getElementById('fit-result');
    const fitResultContent = document.getElementById('fit-result-content');

    if (btnCalcFit && fitStockGain && fitOtherGain && fitLoss) {
      [fitStockGain, fitOtherGain, fitLoss].forEach(el => {
        el.addEventListener('input', formatInputOnEvent);
        el.addEventListener('change', formatInputOnEvent);
      });

      btnCalcFit.addEventListener('click', () => {
        const stockVal = parseVal('fit-stock-gain');
        const otherVal = parseVal('fit-other-gain');
        const lossVal = parseVal('fit-loss');
        const res = TaxCalculator.calculateFinancialInvestmentTax(stockVal, otherVal, lossVal);
        
        fitResultContent.innerHTML = `
          <div style="margin-bottom: 8px;">📉 주식/채권형 과세대상: <b>\${formatNumberWithCommas(res.stockGain)} 원</b></div>
          <div style="margin-bottom: 8px;">📈 기타 금융투자 과세대상: <b>\${formatNumberWithCommas(res.otherGain)} 원</b></div>
          \${res.carryoverLoss > 0 ? `<div style="margin-bottom: 8px;">📉 금융투자 이월결손금 공제: <b>\${formatNumberWithCommas(res.carryoverLoss)} 원</b></div>` : ''}
          <div style="margin-bottom: 8px;">과세표준 합계: <b>\${formatNumberWithCommas(res.totalBase)} 원</b></div>
          <div style="margin-bottom: 8px; color: var(--accent-secondary); font-size: 0.95rem;">
            <b>예상 금투세 세액: \${formatNumberWithCommas(res.totalTax)} 원</b> (지방소득세 포함)
          </div>
          <p style="margin: 8px 0 0 0; font-size: 0.75rem; opacity: 0.8; line-height: 1.4;">
            💡 \${res.recommendation}
          </p>
        `;
        fitResultDiv.style.display = 'block';
      });

      [fitStockGain, fitOtherGain, fitLoss].forEach(el => {
        el.addEventListener('input', debounce(() => {
          if (!isLoadingState) {
            btnCalcFit.click();
          }
        }, 500));
      });
    }

    // 8. PDF 다운로드 및 인쇄 버튼 연동
    const btnPrintReport = document.getElementById('btn-print-report');
    if (btnPrintReport) {
      btnPrintReport.addEventListener('click', () => {
        window.print();
      });
    }

    // 9. 세무사 1:1 상담 연결 CTA 연동
    const btnExpertCta = document.getElementById('btn-expert-cta');
    if (btnExpertCta) {
      btnExpertCta.addEventListener('click', () => {
        alert("🤝 TAX NAVI Premium 세무 컨설팅\n\n정교한 상속/증여세 설계, 벤처투자 소득공제(3천만 원 이상) 세무 조정이 필요하신가요?\nTAX NAVI와 제휴된 전문 세무 법인을 통해 1:1 세무사 무료 유선 상담을 예약하실 수 있습니다.\n\n[상담 신청서 작성 페이지로 이동합니다 (데모)]");
      });
    }

    // 10. 카카오톡 / 링크 공유 기능 연동
    const btnShareReportNew = document.getElementById('btn-share-report');
    if (btnShareReportNew) {
      btnShareReportNew.addEventListener('click', () => {
        const amountEl = document.getElementById('floating-bar-amount');
        const bestTax = amountEl ? amountEl.textContent : '0 원';
        
        const shareData = {
          title: 'TAX NAVI 대한민국 종합 절세 시뮬레이터',
          text: `우리 가족 최적화 합산 세액은 [${bestTax}]입니다! TAX NAVI를 통해 실시간으로 맞춤형 절세 혜택을 확인해 보세요.`,
          url: window.location.href
        };

        if (navigator.share) {
          navigator.share(shareData)
            .then(() => showToast('공유 완료!'))
            .catch((err) => console.log('Share failed', err));
        } else {
          // Fallback to clipboard copy
          const textToCopy = `${shareData.text}\n👉 절세 시뮬레이터 바로가기: ${shareData.url}`;
          navigator.clipboard.writeText(textToCopy)
            .then(() => {
              showToast('📋 링크와 요약 내역이 클립보드에 복사되었습니다!');
            })
            .catch(() => {
              alert('클립보드 복사에 실패했습니다. 주소창의 링크를 공유해 주세요.');
            });
        }
      });
    }

  };

  initDashboardAndWidgets();

  initProfilingModal();
}


// ==========================================
// Sidebar & Menu Map Logic
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
  const sidebarMenu = document.getElementById('sidebar-menu');
  const btnOpenSidebar = document.getElementById('btn-open-sidebar');
  const btnCloseSidebar = document.getElementById('btn-close-sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const navTreeContainer = document.getElementById('sidebar-nav-tree');
  
  if (!sidebarMenu || !navTreeContainer) return;

  // Toggle Sidebar for mobile
  function toggleSidebar(show) {
    if (show) {
      sidebarMenu.classList.add('open');
      sidebarOverlay.classList.add('show');
      document.body.style.overflow = 'hidden'; // prevent bg scroll
    } else {
      sidebarMenu.classList.remove('open');
      sidebarOverlay.classList.remove('show');
      document.body.style.overflow = '';
    }
  }

  if (btnOpenSidebar) {
    btnOpenSidebar.addEventListener('click', () => toggleSidebar(true));
  }
  if (btnCloseSidebar) {
    btnCloseSidebar.addEventListener('click', () => toggleSidebar(false));
  }
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => toggleSidebar(false));
  }

  // Generate Menu Map
  const tabs = document.querySelectorAll('.calculator-panel');
  const tabButtons = document.querySelectorAll('.nav-step-btn');
  
  let menuHtml = '';
  const sectionsData = [];
  
  // Mapping tab IDs to names for the tree
  const tabNames = {
    'tab-profile': '내 정보 입력',
    'tab-salary': '직장인·연말정산',
    'tab-business': '사업·투자·절세',
    'tab-capital': '상속·증여·양도',
    'tab-report': '종합 리포트'
  };

  tabs.forEach((tab, index) => {
    const tabId = tab.id;
    const tabName = tabNames[tabId] || tabId;
    
    menuHtml += `<div class="nav-tree-item" data-target-tab="${tabId}">`;
    menuHtml += `<div class="nav-tree-tab ${index === 0 ? 'active' : ''}" data-tab="${tabId}">
                   <span style="font-size:1.1rem; opacity:0.8;">${index + 1}.</span> ${tabName}
                 </div>`;
    menuHtml += `<div class="nav-tree-sub">`;
    
    // Find all titles in this tab
    const titles = tab.querySelectorAll('.card-title, .category-section-header h3');
    titles.forEach((titleEl, tIdx) => {
      // Ensure the title or its parent has an ID for scrolling
      let targetId = titleEl.id;
      if (!targetId) {
        // If no ID, check parent input-card
        const parentCard = titleEl.closest('.input-card, .result-card');
        if (parentCard && parentCard.id) {
          targetId = parentCard.id;
        } else {
          // Generate an ID
          targetId = `menu-target-${tabId}-${tIdx}`;
          titleEl.id = targetId;
        }
      }
      
      let titleText = titleEl.textContent.trim();
      // Remove emojis using a simple regex if desired, or keep them. We'll keep them for consistency.
      
      menuHtml += `<a class="nav-tree-link" data-scroll-to="${targetId}" data-parent-tab="${tabId}">${titleText}</a>`;
      sectionsData.push({ id: targetId, tabId: tabId, el: document.getElementById(targetId) || titleEl });
    });
    
    menuHtml += `</div></div>`;
  });
  
  navTreeContainer.innerHTML = menuHtml;

  // Interactivity: Click tab to expand and switch
  const treeTabs = navTreeContainer.querySelectorAll('.nav-tree-tab');
  treeTabs.forEach(treeTab => {
    treeTab.addEventListener('click', function() {
      const targetTabId = this.getAttribute('data-tab');
      // Trigger the existing tab switch logic by finding the top stepper button
      const topStepBtn = document.querySelector(`.nav-step-btn[data-tab="${targetTabId.replace('tab-', '')}"]`);
      if (topStepBtn) {
        topStepBtn.click();
      }
    });
  });

  // Interactivity: Click link to scroll
  const treeLinks = navTreeContainer.querySelectorAll('.nav-tree-link');
  treeLinks.forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('data-scroll-to');
      const parentTabId = this.getAttribute('data-parent-tab');
      
      // Switch tab if not active
      const currentActiveTab = document.querySelector('.calculator-panel.active');
      if (currentActiveTab && currentActiveTab.id !== parentTabId) {
        const topStepBtn = document.querySelector(`.nav-step-btn[data-tab="${parentTabId.replace('tab-', '')}"]`);
        if (topStepBtn) topStepBtn.click();
      }
      
      // Scroll to element
      setTimeout(() => {
        const targetEl = document.getElementById(targetId);
        if (targetEl) {
          // close sidebar on mobile
          if (window.innerWidth <= 1024) toggleSidebar(false);
          
          targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
          
          // Flash effect
          const originalBg = targetEl.style.backgroundColor;
          targetEl.style.transition = 'background-color 0.5s';
          targetEl.style.backgroundColor = 'rgba(108, 99, 255, 0.2)';
          setTimeout(() => {
            targetEl.style.backgroundColor = originalBg;
          }, 1000);
        }
      }, 100);
    });
  });

  // Scroll Spy logic
  const scrollSpyObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        if (!id) return;
        
        // Remove active class from all links
        treeLinks.forEach(l => l.classList.remove('active-scroll'));
        // Add active class to corresponding link
        const activeLink = document.querySelector(`.nav-tree-link[data-scroll-to="${id}"]`);
        if (activeLink) {
          activeLink.classList.add('active-scroll');
        }
      }
    });
  }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });

  // Observe all generated section IDs
  sectionsData.forEach(item => {
    if (item.el) scrollSpyObserver.observe(item.el);
  });

  // Keep menu tree synced with main tabs
  function syncMenuTreeWithTabs() {
    const activeTabPanel = document.querySelector('.calculator-panel.active');
    if (!activeTabPanel) return;
    const activeTabId = activeTabPanel.id;
    
    const allTreeItems = document.querySelectorAll('.nav-tree-item');
    allTreeItems.forEach(item => {
      if (item.getAttribute('data-target-tab') === activeTabId) {
        item.classList.add('open');
        item.querySelector('.nav-tree-tab').classList.add('active');
      } else {
        item.classList.remove('open');
        item.querySelector('.nav-tree-tab').classList.remove('active');
      }
    });
  }
  
  // Hook into existing tab buttons to sync tree
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      setTimeout(syncMenuTreeWithTabs, 50);
    });
  });
  
  // Initial sync
  syncMenuTreeWithTabs();
});
