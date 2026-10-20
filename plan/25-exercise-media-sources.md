# 25 · Exercise media sources (checked 2026-10-19, second pass same day)

Plan rules ([09](09-design-system-and-media.md) section 6): technique media shows real people moving correctly and is reviewed by a qualified coach; AI-generated imagery is never the technique reference; the pilot may use text cues plus simple line illustrations, or openly licensed images with attribution; every asset needs a licence row.

## What each source allows

| Source | What it has | Licence (as checked) | Fit for Form & Flow |
|---|---|---|---|
| free-exercise-db / exercises.json (GitHub) | 800+ exercises, 2 photos each | Repo is Unlicense, but the original author says the images "have been scraped off the internet" and advises against commercial use ([CONTRIBUTING](https://github.com/wrkout/exercises.json/blob/master/CONTRIBUTING.md#exercise-images), [issue #2](https://github.com/yuhonas/free-exercise-db/issues/2), [issue #13](https://github.com/yuhonas/free-exercise-db/issues/13)) | **No.** Text only, at most |
| ExerciseDB / AscendAPI GIFs | 1,500 GIFs | Media rights unclear; a reported legal notice to a buyer of copied GIFs (anecdotal) ([exercisedb.dev](https://exercisedb.dev/)) | **No**, unless written commercial rights |
| wger (open-source app) | 279 of 932 exercises have images, 46 have videos | Per item: CC0, CC-BY 4 or CC-BY-SA 3/4, author named in the API ([wger API](https://wger.de/api/v2/license/)) | **Partly.** Covers 17 of our 46 exercises with an image (about 11 true matches, the rest are other variants) and 2 to 4 with video; mixed styles; attribution and share-alike required |
| Pexels videos | Real people, varied | Free, modify, no attribution; no implied endorsement, no bad light ([licence](https://www.pexels.com/license/)) | **Maybe.** Common moves found (squat, glute bridge, lat pulldown, deadlift); dead bug, bird dog, Pallof press, farmer's carry and cat-cow not in the top results. Mixed people and angles; each clip needs coach review |
| Mixamo (Adobe) 3D characters and mocap animations | Realistic 3D people, motion-captured moves | "Royalty free for personal, commercial, and non-profit projects", films and games listed; free Adobe ID ([Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)). An Adobe staff post adds: do not redistribute the raw character or animation files ([community FAQ](https://community.adobe.com/questions-696/mixamo-faq-licensing-royalties-ownership-eula-and-tos-589400)) | **Yes, as rendered video** (ship MP4, never the FBX). No real person, so no likeness risk. Coverage checked 2026-10-20: usable for 3 of our 46 (bodyweight squat, push-up, barbell back squat with a drawn bar). Its plank is straight-arm, its kettlebell swing goes overhead and its sit-to-stand is casual, so those contradict our cues |
| Everkinetic drawings ([GitHub](https://github.com/everkinetic/data)) | 293 exercises, 2 hand-drawn frames each (start, end), SVG and PNG | CC BY-SA 4.0 (repo LICENSE.md) | **Partly.** 14 exact matches of our 46 (leg press, back squat, glute bridge, deadlift, DB reverse lunge, push-up, DB and barbell bench, DB shoulder press, cable row, barbell row, lat pulldown, pull-up, side plank). Attribution and share-alike on the images. Origin of the drawings not independently confirmed |
| CMU motion capture database | Mocap clips | "You may include this data in commercially-sold products, but you may not resell this data directly" ([mocap.cs.cmu.edu](http://mocap.cs.cmu.edu/)) | **Low coverage.** Only squats, lunges, jumping jacks and stretches |
| Pixabay videos | Real people | Commercial use allowed, but Pixabay does not promise model releases for identifiable people ([terms](https://pixabay.com/service/terms/)) | **Avoid** (likeness risk sits with us) |
| US military (DVIDS) videos | Real soldiers, drills | Not copyrighted, but commercial use needs a non-endorsement disclaimer, and posting "do[es] not waive any publicity or privacy rights" of people shown ([DVIDS](https://www.dvidshub.net/about/copyright)) | **Avoid** |
| NIA Go4Life videos | Older-adult exercises | Federal works, reusable with credit, but NIA warns privately sponsored items may be restricted ([policies](https://go4life.nia.nih.gov/policies)) | **Avoid** unless NIA confirms per video |
| Wikimedia Commons | 27 exercise videos | Per file | **No.** Almost no demos of our moves |
| Own footage (plan's beta route) | Whatever we film | Ours, with model releases | **Yes.** Best long-term fit |
| Tools: ffmpeg | Trim, compress, loop to the 720p, under 1.5 MB spec | Free, open source | Yes |
| Tools: Remotion | Code-built videos and captions | Free for individuals and companies up to 3 employees ([LICENSE](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md)) | Yes, for the pilot |

## What shipped (2026-10-20)

Every one of the 46 exercises has a looping 3D demo in the workout player and the library.

| Asset | Source | Licence |
|---|---|---|
| Character (Remy) | Mixamo, downloaded by the founder's Adobe ID | Royalty free, commercial use allowed; only rendered video ships, never the raw FBX ([Adobe FAQ](https://helpx.adobe.com/creative-cloud/faq/mixamo-faq.html)) |
| Motion for bodyweight squat, push-up, back squat | Mixamo motion capture | Same as above |
| Motion for the other 43 | Our own keyframes (`tools/render-moves/motion/`), mapped onto the 3D skeleton | Ours |
| Equipment (bars, bench, bands, machines) | Simple shapes drawn in code | Ours |

Raw Mixamo files stay in `media-src/` (git-ignored). Clips are rendered by `tools/render-moves` and copied into `app/assets/exercises` by its publish step. All demos are drafts until a coach reviews them; real clips replace them for beta ([26](26-filming-guide.md)).
