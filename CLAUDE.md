# jordan.mckible.com

The live source for the personal site (GitHub Pages, CNAME jordan.mckible.com). Edit here:
copy, layout, HTML. A push deploys.

- `index.html` + `img/`: the homepage, a register of projects, each with a picture.
- `omakase/`: my omakase, the Omarchy write-up in cut paper. Each section loads at runtime
  from `omakase/sections/<slug>/`. `omakase/identity/` is a frozen copy of the studio's kit
  and icon; don't edit it here.
- `pneu/`: redirect stubs to pneu.mckible.com. Installs' Google consent screens link these
  paths, so they stay forever.
- `memento/`, `images/`: old pages and portraits; leave them alone.

pneu's own site is not here: it's `~/dev/pneu-site` (pneu.mckible.com).

Preview: `python3 -m http.server 8790` here, then http://127.0.0.1:8790/ (omakase uses
module scripts, so it needs http, not file://).

## Design work goes through the studio

New pictures, a new section, a change of form, anything about the identity: that starts in
`~/dev/design-studio` (private, github.com/jmckible/design-studio). Read its CLAUDE.md, then
the project's log: `projects/jordan/log.md` for the homepage, `projects/omakase/process/log.md`
for omakase. The studio has the kit's README, the review canvases, the capture tools
(`bin/shot`, `bin/snap`) and the sources for every picture in `img/`. Finished work comes back
here as files.

`design-studio/projects/omakase/export.py` rebuilds `omakase/` wholesale from the studio,
which overwrites any edits made here. Port those edits back to the studio before running it.
