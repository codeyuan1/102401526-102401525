/* ============================================================
 * storage.js —— 数据持久化层（localStorage）
 * 依赖：utils.js
 * 挂载到 window.Store
 *
 * 数据全部保存在浏览器 localStorage，无需后端服务器，
 * 用 Chrome 直接打开 index.html 即可读写。
 * ============================================================ */
(function (global) {
  'use strict';

  var U = global.Utils;
  var KEY_ITEMS = 'lf_items_v1';    // 全部信息
  var KEY_MYIDS = 'lf_my_ids_v1';   // 本机（当前用户）发布的信息 id
  var KEY_SEQ = 'lf_seq_v1';        // 编号自增序列

  /* ---------- 底层读写 ---------- */

  function read(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      // 一般是存储空间不足（图片过大）
      alert('数据保存失败：本地存储空间不足，请减少图片数量或更换更小的图片。');
      return false;
    }
  }

  /* ---------- 示例数据 ----------
   * 时间相对当前时间生成，保证任何时候打开都像"最近发布"。
   */
  function seedItems() {
    var now = Date.now();
    var H = 3600 * 1000, D = 24 * H;
    // 辅助：生成一条信息
    function mk(cfg) {
      var happen = new Date(now - cfg.agoHappen * H);
      var create = new Date(now - cfg.agoCreate * H);
      return {
        id: cfg.id,
        bizNo: U.bizNo(cfg.type, happen, cfg.seq),
        type: cfg.type,
        status: cfg.status,
        name: cfg.name,
        category: cfg.category,
        location: cfg.location,
        happenTime: happen.toISOString(),
        description: cfg.description,
        contactName: cfg.contactName,
        contact: cfg.contact,
        images: [],                 // 示例数据使用分类 SVG 配图
        createTime: create.toISOString()
      };
    }

    var items = [
      mk({
        id: 'seed-01', seq: 1, type: U.TYPE_FOUND, status: U.STATUS_DOING,
        name: '校园卡一张（尾号 2617）', category: '证件',
        location: '第二食堂一楼 3 号窗口', agoHappen: 20, agoCreate: 19,
        description: '今天中午在第二食堂一楼捡到一张校园卡，卡面贴着小熊贴纸，已交到食堂服务台，失主请联系我核对信息。',
        contactName: '张同学', contact: '13912340001'
      }),
      mk({
        id: 'seed-02', seq: 2, type: U.TYPE_LOST, status: U.STATUS_DOING,
        name: '黑色自动折叠伞', category: '雨具',
        location: '图书馆三楼自习区靠窗座位', agoHappen: 26, agoCreate: 24,
        description: '昨晚在图书馆三楼靠窗位置落下一把黑色自动折叠伞，伞柄有磨损痕迹，伞套边缘有一圈蓝色缝线。下雨天全靠它，捡到的同学麻烦联系我，非常感谢！',
        contactName: '刘同学', contact: 'liu_umbrella（微信）'
      }),
      mk({
        id: 'seed-03', seq: 3, type: U.TYPE_FOUND, status: U.STATUS_DOING,
        name: '一串钥匙（带棕色小熊挂件）', category: '钥匙',
        location: '文科楼 2 层走廊饮水机旁', agoHappen: 30, agoCreate: 28,
        description: '钥匙共 4 把，含一个蓝色门禁卡套和棕色小熊挂件，在文科楼二楼饮水机旁捡到。',
        contactName: '王同学', contact: 'wxid_xh2026（微信）'
      }),
      mk({
        id: 'seed-04', seq: 4, type: U.TYPE_LOST, status: U.STATUS_DOING,
        name: 'AirPods Pro 耳机（含充电盒）', category: '数码',
        location: '操场东看台附近', agoHappen: 8, agoCreate: 6,
        description: '今天下午在操场跑步时遗落 AirPods Pro 一副，充电盒上有刻字缩写，提供准确特征即可认领，重谢！',
        contactName: '陈同学', contact: '13900001234'
      }),
      mk({
        id: 'seed-05', seq: 5, type: U.TYPE_FOUND, status: U.STATUS_DOING,
        name: '《高等数学（上册）》课本', category: '书籍',
        location: '教三 302 教室倒数第二排', agoHappen: 46, agoCreate: 44,
        description: '教三 302 教室捡到《高等数学（上册）》，扉页有名字被涂掉了，书内夹着几张高数作业纸。',
        contactName: '赵同学', contact: 'math_lover（微信）'
      }),
      mk({
        id: 'seed-06', seq: 6, type: U.TYPE_LOST, status: U.STATUS_DOING,
        name: '黑色双肩背包', category: '箱包',
        location: '计算机学院楼一楼大厅沙发', agoHappen: 5, agoCreate: 4,
        description: '背包内有笔记本电脑充电器、实验报告和一个灰色水杯，对我很重要，拾到者请喝奶茶！',
        contactName: '郑同学', contact: 'zheng_bp（微信）'
      }),
      mk({
        id: 'seed-07', seq: 7, type: U.TYPE_FOUND, status: U.STATUS_DOING,
        name: '白色保温杯（杯底有贴纸）', category: '生活用品',
        location: '第一食堂二楼', agoHappen: 22, agoCreate: 21,
        description: '白色保温杯一个，杯底贴有星星贴纸，暂时放在第一食堂二楼收餐处。',
        contactName: '杨同学', contact: '13912340007'
      }),
      mk({
        id: 'seed-08', seq: 8, type: U.TYPE_LOST, status: U.STATUS_DOING,
        name: '小米手环 8', category: '数码',
        location: '体育馆羽毛球场 3 号场', agoHappen: 32, agoCreate: 30,
        description: '昨晚打羽毛球时摘下来忘在 3 号场边，黑色表带，表盘有轻微划痕。',
        contactName: '孙同学', contact: 'sunband2026（微信）'
      }),
      mk({
        id: 'seed-09', seq: 9, type: U.TYPE_FOUND, status: U.STATUS_DONE,
        name: '深蓝色钱包（内含学生证）', category: '箱包',
        location: '行政楼门口台阶处', agoHappen: 70, agoCreate: 68,
        description: '在行政楼门口捡到深蓝色钱包，内有学生证和少量现金。已联系到失主本人，当面核对后归还。',
        contactName: '周同学', contact: 'zhouwx（微信）'
      }),
      mk({
        id: 'seed-10', seq: 10, type: U.TYPE_LOST, status: U.STATUS_DONE,
        name: '金色石英手表', category: '其他',
        location: '图书馆二楼还书处', agoHappen: 96, agoCreate: 94,
        description: '金色表盘石英手表，在图书馆二楼还书附近遗失。已被好心人交到服务台，凭描述成功领回，谢谢大家！',
        contactName: '吴同学', contact: '13700005678'
      })
    ];
    return items;
  }

  /* ---------- 初始化 ---------- */

  function init() {
    if (!localStorage.getItem(KEY_ITEMS)) {
      write(KEY_ITEMS, seedItems());
      // 预置两条"我发布的"信息，方便直接体验状态更新流程
      write(KEY_MYIDS, ['seed-01', 'seed-02']);
      write(KEY_SEQ, 10);
    }
  }

  // 恢复示例数据（清空我发布的测试数据）
  function resetData() {
    write(KEY_ITEMS, seedItems());
    write(KEY_MYIDS, ['seed-01', 'seed-02']);
    write(KEY_SEQ, 10);
  }

  /* ---------- 查询 ---------- */

  function getItems() { return read(KEY_ITEMS, []); }

  function getItem(id) {
    var items = getItems();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) return items[i];
    }
    return null;
  }

  function getMyIds() { return read(KEY_MYIDS, []); }

  function isMine(id) { return getMyIds().indexOf(id) >= 0; }

  function getMyItems() {
    var ids = getMyIds();
    return getItems().filter(function (it) { return ids.indexOf(it.id) >= 0; })
      .sort(function (a, b) {
        return new Date(b.createTime).getTime() - new Date(a.createTime).getTime();
      });
  }

  /* ---------- 新增 ---------- */

  // data 为表单数据；返回新信息对象（含生成的编号、状态等），失败返回 null
  function addItem(data) {
    var items = getItems();
    var seq = (read(KEY_SEQ, items.length) || 0) + 1;
    var now = new Date();
    var item = {
      id: U.uid(),
      bizNo: U.bizNo(data.type, now, seq),
      type: data.type,
      status: U.STATUS_DOING,
      name: String(data.name).trim(),
      category: data.category,
      location: String(data.location).trim(),
      happenTime: new Date(data.happenTime).toISOString(),
      description: String(data.description || '').trim(),
      contactName: String(data.contactName).trim(),
      contact: String(data.contact).trim(),
      images: Array.isArray(data.images) ? data.images : [],
      createTime: now.toISOString()
    };
    items.push(item);
    if (!write(KEY_ITEMS, items)) return null;
    write(KEY_SEQ, seq);
    var myIds = getMyIds();
    myIds.push(item.id);
    write(KEY_MYIDS, myIds);
    return item;
  }

  /* ---------- 状态更新（核心：已找到 / 已归还 / 撤销） ---------- */

  // status: 'doing' | 'done'
  function updateStatus(id, status) {
    if (status !== U.STATUS_DOING && status !== U.STATUS_DONE) return false;
    var items = getItems();
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i].status = status;
        write(KEY_ITEMS, items);
        return true;
      }
    }
    return false;
  }

  // 统计（首页数字）
  function getStats() {
    var items = getItems();
    var lost = 0, found = 0, done = 0;
    items.forEach(function (it) {
      if (it.type === U.TYPE_LOST) lost++; else found++;
      if (it.status === U.STATUS_DONE) done++;
    });
    return { total: items.length, lost: lost, found: found, done: done };
  }

  global.Store = {
    init: init,
    resetData: resetData,
    getItems: getItems,
    getItem: getItem,
    getMyIds: getMyIds,
    isMine: isMine,
    getMyItems: getMyItems,
    addItem: addItem,
    updateStatus: updateStatus,
    getStats: getStats
  };
})(window);
