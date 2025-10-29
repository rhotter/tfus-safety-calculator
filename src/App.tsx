import React, { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Info } from "lucide-react";

interface SafetyParams {
  pulseRepetitionRateKHz: number;
  frequencyMHz: number;
  cycles: number;
  transducerWidthCm: number;
  transducerHeightCm: number;
  transducerPressureKPa: number;
  useElevationalFocusing: boolean;
  elevationalFocalDepthCm: number;
  useAzimuthalFocusing: boolean;
  azimuthalFocalDepthCm: number;
}

const MHZ_TO_HZ = 1e6;
const KHZ_TO_HZ = 1e3;
const KPA_TO_PA = 1000;
const CM2_TO_M2 = 1e-4; // 1 cm² = 1e-4 m²
const W_TO_MW = 1000; // 1 W = 1000 mW
const PA_TO_MPA = 1e-6;
const C_CONSTANT_MW_PER_CM = 40; // mW/cm constant for TIC calculation
const SPEED_OF_SOUND_M_PER_S = 1540; // Speed of sound in tissue (m/s)
const DENSITY_KG_PER_M3 = 1058; // Density of tissue (kg/m³)
const IMPEDANCE_RAYL = SPEED_OF_SOUND_M_PER_S * DENSITY_KG_PER_M3;
const CM_TO_M = 0.01; // Conversion factor from cm to m

