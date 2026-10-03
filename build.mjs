import {build} from 'esbuild';
await build({entryPoints:['server/bridge.mjs'],outfile:'server/dist/bridge.mjs',bundle:true,platform:'node',target:'node22',format:'esm',banner:{js:"import {createRequire as __createRequire} from 'node:module';const require=__createRequire(import.meta.url);"}});
