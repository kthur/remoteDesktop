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

    // ① 벤처기업 투자 소득공제 추천
    if (ventureInvestment === 0 && bracketRate >= 24) {
      advice.push({
        id: 'income_venture_investment',
        type: 'success',
        priority: 'high',
        saving: Math.floor(30000000 * (bracketRate / 100)),
        title: "🚀 고소득자 벤처기업 투자 소득공제 (최대 100% 공제)",
        desc: `현재 고객님의 한계세율은 ${bracketRate}%로 높은 편입니다. 벤처투자조합이나 벤처기업에 출자 시 3,000만 원 이하 금액에 대해서는 100% 전액 소득공제가 적용되어 납부세액을 크게 줄일 수 있습니다. (3천만 원 투자 시 약 ${(30000000 * (bracketRate / 100)).toLocaleString()}원 절감)`,
        actionText: "벤처투자 3,000만 원 적용",
        actionValue: 30000000
      });
    }

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
    const { totalSalary, pensionSavings, irpSavings, monthlyRent, studentLoanRepay, localDonation, ventureInvestment } = inputs;
    const { finalTax } = results;

    if (finalTax <= 0) return advice;

    if (ventureInvestment === 0 && totalSalary >= 88000000) {
      advice.push({
        id: 'yearend_venture_invest',
        type: 'success',
        priority: 'high',
        saving: Math.floor(30000000 * 0.38),
        title: "🚀 연봉 8,800만 초과 고소득자 벤처투자 소득공제",
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
        saving: 130000,
        title: "🎁 기적의 수익률 '고향사랑기부제'",
        desc: "지방자치단체에 10만 원을 기부하면 10만 원은 전액 소득세에서 공제되어 100% 환급되고, 추가로 3만 원 상당의 답례품까지 받을 수 있는 강력한 절세 기부금 제도입니다.",
        actionText: "10만 원 기부 반영",
        actionValue: 100000
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
  }
};
