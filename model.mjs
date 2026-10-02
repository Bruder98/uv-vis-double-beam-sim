// Teaching model: broad pigment bands, not digitized experimental spectra.
export const pigments = {
  a: { name: '엽록소 a', color: '#258b70', peaks: [[430, 19, 0.95], [662, 15, 0.775]] },
  b: { name: '엽록소 b', color: '#89a940', peaks: [[455, 20, 0.90], [644, 17, 0.65]] },
  carotene: { name: '카로틴', color: '#df9a29', peaks: [[452, 22, 0.72], [480, 18, 0.58]] },
  mix: { name: '잎 색소 혼합물', color: '#386b35' }
};
export function spectrum(kind, nm) {
  if (kind === 'blank') return 0;
  if (kind === 'mix') return 0.55*spectrum('a', nm)+0.30*spectrum('b', nm)+0.25*spectrum('carotene', nm);
  return 0.025 + pigments[kind].peaks.reduce((v,[mu,sd,h]) => v+h*Math.exp(-0.5*((nm-mu)/sd)**2),0);
}
export function measure({kind, nm, concentration, length, lamp, baseline, blankAbsorbance=0}) {
  const trueA = kind==='blank' ? blankAbsorbance : spectrum(kind,nm)*concentration*length;
  // Solvent transmission and channel imbalance are intentionally present.
  // The 0.5 is a common relative throughput scale, not a 50:50 spatial splitter.
  const R = lamp*0.5*0.97;
  const S = R*0.96*10**(-trueA);
  const rhoBlank = baseline === null ? null : 0.96*10**(-baseline);
  const I0 = rhoBlank === null ? null : R*rhoBlank;
  const T = I0 === null ? null : S/I0;
  return {trueA,R,S,I0,T,A:T===null?null:-Math.log10(T)};
}
export function wavelengthColor(nm) {
  // UV has no visible color; violet here is explicitly a false-color cue.
  let r=0,g=0,b=0;
  if(nm<440){r=-(nm-440)/60;b=1;} else if(nm<490){g=(nm-440)/50;b=1;}
  else if(nm<510){g=1;b=-(nm-510)/20;} else if(nm<580){r=(nm-510)/70;g=1;}
  else if(nm<645){r=1;g=-(nm-645)/65;} else r=1;
  return `rgb(${Math.round(Math.max(0,Math.min(1,r))*220)},${Math.round(Math.max(0,Math.min(1,g))*220)},${Math.round(Math.max(0,Math.min(1,b))*220)})`;
}
