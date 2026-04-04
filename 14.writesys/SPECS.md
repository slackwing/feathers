# WriteSys UI Specifications

## Multi-Note Annotation UI

### Color Picker Circle and Palette

**Visual Layout:**

1. **Color Picker Circle** (showing current annotation color):
   - Position: Exact top-right corner of sticky note
   - Alignment: Circle center at note's top-right corner point
   - Visibility: Fades in on note hover
   - Size: 22px diameter + 2px white border = 26px total

2. **Color Palette** (additional color options):
   - Trigger: Appears on color picker hover
   - Arrangement: Vertical column below color picker
   - Count: 5-6 circles (excludes current color if set)
   - Alignment: All circles vertically aligned with note's right edge
   - Spacing: 32px center-to-center (6px edge-to-edge gap)
   - Visual effect: Appears as one continuous vertical line of circles

**Interaction Behavior:**

1. **Hover Sequence:**
   - User hovers over sticky note → color picker circle fades in at corner
   - User hovers over color picker → palette slides/fades in below
   - User moves mouse between circles → palette remains visible (continuous hover zone)
   - User leaves circle area → palette fades out after 200ms delay

2. **Click Actions:**
   - Click color picker → shows palette (if not already visible)
   - Click palette circle → changes annotation color
   - Click outside → dismisses palette

**Technical Implementation:**

1. **DOM Structure:**
   ```html
   <div class="sticky-note">
     <div class="sticky-note-color-circle">  <!-- Parent -->
       <div class="sticky-note-palette">     <!-- Child of color circle -->
         <div><div class="color-circle"></div></div>  <!-- Wrapped circles -->
         <div><div class="color-circle"></div></div>
         <!-- ... more circles ... -->
       </div>
     </div>
   </div>
   ```

2. **CSS Variables:**
   - `--circle-size: 22px` - Inner circle diameter
   - `--circle-border: 2px` - White border width
   - `--circle-total: 26px` - Total size including border
   - `--circle-radius: 13px` - Half of total size
   - `--circle-gap: 6px` - Space between circle edges
   - `--circle-spacing: 32px` - Distance between circle centers

3. **Positioning Strategy:**
   - Color picker: `position: absolute; top: -13px; right: -13px;` (relative to sticky note)
   - Palette: `position: absolute; top: 11px;` (relative to color picker, empirically adjusted)
   - Wrappers: Absolutely positioned with nth-child rules for exact spacing
   - Circles: `position: absolute; top: 0;` within wrappers

4. **Hover Zones:**
   - Extended using padding on wrapper divs (20px horizontal, 8px vertical)
   - Ensures continuous hover area for smooth mouse movement between circles

**Design Constraints:**

- All circles must be same size for visual consistency
- Spacing must be mathematically consistent (no visual gaps or overlaps)
- Hover zones must not have dead space between circles
- Transitions should be smooth (0.2s cubic-bezier easing)
- Avoid `scale()` transforms - use explicit px/em/rem dimensions instead

**Color Options:**

Standard palette colors (CSS variables):
- Yellow: `--highlight-yellow`
- Green: `--highlight-green`
- Blue: `--highlight-blue`
- Purple: `--highlight-purple`
- Red: `--highlight-red`
- Orange: `--highlight-orange`
