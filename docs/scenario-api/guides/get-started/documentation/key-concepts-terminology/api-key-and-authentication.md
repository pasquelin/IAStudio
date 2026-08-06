---
title: API Key and Authentication | Scenario Docs
---

To interact with the Scenario API, you must first obtain an **API Key** and authenticate your requests. The API employs **Basic Authentication**, a standard HTTP authentication scheme. This means that every request you send to the Scenario API must include an `Authorization` header.

The `Authorization` header is constructed by encoding your API key and API secret, joined by a single colon (`:`), using Base64 encoding. For example, if your API key is `hello` and your API secret is `world`, you would encode `hello:world` to `aGVsbG86d29ybGQ=`. Your `Authorization` header would then look like this:

```
Authorization: Basic aGVsbG86d29ybGQ=
```

This method ensures that only authorized users can access the API and perform operations. It is crucial to keep your API key and secret confidential to prevent unauthorized access to your Scenario account and resources. For detailed instructions on how to obtain your API key, please refer to the [Get Your API Key documentation](/get-started/documentation/quick-start-guide/step-1-obtain-your-api-key/index.md).
