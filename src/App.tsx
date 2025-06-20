import React, { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { realChargingData } from './realChargingData';

document.title = 'Tesla Charging Calculator';

// Funzione di utilità per convertire hh:mm:ss in minuti
function timeToMinutes(timeStr: string): number {
  const [h, m, s] = timeStr.split(':').map(Number);
  return h * 60 + m + s / 60;
}

// Interpolazione lineare tra due punti dati
function interpolateField(soc: number, field: keyof typeof realChargingData[0]) {
  const lower = realChargingData.slice().reverse().find((p) => p.soc <= soc);
  const upper = realChargingData.find((p) => p.soc >= soc);
  if (field === 'time') {
    // Restituisci sempre minuti
    if (!lower && upper) return timeToMinutes(upper.time);
    if (!upper && lower) return timeToMinutes(lower.time);
    if (lower && upper && lower.soc === upper.soc) return timeToMinutes(lower.time);
    if (lower && upper) {
      const ratio = (soc - lower.soc) / (upper.soc - lower.soc);
      const lowerMin = timeToMinutes(lower.time);
      const upperMin = timeToMinutes(upper.time);
      return lowerMin + ratio * (upperMin - lowerMin);
    }
    return 0;
  }
  // Per altri campi
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
                min="1"
                max="250"
                value={maxPower}
                onChange={(e) => setMaxPower(Number(e.target.value))}
                className="flex-1 h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
              />
              <input
                type="number"
                value={maxPower}
                min="1"
                max="250"
                onChange={(e) => setMaxPower(Number(e.target.value))}
                className="text-2xl font-bold text-red-700 min-w-[70px]"
                style={{ width: 60, marginLeft: 8 }}
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
                  formatter={(value, name) => [
                    `${(Number(value)).toFixed(1)} kW`, 
                    name === 'power' ? 'Potenza Limitata' : 'Potenza Originale'
                  ]}
                  labelFormatter={(value) => `SOC: ${value}%`}
                />
                <Legend />
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
                {startSOC < endSOC && (
                  <>
                    <ReferenceLine x={startSOC} stroke="#10b981" strokeWidth={2} strokeDasharray="8 8" />
                    <ReferenceLine x={endSOC} stroke="#ef4444" strokeWidth={2} strokeDasharray="8 8" />
                  </>
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Grafico Progresso di Ricarica */}
          <div className="bg-gray-50 p-6 rounded-xl">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              ⏱️ Progresso di Ricarica - SOC vs Tempo
            </h3>
            {calculateChargingTime && startSOC < endSOC ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={calculateChargingTime.combinedProfile}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e7ff" />
                  <XAxis 
                    dataKey="time" 
                    label={{ value: 'Tempo (min)', position: 'insideBottom', offset: -5 }}
                    tickFormatter={(value) => value < 60 ? `${Math.round(value)}min` : `${Math.round(value/60)}h`}
                  />
                  <YAxis 
                    domain={[startSOC, endSOC]}
                    label={{ value: 'SOC (%)', angle: -90, position: 'insideLeft' }}
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
                    strokeWidth={2}
                    fill="none"
                    strokeDasharray="6 6"
                    name="SOC max potenza"
                    dot={false}
                    isAnimationActive={false}
                  />
                  {/* Curva piena: potenza limitata */}
                  <Area 
                    type="monotone" 
                    dataKey="socLimited"
                    stroke="#8b5cf6"
                    strokeWidth={3}
                    fill="url(#colorGradient)"
                    name="SOC potenza selezionata"
                    dot={false}
                    isAnimationActive={false}
                  />
                  <defs>
                    <linearGradient id="colorGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <div className="text-4xl mb-2">📈</div>
                  <div>Imposta SOC validi per vedere il progresso</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeslaChargingCalculator;
