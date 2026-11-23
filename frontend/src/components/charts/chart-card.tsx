"use client";

import type { ChartSpec } from "@/lib/types";
import { MetricChart } from "@/components/charts/metric-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCopyToClipboard } from "@/hooks/use-copy";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

/** Card wrapper that renders a ChartSpec returned by the chat agent. */
export function ChartCard({ spec }: { spec: ChartSpec }) {
  const { copied, copy } = useCopyToClipboard();

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle className="truncate">{spec.title}</CardTitle>
          <CardDescription>
            {spec.unit ? `Units: ${spec.unit}` : "Generated from your request"}
          </CardDescription>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge tone="brand">{spec.chart_type}</Badge>
          <Button
            variant="ghost"
            size="icon"
            title="Copy chart data as JSON"
            onClick={() => copy(JSON.stringify(spec, null, 2))}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-bull" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <MetricChart spec={spec} height={280} />
      </CardContent>
    </Card>
  );
}
