/* =========================================================================
 * pld-core.js — PLD 计算引擎
 *
 * 纯 JavaScript 复现 figure1.ipynb 中用到的两个非线性时间序列指标：
 *   1) Lyapunov Exponent  : nolds.lyap_e —— Eckmann et al. (1986) 算法
 *                           默认参数 emb_dim = 10, matrix_dim = 4, tau = 1,
 *                           min_nb = min(2*matrix_dim, matrix_dim+4) = 8,
 *                           min_tsep = 0
 *   2) Pincus Index       : cal_apen / get_max_apen / get_pincus_index
 *                           （notebook 中的 numba 实现，逐行对应）
 *
 * 可在浏览器 (window.PLD) 与 Node (require) 中使用。
 * ========================================================================= */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.PLD = factory();
})(typeof self !== 'undefined' ? self : this, function () {

  'use strict';

  /* --------------------------- 基础工具 --------------------------- */

  /** 可复现的伪随机数发生器（mulberry32） */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Fisher–Yates 原地重排（对应 np.random.shuffle） */
  function shuffle(arr, rand) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
    }
    return arr;
  }

  /** min–max 归一化到 [0,1]（对应 notebook 中的 scaledT / scaledE） */
  function scale(x) {
    const n = x.length;
    const out = new Float64Array(n);
    if (n === 0) return out;
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) { const v = x[i]; if (v < lo) lo = v; if (v > hi) hi = v; }
    if (hi === lo) return out;
    const inv = 1 / (hi - lo);
    for (let i = 0; i < n; i++) out[i] = (x[i] - lo) * inv;
    return out;
  }

  function median(sorted) {
    const n = sorted.length;
    if (n === 0) return NaN;
    const m = n >> 1;
    return n % 2 ? sorted[m] : 0.5 * (sorted[m - 1] + sorted[m]);
  }

  function std(arr) { // 对应 np.std (ddof = 0)
    const n = arr.length; if (n === 0) return NaN;
    let s = 0; for (let i = 0; i < n; i++) s += arr[i];
    const mu = s / n;
    let v = 0; for (let i = 0; i < n; i++) { const d = arr[i] - mu; v += d * d; }
    return Math.sqrt(v / n);
  }

  function defaultToler() {
    // np.logspace(-10, 1, 50)
    const t = new Float64Array(50);
    for (let k = 0; k < 50; k++) t[k] = Math.pow(10, -10 + 11 * k / 49);
    return t;
  }

  /* ------------------- 序列构造（对应 notebook） ------------------- */

  /**
   * 由 time / energy 构造归一化后的等待时间序列与能量差分序列。
   * @param {number[]} time   时间（MJD 天 或 秒）
   * @param {number[]} energy 能量
   * @param {string} timeUnit 'mjd'（天，内部 ×86400 转秒）| 'second'
   */
  function buildSequences(time, energy, timeUnit) {
    const fac = (timeUnit === 'second') ? 1.0 : 86400.0;
    const n = Math.min(time.length, energy.length);
    const dt = new Float64Array(Math.max(0, n - 1));
    const de = new Float64Array(Math.max(0, n - 1));
    for (let i = 0; i < n - 1; i++) {
      dt[i] = (time[i + 1] - time[i]) * fac;
      de[i] = energy[i + 1] - energy[i];
    }
    return { dt: dt, de: de, scaledT: scale(dt), scaledE: scale(de) };
  }

  /**
   * 按等待时间阈值切分观测段（对应 notebook 的 Split Date）。
   * @param {number} gapSec 阈值（秒），默认 36000 s = 10 h
   */
  function splitSessions(time, energy, timeUnit, gapSec) {
    const fac = (timeUnit === 'second') ? 1.0 : 86400.0;
    const n = Math.min(time.length, energy.length);
    const segs = [];
    let start = 0;
    for (let i = 1; i < n; i++) {
      if ((time[i] - time[i - 1]) * fac > gapSec) {
        if (i - start >= 2) segs.push({ from: start, to: i });
        start = i;
      }
    }
    if (n - start >= 2) segs.push({ from: start, to: n });
    return segs.map(function (s) {
      return {
        time: time.slice(s.from, s.to),
        energy: energy.slice(s.from, s.to),
        index: s.from,
        count: s.to - s.from
      };
    });
  }

  /* ============== Lyapunov Exponent：Eckmann et al. (1986) ==============
   * 与 nolds.lyap_e(data, emb_dim=10, matrix_dim=4, min_nb=None,
   *                  min_tsep=0, tau=1) 完全一致
   * ==================================================================== */

  /** Householder QR 分解：A (m×n, m>=n) → {Q, R} */
  function qrDecompose(A, rows, cols) {
    // R 存为上三角，Q 通过累积 Householder 向量得到
    const R = new Float64Array(cols * cols);
    const Q = new Float64Array(rows * cols);
    // 拷贝 A 到工作矩阵 W
    const W = new Float64Array(rows * cols);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) W[i * cols + j] = A[i * cols + j];
    // Q 初始化为单位阵（因 rows == cols == matrix_dim，实际是方阵）
    for (let i = 0; i < rows; i++) Q[i * cols + i] = 1;

    for (let k = 0; k < cols; k++) {
      // 计算 Householder 向量
      let norm = 0;
      for (let i = k; i < rows; i++) norm += W[i * cols + k] * W[i * cols + k];
      norm = Math.sqrt(norm);
      if (norm === 0) continue;
      const alpha = W[k * cols + k];
      const beta = alpha >= 0 ? -norm : norm;
      // v = W[k:,k] - beta*e1
      const v = new Float64Array(rows - k);
      for (let i = k; i < rows; i++) v[i - k] = W[i * cols + k];
      v[0] -= beta;
      let vnorm2 = 0;
      for (let i = 0; i < v.length; i++) vnorm2 += v[i] * v[i];
      if (vnorm2 < 1e-300) continue;
      // W[k:, k:] -= 2 v (v^T W[k:,k:]) / vnorm2
      for (let j = k; j < cols; j++) {
        let s = 0;
        for (let i = 0; i < v.length; i++) s += v[i] * W[(i + k) * cols + j];
        s = 2 * s / vnorm2;
        for (let i = 0; i < v.length; i++) W[(i + k) * cols + j] -= s * v[i];
      }
      // Q 同样更新：Q[k:, :] -= 2 v (v^T Q[k:,:]) / vnorm2
      for (let j = 0; j < cols; j++) {
        let s = 0;
        for (let i = 0; i < v.length; i++) s += v[i] * Q[(i + k) * cols + j];
        s = 2 * s / vnorm2;
        for (let i = 0; i < v.length; i++) Q[(i + k) * cols + j] -= s * v[i];
      }
    }
    // 提取上三角 R
    for (let i = 0; i < cols; i++) for (let j = 0; j < cols; j++) R[i * cols + j] = (j >= i) ? W[i * cols + j] : 0;
    // 上面累积的是 H_{n-1}...H_0 = Q^T，转置还原为 Q
    const Qt = new Float64Array(rows * cols);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) Qt[i * cols + j] = Q[j * cols + i];
    return { Q: Qt, R: R };
  }

  /** 最小二乘：求解 min ||X a - b||（X: rows×cols, 列满秩或接近） */
  function lstsq(X, b, rows, cols) {
    // Householder QR
    const W = new Float64Array(rows * cols);
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) W[i * cols + j] = X[i * cols + j];
    const bb = Float64Array.from(b);
    for (let k = 0; k < cols; k++) {
      let norm = 0;
      for (let i = k; i < rows; i++) norm += W[i * cols + k] * W[i * cols + k];
      norm = Math.sqrt(norm);
      if (norm === 0) continue;
      const alpha = W[k * cols + k];
      const beta = alpha >= 0 ? -norm : norm;
      const v = new Float64Array(rows - k);
      for (let i = k; i < rows; i++) v[i - k] = W[i * cols + k];
      v[0] -= beta;
      let vnorm2 = 0;
      for (let i = 0; i < v.length; i++) vnorm2 += v[i] * v[i];
      if (vnorm2 < 1e-300) continue;
      for (let j = k; j < cols; j++) {
        let s = 0;
        for (let i = 0; i < v.length; i++) s += v[i] * W[(i + k) * cols + j];
        s = 2 * s / vnorm2;
        for (let i = 0; i < v.length; i++) W[(i + k) * cols + j] -= s * v[i];
      }
      {
        let s = 0;
        for (let i = 0; i < v.length; i++) s += v[i] * bb[i + k];
        s = 2 * s / vnorm2;
        for (let i = 0; i < v.length; i++) bb[i + k] -= s * v[i];
      }
    }
    // 回代（R 为上三角，存于 W 的上三角部分）
    const a = new Float64Array(cols);
    for (let i = cols - 1; i >= 0; i--) {
      let s = bb[i];
      for (let j = i + 1; j < cols; j++) s -= W[i * cols + j] * a[j];
      const piv = W[i * cols + i];
      a[i] = Math.abs(piv) < 1e-12 ? 0 : s / piv;
    }
    return a;
  }

  /**
   * Lyapunov 指数谱（Eckmann 算法）
   * @returns {Float64Array} 长度 matrix_dim 的谱；不足长度时返回 null
   */
  function lyapE(data, opts) {
    opts = opts || {};
    const embDim = opts.embDim || 10;
    const matrixDim = opts.matrixDim || 4;
    const tau = (opts.tau === undefined) ? 1 : opts.tau;
    const minTsep = (opts.minTsep === undefined) ? 0 : opts.minTsep;
    const minNb = (opts.minNb === undefined) ? Math.min(2 * matrixDim, matrixDim + 4) : opts.minNb;

    const n = data.length;
    if ((embDim - 1) % (matrixDim - 1) !== 0) throw new Error('emb_dim - 1 must be divisible by matrix_dim - 1');
    const m = (embDim - 1) / (matrixDim - 1);

    // orbit = delay_embedding(data[:-m], emb_dim, lag=1)
    const nData = n - m;
    const M = nData - embDim + 1;          // 轨道向量个数
    const minLen = embDim + m + minTsep * 2 + minNb;
    if (M < minNb + 1 || n < minLen) return null;

    let oldQ = new Float64Array(matrixDim * matrixDim);
    for (let i = 0; i < matrixDim; i++) oldQ[i * matrixDim + i] = 1;
    const lexp = new Float64Array(matrixDim);
    const counts = new Float64Array(matrixDim);

    const diffs = new Float64Array(M);

    for (let i = 0; i < M; i++) {
      // Chebyshev 距离
      for (let j = 0; j < M; j++) {
        let d = 0;
        for (let k = 0; k < embDim; k++) {
          const v = Math.abs(data[i + k] - data[j + k]);
          if (v > d) d = v;
        }
        diffs[j] = d;
      }
      diffs[i] = Infinity;
      const maskFrom = Math.max(0, i - minTsep);
      const maskTo = Math.min(M, i + minTsep + 1);
      for (let j = maskFrom; j < maskTo; j++) diffs[j] = Infinity;

      // 第 minNb 个最近邻的距离 r（top-k 选择）
      let r = Infinity;
      {
        const best = new Float64Array(minNb);
        for (let q = 0; q < minNb; q++) best[q] = Infinity;
        for (let j = 0; j < M; j++) {
          const d = diffs[j];
          if (d < best[minNb - 1]) {
            let p = minNb - 1;
            while (p > 0 && best[p - 1] > d) { best[p] = best[p - 1]; p--; }
            best[p] = d;
          }
        }
        r = best[minNb - 1];
      }
      if (!isFinite(r)) return null;

      // indices = where(diffs <= r)
      let nb = 0;
      for (let j = 0; j < M; j++) if (diffs[j] <= r) nb++;
      const indices = new Int32Array(nb);
      { let c = 0; for (let j = 0; j < M; j++) if (diffs[j] <= r) indices[c++] = j; }

      // 构造 X 与 beta
      const X = new Float64Array(nb * matrixDim);
      const beta = new Float64Array(nb);
      for (let row = 0; row < nb; row++) {
        const j = indices[row];
        for (let q = 0; q < matrixDim; q++) {
          X[row * matrixDim + q] = data[j + q * m] - data[i + q * m];
        }
        beta[row] = data[j + matrixDim * m] - data[i + matrixDim * m];
      }
      const a = lstsq(X, beta, nb, matrixDim);

      // T_i
      const T = new Float64Array(matrixDim * matrixDim);
      for (let q = 0; q < matrixDim - 1; q++) T[q * matrixDim + (q + 1)] = 1;
      for (let q = 0; q < matrixDim; q++) T[(matrixDim - 1) * matrixDim + q] = a[q];

      // A = T @ oldQ
      const A = new Float64Array(matrixDim * matrixDim);
      for (let p = 0; p < matrixDim; p++)
        for (let q = 0; q < matrixDim; q++) {
          let s = 0;
          for (let u = 0; u < matrixDim; u++) s += T[p * matrixDim + u] * oldQ[u * matrixDim + q];
          A[p * matrixDim + q] = s;
        }

      // QR，强制 R 对角为正
      const qr = qrDecompose(A, matrixDim, matrixDim);
      const Q = qr.Q, R = qr.R;
      for (let p = 0; p < matrixDim; p++) {
        if (R[p * matrixDim + p] < 0) {
          for (let q = 0; q < matrixDim; q++) { Q[q * matrixDim + p] = -Q[q * matrixDim + p]; R[p * matrixDim + q] = -R[p * matrixDim + q]; }
        }
      }
      if (opts.onStep) {
        opts.onStep(i, { r: r, nb: nb, a: Array.from(a),
          diagR: [R[0], R[1 * matrixDim + 1], R[2 * matrixDim + 2], R[3 * matrixDim + 3]] });
      }
      oldQ = Q;
      for (let p = 0; p < matrixDim; p++) {
        const d = R[p * matrixDim + p];
        if (d > 0) { lexp[p] += Math.log(d); counts[p] += 1; }
      }
    }

    for (let p = 0; p < matrixDim; p++) {
      lexp[p] = counts[p] > 0 ? lexp[p] / counts[p] : Infinity;
    }
    for (let p = 0; p < matrixDim; p++) lexp[p] = lexp[p] / tau / m;
    return lexp;
  }

  /** 最大 Lyapunov 指数（对应 np.max(nolds.lyap_e(x))） */
  function lyapMax(data, opts) {
    const s = lyapE(data, opts);
    if (!s) return NaN;
    let best = -Infinity;
    for (let i = 0; i < s.length; i++) if (isFinite(s[i]) && s[i] > best) best = s[i];
    return best;
  }

  /* ==================== Pincus Index（近似熵比） ====================
   * ApEn(m, r) 的一次性实现：对给定嵌入维数 m，一次算出所有容忍度 r
   * 对应的 ApEn 值（与 notebook 中逐个 r 调用的 cal_apen 数值等价，
   * 但把 O(N² × R) 的比较降为 O(N²) + O(N² log)）。
   * ================================================================= */

  /**
   * @param {Float64Array} a     序列
   * @param {number} m           嵌入维数
   * @param {Float64Array} toler 容忍度数组（logspace(-10, 1, 50)）
   * @returns {Float64Array} 每个 r 对应的 cal_apen 值（未取绝对值）
   */
  function apenCurve(a, m, toler) {
    const n = a.length;
    const seg = n - m;
    const K = toler.length;
    const out = new Float64Array(K);
    if (seg <= 0) return out;
    // diff[i][k]：距离落在“第 k 个 r 区间”的 j 的个数（前缀和前为差分）
    const W = K + 1;
    const diff = new Float64Array(seg * W);
    for (let i = 0; i < seg; i++) diff[i * W] += 1;   // 自匹配 d = 0 < r_k

    for (let i = 0; i < seg; i++) {
      const baseI = i * W;
      for (let j = i + 1; j < seg; j++) {
        let d = 0;
        for (let k = 0; k < m; k++) {
          const v = Math.abs(a[i + k] - a[j + k]);
          if (v > d) d = v;
        }
        // 求最小的 k 使 d < r_k；r_k = 10^(-10 + 11k/49)
        let b;
        if (d <= 0) b = 0;
        else {
          b = Math.floor((Math.log10(d) + 10) * 49 / 11) + 1;
          if (b < 0) b = 0; else if (b > K) b = K;
        }
        if (b <= K) { diff[baseI + b] += 1; diff[j * W + b] += 1; }
      }
    }
    // 前缀和 → counts[i][k] = #{ j : d_ij < r_k }
    for (let i = 0; i < seg; i++) {
      const base = i * W;
      let acc = 0;
      for (let k = 0; k < K; k++) { acc += diff[base + k]; diff[base + k] = acc; }
    }
    // denom_i = counts/(n-m+1)，0 → 1e-10；ApEn = Σ log(denom)/(n-m)
    const inv = 1 / (n - m + 1);
    for (let k = 0; k < K; k++) {
      let s = 0;
      for (let i = 0; i < seg; i++) {
        let den = diff[i * W + k] * inv;
        if (den === 0) den = 1e-10;
        s += Math.log(den);
      }
      out[k] = s / (n - m);
    }
    return out;
  }

  /** MaxApEn = max_r |ApEn(m+1, r) − ApEn(m, r)|（对应 get_max_apen） */
  function maxApEn(a, m, toler) {
    const c1 = apenCurve(a, m, toler);
    const c2 = apenCurve(a, m + 1, toler);
    let best = 0;
    for (let k = 0; k < toler.length; k++) {
      const v = Math.abs(c2[k] - c1[k]);
      if (v > best) best = v;
    }
    return best;
  }

  /**
   * Pincus Index（对应 get_pincus_index）
   * @param {Float64Array} a 输入序列（内部会复制，不会修改原数组）
   * @param {object} opts { nShuffle, seed, toler, yieldEvery, onProgress }
   * @returns {{PI:number, err:number, shuffled:Float64Array}}
   */
  function pincusIndex(a, opts) {
    opts = opts || {};
    const nShuffle = opts.nShuffle || 100;
    const seed = (opts.seed === undefined) ? 42 : opts.seed;
    const toler = opts.toler || defaultToler();
    const work = Float64Array.from(a);

    const r1 = maxApEn(work, 2, toler);
    const rand = mulberry32(seed);
    const r2 = new Float64Array(nShuffle);
    for (let s = 0; s < nShuffle; s++) {
      shuffle(work, rand);
      r2[s] = maxApEn(work, 2, toler);
    }
    const sorted = Array.prototype.slice.call(r2).sort(function (x, y) { return x - y; });
    const med = median(sorted);
    if (med === 0) return { PI: NaN, err: std(sorted), shuffled: r2 };
    return { PI: r1 / med, err: std(sorted), shuffled: r2 };
  }

  /** 异步版：每 yieldEvery 次重排让出主线程一次，避免界面卡死 */
  function pincusIndexAsync(a, opts) {
    opts = opts || {};
    const nShuffle = opts.nShuffle || 100;
    const seed = (opts.seed === undefined) ? 42 : opts.seed;
    const toler = opts.toler || defaultToler();
    const onProgress = opts.onProgress || function () { };
    const yieldEvery = Math.max(1, Math.floor(opts.yieldEvery || 5));
    const work = Float64Array.from(a);

    function nextFrame() {
      return new Promise(function (res) {
        if (typeof requestAnimationFrame === 'function') requestAnimationFrame(function () { res(); });
        else setTimeout(res, 0);
      });
    }

    return (async function () {
      const r1 = maxApEn(work, 2, toler);
      const rand = mulberry32(seed);
      const r2 = new Float64Array(nShuffle);
      for (let s = 0; s < nShuffle; s++) {
        shuffle(work, rand);
        r2[s] = maxApEn(work, 2, toler);
        if ((s + 1) % yieldEvery === 0) {
          onProgress((s + 1) / nShuffle);
          await nextFrame();
        }
      }
      const sorted = Array.prototype.slice.call(r2).sort(function (x, y) { return x - y; });
      const med = median(sorted);
      onProgress(1);
      if (med === 0) return { PI: NaN, err: std(sorted), shuffled: r2 };
      return { PI: r1 / med, err: std(sorted), shuffled: r2 };
    })();
  }

  /* ====================== 顶层：单源 PLD 计算 ====================== */

  /**
   * @param {number[]} time
   * @param {number[]} energy
   * @param {object} opts
   *   timeUnit    'mjd' | 'second'
   *   gapSec      观测段切分阈值（秒），默认 36000
   *   segmentMode 'busiest'（最活跃段，文章默认）| 'all'（全部合并）
   *   nShuffle, seed
   *   async       true 则返回 Promise
   *   onProgress  (frac, stage) => void
   */
  function computePLD(time, energy, opts) {
    opts = opts || {};
    const timeUnit = opts.timeUnit || 'mjd';
    const gapSec = (opts.gapSec === undefined) ? 36000 : opts.gapSec;
    const mode = opts.segmentMode || 'busiest';
    const onProgress = opts.onProgress || function () { };

    // 排序（按时间）
    const idx = Array.from({ length: Math.min(time.length, energy.length) }, function (_, i) { return i; });
    idx.sort(function (a, b) { return time[a] - time[b]; });
    const t = idx.map(function (i) { return time[i]; });
    const e = idx.map(function (i) { return energy[i]; });

    const segs = splitSessions(t, e, timeUnit, gapSec);
    let useT, useE, nSeg = segs.length, segInfo = 'all';
    if (mode === 'busiest' && segs.length > 0) {
      let best = segs[0];
      for (const s of segs) if (s.count > best.count) best = s;
      useT = best.time; useE = best.energy;
      segInfo = 'busiest session (' + best.count + ' of ' + t.length + ' events; ' + segs.length + ' sessions)';
    } else {
      useT = t; useE = e;
      segInfo = 'all events (' + t.length + ')';
    }

    const seq = buildSequences(useT, useE, timeUnit);
    const base = {
      N: seq.dt.length,
      nEvents: t.length,
      nSegments: nSeg,
      segmentInfo: segInfo,
      timeRange: [t[0], t[t.length - 1]]
    };
    if (seq.dt.length < 8) {
      return Object.assign(base, {
        ok: false, error: '有效数据点不足（差分后 N = ' + seq.dt.length + '），至少需要 30 个点才能得到可靠的 PI / LE。',
        PI: NaN, PI_err: NaN, LE: NaN, PI_t: NaN, PI_E: NaN, LE_t: NaN, LE_E: NaN
      });
    }

    function finish(piT, piE) {
      const leT = lyapMax(seq.scaledT);
      const leE = lyapMax(seq.scaledE);
      const PI = (piT.PI + piE.PI) / 2;
      const PIerr = Math.sqrt(0.25 * (piT.err * piT.err + piE.err * piE.err));
      return Object.assign(base, {
        ok: isFinite(PI) && isFinite(leT) && isFinite(leE),
        PI: PI, PI_err: PIerr, LE: (leT + leE) / 2,
        PI_t: piT.PI, PI_E: piE.PI, LE_t: leT, LE_E: leE,
        error: (isFinite(leT) && isFinite(leE)) ? null : 'Lyapunov 指数计算失败：序列太短或缺少足够的近邻（建议 N ≥ 30）。'
      });
    }

    if (opts.async) {
      return (async function () {
        onProgress(0, 'waiting-time');
        const piT = await pincusIndexAsync(seq.scaledT, {
          nShuffle: opts.nShuffle, seed: opts.seed, toler: opts.toler,
          yieldEvery: opts.yieldEvery,
          onProgress: function (f) { onProgress(f * 0.5, 'waiting-time'); }
        });
        onProgress(0.5, 'energy');
        const piE = await pincusIndexAsync(seq.scaledE, {
          nShuffle: opts.nShuffle, seed: (opts.seed || 42) + 1, toler: opts.toler,
          yieldEvery: opts.yieldEvery,
          onProgress: function (f) { onProgress(0.5 + f * 0.5, 'energy'); }
        });
        return finish(piT, piE);
      })();
    }

    const piT = pincusIndex(seq.scaledT, { nShuffle: opts.nShuffle, seed: opts.seed, toler: opts.toler });
    const piE = pincusIndex(seq.scaledE, { nShuffle: opts.nShuffle, seed: (opts.seed || 42) + 1, toler: opts.toler });
    return finish(piT, piE);
  }

  /* --------------------------- CSV 解析 --------------------------- */

  function parseCSV(text, opts) {
    opts = opts || {};
    const maxRows = opts.maxRows || Infinity;
    text = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
    const lines = text.split('\n');
    // 探测分隔符
    let sep = opts.sep || null;
    if (!sep) {
      const probe = lines.find(function (l) { return l.trim() && !/^\s*#/.test(l); }) || '';
      const cand = [',', ';', '\t', /\s+/];
      let bestCount = -1;
      for (const c of cand) {
        const parts = typeof c === 'string' ? probe.split(c) : probe.split(c);
        if (parts.length > bestCount) { bestCount = parts.length; sep = c; }
      }
      if (bestCount <= 1) sep = ',';
    }
    const rows = [];
    for (let li = 0; li < lines.length && rows.length < maxRows; li++) {
      let line = lines[li];
      if (!line.trim()) continue;
      if (/^\s*(#|%)/.test(line)) continue;
      const parts = typeof sep === 'string' ? line.split(sep) : line.trim().split(sep);
      rows.push(parts.map(function (s) { return s.trim().replace(/^["']|["']$/g, ''); }));
    }
    if (!rows.length) return { time: [], energy: [], header: null, warnings: ['文件为空'] };

    const warnings = [];
    // 判断首行是否为表头
    let start = 0;
    const firstNumeric = rows[0].map(function (v) { return v !== '' && isFinite(parseFloat(v)); });
    let header = null;
    if (firstNumeric.length >= 2 && firstNumeric[0] && firstNumeric[1]) {
      start = 0; header = null;
    } else {
      header = rows[0]; start = 1;
    }

    // 时间列 / 能量列：优先表头名，其次前两列
    let ti = 0, ei = 1;
    if (header) {
      const norm = header.map(function (h) { return String(h).toLowerCase().replace(/[^a-z0-9]/g, ''); });
      const timeKeys = ['time', 'mjd', 't', 'tstart', 'peaktimesecond', 'missionelapsedtime', 'date', 'barycentertime', 'tt'];
      const enKeys = ['energy', 'e', 'fluence', 'flux', 'fluenceerg', 'totalcounts', 'mag'];
      let found = false;
      for (let k = 0; k < norm.length; k++) if (timeKeys.indexOf(norm[k]) >= 0) { ti = k; found = true; break; }
      for (let k = 0; k < norm.length; k++) if (k !== ti && enKeys.indexOf(norm[k]) >= 0) { ei = k; break; }
      if (!found) { ti = 0; ei = 1; }
    }

    const time = [], energy = [];
    let bad = 0;
    for (let i = start; i < rows.length; i++) {
      const row = rows[i];
      if (row.length <= Math.max(ti, ei)) { bad++; continue; }
      const tv = parseFloat(row[ti]);
      const ev = parseFloat(row[ei]);
      if (!isFinite(tv) || !isFinite(ev)) { bad++; continue; }
      time.push(tv); energy.push(ev);
    }
    if (bad > 0) warnings.push('已跳过 ' + bad + ' 行无法解析的数据');
    return { time: time, energy: energy, header: header, timeCol: ti, energyCol: ei, warnings: warnings };
  }

  /* -------------------- 2D 高斯核密度估计（KDE） -------------------- */

  /**
   * 与 scipy.stats.gaussian_kde 完全等价的二维高斯核密度估计。
   *
   *   factor  = n^(-1/(d+4)) = n^(-1/6)        （bw_method='scott'，scipy 默认）
   *   cov     = cov(data, ddof=1) · factor²
   *   inv_cov = inv(cov)
   *   f(p)    = 1/(n·sqrt(det(2π·cov))) · Σ exp(-½ dᵀ inv_cov d)
   *
   * 用的是**完整 2×2 协方差**（含相关项），不是对角近似 —— 相关项会旋转核，
   * 对等值线的形状有实质影响。
   */
  function gaussianKDE2D(points, xgrid, ygrid) {
    const n = points.length;
    const nx = xgrid.length, ny = ygrid.length;
    const out = new Float64Array(nx * ny);
    if (n < 2) return { density: out, bw: [1, 1] };

    let mx = 0, my = 0;
    for (let k = 0; k < n; k++) { mx += points[k][0]; my += points[k][1]; }
    mx /= n; my /= n;
    let c00 = 0, c01 = 0, c11 = 0;
    for (let k = 0; k < n; k++) {
      const dx = points[k][0] - mx, dy = points[k][1] - my;
      c00 += dx * dx; c01 += dx * dy; c11 += dy * dy;
    }
    const dof = n - 1;                        // ddof = 1，与 np.cov 默认一致
    c00 /= dof; c01 /= dof; c11 /= dof;

    const f2 = Math.pow(n, -1 / 3);           // factor² = (n^(-1/6))²
    const a = c00 * f2, b = c01 * f2, c = c11 * f2;
    let det = a * c - b * b;
    if (!(det > 1e-300)) {                    // 退化（近似共线）时补一点抖动
      const eps = 1e-9 * (Math.abs(a) + Math.abs(c) + 1);
      det = (a + eps) * (c + eps) - b * b;
    }
    const i00 = c / det, i01 = -b / det, i11 = a / det;
    const norm = 1 / (n * 2 * Math.PI * Math.sqrt(det));

    for (let i = 0; i < nx; i++) {
      const x = xgrid[i];
      for (let j = 0; j < ny; j++) {
        const y = ygrid[j];
        let s = 0;
        for (let k = 0; k < n; k++) {
          const dx = x - points[k][0], dy = y - points[k][1];
          s += Math.exp(-0.5 * (dx * (i00 * dx + i01 * dy) + dy * (i01 * dx + i11 * dy)));
        }
        out[i * ny + j] = s * norm;
      }
    }
    return { density: out, bw: [Math.sqrt(a), Math.sqrt(c)] };
  }

  /* ------------------ matplotlib Reds 色表（sRGB 线性插值） ------------------ */
  var REDS_STOPS = [
    [0.000, 255, 245, 240], [0.125, 254, 224, 210], [0.250, 252, 187, 161],
    [0.375, 252, 146, 114], [0.500, 251, 106, 74], [0.625, 239, 59, 44],
    [0.750, 203, 24, 29], [0.875, 165, 15, 21], [1.000, 103, 0, 13]
  ];

  function redsColor(t) {
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    for (let i = 0; i < REDS_STOPS.length - 1; i++) {
      const s0 = REDS_STOPS[i], s1 = REDS_STOPS[i + 1];
      if (t <= s1[0]) {
        const u = (t - s0[0]) / (s1[0] - s0[0]);
        return 'rgb(' + Math.round(s0[1] + (s1[1] - s0[1]) * u) + ',' +
          Math.round(s0[2] + (s1[2] - s0[2]) * u) + ',' +
          Math.round(s0[3] + (s1[3] - s0[3]) * u) + ')';
      }
    }
    const s = REDS_STOPS[REDS_STOPS.length - 1];
    return 'rgb(' + s[1] + ',' + s[2] + ',' + s[3] + ')';
  }

  /** matplotlib MaxNLocator 的简化版：在 [vmin, vmax] 上取约 n 个“整齐”的层级 */
  function niceLevels(vmin, vmax, n) {
    if (!(vmax > vmin)) return [vmin];
    const raw = (vmax - vmin) / Math.max(1, n);
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const cand = [1, 2, 2.5, 5, 10].map(function (m) { return m * mag; });
    let step = cand[cand.length - 1];
    for (let i = 0; i < cand.length; i++) { if (cand[i] >= raw) { step = cand[i]; break; } }
    const lo = Math.floor(vmin / step) * step;
    const hi = Math.ceil(vmax / step) * step;
    const out = [];
    for (let v = lo; v <= hi + step * 1e-9; v += step) out.push(parseFloat(v.toPrecision(12)));
    return out;
  }

  /** contourf 配色：层级中点经 [levels[0], levels[-1]] 归一化后查 Reds —— 与 matplotlib 一致 */
  function contourfColors(levels) {
    const out = [];
    const lo = levels[0], hi = levels[levels.length - 1];
    const span = (hi - lo) || 1;
    for (let i = 0; i < levels.length - 1; i++) {
      out.push(redsColor(((levels[i] + levels[i + 1]) / 2 - lo) / span));
    }
    return out;
  }

  /**
   * 填充等值线，等价于 matplotlib 的 contourf(levels=..., cmap='Reds', alpha=...)。
   *
   * 做法：对每个层级 L 用 marching squares 求出 {f ≥ L} 的区域并填充；
   * 由低到高逐层覆盖（后画的盖住先画的），即得到与 contourf 相同的分层色带。
   *
   * @param g      密度网格，长度 nx·ny，下标 i·ny + j（i 沿 x，j 沿 y）
   */
  /** marching squares：把 {f ≥ L} 的边界作为一个个子路径追加到当前 path */
  function addRegion(ctx, g, nx, ny, x0, x1, y0, y1, L) {
    const dx = (x1 - x0) / (nx - 1), dy = (y1 - y0) / (ny - 1);
    const px = [], py = [];
    const emit = function () {
      if (px.length < 3) return;
      ctx.moveTo(px[0], py[0]);
      for (let k = 1; k < px.length; k++) ctx.lineTo(px[k], py[k]);
      ctx.closePath();
    };
    for (let i = 0; i < nx - 1; i++) {
      const xa = x0 + dx * i, xb = x0 + dx * (i + 1);
      for (let j = 0; j < ny - 1; j++) {
        const ya = y0 + dy * j, yb = y0 + dy * (j + 1);
        const v00 = g[i * ny + j], v10 = g[(i + 1) * ny + j];
        const v11 = g[(i + 1) * ny + j + 1], v01 = g[i * ny + j + 1];
        const b00 = v00 >= L, b10 = v10 >= L, b11 = v11 >= L, b01 = v01 >= L;
        const mask = (b00 ? 1 : 0) | (b10 ? 2 : 0) | (b11 ? 4 : 0) | (b01 ? 8 : 0);
        if (mask === 0) continue;
        const ip = function (va, vb) { return (L - va) / (vb - va); };
        const cb = (b00 !== b10) ? [xa + dx * ip(v00, v10), ya] : null;   // 下边
        const cr = (b10 !== b11) ? [xb, ya + dy * ip(v10, v11)] : null;   // 右边
        const ct = (b11 !== b01) ? [xb - dx * ip(v11, v01), yb] : null;   // 上边
        const cl = (b01 !== b00) ? [xa, yb - dy * ip(v01, v00)] : null;   // 左边
        const push = function (p) { if (p) { px.push(p[0]); py.push(p[1]); } };
        const P0 = [xa, ya], P1 = [xb, ya], P2 = [xb, yb], P3 = [xa, yb];

        px.length = 0; py.length = 0;
        if (mask === 15) {
          push(P0); push(P1); push(P2); push(P3); emit();
        } else if (mask === 5) {            // 鞍点：左下 + 右上各一个三角
          push(P0); push(cb); push(cl); emit();
          px.length = 0; py.length = 0;
          push(P2); push(cr); push(ct); emit();
        } else if (mask === 10) {           // 鞍点：挖去左下 + 右上两个角
          push(cb); push(P1); push(cr); push(ct); push(P3); push(cl); emit();
        } else {                            // 其余情形沿单元格边界绕一圈
          if (b00) push(P0);
          push(cb); if (b10) push(P1);
          push(cr); if (b11) push(P2);
          push(ct); if (b01) push(P3);
          push(cl); emit();
        }
      }
    }
  }

  function contourFilled(ctx, g, nx, ny, x0, x1, y0, y1, levels, colors, alpha) {
    if (!g || nx < 2 || ny < 2 || !levels || levels.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    for (let b = 0; b < levels.length - 1; b++) {
      ctx.fillStyle = colors[b] || '#ffffff';
      ctx.beginPath();
      // 偶数-奇数规则：{f ≥ L_b} 减去 {f ≥ L_{b+1}}，正好是第 b 条色带，
      // 与 matplotlib contourf 的分层填充等价（各色带互不叠加）
      addRegion(ctx, g, nx, ny, x0, x1, y0, y1, levels[b]);
      addRegion(ctx, g, nx, ny, x0, x1, y0, y1, levels[b + 1]);
      ctx.fill('evenodd');
    }
    ctx.restore();
  }

  return {
    mulberry32: mulberry32,
    shuffle: shuffle,
    scale: scale,
    median: median,
    std: std,
    defaultToler: defaultToler,
    buildSequences: buildSequences,
    splitSessions: splitSessions,
    lyapE: lyapE,
    lyapMax: lyapMax,
    apenCurve: apenCurve,
    maxApEn: maxApEn,
    pincusIndex: pincusIndex,
    pincusIndexAsync: pincusIndexAsync,
    computePLD: computePLD,
    parseCSV: parseCSV,
    gaussianKDE2D: gaussianKDE2D,
    redsColor: redsColor,
    niceLevels: niceLevels,
    contourfColors: contourfColors,
    contourFilled: contourFilled
  };
});
