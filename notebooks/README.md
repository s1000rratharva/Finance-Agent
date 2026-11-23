# Notebooks

Exploratory work lives here; production code belongs in `backend/app`.

Suggested roadmap:

| Notebook | Purpose |
| --- | --- |
| `01_eda_companies.ipynb` | Explore seeded fundamentals: growth, margins, outliers |
| `02_chunking_experiments.ipynb` | Tune chunk size/overlap for filings vs. spreadsheets |
| `03_hybrid_search_eval.ipynb` | Compare BM25-only / vector-only / hybrid / +rerank recall |
| `04_ragas_report.ipynb` | Visualise RAGAS scores across prompt + retriever versions |
| `05_ratio_deep_dive.ipynb` | Validate calculator outputs against manual statements |

Conventions

- Notebooks read from `data/companies/*.json` or the live API
  (`http://localhost:8000/api/v1/...`), never from ad-hoc CSVs.
- Anything reusable must be promoted into
  `backend/app/services/` and covered by tests before it ships.
