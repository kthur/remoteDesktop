/**
 * 2025년 대한민국 세제 기준 세금 계산 엔진 (2024년 귀속)
 * 금융소득 세부 유형(일반, ISA 비과세/분리과세, 채권 30%, 해외 무조건 합산) 및 벤처투자 완벽 반영
 */

const TaxCalculator = {
  // 1. 세법 구조화 및 세율 테이블 설정
  bracketsConfig: {
    incomeTaxBrackets: [
      { limit: 14000000, rate: 0.06, deduction: 0 },
      { limit: 50000000, rate: 0.15, deduction: 1260000 },
      { limit: 88000000, rate: 0.24, deduction: 5760000 },
      { limit: 150000000, rate: 0.35, deduction: 15440000 },
      { limit: 300000000, rate: 0.38, deduction: 19940000 },
      { limit: 500000000, rate: 0.40, deduction: 25940000 },
      { limit: 1000000000, rate: 0.42, deduction: 35940000 },
      { limit: Infinity, rate: 0.45, deduction: 65940000 }
    ],
    isaLimits: {
      sub: 10000000,
      general: 5000000
    }
  },

  calculateIncomeTax(taxableIncome) {
    if (taxableIncome <= 0) return { tax: 0, rate: 0, deduction: 0 };
    
    let targetBracket = this.bracketsConfig.incomeTaxBrackets[0];
    for (const bracket of this.bracketsConfig.incomeTaxBrackets) {
      if (taxableIncome <= bracket.limit) {
        targetBracket = bracket;
        break;
      }
    }
    
    const tax = Math.max(0, Math.floor(taxableIncome * targetBracket.rate - targetBracket.deduction));
    return {
      tax: tax,
      rate: targetBracket.rate,
      deduction: targetBracket.deduction
    };
  },

  calculateYellowUmbrellaDeduction(businessIncome, payment) {
    if (payment <= 0) return 0;
    let limit = 2000000;
    if (businessIncome <= 40000000) {
      limit = 5000000;
    } else if (businessIncome <= 100000000) {
      limit = 3000000;
    }
    return Math.min(payment, limit);
  },

  calculateVentureInvestmentDeduction(incomeAmount, investment) {
    if (investment <= 0) return 0;
    let deduction = 0;
    if (investment <= 30000000) {
      deduction = investment;
    } else if (investment <= 50000000) {
      deduction = Math.floor(30000000 + (investment - 30000000) * 0.7);
    } else {
      deduction = Math.floor(44000000 + (investment - 50000000) * 0.3);
    }
    return Math.min(deduction, Math.floor(incomeAmount * 0.5));
  },

  // 종합소득세 전체 계산 (금융소득 세부 유형 및 벤처투자 소득공제 연동)
  calculateComprehensiveIncome({ 
    totalIncome, 
    incomeType, 
    expense, 
    yellowUmbrella = 0, 
    pensionSavings = 0, 
    irpSavings = 0,
    ventureInvestment = 0,
    // 금융소득 상세 항목
    financialGeneral = 0, // 일반 이자/배당 (원천징수 15.4% 대상)
    financialOverseas = 0, // 해외 이자/배당 (무조건 종합과세 대상)
    isaIncome = 0, // ISA 총 수익
    isaType = 'general', // ISA 유형 ('general': 500만 비과세, 'sub': 1,000만 비과세)
    bondSeparated = 0, // 장기채권 30% 분리과세 신청액
    dependentsCount = 0,
    hasSeniorDependent = false,
    hasDisabledDependent = false
  }) {
    let calculatedExpense = expense;
    let salaryDeduction = 0;
    if (incomeType === 'wage') {
      if (totalIncome <= 5000000) salaryDeduction = Math.floor(totalIncome * 0.7);
      else if (totalIncome <= 15000000) salaryDeduction = Math.floor(3500000 + (totalIncome - 5000000) * 0.4);
      else if (totalIncome <= 45000000) salaryDeduction = Math.floor(7500000 + (totalIncome - 15000000) * 0.15);
      else if (totalIncome <= 100000000) salaryDeduction = Math.floor(12000000 + (totalIncome - 45000000) * 0.05);
      else salaryDeduction = Math.floor(14750000 + (totalIncome - 100000000) * 0.02);
      calculatedExpense = Math.floor(salaryDeduction);
    }
    
    let netIncome = Math.max(0, totalIncome - calculatedExpense);
    
    // 노란우산공제
    const yellowUmbrellaDeduction = incomeType === 'business' 
      ? this.calculateYellowUmbrellaDeduction(netIncome, yellowUmbrella) 
      : 0;

    // 벤처투자 소득공제
    const baseIncome = Math.max(0, netIncome - yellowUmbrellaDeduction);
    const ventureDeduction = this.calculateVentureInvestmentDeduction(baseIncome, ventureInvestment);

    // 기본공제 및 부양가족 기본공제 (종합소득세 인적공제)
    const personDeduction = (1 + dependentsCount) * 1500000 
      + (hasSeniorDependent ? 1000000 : 0) 
      + (hasDisabledDependent ? 2000000 : 0);

    // 과세표준 (금융소득 제외한 일반 종합소득 과표)
    let taxableIncome = Math.max(0, baseIncome - ventureDeduction - personDeduction);

    // ISA 금융소득 계산 (비과세 한도 차감 및 초과분 9.9% 분리과세)
    const isaLimit = isaType === 'sub' ? 10000000 : 5000000;
    const isaTaxfreeAmount = Math.min(isaIncome, isaLimit);
    const isaOverLimitAmount = Math.max(0, isaIncome - isaLimit);
    const isaSeparatedTax = Math.floor(isaOverLimitAmount * 0.09); // 9.9% 분리과세 (지방세 0.9% 제외 원세 9%)

    // 장기채권 30% 분리과세 세액 (지방세 10% 제외한 원천세 27.27%, 지방세는 localTax에서 합산)
    const bondSeparatedTax = Math.floor(bondSeparated * (30 / 110));

    // 종합과세 대상 금융소득 판별
    // 일반 국내 이자/배당 + 해외 이자/배당 합산액 기준
    const compFinancialBase = financialGeneral + financialOverseas;
    let financialTax = 0;
    let isFinancialCompTax = false;
    let financialCompAmount = 0;

    // 해외 이자/배당은 금액과 무관하게 무조건 종합과세 대상에 합산
    if (compFinancialBase <= 20000000) {
      // 2,000만 원 이하는 일반 금융소득은 14% 원천징수 분리과세로 종결
      financialTax = Math.floor(financialGeneral * 0.14);
      // 해외 금융소득은 1원이라도 종합합산
      if (financialOverseas > 0) {
        taxableIncome += financialOverseas;
        financialCompAmount += financialOverseas;
      }
    } else {
      // 2,000만 원 초과 시 초과분 전체 종합소득세 과세표준에 합산
      isFinancialCompTax = true;
      financialCompAmount = compFinancialBase - 20000000;
      taxableIncome += financialCompAmount;
      // 2,000만 원 한도까지는 14% 분리과세 적용
      financialTax = Math.floor(20000000 * 0.14);
    }

    const { tax, rate, deduction } = this.calculateIncomeTax(taxableIncome);

    // 세액공제: 연금저축/IRP
    const totalPension = Math.min(9000000, pensionSavings + irpSavings);
    const pensionRate = (netIncome + financialCompAmount) <= 45000000 ? 0.15 : 0.12;
    const pensionCredit = Math.floor(totalPension * pensionRate);

    // 최종 산출세액 (종합소득세 + 일반금융원천세 + ISA분리과세세액 + 채권분리과세세액)
    let finalTax = Math.max(0, tax + financialTax + isaSeparatedTax + bondSeparatedTax - pensionCredit);
    const localTax = Math.floor(finalTax * 0.1);
    const totalTax = finalTax + localTax;
    
    const allFinancialIncome = financialGeneral + financialOverseas + isaIncome + bondSeparated;
    const effectiveRate = totalIncome > 0 ? Math.round((totalTax / (totalIncome + allFinancialIncome)) * 10000) / 100 : 0;

    return {
      totalIncome,
      financialGeneral,
      financialOverseas,
      isaIncome,
      isaTaxfreeAmount,
      isaOverLimitAmount,
      bondSeparated,
      isFinancialCompTax,
      financialCompAmount,
      expense: calculatedExpense,
      salaryDeduction: incomeType === 'wage' ? calculatedExpense : 0,
      personDeduction,
      yellowUmbrellaDeduction,
      ventureDeduction,
      taxableIncome,
      tax: finalTax,
      localTax,
      totalTax,
      effectiveRate,
      bracketRate: rate * 100,
      bracketDeduction: deduction,
      pensionCredit,
      isaSeparatedTax,
      bondSeparatedTax
    };
  },

  // 2. 양도소득세 계산 (장기보유특별공제 및 이월과세)
  calculateCapitalGains({ type, purchasePrice, sellPrice, holdingPeriodMonths, houseCount, isAdjustedArea, stockType, stockGain, isGiftTransfer = false, giftPastYears = 0 }) {
    if (type === 'real_estate') {
      let finalPurchasePrice = purchasePrice;
      let warningMsg = '';

      if (isGiftTransfer && giftPastYears < 10) {
        warningMsg = '⚠️ 배우자 증여 후 10년 이내 양도로 인해 이월과세가 적용되어 최초 증여자의 취득가액으로 계산됩니다.';
      }

      const gain = Math.max(0, sellPrice - finalPurchasePrice);
      if (gain <= 0) return { gain: 0, tax: 0, localTax: 0, totalTax: 0, warningMsg };

      if (houseCount === 1 && sellPrice <= 1200000000 && holdingPeriodMonths >= 24) {
        return { gain, tax: 0, localTax: 0, totalTax: 0, isNonTaxable: true, warningMsg };
      }

      const years = Math.floor(holdingPeriodMonths / 12);
      let specialDeductionRate = 0;
      if (years >= 3) {
        if (houseCount === 1) {
          specialDeductionRate = Math.min(0.8, years * 0.08); 
        } else {
          specialDeductionRate = Math.min(0.3, years * 0.02); 
        }
      }
      const specialDeduction = Math.floor(gain * specialDeductionRate);
      const baseDeduction = 2500000;
      const taxableIncome = Math.max(0, gain - specialDeduction - baseDeduction);

      let rate = 0;
      let deduction = 0;
      let isAppliedBaseRate = false;

      if (holdingPeriodMonths < 12) {
        rate = 0.70;
      } else if (holdingPeriodMonths < 24) {
        rate = 0.60;
      } else {
        const baseTax = this.calculateIncomeTax(taxableIncome);
        rate = baseTax.rate;
        deduction = baseTax.deduction;
        isAppliedBaseRate = true;
      }

      const tax = isAppliedBaseRate 
        ? Math.max(0, Math.floor(taxableIncome * rate - deduction))
        : Math.max(0, Math.floor(taxableIncome * rate));

      const localTax = Math.floor(tax * 0.1);
      return {
        gain,
        specialDeduction,
        baseDeduction,
        taxableIncome,
        rate: rate * 100,
        tax,
        localTax,
        totalTax: tax + localTax,
        warningMsg
      };
    } else {
      const baseDeduction = 2500000;
      const taxableIncome = Math.max(0, stockGain - baseDeduction);
      let rate = 0;

      if (stockType === 'foreign') {
        rate = 0.20;
      } else if (stockType === 'domestic_major') {
        rate = taxableIncome <= 300000000 ? 0.20 : 0.25;
      }

      const tax = Math.floor(taxableIncome * rate);
      const localTax = Math.floor(tax * 0.1);

      return {
        gain: stockGain,
        baseDeduction,
        taxableIncome,
        rate: rate * 100,
        tax,
        localTax,
        totalTax: tax + localTax
      };
    }
  },

  // 3. 부가가치세 계산 (의제매입 및 신용카드 발행세액공제)
  calculateVAT({ type, sales, purchases, businessType, useAgriPurchase = false, agriPurchaseAmount = 0, hasCardSales = false, cardSalesAmount = 0 }) {
    if (type === 'general') {
      const salesTax = Math.floor(sales * 0.1);
      let purchaseTax = Math.floor(purchases * 0.1);

      let agriDeduction = 0;
      if (useAgriPurchase && agriPurchaseAmount > 0) {
        agriDeduction = Math.floor(agriPurchaseAmount * (8 / 108));
        purchaseTax += agriDeduction;
      }

      let cardCredit = 0;
      if (hasCardSales && cardSalesAmount > 0) {
        cardCredit = Math.min(10000000, Math.floor(cardSalesAmount * 0.013));
      }

      const netTax = Math.max(0, salesTax - purchaseTax - cardCredit);
      return {
        salesTax,
        purchaseTax,
        agriDeduction,
        cardCredit,
        netTax,
        totalPayable: netTax
      };
    } else {
      const vatRates = { retail: 0.15, manufacturing: 0.20, service: 0.30, construction: 0.30 };
      const valRate = vatRates[businessType] || 0.15;
      const salesTax = Math.floor(sales * valRate * 0.1);
      const purchaseTax = Math.floor(purchases * valRate * 0.1);

      let cardCredit = 0;
      if (hasCardSales && cardSalesAmount > 0) {
        cardCredit = Math.min(10000000, Math.floor(cardSalesAmount * 0.013));
      }

      const netTax = Math.max(0, salesTax - purchaseTax - cardCredit);
      return {
        salesTax,
        purchaseTax,
        cardCredit,
        netTax,
        totalPayable: netTax,
        businessRate: valRate * 100
      };
    }
  },

  // 4. 연말정산 정밀 계산
  calculateYearEndTax({
    totalSalary,
    dependents,
    cardUsage,
    cashUsage,
    pensionSavings,
    irpSavings,
    medicalExpense,
    educationExpense,
    monthlyRent,
    childrenCount = 0,
    isMarriedThisYear = false,
    isSmeEmployee = false,
    hasSeniorDependent = false, 
    hasDisabledDependent = false, 
    isFemaleHead = false, 
    isSingleParent = false, 
    hasBirthOrAdoption = false, 
    birthOrder = 1, 
    housingSubscription = 0, 
    housingLoanRepay = 0, 
    mortgageInterest = 0, 
    insurancePremium = 0, 
    studentLoanRepay = 0, 
    donationAmount = 0, 
    localDonation = 0, 
    ventureInvestment = 0 
  }) {
    let salaryDeduction = 0;
    if (totalSalary <= 5000000) salaryDeduction = Math.floor(totalSalary * 0.7);
    else if (totalSalary <= 15000000) salaryDeduction = Math.floor(3500000 + (totalSalary - 5000000) * 0.4);
    else if (totalSalary <= 45000000) salaryDeduction = Math.floor(7500000 + (totalSalary - 15000000) * 0.15);
    else if (totalSalary <= 100000000) salaryDeduction = Math.floor(12000000 + (totalSalary - 45000000) * 0.05);
    else salaryDeduction = Math.floor(14750000 + (totalSalary - 100000000) * 0.02);

    const grossIncome = Math.max(0, totalSalary - salaryDeduction);

    let personDeduction = (1 + dependents) * 1500000;
    if (hasSeniorDependent) personDeduction += 1000000;
    if (hasDisabledDependent) personDeduction += 2000000;
    
    if (isSingleParent) {
      personDeduction += 1000000;
    } else if (isFemaleHead && totalSalary <= 41666666) {
      personDeduction += 500000;
    }

    let housingDeduction = 0;
    if (totalSalary <= 70000000) {
      housingDeduction += Math.min(1200000, Math.floor(housingSubscription * 0.4));
    }
    housingDeduction += Math.min(4000000, Math.floor(housingLoanRepay * 0.4));
    housingDeduction += Math.min(18000000, mortgageInterest);

    const threshold = Math.floor(totalSalary * 0.25);
    const totalCardUsage = cardUsage + cashUsage;
    let cardDeduction = 0;

    if (totalCardUsage > threshold) {
      const excess = totalCardUsage - threshold;
      if (cardUsage >= threshold) {
        cardDeduction = Math.floor((cardUsage - threshold) * 0.15) + Math.floor(cashUsage * 0.3);
      } else {
        cardDeduction = Math.floor(excess * 0.3);
      }
      let limit = 3000000;
      if (totalSalary > 120000000) limit = 2000000;
      else if (totalSalary > 70000000) limit = 2500000;
      cardDeduction = Math.min(limit, cardDeduction);
    }

    const tempDeductions = personDeduction + cardDeduction + housingDeduction;
    const currentIncome = Math.max(0, grossIncome - tempDeductions);
    const ventureDeduction = this.calculateVentureInvestmentDeduction(currentIncome, ventureInvestment);

    const totalDeductions = tempDeductions + ventureDeduction;
    const taxableIncome = Math.max(0, grossIncome - totalDeductions);

    const { tax: calculatedTax } = this.calculateIncomeTax(taxableIncome);

    let taxCredits = 0;

    let workTaxCredit = 0;
    if (calculatedTax <= 1300000) workTaxCredit = Math.floor(calculatedTax * 0.55);
    else workTaxCredit = Math.floor(715000 + (calculatedTax - 1300000) * 0.3);
    let workCreditLimit = totalSalary > 70000000 ? 660000 : 740000;
    workTaxCredit = Math.min(workCreditLimit, workTaxCredit);
    taxCredits += workTaxCredit;

    let childCredit = 0;
    if (childrenCount === 1) childCredit = 250000;
    else if (childrenCount === 2) childCredit = 550000;
    else if (childrenCount >= 3) childCredit = 550000 + (childrenCount - 2) * 400000;
    taxCredits += childCredit;

    let birthCredit = 0;
    if (hasBirthOrAdoption) {
      if (birthOrder === 1) birthCredit = 300000;
      else if (birthOrder === 2) birthCredit = 500000;
      else birthCredit = 700000;
    }
    taxCredits += birthCredit;

    const totalPension = Math.min(9000000, pensionSavings + irpSavings);
    let pensionCredit = 0;
    if (totalPension > 0) {
      const rate = totalSalary <= 55000000 ? 0.15 : 0.12;
      pensionCredit = Math.floor(totalPension * rate);
      taxCredits += pensionCredit;
    }

    let insuranceCredit = Math.min(120000, Math.floor(insurancePremium * 0.12));
    taxCredits += insuranceCredit;

    let medicalCredit = 0;
    const medicalThreshold = Math.floor(totalSalary * 0.03);
    if (medicalExpense > medicalThreshold) {
      medicalCredit = Math.floor((medicalExpense - medicalThreshold) * 0.15);
      taxCredits += medicalCredit;
    }

    const totalEdu = educationExpense + studentLoanRepay;
    let eduCredit = Math.floor(totalEdu * 0.15);
    taxCredits += eduCredit;

    let rentCredit = 0;
    if (monthlyRent > 0 && totalSalary <= 80000000) {
      const rate = totalSalary <= 55000000 ? 0.17 : 0.15;
      rentCredit = Math.floor(Math.min(10000000, monthlyRent * 12) * rate);
      taxCredits += rentCredit;
    }

    let donationCredit = 0;
    if (localDonation > 0) {
      if (localDonation <= 100000) donationCredit += localDonation;
      else donationCredit += Math.floor(100000 + (localDonation - 100000) * 0.15);
    }
    donationCredit += Math.floor(donationAmount * 0.15);
    taxCredits += donationCredit;

    if (isMarriedThisYear) {
      taxCredits += 500000;
    }

    let finalTax = Math.max(0, calculatedTax - taxCredits);

    let smeReduction = 0;
    if (isSmeEmployee) {
      smeReduction = Math.min(2000000, Math.floor(finalTax * 0.9));
      finalTax -= smeReduction;
    }

    const localTax = Math.floor(finalTax * 0.1);

    return {
      salaryDeduction,
      grossIncome,
      personDeduction,
      cardDeduction,
      housingDeduction,
      ventureDeduction,
      taxableIncome,
      calculatedTax,
      workTaxCredit,
      childCredit,
      birthCredit,
      pensionCredit,
      insuranceCredit,
      medicalCredit,
      eduCredit,
      rentCredit,
      donationCredit,
      smeReduction,
      finalTax,
      localTax,
      totalTax: finalTax + localTax
    };
  }
};

