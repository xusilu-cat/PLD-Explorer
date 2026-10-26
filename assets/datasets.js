/* =========================================================================
 * datasets.js — 文章中使用的内置数据集元信息
 *
 * 颜色、标记、标签偏移严格取自 figure1.ipynb（cell 8）：
 *   color_list = ['#CB459A'×4, '#787CCAC4', '#9D9D9D'×6, '#313695'×4,
 *                 '#9370DB', '#6B8E23']
 *   marker     = ['o','o','o','o','D','^','^','^','^','^','^',
 *                 '*','*','*','*','s','v']
 *   shift      = plt.text(x + shift_x, y + shift_y, name, ha='center')
 * 20240114A 为特例：KDE 峰值点单独画，标签写在 (PI+0.005, LE-0.007)，ha='left'。
 * ========================================================================= */
window.PLD_GROUPS = [
  { id: 'frb',    label: '重复快速射电暴',   en: 'Repeating FRBs',         color: '#CB459A', marker: 'o' },
  { id: 'radio',  label: '磁星射电脉冲',     en: 'Magnetar radio pulses',  color: '#787CCA', marker: 'D' },
  { id: 'xray',   label: '磁星 X 射线耀发',  en: 'Magnetar X-ray bursts',  color: '#9D9D9D', marker: '^' },
  { id: 'glitch', label: '脉冲星 glitch',    en: 'Pulsar glitches',        color: '#313695', marker: '*' },
  { id: 'eq',     label: '地震',             en: 'Earthquakes',            color: '#9370DB', marker: 's' },
  { id: 'solar',  label: '太阳耀发',         en: 'Solar flares',           color: '#6B8E23', marker: 'v' }
];

