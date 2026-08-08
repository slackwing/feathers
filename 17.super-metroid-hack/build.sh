#!/bin/sh
# build.sh — patch base ROM, emit playable ROM + distributable BPS
set -e
cd "$(dirname "$0")"
test -f roms/base.sfc || { echo "missing roms/base.sfc"; exit 1; }
md5sum -c <<< "21f3e98df4780ee1c667b84e57d88675  roms/base.sfc"
cp roms/base.sfc build/health-aim-jitter.sfc
asar patches/health-aim-jitter.asm build/health-aim-jitter.sfc
flips --create --bps roms/base.sfc build/health-aim-jitter.sfc build/health-aim-jitter.bps
echo "OK: build/health-aim-jitter.sfc (play) + .bps (distribute)"
