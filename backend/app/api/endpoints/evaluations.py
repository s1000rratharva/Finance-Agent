"""RAGAS evaluation endpoints."""

from fastapi import APIRouter, status

from app.api.deps import CurrentWorkspace, DbSession
from app.schemas.evaluation import EvalRunOut, EvalRunRequest
from app.services.evaluation import ragas_runner

router = APIRouter()


@router.get("/datasets")
async def list_datasets() -> list[str]:
    return ragas_runner.list_datasets()


@router.post("/run", response_model=EvalRunOut, status_code=status.HTTP_202_ACCEPTED)
async def run_evaluation(
    payload: EvalRunRequest, workspace: CurrentWorkspace, session: DbSession
) -> EvalRunOut:
    """Kick off a RAGAS run over a labelled dataset for this workspace."""
    run = await ragas_runner.run_evaluation(
        session,
        dataset_name=payload.dataset_name,
        limit=payload.limit,
        workspace_id=str(workspace.id),
    )
    return EvalRunOut(**_normalise(run))


@router.get("/runs", response_model=list[EvalRunOut])
async def list_runs(workspace: CurrentWorkspace) -> list[EvalRunOut]:
    runs = ragas_runner.list_runs(workspace_id=str(workspace.id))
    return [EvalRunOut(**_normalise(r)) for r in runs]


@router.get("/runs/{run_id}", response_model=EvalRunOut)
async def get_run(run_id: str, workspace: CurrentWorkspace) -> EvalRunOut:
    from app.core.exceptions import NotFoundError

    # Scoped lookup: another tenant's run id reads as "not found".
    run = ragas_runner.get_run(run_id, workspace_id=str(workspace.id))
    if run is None:
        raise NotFoundError("Evaluation run not found")
    return EvalRunOut(**_normalise(run))


def _normalise(run: dict) -> dict:
    return {
        "id": run["id"],
        "dataset_name": run["dataset_name"],
        "status": run["status"],
        "scores": run.get("scores") or {},
        "sample_count": run.get("sample_count", 0),
        "created_at": run["created_at"],
        "error": run.get("error"),
    }
