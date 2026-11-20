# Build patterns (Figma Plugin API via use_figma)

Load the `figma-use` skill first. `use_figma` scripts are atomic: on error nothing is applied. Work in small steps; return node IDs from every call.

## Sessions and tools
- `create_session` per file, pass `sessionId` to every call.
- `get_screenshot` returns a short-lived URL; download with `curl -sf -L -o file.png "<url>"` into the scratchpad, then Read it to view.
- `get_metadata` for IDs/positions, `get_design_context` for tokens/text.

## Cross-file copying (no direct API)
1. `get_screenshot` the source node (use a high `maxDimension` for detail).
2. Download PNG with curl.
3. `upload_assets` (POST multipart to `submitUrl`, `curl -F file=@x.png`); the layer name = filename. Very wide images (>~16k px) will not upload: rebuild natively.
4. Position at the original relative coordinates inside a SECTION (children x/y are relative to the section).
- Crop with Python Pillow (`pip install pillow`) or, on macOS only, `sips`.

## Status icons (component keys from the guidelines library)
Import with `figma.importComponentByKeyAsync(key)`; use `instance.swapComponent(comp)` to change status.
- YES / pass: `4f5d3f857dda2a44883fc3ec5370a6bef44f9f16`
- NO / fail: `d82632a069c09bf5aa49e8e1b8b98ee72a349094`
- Unchecked: `03e55a0b291d973bd549bedb31fde8e0e19f0be0`
- N/A: `65b6735dcb00d4da0e60e665f09a95620cd990cf`
- To be reviewed once implemented ("Development & QA phase"): `c1ea355cdce58bee576c796e156a4ad22f08e7ee`
Legend wording from the template: NO / DOESN'T PASS, YES / PASS, UNCHECKED, NOT APPLICABLE, TO BE REVIEWED ONCE IMPLEMENTED. If keys fail, search the guidelines file for the "A11y point" component set.

## Checklist structure
`Column > "Category / X" > "Point / <criterion>" (label text + "Findings" frame) > "Finding / <name>"` where a Finding is a text frame (linked name + comment) plus a status icon instance. Clone an existing Point to create new ones; keep first finding only, then edit.

## Hyperlinks
- Link only a range: `text.setRangeHyperlink(start, end, {type:'URL', value})`; link colour blue `{r:.07,g:.34,b:.86}`; clear with `setRangeHyperlink(0, n, null)`.
- Criterion label: `label + ' ↗'`; only the `↗` (bold, blue) is linked to `…Accessibility-Guidelines?node-id=3827-<id>`.
- Finding name: blue, underlined, linked to the original frame: `https://www.figma.com/design/<fileKey>?node-id=<a>-<b>`.
- Example card headers: title text plus `↗` linked to the original frame.
- Annotation references: append `\nSee annotation: <example>, callout n ↗` to the finding comment, link the range to `?node-id=<callout id with - not :>` in the audit file.

## Text editing gotchas
- Load every font in the range before editing: `for (const f of t.getRangeAllFontNames(0, t.characters.length)) await figma.loadFontAsync(f)`.
- Inter styles are "Semi Bold" / "Extra Bold".
- Use `insertCharacters` / `deleteCharacters` to keep formatting; replacing `characters` resets to the first-range style.
- `strokeWeight` can be `figma.mixed` (a Symbol): check `typeof === 'number'`.
- Set `layoutSizing FILL` only after `appendChild`. `resize()` before sizing modes.
- Root frame height auto: set `primaryAxisSizingMode = 'AUTO'`.
- Emoji replacement: loop with `indexOf`, insert then delete.

## Measurement helpers (run in the source file)
```js
const lum=c=>{const f=v=>v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);return .2126*f(c.r)+.7152*f(c.g)+.0722*f(c.b)};
const cr=(a,b)=>+((Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05)).toFixed(2);
const solid=a=>Array.isArray(a)?a.find(p=>p.type==='SOLID'&&p.visible!==false&&(p.opacity===undefined||p.opacity>=.99)):null;
const bgOf=n=>{let p=n.parent;while(p){const s=Array.isArray(p.fills)&&solid(p.fills);if(s)return s.color;p=p.parent}return{r:1,g:1,b:1}};
```
- Dedupe by `mainComponent.key` so each component is measured once, then report which frames use it.
- Skip logos, photos, hero/media, footers when sweeping; treat white-on-photo as unmeasurable.
- Collect top-level frames from page children and SECTIONs (`width>=300 && height>=500`).
- Component discovery: count INSTANCE names per frame, then inspect states via `variantProperties`.
- Touch targets: report `width x height` of the interactive frame/instance, not its icon.
- Pagination/arrow buttons etc: check both the icon (3:1) and the control boundary.

## Annotated examples
- Crop screenshot into a clip frame (`clipsContent = true`) and place the image inside; keep scale factor so outline coordinates are right (a wrong scale placed an outline at 0.8x once; recheck after placing).
- Outlines: transparent rectangle, red dashed stroke (e.g. `#E5484D`), named `Issue outline n`; markers: red circle with white number named `Issue marker n`.
- Callout card: number badge + title text (severity emoji + criterion title) + description. When removing a callout, select the title among **direct** TEXT children (the first TEXT in the header is the number badge).

## Notes for developers page
- Build rows as auto-layout frames; 4 columns; owner chips coloured per owner.
- Figures: clone the screenshot, add blue dashed outlines and blue numbered markers, add a legend card per figure. Drop legend items for stock credits, placeholders, passive indicators.

## Verification checklist
- Script: 60 `Point /` frames, each with at least one `Finding /`; no `🟢` characters; no leftover `Callout` for removed items.
- Screenshot each column and each new frame; fix clipping, overflow, overlapping text, wrong icons.
- Clean up stray nodes on other pages and unused uploads.
