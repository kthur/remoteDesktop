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
    // 2026년 개정: 비과세 한도 2배 상향 (일반 500만→500만, 서민 1,000만→1,000만)  
    // ※ 2026년 세법 개정안 기준: 일반 500만, 서민 1,000만 (변동 없으나 납입한도 2배)
    isaLimits: {
      sub: 10000000,
      general: 5000000
    },
    // ISA 개편 (2026년): 납입한도 연 4,000만 원, 총 2억 원
    isaNewLimits: {
      annual: 40000000,
      total: 200000000,
      taxfreeGeneral: 5000000,
      taxfreeSub: 10000000
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

  calculateSalaryDeduction(totalSalary) {
    if (totalSalary <= 5000000) return Math.floor(totalSalary * 0.7);
    if (totalSalary <= 15000000) return Math.floor(3500000 + (totalSalary - 5000000) * 0.4);
    if (totalSalary <= 45000000) return Math.floor(7500000 + (totalSalary - 15000000) * 0.15);
    if (totalSalary <= 100000000) return Math.floor(12000000 + (totalSalary - 45000000) * 0.05);
    return Math.floor(14750000 + (totalSalary - 100000000) * 0.02);
  },

  applyProgressiveBrackets(value, brackets) {
    if (value <= 0) return { tax: 0, rate: 0, deduction: 0 };
    let target = brackets[brackets.length - 1];
    for (const bracket of brackets) {
      if (value <= bracket.limit) { target = bracket; break; }
    }
    return {
      tax: Math.max(0, Math.floor(value * target.rate - (target.ded || 0))),
      rate: target.rate,
      deduction: target.ded || 0
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
      salaryDeduction = this.calculateSalaryDeduction(totalIncome);
      calculatedExpense = salaryDeduction;
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
      if (gain <= 0) return { gain: 0, specialDeduction: 0, baseDeduction: 0, taxableIncome: 0, tax: 0, localTax: 0, totalTax: 0, warningMsg };

      if (houseCount === 1 && sellPrice <= 1200000000 && holdingPeriodMonths >= 24) {
        return { gain, specialDeduction: 0, baseDeduction: 0, taxableIncome: 0, tax: 0, localTax: 0, totalTax: 0, isNonTaxable: true, warningMsg };
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
  calculateYearEndTax(opts) {
    const {
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
      ventureInvestment = 0,
      traditionalMarket = 0,
      publicTransit = 0,
      bookPerformance = 0,
      isHouseholder = true,
      spouseHousingSubscription = 0,
      isNoHouse = true
    } = opts || {};
    const salaryDeduction = this.calculateSalaryDeduction(totalSalary);

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
    // 주택청약종합저축: 세대주 및 배우자 납입분 공제 (2025년 개정)
    var subResult = this.calculateHousingSubscriptionDeduction({
      totalSalary: totalSalary,
      isHouseholder: isHouseholder !== false,
      myPayment: housingSubscription,
      spousePayment: spouseHousingSubscription || 0,
      isNoHouse: isNoHouse !== false
    });
    if (subResult.isEligible) {
      housingDeduction += subResult.totalDeduction;
    }
    housingDeduction += Math.min(4000000, Math.floor(housingLoanRepay * 0.4));
    housingDeduction += Math.min(18000000, mortgageInterest);

    // 추가 소비 공제: 전통시장(30%), 대중교통(40%), 도서공연(30%) — 별도 한도
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

    // 추가 공제: 기본 한도와 별도로 추가 한도 적용
    const addLimitTrad = 3000000;
    const addLimitTransit = 3000000;
    const addLimitBook = totalSalary <= 70000000 ? 3000000 : 0;
    const tradDeduction = Math.min(Math.floor(traditionalMarket * 0.3), addLimitTrad);
    const transitDeduction = Math.min(Math.floor(publicTransit * 0.4), addLimitTransit);
    const bookDeduction = addLimitBook > 0 ? Math.min(Math.floor(bookPerformance * 0.3), addLimitBook) : 0;

    const tempDeductions = personDeduction + cardDeduction + tradDeduction + transitDeduction + bookDeduction + housingDeduction;
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
      tradDeduction,
      transitDeduction,
      bookDeduction,
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

  var bracketResult = TaxCalculator.applyProgressiveBrackets(taxableGift, brackets);
  
  var pastTaxable = Math.max(0, giftPast10Years - exemption);
  var pastBracketResult = TaxCalculator.applyProgressiveBrackets(pastTaxable, brackets);
  var pastTax = pastBracketResult.tax;
  
  var tax = Math.max(0, bracketResult.tax - pastTax);
  var localTax = Math.floor(tax * 0.1);
  
  return { 
    taxableGift: taxableGift, 
    tax: tax, 
    localTax: localTax, 
    totalTax: tax + localTax, 
    rate: bracketResult.rate * 100, 
    exemption: exemption, 
    cumulative: cumulative 
  };
};

// ──────────────────────────────────────────────
// 상속세 계산 (2025~2026년 개정 반영)
// ──────────────────────────────────────────────
TaxCalculator.calculateInheritanceTax = function(opts) {
  var totalAsset = opts.totalAsset || 0;          // 피상속인 총 재산
  var spouseShare = opts.spouseShare || 0;         // 배우자 실질 상속액 (0=최소공제)
  var childCount = opts.childCount || 0;           // 자녀 수
  var hasLivingSpouse = opts.hasLivingSpouse !== false; // 배우자 생존 여부
  var isCoResidentHouse = opts.isCoResidentHouse || false; // 동거주택 상속공제 대상
  var coResidentHouseValue = opts.coResidentHouseValue || 0; // 동거주택 가액
  var financialAssetValue = opts.financialAssetValue || 0; // 순금융재산액
  var financialDebt = opts.financialDebt || 0;     // 금융채무
  var giftPast10Years = opts.giftPast10Years || 0; // 사전증여(10년 내)

  // 1. 상속세 과세가액 = 총 재산 + 사전증여(10년 내 합산)
  var grossEstate = totalAsset + giftPast10Years;

  // 2. 각종 공제 계산
  // 기초공제 2억 원
  var basicDeduction = 200000000;

  // 자녀공제: 1인당 5억 원 (개정: 5천만→5억)
  var childDeduction = childCount * 500000000;

  // 일괄공제 5억 원 (기초+자녀 합계보다 클 경우 선택)
  var lumpSumDeduction = 500000000;
  var personDeduction = Math.max(lumpSumDeduction, basicDeduction + childDeduction);

  // 배우자 상속공제
  var spouseDeduction = 0;
  if (hasLivingSpouse) {
    // 법정상속지분율 간이 계산 (자녀 수에 따라)
    var legalShareRate = 1.5 / (childCount + 1.5); // 배우자 1.5 + 자녀 1/n
    var legalShare = Math.floor(totalAsset * legalShareRate);
    // 배우자 상속공제 = 실제 상속액과 법정지분율 한도 내에서 최대 30억
    // 최소공제 5억 원 (실제 상속 0원이어도 적용)
    var spouseMinDeduction = 500000000;
    if (spouseShare > 0) {
      // 실제 상속받은 금액이 있으면: 법정지분율 한도 내에서 실제 상속액 공제
      var actualSpouseDeduction = Math.min(spouseShare, legalShare, 3000000000);
      spouseDeduction = Math.max(spouseMinDeduction, actualSpouseDeduction);
    } else {
      spouseDeduction = spouseMinDeduction;
    }
  }

  // 동거주택 상속공제
  var coResidentDeduction = 0;
  if (isCoResidentHouse) {
    coResidentDeduction = Math.min(coResidentHouseValue, 600000000);
  }

  // 금융재산 상속공제
  var netFinancial = Math.max(0, financialAssetValue - financialDebt);
  var financialDeduction = 0;
  if (netFinancial > 0) {
    if (netFinancial <= 20000000) {
      financialDeduction = netFinancial;
    } else if (netFinancial <= 100000000) {
      financialDeduction = 20000000;
    } else {
      financialDeduction = Math.min(Math.floor(netFinancial * 0.2), 200000000);
    }
  }

  var totalDeductions = personDeduction + spouseDeduction + coResidentDeduction + financialDeduction;
  var taxableEstate = Math.max(0, grossEstate - totalDeductions);

  // 4. 상속세율 (개정: 최고 50% 구간 삭제 → 최고 40%)
  var bracketResult = TaxCalculator.applyProgressiveBrackets(taxableEstate, [
    { limit: 200000000,   rate: 0.10, ded: 0 },
    { limit: 500000000,   rate: 0.20, ded: 20000000 },
    { limit: 1000000000,  rate: 0.30, ded: 70000000 },
    { limit: 3000000000,  rate: 0.40, ded: 170000000 },
    { limit: Infinity,    rate: 0.40, ded: 170000000 }
  ]);
  var localTax = Math.floor(bracketResult.tax * 0.1);

  return {
    grossEstate: grossEstate,
    basicDeduction: basicDeduction,
    childDeduction: childDeduction,
    personDeduction: personDeduction,
    spouseDeduction: spouseDeduction,
    coResidentDeduction: coResidentDeduction,
    financialDeduction: financialDeduction,
    totalDeductions: totalDeductions,
    taxableEstate: taxableEstate,
    tax: bracketResult.tax,
    localTax: localTax,
    totalTax: bracketResult.tax + localTax,
    rate: bracketResult.rate * 100,
    exemptionLimit: personDeduction + spouseDeduction,
    isTaxFree: taxableEstate <= 0,
    spouseLegalShare: hasLivingSpouse ? Math.floor(totalAsset * (1.5 / (childCount + 1.5))) : 0
  };
};

// ──────────────────────────────────────────────
// 혼인·출산 증여재산공제 (2024년 신설, 기본공제와 별도)
// ──────────────────────────────────────────────
/**
 * 혼인/출산 증여재산공제 계산
 * @param {Object} opts
 * @param {number} opts.giftAmount       - 증여 금액
 * @param {string} opts.reason           - 'marriage' | 'birth' | 'both'
 * @param {number} opts.basicExemptionUsed - 10년 기본공제 사용액 (성인자녀 5천만)
 * @param {number} opts.past10YrsGift    - 최근 10년 내 동일인 증여 합계
 */
TaxCalculator.calculateMarriageBirthGiftTax = function(opts) {
  var giftAmount = opts.giftAmount || 0;
  var reason = opts.reason || 'marriage';
  var past10YrsGift = opts.past10YrsGift || 0;

  // 기본 증여재산공제 (성인자녀 5천만) - 과거 증여에 의해 한도 차감
  var remainingBasicExemption = Math.max(0, 50000000 - past10YrsGift);

  // 혼인·출산 특별공제 (통합 한도 1억 원, 중복 불가)
  var specialExemption = 100000000;

  var totalExemption = remainingBasicExemption + specialExemption;
  
  // 누진합산 대상 과세표준 계산
  // 10개년 합산과세표준 = 누계액 - (최초 기본 5천만 + 혼인/출산 1억)
  var cumulative = giftAmount + past10YrsGift;
  var taxableGift = Math.max(0, cumulative - (50000000 + specialExemption));

  var brackets = [
    { limit: 100000000,  rate: 0.10, ded: 0 },
    { limit: 500000000,  rate: 0.20, ded: 10000000 },
    { limit: 1000000000, rate: 0.30, ded: 60000000 },
    { limit: 3000000000, rate: 0.40, ded: 160000000 },
    { limit: Infinity,   rate: 0.50, ded: 460000000 }
  ];

  // 기납부세액 공제액 계산 (기존 증여 10개년 과표에 대해 계산된 세액)
  var pastTaxable = Math.max(0, past10YrsGift - 50000000);
  var pastBracketResult = TaxCalculator.applyProgressiveBrackets(pastTaxable, brackets);
  var pastTax = pastBracketResult.tax;

  var cumulativeBracketResult = TaxCalculator.applyProgressiveBrackets(taxableGift, brackets);
  
  // 최종 증여세 = 합산 증여세 - 기납부세액
  var tax = Math.max(0, cumulativeBracketResult.tax - pastTax);
  var localTax = Math.floor(tax * 0.1);

  var isTaxFree = taxableGift <= 0;
  return {
    giftAmount: giftAmount,
    basicExemption: remainingBasicExemption,
    specialExemption: specialExemption,
    totalExemption: totalExemption,
    cumulative: cumulative,
    taxableGift: taxableGift,
    tax: tax,
    localTax: localTax,
    totalTax: tax + localTax,
    rate: cumulativeBracketResult.rate * 100,
    isTaxFree: isTaxFree,
    maxTaxFreeAmount: totalExemption,
    양가활용가능: "양가(친정+시댁) 각각 1.5억씩 총 3억 원까지 증여세 없이 이전 가능"
  };
};

TaxCalculator.calculatePropertyTax = function(opts) {
  var publicPrice = opts.publicPrice || 0;
  var marketPrice = opts.marketPrice || publicPrice;
  var houseCount = opts.houseCount || 1;
  var isOneHouse = opts.isOneHouse !== undefined ? opts.isOneHouse : (houseCount === 1);
  var taxableProperty = Math.floor(publicPrice * 0.6);
  var propertyResult = TaxCalculator.applyProgressiveBrackets(taxableProperty, [
    { limit: 60000000,   rate: 0.001, ded: 0 },
    { limit: 150000000,  rate: 0.0015, ded: 30000 },
    { limit: 300000000,  rate: 0.0025, ded: 180000 },
    { limit: Infinity,   rate: 0.004,  ded: 630000 }
  ]);
  var propertyTax = propertyResult.tax;
  var compDeduction = isOneHouse ? 1200000000 : 900000000;
  var compTaxable = Math.max(0, publicPrice - compDeduction);
  var compFairRate = isOneHouse ? 0.6 : 1.0;
  compTaxable = Math.floor(compTaxable * compFairRate);
  var compResult = TaxCalculator.applyProgressiveBrackets(compTaxable, [
    { limit: 3000000000,  rate: 0.006, ded: 0 },
    { limit: 5000000000,  rate: 0.012, ded: 18000000 },
    { limit: 94000000000, rate: 0.018, ded: 48000000 },
    { limit: Infinity,    rate: 0.030, ded: 1176000000 }
  ]);
  var comprehensiveTax = compResult.tax;
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

// ──────────────────────────────────────────────
// ISA 개편 (2026년): 납입한도 2배, 국내투자형, ISA→연금 전환
// ──────────────────────────────────────────────
TaxCalculator.calculateISAOptimization = function(opts) {
  var annualIncome = opts.annualIncome || 0;       // 연 납입액
  var totalIncome = opts.totalIncome || 0;         // 총급여 (서민형 자격용)
  var incomeType = opts.incomeType || 'wage';       // 소득유형
  var isFinancialCompTax = opts.isFinancialCompTax || false; // 금융소득종합과세 대상?
  var currentIsaType = opts.currentIsaType || 'general'; // 현재 ISA 유형
  var isaBalance = opts.isaBalance || 0;            // 현재 ISA 잔고
  var isMatured = opts.isMatured || false;          // 만기 도달?
  var pensionTransfer = opts.pensionTransfer || 0;  // ISA→연금 전환 금액

  // 1. 납입 한도 (개정: 연 4천만, 총 2억)
  var annualLimit = 40000000;
  var totalLimit = 200000000;

  // 2. ISA 유형별 비과세 한도 (개정: 일반 500만, 서민 1,000만)
  var isaType = currentIsaType;
  if (incomeType === 'wage' && totalIncome > 50000000 && isaType === 'sub') {
    isaType = 'general'; // 서민형 자격 상실 시 일반형
  }
  var taxfreeLimit = isaType === 'sub' ? 10000000 : 5000000;

  // 3. 국내투자형 ISA (금융소득종합과세자 가입 가능)
  var isDomesticType = opts.isDomesticType || false;
  var domesticSeparatedRate = 0.14; // 14% 분리과세 (지방세 포함 15.4%)

  // 4. 일반형 세제 혜택
  var normalTaxfree = Math.min(isaBalance, taxfreeLimit);
  var normalExcess = Math.max(0, isaBalance - taxfreeLimit);
  var normalSeparatedTax = Math.floor(normalExcess * 0.09);

  // 5. 국내투자형 세제 혜택 (종합과세자도 분리과세 14%로 종결)
  var domesticTax = 0;
  if (isDomesticType) {
    domesticTax = Math.floor(isaBalance * domesticSeparatedRate);
  }

  // 6. ISA 만기 → 연금계좌 전환 세액공제 (전환액 10%, 최대 300만)
  var pensionTransferCredit = 0;
  if (isMatured && pensionTransfer > 0) {
    var maxTransferCredit = 3000000;
    pensionTransferCredit = Math.min(maxTransferCredit, Math.floor(pensionTransfer * 0.1));
  }

  return {
    annualLimit: annualLimit,
    totalLimit: totalLimit,
    taxfreeLimit: taxfreeLimit,
    isaType: isaType,
    normalTaxfree: normalTaxfree,
    normalExcess: normalExcess,
    normalSeparatedTax: normalSeparatedTax,
    domesticSeparatedRate: domesticSeparatedRate * 100,
    domesticTax: domesticTax,
    pensionTransferCredit: pensionTransferCredit,
    recommendDomesticType: isFinancialCompTax,
    summary: (isFinancialCompTax
      ? "금융소득종합과세 대상자 → 국내투자형 ISA(14% 분리과세) 활용 추천"
      : "일반 ISA 가입 가능 (연 " + annualLimit.toLocaleString() + "원 한도)")
  };
};

// ──────────────────────────────────────────────
// 고향사랑기부제 (2026년 개편: 20만 원 44% 구간 신설)
// ──────────────────────────────────────────────
TaxCalculator.calculateHometownDonation = function(opts) {
  var donationAmount = Math.max(0, opts.donationAmount || 0);
  var isDisasterArea = opts.isDisasterArea || false;
  var taxRate = opts.taxRate || 0.15; // 사용자 한계세율

  // 2026년 개편 세액공제 구조
  var credit = 0;
  // 10만 원까지 100%
  var first100k = Math.min(donationAmount, 100000);
  credit += first100k;

  // 10만 초과 20만 이하 44%
  if (donationAmount > 100000) {
    var secondBracket = Math.min(donationAmount - 100000, 100000);
    credit += Math.floor(secondBracket * 0.44);
  }

  // 20만 초과분 16.5% (특별재난지역은 33%)
  if (donationAmount > 200000) {
    var thirdBracket = donationAmount - 200000;
    var thirdRate = isDisasterArea ? 0.33 : 0.165;
    credit += Math.floor(thirdBracket * thirdRate);
  }

  // 답례품 가치 (기부액의 30%)
  var giftValue = Math.floor(donationAmount * 0.3);

  // 총 체감 혜택
  var totalBenefit = credit + giftValue;

  // 최적 기부액 추천
  var optimalAmount = 200000;
  var optimalCredit = 100000 + Math.floor(100000 * 0.44);
  var optimalGift = Math.floor(optimalAmount * 0.3);
  var optimalBenefit = optimalCredit + optimalGift;

  return {
    donationAmount: donationAmount,
    creditFirst100k: first100k,
    creditSecondBracket: Math.max(0, Math.min(donationAmount - 100000, 100000) > 0 ? Math.floor(Math.min(donationAmount - 100000, 100000) * 0.44) : 0),
    creditThirdBracket: donationAmount > 200000 ? Math.floor((donationAmount - 200000) * (isDisasterArea ? 0.33 : 0.165)) : 0,
    totalCredit: credit,
    giftValue: giftValue,
    totalBenefit: totalBenefit,
    netCost: donationAmount - totalBenefit,
    effectiveReturnRate: donationAmount > 0 ? Math.round(totalBenefit / donationAmount * 100) : 0,
    optimalAmount: optimalAmount,
    optimalCredit: optimalCredit,
    optimalGift: optimalGift,
    optimalBenefit: optimalBenefit,
    isOptimal: donationAmount === optimalAmount,
    recommendation: "20만 원 기부 시 14.4만 원 환급 + 6만 원 답례품 = 원금 상회"
  };
};

// ──────────────────────────────────────────────
// 체육시설 이용료 소득공제 (2025.7월 신설)
// ──────────────────────────────────────────────
TaxCalculator.calculateSportsDeduction = function(opts) {
  var totalSalary = opts.totalSalary || 0;
  var facilityFee = opts.facilityFee || 0; // 수영장/체육단련장 이용료
  var hasPT = opts.hasPT || false;          // PT 포함 여부

  // 대상: 총급여 7,000만 원 이하
  if (totalSalary > 70000000) {
    return { isEligible: false, reason: "총급여 7,000만 원 초과로 공제 대상 아님", totalSalary: totalSalary };
  }

  // PT 포함 시 50%만 시설 이용료로 인정
  var eligibleAmount = hasPT ? Math.floor(facilityFee * 0.5) : facilityFee;
  var deductionLimit = 3000000;
  var deductionBase = Math.min(eligibleAmount, deductionLimit);
  var deduction = Math.floor(deductionBase * 0.3);

  return {
    isEligible: true,
    totalSalary: totalSalary,
    facilityFee: facilityFee,
    hasPT: hasPT,
    eligibleAmount: eligibleAmount,
    deductionLimit: deductionLimit,
    deduction: deduction,
    taxableIncomeReduction: deduction
  };
};

// ──────────────────────────────────────────────
// 간주임대료 (2026년 개정: 2주택 고가 과세 신설)
// ──────────────────────────────────────────────
TaxCalculator.calculateDeemedRent = function(opts) {
  var houseCount = opts.houseCount || 0;
  var jeonseDeposits = opts.jeonseDeposits || 0;   // 전세보증금 합계
  var hasHighPriceHouse = opts.hasHighPriceHouse || false; // 기준시가 12억 초과 주택 보유?
  var smallHouseExclusion = opts.smallHouseExclusion || 0; // 소형주택 공제액 (40㎡/2억)
  var interestRate = opts.interestRate || 0.02;     // 정기예금 이자율
  var financialIncome = opts.financialIncome || 0;  // 금융수익

  var deductionBase = 0;
  var warningMsg = '';

  if (houseCount >= 3) {
    // 3주택 이상: 보증금 합계 3억 초과분 과세
    deductionBase = 300000000;
  } else if (houseCount === 2 && hasHighPriceHouse) {
    // 2주택 + 고가주택(12억 초과) 보유: 보증금 합계 12억 초과분 과세 (2026.1.1~)
    deductionBase = 1200000000;
    warningMsg = '고가 2주택자 간주임대료 과세 대상 (2026.1.1부터)';
  } else {
    return { isTaxable: false, deemedRent: 0, reason: '간주임대료 과세 대상 아님' };
  }

  var excessDeposit = Math.max(0, jeonseDeposits - deductionBase - smallHouseExclusion);
  if (excessDeposit <= 0) {
    return { isTaxable: false, deemedRent: 0, reason: '보증금 합계가 공제 기준 이하' };
  }

  var deemedRent = Math.max(0, Math.floor(excessDeposit * 0.6 * interestRate) - financialIncome);
  var incomeTax = Math.floor(deemedRent * 0.15); // 임대소득세 단순 추정 (15%)
  var localTax = Math.floor(incomeTax * 0.1);

  return {
    isTaxable: true,
    houseCount: houseCount,
    jeonseDeposits: jeonseDeposits,
    deductionBase: deductionBase,
    smallHouseExclusion: smallHouseExclusion,
    excessDeposit: excessDeposit,
    interestRate: interestRate,
    financialIncome: financialIncome,
    deemedRent: deemedRent,
    incomeTax: incomeTax,
    localTax: localTax,
    totalTax: incomeTax + localTax,
    warningMsg: warningMsg
  };
};

// ──────────────────────────────────────────────
// 연금저축/IRP 세액공제 최적화
// ──────────────────────────────────────────────
/**
 * @param {Object} opts
 * @param {number} opts.totalSalary     — 총급여 (연말정산 기준 grossIncome)
 * @param {number} opts.currentPension  — 현재까지 납입한 연금저축 금액
 * @param {number} opts.currentIrp      — 현재까지 납입한 IRP 금액
 * @param {number} opts.isPersonA       — true이면 배우자 A용 필드 ID 생성
 * @returns {Object}
 */
TaxCalculator.calculatePensionOptimization = function(opts) {
  var totalSalary = opts.totalSalary || 0;
  var currentPension = opts.currentPension || 0;
  var currentIrp = opts.currentIrp || 0;
  var MAX_LIMIT = 9000000;
  var currentTotal = Math.min(MAX_LIMIT, currentPension + currentIrp);
  var remaining = Math.max(0, MAX_LIMIT - currentTotal);
  var rate = totalSalary <= 55000000 ? 0.165 : 0.132;
  var currentCredit = Math.floor(currentTotal * rate);
  var potentialCredit = Math.floor(MAX_LIMIT * rate);
  var additionalCredit = potentialCredit - currentCredit;
  // 최적 추천: 연금저축 유지, 나머지를 IRP로 채움
  var recommendedIrp = Math.max(0, currentIrp + remaining);
  return {
    currentPension: currentPension,
    currentIrp: currentIrp,
    currentTotal: currentTotal,
    remaining: remaining,
    rate: rate * 100,
    maxLimit: MAX_LIMIT,
    currentCredit: currentCredit,
    potentialCredit: potentialCredit,
    additionalCredit: additionalCredit,
    recommendedIrp: recommendedIrp,
    reachedLimit: currentTotal >= MAX_LIMIT
  };
};

// ──────────────────────────────────────────────
// 주택청약종합저축 소득공제 (2025년 개정: 배우자 납입분 추가)
// ──────────────────────────────────────────────
TaxCalculator.calculateHousingSubscriptionDeduction = function(opts) {
  var totalSalary = opts.totalSalary || 0;
  var isHouseholder = opts.isHouseholder !== false;
  var spousePayment = opts.spousePayment || 0;  // 배우자 납입액
  var myPayment = opts.myPayment || 0;          // 본인 납입액
  var isNoHouse = opts.isNoHouse !== false;      // 무주택?

  // 대상: 총급여 7,000만 원 이하 무주택 세대주 (개정: 배우자 추가)
  if (totalSalary > 70000000) {
    return { isEligible: false, reason: "총급여 7,000만 원 초과" };
  }
  if (!isNoHouse) {
    return { isEligible: false, reason: "유주택자" };
  }

  // 본인 + 배우자 합산하여 300만 원 한도로 40% 소득공제 (세대주 기준)
  var combinedPayment = isHouseholder ? Math.min(myPayment + spousePayment, 3000000) : 0;
  var totalDeduction = Math.floor(combinedPayment * 0.4);

  return {
    isEligible: true,
    myPayment: myPayment,
    spousePayment: spousePayment,
    combinedPayment: combinedPayment,
    totalDeduction: totalDeduction,
    totalSavings: Math.floor(totalDeduction * 0.15) // 한계세율 15% 가정 시 절세액
  };
};

// ──────────────────────────────────────────────
// 신용카드 vs 체크카드 황금비율 계산기 (전통시장·대중교통·도서공연 추가 공제 반영)
// ──────────────────────────────────────────────
/**
 * @param {Object} opts
 * @param {number} opts.totalSalary       — 총급여
 * @param {number} opts.cardUsage         — 신용카드 사용액
 * @param {number} opts.cashUsage         — 체크카드/현금 사용액
 * @param {number} opts.traditionalMarket — 전통시장 사용액 (별도 30% + 추가한도)
 * @param {number} opts.publicTransit     — 대중교통 사용액 (별도 40% + 추가한도)
 * @param {number} opts.bookPerformance   — 도서·공연 사용액 (별도 30% + 추가한도, 7천만↓)
 * @returns {Object}
 */
TaxCalculator.calculateCardOptimalMix = function(opts) {
  var totalSalary = opts.totalSalary || 0;
  var cardUsage = opts.cardUsage || 0;
  var cashUsage = opts.cashUsage || 0;
  var traditionalMarket = opts.traditionalMarket || 0;
  var publicTransit = opts.publicTransit || 0;
  var bookPerformance = opts.bookPerformance || 0;
  var threshold = Math.floor(totalSalary * 0.25);
  var totalUsage = cardUsage + cashUsage;

  // 기본 공제 한도
  var limit;
  if (totalSalary > 120000000) limit = 2000000;
  else if (totalSalary > 70000000) limit = 2500000;
  else limit = 3000000;

  // 추가 한도: 전통시장 300만, 대중교통 300만, 도서공연 300만 (7천만↓)
  var addLimitTraditional = 3000000;
  var addLimitTransit = 3000000;
  var addLimitBook = totalSalary <= 70000000 ? 3000000 : 0;

  // 1. 기본 공제 계산 (일반 신용카드 + 체크카드)
  var currentExcess = Math.max(0, totalUsage - threshold);
  var baseDeduction = 0;
  if (currentExcess > 0) {
    if (cardUsage >= threshold) {
      baseDeduction = Math.floor((cardUsage - threshold) * 0.15) + Math.floor(cashUsage * 0.3);
    } else {
      baseDeduction = Math.floor(currentExcess * 0.3);
    }
    baseDeduction = Math.min(limit, baseDeduction);
  }

  // 2. 추가 공제 계산 (각 항목별 별도 한도, 기본공제 한도와 별개)
  // 전통시장: 30% 공제율 (체크카드는 30% 동일, 추가한도 내)
  var tradDeduction = Math.min(Math.floor(traditionalMarket * 0.3), addLimitTraditional);

  // 대중교통: 40% 공제율 (체크카드도 40%)
  var transitDeduction = Math.min(Math.floor(publicTransit * 0.4), addLimitTransit);

  // 도서·공연: 30% 공제율 (7천만 이하만)
  var bookDeduction = addLimitBook > 0 ? Math.min(Math.floor(bookPerformance * 0.3), addLimitBook) : 0;

  var totalDeduction = baseDeduction + tradDeduction + transitDeduction + bookDeduction;

  // 3. 최적 전략 계산
  var remainingToThreshold = Math.max(0, threshold - totalUsage);
  var isLimitReached = baseDeduction >= limit;
  var deductionGap = limit - baseDeduction;
  var additionalCashNeeded = 0;
  var additionalCardNeeded = 0;

  if (!isLimitReached && totalUsage >= threshold) {
    additionalCashNeeded = Math.ceil(deductionGap / 0.3);
  } else if (!isLimitReached && totalUsage < threshold) {
    additionalCardNeeded = remainingToThreshold;
    additionalCashNeeded = Math.ceil(deductionGap / 0.3);
  }

  var effectiveRate = currentExcess > 0 && baseDeduction > 0
    ? Math.floor(baseDeduction / currentExcess * 1000) / 10
    : 0;

  return {
    totalSalary: totalSalary,
    threshold: threshold,
    totalUsage: totalUsage,
    cardUsage: cardUsage,
    cashUsage: cashUsage,
    traditionalMarket: traditionalMarket,
    publicTransit: publicTransit,
    bookPerformance: bookPerformance,
    baseDeduction: baseDeduction,
    tradDeduction: tradDeduction,
    transitDeduction: transitDeduction,
    bookDeduction: bookDeduction,
    totalDeduction: totalDeduction,
    limit: limit,
    addLimitTraditional: addLimitTraditional,
    addLimitTransit: addLimitTransit,
    addLimitBook: addLimitBook,
    isLimitReached: isLimitReached,
    remainingToThreshold: remainingToThreshold,
    additionalCardNeeded: additionalCardNeeded,
    additionalCashNeeded: additionalCashNeeded,
    effectiveRate: effectiveRate,
    overThreshold: totalUsage >= threshold,
    optimalCardToUse: totalUsage < threshold ? remainingToThreshold : 0,
    optimalCashToUse: additionalCashNeeded
  };
};

// ──────────────────────────────────────────────
// 보장성 보험료 세액공제 계산기
// ──────────────────────────────────────────────
TaxCalculator.calculateInsuranceCredit = function(opts) {
  var totalPremium = opts.totalPremium || 0;
  var limit = 1000000;
  var eligibleAmount = Math.min(totalPremium, limit);
  var creditRate = 0.12;
  var credit = Math.floor(eligibleAmount * creditRate);
  var localTax = Math.floor(credit * 0.1);
  return {
    totalPremium: totalPremium,
    limit: limit,
    eligibleAmount: eligibleAmount,
    creditRate: creditRate * 100,
    credit: credit,
    localTax: localTax,
    totalBenefit: credit + localTax,
    isMaxed: totalPremium >= limit
  };
};

// ──────────────────────────────────────────────
// 월세 세액공제 계산기
// ──────────────────────────────────────────────
TaxCalculator.calculateRentCredit = function(opts) {
  var totalSalary = opts.totalSalary || 0;
  var annualRent = opts.annualRent || 0;
  if (totalSalary > 70000000) {
    return { isEligible: false, reason: "총급여 7,000만 원 초과로 월세 세액공제 대상이 아닙니다.", totalSalary: totalSalary, annualRent: annualRent };
  }
  var limit = 7500000;
  var eligibleAmount = Math.min(annualRent, limit);
  var creditRate = totalSalary <= 55000000 ? 0.15 : 0.12;
  var credit = Math.floor(eligibleAmount * creditRate);
  var localTax = Math.floor(credit * 0.1);
  return {
    isEligible: true,
    totalSalary: totalSalary,
    annualRent: annualRent,
    limit: limit,
    eligibleAmount: eligibleAmount,
    creditRate: creditRate * 100,
    credit: credit,
    localTax: localTax,
    totalBenefit: credit + localTax,
    isMaxed: annualRent >= limit
  };
};

// ──────────────────────────────────────────────
// 일반 기부금 세액공제 계산기
// ──────────────────────────────────────────────
TaxCalculator.calculateDonationCredit = function(opts) {
  var totalIncome = opts.totalIncome || 0;
  var statutoryDonation = opts.statutoryDonation || 0;
  var designatedDonation = opts.designatedDonation || 0;
  var religiousDonation = opts.religiousDonation || 0;
  var incomeLimit = Math.floor(totalIncome * 0.3);
  var totalDonation = statutoryDonation + designatedDonation + religiousDonation;
  // 법정기부금: 100% 세액공제, 한도 = 소득금액 100%
  var statutoryCredit = Math.floor(statutoryDonation * 1.0);
  // 지정기부금 + 종교단체: 30% 세액공제, 합산 한도 = 소득금액 30%
  var designatedTotal = designatedDonation + religiousDonation;
  var designatedEligible = Math.min(designatedTotal, incomeLimit);
  var designatedCredit = Math.floor(designatedEligible * 0.30);
  var totalCredit = statutoryCredit + designatedCredit;
  var localTax = Math.floor(totalCredit * 0.1);
  return {
    totalIncome: totalIncome,
    statutoryDonation: statutoryDonation,
    designatedDonation: designatedDonation,
    religiousDonation: religiousDonation,
    totalDonation: totalDonation,
    incomeLimit: incomeLimit,
    statutoryCredit: statutoryCredit,
    designatedEligible: designatedEligible,
    designatedCredit: designatedCredit,
    totalCredit: totalCredit,
    localTax: localTax,
    totalBenefit: totalCredit + localTax
  };
};

// ──────────────────────────────────────────────
// 표준세액공제 계산기
// ──────────────────────────────────────────────
TaxCalculator.calculateStandardCredit = function(opts) {
  var itemizedTotal = opts.itemizedTotal || 0;
  var standardCredit = 130000;
  var isStandardBetter = itemizedTotal < standardCredit;
  var difference = Math.abs(standardCredit - itemizedTotal);
  return {
    itemizedTotal: itemizedTotal,
    standardCredit: standardCredit,
    isStandardBetter: isStandardBetter,
    recommendedAmount: isStandardBetter ? standardCredit : itemizedTotal,
    difference: difference,
    recommendation: isStandardBetter
      ? "표준세액공제(13만 원)가 유리합니다. 별도 증빙 없이 자동 적용됩니다."
      : "항목별 세액공제 합계가 표준공제보다 큽니다. 항목별 공제를 선택하세요."
  };
};

// ──────────────────────────────────────────────
// 전기차·친환경차 세액공제 계산기
// ──────────────────────────────────────────────
TaxCalculator.calculateEcoCarCredit = function(opts) {
  var carPrice = opts.carPrice || 0;
  var carType = opts.carType || 'electric'; // electric, hybrid, hydrogen
  var individualConsumeTax = 0;
  var acquisitionTax = 0;
  var eduTax = 0;
  if (carType === 'electric') {
    individualConsumeTax = Math.min(5000000, Math.floor(carPrice * 0.05));
    acquisitionTax = Math.min(1400000, Math.floor(carPrice * 0.04));
    eduTax = Math.floor(acquisitionTax * 0.2);
  } else if (carType === 'hybrid') {
    individualConsumeTax = Math.min(2000000, Math.floor(carPrice * 0.04));
    acquisitionTax = Math.min(800000, Math.floor(carPrice * 0.04));
    eduTax = Math.floor(acquisitionTax * 0.2);
  } else if (carType === 'hydrogen') {
    individualConsumeTax = Math.min(5000000, Math.floor(carPrice * 0.05));
    acquisitionTax = Math.min(1400000, Math.floor(carPrice * 0.04));
    eduTax = Math.floor(acquisitionTax * 0.2);
  }
  var totalBenefit = individualConsumeTax + acquisitionTax + eduTax;
  return {
    carPrice: carPrice,
    carType: carType,
    carTypeLabel: carType === 'electric' ? '전기차' : carType === 'hybrid' ? '하이브리드차' : '수소전기차',
    individualConsumeTax: individualConsumeTax,
    acquisitionTax: acquisitionTax,
    eduTax: eduTax,
    totalBenefit: totalBenefit
  };
};

// ──────────────────────────────────────────────
// 주택자금 공제 계산기
// ──────────────────────────────────────────────
TaxCalculator.calculateHousingFundDeduction = function(opts) {
  var totalSalary = opts.totalSalary || 0;
  var subscriptionAmount = opts.subscriptionAmount || 0;  // 주택청약 납입액
  var jeonseLoanRepay = opts.jeonseLoanRepay || 0;       // 전세대출 원리금
  var mortgageInterest = opts.mortgageInterest || 0;      // 장기주택저당 이자

  var subscriptionLimit = totalSalary <= 70000000 ? 2400000 : 0;
  var subscriptionDeduction = Math.min(subscriptionAmount, subscriptionLimit);

  var jeonseLimit = 4000000;
  var jeonseDeduction = Math.min(jeonseLoanRepay, jeonseLimit);

  var mortgageLimit = 18000000;
  var mortgageDeduction = Math.min(mortgageInterest, mortgageLimit);

  var totalDeduction = subscriptionDeduction + jeonseDeduction + mortgageDeduction;
  var taxRate = TaxCalculator.calculateIncomeTax(totalSalary).rate;
  var estimatedTaxSavings = Math.floor(totalDeduction * taxRate);

  return {
    totalSalary: totalSalary,
    subscriptionAmount: subscriptionAmount,
    jeonseLoanRepay: jeonseLoanRepay,
    mortgageInterest: mortgageInterest,
    subscriptionLimit: subscriptionLimit,
    subscriptionDeduction: subscriptionDeduction,
    jeonseLimit: jeonseLimit,
    jeonseDeduction: jeonseDeduction,
    mortgageLimit: mortgageLimit,
    mortgageDeduction: mortgageDeduction,
    totalDeduction: totalDeduction,
    taxRate: taxRate,
    estimatedTaxSavings: estimatedTaxSavings
  };
};

// ──────────────────────────────────────────────
// 개인사업자 종합소득세 간편 계산기
// ──────────────────────────────────────────────
TaxCalculator.calculateSelfEmployedTax = function(opts) {
  var totalRevenue = opts.totalRevenue || 0;
  var bizCode = opts.bizCode || '940500'; // 기본: 서비스업
  var declaredType = opts.declaredType || 'simple'; // simple or standard
  var otherIncome = opts.otherIncome || 0;
  var financialIncome = opts.financialIncome || 0;

  var ratioInfo = TaxCalculator.getExpenseRatioInfo(bizCode);
  var expenseRate = declaredType === 'simple' ? ratioInfo.simpleRate : ratioInfo.standardRate;
  var bizIncome = Math.floor(totalRevenue * (1 - expenseRate));
  var totalIncome = bizIncome + otherIncome + financialIncome;
  var taxResult = TaxCalculator.calculateIncomeTax(totalIncome);
  var salaryDeduction = TaxCalculator.calculateSalaryDeduction(totalIncome);
  var basicDeduction = 1500000;
  var taxableIncome = Math.max(0, totalIncome - salaryDeduction - basicDeduction);
  var finalResult = TaxCalculator.calculateIncomeTax(taxableIncome);
  var localTax = Math.floor(finalResult.tax * 0.1);
  var totalTax = finalResult.tax + localTax;

  return {
    totalRevenue: totalRevenue,
    bizCode: bizCode,
    bizCodeLabel: ratioInfo.label,
    declaredType: declaredType,
    expenseRate: expenseRate,
    bizIncome: bizIncome,
    otherIncome: otherIncome,
    financialIncome: financialIncome,
    totalIncome: totalIncome,
    salaryDeduction: salaryDeduction,
    basicDeduction: basicDeduction,
    taxableIncome: taxableIncome,
    taxRate: finalResult.rate,
    incomeTax: finalResult.tax,
    localTax: localTax,
    totalTax: totalTax,
    effectiveRate: totalIncome > 0 ? Math.round(totalTax / totalIncome * 10000) / 100 : 0
  };
};
