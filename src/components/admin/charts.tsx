'use client'

import type * as React from 'react'
import { useId } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { FORMATTERS, shortDay, type FormatKind } from '@/lib/format'

/*
 * Operator console charts. Conventions (see the dataviz method): categorical slots in fixed
 * order, thin marks (≤24px bars, 2px lines), a 2px surface gap between stacked segments,
 * hairline solid gridlines, a legend for 2+ series, a hover layer, and a table view twin so no
 * value is reachable only by hovering. Formatters are passed by name so server components can
 * configure these client components.
 */

type Format = (value: number) => string

interface TooltipItem {
  name?: string | number
  value?: unknown
  color?: string
}

function TooltipCard({
  active,
  payload,
  label,
  format,
  labelFormat,
  total,
}: {
  active?: boolean
  payload?: readonly TooltipItem[]
  label?: unknown
  format: Format
  labelFormat: (label: unknown) => string
  total?: boolean
}) {
  if (!active || !payload || payload.length === 0) return null
  const sum = payload.reduce((acc, item) => acc + (Number(item.value) || 0), 0)
  return (
    <div className="min-w-40 rounded-lg border bg-popover px-3 py-2 text-xs shadow-raised">
      <p className="mb-1.5 text-muted-foreground">{labelFormat(label)}</p>
      <ul className="space-y-1">
        {[...payload].reverse().map((item) => (
          <li key={String(item.name)} className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-0.5 w-3 shrink-0 rounded-full"
              style={{ background: item.color }}
            />
            <span className="tabular font-semibold text-foreground">
              {format(Number(item.value) || 0)}
            </span>
            <span className="text-muted-foreground">{item.name}</span>
          </li>
        ))}
      </ul>
      {total && payload.length > 1 ? (
        <p className="mt-1.5 border-t pt-1.5">
          <span className="tabular font-semibold text-foreground">{format(sum)}</span>{' '}
          <span className="text-muted-foreground">total</span>
        </p>
      ) : null}
    </div>
  )
}

export interface SeriesDef {
  key: string
  label: string
  /** CSS colour, normally a categorical token such as `var(--viz-1)`. */
  color: string
}

