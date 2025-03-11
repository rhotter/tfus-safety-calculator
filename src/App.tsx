import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info } from 'lucide-react';

interface SafetyParams {
  pulseRepetitionRate: number;
  frequency: number;
  cycles: number;
  width: number;
  height: number;
  pressure: number;
}

function App() {
  const [params, setParams] = useState<SafetyParams>({
    pulseRepetitionRate: 5,
    frequency: 2,
    cycles: 2,
    width: 3,
    height: 1.5,
    pressure: 600
  });

  const [results, setResults] = useState({
    pulseDuration: 0,
    dutyCycle: 0,
    intensityPerPulse: 0,
    averageIntensity: 0,
    transducerArea: 0,
    transducerPower: 0,
    tic: 0
  });

  const calculateResults = (p: SafetyParams) => {
    // Constants
    const speedOfSound = 1500; // m/s
    const density = 1000; // kg/m^3
    const impedance = 1.5; // MRayl

    // Step 1: Pulse duration (in seconds)
    const pulseDuration = (p.cycles / (p.frequency * 1e6));
    
    // Step 2: Duty cycle (as percentage)
    const dutyCycle = pulseDuration * (p.pulseRepetitionRate * 1000) * 100;
    
    // Step 3: Intensity calculations
    // Convert pressure from kPa to Pa
    const pressureInPa = p.pressure * 1000;
    
    // Calculate intensity per pulse (W/cm²)
    const intensityPerPulse = (pressureInPa * pressureInPa) / (2 * density * speedOfSound) / 10000;
    
    // Calculate average intensity (mW/cm²)
    const averageIntensity = intensityPerPulse * dutyCycle / 100 * 1000;
    
    // Step 4: Transducer calculations
    const transducerArea = p.width * p.height; // cm²
    const transducerPower = averageIntensity * transducerArea; // mW
    
    // Step 5: TIC calculation
    // C constant is 40 mW/cm
    const tic = transducerPower / (40 * transducerArea);

    setResults({
      pulseDuration,
      dutyCycle,
      intensityPerPulse,
      averageIntensity,
      transducerArea,
      transducerPower,
      tic
    });
  };

  useEffect(() => {
    calculateResults(params);
  }, [params]);

  const getMaxExposureTime = (tic: number) => {
    // BMUS limits
    if (tic <= 0.7) return 60;
    if (tic <= 1) return 30;
    if (tic <= 1.5) return 15;
    if (tic <= 2) return 4;
    if (tic <= 2.5) return 1;
    return 0;
  };

  const getITRUSSTMaxExposureTime = (tic: number) => {
    // ITRUSST limits
    if (tic <= 1.5) return 80;
    if (tic <= 2) return 40;
    if (tic <= 2.5) return 10;
    if (tic <= 3) return 2.67;
    if (tic <= 4) return 0.67;
    if (tic <= 5) return 0.17;
    return 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setParams(prev => ({
      ...prev,
      [name]: parseFloat(value)
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">
          Transcranial Ultrasound Safety Calculator
        </h1>

        <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Input Parameters</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Pulse Repetition Rate (kHz)
              </label>
              <input
                type="number"
                name="pulseRepetitionRate"
                value={params.pulseRepetitionRate}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Frequency (MHz)
              </label>
              <input
                type="number"
                name="frequency"
                value={params.frequency}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Cycles per Pulse
              </label>
              <input
                type="number"
                name="cycles"
                value={params.cycles}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Transducer Width (cm)
              </label>
              <input
                type="number"
                name="width"
                value={params.width}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Transducer Height (cm)
              </label>
              <input
                type="number"
                name="height"
                value={params.height}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Pressure (kPa)
              </label>
              <input
                type="number"
                name="pressure"
                value={params.pressure}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Safety Analysis</h2>
          
          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-lg font-medium mb-2">Peak Intensity Check</h3>
              <div className="flex items-center">
                {results.intensityPerPulse < 190 ? (
                  <CheckCircle className="text-green-500 w-6 h-6 mr-2" />
                ) : (
                  <AlertTriangle className="text-red-500 w-6 h-6 mr-2" />
                )}
                <span>
                  {results.intensityPerPulse.toFixed(2)} W/cm² 
                  (Limit: 190 W/cm²)
                </span>
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="text-lg font-medium mb-2">Average Intensity Check</h3>
              <div className="flex items-center">
                {results.averageIntensity < 720 ? (
                  <CheckCircle className="text-green-500 w-6 h-6 mr-2" />
                ) : (
                  <AlertTriangle className="text-red-500 w-6 h-6 mr-2" />
                )}
                <span>
                  {results.averageIntensity.toFixed(2)} mW/cm² 
                  (Limit: 720 mW/cm²)
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Thermal Index (TIC)</h3>
              <div className="flex items-center mb-2">
                {results.tic < 3 ? (
                  <CheckCircle className="text-green-500 w-6 h-6 mr-2" />
                ) : (
                  <AlertTriangle className="text-red-500 w-6 h-6 mr-2" />
                )}
                <span>
                  {results.tic.toFixed(2)}°C
                  (BMUS Limit: 3°C, ITRUSST Limit: 6°C)
                </span>
              </div>
              
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Info className="text-blue-500 w-5 h-5 mr-2" />
                  <span className="font-medium">Maximum Exposure Times:</span>
                </div>
                <div className="ml-7 space-y-1">
                  <p>BMUS: {getMaxExposureTime(results.tic)} minutes</p>
                  <p>ITRUSST: {getITRUSSTMaxExposureTime(results.tic)} minutes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;