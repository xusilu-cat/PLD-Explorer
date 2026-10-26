# PLD Explorer

**PLD Explorer** is an interactive, browser-based tool for exploring the **Pincus–Lyapunov Diagram (PLD)**, which characterizes time–energy sequences using the Pincus Index (PI) and Lyapunov Exponent (LE).

The tool accompanies the paper:

> S.-L. Xu, Y.-K. Zhang, P. Wang, D. Li, et al.,  
> “Fast radio bursts, magnetars and earthquakes: Their ‘family feud’?”  
> *Science China Physics, Mechanics & Astronomy*, **69**, 109511 (2026).  
> https://doi.org/10.1007/s11433-026-3030-x

**Online demo:** https://xusilu-cat.github.io/PLD-Explorer/

**Data archive:** Science Data Bank, https://doi.org/10.57760/sciencedb.fastro.00031

The application is a static website. Its calculations and visualizations run in the browser; no server-side computation is required.

## Features

- **Published PLD values:** Explore the 18 data points shown in Figure 1 of the paper. The plotted PI, LE, and PI uncertainties are taken from the published figure, rather than recalculated by the page.
- **Data selection:** Select datasets to display them on the diagram, with source labels and error bars.
- **CSV upload:** Load multiple files at once. A header row is optional; comma-, semicolon-, tab-, and whitespace-separated data are supported.
- **Manual input:** Paste two columns containing time and event amplitude/energy.
- **In-browser analysis:** Calculate the Pincus Index and Lyapunov Exponent for user-supplied sequences, with progress feedback and an estimated run time.
- **Plotting:** Canvas-based PLD visualization, including error bars, source-specific label offsets, a star marker for pulsar glitches, and KDE contours for FRB 20240114A.
- **Export:** Save the plot as a 2× PNG (approximately equivalent to 300 dpi), export a CSV results table, or download a sample data template.
- **Bilingual interface:** Switch between English and Chinese.
- **Dataset downloads:** Download the included source CSV files from the dataset table, where available.

## Data availability

Most source CSV files used by the project are included in the repository under `data/` (approximately 37 MB in total).

**`EarthQuake.csv` is not included in this GitHub repository because the file exceeds GitHub's 25 MB web-upload limit.** Download the dataset from the project's Science Data Bank archive:

**Science Data Bank:** https://doi.org/10.57760/sciencedb.fastro.00031

After downloading `EarthQuake.csv`, place it in the local `data/` directory if you want to use that file locally. The online application may not be able to retrieve the file from this repository while it is absent; download it from Science Data Bank for access to the complete earthquake dataset.

## Data format

The application accepts two columns: time and event amplitude/energy. For example:

```csv
time,Energy
59093.151961,1.90023964159762e+38
59093.152157,5.332552452872839e+38
```

- **Column 1: time.** Use Modified Julian Date (MJD), in days, and retain at least five decimal places where possible. If the original timestamps are in seconds (for example, mission elapsed time), select seconds as the input time unit in the interface.
- **Column 2: event amplitude/energy.** The units can be arbitrary, but should be consistent within a sequence.
- **Normalization:** The waiting-time sequence, \(\Delta t\), and the energy-difference sequence, \(\Delta E\), are each min–max normalized. Consequently, the absolute energy unit and a linear rescaling of time do not affect PI or LE.
- **Segmentation caveat:** The 36,000 s observation-gap threshold is an absolute time threshold applied before normalization, so changing the time unit or scale can affect how the sequence is segmented. Make sure the selected input time unit is correct.

## How the built-in datasets are handled

The built-in datasets follow the sequence-construction choices used in the paper. The “segmentation” option in the interface applies to uploaded or manually entered data; it does not override the processing choices for built-in datasets.

| Mode | Used for | Description |
| --- | --- | --- |
| `busiest` | Repeating FRBs and magnetars | Split observations using a 10-hour threshold and select the segment containing the most bursts. |
| `all` | Pulsar glitches and sparse sources | Combine all events. For example, SGR J0501+4516 has too few bursts after segmentation to calculate LE reliably. |
| `grid` | Earthquakes | Group events into 2° × 2° geographic grids and combine the events within each grid. |
| `sessions` | FRB 20240114A | Use per-observation-session PI and LE values from `240114_with_rate.csv` to construct the two-dimensional KDE distribution. |

## Instrumentation and event-amplitude definitions

The instrument and event-amplitude definitions shown in the dataset table follow Table 1 and Section 2 of the paper.

| Source or source group | Instrument / data source | Event-amplitude definition |
| --- | --- | --- |
| Five repeating FRBs and radio bursts from SGR J1935+2154 | FAST; Parkes is also used for FRB 20190520B | Isotropic-equivalent burst energy (erg) |
| SGR J1550−5418 and SGR J0501+4516 | Fermi-GBM | Fluence from Comptonized (COMP) spectral-model fits |
| SGR 1806−20 and SGR 1900+14 | RXTE data compiled by the Sabancı University Magnetar Database | Photon counts listed in the database |
| SGR J1935+2154 X-ray bursts (2020 and 2022) | NICER | Flux integrated over burst duration after absorbed blackbody or power-law spectral fitting |
| Four pulsar-glitch sources | ATNF Pulsar Catalogue and Jodrell Bank glitch data (radio timing) | Change in rotational energy |
| Earthquakes | Southern California Earthquake Data Center (SCEDC) catalogue | Energy estimated from magnitude using \(\log_{10} E = 12.24 + 1.44M\) (Båth 1966) |
| Solar flares | Hinode XRT / GOES XRS | Empirical conversion from NOAA GOES XRS flare class |

