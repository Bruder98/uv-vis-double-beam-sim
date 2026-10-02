import assert from 'node:assert/strict';
import {measure, spectrum} from './model.mjs';
const p={kind:'a',nm:662,concentration:1,length:1,lamp:100,baseline:0};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-10,`${a} != ${b}`);
const a=measure(p);close(a.A,spectrum('a',662));close(a.T,10**(-a.A));
close(measure({...p,concentration:2}).A,2*a.A);
close(measure({...p,length:2}).A,2*a.A);
close(measure({...p,lamp:50}).A,a.A);
close(measure({...p,lamp:150}).A,a.A);
close(measure({...p,kind:'blank'}).A,0);
close(measure({...p,concentration:0}).A,0);
assert.equal(measure({...p,baseline:null}).A,null);
const dirty=measure({...p,nm:550,baseline:.11});assert.ok(dirty.A<0&&dirty.T>1);close(dirty.A,spectrum('a',550)-.11);
close(measure({...p,kind:'blank',baseline:.11}).A,-.11); // clean blank after contaminated baseline
close(measure({...p,kind:'blank',baseline:.11,blankAbsorbance:.11}).A,0); // contaminated blank during zeroing
const scanned=Array.from({length:321},(_,i)=>measure({...p,nm:380+i}));assert.ok(scanned.every(x=>Number.isFinite(x.A)&&x.T>0&&x.T<=1));
console.log('PASS: blank, absorbance, transmittance, concentration, path length, lamp cancellation, negative baseline and 321-point scan');
