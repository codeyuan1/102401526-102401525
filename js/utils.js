/* ============================================================
 * utils.js —— 工具函数与可测试的纯业务逻辑
 * 依赖：无（可直接被单元测试页面引用）
 * 挂载到 window.Utils
 * ============================================================ */
(function (global) {
  'use strict';

  /* ---------- 常量 ---------- */

  // 启事类型
  var TYPE_LOST = 'lost';   // 寻物启事
  var TYPE_FOUND = 'found'; // 招领启事

  // 信息状态
  var STATUS_DOING = 'doing'; // 进行中（寻物：寻找中 / 招领：待认领）
  var STATUS_DONE = 'done';   // 已结束（寻物：已找到 / 招领：已归还）

  // 物品分类（与原型一致：箱包、证件、数码、生活用品、雨具、钥匙，补充书籍、其他）
  var CATEGORIES = ['箱包', '证件', '数码', '钥匙', '雨具', '书籍', '生活用品', '其他'];

  // 分类 -> 配图（assets 下的本地 SVG，离线可用）
  var CATEGORY_ICONS = {
    '箱包': 'assets/bag.svg',
    '证件': 'assets/card.svg',
    '数码': 'assets/headphones.svg',
    '钥匙': 'assets/key.svg',
    '雨具': 'assets/umbrella.svg',
    '书籍': 'assets/book.svg',
    '生活用品': 'assets/cup.svg',
    '其他': 'assets/watch.svg'
  };

  var MAX_IMAGES = 3; // 最多上传图片数（原型要求 3 张）

  var TYPE_TEXT = {};
  TYPE_TEXT[TYPE_LOST] = '寻物启事';
  TYPE_TEXT[TYPE_FOUND] = '招领启事';

  var STATUS_TEXT = {};
  STATUS_TEXT[TYPE_LOST] = { doing: '寻找中', done: '已找到' };
  STATUS_TEXT[TYPE_FOUND] = { doing: '待认领', done: '已归还' };

  /* ---------- DOM 与基础工具 ---------- */

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $all(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // 生成唯一 id
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function pad2(n) { return n < 10 ? '0' + n : '' + n; }

  // 生成信息编号：寻物 XW + yyyymmdd + 3 位序号；招领 ZL
  function bizNo(type, date, seq) {
    var d = date instanceof Date ? date : new Date(date);
    var ymd = d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
    return (type === TYPE_LOST ? 'XW' : 'ZL') + ymd + pad2(Math.min(99, seq));
  }

  // 把 ISO / datetime-local 字符串转成「yyyy-MM-dd HH:mm」
  function formatTime(input) {
    if (!input) return '';
    var d = new Date(input);
    if (isNaN(d.getTime())) return String(input);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  // 相对时间（刚刚 / n分钟前 / n小时前 / n天前）
  function fromNow(input) {
    var d = new Date(input).getTime();
    if (isNaN(d)) return '';
    var diff = Date.now() - d;
    if (diff < 0) return formatTime(input);
    var min = Math.floor(diff / 60000);
    if (min < 1) return '刚刚';
    if (min < 60) return min + ' 分钟前';
    var hour = Math.floor(min / 60);
    if (hour < 24) return hour + ' 小时前';
    var day = Math.floor(hour / 24);
    if (day < 7) return day + ' 天前';
    return formatTime(input).slice(0, 10);
  }

  // 当前时间，datetime-local 控件默认值
  function nowLocalInput() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  function debounce(fn, wait) {
    var t = null;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait || 200);
    };
  }

  // 判断字符串是否为手机号（用于显示「拨打」按钮）
  function isPhone(s) { return /^1[3-9]\d{9}$/.test(String(s || '').trim()); }

  /* ---------- 表单校验（发布信息） ----------
   * 返回 { valid: Boolean, errors: { 字段名: 提示文字 } }
   */
  function validateItem(data) {
    var errors = {};
    data = data || {};

    if (!data.name || !String(data.name).trim()) {
      errors.name = '请填写物品名称';
    } else if (String(data.name).trim().length > 30) {
      errors.name = '物品名称不能超过 30 个字';
    }

    if (data.type !== TYPE_LOST && data.type !== TYPE_FOUND) {
      errors.type = '请选择启事类型';
    }
    if (CATEGORIES.indexOf(data.category) < 0) {
      errors.category = '请选择物品分类';
    }
    if (!data.location || !String(data.location).trim()) {
      errors.location = '请填写地点';
    }
    if (!data.happenTime) {
      errors.happenTime = '请选择时间';
    } else if (isNaN(new Date(data.happenTime).getTime())) {
      errors.happenTime = '时间格式不正确';
    } else if (new Date(data.happenTime).getTime() > Date.now() + 60 * 60 * 1000) {
      errors.happenTime = '时间不能晚于当前时间';
    }
    if (!data.contactName || !String(data.contactName).trim()) {
      errors.contactName = '请填写联系人姓名';
    }
    if (!data.contact || !String(data.contact).trim()) {
      errors.contact = '请填写手机号或微信号';
    }
    if (data.description && String(data.description).length > 300) {
      errors.description = '物品描述不能超过 300 个字';
    }
    if (data.images && data.images.length > MAX_IMAGES) {
      errors.images = '最多上传 ' + MAX_IMAGES + ' 张图片';
    }

    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  /* ---------- 搜索 / 筛选（纯函数，单元测试重点） ----------
   * items: 信息数组
   * cond: { keyword: 关键词(匹配名称/地点/描述), type: lost|found|'' , category: 分类|'' }
   * 返回新数组，新发布在前
   */
  function filterItems(items, cond) {
    cond = cond || {};
    var kw = String(cond.keyword || '').trim().toLowerCase();
    var type = cond.type || '';
    var category = cond.category || '';

    var result = (items || []).filter(function (it) {
      if (type && it.type !== type) return false;
      if (category && it.category !== category) return false;
      if (kw) {
        var hay = [it.name, it.location, it.description, it.bizNo]
          .join(' ').toLowerCase();
        if (hay.indexOf(kw) < 0) return false;
      }
      return true;
    });

    // 按发布时间倒序；进行中的排在已结束前面
    return result.sort(function (a, b) {
      if ((a.status === 'doing') !== (b.status === 'doing')) {
        return a.status === 'doing' ? -1 : 1;
      }
      return new Date(b.createTime).getTime() - new Date(a.createTime).getTime();
    });
  }

  // 关键词是否命中单条信息
  function matchKeyword(item, keyword) {
    var kw = String(keyword || '').trim().toLowerCase();
    if (!kw) return true;
    return [item.name, item.location, item.description, item.bizNo]
      .join(' ').toLowerCase().indexOf(kw) >= 0;
  }

  /* ---------- 图片压缩（File/Blob -> 压缩后的 base64） ----------
   * 最大边 800px，JPEG 0.72，控制 localStorage 占用
   */
  function compressImage(file, maxSize) {
    maxSize = maxSize || 800;
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('请选择图片文件'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function (e) {
        var img = new Image();
        img.onload = function () {
          var w = img.width, h = img.height;
          if (w > maxSize || h > maxSize) {
            if (w >= h) { h = Math.round(h * maxSize / w); w = maxSize; }
            else { w = Math.round(w * maxSize / h); h = maxSize; }
          }
          var canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          // png 透明图保留 png，其余统一 jpeg 减小体积
          var mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          resolve(canvas.toDataURL(mime, 0.72));
        };
        img.onerror = function () { reject(new Error('图片读取失败')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('图片读取失败')); };
      reader.readAsDataURL(file);
    });
  }

  // 复制文本（带回退方案）
  function copyText(text) {
    return new Promise(function (resolve, reject) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(resolve, function () { fallback(); });
      } else { fallback(); }
      function fallback() {
        var ta = document.createElement('textarea');
        ta.value = text;
        // 360 等浏览器对完全透明元素会拦截复制，改为移出屏幕的可见元素
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        ta.style.top = '0';
        document.body.appendChild(ta);
        ta.focus();
        ta.setSelectionRange(0, ta.value.length);
        try { document.execCommand('copy') ? resolve() : reject(new Error('复制失败')); }
        catch (err) { reject(err); }
        document.body.removeChild(ta);
      }
    });
  }

  global.Utils = {
    TYPE_LOST: TYPE_LOST,
    TYPE_FOUND: TYPE_FOUND,
    STATUS_DOING: STATUS_DOING,
    STATUS_DONE: STATUS_DONE,
    CATEGORIES: CATEGORIES,
    CATEGORY_ICONS: CATEGORY_ICONS,
    MAX_IMAGES: MAX_IMAGES,
    TYPE_TEXT: TYPE_TEXT,
    STATUS_TEXT: STATUS_TEXT,
    $: $,
    $all: $all,
    escapeHtml: escapeHtml,
    uid: uid,
    bizNo: bizNo,
    formatTime: formatTime,
    fromNow: fromNow,
    nowLocalInput: nowLocalInput,
    debounce: debounce,
    isPhone: isPhone,
    validateItem: validateItem,
    filterItems: filterItems,
    matchKeyword: matchKeyword,
    compressImage: compressImage,
    copyText: copyText
  };
})(window);
