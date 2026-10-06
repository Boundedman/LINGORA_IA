import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
export default defineConfig({
 root:fileURLToPath(new URL('.',import.meta.url)),
 envDir:fileURLToPath(new URL('..',import.meta.url)),
 plugins:[react()],
 server:{proxy:{'/api':{target:'http://127.0.0.1:8000',ws:true}}},
 // Worklet must remain a same-origin file (CSP does not allow data: scripts).
 build:{outDir:'dist',sourcemap:false,assetsInlineLimit:0}
});
