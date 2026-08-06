---
title: Uploading Assets | Scenario Docs
---

To fully leverage the Scenario API for content generation, you often need to provide input assets, such as reference images for `img2img`, audio files for video lip-sync, or 3D models for 3D generation. The Scenario API provides two endpoints for uploading files:

- **`POST /v1/assets`** - For uploading **small images** (< 6MB) using simple base64 upload
- **`POST /v1/uploads`** - For uploading **larger images** (≥ 6MB), **audio, video, and 3D models** using multipart upload

This guide will help you understand when to use each endpoint and how to upload files successfully.

---

## Quick Reference: Which Endpoint to Use?

| File Type                                    | File Size | Endpoint      | Method               |
| -------------------------------------------- | --------- | ------------- | -------------------- |
| **Images** (JPEG, PNG, GIF, SVG, WebP, etc.) | < 6MB     | `/v1/assets`  | Simple base64 upload |
| **Images** (JPEG, PNG, GIF, SVG, WebP, etc.) | ≥ 6MB     | `/v1/uploads` | Multipart upload     |
| **Audio** (MP3, WAV, OGG, M4A)               | Any size  | `/v1/uploads` | Multipart upload     |
| **Video** (MP4, WebM)                        | Any size  | `/v1/uploads` | Multipart upload     |
| **3D Models** (GLB, GLTF, OBJ, FBX, etc.)    | Any size  | `/v1/uploads` | Multipart upload     |

---

## Uploading Images: `/v1/assets`

The `/v1/assets` endpoint is the simplest way to upload **small images** (under 6MB). It accepts images in base64 format and returns an `assetId` immediately. For larger images (6MB or more), use the `/v1/uploads` endpoint with multipart upload instead.

### Supported Image Formats

- **JPEG** - `image/jpeg`
- **PNG** - `image/png`
- **GIF** - `image/gif`
- **SVG** - `image/svg+xml`
- **WebP** - `image/webp`
- **AVIF** - `image/avif`
- **TIFF** - `image/tiff`
- **HEIF** / **HEIC** - `image/heic`

### Endpoint Details

**Endpoint:** `POST https://api.cloud.scenario.com/v1/assets?projectId={projectId}`

### Request Body

| Parameter | Type   | Description                              |
| --------- | ------ | ---------------------------------------- |
| `image`   | string | **Required.** The image in base64 format |
| `name`    | string | **Required.** The name of the image file |

**Optional Parameters:**

- `hide` - Boolean to hide the asset from the UI
- `parentId` - Parent asset ID for organizing assets
- `collectionIds` - Array of collection IDs to add the asset to

### Code Examples

#### Python

```
import base64
from scenario_sdk import Scenario


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


# Read and encode image as base64
file_path = "./my_image.png"
with open(file_path, "rb") as image_file:
    encoded_string = base64.b64encode(image_file.read()).decode("utf-8")


# Upload image
response = client.assets.upload(
    name="my_image_base64_upload",
    image=encoded_string,
)


asset_id = response.asset.id
print(f"Asset uploaded successfully! Asset ID: {asset_id}")
```

#### TypeScript

```
import Scenario from '@scenario-labs/sdk';
import fs from 'fs';
import path from 'path';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


async function uploadImage() {
  const filePath = './my_image.png';


  // Read and encode image to Base64
  const fileBuffer = fs.readFileSync(filePath);
  const base64Image = fileBuffer.toString('base64');


  // Upload image
  const response = await client.assets.upload({
    name: path.basename(filePath),
    image: base64Image,
  });


  const assetId = response.asset.id;
  console.log(`Asset uploaded successfully! Asset ID: ${assetId}`);
}


uploadImage();
```

### Response

A successful response returns an HTTP `200 OK` status code and a JSON object containing details about the uploaded asset:

