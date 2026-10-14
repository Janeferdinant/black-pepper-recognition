# Paper trace: claim to page (2026-10-14)

Every statement about the paper on the page and in the README is listed here with the page of the paper it comes from.
Page numbers are the printed "Page | n" numbers of the 8-page PDF (pages 1 to 8). Claims are paraphrased; none is copied.
The PDF itself is not in this repository and was never committed.

Status labels: **Stated** (the paper says it plainly), **Ambiguous** (the paper says it in a way that can be read two ways, or conflicts with itself), **Not stated** (looked for, absent), **Derived** (arithmetic done here on numbers the paper reports; marked as ours on the page).

## Identity

| # | Claim | Page | Status |
|---|---|---|---|
| 1 | Title is "Harvestable Black Pepper Recognition Using Computer Vision". | 1 | Stated |
| 2 | Three authors: Jane Rose N. F, Dr. Shelbi Joseph, Akhil Vijayan. The Crossref/IEEE record lists the third author as "P V Akhil". The page cites the Crossref/IEEE form and notes the title-page form. | 1 | Stated; spelling differs between sources |
| 3 | The conference name and city are not printed on any of the 8 pages. Venue (ICACC 2019, Kochi) comes from the Crossref record and the owner's confirmation. | 1 to 8 | Not stated in the PDF |

## Motivation and application

| # | Claim | Page | Status |
|---|---|---|---|
| 4 | Kerala grows much black pepper but is not the largest producer; the authors attribute this partly to a shortage of skilled labour and to late recognition of harvestable pepper. | 1 | Stated |
| 5 | The aim is to replace scarce skilled labour for spotting harvestable pepper, by finding it (and its position) in an image. | 1 | Stated |
| 6 | The intended application is an automated harvesting drone. | 1 | Stated |
| 7 | The paper gives no formal definition of "harvestable". Stage 1 looks for red components, and the segmentation discussion says red and yellow separate from green in HSV. | 1, 4 | Not stated (definition); Stated (red focus) |

## Image set

| # | Claim | Page | Status |
|---|---|---|---|
| 8 | A new image set of black pepper was captured in natural canopies in Kerala with a digital camera. | 1 | Stated |
| 9 | The flow chart labels the capture device "digital camera / smart phone"; the text says an ordinary RGB camera was chosen to keep cost down and that a phone camera is enough. | 2, 3 | Stated |
| 10 | The network was trained on "over 500" images from the new set; the conclusion calls the set "500+" images. Whether 500+ is the whole set or only the training part is not clear. | 1, 2, 5, 7 | Ambiguous |
| 11 | Classes are binary at the image level: the final stage decides "pepper" or "not pepper". Negative images contain none of the harvestable pepper. | 5, 6, 7 | Stated |
| 12 | Lighting, time of day, camera model, original resolution, number of plants, and distance are not given. Pseudo-code resizes input to 300 x 400 pixels. | 6 | Not stated (capture details); Stated (resize) |
| 13 | Whether the data set is available to others is not stated. | 1 to 8 | Not stated |

## Method

