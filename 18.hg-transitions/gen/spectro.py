import sys, wave, numpy as np, matplotlib; matplotlib.use("Agg"); import matplotlib.pyplot as plt
import soundfile as sf
files = sys.argv[1:]
fig, axes = plt.subplots(len(files), 1, figsize=(14, 3.2*len(files)), squeeze=False)
for ax, f in zip(axes[:,0], files):
    x, sr = sf.read(f); x = x.mean(1) if x.ndim > 1 else x
    ax.specgram(x, NFFT=4096, Fs=sr, noverlap=3072, cmap="magma", vmin=-110, vmax=-30)
    ax.set_yscale("symlog", linthresh=200); ax.set_ylim(30, 12000); ax.set_title(f, fontsize=9)
plt.tight_layout(); plt.savefig("spectro.png", dpi=80); print("spectro.png")
