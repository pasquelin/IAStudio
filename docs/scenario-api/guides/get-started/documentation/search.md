---
title: Search | Scenario Docs
---

Scenario provides powerful search APIs for finding both assets and models in your projects. The search supports text queries, semantic similarity search using AI embeddings, image-based search, advanced filtering, and hybrid search modes that combine multiple search methods.

**Endpoints**:

- **Assets**: `POST /v1/search/assets`
- **Models**: `POST /v1/search/models`

This documentation covers Asset Search first, followed by Model Search. Both endpoints share similar search methods and syntax.

---

# Asset Search

## Quick Start

### Basic Text Search

Search for assets by name, description, or prompt:

```
POST /v1/search/assets
{
  "query": "fantasy castle"
}
```

### Image Similarity Search

Find assets similar to a reference image:

```
{
  "image": "data:image/png;base64,iVBORw0KGgo..."
}
```

### Filter by Attributes

Find assets matching specific criteria:

```
{
  "filter": "width >= 1024 AND tags = landscape"
}
```

## Search Methods

### 1. Text Search

Search assets by text content in names, prompts, descriptions, and tags.

**Parameters:**

- `query` (string): Text to search for

**Example:**

```
{
  "query": "cat wearing hat"
}
```

**Matches:**

- Asset names containing the text
- Generation prompts
- Asset descriptions and captions
- Tags
- Seeds (for reproducibility)

**Features:**

- **Typo tolerance**: Handles minor spelling mistakes
- **Prefix search**: “chris” matches “christmas”
- **Word splitting**: Finds partial matches

### 2. Semantic Search

Use AI embeddings to find semantically similar content, even when exact words don’t match.

**Parameters:**

- `query` (string): Text describing what you’re looking for
- `querySemanticRatio` (number, 0-1, default: 0): Weight of semantic vs. keyword search

**Example:**

```
{
  "query": "a man in red outfit for Christmas",
  "querySemanticRatio": 0.75
}
```

**When to use:**

- Finding conceptually similar images
- Discovering related content
- Overcoming vocabulary differences

**Ratio guide:**

- `0.0`: Pure keyword search (exact matches)
- `0.5`: Balanced hybrid search
- `1.0`: Pure semantic search (meaning-based)

### 3. Image Similarity Search

Find assets visually similar to a reference image.

**Parameters:**

- `image` (string): Asset ID or data URL of reference image
- `imageSemanticRatio` (number, 0-1, default: 1): Weight of visual similarity

**Single Image:**

```
{
  "image": "asset_abc123xyz",
  "imageSemanticRatio": 1.0
}
```

**Multiple Images (like/unlike):**

```
{
  "images": {
    "like": ["asset_abc123", "asset_def456"],
    "unlike": ["asset_xyz789"]
  }
}
```

**Use cases:**

- Find variations of an image
- Discover similar styles
- Exclude unwanted styles with `unlike`

**Supported formats:**

- Asset ID: `"asset_abc123xyz"`
- Data URL: `"data:image/png;base64,..."`

### 4. Combined Hybrid Search

Combine text, semantic, and image search for precise results.

```
{
  "query": "medieval architecture",
  "querySemanticRatio": 0.5,
  "image": "asset_reference123",
  "imageSemanticRatio": 0.8,
  "filter": "width >= 1024"
}
```

## Filtering

Use filters to narrow results by specific attributes.

### Filter Syntax

**Basic operators:**

- `=` - Equals
- `!=` - Not equals
- `>` - Greater than
- `>=` - Greater than or equal
- `<` - Less than
- `<=` - Less than or equal
- `IS EMPTY` - Field is empty/null
- `IS NOT EMPTY` - Field has a value

**Logical operators:**

- `AND` - Both conditions must be true
- `OR` - Either condition must be true
- `NOT` - Negates condition

**Grouping:**

- Use parentheses for complex logic: `(A OR B) AND C`

### Filterable Fields

**Asset Metadata:**

