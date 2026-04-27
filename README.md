## Food Delivery Service API

A production-ready REST API for a food delivery service built with Node.js, Express, and Prisma.

### Documentation
-   🌐 **[Developer Portal](https://googleknight.github.io/Food-delivery-Service/)**: The central hub for all documentation, featuring a comprehensive OpenAPI Reference, architectural decisions, and Postman setups.
-   **Swagger UI**: Once the server is running, the interactive API documentation is also available locally at `http://localhost:3000/api-docs`.
-   **Technical Specifications**: Detailed architecture and endpoint details can be found in `docs/tech-specs.md`.

### Testing with Postman

A Postman collection and environment are provided in the `postman/` directory:
1.  Import `postman/food-delivery-api.postman_collection.json` into Postman.
2.  Import `postman/food-delivery-api.postman_environment.json`.
3.  Select the **Food Delivery - Local** environment.
4.  The "Login" request contains a test script that automatically saves the `accessToken` and `refreshToken` to your environment for subsequent requests.

### Getting Started

The easiest way to get started is to use the provided developer script:

```bash
# Setup and run everything automatically
./dev.sh

# Or use specific commands
./dev.sh setup  # Just setup
./dev.sh run    # Just run
```

Alternatively, you can follow these manual steps:

1.  **Install dependencies**: `npm install`
2.  **Environment variables**: Copy `.env.example` to `.env.local` and update the values:
    ```bash
    cp .env.example .env.local
    ```
3.  **Start database**: `docker compose up -d`
4.  **Run migrations and seed**: `npm run db:reset`
5.  **Start dev server**: `npm run dev`

### Running Tests

The project includes a comprehensive integration test suite. A separate test database is configured in `docker-compose.yml` and loaded via `.env.test`.

1.  **Ensure test database is running**: `docker compose up -d db-test`
2.  **Run tests**: `npm test`