// ----- new feature functions added by TAX NAVI expansion -----

TaxCalculator.calculateGiftTax = function(opts) {
  var giftAmount = opts.giftAmount || 0;
  var recipient = opts.recipient || "adult_child";
  var giftPast10Years = opts.giftPast10Years || 0;
  var exemption;
  switch (recipient) {
    case "spouse": exemption = 600000000; break;
    case "minor":  exemption = 20000000;  break;
    case "child": case "adult_child": exemption = 50000000; break;
    default: exemption = 50000000;
  }
  var cumulative = giftAmount + giftPast10Years;
  var taxableGift = Math.max(0, cumulative - exemption);
  var brackets = [
    { limit: 100000000,  rate: 0.10, ded: 0 },
    { limit: 500000000,  rate: 0.20, ded: 10000000 },
    { limit: 1000000000, rate: 0.30, ded: 60000000 },
    { limit: 3000000000, rate: 0.40, ded: 160000000 },
    { limit: Infinity,   rate: 0.50, ded: 460000000 }
  ];
  var bracket = brackets[brackets.length - 1];
  for (var i = 0; i < brackets.length; i++) {
    if (taxableGift <= brackets[i].limit) { bracket = brackets[i]; break; }
  }
  var tax = Math.floor(taxableGift * bracket.rate - bracket.ded);
  if (tax < 0) tax = 0;
  var localTax = Math.floor(tax * 0.1);
  return { taxableGift: taxableGift, tax: tax, localTax: localTax, totalTax: tax + localTax, rate: bracket.rate * 100, exemption: exemption, cumulative: cumulative };
};

