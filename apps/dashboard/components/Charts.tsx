const palette = ['#5b5bd6', '#8b5cf6', '#0ea5a4', '#f59e0b', '#e5484d', '#12a594'];

export function RevenueChart({ byDay }: { byDay: Record<string, number> }) {
  const entries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  if (entries.length === 0) return <div className="empty"><strong>No revenue data yet</strong></div>;

  const values = entries.map(([, value]) => Number(value));
  const max = Math.max(...values, 1);
  const width = 620;
  const height = 220;
  const padding = 24;
  const stepX = (width - padding * 2) / Math.max(entries.length - 1, 1);
  const points = values.map((value, index) => ({
    x: padding + index * stepX,
    y: height - padding - (value / max) * (height - padding * 2),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `${padding},${height - padding} ${line} ${padding + (entries.length - 1) * stepX},${height - padding}`;

  return (
    <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue trend">
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5b5bd6" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#5b5bd6" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((row) => (
        <line
          key={row}
          className="chart-grid-line"
          x1={padding}
          x2={width - padding}
          y1={padding + row * ((height - padding * 2) / 3)}
          y2={padding + row * ((height - padding * 2) / 3)}
        />
      ))}
      <polygon className="chart-area" points={area} />
      <polyline className="chart-line" points={line} />
      {points.map((point, index) => (
        <circle key={index} className="chart-dot" cx={point.x} cy={point.y} r="4" />
      ))}
    </svg>
  );
}

export function StatusDonut({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);

  if (total === 0) return <div className="empty"><strong>No orders yet</strong></div>;

  let offset = 0;
  const segments = entries.map(([, value], index) => {
    const length = (value / total) * 100;
    const segment = (
      <circle
        key={index}
        r="15.9"
        cx="42"
        cy="42"
        fill="transparent"
        stroke={palette[index % palette.length]}
        strokeWidth="7"
        strokeDasharray={`${length} ${100 - length}`}
        strokeDashoffset={-offset}
        transform="rotate(-90 42 42)"
      />
    );
    offset += length;
    return segment;
  });

  return (
    <div className="donut-wrap">
      <div style={{ position: 'relative', width: 150, height: 150 }}>
        <svg viewBox="0 0 42 42" width="150" height="150">
          <circle cx="42" cy="42" r="15.9" fill="transparent" stroke="#eef0f5" strokeWidth="7" />
          {segments}
        </svg>
        <div
          className="donut-center"
          style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}
        >
          {total}
        </div>
      </div>
      <div className="legend">
        {entries.map(([status, value], index) => (
          <div className="legend-item" key={status}>
            <span className="legend-dot" style={{ background: palette[index % palette.length] }} />
            <span>{status.replaceAll('_', ' ').toLowerCase()}</span>
            <span>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MiniBars({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  return (
    <div className="mini-bars">
      {values.map((value, index) => (
        <div key={index} className="mini-bar" style={{ height: `${Math.max(8, (value / max) * 100)}%` }} />
      ))}
    </div>
  );
}
