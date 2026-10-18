/** Explicit decimal and integer checks for domain validators. Never coerces blanks to zero. */
export function decimalError(value:unknown,label:string,min:number,max:number,scale:number):string {
 if(typeof value!=='number'||!Number.isFinite(value))return `${label} must be a finite number.`;
 if(value<min||value>max)return `${label} must be from ${min.toLocaleString('en-PH')} to ${max.toLocaleString('en-PH')}.`;
 const scaled=value*10**scale;
 const [coefficient,exponent='0']=value.toString().toLowerCase().split('e');
 const decimals=Math.max(0,(coefficient.split('.')[1]?.length||0)-Number(exponent));
 if(!Number.isSafeInteger(Math.round(scaled))||decimals>scale)return `${label} can have up to ${scale} decimal places.`;
 return '';
}
export function integerError(value:unknown,label:string,min:number,max:number):string {
 return typeof value!=='number'||!Number.isSafeInteger(value)||value<min||value>max?`${label} must be a whole number from ${min} to ${max}.`:'';
}
