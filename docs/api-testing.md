---
id: api-testing
title: API Testing & Postman
sidebar_position: 4
---
# API Testing with Postman

We provide a comprehensive Postman collection to help you test and integrate with the Food Delivery Service API quickly.

The collection includes pre-configured requests for all endpoints, complete with example payloads and authentication scripts.

## Download Assets

- [📥 Download Postman Collection](/postman/food-delivery-api.postman_collection.json)
- [📥 Download Postman Environment](/postman/food-delivery-api.postman_environment.json)

## How to Use

1. Download both files using the links above.
2. Open Postman.
3. Click **Import** in the top left corner.
4. Select both the collection and environment files.
5. Make sure to select the **Food Delivery API Env** in the environment dropdown in the top right corner of Postman.
6. Run the `POST /auth/login` request. The pre-request and test scripts will automatically capture your `accessToken` and apply it to all subsequent requests.
