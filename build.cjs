const fs = require('node:fs');
const path = require('node:path');
const dependencyPaths = [__dirname, path.resolve(__dirname,'../aspirin-synthesis-sim')];
const esbuild = require(require.resolve('esbuild',{paths:dependencyPaths}));
const threeRoot = path.resolve(path.dirname(require.resolve('three',{paths:dependencyPaths})),'..');
(async()=>{
 const code = await esbuild.build({entryPoints:[path.join(__dirname,'main.js')],bundle:true,write:false,format:'iife',minify:true,target:['es2022'],nodePaths:[path.dirname(threeRoot)],legalComments:'inline'});
 const html=fs.readFileSync(path.join(__dirname,'index.template.html'),'utf8').replace('/* INLINE_CSS */',fs.readFileSync(path.join(__dirname,'style.css'),'utf8')).replace('/* INLINE_JS */',()=>code.outputFiles[0].text.replace(/<\/script/gi,'<\\/script'));
 fs.mkdirSync(path.join(__dirname,'배포본'),{recursive:true});
 fs.writeFileSync(path.join(__dirname,'배포본/index.html'),html);
 fs.copyFileSync(path.join(threeRoot,'LICENSE'),path.join(__dirname,'배포본/THREE-LICENSE.txt'));
 for(const name of ['LICENSE.txt','사용안내.txt']){const source=path.join(__dirname,name);if(fs.existsSync(source))fs.copyFileSync(source,path.join(__dirname,'배포본',name));}
 console.log('Built offline single-file distribution:',(Buffer.byteLength(html)/1024).toFixed(0),'KiB');
})().catch(e=>{console.error(e);process.exitCode=1;});
