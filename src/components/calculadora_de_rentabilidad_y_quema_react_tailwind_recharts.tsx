import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ReferenceDot,
} from "recharts";
import { TrendingUp, PiggyBank, RefreshCw, Wallet, CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * Calculadora de rentabilidad y quema
 * --------------------------------------------------------------
 * Qué modela:
 * - Ingresos (MRR) creciendo por tasa compuesta por periodo (semanal o mensual)
 * - Gastos fijos por mes
 * - Caja inicial (runway actual)
 * - (Opcional) churn mensual que reduce el crecimiento neto
 *
 * Resultados clave:
 * - Mes de break-even (ingresos >= gastos)
 * - Capital requerido hasta el break-even (área de déficit acumulado)
 * - ¿Default alive? (si la caja inicial cubre el déficit)
 * - Gráfica de ingresos vs gastos y déficit acumulado
 */

const currency = (v: number, currency = "MXN") =>
  v.toLocaleString(undefined, { style: "currency", currency });

const formatCurrencyAbbrev = (value: number, currency = "MXN") => {
  const absValue = Math.abs(value);
  let formattedValue = '';
  
  if (absValue >= 1000000000) {
    formattedValue = (value / 1000000000).toFixed(1) + 'B';
  } else if (absValue >= 1000000) {
    formattedValue = (value / 1000000).toFixed(1) + 'M';
  } else if (absValue >= 1000) {
    formattedValue = (value / 1000).toFixed(1) + 'K';
  } else {
    formattedValue = value.toFixed(0);
  }
  
  // Remove trailing .0
  formattedValue = formattedValue.replace(/\.0([KMB]?)$/, '$1');
  
  return `${formattedValue} ${currency}`;
};

const formatNumberAbbrev = (value: number) => {
  const absValue = Math.abs(value);
  let formattedValue = '';
  
  if (absValue >= 1000000000) {
    formattedValue = (value / 1000000000).toFixed(1) + 'B';
  } else if (absValue >= 1000000) {
    formattedValue = (value / 1000000).toFixed(1) + 'M';
  } else if (absValue >= 1000) {
    formattedValue = (value / 1000).toFixed(1) + 'K';
  } else {
    formattedValue = value.toFixed(0);
  }
  
  // Remove trailing .0
  formattedValue = formattedValue.replace(/\.0([KMB]?)$/, '$1');
  
  return formattedValue;
};
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function GrowthBurnCalculator() {
  const [periodicity, setPeriodicity] = useState<"monthly" | "weekly">(
    "monthly"
  );
  const [mrr, setMrr] = useState(250000); // MRR actual
  const [growth, setGrowth] = useState(0.10); // 10% por periodo
  const [churn, setChurn] = useState(0.02); // 2% mensual
  const [expenses, setExpenses] = useState(400000); // gastos mensuales
  const [cash, setCash] = useState(1500000); // caja inicial
  const [monthsHorizon, setMonthsHorizon] = useState(24);
  const [ccy, setCcy] = useState("MXN");

  // Normaliza tasas si el usuario cambia periodicidad
  const periodToMonthFactor = periodicity === "weekly" ? 4.34524 : 1; // semanas ≈ 4.345 por mes
  const effMonthlyGrowth = useMemo(() => {
    // crecimiento efectivo mensual = (1 + g_periodo)^(periodos/mes) - 1
    return Math.pow(1 + growth, periodToMonthFactor) - 1;
  }, [growth, periodToMonthFactor]);

  const effMonthlyChurn = useMemo(() => {
    // churn siempre lo interpretamos mensual; si periodicidad = weekly, solo afecta crecimiento efectivo mensual
    return Math.max(0, churn);
  }, [churn]);

  const series = useMemo(() => {
    const data: any[] = [];
    let revenue = mrr;
    let cumulativeDeficit = 0;
    let breakEvenMonth: number | null = null;

    for (let m = 0; m <= monthsHorizon; m++) {
      const monthLabel = `M${m}`;
      const deficit = Math.max(0, expenses - revenue);
      cumulativeDeficit += deficit;
      if (breakEvenMonth === null && revenue >= expenses) breakEvenMonth = m;

      const cashBalance = cash - cumulativeDeficit;
      const deficitArea = expenses > revenue ? [revenue, expenses] : null;
      const surplusArea = revenue > expenses ? [expenses, revenue] : null;

      data.push({
        month: monthLabel,
        monthIndex: m,
        revenue,
        expenses,
        deficit,
        cumulativeDeficit,
        cashBalance,
        deficitArea,
        surplusArea,
      });

      // siguiente mes: revenue crece por growth neto (crecimiento - churn)
      const netGrowth = Math.max(-0.95, effMonthlyGrowth - effMonthlyChurn);
      revenue = revenue * (1 + netGrowth);
    }

    let minCash = { value: data[0].cashBalance, month: 0 };
    for (const d of data) {
      if (d.cashBalance < minCash.value) {
        minCash = { value: d.cashBalance, month: d.monthIndex };
      }
    }

    return {
      data,
      breakEvenMonth,
      totalDeficit: data[data.length - 1].cumulativeDeficit,
      minCash,
    };
  }, [mrr, effMonthlyGrowth, effMonthlyChurn, expenses, monthsHorizon, cash]);

  const neededCapital = series.data.reduce((acc, d) => acc + d.deficit, 0);
  const defaultAlive = cash >= neededCapital && series.breakEvenMonth !== null;
  const margin = cash - neededCapital;
  const cashTrajectoryColor = series.minCash.value < 0 ? "#ef4444" : "#10b981";
  const cashTrajectoryFillId = series.minCash.value < 0 ? "cashNeg" : "cashPos";

  const tooltipFormatter = (value: any, name: any) => {
    if (typeof value !== "number") return [value, name];
    return [formatCurrencyAbbrev(value, ccy), name];
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 p-0 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 px-4 md:px-0">
          <motion.h1
            layout
            className="text-xl md:text-2xl lg:text-3xl font-semibold tracking-tight"
          >
            Calculadora de rentabilidad y burn
          </motion.h1>
          <div className="flex items-center gap-3 justify-between md:justify-end">
            <div className="flex items-center gap-2">
              <Select
                label=""
                value={periodicity}
                onChange={(v) => setPeriodicity(v as any)}
                options={[
                  { label: "Mensual", value: "monthly" },
                  { label: "Semanal", value: "weekly" },
                ]}
              />
              <Select
                label=""
                value={ccy}
                onChange={(v) => setCcy(v)}
                options={[
                  { label: "MXN", value: "MXN" },
                  { label: "USD", value: "USD" },
                  { label: "EUR", value: "EUR" },
                ]}
              />
            </div>
            <button
              onClick={() => {
                setMrr(250000);
                setGrowth(0.1);
                setChurn(0.02);
                setExpenses(400000);
                setCash(1500000);
                setMonthsHorizon(24);
                setPeriodicity("monthly");
                setCcy("MXN");
              }}
              className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-white shadow-sm border hover:bg-gray-50"
            >
              <RefreshCw className="w-4 h-4" /> Reset
            </button>
          </div>
        </header>

        {/* Controles */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5 space-y-4">
            <Card>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-5 h-5" />
                <h2 className="font-medium">Supuestos</h2>
              </div>
              <div className="space-y-4">
                <CurrencyField
                  label={`MRR actual (${ccy})`}
                  value={mrr}
                  onChange={(v) => setMrr(v)}
                  currency={ccy}
                  min={0}
                  step={1000}
                />
                <CurrencyField
                  label={`Gastos mensuales (${ccy})`}
                  value={expenses}
                  onChange={(v) => setExpenses(v)}
                  currency={ccy}
                  min={0}
                  step={1000}
                />
                <CurrencyField
                  label={`Caja inicial (${ccy})`}
                  value={cash}
                  onChange={(v) => setCash(v)}
                  currency={ccy}
                  min={0}
                  step={10000}
                />
                <div className="grid grid-cols-1 gap-3">
                  <DualRateField
                    label={`Crecimiento por periodo (${periodicity === "monthly" ? "mensual" : "semanal"})`}
                    rate={growth}
                    onRateChange={setGrowth}
                    mrr={mrr}
                    absLabel="Nuevo MRR"
                    perPeriodLabel={periodicity === "monthly" ? "mes" : "semana"}
                    currency={ccy}
                    min={-0.5}
                    max={0.5}
                    step={0.005}
                  />
                  <DualRateField
                    label="Churn mensual"
                    rate={churn}
                    onRateChange={setChurn}
                    mrr={mrr}
                    absLabel="MRR perdido"
                    perPeriodLabel="mes"
                    currency={ccy}
                    min={0}
                    max={0.5}
                    step={0.005}
                  />
                </div>

                <SliderField
                  label="Horizonte (meses)"
                  value={monthsHorizon}
                  onChange={(v) => setMonthsHorizon(Math.round(v))}
                  min={6}
                  max={60}
                  step={1}
                  format={(v) => `${Math.round(v)} m`}
                />
              </div>
            </Card>
          </div>

          {/* Métricas y gráficas */}
          <div className="md:col-span-7 space-y-4">
            <DefaultAliveBanner
              defaultAlive={defaultAlive}
              margin={margin}
              breakEvenMonth={series.breakEvenMonth}
              monthsHorizon={monthsHorizon}
              ccy={ccy}
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <KPI
                icon={<TrendingUp className="w-5 h-5" />}
                label="Mes de break-even"
                value={
                  series.breakEvenMonth !== null
                    ? `M${series.breakEvenMonth}`
                    : `> ${monthsHorizon}m`
                }
              />
              <KPI
                icon={<PiggyBank className="w-5 h-5" />}
                label="Capital requerido"
                value={formatCurrencyAbbrev(neededCapital, ccy)}
              />
              <KPI
                icon={<Wallet className="w-5 h-5" />}
                label="Caja mínima proyectada"
                value={formatCurrencyAbbrev(series.minCash.value, ccy)}
                subValue={`en M${series.minCash.month}`}
                className={series.minCash.value < 0 ? "text-rose-600" : ""}
              />
            </div>

            <Card>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-900">Ingresos vs Gastos</div>
                <ChartLegend
                  items={[
                    { color: "#3b82f6", label: "Ingresos" },
                    { color: "#ef4444", label: "Gastos" },
                    { color: "#fecaca", label: "Déficit" },
                    { color: "#bbf7d0", label: "Superávit" },
                  ]}
                />
              </div>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={series.data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => formatNumberAbbrev(v)} width={60} />
                    <Tooltip
                      formatter={tooltipFormatter}
                      labelFormatter={(label) => `Mes ${label}`}
                    />
                    {series.breakEvenMonth !== null && (
                      <ReferenceLine
                        x={`M${series.breakEvenMonth}`}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                        label={{
                          value: `Break-even M${series.breakEvenMonth}`,
                          position: "insideTopRight",
                          fill: "#10b981",
                          fontSize: 12,
                        }}
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="deficitArea"
                      name="Déficit"
                      stroke="none"
                      fill="#fecaca"
                      fillOpacity={0.7}
                      isAnimationActive={false}
                      activeDot={false}
                      legendType="none"
                    />
                    <Area
                      type="monotone"
                      dataKey="surplusArea"
                      name="Superávit"
                      stroke="none"
                      fill="#bbf7d0"
                      fillOpacity={0.7}
                      isAnimationActive={false}
                      activeDot={false}
                      legendType="none"
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      name="Ingresos"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="expenses"
                      name="Gastos"
                      stroke="#ef4444"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-gray-900">Trayectoria de la caja</div>
                <ChartLegend
                  items={[
                    { color: cashTrajectoryColor, label: "Caja proyectada" },
                    { color: "#9ca3af", label: "Línea de peligro (0)" },
                  ]}
                />
              </div>
              <div className="h-[240px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series.data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="cashPos" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                      </linearGradient>
                      <linearGradient id="cashNeg" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity={0.6} />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis tickFormatter={(v) => formatNumberAbbrev(v)} width={60} />
                    <Tooltip
                      formatter={(v: any) => formatCurrencyAbbrev(v as number, ccy)}
                      labelFormatter={(label) => `Mes ${label}`}
                    />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />
                    {series.breakEvenMonth !== null && (
                      <ReferenceLine
                        x={`M${series.breakEvenMonth}`}
                        stroke="#10b981"
                        strokeDasharray="4 4"
                      />
                    )}
                    <Area
                      type="monotone"
                      dataKey="cashBalance"
                      name="Caja"
                      stroke={cashTrajectoryColor}
                      fill={`url(#${cashTrajectoryFillId})`}
                      strokeWidth={2}
                    />
                    <ReferenceDot
                      x={`M${series.minCash.month}`}
                      y={series.minCash.value}
                      r={5}
                      fill={cashTrajectoryColor}
                      stroke="#fff"
                      strokeWidth={2}
                      label={{
                        value: "Caja mínima",
                        position: series.minCash.value < 0 ? "top" : "bottom",
                        fill: cashTrajectoryColor,
                        fontSize: 11,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        </section>

        {/* Notas */}
        <Card>
          <h3 className="font-medium mb-2">Notas del modelo</h3>
          <ul className="list-disc pl-5 space-y-1 text-sm text-gray-700">
            <li>El crecimiento neto mensual = crecimiento efectivo mensual − churn mensual.</li>
            <li>El capital requerido es la suma de déficits mensuales hasta alcanzar o no el break-even dentro del horizonte.</li>
            <li>Si cambias a periodicidad semanal, la tasa por periodo se compone a mensual usando 4.345 semanas/mes.</li>
            <li>Puedes poner crecimiento negativo para simular contracciones.</li>
            <li>"Nuevo MRR" y "MRR perdido" son snapshots al MRR actual: como el modelo compone, estos montos absolutos crecen mes a mes aunque la tasa % se mantenga constante.</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white border shadow-sm rounded-2xl p-4 ${className}`}>{children}</div>
  );
}

function KPI({ icon, label, value, subValue, className = "" }: { icon: React.ReactNode; label: string; value: string; subValue?: string; className?: string }) {
  return (
    <div className={`bg-white border shadow-sm rounded-2xl p-4 flex flex-col gap-1 ${className}`}>
      <div className="text-xs text-gray-500 flex items-center gap-2">{icon}<span>{label}</span></div>
      <div className="text-lg md:text-xl font-semibold">{value}</div>
      {subValue && <div className="text-xs text-gray-500">{subValue}</div>}
    </div>
  );
}

function ChartLegend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-sm"
            style={{ backgroundColor: item.color }}
          />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function DefaultAliveBanner({
  defaultAlive,
  margin,
  breakEvenMonth,
  monthsHorizon,
  ccy,
}: {
  defaultAlive: boolean;
  margin: number;
  breakEvenMonth: number | null;
  monthsHorizon: number;
  ccy: string;
}) {
  const noBreakEven = breakEvenMonth === null;

  const tone = defaultAlive
    ? {
        bg: "bg-emerald-50 border-emerald-200",
        text: "text-emerald-700",
        iconBg: "bg-emerald-100",
        title: "Default alive",
      }
    : {
        bg: "bg-rose-50 border-rose-200",
        text: "text-rose-700",
        iconBg: "bg-rose-100",
        title: "Default dead",
      };

  const subtitle = noBreakEven
    ? `No alcanzas break-even en ${monthsHorizon} meses al ritmo actual.`
    : defaultAlive
      ? `Te sobran ${formatCurrencyAbbrev(margin, ccy)} sobre el capital requerido.`
      : `Te faltan ${formatCurrencyAbbrev(Math.abs(margin), ccy)} para llegar al break-even.`;

  return (
    <div className={`border rounded-2xl p-4 flex items-center gap-4 ${tone.bg}`}>
      <div className={`rounded-full p-3 ${tone.iconBg}`}>
        {defaultAlive ? (
          <CheckCircle2 className={`w-6 h-6 ${tone.text}`} />
        ) : (
          <AlertTriangle className={`w-6 h-6 ${tone.text}`} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className={`text-lg md:text-xl font-semibold ${tone.text}`}>{tone.title}</div>
        <div className="text-sm text-gray-700">{subtitle}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, min = 0, step = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; step?: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-600">{label}</span>
      <input
        type="number"
        className="border rounded-xl px-3 py-2 focus:outline-none focus:ring w-full"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </label>
  );
}

function CurrencyField({ label, value, onChange, currency, min = 0, step = 1 }: { label: string; value: number; onChange: (v: number) => void; currency: string; min?: number; step?: number }) {
  const formatCurrencyInput = (val: number, curr: string) => {
    const symbol = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : '$';
    return `${symbol}${val.toLocaleString()}`;
  };

  const parseCurrencyInput = (input: string) => {
    // Remove currency symbols and commas, keep only numbers
    const cleaned = input.replace(/[^0-9]/g, '');
    return cleaned === '' ? 0 : Number(cleaned);
  };

  const [displayValue, setDisplayValue] = React.useState(formatCurrencyInput(value, currency));
  const [isFocused, setIsFocused] = React.useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      setDisplayValue(formatCurrencyInput(value, currency));
    }
  }, [value, currency, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputValue = e.target.value;
    setDisplayValue(inputValue);
    
    const numericValue = parseCurrencyInput(inputValue);
    onChange(numericValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Show raw number when focused for easier editing
    setDisplayValue(value.toString());
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Format back to currency display
    setDisplayValue(formatCurrencyInput(value, currency));
  };

  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm text-gray-600">{label}</span>
      <input
        type="text"
        className="border rounded-xl px-3 py-2 focus:outline-none focus:ring w-full"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </label>
  );
}

function SliderField({ label, value, onChange, min, max, step, format = (v: number) => String(v) }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; format?: (v: number) => string }) {
  return (
    <label className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span className="font-medium text-gray-800">{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
      />
    </label>
  );
}

function DualRateField({
  label,
  rate,
  onRateChange,
  mrr,
  absLabel,
  perPeriodLabel,
  currency,
  min,
  max,
  step,
}: {
  label: string;
  rate: number;
  onRateChange: (v: number) => void;
  mrr: number;
  absLabel: string;
  perPeriodLabel: string;
  currency: string;
  min: number;
  max: number;
  step: number;
}) {
  const symbol = currency === "EUR" ? "€" : "$";
  const absValue = mrr * rate;
  const formatAbs = (v: number) => `${v < 0 ? "-" : ""}${symbol}${Math.abs(Math.round(v)).toLocaleString()}`;

  const [isFocused, setIsFocused] = React.useState(false);
  const [displayValue, setDisplayValue] = React.useState(formatAbs(absValue));

  React.useEffect(() => {
    if (!isFocused) setDisplayValue(formatAbs(absValue));
  }, [absValue, currency, isFocused]);

  const handleAbsInput = (raw: string) => {
    setDisplayValue(raw);
    const cleaned = raw.replace(/[^0-9-]/g, "").replace(/(?!^)-/g, "");
    const num = cleaned === "" || cleaned === "-" ? 0 : Number(cleaned);
    if (mrr > 0) {
      const newRate = Math.max(min, Math.min(max, num / mrr));
      onRateChange(newRate);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span className="font-medium text-gray-800">{pct(rate)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={rate}
        onChange={(e) => onRateChange(Number(e.target.value))}
        className="w-full"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 whitespace-nowrap">{absLabel}/{perPeriodLabel}</span>
        <input
          type="text"
          inputMode="numeric"
          className="border rounded-lg px-2 py-1 text-sm w-full focus:outline-none focus:ring disabled:bg-gray-50 disabled:text-gray-400"
          value={displayValue}
          disabled={mrr <= 0}
          onChange={(e) => handleAbsInput(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            setDisplayValue(String(Math.round(absValue)));
          }}
          onBlur={() => {
            setIsFocused(false);
            setDisplayValue(formatAbs(mrr * rate));
          }}
        />
      </div>
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { label: string; value: string }[] }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-sm text-gray-600">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="border rounded-xl px-3 py-2 focus:outline-none focus:ring bg-white text-sm min-w-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}