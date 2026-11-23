"""Financial maths + risk scoring tests (the SQL/Python calculation layer)."""

import pytest

from app.services.financials import calculator as calc


def test_growth_rate():
    assert calc.growth_rate(120, 100) == pytest.approx(0.20)
    assert calc.growth_rate(None, 100) is None
    assert calc.growth_rate(100, 0) is None


def test_cagr():
    # doubles over 4 years -> 2^(1/4) - 1
    assert calc.cagr(100, 200, 4) == pytest.approx(0.1892, abs=1e-4)
    assert calc.cagr(0, 200, 4) is None
    assert calc.cagr(100, 200, 0) is None


def test_margins():
    assert calc.margin(25, 100) == pytest.approx(0.25)
    assert calc.margin(25, None) is None
    assert calc.margin(25, 0) is None


def test_liquidity_ratios():
    assert calc.current_ratio(200, 100) == 2.0
    assert calc.quick_ratio(200, 50, 100) == 1.5
    assert calc.current_ratio(None, 100) is None


def test_leverage_and_coverage():
    assert calc.debt_to_equity(150, 300) == 0.5
    assert calc.debt_to_equity(150, 0) is None
    assert calc.interest_coverage(60, 20) == 3.0


def test_returns():
    assert calc.roe(50, 250) == 0.2
    assert calc.roa(50, 500) == 0.1


def test_cash_flow_helpers():
    assert calc.free_cash_flow(100, 40) == 60
    assert calc.free_cash_flow(100, None) == 100
    assert calc.working_capital(300, 120) == 180
    assert calc.working_capital(None, 120) is None


def test_ratio_snapshot_serialises():
    snapshot = calc.RatioSnapshot(fiscal_year=2025, net_margin=0.18)
    data = snapshot.as_dict()
    assert data["net_margin"] == 0.18
    assert data["debt_to_equity"] is None
    assert snapshot.fiscal_year == 2025


def test_risk_flags_high_leverage():
    from app.db.models.financial import FinancialStatement
    from app.services.financials.risk import assess_risk

    statement = FinancialStatement(
        fiscal_year=2025,
        total_debt=400,
        total_equity=100,       # D/E = 4.0 -> high
        current_assets=80,
        current_liabilities=100,  # current ratio 0.8 -> high
        operating_profit=10,
        interest_expense=10,      # coverage 1.0 -> high
        operating_cash_flow=1,
        net_profit=10,
    )
    flags, summary = assess_risk("Test Co", statement)

    by_key = {f.key: f for f in flags}
    assert by_key["leverage"].severity == "high"
    assert by_key["liquidity"].severity == "high"
    assert by_key["coverage"].severity == "high"
    assert "HIGH" in summary
    assert "Test Co" in summary


def test_risk_flags_low_when_healthy():
    from app.db.models.financial import FinancialStatement
    from app.services.financials.risk import assess_risk

    statement = FinancialStatement(
        fiscal_year=2025,
        total_debt=50,
        total_equity=300,        # D/E ~0.17 -> low
        current_assets=300,
        current_liabilities=100,  # 3.0 -> low
        operating_profit=100,
        interest_expense=10,      # 10x -> low
        operating_cash_flow=90,
        net_profit=100,
    )
    flags, _ = assess_risk("Healthy Co", statement)
    assert all(f.severity == "low" for f in flags)
