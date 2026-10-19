# 25 · Exercise media sources (checked 2026-10-19)

Plan rules ([09](09-design-system-and-media.md) section 6): technique media shows real people moving correctly and is reviewed by a qualified coach; AI-generated imagery is never the technique reference; the pilot may use text cues plus simple line illustrations, or openly licensed images with attribution; every asset needs a licence row.

## What each source allows

| Source | What it has | Licence (as checked) | Fit for Form & Flow |
|---|---|---|---|
| free-exercise-db / exercises.json (GitHub) | 800+ exercises, 2 photos each | Repo is Unlicense, but the original author says the images "have been scraped off the internet" and advises against commercial use ([CONTRIBUTING](https://github.com/wrkout/exercises.json/blob/master/CONTRIBUTING.md#exercise-images), [issue #2](https://github.com/yuhonas/free-exercise-db/issues/2), [issue #13](https://github.com/yuhonas/free-exercise-db/issues/13)) | **No.** Text only, at most |
| ExerciseDB / AscendAPI GIFs | 1,500 GIFs | Media rights unclear; a reported legal notice to a buyer of copied GIFs (anecdotal) ([exercisedb.dev](https://exercisedb.dev/)) | **No**, unless written commercial rights |
| wger (open-source app) | 279 of 932 exercises have images, 46 have videos | Per item: CC0, CC-BY 4 or CC-BY-SA 3/4, author named in the API ([wger API](https://wger.de/api/v2/license/)) | **Partly.** Covers 17 of our 46 exercises with an image (about 11 true matches, the rest are other variants) and 2 to 4 with video; mixed styles; attribution and share-alike required |
| Pexels videos | Real people, varied | Free, modify, no attribution; no implied endorsement, no bad light ([licence](https://www.pexels.com/license/)) | **Maybe.** Coverage and form quality not checked; each clip needs coach review |
| Own footage (plan's beta route) | Whatever we film | Ours, with model releases | **Yes.** Best long-term fit |
| Tools: ffmpeg | Trim, compress, loop to the 720p, under 1.5 MB spec | Free, open source | Yes |
| Tools: Remotion | Code-built videos and captions | Free for individuals and companies up to 3 employees ([LICENSE](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)) | Yes, for the pilot |

## Recommendation

1. **Pilot, now:** animated line illustrations built in code, one per movement pattern (about 12 cover all 46 exercises). No licence risk, tiny, offline, in the Block Party style. Allowed by plan 09 for the pilot.
2. **Beta:** film short clips (front and side, plain wall), process them with ffmpeg into loops, and have the S&C reviewer approve each one before it goes live.
3. **Optional:** use wger images where they truly match, with the author and licence shown under each one.
