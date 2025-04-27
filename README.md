# NestJS Google Drive File Uploader

## Overview

This project is a backend application built with NestJS that allows clients to submit an array of file URLs. The application downloads these files asynchronously and uploads them to a specified Google Drive folder. It provides a REST API to initiate uploads and retrieve a list of processed files with their corresponding Google Drive links and statuses.

The application is designed to handle potentially large files efficiently using streams and processes uploads in the background using Redis and Bull queues for reliability and responsiveness. The entire environment is containerized using Docker Compose for easy setup and consistent deployment.

## Features

* **Upload from URLs:** Accepts a list of URLs via a REST API endpoint.
* **Asynchronous Processing:** Downloads and uploads are handled in the background using Bull queues, preventing API request timeouts.
* **Google Drive Integration:** Uploads files directly to a specified Google Drive folder using a Service Account.
* **Large File Handling:** Uses Node.js streams to download and upload files, minimizing memory consumption.
* **Database Persistence:** Stores file metadata (original URL, Google Drive ID, link, status, errors) in a PostgreSQL database using TypeORM.
* **REST API:** Provides endpoints to initiate uploads (`POST /files/upload-from-urls`), list all files (`GET /files`), and retrieve specific file details (`GET /files/{id}`).
* **Dockerized Environment:** Uses Docker and Docker Compose for easy setup, development, and deployment (includes NestJS app, PostgreSQL DB, and Redis).
* **Unit Tests:** Includes unit tests written with Jest and `@nestjs/testing`.
* **API Documentation:** API endpoints are documented using OpenAPI (Swagger) accessible at `apiDefinition.yaml`.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

* **Docker Engine:** [Install Docker](https://docs.docker.com/engine/install/)
* **Docker Compose:** [Install Docker Compose](https://docs.docker.com/compose/install/) (Often included with Docker Desktop)

## Environment Setup

Follow these steps carefully to configure the necessary environment variables and Google Cloud credentials.

### 1. Google Cloud & Drive Setup

You need a Google Cloud Service Account key and a target Google Drive folder.

1.  **Create/Select Google Cloud Project:** Go to the [Google Cloud Console](https://console.cloud.google.com/) and create a new project or select an existing one.
2.  **Enable Google Drive API:** In your project, navigate to "APIs & Services" > "Library", search for "Google Drive API", and enable it.
3.  **Create Service Account:**
    * Navigate to "IAM & Admin" > "Service Accounts".
    * Click "+ CREATE SERVICE ACCOUNT".
    * Give it a name (e.g., `drive-uploader-service-account`) and an optional description. Click "CREATE AND CONTINUE".
    * You can skip granting project-level roles (Step 2). Click "CONTINUE".
    * Skip granting user access (Step 3). Click "DONE".
    * Find the newly created service account in the list, click on its email address.
    * Go to the "KEYS" tab.
    * Click "ADD KEY" > "Create new key".
    * Select "JSON" as the key type and click "CREATE". A JSON key file will be downloaded. **Keep this file secure!**
4.  **Create Google Drive Folder:** Create a new folder in your Google Drive where the files will be uploaded. Note down the **Folder ID** from the URL (the part after `folders/`).
5.  **Share Drive Folder:** Share the Google Drive folder you created with the **`client_email`** address found inside the downloaded JSON key file. Grant "Editor" permissions.

### 2. `.env` Configuration

1.  **Create `.env` file:** Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
2.  **Place Service Account Key:**
    * Create a directory named `secrets` in the project root.
    * Place the downloaded Service Account JSON key file inside the `secrets` directory (e.g., rename it to `service-account-key.json`).
3.  **Edit `.env` file:** Open the `.env` file and fill in the values based on your setup:

    ```dotenv
    # .env

    
    ... left the rest of variables as is
     
    
    GOOGLE_DRIVE_FOLDER_ID=YOUR_GOOGLE_DRIVE_FOLDER_ID # <-- PASTE YOUR FOLDER ID HERE
    ```

## Running the Application

Once the `.env` file is configured and the service account key is in place:

1.  **Build and Start Containers:** Open your terminal in the project root directory and run:
    ```bash
    npm compose
    ```
    or
    ```bash
    docker-compose up --build -d
    ```
    * `--build`: Forces Docker to rebuild the application image if code changes were made.
    * `-d`: Runs the containers in detached mode (in the background).

2.  **Accessing the API:** The API should now be running. The default base URL is `http://localhost:3000`.

## API Documentation & Usage

The API allows initiating uploads and checking file statuses.

**Base URL:** `http://localhost:3000`

### Initiate Uploads

* **Endpoint:** `POST /files/upload-from-urls`
* **Description:** Submits a list of URLs for processing. Returns `202 Accepted` immediately.
* **Request Body:** `application/json`
    ```json
    {
      "urls": [
        "[https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf](https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf)",
        "[https://link.storjshare.io/raw/jxn55kfxo5g5nngluhauxzpgsmfa/images%2Fimg_test%2Fwallhaven-g8z9j7_1920x1080.png](https://link.storjshare.io/raw/jxn55kfxo5g5nngluhauxzpgsmfa/images%2Fimg_test%2Fwallhaven-g8z9j7_1920x1080.png)"
      ]
    }
    ```
* **Example `curl`:**
    ```bash
    curl -X POST http://localhost:3000/files/upload-from-urls \
    -H "Content-Type: application/json" \
    -d '{
      "urls": [
        "[https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf](https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf)",
        "[https://link.storjshare.io/raw/jxn55kfxo5g5nngluhauxzpgsmfa/images%2Fimg_test%2Fwallhaven-g8z9j7_1920x1080.png](https://link.storjshare.io/raw/jxn55kfxo5g5nngluhauxzpgsmfa/images%2Fimg_test%2Fwallhaven-g8z9j7_1920x1080.png)"
      ]
    }'
    ```
* **Success Response (`202 Accepted`):**
    ```json
    {
      "message": "File processing initiated for the provided URLs.",
      "jobs": [
        { "jobId": "1", "originalUrl": "https://.../dummy.pdf" },
        { "jobId": "2", "originalUrl": "https://.../wallhaven-g8z9j7_1920x1080.png" }
      ]
    }
    ```

### List All Files

* **Endpoint:** `GET /files`
* **Description:** Retrieves a list of all file records and their current status.
* **Example `curl`:**
    ```bash
    curl http://localhost:3000/files
    ```
* **Success Response (`200 OK`):** An array of File objects (see Swagger or code for schema).

### Get File by ID

* **Endpoint:** `GET /files/{id}`
* **Description:** Retrieves details for a specific file record by its UUID.
* **Example `curl` (replace `{id}` with an actual UUID):**
    ```bash
    curl http://localhost:3000/files/f47ac10b-58cc-4372-a567-0e02b2c3d479
    ```
* **Success Response (`200 OK`):** A single File object.
* **Error Responses:** `400 Bad Request` (invalid UUID), `404 Not Found`.

## Running Tests

Unit tests are included using Jest.

1.  **Run tests:**
    ```bash
    npm run test
    npm run test:watch
    npm run test:cov
    ```
