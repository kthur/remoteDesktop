/**
 * 메인 애플리케이션 UI 제어, 이벤트 바인딩 및 차트 렌더링 (배우자 1,2 금융소득 개별 연산 적용)
 */

document.addEventListener('DOMContentLoaded', () => {
  const parseVal = (idOrEl) => {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return 0;
    return parseFloat(el.value.replace(/,/g, '')) || 0;
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

  // Flag to prevent save-during-load loop
  let isLoadingState = false;

  // Local Storage Save & Load logic
  function saveStateToLocalStorage() {
    const state = {
      statics: {},
      dependents: []
    };

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
              groupAgriAmt.style.display = el.checked ? 'block' : 'none';
            } else if (id === 'vat-use-cardsales') {
              groupCardSalesAmt.style.display = el.checked ? 'block' : 'none';
            }
          } else {
            el.value = state.statics[id];
            // Directly apply UI state for selects
            if (id === 'vat-type') {
              groupBusinessType.style.display = el.value === 'simplified' ? 'block' : 'none';
            } else if (id === 'capital-type') {
              if (el.value === 'real_estate') {
                formRealEstate.style.display = 'block';
                formStock.style.display = 'none';
              } else {
                formRealEstate.style.display = 'none';
                formStock.style.display = 'block';
              }
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

  function setupKoreanUnitHelpers() {
    const targetIds = [
      'inc-h-salary', 'inc-w-salary', 'inc-h-card', 'inc-w-card',
      'vat-sales', 'vat-purchases', 'capital-purchase', 'capital-sell',
      'stock-gain', 'opt-gs-purchase', 'opt-gs-current'
    ];
    
    targetIds.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      
      const helper = document.createElement('div');
      helper.className = 'won-helper';
      helper.style.fontSize = '0.8rem';
      helper.style.color = 'var(--accent-secondary)';
      helper.style.marginTop = '4px';
      helper.style.fontWeight = 'bold';
      el.parentNode.insertBefore(helper, el.nextSibling);
      
      const updateHelper = () => {
        helper.textContent = convertToKoreanWon(el.value);
      };
      
      el.addEventListener('input', updateHelper);
      updateHelper();
    });
  }

  // Bind input listeners to money inputs
  document.querySelectorAll('.money-input').forEach(input => {
    input.addEventListener('input', formatInputOnEvent);
    if (input.value) {
      input.value = formatNumberWithCommas(input.value);
    }
  });

  // 1. 테마 토글
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    themeToggleBtn.querySelector('.theme-icon').textContent = isLight ? '☀️' : '🌙';
    themeToggleBtn.querySelector('.theme-text').textContent = isLight ? '라이트 모드' : '다크 모드';
  });

  // 2. 대분류 탭 전환 (종합소득세 / 양도소득세)
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.calculator-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(`tab-${btn.dataset.tab}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
    });
  });

  // 3. 양도소득세 탭 입력 전환 제어 (부동산 vs 주식)
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

  // 5. 부양가족 동적 추가/삭제
  const optCoupleYePeople = document.getElementById('inc-couple-ye-people');
  const btnAddCoupleDep = document.getElementById('btn-add-couple-dep');

  btnAddCoupleDep.addEventListener('click', () => {
    const currentCount = optCoupleYePeople.querySelectorAll('.person-card').length;
    if (currentCount >= 5) {
      alert("부양가족은 최대 5명까지 설정할 수 있습니다.");
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
            <input type="text" class="form-input opt-dep-name" value="가족 ${nextId}" placeholder="예: 홍길동">
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

  // 1. 종합소득세 & 연말정산 원스톱 대통합 계산
  const btnCalcIncomeIntegrated = document.getElementById('btn-calc-income-integrated');
  btnCalcIncomeIntegrated.addEventListener('click', () => {
    // 배우자 1 (남편) 기본 데이터 확보
    const hSalary = parseVal('inc-h-salary');
    const hType = document.getElementById('inc-h-type').value;
    const hCard = parseVal('inc-h-card');
    const hYellow = parseVal('inc-h-yellow');
    const hPension = parseVal('inc-h-pension');

    // 🆕 배우자 1 금융소득 상세 설정 분리 반영
    const hFinancialGen = parseVal('inc-h-financial-gen');
    const hFinancialOverseas = parseVal('inc-h-financial-overseas');
    const hIsaIncome = parseVal('inc-h-isa');
    const hIsaType = document.getElementById('inc-h-isa-type').value;
    const hBondSeparated = parseVal('inc-h-bond');

    // 배우자 2 (아내) 기본 데이터 확보
    const wSalary = parseVal('inc-w-salary');
    const wType = document.getElementById('inc-w-type').value;
    const wCard = parseVal('inc-w-card');
    const wYellow = parseVal('inc-w-yellow');
    const wPension = parseVal('inc-w-pension');

    // 🆕 배우자 2 금융소득 상세 설정 분리 반영
    const wFinancialGen = parseVal('inc-w-financial-gen');
    const wFinancialOverseas = parseVal('inc-w-financial-overseas');
    const wIsaIncome = parseVal('inc-w-isa');
    const wIsaType = document.getElementById('inc-w-isa-type').value;
    const wBondSeparated = parseVal('inc-w-bond');

    // 공통 투자 설정
    const ventureInvestment = parseVal('inc-venture');
    const housingSubscription = parseVal('inc-housing-sub');
    const housingLoanRepay = parseVal('inc-housing-loan');

    // 1. 소득금액 기본 검증 (음수 제한 등)
    if (hSalary < 0 || wSalary < 0) {
      alert("⚠️ 소득금액은 0원 이상이어야 합니다.");
      return;
    }
    if (hCard < 0 || wCard < 0 || hYellow < 0 || wYellow < 0 || hPension < 0 || wPension < 0 ||
        hFinancialGen < 0 || hFinancialOverseas < 0 || hIsaIncome < 0 || hBondSeparated < 0 ||
        wFinancialGen < 0 || wFinancialOverseas < 0 || wIsaIncome < 0 || wBondSeparated < 0 ||
        ventureInvestment < 0 || housingSubscription < 0 || housingLoanRepay < 0) {
      alert("⚠️ 모든 입력금액은 0원 이상이어야 합니다.");
      return;
    }

    // 부양가족 데이터 수집 및 이름 중복 검증
    const cards = optCoupleYePeople.querySelectorAll('.person-card');
    const dependents = [];
    const depNames = [];
    for (const card of cards) {
      const name = (card.querySelector('.opt-dep-name').value || '').trim();
      if (!name) {
        alert("⚠️ 부양가족 이름을 입력해주세요.");
        return;
      }
      if (depNames.includes(name)) {
        alert(`⚠️ 중복된 부양가족 이름이 존재합니다: "${name}". 부양가족 이름은 고유해야 합니다.`);
        return;
      }
      depNames.push(name);
      
      const cardVal = parseVal(card.querySelector('.opt-dep-card'));
      const medicalVal = parseVal(card.querySelector('.opt-dep-medical'));
      const eduVal = parseVal(card.querySelector('.opt-dep-edu'));
      const studentLoanRepayVal = parseVal(card.querySelector('.opt-dep-student-loan'));
      
      if (cardVal < 0 || medicalVal < 0 || eduVal < 0 || studentLoanRepayVal < 0) {
        alert("⚠️ 부양가족 지출액은 0원 이상이어야 합니다.");
        return;
      }
      
      dependents.push({
        name,
        relation: card.querySelector('.opt-dep-relation').value,
        card: cardVal,
        medical: medicalVal,
        edu: eduVal,
        studentLoanRepay: studentLoanRepayVal,
        senior: card.querySelector('.opt-dep-senior').checked,
        disabled: card.querySelector('.opt-dep-disabled').checked,
        birth: card.querySelector('.opt-dep-birth').checked,
        birthOrder: 1
      });
    }

    // ① 배우자 1 개별 세액 정밀 연산 (금융소득 개별 합산)
    const hResult = TaxCalculator.calculateComprehensiveIncome({
      totalIncome: hSalary,
      incomeType: hType,
      expense: hType === 'business' ? Math.floor(hSalary * 0.3) : 0,
      yellowUmbrella: hYellow,
      pensionSavings: hPension,
      financialGeneral: hFinancialGen,
      financialOverseas: hFinancialOverseas,
      isaIncome: hIsaIncome,
      isaType: hIsaType,
      bondSeparated: hBondSeparated,
      ventureInvestment
    });

    // ② 배우자 2 개별 세액 정밀 연산 (금융소득 개별 합산)
    const wResult = TaxCalculator.calculateComprehensiveIncome({
      totalIncome: wSalary,
      incomeType: wType,
      expense: wType === 'business' ? Math.floor(wSalary * 0.3) : 0,
      yellowUmbrella: wYellow,
      pensionSavings: wPension,
      financialGeneral: wFinancialGen,
      financialOverseas: wFinancialOverseas,
      isaIncome: wIsaIncome,
      isaType: wIsaType,
      bondSeparated: wBondSeparated,
      ventureInvestment: 0 // 벤처투자는 배우자 1 명의로 적용 시뮬레이션
    });

    document.getElementById('res-h-expense').textContent = (hResult.salaryDeduction || hResult.expense || 0).toLocaleString() + ' 원';
    document.getElementById('res-h-person').textContent = (hResult.personDeduction || 0).toLocaleString() + ' 원';
    document.getElementById('res-h-taxable').textContent = hResult.taxableIncome.toLocaleString() + ' 원';
    document.getElementById('res-h-rate').textContent = hResult.bracketRate + '%';
    document.getElementById('res-h-total').textContent = hResult.totalTax.toLocaleString() + ' 원';

    document.getElementById('res-w-expense').textContent = (wResult.salaryDeduction || wResult.expense || 0).toLocaleString() + ' 원';
    document.getElementById('res-w-person').textContent = (wResult.personDeduction || 0).toLocaleString() + ' 원';
    document.getElementById('res-w-taxable').textContent = wResult.taxableIncome.toLocaleString() + ' 원';
    document.getElementById('res-w-rate').textContent = wResult.bracketRate + '%';
    document.getElementById('res-w-total').textContent = wResult.totalTax.toLocaleString() + ' 원';

    // 배우자 1, 2 금융소득 개별 산출 결과 출력
    document.getElementById('res-h-isa-free').textContent = hResult.isaTaxfreeAmount.toLocaleString() + ' 원';
    document.getElementById('res-h-isa-tax').textContent = hResult.isaSeparatedTax.toLocaleString() + ' 원';
    document.getElementById('res-h-bond-tax').textContent = hResult.bondSeparatedTax.toLocaleString() + ' 원';
    document.getElementById('res-h-financial-comp').textContent = hResult.financialCompAmount.toLocaleString() + ' 원';

    document.getElementById('res-w-isa-free').textContent = wResult.isaTaxfreeAmount.toLocaleString() + ' 원';
    document.getElementById('res-w-isa-tax').textContent = wResult.isaSeparatedTax.toLocaleString() + ' 원';
    document.getElementById('res-w-bond-tax').textContent = wResult.bondSeparatedTax.toLocaleString() + ' 원';
    document.getElementById('res-w-financial-comp').textContent = wResult.financialCompAmount.toLocaleString() + ' 원';

    // ③ 맞벌이 부양가족 최적 배정 연동
    const husbandOptData = {
      salary: hSalary, card: hCard, cash: 0, pension: hPension, SME: false,
      housingSubscription, housingLoanRepay, ventureInvestment
    };
    const wifeOptData = {
      salary: wSalary, card: wCard, cash: 0, pension: wPension, SME: false
    };

    const optResult = TaxOptimizer.optimizeCoupleYearEnd({ husband: husbandOptData, wife: wifeOptData, dependents });
    const best = optResult.best;

    if (best) {
      document.getElementById('res-couple-ye-desc').innerHTML = `
        배우자 1(남편) 배정 부양가족: <strong>[${best.husbandDeps.join(', ') || '없음'}]</strong><br>
        배우자 2(아내) 배정 부양가족: <strong>[${best.wifeDeps.join(', ') || '없음'}]</strong><br>
        최적 배정 시 부부 합산 세액: <strong style="color:var(--accent-secondary); font-size:1.05rem;">${best.totalTax.toLocaleString()} 원</strong> 
        (단독 몰아주기 대비 <strong style="color:var(--accent-secondary);">약 ${optResult.savings.toLocaleString()} 원 절약</strong>)<br>
        <span style="font-size:0.8rem; opacity:0.8;">* 의료비 공제는 <strong>${best.medicalTarget === 'husband' ? '남편' : '아내'}</strong> 밑으로 수렴하는 것이 절세에 최적입니다.</span>
      `;

      // Update individual report sections with optimized details
      document.getElementById('res-h-expense').textContent = (best.hResult.salaryDeduction || best.hResult.expense || 0).toLocaleString() + ' 원';
      document.getElementById('res-h-person').textContent = (best.hResult.personDeduction || 0).toLocaleString() + ' 원';
      document.getElementById('res-h-taxable').textContent = best.hResult.taxableIncome.toLocaleString() + ' 원';
      const hRate = best.hResult.bracketRate !== undefined ? best.hResult.bracketRate : (TaxCalculator.calculateIncomeTax(best.hResult.taxableIncome).rate * 100);
      document.getElementById('res-h-rate').textContent = hRate + '%';
      document.getElementById('res-h-total').textContent = best.hResult.totalTax.toLocaleString() + ' 원';

      document.getElementById('res-w-expense').textContent = (best.wResult.salaryDeduction || best.wResult.expense || 0).toLocaleString() + ' 원';
      document.getElementById('res-w-person').textContent = (best.wResult.personDeduction || 0).toLocaleString() + ' 원';
      document.getElementById('res-w-taxable').textContent = best.wResult.taxableIncome.toLocaleString() + ' 원';
      const wRate = best.wResult.bracketRate !== undefined ? best.wResult.bracketRate : (TaxCalculator.calculateIncomeTax(best.wResult.taxableIncome).rate * 100);
      document.getElementById('res-w-rate').textContent = wRate + '%';
      document.getElementById('res-w-total').textContent = best.wResult.totalTax.toLocaleString() + ' 원';

      // Update visual comparison bars
      const worstTax = Math.max(optResult.allHusbandTax, optResult.allWifeTax);
      const bestTax = best.totalTax;
      const savings = Math.max(0, worstTax - bestTax);

      document.getElementById('comp-worst-val').textContent = worstTax.toLocaleString() + ' 원';
      document.getElementById('comp-opt-val').textContent = bestTax.toLocaleString() + ' 원';
      document.getElementById('comp-savings-val').textContent = savings.toLocaleString() + ' 원';

      if (worstTax > 0) {
        const optPercent = Math.max(5, Math.min(100, Math.round((bestTax / worstTax) * 100)));
        document.getElementById('comp-worst-bar').style.width = '100%';
        document.getElementById('comp-opt-bar').style.width = optPercent + '%';
      } else {
        document.getElementById('comp-worst-bar').style.width = '0%';
        document.getElementById('comp-opt-bar').style.width = '0%';
      }
    }

    // ④ AI 절세 추천 연동
    const advice = TaxAdvisor.getIncomeTaxAdvice({
      totalIncome: hSalary, expense: hType === 'business' ? hSalary * 0.3 : 0, incomeType: hType,
      yellowUmbrella: hYellow, pensionSavings: hPension, financialGeneral: hFinancialGen, 
      financialOverseas: hFinancialOverseas, isaIncome: hIsaIncome, isaType: hIsaType, bondSeparated: hBondSeparated, ventureInvestment
    }, hResult);

    renderAdvice('income-advice-list', advice, (id, val) => {
      if (id === 'income_yellow_umbrella') {
        setAndFormatVal('inc-h-yellow', val);
      } else if (id === 'income_pension') {
        setAndFormatVal('inc-h-pension', val);
      } else if (id === 'income_venture_investment') {
        setAndFormatVal('inc-venture', val);
      } else if (id === 'income_isa_switch') {
        setAndFormatVal('inc-h-isa', val);
        setAndFormatVal('inc-h-financial-gen', Math.max(0, hFinancialGen - val));
      } else if (id === 'income_financial_split') {
        // [양도소득세] 대분류 탭 버튼 클릭
        const capitalTabBtn = document.querySelector('.tab-btn[data-tab="capital"]');
        if (capitalTabBtn) {
          capitalTabBtn.click();
        }
        // 자산 이전 시뮬레이터 입력값 세팅 (주식 증여로 세팅)
        const optGsType = document.getElementById('opt-gs-type');
        if (optGsType) {
          optGsType.value = 'stock';
        }
        // 금융소득 원금이 대략 수익률 4% 기준이라고 가정하여 환산 세팅하거나 금융소득 금액 그대로 세팅
        // 여기선 현재 평가액을 증여하고자 하는 금융소득(예: 주식 평가액) 기준으로 세팅하도록 현재 평가액 필드에 입력
        setAndFormatVal('opt-gs-current', val * 25); // 4% 수익률 가정 시 원금
        setAndFormatVal('opt-gs-purchase', val * 15); // 취득가액 예시 세팅
        
        // 시뮬레이터 영역으로 스크롤 이동
        const targetSection = document.getElementById('opt-gs-type');
        if (targetSection) {
          targetSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      // btnCalcIncomeIntegrated.click();
    });

    // 결과 뷰 항상 활성화 (best가 없어도 개별 세금 리포트는 표시)
    document.getElementById('inc-result-card').style.display = 'block';
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
    `;
  });

  // Setup Korean unit helpers
  setupKoreanUnitHelpers();

  // Load state from local storage (if any)
  loadStateFromLocalStorage();

  // Bind auto-save listeners on all inputs/selects
  // Guard with isLoadingState flag to prevent save-during-load loops
  document.addEventListener('input', () => { if (!isLoadingState) saveStateToLocalStorage(); });
  document.addEventListener('change', () => { if (!isLoadingState) saveStateToLocalStorage(); });

  // 초기 실행 - use setTimeout to ensure DOM is fully settled after localStorage restore
  setTimeout(() => {
    btnCalcIncomeIntegrated.click();
    btnCalcVat.click();
    btnCalcCapital.click();
    btnCalcOptGs.click();
  }, 0);
});

function renderAdvice(containerId, adviceList, actionCallback) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (adviceList.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding: 1.5rem; opacity:0.6; font-size:0.85rem;">
        🎉 이미 스마트한 절세 비율을 만족하고 계십니다!
      </div>
    `;
    return;
  }

  adviceList.sort((a, b) => b.saving - a.saving);

  adviceList.forEach(item => {
    const card = document.createElement('div');
    card.className = `advice-card ${item.type}`;
    card.innerHTML = `
      <div class="advice-header">
        <span class="advice-title" style="font-size:0.9rem;">${item.title}</span>
        ${item.saving > 0 ? `<span class="advice-saving" style="font-size:0.75rem;">약 +${item.saving.toLocaleString()}원 절감</span>` : ''}
      </div>
      <p class="advice-desc" style="font-size:0.8rem; line-height:1.4; margin-bottom:8px;">${item.desc}</p>
      ${item.actionText ? `<button class="advice-action-btn" style="padding:6px 10px; font-size:0.75rem;">${item.actionText} ➔</button>` : ''}
    `;

    if (item.actionText) {
      card.querySelector('.advice-action-btn').addEventListener('click', () => {
        actionCallback(item.id, item.actionValue);
      });
    }

    container.appendChild(card);
  });
}
