export const now=()=>new Date().toISOString();
export const secondsToClock=(seconds:number)=>`${Math.floor(Math.max(0,seconds)/60)}:${String(Math.max(0,seconds)%60).padStart(2,'0')}`;
export const workoutDuration=(startedAt:string,endedAt:string|null=null)=>{const ms=new Date(endedAt??Date.now()).getTime()-new Date(startedAt).getTime();const mins=Math.max(1,Math.round(ms/60000));return mins<60?`${mins} min`:`${Math.floor(mins/60)}h ${mins%60}m`};
export const validWeight=(value:string)=>value===''||(/^\d{0,4}(\.\d{0,2})?$/.test(value)&&Number(value)>=0);
export const validReps=(value:string)=>value===''||(/^\d{0,3}$/.test(value)&&Number(value)>=0);