| Field         | Type   | Description        | Example                  |
| ------------- | ------ | ------------------ | ------------------------ |
| `kind`        | string | Asset type         | `kind = image`           |
| `width`       | number | Width in pixels    | `width >= 1024`          |
| `height`      | number | Height in pixels   | `height <= 2048`         |
| `size`        | number | File size in bytes | `size < 1000000`         |
| `aspectRatio` | string | Aspect ratio       | `aspectRatio = "16:9"`   |
| `mimeType`    | string | MIME type          | `mimeType = "image/png"` |
| `name`        | string | Asset name         | `name = "my-asset"`      |

**Generation Parameters:**

| Field               | Type   | Description        | Example                               |
| ------------------- | ------ | ------------------ | ------------------------------------- |
| `prompt`            | string | Generation prompt  | `prompt:dragon`                       |
| `text`              | string | Text content (TTS) | `text:hello`                          |
| `negativePrompt`    | string | Negative prompt    | `negativePrompt:blurry`               |
| `seed`              | string | Random seed        | `seed = "1234567890"`                 |
| `modelId`           | string | Model ID used      | `modelId = "model_abc123"`            |
| `baseModelId`       | string | Base model ID      | `baseModelId = "stable-diffusion-xl"` |
| `modelType`         | string | Model type         | `modelType = "flux.1"`                |
| `numInferenceSteps` | number | Inference steps    | `numInferenceSteps >= 50`             |
| `guidance`          | number | Guidance scale     | `guidance = 7.5`                      |
| `scheduler`         | string | Scheduler used     | `scheduler = "euler"`                 |

**Organization:**

| Field           | Type      | Description     | Example                      |
| --------------- | --------- | --------------- | ---------------------------- |
| `tags`          | string\[] | Asset tags      | `tags = landscape`           |
| `collectionIds` | string\[] | Collection IDs  | `collectionIds = col_abc123` |
| `nsfw`          | string\[] | NSFW labels     | `nsfw IS EMPTY`              |
| `privacy`       | string    | Privacy setting | `privacy = public`           |

**Timestamps:**

| Field       | Type | Description   | Example                     |
| ----------- | ---- | ------------- | --------------------------- |
| `createdAt` | date | Creation date | `createdAt >= "2024-01-01"` |
| `updatedAt` | date | Last modified | `updatedAt < "2024-12-31"`  |

**User/Project:**

| Field      | Type   | Description     | Example                  |
| ---------- | ------ | --------------- | ------------------------ |
| `authorId` | string | Creator user ID | `authorId = user_abc123` |
| `ownerId`  | string | Project ID      | Auto-filtered by API     |

### Filter Examples

**Find large landscape images:**

```
{
  "filter": "width >= 1920 AND height >= 1080 AND tags = landscape"
}
```

**Find safe-for-work assets:**

```
{
  "filter": "nsfw IS EMPTY"
}
```

**Find assets from specific model:**

```
{
  "filter": "modelId = model_abc123 AND kind = image"
}
```

**Find recent high-quality generations:**

```
{
  "filter": "createdAt >= \"2024-01-01\" AND numInferenceSteps >= 50 AND guidance >= 7"
}
```

**Find assets with specific tags:**

```
{
  "filter": "tags = fantasy AND tags = character"
}
```

**Exclude assets with tags:**

```
{
  "filter": "tags = landscape AND NOT tags = nsfw"
}
```

**Complex filter with grouping:**

```
{
  "filter": "(tags = dragon OR prompt:dragon) AND width >= 1024 AND nsfw IS EMPTY"
}
```

## Pagination

Two pagination modes are available:

### Offset-based Pagination

Use `offset` and `limit` for traditional pagination.

**Parameters:**

- `offset` (number, default: 0, min: 0): Number of results to skip
- `limit` (number, default: 20, min: 1, max: 100): Maximum results per request

**Example:**

```
{
  "query": "castle",
  "offset": 0,
  "limit": 20
}
```

**Next page:**

```
{
  "query": "castle",
  "offset": 20,
  "limit": 20
}
```

**Response:**

```
{
  "hits": [...],
  "offset": 0,
  "limit": 20,
  "estimatedTotalHits": 156
}
```

### Page-based Pagination

Use `page` and `hitsPerPage` for page-based pagination.

**Parameters:**

- `page` (number, min: 1): Page number to retrieve
- `hitsPerPage` (number, min: 1, max: 100): Results per page

