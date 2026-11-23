"""Risk scoring over statement rows: leverage, liquidity, coverage, trend."""

from __future__ import annotations

from app.db.models.financial import FinancialStatement
from app.schemas.company import RiskFlag
from app.services.financials import calculator as calc


def assess_risk(company_name: str, statement: FinancialStatement | None,
                previous: FinancialStatement | None = None) -> tuple[list[RiskFlag], str]:
    if statement is None:
        return [], f"No statement available for {company_name}."

    flags: list[RiskFlag] = []

    # --- Leverage ---
    dte = calc.debt_to_equity(_f(statement.total_debt), _f(statement.total_equity))
    if dte is not None:
        severity = "high" if dte > 2.0 else "medium" if dte > 1.0 else "low"
        flags.append(
            RiskFlag(
                key="leverage",
                label="Debt / Equity",
                severity=severity,
                value=round(dte, 2),
                detail=f"D/E of {dte:.2f}x in FY{statement.fiscal_year}.",
            )
        )

    # --- Liquidity ---
    cr = calc.current_ratio(_f(statement.current_assets), _f(statement.current_liabilities))
    if cr is not None:
        severity = "high" if cr < 1.0 else "medium" if cr < 1.3 else "low"
        flags.append(
            RiskFlag(
                key="liquidity",
                label="Current ratio",
                severity=severity,
                value=round(cr, 2),
                detail=f"Current ratio {cr:.2f}x - "
                + ("short-term obligations exceed current assets." if cr < 1
                   else "adequate short-term cover." if cr >= 1.3
                   else "thin buffer against near-term liabilities."),
            )
        )

    # --- Interest coverage ---
    coverage = calc.interest_coverage(
        _f(statement.operating_profit), _f(statement.interest_expense)
    )
    if coverage is not None:
        severity = "high" if coverage < 1.5 else "medium" if coverage < 3.0 else "low"
        flags.append(
            RiskFlag(
                key="coverage",
                label="Interest coverage",
                severity=severity,
                value=round(coverage, 2),
                detail=f"EBIT covers interest {coverage:.1f}x.",
            )
        )

    # --- Cash conversion ---
    if statement.operating_cash_flow is not None and statement.net_profit is not None:
        ratio = calc.margin(_f(statement.operating_cash_flow), _f(statement.net_profit))
        if ratio is not None:
            severity = "high" if ratio < 0.5 else "medium" if ratio < 0.8 else "low"
            flags.append(
                RiskFlag(
                    key="cash_conversion",
                    label="OCF / Net profit",
                    severity=severity,
                    value=round(ratio, 2),
                    detail="Profits are converting into cash."
                    if ratio >= 0.8
                    else "Earnings quality: cash lags reported profit.",
                )
            )

    # --- Debt trend ---
    if previous is not None and previous.total_debt and statement.total_debt:
        trend = calc.growth_rate(_f(statement.total_debt), _f(previous.total_debt))
        if trend is not None and trend > 0.15:
            flags.append(
                RiskFlag(
                    key="debt_trend",
                    label="Rising borrowings",
                    severity="medium",
                    value=round(trend * 100, 1),
                    detail=f"Total debt grew {trend * 100:.1f}% YoY.",
                )
            )

    summary = _summarise(company_name, statement.fiscal_year, flags)
    return flags, summary


def _summarise(company: str, year: int, flags: list[RiskFlag]) -> str:
    if not flags:
        return f"{company}: no material risk signals detected for FY{year}."
    highs = [f for f in flags if f.severity == "high"]
    mediums = [f for f in flags if f.severity == "medium"]
    parts = [f"{company} FY{year} risk lens:"]
    if highs:
        parts.append("HIGH - " + "; ".join(f.label for f in highs) + ".")
    if mediums:
        parts.append("WATCH - " + "; ".join(f.label for f in mediums) + ".")
    if not highs and not mediums:
        parts.append("All tracked indicators within comfortable bounds.")
    return " ".join(parts)


def _f(value) -> float | None:
    return float(value) if value is not None else None
