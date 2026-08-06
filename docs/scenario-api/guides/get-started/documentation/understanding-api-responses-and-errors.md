---
title: Understanding API Responses and Errors | Scenario Docs
---

Building robust applications with any API requires a clear understanding of how to interpret its responses, both successful and erroneous. The Scenario API provides structured responses that allow you to effectively process generated content and gracefully handle any issues that may arise. This article will guide you through the typical structure of successful API responses and provide strategies for identifying and managing common errors.

## Successful API Responses

When an API request to the Scenario platform is successful, you will typically receive an HTTP `200 OK` status code, accompanied by a JSON payload containing the requested data. For image generation requests, this payload will include information about the generated images, such as their URLs.

### Example: Successful Image Generation Response

After a successful text-to-image generation request, the API might return a JSON response similar to this:

```
{
    "job": {
        "jobId": "job_aZ67MsuuyQ5JawJekta3V7yD",
        "jobType": "flux",
        "metadata": {
            "input": {
                "modelId": "flux.1-dev",
                "intermediateImages": false,
                "guidance": 3.5,
                "numInferenceSteps": 28,
                "numSamples": 1,
                "width": 1024,
                "hideResults": false,
                "type": "txt2img",
                "baseModelId": "",
                "prompt": "A 3D low-poly wizard character designed for a mobile fantasy strategy game. The wizard wears a long, flowing blue cloak decorated with silver stars and a tall pointed hat. He carries a wooden staff topped with a glowing purple crystal orb. The model should use simplified shapes and textures, highlighting the mystical elements with glowing effects around the staff and cloak. Include casting and idle animation cycles, focusing on smooth, exaggerated movements. The overall style is colorful and playful, optimized for mobile performance, fitting seamlessly into a whimsical fantasy game world.",
                "negativePrompt": "",
                "height": 1024
            },
            "assetIds": [
                "asset_3ozWujykU62eMC4FHcjzf1eT"
            ]
        },
        "ownerId": "aLKe8J0IS7Oj3o0llJsoyw",
        "authorId": "6de208bb174452c39aa54cbec8595ccd",
        "createdAt": "2025-06-20T15:30:05.356Z",
        "updatedAt": "2025-06-20T15:30:11.734Z",
        "status": "success",
        "statusHistory": [
            {
                "status": "queued",
                "date": "2025-06-20T15:30:05.356Z"
            },
            {
                "status": "in-progress",
                "date": "2025-06-20T15:30:05.539Z"
            },
            {
                "status": "success",
                "date": "2025-06-20T15:30:11.734Z"
            }
        ],
        "progress": 1
    }
}
```

**Key fields in a successful response often include:**

- `status`: Indicates the overall success or failure of the request (e.g., `"success"`).

- `metadata`: The primary payload of the response, containing the actual results.

  - `assetIds`: An array of objects, each representing id of the generated image.
  - `input` : your input parameters

- `progress`: The progress evolution of your generation, from 0 to 1.

## Error Handling

Errors are an inevitable part of API interaction. Properly handling them is vital for creating resilient applications that provide a good user experience. The Scenario API uses standard HTTP status codes to indicate the nature of an error, often accompanied by a JSON payload providing more specific details about what went wrong.

Common HTTP Status Codes and Their Meanings

| HTTP Status Code            | Meaning              | Description                                                                                             | Common Causes                                                                                         | How to Handle                                                                                                                                               |
| --------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `200 OK`                    | Success              | The request was successful.                                                                             | N/A                                                                                                   | Process the response data.                                                                                                                                  |
| `400 Bad Request`           | Client Error         | The server cannot process the request due to invalid syntax or malformed request parameters.            | Missing required parameters, invalid parameter values, incorrect JSON format.                         | Check your request payload, ensure all required fields are present and correctly formatted. Refer to API documentation for parameter specifications.        |
| `401 Unauthorized`          | Authentication Error | The request lacks valid authentication credentials.                                                     | Missing `Authorization` header, invalid API Key or Secret, expired credentials.                       | Ensure your API Key and Secret are correct and properly Base64 encoded in the `Authorization` header. Refresh credentials if necessary.                     |
| `403 Forbidden`             | Authorization Error  | The authenticated user does not have permission to access the requested resource or perform the action. | Insufficient permissions for the API Key used, attempting to access a resource not owned by the user. | Verify the permissions associated with your API Key. Ensure you are authorized for the specific operation.                                                  |
| `404 Not Found`             | Resource Not Found   | The requested resource (e.g., a specific model ID, an image ID) does not exist.                         | Incorrect model ID, attempting to access a non-existent endpoint, typos in URLs.                      | Double-check the IDs and URLs in your request. Ensure the resource you are trying to access actually exists.                                                |
| `429 Too Many Requests`     | Rate Limit Exceeded  | The user has sent too many requests in a given amount of time.                                          | Rapid-fire requests without proper rate limiting logic.                                               | Implement exponential backoff and retry mechanisms. Wait for a period before retrying.                                                                      |
| `500 Internal Server Error` | Server Error         | A generic error message, indicating an unexpected condition encountered by the server.                  | Bugs on the API server, temporary server issues.                                                      | This is a server-side issue. Implement retry logic. If the issue persists, contact Scenario API support with details of your request and the error message. |

Example: Error Response Structure

An error response will typically have a structure similar to this:

```
{
  "status": "error",
  "code": "INVALID_PARAMETER",
  "message": "The 'prompt' parameter is missing or empty."
}
```

**Key fields in an error response often include:**

- `status`: Indicates an error (e.g., `"error"`).
- `code`: A specific error code that programmatically identifies the type of error (e.g., `"INVALID_PARAMETER"`, `"AUTHENTICATION_FAILED"`).
- `message`: A human-readable description of the error, providing details on what went wrong.

Strategies for Handling Errors in Your Code

1. **Check HTTP Status Codes:** Always check the HTTP status code of the API response first. This gives you a quick indication of whether the request was successful or if an error occurred.

2. **Parse Error Messages:** If the status code indicates an error (e.g., 4xx or 5xx), parse the JSON response to extract the `code` and `message` fields. These provide valuable information for debugging and informing your users.

3. **Implement Retry Logic (for transient errors):** For errors like `429 Too Many Requests` or `500 Internal Server Error`, implement retry mechanisms with exponential backoff. This means waiting for progressively longer periods between retries to avoid overwhelming the API.

   - **Exponential Backoff Example (Pseudocode):**

     ```
     max_retries = 5
     base_delay = 1 # seconds


     for attempt in range(max_retries):
         response = make_api_request()
         if response.status_code == 200:
             break # Success
         elif response.status_code in [429, 500]:
             delay = base_delay * (2 ** attempt) # Exponential increase
             time.sleep(delay)
         else:
             handle_permanent_error(response.status_code, response.json())
             break
     else:
         # All retries failed
         notify_user_of_persistent_error()
     ```

4. **Provide User Feedback:** When an error occurs, provide clear and informative feedback to your application users. Avoid generic error messages. Instead, use the API’s error `message` to explain what happened and, if possible, suggest a solution.

5. **Logging:** Log API requests and responses, especially errors, to help with debugging and monitoring your application’s interaction with the Scenario API.

By diligently implementing these error handling strategies, you can build more resilient and user-friendly applications that seamlessly integrate with the Scenario API.
