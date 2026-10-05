'use strict';
// Offline mock of the ChargePoint station API, used only when CP_MOCK=1 (dev / screenshots).
let n = 0;
const seq = (process.env.CP_MOCK_SEQ || 'in_use,in_use,available').split(',');

function station(id, p2) {
  return {
    name: ['DEMO GARAGE', 'LEVEL 2'], deviceId: Number(id),
    address: { address1: '100 Example Ave', city: 'Springfield', state: 'Anystate' },
    description: 'Sample data',
    portsInfo: { ports: [
      { outletNumber: 1, status: 'available', statusV2: 'available', level: 'L2', powerRange: { unit: 'kW', max: '6.6' }, connectorList: [{ displayPlugType: 'J1772' }] },
      { outletNumber: 2, status: p2, statusV2: p2, level: 'L2', powerRange: { unit: 'kW', max: '6.6' }, connectorList: [{ displayPlugType: 'J1772' }] },
    ] },
  };
}

module.exports.reset = () => { n = 0; };

module.exports.next = async (url) => {
  const id = new URL(url).searchParams.get('deviceId');
  await new Promise((r) => setTimeout(r, 150));
  return station(id, seq[n++ % seq.length]);
};
