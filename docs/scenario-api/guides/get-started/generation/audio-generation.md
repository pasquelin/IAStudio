---
title: Audio Generation | Scenario Docs
---

The Scenario API extends its capabilities beyond visual content to include dynamic audio generation. This advanced functionality often involves longer processing times and utilizes a flexible “custom” endpoint, requiring a job polling mechanism to retrieve the final results. This guide will explain how to initiate audio generation, monitor its progress, and retrieve the completed assets.

## The Custom Endpoint

For specialized generation tasks like audio, the Scenario API provides a versatile custom endpoint. This endpoint allows you to interact with specific models tailored for these complex outputs.

`POST https://api.cloud.scenario.com/v1/generate/custom/{modelId}` - [API Reference](/api/postgeneratecustom#/index.md)

Where `{modelId}` is the identifier for the specific audio generation model you wish to use (e.g., `model_elevenlabs-tts-v3` for the ElevenLabs v3 audio model). Available model IDs are here: [Audio Models - Parameters Reference](/get-started/audio-models-parameters-reference#/index.md)

## Request Body for Custom Generation

The payload for the custom endpoint will vary depending on the `modelId` and the type of generation (audio). However, common parameters often include:

| Parameter          | Type         | Description                                                                 |
| ------------------ | ------------ | --------------------------------------------------------------------------- |
| `lyrics`           | string       | A textual description or lyrics to guide the audio generation.              |
| `songFile`         | file (audio) | An audio file to be used as a reference for the generated song.             |
| `voiceFile`        | file (audio) | An audio file to be used as a voice reference for vocal generation.         |
| `instrumentalFile` | file (audio) | An audio file to be used as an instrumental reference for track generation. |
| `sampleRate`       | number       | The sample rate for the generated audio.                                    |
| `bitrate`          | number       | The bitrate for the generated audio.                                        |

To find the correct list of parameters for a specific model, you can refer to the [Audio Models - Parameters Reference](audio_models_parameters_reference.md) or consult the API documentation.

## Job Polling: Retrieving Asynchronous Results

Unlike instant image generation, audio generation is an asynchronous process. This means that when you make a request to the custom endpoint, you will receive a `jobId` immediately, but the actual generation will happen in the background. You then need to periodically poll a separate endpoint to check the status and retrieve the final asset.

`GET https://api.cloud.scenario.com/v1/jobs/{jobId}` - [API Reference](/api/index.md)

The response from the polling endpoint will contain the current status of your job. You should continue polling until the `status` field indicates `success` or `failed`.

```
{
  "job": {
    "jobId": "job_abc123def456",
    "status": "processing", // Can be "queued", "processing", "success", "failed", "canceled"
    "progress": 0.5, // Optional: progress percentage
    "metadata": {
      "assetIds": []
    }
  },
  "creativeUnitsCost": 5
}
```

Once the `status` is `success`, the `metadata.assetIds` field will contain the IDs to your generated audio assets.

## Code Examples: Audio Generation with Minimax Music 01

This example demonstrates initiating an audio generation and then polling for the result using the `minimax/music-01` model.

### TypeScript

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


async function generateAudio() {
  const customAudioModelId = 'minimax/music-01';


  console.log('Initiating audio generation...');


  // Step 1: Initiate Audio Generation
  const response = await client.generate.runModel(customAudioModelId, {
    body: {
      lyrics:
        '## (Verse 1) ##\nHello, world!\nThis is my first song.\n## (Chorus) ##\nSinging loud and clear,\nFor everyone to hear.',
      sampleRate: 44100,
      bitrate: 256000,
    },
  });


  const jobId = response.job.jobId;
  console.log(`Audio generation job initiated. Job ID: ${jobId}`);


  // Step 2: Wait for completion using the built-in .wait() helper
  const completed = await response.job.wait();


  if (completed.status === 'success') {
    const assetIds = completed.metadata?.assetIds || [];
    console.log('Audio generation completed! Asset IDs:', assetIds);
  } else {
    console.error(`Audio generation ended with status: ${completed.status}`);
  }
}


generateAudio();
```

### Python

```
from scenario_sdk import Scenario
import time


client = Scenario(
    api_key="YOUR_API_KEY",
    api_secret="YOUR_API_SECRET",
)


# Step 1: Initiate Audio Generation
custom_audio_model_id = "minimax/music-01"


print("Initiating audio generation...")
response = client.generate.run_model(
    custom_audio_model_id,
    body={
        "lyrics": "## (Verse 1) ##\nHello, world!\nThis is my first song.\n## (Chorus) ##\nSinging loud and clear,\nFor everyone to hear.",
        "sampleRate": 44100,
        "bitrate": 256000,
    },
)


job_id = response.job.job_id
print(f"Audio generation job initiated. Job ID: {job_id}")


# Step 2: Poll for Job Status (or use response.job.wait() for a simpler approach)
status = "queued"
while status not in ["success", "failure", "canceled"]:
    print(f"Polling job {job_id}... Current status: {status}")
    time.sleep(3)


    poll = client.jobs.retrieve(job_id)
    status = poll.job.status
    progress = (poll.job.progress or 0) * 100
    print(f"Progress: {progress:.2f}%")


    if status == "success":
        asset_ids = poll.job.metadata.get("assetIds", [])
        print(f"Audio generation completed! Asset IDs: {asset_ids}")
    elif status in ["failure", "canceled"]:
        print(f"Audio generation failed or canceled: {poll.job.error}")
```

### cURL

Terminal window

```
curl -X POST \
  -u "YOUR_API_KEY:YOUR_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "lyrics": "## (Verse 1) ##\nHello, world!\nThis is my first song.\n## (Chorus) ##\nSinging loud and clear,\nFor everyone to hear.",
    "sampleRate": 44100,
    "bitrate": 256000
  }' \
  https://api.cloud.scenario.com/v1/generate/custom/minimax/music-01?projectId=yourprojectid
```
