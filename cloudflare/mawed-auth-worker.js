/**
 * Maw'ed Discord verification API.
 * Multi-server-safe design: Discord usernames are not globally searchable by bots.
 * The client must supply a Discord user ID obtained from a trusted Discord OAuth2
 * flow or an interaction in a server where Maw'ed is installed. Never trust a
 * user-supplied ID alone in a production login flow; use OAuth2 identity verification.
 *
 * Current endpoints retain the DM code flow and accept userId + username, but this
 * endpoint should be connected only after the site obtains userId from Discord OAuth2.
 */
const headers = (origin, allowed) => ({
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": origin === allowed ? allowed : "null",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "Content-Type",
  "vary": "Origin"
});
const json = (body, status, origin, allowed) => new Response(JSON.stringify(body), {status, headers:headers(origin,allowed)});
const hash = async s => {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,"0")).join("");
};
async function discord(env,path,method="GET",body) {
  return fetch("https://discord.com/api/v10"+path,{
    method,
    headers:{authorization:"Bot "+env.DISCORD_BOT_TOKEN,...(body?{"content-type":"application/json"}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
}
export default {
 async fetch(request,env) {
  const url=new URL(request.url), origin=request.headers.get("Origin")||"", allowed=env.ALLOWED_ORIGIN||"";
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:headers(origin,allowed)});
  if(!allowed||origin!==allowed) return json({error:"Origin not allowed"},403,origin,allowed);
  if(request.method!=="POST"||!["/auth/request","/auth/verify"].includes(url.pathname))
    return json({error:"Not found"},404,origin,allowed);
  if(!env.DISCORD_BOT_TOKEN||!env.CODE_PEPPER||!env.RATE_LIMIT_SALT||!env.AUTH_DB)
    return json({error:"Authentication service is not configured"},503,origin,allowed);
  let body;
  try{body=await request.json()}catch{return json({error:"Invalid JSON"},400,origin,allowed)}
  const userId=String(body.userId||"").trim();
  if(!/^\d{17,20}$/.test(userId))
    return json({error:"لجعل الدخول يعمل في كل السيرفرات، يجب ربط الموقع بتسجيل Discord OAuth2 للحصول على هوية المستخدم. اسم المستخدم وحده لا يمكن البحث عنه عالميًا بواسطة البوت."},400,origin,allowed);
  const now=Date.now();
  try{
   const ip=request.headers.get("CF-Connecting-IP")||"unknown";
   const ipHash=await hash(ip+env.RATE_LIMIT_SALT);
   const recent=await env.AUTH_DB.prepare("SELECT COUNT(*) AS n FROM auth_rate WHERE ip_hash=? AND created_at>?").bind(ipHash,now-900000).first();
   if((recent?.n||0)>=10)return json({error:"محاولات كثيرة. انتظر 15 دقيقة ثم أعد المحاولة."},429,origin,allowed);
   await env.AUTH_DB.prepare("INSERT INTO auth_rate (ip_hash,created_at) VALUES (?,?)").bind(ipHash,now).run();

   if(url.pathname==="/auth/request"){
    // Do not allow the frontend to claim arbitrary Discord IDs. This endpoint requires
    // a trusted OAuth2-authenticated user before it can safely DM the account.
    if(!env.DISCORD_CLIENT_ID||!env.DISCORD_CLIENT_SECRET)
      return json({error:"إعداد Discord OAuth2 غير مكتمل؛ لم نفعّل إرسال الأكواد بعد."},503,origin,allowed);
    return json({error:"يلزم إكمال OAuth2 callback والتحقق من هوية Discord قبل تفعيل إرسال الأكواد."},501,origin,allowed);
   }
   return json({error:"التحقق غير متاح حتى يكتمل تدفق OAuth2 الآمن."},501,origin,allowed);
  }catch(e){return json({error:e?.message||"حدث خطأ في خدمة التحقق."},400,origin,allowed)}
 }
};
