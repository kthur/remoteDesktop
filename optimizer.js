/**
 * 맞벌이 연말정산 최적 배정 및 가족 간 자산 이전 절세 시뮬레이터 (금융자산 소득 분산 포함)
 */

const TaxOptimizer = {
  // 1. 맞벌이 부부 연말정산 몰아주기 (부양가족 배정 조합 시뮬레이션)
  optimizeCoupleYearEnd({ husband, wife, dependents }) {
    const depCount = dependents.length;
    let bestAssignment = null;
    let minCoupleTax = Infinity;
    
    const maxCombinations = Math.pow(2, depCount);
    
    for (let c = 0; c < maxCombinations; c++) {
      const husbandDeps = [];
      const wifeDeps = [];
      
      let husbandCardSum = husband.card;
      let husbandCashSum = husband.cash;
      let husbandMedicalSum = 0;
      let husbandEduSum = 0;
      let husbandChildCount = 0;

      let wifeCardSum = wife.card;
      let wifeCashSum = wife.cash;
      let wifeMedicalSum = 0;
      let wifeEduSum = 0;
      let wifeChildCount = 0;

      let hSenior = false, hDisabled = false, hBirth = false, hBirthOrder = 1;
      let wSenior = false, wDisabled = false, wBirth = false, wBirthOrder = 1;

      for (let i = 0; i < depCount; i++) {
        const dep = dependents[i];
        const isWife = (c >> i) & 1;
        
        if (isWife) {
          wifeDeps.push(dep);
          wifeCardSum += dep.card;
          wifeMedicalSum += dep.medical;
          wifeEduSum += dep.edu;
          if (dep.relation === 'child') wifeChildCount++;
          if (dep.senior) wSenior = true;
          if (dep.disabled) wDisabled = true;
          if (dep.birth) { wBirth = true; wBirthOrder = dep.birthOrder; }
        } else {
          husbandDeps.push(dep);
          husbandCardSum += dep.card;
          husbandMedicalSum += dep.medical;
          husbandEduSum += dep.edu;
          if (dep.relation === 'child') husbandChildCount++;
          if (dep.senior) hSenior = true;
          if (dep.disabled) hDisabled = true;
          if (dep.birth) { hBirth = true; hBirthOrder = dep.birthOrder; }
        }
      }

      // 의료비 몰아주기 예외 조합 시뮬레이션
      const medicalScenarios = [
        { hMed: husbandMedicalSum + wifeMedicalSum, wMed: 0 },
        { hMed: 0, wMed: husbandMedicalSum + wifeMedicalSum }
      ];

      for (const med of medicalScenarios) {
        const hResult = TaxCalculator.calculateYearEndTax({
          totalSalary: husband.salary,
          dependents: husbandDeps.length,
          cardUsage: husbandCardSum,
          cashUsage: husbandCashSum,
          pensionSavings: husband.pension || 0,
          irpSavings: husband.irp || 0,
          medicalExpense: med.hMed,
          educationExpense: husbandEduSum,
          monthlyRent: husband.rent || 0,
          childrenCount: husbandChildCount,
          isSmeEmployee: husband.SME,
          hasSeniorDependent: hSenior,
          hasDisabledDependent: hDisabled,
          hasBirthOrAdoption: hBirth,
          birthOrder: hBirthOrder,
          housingSubscription: husband.housingSubscription || 0,
          housingLoanRepay: husband.housingLoanRepay || 0,
          mortgageInterest: husband.mortgageInterest || 0,
          ventureInvestment: husband.ventureInvestment || 0
        });

        const wResult = TaxCalculator.calculateYearEndTax({
          totalSalary: wife.salary,
          dependents: wifeDeps.length,
          cardUsage: wifeCardSum,
          cashUsage: wifeCashSum,
          pensionSavings: wife.pension || 0,
          irpSavings: wife.irp || 0,
          medicalExpense: med.wMed,
          educationExpense: wifeEduSum,
          monthlyRent: wife.rent || 0,
          childrenCount: wifeChildCount,
          isSmeEmployee: wife.SME,
          hasSeniorDependent: wSenior,
          hasDisabledDependent: wDisabled,
          hasBirthOrAdoption: wBirth,
          birthOrder: wBirthOrder,
          housingSubscription: wife.housingSubscription || 0,
          housingLoanRepay: wife.housingLoanRepay || 0,
          mortgageInterest: wife.mortgageInterest || 0,
          ventureInvestment: wife.ventureInvestment || 0
        });

        const coupleTax = hResult.totalTax + wResult.totalTax;

        if (coupleTax < minCoupleTax) {
          minCoupleTax = coupleTax;
          bestAssignment = {
            combinationIndex: c,
            medicalTarget: med.hMed > 0 ? 'husband' : 'wife',
            husbandDeps: husbandDeps.map(d => d.name),
            wifeDeps: wifeDeps.map(d => d.name),
            husbandTax: hResult.totalTax,
            wifeTax: wResult.totalTax,
            totalTax: coupleTax,
            hResult: hResult,
            wResult: wResult
          };
        }
      }
    }

    const allHusbandTax = this.getCoupleTaxWithTarget(husband, wife, dependents, 'husband');
    const allWifeTax = this.getCoupleTaxWithTarget(husband, wife, dependents, 'wife');

    return {
      best: bestAssignment,
      minCoupleTax,
      allHusbandTax,
      allWifeTax,
      savings: Math.max(0, Math.min(allHusbandTax, allWifeTax) - minCoupleTax)
    };
  },

  getCoupleTaxWithTarget(husband, wife, dependents, target) {
    const isWifeTarget = target === 'wife';
    const husbandDeps = isWifeTarget ? [] : dependents;
    const wifeDeps = isWifeTarget ? dependents : [];

    const hSenior = !isWifeTarget && dependents.some(d => d.senior);
    const hDisabled = !isWifeTarget && dependents.some(d => d.disabled);
    const wSenior = isWifeTarget && dependents.some(d => d.senior);
    const wDisabled = isWifeTarget && dependents.some(d => d.disabled);

    const hResult = TaxCalculator.calculateYearEndTax({
      totalSalary: husband.salary,
      dependents: husbandDeps.length,
      cardUsage: husband.card + (isWifeTarget ? 0 : dependents.reduce((sum, d) => sum + d.card, 0)),
      cashUsage: husband.cash,
      pensionSavings: husband.pension || 0,
      irpSavings: husband.irp || 0,
      medicalExpense: isWifeTarget ? 0 : dependents.reduce((sum, d) => sum + d.medical, 0),
      educationExpense: isWifeTarget ? 0 : dependents.reduce((sum, d) => sum + d.edu, 0),
      childrenCount: isWifeTarget ? 0 : dependents.filter(d => d.relation === 'child').length,
      isSmeEmployee: husband.SME,
      hasSeniorDependent: hSenior,
      hasDisabledDependent: hDisabled
    });

    const wResult = TaxCalculator.calculateYearEndTax({
      totalSalary: wife.salary,
      dependents: wifeDeps.length,
      cardUsage: wife.card + (isWifeTarget ? dependents.reduce((sum, d) => sum + d.card, 0) : 0),
      cashUsage: wife.cash,
      pensionSavings: wife.pension || 0,
      irpSavings: wife.irp || 0,
      medicalExpense: isWifeTarget ? dependents.reduce((sum, d) => sum + d.medical, 0) : 0,
      educationExpense: isWifeTarget ? dependents.reduce((sum, d) => sum + d.edu, 0) : 0,
      childrenCount: isWifeTarget ? dependents.filter(d => d.relation === 'child').length : 0,
      isSmeEmployee: wife.SME,
      hasSeniorDependent: wSenior,
      hasDisabledDependent: wDisabled
    });

    return hResult.totalTax + wResult.totalTax;
  },

  // 2. 해외주식/부동산 배우자 증여 후 매도 시뮬레이터
  optimizeGiftAndSell({ type, originalPurchasePrice, currentPrice, giftLimit = 600000000 }) {
    const giftAmount = Math.min(currentPrice, giftLimit);
    const originalGain = Math.max(0, currentPrice - originalPurchasePrice);
    
    let originalTax = 0;
    let afterGiftTax = 0;

    if (type === 'stock') {
      const originalTaxable = Math.max(0, originalGain - 2500000);
      originalTax = Math.floor(originalTaxable * 0.22);
      
      const afterGain = Math.max(0, currentPrice - giftAmount);
      const afterTaxable = Math.max(0, afterGain - 2500000);
      afterGiftTax = Math.floor(afterTaxable * 0.22);
    } else {
      const origCalc = TaxCalculator.calculateCapitalGains({
        type: 'real_estate',
        purchasePrice: originalPurchasePrice,
        sellPrice: currentPrice,
        holdingPeriodMonths: 24,
        houseCount: 2
      });
      originalTax = origCalc.totalTax;

      const afterCalc = TaxCalculator.calculateCapitalGains({
        type: 'real_estate',
        purchasePrice: giftAmount,
        sellPrice: currentPrice,
        holdingPeriodMonths: 120,
        houseCount: 2
      });
      afterGiftTax = afterCalc.totalTax;
    }

    return {
      originalGain,
      originalTax,
      afterGiftTax,
      savings: Math.max(0, originalTax - afterGiftTax),
      giftAmount
    };
  },

  // 3. 공동대표 소득 분배 최적화 (종합소득세 분산)
  optimizeIncomeDistribution({ members, totalDistributeAmount }) {
    const memberCount = members.length;
    if (memberCount < 2) return null;

    let bestDistribution = [];
    let minTotalTax = Infinity;
    const steps = 20; 
    
    function recurse(index, currentAllocations, remainingSum) {
      if (index === memberCount - 1) {
        currentAllocations.push(remainingSum);
        
        let totalTaxSum = 0;
        const currentTaxDetails = [];
        
        for (let i = 0; i < memberCount; i++) {
          const alloc = currentAllocations[i];
          const newIncome = members[i].existingIncome + alloc;
          const result = TaxCalculator.calculateComprehensiveIncome({
            totalIncome: newIncome,
            incomeType: 'business',
            expense: 0
          });
          
          totalTaxSum += result.totalTax;
          currentTaxDetails.push({
            id: members[i].id,
            name: members[i].name,
            allocated: alloc,
            existingIncome: members[i].existingIncome,
            totalIncome: newIncome,
            tax: result.totalTax
          });
        }

        if (totalTaxSum < minTotalTax) {
          minTotalTax = totalTaxSum;
          bestDistribution = JSON.parse(JSON.stringify(currentTaxDetails));
        }
        
        currentAllocations.pop();
        return;
      }

      for (let i = 0; i <= steps; i++) {
        const alloc = Math.floor((totalDistributeAmount * i) / steps);
        if (alloc <= remainingSum) {
          currentAllocations.push(alloc);
          recurse(index + 1, currentAllocations, remainingSum - alloc);
          currentAllocations.pop();
        }
      }
    }

    recurse(0, [], totalDistributeAmount);

    let singleTaxSum = 0;
    const singleDetails = members.map((m, idx) => {
      const alloc = idx === 0 ? totalDistributeAmount : 0;
      const result = TaxCalculator.calculateComprehensiveIncome({
        totalIncome: m.existingIncome + alloc,
        incomeType: 'business',
        expense: 0
      });
      singleTaxSum += result.totalTax;
      return { name: m.name, allocated: alloc, tax: result.totalTax };
    });

    let equalTaxSum = 0;
    const equalDetails = members.map(m => {
      const alloc = Math.floor(totalDistributeAmount / memberCount);
      const result = TaxCalculator.calculateComprehensiveIncome({
        totalIncome: m.existingIncome + alloc,
        incomeType: 'business',
        expense: 0
      });
      equalTaxSum += result.totalTax;
      return { name: m.name, allocated: alloc, tax: result.totalTax };
    });

    return {
      best: bestDistribution,
      minTotalTax,
      singleTaxSum,
      singleDetails,
      equalTaxSum,
      equalDetails,
      savings: Math.max(0, equalTaxSum - minTotalTax),
      singleSavings: Math.max(0, singleTaxSum - minTotalTax)
    };
  }
};
