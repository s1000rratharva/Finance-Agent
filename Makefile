.PHONY: help install backend frontend dev seed test lint up down clean

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install backend + frontend dependencies
	python -m pip install -r backend/requirements-eval.txt
	cd frontend && npm install

install-core: ## Backend deps only (skips RAGAS; works on Python >= 3.13)
	python -m pip install -r backend/requirements.txt
	cd frontend && npm install

backend: ## Run the FastAPI dev server
	cd backend && python -m uvicorn app.main:app --reload --port 8000

frontend: ## Run the Next.js dev server
	cd frontend && npm run dev

dev: ## Run both servers (starts two terminals)
	powershell -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd backend; python -m uvicorn app.main:app --reload --port 8000'"
	powershell -Command "Start-Process powershell -ArgumentList '-NoExit','-Command','cd frontend; npm run dev'"

seed: ## Seed companies + sample financial statements into Postgres/Chroma
	cd backend && python -m scripts.seed

test: ## Run backend tests
	cd backend && python -m pytest -q

lint: ## Lint frontend
	cd frontend && npm run lint

up: ## Start the full stack with Docker Compose
	docker compose up --build

down: ## Stop the stack
	docker compose down

clean: ## Remove generated artefacts
	Remove-Item -Recurse -Force frontend\.next, backend\app\**\__pycache__ -ErrorAction SilentlyContinue
