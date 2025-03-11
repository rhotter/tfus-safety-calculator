# Transcrnial Ultrasound Safety Calculator

Ultrasound at low power is safe and has been used in imaging since the mid 90s for fetuses, brains, hearts, etc.

But at high ultrasound power, one needs to be careful. There are two ways ultrasound can damage tissue:

1. **Mechanical cavitation:** ultrasound waves compress and decompress a medium. In the decompression stage, if the pressure is too low, microscopic cavities or bubbles can form. Then the bubbles can collapse rapidly, which can be dangerous.
2. **Thermal damage:** Tissue absorbs ultrasound, so the ultrasound power gets converted into heat. If there’s too much ultrasound power, the heating can raise the temperature of the tissue to dangerous levels.

## How much power is acceptable?

### Mechanical cavitation

To avoid mechanical cavitation, FDA regulations set a maximum on the mechanical index, $\text{MI}$, to 1.9, where the mechanical index is:

$$
\text{MI}=\frac{p_{\text{min}}}{\sqrt{f}}
$$

where $p_\text{min}$ is the peak rarefactional pressure in MPa, and $f$ is the frequency in MHz. So at 1 MHz, the peak rarefactional pressure is 1.9 MPa.

### Thermal damage

The FDA sets an average intensity limit of 720 mW/cm^2 and a per-pulse limit of 190 W/cm^2 intensity. We can compute the intensity as

$$
I = \frac{p_{max}^2}{2 Z}
$$

where $p_{max}$ is the peak pressure and $Z$ is the acoustic impedance of tissue (1.5 MRayl).

### Thermal index

The FDA limits the spatial-peak temporally average intensity (SPTA), but the real limit is on the temperature rise. Tissue can sustain a temperature rise of up to 2 ºC.

A proxy for temperature rise is called the thermal index, which can be interpretted as the temperature rise in degrees celcius.

There are different ways of computing the thermal index, one [paper](https://arxiv.org/abs/2311.05359) recommends using the cranial thermal index (TIC)

$$
TIC = \frac{W_0/D_{eq}}{C_{TIC}}
$$

where $W_0$ is the output power of our transducer in mW, $D_{eq}$ is the diameter of the transducer in cm, $C_{TIC} = 40 \text{ mW/cm}$ is the power per unit length needed to raise the temperature of bone by 1 degree celcius.