window.PLD_DATASETS = [
  /* ------------------------------ FRBs ------------------------------ */
  {
    key: '20220912A', group: 'frb', name: '20220912A', nameEn: '20220912A',
    file: 'FRB220912.csv', timeUnit: 'mjd', segment: 'busiest',
    inst: 'FAST', instEn: 'FAST',
    egu: '各向同性等效爆发能量', eguEn: 'Isotropic-equivalent burst energy',
    color: '#CB459A', marker: 'o', shift: [-0.02, 0.0055],
    desc: 'FAST 观测；取爆发最集中的观测段',
    descEn: 'FAST observations; the most active observing session is used'
  },
  {
    key: '20121102A', group: 'frb', name: '20121102A', nameEn: '20121102A',
    file: 'FRB121102.csv', timeUnit: 'mjd', segment: 'busiest',
    inst: 'FAST', instEn: 'FAST',
    egu: '各向同性等效爆发能量', eguEn: 'Isotropic-equivalent burst energy',
    color: '#CB459A', marker: 'o', shift: [0, 0.0055],
    desc: '首个被确认的重复暴；取最活跃观测段',
    descEn: 'The first confirmed repeater; the most active session is used'
  },
  {
    key: '20190520B', group: 'frb', name: '20190520B', nameEn: '20190520B',
    file: 'FRB190520.csv + 190520-Parkes.csv', timeUnit: 'mjd', segment: 'busiest',
    inst: 'FAST + Parkes', instEn: 'FAST + Parkes',
    egu: '各向同性等效爆发能量', eguEn: 'Isotropic-equivalent burst energy',
    color: '#CB459A', marker: 'o', shift: [0, 0.0055],
    desc: 'FAST 与 Parkes 数据合并后取最活跃观测段',
    descEn: 'FAST and Parkes data combined; the most active session is used'
  },
  {
    key: '20201124A', group: 'frb', name: '20201124A', nameEn: '20201124A',
    file: 'FRB201124.csv', timeUnit: 'mjd', segment: 'busiest',
    inst: 'FAST', instEn: 'FAST',
    egu: '各向同性等效爆发能量', eguEn: 'Isotropic-equivalent burst energy',
    color: '#CB459A', marker: 'o', shift: [-0.025, -0.01],
    desc: 'FAST 观测；处于活跃期的重复暴',
    descEn: 'FAST observations of a hyper-active repeater'
  },
  {
    key: '20240114A', group: 'frb', name: '20240114A', nameEn: '20240114A',
    file: '240114_with_rate.csv', raw: 'FRB240114.csv',
    inst: 'FAST', instEn: 'FAST',
    egu: '各向同性等效爆发能量', eguEn: 'Isotropic-equivalent burst energy',
    timeUnit: 'mjd', segment: 'sessions', kde: true,
    color: '#a50026', marker: 'o', shift: [0.005, -0.007], labelAlign: 'left',
    desc: '逐观测段 (PI, LE) 的二维核密度分布；红色等值线为 KDE，实心点为密度峰值',
    descEn: 'Kernel-density distribution of per-session (PI, LE); red contours are the KDE, the filled dot marks the density peak',
    extra: 'KDE 点云取自 240114_with_rate.csv 的 PI / LE 两列（40 个观测段），与 figure1.ipynb 完全相同',
    extraEn: 'The KDE point cloud is taken directly from the PI / LE columns of 240114_with_rate.csv (40 sessions), exactly as in figure1.ipynb'
  },

  /* --------------------------- Magnetars ---------------------------- */
  {
    key: 'SGR J1935+2154 (radio)', group: 'radio', name: 'SGR J1935+2154 (radio)', nameEn: 'SGR J1935+2154 (radio)',
    file: 'SGR J1935+2154 radio.csv', timeUnit: 'mjd', segment: 'busiest',
    inst: 'FAST', instEn: 'FAST',
    egu: '各向同性等效爆发能量', eguEn: 'Isotropic-equivalent burst energy',
    color: '#787CCA', marker: 'D', shift: [-0.08, -0.005],
    desc: '银河系磁星的射电脉冲序列',
    descEn: 'Radio pulse sequence of a Galactic magnetar'
  },
  {
    key: 'SGR J1550-5418', group: 'xray', name: 'SGR J1550-5418', nameEn: 'SGR J1550-5418',
    file: 'SGR J1550-5418.csv', timeUnit: 'mjd', segment: 'busiest',
    inst: 'Fermi-GBM', instEn: 'Fermi-GBM',
    egu: 'COMP 模型注量', eguEn: 'Fluence from comptonized-model fits',
    color: '#9D9D9D', marker: '^', shift: [0, 0.0055],
    desc: 'X 射线耀发序列（MJD，秒级时间戳）',
    descEn: 'X-ray burst sequence (MJD, sub-minute time stamps)'
  },
  {
    key: 'SGR J0501+4516', group: 'xray', name: 'SGR J0501+4516', nameEn: 'SGR J0501+4516',
    file: 'SGR J0501+4516.csv', timeUnit: 'mjd', segment: 'all',
    inst: 'Fermi-GBM', instEn: 'Fermi-GBM',
    egu: 'COMP 模型注量', eguEn: 'Fluence from comptonized-model fits',
    color: '#9D9D9D', marker: '^', shift: [-0.01, -0.018],
    desc: '样本很少，直接使用全部爆发，不切观测段',
    descEn: 'Small sample; all bursts are used without session splitting'
  },
  {
    key: 'SGR 1806-20', group: 'xray', name: 'SGR 1806-20', nameEn: 'SGR 1806-20',
    file: 'SGR 1806-20.csv', timeUnit: 'mjd', segment: 'busiest',
    inst: 'RXTE', instEn: 'RXTE',
    egu: '光子计数', eguEn: 'Reported photon counts',
    color: '#9D9D9D', marker: '^', shift: [0, 0.0055],
    desc: 'X 射线爆发；时间列 = 任务经过时 MET ÷ 86400，单位为天',
    descEn: 'X-ray bursts; the time column is mission elapsed time (MET) divided by 86400, i.e. in days',
    extra: 'dt 与观测段切分均按天处理（换算到秒后与 36000 s 阈值比较），与 figure1.ipynb 的 np.diff(time)*24*60*60 一致',
    extraEn: 'Both dt and session splitting treat the column as days (converted to seconds before comparing with the 36000 s threshold), consistent with np.diff(time)*24*60*60 in figure1.ipynb'
  },
  {
    key: 'SGR 1900+14', group: 'xray', name: 'SGR 1900+14', nameEn: 'SGR 1900+14',
    file: 'SGR 1900+14.csv', timeUnit: 'mjd', segment: 'busiest',
    inst: 'RXTE', instEn: 'RXTE',
    egu: '光子计数', eguEn: 'Reported photon counts',
    color: '#9D9D9D', marker: '^', shift: [0.025, -0.016],
    desc: 'X 射线爆发；时间列 = MET ÷ 86400，单位为天',
    descEn: 'X-ray bursts; the time column is MET/86400, i.e. in days'
  },
  {
    key: 'SGR J1935+2154 (x-ray 2020)', group: 'xray', name: 'SGR J1935+2154 (x-ray2020)', nameEn: 'SGR J1935+2154 (x-ray2020)',
    file: 'SGR J1935+2154_y2020.csv', timeUnit: 'second', segment: 'busiest',
    inst: 'NICER', instEn: 'NICER',
    egu: '积分通量（黑体 / 幂律拟合）', eguEn: 'Burst-integrated flux',
    color: '#9D9D9D', marker: '^', shift: [0, 0.0055],
    desc: '2020 年活跃期的 X 射线暴；峰时以秒计',
    descEn: 'X-ray bursts in the 2020 active episode; peak times are in seconds'
  },
  {
    key: 'SGR J1935+2154 (x-ray 2022)', group: 'xray', name: 'SGR J1935+2154 (x-ray2022)', nameEn: 'SGR J1935+2154 (x-ray2022)',
    file: 'SGR J1935+2154_y2022.csv', timeUnit: 'second', segment: 'busiest',
    inst: 'NICER', instEn: 'NICER',
    egu: '积分通量（黑体 / 幂律拟合）', eguEn: 'Burst-integrated flux',
    color: '#9D9D9D', marker: '^', shift: [0, 0.0055],
    desc: '2022 年活跃期的 X 射线暴；峰时以秒计',
    descEn: 'X-ray bursts in the 2022 active episode; peak times are in seconds'
  },

  /* ---------------------------- Glitches ---------------------------- */
  {
    key: 'PSR J0537-6910 (glitch)', group: 'glitch', name: 'PSR J0537-6910 (glitch)', nameEn: 'PSR J0537-6910',
    file: 'glitch J0537-6910.csv', timeUnit: 'mjd', segment: 'all',
    inst: 'ATNF / Jodrell Bank 星表', instEn: 'ATNF / Jodrell Bank',
    egu: '转动能变化', eguEn: 'Change in rotational energy',
    color: '#313695', marker: '*', shift: [0, 0.0055],
    desc: '自转能跳变序列；考察长时标的 glitch 行为',
    descEn: 'Rotation-energy glitch sequence; long-term glitch behaviour'
  },
  {
    key: 'PSR B0833-45 (glitch)', group: 'glitch', name: 'PSR B0833-45 (glitch)', nameEn: 'PSR B0833-45 (glitch)',
    file: 'glitch B0833-45.csv', timeUnit: 'mjd', segment: 'all',
    inst: 'ATNF / Jodrell Bank 星表', instEn: 'ATNF / Jodrell Bank',
    egu: '转动能变化', eguEn: 'Change in rotational energy',
    color: '#313695', marker: '*', shift: [0, 0.0055],
    desc: 'Vela 脉冲星自转能跳变序列',
    descEn: 'Rotation-energy glitch sequence of the Vela pulsar'
  },
  {
    key: 'PSR B1338-62 (glitch)', group: 'glitch', name: 'PSR B1338-62 (glitch)', nameEn: 'PSR B1338-62',
    file: 'glitch B1338-62.csv', timeUnit: 'mjd', segment: 'all',
    inst: 'ATNF / Jodrell Bank 星表', instEn: 'ATNF / Jodrell Bank',
    egu: '转动能变化', eguEn: 'Change in rotational energy',
    color: '#313695', marker: '*', shift: [0, 0.0055],
    desc: '自转能跳变序列',
    descEn: 'Rotation-energy glitch sequence'
  },
  {
    key: 'PSR B1737-30 (glitch)', group: 'glitch', name: 'PSR B1737-30 (glitch)', nameEn: 'PSR B1737-30',
    file: 'glitch B1737-30.csv', timeUnit: 'mjd', segment: 'all',
    inst: 'ATNF / Jodrell Bank 星表', instEn: 'ATNF / Jodrell Bank',
    egu: '转动能变化', eguEn: 'Change in rotational energy',
    color: '#313695', marker: '*', shift: [0, 0.005],
    desc: '自转能跳变序列（MJD 46991–59934，共 37 次 glitch）',
    descEn: 'Rotation-energy glitch sequence (MJD 46991–59934, 37 glitches)'
  },

  /* -------------------------- Earthquakes --------------------------- */
  {
    key: 'Earthquake', group: 'eq', name: 'Earthquake', nameEn: 'Earthquake',
    file: 'EarthQuake.csv', timeUnit: 'mjd', segment: 'grid',
    inst: 'SCEDC 地震目录', instEn: 'SCEDC catalogue',
    egu: '震级换算：log₁₀E = 12.24 + 1.44M', eguEn: 'Energy from magnitude: log₁₀E = 12.24 + 1.44M',
    color: '#9370DB', marker: 's', shift: [0, 0.0055],
    desc: '全球地震目录（M ≥ 4）；按 2° × 2° 经纬网格分组后拼接等待时间与能量差分序列',
    descEn: 'Global earthquake catalogue (M ≥ 4); waiting-time and energy-increment sequences are concatenated over 2° × 2° lon–lat cells',
    extra: '数据文件约 37 MB，未内嵌于网页，此处显示的是文章发表值。figure1.ipynb 原先写成 (latlabel==i)&(latlabel==j)（第二个为笔误），已按作者确认改为 lonlabel。网站对上传数据只做常规观测段切分，不做经纬网格分组，因此自行上传复算的结果不会与文章一致。',
    extraEn: 'The catalogue (~37 MB) is not embedded; the published values are shown. The notebook originally used (latlabel==i)&(latlabel==j) — a typo for the second term — and has been corrected to lonlabel as confirmed by the author. Uploaded data are only split by observing session, never by geographic cell, so re-computed results will not match the paper.'
  },

  /* -------------------------- Solar flares -------------------------- */
  {
    key: 'Solar Flare', group: 'solar', name: 'Solar Flare', nameEn: 'Solar Flare',
    file: 'SolarFlare.csv', timeUnit: 'mjd', segment: 'all',
    inst: 'Hinode XRT / GOES XRS', instEn: 'Hinode XRT / GOES XRS',
    egu: 'GOES XRS 等级换算', eguEn: 'Energy from the GOES XRS class',
    color: '#6B8E23', marker: 'v', shift: [0, 0.012],
    desc: 'GOES 耀斑目录；取 MJD 55500–57500 且能量 > 5 × 10⁻⁶ 的事件',
    descEn: 'GOES flare catalogue; events with MJD 55500–57500 and energy > 5 × 10⁻⁶'
  }
];