| # | Claim | Page | Status |
|---|---|---|---|
| 14 | The system has three stages. Each of the three has a "verification" gate: the program ends early if no red component is present (first), if no circles are present (second); the third gives the final confirmation of harvestable pepper. Moving on only when conditions are met is said to cut processing time and computing resources. | 1, 2 (Fig. 1) | Stated |
| 15 | Before the stages, the image is pre-processed in three ways: edge-preserving smoothing with a guided filter, local Laplacian filtering to raise local contrast, then histogram equalisation. | 3, 4 | Stated |
| 16 | Stage 1: convert to HSV, keep the red colour range as the region of interest, producing a segmented image. HSV was preferred over RGB, YCbCr and L*a*b* after a visual comparison of the colour spaces. | 1, 4, 5 | Stated |
| 17 | Stage 2: morphological operations remove small noise particles; objects smaller than 60 pixels are discarded; the centroid of each remaining object is found; a circle is drawn around each; circles are counted. | 1, 5, 6 | Stated |
| 18 | Gate 2 rule: the prose says the system stops when there are no circles; the pseudo-code stops when the circle count is one or fewer. | 1, 6 | Ambiguous (conflict) |
| 19 | Circle size in the pseudo-code: diameter is the mean of the object's major and minor axis lengths, radius is half of that. A table lists centroid, major axis, minor axis and orientation per object. | 5, 6 | Stated |
| 20 | Features used are morphological (size and shape); the paper argues size and shape separate leaf from pepper. The flow chart also shows colour features, and the results section speaks of morphological plus colour features. | 2, 5, 6 | Ambiguous (colour features) |
| 21 | Stage 3: ResNet-50 is given the input image and says whether it is harvestable pepper. | 1, 2, 5 | Stated |
| 22 | How ResNet-50 was trained: the prose says "trained over 500 images ... through feature extraction and deep learning". The pseudo-code loads a pre-trained network, extracts features from one of its convolutional layers, trains a classifier on them, then predicts and prints "Pepper Ready for Harvest" or "No Harvestable Pepper Found". Whether the weights were fine-tuned or only used as a feature extractor is not clear, and the network input size is not given. | 1, 5, 6 | Ambiguous |
| 23 | Several classifiers (ResNet-101, ResNet-50, GoogLeNet, AlexNet, an SVM category classifier) were compared on accuracy and execution time. ResNet-50 is called the best trade-off; ResNet-101 was a little less accurate, which the authors attribute to its extra layers. What exactly was timed is not stated. | 6 (Fig. 9, 10) | Stated (ordering only; chart values not reproduced here) |
| 24 | Software and hardware: MATLAB R2018b with computer-vision and parallel-computing toolboxes; Intel i5 at 3.6 GHz, 16 GB RAM, NVIDIA GTX 1080 with 8 GB. A high-performance GPU and processor are called desirable. | 2, 3, 6 | Stated |

## Evaluation

| # | Claim | Page | Status |
|---|---|---|---|
| 25 | System-level evaluation used 115 test images: 65 with harvestable pepper, all reported correctly, and 50 without, all reported correctly; no false positives or false negatives. Detection rate 115 of 115. | 6, 7 (Table IV) | Stated |
| 26 | Definitions: a true positive is an image with harvestable pepper that the system reports as having it; true negative, an image without it reported as without; false positive, an image without it reported as having it; false negative, an image with it reported as without it. These are image-level outcomes of the whole system. | 6, 7 | Stated |
| 27 | Formulas given: accuracy as correct over all (printed with missing brackets), recall = TP/(TP+FN), precision = TP/(TP+FP), F1 as their harmonic mean. | 5, 7 | Stated (accuracy formula has a printing slip) |
| 28 | "Global accuracy" is the accuracy of the full three-stage system, 100%. Recall 100%, precision 100%, F1 1.00. | 5, 7 (Tables III, V) | Stated |
| 29 | The classifier alone (stage 3 on its own): the prose gives 98.44%, Table III gives 96.35%. The two are not the same. Averaging the two diagonal entries of Table II matches the Table III figure, so 96.35% is the more internally consistent. | 5 | Ambiguous (conflict); Derived (consistency check) |
| 30 | The labelling of the error cells in Table II (which is called FP and which FN, against rows P and N) does not follow the usual convention. | 5 | Ambiguous |
| 31 | Whether the 115 test images are separate from the 500+ training images is not stated. How many images were taken per plant or scene is not stated. | 5 to 7 | Not stated |
| 32 | The scan time is called "reasonable" for real-time use. No number is given for the full system; the only timing is a per-classifier chart. | 1, 6 | Stated (claim); Not stated (number) |
| 33 | One-sided 95% upper bound on the true error rate after 0 errors in 115 trials: 1 - 0.05^(1/115) is about 2.6% (rule of three: 3/115 is about 2.6%). | n/a | Derived (standard statistics on the reported count; not from the paper) |
| 34 | The authors say the system outperforms existing algorithms in speed and accuracy, but do not run a head-to-head comparison with those systems on the same images. | 6 | Stated (claim) |

## Limitations and future work

| # | Claim | Page | Status |
|---|---|---|---|
| 35 | The paper has no section on limitations. | 1 to 8 | Not stated |
| 36 | Future work named: use live video instead of still images; automate finding the cutting point; put the system on unmanned ground or aerial vehicles with a cutting mechanism; build a mobile app for farmers (yield estimation and harvesting). | 7 | Stated |
| 37 | The conclusion calls the new image set an asset for further fruit-recognition research. | 7 | Stated |

## Not used

Personal contact details printed on the title page, the paper's figures, tables, histograms and chart values, and all sentences of the paper's text were not used. The page quotes nothing.
