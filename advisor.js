/**
 * AI 절세 어드바이저 추천 엔진 (금융소득 세부 유형 및 ISA 절세 시뮬레이션 탑재)
 */

const TaxAdvisor = {
  // 1. 종합소득세 절세 분석
  getIncomeTaxAdvice(inputs, results) {
    const advice = [];
    const { 
      totalIncome, expense, incomeType, yellowUmbrella = 0, 
      financialGeneral = 0, financialOverseas = 0, isaIncome = 0, bondSeparated = 0,
      ventureInvestment = 0
    } = inputs;
    const { totalTax, bracketRate, taxableIncome, isFinancialCompTax } = results;

    if (totalTax <= 0) return advice;

    // ② 금융소득 종합과세 한도 도달 경고 및 명의분산 권고
    const compFinancialBase = financialGeneral + financialOverseas;
    if (isFinancialCompTax) {
      const excess = compFinancialBase - 20000000;
      const saving = Math.floor(excess * (bracketRate / 100 - 0.14));
      advice.push({
        id: 'income_financial_split',
        type: 'warning',
        priority: 'high',
        saving: saving,
        title: "⚠️ 금융소득 종합과세(이자/배당 2천만 원 초과) 대상",
        desc: `연간 금융소득이 2,000만 원을 초과하여 종합소득에 합산되고 있습니다. 배우자(6억 한도) 또는 자녀에게 자산을 일부 사전 증여하여 금융소득의 명의를 분산시키면, 각자 2,000만 원 이하 분리과세(14%) 혜택을 적용받아 종합합산 누진세를 회피할 수 있습니다.`,
        actionText: "절세 시뮬레이터로 이동",
        actionValue: compFinancialBase
      });
    }

    // ③ ISA 계좌 전환을 통한 비과세/분리과세(9.9%) 추천
    if (financialGeneral > 0 && isaIncome === 0) {
      const estimatedIsaSaving = Math.floor(Math.min(financialGeneral, 5000000) * 0.154) + Math.floor(Math.max(0, financialGeneral - 5000000) * (0.154 - 0.099));
      advice.push({
        id: 'income_isa_switch',
        type: 'success',
        priority: 'high',
        saving: estimatedIsaSaving,
        title: "💎 일반 계좌 금융소득의 ISA 전환 추천",
        desc: `현재 발생하는 일반 금융소득 중 일부를 ISA(개인종합자산관리계좌)로 운용 시 일반형 기준 500만 원(서민형 1,000만 원)까지 완전 비과세 혜택을 받으며, 한도 초과분은 종합과세에 합산되지 않고 9.9%로 저율 분리과세되어 세금을 크게 아낄 수 있습니다.`,
        actionText: "ISA 일반형 비과세 적용",
        actionValue: 5000000
      });
    }

    // ④ 해외 주식/이자 무조건 종합과세 경고
    if (financialOverseas > 0) {
      advice.push({
        id: 'income_overseas_financial',
        type: 'warning',
        priority: 'medium',
        saving: 0,
        title: "🌍 해외 금융소득 무조건 종합과세 대상 안내",
        desc: "원천징수되지 않은 해외 예금 이자나 해외 주식 배당금은 2,000만 원 초과 여부와 상관없이 1원부터 무조건 종합과세 과세표준에 합산됩니다. 해당 소득이 누락되지 않도록 홈택스 신고 시 주의가 필요합니다.",
        actionText: "해외소득 자산분산 시뮬레이션"
      });
    }

    // ⑤ 노란우산공제 추천 (사업소득 유형 자영업/프리랜서용)
    if (incomeType === 'business' && yellowUmbrella < 2000000) {
      let limit = 2000000;
      const netIncome = totalIncome - expense;
      if (netIncome <= 40000000) limit = 5000000;
      else if (netIncome <= 100000000) limit = 3000000;

      const gap = limit - yellowUmbrella;
      const saving = Math.floor(gap * (bracketRate / 100));

      advice.push({
        id: 'income_yellow_umbrella',
        type: 'success',
        priority: 'high',
        saving: saving,
        title: "🟡 노란우산공제(소기업소상공인공제) 활용",
        desc: `현재 필요 소득 수준에 대해 연 최대 ${limit.toLocaleString()}원까지 노란우산공제 납입액이 소득공제됩니다. 현재보다 연 약 ${saving.toLocaleString()}원의 세금을 더 절감할 수 있습니다.`,
        actionText: "노란우산 한도 추가 적용",
        actionValue: limit
      });
    }

    return advice;
  },

  // 2. 양도소득세 절세 분석
  getCapitalGainsAdvice(inputs, results) {
    const advice = [];
    const { type, holdingPeriodMonths } = inputs;
    const { totalTax, gain } = results;

    if (totalTax === 0) return advice;

    if (type === 'real_estate') {
      if (holdingPeriodMonths < 24) {
        const nextMonth = 24 - holdingPeriodMonths;
        const baseTaxable = results.taxableIncome;
        const baseCalculated = TaxCalculator.calculateIncomeTax(baseTaxable);
        const normalTax = baseCalculated.tax + Math.floor(baseCalculated.tax * 0.1);
        const currentTax = results.totalTax;
        const saving = Math.max(0, currentTax - normalTax);

        if (saving > 0) {
          advice.push({
            id: 'real_estate_hold',
            type: 'warning',
            priority: 'high',
            saving: saving,
            title: `⏰ 보유 기간 연장을 통한 단기 중과세 회피`,
            desc: `현재 보유기간(${holdingPeriodMonths}개월)이 2년 미만이어서 단기양도세율(60% 혹은 70%)이 적용되고 있습니다. 등기 완료일로부터 ${nextMonth}개월을 더 채워 2년 이상 보유 후 매도하시면 일반 누진세율(6~45%)로 낮아져 약 ${saving.toLocaleString()}원의 양도소득세를 절세할 수 있습니다.`,
            actionText: "보유 기간 24개월로 연장 적용",
            actionValue: 24
          });
        }
      }

      advice.push({
        id: 'real_estate_gift_transfer',
        type: 'info',
        priority: 'medium',
        saving: 0,
        title: "🎁 배우자 증여 후 매도(양도세 취득가 갱신)",
        desc: "양도차익이 매우 커 세금이 많을 경우, 배우자에게 부동산을 먼저 증여(6억 원까지 증여세 면제)한 다음 10년이 지난 뒤 매도하게 되면 양도차익의 기준인 취득가가 증여가액으로 갱신되어 세금이 매우 큰 폭으로 절감됩니다. (단, 이월과세 회피를 위해 10년 보유 조건 필수)",
        actionText: "증여 시뮬레이션 이동"
      });
    } else {
      if (gain > 2500000) {
        advice.push({
          id: 'stock_loss_net',
          type: 'success',
          priority: 'medium',
          saving: Math.floor((gain - 2500000) * 0.22),
          title: "📈 해외주식 손익통산 매도 추천",
          desc: "연말 전에 보유 중인 마이너스(손실) 주식을 일단 매도하여 양도차익을 상쇄(손익 통산) 시킨 후 다시 매수함으로써 합산 세금을 대폭 줄일 수 있습니다. (연 250만원 기본공제 적용)",
          actionText: "손익통산 시뮬레이션"
        });
      }
    }

    return advice;
  },

  // 3. 부가가치세 절세 분석
  getVATAdvice(inputs, results) {
    const advice = [];
    const { type, sales, purchases, useAgriPurchase, hasCardSales } = inputs;
    const { totalPayable } = results;

    if (totalPayable <= 0) return advice;

    if (!useAgriPurchase) {
      advice.push({
        id: 'vat_agri_deduction',
        type: 'success',
        priority: 'medium',
        saving: Math.floor(purchases * 0.2 * (8/108)),
        title: "🌾 면세 농산물 의제매입세액공제 활용",
        desc: "음식점이나 제조업의 경우, 면세농산물(쌀, 채소, 고기 등)을 구매한 영수증이나 계산서를 챙기시면 구매액의 일부(음식점의 경우 8/108 등)를 매입세액으로 의제 공제받아 부가세를 절감할 수 있습니다.",
        actionText: "의제매입 1000만원 적용"
      });
    }

    if (!hasCardSales) {
      advice.push({
        id: 'vat_card_sales_ded',
        type: 'info',
        priority: 'high',
        saving: Math.min(10000000, Math.floor(sales * 0.5 * 0.013)),
        title: "💳 신용카드 발행세액공제(1.3% 세액공제) 누락 방지",
        desc: "소비자 대상 소상공인 사업체라면 카드 결제 및 현금영수증 발행 매출액의 1.3%를 연 최대 1,000만 원 한도로 부가가치세에서 즉시 세액공제하여 차감받을 수 있으므로 필수 신고해야 합니다.",
        actionText: "카드매출 2천만 원 적용"
      });
    }

    return advice;
  },

  // 4. 연말정산 절세 분석
  getYearEndAdvice(inputs, results) {
    const advice = [];
    const { totalSalary, pensionSavings, irpSavings, monthlyRent, studentLoanRepay, localDonation, ventureInvestment, creditCard = 0, cashReceipt = 0 } = inputs;
    const { finalTax, bracketRate = 15, totalTaxCalculated = finalTax } = results;

    // 1. 소비 가이드라인 (신용카드 등 소득공제)
    const cardThreshold = totalSalary * 0.25;
    const totalSpent = creditCard + cashReceipt;
    if (totalSalary > 0) {
      if (totalSpent < cardThreshold) {
        const gap = cardThreshold - totalSpent;
        advice.push({
          id: 'yearend_card_threshold',
          type: 'warning',
          priority: 'high',
          saving: 0,
          title: "💳 신용카드 소득공제 문턱 미달",
          desc: `현재 총 소비액(${totalSpent.toLocaleString()}원)이 총급여의 25%(${cardThreshold.toLocaleString()}원)에 미달하여 소득공제를 받을 수 없습니다. 앞으로 ${gap.toLocaleString()}원은 신용카드 혜택이 좋은 카드로 집중 소비하시고, 문턱을 넘은 후에는 공제율이 높은 체크카드/현금영수증을 사용하세요.`,
          actionText: "소비 목표액 적용"
        });
      } else {
        advice.push({
          id: 'yearend_card_optimize',
          type: 'success',
          priority: 'medium',
          saving: Math.floor(totalSpent * 0.3 * (bracketRate / 100)), // 대략적인 환급액 (체크카드 기준 30%)
          title: "🎯 소득공제 문턱 초과! 체크카드/현금 사용 권장",
          desc: "현재 소비액이 소득공제 문턱(총급여 25%)을 넘었습니다. 문턱 초과분부터는 공제율이 신용카드(15%)보다 2배 높은 체크카드나 현금영수증(30%)을 적극 사용하시면 환급액이 극대화됩니다.",
          actionText: "체크카드 사용 100만 원 적용"
        });
      }
    }

    // 2. 연금 계좌 가이드라인
    const maxPensionLimit = totalSalary <= 120000000 ? 9000000 : 7000000;
    const currentPension = pensionSavings + irpSavings;
    const pensionCreditRate = totalSalary <= 55000000 ? 0.165 : 0.132;
    
    if (currentPension < maxPensionLimit) {
      const gap = maxPensionLimit - currentPension;
      advice.push({
        id: 'yearend_pension_guide',
        type: 'success',
        priority: 'high',
        saving: Math.floor(gap * pensionCreditRate),
        title: "🏦 연금저축/IRP 납입 여력 알림",
        desc: `올해 연금계좌 세액공제 한도 ${maxPensionLimit.toLocaleString()}원 중 아직 ${gap.toLocaleString()}원을 더 납입하실 수 있습니다. ${(pensionCreditRate * 100).toFixed(1)}% 세액공제율을 적용받아 잔여 한도 납입 시 약 ${Math.floor(gap * pensionCreditRate).toLocaleString()}원의 세금을 즉시 돌려받을 수 있습니다.`,
        actionText: "연금저축/IRP 최대한도 적용",
        actionValue: maxPensionLimit
      });
    }

    if (totalTaxCalculated <= 0) return advice;

    if (ventureInvestment === 0 && totalSalary >= 88000000) {
      advice.push({
        id: 'yearend_venture_invest',
        type: 'success',
        priority: 'high',
        saving: Math.floor(30000000 * 0.38),
        title: "🚀 연봉 8,800만 초과 벤처투자 소득공제",
        desc: "연봉이 높아 높은 누진세율(38% 이상)이 적용되는 직장인은 벤처투자조합 출자 시 3,000만 원 이하 한도로 100% 소득공제를 받아 세금을 대규모로 즉시 환급받을 수 있는 기회가 제공됩니다. (3천만 원 투자 시 약 1,140만 원 환급)",
        actionText: "벤처투자 3,000만 원 적용",
        actionValue: 30000000
      });
    }

    if (studentLoanRepay === 0) {
      advice.push({
        id: 'yearend_student_loan',
        type: 'info',
        priority: 'medium',
        saving: 150000,
        title: "🎓 학자금 대출 원리금 상환 세액공제",
        desc: "본인 또는 부양가족 명의의 학자금 대출을 한국장학재단 등에 원리금으로 상환한 내역이 있으시다면 상환액의 15%가 전액 세액공제됩니다. 연말정산 간소화 자료에 누락되었는지 조회하여 반영하세요.",
        actionText: "학자금 100만 상환 적용"
      });
    }

    if (localDonation === 0) {
      advice.push({
        id: 'yearend_donation',
        type: 'success',
        priority: 'high',
        saving: 204000,
        title: "🎁 고향사랑기부제 '20만 원 전략' (2026년 개편)",
        desc: "2026년부터 20만 원까지 44% 세액공제(10만 초과분)가 신설됩니다. 20만 원 기부 시 14.4만 원 세금환급 + 6만 원 답례품 = 총 20.4만 원 혜택으로 원금을 상회하는 '기적의 절세'가 가능합니다.",
        actionText: "20만 원 기부 반영",
        actionValue: 200000
      });
    }

    if (totalSalary <= 80000000 && monthlyRent === 0) {
      advice.push({
        id: 'yearend_rent',
        type: 'success',
        priority: 'high',
        saving: 1020000,
        title: "🏠 무주택자 월세 세액공제 (15~17%)",
        desc: "총급여 8,000만 원 이하의 무주택 세대주라면 지출하신 월세액의 최대 17%를 세액공제받을 수 있습니다. 주민등록등본상 주소지와 임대차계약서의 주소지가 같아야 하며 이체증빙을 통해 쉽게 청구할 수 있습니다.",
        actionText: "임의 월세 50만 적용"
      });
    }

    return advice;
  },

  // 5. 상속세 절세 추천
  getInheritanceAdvice(inputs, results) {
    const advice = [];
    if (!results || results.totalTax <= 0) return advice;

    // 자녀공제 활용 (5억 × 자녀 수)
    if (inputs.childCount > 0) {
      advice.push({
        id: 'inherit_child_deduction',
        type: 'success',
        priority: 'high',
        saving: Math.floor(results.childDeduction * 0.2),
        title: "👨‍👩‍👧‍👦 상속세 자녀공제 5억 원 (10배 상향)",
        desc: `2025년 개정으로 자녀 1인당 공제액이 5,000만 원에서 5억 원으로 대폭 상향되었습니다. 자녀 ${inputs.childCount}명 기준 ${(results.childDeduction).toLocaleString()}원 공제 가능. 기존 일괄공제(5억)보다 유리합니다.`,
        actionText: "자세히 보기"
      });
    }

    // 배우자 공제 전략
    if (inputs.hasLivingSpouse !== false && results.spouseDeduction > 0) {
      advice.push({
        id: 'inherit_spouse_strategy',
        type: 'info',
        priority: 'high',
        saving: 0,
        title: "💑 배우자 상속공제 최대화 전략",
        desc: `배우자 법정상속지분(${results.spouseLegalShare.toLocaleString()}원)까지 실제 상속 시 최대 30억 원 공제 가능. 자녀에게만 상속 시 공제액이 줄어드니 배우자에게 법정지분 최대치로 우선 배분하세요.`,
        actionText: "자세히 보기"
      });
    }

    // 면세점 초과 시 추가 전략
    if (!results.isTaxFree && inputs.totalAsset > 1700000000) {
      advice.push({
        id: 'inherit_financial_deduction',
        type: 'success',
        priority: 'medium',
        saving: results.financialDeduction > 0 ? Math.floor(results.financialDeduction * 0.2) : 0,
        title: "💰 금융재산 상속공제 (최대 2억 원)",
        desc: "순금융재산(예적금·주식)의 20%를 최대 2억 원까지 추가 공제 가능합니다. 상속세 납부 재원 마련 겸 종신보험·예적금 포트폴리오를 일정 규모(10억 수준) 이상 유지하세요.",
        actionText: "금융재산 공제 적용"
      });
    }

    // 혼인·출산 증여공제
    advice.push({
      id: 'inherit_marriage_gift',
      type: 'success',
      priority: 'high',
      saving: 15000000,
      title: "💍 혼인·출산 증여재산공제 (최대 1.5억 원 비과세)",
      desc: "성인 자녀 결혼(전후 2년) 또는 출산(후 2년) 시 기존 5천만 원 기본공제 + 별도 1억 원 특별공제로 총 1.5억 원까지 증여세 없이 현금 이전 가능합니다. 양가 활용 시 최대 3억 원!",
      actionText: "증여 시뮬레이터 열기"
    });

    // 동거주택 상속공제
    if (inputs.isCoResidentHouse) {
      advice.push({
        id: 'inherit_coresident',
        type: 'success',
        priority: 'medium',
        saving: Math.floor(Math.min(inputs.coResidentHouseValue || 0, 600000000) * 0.2),
        title: "🏠 동거주택 상속공제 (최대 6억 원)",
        desc: "부모와 10년 이상 동거한 무주택 자녀가 해당 주택을 상속받을 경우 주택 가액의 100%를 최대 6억 원까지 공제받을 수 있습니다.",
        actionText: "자세히 보기"
      });
    }

    return advice;
  },

  // 6. ISA 개편 절세 추천
  getISAAdvice(inputs, results) {
    const advice = [];
    if (!results) return advice;

    // 국내투자형 ISA 추천 (금융소득종합과세자)
    if (inputs.isFinancialCompTax) {
      advice.push({
        id: 'isa_domestic_type',
        type: 'success',
        priority: 'high',
        saving: Math.floor((inputs.financialIncome || 50000000) * (0.495 - 0.154)),
        title: "💎 국내투자형 ISA (종합과세자 분리과세 14%)",
        desc: "금융소득종합과세 대상자는 국내투자형 ISA에 가입하여 계좌 내 소득을 14% 분리과세로 종결할 수 있습니다. 최고세율 49.5% 대비 최대 35.5%p 절감 효과가 있습니다.",
        actionText: "ISA 최적화 계산"
      });
    }

    // ISA→연금 전환 세액공제
    if (inputs.isMatured && inputs.pensionTransfer > 0) {
      advice.push({
        id: 'isa_pension_rollover',
        type: 'success',
        priority: 'high',
        saving: results.pensionTransferCredit || 0,
        title: "🔄 ISA 만기자금 연금계좌 전환 (10% 추가 세액공제)",
        desc: `ISA 만기자금 ${(inputs.pensionTransfer || 0).toLocaleString()}원을 연금계좌로 이체 시 전환액의 10%(최대 300만 원)를 추가 세액공제받을 수 있습니다. 기존 900만 원 한도와 별도 적용!`,
        actionText: "전환 세액공제 적용"
      });
    }

    return advice;
  }
};
