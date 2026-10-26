/* =========================================================================
 * i18n.js — 中 / 英双语
 *
 * 用法：
 *   · 长段落用 <div class="lang-zh"> / <div class="lang-en"> 包起来，切换时显隐；
 *   · 短字符串用 data-i18n="key" 标注，切换时替换 textContent；
 *   · 脚本里的动态文案用 window.PLD_I18N.t('key')。
 * ========================================================================= */
(function () {
  var DICT = {
    zh: {
      'nav.plot': '绘图', 'nav.format': '数据格式', 'nav.theory': '数学原理',
      'nav.data': '文章数据集', 'nav.about': '引用 &amp; 参考文献', 'nav.paper': '原文 (SCPMA)',
      'hero.title': '把你的瞬变事件序列，放进随机性–混沌相空间',

      'sec.upload': '1 · 上传数据（可多选）',
      'sec.manual': '2 · 手动输入 / 粘贴', 'sec.params': '3 · 计算参数',
      'btn.selectall': '全选', 'btn.selectnone': '清空',
      'btn.sample': '填入示例', 'btn.add': '加入数据集',
      'btn.run': '计算待算数据集', 'btn.reset': '恢复默认',
      'btn.axis': '对齐文章坐标范围', 'btn.png': '导出 PNG（2×）', 'btn.csv': '导出 CSV',
      'btn.tpl': '下载模板 CSV', 'btn.example': '下载示例（FRB 20220912A）',

      'hint.upload': 'CSV 文件：第 1 列为时间（MJD），第 2 列为能量。支持一次选择多个文件，或直接把文件拖进来。',
      'hint.manual': '每行一条记录：<code>MJD, Energy</code>（也可用制表符或空格分隔）。',
      'hint.table': 'N 为差分后的序列长度（事件数 − 1）；PI 的误差为 100 次随机重排得到的标准差传播值。「能量定义」一列给出各序列所用的事件幅度 <i>E</i><sub><i>i</i></sub> 的含义。',
      'hint.table2': 'N 为差分后的序列长度（事件数 − 1）。PI 的误差为 100 次随机重排得到的标准差传播值。文章数据点的数值见下方「文章数据集」表。',
      'hint.empty': '尚未选择任何数据集',
      'hint.nouser': '尚未添加自定义数据；上传 CSV 或在左侧手动输入后会自动计算',

      'dz.drag': '拖拽文件到此处，或', 'dz.click': '点击选择',
      'dz.sub': '逗号、分号或空格分隔均可',

      'field.unit': '新数据的时间单位', 'field.name': '数据集名称',
      'field.gap': '观测段切分阈值 <i>Δt</i>（秒）', 'field.mode': '取用方式',
      'field.shuffle': 'Monte-Carlo 重排次数', 'field.seed': '随机种子',
      'opt.mjd': 'MJD（天）— 推荐', 'opt.second': '秒（任务经过时 / 相对时标）',
      'opt.busiest': '最活跃观测段（文章默认）', 'opt.all': '全部事件合并',
      'small.unit': '对本次上传与手动输入的数据生效；MJD 会先 × 86400 换算成秒再计算等待时间',
      'small.gap': '相邻事件间隔超过该值即划分为新的观测段（文章取 36000 s = 10 h）',
      'small.mode': '对上传／手填数据生效；内置源沿用文章既定的处理方式（全部事件 / 经纬网格分组 / 逐观测段 KDE）',
      'small.shuffle': 'PI 的分母由打乱序列得到；次数越多越稳，耗时越长（文章取 100）',
      'small.seed': '固定种子 ⇒ 结果可复现',

      'chk.labels': '显示标签', 'chk.errbars': '误差棒', 'chk.kde': '20240114A 的 KDE',
      'plot.title': 'Pincus–Lyapunov 图', 'result.title': '我的数据 · 计算结果',
      'axis_x': 'Pincus Index', 'axis_y': 'Lyapunov Exponent',

      'table.src': '源', 'table.pi': 'Pincus Index',
      'table.le': 'Lyapunov Exp.', 'table.note': '说明', 'table.seg': '处理方式',
      'table.inst': '望远镜 / 设备', 'table.egu': '能量定义',
      'note.local': '<b>计算在浏览器本地完成</b>，数据不会上传到任何服务器。大数据集（N ≳ 2000）可能需要十几秒到数十秒。',

      'format.title': '数据格式说明', 'theory.title': '数学原理',
      'data.title': '文章数据集与数据来源', 'about.title': '引用 &amp; 参考文献',
      'data.dstitle': '文章内置数据集', 'data.dssub': '取值来源：figure1.pdf 矢量坐标',
      'data.csv': 'CSV',
      'data.srctitle': '数据来源',
      'data.srchint': '引用这些数据时请同时引用上述数据集（Science Data Bank）与文章本身。',
      'data.download': '下载',


      'status.article': '文章发表值', 'status.ref': '站内 CSV 复算值',
      'status.ok': '已复算', 'status.pending': '待计算', 'status.error': '计算失败',
      'status.issue': '数据待补', 'status.computing': '计算中…',
      'badge.article': '文章值', 'badge.recomputed': '复算值', 'badge.issue': '数据待补',
      'badge.sec': '秒',

      'seg.busiest': '最活跃观测段', 'seg.all': '全部事件', 'seg.glitch': '全部 glitch 事件',
      'seg.grid': '2° × 2° 经纬网格分组', 'seg.sessions': '逐观测段 KDE', 'seg.paper': '文章发表值',
      'note.noref': '缺少参考值', 'note.recalcfmt': '站内数据复算 · ',
      'group.user': '自定义',

      'btn.compute': '计算', 'btn.axis.on': '恢复自适应范围',
      'status.done': '已计算', 'my.data': '我的数据',
      'count.datasets': '{n} 个数据集', 'hint.nosel': '未选择数据集',

      'note.kdepoints': 'KDE 密度峰值（{n} 个观测段）',
      'note.pending': '待计算', 'note.pendingmanual': '待计算 · 手动输入',
      'note.pendingfile': '待计算 · {n} 条事件', 'note.header': '（表头：{h}）',
      'note.computing': '计算中…', 'note.cancel': '已取消（预计耗时 {d}）',
      'note.segkde': '{n} 个观测段的 KDE 峰值',
      'note.noseg': '没有足够长的观测段（每段至少 30 个事件）',
      'note.recalcpi': '复算 PI={pi} / LE={le}（与图上值差 ΔPI={dpi}，ΔLE={dle}）',
      'note.fail': '计算失败', 'note.plain': '{seg}',
      'note.failmsg': '计算失败：{msg}',
      'note.recalcfull': '站内数据复算 · {seg}',
      'note.pendingfilehdr': '待计算 · {n} 条事件（表头：{h}）',
      'seg.info.busiest': '最活跃观测段（{c}/{n} 个事件，共 {s} 段）',
      'seg.info.all': '全部事件（{n}）',
      'err.few': '有效数据点不足（差分后 N = {n}），至少需要 30 个点才能得到可靠的 PI / LE。',
      'err.lyap': 'Lyapunov 指数计算失败：序列太短或缺少足够的近邻（建议 N ≥ 30）。',
      'warn.empty': '文件为空',
      'warn.skipped': '已跳过 {n} 行无法解析的数据',

      'prog.session': '观测段 {i}/{n}', 'prog.wait': '等待时间序列', 'prog.energy': '能量序列',
      'dl.events': '{n} 条事件 · MJD {a} – {b}',
      'dl.eventsunit': '{n} 条事件 · 单位 {u}',
      'unit.mjd': 'MJD', 'unit.sec': '秒',
      'dur.sec': '{n} 秒', 'dur.min': '{n} 分钟', 'dur.hour': '{n} 小时',

      'alert.nopending': '没有待计算的数据集。上传 CSV 或在左侧手动输入后，数据会自动进入待计算队列。',
      'alert.norows': '没有可导出的数据集',
      'alert.few': '有效数据点不足（解析到 {n} 条），至少需要 8 条事件（建议 ≥ 30 条）。\n{w}',
      'alert.fewfile': '文件 {f} 有效数据点不足（{n} 条）。\n{w}',
      'confirm.seg': '（{n} 个观测段）',
      'confirm.slow': '「{name}」{seg}预计需要约 {dur}。\n\n· 序列越长，PI 的代价按 N² 增长（当前 N = {n}）；\n· 想更快：改用“最活跃观测段”、或把 Monte-Carlo 重排次数降到 20–50；\n· 计算期间请保持页面打开。\n\n仍要继续吗？',
      'confirm.big': '「{name}」约 {mb} MB，浏览器解析和计算都可能很慢。\n建议先把数据裁剪到关注的观测段，或选用“最活跃观测段”模式。\n\n仍要加载吗？',

      'tip.remove': '移除',

      'dl.cols': 'N = {n} 行', 'tip.pi': 'PI', 'tip.le': 'LE', 'tip.n': 'N',
      'foot.local': '计算全部在本地浏览器完成'
    },

    en: {
      'nav.plot': 'Plot', 'nav.format': 'Data format', 'nav.theory': 'Theory',
      'nav.data': 'Data sets', 'nav.about': 'Reference &amp; citation', 'nav.paper': 'Paper (SCPMA)',
      'hero.title': 'Put your transient-event series into the stochasticity–chaos plane',

      'sec.upload': '1 · Upload data (multiple files allowed)',
      'sec.manual': '2 · Type or paste data', 'sec.params': '3 · Parameters',
      'btn.selectall': 'Select all', 'btn.selectnone': 'Clear',
      'btn.sample': 'Fill example', 'btn.add': 'Add data set',
      'btn.run': 'Compute pending sources', 'btn.reset': 'Reset',
      'btn.axis': 'Match the paper axis range', 'btn.png': 'Export PNG (2×)',
      'btn.csv': 'Export CSV', 'btn.tpl': 'Download CSV template',
      'btn.example': 'Download example (FRB 20220912A)',

      'hint.upload': 'CSV files: column 1 = time (MJD), column 2 = energy. Select several files at once, or drag them in.',
      'hint.manual': 'One record per line: <code>MJD, Energy</code> (tabs or spaces also work).',
      'hint.table': 'N is the length of the differenced series (events − 1). The PI error is propagated from the standard deviation over 100 random shuffles. The <i>energy definition</i> column gives the meaning of the event amplitude <i>E</i><sub><i>i</i></sub> used for each series.',
      'hint.empty': 'No data set selected yet',
      'hint.table2': 'N is the length of the differenced series (events - 1). The PI error is propagated from the standard deviation over 100 random shuffles. Values for the published points are listed in the data-set table below.',
      'hint.nouser': 'No custom data yet - upload a CSV or type values in the left panel and they will be computed automatically',

      'dz.drag': 'Drag files here, or', 'dz.click': 'browse',
      'dz.sub': 'comma, semicolon or whitespace delimited',

      'field.unit': 'Time unit of new data', 'field.name': 'Data set name',
      'field.gap': 'Session-splitting threshold <i>Δt</i> (s)', 'field.mode': 'Which events to use',
      'field.shuffle': 'Monte-Carlo shuffles', 'field.seed': 'Random seed',
      'opt.mjd': 'MJD (days) — recommended', 'opt.second': 'Seconds (mission elapsed / relative time)',
      'opt.busiest': 'Most active session (paper default)', 'opt.all': 'All events combined',
      'small.unit': 'Applies to uploaded and hand-typed data; MJD is multiplied by 86400 to obtain waiting times in seconds',
      'small.gap': 'A gap larger than this starts a new observing session (the paper uses 36000 s = 10 h)',
      'small.mode': 'Applies to uploaded / typed data; built-in sources keep the treatment used in the paper (all events / lon–lat cells / per-session KDE)',
      'small.shuffle': 'The PI denominator comes from shuffled series; more shuffles are steadier but slower (the paper uses 100)',
      'small.seed': 'A fixed seed makes the result reproducible',

      'chk.labels': 'Labels', 'chk.errbars': 'Error bars', 'chk.kde': 'KDE of 20240114A',
      'plot.title': 'Pincus–Lyapunov diagram', 'result.title': 'My data - Results',
      'axis_x': 'Pincus Index', 'axis_y': 'Lyapunov Exponent',

      'table.src': 'Source', 'table.pi': 'Pincus Index',
      'table.le': 'Lyapunov Exp.', 'table.note': 'Note', 'table.seg': 'Treatment',
      'table.inst': 'Telescope / instrument', 'table.egu': 'Energy definition',
      'note.local': '<b>All computation happens locally in your browser</b>; nothing is uploaded. Large data sets (N ≳ 2000) may take tens of seconds.',

      'format.title': 'Data format', 'theory.title': 'Theory',
      'data.title': 'Data sets from the paper and provenance', 'about.title': 'Reference &amp; citation',
      'data.dstitle': 'Data sets from the paper', 'data.dssub': 'values from the vector coordinates of figure1.pdf',
      'data.csv': 'CSV',
      'data.srctitle': 'Data provenance',
      'data.srchint': 'When using these data, please cite both the data set (Science Data Bank) and the article.',
      'data.download': 'Download',


      'status.article': 'Published value', 'status.ref': 'Recomputed from bundled CSV',
      'status.ok': 'Recomputed', 'status.pending': 'Pending', 'status.error': 'Failed',
      'status.issue': 'Data missing', 'status.computing': 'Computing…',
      'badge.article': 'published', 'badge.recomputed': 'recomputed',
      'badge.issue': 'data missing', 'badge.sec': 'seconds',

      'seg.busiest': 'most active session', 'seg.all': 'all events',
      'seg.glitch': 'all glitch events', 'seg.grid': '2° × 2° lon–lat cells',
      'seg.sessions': 'per-session KDE', 'seg.paper': 'published value',
      'note.noref': 'no reference value', 'note.recalcfmt': 'recomputed · ',
      'group.user': 'User data',

      'btn.compute': 'Compute', 'btn.axis.on': 'Restore auto range',
      'status.done': 'Computed', 'my.data': 'My data',
      'count.datasets': '{n} data sets', 'hint.nosel': 'No data set selected',

      'note.kdepoints': 'KDE density peak ({n} sessions)',
      'note.pending': 'Pending', 'note.pendingmanual': 'Pending · typed in',
      'note.pendingfile': 'Pending · {n} events', 'note.header': ' (header: {h})',
      'note.computing': 'Computing…', 'note.cancel': 'Cancelled (estimated {d})',
      'note.segkde': 'KDE peak of {n} sessions',
      'note.noseg': 'No session is long enough (at least 30 events each)',
      'note.recalcpi': 'recomputed PI={pi} / LE={le} (ΔPI={dpi}, ΔLE={dle} from the plotted value)',
      'note.fail': 'Computation failed', 'note.plain': '{seg}',
      'note.failmsg': 'Computation failed: {msg}',
      'note.recalcfull': 'recomputed · {seg}',
      'note.pendingfilehdr': 'Pending · {n} events (header: {h})',
      'seg.info.busiest': 'most active session ({c}/{n} events, {s} sessions)',
      'seg.info.all': 'all events ({n})',
      'err.few': 'Not enough valid points (N = {n} after differencing); at least 30 points are needed for a reliable PI / LE.',
      'err.lyap': 'Lyapunov exponent failed: the series is too short or lacks enough neighbours (N ≥ 30 recommended).',
      'warn.empty': 'the file is empty',
      'warn.skipped': 'skipped {n} unparsable rows',

      'prog.session': 'session {i}/{n}', 'prog.wait': 'waiting-time series', 'prog.energy': 'energy series',
      'dl.events': '{n} events · MJD {a} – {b}',
      'dl.eventsunit': '{n} events · unit {u}',
      'unit.mjd': 'MJD', 'unit.sec': 'seconds',
      'dur.sec': '{n} s', 'dur.min': '{n} min', 'dur.hour': '{n} h',

      'alert.nopending': 'Nothing to compute. Upload a CSV or type values in the left panel - they enter the queue automatically.',
      'alert.norows': 'No data set to export',
      'alert.few': 'Not enough valid points ({n} parsed); at least 8 events are required (≥ 30 recommended).\n{w}',
      'alert.fewfile': 'File {f} has too few valid points ({n}).\n{w}',
      'confirm.seg': ' ({n} sessions)',
      'confirm.slow': '“{name}”{seg} will take about {dur}.\n\n· PI scales as N² with series length (current N = {n});\n· to speed it up, use the most active session or lower the Monte-Carlo shuffles to 20–50;\n· keep this page open while computing.\n\nContinue anyway?',
      'confirm.big': '“{name}” is about {mb} MB; parsing and computing in the browser may be very slow.\nConsider trimming the data to the sessions of interest, or use the “most active session” mode.\n\nLoad it anyway?',

      'tip.remove': 'Remove',

      'dl.cols': 'N = {n} rows', 'tip.pi': 'PI', 'tip.le': 'LE', 'tip.n': 'N',
      'foot.local': 'Everything is computed locally in your browser'
    }
  };

  var LANG = 'zh';

  function t(key, vars) {
    var d = DICT[LANG] || DICT.zh;
    var s = d[key];
    if (s == null) s = (DICT.zh[key] != null ? DICT.zh[key] : key);
    if (vars) Object.keys(vars).forEach(function (k) {
      s = s.split('{' + k + '}').join(vars[k]);
    });
    return s;
  }

  function apply(lang) {
    LANG = (lang === 'en') ? 'en' : 'zh';
    document.documentElement.lang = (LANG === 'zh') ? 'zh-CN' : 'en';

    // 长段落：显隐
    Array.prototype.forEach.call(document.querySelectorAll('.lang-zh'), function (n) {
      n.hidden = (LANG !== 'zh');
    });
    Array.prototype.forEach.call(document.querySelectorAll('.lang-en'), function (n) {
      n.hidden = (LANG !== 'en');
    });

    // 短字符串：替换文本（部分条目内含 <i>/<code>/<b>，因此用 innerHTML）
    Array.prototype.forEach.call(document.querySelectorAll('[data-i18n]'), function (n) {
      var v = t(n.getAttribute('data-i18n'));
      if (v != null) n.innerHTML = v;
    });

    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      b.classList.toggle('is-on', b.getAttribute('data-lang') === LANG);
    });

    try { localStorage.setItem('pld-lang', LANG); } catch (e) { /* file:// 下可能不可用 */ }
    document.dispatchEvent(new CustomEvent('pld:langchange', { detail: { lang: LANG } }));
  }

  function init() {
    var saved = null;
    try { saved = localStorage.getItem('pld-lang'); } catch (e) { /* noop */ }
    Array.prototype.forEach.call(document.querySelectorAll('.lang-btn'), function (b) {
      b.addEventListener('click', function () { apply(b.getAttribute('data-lang')); });
    });
    apply(saved || 'zh');
  }

  window.PLD_I18N = { t: t, apply: apply, init: init, dict: DICT,
    get lang() { return LANG; } };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
