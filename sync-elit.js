const { createClient } = require('@libsql/client/web');
const db = createClient({url:'libsql://compucity-vorterixgames-gif.aws-us-east-1.turso.io',authToken:'eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3Nzk4NDQ4MzEsImlkIjoiMDE5ZTRmYTctMTMwMS03NTFiLWFhZTQtNzNhMTgxZDY0NDkyIiwicmlkIjoiZjcyMjM3NTYtMjRhMy00OGU5LWIxNGEtYjQyMzczZWM3OGRkIn0.vGK7b7wCYvIUL85JFcugDliuvYir9Dtkh85GoGFS0fsVrnhkORUhhmFc_hlXpjE0SIwrLq21o6YBoY909NOYDw'});

const SID = '97ee58ad-279b-48c4-907d-1db97ae9e15e';
const MARKUP = 30;

async function run() {
  const cats = await db.execute('SELECT id, slug FROM categories');
  const slugToId = {};
  for (const r of cats.rows) if (r.slug) slugToId[r.slug] = r.id;

  const KEYWORD_MAP = [
    {keywords:['AURICULAR','HEADSET'],slug:'auriculares'},
    {keywords:['MOUSE'],slug:'mouse'},
    {keywords:['TECLADO','KEYBOARD'],slug:'teclados'},
    {keywords:['DDR4','DDR5','SODIMM','MEMORIA DDR'],slug:'memorias-ram'},
    {keywords:['SSD','NVME','M.2'],slug:'discos-ssd'},
    {keywords:['RTX','GTX','RADEON RX','GEFORCE'],slug:'placas-de-video'},
    {keywords:['RYZEN','INTEL I3','INTEL I5','INTEL I7','INTEL I9','CORE I'],slug:'microprocesadores'},
    {keywords:['MOTHER','H610','B760','A520','B650'],slug:'motherboards'},
    {keywords:['FUENTE','POWER SUPPLY','PSU'],slug:'fuentes'},
    {keywords:['GABINETE','CHASSIS'],slug:'gabinetes'},
    {keywords:['MONITOR'],slug:'monitores'},
    {keywords:['NOTEBOOK','LAPTOP'],slug:'notebooks'},
    {keywords:['COOLER','WATER COOL','AIO'],slug:'refrigeracion'},
    {keywords:['IMPRESORA','LASERJET','DESKJET','SMART TANK'],slug:'impresion'},
    {keywords:['PARLANTE','SPEAKER','BARRA DE SONIDO'],slug:'parlantes'},
    {keywords:['UPS','ESTABILIZADOR'],slug:'ups'},
    {keywords:['ROUTER','ARCHER'],slug:'routers-wifi'},
    {keywords:['PENDRIVE'],slug:'pendrives'},
    {keywords:['HDD','IRONWOLF','DISCO RIGIDO'],slug:'discos-hdd'},
    {keywords:['DISCO EXTERNO','CANVIO','PORTABLE'],slug:'discos-externos'},
    {keywords:['WEBCAM','CAMARA'],slug:'webcams'},
    {keywords:['MICROFONO'],slug:'microfonos'},
    {keywords:['SILLA','GAMING CHAIR'],slug:'sillas-gamer'},
    {keywords:['MOCHILA','FUNDA'],slug:'fundas-mochilas'},
    {keywords:['SWITCH'],slug:'switches'},
    {keywords:['CARTUCHO','TONER'],slug:'toners-y-cartuchos'},
  ];
  function findCat(name) {
    const u=(name||'').toUpperCase();
    for (const m of KEYWORD_MAP) if (m.keywords.some(k=>u.includes(k))) return slugToId[m.slug]||null;
    return null;
  }

  let totalFetched=0, created=0, updated=0, skipped=0, errors=0;

  for (let page = 1; page <= 16; page++) {
    const offset = (page-1)*100+1;
    const res = await fetch('https://clientes.elit.com.ar/v1/api/productos?limit=100&offset='+offset, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({user_id:18469, token:'gksdk48b2at'})
    });
    const data = await res.json();
    const products = data.resultado || [];
    if (!products.length) break;

    for (const p of products) {
      totalFetched++;
      try {
        const price = parseFloat(p.precio||'0');
        if (price<=0) { skipped++; continue; }
        const sku = p.codigo_alfa||'';
        const sp = price*(1+MARKUP/100);
        const sc = (p.categoria&&p.sub_categoria)?p.categoria+' > '+p.sub_categoria:(p.categoria||'');
        const stock = parseInt(p.stock_total||'0');
        
        const ex = await db.execute({sql:'SELECT id FROM products WHERE providerId=? AND providerSku=?',args:[SID,sku]});
        if (ex.rows.length>0) {
          await db.execute({sql:'UPDATE products SET costPrice=?,price=?,stock=?,supplierCategory=?,updatedAt=? WHERE id=?',args:[price,sp,stock,sc,new Date().toISOString(),ex.rows[0].id]});
          updated++;
        } else {
          if (!p.nombre) { skipped++; continue; }
          const id=crypto.randomUUID();
          const slug=p.nombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
          const imgs=Array.isArray(p.imagenes)&&p.imagenes.length?JSON.stringify(p.imagenes):'[]';
          const specs={};
          if(p.marca)specs.Marca=p.marca; if(p.ean)specs.EAN=p.ean; if(p.gamer)specs.Gamer='Sí'; if(p.garantia)specs['Garantía']=p.garantia;
          const catId = findCat(p.nombre);
          await db.execute({sql:'INSERT INTO products(id,name,slug,description,price,comparePrice,costPrice,sku,stock,isActive,isFeatured,images,specs,providerId,providerSku,categoryId,supplierCategory) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            args:[id,p.nombre,slug,p.descripcion||'',sp,p.pvp_usd?parseFloat(p.pvp_usd)*(1+MARKUP/100):null,price,sku,stock,1,0,imgs,JSON.stringify(specs),SID,sku,catId,sc]});
          created++;
        }
      } catch(e) { errors++; }
    }
    console.log('Page '+page+': fetched='+totalFetched+' new='+created+' updated='+updated+' skip='+skipped+' err='+errors);
    if (products.length<100) break;
  }

  await db.execute({sql:'UPDATE suppliers SET lastSyncAt=?,updatedAt=? WHERE id=?',args:[new Date().toISOString(),new Date().toISOString(),SID]});
  console.log('\\nDONE: fetched='+totalFetched+' created='+created+' updated='+updated+' skipped='+skipped+' errors='+errors);
}
run().catch(e=>console.error(e));