/* 用户上传数据用的备用配色（与文章配色区分开） */
window.PLD_USER_COLORS = [
  '#d95f02', '#1b9e77', '#e7298a', '#66a61e', '#a6761d',
  '#7570b3', '#e41a1c', '#377eb8', '#4daf4a', '#984ea3',
  '#ff7f00', '#00ced1', '#8b4513', '#4682b4'
];

/* ------------------------------------------------------------------
 * 可下载的原始 CSV（与 web/data/ 下的文件一一对应）
 * size 为字节数，用于页面上显示文件大小。
 * ------------------------------------------------------------------ */
window.PLD_FILES = [
  { file: 'FRB220912.csv',                 size: 23553,    group: 'frb',
    desc: 'FRB 20220912A — FAST 爆发目录（MJD, Energy）',
    descEn: 'FRB 20220912A — FAST burst catalogue (MJD, Energy)' },
  { file: 'FRB121102.csv',                 size: 36428,    group: 'frb',
    desc: 'FRB 20121102A — 爆发目录',
    descEn: 'FRB 20121102A — burst catalogue' },
  { file: 'FRB190520.csv',                 size: 4802,     group: 'frb',
    tag: 'FAST', tagEn: 'FAST',
    desc: 'FRB 20190520B — FAST 爆发目录',
    descEn: 'FRB 20190520B — FAST burst catalogue' },
  { file: '190520-Parkes.csv',             size: 4524,     group: 'frb',
    tag: 'Parkes', tagEn: 'Parkes',
    desc: 'FRB 20190520B — Parkes 爆发目录（与上一份合并后使用）',
    descEn: 'FRB 20190520B — Parkes burst catalogue (combined with the one above)' },
  { file: 'FRB201124.csv',                 size: 19280,    group: 'frb',
    desc: 'FRB 20201124A — FAST 爆发目录',
    descEn: 'FRB 20201124A — FAST burst catalogue' },
  { file: 'FRB240114.csv',                 size: 242380,   group: 'frb',
    tag: '原始目录', tagEn: 'catalogue',
    desc: 'FRB 20240114A — 原始爆发目录（含观测段编号）',
    descEn: 'FRB 20240114A — raw burst catalogue (with session numbers)' },
  { file: '240114_with_rate.csv',          size: 122524,   group: 'frb',
    tag: '逐段 PI/LE', tagEn: 'per-session',
    desc: 'FRB 20240114A — 逐观测段的 PI / LE / burst_num（文章 KDE 的直接输入）',
    descEn: 'FRB 20240114A — per-session PI / LE / burst_num (direct input of the KDE)' },

  { file: 'SGR J1935+2154 radio.csv',      size: 12335,    group: 'radio',
    desc: 'SGR J1935+2154 — 射电脉冲序列',
    descEn: 'SGR J1935+2154 — radio pulse sequence' },

  { file: 'SGR J1550-5418.csv',            size: 11272,    group: 'xray',
    desc: 'SGR J1550-5418 — X 射线耀发（MJD，秒级时间戳）',
    descEn: 'SGR J1550-5418 — X-ray bursts (MJD, sub-minute time stamps)' },
  { file: 'SGR J0501+4516.csv',            size: 902,      group: 'xray',
    desc: 'SGR J0501+4516 — X 射线耀发',
    descEn: 'SGR J0501+4516 — X-ray bursts' },
  { file: 'SGR 1806-20.csv',               size: 23126,    group: 'xray',
    desc: 'SGR 1806-20 — X 射线爆发（时间列 = MET ÷ 86400，单位为天）',
    descEn: 'SGR 1806-20 — X-ray bursts (time column = MET / 86400, in days)' },
  { file: 'SGR 1900+14.csv',               size: 10863,    group: 'xray',
    desc: 'SGR 1900+14 — X 射线爆发（时间列 = MET ÷ 86400，单位为天）',
    descEn: 'SGR 1900+14 — X-ray bursts (time column = MET / 86400, in days)' },
  { file: 'SGR J1935+2154_y2020.csv',      size: 3866,     group: 'xray',
    desc: 'SGR J1935+2154 — 2020 年活跃期 X 射线暴（峰时以秒计）',
    descEn: 'SGR J1935+2154 — 2020 X-ray bursts (peak times in seconds)' },
  { file: 'SGR J1935+2154_y2022.csv',      size: 5575,     group: 'xray',
    desc: 'SGR J1935+2154 — 2022 年活跃期 X 射线暴（峰时以秒计）',
    descEn: 'SGR J1935+2154 — 2022 X-ray bursts (peak times in seconds)' },

  { file: 'glitch J0537-6910.csv',         size: 1241,     group: 'glitch',
    desc: 'PSR J0537-6910 — 自转能 glitch 序列',
    descEn: 'PSR J0537-6910 — rotation-energy glitch sequence' },
  { file: 'glitch B0833-45.csv',           size: 522,      group: 'glitch',
    desc: 'PSR B0833-45（Vela）— 自转能 glitch 序列',
    descEn: 'PSR B0833-45 (Vela) — rotation-energy glitch sequence' },
  { file: 'glitch B1338-62.csv',           size: 632,      group: 'glitch',
    desc: 'PSR B1338-62 — 自转能 glitch 序列',
    descEn: 'PSR B1338-62 — rotation-energy glitch sequence' },
  { file: 'glitch B1737-30.csv',           size: 758,      group: 'glitch',
    desc: 'PSR B1737-30 — 自转能 glitch 序列',
    descEn: 'PSR B1737-30 — rotation-energy glitch sequence' },

  { file: 'EarthQuake.csv',                size: 36894823, group: 'eq',
    desc: '全球地震目录（M ≥ 4），约 36 MB',
    descEn: 'Global earthquake catalogue (M ≥ 4), ~36 MB' },
  { file: 'SolarFlare.csv',                size: 749722,   group: 'solar',
    desc: 'GOES 太阳耀斑目录',
    descEn: 'GOES solar-flare catalogue' }
];

/* 文章数据的数据来源（Science Data Bank） */
window.PLD_DATASOURCE = {
  title: 'A Stochasticity-Chaos Analysis of Magnetar Flares, Glitches, Solar Flares, Earthquakes, FRBs and Repeating Source FRB 20240114A',
  authors: 'Silu XU, Yongkun Zhang, Pei Wang, et al.',
  publisher: 'Science Data Bank',
  year: '2026',
  version: 'V1',
  accessed: '2026-10-24',
  url: 'https://doi.org/10.57760/sciencedb.fastro.00031',
  doi: '10.57760/sciencedb.fastro.00031'
};
