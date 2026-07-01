/**
 * 맞벌이 연말정산 최적 배정 및 가족 간 자산 이전 절세 시뮬레이터 (금융자산 소득 분산 포함)
 */

const TaxOptimizer = {
  // 1. 맞벌이 부부 연말정산 몰아주기 (부양가족 배정 조합 시뮬레이션)
  optimizeCoupleYearEnd({ personA, personB, dependents }) {
    const depCount = dependents.length;
    let bestAssignment = null;
    let minCoupleTax = Infinity;
    
    const maxCombinations = Math.pow(2, depCount);
    
    for (let c = 0; c < maxCombinations; c++) {
      const aDeps = [];
      const bDeps = [];
      
      let aCardSum = personA.card;
      let aCashSum = personA.cash;
      let aMedicalSum = personA.medicalExpense || 0;
      let aEduSum = 0;
      let aChildCount = 0;

      let bCardSum = personB.card;
      let bCashSum = personB.cash;
      let bMedicalSum = personB.medicalExpense || 0;
      let bEduSum = 0;
      let bChildCount = 0;

      let aSenior = false, aDisabled = false, aBirth = false, aBirthOrder = 1;
      let bSenior = false, bDisabled = false, bBirth = false, bBirthOrder = 1;

      for (let i = 0; i < depCount; i++) {
        const dep = dependents[i];
        const isB = (c >> i) & 1;
        
        if (isB) {
          bDeps.push(dep);
          bCardSum += dep.card;
          bMedicalSum += dep.medical;
          bEduSum += dep.edu;
          if (dep.relation === 'child') bChildCount++;
          if (dep.senior) bSenior = true;
          if (dep.disabled) bDisabled = true;
          if (dep.birth) { bBirth = true; bBirthOrder = dep.birthOrder; }
        } else {
          aDeps.push(dep);
          aCardSum += dep.card;
          aMedicalSum += dep.medical;
          aEduSum += dep.edu;
          if (dep.relation === 'child') aChildCount++;
          if (dep.senior) aSenior = true;
          if (dep.disabled) aDisabled = true;
          if (dep.birth) { aBirth = true; aBirthOrder = dep.birthOrder; }
        }
      }

      // 의료비 몰아주기 예외 조합 시뮬레이션
      const medicalScenarios = [
        { aMed: aMedicalSum + bMedicalSum, bMed: 0 },
        { aMed: 0, bMed: aMedicalSum + bMedicalSum }
      ];

      for (const med of medicalScenarios) {
        const aResult = TaxCalculator.calculateYearEndTax({
          totalSalary: personA.totalSalary || 0,
          businessRevenue: personA.businessRevenue || 0,
          businessExpense: personA.businessExpense || 0,
          pensionIncome: personA.pensionIncome || 0,
          otherRevenue: personA.otherRevenue || 0,
          otherExpense: personA.otherExpense || 0,
          financialGeneral: personA.financialGeneral || 0,
          financialOverseas: personA.financialOverseas || 0,
          isaIncome: personA.isaIncome || 0,
          isaType: personA.isaType || 'general',
          bondSeparated: personA.bondSeparated || 0,
          dependents: aDeps.length,
          cardUsage: aCardSum,
          cashUsage: aCashSum,
          pensionSavings: personA.pensionSavings || 0,
          irpSavings: personA.irpSavings || 0,
          yellowUmbrella: personA.yellowUmbrella || 0,
          medicalExpense: med.aMed,
          educationExpense: aEduSum,
          monthlyRent: personA.rent || 0,
          childrenCount: aChildCount,
          isSmeEmployee: personA.SME,
          hasSeniorDependent: aSenior,
          hasDisabledDependent: aDisabled,
          hasBirthOrAdoption: aBirth,
          birthOrder: aBirthOrder,
          housingSubscription: personA.housingSubscription || 0,
          housingLoanRepay: personA.housingLoanRepay || 0,
          mortgageInterest: personA.mortgageInterest || 0,
          ventureInvestment: personA.ventureInvestment || 0,
          isHouseholder: personA.isHouseholder !== false,
          spouseHousingSubscription: personA.spouseHousingSubscription || 0
        });

        const bResult = TaxCalculator.calculateYearEndTax({
          totalSalary: personB.totalSalary || 0,
          businessRevenue: personB.businessRevenue || 0,
          businessExpense: personB.businessExpense || 0,
          pensionIncome: personB.pensionIncome || 0,
          otherRevenue: personB.otherRevenue || 0,
          otherExpense: personB.otherExpense || 0,
          financialGeneral: personB.financialGeneral || 0,
          financialOverseas: personB.financialOverseas || 0,
          isaIncome: personB.isaIncome || 0,
          isaType: personB.isaType || 'general',
          bondSeparated: personB.bondSeparated || 0,
          dependents: bDeps.length,
          cardUsage: bCardSum,
          cashUsage: bCashSum,
          pensionSavings: personB.pensionSavings || 0,
          irpSavings: personB.irpSavings || 0,
          yellowUmbrella: personB.yellowUmbrella || 0,
          medicalExpense: med.bMed,
          educationExpense: bEduSum,
          monthlyRent: personB.rent || 0,
          childrenCount: bChildCount,
          isSmeEmployee: personB.SME,
          hasSeniorDependent: bSenior,
          hasDisabledDependent: bDisabled,
          hasBirthOrAdoption: bBirth,
          birthOrder: bBirthOrder,
          housingSubscription: personB.housingSubscription || 0,
          housingLoanRepay: personB.housingLoanRepay || 0,
          mortgageInterest: personB.mortgageInterest || 0,
          ventureInvestment: personB.ventureInvestment || 0,
          isHouseholder: personB.isHouseholder !== false,
          spouseHousingSubscription: personB.spouseHousingSubscription || 0
        });

        const coupleTax = aResult.totalTax + bResult.totalTax;

        if (coupleTax < minCoupleTax) {
          minCoupleTax = coupleTax;
          bestAssignment = {
            combinationIndex: c,
            medicalTarget: med.aMed > 0 ? 'a' : 'b',
            aDeps: aDeps.map(d => d.name),
            bDeps: bDeps.map(d => d.name),
            aTax: aResult.totalTax,
            bTax: bResult.totalTax,
            totalTax: coupleTax,
            aResult: aResult,
            bResult: bResult
          };
        }
      }
    }

    const allATax = this.getCoupleTaxWithTarget(personA, personB, dependents, 'a');
    const allBTax = this.getCoupleTaxWithTarget(personA, personB, dependents, 'b');

    return {
      best: bestAssignment,
      minCoupleTax,
      allATax,
      allBTax,
      savings: Math.max(0, Math.min(allATax, allBTax) - minCoupleTax)
    };
  },

  getCoupleTaxWithTarget(personA, personB, dependents, target) {
    const isBTarget = target === 'b';
    const aDeps = isBTarget ? [] : dependents;
    const bDeps = isBTarget ? dependents : [];

    const aSenior = !isBTarget && dependents.some(d => d.senior);
    const aDisabled = !isBTarget && dependents.some(d => d.disabled);
    const bSenior = isBTarget && dependents.some(d => d.senior);
    const bDisabled = isBTarget && dependents.some(d => d.disabled);

    const aResult = TaxCalculator.calculateYearEndTax({
      totalSalary: personA.totalSalary || 0,
      businessRevenue: personA.businessRevenue || 0,
      businessExpense: personA.businessExpense || 0,
      pensionIncome: personA.pensionIncome || 0,
      otherRevenue: personA.otherRevenue || 0,
      otherExpense: personA.otherExpense || 0,
      financialGeneral: personA.financialGeneral || 0,
      financialOverseas: personA.financialOverseas || 0,
      isaIncome: personA.isaIncome || 0,
      isaType: personA.isaType || 'general',
      bondSeparated: personA.bondSeparated || 0,
      dependents: aDeps.length,
      cardUsage: (personA.totalSalary > 0 ? (personA.card || 0) : 0) + (isBTarget ? 0 : dependents.reduce((sum, d) => sum + d.card, 0)),
      cashUsage: personA.cash || 0,
      pensionSavings: personA.pensionSavings || 0,
      irpSavings: personA.irpSavings || 0,
      yellowUmbrella: personA.yellowUmbrella || 0,
      medicalExpense: isBTarget ? 0 : dependents.reduce((sum, d) => sum + d.medical, 0),
      educationExpense: isBTarget ? 0 : dependents.reduce((sum, d) => sum + d.edu, 0),
      childrenCount: isBTarget ? 0 : dependents.filter(d => d.relation === 'child').length,
      isSmeEmployee: personA.SME,
      hasSeniorDependent: aSenior,
      hasDisabledDependent: aDisabled
    });

    const bResult = TaxCalculator.calculateYearEndTax({
      totalSalary: personB.totalSalary || 0,
      businessRevenue: personB.businessRevenue || 0,
      businessExpense: personB.businessExpense || 0,
      pensionIncome: personB.pensionIncome || 0,
      otherRevenue: personB.otherRevenue || 0,
      otherExpense: personB.otherExpense || 0,
      financialGeneral: personB.financialGeneral || 0,
      financialOverseas: personB.financialOverseas || 0,
      isaIncome: personB.isaIncome || 0,
      isaType: personB.isaType || 'general',
      bondSeparated: personB.bondSeparated || 0,
      dependents: bDeps.length,
      cardUsage: (personB.totalSalary > 0 ? (personB.card || 0) : 0) + (isBTarget ? dependents.reduce((sum, d) => sum + d.card, 0) : 0),
      cashUsage: personB.cash || 0,
      pensionSavings: personB.pensionSavings || 0,
      irpSavings: personB.irpSavings || 0,
      yellowUmbrella: personB.yellowUmbrella || 0,
      medicalExpense: isBTarget ? dependents.reduce((sum, d) => sum + d.medical, 0) : 0,
      educationExpense: isBTarget ? dependents.reduce((sum, d) => sum + d.edu, 0) : 0,
      childrenCount: isBTarget ? dependents.filter(d => d.relation === 'child').length : 0,
      isSmeEmployee: personB.SME,
      hasSeniorDependent: bSenior,
      hasDisabledDependent: bDisabled
    });

    return aResult.totalTax + bResult.totalTax;
  },

  // 2. 해외주식/부동산 배우자 증여 후 매도 시뮬레이터
  optimizeGiftAndSell({ type, originalPurchasePrice, currentPrice, years = 0, giftLimit = 600000000 }) {
    const originalGain = Math.max(0, currentPrice - originalPurchasePrice);
    
    let originalTax = 0;
    let afterGiftTax = 0;

    // Calculate original tax first
    if (type === 'stock') {
      const originalTaxable = Math.max(0, originalGain - 2500000);
      originalTax = Math.floor(originalTaxable * 0.22);
    } else {
      const origCalc = TaxCalculator.calculateCapitalGains({
        type: 'real_estate',
        purchasePrice: originalPurchasePrice,
        sellPrice: currentPrice,
        holdingPeriodMonths: 24,
        houseCount: 2
      });
      originalTax = origCalc.totalTax;
    }

    // Determine if carryover tax applies
    let isCarryoverTaxApplied = false;
    if (type === 'stock' && years < 1) {
      isCarryoverTaxApplied = true;
    } else if (type === 'real_estate' && years < 10) {
      isCarryoverTaxApplied = true;
    }

    const giftAmount = isCarryoverTaxApplied ? 0 : Math.min(currentPrice, giftLimit);

    if (isCarryoverTaxApplied) {
      afterGiftTax = originalTax;
    } else {
      if (type === 'stock') {
        const afterGain = Math.max(0, currentPrice - giftAmount);
        const afterTaxable = Math.max(0, afterGain - 2500000);
        afterGiftTax = Math.floor(afterTaxable * 0.22);
      } else {
        const afterCalc = TaxCalculator.calculateCapitalGains({
          type: 'real_estate',
          purchasePrice: giftAmount,
          sellPrice: currentPrice,
          holdingPeriodMonths: 120,
          houseCount: 2
        });
        afterGiftTax = afterCalc.totalTax;
      }
    }

    return {
      originalGain,
      originalTax,
      afterGiftTax,
      savings: Math.max(0, originalTax - afterGiftTax),
      giftAmount,
      isCarryoverTaxApplied
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
