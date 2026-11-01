// Cloudflare Pages Function: /api/maps and /api/maps/:id
const json = (data, status=200) => new Response(JSON.stringify(data), {
  status, headers: { "Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store", "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Headers":"Content-Type, X-Edit-Token",
    "Access-Control-Allow-Methods":"GET, POST, PUT, OPTIONS" }
});
const token = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map(x=>x.toString(16).padStart(2,"0")).join("");
};
async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function validMap(m) {
  return m && Array.isArray(m.nodes) && Array.isArray(m.edges) &&
    Array.isArray(m.history) && m.nodes.length <= 5000 &&
    m.edges.length <= 15000 && m.history.length <= 10000;
}
export async function onRequest({request, env, params}) {
  if (request.method === "OPTIONS") return json({});
  if (!env.DB) return json({error:"数据库未绑定，请检查 D1 配置"},500);
  const parts = params.path || [];
  if (parts.length < 1 || parts[0] !== "maps") return json({error:"接口不存在"},404);
  if (request.method === "POST" && parts.length === 1) {
    let body; try { body=await request.json(); } catch { return json({error:"请求内容不是有效 JSON"},400); }
    if (!validMap(body.mapData)) return json({error:"地图数据格式不正确或数量超出限制"},400);
    const id=crypto.randomUUID(), editToken=token(), readKey=token();
    const visibility=body.visibility==="private"?"private":"public";
    const title=String(body.title||"未命名地图").slice(0,100);
    const now=new Date().toISOString();
    await env.DB.prepare(`INSERT INTO maps (id,title,visibility,edit_hash,read_hash,map_json,revision,created_at,updated_at)
      VALUES (?,?,?,?,?,?,1,?,?)`).bind(id,title,visibility,await sha256(editToken),await sha256(readKey),JSON.stringify(body.mapData),now,now).run();
    return json({id,title,visibility,editToken,readKey,revision:1},201);
  }
  if (parts.length !== 2) return json({error:"接口不存在"},404);
  const id=String(parts[1]);
  if (request.method === "GET") {
    const row=await env.DB.prepare("SELECT id,title,visibility,read_hash,map_json,revision,updated_at FROM maps WHERE id=?").bind(id).first();
    if(!row)return json({error:"地图不存在"},404);
    if(row.visibility==="private"){
      const key=new URL(request.url).searchParams.get("key")||"";
      if(!key || await sha256(key)!==row.read_hash)return json({error:"这是私人地图，需要有效的浏览链接"},403);
    }
    return json({id:row.id,title:row.title,visibility:row.visibility,mapData:JSON.parse(row.map_json),revision:row.revision,updatedAt:row.updated_at});
  }
  if (request.method === "PUT") {
    const editToken=request.headers.get("X-Edit-Token")||"";
    const row=await env.DB.prepare("SELECT edit_hash,revision FROM maps WHERE id=?").bind(id).first();
    if(!row)return json({error:"地图不存在"},404);
    if(!editToken || await sha256(editToken)!==row.edit_hash)return json({error:"没有编辑权限。请使用协作编辑链接打开地图"},403);
    let body;try{body=await request.json();}catch{return json({error:"请求内容不是有效 JSON"},400);}
    if(!validMap(body.mapData))return json({error:"地图数据格式不正确或数量超出限制"},400);
    if(Number(body.revision)!==Number(row.revision)){
      const latest=await env.DB.prepare("SELECT map_json,revision FROM maps WHERE id=?").bind(id).first();
      return json({error:"地图已被其他人更新",mapData:JSON.parse(latest.map_json),revision:latest.revision},409);
    }
    const now=new Date().toISOString();
    const result=await env.DB.prepare("UPDATE maps SET map_json=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?")
      .bind(JSON.stringify(body.mapData),now,id,row.revision).run();
    if(!result.success || result.meta.changes===0){
      const latest=await env.DB.prepare("SELECT map_json,revision FROM maps WHERE id=?").bind(id).first();
      return json({error:"保存冲突",mapData:JSON.parse(latest.map_json),revision:latest.revision},409);
    }
    return json({ok:true,revision:Number(row.revision)+1,updatedAt:now});
  }
  return json({error:"不支持的请求方式"},405);
}
