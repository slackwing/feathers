; health-aim-jitter.asm
; Below 99 energy, Samus degrades: beam shots gain random angular error and
; jumps get weaker and inconsistent. At 99+ energy everything is exactly
; vanilla — the threshold is absolute energy, not % of max, so collecting
; energy tanks never penalizes aim.
;
;   deficit = 99 - energy (0..99)
;   aim:  amplitude = deficit/3 (0..33); per-axis triangular random deviation
;         added to projectile velocity; ~±27 degrees max at 1 HP
;   jump: launch speed scaled by (256 - d - rand*d/256)/256 where d = deficit/2;
;         worst case at 1 HP is 62-81% speed = 38-65% of vanilla jump height,
;         re-rolled every jump
;
; Target: Super Metroid (JU) unheadered, asar 1.91+.
; Addresses per InsaneFirebat/sm_disassembly (labels noted in comments).

lorom

; ---------------------------------------------------------------------------
; AIM: hijack InitializeBeamVelocities' ($90B197) call to
; InitializeProjectileVelocities at its .merge. One hook covers uncharged,
; charged, and hyper beam, all combos, and enemy-reflected shots.
; State here: REP #$30, DB=$90, X = $12 = $14 = projectile slot index;
; caller does PLB/PLP/RTL right after (X restored to slot to match vanilla).
; ---------------------------------------------------------------------------
org $90B1C3
    jsr.w AimJitter

; ---------------------------------------------------------------------------
; Straight shots normally dispatch to single-axis movers each frame, which
; would silently ignore the perpendicular component of the jitter. Point all
; ten directions at the diagonal handler, which moves/collides both axes
; (zero velocity on an axis is a no-op, so vanilla behavior is preserved
; when there is no jitter).
; ---------------------------------------------------------------------------
org $90AF36                         ; beam mover dispatch (non-wave)
    dw $AF52,$AF52,$AF52,$AF52,$AF52    ; BeamBlockCollision_NoWaveBeam_Diagonal
    dw $AF52,$AF52,$AF52,$AF52,$AF52
org $90B127                         ; wave beam mover dispatch
    dw $B143,$B143,$B143,$B143,$B143    ; WaveBeamBlockCollision_Diagonal
    dw $B143,$B143,$B143,$B143,$B143

; ---------------------------------------------------------------------------
; JUMP: hijack the shared tail of Make_Samus_Jump ($9098BC) and
; Make_Samus_WallJump ($909949), right after they finish writing the launch
; speed (hi-jump / water / speed-boost already applied). Both tails begin
; with STZ.W GrappleWalljumpTimer ($0A9E) — replaced by the JSR, re-done in
; the routine. State: REP #$30, DB=$90; A is reloaded by the caller after.
; Bomb jumps and morph bounces are separate code and stay vanilla.
; ---------------------------------------------------------------------------
org $90993A                         ; Make_Samus_Jump tail
    jsr.w JumpScale
org $9099C7                         ; Make_Samus_WallJump tail
    jsr.w JumpScale

; ---------------------------------------------------------------------------
; New code in vanilla freespace (Freespace_Bank90_F63A, $9C6 bytes).
; ---------------------------------------------------------------------------
org $90F63A

AimJitter:
    jsr.w $B1F3                     ; vanilla InitializeProjectileVelocities

    lda.w #$0063                    ; 99
    sec
    sbc.w $09C2                     ; minus Energy = deficit
    beq .ret                        ; exactly 99: perfect aim
    bcc .ret                        ; 99+: perfect aim

    pei ($14)                       ; preserve DP temps we clobber
    pei ($16)
    pei ($1A)

    ; amplitude = deficit/3, range 0..33
    sta.w $4204                     ; dividend (16-bit write hits WRDIVL/H)
    lda.w #$0003
    sep #$20
    sta.w $4206                     ; 8-bit divisor write starts the divide
    nop : nop : nop : nop
    nop : nop : nop : nop           ; divider needs 16 cycles
    lda.w $4214                     ; quotient = jitter amplitude
    sta.b $1A
    rep #$20

    ; read quotient BEFORE these: the RNG uses the shared hardware multiplier
    jsl $808111                     ; GenerateRandomNumber -> word for X axis
    sta.b $14
    jsl $808111                     ; word for Y axis
    sta.b $16

    jsr.w .computeJitter            ; A = signed X deviation (subpx/frame)
    ldx.b $12                       ; projectile slot
    clc
    adc.w $0BDC,x                   ; SamusProjectile_XVelocities
    sta.w $0BDC,x

    lda.b $16
    sta.b $14
    jsr.w .computeJitter
    ldx.b $12
    clc
    adc.w $0BF0,x                   ; SamusProjectile_YVelocities
    sta.w $0BF0,x

    pla
    sta.b $1A
    pla
    sta.b $16
    pla
    sta.b $14