```
{
    "asset": {
        "id": "asset_staging_qSACAtKeAbd1EmAEG4YNguea",
        "url": "https://cdn.cloud.scenario.com/assets-transform/asset_staging_qSACAtKeAbd1EmAEG4YNguea?...",
        "mimeType": "image/png",
        "metadata": {
            "type": "uploaded",
            "name": "fileName.png",
            "kind": "image",
            "width": 1024,
            "height": 1024,
            "size": 979892
        },
        "properties": {
            "width": 1024,
            "height": 1024,
            "size": 979892
        },
        "kind": "image",
        "source": "uploaded",
        "ownerId": "proj_eTyi419soRtdN2AexdFHZDqX",
        "authorId": "03223725c4b2d23114ab7d673bcbf850",
        "createdAt": "2025-06-30T15:15:27.153Z",
        "updatedAt": "2025-06-30T15:15:27.153Z",
        "privacy": "private",
        "tags": [],
        "collectionIds": [],
        "status": "success",
        "editCapabilities": [
            "REMOVE_BACKGROUND",
            "REFINE",
            "PIXELATE",
            "PROMPT_EDITING",
            "UPSCALE",
            "UPSCALE_360",
            "DETECTION",
            "VECTORIZATION",
            "SEGMENTATION",
            "REFRAME",
            "GENERATIVE_FILL"
        ]
    }
}
```

**Key fields:**

- `id` - The unique `assetId` for referencing in other API calls
- `url` - The URL where the asset can be accessed
- `mimeType` - The MIME type of the uploaded file
- `properties` - Image dimensions and size information

---

## Uploading Larger Images, Audio, Video, and 3D Models: `/v1/uploads`

The `/v1/uploads` endpoint uses a multipart upload process for:

- **Large images** (6MB or larger) that exceed the `/v1/assets` size limit
- **Audio files** (for video lip-sync, music generation, etc.)
- **Video files**
- **3D models**

This endpoint is required for all non-image files and recommended for images that are 6MB or larger.

### Supported File Types

#### Images (Large Files)

- **JPEG** - `image/jpeg`
- **PNG** - `image/png`
- **GIF** - `image/gif`
- **SVG** - `image/svg+xml`
- **WebP** - `image/webp`
- **AVIF** - `image/avif`
- **TIFF** - `image/tiff`
- **HEIF** / **HEIC** - `image/heic`

For images under 6MB, use `/v1/assets` for simpler upload. For images 6MB or larger, use `/v1/uploads` with `kind: "image"`.

#### Audio Files

- **MP3** - `audio/mpeg` or `audio/mp3`
- **WAV** - `audio/wav`
- **OGG** - `audio/ogg`
- **M4A** - `audio/m4a`

#### Video Files

- **MP4** - `video/mp4`
- **WebM** - `video/webm`

#### 3D Models

- **GLB** - `model/gltf-binary`
- **GLTF** - `model/gltf+json`
- **OBJ** - `model/obj`
- **FBX** - `application/vnd.autodesk.fbx`
- **STL** - `model/stl`
- **PLY** - `model/ply`
- **VOX** - `model/x-3d-vox`
- And other 3D formats

### Multipart Upload Process

The `/v1/uploads` endpoint uses a 4-step multipart upload process:

1. **Initialize the upload** - Create an upload entry and get presigned URLs
2. **Upload file parts** - Upload your file to the presigned URLs
3. **Complete the upload** - Signal that all parts have been uploaded
4. **Retrieve the assetId** - Poll the upload status until processing is complete

---

## Step-by-Step Guide: Multipart Upload

### Step 1: Initialize the Upload

Make a `POST` request to `/v1/uploads` with file metadata:

**Endpoint:** `POST /v1/uploads?projectId={projectId}`

**Request Body (Large Image Example):**

```
{
  "fileName": "large-image.png",
  "contentType": "image/png",
  "kind": "image",
  "parts": 1,
  "fileSize": 8388608
}
```

**Request Body (Audio Example):**

```
{
  "fileName": "audio.mp3",
  "contentType": "audio/mpeg",
  "kind": "audio",
  "parts": 1,
  "fileSize": 1234567
}
```

**Request Body (Video Example):**

```
{
  "fileName": "video.mp4",
  "contentType": "video/mp4",
  "kind": "video",
  "parts": 1,
  "fileSize": 5678901
}
```

**Request Body (3D Model Example):**

```
{
  "fileName": "model.glb",
  "contentType": "model/gltf-binary",
  "kind": "3d",
  "parts": 1,
  "fileSize": 2345678
}
```

**Parameters:**

- `fileName` (required) - The name of your file

