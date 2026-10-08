/* ============================================================
 * app.js —— 页面路由、视图渲染与交互
 * 依赖：utils.js、storage.js
 *
 * 页面（hash 路由）：
 *   #/home            首页（浏览 + 类型筛选）
 *   #/search          搜索页（关键词 + 分类）
 *   #/publish         发布页（寻物 / 招领表单）
 *   #/success?id=xx   发布成功页
 *   #/detail?id=xx    信息详情页（联系发布者 / 发布者更新状态）
 *   #/mine            我的发布（状态维护入口）
 * ============================================================ */
(function () {
  'use strict';

  var U = Utils, S = Store;
  var view = document.getElementById('view');
  var tabbar = document.getElementById('tabbar');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  /* 页面级临时状态 */
  var state = {
    homeType: '',            // 首页筛选 '' | lost | found
    searchKw: '',            // 搜索关键词
    searchCat: '',           // 搜索分类
    formType: U.TYPE_LOST,   // 发布表单类型
    formImages: []           // 待上传图片（base64）
  };

  /* ---------------- 通用组件 ---------------- */

  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, ms || 1800);
  }

  // 底部操作确认弹层
  function openSheet(opts) {
    var mask = document.createElement('div');
    mask.className = 'sheet-mask';
    mask.innerHTML =
      '<div class="sheet">' +
      '  <h3>' + U.escapeHtml(opts.title) + '</h3>' +
      (opts.content ? '<p>' + U.escapeHtml(opts.content) + '</p>' : '') +
      '  <div class="sheet-actions">' +
      '    <button class="btn btn-primary" data-act="ok">' + U.escapeHtml(opts.okText || '确定') + '</button>' +
      '    <button class="btn btn-ghost btn-block" data-act="cancel">取消</button>' +
      '  </div>' +
      '</div>';
    function close() { mask.remove(); }
    mask.addEventListener('click', function (e) {
      var act = e.target.getAttribute('data-act');
      if (act === 'cancel' || e.target === mask) { close(); }
      if (act === 'ok') { close(); opts.onOk && opts.onOk(); }
    });
    document.getElementById('phone').appendChild(mask);
  }

  // 物品配图：有上传图用上传图，否则用分类 SVG
  function thumbSrc(it) {
    if (it.images && it.images.length) return it.images[0];
    return U.CATEGORY_ICONS[it.category] || U.CATEGORY_ICONS['其他'];
  }

  function typeTag(it) {
    return it.type === U.TYPE_LOST
      ? '<span class="tag tag-lost">寻物</span>'
      : '<span class="tag tag-found">招领</span>';
  }

  function statusTag(it) {
    var text = U.STATUS_TEXT[it.type][it.status];
    return it.status === U.STATUS_DONE
      ? '<span class="tag tag-done">' + text + '</span>'
      : '<span class="tag tag-doing">' + text + '</span>';
  }

  // 列表卡片
  function cardHtml(it) {
    return '<div class="item-card' + (it.status === 'done' ? ' is-done' : '') + '" data-go-detail="' + it.id + '">' +
      '  <div class="item-thumb"><img src="' + thumbSrc(it) + '" alt=""></div>' +
      '  <div class="item-main">' +
      '    <div class="item-name">' + U.escapeHtml(it.name) + '</div>' +
      '    <div class="item-meta"><span>📍 ' + U.escapeHtml(it.location) + '</span></div>' +
      '    <div class="item-meta"><span>' + U.fromNow(it.happenTime) + '</span><span class="dot">·</span><span>' + U.escapeHtml(it.category) + '</span></div>' +
      '    <div class="item-foot">' + typeTag(it) + statusTag(it) + '</div>' +
      '  </div>' +
      '</div>';
  }

  function emptyHtml(title, sub, actions) {
    return '<div class="empty">' +
      '<img src="assets/empty.svg" alt="暂无数据">' +
      '<div class="ep-title">' + U.escapeHtml(title) + '</div>' +
      '<div class="ep-sub">' + U.escapeHtml(sub) + '</div>' +
      (actions ? '<div class="ep-actions">' + actions + '</div>' : '') +
      '</div>';
  }

  /* ---------------- 首页 ---------------- */

  function renderHome() {
    var stats = S.getStats();
    var items = U.filterItems(S.getItems(), { type: state.homeType });

    view.innerHTML =
      '<div class="home-hero">' +
      '  <div class="hero-title">校园失物招领</div>' +
      '  <div class="hero-sub">让每一份遗失，都有处可寻</div>' +
      '  <div class="home-search" id="homeSearchBtn"><span class="tab-ic ic-search"></span>搜索物品名称、地点…</div>' +
      '</div>' +
      '<div class="home-stat">' +
      '  <div class="stat-card"><div class="num">' + stats.lost + '</div><div class="lb">寻物启事</div></div>' +
      '  <div class="stat-card"><div class="num">' + stats.found + '</div><div class="lb">招领启事</div></div>' +
      '  <div class="stat-card"><div class="num">' + stats.done + '</div><div class="lb">已完结</div></div>' +
      '</div>' +
      '<div class="segment" id="homeSeg">' +
      '  <button data-v=""' + (state.homeType === '' ? ' class="on"' : '') + '>全部</button>' +
      '  <button data-v="lost"' + (state.homeType === 'lost' ? ' class="on"' : '') + '>寻物启事</button>' +
      '  <button data-v="found"' + (state.homeType === 'found' ? ' class="on"' : '') + '>招领启事</button>' +
      '</div>' +
      '<div class="list" id="homeList">' +
      (items.length
        ? items.map(cardHtml).join('')
        : emptyHtml('这里还没有信息', '成为第一个发布信息的人吧',
          '<button class="btn btn-primary btn-sm" id="emptyPublish">去发布</button>')) +
      '</div>';

    U.$('#homeSearchBtn').addEventListener('click', function () { location.hash = '#/search'; });
    var ep = U.$('#emptyPublish');
    if (ep) ep.addEventListener('click', function () { location.hash = '#/publish'; });
    U.$('#homeSeg').addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-v]');
      if (!btn) return;
      state.homeType = btn.getAttribute('data-v');
      renderHome();
    });
    bindCardJump(view);
  }

  // 卡片点击 -> 详情（首页/搜索/我的通用）
  function bindCardJump(root) {
    root.addEventListener('click', function (e) {
      var card = e.target.closest('[data-go-detail]');
      if (card) location.hash = '#/detail?id=' + card.getAttribute('data-go-detail');
    });
  }

  /* ---------------- 搜索页 ---------------- */

  function renderSearch() {
    view.innerHTML =
      '<div class="search-box">' +
      '  <div class="search-input-wrap">' +
      '    <span class="tab-ic ic-search"></span>' +
      '    <input id="searchInput" type="text" placeholder="搜索物品名称 / 地点 / 编号" value="' + U.escapeHtml(state.searchKw) + '">' +
      '  </div>' +
      '  <button class="search-cancel" id="searchCancel">取消</button>' +
      '</div>' +
      '<div class="chips" id="searchChips">' +
      '  <span class="chip' + (state.searchCat === '' ? ' on' : '') + '" data-c="">全部</span>' +
      U.CATEGORIES.map(function (c) {
        return '<span class="chip' + (state.searchCat === c ? ' on' : '') + '" data-c="' + c + '">' + c + '</span>';
      }).join('') +
      '</div>' +
      '<div class="result-tip" id="resultTip"></div>' +
      '<div class="list" id="searchList"></div>';

    var input = U.$('#searchInput');
    var listEl = U.$('#searchList');
    var tipEl = U.$('#resultTip');

    function refresh() {
      var items = U.filterItems(S.getItems(), {
        keyword: state.searchKw,
        category: state.searchCat
      });
      tipEl.textContent = state.searchKw || state.searchCat
        ? '找到 ' + items.length + ' 条相关信息'
        : '共 ' + items.length + ' 条信息';
      if (items.length) {
        listEl.innerHTML = items.map(cardHtml).join('');
      } else {
        listEl.innerHTML = emptyHtml(
          '没有找到相关信息',
          '换个关键词或分类试试，也可以发布一条新信息',
          '<button class="btn btn-ghost btn-sm" id="resetSearch">重置筛选</button>' +
          '<button class="btn btn-primary btn-sm" id="goPublish">去发布</button>');
        var rs = U.$('#resetSearch', listEl);
        if (rs) rs.addEventListener('click', function () {
          state.searchKw = ''; state.searchCat = '';
          renderSearch();
        });
        U.$('#goPublish', listEl).addEventListener('click', function () { location.hash = '#/publish'; });
      }
    }

    input.addEventListener('input', U.debounce(function () {
      state.searchKw = input.value;
      refresh();
    }, 150));
    U.$('#searchCancel').addEventListener('click', function () { location.hash = '#/home'; });
    U.$('#searchChips').addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      state.searchCat = chip.getAttribute('data-c');
      renderSearch();
    });

    refresh();
    setTimeout(function () { input.focus(); }, 60);
    bindCardJump(view);
  }

  /* ---------------- 发布页 ---------------- */

  function renderPublish() {
    var isLost = state.formType === U.TYPE_LOST;
    view.innerHTML =
      '<header class="appbar"><h1>发布信息</h1></header>' +
      '<form id="publishForm" novalidate>' +
      '  <div class="form-section">' +
      '    <div class="sec-title">选择启事类型</div>' +
      '    <div class="type-switch">' +
      '      <div class="type-opt lost' + (isLost ? ' on' : '') + '" data-type="lost">' +
      '        <div class="t-ic">🔍</div><div class="t-name">寻物启事</div>' +
      '        <div class="t-desc">我丢了东西，寻找它</div>' +
      '      </div>' +
      '      <div class="type-opt' + (!isLost ? ' on' : '') + '" data-type="found">' +
      '        <div class="t-ic">🤝</div><div class="t-name">招领启事</div>' +
      '        <div class="t-desc">我捡到东西，找失主</div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +

      '  <div class="form-section">' +
      '    <div class="sec-title">物品信息</div>' +
      fieldHtml('name', '物品名称', '<input type="text" name="name" maxlength="30" placeholder="如：黑色折叠伞 / 校园卡">', true) +
      '    <div class="field"><label>物品分类<span class="req">*</span></label><div class="ctrl">' +
      '      <select name="category"><option value="">请选择分类</option>' +
      U.CATEGORIES.map(function (c) { return '<option value="' + c + '">' + c + '</option>'; }).join('') +
      '      </select><div class="err-tx"></div></div></div>' +
      fieldHtml('location', isLost ? '丢失地点' : '拾到地点',
        '<input type="text" name="location" placeholder="如：第二食堂一楼 / 教三 302">', true) +
      '    <div class="field"><label>' + (isLost ? '丢失时间' : '拾到时间') + '<span class="req">*</span></label><div class="ctrl">' +
      '      <input type="datetime-local" name="happenTime" value="' + U.nowLocalInput() + '"><div class="err-tx"></div></div></div>' +
      '    <div class="field"><label>物品描述</label><div class="ctrl">' +
      '      <textarea name="description" maxlength="300" placeholder="描述物品特征，便于核对（颜色、品牌、明显记号等）"></textarea>' +
      '      <div class="hint">0 / 300</div><div class="err-tx"></div></div></div>' +
      '  </div>' +

      '  <div class="form-section">' +
      '    <div class="sec-title">物品图片（选填，最多 ' + U.MAX_IMAGES + ' 张）</div>' +
      '    <div class="field"><label>&nbsp;</label><div class="ctrl">' +
      '      <div class="img-uploader" id="imgUploader">' +
      '        <div class="img-add" id="imgAdd"><span class="plus">+</span>添加图片</div>' +
      '      </div>' +
      '      <input type="file" id="imgFile" accept="image/*" multiple hidden>' +
      '      <div class="err-tx"></div>' +
      '    </div></div>' +
      '  </div>' +

      '  <div class="form-section">' +
      '    <div class="sec-title">联系方式（仅在信息详情页对查看者公开）</div>' +
      fieldHtml('contactName', '联系人', '<input type="text" name="contactName" placeholder="你的称呼，如：林同学">', true) +
      fieldHtml('contact', '手机/微信', '<input type="tel" name="contact" placeholder="手机号或微信号">', true) +
      '  </div>' +

      '  <div class="form-submit"><button type="submit" class="btn btn-primary" id="submitBtn">提交发布</button></div>' +
      '</form>';

    // 描述字数
    var desc = view.querySelector('[name=description]');
    var hint = desc.parentElement.querySelector('.hint');
    desc.addEventListener('input', function () { hint.textContent = desc.value.length + ' / 300'; });

    // 类型切换
    U.$('.type-switch').addEventListener('click', function (e) {
      var opt = e.target.closest('.type-opt');
      if (!opt) return;
      state.formType = opt.getAttribute('data-type');
      renderPublish();
    });

    // 图片上传
    renderImageCells();
    U.$('#imgAdd').addEventListener('click', function () { U.$('#imgFile').click(); });
    U.$('#imgFile').addEventListener('change', function (e) {
      var files = Array.prototype.slice.call(e.target.files || []);
      files.forEach(function (f) {
        if (state.formImages.length >= U.MAX_IMAGES) {
          toast('最多上传 ' + U.MAX_IMAGES + ' 张图片');
          return;
        }
        U.compressImage(f).then(function (dataUrl) {
          if (state.formImages.length < U.MAX_IMAGES) {
            state.formImages.push(dataUrl);
            renderImageCells();
          }
        }).catch(function (err) { toast(err.message); });
      });
      e.target.value = '';
    });

    // 提交
    U.$('#publishForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target;
      var data = {
        type: state.formType,
        name: f.name.value,
        category: f.category.value,
        location: f.location.value,
        happenTime: f.happenTime.value,
        description: f.description.value,
        contactName: f.contactName.value,
        contact: f.contact.value,
        images: state.formImages.slice()
      };
      var res = U.validateItem(data);

      // 清除旧的错误标记
      U.$all('.field.invalid', f).forEach(function (el) { el.classList.remove('invalid'); });

      if (!res.valid) {
        // 图片错误挂到 uploader 的 field
        Object.keys(res.errors).forEach(function (key) {
          if (key === 'type') { toast(res.errors[key]); return; }
          var el;
          if (key === 'images') el = U.$('#imgUploader').closest('.field');
          else el = f[key] ? f[key].closest('.field') : null;
          if (el) {
            el.classList.add('invalid');
            var tx = el.querySelector('.err-tx');
            if (tx) tx.textContent = res.errors[key];
          }
        });
        var firstKey = Object.keys(res.errors).filter(function (k) { return k !== 'type'; })[0];
        if (firstKey && firstKey !== 'images') f[firstKey].focus();
        toast('请完善标红的必填信息');
        return;
      }

      var btn = U.$('#submitBtn');
      btn.setAttribute('disabled', 'disabled');
      btn.textContent = '发布中…';
      // 让按钮状态先渲染再写存储（大图片可能稍卡）
      setTimeout(function () {
        var item = S.addItem(data);
        btn.removeAttribute('disabled');
        btn.textContent = '提交发布';
        if (item) {
          state.formImages = [];
          location.hash = '#/success?id=' + item.id;
        }
      }, 50);
    });
  }

  // 生成一行表单字段
  function fieldHtml(name, label, ctrl, required) {
    return '<div class="field"><label>' + label + (required ? '<span class="req">*</span>' : '') +
      '</label><div class="ctrl">' + ctrl + '<div class="err-tx"></div></div></div>';
  }

  // 渲染图片缩略格
  function renderImageCells() {
    var uploader = U.$('#imgUploader');
    if (!uploader) return;
    var cells = state.formImages.map(function (src, i) {
      return '<div class="img-cell"><img src="' + src + '" alt=""><button type="button" class="rm" data-rm="' + i + '">×</button></div>';
    }).join('');
    var add = state.formImages.length < U.MAX_IMAGES
      ? '<div class="img-add" id="imgAdd"><span class="plus">+</span>添加图片</div>' : '';
    uploader.innerHTML = cells + add;
    var addBtn = U.$('#imgAdd');
    if (addBtn) addBtn.addEventListener('click', function () { U.$('#imgFile').click(); });
    uploader.querySelectorAll('[data-rm]').forEach(function (b) {
      b.addEventListener('click', function () {
        state.formImages.splice(Number(b.getAttribute('data-rm')), 1);
        renderImageCells();
      });
    });
  }

  /* ---------------- 发布成功页 ---------------- */

  function renderSuccess(id) {
    document.body.classList.add('hide-tabbar');
    view.classList.add('no-tabbar');
    view.innerHTML =
      '<div class="success-page">' +
      '  <div class="success-icon"><svg viewBox="0 0 52 52" fill="none"><circle cx="26" cy="26" r="24" fill="none" stroke="#2f9e5e" stroke-width="2.5"/><path d="M15 27l7.5 7.5L38 19" stroke="#2f9e5e" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '  <h2>发布成功！</h2>' +
      '  <p>信息已同步到首页列表，大家现在可以浏览到这条信息了。<br>物品找回或归还后，记得回来更新状态。</p>' +
      '  <div class="success-actions">' +
      '    <button class="btn btn-primary" id="sView">查看我发布的信息</button>' +
      '    <button class="btn btn-ghost btn-block" id="sAgain">继续发布一条</button>' +
      '    <button class="btn btn-ghost btn-block" id="sHome">返回首页</button>' +
      '  </div>' +
      '</div>';

    U.$('#sView').addEventListener('click', function () {
      location.hash = id ? '#/detail?id=' + id : '#/mine';
    });
    U.$('#sAgain').addEventListener('click', function () { location.hash = '#/publish'; });
    U.$('#sHome').addEventListener('click', function () { location.hash = '#/home'; });
  }

  /* ---------------- 详情页 ---------------- */

  function renderDetail(id) {
    document.body.classList.add('hide-tabbar');
    view.classList.add('no-tabbar');
    var it = S.getItem(id);
    if (!it) {
      view.innerHTML = '<div style="padding:60px 24px;text-align:center">' +
        emptyHtml('信息不存在或已被删除', '',
          '<button class="btn btn-primary btn-sm" id="dBackHome">返回首页</button>') + '</div>';
      U.$('#dBackHome').addEventListener('click', function () { location.hash = '#/home'; });
      return;
    }

    var isLost = it.type === U.TYPE_LOST;
    var isDone = it.status === U.STATUS_DONE;
    var mine = S.isMine(it.id);
    var imgs = it.images && it.images.length ? it.images : [thumbSrc(it)];

    var gallery =
      '<div class="detail-gallery' + (it.images && it.images.length ? ' has-img' : '') + '">' +
      '  <button class="detail-back" id="detailBack">‹</button>' +
      '  <img src="' + imgs[0] + '" alt="物品图片" id="galleryImg">' +
      (imgs.length > 1 ? '<div class="detail-counter" id="gCounter">1 / ' + imgs.length + '</div>' : '') +
      '</div>';

    var doneBanner = isDone
      ? '<div class="done-banner">✅ 这条' + U.TYPE_TEXT[it.type] + '已' +
        (isLost ? '标记为「已找到」' : '标记为「已归还」') + '，感谢关注，请勿重复联系</div>'
      : '';

    // 联系人区：本人看自己的信息不锁定；他人看已结束信息时锁定
    var contactHtml;
    if (isDone && !mine) {
      contactHtml =
        '<div class="contact-card">' +
        '  <div class="contact-head">📇 联系方式</div>' +
        '  <div class="contact-locked">该物品已' + (isLost ? '找到' : '归还') +
        '，联系方式已暂时收起，<br>如有疑问可在校园群内核实。</div>' +
        '</div>';
    } else {
      var phoneBtn = U.isPhone(it.contact)
        ? '<a class="btn btn-primary btn-sm" href="tel:' + U.escapeHtml(it.contact) + '">📞 拨打电话</a>' : '';
      contactHtml =
        '<div class="contact-card">' +
        '  <div class="contact-head">📇 联系方式 · 请说明你来自校园失物招领</div>' +
        '  <div class="contact-line"><span class="ck">联系人</span><span class="cv">' + U.escapeHtml(it.contactName) + '</span></div>' +
        '  <div class="contact-line"><span class="ck">' + (U.isPhone(it.contact) ? '手机号' : '微信号') +
        '</span><span class="cv">' + U.escapeHtml(it.contact) + '</span></div>' +
        '  <div class="contact-actions">' +
        '    <button class="btn btn-ghost btn-sm" id="copyContact">📋 复制' + (U.isPhone(it.contact) ? '手机号' : '微信号') + '</button>' +
        phoneBtn +
        '  </div>' +
        '</div>';
    }

    // 发布者管理区（回应"谁来改、从哪改"）
    var ownerHtml = '';
    if (mine) {
      var actionBtn = isDone
        ? '<button class="btn btn-ghost btn-block" id="reopenBtn">↩️ 撤销结束状态（重新开放联系）</button>'
        : '<button class="btn btn-ok btn-block" id="finishBtn">' +
          (isLost ? '✅ 物品已找到，结束这条寻物' : '✅ 物品已归还，结束这条招领') + '</button>';
      ownerHtml =
        '<div class="owner-card">' +
        '  <div class="oc-title">🔧 发布者管理（仅你可见）</div>' +
        '  <div class="oc-sub">物品' + (isLost ? '找到' : '归还') +
        '后请及时更新状态，其他同学将在列表和详情页看到结果，避免重复询问。</div>' +
        '  <div class="oc-actions">' + actionBtn + '</div>' +
        '</div>';
    }

    view.innerHTML =
      gallery +
      doneBanner +
      '<div class="detail-card">' +
      '  <div class="detail-title-row">' + typeTag(it) + statusTag(it) + '<h2>' + U.escapeHtml(it.name) + '</h2></div>' +
      '  <div class="detail-bizno">编号：' + U.escapeHtml(it.bizNo) + '</div>' +
      '  <div class="info-grid">' +
      '    <div class="info-row"><span class="k">物品分类</span><span class="v">' + U.escapeHtml(it.category) + '</span></div>' +
      '    <div class="info-row"><span class="k">' + (isLost ? '丢失地点' : '拾到地点') + '</span><span class="v">📍 ' + U.escapeHtml(it.location) + '</span></div>' +
      '    <div class="info-row"><span class="k">' + (isLost ? '丢失时间' : '拾到时间') + '</span><span class="v">' + U.formatTime(it.happenTime) + '</span></div>' +
      '    <div class="info-row"><span class="k">发布时间</span><span class="v">' + U.formatTime(it.createTime) + '</span></div>' +
      (it.description ? '<div class="info-row desc-block"><span class="k">物品描述</span><div class="v"><div class="desc-text">' + U.escapeHtml(it.description) + '</div></div></div>'
                        : '<div class="info-row"><span class="k">物品描述</span><span class="v" style="color:var(--light)">发布者未填写</span></div>') +
      '  </div>' +
      '</div>' +
      '<div class="detail-card">' + contactHtml + '</div>' +
      ownerHtml;

    U.$('#detailBack').addEventListener('click', function () { history.back(); });

    var copyBtn = U.$('#copyContact');
    if (copyBtn) copyBtn.addEventListener('click', function () {
      U.copyText(it.contact).then(function () { toast('联系方式已复制'); }, function () { toast('复制失败，请长按手动复制'); });
    });

    // 多图滑动切换
    if (imgs.length > 1) {
      var idx = 0;
      var gImg = U.$('#galleryImg');
      var counter = U.$('#gCounter');
      var startX = null;
      var gEl = U.$('.detail-gallery');
      gEl.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; });
      gEl.addEventListener('touchend', function (e) {
        if (startX == null) return;
        var dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 40) {
          idx = (idx + (dx < 0 ? 1 : -1) + imgs.length) % imgs.length;
          gImg.src = imgs[idx];
          counter.textContent = (idx + 1) + ' / ' + imgs.length;
        }
        startX = null;
      });
      gImg.style.cursor = 'pointer';
      gImg.addEventListener('click', function () {
        idx = (idx + 1) % imgs.length;
        gImg.src = imgs[idx];
        counter.textContent = (idx + 1) + ' / ' + imgs.length;
      });
    }

    var finishBtn = U.$('#finishBtn');
    if (finishBtn) finishBtn.addEventListener('click', function () {
      var word = isLost ? '已找到' : '已归还';
      openSheet({
        title: '确认标记为「' + word + '」？',
        content: '标记后信息将显示为已完结，其他同学可看到结果，联系方式将对他人暂时收起。',
        okText: '确认' + word,
        onOk: function () {
          S.updateStatus(it.id, U.STATUS_DONE);
          toast('已更新状态：' + word);
          renderDetail(it.id);
        }
      });
    });

    var reopenBtn = U.$('#reopenBtn');
    if (reopenBtn) reopenBtn.addEventListener('click', function () {
      S.updateStatus(it.id, U.STATUS_DOING);
      toast('已撤销，信息重新开放');
      renderDetail(it.id);
    });
  }

  /* ---------------- 我的发布 ---------------- */

  function renderMine() {
    var items = S.getMyItems();
    var body = items.length ? items.map(function (it) {
      var isDone = it.status === U.STATUS_DONE;
      var btn = isDone
        ? '<button class="btn btn-ghost btn-sm" data-reopen="' + it.id + '">撤销完结</button>'
        : '<button class="btn btn-ok btn-sm" data-finish="' + it.id + '">' +
          (it.type === U.TYPE_LOST ? '标记已找到' : '标记已归还') + '</button>';
      return '<div class="mine-item">' +
        '  <div class="mi-main" data-go-detail="' + it.id + '">' +
        '    <div class="item-thumb"><img src="' + thumbSrc(it) + '" alt=""></div>' +
        '    <div class="mi-body">' +
        '      <div class="mi-name">' + U.escapeHtml(it.name) + '</div>' +
        '      <div class="mi-no">' + U.escapeHtml(it.bizNo) + ' · ' + U.fromNow(it.createTime) + '发布</div>' +
        '      <div class="item-foot" style="padding-top:6px">' + typeTag(it) + statusTag(it) + '</div>' +
        '    </div>' +
        '  </div>' +
        '  <div class="mi-actions">' + btn + '</div>' +
        '</div>';
    }).join('') : emptyHtml('你还没有发布过信息', '丢了东西或捡到物品，都可以在这里发布',
      '<button class="btn btn-primary btn-sm" id="minePublish">立即发布</button>');

    view.innerHTML =
      '<header class="appbar"><h1>我的发布</h1></header>' +
      '<div class="list">' + body + '</div>';

    var mp = U.$('#minePublish');
    if (mp) mp.addEventListener('click', function () { location.hash = '#/publish'; });

    bindCardJump(view);

    U.$all('[data-finish]', view).forEach(function (b) {
      b.addEventListener('click', function () {
        var item = S.getItem(b.getAttribute('data-finish'));
        if (!item) return;
        var word = item.type === U.TYPE_LOST ? '已找到' : '已归还';
        openSheet({
          title: '确认标记为「' + word + '」？',
          content: '标记后其他同学将在首页和详情页看到完结结果。',
          okText: '确认' + word,
          onOk: function () {
            S.updateStatus(item.id, U.STATUS_DONE);
            toast('已更新状态：' + word);
            renderMine();
          }
        });
      });
    });
    U.$all('[data-reopen]', view).forEach(function (b) {
      b.addEventListener('click', function () {
        S.updateStatus(b.getAttribute('data-reopen'), U.STATUS_DOING);
        toast('已撤销完结状态');
        renderMine();
      });
    });
  }

  /* ---------------- 路由 ---------------- */

  var TABBED = { '#/home': 0, '#/search': 1, '#/publish': 2, '#/mine': 3 };

  function parseHash() {
    var h = location.hash || '#/home';
    var path = h.split('?')[0];
    var query = {};
    if (h.indexOf('?') >= 0) {
      h.split('?')[1].split('&').forEach(function (pair) {
        var kv = pair.split('=');
        query[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
      });
    }
    return { path: path, query: query };
  }

  function renderRoute() {
    view.scrollTop = 0;
    var r = parseHash();
    var tabIndex = TABBED[r.path];
    var isTabbed = tabIndex !== undefined;

    document.body.classList.toggle('hide-tabbar', !isTabbed);
    view.classList.toggle('no-tabbar', !isTabbed);

    // 底部导航高亮
    U.$all('.tab', tabbar).forEach(function (t, i) { t.classList.toggle('on', i === tabIndex); });

    switch (r.path) {
      case '#/home': renderHome(); break;
      case '#/search': renderSearch(); break;
      case '#/publish':
        // 每次进入发布页重置草稿图片（保留类型选择）
        state.formImages = [];
        renderPublish();
        break;
      case '#/success': renderSuccess(r.query.id); break;
      case '#/detail': renderDetail(r.query.id); break;
      case '#/mine': renderMine(); break;
      default: location.hash = '#/home';
    }
  }

  // 底部导航点击
  tabbar.addEventListener('click', function (e) {
    var tab = e.target.closest('.tab[data-route]');
    if (tab) location.hash = tab.getAttribute('data-route');
  });

  window.addEventListener('hashchange', renderRoute);

  /* ---------------- 启动 ---------------- */
  S.init();
  if (!location.hash) location.hash = '#/home';
  renderRoute();
})();
