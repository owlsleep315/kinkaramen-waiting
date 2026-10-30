/** Local record key, not a credential. Works in HTTP previews and older browsers too. */
let sequence = 0;
export function newId() { return `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2, 10)}`; }
