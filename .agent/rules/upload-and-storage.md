---
trigger: always_on
---

# Upload and Storage Rules

## Purpose

These rules govern file uploads and stored user/business assets if and when the MVP requires them.

Do not build a general file-management system unless required by the product.

## Upload Validation

Never trust client-provided file metadata.

Validate:

- File size
- File type
- File extension where applicable
- MIME type where applicable
- Ownership/business association

Do not rely on the filename alone to determine file type.

## Authorization

Every uploaded file must belong to an authorized business/user context.

A user must never be able to retrieve another business's private files by changing an ID or URL.

## Storage

- Do not store sensitive files in publicly accessible storage unless explicitly required.
- Prefer private storage for business/user data.
- Use controlled access when serving private files.
- Do not expose storage credentials to the mobile app.

## File Names

Do not use raw user-provided filenames as trusted storage identifiers.

Generate safe storage keys.

Prevent path traversal and unsafe path manipulation.

## File Size

Enforce server-side size limits.

Do not allow unlimited uploads.

Reject oversized files before expensive processing where possible.

## Processing

Do not process uploaded content as trusted code.

Treat uploaded files as untrusted input.

If files are processed by AI or another service:

- Validate the file first.
- Enforce size/type limits.
- Prevent unauthorized access.
- Do not allow the processing result to bypass normal authorization.

## Deletion

Do not delete files belonging to historical records unless the product explicitly requires deletion.

When deleting an associated record, follow the defined retention policy.

## Secrets

Never expose storage credentials, private bucket credentials, or signed-token secrets to clients.

## Logging

Do not log sensitive file contents.

Avoid logging private file URLs when unnecessary.

## MVP Scope

Do not introduce uploads merely because a storage system exists.

Implement only upload/storage flows required by the approved product scope.