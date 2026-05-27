"""
Converte Litematica .schematic → Sponge V3 .schem.

Litematica format:
  Regions: Map<name, region> com BlockStates (LongArray empacotado),
  BlockStatePalette (List of stateString tags), Size, Position, etc.

Sponge V3:
  Schematic compound com Blocks{Palette, Data (ByteArray varint), BlockEntities}.

Estratégia:
  1. litemapy le o file
  2. Pra cada region (vou pegar a primeira/maior), itero cada bloco
  3. Construo palette: Map<blockStateString, int>
  4. Encode data como varint byte array (palette index pra cada coord)
"""
import sys, os, struct
from litemapy import Schematic
import nbtlib

def encode_varint(value):
    result = bytearray()
    while True:
        byte = value & 0x7F
        value >>= 7
        if value:
            result.append(byte | 0x80)
        else:
            result.append(byte)
            return bytes(result)

if len(sys.argv) != 3:
    print(f"Uso: {sys.argv[0]} <input.schematic> <output.schem>", file=sys.stderr)
    sys.exit(1)

inp, outp = sys.argv[1], sys.argv[2]
schem = Schematic.load(inp)
print(f"Litematica loaded: {schem.name}")
print(f"Regions: {len(schem.regions)}")

# Pega a região principal (maior, ou única)
region = max(schem.regions.values(), key=lambda r: abs(r.width) * abs(r.height) * abs(r.length))
print(f"Main region size: {abs(region.width)}×{abs(region.height)}×{abs(region.length)}")
print(f"Region range: x[{region.minx()}..{region.maxx()}] y[{region.miny()}..{region.maxy()}] z[{region.minz()}..{region.maxz()}]")

# Dimensões absolutas
width = abs(region.width)
height = abs(region.height)
length = abs(region.length)

# Build palette: state string → index
palette = {}
data_indices = []  # list of palette indices in YZX order

# Itera em ordem YZX (Sponge spec)
for y in range(region.miny(), region.maxy() + 1):
    for z in range(region.minz(), region.maxz() + 1):
        for x in range(region.minx(), region.maxx() + 1):
            state = region.getblock(x, y, z)
            key = state.to_block_state_identifier()
            if key not in palette:
                palette[key] = len(palette)
            data_indices.append(palette[key])

print(f"Palette size: {len(palette)} unique block states")
print(f"Data length: {len(data_indices)} blocks")

# Encode data como varint byte array
data_bytes = bytearray()
for idx in data_indices:
    data_bytes.extend(encode_varint(idx))
print(f"Encoded data: {len(data_bytes)} bytes")

# Build Sponge V3 NBT
v3 = nbtlib.tag.Compound()
v3["Version"] = nbtlib.tag.Int(3)
v3["DataVersion"] = nbtlib.tag.Int(3955)  # 1.21.4-ish
v3["Width"] = nbtlib.tag.Short(width)
v3["Height"] = nbtlib.tag.Short(height)
v3["Length"] = nbtlib.tag.Short(length)
v3["Offset"] = nbtlib.tag.IntArray([0, 0, 0])

# Metadata
meta = nbtlib.tag.Compound()
meta["WorldEdit"] = nbtlib.tag.Compound({
    "Version": nbtlib.tag.String("converted from Litematica"),
})
v3["Metadata"] = meta

# Blocks
blocks = nbtlib.tag.Compound()
palette_compound = nbtlib.tag.Compound()
for state, idx in palette.items():
    palette_compound[state] = nbtlib.tag.Int(idx)
blocks["Palette"] = palette_compound
blocks["Data"] = nbtlib.tag.ByteArray([(b if b < 128 else b - 256) for b in data_bytes])
blocks["BlockEntities"] = nbtlib.tag.List[nbtlib.tag.Compound]([])
v3["Blocks"] = blocks

# Empacota como root
root = nbtlib.tag.Compound()
root["Schematic"] = v3

result = nbtlib.File(root, gzipped=True)
result.save(outp)
print(f"\n✓ Wrote V3 to {outp} ({os.path.getsize(outp)} bytes)")
