import React, { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts";
import { TrendingUp, PiggyBank, Flame, RefreshCw, X } from "lucide-react";

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
  const [activePayload, setActivePayload] = useState<any[] | null>(null);
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [selectedPayload, setSelectedPayload] = useState<any[] | null>(null);
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null);

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

      data.push({
        month: monthLabel,
        revenue,
        expenses,
        deficit,
        cumulativeDeficit,
      });

      // siguiente mes: revenue crece por growth neto (crecimiento - churn)
      const netGrowth = Math.max(-0.95, effMonthlyGrowth - effMonthlyChurn);
      revenue = revenue * (1 + netGrowth);
    }

    return {
      data,
      breakEvenMonth,
      totalDeficit: data[data.length - 1].cumulativeDeficit,
    };
  }, [mrr, effMonthlyGrowth, effMonthlyChurn, expenses, monthsHorizon]);

  const neededCapital = series.data.reduce((acc, d) => acc + d.deficit, 0);
  const defaultAlive = cash >= neededCapital;

  // Función para manejar click en etiquetas del eje X
  const handleTickClick = React.useCallback((tickValue: string) => {
    const monthData = series.data.find(d => d.month === tickValue);
    if (monthData) {
      const payload = [
        { dataKey: 'revenue', value: monthData.revenue, color: '#3b82f6' },
        { dataKey: 'expenses', value: monthData.expenses, color: '#ef4444' },
        { dataKey: 'deficit', value: monthData.deficit, color: '#10b981' },
        { dataKey: 'cumulativeDeficit', value: monthData.cumulativeDeficit, color: '#10b981' }
      ];
      setSelectedPayload(payload);
      setSelectedLabel(tickValue);
    }
  }, [series.data, ccy]);

  // Componente personalizado para las etiquetas del eje X
  const CustomTick = React.useCallback((props: any) => {
    const { x, y, payload } = props;
    return (
      <g>
        <text 
          x={x} 
          y={y} 
          dy={16} 
          textAnchor="middle" 
          fill="#666" 
          fontSize="12"
          className="cursor-pointer hover:fill-blue-600 hover:font-medium transition-colors"
          onClick={() => handleTickClick(payload.value)}
        >
          {payload.value}
        </text>
      </g>
    );
  }, [handleTickClick]);

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
                  <SliderField
                    label={`Crecimiento por periodo (${periodicity})`}
                    value={growth}
                    onChange={setGrowth}
                    min={-0.5}
                    max={0.5}
                    step={0.005}
                    format={(v) => pct(v)}
                  />
                  <SliderField
                    label="Churn mensual"
                    value={churn}
                    onChange={setChurn}
                    min={0}
                    max={0.5}
                    step={0.005}
                    format={(v) => pct(v)}
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

          {/* Métricas */}
          <div className="md:col-span-7 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <KPI
                icon={<PiggyBank className="w-5 h-5" />}
                label="Capital requerido (hasta break-even)"
                value={formatCurrencyAbbrev(neededCapital, ccy)}
              />
              <KPI
                icon={<TrendingUp className="w-5 h-5" />}
                label="Mes de break-even"
                value={series.breakEvenMonth !== null ? `M${series.breakEvenMonth}` : "No en horizonte"}
              />
              <KPI
                icon={<Flame className="w-5 h-5" />}
                label="Default alive"
                value={defaultAlive ? "Sí" : "No"}
                className={defaultAlive ? "text-emerald-600" : "text-rose-600"}
              />
            </div>

            <Card className="h-[420px]">
              <div className="text-sm text-gray-600 mb-2">
                Ingresos vs gastos y déficit acumulado
              </div>
              <ResponsiveContainer width="100%" height="90%">
                <AreaChart 
                  data={series.data} 
                  margin={{ top: 10, right: 20, left: 0, bottom: 0 }}
                  onMouseMove={(state) => {
                    if (state && state.activePayload && state.activeLabel) {
                      setActivePayload(state.activePayload);
                      setActiveLabel(state.activeLabel);
                    }
                  }}
                  onMouseLeave={() => {
                    setActivePayload(null);
                    setActiveLabel(null);
                  }}
                >
                  <defs>
                    <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="exp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f87171" stopOpacity={0.7} />
                      <stop offset="100%" stopColor="#f87171" stopOpacity={0.2} />
                    </linearGradient>
                    <linearGradient id="cum" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34d399" stopOpacity={0.8} />
                      <stop offset="100%" stopColor="#34d399" stopOpacity={0.2} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" tick={CustomTick} />
                  <YAxis tickFormatter={(v) => formatNumberAbbrev(v)} width={60} />
                  {series.breakEvenMonth !== null && (
                    <ReferenceLine
                      x={`M${series.breakEvenMonth}`}
                      stroke="#10b981"
                      strokeDasharray="4 4"
                      label={{ value: "Break-even", position: "insideTop" }}
                    />
                  )}
                  <Legend />
                  <Area type="monotone" dataKey="revenue" name="Ingresos" stroke="#3b82f6" fill="url(#rev)" />
                  <Area type="monotone" dataKey="expenses" name="Gastos" stroke="#ef4444" fill="url(#exp)" />
                  <Area type="monotone" dataKey="cumulativeDeficit" name="Déficit acumulado" stroke="#10b981" fill="url(#cum)" />
                </AreaChart>
              </ResponsiveContainer>
              
              {/* Contenedor dinámico para detalles del gráfico */}
              {activePayload && activeLabel && (
                <div className="mt-2 p-3 bg-gray-50 rounded-xl border">
                  <div className="text-sm font-medium text-gray-900 mb-2">{activeLabel}</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    {activePayload.map((entry: any, index: number) => {
                      const labels: { [key: string]: string } = {
                        revenue: "Ingresos",
                        expenses: "Gastos", 
                        deficit: "Déficit",
                        cumulativeDeficit: "Déficit acumulado"
                      };
                      
                      if (labels[entry.dataKey]) {
                        return (
                          <div key={index} className="flex flex-col">
                            <span className="text-gray-600">{labels[entry.dataKey]}</span>
                            <span className="font-medium" style={{ color: entry.color }}>
                              {formatCurrencyAbbrev(entry.value, ccy)}
                            </span>
                          </div>
                        );
                      }
                      return null;
                    })}
                  </div>
                </div>
              )}
            </Card>
            
            {/* Contenedor de detalles seleccionados */}
            {selectedPayload && selectedLabel && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-gray-900">
                    Detalles de {selectedLabel}
                  </div>
                  <button
                    onClick={() => {
                      setSelectedPayload(null);
                      setSelectedLabel(null);
                    }}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {selectedPayload.map((entry: any, index: number) => {
                    const labels: { [key: string]: string } = {
                      revenue: "Ingresos",
                      expenses: "Gastos", 
                      deficit: "Déficit",
                      cumulativeDeficit: "Déficit acumulado"
                    };
                    
                    if (labels[entry.dataKey]) {
                      return (
                        <div key={index} className="flex flex-col p-3 bg-gray-50 rounded-xl">
                          <span className="text-xs text-gray-600 mb-1">{labels[entry.dataKey]}</span>
                          <span className="text-sm font-semibold" style={{ color: entry.color }}>
                            {formatCurrencyAbbrev(entry.value, ccy)}
                          </span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </Card>
            )}
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

function KPI({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value: string; className?: string }) {
  return (
    <div className={`bg-white border shadow-sm rounded-2xl p-4 flex flex-col gap-1 ${className}`}>
      <div className="text-xs text-gray-500 flex items-center gap-2">{icon}<span>{label}</span></div>
      <div className="text-lg md:text-xl font-semibold">{value}</div>
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