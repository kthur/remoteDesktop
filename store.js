/**
 * TaxStore — 입력/계산 로직 사이의 상태 관리 인터페이스
 *
 * 목적:
 *   - DOM 직접 조작 없이도 외부(홈택스 API, CODEF, 팝빌 등)에서 데이터를 주입(inject) 가능
 *   - 수동 입력 로직과 계산 엔진 사이의 결합도를 낮춤
 *   - 향후 React/Vue 마이그레이션 시 store만 교체하면 되도록 추상화
 *
 * 사용 예:
 *   TaxStore.set('inc-h-salary', 70000000);
 *   TaxStore.set('inc-w-salary', 45000000);
 *   const data = TaxStore.getData();  // 구조화된 전체 입력 객체
 */
(function () {
  'use strict';

  var listeners = [];

  /**
   * 단일 필드 값을 DOM에 반영하고 구독자에게 알림
   * @param {string} id  DOM 요소 id
   * @param {number|string|boolean} value
   */
  function setField(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') {
      el.checked = !!value;
    } else {
      // 숫자는 콤마 포맷 적용
      var numVal = typeof value === 'number' ? value : parseInt(String(value).replace(/,/g, ''), 10);
      if (!isNaN(numVal) && el.classList.contains('money-input')) {
        el.value = Number(numVal).toLocaleString('ko-KR');
      } else {
        el.value = String(value);
      }
    }
    notify();
  }

  /**
   * 현재 DOM으로부터 전체 입력 데이터를 구조화된 객체로 수집
   * @returns {Object}
   */
  function getData() {
    function parse(id) {
      var el = document.getElementById(id);
      if (!el) return 0;
      return parseInt(el.value.replace(/,/g, ''), 10) || 0;
    }

    var hType = (document.getElementById('inc-h-type') || {}).value || 'wage';
    var wType = (document.getElementById('inc-w-type') || {}).value || 'wage';

    // 부양가족 수집
    var container = document.getElementById('inc-couple-ye-people');
    var dependents = [];
    if (container) {
      container.querySelectorAll('.person-card').forEach(function (card) {
        dependents.push({
          name: (card.querySelector('.opt-dep-name') || {}).value || '',
          relation: (card.querySelector('.opt-dep-relation') || {}).value || 'child',
          card: parse(card.querySelector('.opt-dep-card')),
          medical: parse(card.querySelector('.opt-dep-medical')),
          edu: parse(card.querySelector('.opt-dep-edu')),
          studentLoanRepay: parse(card.querySelector('.opt-dep-student-loan')),
          senior: (card.querySelector('.opt-dep-senior') || {}).checked || false,
          disabled: (card.querySelector('.opt-dep-disabled') || {}).checked || false,
          birth: (card.querySelector('.opt-dep-birth') || {}).checked || false,
          birthOrder: 1
        });
      });
    }

    return {
      husband: {
        salary: parse('inc-h-salary'),
        type: hType,
        card: parse('inc-h-card'),
        yellow: parse('inc-h-yellow'),
        pension: parse('inc-h-pension'),
        financialGen: parse('inc-h-financial-gen'),
        financialOverseas: parse('inc-h-financial-overseas'),
        isaIncome: parse('inc-h-isa'),
        isaType: (document.getElementById('inc-h-isa-type') || {}).value || 'general',
        bondSeparated: parse('inc-h-bond')
      },
      wife: {
        salary: parse('inc-w-salary'),
        type: wType,
        card: parse('inc-w-card'),
        yellow: parse('inc-w-yellow'),
        pension: parse('inc-w-pension'),
        financialGen: parse('inc-w-financial-gen'),
        financialOverseas: parse('inc-w-financial-overseas'),
        isaIncome: parse('inc-w-isa'),
        isaType: (document.getElementById('inc-w-isa-type') || {}).value || 'general',
        bondSeparated: parse('inc-w-bond')
      },
      common: {
        venture: parse('inc-venture'),
        housingSubscription: parse('inc-housing-sub'),
        housingLoanRepay: parse('inc-housing-loan')
      },
      dependents: dependents,
      vat: {
        type: (document.getElementById('vat-type') || {}).value || 'general',
        sales: parse('vat-sales'),
        purchases: parse('vat-purchases'),
        businessType: (document.getElementById('vat-business-type') || {}).value || 'retail',
        useAgriPurchase: (document.getElementById('vat-use-agri') || {}).checked || false,
        agriPurchaseAmount: parse('vat-agri-amt'),
        hasCardSales: (document.getElementById('vat-use-cardsales') || {}).checked || false,
        cardSalesAmount: parse('vat-cardsales-amt')
      },
      capital: {
        type: (document.getElementById('capital-type') || {}).value || 'real_estate',
        purchasePrice: parse('capital-purchase'),
        sellPrice: parse('capital-sell'),
        holdingPeriodMonths: parseInt((document.getElementById('capital-period') || {}).value, 10) || 0,
        houseCount: parseInt((document.getElementById('capital-houses') || {}).value, 10) || 0,
        stockType: (document.getElementById('stock-type') || {}).value || 'foreign',
        stockGain: parse('stock-gain')
      },
      giftSell: {
        type: (document.getElementById('opt-gs-type') || {}).value || 'stock',
        originalPurchasePrice: parse('opt-gs-purchase'),
        currentPrice: parse('opt-gs-current'),
        years: parseInt((document.getElementById('opt-gs-years') || {}).value, 10) || 0
      },
      giftTimeline: {
        childName: (document.getElementById('gift-child-name') || {}).value || '',
        childAge: parseInt((document.getElementById('gift-child-age') || {}).value, 10) || 0
      }
    };
  }

  function notify() {
    for (var i = 0; i < listeners.length; i++) {
      try { listeners[i](getData()); } catch (e) { console.error('[TaxStore] listener error', e); }
    }
  }

  /**
   * @param {Function} fn  (data) => {} 형태의 리스너
   */
  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  window.TaxStore = {
    set: setField,
    getData: getData,
    subscribe: subscribe
  };
})();
