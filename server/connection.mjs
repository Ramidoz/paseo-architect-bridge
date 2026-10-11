import {createPaseoClient} from '@getpaseo/client';
import {DaemonClient} from '@getpaseo/client/internal/daemon-client';

// Evidence collection has its own sockets, so its deadlines cannot interrupt
// a control request or discard an acknowledgement on the raw API connection.
export function createConnection(options,clientId) {
 let live=null,connecting=null,generation=0;
 async function closePair(pair) {
  await Promise.allSettled([pair.client.close(),pair.checkout.close()]);
 }
 return {
  async open() {
   if(live?.checkout.isConnected)return live;
   if(connecting)return connecting;
   if(live){const old=live;live=null;await closePair(old);}
   const attempt=generation;
   const pending=(async()=>{
    const pair={client:createPaseoClient(options),checkout:new DaemonClient({...options,clientId})};
    try {
     await Promise.all([pair.client.connect(),pair.checkout.connect()]);
     if(attempt!==generation)throw Error('Connection attempt superseded');
     live=pair;return pair;
    }catch(error){await closePair(pair);throw error;}
   })();
   connecting=pending;
   try{return await pending;}finally{if(connecting===pending)connecting=null;}
  },
  async close() {
   generation++;const old=live;live=null;connecting=null;
   if(old)await closePair(old);
  }
 };
}