- `contentType` (required) - The MIME type of your file:

  - **Images:** `image/jpeg`, `image/png`, `image/gif`, etc.
  - **Audio:** `audio/mpeg`, `audio/wav`, `audio/ogg`, `audio/m4a`
  - **Video:** `video/mp4`, `video/webm`
  - **3D Models:** `model/gltf-binary`, `model/gltf+json`, `model/obj`, etc.

- `kind` (required) - The file type: `"image"`, `"audio"`, `"video"`, or `"3d"`

- `parts` (required) - Number of parts (use `1` for files < 5MB)

- `fileSize` (required) - Size of the file in bytes

**Response:**

```
{
  "upload": {
    "id": "upload_abc123",
    "status": "pending",
    "parts": [
      {
        "number": 1,
        "url": "https://s3.amazonaws.com/...",
        "expires": "2024-01-01T12:00:00Z"
      }
    ],
    "jobId": "job_xyz789"
  }
}
```

Save the `upload.id` and the `parts` array for the next steps.

### Step 2: Upload File Parts

For each part in the `parts` array, make a `PUT` request to the presigned URL with the file data.

**For single-part uploads (files < 5MB):**

```
const file = fs.readFileSync('audio.mp3');
const part = upload.parts[0];


await fetch(part.url, {
  method: 'PUT',
  body: file
});
```

**For multi-part uploads (files > 5MB):** Split your file into chunks and upload each chunk:

```
const fileBuffer = fs.readFileSync('large-file.mp3');
const partSize = Math.ceil(fileBuffer.length / partsCount);


for (let i = 0; i < partsCount; i++) {
  const start = i * partSize;
  const end = Math.min((i + 1) * partSize, fileBuffer.length);
  const chunk = fileBuffer.slice(start, end);
  const part = upload.parts[i];


  await fetch(part.url, {
    method: 'PUT',
    body: chunk
  });
}
```

**Important Notes:**

- Presigned URLs expire after a certain time (check the `expires` field)
- Each part must be at least 5MB (except the last part)
- Maximum number of parts is 10,000
- Maximum file size is 5TB

### Step 3: Complete the Upload

After all parts have been uploaded, signal completion:

**Endpoint:** `POST /v1/uploads/{uploadId}/action?projectId={projectId}`

**Request Body:**

```
{
  "action": "complete"
}
```

**Response:**

```
{
  "upload": {
    "id": "upload_abc123",
    "status": "validating",
    "entityId": null
  }
}
```

The upload status will change from `"pending"` → `"validating"` → `"validated"` → `"imported"` when processing is complete.

### Step 4: Retrieve the Asset ID

Poll the upload status until the `entityId` field is populated. This `entityId` is your `assetId` that you can use in other API calls.

**Endpoint:** `GET /v1/uploads/{uploadId}?projectId={projectId}`

**Response (while processing):**

```
{
  "upload": {
    "id": "upload_abc123",
    "status": "validating",
    "entityId": null
  }
}
```

**Response (when complete):**

```
{
  "upload": {
    "id": "upload_abc123",
    "status": "imported",
    "entityId": "asset_xyz789"
  }
}
```

---

## Complete Code Examples

### Example 1: Upload Image (Simple)

```
import base64
from scenario_sdk import Scenario


def upload_image(file_path, api_key, api_secret):
    client = Scenario(api_key=api_key, api_secret=api_secret)


    with open(file_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")


    response = client.assets.upload(
        name=file_path.split("/")[-1],
        image=encoded,
    )


    return response.asset.id


# Usage
asset_id = upload_image("./image.png", "key_...", "secret_...")
print(f"Image uploaded! Asset ID: {asset_id}")
```

### Example 2: Upload Large Image

