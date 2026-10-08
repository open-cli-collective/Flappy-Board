/* Validation and layout are shared by the browser renderer and Node tests. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;else root.SplitFlapCore=api;})(globalThis,()=>{
  'use strict';
  const segmenter=new Intl.Segmenter(undefined,{granularity:'grapheme'});
  const graphemes=text=>Array.from(segmenter.segment(text),item=>item.segment);
  const defaults={columns:22,rows:6,aspectRatio:.525,characterScale:1,faceColor:'#2a2f37',textColor:'#f0f0e9',frameColor:null,fontFamily:'"Helvetica Neue",Arial,sans-serif',reducedMotion:'system',transition:{type:'wave',direction:'left-to-right',durationMs:1800,sweepMs:900}};
  const clone=value=>JSON.parse(JSON.stringify(value));
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  function fail(message){throw new TypeError(message);}
  function keys(value,allowed,path){if(!object(value))fail(path+' must be an object');for(const k of Object.keys(value))if(!allowed.includes(k))fail(path+'.'+k+' is unknown');}
  function number(value,min,max,path,integer=false){if(!Number.isFinite(value)||value<min||value>max||(integer&&!Number.isInteger(value)))fail(`${path} must be ${integer?'an integer':'a number'} between ${min} and ${max}`);return value;}
  function color(value,path){if(typeof value!=='string'||!/^#[\da-f]{6}$/i.test(value))fail(path+' must be #RRGGBB');return value;}
  function transition(value={},base=defaults.transition,cell=false){
    keys(value,['type','direction','durationMs','sweepMs'],'transition');
    const t={...base,...value};
    if(!['instant','flip','wave'].includes(t.type)||(cell&&t.type==='wave'))fail('Unsupported transition type');
    if(!['left-to-right','right-to-left','top-to-bottom','bottom-to-top'].includes(t.direction))fail('Unsupported transition direction');
    number(t.durationMs,0,60000,'durationMs');number(t.sweepMs,0,60000,'sweepMs');
    if(t.type==='instant'){t.durationMs=0;t.sweepMs=0;}
    else {if(t.durationMs===0)fail('Animated durationMs must be greater than zero');if(t.type==='flip')t.sweepMs=0;else if(t.sweepMs>=t.durationMs)fail('sweepMs must be less than durationMs');}
    return t;
  }
  function config(patch={},previous=defaults){
    keys(patch,Object.keys(defaults),'config');const c={...previous,...patch};
    number(c.columns,1,64,'columns',true);number(c.rows,1,32,'rows',true);if(c.columns*c.rows>1024)fail('Maximum board size is 1024 cells');
    number(c.aspectRatio,.25,2,'aspectRatio');number(c.characterScale,.25,2,'characterScale');
    color(c.faceColor,'faceColor');color(c.textColor,'textColor');if(c.frameColor!==null)color(c.frameColor,'frameColor');
    if(typeof c.fontFamily!=='string'||!c.fontFamily.trim())fail('fontFamily must be a nonempty string');
    if(!['system',true,false].includes(c.reducedMotion))fail('reducedMotion must be system, true, or false');
    c.transition=transition(patch.transition??{},previous.transition);return clone(c);
  }
  function face(value,path){
    if(typeof value==='string'){if(/[\t\r\n]/.test(value)||graphemes(value).length!==1)fail(path+' must contain exactly one grapheme');return {text:value,color:null};}
    keys(value,['color'],path);return {text:'',color:color(value.color,path+'.color')};
  }
  function position(at,c,path){keys(at,['x','y'],path);number(at.x,0,1000000,path+'.x',true);number(at.y,0,1000000,path+'.y',true);return at.x<c.columns&&at.y<c.rows;}
  function message(input,c){
    keys(input,['id','lines','cells','transition','effects'],'message');
    if(input.id!==undefined&&typeof input.id!=='string')fail('id must be a string');
    const lines=input.lines??[];if(!Array.isArray(lines)||lines.some(x=>typeof x!=='string'))fail('lines must be an array of strings');
    if(lines.some(x=>/[\t\r\n]/.test(x)))fail('Use separate lines entries for newlines; tabs are not supported');
    const warnings=[],base=Array.from({length:c.columns*c.rows},()=>({text:' ',color:null}));
    if(lines.length>c.rows)warnings.push({code:'ROWS_TRUNCATED',received:lines.length,rendered:c.rows});
    lines.slice(0,c.rows).forEach((line,y)=>{const chars=graphemes(line);if(chars.length>c.columns)warnings.push({code:'ROW_TRUNCATED',y,received:chars.length,rendered:c.columns});chars.slice(0,c.columns).forEach((text,x)=>base[y*c.columns+x]={text,color:null});});
    const overrides=input.cells??[];if(!Array.isArray(overrides))fail('cells must be an array');const occupied=new Set();
    overrides.forEach((entry,i)=>{keys(entry,['at','value'],'cells['+i+']');const value=face(entry.value,'cells['+i+'].value');if(!position(entry.at,c,'cells['+i+'].at')){warnings.push({code:'CELL_OUT_OF_BOUNDS',at:entry.at});return;}const idx=entry.at.y*c.columns+entry.at.x;if(occupied.has(idx))fail('Duplicate cell override');occupied.add(idx);base[idx]=value;});
    const effects=input.effects??[];if(!Array.isArray(effects))fail('effects must be an array');const seen=new Set(),normalized=[];
    effects.forEach((effect,i)=>{
      keys(effect,['at','frames','intervalMs','transition','repeat'],'effects['+i+']');
      if(!Array.isArray(effect.frames)||effect.frames.length<2||effect.frames.length>256)fail('effects frames must contain 2–256 entries');
      const frames=effect.frames.map((f,j)=>face(f,`effects[${i}].frames[${j}]`));
      const intervalMs=number(effect.intervalMs,16,86400000,'intervalMs');
      const t=transition(effect.transition??{},{type:'instant',direction:'left-to-right',durationMs:0,sweepMs:0},true);
      if(t.durationMs>intervalMs)fail('Effect durationMs cannot exceed intervalMs');
      const repeat=effect.repeat===undefined?null:number(effect.repeat,1,1000000,'repeat',true);
      if(!position(effect.at,c,'effects['+i+'].at')){warnings.push({code:'EFFECT_OUT_OF_BOUNDS',at:effect.at});return;}
      const idx=effect.at.y*c.columns+effect.at.x;if(seen.has(idx))fail('Multiple effects target the same cell');seen.add(idx);
      normalized.push({index:idx,frames,intervalMs,transition:t,repeat});
    });
    return {id:input.id??null,base,effects:normalized,transition:transition(input.transition??{},c.transition),warnings};
  }
  function timing(index,c,t){
    if(t.type!=='wave')return {delay:0,duration:t.durationMs};
    const vertical=t.direction==='top-to-bottom'||t.direction==='bottom-to-top';const count=vertical?c.rows:c.columns;
    let axis=vertical?Math.floor(index/c.columns):index%c.columns;
    if(t.direction==='right-to-left'||t.direction==='bottom-to-top')axis=count-1-axis;
    return {delay:count===1?0:axis/(count-1)*t.sweepMs,duration:count===1?t.durationMs:t.durationMs-t.sweepMs};
  }
  return {defaults,config,message,graphemes,timing,clone};
});
