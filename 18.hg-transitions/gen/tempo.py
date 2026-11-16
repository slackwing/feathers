"""Rough BPM: spectral-flux onset envelope -> autocorrelation, 60-200 BPM, prior around 120."""
import sys, numpy as np, soundfile as sf
def bpm(path, seconds=60):
    x, sr = sf.read(path); x = x.mean(1) if x.ndim > 1 else x
    mid = len(x)//2; x = x[max(0, mid-int(seconds/2*sr)):mid+int(seconds/2*sr)]
    N, H = 2048, 512; win = np.hanning(N)
    frames = np.lib.stride_tricks.sliding_window_view(x, N)[::H]*win
    S = np.log1p(50*np.abs(np.fft.rfft(frames, axis=1)))
    flux = np.maximum(np.diff(S, axis=0), 0).sum(1); flux -= flux.mean()
    fr = sr/H; ac = np.correlate(flux, flux, "full")[len(flux)-1:]; ac /= ac[0]
    lags = np.arange(len(ac)); bpms = 60*fr/np.maximum(lags, 1)
    m = (bpms >= 60) & (bpms <= 200)
    prior = np.exp(-0.5*((np.log2(bpms[m]/120))/0.6)**2)
    score = ac[m]*prior; i = np.argmax(score)
    return float(bpms[m][i]), float(ac[m][i])
if __name__ == "__main__":
    for p in sys.argv[1:]:
        b, c = bpm(p); print(f"{b:6.1f} bpm (ac {c:.2f})  {p}")
