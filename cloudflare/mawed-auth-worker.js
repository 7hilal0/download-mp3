const encoder = new TextEncoder();
const SITE = "https://7hilal0.github.io/download-mp3/";
const API_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "Content-Type, Authorization",
  "vary": "Origin"
};
function response(body, status=200, origin="", allowed="") {
  return new Response(JSON.stringify(body), {status, headers:{
    ...API_HEADERS,
    "access-control-allow-origin": origin === allowed ? allowed : "null"
  }});
}
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
const fromB64url = s => Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/")+"=".repeat((4-s.length%4)%4)),c=>c.charCodeAt(0));
async function hmac(secret, value) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), {name:"HMAC",hash:"SHA-256"}, false, ["sign","verify"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(value)));
}
async function sign(secret, value) { return b64url(await hmac(secret,value)); }
async function safeEqual(a,b) {
  const aa=encoder.encode(a),bb=encoder.encode(b);
  if(aa.length!==bb.length)return false;
  let d=0;for(let i=0;i<aa.length;i++)d|=aa[i]^bb[i];return d===0;
}
function redirect(url) { return Response.redirect(url,302); }
export default {
 async fetch(request, env) {
  const url=new URL(request.url), origin=request.headers.get("Origin")||"", allowed=env.ALLOWED_ORIGIN||"https://7hilal0.github.io";
  if(request.method==="OPTIONS") return new Response(null,{status:204,headers:{...API_HEADERS,"access-control-allow-origin":origin===allowed?allowed:"null"}});
  if(url.pathname==="/auth/login" && request.method==="GET") {
    if(!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.SESSION_SECRET || !env.AUTH_DB)
      return new Response("Discord OAuth2 is not configured yet. Add DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and SESSION_SECRET in Worker settings.",{status:503});
    const nonce=crypto.randomUUID().replace(/-/g,"");
    const now=Date.now();
    await env.AUTH_DB.prepare("INSERT INTO auth_codes (user_id,username,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,?,0,?)")
      .bind("state:"+nonce,"oauth-state",await sign(env.SESSION_SECRET,nonce),now+600000,now).run();
    const state=nonce+"."+now+"."+await sign(env.SESSION_SECRET,nonce+"."+now);
    const callback=url.origin+"/auth/callback";
    const authorize=new URL("https://discord.com/oauth2/authorize");
    authorize.searchParams.set("client_id",env.DISCORD_CLIENT_ID);
    authorize.searchParams.set("redirect_uri",callback);
    authorize.searchParams.set("response_type","code");
    authorize.searchParams.set("scope","identify");
    authorize.searchParams.set("state",state);
    return redirect(authorize.toString());
  }
  if(url.pathname==="/auth/callback" && request.method==="GET") {
    if(url.searchParams.has("error")) return redirect(SITE+"?login=cancelled");
    const code=url.searchParams.get("code")||"", state=url.searchParams.get("state")||"";
    const parts=state.split("."), nonce=parts[0]||"", issuedAt=Number(parts[1]||0), signature=parts[2]||"";
    if(!code||!nonce||!issuedAt||!signature||!env.SESSION_SECRET||!env.DISCORD_CLIENT_ID||!env.DISCORD_CLIENT_SECRET||!env.AUTH_DB)
      return new Response("Invalid OAuth callback.",{status:400});
    // Timestamp is bound into signature; nonce must also exist and be unexpired in D1.
    const stateRow=await env.AUTH_DB.prepare("SELECT code_hash,expires_at FROM auth_codes WHERE user_id=?").bind("state:"+nonce).first();
    if(!stateRow||Date.now()-issuedAt>600000||issuedAt>Date.now()+60000||stateRow.expires_at<Date.now()||!await safeEqual(signature,await sign(env.SESSION_SECRET,nonce+"."+issuedAt))||!await safeEqual(stateRow.code_hash,await sign(env.SESSION_SECRET,nonce)))
      return new Response("OAuth state expired or already used. Please try again.",{status:400});
    // Consume state before exchanging code to prevent callback replay.
    await env.AUTH_DB.prepare("DELETE FROM auth_codes WHERE user_id=?").bind("state:"+nonce).run();
    const tokenRes=await fetch("https://discord.com/api/v10/oauth2/token",{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body:new URLSearchParams({client_id:env.DISCORD_CLIENT_ID,client_secret:env.DISCORD_CLIENT_SECRET,grant_type:"authorization_code",code,redirect_uri:url.origin+"/auth/callback"})});
    if(!tokenRes.ok) return new Response("Discord token exchange failed. Check the OAuth redirect URL and client credentials.",{status:502});
    const token=await tokenRes.json();
    const userRes=await fetch("https://discord.com/api/v10/users/@me",{headers:{authorization:"Bearer "+token.access_token}});
    if(!userRes.ok) return new Response("Could not verify your Discord account.",{status:502});
    const user=await userRes.json();
    const exp=Date.now()+7*24*60*60*1000;
    const payload=b64url(encoder.encode(JSON.stringify({sub:user.id,username:user.username,global_name:user.global_name||null,avatar:user.avatar||null,exp})));
    const session=payload+"."+await sign(env.SESSION_SECRET,payload);
    return redirect(SITE+"#session="+encodeURIComponent(session));
  }
  if(url.pathname==="/auth/me" && request.method==="GET") {
    if(origin!==allowed)return response({error:"Origin not allowed"},403,origin,allowed);
    const token=(request.headers.get("Authorization")||"").replace(/^Bearer\s+/i,"");
    const dot=token.lastIndexOf(".");
    if(dot<1||!env.SESSION_SECRET)return response({error:"Not signed in"},401,origin,allowed);
    const payload=token.slice(0,dot), signature=token.slice(dot+1);
    if(!await safeEqual(signature,await sign(env.SESSION_SECRET,payload)))return response({error:"Invalid session"},401,origin,allowed);
    try {
      const data=JSON.parse(new TextDecoder().decode(fromB64url(payload)));
      if(!data.sub||data.exp<Date.now())return response({error:"Session expired"},401,origin,allowed);
      const revokedKey="logout:"+await sign(env.SESSION_SECRET,token);
      const revoked=await env.AUTH_DB.prepare("SELECT expires_at FROM auth_codes WHERE user_id=?").bind(revokedKey).first();
      if(revoked && revoked.expires_at>Date.now())return response({error:"Session signed out"},401,origin,allowed);
      return response({ok:true,user:{id:data.sub,username:data.username,global_name:data.global_name,avatar:data.avatar},expires_at:data.exp},200,origin,allowed);
    } catch { return response({error:"Invalid session"},401,origin,allowed); }
  }
  if(url.pathname==="/auth/logout" && request.method==="POST") {
    if(origin!==allowed)return response({error:"Origin not allowed"},403,origin,allowed);
    const token=(request.headers.get("Authorization")||"").replace(/^Bearer\\s+/i,"");
    const dot=token.lastIndexOf(".");
    if(dot<1||!env.SESSION_SECRET||!env.AUTH_DB)return response({ok:true},200,origin,allowed);
    const payload=token.slice(0,dot), signature=token.slice(dot+1);
    if(!await safeEqual(signature,await sign(env.SESSION_SECRET,payload)))return response({ok:true},200,origin,allowed);
    try {
      const data=JSON.parse(new TextDecoder().decode(fromB64url(payload)));
      if(data.exp>Date.now()) {
        const revokedKey="logout:"+await sign(env.SESSION_SECRET,token);
        const now=Date.now();
        await env.AUTH_DB.prepare("INSERT OR REPLACE INTO auth_codes (user_id,username,code_hash,expires_at,attempts,created_at) VALUES (?,?,?,?,0,?)")
          .bind(revokedKey,"revoked-session",await sign(env.SESSION_SECRET,token),data.exp,now).run();
      }
    } catch {}
    return response({ok:true,message:"Signed out"},200,origin,allowed);
  }
  if(origin!==allowed)return response({error:"Origin not allowed"},403,origin,allowed);
  return response({error:"Not found"},404,origin,allowed);
 }
};
