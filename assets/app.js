/* =========================================================================
 * app.js — 界面逻辑：数据集管理、计算调度、PLD 绘图、导出
 * ========================================================================= */
(function () {
  'use strict';

  const PLD = window.PLD;
  const GROUPS = window.PLD_GROUPS || [];
  const DATASETS = window.PLD_DATASETS || [];
  const REF = window.PLD_REFERENCE || null;
  const EMBEDDED = window.PLD_EMBEDDED || {};
  const USER_COLORS = window.PLD_USER_COLORS || [];

  const groupById = {};
  GROUPS.forEach(g => { groupById[g.id] = g; });

  /* ------------------------------ 状态 ------------------------------ */
  const state = {
    sources: [],          // 所有数据集（内置 / 上传 / 手动）
    userColorIdx: 0,
    axisLock: null,       // null = 自适应；否则 {x:[..], y:[..]}
    computing: false
  };

  let uid = 0;
  function nextId() { return 's' + (++uid); }

  let exportScale = 1;        // 导出高清 PNG 时临时设为 2

  /* ------------------------------ 语言 ------------------------------ */
  function t(key, vars) {
    return (window.PLD_I18N && window.PLD_I18N.t) ? window.PLD_I18N.t(key, vars) : key;
  }
  function lang() { return (window.PLD_I18N && window.PLD_I18N.lang) || 'zh'; }
  /** 按当前语言挑选中文 / 英文字段 */
  function pick(zh, en) { return (lang() === 'en' && en) ? en : zh; }
  /** 拼 HTML 前转义，避免文件名 / 描述里的 & < > " 破坏结构 */
  function esc(x) {
    return String(x == null ? '' : x)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  /** 组的显示名 */
  function gname(g) { return pick(g.label, g.en); }

  /* 说明文字一律存「键 + 变量」，渲染时才翻译，语言一切换就自动跟着变。
     变量值可以写成 { k: 'key', v: {...} } 表示再嵌套一层翻译。 */
  function resolveVars(vars) {
    if (!vars) return undefined;
    const out = {};
    Object.keys(vars).forEach(k => {
      const v = vars[k];
      out[k] = (v && typeof v === 'object' && v.k) ? t(v.k, resolveVars(v.v)) : v;
    });
    return out;
  }
  function setNote(s, key, vars) { s.noteKey = key; s.noteVars = vars || null; s.note = t(key, resolveVars(vars)); }
  function setDesc(s, key, vars) { s.descKey = key; s.descVars = vars || null; s.desc = t(key, resolveVars(vars)); }
  function noteOf(s) { return s.noteKey ? t(s.noteKey, resolveVars(s.noteVars)) : (s.note || ''); }
  function descOf(s) { return s.descKey ? t(s.descKey, resolveVars(s.descVars)) : (s.desc || ''); }

  /** 把 core 返回的 segmentInfo 拆成「键 + 变量」，这样切语言时也能跟着变 */
  function segVars(r) {
    const s = (r && r.segmentInfo) || '';
    let m = /busiest session \((\d+) of (\d+) events; (\d+) sessions\)/.exec(s);
    if (m) return { k: 'seg.info.busiest', v: { c: m[1], n: m[2], s: m[3] } };
    m = /all events \((\d+)\)/.exec(s);
    if (m) return { k: 'seg.info.all', v: { n: m[1] } };
    m = /kde of (\d+) sessions/.exec(s);
    if (m) return { k: 'note.segkde', v: { n: m[1] } };
    return null;
  }
  function setSegNote(s, r, wrapKey) {
    const sv = segVars(r);
    if (!sv) { setNote(s, 'note.plain', { seg: (r && r.segmentInfo) || '' }); return; }
    if (wrapKey) setNote(s, wrapKey, { seg: sv });
    else setNote(s, sv.k, sv.v);
  }

  /** pld-core 的解析告警也是中文，这里换成对应语言的文案 */
  function warnText(w) {
    const m = /已跳过 (\d+) 行/.exec(w);
    if (m) return t('warn.skipped', { n: m[1] });
    if (w === '文件为空') return t('warn.empty');
    return w;
  }
  function warnList(w) { return (w || []).map(warnText).join('\n'); }

  /** pld-core 的报错是中文，这里换成对应语言的文案 */
  function coreError(r) {
    if (!r || !r.error) return t('note.fail');
    if (/有效数据点不足/.test(r.error)) return t('err.few', { n: r.N });
    if (/Lyapunov/.test(r.error)) return t('err.lyap');
    return r.error;
  }

  function groupOf(id) {
    return groupById[id] || { label: t('group.user'), en: 'User data', color: '#333', marker: 'o' };
  }

  /* --------------------------- 内置数据集 --------------------------- */
  function initBuiltins() {
    DATASETS.forEach(ds => {
      const g = groupOf(ds.group);
      const ref = REF && REF.results ? REF.results[ds.key] : null;
      const art = window.PLD_ARTICLE ? window.PLD_ARTICLE[ds.key] : null;
      // 显示值优先取文章发表值（figure1.pdf），否则用站内数据复算值
      const useArt = art && isFinite(art.PI) && isFinite(art.LE);
      const hasRef = ref && isFinite(ref.PI) && isFinite(ref.LE);
      const hasVal = useArt || hasRef;
      const KD = window.PLD_KDE_240114;
      const s = {
        id: nextId(),
        kind: 'builtin',
        key: ds.key,
        name: ds.name,
        nameEn: ds.nameEn || ds.name,
        group: ds.group,
        color: ds.color || g.color,
        marker: ds.marker || g.marker,
        shift: ds.shift || [0, 0.0055],
        labelAlign: ds.labelAlign || 'center',
        desc: ds.desc,
        descEn: ds.descEn || ds.desc,
        extra: ds.extra,
        extraEn: ds.extraEn || ds.extra,
        issue: ds.issue || null,
        file: ds.file,
        raw: ds.raw || null,
        // 表格里的「望远镜 / 设备」与「能量定义」（取自文章 sect.2 与 Table 1）
        inst: ds.inst || '', instEn: ds.instEn || ds.inst || '',
        egu: ds.egu || '', eguEn: ds.eguEn || ds.egu || '',
        timeUnit: ds.timeUnit,
        segmentMode: (ds.segment === 'sessions' || ds.segment === 'all' || ds.segment === 'grid') ? 'all' : ds.segment,
        kde: !!ds.kde,
        selected: hasVal,
        visible: true,
        status: hasVal ? (useArt ? 'article' : 'ref') : (ds.issue ? 'issue' : 'pending'),
        PI: useArt ? art.PI : (hasRef ? ref.PI : NaN),
        PI_err: (useArt && art.PI_err != null) ? art.PI_err : (hasRef ? ref.PI_err : NaN),
        LE: useArt ? art.LE : (hasRef ? ref.LE : NaN),
        N: hasRef ? ref.N : NaN,
        recalc: hasRef ? { PI: ref.PI, PI_err: ref.PI_err, LE: ref.LE, N: ref.N } : null,
        valueSource: useArt ? 'article' : (hasRef ? 'recomputed' : null),
        noteKey: null, noteVars: null, note: '',
        data: null
      };
      if (useArt) setNote(s, segmentKey(ds));
      else if (hasRef) setNote(s, 'note.recalcfull', { seg: { k: segmentKey(ds) } });
      else setNote(s, 'note.noref');
      // 20240114A：图上画的是 KDE 密度峰值（与 notebook 一致），点云来自逐观测段的值
      if (s.kde && KD && KD.peak) {
        s.kdePoints = KD.points.map(p => [p[0], p[1]]);
        s.PI = KD.peak[0]; s.LE = KD.peak[1]; s.PI_err = NaN;
        s.recalc = { PI: KD.peak[0], PI_err: NaN, LE: KD.peak[1], N: KD.npoints };
        /* 峰值与文章发表值一致时徽章仍标「文章值」，只在说明里注明来自 KDE 峰值 */
        const nearArt = useArt && Math.abs(KD.peak[0] - art.PI) < 0.005 && Math.abs(KD.peak[1] - art.LE) < 0.005;
        s.valueSource = nearArt ? 'article' : 'recomputed';
        s.status = nearArt ? 'article' : 'ref';
        setNote(s, 'note.kdepoints', { n: KD.npoints });
      }
      state.sources.push(s);
    });
  }

  function segmentKey(ds) {
    switch (ds.segment) {
      case 'busiest': return 'seg.busiest';
      case 'all': return ds.group === 'glitch' ? 'seg.glitch' : 'seg.all';
      case 'grid': return 'seg.grid';
      case 'sessions': return 'seg.sessions';
      default: return 'seg.paper';
    }
  }
  function segmentLabel(ds) { return t(segmentKey(ds)); }

  /* ------------------------------ DOM ------------------------------ */
  const $ = sel => document.querySelector(sel);
  const el = {
    builtinBody: $('#builtin-body'),
    uploadList: $('#upload-list'),
    dropzone: $('#dropzone'),
    fileInput: $('#file-input'),
    manualName: $('#manual-name'),
    manualText: $('#manual-text'),
    canvas: $('#plot-canvas'),
    tooltip: $('#tooltip'),
    legend: $('#legend'),
    resultBody: $('#result-body'),
    resultCount: $('#result-count'),
    progressBox: $('#progress-box'),
    progressName: $('#progress-name'),
    progressPct: $('#progress-pct'),
    progressFill: $('#progress-fill'),
    btnRun: $('#btn-run')
  };

  /* ------------------------------------------------------------------
   * 内置数据集表：数值直接取自文章发表图（figure1.pdf 的矢量坐标），
   * 一行 = 图上一个点；勾选即在图中显示，行末给出原始 CSV 下载。
   * ------------------------------------------------------------------ */
  function renderBuiltinTable() {
    const body = el.builtinBody;
    if (!body) return;
    body.innerHTML = '';
    GROUPS.forEach(g => {
      const items = state.sources.filter(s => s.kind === 'builtin' && s.group === g.id);
      if (!items.length) return;
      const gh = document.createElement('tr');
      gh.className = 'grp-row';
      gh.innerHTML = '<td colspan="10"><span class="dot" style="background:' + g.color + '"></span>' +
        '<b>' + gname(g) + '</b>' +
        (lang() === 'zh' ? ' <span class="hint">' + g.en + '</span>' : '') + '</td>';
      body.appendChild(gh);
      items.forEach(s => body.appendChild(builtinTableRow(s)));
    });
  }

  function builtinTableRow(s) {
    const tr = document.createElement('tr');
    if (s.issue || !isFinite(s.PI)) tr.className = 'off';
    const td0 = document.createElement('td');
    td0.className = 'col-sel';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = s.selected;
    cb.disabled = !isFinite(s.PI) || !!s.issue;
    cb.addEventListener('change', () => { s.selected = cb.checked; renderAll(); });
    td0.appendChild(cb);
    tr.appendChild(td0);

    const badges = [];
    if (s.issue) badges.push('<span class="ds-badge warn">' + t('badge.issue') + '</span>');
    if (s.timeUnit === 'second') badges.push('<span class="ds-badge" title="' + t('opt.second') + '">' + t('badge.sec') + '</span>');
    const nm = s.name;
    const meta = dsetMeta(s);
    tr.insertAdjacentHTML('beforeend',
      '<td><span class="src"><span class="ds-swatch" style="background:' + s.color + ';margin:0"></span>' +
      nm + ' ' + badges.join(' ') + '</span></td>' +
      '<td class="col-inst">' + (meta.inst ? esc(meta.inst) : '—') + '</td>' +
      '<td class="col-egu">' + (meta.egu ? esc(meta.egu) : '—') + '</td>' +
      '<td class="num">' + (isFinite(s.N) ? s.N : '—') + '</td>' +
      '<td class="num">' + (isFinite(s.PI) ? s.PI.toFixed(4) : '—') + '</td>' +
      '<td class="num">' + (isFinite(s.PI_err) ? '±' + s.PI_err.toFixed(4) : '—') + '</td>' +
      '<td class="num">' + (isFinite(s.LE) ? s.LE.toFixed(4) : '—') + '</td>' +
      '<td><span class="note">' + noteOf(s) + '</span></td>' +
      '<td class="col-dl">' + fileLink(s) + '</td>');
    return tr;
  }

  /** 按当前语言取某个内置源的「望远镜 / 设备」与「能量定义」文案 */
  function dsetMeta(s) {
    const en = lang() === 'en';
    return {
      inst: en ? (s.instEn || s.inst) : s.inst,
      egu: en ? (s.eguEn || s.egu) : s.egu
    };
  }

  /**
   * 行末的原始 CSV 下载链接。三种情况：
   *   单独的 file                       → 一个链接
   *   "A + B" 的组合数据                → 两个链接（如 20190520B 的 FAST / Parkes）
   *   另有 raw 的派生数据               → 额外一个链接（如 20240114A 的原始目录）
   * 多于一个链接时，靠 PLD_FILES 的 tag/tagEn 在链接上标小字，避免看不出区别。
   */
  function fileLink(s) {
    const FILES = window.PLD_FILES || [];
    const meta = f => FILES.find(x => x.file === f) || null;
    const humanSize = b => b >= 1048576
      ? (b / 1048576).toFixed(1) + ' MB'
      : Math.max(1, Math.round(b / 1024)) + ' KB';
    const link = f => {
      const m = meta(f);
      const tag = m ? pick(m.tag, m.tagEn) : '';
      const title = m
        ? pick(m.desc, m.descEn) + (m.size ? ' · ' + humanSize(m.size) : '')
        : f;
      return '<a class="icon-btn" href="data/' + encodeURIComponent(f) + '" download' +
        ' title="' + esc(title) + '">' +
        t('data.download') + (tag ? '<span class="dl-tag">' + esc(tag) + '</span>' : '') +
        '</a>';
    };
    const files = [];
    // raw 是未经处理的一手目录，排在派生文件前面
    const raw = (s.raw || '').trim();
    if (raw && FILES.some(x => x.file === raw)) files.push(raw);
    const f = (s.file || '').trim();
    if (f) {
      // 注意文件名本身可能带 '+'（如 SGR J1935+2154 radio.csv），先整串匹配
      if (FILES.some(x => x.file === f)) files.push(f);
      else f.split(/\s+\+\s+/).map(x => x.trim())
        .filter(x => FILES.some(y => y.file === x))
        .forEach(x => files.push(x));
    }
    return files.length ? files.map(link).join(' ') : '—';
  }

  /* --------------------------- 上传 / 输入 --------------------------- */
  function addUserSource(name, time, energy, opts) {
    opts = opts || {};
    const color = USER_COLORS[state.userColorIdx % USER_COLORS.length];
    const markers = ['o', 's', '^', 'D', 'v', 'P', 'X'];
    const marker = markers[state.userColorIdx % markers.length];
    state.userColorIdx++;
    const s = {
      id: nextId(),
      kind: opts.kind || 'upload',
      key: null,
      name: name,
      group: 'user',
      color: color,
      marker: marker,
      desc: '',
      file: opts.file || null,
      timeUnit: opts.timeUnit || 'mjd',
      selected: true,
      visible: true,
      status: 'pending',
      PI: NaN, PI_err: NaN, LE: NaN, N: NaN,
      note: '',
      data: { time: time, energy: energy }
    };
    if (opts.descKey) setDesc(s, opts.descKey, opts.descVars);
    else setDesc(s, 'dl.events', {
      n: time.length, a: fmtNum(time[0]), b: fmtNum(time[time.length - 1])
    });
    setNote(s, 'note.pending');
    state.sources.push(s);
    renderAll();
    return s;
  }

  function renderUploads() {
    const list = state.sources.filter(s => s.kind !== 'builtin');
    el.uploadList.innerHTML = '';
    if (!list.length) return;
    const head = document.createElement('div');
    head.className = 'ds-group';
    head.innerHTML = '<span class="dot" style="background:#888"></span>' + t('my.data');
    el.uploadList.appendChild(head);
    list.forEach(s => {
      const row = document.createElement('div');
      row.className = 'ds-item';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.checked = s.selected;
      cb.addEventListener('change', () => { s.selected = cb.checked; renderAll(); });
      const sw = document.createElement('span');
      sw.className = 'ds-swatch'; sw.style.background = s.color;
      const lab = document.createElement('span');
      lab.className = 'ds-label';
      const nt = noteOf(s);
      lab.innerHTML = '<span class="nm">' + s.name + ' <span class="ds-badge">' + statusText(s) + '</span></span>' +
        '<span class="meta">' + descOf(s) + '</span>' +
        (nt ? '<span class="ds-note">' + nt + '</span>' : '');
      const rm = document.createElement('button');
      rm.className = 'ds-remove'; rm.textContent = '×'; rm.title = t('tip.remove');
      rm.addEventListener('click', () => {
        state.sources = state.sources.filter(x => x.id !== s.id);
        renderAll();
      });
      row.appendChild(cb); row.appendChild(sw); row.appendChild(lab); row.appendChild(rm);
      el.uploadList.appendChild(row);
    });
  }

  function statusText(s) {
    switch (s.status) {
      case 'ok': return t('status.done');
      case 'pending': return t('status.pending');
      case 'article': return t('status.article');
      case 'ref': return t('status.ref');
      case 'error': return t('status.error');
      case 'issue': return t('status.issue');
      case 'computing': return t('status.computing');
      default: return s.status;
    }
  }

  /* ----------------------------- 计算 ----------------------------- */
  function computeOptions() {
    return {
      timeUnit: 'mjd',
      gapSec: parseFloat($('#p-gap').value) || 36000,
      segmentMode: $('#p-mode').value,
      nShuffle: parseInt($('#p-shuffle').value, 10) || 100,
      seed: parseInt($('#p-seed').value, 10) || 42,
      async: true
    };
  }

  /** 粗略估算计算耗时（秒）—— PI 是 O(N² × 重排次数) */
  function estimateForSource(s, opts) {
    const t = s.data.time, e = s.data.energy, unit = opts.timeUnit;
    const n = Math.min(t.length, e.length);
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => t[a] - t[b]);
    const ts = idx.map(i => t[i]), es = idx.map(i => e[i]);
    const segs = PLD.splitSessions(ts, es, unit, opts.gapSec);
    const cost = N => N * N * (opts.nShuffle || 100) / 1e7 * 2;   // 两条序列
    if (s.kde) {                       // 逐观测段计算
      let total = 0, cnt = 0;
      segs.forEach(sg => { if (sg.count >= 30) { total += cost(sg.count - 1); cnt++; } });
      return { seconds: total, N: n - 1, segments: cnt };
    }
    if (opts.segmentMode === 'busiest' && segs.length) {
      let best = 0;
      segs.forEach(sg => { if (sg.count > best) best = sg.count; });
      return { seconds: cost(Math.max(0, best - 1)), N: Math.max(0, best - 1), segments: segs.length };
    }
    return { seconds: cost(Math.max(0, n - 1)), N: Math.max(0, n - 1), segments: segs.length };
  }

  function fmtDur(sec) {
    if (sec < 60) return t('dur.sec', { n: Math.round(sec) });
    if (sec < 3600) return t('dur.min', { n: (sec / 60).toFixed(1) });
    return t('dur.hour', { n: (sec / 3600).toFixed(1) });
  }

  async function computeOne(s, force) {
    if (!s.data && !EMBEDDED[s.key]) return;
    if (s.data === null && EMBEDDED[s.key]) loadEmbedded(s);

    const opts = computeOptions();
    if (s.timeUnit === 'second') opts.timeUnit = 'second';
    // 内置源必须沿用文章既定的处理方式（全部事件 / 经纬网格分组 / 逐观测段 KDE）。
    // 若任由面板的「最活跃观测段」切分，像 SGR J0501+4516（27 个爆发、跨度 12 天）
    // 这类稀疏样本会被切成若干单事件段，根本算不出 Lyapunov 指数。
    if (s.kind === 'builtin' && s.segmentMode) opts.segmentMode = s.segmentMode;

    // 长序列先确认，避免浏览器长时间卡住
    if (!force) {
      let est;
      try { est = estimateForSource(s, opts); } catch (err) { est = { seconds: 0 }; }
      if (est.seconds > 20) {
        const go = confirm(t('confirm.slow', {
          name: s.name,
          seg: est.segments > 1 ? t('confirm.seg', { n: est.segments }) : '',
          dur: fmtDur(est.seconds), n: est.N
        }));
        if (!go) {
          s.status = s.recalc ? (s.valueSource === 'article' ? 'article' : 'ref') : 'pending';
          setNote(s, 'note.cancel', { d: fmtDur(est.seconds) });
          renderAll();
          return;
        }
      }
    }

    s.status = 'computing';
    setNote(s, 'note.computing');
    renderAll();

    // 20240114A：逐观测段计算 → KDE 点云
    if (s.kind === 'builtin' && s.kde) {
      const segs = PLD.splitSessions(s.data.time, s.data.energy, opts.timeUnit, opts.gapSec);
      const pts = [];
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        if (seg.count < 30) continue;
        setProgress(s.name + ' · ' + t('prog.session', { i: i + 1, n: segs.length }), (i + 1) / segs.length);
        const r = await PLD.computePLD(seg.time, seg.energy, Object.assign({}, opts, { segmentMode: 'all' }));
        if (r.ok) pts.push([r.PI, r.LE, r.N]);
        await tick();
      }
      if (pts.length) {
        s.kdePoints = pts.map(p => [p[0], p[1]]);
        applyResult(s, {
          ok: true, PI: pts.reduce((a, p) => a + p[0], 0) / pts.length,
          LE: pts.reduce((a, p) => a + p[1], 0) / pts.length,
          PI_err: NaN, N: pts.reduce((a, p) => a + p[2], 0),
          segmentInfo: 'kde of ' + pts.length + ' sessions'
        });
      } else {
        s.status = 'error'; setNote(s, 'note.noseg');
      }
      setProgress('', 0);
      renderAll();
      return;
    }

    setProgress(s.name, 0);
    const r = await PLD.computePLD(s.data.time, s.data.energy, Object.assign({}, opts, {
      onProgress: (f, stage) => setProgress(s.name + ' · ' +
        (stage === 'waiting-time' ? t('prog.wait') : t('prog.energy')), f)
    }));
    setProgress('', 0);
    applyResult(s, r);
    renderAll();
  }

  /**
   * 写入计算结果：
   *  · 上传 / 手动数据：直接作为显示值；
   *  · 内置数据：作为“复算值”保存，显示值仍用文章发表值，并在说明里给出偏差。
   */
  function applyResult(s, r) {
    const computed = { PI: r.PI, PI_err: r.PI_err, LE: r.LE, N: r.N };
    if (s.kind !== 'builtin') {
      Object.assign(s, computed);
      s.status = r.ok ? 'ok' : 'error';
      if (r.ok) setSegNote(s, r);
      else setNote(s, 'note.failmsg', { msg: coreError(r) });
      return;
    }
    s.recalc = computed;
    if (!isFinite(s.PI) && r.ok) {          // 没有文章值时退回复算值
      Object.assign(s, computed);
      s.valueSource = 'recomputed';
      s.status = 'ok';
      setSegNote(s, r, 'note.recalcfull');
      return;
    }
    if (!r.ok) { s.status = 'error'; setNote(s, 'note.failmsg', { msg: coreError(r) }); return; }
    s.status = (s.valueSource === 'article') ? 'article' : 'ref';
    const dPI = Math.abs(r.PI - s.PI), dLE = Math.abs(r.LE - s.LE);
    setNote(s, 'note.recalcpi', {
      pi: r.PI.toFixed(3), le: r.LE.toFixed(3),
      dpi: dPI.toFixed(3), dle: dLE.toFixed(3)
    });
  }

  function tick() { return new Promise(r => setTimeout(r, 0)); }

  function unitChoice() {
    const sel = document.getElementById('p-unit');
    return (sel && sel.value === 'second') ? 'second' : 'mjd';
  }

  function setProgress(name, frac) {
    if (!name) { el.progressBox.hidden = true; return; }
    el.progressBox.hidden = false;
    el.progressName.textContent = name;
    el.progressPct.textContent = Math.round(frac * 100) + '%';
    el.progressFill.style.width = (frac * 100) + '%';
  }

  async function runPending() {
    if (state.computing) return;
    const queue = state.sources.filter(s =>
      s.selected && s.kind !== 'builtin' && s.status === 'pending' && s.data);
    if (!queue.length) {
      alert(t('alert.nopending'));
      return;
    }
    state.computing = true;
    el.btnRun.disabled = true;
    for (const s of queue) await computeOne(s);
    state.computing = false;
    el.btnRun.disabled = false;
    setProgress('', 0);
  }

  function loadEmbedded(s) {
    const e = EMBEDDED[s.key];
    if (!e) return;
    const time = [], energy = [];
    const parts = e.s.split(';');
    for (const p of parts) {
      const i = p.indexOf(',');
      if (i < 0) continue;
      const t = parseFloat(p.slice(0, i)), v = parseFloat(p.slice(i + 1));
      if (isFinite(t) && isFinite(v)) { time.push(t); energy.push(v); }
    }
    s.data = { time: time, energy: energy };
    s.timeUnit = e.unit === 'second' ? 'second' : 'mjd';
  }

  /* ------------------------------ 绘图 ------------------------------ */
  /**
   * 文章图的坐标范围 = matplotlib 对 17 个误差棒做默认 autoscale（四周各 5% 数据跨度）
   * 的结果，由 gen_kde240114.py 打印 / kde-240114.js 记录：
   *     xlim = (0.685095, 1.028405)   ylim = (-0.055065, 0.384165)
   * 这里优先取 KDE 数据里记录的值，保证两边永不脱节。
   */
  const PAPER_AXIS = (function () {
    const K = window.PLD_KDE_240114;
    if (K && isFinite(K.xmin) && isFinite(K.xmax) && isFinite(K.ymin) && isFinite(K.ymax)) {
      return { x: [K.xmin, K.xmax], y: [K.ymin, K.ymax] };
    }
    return { x: [0.685095, 1.028405], y: [-0.055065, 0.384165] };
  })();

  function activeSources() {
    return state.sources.filter(s => s.selected && s.visible && isFinite(s.PI) && isFinite(s.LE) && s.status !== 'issue');
  }

  function niceTicks(min, max, n) {
    const span = max - min;
    if (!(span > 0)) return [min];
    const raw = span / n;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    let step = mag;
    if (norm > 5) step = 10 * mag; else if (norm > 2) step = 5 * mag; else if (norm > 1) step = 2 * mag;
    const start = Math.ceil(min / step) * step;
    const out = [];
    for (let v = start; v <= max + step * 1e-6; v += step) out.push(Math.abs(v) < 1e-12 ? 0 : v);
    return out;
  }

  /* ---------------------------------------------------------------------
   * 绘图基准：一律以 figure1.pdf（文章的图）为准。
   *   绘图区   390.18 × 403.92 pt
   *   字号     10 pt Arial（轴标题为 Arial-Bold）
   *   errorbar(ms=10, capsize=3, elinewidth=0.5)，无网格线
   *   KDE      contourf(levels=10, cmap='Reds', alpha=0.2)
   * ------------------------------------------------------------------- */
  /* 绘图区尺寸直接量自 figure1.pdf 的坐标框：1240 × 1232 px @200 dpi → 446.4 × 443.5 pt */
  var PAPER_AXES_PT = { w: 446.4, h: 443.5 };
  var FONT_PT = 10, MS_PT = 10, CAP_PT = 3, ELW_PT = 0.5;
  var SPINE_PT = 0.8, TICK_PT = 4, PAD_PT = 3.5, LABELPAD_PT = 4;

  function paperMargins(sc) {
    return {
      l: Math.round((TICK_PT + PAD_PT + 30 + LABELPAD_PT + FONT_PT + 5) * sc),
      r: Math.round(14 * sc),
      t: Math.round(14 * sc),
      b: Math.round((TICK_PT + PAD_PT + FONT_PT + LABELPAD_PT + FONT_PT + 7) * sc)
    };
  }

  function drawPlot() {
    const cv = el.canvas;
    const parent = cv.parentElement;
    const cssW = Math.max(320, parent.clientWidth);
    const dpr = (window.devicePixelRatio || 1) * exportScale;

    const pts = activeSources();
    let xr, yr;
    if (state.axisLock) { xr = state.axisLock.x.slice(); yr = state.axisLock.y.slice(); }
    else if (!pts.length) { xr = PAPER_AXIS.x.slice(); yr = PAPER_AXIS.y.slice(); }
    else {
      /* matplotlib 的默认 autoscale：数据范围四周各留 5% 跨度
         （rcParams['axes.xmargin'] = axes.ymargin = 0.05），与 notebook 完全一致。
         注意：KDE 点云不是 artist，不参与 autoscale —— 与文章相同。 */
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
      pts.forEach(s => {
        const e = isFinite(s.PI_err) ? s.PI_err : 0;
        x0 = Math.min(x0, s.PI - e); x1 = Math.max(x1, s.PI + e);
        y0 = Math.min(y0, s.LE); y1 = Math.max(y1, s.LE);
      });
      if (!(x1 > x0)) { x0 -= 0.5; x1 += 0.5; }
      if (!(y1 > y0)) { y0 -= 0.5; y1 += 0.5; }
      const px = (x1 - x0) * 0.05, py = (y1 - y0) * 0.05;
      xr = [x0 - px, x1 + px]; yr = [y0 - py, y1 + py];
    }

    /* 边距宽度依赖缩放、缩放又依赖边距 —— 迭代两次即可定稿 */
    let sc = (cssW - 96) / PAPER_AXES_PT.w;
    let m = paperMargins(sc);
    let W = cssW - m.l - m.r;
    sc = W / PAPER_AXES_PT.w;
    m = paperMargins(sc);
    W = cssW - m.l - m.r;
    sc = W / PAPER_AXES_PT.w;
    const H = W * (PAPER_AXES_PT.h / PAPER_AXES_PT.w);
    const cssH = Math.round(m.t + H + m.b);

    cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
    cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cssW, cssH);

    const X = v => m.l + (v - xr[0]) / (xr[1] - xr[0]) * W;
    const Y = v => m.t + H - (v - yr[0]) / (yr[1] - yr[0]) * H;
    const FS = FONT_PT * sc;

    /* --- FRB 20240114A 的 KDE 等值线 --- */
    if ($('#opt-kde').checked) drawKDE(ctx, X, Y, m, W, H, xr, yr);

    /* --- 坐标轴：matplotlib 默认样式，无网格线 --- */
    ctx.save();
    const xt = niceTicks(xr[0], xr[1], 9), yt = niceTicks(yr[0], yr[1], 9);
    const tick = TICK_PT * sc, spine = Math.max(0.8, SPINE_PT * sc);
    ctx.strokeStyle = '#000000'; ctx.lineWidth = spine;
    /* matplotlib 默认四条边框全画（不需要去掉 top / right） */
    ctx.beginPath();
    ctx.moveTo(m.l, m.t + H); ctx.lineTo(m.l + W, m.t + H);
    ctx.lineTo(m.l + W, m.t); ctx.lineTo(m.l, m.t); ctx.lineTo(m.l, m.t + H);
    ctx.stroke();

    ctx.font = FS + 'px Arial, Helvetica, sans-serif';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    xt.forEach(v => {
      const x = X(v);
      ctx.beginPath(); ctx.moveTo(x, m.t + H); ctx.lineTo(x, m.t + H + tick); ctx.stroke();
      ctx.fillText(fmtTick(v), x, m.t + H + tick + PAD_PT * sc);
    });
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    yt.forEach(v => {
      const y = Y(v);
      ctx.beginPath(); ctx.moveTo(m.l, y); ctx.lineTo(m.l - tick, y); ctx.stroke();
      ctx.fillText(fmtTick(v), m.l - tick - PAD_PT * sc, y);
    });

    ctx.font = 'bold ' + FS + 'px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(t('axis_x'), m.l + W / 2,
      m.t + H + (TICK_PT + PAD_PT + FONT_PT + LABELPAD_PT + FONT_PT) * sc);
    ctx.save();
    ctx.translate(m.l - (TICK_PT + PAD_PT + 30 + LABELPAD_PT + FONT_PT) * sc, m.t + H / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(t('axis_y'), 0, 0);
    ctx.restore();
    ctx.restore();

    /* --- 数据点：errorbar(xerr, fmt=marker, ms=10, capsize=3, elinewidth=0.5) --- */
    const showErr = $('#opt-errbars').checked;
    const showLab = $('#opt-labels').checked;
    const r = MS_PT / 2 * sc, cap = CAP_PT * sc, elw = Math.max(0.6, ELW_PT * sc);
    pts.forEach(s => {
      const x = X(s.PI), y = Y(s.LE);
      if (showErr && isFinite(s.PI_err)) {
        const e0 = X(s.PI - s.PI_err), e1 = X(s.PI + s.PI_err);
        ctx.save();
        ctx.strokeStyle = s.color; ctx.lineWidth = elw;
        ctx.beginPath();
        ctx.moveTo(e0, y); ctx.lineTo(e1, y);
        ctx.moveTo(e0, y - cap); ctx.lineTo(e0, y + cap);
        ctx.moveTo(e1, y - cap); ctx.lineTo(e1, y + cap);
        ctx.stroke();
        ctx.restore();
      }
      drawMarker(ctx, s.marker, x, y, r, s.color, sc);
      if (showLab) {
        const sh = s.shift || [0, 0.0055];
        ctx.save();
        ctx.font = FS + 'px Arial, Helvetica, sans-serif';
        ctx.fillStyle = s.color;
        ctx.textAlign = (s.labelAlign === 'left') ? 'left' : 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText(s.name, X(s.PI + sh[0]), Y(s.LE + sh[1]));
        ctx.restore();
      }
    });

    cv._hit = pts.map(s => ({ s: s, x: X(s.PI), y: Y(s.LE) }));
  }

  function line(ctx, x1, y1, x2, y2, color, w) {
    ctx.save();
    ctx.strokeStyle = color || '#eceff3'; ctx.lineWidth = w || 1;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
    ctx.restore();
  }

  /**
   * 按 matplotlib 的标记路径绘制。
   * matplotlib 的 marker path 归一化在 [-1, 1]，再按 markersize/2 缩放；
   * 这里 r = markersize/2（已含 pt→px 换算）。路径顶点取自
   * matplotlib.markers.MarkerStyle(k).get_path()（注意 path 的 y 轴朝上）。
   */
  var STAR_PATH = [
    [0, 1], [-0.225, 0.309], [-0.951, 0.309], [-0.363, -0.118], [-0.588, -0.809],
    [0, -0.382], [0.588, -0.809], [0.363, -0.118], [0.951, 0.309], [0.225, 0.309]
  ];

  function drawMarker(ctx, kind, x, y, r, color, sc) {
    ctx.save();
    ctx.fillStyle = color; ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(0.6, 0.8 * (sc || 1));
    ctx.beginPath();
    switch (kind) {
      case 'D':                                   // diamond：正方形旋转 45°
        ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.78, y);
        ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.78, y); ctx.closePath(); break;
      case '^':                                   // triangle_up
        ctx.moveTo(x, y - r); ctx.lineTo(x + r, y + r);
        ctx.lineTo(x - r, y + r); ctx.closePath(); break;
      case 'v':                                   // triangle_down
        ctx.moveTo(x, y + r); ctx.lineTo(x + r, y - r);
        ctx.lineTo(x - r, y - r); ctx.closePath(); break;
      case 's':                                   // square
        ctx.rect(x - r, y - r, r * 2, r * 2); break;
      case '*':                                   // star（五角星，matplotlib 原路径）
        for (let i = 0; i < STAR_PATH.length; i++) {
          const vx = x + STAR_PATH[i][0] * r, vy = y - STAR_PATH[i][1] * r;
          if (i === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
        }
        ctx.closePath(); break;
      case 'P':
        ctx.rect(x - r * 0.9, y - r * 0.9, r * 1.8, r * 1.8); break;
      case 'X':
        ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r);
        ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r);
        ctx.stroke(); ctx.restore(); return;
      default:                                    // 'o' circle
        ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  /** 二维高斯核密度阴影 + 密度峰值点 */
  /**
   * FRB 20240114A 的二维核密度阴影，完全照抄 figure1.ipynb：
   *     kde = gaussian_kde(xy);  xx, yy = np.mgrid[x0:x1:100j, y0:y1:100j]
   *     ax.contourf(xx, yy, density, levels=10, cmap='Reds', alpha=0.2)
   *
   * 坐标范围与文章一致时，直接使用 Python 端预算好的网格、层级与配色
   * （kde-240114.js，matplotlib 亲自算的），做到逐层一致；
   * 换了坐标范围则按同一算法在浏览器里重算。
   */
  function drawKDE(ctx, X, Y, m, W, H, xr, yr) {
    const K = window.PLD_KDE_240114;
    if (!K || !K.points || K.points.length < 3) return;
    let grid, nx, ny, x0, x1, y0, y1, levels, colors, alpha;

    const same = Math.abs(xr[0] - K.xmin) < 1e-6 && Math.abs(xr[1] - K.xmax) < 1e-6 &&
      Math.abs(yr[0] - K.ymin) < 1e-6 && Math.abs(yr[1] - K.ymax) < 1e-6;
    if (same) {
      nx = K.nx; ny = K.ny; x0 = K.xmin; x1 = K.xmax; y0 = K.ymin; y1 = K.ymax;
      grid = Float64Array.from(K.density);
      levels = K.levels; colors = K.colors; alpha = K.alpha;
    } else {
      nx = ny = 100; x0 = xr[0]; x1 = xr[1]; y0 = yr[0]; y1 = yr[1];
      const xg = new Array(nx), yg = new Array(ny);
      for (let i = 0; i < nx; i++) xg[i] = x0 + (x1 - x0) * i / (nx - 1);
      for (let j = 0; j < ny; j++) yg[j] = y0 + (y1 - y0) * j / (ny - 1);
      grid = PLD.gaussianKDE2D(K.points, xg, yg).density;
      let dmin = Infinity, dmax = -Infinity;
      for (let k = 0; k < grid.length; k++) {
        if (grid[k] < dmin) dmin = grid[k];
        if (grid[k] > dmax) dmax = grid[k];
      }
      if (!(dmax > dmin)) return;
      levels = PLD.niceLevels(dmin, dmax, 10);
      colors = PLD.contourfColors(levels);
      alpha = 0.2;
    }

    ctx.save();
    ctx.beginPath(); ctx.rect(m.l, m.t, W, H); ctx.clip();
    PLD.contourFilled(ctx, grid, nx, ny, X(x0), X(x1), Y(y0), Y(y1), levels, colors, alpha);
    ctx.restore();
  }

  /* ------------------------------ 图例 ------------------------------ */
  function renderLegend() {
    const pts = state.sources.filter(s => s.selected && isFinite(s.PI) && isFinite(s.LE));
    const sym = { 'o': '●', 'D': '◆', '^': '▲', 'v': '▼', 's': '■', '*': '✳', 'P': '▣', 'X': '✕' };
    el.legend.innerHTML = '';
    pts.forEach(s => {
      const it = document.createElement('span');
      it.className = 'legend-item' + (s.visible ? '' : ' off');
      it.innerHTML = '<span class="lg-sym" style="color:' + s.color + '">' + (sym[s.marker] || '●') + '</span>' + s.name;
      it.addEventListener('click', () => { s.visible = !s.visible; renderAll(); });
      el.legend.appendChild(it);
    });
    if (!pts.length) el.legend.innerHTML = '<span class="hint">' + t('hint.empty') + '</span>';
  }

  /* ---------------------------- 结果表 ---------------------------- */
  /* 只列出用户自己的数据（上传 / 手填）；文章数据点见 #data 的「文章内置数据集」表 */
  function renderTable() {
    const rows = state.sources.filter(s => s.selected && s.kind !== 'builtin');
    el.resultBody.innerHTML = '';
    rows.forEach(s => {
      const tr = document.createElement('tr');
      const stCls = (s.status === 'ok' || s.status === 'ref') ? 'ok' : (s.status === 'error' || s.status === 'issue' ? 'err' : '');
      tr.innerHTML =
        '<td><span class="src"><span class="ds-swatch" style="background:' + s.color + ';margin:0"></span>' + s.name + '</span></td>' +
        '<td class="num">' + (isFinite(s.N) ? s.N : '—') + '</td>' +
        '<td class="num">' + (isFinite(s.PI) ? s.PI.toFixed(4) : '—') + '</td>' +
        '<td class="num">' + (isFinite(s.PI_err) ? '±' + s.PI_err.toFixed(4) : '—') + '</td>' +
        '<td class="num">' + (isFinite(s.LE) ? s.LE.toFixed(4) : '—') + '</td>' +
        '<td><span class="st ' + stCls + '">' + statusText(s) + '</span> <span class="note">' + noteOf(s) + '</span></td>' +
        '<td></td>';
      if (s.status !== 'computing') addBtn(tr.lastElementChild, t('btn.compute'), () => computeOne(s));
      el.resultBody.appendChild(tr);
    });
    el.resultCount.textContent = rows.length ? t('count.datasets', { n: rows.length }) : '';
    if (!rows.length) el.resultBody.innerHTML = '<tr><td colspan="7" class="hint">' + t('hint.nouser') + '</td></tr>';
  }

  function addBtn(td, text, fn) {
    const b = document.createElement('button');
    b.className = 'icon-btn'; b.textContent = text;
    b.addEventListener('click', fn);
    td.appendChild(b);
  }

  /* ------------------------------ 导出 ------------------------------ */
  /** 导出 2× 分辨率 PNG（约等效 300 dpi 的期刊插图） */
  function exportPNG() {
    exportScale = 2;
    drawPlot();
    const url = el.canvas.toDataURL('image/png');
    exportScale = 1;
    drawPlot();
    const a = document.createElement('a');
    a.href = url; a.download = 'PLD.png'; a.click();
  }

  function exportCSV() {
    const rows = state.sources.filter(s => s.selected);
    if (!rows.length) { alert(t('alert.norows')); return; }
    const head = ['source', 'group', 'N', 'PI', 'PI_err', 'LE', 'status', 'note'];
    const lines = [head.join(',')];
    rows.forEach(s => {
      const g = s.group === 'user' ? 'User data' : groupOf(s.group).label;
      lines.push([csvq(s.name), csvq(g), isFinite(s.N) ? s.N : '', isFinite(s.PI) ? s.PI.toFixed(6) : '',
        isFinite(s.PI_err) ? s.PI_err.toFixed(6) : '', isFinite(s.LE) ? s.LE.toFixed(6) : '',
        statusText(s), csvq(noteOf(s))].join(','));
    });
    download('PLD_results.csv', lines.join('\n'), 'text/csv;charset=utf-8');
  }

  function csvq(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }

  function download(name, content, type) {
    const blob = new Blob([content], { type: type || 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  /* ----------------------------- 工具 ----------------------------- */
  function fmtNum(v) { return Math.abs(v) >= 1e4 ? v.toFixed(0) : v.toFixed(4); }
  function fmtTick(v) {
    const a = Math.abs(v);
    if (a >= 100) return v.toFixed(0);
    if (a >= 10) return v.toFixed(1);
    return v.toFixed(2);
  }

  /* ----------------------------- 事件 ----------------------------- */
  function renderAll() {
    renderBuiltinTable();
    renderUploads();
    renderLegend();
    renderTable();
    drawPlot();
  }

  function bind() {
    // 上传
    el.dropzone.addEventListener('click', () => el.fileInput.click());
    el.fileInput.addEventListener('change', e => handleFiles(e.target.files));
    ['dragenter', 'dragover'].forEach(ev =>
      el.dropzone.addEventListener(ev, e => { e.preventDefault(); el.dropzone.classList.add('over'); }));
    ['dragleave', 'drop'].forEach(ev =>
      el.dropzone.addEventListener(ev, e => { e.preventDefault(); el.dropzone.classList.remove('over'); }));
    el.dropzone.addEventListener('drop', e => {
      if (e.dataTransfer && e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    });

    // 手动输入
    $('#btn-manual-add').addEventListener('click', () => {
      const text = el.manualText.value;
      const parsed = PLD.parseCSV(text);
      if (parsed.time.length < 8) {
        alert(t('alert.few', { n: parsed.time.length, w: warnList(parsed.warnings) }));
        return;
      }
      const name = (el.manualName.value || 'My source').trim();
      const unit = unitChoice();
      const s = addUserSource(name, parsed.time, parsed.energy, {
        kind: 'manual', timeUnit: unit,
        descKey: 'dl.eventsunit',
        descVars: { n: parsed.time.length, u: { k: unit === 'second' ? 'unit.sec' : 'unit.mjd' } }
      });
      setNote(s, 'note.pendingmanual');
      renderAll();
    });
    $('#btn-manual-sample').addEventListener('click', () => {
      el.manualText.value = SAMPLE;
    });

    // 全选 / 清空
    $('#btn-select-all').addEventListener('click', () => {
      state.sources.forEach(s => { if (s.kind === 'builtin' && !s.issue) s.selected = true; });
      renderAll();
    });
    $('#btn-select-none').addEventListener('click', () => {
      state.sources.forEach(s => { if (s.kind === 'builtin') s.selected = false; });
      renderAll();
    });

    // 参数 / 选项
    ['#opt-labels', '#opt-errbars', '#opt-kde'].forEach(sel => $(sel).addEventListener('change', drawPlot));
    const axisBtn = $('#btn-axis-paper');
    axisBtn.addEventListener('click', () => {
      state.axisLock = state.axisLock ? null : PAPER_AXIS;
      axisBtn.textContent = state.axisLock ? t('btn.axis.on') : t('btn.axis');
      drawPlot();
    });
    $('#btn-png').addEventListener('click', exportPNG);
    $('#btn-csv').addEventListener('click', exportCSV);
    el.btnRun.addEventListener('click', runPending);
    $('#btn-reset').addEventListener('click', () => {
      $('#p-gap').value = 36000; $('#p-mode').value = 'busiest';
      $('#p-shuffle').value = 100; $('#p-seed').value = 42;
    });

    // 模板 / 示例下载
    $('#btn-download-template').addEventListener('click', () => {
      download('PLD_template.csv', TEMPLATE, 'text/csv;charset=utf-8');
    });
    $('#btn-download-example').addEventListener('click', () => {
      let text = 'time,Energy\n';
      if (EMBEDDED['20220912A']) {
        EMBEDDED['20220912A'].s.split(';').slice(0, 400).forEach(p => {
          text += p.replace(',', ',') + '\n';
        });
      }
      download('FRB20220912A_example.csv', text, 'text/csv;charset=utf-8');
    });

    // tooltip
    el.canvas.addEventListener('mousemove', e => {
      const r = el.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      let best = null, bd = 15;
      (el.canvas._hit || []).forEach(h => {
        const d = Math.hypot(h.x - x, h.y - y);
        if (d < bd) { bd = d; best = h; }
      });
      if (!best) { el.tooltip.hidden = true; return; }
      const s = best.s;
      el.tooltip.hidden = false;
      el.tooltip.innerHTML = '<b>' + s.name + '</b><br>' +
        'PI = ' + s.PI.toFixed(4) + (isFinite(s.PI_err) ? ' ± ' + s.PI_err.toFixed(4) : '') + '<br>' +
        'LE = ' + s.LE.toFixed(4) + '<br>' +
        '<span style="opacity:.75">N = ' + (isFinite(s.N) ? s.N : '—') + '</span>';
      const tw = el.tooltip.offsetWidth, th = el.tooltip.offsetHeight;
      el.tooltip.style.left = Math.min(r.width - tw - 4, best.x + 12) + 'px';
      el.tooltip.style.top = Math.max(2, best.y - th - 8) + 'px';
    });
    el.canvas.addEventListener('mouseleave', () => { el.tooltip.hidden = true; });

    window.addEventListener('resize', drawPlot);
  }

  function handleFiles(files) {
    Array.from(files).forEach(f => {
      if (f.size > 20 * 1024 * 1024) {
        const go = confirm(t('confirm.big', { name: f.name, mb: (f.size / 1048576).toFixed(0) }));
        if (!go) return;
      }
      const fr = new FileReader();
      fr.onload = () => {
        const parsed = PLD.parseCSV(String(fr.result));
        if (parsed.time.length < 8) {
          alert(t('alert.fewfile', {
            f: f.name, n: parsed.time.length, w: warnList(parsed.warnings)
          }));
          return;
        }
        const name = f.name.replace(/\.(csv|txt|tsv|dat)$/i, '');
        const unit = unitChoice();
        const s = addUserSource(name, parsed.time, parsed.energy, {
          kind: 'upload', file: f.name, timeUnit: unit,
          descKey: 'dl.eventsunit',
          descVars: { n: parsed.time.length, u: { k: unit === 'second' ? 'unit.sec' : 'unit.mjd' } }
        });
        if (parsed.header && parsed.header.length) {
          setNote(s, 'note.pendingfilehdr', {
            n: parsed.time.length, h: parsed.header.join(' / ')
          });
        } else {
          setNote(s, 'note.pendingfile', { n: parsed.time.length });
        }
        renderAll();
        // 自动开始计算
        computeOne(s);
      };
      fr.readAsText(f);
    });
  }

  /* ---------------------------- 示例数据 ---------------------------- */
  const SAMPLE = [
    '59093.151961,1.90023964159762e+38',
    '59093.152157,5.332552452872839e+38',
    '59093.153021,2.109214e+38',
    '59093.154480,7.77e37',
    '59093.156902,3.41e38',
    '59093.158011,1.22e38',
    '59093.160245,6.03e38',
    '59093.161337,2.87e37'
  ].join('\n');

  const TEMPLATE = 'time,Energy\n' + SAMPLE + '\n';

  /* ------------------------------ 启动 ------------------------------ */
  initBuiltins();
  bind();
  renderAll();

  /* 语言切换：重排全部动态内容（坐标轴标题由 drawPlot 里的 t() 处理） */
  document.addEventListener('pld:langchange', function () {
    renderAll();
    const ab = $('#btn-axis-paper');
    if (ab) ab.textContent = state.axisLock ? t('btn.axis.on') : t('btn.axis');
  });

  // 内置数据缺少参考值时的提示
  if (!REF) {
    console.warn('未找到 assets/reference.js —— 内置数据集将没有预置结果。请运行 pld_reference.py 生成。');
  }
})();