TaxCalculator.calculatePropertyTax = function(opts) {
  var publicPrice = opts.publicPrice || 0;
  var marketPrice = opts.marketPrice || publicPrice;
  var houseCount = opts.houseCount || 1;
  var isOneHouse = opts.isOneHouse !== undefined ? opts.isOneHouse : (houseCount === 1);
  var propertyBrackets = [
    { limit: 60000000,   rate: 0.001, ded: 0 },
    { limit: 150000000,  rate: 0.0015, ded: 30000 },
    { limit: 300000000,  rate: 0.0025, ded: 180000 },
    { limit: Infinity,   rate: 0.004,  ded: 630000 }
  ];
  var taxableProperty = Math.floor(publicPrice * 0.6);
  var pBracket = propertyBrackets[propertyBrackets.length - 1];
  for (var pi = 0; pi < propertyBrackets.length; pi++) {
    if (taxableProperty <= propertyBrackets[pi].limit) { pBracket = propertyBrackets[pi]; break; }
  }
  var propertyTax = Math.floor(taxableProperty * pBracket.rate - pBracket.ded);
  if (propertyTax < 0) propertyTax = 0;
  var compDeduction = isOneHouse ? 1200000000 : 900000000;
  var compTaxable = Math.max(0, publicPrice - compDeduction);
  var compFairRate = isOneHouse ? 0.6 : 1.0;
  compTaxable = Math.floor(compTaxable * compFairRate);
  var compBrackets = [
    { limit: 3000000000,  rate: 0.006, ded: 0 },
    { limit: 5000000000,  rate: 0.012, ded: 18000000 },
    { limit: 94000000000, rate: 0.018, ded: 48000000 },
    { limit: Infinity,    rate: 0.030, ded: 1176000000 }
  ];
  var cBracket = compBrackets[compBrackets.length - 1];
  for (var ci = 0; ci < compBrackets.length; ci++) {
    if (compTaxable <= compBrackets[ci].limit) { cBracket = compBrackets[ci]; break; }
  }
  var comprehensiveTax = Math.floor(compTaxable * cBracket.rate - cBracket.ded);
  if (comprehensiveTax < 0) comprehensiveTax = 0;
  var specialTax = Math.floor(comprehensiveTax * 0.2);
  return { propertyTax: propertyTax, comprehensiveTax: comprehensiveTax, specialTax: specialTax, totalTax: propertyTax + comprehensiveTax + specialTax, taxableProperty: taxableProperty, compTaxable: compTaxable };
};

