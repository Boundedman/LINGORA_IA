export function Avatar({name='',large=false}:{name?:string|null;large?:boolean}){
 const initials=(name??'').trim().split(/\s+/).filter(Boolean).slice(0,2).map(part=>Array.from(part)[0]?.toLocaleUpperCase()).join('');
 return <span className={`profile-avatar ${large?'profile-avatar-large':''}`} aria-hidden="true">{initials||'L'}</span>;
}