**Example:**

```
{
  "query": "castle",
  "page": 1,
  "hitsPerPage": 20
}
```

**Response:**

```
{
  "hits": [...],
  "page": 1,
  "hitsPerPage": 20,
  "totalPages": 8,
  "totalHits": 156
}
```

## Sorting

Sort results by specific attributes.

**Parameter:**

- `sortBy` (string\[]): Array of `attribute:order` pairs

**Format:** `["field:asc"]` or `["field:desc"]`

**Sortable fields:**

- `createdAt` - Creation date
- `updatedAt` - Last modified date
- `width` - Image width
- `height` - Image height
- `score` - Asset popularity score

**Examples:**

Sort by newest first:

```
{
  "sortBy": ["createdAt:desc"]
}
```

Sort by dimensions:

```
{
  "sortBy": ["width:desc", "height:desc"]
}
```

Sort by popularity:

```
{
  "sortBy": ["score:desc", "createdAt:desc"]
}
```

When using text or semantic search without explicit sorting, results are automatically ranked by relevance.

## Public Search

Search across publicly shared assets from all users.

**Parameter:**

- `public` (boolean, default: false): Search public assets instead of your own

**Example:**

```
{
  "query": "fantasy landscape",
  "public": true,
  "limit": 50
}
```

**Use cases:**

- Discover community creations
- Find inspiration
- Browse trending content

Public search only returns assets explicitly marked as public by their creators.

## Response Format

```
{
  "hits": [
    {
      "id": "asset_abc123xyz",
      "url": "https://cdn.cloud.scenario.com/assets/...",
      "ownerId": "project_def456",
      "authorId": "user_ghi789",
      "privacy": "private",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "mimeType": "image/png",
      "description": "A majestic fantasy castle on a hill",
      "metadata": {
        "name": "Fantasy Castle",
        "kind": "image",
        "type": "inference-txt2img",
        "width": 1024,
        "height": 1024,
        "prompt": "fantasy castle on a hill, dramatic lighting",
        "seed": "1234567890",
        "modelId": "model_xyz789",
        "numInferenceSteps": 50,
        "guidance": 7.5
      },
      "tags": ["fantasy", "castle", "landscape"],
      "collectionIds": ["col_abc123"],
      "nsfw": [],
      "thumbnail": {
        "assetId": "asset_thumb123",
        "url": "https://cdn.cloud.scenario.com/thumbnails/..."
      }
    }
  ],
  "offset": 0,
  "limit": 20,
  "estimatedTotalHits": 156
}
```

### Response Fields

**Asset Information:**

- `id` - Asset unique identifier
- `url` - Signed CDN URL to access the asset
- `thumbnail` - Preview image for videos/3D models (optional)

**Ownership:**

- `ownerId` - Project that owns the asset
- `authorId` - User who created the asset
- `teamId` - Team that owns the project

**Metadata:**

- `metadata.kind` - Asset type (image, video, 3d, audio)
- `metadata.type` - Specific asset type (inference-txt2img, canvas, upload, etc.)
- `metadata.name` - User-assigned name
- `metadata.width/height` - Dimensions in pixels
- `metadata.prompt` - Generation prompt used
- `metadata.seed` - Reproducibility seed
- `metadata.modelId` - Model used for generation
- `metadata.numInferenceSteps` - Number of steps
- `metadata.guidance` - Guidance scale value
- `metadata.scheduler` - Scheduler algorithm

**Organization:**

- `tags` - User-assigned tags
- `collectionIds` - Collections containing this asset
- `nsfw` - NSFW classification labels
- `description` - Caption or user description

**Timestamps:**

- `createdAt` - When asset was created (ISO 8601)
- `updatedAt` - When asset was last modified (ISO 8601)

**Pagination:**

- `offset` - Number of results skipped
- `limit` - Maximum results returned
- `estimatedTotalHits` - Approximate total matches
- `page` - Current page (page-based pagination)
- `hitsPerPage` - Results per page (page-based pagination)
- `totalPages` - Total pages (page-based pagination)
- `totalHits` - Exact total matches (page-based pagination)

## Complete Examples

### Example 1: Find Similar Fantasy Landscapes

