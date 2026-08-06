---
title: Core Terminology | Scenario Docs
---

### Model

In the context of the Scenario API, a **Model** refers to a custom-trained Artificial Intelligence (AI) model specifically designed for image generation. Unlike general-purpose AI models, Scenario models are fine-tuned using your own unique datasets. This process allows the AI to learn and replicate specific visual styles, characteristics, or objects that are central to your creative vision or project requirements. For instance, you can train a model on a collection of your own character designs, architectural blueprints, or product photographs. Once trained, this model can then generate new images that adhere to the learned aesthetic, ensuring consistency and relevance to your specific needs.

To create a model, you typically upload a set of training images and specify various parameters that guide the training process. The Scenario cloud platform handles the computationally intensive training, abstracting away the complexities of deep learning infrastructure. The output is a highly specialized AI model capable of generating images that align with your desired output. This capability is particularly valuable for maintaining brand consistency, developing unique artistic assets, or generating variations of proprietary content.

### Job

A **Job** contains a request and its result generating content (images, videos, or 3D models). When you make a request, you specify various parameters that dictate the characteristics of the generated content. These parameters can include textual prompts (for text-to-image, text-to-video, or text-to-3D generation), reference images (for image-to-image generation), the number of items to generate, guidance scales, and other technical specifications that influence the creative output.

Each request can generate multiple items in a single batch, making it an efficient way to produce a large volume of visual assets. The API processes these requests and return a job containing progress then results.

### Image, Video, and 3D

An **Image**, **Video**, or **3D** model in the context of the Scenario API refers to the visual output generated as a result of a job request. These are the tangible creative assets produced by the AI models. They can be similar in nature to the content generated through the Scenario web application, but with the added benefit of programmatic control and automation. The API supports various formats and allows for different types of content generation, including:

- **Text-to-Image (txt2img):** Generating images solely from textual prompts.
- **Image-to-Image (img2img):** Transforming an existing image based on a prompt or other parameters.
- **Text-to-Video:** Generating short video clips from textual prompts.
- **Image-to-Video:** Generating short video clips with a start and/or end image.
- **Image-to-3D:** Generating 3D models from textual prompts.
- **ControlNet Modalities:** Utilizing advanced control mechanisms to guide the content generation process with greater precision, often involving an input image to control aspects like pose, depth, or edges.

The generated content is typically returned in a format that is easy to integrate into other applications, such as URLs to hosted files or direct file data. The quality, style, and content of these items are directly influenced by the model used and the parameters provided during the job request.
