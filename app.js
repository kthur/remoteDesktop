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
  const parseVal = (idOrEl) => {
    const el = typeof idOrEl === 'string' ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return 0;
    return parseInt(el.value.replace(/,/g, ''), 10) || 0;
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
      'stock-gain', 'opt-gs-purchase', 'opt-gs-current',
      'expense-revenue', 'hi-earned-income', 'hi-other-income',
      'prop-public-price', 'prop-market-price', 'gift-amount', 'gift-past',
      'stock-exchange-rate'
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

  // ✅ PDF 업로드 — 홈택스 자동 입력
  const dropzone = document.getElementById('pdf-dropzone');
  const fileInput = document.getElementById('pdf-file-input');
  const pdfStatus = document.getElementById('pdf-status');

  dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
  dropzone.addEventListener('dragleave', () => { dropzone.classList.remove('dragover'); });
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) processPDF(e.dataTransfer.files[0]);
  });
  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) processPDF(e.target.files[0]);
  });

  async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
    let fullText = '';
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      fullText += textContent.items.map(item => item.str).join(' ') + '\n';
    }
    return fullText;
  }

  function parseTaxData(text) {
    const clean = text.replace(/\s+/g, ' ');
    const patterns = [
      { key: 'totalSalary',   regex: /(?:총급여액|총급여)\s*[:\s]*\[?([\d,]+)\]?/,     id: 'inc-h-salary' },
      { key: 'creditCard',    regex: /(?:신용카드\s*사용액|신용카드)\s*[:\s]*\[?([\d,]+)\]?/, id: 'inc-h-card' },
      { key: 'pension',       regex: /(?:연금저축|연금계좌)\s*[:\s]*\[?([\d,]+)\]?/,      id: 'inc-h-pension' },
      { key: 'medical',       regex: /(?:의료비\s*지출액|의료비)\s*[:\s]*\[?([\d,]+)\]?/,   id: null },
      { key: 'insurance',     regex: /(?:보장성보험료|보험료)\s*[:\s]*\[?([\d,]+)\]?/,      id: null },
      { key: 'education',     regex: /(?:교육비)\s*[:\s]*\[?([\d,]+)\]?/,                  id: null },
    ];
    const result = {};
    for (const { key, regex, id } of patterns) {
      const match = clean.match(regex);
      const val = match ? parseInt(match[1].replace(/,/g, ''), 10) : 0;
      result[key] = val;
      if (id && val > 0) {
        const el = document.getElementById(id);
        if (el) { el.value = String(val); el.style.background = 'rgba(0,212,170,0.15)'; }
      }
    }
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
      const extractedText = await extractTextFromPDF(file);
      const parsedData = parseTaxData(extractedText);
      const filledCount = Object.values(parsedData).filter(v => v > 0).length;
      if (filledCount > 0) {
        document.querySelectorAll('.money-input').forEach(el => {
          if (el.value) el.value = formatNumberWithCommas(el.value);
        });
        pdfStatus.innerHTML = `✅ PDF 분석 완료! <strong>${filledCount}개 항목</strong>이 자동 입력되었습니다. (총급여 ${parsedData.totalSalary.toLocaleString()}원, 카드 ${parsedData.creditCard.toLocaleString()}원 등)`;
        pdfStatus.style.color = 'var(--accent-secondary)';
      } else {
        pdfStatus.innerHTML = '⚠️ 텍스트를 추출했으나 일치하는 항목이 없습니다. 암호(생년월일)가 걸린 PDF는 홈택스에서 암호 없이 재다운로드하세요.';
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

  // 1. 테마 토글
  const themeToggleBtn = document.getElementById('themeToggleBtn');
  themeToggleBtn.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    themeToggleBtn.querySelector('.theme-icon').textContent = isLight ? '☀️' : '🌙';
    themeToggleBtn.querySelector('.theme-text').textContent = isLight ? '다크 모드로 전환' : '라이트 모드로 전환';
  });

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

    // ISA 서민형 자격 검증
    if (hIsaType === 'sub' && hSalary > 50000000 && hType === 'wage') {
      alert("⚠️ 배우자 1의 총급여가 5,000만 원을 초과하여 ISA 서민형(1,000만) 자격이 없습니다. 일반형(500만)을 선택해 주세요.");
      return;
    }
    if (wIsaType === 'sub' && wSalary > 50000000 && wType === 'wage') {
      alert("⚠️ 배우자 2의 총급여가 5,000만 원을 초과하여 ISA 서민형(1,000만) 자격이 없습니다. 일반형(500만)을 선택해 주세요.");
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
      const hRate = TaxCalculator.calculateIncomeTax(best.hResult.taxableIncome).rate * 100;
      document.getElementById('res-h-rate').textContent = hRate + '%';
      document.getElementById('res-h-total').textContent = best.hResult.totalTax.toLocaleString() + ' 원';

      document.getElementById('res-w-expense').textContent = (best.wResult.salaryDeduction || best.wResult.expense || 0).toLocaleString() + ' 원';
      document.getElementById('res-w-person').textContent = (best.wResult.personDeduction || 0).toLocaleString() + ' 원';
      document.getElementById('res-w-taxable').textContent = best.wResult.taxableIncome.toLocaleString() + ' 원';
      const wRate = TaxCalculator.calculateIncomeTax(best.wResult.taxableIncome).rate * 100;
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

    // ④ AI 절세 추천 연동 (종합소득세 + 연말정산 절세 팁 결합)
    const incomeAdvice = TaxAdvisor.getIncomeTaxAdvice({
      totalIncome: hSalary, expense: hType === 'business' ? hSalary * 0.3 : 0, incomeType: hType,
      yellowUmbrella: hYellow, pensionSavings: hPension, financialGeneral: hFinancialGen, 
      financialOverseas: hFinancialOverseas, isaIncome: hIsaIncome, isaType: hIsaType, bondSeparated: hBondSeparated, ventureInvestment
    }, hResult);

    const yearEndAdvice = TaxAdvisor.getYearEndAdvice({
      totalSalary: hSalary, pensionSavings: hPension, irpSavings: 0, 
      monthlyRent: 0, studentLoanRepay: 0, localDonation: 0, ventureInvestment
    }, { finalTax: hResult.totalTax });

    const combinedAdvice = [...incomeAdvice, ...yearEndAdvice];

    renderAdvice('income-advice-list', combinedAdvice, (id, val) => {
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
      } else if (id === 'yearend_venture_invest') {
        setAndFormatVal('inc-venture', val);
      } else if (id === 'yearend_student_loan') {
        // 학자금 대출 상환 인풋이 없으므로 부양가족 첫 번째 카드에 반영
        const firstDepStudentLoan = document.querySelector('#inc-couple-ye-people .opt-dep-student-loan');
        if (firstDepStudentLoan) setAndFormatVal(firstDepStudentLoan, val);
      } else if (id === 'yearend_donation') {
        // 기부금 인풋이 없으므로 벤처투자 항목에 반영
      } else if (id === 'yearend_rent') {
        // 월세 인풋이 없으므로 skip
      }
    });

    // ⑤ 💳 소비 네비게이션 — 남은 기간 카드 사용 추천
    const hThreshold = Math.floor(hSalary * 0.25);
    const wThreshold = Math.floor(wSalary * 0.25);
    const hCardLimit = hSalary > 120000000 ? 2000000 : hSalary > 70000000 ? 2500000 : 3000000;
    const wCardLimit = wSalary > 120000000 ? 2000000 : wSalary > 70000000 ? 2500000 : 3000000;
    const hCardRemaining = Math.max(0, hCardLimit - Math.max(0, hCard - hThreshold));
    const wCardRemaining = Math.max(0, wCardLimit - Math.max(0, wCard - wThreshold));
    let navHtml = '';
    if (hCard >= hThreshold + hCardLimit) {
      navHtml += '<span style="color:var(--accent-secondary);">✅ 남편</span> 카드공제 한도 도달. ';
    } else {
      navHtml += `<span style="color:var(--accent-info);">📌 남편</span> 카드 ${Math.max(0, hThreshold + hCardLimit - hCard).toLocaleString()}원 추가 사용 시 최대 <strong>${hCardRemaining.toLocaleString()}원</strong> 공제 가능. `;
    }
    if (wCard >= wThreshold + wCardLimit) {
      navHtml += '<span style="color:var(--accent-secondary);">✅ 아내</span> 카드공제 한도 도달.';
    } else {
      navHtml += `<span style="color:var(--accent-info);">📌 아내</span> 카드 ${Math.max(0, wThreshold + wCardLimit - wCard).toLocaleString()}원 추가 사용 시 최대 <strong>${wCardRemaining.toLocaleString()}원</strong> 공제 가능.`;
    }
    if (hCard < hThreshold && wCard < wThreshold) {
      navHtml += '<br>💡 <strong>둘 다 문턱 미달.</strong> 소득이 높은 배우자(남편) 카드를 우선 사용하세요.';
    } else if (hCard >= hThreshold + hCardLimit && wCard < wThreshold + wCardLimit) {
      navHtml += '<br>💡 남편 한도 소진 → <strong>아내 카드</strong>를 추가 사용하세요.';
    } else if (wCard >= wThreshold + wCardLimit && hCard < hThreshold + hCardLimit) {
      navHtml += '<br>💡 아내 한도 소진 → <strong>남편 카드</strong>를 추가 사용하세요.';
    }
    document.getElementById('res-card-nav-content').innerHTML = navHtml;
    document.getElementById('res-card-navigation').style.display = 'block';

    // ⑥ 🏥 의료비 몰아주기 시각화
    const totalMedical = dependents.reduce((s, d) => s + d.medical, 0);
    if (totalMedical > 0) {
      const hMedThreshold = Math.floor(hSalary * 0.03);
      const wMedThreshold = Math.floor(wSalary * 0.03);
      const hMedTax = Math.max(0, Math.floor((totalMedical - hMedThreshold) * 0.15));
      const wMedTax = Math.max(0, Math.floor((totalMedical - wMedThreshold) * 0.15));
      const maxMed = Math.max(hMedTax, wMedTax, 1);
      document.getElementById('med-bar-h').style.width = (hMedTax / maxMed * 100) + '%';
      document.getElementById('med-bar-w').style.width = (wMedTax / maxMed * 100) + '%';
      document.getElementById('med-tax-h').textContent = hMedTax.toLocaleString() + ' 원';
      document.getElementById('med-tax-w').textContent = wMedTax.toLocaleString() + ' 원';
      if (hMedTax > wMedTax) {
        document.getElementById('res-medical-desc').innerHTML = `🏆 <strong>남편 청구</strong>가 유리 (약 ${(hMedTax - wMedTax).toLocaleString()}원 차이) — 급여가 낮은 쪽이 문턱(3%)을 넘기 쉬워 공제 효과가 큽니다.`;
      } else if (wMedTax > hMedTax) {
        document.getElementById('res-medical-desc').innerHTML = `🏆 <strong>아내 청구</strong>가 유리 (약 ${(wMedTax - hMedTax).toLocaleString()}원 차이) — 급여가 낮은 쪽이 문턱(3%)을 넘기 쉬워 공제 효과가 큽니다.`;
      } else {
        document.getElementById('res-medical-desc').textContent = '⚖️ 의료비 공제 차이가 없습니다.';
      }
      document.getElementById('res-medical-comparison').style.display = 'block';
    }

    // ⑦ 📋 가족 통합 리포트 요약
    const hDeduction = hResult.salaryDeduction || hResult.expense || 0;
    const wDeduction = wResult.salaryDeduction || wResult.expense || 0;
    const familySummary = `
      <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; text-align:center; margin:8px 0;">
        <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">
          <div style="font-size:0.7rem; opacity:0.7;">부부 합산 총급여</div>
          <div style="font-weight:bold; font-size:1rem;">${(hSalary + wSalary).toLocaleString()} 원</div>
        </div>
        <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">
          <div style="font-size:0.7rem; opacity:0.7;">최적화 합산 세액</div>
          <div style="font-weight:bold; font-size:1rem; color:var(--accent-secondary);">${(best ? best.totalTax : hResult.totalTax + wResult.totalTax).toLocaleString()} 원</div>
        </div>
        <div style="background:rgba(255,255,255,0.05); padding:8px; border-radius:6px;">
          <div style="font-size:0.7rem; opacity:0.7;">예상 절감액</div>
          <div style="font-weight:bold; font-size:1rem; color:var(--accent-gold);">${(best ? optResult.savings : 0).toLocaleString()} 원</div>
        </div>
      </div>
      <div style="font-size:0.78rem; opacity:0.7; line-height:1.5;">부양가족 ${dependents.length}명 · 남편 세율 ${hResult.bracketRate}% · 아내 세율 ${wResult.bracketRate}%<br>
      소득공제 합계: ${(hDeduction + wDeduction).toLocaleString()}원 · 결정세액 합계: ${((best ? best.hResult.totalTax + best.wResult.totalTax : hResult.totalTax + wResult.totalTax)).toLocaleString()}원</div>
    `;
    document.getElementById('res-family-summary-content').innerHTML = familySummary;
    document.getElementById('res-family-summary').style.display = 'block';
  });

  // 📤 리포트 복사하기
  document.getElementById('btn-share-report').addEventListener('click', () => {
    const summaryText = document.getElementById('res-family-summary-content').innerText;
    const navText = document.getElementById('res-card-nav-content').innerText;
    const totalText = `[TAX NAVI 가족 절세 리포트]\n\n${summaryText}\n\n[소비 네비게이션]\n${navText}\n\n👉 https://kthur.github.io/tax_calculator/`;
    navigator.clipboard.writeText(totalText).then(() => {
      const btn = document.getElementById('btn-share-report');
      btn.textContent = '✅ 복사 완료!';
      setTimeout(() => { btn.textContent = '📤 리포트 복사하기'; }, 2000);
    }).catch(() => { alert('클립보드 복사에 실패했습니다. 직접 복사해 주세요.'); });
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
  document.getElementById('hi-type').addEventListener('change', function () {
    const isEmployee = this.value === 'employee';
    document.getElementById('hi-employee-fields').style.display = isEmployee ? 'block' : 'none';
    document.getElementById('hi-regional-fields').style.display = isEmployee ? 'none' : 'block';
  });
  document.getElementById('btn-calc-health-insurance').addEventListener('click', () => {
    const isEmployee = document.getElementById('hi-type').value === 'employee';
    let opts = { isEmployee };
    if (isEmployee) {
      opts.earnedIncome = parseVal('hi-earned-income');
      opts.otherIncome = parseVal('hi-other-income');
    } else {
      opts.regionalIncome = parseVal('hi-regional-income');
      opts.regionalPropertyValue = parseVal('hi-regional-property');
    }
    const hi = TaxCalculator.calculateHealthInsurance(opts);
    document.getElementById('hi-result').style.display = 'block';
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
    const checkDependent = document.getElementById('hi-dependent-check').checked;
    if (checkDependent && isEmployee) {
      const depResult = TaxCalculator.checkDependentStatus({ otherIncome: opts.otherIncome, isWageOnly: true, isPropertyOwner: false });
      html += `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:6px 0;"><div style="font-weight:bold;">🔍 피부양자 자격: ${depResult.isEligible ? '✅ 유지' : '❌ 상실'}</div><div style="font-size:0.78rem;opacity:0.7;">${depResult.reason}</div>`;
    }
    document.getElementById('hi-result-content').innerHTML = html;
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

  // 새 섹션 input 초기화 (money-input 포맷 적용)
  var newMoneyFields = [
    'expense-revenue','hi-earned-income','hi-other-income','hi-regional-income','hi-regional-property',
    'prop-public-price','prop-market-price','gift-amount','gift-past','stock-exchange-rate'
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
    'inc-h-salary','inc-h-type','inc-h-card','inc-h-yellow','inc-h-pension',
    'inc-h-financial-gen','inc-h-financial-overseas','inc-h-isa','inc-h-isa-type','inc-h-bond',
    'inc-w-salary','inc-w-type','inc-w-card','inc-w-yellow','inc-w-pension',
    'inc-w-financial-gen','inc-w-financial-overseas','inc-w-isa','inc-w-isa-type','inc-w-bond',
    'inc-venture','inc-housing-sub','inc-housing-loan'
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
      <div style="text-align:center; padding: 1.5rem; opacity:0.6; font-size:0.85rem;">
        🎉 이미 스마트한 절세 비율을 만족하고 계십니다!
      </div>
    `;
    return;
  }

  adviceList.sort((a, b) => b.saving - a.saving);

  const totalSlides = adviceList.length;
  let currentSlide = 0;

  const carousel = document.createElement('div');
  carousel.className = 'advice-carousel';

  const track = document.createElement('div');
  track.className = 'advice-carousel-track';

  adviceList.forEach((item, index) => {
    const slide = document.createElement('div');
    slide.className = 'advice-carousel-slide';
    slide.style.display = index === 0 ? 'block' : 'none';

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

    slide.appendChild(card);
    track.appendChild(slide);
  });

  carousel.appendChild(track);

  function showSlide(index) {
    const slides = track.querySelectorAll('.advice-carousel-slide');
    slides.forEach(s => s.style.display = 'none');
    currentSlide = (index + totalSlides) % totalSlides;
    slides[currentSlide].style.display = 'block';
    const dots = carousel.querySelectorAll('.advice-carousel-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === currentSlide));
    const counter = carousel.querySelector('.advice-carousel-counter');
    if (counter) counter.textContent = `${currentSlide + 1} / ${totalSlides}`;
  }

  const nav = document.createElement('div');
  nav.className = 'advice-carousel-nav';

  const prevBtn = document.createElement('button');
  prevBtn.className = 'advice-carousel-btn';
  prevBtn.innerHTML = '&#9664;';
  prevBtn.setAttribute('aria-label', '이전 가이드');
  prevBtn.addEventListener('click', () => showSlide(currentSlide - 1));

  const dotsContainer = document.createElement('div');
  dotsContainer.className = 'advice-carousel-dots';
  for (let i = 0; i < totalSlides; i++) {
    const dot = document.createElement('span');
    dot.className = `advice-carousel-dot${i === 0 ? ' active' : ''}`;
    dot.addEventListener('click', () => showSlide(i));
    dotsContainer.appendChild(dot);
  }

  const counter = document.createElement('span');
  counter.className = 'advice-carousel-counter';
  counter.textContent = `1 / ${totalSlides}`;

  const nextBtn = document.createElement('button');
  nextBtn.className = 'advice-carousel-btn';
  nextBtn.innerHTML = '&#9654;';
  nextBtn.setAttribute('aria-label', '다음 가이드');
  nextBtn.addEventListener('click', () => showSlide(currentSlide + 1));

  nav.appendChild(prevBtn);
  nav.appendChild(counter);
  nav.appendChild(dotsContainer);
  nav.appendChild(nextBtn);
  carousel.appendChild(nav);

  container.appendChild(carousel);
}