```
{
  "query": "fantasy landscape",
  "querySemanticRatio": 0.7,
  "filter": "width >= 1024 AND nsfw IS EMPTY AND tags = landscape",
  "sortBy": ["score:desc"],
  "limit": 30
}
```

### Example 2: Find Variations of an Image

```
{
  "images": {
    "like": ["asset_reference123"]
  },
  "imageSemanticRatio": 0.9,
  "filter": "kind = image",
  "limit": 20
}
```

### Example 3: Browse Recent High-Quality Generations

```
{
  "filter": "numInferenceSteps >= 50 AND guidance >= 7 AND createdAt >= \"2024-01-01\"",
  "sortBy": ["createdAt:desc"],
  "limit": 50
}
```

### Example 4: Search Public Gallery

```
{
  "public": true,
  "query": "character design",
  "querySemanticRatio": 0.5,
  "filter": "nsfw IS EMPTY AND width >= 512",
  "sortBy": ["score:desc"],
  "page": 1,
  "hitsPerPage": 24
}
```

### Example 5: Find Assets by Multiple Tags

```
{
  "filter": "tags = character AND tags = fantasy AND tags = warrior",
  "sortBy": ["createdAt:desc"],
  "limit": 40
}
```

## Best Practices

### Performance

1. **Use filters to narrow results** before applying semantic search
2. **Limit results appropriately** - don’t request more than you need
3. **Cache results** when possible to reduce API calls
4. **Use offset pagination** for deep pagination (better performance)

### Search Quality

1. **Combine search methods** for best results:

   - Use `filter` to narrow by concrete attributes
   - Use `query` for text matching
   - Use semantic search for conceptual matches
   - Use image search for visual similarity

2. **Start with filters** for specific requirements:

   ```
   {
     "filter": "width >= 1024 AND nsfw IS EMPTY",
     "query": "dragon",
     "querySemanticRatio": 0.5
   }
   ```

3. **Use appropriate semantic ratios:**

   - High ratio (0.8-1.0): Conceptual search, finding related content
   - Medium ratio (0.4-0.7): Balanced search with keyword preference
   - Low ratio (0.0-0.3): Exact matching with slight semantic boost

### Organization

1. **Tag your assets** consistently for better filtering
2. **Use descriptive names** to improve text search
3. **Organize into collections** for easy filtering by `collectionIds`
4. **Add to collections** for categorical searches

## Rate Limits

Asset search requests count against your account’s search quota. The quota depends on your subscription plan.

**Quota exceeded response:**

```
{
  "error": "Quota exceeded for search",
  "code": "QUOTA_EXCEEDED"
}
```

## Common Errors

Missing Search Parameters

**Error:** Must provide at least one search parameter

**Cause:** Request has no `query`, `filter`, `image`, or `images`

**Solution:** Include at least one search parameter

Invalid Filter Syntax

**Error:** Invalid filter syntax

**Cause:** Filter contains syntax errors or invalid fields

**Solution:** Check filter syntax and field names

Invalid Field

**Error:** “fieldName” is not a filterable field

**Cause:** Attempting to filter by non-filterable field

**Solution:** Use only fields from the filterable fields list

Pagination Limits

**Error:** Limit exceeds maximum (100)

**Cause:** `limit` or `hitsPerPage` set above 100

**Solution:** Use maximum of 100 results per request

## Migration Notes

### From Legacy Search

If you’re migrating from an older search API:

1. **Endpoint changed**: Use `POST /v1/search/assets` instead of previous endpoints
2. **Semantic search is opt-in**: Set `querySemanticRatio > 0` to enable
3. **Filter syntax**: Use standard operators (`=`, `>=`, etc.) instead of custom syntax
4. **Image search**: Use `image` or `images` parameter with asset IDs or data URLs
5. **Response format**: Assets include full metadata and signed URLs

---

# Model Search

## Overview

Search for AI models in your projects using the model search API. Model search supports text queries, semantic image-based search, filtering by capabilities and metadata, and discovering public community models.

**Endpoint**: `POST /v1/search/models`

## Quick Start

### Basic Text Search

Search for models by name or description:

```
POST /v1/search/models
{
  "query": "character"
}
```

