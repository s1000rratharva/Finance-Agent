"""Python financial mathematics.

Every function takes plain numbers (millions of `currency`) so the same code
powers the SQL-adjacent analytics, the agentic ``python`` tool and tests.
"""

from __future__ import annotations

from dataclasses import dataclass


def _safe(numerator: float | None, denominator: float | None) -> float | None:
    if numerator is None or denominator in (None, 0):
        return None
    return numerator / denominator


def growth_rate(current: float | None, previous: float | None) -> float | None:
    """Period-over-period growth as a decimal (0.12 == +12%)."""
    if current is None or previous in (None, 0):
        return None
    return (current - previous) / abs(previous)


def cagr(first: float | None, last: float | None, years: int) -> float | None:
    """Compound annual growth rate over `years` periods."""
    if not first or not last or years <= 0 or first <= 0 or last <= 0:
        return None
    return (last / first) ** (1 / years) - 1


def margin(value: float | None, base: float | None) -> float | None:
    return _safe(value, base)


def YoY(current: float | None, previous: float | None) -> float | None:
    return growth_rate(current, previous)


# --- ratios ----------------------------------------------------------------------


def current_ratio(current_assets: float | None, current_liabilities: float | None) -> float | None:
    return _safe(current_assets, current_liabilities)


def quick_ratio(
    current_assets: float | None,
    inventory: float | None,
    current_liabilities: float | None,
) -> float | None:
    if current_assets is None or current_liabilities in (None, 0):
        return None
    return (current_assets - (inventory or 0)) / current_liabilities


def debt_to_equity(total_debt: float | None, total_equity: float | None) -> float | None:
    return _safe(total_debt, total_equity)


def debt_to_assets(total_debt: float | None, total_assets: float | None) -> float | None:
    return _safe(total_debt, total_assets)


def interest_coverage(
    operating_profit: float | None, interest_expense: float | None
) -> float | None:
    return _safe(operating_profit, interest_expense)


def roe(net_profit: float | None, total_equity: float | None) -> float | None:
    return _safe(net_profit, total_equity)


def roa(net_profit: float | None, total_assets: float | None) -> float | None:
    return _safe(net_profit, total_assets)


def free_cash_flow(
    operating_cash_flow: float | None, capex: float | None
) -> float | None:
    if operating_cash_flow is None:
        return None
    return operating_cash_flow - (capex or 0)


def working_capital(
    current_assets: float | None, current_liabilities: float | None
) -> float | None:
    if current_assets is None or current_liabilities is None:
        return None
    return current_assets - current_liabilities


@dataclass
class RatioSnapshot:
    fiscal_year: int
    gross_margin: float | None = None
    operating_margin: float | None = None
    net_margin: float | None = None
    current_ratio: float | None = None
    quick_ratio: float | None = None
    debt_to_equity: float | None = None
    interest_coverage: float | None = None
    roe: float | None = None
    roa: float | None = None
    free_cash_flow: float | None = None

    def as_dict(self) -> dict[str, float | None]:
        return {
            "gross_margin": self.gross_margin,
            "operating_margin": self.operating_margin,
            "net_margin": self.net_margin,
            "current_ratio": self.current_ratio,
            "quick_ratio": self.quick_ratio,
            "debt_to_equity": self.debt_to_equity,
            "interest_coverage": self.interest_coverage,
            "roe": self.roe,
            "roa": self.roa,
            "free_cash_flow": self.free_cash_flow,
        }
