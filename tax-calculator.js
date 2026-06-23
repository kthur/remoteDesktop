/**
 * 2025년 대한민국 세제 기준 세금 계산 엔진 (2024년 귀속)
 * 금융소득 세부 유형(일반, ISA 비과세/분리과세, 채권 30%, 해외 무조건 합산) 및 벤처투자 완벽 반영
 */

const TaxCalculator = {
  // 1. 종합소득세율 테이블 및 계산
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

  calculateIncomeTax(taxableIncome) {
    if (taxableIncome <= 0) return { tax: 0, rate: 0, deduction: 0 };
    
    let targetBracket = this.incomeTaxBrackets[0];
    for (const bracket of this.incomeTaxBrackets) {
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
      deduction = 30000000 + (investment - 30000000) * 0.7;
    } else {
      deduction = 44000000 + (investment - 50000000) * 0.3;
    }
    return Math.min(deduction, incomeAmount * 0.5);
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
    isaType = 'general', // ISA 유형 ('general': 200만 비과세, 'sub': 400만 비과세)
    bondSeparated = 0, // 장기채권 30% 분리과세 신청액
    dependentsCount = 0,
    hasSeniorDependent = false,
    hasDisabledDependent = false
  }) {
    let calculatedExpense = expense;
    let salaryDeduction = 0;
    if (incomeType === 'wage') {
      if (totalIncome <= 5000000) salaryDeduction = totalIncome * 0.7;
      else if (totalIncome <= 15000000) salaryDeduction = 3500000 + (totalIncome - 5000000) * 0.4;
      else if (totalIncome <= 45000000) salaryDeduction = 7500000 + (totalIncome - 15000000) * 0.15;
      else if (totalIncome <= 100000000) salaryDeduction = 12000000 + (totalIncome - 45000000) * 0.05;
      else salaryDeduction = 14750000 + (totalIncome - 100000000) * 0.02;
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
    const isaLimit = isaType === 'sub' ? 4000000 : 2000000;
    const isaTaxfreeAmount = Math.min(isaIncome, isaLimit);
    const isaOverLimitAmount = Math.max(0, isaIncome - isaLimit);
    const isaSeparatedTax = Math.floor(isaOverLimitAmount * 0.09); // 9.9% 분리과세 (지방세 0.9% 제외 원세 9%)

    // 장기채권 30% 분리과세 세액
    const bondSeparatedTax = Math.floor(bondSeparated * 0.30);

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
    const effectiveRate = totalIncome > 0 ? (totalTax / (totalIncome + allFinancialIncome)) * 100 : 0;

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

      if (houseCount === 1 && sellPrice <= 1200000000) {
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
    if (totalSalary <= 5000000) salaryDeduction = totalSalary * 0.7;
    else if (totalSalary <= 15000000) salaryDeduction = 3500000 + (totalSalary - 5000000) * 0.4;
    else if (totalSalary <= 45000000) salaryDeduction = 7500000 + (totalSalary - 15000000) * 0.15;
    else if (totalSalary <= 100000000) salaryDeduction = 12000000 + (totalSalary - 45000000) * 0.05;
    else salaryDeduction = 14750000 + (totalSalary - 100000000) * 0.02;

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
      housingDeduction += Math.min(1200000, housingSubscription * 0.4);
    }
    housingDeduction += Math.min(4000000, housingLoanRepay * 0.4);
    housingDeduction += Math.min(18000000, mortgageInterest);

    const threshold = totalSalary * 0.25;
    const totalCardUsage = cardUsage + cashUsage;
    let cardDeduction = 0;

    if (totalCardUsage > threshold) {
      const excess = totalCardUsage - threshold;
      if (cardUsage >= threshold) {
        cardDeduction = (cardUsage - threshold) * 0.15 + cashUsage * 0.3;
      } else {
        cardDeduction = excess * 0.3;
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
    if (calculatedTax <= 1300000) workTaxCredit = calculatedTax * 0.55;
    else workTaxCredit = 715000 + (calculatedTax - 1300000) * 0.3;
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
      pensionCredit = totalPension * rate;
      taxCredits += pensionCredit;
    }

    let insuranceCredit = Math.min(120000, insurancePremium * 0.12);
    taxCredits += insuranceCredit;

    let medicalCredit = 0;
    const medicalThreshold = totalSalary * 0.03;
    if (medicalExpense > medicalThreshold) {
      medicalCredit = (medicalExpense - medicalThreshold) * 0.15;
      taxCredits += medicalCredit;
    }

    const totalEdu = educationExpense + studentLoanRepay;
    let eduCredit = totalEdu * 0.15;
    taxCredits += eduCredit;

    let rentCredit = 0;
    if (monthlyRent > 0 && totalSalary <= 80000000) {
      const rate = totalSalary <= 55000000 ? 0.17 : 0.15;
      rentCredit = Math.min(10000000, monthlyRent * 12) * rate;
      taxCredits += rentCredit;
    }

    let donationCredit = 0;
    if (localDonation > 0) {
      if (localDonation <= 100000) donationCredit += localDonation;
      else donationCredit += 100000 + (localDonation - 100000) * 0.15;
    }
    donationCredit += donationAmount * 0.15;
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