var EXPENSE_RATIO_TABLE = {
  "940909": { name: "정보통신업 (프로그래머/IT)", simpleRate: 0.641, standardRate: 0.182 },
  "940100": { name: "제조업", simpleRate: 0.704, standardRate: 0.224 },
  "940200": { name: "도소매업", simpleRate: 0.643, standardRate: 0.222 },
  "940300": { name: "음식점업", simpleRate: 0.756, standardRate: 0.195 },
  "940400": { name: "부동산업", simpleRate: 0.535, standardRate: 0.270 },
  "940500": { name: "서비스업 (크몽/숨고 등)", simpleRate: 0.676, standardRate: 0.213 },
  "940600": { name: "건설업", simpleRate: 0.794, standardRate: 0.269 },
  "940700": { name: "운수업", simpleRate: 0.805, standardRate: 0.301 },
  "940800": { name: "의료업", simpleRate: 0.557, standardRate: 0.123 },
  "941000": { name: "교육서비스업", simpleRate: 0.727, standardRate: 0.256 },
  "941100": { name: "예술/스포츠업", simpleRate: 0.633, standardRate: 0.188 },
  "941200": { name: "유튜브/1인 미디어", simpleRate: 0.598, standardRate: 0.154 }
};

TaxCalculator.getExpenseRatioInfo = function(bizCode) { return EXPENSE_RATIO_TABLE[bizCode] || EXPENSE_RATIO_TABLE["940500"]; };