```
import os
import time
import requests
from scenario_sdk import Scenario


def upload_large_image(file_path, api_key, api_secret):
    """Upload an image that is 6MB or larger using multipart upload."""
    client = Scenario(api_key=api_key, api_secret=api_secret)


    file_size = os.path.getsize(file_path)
    file_name = os.path.basename(file_path)


    # Determine content type based on extension
    ext = file_name.split('.')[-1].lower()
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml'
    }
    content_type = content_types.get(ext, 'image/jpeg')


    # Step 1: Initialize upload
    init_response = client.uploads.create(
        file_name=file_name,
        content_type=content_type,
        kind="image",
        parts=1,
        file_size=file_size,
    )
    upload = init_response.upload
    upload_id = upload.id


    # Step 2: Upload file part to presigned URL
    with open(file_path, 'rb') as f:
        image_data = f.read()


    part = upload.parts[0]
    requests.put(part.url, data=image_data).raise_for_status()


    # Step 3: Complete upload
    client.uploads.trigger_action(upload_id, action="complete")


    # Step 4: Wait for processing and get assetId
    while True:
        time.sleep(3)
        status_response = client.uploads.retrieve(upload_id)
        upload_status = status_response.upload


        if upload_status.status == "imported" and upload_status.entity_id:
            return upload_status.entity_id
        elif upload_status.status == "failed":
            raise Exception(f"Upload failed: {upload_status.error_message}")


# Usage
asset_id = upload_large_image('./large-image.png', 'key_...', 'secret_...')
print(f"Large image uploaded! Asset ID: {asset_id}")
```

### Example 3: Upload Audio for VEED Fabric

```
import os
import time
import requests
from scenario_sdk import Scenario


def upload_audio_file(file_path, api_key, api_secret):
    client = Scenario(api_key=api_key, api_secret=api_secret)


    file_size = os.path.getsize(file_path)
    file_name = os.path.basename(file_path)


    # Determine content type
    ext = file_name.split('.')[-1].lower()
    content_types = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'm4a': 'audio/m4a'
    }
    content_type = content_types.get(ext, 'audio/mpeg')


    # Step 1: Initialize upload
    init_response = client.uploads.create(
        file_name=file_name,
        content_type=content_type,
        kind="audio",
        parts=1,
        file_size=file_size,
    )
    upload = init_response.upload
    upload_id = upload.id


    # Step 2: Upload file part to presigned URL
    with open(file_path, 'rb') as f:
        audio_data = f.read()


    part = upload.parts[0]
    requests.put(part.url, data=audio_data).raise_for_status()


    # Step 3: Complete upload
    client.uploads.trigger_action(upload_id, action="complete")


    # Step 4: Wait for processing and get assetId
    while True:
        time.sleep(3)
        status_response = client.uploads.retrieve(upload_id)
        upload_status = status_response.upload


        if upload_status.status == "imported" and upload_status.entity_id:
            return upload_status.entity_id
        elif upload_status.status == "failed":
            raise Exception(f"Upload failed: {upload_status.error_message}")


# Usage
asset_id = upload_audio_file('./audio.mp3', 'key_...', 'secret_...')
print(f"Audio uploaded! Asset ID: {asset_id}")


# Use with VEED Fabric
client = Scenario(api_key="key_...", api_secret="secret_...")
response = client.generate.create(
    model_id="veed-fabric-1.0",
    parameters={
        "audioUrl": asset_id,
        # ... other parameters
    },
)
```

### Example 4: Generic File Upload Function (TypeScript)

```
import Scenario from '@scenario-labs/sdk';
import type { UploadCreateParams } from '@scenario-labs/sdk/resources/uploads';
import fs from 'fs';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


async function uploadFile(
  filePath: string,
  kind: UploadCreateParams['kind'],
  contentType: string,
): Promise<string> {
  const file = fs.readFileSync(filePath);
  const fileSize = fs.statSync(filePath).size;
  const fileName = filePath.split('/').pop()!;


  // Step 1: Initialize upload
  const { upload } = await client.uploads.create({
    fileName,
    contentType,
    kind,
    parts: 1,
    fileSize,
  });
  const uploadId = upload.id;


  // Step 2: Upload file part to presigned URL
  const part = upload.parts![0];
  await fetch(part.url, {
    method: 'PUT',
    body: file,
  });


  // Step 3: Complete upload
  await client.uploads.triggerAction(uploadId, { action: 'complete' });


  // Step 4: Wait for processing and get assetId
  let assetId: string | null = null;
  while (!assetId) {
    await new Promise((resolve) => setTimeout(resolve, 3000));


    const { upload: uploadStatus } = await client.uploads.retrieve(uploadId);


    if (uploadStatus.status === 'imported' && uploadStatus.entityId) {
      assetId = uploadStatus.entityId;
    } else if (uploadStatus.status === 'failed') {
      throw new Error(`Upload failed: ${uploadStatus.errorMessage}`);
    }
  }


  return assetId;
}


// Usage examples:
(async () => {
  // Upload large image (6MB+)
  const largeImageAssetId = await uploadFile('./large-image.png', 'image', 'image/png');
  console.log('Large image assetId:', largeImageAssetId);


  // Upload audio
  const audioAssetId = await uploadFile('./audio.mp3', 'audio', 'audio/mpeg');
  console.log('Audio assetId:', audioAssetId);


  // Upload video
  const videoAssetId = await uploadFile('./video.mp4', 'video', 'video/mp4');
  console.log('Video assetId:', videoAssetId);


  // Upload 3D model
  const modelAssetId = await uploadFile('./model.glb', '3d', 'model/gltf-binary');
  console.log('3D model assetId:', modelAssetId);
})();
```