### Image-Based Model Discovery

Find models by providing an example image:

```
{
  "image": "asset_abc123xyz"
}
```

### Filter by Capabilities

Find models with specific capabilities:

```
{
  "filter": "capabilities = img2img AND type = flux.1-lora"
}
```

## Search Methods

Model search supports the same search methods as asset search:

1. **Text Search** - Search by model name, description, tags, and capabilities
2. **Semantic Search** - Use `querySemanticRatio` for meaning-based search
3. **Image Similarity** - Find models using reference images (searches against model example images)
4. **Hybrid Search** - Combine multiple search methods

See the [Asset Search Methods](#search-methods) section for detailed documentation on each method.

## Model-Specific Filters

### Filterable Fields

**Model Metadata:**

| Field           | Type   | Description     | Example                        |
| --------------- | ------ | --------------- | ------------------------------ |
| `name`          | string | Model name      | `name:character`               |
| `type`          | string | Model type      | `type = "flux.1-lora"`         |
| `source`        | string | Model origin    | `source = training`            |
| `parentModelId` | string | Parent model ID | `parentModelId = model_abc123` |

**Capabilities & Features:**

| Field           | Type      | Description           | Example                      |
| --------------- | --------- | --------------------- | ---------------------------- |
| `capabilities`  | string\[] | Model capabilities    | `capabilities = img2img`     |
| `tags`          | string\[] | User-assigned tags    | `tags = character`           |
| `collectionIds` | string\[] | Collection IDs        | `collectionIds = col_abc123` |
| `concepts`      | string\[] | Linked concept models | `concepts = model_xyz789`    |

**Training Data:**

| Field                  | Type      | Description               | Example                          |
| ---------------------- | --------- | ------------------------- | -------------------------------- |
| `trainingImagesNumber` | number    | Number of training images | `trainingImagesNumber >= 10`     |
| `exampleAssetIds`      | string\[] | Example asset IDs         | `exampleAssetIds = asset_abc123` |

**Compliance:**

| Field                              | Type   | Description      | Example                                       |
| ---------------------------------- | ------ | ---------------- | --------------------------------------------- |
| `complianceMetadata.subProcessor`  | string | Sub-processor    | `complianceMetadata.subProcessor = Modal`     |
| `complianceMetadata.modelProvider` | string | Model provider   | `complianceMetadata.modelProvider = Scenario` |
| `complianceMetadata.maintainer`    | string | Model maintainer | `complianceMetadata.maintainer = Scenario`    |

**Organization:**

| Field      | Type   | Description     | Example                  |
| ---------- | ------ | --------------- | ------------------------ |
| `privacy`  | string | Privacy setting | `privacy = public`       |
| `ownerId`  | string | Project ID      | Auto-filtered by API     |
| `authorId` | string | Creator user ID | `authorId = user_abc123` |

**Timestamps:**

| Field       | Type | Description   | Example                     |
| ----------- | ---- | ------------- | --------------------------- |
| `createdAt` | date | Creation date | `createdAt >= "2024-01-01"` |
| `updatedAt` | date | Last modified | `updatedAt < "2024-12-31"`  |

### Common Model Capabilities

Models can have the following capabilities:

**Image Generation:**

- `txt2img` - Text to image generation
- `img2img` - Image to image transformation

**Video Generation:**

- `txt2video` - Text to video generation
- `img2video` - Image to video generation
- `video2video` - Video to video transformation
- `video2img` - Video to image extraction

**3D Generation:**

- `txt23d` - Text to 3D model generation
- `img23d` - Image to 3D model generation
- `3d23d` - 3D to 3D transformation

**Audio Generation:**

- `txt2audio` - Text to audio generation (music, speech, sound effects)
- `audio2audio` - Audio to audio transformation

**Other:**

- `txt2txt` - Text to text (language models, analysis)
- `img2txt` - Image to text (captioning, analysis)

### Filter Examples

**Find Flux models for image generation:**

```
{
  "filter": "type = \"flux.1-lora\" AND capabilities = txt2img"
}
```

**Find trained models with sufficient training data:**

```
{
  "filter": "source = training AND trainingImagesNumber >= 20"
}
```

**Find models by provider:**

```
{
  "filter": "complianceMetadata.modelProvider = Scenario"
}
```

**Find models with specific capabilities:**

```
{
  "filter": "capabilities = txt2img AND capabilities = img2img"
}
```

**Find public models with tags:**

```
{
  "public": true,
  "filter": "tags = character AND tags = fantasy"
}
```

## Response Format

```
{
  "hits": [
    {
      "id": "model_abc123xyz",
      "name": "Fantasy Character Generator",
      "shortDescription": "Generate detailed fantasy characters",
      "type": "flux.1",
      "source": "training",
      "ownerId": "project_def456",
      "authorId": "user_ghi789",
      "privacy": "private",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "updatedAt": "2024-01-15T10:30:00.000Z",
      "capabilities": ["txt2img", "img2img"],
      "tags": ["character", "fantasy"],
      "collectionIds": ["col_abc123"],
      "trainingImagesNumber": 25,
      "exampleAssetIds": ["asset_example1", "asset_example2"],
      "concepts": [
        { "modelId": "model_concept1" }
      ],
      "complianceMetadata": {
        "subProcessor": "Modal",
        "modelProvider": "Scenario",
        "maintainer": "Scenario"
      },
      "thumbnail": {
        "assetId": "asset_thumb123",
        "url": "https://cdn.cloud.scenario.com/thumbnails/..."
      },
      "score": 95.5
    }
  ],
  "offset": 0,
  "limit": 20,
  "estimatedTotalHits": 42
}
```

### Response Fields

**Model Information:**

- `id` - Model unique identifier
- `name` - Model display name
- `shortDescription` - Brief description
- `type` - Model type (e.g., “flux.1”, “sd-1\_5”)
- `source` - Origin (e.g., “training”, “import”)
- `parentModelId` - Parent model if derived

**Capabilities:**

- `capabilities` - Array of model capabilities
- `trainingImagesNumber` - Number of training images used
- `exampleAssetIds` - Array of example asset IDs
- `concepts` - Array of linked concept models

**Organization:**

- `tags` - User-assigned tags
- `collectionIds` - Collections containing this model
- `privacy` - Privacy setting

**Compliance:**

- `complianceMetadata` - Compliance and licensing information

  - `subProcessor` - Infrastructure provider
  - `modelProvider` - Model provider/creator
  - `maintainer` - Who maintains the model
  - `licenseTerms` - License URL
  - `dataProcessingComment` - Data retention policy

**Metadata:**

- `thumbnail` - Preview image (if available)
- `score` - Popularity/usage score
- `ownerId` - Project that owns the model
- `authorId` - User who created the model
- `createdAt` / `updatedAt` - Timestamps

## Public Model Search

Discover models shared by the community:

```
{
  "public": true,
  "query": "fantasy",
  "filter": "capabilities = txt2img",
  "limit": 50
}
```

**Public search features:**

- Browse community-created models
- Find pre-trained models
- Discover popular styles and concepts

## Complete Examples

### Example 1: Find Custom Trained Models

```
{
  "filter": "source = training AND trainingImagesNumber >= 15",
  "sortBy": ["createdAt:desc"],
  "limit": 20
}
```

### Example 2: Discover Image-to-Image Models

```
{
  "filter": "capabilities = img2img",
  "sortBy": ["score:desc"],
  "limit": 30
}
```

### Example 3: Find Models Similar to Reference Image

```
{
  "image": "asset_reference123",
  "imageSemanticRatio": 0.9,
  "filter": "capabilities = txt2img",
  "limit": 10
}
```

### Example 4: Search Public Flux Models

```
{
  "public": true,
  "query": "character design",
  "filter": "type = \"flux.1-lora\" AND capabilities = txt2img",
  "sortBy": ["score:desc"],
  "page": 1,
  "hitsPerPage": 24
}
```

## Pagination, Sorting & Public Search

Model search uses the same pagination, sorting, and public search features as asset search. See the corresponding sections in [Asset Search](#pagination) for details.

## Rate Limits & Errors

Model search shares the same rate limits and error handling as asset search. See [Rate Limits](#rate-limits) and [Common Errors](#common-errors) sections for details.
