# FinSight AI data directory

```
data/
├── companies/     # Preloaded fundamentals (seeded into PostgreSQL by scripts.seed)
├── eval/          # Labelled RAGAS evaluation datasets (JSON rows)
├── raw/           # Uploaded source files (git-ignored)
├── processed/     # Derived artefacts: normalised tables, embeddings cache
└── uploads/       # Local object-store fallback when MinIO/R2 is unavailable
```

## Company datasets

Each `companies/*.json` file describes one company and its fiscal-year
statements:

```jsonc
{
  "slug": "tcs",
  "ticker": "TCS",
  "name": "...",
  "statements": [ { "fiscal_year": 2025, "revenue": 255324, ... } ]
}
```

**Units:** all monetary values are in **INR crore**, matching how Indian
filings report. Ratios and growth rates are dimensionless decimals.

**Important:** the bundled figures are *illustrative sample data* shaped like
real annual-report numbers so the UI, charts and SQL layer can be built and
tested. Replace them with audited figures (or wire up a filings ingestion
source) before using FinSight for real analysis.

### Adding a company

1. Drop a new `<slug>.json` following the schema above.
2. Run `make seed` (idempotent - upserts by `slug` + `fiscal_year`).
3. `GET /api/v1/companies` should now list it.
