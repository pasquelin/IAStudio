---
title: Downloading an Archive of Assets | Scenario Docs
---

The Scenario API allows you to efficiently download multiple assets (such as generated images or other files) as a single archive. This is particularly useful for batch processing or when you need to retrieve a large number of files. This guide will walk you through the process of generating and downloading an archive of assets, detailing the necessary steps, API endpoints, and parameters. We will also provide code examples to help you integrate asset archiving into your applications.

## 🚀 Key Concepts

- **Asset**: Any digital file generated or managed within the Scenario platform, such as an image, video, or 3D model.

- **Archive Generation**: The process of bundling multiple individual assets into a single compressed file (e.g., a ZIP file) for easier download and management.

- **Asynchronous Process**: Generating an archive is an asynchronous operation, meaning it runs in the background and may take some time to complete, especially for large collections of assets. You will need to poll the API to check the status of the archive generation job.

## ⚡️ Workflow for Downloading an Asset Archive

The general workflow for downloading an archive of assets involves the following steps:

1. **Launch Archive Generation**: Initiate the process of creating an archive by specifying the assets you want to include.
2. **Monitor Job Status**: Periodically check the status of the archive generation job until it is complete.
3. **Retrieve Archive URL**: Once the job is successful, obtain the URL from which you can download the generated archive.

Let’s explore each step in detail.

## 1. Launch Archive Generation

To begin, you need to launch the generation of an archive. This involves making a `POST` request to the `/v1/assets/archive` endpoint, providing a list of `assetIds` that you wish to include in the archive. You can also specify options for the archive, such as whether to flatten the directory structure or a template for file names within the archive.

**Endpoint:**

`POST https://api.cloud.scenario.com/v1/assets/archive`

**Request Body Parameters:**

| Parameter                  | Type             | Description                                                                                        | Required |
| -------------------------- | ---------------- | -------------------------------------------------------------------------------------------------- | -------- |
| `query`                    | object           | An object containing the criteria for selecting assets to archive.                                 | Yes      |
| `query.assetIds`           | array of strings | A list of asset IDs to include in the archive.                                                     | Yes      |
| `options`                  | object           | (Optional) An object containing options for the archive generation.                                | No       |
| `options.flat`             | boolean          | If `true`, the archive will have a flat directory structure (no subfolders).                       | No       |
| `options.fileNameTemplate` | string           | A template string for naming files within the archive (e.g., `<prompt>-<num>-<generator>-<seed>`). | No       |

**Example Request (TypeScript):**

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


const response = await client.assets.download.requestBatch({
  query: {
    assetIds: ['asset_V2anp75qTuKmmHOeInzQhg', 'asset_AnotherAssetId'], // Replace with your actual asset IDs
    inferenceIds: [],
    modelIds: [],
  },
  options: {
    flat: true,
    fileNameTemplate: '<assetId>', // Example: name files by their asset ID
  },
});


console.log(`Archive generation launched. Job ID: ${response.jobId}`);
// Proceed to poll job status using response.jobId
```

Upon successful initiation, the API will return a `jobId`. You will use this `jobId` to monitor the progress of your archive generation.

## 2. Monitor Job Status

Since archive generation is an asynchronous process, you need to poll the API to check the status of your job. You will make `GET` requests to the `/v1/jobs/{jobId}` endpoint until the job reaches a final status (e.g., `success`, `failure`, or `canceled`).

**Endpoint:**

`GET https://api.cloud.scenario.com/v1/jobs/{jobId}`

**Path Parameters:**

| Parameter | Type   | Description                           | Required |
| --------- | ------ | ------------------------------------- | -------- |
| `jobId`   | string | The ID of the archive generation job. | Yes      |

**Example Request (TypeScript):**

```
import Scenario from '@scenario-labs/sdk';


const client = new Scenario({
  apiKey: 'YOUR_API_KEY',
  apiSecret: 'YOUR_API_SECRET',
});


const JOB_FINAL_STATUS = ['success', 'failure', 'canceled'];


const sleep = (duration: number) => new Promise((resolve) => setTimeout(resolve, duration));


const pollJobStatus = async (jobId: string) => {
  let status: string | undefined;
  while (!status || !JOB_FINAL_STATUS.includes(status)) {
    try {
      const response = await client.jobs.retrieve(jobId);
      status = response.job.status;
      console.log(`Job ${jobId} status: ${status}`);


      if (status === 'success') {
        return response.job; // Return the full job object on success
      } else if (JOB_FINAL_STATUS.includes(status)) {
        throw new Error(`Job ${jobId} ended with status: ${status}`);
      }
      await sleep(3000); // Poll every 3 seconds
    } catch (err) {
      console.error('Error polling job status:', err);
      throw err;
    }
  }
};


// Example usage (assuming you have a jobId from the previous step)
// pollJobStatus("your_job_id").then(job => {
//   console.log("Job completed successfully:", job);
// }).catch(error => {
//   console.error("Job failed:", error);
// });
```

## 3. Get the Archive from the URL

Once the job status is `success`, the job object will contain a URL from which you can download the generated archive. This URL is typically found within the `metadata` field of the job response.

**Example of successful job response (relevant part):**

```
{
  "job": {
    "jobId": "job_archive_example",
    "status": "success",
    "metadata": {
      "archiveUrl": "https://scenario.com/downloads/your_archive.zip"
    }
    // ... other job details
  }
}
```

You can then use a standard HTTP GET request to download the file from the `archiveUrl`.

**Example Download (Node.js):**

```
const fetch = require("node-fetch");
const fs = require("fs");


const downloadArchive = async (archiveUrl, outputPath) => {
  try {
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error(`Failed to download archive: ${response.statusText}`);
    }
    const fileStream = fs.createWriteStream(outputPath);
    await new Promise((resolve, reject) => {
      response.body.pipe(fileStream);
      response.body.on("error", reject);
      fileStream.on("finish", resolve);
    });
    console.log(`Archive downloaded to ${outputPath}`);
  } catch (error) {
    console.error("Error downloading archive:", error);
  }
};


// Example usage (assuming you have the archiveUrl from the successful job response)
// const archiveUrl = "https://scenario.com/downloads/your_archive.zip"; // Replace with actual URL
// const outputPath = "./my_assets_archive.zip";
// downloadArchive(archiveUrl, outputPath);
```

## 📚 References

- \[Scenario API Reference: POST /v1/assets/download]\(<- [/api/postdownloadassets](/api/postdownloadassets/index.md)>)
- [Scenario API Reference: GET /v1/jobs/{jobId}](/api/getjobsbyjobid/index.md) (Note: This is a general job status endpoint, not specific to archive generation, but applicable)
