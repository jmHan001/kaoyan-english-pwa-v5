export function localDateKey(value=new Date()){
  const date=value instanceof Date?value:new Date(value),pad=part=>String(part).padStart(2,'0');
  return`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
}

export function localDayStart(value=new Date()){
  const date=value instanceof Date?value:new Date(value);
  return new Date(date.getFullYear(),date.getMonth(),date.getDate()).getTime();
}