TaxCalculator.compareExpenseRatios = function(bizCode, revenue, declaredType) {
  var info = TaxCalculator.getExpenseRatioInfo(bizCode);
  var simpleExpense = Math.floor(revenue * info.simpleRate);
  var standardExpense = Math.floor(revenue * info.standardRate);
  var saving = standardExpense - simpleExpense;
  var recommended = simpleExpense >= standardExpense ? "simple" : "standard";
  return { bizName: info.name, simpleExpense: simpleExpense, simpleRate: info.simpleRate, standardExpense: standardExpense, standardRate: info.standardRate, saving: saving, recommended: recommended, isSimpleBetter: simpleExpense >= standardExpense };
};

TaxCalculator.getBusinessCodeList = function() {
  var list = [];
  for (var code in EXPENSE_RATIO_TABLE) { if (EXPENSE_RATIO_TABLE.hasOwnProperty(code)) { list.push({ code: code, name: EXPENSE_RATIO_TABLE[code].name }); } }
  return list;
};

TaxCalculator.calculateHealthInsurance = function(opts) {
  var DEFAULT_RATE = 0.0715;
  var LONGTERM_RATE = 0.1295;
  if (opts.isEmployee === false) {
    var income = opts.regionalIncome || 0;
    var property = opts.regionalPropertyValue || 0;
    var incomeScore = Math.floor(income * 0.035);
    var propertyScore = Math.floor(property * 0.004);
    var monthly = Math.floor((incomeScore + propertyScore) * DEFAULT_RATE);
    return { type: "regional", monthlyPremium: monthly, annualPremium: monthly * 12, details: { incomeScore: incomeScore, propertyScore: propertyScore } };
  }
  var earnedMonthly = Math.floor((opts.earnedIncome || 0) / 12);
  var workedPremium = Math.floor(earnedMonthly * DEFAULT_RATE);
  var longTermCare = Math.floor(workedPremium * LONGTERM_RATE);
  var otherIncome = opts.otherIncome || 0;
  var incomeMonthlyPremium = 0;
  if (otherIncome > 20000000) {
    var incomeBase = Math.floor((otherIncome - 20000000) * 0.0715);
    incomeMonthlyPremium = Math.floor(incomeBase / 12);
  }
  var totalMonthly = workedPremium + longTermCare + incomeMonthlyPremium;
  return { type: "employee", monthlyPremium: totalMonthly, annualPremium: totalMonthly * 12, workedPremium: workedPremium, longTermCare: longTermCare, incomeMonthlyPremium: incomeMonthlyPremium, earnedMonthly: earnedMonthly };
};

TaxCalculator.checkDependentStatus = function(opts) {
  var otherIncome = opts.otherIncome || 0;
  var incomeLimit = opts.isWageOnly ? 50000000 : 34000000;
  if (otherIncome > incomeLimit) { return { isEligible: false, reason: "소득초과: 종합소득 " + otherIncome.toLocaleString() + "원으로 피부양자 자격 상실 (기준 " + incomeLimit.toLocaleString() + "원)" }; }
  if (opts.isPropertyOwner) { return { isEligible: false, reason: "재산보유: 재산세 과세대상 재산 보유로 피부양자 자격 상실 가능" }; }
  return { isEligible: true, reason: "✅ 피부양자 자격 유지" };
};
