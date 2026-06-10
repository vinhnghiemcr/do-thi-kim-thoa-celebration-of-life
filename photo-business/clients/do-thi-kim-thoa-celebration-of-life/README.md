# Do Thi Kim Thoa Celebration of Life

Dedicated memorial website project for the `Do Thi Kim Thoa` celebration-of-life site.

## Files

- `index.html` - memorial microsite shell
- `styles.css` - visual system and layout
- `app.js` - data-driven rendering, gallery tabs, lightbox
- `data/site-data.js` - schedule, memory timeline, daily updates, archive data
- `images/placeholders/` - neutral SVG placeholder artwork

## Local Preview

```bash
cd /home/vncr/.openclaw/workspace/main/photo-business/clients/do-thi-kim-thoa-celebration-of-life
python3 -m http.server 8030
```

Then open:

- `http://localhost:8030`

## Update Workflow

1. Replace placeholder image paths in `data/site-data.js` with real exported images.
2. Update the schedule details, family names, captions, and short remembrance copy.
3. After each funeral day, add that day's selected images to the matching `updates` section.
4. Refresh the site and redeploy.

## Notes

- The first version uses elegant placeholders instead of unrelated stock family photos.
- Keep original edited/high-resolution images outside this folder.
- Export web copies for the site and reference those here.
