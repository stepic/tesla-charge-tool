import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';

document.title = 'Tesla Charging Calculator';

const TeslaChargingCalculator = () => {
  const [startSOC, setStartSOC] = useState(20);
  const [endSOC, setEndSOC] = useState(80);
  const [maxPower, setMaxPower] = useState(250);
  const [results, setResults] = useState(null);

  // Dati reali dalla sessione di ricarica (curva di ricarica Tesla Model Y)
  const realChargingData = [
    { soc: 14, avgPower: 189 }, { soc: 15, avgPower: 187 }, { soc: 16, avgPower: 185 },
    { soc: 17, avgPower: 187 }, { soc: 18, avgPower: 187 }, { soc: 19, avgPower: 188 },
    { soc: 20, avgPower: 188 }, { soc: 21, avgPower: 189 }, { soc: 22, avgPower: 189 },
    { soc: 23, avgPower: 174 }, { soc: 24, avgPower: 164 }, { soc: 25, avgPower: 166 },
    { soc: 26, avgPower: 166 }, { soc: 27, avgPower: 165 }, { soc: 28, avgPower: 165 },
    { soc: 29, avgPower: 167 }, { soc: 30, avgPower: 167 }, { soc: 31, avgPower: 164 },
    { soc: 32, avgPower: 161 }, { soc: 33, avgPower: 158 }, { soc: 34, avgPower: 156 },
    { soc: 35, avgPower: 154 }, { soc: 36, avgPower: 151 }, { soc: 37, avgPower: 147 },
    { soc: 38, avgPower: 144 }, { soc: 39, avgPower: 142 }, { soc: 40, avgPower: 139 },
    { soc: 41, avgPower: 137 }, { soc: 42, avgPower: 134 }, { soc: 43, avgPower: 122 },
    { soc: 44, avgPower: 123 }, { soc: 45, avgPower: 121 }, { soc: 46, avgPower: 116 },
    { soc: 47, avgPower: 112 }, { soc: 48, avgPower: 107 }, { soc: 49, avgPower: 104 },
    { soc: 50, avgPower: 102 }, { soc: 51, avgPower: 98 }, { soc: 52, avgPower: 95 },
    { soc: 53, avgPower: 92 }, { soc: 54, avgPower: 89 }, { soc: 55, avgPower: 87 },
    { soc: 56, avgPower: 86 }, { soc: 57, avgPower: 85 }, { soc: 58, avgPower: 83 },
    { soc: 59, avgPower: 82 }, { soc: 60, avgPower: 82 }, { soc: 61, avgPower: 80 },
    { soc: 62, avgPower: 79 }, { soc: 63, avgPower: 78 }, { soc: 64, avgPower: 77 },
    { soc: 65, avgPower: 76 }, { soc: 66, avgPower: 74 }, { soc: 67, avgPower: 73 },
    { soc: 68, avgPower: 73 }, { soc: 69, avgPower: 73 }, { soc: 70, avgPower: 73 },
    { soc: 71, avgPower: 73 }, { soc: 72, avgPower: 73 }, { soc: 73, avgPower: 72 },
    { soc: 74, avgPower: 71 }, { soc: 75, avgPower: 69 }, { soc: 76, avgPower: 67 },
    { soc: 77, avgPower: 64 }, { soc: 78, avgPower: 58 }, { soc: 79, avgPower: 57 },
    { soc: 80, avgPower: 54 }, { soc: 81, avgPower: 51 }, { soc: 82, avgPower: 49 },
    { soc: 83, avgPower: 47 }, { soc: 84, avgPower: 45 }, { soc: 85, avgPower: 44 },
    { soc: 86, avgPower: 42 }, { soc: 87, avgPower: 42 }, { soc: 88, avgPower: 39 },
    { soc: 89, avgPower: 38 }, { soc: 90, avgPower: 37 }, { soc: 91, avgPower: 35 },
    { soc: 92, avgPower: 33 }, { soc: 93, avgPower: 32 }, { soc: 94, avgPower: 30 },
    { soc: 95, avgPower: 27 }, { soc: 96, avgPower: 25 }, { soc: 97, avgPower: 23 },
    { soc: 98, avgPower: 20 }, { soc: 99, avgPower: 15 }, { soc: 100, avgPower: 13 }
  ];

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

  // Calcolo del tempo di ricarica
  const calculateChargingTime = useMemo(() => {
    if (startSOC >= endSOC) return null;

    const batteryCapacity = 82; // kWh per Tesla Model Y AWD
    const stepSize = 0.5; // Passi di 0.5% per maggiore precisione
    let totalTime = 0;
    let chargingProfile: { soc: number; time: number; power: number; timeHours: number }[] = [];
    
    for (let currentSOC = startSOC; currentSOC < endSOC; currentSOC += stepSize) {
      const power = interpolatePower(currentSOC);
      const energyNeeded = (batteryCapacity * stepSize) / 100; // kWh per questo step
      const timeForStep = (energyNeeded / power) * 60; // minuti
      
      totalTime += timeForStep;
      
      // Aggiungi punto al profilo ogni 1%
      if (currentSOC % 1 === 0) {
        chargingProfile.push({
          soc: Math.round(currentSOC),
          time: totalTime,
          power: power,
          timeHours: totalTime / 60
        });
      }
    }

    // Aggiungi il punto finale
    chargingProfile.push({
      soc: endSOC,
      time: totalTime,
      power: interpolatePower(endSOC),
      timeHours: totalTime / 60
    });

    return {
      totalTimeMinutes: totalTime,
      totalTimeHours: totalTime / 60,
      chargingProfile: chargingProfile,
      energyAdded: (batteryCapacity * (endSOC - startSOC)) / 100
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

  // Dati per il grafico della curva di potenza
  const powerCurveData = realChargingData.map(point => ({
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
                max="189"
                value={maxPower}
                onChange={(e) => setMaxPower(Number(e.target.value))}
                className="flex-1 h-2 bg-red-200 rounded-lg appearance-none cursor-pointer"
              />
              <input
                type="number"
                value={maxPower}
                min="1"
                max="189"
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
                  domain={[14, 100]}
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
                <AreaChart data={calculateChargingTime.chargingProfile}>
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
                    formatter={(value) => [`${value}%`, 'SOC']}
                    labelFormatter={(value) => `Tempo: ${formatTime(value)}`}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="soc" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    fill="url(#colorGradient)"
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

        {/* Informazioni tecniche */}
        <div className="mt-8 bg-gradient-to-r from-gray-50 to-gray-100 p-6 rounded-xl">
          <h3 className="text-lg font-semibold text-gray-800 mb-3">ℹ️ Informazioni Tecniche</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <strong>Capacità Batteria:</strong> 78.1 kWh (nominale)<br/>
              <strong>Potenza Max Reale:</strong> 189 kW (dai dati)<br/>
              <strong>Tipo di Ricarica:</strong> DC Fast Charging
            </div>
            <div>
              <strong>Algoritmo:</strong> Interpolazione lineare dei dati reali<br/>
              <strong>Precisione:</strong> Calcolo per passi di 0.5%<br/>
              <strong>Fonte Dati:</strong> Sessione di ricarica reale 14%-100%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeslaChargingCalculator;