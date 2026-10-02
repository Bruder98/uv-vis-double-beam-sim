import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { pigments, spectrum, measure, wavelengthColor } from './model.mjs';

const $ = id => document.getElementById(id);
const state = {mode:'principle',step:0,nm:662,selected:'a',kind:'blank',blankAbsorbance:0,concentration:1,length:1,lamp:100,baseline:null,loaded:false,playing:true,scan:null,data:[]};
const steps = [
 ['광원','여러 파장의 빛을 만듭니다','UV–vis 장비는 보통 자외선용 중수소 광원과 가시광선용 텅스텐–할로젠 광원을 사용합니다. 이 모형은 활동지의 380–700 nm 범위를 다룹니다.'],
 ['회절격자와 슬릿','측정할 파장만 선택합니다','회절격자가 빛을 파장별로 분산하고 출구 슬릿이 좁은 파장 범위의 빛을 통과시킵니다. 파장 조절 막대를 움직여 선택된 빛의 색을 관찰하세요.'],
 ['회전 디스크','두 광학 경로를 번갈아 엽니다','투명 구간은 시료 쪽으로 빛을 통과시키고, 거울 구간은 기준 쪽으로 반사합니다. 차단 구간에서는 암신호를 확인합니다. 빛을 시간적으로 나누는 이중 빔 방식입니다.'],
 ['기준·시료 큐벳','색소가 빛의 일부를 흡수합니다','기준 큐벳에는 용매인 에탄올을, 시료 큐벳에는 같은 용매에 녹인 색소를 넣습니다. 시료를 지난 빛은 색소의 흡수 정도에 따라 약해집니다.'],
 ['검출기','두 빛을 하나의 검출기로 읽습니다','거울과 두 번째 회전 디스크가 두 경로의 빛을 검출기로 보냅니다. 검출기는 시료 신호 S와 기준 신호 R을 번갈아 측정하고 빛이 차단될 때의 암신호를 보정합니다.'],
 ['흡광도 계산','신호의 비율을 흡광도로 바꿉니다','Blank의 S/R 비율을 기준으로 투과율 T를 보정합니다. A = −log₁₀T이며, 같은 파장에서는 농도와 광로 길이에 비례합니다. 이제 Blank를 보정한 뒤 시료를 넣어 보세요.']
];
steps.forEach(([name],i) => {const li=document.createElement('li');const b=document.createElement('button');b.innerHTML=`<span>0${i+1}</span>${name}`;b.onclick=()=>setStep(i);li.append(b);$('steps').append(li);});
function setStep(i){state.step=Math.max(0,Math.min(5,i));document.querySelectorAll('#steps button').forEach((b,j)=>{b.classList.toggle('active',j===state.step);b.setAttribute('aria-pressed',String(j===state.step));});$('step-kicker').textContent=`STEP 0${state.step+1}`;$('step-title').textContent=steps[state.step][1];$('step-copy').textContent=steps[state.step][2];$('step-count').textContent=`${state.step+1} / 6`;$('prev').disabled=state.step===0;$('next').disabled=state.step===5;}
function setMode(mode){state.mode=mode;document.body.classList.toggle('experiment-mode',mode==='experiment');['principle','experiment'].forEach(id=>{$(id).classList.toggle('active',id===mode);$(id).setAttribute('aria-pressed',String(id===mode));});$('guide-title').textContent=mode==='principle'?'빛의 경로를 따라가세요':'원리를 실험으로 연결하세요';$('go-measure').hidden=mode==='experiment';if(mode==='experiment')setStep(3);}
$('prev').onclick=()=>setStep(state.step-1);$('next').onclick=()=>setStep(state.step+1);
$('principle').onclick=()=>setMode('principle');['experiment','go-measure','start-experiment'].forEach(id=>$(id).onclick=()=>setMode('experiment'));
const current=()=>measure(state);
function status(text){$('status').textContent=text;}
function clearScan(){state.scan=null;state.data=[];$('export').disabled=true;$('scan').textContent='③ 380–700 nm 스캔';$('scan').disabled=!state.loaded||state.baseline===null;$('chart-caption').textContent='스캔하면 1 nm 간격으로 321개의 값을 기록합니다. 그래프를 누르면 해당 파장을 선택할 수 있습니다.';}
function refresh(){
 const v=current();$('nm-out').textContent=state.nm;$('concentration-out').textContent=state.concentration.toFixed(1);$('length-out').textContent=state.length.toFixed(1);$('lamp-out').textContent=state.lamp;
 $('i0').textContent=v.I0===null?'—':v.I0.toFixed(2);$('intensity').textContent=state.baseline===null?'—':v.S.toFixed(2);$('transmission').textContent=v.T===null?'—':(v.T*100).toFixed(2)+'%';$('absorbance').textContent=v.A===null?'—':(Math.abs(v.A)<0.0005?0:v.A).toFixed(3);
 $('calibration-badge').textContent=state.baseline===null?'보정 전':state.baseline>0?'오염된 Blank 기준':'Blank 보정 완료';
 $('insert').disabled=state.baseline===null;$('scan').disabled=state.baseline===null||!state.loaded;
 if(v.A===null)$('calculation').textContent='Blank 보정 후 시료를 넣으면 투과율과 흡광도를 계산합니다.';
 else if(v.A<-.001)$('calculation').textContent=`A = −log₁₀(${v.T.toFixed(4)}) = ${v.A.toFixed(3)}. 오염된 Blank가 기준값을 낮춰 보정 투과율이 100%를 넘었습니다.`;
 else $('calculation').textContent=`A = −log₁₀(${v.S.toFixed(2)} / ${v.I0.toFixed(2)}) = ${v.A.toFixed(3)}${state.loaded?' · '+pigments[state.kind].name:' · 에탄올 Blank'}`;
 $('chart-sample').textContent=state.loaded?pigments[state.kind].name+' · '+state.concentration.toFixed(1)+'× · '+state.length.toFixed(1)+' cm':'시료를 넣어 스캔하세요';
 drawChart();updateScene();
}
function calibrate(){clearScan();state.kind='blank';state.loaded=false;state.baseline=Number($('blank-quality').value);state.blankAbsorbance=state.baseline;status(state.baseline===0?'Baseline complete · A = 0.000. 이제 선택한 시료를 넣으세요.':'오염된 Blank를 0.000으로 보정했습니다. 깨끗한 시료 큐벳으로 바꿔 550 nm에서 비교하세요.');refresh();}
function insert(){if(state.baseline===null)return;clearScan();state.kind=state.selected;state.loaded=true;status(`${pigments[state.kind].name} 시료를 넣었습니다. 파장·농도를 바꾸거나 스캔하세요.`);refresh();}
$('zero').onclick=calibrate;$('insert').onclick=insert;
$('nm').oninput=e=>{if(state.scan){state.scan=null;$('scan').textContent='③ 380–700 nm 스캔';status('스캔을 중지했습니다. 다시 스캔하면 전체 범위를 측정합니다.');}state.nm=Number(e.target.value);refresh();};
$('pigment').onchange=e=>{clearScan();state.selected=e.target.value;state.kind='blank';state.loaded=false;status('새 시료를 선택했습니다. ② 선택한 시료 넣기를 누르세요.');refresh();};
['concentration','length','lamp'].forEach(id=>$(id).oninput=e=>{state[id]=Number(e.target.value);if(id==='length'){state.baseline=null;state.kind='blank';state.loaded=false;status('광로 길이가 달라졌습니다. 바뀐 큐벳으로 Blank를 다시 보정하세요.');clearScan();}else if(id==='concentration')clearScan();refresh();});
$('blank-quality').onchange=()=>{state.baseline=null;state.loaded=false;state.kind='blank';clearScan();status('Blank 조건을 바꿨습니다. ① Blank 넣고 0점 보정을 누르세요.');refresh();};
$('scan').onclick=()=>{if(!state.loaded||state.baseline===null)return;if(state.scan){state.scan=null;$('scan').textContent='③ 380–700 nm 스캔';status('스캔을 중지했습니다. 기록된 구간만 CSV로 저장됩니다.');return;}state.data=[];state.scan={next:380,elapsed:0};$('export').disabled=true;$('scan').textContent='■ 스캔 중지';status('380–700 nm · 1 nm 간격으로 스캔 중…');};
function reset(){Object.assign(state,{nm:662,selected:'a',kind:'blank',blankAbsorbance:0,concentration:1,length:1,lamp:100,baseline:null,loaded:false});clearScan();['nm','pigment','concentration','length','lamp'].forEach(id=>$(id).value=id==='pigment'?state.selected:state[id]);$('blank-quality').value='0';status('측정 모드에서 Blank부터 보정하세요.');refresh();}
$('reset').onclick=reset;
$('example').onclick=()=>{setMode('experiment');reset();calibrate();insert();status('예시 · 662 nm, 엽록소 a, 상대 농도 1×, 광로 길이 1 cm. I/I₀ ≈ 0.1585 → A ≈ 0.800. 파장을 550 nm로 옮겨 비교하세요.');};
$('export').onclick=()=>{if(!state.data.length)return;const meta=['# Educational synthetic model; not experimental measurements',`# sample=${pigments[state.kind].name};relative_concentration=${state.concentration};path_length_cm=${state.length};blank_absorbance=${state.baseline}`,'wavelength_nm,absorbance,transmittance_percent,reference_R,sample_S,equivalent_I0'];const csv='\uFEFF'+meta.concat(state.data.map(d=>[d.nm,d.A.toFixed(6),(d.T*100).toFixed(6),d.R.toFixed(6),d.S.toFixed(6),d.I0.toFixed(6)].join(','))).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`uv-vis_${state.kind}_${state.data.length}points.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function drawChart(){
 const data=state.data;const max=Math.max(1.2,current().A||0,...data.map(p=>p.A))*1.12;const min=state.baseline>0?-.2:0;const x=nm=>52+(nm-380)/320*575;const y=a=>196-(a-min)/(max-min)*157;
 let svg='';for(let j=0;j<5;j++){const a=min+(max-min)*j/4;svg+=`<line x1="52" y1="${y(a)}" x2="627" y2="${y(a)}" stroke="#e4ede6"/><text x="43" y="${y(a)+4}" text-anchor="end" fill="#789084" font-size="10">${a.toFixed(1)}</text>`;}
 [380,450,500,550,600,650,700].forEach(n=>svg+=`<text x="${x(n)}" y="215" text-anchor="middle" fill="#789084" font-size="10">${n}</text>`);
 svg+='<text x="52" y="20" fill="#7a9187" font-size="10">흡광도 A</text><text x="620" y="235" text-anchor="end" fill="#7a9187" font-size="10">파장 (nm)</text>';
 if(data.length>1){const path=data.map((p,i)=>`${i?'L':'M'}${x(p.nm).toFixed(2)},${y(p.A).toFixed(2)}`).join(' ');svg+=`<path d="${path} L${x(data.at(-1).nm)},${y(0)} L${x(data[0].nm)},${y(0)} Z" fill="#0f907510"/><path d="${path}" fill="none" stroke="#0d8b73" stroke-width="2.6"/>`;}
 else svg+='<text x="335" y="113" text-anchor="middle" fill="#9aaca1" font-size="12">스캔을 시작하면 측정점이 연결됩니다</text>';
 const v=current();svg+=`<line x1="${x(state.nm)}" y1="32" x2="${x(state.nm)}" y2="196" stroke="#bc965d" stroke-dasharray="4 4"/><text x="${Math.max(80,Math.min(590,x(state.nm)))}" y="31" text-anchor="middle" fill="#b08241" font-size="10">${state.nm} nm</text>`;
 if(v.A!==null){svg+=`<circle cx="${x(state.nm)}" cy="${y(v.A)}" r="4" fill="#cd9a51"/>`;}
 $('chart').innerHTML=svg;
}
$('chart').onclick=e=>{if(state.scan)return;const rect=$('chart').getBoundingClientRect();const px=(e.clientX-rect.left)*650/rect.width;state.nm=Math.round(Math.max(380,Math.min(700,380+(px-52)/575*320)));$('nm').value=state.nm;refresh();};

let renderer,scene,camera,orbit,liquid,selectedLight,monoFan,monoGrating,discs=[],beams=[],particles=[],labels=[],highlights=[];
const V=(x,y,z)=>new THREE.Vector3(x,y,z);
const rayY=1.1;
function material(color,opts={}){return new THREE.MeshStandardMaterial({color,roughness:.44,metalness:.12,...opts});}
function box(w,h,d,x,y,z,mat,group=scene){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;group.add(m);return m;}
function cylinderBetween(a,b,r,mat,group=scene){const delta=b.clone().sub(a);const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,delta.length(),12),mat);m.position.copy(a.clone().add(b).multiplyScalar(.5));m.quaternion.setFromUnitVectors(V(0,1,0),delta.normalize());group.add(m);return m;}
function mark(obj,step){obj.userData.step=step;highlights.push({obj,step});return obj;}
function addLabel(text,x,y,z,step){const b=document.createElement('button');b.className='object-label';b.textContent=text;b.onclick=()=>setStep(step);$('labels').append(b);labels.push({el:b,pos:V(x,y,z),step});}
function mirror(x,z,angle= Math.PI/4){const m=box(.12,1.12,.92,x,rayY,z,material('#9fb6b8',{metalness:.92,roughness:.16}));m.rotation.y=angle;box(.58,.12,.58,x,.33,z,material('#59726c'));return m;}
function disc(x,z){
 const base=new THREE.Group();base.position.set(x,rayY,z);base.rotation.y=Math.PI/4;scene.add(base);const spin=new THREE.Group();base.add(spin);
 ['#aebdc0','#f1fbf7','#273c37'].forEach((color,i)=>{const mesh=new THREE.Mesh(new THREE.CircleGeometry(.66,30,i*2*Math.PI/3,2*Math.PI/3),material(color,{side:THREE.DoubleSide,transparent:i===1,opacity:i===1?.32:1,metalness:i===0?.9:.2}));spin.add(mesh);});
 const rim=new THREE.Mesh(new THREE.TorusGeometry(.66,.03,8,60),material('#749288'));spin.add(rim);const hub=new THREE.Mesh(new THREE.SphereGeometry(.10,12,12),material('#314e45'));base.add(hub);box(.13,.7,.13,x,.65,z,material('#46665c'));box(.65,.17,.6,x,.24,z,material('#526f63'));discs.push(spin);return mark(base,2);
}
function addPath(points,branch){const path=new THREE.CatmullRomCurve3(points.map(p=>V(p[0],rayY,p[1])),false,'catmullrom',0);const segments=[];for(let i=0;i<points.length-1;i++){const a=V(points[i][0],rayY,points[i][1]),b=V(points[i+1][0],rayY,points[i+1][1]);const mat=new THREE.MeshBasicMaterial({color:0x27ba8e,transparent:true,opacity:.7,depthWrite:false});const m=cylinderBetween(a,b,.027,mat);const glow=cylinderBetween(a,b,.09,new THREE.MeshBasicMaterial({color:0x27ba8e,transparent:true,opacity:.06,depthWrite:false}));segments.push({m,glow});}beams.push({segments,branch});for(let i=0;i<10;i++){const dot=new THREE.Mesh(new THREE.SphereGeometry(.058,8,8),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true}));scene.add(dot);particles.push({dot,points:points.map(p=>V(p[0],rayY,p[1])),branch,offset:i/10});}}
function buildScene(){
 scene=new THREE.Scene();scene.background=new THREE.Color('#f6faf7');camera=new THREE.PerspectiveCamera(39,1,.1,100);renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor('#f6faf7');$('scene').prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label','회전 가능한 3D 분광분석기');renderer.domElement.setAttribute('role','img');
 orbit=new OrbitControls(camera,renderer.domElement);orbit.enableDamping=true;orbit.enablePan=false;orbit.minDistance=9;orbit.maxDistance=44;orbit.maxPolarAngle=Math.PI/2.12;orbit.target.set(-.1,.3,-1.2);home();
 scene.add(new THREE.HemisphereLight('#ffffff','#b0c2b5',2.5));const sun=new THREE.DirectionalLight('#ffffff',3.0);sun.position.set(-3,12,5);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=9;sun.shadow.camera.bottom=-9;scene.add(sun);const fill=new THREE.DirectionalLight('#b9e5df',1.2);fill.position.set(4,5,-8);scene.add(fill);
 box(16,.20,7.2,-.25,.04,-1.15,material('#dce9e1'));box(15.8,.08,7,-.25,.17,-1.15,material('#ecf4ee'));const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),material('#f5f9f6'));floor.rotation.x=-Math.PI/2;floor.position.y=-.2;floor.receiveShadow=true;scene.add(floor);
 [-7.4,7].forEach(x=>[-4.2,1.8].forEach(z=>{const screw=new THREE.Mesh(new THREE.CylinderGeometry(.07,.07,.02,12),material('#94ab9e'));screw.position.set(x,.23,z);scene.add(screw);}));
 // Lamp and open monochromator: entrance slit -> grating -> exit slit.
 mark(box(.95,1.45,1.10,-6.7,.92,0,material('#395e53')),0);box(.1,.38,.4,-6.17,rayY,0,material('#fff3b7',{emissive:'#ffe794',emissiveIntensity:1}));selectedLight=new THREE.PointLight('#ffd788',4,3);selectedLight.position.set(-6.12,1.3,0);scene.add(selectedLight);addLabel('01 광원',-6.7,1.9,0,0);
 mark(box(2.8,.18,2.5,-4.2,.38,0,material('#bdcdc1')),1);box(.09,.75,.56,-5.55,.94,0,material('#567468'));monoGrating=mark(box(.14,.78,.94,-4.7,rayY,0,material('#a6b8bc',{metalness:.96,roughness:.17})),1);monoGrating.rotation.y=-Math.PI/5;
 for(let k=0;k<18;k++){const line=box(.015,.66,.017,0,0,-.41+k*.048,material('#536e78'),monoGrating);}
 // Dispersion fan is a conceptual wavelength-selection illustration.
 monoFan=new THREE.Group();scene.add(monoFan);for(let k=0;k<7;k++){const color=wavelengthColor(400+k*45);cylinderBetween(V(-4.6,rayY,0),V(-3.3,rayY,-.67+k*.22),.012,new THREE.MeshBasicMaterial({color,transparent:true,opacity:.50}),monoFan);}
 mark(box(.09,.78,.42,-2.8,rayY,0,material('#47645a')),1);box(.11,.32,.075,-2.74,rayY,0,material('#e2f5df'));addLabel('02 回 회절격자 · 슬릿'.replace('回 ',''),-4.2,1.82,0,1);
 disc(-1,0);addLabel('03 회전 디스크',-1,2.03,.1,2);mirror(-1,-3);mirror(4.2,0,-Math.PI/4);disc(4.2,-3);
 // Rectangular cuvettes with clear wall edges and colored liquid.
 [0,-3].forEach((z,i)=>{const x=1.2;mark(box(1.05,.28,1.0,x,.37,z,material('#536c60')),3);const glass=mark(box(.66,1.35,.73,x,1.18,z,material('#c7f0e7',{transparent:true,opacity:.18,metalness:0,roughness:.1,depthWrite:false})),3);const edges=new THREE.LineSegments(new THREE.EdgesGeometry(glass.geometry),new THREE.LineBasicMaterial({color:'#9bbbb0',transparent:true,opacity:.65}));glass.add(edges);const content=box(.58,.89,.64,x,.99,z,material(i===0?'#238a65':'#c7e3d3',{transparent:true,opacity:i===0?.55:.2,depthWrite:false,metalness:0}));if(i===0)liquid=content;addLabel(i===0?'S 시료 큐벳':'R 기준 큐벳 · 에탄올',x,2.09,z,3);});
 const detector=mark(box(1.0,1.1,1.1,6.25,.94,-3,material('#35594c')),4);box(.08,.42,.45,5.71,rayY,-3,material('#142e29'));box(.32,.13,.07,6.1,1.27,-2.42,material('#5dcea4',{emissive:'#5dcea4',emissiveIntensity:.5}));addLabel('04 검출기',6.25,1.85,-3,4);addLabel('광로 재결합',4.2,2.01,-3,4);
 addPath([[-6.17,0],[-5.55,0],[-4.7,0]],'white');addPath([[-4.6,0],[-2.8,0],[-1,0]],'common');
 addPath([[-1,0],[.85,0]],'sample-before');addPath([[.85,0],[1.55,0]],'sample-inside');addPath([[1.55,0],[4.2,0],[4.2,-3],[5.71,-3]],'sample-after');
 addPath([[-1,0],[-1,-3],[.85,-3]],'ref-before');addPath([[.85,-3],[1.55,-3],[4.2,-3],[5.71,-3]],'ref-after');
 const raycaster=new THREE.Raycaster();let down=null;renderer.domElement.addEventListener('pointerdown',e=>down={x:e.clientX,y:e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>5)return;const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);for(const hit of raycaster.intersectObjects(scene.children,true)){let o=hit.object;while(o&&o.userData.step===undefined)o=o.parent;if(o){setStep(o.userData.step);break;}}});
 let previousAspect=0;
 const resize=()=>{const w=$('scene').clientWidth,h=$('scene').clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);if(!previousAspect||Math.abs(camera.aspect/previousAspect-1)>.12)home();previousAspect=camera.aspect;};new ResizeObserver(resize).observe($('scene'));resize();
}
function home(){if(!camera)return;const aspect=$('scene').clientWidth/$('scene').clientHeight;const distance=Math.min(42,Math.max(23,23/Math.max(.6,aspect)));orbit.target.set(-.1,.3,-1.2);camera.position.copy(V(10,12,12).normalize().multiplyScalar(distance).add(orbit.target));orbit.update();}
$('home').onclick=home;$('top').onclick=()=>{if(!camera)return;camera.position.set(-.1,21,-1.19);orbit.target.set(-.1,.3,-1.2);orbit.update();};
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.querySelector('.viewer').requestFullscreen();}catch{status('이 브라우저에서는 전체 화면을 지원하지 않습니다.');}};
$('play').onclick=()=>{state.playing=!state.playing;$('play').textContent=state.playing?'Ⅱ 일시정지':'▶ 재생';$('play').setAttribute('aria-pressed',String(!state.playing));};
let opticalTime=0,phase=0;
function updateScene(){if(!scene)return;if(liquid){liquid.material.color.set(state.loaded?pigments[state.kind].color:'#c7e3d3');liquid.material.opacity=state.loaded?.50:.18;}monoGrating.rotation.y=-Math.PI/5+(state.nm-540)/320*.45;}
function pathPoint(points,t){const distances=points.slice(1).map((p,i)=>p.distanceTo(points[i]));const length=distances.reduce((a,b)=>a+b,0);let distance=t*length;for(let i=0;i<distances.length;i++){if(distance<=distances[i])return points[i].clone().lerp(points[i+1],distance/distances[i]);distance-=distances[i];}return points.at(-1);}
function animateOptics(dt){
 if(state.playing)opticalTime+=dt;
 phase=Math.floor(opticalTime/.95)%3;const names=['시료광 통과 · S','기준광 통과 · R','빛 차단 · 암신호'];$('phase').textContent=names[phase];$('detector-phase').textContent=['시료 신호 S','기준 신호 R','암신호 (차단 구간)'][phase];const v=current();$('detector-signal').textContent=(phase===0?v.S:phase===1?v.R:.8).toFixed(2)+(phase===2?' · 보정 시 차감':' · 암신호 보정 후');
 if(!renderer)return;
 discs.forEach(d=>d.rotation.z=opticalTime/.95*(Math.PI*2/3));const spectral=wavelengthColor(state.nm);
 beams.forEach(({segments,branch})=>{const active=branch==='white'||branch==='common'||(branch.startsWith('sample')&&phase===0)||(branch.startsWith('ref')&&phase===1);const color=branch==='white'?'#fff5b5':spectral;const transmission=branch==='sample-after'?10**(-v.trueA):branch==='sample-inside'?Math.sqrt(10**(-v.trueA)):1;segments.forEach(({m,glow})=>{m.material.color.set(color);glow.material.color.set(color);m.material.opacity=active?Math.max(.06,.8*transmission):.04;glow.material.opacity=active?.10*transmission:.012;});});
 particles.forEach(p=>{const active=p.branch==='white'||p.branch==='common'||(p.branch.startsWith('sample')&&phase===0)||(p.branch.startsWith('ref')&&phase===1);const tr=p.branch==='sample-after'?10**(-v.trueA):1;p.dot.visible=active;p.dot.position.copy(pathPoint(p.points,(opticalTime*.43+p.offset)%1));p.dot.material.color.set(p.branch==='white'?'#fff7ce':spectral);p.dot.material.opacity=Math.max(.07,tr);p.dot.scale.setScalar(.55+.45*tr);});
 selectedLight.intensity=3*state.lamp/100;orbit.update();highlights.forEach(({obj,step})=>{if(obj.material&&obj.material.emissive){obj.material.emissive.set(step===state.step?'#143b28':'#000000');obj.material.emissiveIntensity=step===state.step?.28:0;}});
 labels.forEach(({el,pos,step})=>{const p=pos.clone().project(camera);const w=$('scene').clientWidth,h=$('scene').clientHeight;el.style.left=`${(p.x*.5+.5)*w}px`;el.style.top=`${(-p.y*.5+.5)*h}px`;el.hidden=p.z>1||p.z< -1;el.classList.toggle('active',step===state.step);});renderer.render(scene,camera);
}
let last=performance.now();function frame(now){const dt=Math.min((now-last)/1000,.1);last=now;if(state.scan){state.scan.elapsed+=dt;while(state.scan&&state.scan.elapsed>.017){state.scan.elapsed-=.017;state.nm=state.scan.next++;const d=current();state.data.push({nm:state.nm,...d});$('nm').value=state.nm;if(state.scan.next>700){state.scan=null;$('scan').textContent='③ 380–700 nm 스캔';status('스캔 완료 · 321개 파장값. CSV를 저장하거나 그래프를 눌러 비교하세요.');}refresh();$('export').disabled=false;}if(state.scan)$('chart-caption').textContent=`스캔 진행 ${state.data.length} / 321 · ${state.nm} nm` ;else $('chart-caption').textContent='380–700 nm, 1 nm 간격 · 321개 모형값. 그래프를 누르면 파장을 선택합니다.';}animateOptics(dt);requestAnimationFrame(frame);}
const about=`<div class="eyebrow">MODEL & SOURCES</div><h2>이 시뮬레이션의 범위</h2><p>제공된 「[탐구 활동지] 광합성 색소 분리 및 흡광도 분석」의 PART 2, 특히 4쪽의 회전 디스크·단일 검출기 구조와 380–700 nm 스캔, 에탄올 Blank 보정 절차를 참고했습니다. 셀 체인저는 구현하지 않고 기준·시료 큐벳 한 쌍의 원리에 집중했습니다.</p><p>색소 스펙트럼은 넓은 흡수대의 위치를 보여 주는 가우스 함수 기반 교육용 모형입니다. 실제 측정 데이터 또는 특정 용매의 인증된 흡광계수가 아닙니다. 농도는 상대값이며, 이상적인 희석 용액에서의 A = εcl 관계를 가정합니다. UV 측정·산란·형광·미광·검출기 포화는 구현 범위에 포함하지 않았습니다.</p><p>디스크 회전, 광학 부품의 크기와 배치는 원리를 보이도록 단순화했습니다. 두 번째 디스크도 첫 번째와 동기화되는 개념 모형이며, 실제 디스크의 연속 회전 각도와 광선 개폐의 기하학적 접촉을 재현한 설계 도면은 아닙니다.</p><p>참고: <a href="https://www.ssi.shimadzu.com/service-support/faq/uv-vis/instrument-design/24/index.html" target="_blank" rel="noopener">Shimadzu · Beam chopper</a> / <a href="https://www.ssi.shimadzu.com/service-support/technical-support/analysis-basics/fundamentals-uv/monochromators.html" target="_blank" rel="noopener">Shimadzu · Monochromators</a></p><p>3D 렌더링: Three.js (MIT). 배포 파일은 라이브러리를 내장해 인터넷 연결 없이 실행됩니다. 측정값은 서버로 전송하지 않습니다.</p>`;
$('about').onclick=()=>{$('info-content').innerHTML=about;$('info').showModal();};
$('help').onclick=()=>{$('info-content').innerHTML='<div class="eyebrow">QUICK START</div><h2>실험을 시작하는 방법</h2><ol><li>작동 원리 탐색에서 01–06 부품을 선택하며 빛의 경로를 관찰합니다. 마우스 드래그 또는 손가락으로 3D 모형을 회전할 수 있습니다.</li><li>시료 넣고 측정하기로 이동해 ① Blank 넣고 0점 보정을 누릅니다.</li><li>색소를 선택하고 ② 선택한 시료 넣기를 누릅니다. 파장·농도·광로 길이에 따른 변화를 관찰합니다. 광로 길이를 바꾸면 Blank를 다시 보정합니다.</li><li>③ 스캔으로 380–700 nm의 흡수 스펙트럼을 기록하고 CSV로 저장합니다.</li><li>오염된 Blank로 보정한 뒤 550 nm에서 측정해 음의 흡광도 오류를 탐구합니다.</li></ol><p>배포: 배포본/index.html 파일을 전달하거나 정적 웹 호스팅에 올리세요. 최신 Chrome·Edge·Firefox·Safari의 WebGL 지원이 필요합니다.</p>';$('info').showModal();};
$('close-info').onclick=()=>$('info').close();$('info').onclick=e=>{if(e.target===$('info')){const r=$('info').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('info').close();}};
try{buildScene();}catch(e){console.error('3D initialization:',e);$('fallback').hidden=false;$('labels').hidden=true;['home','top','fullscreen'].forEach(id=>$(id).disabled=true);renderer=null;}
setStep(0);refresh();requestAnimationFrame(frame);
