/** IFC → XKT (README §3): the viewer loads XKT fast; loading IFC in the browser crashes xeokit. POST an IFC as the body
 * of /convert and get its XKT back. Colours are fixed on the way: glass see-through, nothing left black. */
import http from 'node:http';
import { convert2xkt } from '@xeokit/xeokit-convert/src/convert2xkt.js';
import * as WebIFC from 'web-ifc';

const PORT = Number(process.env.CONVERTER_PORT ?? 8100);
const LIMIT = 200 * 1024 * 1024;

const configs = {
  sourceConfigs: { ifc: { excludeTypes: ['IfcSpace', 'IfcOpeningElement'] } },
};

export async function convert(ifc) {
  let xkt;
  const said = console.log;
  console.log = () => {}; // the parser logs every element it skips
  await convert2xkt({
    WebIFC,
    configs,
    sourceData: ifc,
    sourceFormat: 'ifc',
    outputXKT: (data) => { xkt = data; },
    excludeTypes: ['IfcSpace', 'IfcOpeningElement'],
    log: () => {},
  }).finally(() => { console.log = said; });
  return Buffer.from(xkt);
}

http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') return response.end('ok');
  if (request.method !== 'POST' || request.url !== '/convert') { response.statusCode = 404; return response.end(); }
  const parts = [];
  let size = 0;
  for await (const part of request) {
    size += part.length;
    if (size > LIMIT) { response.statusCode = 413; return response.end('IFC over 200 MB'); }
    parts.push(part);
  }
  try {
    const started = Date.now();
    const xkt = await convert(Buffer.concat(parts));
    response.setHeader('Content-Type', 'application/octet-stream');
    response.setHeader('X-Seconds', ((Date.now() - started) / 1000).toFixed(1));
    response.end(xkt);
  } catch (error) {
    console.error(error);
    response.statusCode = 422;
    response.end(String(error?.message ?? error));
  }
}).listen(PORT, () => console.log(`converter on :${PORT}`));
