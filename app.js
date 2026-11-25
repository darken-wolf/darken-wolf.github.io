/* دارك وولف — تطبيق طلبات خامات الورش (نسخة أولى: فهرس + سلة + فاتورة + إرسال) */
(function () {
  'use strict';

  var WHATSAPP_NUMBER = (window.DW_CONFIG && window.DW_CONFIG.whatsappNumber) || '201066683195';
  var DEMO_MODE = !(window.DW_CONFIG && window.DW_CONFIG.firebase);

  var PRODUCTS = [
    { id: 'hinge',        name: 'مفصلة كابينة هيدروليك غلق ناعم',   unit: 'قطعة',     price: 120, cat: 'kitchen',  img: 'photo-hinge.jpg' },
    { id: 'drawer-slide', name: 'مجرى درج تلسكوبي ٤٥ سم',            unit: 'زوج',      price: 250, cat: 'kitchen',  img: 'photo-drawer-slide.jpg' },
    { id: 'handle',       name: 'مقبض ألومنيوم مصقول ١٢٨ مم',        unit: 'قطعة',     price: 50,  cat: 'kitchen',  img: 'photo-handle.jpg' },
    { id: 'gas-strut',    name: 'بستم رفع غاز للوحدات العلوية',      unit: 'قطعة',     price: 250, cat: 'kitchen',  img: 'photo-gas-strut.jpg' },
    { id: 'leg',          name: 'رجل بلاستيك قابلة للتعديل',         unit: 'قطعة',     price: 20,  cat: 'kitchen',  img: 'photo-leg.jpg' },
    { id: 'led-strip',    name: 'شريط إضاءة LED داخلي',              unit: 'متر',      price: 60,  cat: 'kitchen',  img: 'photo-led-strip.jpg' },
    { id: 'alu-profile',  name: 'قطاع ألومنيوم شباك جرار',           unit: 'كجم',      price: 250, cat: 'aluminum', img: 'photo-alu-profile.jpg' },
    { id: 'roller',       name: 'عجلة رولر شباك جرار',               unit: 'قطعة',     price: 40,  cat: 'aluminum', img: 'photo-roller.jpg' },
    { id: 'lock',         name: 'قفل شباك قلاب',                     unit: 'قطعة',     price: 75,  cat: 'aluminum', img: 'photo-lock.jpg' },
    { id: 'epdm',         name: 'مطاط عازل EPDM',                    unit: 'متر',      price: 12,  cat: 'aluminum', img: 'photo-epdm.jpg' },
    { id: 'mesh',         name: 'شبكة سلك ألومنيوم ضد الحشرات',      unit: 'متر مربع', price: 150, cat: 'aluminum', img: 'photo-mesh.jpg' },
    { id: 'upvc-handle',  name: 'مقبض شباك UPVC',                    unit: 'قطعة',     price: 120, cat: 'aluminum', img: 'photo-upvc-handle.jpg' }
  ];

  var CATS = [
    { value: 'all',      label: 'الكل' },
    { value: 'kitchen',  label: 'إكسسوارات مطابخ' },
    { value: 'aluminum', label: 'ألومنيوم وشبابيك' }
  ];

  var fmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });
  function egp(n) { return fmt.format(n) + ' ج'; }

  var state = {
    cat: 'all',
    cart: load('dw-cart', {}),
    workshop: load('dw-workshop', ''),
    phone: load('dw-phone', '')
  };

  function load(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function toast(msg) {
    var el = document.querySelector('.toast');
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  function setQty(id, qty) {
    if (qty <= 0) delete state.cart[id]; else state.cart[id] = qty;
    save('dw-cart', state.cart);
    renderGrid();
    renderCart();
  }

  function lines() {
    return PRODUCTS.filter(function (p) { return state.cart[p.id] > 0; })
      .map(function (p) { return { p: p, qty: state.cart[p.id], total: state.cart[p.id] * p.price }; });
  }

  function stepper(id, qty) {
    var wrap = document.createElement('div');
    wrap.className = 'stepper';
    wrap.dir = 'ltr';
    var plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'زيادة');
    plus.addEventListener('click', function () { setQty(id, qty + 1); });
    var num = document.createElement('span');
    num.textContent = fmt.format(qty);
    var minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'تقليل');
    minus.addEventListener('click', function () { setQty(id, qty - 1); });
    wrap.appendChild(plus); wrap.appendChild(num); wrap.appendChild(minus);
    return wrap;
  }

  function renderFilters() {
    var nav = document.getElementById('filters');
    nav.innerHTML = '';
    CATS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label;
      b.setAttribute('aria-pressed', String(state.cat === c.value));
      b.addEventListener('click', function () { state.cat = c.value; renderFilters(); renderGrid(); });
      nav.appendChild(b);
    });
  }

  function renderGrid() {
    var grid = document.getElementById('grid');
    grid.innerHTML = '';
    PRODUCTS.filter(function (p) { return state.cat === 'all' || p.cat === state.cat; })
      .forEach(function (p) {
        var qty = state.cart[p.id] || 0;
        var card = document.createElement('article');
        card.className = 'card';

        var img = document.createElement('img');
        img.src = p.img; img.alt = p.name; img.loading = 'lazy';

        var name = document.createElement('div');
        name.className = 'name'; name.textContent = p.name;

        var price = document.createElement('div');
        price.className = 'price';
        price.textContent = egp(p.price) + ' ';
        var unit = document.createElement('small');
        unit.textContent = '/ ' + p.unit;
        price.appendChild(unit);

        card.appendChild(img); card.appendChild(name); card.appendChild(price);

        if (qty === 0) {
          var add = document.createElement('button');
          add.type = 'button'; add.className = 'btn ghost block'; add.textContent = 'أضف للسلة';
          add.addEventListener('click', function () { setQty(p.id, 1); });
          card.appendChild(add);
        } else {
          card.appendChild(stepper(p.id, qty));
        }
        grid.appendChild(card);
      });
  }

  function orderText() {
    var ls = lines();
    var total = ls.reduce(function (s, l) { return s + l.total; }, 0);
    var rows = ls.map(function (l, i) {
      return fmt.format(i + 1) + ') ' + l.p.name + ' — ' + fmt.format(l.qty) + ' ' + l.p.unit + ' × ' + egp(l.p.price) + ' = ' + egp(l.total);
    });
    var parts = ['طلب جديد من تطبيق دارك وولف'];
    if (state.workshop) parts.push('الورشة: ' + state.workshop);
    if (state.phone) parts.push('التليفون: ' + state.phone);
    parts.push('———');
    parts = parts.concat(rows);
    parts.push('الإجمالي: ' + egp(total));
    var notes = document.getElementById('f-notes').value.trim();
    if (notes) parts.push('ملاحظات: ' + notes);
    return parts.join('\n');
  }

  function renderCart() {
    var ls = lines();
    var empty = document.getElementById('cart-empty');
    var body = document.getElementById('cart-body');
    if (ls.length === 0) {
      empty.hidden = false; body.hidden = true;
      return;
    }
    empty.hidden = true; body.hidden = false;

    var ul = document.getElementById('lines');
    ul.innerHTML = '';
    var total = 0;
    ls.forEach(function (l, i) {
      total += l.total;
      var li = document.createElement('li');
      var info = document.createElement('div');
      info.className = 'info';
      var n = document.createElement('div');
      n.className = 'lname'; n.textContent = fmt.format(i + 1) + '. ' + l.p.name;
      var m = document.createElement('div');
      m.className = 'lmeta'; m.textContent = fmt.format(l.qty) + ' ' + l.p.unit + ' × ' + egp(l.p.price);
      info.appendChild(n); info.appendChild(m);
      var t = document.createElement('div');
      t.className = 'ltotal'; t.textContent = egp(l.total);
      li.appendChild(info);
      li.appendChild(stepper(l.p.id, l.qty));
      li.appendChild(t);
      ul.appendChild(li);
    });
    document.getElementById('grand-total').textContent = egp(total);

    var hint = document.getElementById('send-hint');
    hint.innerHTML = '';
    hint.appendChild(document.createTextNode('الزرار بيفتح واتساب عندك والطلب جاهز في الرسالة، دوس إرسال ويوصل لدارك وولف على الرقم '));
    var bdi = document.createElement('bdi');
    bdi.dir = 'ltr'; bdi.textContent = '01066683195';
    hint.appendChild(bdi);
    hint.appendChild(document.createTextNode('.'));
  }

  function bind() {
    var w = document.getElementById('f-workshop');
    var ph = document.getElementById('f-phone');
    w.value = state.workshop; ph.value = state.phone;
    w.addEventListener('input', function () { state.workshop = w.value; save('dw-workshop', w.value); });
    ph.addEventListener('input', function () { state.phone = ph.value; save('dw-phone', ph.value); });

    document.getElementById('send-order').addEventListener('click', function () {
      var url = 'https://wa.me/' + WHATSAPP_NUMBER + '?text=' + encodeURIComponent(orderText());
      window.open(url, '_blank', 'noopener');
    });
    document.getElementById('copy-order').addEventListener('click', function () {
      var text = orderText();
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
          function () { toast('اتنسخ الطلب'); },
          function () { fallbackCopy(text); }
        );
      } else { fallbackCopy(text); }
    });
  }

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast('اتنسخ الطلب'); }
    catch (e) { toast('النسخ مش متاح، اعمل لقطة شاشة للفاتورة'); }
    document.body.removeChild(ta);
  }

  if (DEMO_MODE) {
    document.getElementById('demo-note').hidden = false;
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  renderFilters();
  renderGrid();
  renderCart();
  bind();
})();
