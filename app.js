/* دارك وولف — تطبيق طلبات خامات الورش: حسابات + متجر + إدارة */
(function () {
  'use strict';

  var CFG = window.DW_CONFIG || {};
  var OWNER_EMAIL = (CFG.ownerEmail || '').toLowerCase();
  var sb = window.supabase.createClient(CFG.supabase.url, CFG.supabase.key);

  var CATS = [
    { value: 'all',      label: 'الكل' },
    { value: 'kitchen',  label: 'إكسسوارات مطابخ' },
    { value: 'aluminum', label: 'ألومنيوم وشبابيك' }
  ];
  var KNOWN_IMAGES = [
    'photo-hinge.jpg','photo-drawer-slide.jpg','photo-handle.jpg','photo-gas-strut.jpg',
    'photo-leg.jpg','photo-led-strip.jpg','photo-alu-profile.jpg','photo-roller.jpg',
    'photo-lock.jpg','photo-epdm.jpg','photo-mesh.jpg','photo-upvc-handle.jpg'
  ];

  var fmt = new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 });
  function egp(n) { return fmt.format(n) + ' ج'; }
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  var state = {
    user: null,
    isOwner: false,
    products: [],
    texts: {},
    cart: load('dw-cart', {}),
    cat: 'all',
    authMode: 'login',
    adminTab: 'orders'
  };

  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  function toast(msg) {
    var el = $('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast'; el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------- الدخول ---------- */
  function showAuth() {
    $('auth-screen').hidden = false;
    $('app').hidden = true;
  }
  function showApp() {
    $('auth-screen').hidden = true;
    $('app').hidden = false;
  }
  function setAuthMode(mode) {
    state.authMode = mode;
    $('tab-login').classList.toggle('active', mode === 'login');
    $('tab-signup').classList.toggle('active', mode === 'signup');
    $('f-name-wrap').hidden = mode === 'login';
    $('auth-submit').textContent = mode === 'login' ? 'دخول' : 'إنشاء الحساب';
    $('auth-error').hidden = true;
    $('f-password').setAttribute('autocomplete', mode === 'login' ? 'current-password' : 'new-password');
  }
  function authError(msg) {
    var el = $('auth-error');
    el.textContent = msg;
    el.hidden = false;
  }
  function bindAuth() {
    $('tab-login').addEventListener('click', function () { setAuthMode('login'); });
    $('tab-signup').addEventListener('click', function () { setAuthMode('signup'); });
    $('auth-form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      var email = $('f-email').value.trim();
      var pass = $('f-password').value;
      var name = $('f-name').value.trim();
      $('auth-error').hidden = true;
      $('auth-submit').disabled = true;
      var done = function () { $('auth-submit').disabled = false; };
      if (state.authMode === 'signup') {
        if (!name) { authError('اكتب اسمك الأول'); done(); return; }
        sb.auth.signUp({ email: email, password: pass, options: { data: { full_name: name } } })
          .then(function (r) {
            done();
            if (r.error) { authError(translateAuthError(r.error.message)); return; }
            if (!r.data.session) { authError('تم إنشاء الحساب. سجّل دخولك دلوقتي.'); setAuthMode('login'); return; }
            toast('أهلًا بيك يا ' + name);
          })
          .catch(function () { done(); authError('حصلت مشكلة في الاتصال. جرّب تاني.'); });
      } else {
        sb.auth.signInWithPassword({ email: email, password: pass })
          .then(function (r) {
            done();
            if (r.error) { authError(translateAuthError(r.error.message)); }
          })
          .catch(function () { done(); authError('حصلت مشكلة في الاتصال. جرّب تاني.'); });
      }
    });
  }
  function translateAuthError(msg) {
    msg = String(msg || '');
    if (/Invalid login credentials/i.test(msg)) return 'البريد أو كلمة السر غلط.';
    if (/User already registered/i.test(msg)) return 'البريد ده مسجل قبل كده. سجّل دخولك.';
    if (/at least 6/i.test(msg) || /password/i.test(msg) && /short|weak/i.test(msg)) return 'كلمة السر لازم ٦ حروف على الأقل.';
    if (/valid email/i.test(msg)) return 'اكتب بريد إلكتروني صحيح.';
    if (/rate limit|too many/i.test(msg)) return 'محاولات كتير. استنى شوية وجرّب تاني.';
    return 'مشكلة: ' + msg;
  }

  /* ---------- البيانات ---------- */
  function loadTexts() {
    return sb.from('settings').select('value').eq('id', 'app').maybeSingle()
      .then(function (r) {
        state.texts = (r.data && r.data.value) || {};
        applyTexts();
      })
      .catch(function () {});
  }
  function applyTexts() {
    var t = state.texts;
    if (t.welcome) $('welcome-text').textContent = t.welcome;
    if (t.description) $('brand-sub').textContent = t.description;
    if (t.footer) $('footer-text').textContent = t.footer;
    var note = $('demo-note');
    if (t.note) { note.textContent = t.note; note.hidden = false; }
    else { note.hidden = true; }
  }
  function loadProducts() {
    return sb.from('products').select('*').order('sort').order('created_at')
      .then(function (r) {
        if (r.error) { toast('مشكلة في تحميل المنتجات'); return; }
        state.products = r.data || [];
        renderGrid();
      })
      .catch(function () { toast('مشكلة في تحميل المنتجات'); });
  }

  /* ---------- المتجر ---------- */
  function setQty(id, qty) {
    if (qty <= 0) { delete state.cart[id]; } else { state.cart[id] = qty; }
    save('dw-cart', state.cart);
    renderGrid();
    renderCart();
  }
  function productById(id) {
    for (var i = 0; i < state.products.length; i++) {
      if (String(state.products[i].id) === String(id)) return state.products[i];
    }
    return null;
  }
  function lines() {
    return Object.keys(state.cart).map(function (id) {
      var p = productById(id);
      if (!p || !(state.cart[id] > 0)) return null;
      return { p: p, qty: state.cart[id], total: state.cart[id] * p.price };
    }).filter(Boolean);
  }
  function catLabel(v) {
    for (var i = 0; i < CATS.length; i++) if (CATS[i].value === v) return CATS[i].label;
    return v;
  }
  function renderFilters() {
    var nav = $('filters');
    nav.innerHTML = '';
    CATS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (state.cat === c.value ? ' active' : '');
      b.textContent = c.label;
      b.addEventListener('click', function () { state.cat = c.value; renderFilters(); renderGrid(); });
      nav.appendChild(b);
    });
  }
  function renderGrid() {
    var grid = $('grid');
    grid.innerHTML = '';
    var shown = state.products.filter(function (p) {
      return p.in_stock && (state.cat === 'all' || p.cat === state.cat);
    });
    if (!shown.length) {
      grid.innerHTML = '<p class="empty">مفيش منتجات متاحة هنا دلوقتي.</p>';
      return;
    }
    shown.forEach(function (p) {
      var qty = state.cart[p.id] || 0;
      var card = document.createElement('article');
      card.className = 'card';
      var imgHtml = p.img ? '<img src="' + esc(p.img) + '" alt="" loading="lazy">' : '';
      card.innerHTML =
        '<div class="thumb">' + imgHtml + '</div>' +
        '<div class="info">' +
          '<h3>' + esc(p.name) + '</h3>' +
          '<p class="price">' + egp(p.price) + ' <span>/ ' + esc(p.unit) + '</span></p>' +
          '<div class="row"></div>' +
        '</div>';
      var row = card.querySelector('.row');
      if (qty === 0) {
        var add = document.createElement('button');
        add.type = 'button'; add.className = 'btn primary'; add.textContent = 'أضف للسلة';
        add.addEventListener('click', function () { setQty(p.id, 1); });
        row.appendChild(add);
      } else {
        row.appendChild(stepper(p.id, qty));
      }
      grid.appendChild(card);
    });
  }
  function stepper(id, qty) {
    var wrap = document.createElement('div');
    wrap.className = 'stepper';
    var minus = document.createElement('button');
    minus.type = 'button'; minus.textContent = '−'; minus.setAttribute('aria-label', 'أنقص');
    var val = document.createElement('span'); val.textContent = qty;
    var plus = document.createElement('button');
    plus.type = 'button'; plus.textContent = '+'; plus.setAttribute('aria-label', 'زود');
    plus.addEventListener('click', function () { setQty(id, qty + 1); });
    minus.addEventListener('click', function () { setQty(id, qty - 1); });
    wrap.appendChild(minus); wrap.appendChild(val); wrap.appendChild(plus);
    return wrap;
  }
  function renderCart() {
    var ls = lines();
    $('cart-empty').hidden = ls.length > 0;
    $('cart-body').hidden = ls.length === 0;
    if (!ls.length) return;
    var ul = $('lines');
    ul.innerHTML = '';
    var total = 0;
    ls.forEach(function (l) {
      total += l.total;
      var li = document.createElement('li');
      li.innerHTML =
        '<span class="l-name">' + esc(l.p.name) + '</span>' +
        '<span class="l-qty">' + l.qty + ' × ' + egp(l.p.price) + '</span>' +
        '<strong>' + egp(l.total) + '</strong>';
      ul.appendChild(li);
    });
    $('grand-total').textContent = egp(total);
  }
  function orderPayload() {
    var ls = lines();
    return {
      customer_name: $('f-workshop').value.trim(),
      phone: $('f-phone').value.trim(),
      notes: $('f-notes').value.trim(),
      items: ls.map(function (l) {
        return { name: l.p.name, qty: l.qty, unit: l.p.unit, price: l.p.price, total: l.total };
      }),
      total: ls.reduce(function (s, l) { return s + l.total; }, 0)
    };
  }
  function orderText(payload) {
    var rows = payload.items.map(function (it, i) {
      return (i + 1) + ') ' + it.name + ' — ' + it.qty + ' ' + it.unit + ' × ' + egp(it.price) + ' = ' + egp(it.total);
    });
    return ['طلب جديد — Darken Wolf', 'الاسم: ' + payload.customer_name, 'التليفون: ' + payload.phone]
      .concat(payload.notes ? ['ملاحظات: ' + payload.notes] : [])
      .concat([''].concat(rows))
      .concat(['الإجمالي: ' + egp(payload.total)]);
  }
  function sendOrder() {
    var payload = orderPayload();
    var hint = $('send-hint');
    if (!payload.customer_name) { hint.textContent = 'اكتب الاسم الأول.'; return; }
    if (!payload.phone) { hint.textContent = 'اكتب رقم التليفون الأول.'; return; }
    hint.textContent = '';
    var btn = $('send-order');
    btn.disabled = true;
    btn.textContent = 'جاري الإرسال…';
    sb.from('orders').insert({
      customer_name: payload.customer_name,
      phone: payload.phone,
      notes: payload.notes || null,
      items: payload.items,
      total: payload.total
    }).select('id').single()
      .then(function (r) {
        btn.disabled = false;
        btn.textContent = 'إرسال الطلب';
        if (r.error) { hint.textContent = 'الطلب ما اتبعتش. جرّب تاني.'; return; }
        state.cart = {};
        save('dw-cart', state.cart);
        renderGrid();
        renderCart();
        var id = String(r.data.id).slice(0, 8);
        $('cart-body').hidden = true;
        $('cart-empty').hidden = true;
        $('order-done').hidden = false;
        $('order-id').textContent = id;
        $('wa-copy').href = 'https://wa.me/' + (CFG.whatsappNumber || '') +
          '?text=' + encodeURIComponent(orderText(payload).join('\n'));
        toast('اتبعت الطلب');
      })
      .catch(function () {
        btn.disabled = false;
        btn.textContent = 'إرسال الطلب';
        hint.textContent = 'الطلب ما اتبعتش. جرّب تاني.';
      });
  }

  /* ---------- الإدارة ---------- */
  function openAdmin() {
    $('catalog-view').hidden = true;
    $('admin-view').hidden = false;
    setAdminTab('orders');
    window.scrollTo(0, 0);
  }
  function closeAdmin() {
    $('admin-view').hidden = true;
    $('catalog-view').hidden = false;
    loadProducts();
  }
  function setAdminTab(tab) {
    state.adminTab = tab;
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    $('admin-orders').hidden = tab !== 'orders';
    $('admin-products').hidden = tab !== 'products';
    $('admin-texts').hidden = tab !== 'texts';
    if (tab === 'orders') renderAdminOrders();
    if (tab === 'products') renderAdminProducts();
    if (tab === 'texts') fillTextsForm();
  }

  function renderAdminOrders() {
    var box = $('admin-orders');
    box.innerHTML = '<p class="empty">بيتم التحميل…</p>';
    sb.from('orders').select('*').order('created_at', { ascending: false }).limit(100)
      .then(function (r) {
        if (r.error) { box.innerHTML = '<p class="empty">مشكلة في تحميل الطلبات.</p>'; return; }
        var orders = r.data || [];
        if (!orders.length) { box.innerHTML = '<p class="empty">مفيش طلبات لسه.</p>'; return; }
        box.innerHTML = '';
        orders.forEach(function (o) {
          var card = document.createElement('article');
          card.className = 'order-card' + (o.status === 'done' ? ' done' : '');
          var when = new Date(o.created_at).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
          var items = (o.items || []).map(function (it) {
            return '<li>' + esc(it.name) + ' — ' + it.qty + ' ' + esc(it.unit || '') + ' × ' + egp(it.price) + '</li>';
          }).join('');
          card.innerHTML =
            '<div class="order-top"><strong>' + esc(o.customer_name) + '</strong>' +
            '<span class="order-when">' + when + '</span></div>' +
            '<div class="order-phone" dir="ltr">' + esc(o.phone) + '</div>' +
            (o.notes ? '<div class="order-notes">' + esc(o.notes) + '</div>' : '') +
            '<ul class="order-items">' + items + '</ul>' +
            '<div class="order-foot"><strong>' + egp(o.total) + '</strong>' +
            '<button type="button" class="btn small ' + (o.status === 'done' ? 'ghost' : 'primary') + '">' +
              (o.status === 'done' ? 'تم ✓ — اضغط للتراجع' : 'تحديد كمُنفَّذ') + '</button></div>';
          card.querySelector('button').addEventListener('click', function () {
            var next = o.status === 'done' ? 'new' : 'done';
            sb.from('orders').update({ status: next }).eq('id', o.id).then(function (u) {
              if (u.error) { toast('مشكلة في التحديث'); return; }
              renderAdminOrders();
            });
          });
          box.appendChild(card);
        });
      })
      .catch(function () { box.innerHTML = '<p class="empty">مشكلة في تحميل الطلبات.</p>'; });
  }

  function renderAdminProducts() {
    var box = $('product-list');
    box.innerHTML = '<p class="empty">بيتم التحميل…</p>';
    sb.from('products').select('*').order('sort').order('created_at')
      .then(function (r) {
        if (r.error) { box.innerHTML = '<p class="empty">مشكلة في تحميل المنتجات.</p>'; return; }
        var list = r.data || [];
        box.innerHTML = list.length ? '' : '<p class="empty">مفيش منتجات. ضيف أول منتج.</p>';
        list.forEach(function (p) {
          var row = document.createElement('div');
          row.className = 'product-row' + (p.in_stock ? '' : ' out');
          row.innerHTML =
            '<div class="product-main"><strong>' + esc(p.name) + '</strong>' +
            '<span>' + egp(p.price) + ' / ' + esc(p.unit) + ' — ' + esc(catLabel(p.cat)) + '</span></div>' +
            '<label class="check small"><input type="checkbox" ' + (p.in_stock ? 'checked' : '') + '> متاح</label>' +
            '<button type="button" class="btn ghost small edit">تعديل</button>' +
            '<button type="button" class="btn ghost small danger del">حذف</button>';
          row.querySelector('input[type=checkbox]').addEventListener('change', function (ev) {
            sb.from('products').update({ in_stock: ev.target.checked }).eq('id', p.id).then(function (u) {
              if (u.error) { toast('مشكلة في التحديث'); return; }
              toast(ev.target.checked ? 'المنتج بقى متاح' : 'المنتج اتحفظ كغير متاح');
              renderAdminProducts();
            });
          });
          row.querySelector('.edit').addEventListener('click', function () { openProductForm(p); });
          row.querySelector('.del').addEventListener('click', function () {
            if (!confirm('تمسح "' + p.name + '" نهائي؟')) return;
            sb.from('products').delete().eq('id', p.id).then(function (d) {
              if (d.error) { toast('مشكلة في المسح'); return; }
              toast('اتمسح المنتج');
              renderAdminProducts();
            });
          });
          box.appendChild(row);
        });
      })
      .catch(function () { box.innerHTML = '<p class="empty">مشكلة في تحميل المنتجات.</p>'; });
  }
  function fillImageOptions() {
    var sel = $('p-img');
    sel.innerHTML = '<option value="">بدون صورة</option>';
    KNOWN_IMAGES.forEach(function (f) {
      var o = document.createElement('option');
      o.value = f; o.textContent = f;
      sel.appendChild(o);
    });
  }
  function openProductForm(p) {
    $('product-form').hidden = false;
    $('product-form-title').textContent = p ? 'تعديل منتج' : 'منتج جديد';
    $('p-id').value = p ? p.id : '';
    $('p-name').value = p ? p.name : '';
    $('p-price').value = p ? p.price : '';
    $('p-unit').value = p ? p.unit : 'قطعة';
    $('p-cat').value = p ? p.cat : 'kitchen';
    $('p-img').value = p && p.img ? p.img : '';
    $('p-stock').checked = p ? !!p.in_stock : true;
    $('p-name').focus();
  }
  function saveProduct() {
    var id = $('p-id').value;
    var data = {
      name: $('p-name').value.trim(),
      price: Number($('p-price').value) || 0,
      unit: $('p-unit').value.trim() || 'قطعة',
      cat: $('p-cat').value,
      img: $('p-img').value || null,
      in_stock: $('p-stock').checked
    };
    if (!data.name) { toast('اكتب اسم المنتج'); return; }
    var q = id
      ? sb.from('products').update(data).eq('id', id)
      : sb.from('products').insert(data);
    q.then(function (r) {
      if (r.error) { toast('مشكلة في الحفظ: ' + r.error.message); return; }
      toast('اتحفظ المنتج');
      $('product-form').hidden = true;
      renderAdminProducts();
    }).catch(function () { toast('مشكلة في الحفظ'); });
  }

  function fillTextsForm() {
    $('t-welcome').value = state.texts.welcome || '';
    $('t-description').value = state.texts.description || '';
    $('t-note').value = state.texts.note || '';
    $('t-footer').value = state.texts.footer || '';
  }
  function saveTexts() {
    var value = {
      welcome: $('t-welcome').value.trim(),
      description: $('t-description').value.trim(),
      note: $('t-note').value.trim(),
      footer: $('t-footer').value.trim()
    };
    sb.from('settings').upsert({ id: 'app', value: value })
      .then(function (r) {
        if (r.error) { toast('مشكلة في الحفظ: ' + r.error.message); return; }
        state.texts = value;
        applyTexts();
        toast('اتحفظت النصوص');
      })
      .catch(function () { toast('مشكلة في الحفظ'); });
  }

  /* ---------- تشغيل ---------- */
  function onUser(user) {
    state.user = user;
    state.isOwner = !!user && String(user.email || '').toLowerCase() === OWNER_EMAIL;
    if (!user) { showAuth(); return; }
    var name = (user.user_metadata && user.user_metadata.full_name) || user.email;
    $('user-name').textContent = name;
    $('admin-open').hidden = !state.isOwner;
    var w = $('f-workshop');
    if (!w.value && user.user_metadata && user.user_metadata.full_name) {
      w.value = user.user_metadata.full_name;
    }
    showApp();
    loadTexts();
    loadProducts();
    renderFilters();
    renderCart();
  }
  function bind() {
    bindAuth();
    $('logout').addEventListener('click', function () {
      sb.auth.signOut().then(function () { toast('سجلت خروجك'); });
    });
    $('admin-open').addEventListener('click', openAdmin);
    $('admin-close').addEventListener('click', closeAdmin);
    document.querySelectorAll('.admin-tab').forEach(function (b) {
      b.addEventListener('click', function () { setAdminTab(b.getAttribute('data-tab')); });
    });
    $('send-order').addEventListener('click', sendOrder);
    $('product-add').addEventListener('click', function () { openProductForm(null); });
    $('p-save').addEventListener('click', saveProduct);
    $('p-cancel').addEventListener('click', function () { $('product-form').hidden = true; });
    $('t-save').addEventListener('click', saveTexts);
    var w = $('f-workshop');
    w.addEventListener('input', function () { save('dw-workshop', w.value); });
    var ph = $('f-phone');
    ph.addEventListener('input', function () { save('dw-phone', ph.value); });
    w.value = load('dw-workshop', '');
    ph.value = load('dw-phone', '');
    fillImageOptions();
  }

  document.addEventListener('DOMContentLoaded', function () {
    bind();
    setAuthMode('login');
    sb.auth.getSession().then(function (r) {
      onUser(r.data.session ? r.data.session.user : null);
    });
    sb.auth.onAuthStateChange(function (event, session) {
      onUser(session ? session.user : null);
    });
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  });
})();