function Legend({ series, shape = 'rect' }: { series: SeriesDef[]; shape?: 'rect' | 'line' }) {
  return (
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={shape === 'rect' ? 'size-2.5 rounded-[3px]' : 'h-0.5 w-3.5 rounded-full'}
            style={{ background: item.color }}
          />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

function TableView({
  caption,
  columns,
  rows,
}: {
  caption: string
  columns: string[]
  rows: (string | number)[][]
}) {
  return (
    <details className="group mt-3 text-xs">
      <summary className="cursor-pointer text-muted-foreground select-none hover:text-foreground">
        View as table
      </summary>
      <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
        <table className="w-full text-left">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 bg-muted">
            <tr>
              {columns.map((column, index) => (
                <th
                  key={column}
                  scope="col"
                  className={`px-2.5 py-1.5 font-medium ${index > 0 ? 'text-right' : ''}`}
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t">
                {row.map((cell, index) => (
                  <td
                    key={index}
                    className={`tabular px-2.5 py-1.5 ${index > 0 ? 'text-right' : ''}`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--viz-muted)', fontSize: 11 },
} as const

function ChartFrame({
  label,
  height,
  children,
}: {
  label: string
  height: number
  children: React.ReactElement
}) {
  return (
    <div className="viz-root" role="img" aria-label={label}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

/** Stacked daily columns: part-to-whole of revenue by stream over time. */
export function StackedColumnChart({
  data,
  series,
  axisFormat = 'compactMoney',
  valueFormat = 'money',
  label,
  height = 260,
}: {
  data: ({ day: number } & Record<string, number>)[]
  series: SeriesDef[]
  axisFormat?: FormatKind
  valueFormat?: FormatKind
  label: string
  height?: number
}) {
  const format = FORMATTERS[axisFormat]
  const tooltipFormat = FORMATTERS[valueFormat]
  return (
    <div>
      <Legend series={series} />
      <ChartFrame label={label} height={height}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          barCategoryGap="22%"
        >
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis
            dataKey="day"
            {...axisProps}
            tickFormatter={(value: number) => shortDay(value)}
            minTickGap={24}
          />
          <YAxis {...axisProps} width={56} tickFormatter={(value: number) => format(value)} />
          <Tooltip
            cursor={{ fill: 'var(--viz-grid)', opacity: 0.5 }}
            content={(props) => (
              <TooltipCard
                {...props}
                format={tooltipFormat}
                labelFormat={(value) => shortDay(Number(value))}
                total
              />
            )}
          />
          {series.map((item, index) => (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stackId="stack"
              fill={item.color}
              stroke="var(--viz-surface)"
              strokeWidth={2}
              maxBarSize={24}
              radius={index === series.length - 1 ? [4, 4, 0, 0] : 0}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ChartFrame>
      <TableView
        caption={label}
        columns={['Day', ...series.map((item) => item.label), 'Total']}
        rows={data.map((row) => [
          shortDay(row.day),
          ...series.map((item) => tooltipFormat(row[item.key] ?? 0)),
          tooltipFormat(series.reduce((total, item) => total + (row[item.key] ?? 0), 0)),
        ])}
      />
    </div>
  )
}

/** Single-series trend (area wash + 2px line) with a crosshair tooltip. */
export function TrendAreaChart({
  data,
  dataKey,
  name,
  axisFormat = 'compactNumber',
  valueFormat,
  label,
  height = 200,
  color = 'var(--viz-1)',
}: {
  data: ({ day: number } & Record<string, number>)[]
  dataKey: string
  name: string
  axisFormat?: FormatKind
  valueFormat?: FormatKind
  label: string
  height?: number
  color?: string
}) {
  const format = FORMATTERS[axisFormat]
  const tooltipFormat = valueFormat ? FORMATTERS[valueFormat] : undefined
  const gradientId = `grad-${dataKey}-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <div>
      <ChartFrame label={label} height={height}>
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.14} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis
            dataKey="day"
            {...axisProps}
            tickFormatter={(value: number) => shortDay(value)}
            minTickGap={28}
          />
          <YAxis {...axisProps} width={48} tickFormatter={(value: number) => format(value)} />
          <Tooltip
            cursor={{ stroke: 'var(--viz-axis)', strokeWidth: 1 }}
            content={(props) => (
              <TooltipCard
                {...props}
                format={tooltipFormat ?? format}
                labelFormat={(value) => shortDay(Number(value))}
              />
            )}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            name={name}
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, stroke: 'var(--viz-surface)', strokeWidth: 2 }}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartFrame>
      <TableView
        caption={label}
        columns={['Day', name]}
        rows={data.map((row) => [shortDay(row.day), (tooltipFormat ?? format)(row[dataKey] ?? 0)])}
      />
    </div>
  )
}

/** Two to four series over time, legend + crosshair. */
export function MultiLineChart({
  data,
  series,
  axisFormat = 'compactNumber',
  valueFormat,
  label,
  height = 220,
}: {
  data: ({ day: number } & Record<string, number>)[]
  series: SeriesDef[]
  axisFormat?: FormatKind
  valueFormat?: FormatKind
  label: string
  height?: number
}) {
  const format = FORMATTERS[axisFormat]
  const tooltipFormat = valueFormat ? FORMATTERS[valueFormat] : undefined
  return (
    <div>
      <Legend series={series} shape="line" />
      <ChartFrame label={label} height={height}>
        <LineChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
          <XAxis
            dataKey="day"
            {...axisProps}
            tickFormatter={(value: number) => shortDay(value)}
            minTickGap={28}
          />
          <YAxis {...axisProps} width={48} tickFormatter={(value: number) => format(value)} />
          <Tooltip
            cursor={{ stroke: 'var(--viz-axis)', strokeWidth: 1 }}
            content={(props) => (
              <TooltipCard
                {...props}
                format={tooltipFormat ?? format}
                labelFormat={(value) => shortDay(Number(value))}
              />
            )}
          />
          {series.map((item) => (
            <Line
              key={item.key}
              type="monotone"
              dataKey={item.key}
              name={item.label}
              stroke={item.color}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 4, stroke: 'var(--viz-surface)', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartFrame>
      <TableView
        caption={label}
        columns={['Day', ...series.map((item) => item.label)]}
        rows={data.map((row) => [
          shortDay(row.day),
          ...series.map((item) => (tooltipFormat ?? format)(row[item.key] ?? 0)),
        ])}
      />
    </div>
  )
}

/** Horizontal bars for one measure across nominal categories: one colour, value at the bar tip. */
export function HorizontalBarChart({
  data,
  axisFormat = 'compactMoney',
  valueFormat = 'money',
  label,
  valueLabel,
}: {
  data: { name: string; value: number }[]
  axisFormat?: FormatKind
  valueFormat?: FormatKind
  label: string
  valueLabel: string
}) {
  const format = FORMATTERS[axisFormat]
  const tooltipFormat = FORMATTERS[valueFormat]
  const height = Math.max(120, data.length * 34 + 16)
  return (
    <div>
      <ChartFrame label={label} height={height}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
          barCategoryGap="30%"
        >
          <CartesianGrid horizontal={false} stroke="var(--viz-grid)" />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            {...axisProps}
            width={96}
            tick={{ fill: 'var(--viz-muted)', fontSize: 12 }}
          />
          <Tooltip
            cursor={{ fill: 'var(--viz-grid)', opacity: 0.5 }}
            content={(props) => (
              <TooltipCard
                {...props}
                format={tooltipFormat}
                labelFormat={(value) => String(value)}
              />
            )}
          />
          <Bar
            dataKey="value"
            name={valueLabel}
            fill="var(--viz-1)"
            maxBarSize={20}
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="value"
              position="right"
              formatter={(value: unknown) => format(Number(value) || 0)}
              style={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ChartFrame>
      <TableView
        caption={label}
        columns={['Category', valueLabel]}
        rows={data.map((row) => [row.name, tooltipFormat(row.value)])}
      />
    </div>
  )
}
