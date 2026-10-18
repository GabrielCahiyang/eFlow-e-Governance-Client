# Storyset illustrations in eFlow

Artwork by Storyset / Freepik, used under the [Storyset terms](https://storyset.com/terms).
Each illustration's original URL, drawing style and local animation are recorded in `sources.json`.
The application displays one linked credit in its page footer when Storyset artwork is in use, instead of repeating the credit under every image.

These are ten different concepts across Rafiki, Bro, Amico, Pana and Cuate, two per style.
The original accent in each drawing was changed to eFlow teal `#0C6F6B`; skin tones and neutral linework remain.
Detailed/simple background groups were removed to keep small empty states readable.

Animations are eFlow-authored CSS on named Storyset layers, embedded in the local SVG.
The files have no scripts, external resources or runtime dependency on Storyset.
The `.still.svg` files contain no animation and are selected with a reduced-motion `<picture>` source.
Animated files also disable animation internally for reduced-motion users.

Do not remove the attribution, extract these into an illustration library, or redistribute them as an asset pack.
