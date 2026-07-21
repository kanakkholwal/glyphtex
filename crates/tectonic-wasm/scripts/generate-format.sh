#!/bin/sh
# Generate latex.fmt using the WASM engine in INITEX mode.
# This ensures TFM font metrics are compatible with the WASM build.
#
# Usage: ./scripts/generate-format.sh <wasm-file> <output-dir>
set -e

WASM="${1:?Usage: $0 <wasm-file> <output-dir>}"
OUTPUT_DIR="${2:-.}"
BUNDLE_DIR="$HOME/.cache/Tectonic/bundles/data"
NODE="${EMSDK_NODE:-$(which node)}"

if [ ! -f "$WASM" ]; then echo "Error: WASM file not found: $WASM"; exit 1; fi

# Find the bundle directory
CACHE_DIR=$(find "$BUNDLE_DIR" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | head -1)
if [ -z "$CACHE_DIR" ]; then
    echo "Error: No tectonic cache. Run 'tectonic test.tex' first to populate."
    exit 1
fi

echo "Using WASM: $WASM"
echo "Using cache: $CACHE_DIR"
echo "Using node: $NODE"

# Create a tar of all files (without the native format)
TMPDIR=$(mktemp -d)
for f in "$CACHE_DIR"/*; do
    [ -f "$f" ] && cp "$f" "$TMPDIR/"
done
# Remove native format if present
rm -f "$TMPDIR"/*.fmt
FILE_COUNT=$(ls "$TMPDIR" | wc -l)
echo "Bundled $FILE_COUNT files for INITEX"
cd "$TMPDIR" && tar czf "$TMPDIR/initex-bundle.tar.gz" .

# Run INITEX via Node.js
cat > "$TMPDIR/initex.mjs" << 'NODEJS'
import{readFileSync as rf,writeFileSync as wf}from'fs';import{gunzipSync}from'zlib';
const wb=rf(process.argv[2]),bd=gunzipSync(rf(process.argv[3]));
function parseTar(b){const f={};let o=0;while(o<b.length-512){if(b[o]===0)break;let n='';for(let i=0;i<100&&b[o+i];i++)n+=String.fromCharCode(b[o+i]);let s='';for(let i=124;i<136&&b[o+i];i++)s+=String.fromCharCode(b[o+i]);const sz=parseInt(s.trim(),8)||0,t=b[o+156];o+=512;if((t===48||t===0)&&sz>0)f[n.replace(/^\.\//,'')]=b.slice(o,o+sz);o+=Math.ceil(sz/512)*512;}return f;}
const files=parseTar(bd);let inst;const lj=new Error('lj');
const st={args_sizes_get:(a,b)=>{const v=new DataView(inst.exports.memory.buffer);v.setUint32(a,0,true);v.setUint32(b,0,true);return 0;},args_get:()=>0,proc_exit:()=>{},environ_get:()=>0,environ_sizes_get:(a,b)=>{const v=new DataView(inst.exports.memory.buffer);v.setUint32(a,0,true);v.setUint32(b,0,true);return 0;},fd_close:()=>0,fd_seek:()=>0,fd_read:()=>0,fd_fdstat_get:()=>0,fd_prestat_get:()=>8,fd_prestat_dir_name:()=>8,path_open:()=>44,path_filestat_get:()=>44,random_get:(p,l)=>{new Uint8Array(inst.exports.memory.buffer,p,l).fill(42);return 0;},clock_time_get:(i,p,t)=>{new DataView(inst.exports.memory.buffer).setBigUint64(t,BigInt(Date.now())*1000000n,true);return 0;},fd_write:(fd,ip,il,np)=>{const m=new DataView(inst.exports.memory.buffer);let t=0;for(let i=0;i<il;i++){const p=m.getUint32(ip+i*8,true),l=m.getUint32(ip+i*8+4,true);t+=l;if(fd===2)process.stderr.write(new TextDecoder().decode(new Uint8Array(inst.exports.memory.buffer,p,l)));}m.setUint32(np,t,true);return 0;},};
const env=new Proxy({emscripten_longjmp:()=>{throw lj;},__main_argc_argv:()=>0,emscripten_notify_memory_growth:()=>{},__syscall_rmdir:()=>0,__syscall_getcwd:()=>0,__syscall_unlinkat:()=>0,hb_graphite2_face_get_gr_face:()=>0},{get:(t,p)=>{if(p in t)return t[p];if(typeof p==='string'&&p.startsWith('invoke_'))return(fp,...a)=>{try{return inst.exports.__indirect_function_table.get(fp)(...a)||0;}catch(e){if(e===lj){inst.exports.setThrew(1,0);return 0;}throw e;}};return()=>0;},has:()=>true});
const r=await WebAssembly.instantiate(wb,{wasi_snapshot_preview1:st,env});inst=r.instance;
function w(b){const p=inst.exports.malloc(b.length);new Uint8Array(inst.exports.memory.buffer,p,b.length).set(b);return{ptr:p,len:b.length};}
function s(v){return w(new TextEncoder().encode(v));}
let n=0;for(const[k,v]of Object.entries(files)){if(!k||k==='latex.fmt')continue;const a=s(k),b=w(v);inst.exports.tectonic_add_file(a.ptr,a.len,b.ptr,b.len);n++;}
console.error(`Loaded ${n} files, running INITEX...`);
inst.exports.tectonic_create_format();
const fn=s('xelatex.fmt'),fs=inst.exports.tectonic_get_output_size(fn.ptr,fn.len);
if(fs>0){const fb=inst.exports.malloc(fs),fn2=s('xelatex.fmt');inst.exports.tectonic_get_output(fn2.ptr,fn2.len,fb,fs);const fmt=new Uint8Array(inst.exports.memory.buffer,fb,fs).slice();wf(process.argv[4],fmt);console.error(`Format: ${fmt.length} bytes -> ${process.argv[4]}`);}
else{console.error('ERROR: No format generated');process.exit(1);}
NODEJS

$NODE --experimental-vm-modules "$TMPDIR/initex.mjs" "$WASM" "$TMPDIR/initex-bundle.tar.gz" "$OUTPUT_DIR/latex.fmt" 2>&1

rm -rf "$TMPDIR"
echo "✅ WASM-native latex.fmt generated"
ls -lh "$OUTPUT_DIR/latex.fmt"
