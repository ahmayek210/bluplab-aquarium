import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function stampOfflineAssets():Plugin {
  let out:string;
  return {
    name:'bluplab-offline-release',
    apply:'build',
    configResolved(config){out=resolve(config.root,config.build.outDir);},
    writeBundle(){
      const path=join(out,'sw.js');
      const worker=readFileSync(path,'utf8');
      const hash=createHash('sha256').update(worker).update(readFileSync(join(out,'index.html')));
      const directory=join(out,'art');
      for(const file of readdirSync(directory).sort()) hash.update(readFileSync(join(directory,file)));
      writeFileSync(path,worker.replace('__BLUPLAB_RELEASE__',hash.digest('hex').slice(0,16)));
    },
  };
}

export default defineConfig({
  base: process.env.VITE_BASE_PATH || './',
  build: { assetsInlineLimit: 0 },
  plugins:[stampOfflineAssets()],
});
