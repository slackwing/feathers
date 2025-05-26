import { Interval } from "@/lib/base/Interval";
import { DSignal } from "./DSignal";
import { Wavelet } from "../Wavelet";

/* eslint-disable @typescript-eslint/no-explicit-any */
export class DSignal_Simple<T, U, I extends Interval> extends DSignal<any, U, I> {

  constructor(interval: I, source: DSignal<any, T, I>) {
    super(interval, source);
  }

  // Single-source DSignals don't need to check for alignment.
  protected process(source: number, signal: Wavelet<T>): void {
    this.onAlignment([signal]);
  }
}