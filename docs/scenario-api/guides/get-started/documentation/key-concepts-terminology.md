---
title: Key Concepts & Terminology | Scenario Docs
---

## API Key & Authentication

To interact with the Scenario API, you must first obtain an **API Key** and authenticate your requests. The API employs **Basic Authentication**, a standard HTTP authentication scheme. This means that every request you send to the Scenario API must include an `Authorization` header.

The `Authorization` header is constructed by encoding your API key and API secret, joined by a single colon (`:`), using Base64 encoding. For example, if your API key is `hello` and your API secret is `world`, you would encode `hello:world` to `aGVsbG86d29ybGQ=`. Your `Authorization` header would then look like this:

```
Authorization: Basic aGVsbG86d29ybGQ=
```

This method ensures that only authorized users can access the API and perform operations. It is crucial to keep your API key and secret confidential to prevent unauthorized access to your Scenario account and resources. For detailed instructions on how to obtain your API key, please refer to the [Get Your API Key documentation](/get-started/documentation/quick-start-guide/step-1-obtain-your-api-key/index.md).

## Rate Limits

To ensure fair usage and maintain the stability and performance of the API for all users, the Scenario API implements **Rate Limits**. These limits define the number of requests you can make to the API within a specific time frame (e.g., requests per minute or per hour). If you exceed these limits, your requests may be temporarily blocked, and you will receive an HTTP `429 Too Many Requests` status code.

It is important to design your applications to gracefully handle rate limits. This typically involves implementing retry mechanisms with exponential backoff, where your application waits for an increasing amount of time before retrying a failed request. Details on specific rate limits and best practices for handling them will be provided in the API documentation. Adhering to these limits is essential for building robust and reliable applications that interact with the Scenario API.