---

## Common Issues and Solutions

Issue: “Either ‘image’ or ‘canvas’ must be provided”

**Problem:** You’re trying to upload audio, video, or 3D models to `/v1/assets`, which only accepts images. Or your image is too large (> 6MB).

**Solution:**

- For images 6MB or larger: Use `/v1/uploads` with `kind: "image"`
- For audio, video, or 3D models: Use `/v1/uploads` with the appropriate `kind` (`"audio"`, `"video"`, or `"3d"`)

Issue: “Unhandled image format”

**Problem:** You’re trying to upload a non-image file (audio, video, 3D model) as an image, or your image is too large.

**Solution:**

- For small images (< 6MB): Use `/v1/assets` with base64 encoded image
- For large images (≥ 6MB): Use `/v1/uploads` with `kind: "image"` and the correct `contentType`
- For other files: Use `/v1/uploads` with the correct `kind` and `contentType`

Issue: “Missing required mimeType parameter for asset kind audio/video/3d”

**Problem:** You’re trying to pass an external URL directly to a parameter that expects an `assetId`.

**Solution:** Upload the file first using `/v1/uploads` to get an `assetId`, then use that `assetId` in your API call.

Issue: Upload status stuck at “validating”

**Problem:** The file might be corrupted or in an unsupported format.

**Solution:**

- Verify the file is valid
- Check that the `contentType` matches the actual file format
- Ensure the file was uploaded completely (all parts uploaded successfully)

Issue: Presigned URL expired

**Problem:** You waited too long between getting the presigned URLs and uploading the file.

**Solution:** Upload the file parts immediately after receiving the presigned URLs. If needed, re-initialize the upload to get fresh URLs.

---

## Upload Status Values

For multipart uploads (`/v1/uploads`), the status progresses through these values:

- `pending` - Upload initialized, waiting for parts to be uploaded
- `validating` - All parts uploaded, file is being validated
- `validated` - File validated successfully, processing
- `imported` - Upload complete, `entityId` (assetId) is available
- `failed` - Upload failed, check `errorMessage` for details

---

## Summary

### For Small Images (< 6MB):

1. ✅ Use `POST /v1/assets` with base64 encoded image
2. ✅ Include `image` and `name` in the request body
3. ✅ Get `assetId` immediately from the response

### For Large Images (≥ 6MB), Audio, Video, and 3D Models:

1. ✅ Use `POST /v1/uploads` (not `/v1/assets`)
2. ✅ Set the correct `kind` (`"image"`, `"audio"`, `"video"`, or `"3d"`) and matching `contentType`
3. ✅ Upload file parts to presigned URLs
4. ✅ Complete the upload with `action: "complete"`
5. ✅ Poll until `status: "imported"` and retrieve `entityId` (this is your `assetId`)

**Key Points:**

- `/v1/assets` is for **small images only** (< 6MB) - simple, single-request upload
- `/v1/uploads` is for **large images** (≥ 6MB), **audio, video, and 3D models** - multipart upload process
- Both endpoints return an `assetId` that can be used in other API calls
- The `assetId` from either endpoint works the same way in subsequent API requests
- For images, choose the endpoint based on file size: use `/v1/assets` for small files, `/v1/uploads` for large files

---

## Additional Resources

- [Scenario API Documentation](//docs/index.md)
- [Multipart Upload Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
