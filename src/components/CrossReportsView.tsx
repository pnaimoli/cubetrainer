import React, { useMemo, useState } from 'react';
import { Card, Title, Group, SegmentedControl, Checkbox, Text, Button, Select } from '@mantine/core';
import { useLocalStorage } from '@mantine/hooks';
import { DataTable, type DataTableSortStatus } from 'mantine-datatable';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from 'recharts';
import { TbArrowLeft } from 'react-icons/tb';

interface CrossStat {
  scramble: string;
  userMoveCount: number;
  optimalMoveCount: number;
  inspectionMs: number;
  executionMs: number;
  timestamp: string;
}

interface CrossReportsViewProps {
  stats: CrossStat[];
  onBack: () => void;
}

interface CaseReport {
  name: string;
  count: number;
  best: number;
  meanOrMedian: number;
  stdDev: number;
}

const computeMean = (times: number[]): number => {
  return times.reduce((a, b) => a + b, 0) / times.length;
};

const computeMedian = (times: number[]): number => {
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const computeStdDev = (times: number[], mean: number): number => {
  const variance = times.reduce((sum, t) => sum + (t - mean) ** 2, 0) / times.length;
  return Math.sqrt(variance);
};

const formatTime = (ms: number | null): string => {
  if (ms === null) return '-';
  return (ms / 1000).toFixed(2);
};

const getTime = (stat: CrossStat, timeType: 'insp' | 'exec'): number => {
  return timeType === 'insp' ? stat.inspectionMs : stat.executionMs;
};

const MOVING_AVERAGES = [
  { window: 12, label: 'ao12', color: '#228be6' },
  { window: 50, label: 'ao50', color: '#40c057' },
  { window: 100, label: 'ao100', color: '#fa5252' },
] as const;

const CrossReportsView: React.FC<CrossReportsViewProps> = ({ stats, onBack }) => {
  const [metric, setMetric] = useLocalStorage<'mean' | 'median'>({ key: 'crossReportMetric', defaultValue: 'mean', getInitialValueInEffect: false });
  const [timeType, setTimeType] = useLocalStorage<'insp' | 'exec'>({ key: 'crossReportTimeType', defaultValue: 'exec', getInitialValueInEffect: false });
  const [eliminateOutliers, setEliminateOutliers] = useLocalStorage<boolean>({ key: 'crossReportEliminateOutliers', defaultValue: true, getInitialValueInEffect: false });
  const [timelineCase, setTimelineCase] = useState<string>('all');
  const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<CaseReport>>({
    columnAccessor: 'name',
    direction: 'asc',
  });

  // All distinct case names sorted
  const caseNames = useMemo(() => {
    const names = new Set(stats.map(s => `${s.optimalMoveCount}-move`));
    return [...names].sort();
  }, [stats]);

  const reports = useMemo(() => {
    if (stats.length === 0) return [];

    const grouped: Record<string, CrossStat[]> = {};
    for (const stat of stats) {
      const key = `${stat.optimalMoveCount}-move`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(stat);
    }

    const results: CaseReport[] = [];

    for (const [name, caseStats] of Object.entries(grouped)) {
      let times = caseStats.map(s => getTime(s, timeType));

      if (eliminateOutliers && times.length >= 4) {
        const m = computeMean(times);
        const sd = computeStdDev(times, m);
        times = times.filter(t => Math.abs(t - m) <= 2 * sd);
      }

      if (times.length === 0) continue;

      const mean = computeMean(times);
      const stdDev = computeStdDev(times, mean);
      const best = Math.min(...times);
      const meanOrMedian = metric === 'mean' ? mean : computeMedian(times);

      results.push({ name, count: times.length, best, meanOrMedian, stdDev });
    }

    return results;
  }, [stats, eliminateOutliers, metric, timeType]);

  const totals = useMemo(() => {
    if (reports.length === 0) return null;
    const count = reports.reduce((sum, r) => sum + r.count, 0);
    const best = Math.min(...reports.map(r => r.best));

    if (metric === 'median') {
      let allTimes = stats.map(s => getTime(s, timeType));
      if (eliminateOutliers && allTimes.length >= 4) {
        const m = computeMean(allTimes);
        const sd = computeStdDev(allTimes, m);
        allTimes = allTimes.filter(t => Math.abs(t - m) <= 2 * sd);
      }
      const median = computeMedian(allTimes);
      const mean = computeMean(allTimes);
      const stdDev = computeStdDev(allTimes, mean);
      return { count, best, meanOrMedian: median, stdDev };
    }

    const mean = reports.reduce((sum, r) => sum + r.meanOrMedian * r.count, 0) / count;
    const pooledVariance = reports.reduce((sum, r) => sum + (r.stdDev ** 2 + (r.meanOrMedian - mean) ** 2) * r.count, 0) / count;
    const stdDev = Math.sqrt(pooledVariance);
    return { count, best, meanOrMedian: mean, stdDev };
  }, [reports, stats, eliminateOutliers, metric, timeType]);

  const sortedReports = useMemo(() => {
    const sorted = [...reports].sort((a, b) => {
      const col = sortStatus.columnAccessor as keyof CaseReport;
      const va = a[col];
      const vb = b[col];
      if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb);
      return (va as number) - (vb as number);
    });
    return sortStatus.direction === 'desc' ? sorted.reverse() : sorted;
  }, [reports, sortStatus]);

  const timelineData = useMemo(() => {
    if (stats.length === 0) return [];

    const sorted = [...stats].sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    const filtered = timelineCase === 'all'
      ? sorted
      : sorted.filter(s => `${s.optimalMoveCount}-move` === timelineCase);

    let times = filtered.map(s => getTime(s, timeType));

    if (eliminateOutliers && times.length >= 4) {
      const m = computeMean(times);
      const sd = computeStdDev(times, m);
      times = times.filter(t => Math.abs(t - m) <= 2 * sd);
    }

    return times.map((_, i) => {
      const point: Record<string, number> = { solve: i + 1 };
      for (const { window, label } of MOVING_AVERAGES) {
        const size = Math.min(window, i + 1);
        const slice = times.slice(i + 1 - size, i + 1);
        const val = metric === 'mean'
          ? slice.reduce((a, b) => a + b, 0) / size
          : computeMedian(slice);
        point[label] = val / 1000;
      }
      return point;
    });
  }, [stats, timelineCase, metric, timeType, eliminateOutliers]);

  if (stats.length === 0) {
    return (
      <Card withBorder padding="xs">
        <Card.Section withBorder px="xs">
          <Group>
            <Button variant="subtle" size="xs" leftSection={<TbArrowLeft />} onClick={onBack}>Back</Button>
            <Title mt="xs" mb="xs">Cross Reports</Title>
          </Group>
        </Card.Section>
        <Text ta="center" c="dimmed" py="xl">No solves recorded yet.</Text>
      </Card>
    );
  }

  return (
    <Group align="flex-start" wrap="wrap">
      <Card withBorder padding={0} maw={400}>
        <Card.Section withBorder px="xs">
          <Group>
            <Button variant="subtle" size="xs" leftSection={<TbArrowLeft />} onClick={onBack}>Back</Button>
            <Title order={2}>Cross Reports</Title>
          </Group>
        </Card.Section>
        <Card.Section withBorder px="xs" py="xs">
          <Group gap="lg">
            <SegmentedControl
              size="xs"
              value={timeType}
              onChange={(value) => setTimeType(value as 'insp' | 'exec')}
              data={[
                { label: 'Insp', value: 'insp' },
                { label: 'Exec', value: 'exec' },
              ]}
            />
            <SegmentedControl
              size="xs"
              value={metric}
              onChange={(value) => setMetric(value as 'mean' | 'median')}
              data={[
                { label: 'Mean', value: 'mean' },
                { label: 'Median', value: 'median' },
              ]}
            />
            <Checkbox
              size="xs"
              label="Eliminate 2σ outliers"
              checked={eliminateOutliers}
              onChange={(event) => setEliminateOutliers(event.currentTarget.checked)}
            />
          </Group>
        </Card.Section>
        <DataTable
          ff="monospace"
          fz="xs"
          withRowBorders={false}
          verticalSpacing={0}
          horizontalSpacing="xs"
          records={sortedReports}
          idAccessor="name"
          sortStatus={sortStatus}
          onSortStatusChange={setSortStatus}
          striped
          highlightOnHover
          defaultColumnProps={{
            textAlign: 'center',
            sortable: true,
          }}
          className="reports-table"
          columns={[
            { accessor: 'name', title: 'Case', textAlign: 'left', footer: 'Total' },
            { accessor: 'count', title: 'n', footer: totals ? String(totals.count) : '' },
            { accessor: 'best', title: 'Best', render: (row) => formatTime(row.best), footer: totals ? formatTime(totals.best) : '' },
            { accessor: 'meanOrMedian', title: metric === 'mean' ? 'Mean' : 'Median', render: (row) => formatTime(row.meanOrMedian), footer: totals ? formatTime(totals.meanOrMedian) : '' },
            { accessor: 'stdDev', title: 'σ', render: (row) => formatTime(row.stdDev), footer: totals ? formatTime(totals.stdDev) : '' },
          ]}
        />
      </Card>
      <Card withBorder padding={0} style={{ flex: 1, minWidth: 400 }}>
        <Card.Section withBorder px="xs">
          <Title order={2}>Timeline</Title>
        </Card.Section>
        <Card.Section withBorder px="xs" py="xs">
          <Group gap="lg" align="center">
            <Text fz="xs" fw={500}>Case</Text>
            <Select
              size="xs"
              value={timelineCase}
              onChange={(value) => setTimelineCase(value || 'all')}
              data={[{ label: 'All', value: 'all' }, ...caseNames.map(n => ({ label: n, value: n }))]}
              maw={120}
            />
          </Group>
        </Card.Section>
        <Card.Section px="xs" py="xs">
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={timelineData}>
            <XAxis
              dataKey="solve"
              type="number"
              domain={['dataMin', 'dataMax']}
              allowDecimals={false}
              label={{ value: 'Solve #', position: 'insideBottom', offset: -5 }}
            />
            <YAxis unit="s" domain={['dataMin', 'dataMax']} tickFormatter={(v: number) => v.toFixed(2)} />
            <Tooltip
              labelFormatter={(v) => `Solve #${v}`}
              formatter={(value) => [(value as number).toFixed(2) + 's']}
            />
            <Legend
              wrapperStyle={{ paddingTop: 20, cursor: 'pointer' }}
              onClick={(e) => {
                const key = e.dataKey as string;
                setHiddenLines(prev => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key); else next.add(key);
                  return next;
                });
              }}
            />
            {timeType === 'insp' && timelineData.length > 0 && (() => {
              const allValues = timelineData.flatMap(d =>
                MOVING_AVERAGES.filter(({ label }) => !hiddenLines.has(label)).map(({ label }) => d[label] as number).filter(v => v != null)
              );
              const max = Math.max(...allValues);
              return max >= 15 ? (
                <ReferenceLine y={15} stroke="gray" strokeDasharray="4 4" strokeWidth={1} label={{ value: '15s', position: 'right', fill: 'gray', fontSize: 12 }} />
              ) : null;
            })()}
            {MOVING_AVERAGES.map(({ label, color }) => (
              <Line
                key={label}
                dataKey={label}
                stroke={color}
                strokeWidth={2}
                dot={false}
                connectNulls
                isAnimationActive={false}
                hide={hiddenLines.has(label)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
        </Card.Section>
      </Card>
    </Group>
  );
};

export default CrossReportsView;
