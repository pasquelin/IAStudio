---
title: NSFW | Scenario Docs
---

# Overview

Scenario automatically classifies all uploaded and generated image assets for Not Safe For Work (NSFW) content. This classification helps you filter and manage content in your projects, particularly for use cases requiring content moderation or age-appropriate filtering.

# How It Works

## Automatic Classification

Every image asset uploaded or generated through Scenario is automatically analyzed using AWS Rekognition’s content moderation service. The classification happens asynchronously during the asset enrichment process and typically completes within seconds.

**What gets classified:**

- User-uploaded images
- AI-generated images from inferences
- Canvas assets
- Edited images

**Processing:**

1. Asset is created or uploaded
2. Background enrichment process starts
3. Image is analyzed for NSFW content
4. Classification labels are stored with the asset
5. Labels become available via API and search

## Classification Categories

The NSFW classification uses AWS Rekognition’s content moderation labels. AWS Rekognition provides a hierarchical taxonomy with parent categories and subcategories.

**Top-Level Categories (Level 1):**

| Category              | Description                            | Example Use Cases           |
| --------------------- | -------------------------------------- | --------------------------- |
| `explicit_nudity`     | Contains explicit nudity               | Adult content filtering     |
| `suggestive`          | Suggestive poses or revealing clothing | Age-appropriate filtering   |
| `violence`            | Violent or weapon-related content      | Content moderation          |
| `visually_disturbing` | Gore, corpses, or disturbing imagery   | Sensitive content filtering |
| `rude_gestures`       | Offensive hand gestures                | Community guidelines        |
| `drugs`               | Drug paraphernalia or drug use         | Platform compliance         |
| `tobacco`             | Tobacco products or smoking            | Regional compliance         |
| `alcohol`             | Alcoholic beverages or drinking        | Age restrictions            |
| `gambling`            | Gambling-related content               | Regional restrictions       |
| `hate_symbols`        | Hate symbols or extremist signs        | Community safety            |

**Common Subcategories (Level 2):**

Some frequently detected subcategories include:

- `swimwear_or_underwear` (under Suggestive)
- `revealing_clothes` (under Suggestive)
- `sexual_activity` (under Explicit Nudity)
- `graphic_male_nudity` / `graphic_female_nudity` (under Explicit Nudity)
- `weapon_violence` (under Violence)
- `explosions_and_blasts` (under Visually Disturbing)
- `emaciated_bodies` (under Visually Disturbing)

* An asset can have multiple labels from different categories
* An empty array `[]` indicates no concerning content was detected
* Category names are returned in lowercase with underscores (e.g., `explicit_nudity`)
* AWS Rekognition continuously updates its taxonomy; new categories may be added over time

# API Integration

## Asset Object Structure

When retrieving assets via the API, each asset includes an `nsfw` field:

```
{
  "asset": {
    "id": "asset-id",
    "url": "https://cdn.cloud.scenario.com/...",
    "nsfw": ["swimwear_or_underwear", "suggestive"],
    ...
  }
}
```

## Retrieving Assets

**Endpoint**: `GET /v1/assets/{assetId}`

**Response**:

```
{
  "asset": {
    "id": "abc123",
    "url": "https://...",
    "nsfw": [],
    "kind": "image",
    ...
  }
}
```

The `nsfw` field is an array of strings. Empty array means no NSFW content detected.

## Filtering NSFW Content

You can filter assets based on NSFW classification in search queries.

**Endpoint**: `POST /v1/assets/search`

**Filter for assets with any NSFW labels:**

```
{
  "filter": "nsfw IS NOT EMPTY"
}
```

**Filter for assets without NSFW labels (safe content only):**

```
{
  "filter": "nsfw IS EMPTY"
}
```

**Filter for specific NSFW categories:**

```
{
  "filter": "nsfw = explicit_nudity"
}
```

# User Preferences

## NSFW Filter Setting

Users can configure their NSFW filter preferences in their settings.

**Endpoint**: `PUT /v1/me`

**Enable NSFW filtering:**

```
{
  "settings": {
    "nsfw-filter": true
  }
}
```

**Disable NSFW filtering:**

```
{
  "settings": {
    "nsfw-filter": false
  }
}
```

**Control NSFW filter visibility:**

```
{
  "settings": {
    "search-filters-display-nsfw": true
  }
}
```

# Best Practices

## Content Moderation

1. **Proactive Filtering**: Use the `nsfw` field to filter content before displaying it to end users
2. **Category-Specific Rules**: Different use cases may require filtering different categories
3. **User Controls**: Allow users to adjust their NSFW filter preferences when appropriate

## Implementation Examples

**Example 1: Safe-for-work only**

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


// Filter to only show assets with no NSFW labels
const response = await client.assets.search({
  filter: 'nsfw IS EMPTY',
});
```

```
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


# Filter to only show assets with no NSFW labels
response = client.assets.search(
    filter="nsfw IS EMPTY",
)
```

**Example 2: Exclude specific categories**

```
// Check asset before displaying
const asset = await getAsset(assetId);


const excludedCategories = ['explicit_nudity', 'visually_disturbing'];
const hasExcludedContent = asset.nsfw.some(label =>
  excludedCategories.includes(label)
);


if (hasExcludedContent) {
  // Show placeholder or skip
  console.log('Asset contains filtered content');
}
```

**Example 3: Age-appropriate content**

```
// Define age-appropriate restrictions
const restrictedForMinors = [
  'explicit_nudity',
  'suggestive',
  'visually_disturbing',
  'drugs',
  'tobacco',
  'alcohol',
  'gambling'
];


const isSafeForMinors = asset.nsfw.every(label =>
  !restrictedForMinors.includes(label)
);
```

# Privacy and Data Processing

- NSFW classification is processed using AWS Rekognition in your selected region
- Classification data is stored with the asset metadata
- No image data is retained by the classification service beyond processing
- Classifications are updated if an asset is replaced or re-uploaded

# Limitations

- **Image-only**: NSFW classification currently applies to images only. Videos and 3D models are not classified
- **Processing time**: Classification happens asynchronously and may take a few seconds
- **Accuracy**: While highly accurate, automated classification may occasionally produce false positives or negatives
- **Language**: Category names are in English and use underscores for multi-word categories
- **Resolution requirements**: Images must be at least 50x50 pixels for analysis

# Troubleshooting

## NSFW Field is Undefined

**Cause**: The asset has not yet been enriched with NSFW data.

**Solution**: Wait a few seconds and retry the request. The enrichment process typically completes within 5-10 seconds of asset creation.

## Empty NSFW Array

**Meaning**: No concerning content was detected. This is the expected result for most safe-for-work content.

### Multiple Categories

**Meaning**: The image contains multiple types of content. For example, an image might have both `swimwear_or_underwear` and `suggestive` labels.

**Handling**: Apply your filtering logic based on any matching category, or require all categories to be safe.

# Regional Considerations

Some content categories may have different acceptability standards across regions:

- **Alcohol/Tobacco**: May be restricted in certain regions or for certain age groups
- **Gambling**: Legal restrictions vary significantly by jurisdiction
- **Swimwear**: Different cultural norms may apply

Consider implementing region-specific filtering rules based on your user base and applicable regulations.

# Support

For questions about NSFW classification or to report classification issues, contact Scenario support with:

- Asset ID
- Expected vs. actual classification
- Use case context
