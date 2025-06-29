import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, ReferenceDot } from 'recharts';
import { realChargingData } from './realChargingData';
import Papa from 'papaparse';

document.title = 'Tesla Charging Calculator';

// Interpolazione lineare tra due punti dati
function interpolateField(
  soc: number,
  field: keyof typeof realChargingData[0] | 'time'
) {
  const lower = realChargingData.slice().reverse().find((p) => p.soc <= soc);
  const upper = realChargingData.find((p) => p.soc >= soc);

  if (!lower) return upper ? upper[field] : 0;
  if (!upper) return lower[field];
  if (lower.soc === upper.soc) return lower[field];
  const ratio = (soc - lower.soc) / (upper.soc - lower.soc);
  if (typeof lower[field] === 'number' && typeof upper[field] === 'number') {
    return (lower[field] as number) + ratio * ((upper[field] as number) - (lower[field] as number));
  }
  return lower[field];
}

const TeslaChargingCalculator = () => {
  const [startSOC, setStartSOC] = useState(20);
  const [endSOC, setEndSOC] = useState(80);
  const [maxPower, setMaxPower] = useState(250);
  const [csvInfo, setCsvInfo] = useState<{minSOC: number, maxSOC: number, maxPower: number} | null>(null);
  const [csvCurveData, setCsvCurveData] = useState<{ soc: number, power: number }[] | null>(null);

  const allowedPowers = [3, 7.4, 11, 15, 20, 22, 45, 50, 60, 75, 90, 250, 300, 320];

  // Parsing CSV e aggiornamento stati
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as any[];
        // Estrai SOC e Potenza
        const socs = data.map(row => {
          const socStr = (row['SOC'] || row['Soc'] || '').replace('%','').trim();
          return Number(socStr);
        }).filter(n => !isNaN(n));
        const powers = data.map(row => {
          const pStr = (row['Power'] || row['Potenza'] || '').replace('kW','').replace(',','.').trim();
          return Number(pStr);
        }).filter(n => !isNaN(n));
        if (socs.length && powers.length) {
          const minSOC = Math.min(...socs);
          const maxSOC = Math.max(...socs);
          const maxPwr = Math.max(...powers);
          setStartSOC(minSOC);
          setEndSOC(maxSOC);
          setMaxPower(Math.round(maxPwr));
          setCsvInfo({minSOC, maxSOC, maxPower: Math.round(maxPwr)});
          // Prepara dati per curva CSV
          const csvData = data.map(row => {
            const soc = Number((row['SOC'] || row['Soc'] || '').replace('%','').trim());
            const power = Number((row['Power'] || row['Potenza'] || '').replace('kW','').replace(',','.').trim());
            return (!isNaN(soc) && !isNaN(power)) ? { soc, power } : null;
          }).filter(Boolean) as { soc: number, power: number }[];
          setCsvCurveData(csvData);
        }
      }
    });
  };

  // Interpolazione lineare per ottenere la potenza a qualsiasi SOC
  const interpolatePower = (soc) => {
    // Trova i due punti più vicini
    const lowerPoint = realChargingData.slice().reverse().find(point => point.soc <= soc);
    const upperPoint = realChargingData.find(point => point.soc >= soc);
    
    if (!lowerPoint) return Math.min(maxPower, realChargingData[0].avgPower);
    if (!upperPoint) return Math.min(maxPower, realChargingData[realChargingData.length - 1].avgPower);
    if (lowerPoint.soc === upperPoint.soc) return Math.min(maxPower, lowerPoint.avgPower);
    
    // Interpolazione lineare
    const ratio = (soc - lowerPoint.soc) / (upperPoint.soc - lowerPoint.soc);
    const interpolatedPower = lowerPoint.avgPower + ratio * (upperPoint.avgPower - lowerPoint.avgPower);
    
    return Math.min(maxPower, interpolatedPower);
  };

  // Calcolo del tempo di ricarica e profilo usando i dati reali
  const calculateChargingTime = useMemo(() => {
    if (startSOC >= endSOC) return null;

    let chargingProfile: { soc: number; time: number; power: number; timeHours: number }[] = [];
    let totalTime = 0;
    let prevEnergy = interpolateField(startSOC, 'energy') as number;

    for (let soc = startSOC + 1; soc <= endSOC; soc += 1) {
      const currEnergy = interpolateField(soc, 'energy') as number;
      const energyStep = currEnergy - prevEnergy; // kWh da caricare in questo step
      let power = interpolateField(soc, 'avgPower') as number;
      power = Math.min(power, maxPower); // limita la potenza
      const timeStep = power > 0 ? (energyStep / power) * 60 : 0; // minuti
      totalTime += timeStep;
      chargingProfile.push({
        soc: Math.round(soc),
        time: totalTime,
        power: power,
        timeHours: totalTime / 60
      });
      prevEnergy = currEnergy;
    }

    chargingProfile.unshift({
      soc: Math.round(startSOC),
      time: 0,
      power: Math.min(interpolateField(startSOC, 'avgPower') as number, maxPower),
      timeHours: 0
    });

    // Calcola anche il profilo alla massima potenza reale (senza limitazione maxPower)
    let chargingProfileMaxPower: { soc: number; time: number; power: number; timeHours: number }[] = [];
    let totalTimeMax = 0;
    let prevEnergyMax = interpolateField(startSOC, 'energy') as number;
    for (let soc = startSOC + 1; soc <= endSOC; soc += 1) {
      const currEnergy = interpolateField(soc, 'energy') as number;
      const energyStep = currEnergy - prevEnergyMax;
      let power = interpolateField(soc, 'avgPower') as number;
      const timeStep = power > 0 ? (energyStep / power) * 60 : 0;
      totalTimeMax += timeStep;
      chargingProfileMaxPower.push({
        soc: Math.round(soc),
        time: totalTimeMax,
        power: power,
        timeHours: totalTimeMax / 60
      });
      prevEnergyMax = currEnergy;
    }
    chargingProfileMaxPower.unshift({
      soc: Math.round(startSOC),
      time: 0,
      power: interpolateField(startSOC, 'avgPower') as number,
      timeHours: 0
    });

    // Crea un array dati combinato per il grafico, con tempo come asse X
    // Per ogni step, abbina i valori di SOC per maxPower e per potenza limitata
    let combinedProfile: { time: number; socLimited: number; socMax: number }[] = [];
    let i = 0, j = 0;
    while (i < chargingProfile.length || j < chargingProfileMaxPower.length) {
      const tLimited = chargingProfile[i]?.time ?? Infinity;
      const tMax = chargingProfileMaxPower[j]?.time ?? Infinity;
      if (tLimited < tMax) {
        combinedProfile.push({
          time: tLimited,
          socLimited: chargingProfile[i].soc,
          socMax: chargingProfileMaxPower[j > 0 ? j - 1 : 0]?.soc ?? chargingProfileMaxPower[0].soc
        });
        i++;
      } else if (tMax < tLimited) {
        combinedProfile.push({
          time: tMax,
          socLimited: chargingProfile[i > 0 ? i - 1 : 0]?.soc ?? chargingProfile[0].soc,
          socMax: chargingProfileMaxPower[j].soc
        });
        j++;
      } else if (tLimited === tMax && tLimited !== Infinity) {
        combinedProfile.push({
          time: tLimited,
          socLimited: chargingProfile[i].soc,
          socMax: chargingProfileMaxPower[j].soc
        });
        i++;
        j++;
      } else {
        break;
      }
    }

    const energyStart = interpolateField(startSOC, 'energy') as number;
    const energyEnd = interpolateField(endSOC, 'energy') as number;
    const energyAdded = energyEnd - energyStart;

    return {
      totalTimeMinutes: totalTime,
      totalTimeHours: totalTime / 60,
      chargingProfile,
      chargingProfileMaxPower,
      combinedProfile,
      energyAdded
    };
  }, [startSOC, endSOC, maxPower]);

  // Formatta il tempo
  const formatTime = (minutes) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = Math.round(minutes % 60);
      return `${hours}h ${mins}min`;
    }
  };

  // Dati per il grafico della curva di potenza (limitati all'intervallo selezionato)
  const powerCurveData = realChargingData
    .filter(point => point.soc >= startSOC && point.soc <= endSOC)
    .map(point => ({
      soc: point.soc,
      power: Math.min(maxPower, point.avgPower),
      originalPower: point.avgPower
    }));

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-100 min-h-screen">
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            🚗⚡ Tesla Model Y Juniper AWD
          </h1>
          <p className="text-xl text-gray-600">Calcolatore Tempo di Ricarica</p>
          <p className="text-sm text-gray-500 mt-2">Basato su dati reali di ricarica</p>
        </div>

        {/* Upload CSV migliorato */}
        <div className="flex flex-col items-center mb-10">
          <label
            htmlFor="csv-upload"
            className="cursor-pointer px-6 py-3 rounded-lg bg-gradient-to-r from-blue-400 to-indigo-500 text-white font-semibold shadow-md hover:from-blue-500 hover:to-indigo-600 transition mb-2"
          >
            📄 Carica file CSV di ricarica
          </label>
          <input
            id="csv-upload"
            type="file"
            accept=".csv"
            onChange={handleCsvUpload}
            className="hidden"
          />
          {csvInfo && (
            <div className="text-sm text-gray-700 mt-2 bg-blue-50 px-4 py-2 rounded-lg shadow-inner">
              <span className="mr-2">SOC rilevati: <b>{csvInfo.minSOC}%</b> - <b>{csvInfo.maxSOC}%</b></span>
              <span className="mx-2">|</span>
              <span>Potenza max: <b>{csvInfo.maxPower} kW</b></span>
              <button
                className="ml-4 px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition text-xs font-semibold"
                onClick={() => {
                  setCsvInfo(null);
                  setCsvCurveData(null);
                }}
              >
                Rimuovi CSV
              </button>
            </div>
          )}
          <div className="text-xs text-gray-400 mt-1">Accetta file CSV con colonne SOC e Power/Potenza</div>
        </div>
        {/* Fine upload CSV migliorato */}

        {/* Controlli */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-50 to-green-100 p-6 rounded-xl">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              SOC Iniziale
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="0"
                max="99"
                value={startSOC}
                onChange={(e) => setStartSOC(Number(e.target.value))}
                className="flex-1 h-2 bg-green-200 rounded-lg appearance-none cursor-pointer"
                disabled={!!csvInfo}
              />
              <span className="text-2xl font-bold text-green-700 min-w-[60px]">
                {startSOC}%
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-6 rounded-xl">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              SOC Finale
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min="1"
                max="100"
                value={endSOC}
                onChange={(e) => setEndSOC(Number(e.target.value))}
                className="flex-1 h-2 bg-blue-200 rounded-lg appearance-none cursor-pointer"
                disabled={!!csvInfo}
              />
              <span className="text-2xl font-bold text-blue-700 min-w-[60px]">
                {endSOC}%
              </span>
            </div>
          </div>

          <div className="bg-gradient-to-r from-red-50 to-red-100 p-6 rounded-xl">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Potenza Max (kW)
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="range"
                min={0}
                max={allowedPowers.length - 1}
                step={1}
                value={allowedPowers.findIndex(p => p === maxPower) !== -1 ? allowedPowers.findIndex(p => p === maxPower) : 0}
                onChange={(e) => {
                  const idx = Number(e.target.value);
                  setMaxPower(allowedPowers[idx]);
                }}
                className="flex-1 h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
                disabled={!!csvInfo}
              />
              <input
                type="number"
                value={maxPower}
                min={Math.min(...allowedPowers)}
                max={Math.max(...allowedPowers)}
                step="any"
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxPower(val);
                }}
                className="text-2xl font-bold text-red-700 min-w-[70px]"
                style={{ width: 60, marginLeft: 8 }}
                disabled={!!csvInfo}
              />
              <span className="text-2xl font-bold text-red-700 min-w-[70px]">
                kW
              </span>
            </div>
          </div>
        </div>

        {/* Risultati */}
        {calculateChargingTime && startSOC < endSOC && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-6 rounded-xl text-center">
              <div className="text-3xl font-bold mb-1">
                {formatTime(calculateChargingTime.totalTimeMinutes)}
              </div>
              <div className="text-sm opacity-90">Tempo Totale</div>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-6 rounded-xl text-center">
              <div className="text-3xl font-bold mb-1">
                {(endSOC - startSOC)}%
              </div>
              <div className="text-sm opacity-90">Carica Aggiunta</div>
            </div>
            <div className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white p-6 rounded-xl text-center">
              <div className="text-3xl font-bold mb-1">
                {calculateChargingTime.energyAdded.toFixed(1)} kWh
              </div>
              <div className="text-sm opacity-90">kWh Caricati</div>
            </div>
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6 rounded-xl text-center">
              <div className="text-3xl font-bold mb-1">
                {interpolatePower(startSOC).toFixed(0)} kW
              </div>
              <div className="text-sm opacity-90">Potenza Iniziale</div>
            </div>
          </div>
        )}

        {/* Errore se SOC non valido */}
        {startSOC >= endSOC && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <strong>Attenzione:</strong> Il SOC iniziale deve essere inferiore al SOC finale.
          </div>
        )}

        {/* Grafici */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Grafico Curva di Potenza */}
          <div className="bg-gray-50 p-6 rounded-xl">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              📊 Curva di Ricarica - Potenza vs SOC
            </h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={powerCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                <XAxis 
                  dataKey="soc" 
                  domain={[startSOC, endSOC]}
                  type="number"
                  label={{ value: 'SOC (%)', position: 'insideBottom', offset: -5 }}
                />
                <YAxis 
                  label={{ value: 'Potenza (kW)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || payload.length === 0) return null;
                    // Trova i valori di potenza applicata, originale e CSV
                    const applied = payload.find(p => p.dataKey === "power" && p.stroke === "#3b82f6");
                    const original = payload.find(p => p.dataKey === "originalPower");
                    const csv = payload.find(p => p.dataKey === "power" && p.stroke === "#ef4444");
                    return (
                      <div className="bg-white rounded-lg shadow-lg px-4 py-2 border border-blue-100">
                        <div className="font-semibold text-gray-700 mb-1">SOC: {label}%</div>
                        {original && (
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded bg-[#94a3b8]" style={{borderBottom: '2px dashed #94a3b8'}}></span>
                            <span className="text-gray-500">Potenza originale:</span>
                            <span className="font-bold text-gray-700">{Number(original.value).toFixed(1)} kW</span>
                          </div>
                        )}
                        {applied && (
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded bg-[#3b82f6]"></span>
                            <span className="text-gray-500">Potenza applicata:</span>
                            <span className="font-bold text-gray-700">{Number(applied.value).toFixed(1)} kW</span>
                          </div>
                        )}
                        {csv && (
                          <div className="flex items-center gap-2">
                            <span className="inline-block w-3 h-3 rounded bg-[#ef4444]"></span>
                            <span className="text-gray-500">Potenza CSV:</span>
                            <span className="font-bold text-gray-700">{Number(csv.value).toFixed(1)} kW</span>
                          </div>
                        )}
                      </div>
                    );
                  }}
                />
                {/* RIMUOVI <Legend /> DA QUI */}
                <Line 
                  type="monotone" 
                  dataKey="originalPower" 
                  stroke="#94a3b8" 
                  strokeWidth={1}
                  strokeDasharray="5 5"
                  name="Curva Originale"
                  dot={false}
                />
                <Line 
                  type="monotone" 
                  dataKey="power" 
                  stroke="#3b82f6" 
                  strokeWidth={3}
                  name="Potenza Applicata"
                  dot={false}
                />
                {/* Curva CSV sovrapposta */}
                {csvCurveData && csvCurveData.length > 0 && (
                  <Line
                    type="monotone"
                    data={csvCurveData}
                    dataKey="power"
                    xAxisId={0}
                    yAxisId={0}
                    stroke="#ef4444"
                    strokeWidth={2}
                    name="Potenza CSV"
                    dot={false}
                    isAnimationActive={false}
                  />
                )}
                {startSOC < endSOC && (
                  <>
                    <ReferenceLine x={startSOC} stroke="#10b981" strokeWidth={2} strokeDasharray="8 8" />
                    <ReferenceLine x={endSOC} stroke="#ef4444" strokeWidth={2} strokeDasharray="8 8" />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
            {/* Legenda spostata sotto il grafico */}
            <div className="flex justify-center gap-6 mt-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="inline-block w-6 h-1 rounded bg-[#3b82f6]"></span>
                <span>Potenza Applicata</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-6 h-1 rounded bg-[#94a3b8]" style={{borderBottom: '2px dashed #94a3b8'}}></span>
                <span>Curva Originale</span>
              </div>
              {csvCurveData && csvCurveData.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="inline-block w-6 h-1 rounded bg-[#ef4444]"></span>
                  <span>Potenza CSV</span>
                </div>
              )}
            </div>
          </div>

          {/* Grafico Progresso di Ricarica */}
          <div className="bg-gray-50 p-6 rounded-xl">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              ⏱️ Progresso di Ricarica - SOC vs Tempo
            </h3>
            {calculateChargingTime && startSOC < endSOC ? (
              <>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart
                    data={calculateChargingTime.combinedProfile}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                    <YAxis
                      type="number"
                      dataKey="time"
                      domain={[0, calculateChargingTime.totalTimeMinutes]}
                      label={{ value: 'Tempo (min)', angle: -90, position: 'insideLeft' }}
                      tickFormatter={(value) => value < 60 ? `${Math.round(value)}` : `${Math.round(value/60)}h`}
                    />
                    <XAxis
                      type="number"
                      dataKey="socLimited"
                      domain={[startSOC, endSOC]}
                      label={{ value: 'SOC (%)', position: 'insideBottom', offset: -5 }}
                    />
                    <Tooltip
                      formatter={(value, name) => [`${value}%`, name === 'socMax' ? 'SOC max potenza' : 'SOC potenza selezionata']}
                      labelFormatter={(value) => `Tempo: ${formatTime(value)}`}
                    />
                    {/* Curva tratteggiata: massima potenza reale */}
                    <Area
                      type="monotone"
                      dataKey="socMax"
                      stroke="#f59e42"
                      fill="#f59e42"
                      fillOpacity={0.15}
                      strokeDasharray="5 5"
                      name="SOC max potenza"
                      dot={false}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="socLimited"
                      stroke="#8b5cf6"
                      fill="#8b5cf6"
                      fillOpacity={0.25}
                      name="SOC potenza selezionata"
                      dot={false}
                      isAnimationActive={false}
                    />
                    {/* Punto di arrivo max potenza reale */}
                    {(() => {
                      // Trova il punto in cui socMax raggiunge endSOC
                      const arr = calculateChargingTime.combinedProfile;
                      const idx = arr.findIndex(p => p.socMax >= endSOC);
                      if (idx === -1) return null;
                      const point = arr[idx];
                      return (
                        <ReferenceDot
                          x={endSOC}
                          y={point.time}
                          r={7}
                          fill="#f59e42"
                          stroke="#fff"
                          strokeWidth={2}
                          label={{
                            value: `Tmax: ${formatTime(point.time)}`,
                            position: "left",
                            fill: "#f59e42",
                            fontWeight: 600,
                            fontSize: 13,
                            offset: 10
                          }}
                        />
                      );
                    })()}
                    {/* Punto di arrivo potenza selezionata */}
                    {(() => {
                      // Trova il punto in cui socLimited raggiunge endSOC
                      const arr = calculateChargingTime.combinedProfile;
                      const idx = arr.findIndex(p => p.socLimited >= endSOC);
                      if (idx === -1) return null;
                      const point = arr[idx];
                      // Label custom assoluta per posizionamento preciso
                      return (
                        <ReferenceDot
                          x={endSOC}
                          y={point.time}
                          r={7}
                          fill="#8b5cf6"
                          stroke="#fff"
                          strokeWidth={2}
                          label={
                            ({ viewBox }) => {
                              // viewBox contiene {x, y} del punto
                              // Sposta la label in alto e a sinistra rispetto al punto
                              const x = viewBox.x - 100;
                              const y = viewBox.y;
                              return (
                                <text
                                  x={x}
                                  y={y}
                                  fill="#8b5cf6"
                                  fontWeight={600}
                                  fontSize={13}
                                  style={{ pointerEvents: 'none' }}
                                >
                                  {`Tsel: ${formatTime(point.time)}`}
                                </text>
                              );
                            }
                          }
                        />
                      );
                    })()}
                  </AreaChart>
                </ResponsiveContainer>
                {/* Legenda custom */}
                <div className="flex justify-center gap-6 mt-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-6 h-1 rounded bg-[#8b5cf6]"></span>
                    <span>SOC potenza selezionata</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-6 h-1 rounded bg-[#f59e42]" style={{borderBottom: '2px dashed #f59e42'}}></span>
                    <span>SOC max potenza reale</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center text-gray-400 py-16">
                Seleziona un intervallo di SOC valido per vedere il grafico.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeslaChargingCalculator;
