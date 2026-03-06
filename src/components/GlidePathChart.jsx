import React, { useMemo } from 'react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine
} from 'recharts';

/**
 * Biometric Glide Path Chart
 * Shows a longitudinal trend of a metric against a specific clinical target band.
 */
export default function GlidePathChart({
    title,
    data,
    dataKey = 'value',
    dateKey = 'date',
    color = '#3b82f6',
    targetMin,
    targetMax,
    targetLabel,
    unit,
    yDomain = ['auto', 'auto']
}) {

    // Custom tooltip to show target context
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const val = payload[0].value;
            let statusStr = '';
            let statusColor = 'var(--text-secondary)';

            if (targetMax && val > targetMax) {
                statusStr = '(Above Target)';
                statusColor = '#ef4444'; // Red
            } else if (targetMin && val < targetMin) {
                statusStr = '(Below Target)';
                statusColor = '#f59e0b'; // Amber
            } else if (targetMin && targetMax && val >= targetMin && val <= targetMax) {
                statusStr = '(In Target)';
                statusColor = '#10b981'; // Green
            } else if (targetMax && !targetMin && val <= targetMax) {
                statusStr = '(In Target)';
                statusColor = '#10b981'; // Green
            }

            return (
                <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px', boxShadow: '0 8px 24px rgba(0,0,0,0.3)' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>{label}</div>
                    <div style={{ fontSize: '18px', fontWeight: 600, color: payload[0].color, marginBottom: '4px' }}>
                        {val} {unit}
                    </div>
                    {statusStr && (
                        <div style={{ fontSize: '12px', fontWeight: 500, color: statusColor }}>
                            {statusStr}
                        </div>
                    )}
                </div>
            );
        }
        return null;
    };

    // Determine optimal Y-axis bounds based on data and targets
    const minData = Math.min(...data.map(d => d[dataKey]));
    const maxData = Math.max(...data.map(d => d[dataKey]));

    const calculatedYMin = targetMin ? Math.min(minData, targetMin) * 0.9 : minData * 0.9;
    const calculatedYMax = targetMax ? Math.max(maxData, targetMax) * 1.1 : maxData * 1.1;

    return (
        <div className="card chart-card fade-in">
            <div className="card-header" style={{ marginBottom: '16px' }}>
                <div>
                    <span className="card-title" style={{ display: 'block' }}>{title}</span>
                    {targetLabel && (
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            Target: {targetLabel}
                        </span>
                    )}
                </div>
            </div>

            <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                        <linearGradient id={`color-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={color} stopOpacity={0} />
                        </linearGradient>

                        {/* Pattern for the target area */}
                        <pattern id="target-pattern" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                            <line stroke="#10b981" strokeWidth="1" y2="4" opacity="0.2" />
                        </pattern>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" opacity={0.5} />
                    <XAxis
                        dataKey={dateKey}
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                        dy={10}
                    />
                    <YAxis
                        domain={yDomain[0] === 'auto' ? [Math.floor(calculatedYMin), Math.ceil(calculatedYMax)] : yDomain}
                        tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                        axisLine={false}
                        tickLine={false}
                    />
                    <Tooltip content={<CustomTooltip />} />

                    {/* Clinical Target Bands */}
                    {targetMin !== undefined && targetMax !== undefined && (
                        <ReferenceArea y1={targetMin} y2={targetMax} fill="url(#target-pattern)" fillOpacity={1} strokeOpacity={0} />
                    )}
                    {targetMax !== undefined && targetMin === undefined && (
                        <ReferenceArea y1={0} y2={targetMax} fill="url(#target-pattern)" fillOpacity={1} strokeOpacity={0} />
                    )}

                    {targetMax !== undefined && (
                        <ReferenceLine y={targetMax} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} opacity={0.8} />
                    )}
                    {targetMin !== undefined && (
                        <ReferenceLine y={targetMin} stroke="#10b981" strokeDasharray="4 4" strokeWidth={1} opacity={0.8} />
                    )}

                    <Area
                        type="monotone"
                        dataKey={dataKey}
                        stroke={color}
                        strokeWidth={3}
                        fillOpacity={1}
                        fill={`url(#color-${dataKey})`}
                        activeDot={{ r: 6, strokeWidth: 0, fill: color }}
                        animationDuration={1500}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}
