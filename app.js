/**
 * 메인 애플리케이션 UI 제어, 이벤트 바인딩 및 차트 렌더링 (배우자 1,2 금융소득 개별 연산 적용)
 */

document.addEventListener('DOMContentLoaded', () => {
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
  let coupleDepCount = 1;

  btnAddCoupleDep.addEventListener('click', () => {
    if (coupleDepCount >= 5) {
      alert("부양가족은 최대 5명까지 설정할 수 있습니다.");
      return;
    }
    coupleDepCount++;
    const card = document.createElement('div');
    card.className = 'person-card';
    card.dataset.id = coupleDepCount;
    card.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span class="person-name">부양가족 ${coupleDepCount}</span>
          <button class="btn-remove-person">✖</button>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:8px;">
          <input type="text" class="form-input opt-dep-name" value="가족 ${coupleDepCount}" placeholder="이름">
          <select class="form-input opt-dep-relation">
            <option value="child">자녀 (8세 이상)</option>
            <option value="parent">부모 (기본공제)</option>
            <option value="other">기타</option>
          </select>
          <input type="number" class="form-input opt-dep-card" value="0" placeholder="카드사용액">
          <input type="number" class="form-input opt-dep-medical" value="0" placeholder="의료비">
          <input type="number" class="form-input opt-dep-edu" value="0" placeholder="교육비">
          <input type="number" class="form-input opt-dep-student-loan" value="0" placeholder="학자금상환">
        </div>
        <div style="display:flex; gap:15px; margin-top:5px; font-size:0.8rem;">
          <label><input type="checkbox" class="opt-dep-senior"> 경로우대(70세+)</label>
          <label><input type="checkbox" class="opt-dep-disabled"> 장애인 공제</label>
          <label><input type="checkbox" class="opt-dep-birth"> 출산/입양</label>
        </div>
      </div>
    `;
    optCoupleYePeople.appendChild(card);

    card.querySelector('.btn-remove-person').addEventListener('click', () => {
      card.remove();
      coupleDepCount--;
    });
  });

  /* ==========================================
     버튼 이벤트 바인딩 및 원스톱 최적화
     ========================================== */

  // 1. 종합소득세 & 연말정산 원스톱 대통합 계산
  const btnCalcIncomeIntegrated = document.getElementById('btn-calc-income-integrated');
  btnCalcIncomeIntegrated.addEventListener('click', () => {
    // 배우자 1 (남편) 기본 데이터 확보
    const hSalary = parseFloat(document.getElementById('inc-h-salary').value) || 0;
    const hType = document.getElementById('inc-h-type').value;
    const hCard = parseFloat(document.getElementById('inc-h-card').value) || 0;
    const hYellow = parseFloat(document.getElementById('inc-h-yellow').value) || 0;
    const hPension = parseFloat(document.getElementById('inc-h-pension').value) || 0;

    // 🆕 배우자 1 금융소득 상세 설정 분리 반영
    const hFinancialGen = parseFloat(document.getElementById('inc-h-financial-gen').value) || 0;
    const hFinancialOverseas = parseFloat(document.getElementById('inc-h-financial-overseas').value) || 0;
    const hIsaIncome = parseFloat(document.getElementById('inc-h-isa').value) || 0;
    const hIsaType = document.getElementById('inc-h-isa-type').value;
    const hBondSeparated = parseFloat(document.getElementById('inc-h-bond').value) || 0;

    // 배우자 2 (아내) 기본 데이터 확보
    const wSalary = parseFloat(document.getElementById('inc-w-salary').value) || 0;
    const wType = document.getElementById('inc-w-type').value;
    const wCard = parseFloat(document.getElementById('inc-w-card').value) || 0;
    const wYellow = parseFloat(document.getElementById('inc-w-yellow').value) || 0;
    const wPension = parseFloat(document.getElementById('inc-w-pension').value) || 0;

    // 🆕 배우자 2 금융소득 상세 설정 분리 반영
    const wFinancialGen = parseFloat(document.getElementById('inc-w-financial-gen').value) || 0;
    const wFinancialOverseas = parseFloat(document.getElementById('inc-w-financial-overseas').value) || 0;
    const wIsaIncome = parseFloat(document.getElementById('inc-w-isa').value) || 0;
    const wIsaType = document.getElementById('inc-w-isa-type').value;
    const wBondSeparated = parseFloat(document.getElementById('inc-w-bond').value) || 0;

    // 공통 투자 설정
    const ventureInvestment = parseFloat(document.getElementById('inc-venture').value) || 0;
    const housingSubscription = parseFloat(document.getElementById('inc-housing-sub').value) || 0;
    const housingLoanRepay = parseFloat(document.getElementById('inc-housing-loan').value) || 0;

    // 부양가족 데이터 수집
    const cards = optCoupleYePeople.querySelectorAll('.person-card');
    const dependents = [];
    cards.forEach(card => {
      dependents.push({
        name: card.querySelector('.opt-dep-name').value || '무명',
        relation: card.querySelector('.opt-dep-relation').value,
        card: parseFloat(card.querySelector('.opt-dep-card').value) || 0,
        medical: parseFloat(card.querySelector('.opt-dep-medical').value) || 0,
        edu: parseFloat(card.querySelector('.opt-dep-edu').value) || 0,
        studentLoanRepay: parseFloat(card.querySelector('.opt-dep-student-loan').value) || 0,
        senior: card.querySelector('.opt-dep-senior').checked,
        disabled: card.querySelector('.opt-dep-disabled').checked,
        birth: card.querySelector('.opt-dep-birth').checked,
        birthOrder: 1
      });
    });

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

    document.getElementById('res-h-taxable').textContent = hResult.taxableIncome.toLocaleString() + ' 원';
    document.getElementById('res-h-rate').textContent = hResult.bracketRate + '%';
    document.getElementById('res-h-total').textContent = hResult.totalTax.toLocaleString() + ' 원';

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
    }

    // ④ AI 절세 추천 연동
    const advice = TaxAdvisor.getIncomeTaxAdvice({
      totalIncome: hSalary, expense: hType === 'business' ? hSalary * 0.3 : 0, incomeType: hType,
      yellowUmbrella: hYellow, pensionSavings: hPension, financialGeneral: hFinancialGen, 
      financialOverseas: hFinancialOverseas, isaIncome: hIsaIncome, isaType: hIsaType, bondSeparated: hBondSeparated, ventureInvestment
    }, hResult);

    renderAdvice('income-advice-list', advice, (id, val) => {
      if (id === 'income_yellow_umbrella') {
        document.getElementById('inc-h-yellow').value = val;
      } else if (id === 'income_pension') {
        document.getElementById('inc-h-pension').value = val;
      } else if (id === 'income_venture_investment') {
        document.getElementById('inc-venture').value = val;
      } else if (id === 'income_isa_switch') {
        document.getElementById('inc-h-isa').value = val;
        document.getElementById('inc-h-financial-gen').value = Math.max(0, hFinancialGen - val);
      }
      btnCalcIncomeIntegrated.click();
    });

    // 결과 뷰 활성화
    document.getElementById('inc-result-card').style.display = 'block';
  });

  // 2. 부가가치세 계산
  const btnCalcVat = document.getElementById('btn-calc-vat');
  btnCalcVat.addEventListener('click', () => {
    const type = vatTypeSelect.value;
    const sales = parseFloat(document.getElementById('vat-sales').value) || 0;
    const purchases = parseFloat(document.getElementById('vat-purchases').value) || 0;
    const businessType = document.getElementById('vat-business-type').value;
    const useAgriPurchase = checkUseAgri.checked;
    const agriPurchaseAmount = parseFloat(document.getElementById('vat-agri-amt').value) || 0;
    const hasCardSales = checkUseCardSales.checked;
    const cardSalesAmount = parseFloat(document.getElementById('vat-cardsales-amt').value) || 0;

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
        document.getElementById('vat-agri-amt').value = 10000000;
      } else if (id === 'vat_card_sales_ded') {
        checkUseCardSales.checked = true;
        checkUseCardSales.dispatchEvent(new Event('change'));
        document.getElementById('vat-cardsales-amt').value = 20000000;
      }
      btnCalcVat.click();
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
        purchasePrice: parseFloat(document.getElementById('capital-purchase').value) || 0,
        sellPrice: parseFloat(document.getElementById('capital-sell').value) || 0,
        holdingPeriodMonths: parseInt(document.getElementById('capital-period').value) || 0,
        houseCount: parseInt(document.getElementById('capital-houses').value) || 0
      };
    } else {
      inputs = {
        type,
        stockType: document.getElementById('stock-type').value,
        stockGain: parseFloat(document.getElementById('stock-gain').value) || 0
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
        btnCalcCapital.click();
      }
    });
  });

  // 4. 자산 이전 절세 시뮬레이션
  const btnCalcOptGs = document.getElementById('btn-calc-opt-gs');
  btnCalcOptGs.addEventListener('click', () => {
    const type = document.getElementById('opt-gs-type').value;
    const originalPurchasePrice = parseFloat(document.getElementById('opt-gs-purchase').value) || 0;
    const currentPrice = parseFloat(document.getElementById('opt-gs-current').value) || 0;

    const result = TaxOptimizer.optimizeGiftAndSell({ type, originalPurchasePrice, currentPrice });
    
    const resultCard = document.getElementById('opt-gs-result-card');
    const resultDetails = document.getElementById('opt-gs-result-details');
    resultCard.style.display = 'block';

    resultDetails.innerHTML = `
      <p style="margin-bottom:8px;">최초 양도차익: ${result.originalGain.toLocaleString()} 원</p>
      <p style="margin-bottom:8px;">이전 전 예상 양도세: ${result.originalTax.toLocaleString()} 원</p>
      <p style="margin-bottom:8px; font-weight:bold; color:var(--accent-secondary);">배우자 증여 후 예상 세금: ${result.afterGiftTax.toLocaleString()} 원</p>
      <p style="font-weight:bold; font-size:1.05rem; margin-top:12px; color:var(--accent-secondary);">
        🎯 총 예상 절세 금액: 약 +${result.savings.toLocaleString()} 원
      </p>
      <p style="font-size:0.75rem; opacity:0.7; margin-top:8px; line-height:1.3;">
        * 증여재산가액 한도 6억 원을 적용한 취득가액 갱신 시뮬레이션입니다. 부동산은 증여 후 10년 뒤 매도(이월과세 방지) 요건을 준수해야 합니다.
      </p>
    `;
  });

  // 초기 실행
  btnCalcIncomeIntegrated.click();
  btnCalcVat.click();
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
