# 12 · Minerva Red

Author: Stella Ioannidou · Started: 2026-11-02 · Status: sketch · Stack: static HTML + JS

Minerva Red follows the dust of the 2024 duststorm that covered Greece and Libya, to trace a lineage of environmental degradation, oil mulching, colonial settlement.

## Run

Online, once published: https://stellaioann.github.io/weather-commons/12-minerva-red/

On your computer:

```bash
cd sketches/12-minerva-red
python -m http.server 8000
```

Then open http://localhost:8000.

The page reads `data/`, which `tools/prep.py` makes from the working folders (Landsat frames, NDVI images, Zelten frames and flare tables, CAMS dust frames, base map). From the folder that holds them: `python /path/to/sketches/12-minerva-red/tools/prep.py /path/to/sketches/12-minerva-red` (needs numpy and Pillow).

## 1. Event

The 2024 dust storm that carried dust from Libya over Athens and turned the sky red. Exact dates, extent and measurements: to check and add.

## 2. Simulate

A map from Tripoli to Crete in a tilted top-down view, told in five steps (texts at the top of `app.js`), then free to move.

- **Al Atayah** (13.48–13.85° E, 32.58–32.86° N): one Landsat picture per year on the ground; above it, a block where height is time. A 72 m cell is marked in the year its vegetation index (NDVI) rose (rust) or fell (sand) by more than 0.10 between the 3 years before and the 3 after, if at least 5 of its 8 neighbours changed the same way.
- **Zelten** (19.59–19.96° E, 28.78–29.06° N): Landsat pictures on the ground; above, the 2 km around the three flares, enlarged ten times. A point is a 30 m pixel detected burning in at least 2 passes that year, sized by the share of clear passes that detected it. From 2012 the yearly gas volume flared, from VIIRS Nightfire.
- **The storm**: dust optical depth from the CAMS forecast, every 3 hours from 21 to 24 April 2024, drawn as a sheet a little above the map. The more dust, the more opaque (thresholds set when the frames were made).

## 3. Situate

Where the dust rose in Libya and where it fell in Athens, and the history of the land it came from: deforestation, oil mulching to fix dunes, Esso's oil drilling, Italian colonization. Places, dates and institutions: to add from Stella's research.

## 4. Narrate

The story in a few sentences. What can a viewer learn here, and what should they not conclude?

## Sources and limits

For every dataset: who made it, which version and date, when you downloaded it, its licence, and what you changed. Say whether each layer is observed, reanalysed, modelled, synthetic or interpretive. Then say what this sketch cannot show.

- Al Atayah and Zelten pictures: Landsat 1–9 Collection 2 (USGS), through Google Earth Engine, observed. Hand-selected scenes, false colour. Reprojected from UTM and placed by their lat/lon frame, so edges may be off by up to about 1 %.
- Al Atayah vegetation change: NDVI from the same scenes, derived from observations. MSS values before 1984 corrected to TM with a fit from 28 same-day pairs (stable ground agrees within ±0.025); small OLI–TM offset (+0.015) left in. The first and last 3 years cannot show change.
- Zelten flares: Landsat 4–9 top-of-atmosphere shortwave infrared, a Schroeder et al. (2016)-style test, observed. The share counts passes, not hours burning; there are few passes before 2000 and detection leans to summer. The 2020 blockade (January–September) and the 2011 war show as gaps.
- Zelten gas volume: VIIRS Nightfire, Earth Observation Group, Payne Institute, observed, 2012–2024. About 750 m pixels; processing versions differ between years.
- Dust: CAMS global atmospheric composition forecasts (ECMWF), dust aerosol optical depth at 550 nm, via Google Earth Engine (`ECMWF/CAMS/NRT`), modelled. About 40 km cells, every 3 hours. A model estimate, not a satellite image.
- Coastline: US Department of State LSIB borders via Google Earth Engine, cartographic.
- Deforestation, oil mulching, Esso drilling and Italian colonization in Libya: interpretive, from personal research. Sources to add.


This folder was first started on 2026-11-02 as an experiment called "EGAS: CC(U)S plans with Eni" and renamed to Minerva Red on 2026-11-09, keeping number 12.