These quantities are used as **relative event-amplitude measures**. The analysis focuses on relative statistical properties; it does not require the listed quantities to be directly interchangeable absolute-energy measurements.

## Algorithms and numerical implementation

The main calculation engine is `assets/pld-core.js`, a JavaScript implementation of the procedures used in `figure1.ipynb`.

### Lyapunov Exponent (LE)

The implementation follows `nolds.lyap_e`, based on the Eckmann et al. (1986) method, with default parameters:

- `emb_dim = 10`
- `matrix_dim = 4`
- `tau = 1`
- `min_nb = 8`

The implementation includes delay embedding, Chebyshev-neighbor searches, least-squares Jacobian estimation, and accumulated QR decomposition. Tests against `nolds` gave relative differences of approximately \(10^{-15}\), at machine precision, for the tested sequences.

### Pincus Index (PI)

The PI implementation uses `cal_apen`, `get_max_apen`, and `get_pincus_index`. The tolerance values are sampled from `logspace(-10, 1, 50)`, and the median of 100 random permutations is used. To reduce computation time, the implementation calculates the distance matrix once and reuses sorted distances/bins instead of repeatedly recalculating the distance matrix for every tolerance.

### Kernel density estimation (KDE) and contours

The Gaussian KDE implementation follows `scipy.stats.gaussian_kde`, using Scott's factor \(n^{-1/6}\), `ddof = 1`, and the full 2 × 2 covariance matrix including the correlation term. The reported maximum absolute grid difference in validation was approximately \(6 \times 10^{-4}\).

The contour renderer uses marching squares and even-odd path filling to draw layered contour bands. The precomputed KDE grid, contour levels, and colors for FRB 20240114A are stored in `assets/kde-240114.js`; the density grid is recalculated when the plot limits change.

### Validation

The JavaScript implementation was compared with Python calculations for four real sequences: the waiting-time/energy sequences of FRB 20220912A, radio bursts from SGR J1935+2154, a PSR J0537−6910 glitch sequence, and SGR J1935+2154 X-ray bursts from 2020. In these tests, LE relative differences were approximately \(10^{-15}\); PI relative differences were around \(10^{-3}\) to \(3 \times 10^{-2}\), consistent with Monte Carlo variation from random permutations.

## Published values versus recalculated values

The PI, LE, and PI error bars displayed for the paper's Figure 1 data points are taken from the vector coordinates in the published `figure1.pdf`. They are not replaced by browser-side recalculations. The `assets/reference.js` file records results recalculated from the repository CSVs for reference and validation; it is not used to determine the plotted published values.

For FRB 20240114A, the KDE contour data are precomputed to reproduce the paper's plotted distribution at the default view. The density peak is at approximately PI = 0.9001 and LE = 0.1002.

## Repository structure

```text
PLD-Explorer/
├── index.html
├── assets/
│   ├── style.css
│   ├── cover.jpg 
│   ├── i18n.js
│   ├── pld-core.js
│   ├── app.js
│   ├── datasets.js
│   ├── reference.js
│   ├── article-values.js
│   ├── kde-240114.js
│   └── embedded-data.js
├── data/
│   └── source CSV files (EarthQuake.csv is not included)
└── README.md
```

The exact files in `data/` may vary with the version of the repository.

## Regenerating the embedded data

After updating the source CSV files, run the following commands from the project root:

```bash
python pld_reference.py
python gen_kde240114.py
python build_embedded.py
```

- `pld_reference.py` recalculates the reference values and updates `assets/reference.js`. The earthquake dataset is the most time-consuming part; a full run may take about 10 minutes.
- `gen_kde240114.py` regenerates the KDE data for FRB 20240114A and outputs `_check_figure1.png` for visual comparison with the published figure.
- `build_embedded.py` packages the source sequences into `assets/embedded-data.js`.

These scripts require the corresponding Python dependencies and source data files. In particular, download `EarthQuake.csv` from ScienceDB before running a full regeneration that requires the earthquake data.

## References

- Pincus, S. M. (1991), Approximate entropy as a measure of system complexity.
- Eckmann, J.-P., et al. (1986), Lyapunov exponents from time series.
- Delgado-Bonal (2019), work on entropy-based time-series analysis.
- Schölzel (2019), Zenodo resource cited in the project.
- Xu, S.-L., et al. (2026), “Fast radio bursts, magnetars and earthquakes: Their ‘family feud’?” https://doi.org/10.1007/s11433-026-3030-x

## Citation

If you use this tool or its datasets in your research, please cite the accompanying paper and the data archive:

> Xu, S.-L., Zhang, Y.-K., Wang, P., Li, D., et al. (2026). “Fast radio bursts, magnetars and earthquakes: Their ‘family feud’?” *Science China Physics, Mechanics & Astronomy*, 69, 109511. https://doi.org/10.1007/s11433-026-3030-x

Data archive: https://doi.org/10.57760/sciencedb.fastro.00031
