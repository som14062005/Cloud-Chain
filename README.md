# ConsentChain

ConsentChain is a smart, consent-based cloud file access manager that acts as a secure middleware between users and cloud storage platforms. It enables privacy-first, transparent, and auditable file sharing by allowing users to manage access through explicit, time-bound, and revocable consent.

## Minimum Viable Product (MVP)

Unlike standard cloud storage services such as Google Drive, which rely on static permissions and lack access visibility, ConsentChain introduces dynamic, fine-grained control over file access. It empowers data owners with:

- Automatic expiry of shared access based on configured time limits
- Real-time access analytics and file usage insights
- A complete audit and download logs of files
- Secure and authenticated access using OAuth 2.0 and JWT

This makes ConsentChain suitable for sensitive contexts where accountability, consent tracking, and secure sharing are essential.

## Features

- OAuth 2.0 Authentication with Google
- Consent-based access control for files
- Cloud file upload and management
- File download and audit logging
- Consent expiry and automatic revocation
- JWT-secured routes and user sessions
- Dashboard with file access analytics
- PostgreSQL database integration using Prisma

## Tech Stack

**Frontend**
- React (Vite)
- TypeScript
- Tailwind CSS

**Backend**
- Node.js with Express
- Google OAuth 2.0
- JSON Web Tokens (JWT)
- PostgreSQL with Prisma 
