/* Browser entry point. Load visuals.js and core.js before this file. */
(function(){
  'use strict';
  const C=window.SplitFlapCore,V=window.SplitFlapVisuals;
  const equal=(a,b)=>a.text===b.text&&a.color===b.color;
  const isEmoji=text=>/\p{Extended_Pictographic}|\p{Regional_Indicator}|\u20e3/u.test(text);
  class SplitFlapBoard {
    constructor(element,options={}) {
      if(!(element instanceof HTMLElement))throw new TypeError('A host HTMLElement is required');
      this.host=element;this.config=C.config(options);this.destroyed=false;this.generation=0;this.jobs=new Map();this.timers=new Set();this.finish=null;this.messageId=null;
      this.shadow=element.attachShadow({mode:'open'});
      this.shadow.innerHTML='<style>'+V.css+'</style><div class="frame"><div class="board" aria-hidden="true"></div></div>';
      this.grid=this.shadow.querySelector('.board');this.host.setAttribute('role','img');
      this.motion=matchMedia('(prefers-reduced-motion: reduce)');
      this.rebuild();this.style();
      this.resize=new ResizeObserver(()=>this.fit());this.resize.observe(element);
    }
    assertLive(){if(this.destroyed)throw new Error('Board has been destroyed');}
    reduced(){return this.config.reducedMotion===true||(this.config.reducedMotion==='system'&&this.motion.matches);}
    rebuild(){
      this.grid.innerHTML=V.cell.repeat(this.config.columns*this.config.rows);
      this.cells=Array.from(this.grid.children).map(cell=>Object.fromEntries(Array.from(cell.querySelectorAll('[data-part]')).map(e=>[e.dataset.part,e])));
      this.current=this.cells.map(()=>({text:' ',color:null}));this.base=C.clone(this.current);this.current.forEach((f,i)=>this.paint(i,f));this.label();
    }
    style(){
      const c=this.config,s=this.grid.style;s.setProperty('--columns',c.columns);s.setProperty('--ratio',c.aspectRatio);s.setProperty('--character-scale',c.characterScale);s.setProperty('--face-color',c.faceColor);s.setProperty('--text-color',c.textColor);s.setProperty('--font-family',c.fontFamily);
      const frame=this.shadow.querySelector('.frame');if(c.frameColor)frame.style.setProperty('--frame-color',c.frameColor);else frame.style.removeProperty('--frame-color');this.fit();
    }
    fit(){const width=this.grid.getBoundingClientRect().width;this.grid.style.setProperty('--cell-width',(width/(this.config.columns+(this.config.columns-1)*.13))+'px');}
    put(i,part,face){const el=this.cells[i][part];el.textContent=face.text;el.classList.toggle('emoji',isEmoji(face.text));el.parentElement.style.background=face.color??this.config.faceColor;}
    paint(i,face){for(const part of ['top','bottom','front','back'])this.put(i,part,face);this.current[i]={...face};}
    label(){this.host.setAttribute('aria-label',this.base.reduce((rows,face,i)=>{if(i%this.config.columns===0)rows.push('');rows[rows.length-1]+=face.color?'■':face.text;return rows;},[]).join('\n'));}
    animate(i,to,timing){
      const previous=this.jobs.get(i);
      if(previous){this.paint(i,previous.to);previous.animations.forEach(a=>a.cancel());this.jobs.delete(i);}
      const from=this.current[i];if(equal(from,to))return Promise.resolve();
      if(this.reduced()||timing.duration===0){this.paint(i,to);return Promise.resolve();}
      const p=this.cells[i];this.put(i,'front',from);this.put(i,'bottom',from);this.put(i,'top',to);this.put(i,'back',to);
      const options={duration:timing.duration,delay:timing.delay,fill:'both'};
      const animations=[
        p.leaf.animate([{transform:'rotateX(0deg)'},{transform:'rotateX(-180deg)'}],{...options,easing:'cubic-bezier(.65,0,.35,1)'}),
        p.frontShade.animate([{opacity:0},{opacity:.55,offset:.5},{opacity:0}],options),
        p.backShade.animate([{opacity:.55},{opacity:0}],options),
        p.cast.animate([{opacity:0},{opacity:.32,offset:.5},{opacity:0}],options)
      ];
      const job={animations,from,to,timing};this.jobs.set(i,job);
      return Promise.all(animations.map(a=>a.finished)).then(()=>{
        if(this.jobs.get(i)!==job)return;
        this.paint(i,to);animations.forEach(a=>a.cancel());this.jobs.delete(i);
      }).catch(()=>{});
    }
    cancel(reason='superseded'){
      this.generation++;for(const timer of this.timers)clearTimeout(timer);this.timers.clear();
      for(const [i,job] of this.jobs){
        // A half-flipped glyph cannot be a stable face. Snap to the face visible at this phase.
        const elapsed=Number(job.animations[0].currentTime??0)-job.timing.delay;
        this.paint(i,elapsed>=job.timing.duration/2?job.to:job.from);job.animations.forEach(a=>a.cancel());
      }
      this.jobs.clear();if(this.finish){this.finish({status:reason,id:this.messageId});this.finish=null;}
    }
    later(callback,ms){const timer=setTimeout(()=>{this.timers.delete(timer);callback();},ms);this.timers.add(timer);}
    startEffect(effect,generation){
      let step=0;const total=effect.repeat===null?Infinity:effect.repeat*effect.frames.length;
      const tick=()=>{
        if(this.destroyed||generation!==this.generation)return;
        if(step===total){this.animate(effect.index,this.base[effect.index],{delay:0,duration:effect.transition.durationMs});return;}
        this.animate(effect.index,effect.frames[step%effect.frames.length],{delay:0,duration:effect.transition.durationMs});step++;
        this.later(tick,effect.intervalMs);
      };tick();
    }
    show(input){
      this.assertLive();let m;try{m=C.message(input,this.config);}catch(error){return {accepted:false,errors:[{code:'INVALID_MESSAGE',message:error.message}]};}
      this.cancel();const generation=this.generation;this.messageId=m.id;this.base=C.clone(m.base);this.label();
      let resolve;const finished=new Promise(r=>resolve=r);this.finish=resolve;
      const work=this.current.map((face,i)=>this.animate(i,m.base[i],C.timing(i,this.config,m.transition)));
      // Preserve the requested total time even when the last columns are unchanged.
      const clock=new Promise(r=>this.later(r,this.reduced()?0:m.transition.durationMs));
      Promise.all([...work,clock]).then(()=>{
        if(this.destroyed||generation!==this.generation)return;
        this.finish=null;resolve({status:'settled',id:m.id});
        for(const effect of m.effects)this.startEffect(effect,generation);
      });
      return {accepted:true,id:m.id,warnings:m.warnings,finished};
    }
    configure(patch){
      this.assertLive();let next;try{next=C.config(patch,this.config);}catch(error){return {accepted:false,errors:[{code:'INVALID_CONFIG',message:error.message}]};}
      const resized=next.columns!==this.config.columns||next.rows!==this.config.rows;
      this.cancel('reconfigured');this.config=next;
      if(resized){this.messageId=null;this.rebuild();}else this.base.forEach((face,i)=>this.paint(i,face));
      this.style();return {accepted:true,cleared:resized,config:C.clone(this.config)};
    }
    clear(transition){return this.show({lines:[],...(transition?{transition}:{})});}
    getState(){this.assertLive();return {config:C.clone(this.config),id:this.messageId,base:C.clone(this.base),visible:C.clone(this.current),transitioning:this.finish!==null};}
    destroy(){if(this.destroyed)return;this.cancel('destroyed');this.resize.disconnect();this.shadow.replaceChildren();this.host.removeAttribute('role');this.host.removeAttribute('aria-label');this.destroyed=true;}
  }
  window.SplitFlapBoard=SplitFlapBoard;
})();