function App() {
  // Default parameters
  const [params, setParams] = useState<SafetyParams>({
    pulseRepetitionRateKHz: 5,
    frequencyMHz: 2,
    cycles: 2,
    transducerWidthCm: 2.87,
    transducerHeightCm: 1.33,
    transducerPressureKPa: 600,
    useElevationalFocusing: false,
    elevationalFocalDepthCm: 3,
    useAzimuthalFocusing: false,
    azimuthalFocalDepthCm: 3,
  });

  const [results, setResults] = useState({
    pulseDurationSec: 0,
    dutyCycle: 0,
    intensityPerPulseWPerCm2: 0,
    averageIntensityMWPerCm2: 0,
    transducerAveragePowerMW: 0,
    tic: 0,
    mechanicalIndex: 0,
    brainPressureKPa: 0,
  });

  const calculateFocusingGain = (
    transducerDimensionCm: number,
    focalDepthCm: number,
    frequencyMHz: number
  ): number => {
    const wavelengthM = SPEED_OF_SOUND_M_PER_S / (frequencyMHz * MHZ_TO_HZ);
    const transducerDimensionM = transducerDimensionCm * CM_TO_M;
    const focalDepthM = focalDepthCm * CM_TO_M;
    const fresnelNumber = (transducerDimensionM ** 2) / (wavelengthM * focalDepthM);
    return Math.sqrt(fresnelNumber);
  };

  const calculateIntensity = (pressurePa: number, impedanceRayl: number): number => {
    return ((pressurePa * pressurePa) / (2 * impedanceRayl)) * CM2_TO_M2;
  };

  const calculateAverageIntensity = (intensityPerPulseWPerCm2: number, dutyCycle: number): number => {
    return (intensityPerPulseWPerCm2 * dutyCycle) * W_TO_MW;
  };

  const calculateBeamAreaAtSkull = (
    transducerWidthCm: number,
    transducerHeightCm: number,
    useElevationalFocusing: boolean,
    elevationalFocalDepthCm: number,
    useAzimuthalFocusing: boolean,
    azimuthalFocalDepthCm: number
  ): number => {
    const skullDepthCm = 1; // 1 cm, including scalp (conservative)

    if (skullDepthCm / elevationalFocalDepthCm < 0 || skullDepthCm / azimuthalFocalDepthCm < 0) {
      throw new Error("Focal depth is too shallow. TODO: Implement diffraction-limited focusing.");
    }

    let areaFactor = 1;
    // Apply elevational focusing (affects height)
    if (useElevationalFocusing) {
      areaFactor *= (1 - skullDepthCm / elevationalFocalDepthCm);
    }

    // Apply azimuthal focusing (affects width)
    if (useAzimuthalFocusing) {
      areaFactor *= (1 - skullDepthCm / azimuthalFocalDepthCm);
    }

    return transducerWidthCm * transducerHeightCm * areaFactor;
  };

  const calculateThermalIndex = (
    transducerWidthCm: number,
    transducerHeightCm: number,
    transducerAverageIntensityMWPerCm2: number,
    useElevationalFocusing: boolean,
    elevationalFocalDepthCm: number,
    useAzimuthalFocusing: boolean,
    azimuthalFocalDepthCm: number
  ): number => {
    const transducerAreaCm2 = transducerWidthCm * transducerHeightCm;
    const transducerPowerMW = transducerAverageIntensityMWPerCm2 * transducerAreaCm2;

    const beamAreaAtSkullCm2 = calculateBeamAreaAtSkull(
      transducerWidthCm,
      transducerHeightCm,
      useElevationalFocusing,
      elevationalFocalDepthCm,
      useAzimuthalFocusing,
      azimuthalFocalDepthCm
    );

    const equivalentDiameterCm = 2 * Math.sqrt(beamAreaAtSkullCm2 / Math.PI);
    return transducerPowerMW / (C_CONSTANT_MW_PER_CM * equivalentDiameterCm);
  };

  const calculateMechanicalIndex = (brainPressurePa: number, frequencyMHz: number): number => {
    const brainPressureMPa = brainPressurePa * PA_TO_MPA;
    return brainPressureMPa / Math.sqrt(frequencyMHz);
  };

  const calculateResults = (p: SafetyParams) => {
    const pulseDurationSec = p.cycles / (p.frequencyMHz * MHZ_TO_HZ);
    const dutyCycle = pulseDurationSec * (p.pulseRepetitionRateKHz * KHZ_TO_HZ);
    const transducerPressurePa = p.transducerPressureKPa * KPA_TO_PA;
    
    const transducerIntensityPerPulseWPerCm2 = calculateIntensity(transducerPressurePa, IMPEDANCE_RAYL);
    const transducerAverageIntensityMWPerCm2 = calculateAverageIntensity(
      transducerIntensityPerPulseWPerCm2,
      dutyCycle
    );

    let brainPressurePa = transducerPressurePa;

    // Apply elevational focusing gain if enabled
    if (p.useElevationalFocusing) {
      brainPressurePa *= calculateFocusingGain(
        p.transducerHeightCm,
        p.elevationalFocalDepthCm,
        p.frequencyMHz
      );
    }

    // Apply azimuthal focusing gain if enabled
    if (p.useAzimuthalFocusing) {
      brainPressurePa *= calculateFocusingGain(
        p.transducerWidthCm,
        p.azimuthalFocalDepthCm,
        p.frequencyMHz
      );
    }

    // Calculate intensity at focal spot
    const brainIntensityPerPulseWPerCm2 = calculateIntensity(brainPressurePa, IMPEDANCE_RAYL);
    const brainAverageIntensityMWPerCm2 = calculateAverageIntensity(
      brainIntensityPerPulseWPerCm2,
      dutyCycle
    );

    const mechanicalIndex = calculateMechanicalIndex(brainPressurePa, p.frequencyMHz);
    const tic = calculateThermalIndex(
      p.transducerWidthCm,
      p.transducerHeightCm,
      transducerAverageIntensityMWPerCm2,
      p.useElevationalFocusing,
      p.elevationalFocalDepthCm,
      p.useAzimuthalFocusing,
      p.azimuthalFocalDepthCm
    );

    const transducerAreaCm2 = p.transducerWidthCm * p.transducerHeightCm;
    const transducerAveragePowerMW = transducerAverageIntensityMWPerCm2 * transducerAreaCm2;
    const brainPressureKPa = brainPressurePa / KPA_TO_PA;

    setResults({
      pulseDurationSec,
      dutyCycle,
      intensityPerPulseWPerCm2: brainIntensityPerPulseWPerCm2,
      averageIntensityMWPerCm2: brainAverageIntensityMWPerCm2,
      transducerAveragePowerMW,
      tic,
      mechanicalIndex,
      brainPressureKPa,
    });
  };

  useEffect(() => {
    calculateResults(params);
  }, [params]);

  const getMaxExposureTime = (tic: number) => {
    // BMUS limits
    if (tic <= 0.7) return Infinity;
    if (tic <= 1) return 60;
    if (tic <= 1.5) return 30;
    if (tic <= 2) return 15;
    if (tic <= 2.5) return 4;
    if (tic <= 3) return 1;
    return 0;
  };

  const getITRUSSTMaxExposureTime = (tic: number) => {
    // ITRUSST limits
    if (tic <= 1.5) return Infinity;
    if (tic <= 2) return 80;
    if (tic <= 2.5) return 40;
    if (tic <= 3) return 10;
    if (tic <= 4) return 2.67;
    if (tic <= 4.5) return 0.67;
    if (tic <= 5) return 0.17;
    return 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setParams((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : parseFloat(value),
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
                Pulse Repetition Frequency (kHz)
              </label>
              <input
                type="number"
                name="pulseRepetitionRateKHz"
                value={params.pulseRepetitionRateKHz}
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
                name="frequencyMHz"
                value={params.frequencyMHz}
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
                name="transducerWidthCm"
                value={params.transducerWidthCm}
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
                name="transducerHeightCm"
                value={params.transducerHeightCm}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Plane Wave Pressure (kPa)
              </label>
              <input
                type="number"
                name="transducerPressureKPa"
                value={params.transducerPressureKPa}
                onChange={handleInputChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="useElevationalFocusing"
                  checked={params.useElevationalFocusing}
                  onChange={handleInputChange}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
                Elevational Focusing
              </label>
            </div>
            {params.useElevationalFocusing && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Elevational Focal Depth (cm)
                </label>
                <input
                  type="number"
                  name="elevationalFocalDepthCm"
                  value={params.elevationalFocalDepthCm}
                  onChange={handleInputChange}
                  step="0.1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="flex items-center text-sm font-medium text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  name="useAzimuthalFocusing"
                  checked={params.useAzimuthalFocusing}
                  onChange={handleInputChange}
                  className="mr-2 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                />
                Azimuthal Focusing
              </label>
            </div>
            {params.useAzimuthalFocusing && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Azimuthal Focal Depth (cm)
                </label>
                <input
                  type="number"
                  name="azimuthalFocalDepthCm"
                  value={params.azimuthalFocalDepthCm}
                  onChange={handleInputChange}
                  step="0.1"
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-gray-200">
            <div className="space-y-2 text-sm">
              <div>
                <span className="font-medium text-gray-700">Duty Cycle: </span>
                <span className="text-gray-900">{(results.dutyCycle * 100).toFixed(2)}%</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Transducer Average Power: </span>
                <span className="text-gray-900">{results.transducerAveragePowerMW.toFixed(2)} mW</span>
              </div>
              {(params.useElevationalFocusing || params.useAzimuthalFocusing) && (
                <div>
                  <span className="font-medium text-gray-700">Pressure at Focus: </span>
                  <span className="text-gray-900">{(results.brainPressureKPa / KPA_TO_PA).toFixed(1)} MPa</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Safety Analysis</h2>

          <div className="space-y-6">
            <div className="border-b pb-4">
              <h3 className="text-lg font-medium mb-2">
                Mechanical Index (MI) Check
              </h3>
              <div className="flex items-center">
                {results.mechanicalIndex < 1.9 ? (
                  <CheckCircle className="text-green-500 w-6 h-6 mr-2" />
                ) : (
                  <AlertTriangle className="text-red-500 w-6 h-6 mr-2" />
                )}
                <span>{results.mechanicalIndex.toFixed(2)} (Limit: 1.9)</span>
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="text-lg font-medium mb-2">Peak Intensity Check (ISPPA)</h3>
              <div className="flex items-center">
                {results.intensityPerPulseWPerCm2 < 190 ? (
                  <CheckCircle className="text-green-500 w-6 h-6 mr-2" />
                ) : (
                  <AlertTriangle className="text-red-500 w-6 h-6 mr-2" />
                )}
                <span>
                  {results.intensityPerPulseWPerCm2.toFixed(2)} W/cm² (Limit:
                  190 W/cm²)
                </span>
              </div>
            </div>

            <div className="border-b pb-4">
              <h3 className="text-lg font-medium mb-2">
                Average Intensity Check (ISPTA)
              </h3>
              <div className="flex items-center">
                {results.averageIntensityMWPerCm2 < 720 ? (
                  <CheckCircle className="text-green-500 w-6 h-6 mr-2" />
                ) : (
                  <AlertTriangle className="text-red-500 w-6 h-6 mr-2" />
                )}
                <span>
                  {results.averageIntensityMWPerCm2.toFixed(2)} mW/cm² (Limit:
                  720 mW/cm²)
                </span>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">
                Thermal Index (TIC) Check
              </h3>
              <div className="flex items-center mb-2">
                {results.tic < 3 ? (
                  <CheckCircle className="text-green-500 w-6 h-6 mr-2" />
                ) : (
                  <AlertTriangle className="text-red-500 w-6 h-6 mr-2" />
                )}
                <span>
                  {results.tic.toFixed(2)}°C (BMUS Limit: 3°C, ITRUSST Limit:
                  6°C)
                </span>
              </div>

              <div className="!bg-red-50 p-4 rounded-lg">
                <div className="flex items-center mb-2">
                  <Info className="text-red-600 w-5 h-5 mr-2" />
                  <span className="text-red-600 font-medium">
                    Maximum Exposure Times
                  </span>
                </div>
                <div className="ml-7 space-y-1">
                  <p>BMUS: {getMaxExposureTime(results.tic)} minutes</p>
                  <p>
                    ITRUSST: {getITRUSSTMaxExposureTime(results.tic)} minutes
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center mt-8 text-sm text-gray-500">
          <a
            href="https://github.com/rhotter/tfus-safety-calculator"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-700 underline"
          >
            Source Code
          </a>
        </div>
      </div>
    </div>
  );
}

export default App;
