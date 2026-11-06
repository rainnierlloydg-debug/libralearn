# Library cover illustrations

`book-01.jpg` through `book-30.jpg` are local project assets created with the
built-in image_gen tool. No CLI/API fallback was used. Each is a separate
portrait illustration, exported as a 640-pixel-wide JPEG for catalog use.
These are original illustrations for the sample collection, not scans of
published editions. `manifest.json` maps every file to its title and author.

Prompt set: each manifest entry supplies the exact title, scene and cover author
for this final specification:

> Use case: illustration-story. Asset: flat front book cover image for a school
> library catalog, portrait 2:3. Create a polished illustrated cover titled
> "{title}". Scene: {scene}. Refined painterly illustration with subtle print
> texture and professional editorial design. Large perfectly readable title
> "{title}" in the upper part. Full bleed artwork. No 3D mockup, no perspective,
> no watermarks or logos. If cover_author is present, show that exact author
> name at the bottom; otherwise no author line or additional text.

The first 18 illustrations were generated with temporary author labels, then
edited with the built-in tool using this instruction:

> Replace ONLY the bottom author line with the exact text "{cover_author}".
> Preserve the complete illustration, title, composition, colors, typography
> and dimensions. Do not include the word Demo anywhere.

Run `php artisan db:seed --class=BookCoverSeeder` to attach these to matching
local records with empty covers. Existing covers are preserved. The main
`SyntheticDemoSeeder` also installs its own 18 covers when missing.