.ret:
    rts

; in:  $14 = random word, $1A = amplitude (0..33)
; out: A = signed deviation in subpixels/frame, triangular distribution,
;      |A| <= amplitude*255/256*16 (up to ~±528 ~= ±2 px/f at amplitude 33,
;      against a 4.0 px/f beam ~= ±27 degrees). Tune via the four LSRs below.
.computeJitter:
    sep #$20
    ldy.w #$0000                    ; Y = sign flag (0 = non-negative)
    lda.b $14
    sec
    sbc.b $15                       ; r_lo - r_hi: triangular on -255..255
    bcs +
    eor.b #$ff
    inc a                           ; A = |t|
    dey                             ; mark negative
+
    sta.w $4202
    lda.b $1A
    sta.w $4203                     ; start |t| * amplitude (needs 8 cycles)
    rep #$20
    nop : nop : nop
    lda.w $4216                     ; product, 0..8415
    and.w #$ff00                    ; keep (product/256)*256...
    lsr
    lsr
    lsr
    lsr                             ; ...*16: deviation magnitude 0..528
    cpy.w #$0000
    beq +
    eor.w #$ffff
    inc a                           ; negate
+
    rts

; Scale the freshly-set jump launch speed by energy deficit + randomness.
; The 8.8 px/frame launch speed is readable as one word at $0B2D
; (SamusYSpeedCombined: high byte of YSubSpeed + low byte of YSpeed).
; factor/256 where factor = 256 - d - (rand8*d)/256, d = deficit/2 (0..49).
JumpScale:
    stz.w $0A9E                     ; replaced: STZ GrappleWalljumpTimer

    lda.w #$0063                    ; 99
    sec
    sbc.w $09C2                     ; minus Energy = deficit
    beq .ret                        ; 99+: vanilla jump
    bcc .ret
    lsr                             ; d = deficit/2, 0..49
    beq .ret                        ; deficit 1: below resolution, vanilla

    pei ($14)                       ; preserve DP temps
    pei ($16)
    sta.b $14                       ; d

    jsl $808111                     ; random word (exits with 16-bit A)
    sep #$20
    sta.w $4202
    lda.b $14
    sta.w $4203                     ; start rand_lo * d
    rep #$20
    nop : nop : nop                 ; multiplier needs 8 cycles
    lda.w $4216
    xba
    and.w #$00ff                    ; r = rand*d/256, 0..48
    clc
    adc.b $14                       ; r + d
    sta.b $16
    lda.w #$0100
    sec
    sbc.b $16                       ; factor = 256 - d - r, 159..255
    sta.b $14

    ; speed' = speed * factor / 256, via (S_lo*f)/256 + S_hi*f
    sep #$20
    lda.w $0B2D                     ; S_lo
    sta.w $4202
    lda.b $14
    sta.w $4203
    rep #$20
    nop : nop : nop
    lda.w $4216
    xba
    and.w #$00ff
    sta.b $16                       ; (S_lo*f)/256
    sep #$20
    lda.w $0B2E                     ; S_hi
    sta.w $4202
    lda.b $14
    sta.w $4203                     ; product only recomputes on $4203 write
    rep #$20
    nop : nop : nop
    lda.w $4216                     ; S_hi*f
    clc
    adc.b $16
    sta.w $0B2D                     ; write back scaled 8.8 speed

    pla
    sta.b $16
    pla
    sta.b $14
.ret:
    rts

assert pc() <= $90FC00              ; end of vanilla freespace
