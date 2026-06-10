# Magic Link Submission System

A Next.js application that allows users to submit their details and confirm their email using a secure **magic link**.

Built with:
- Next.js (App Router)
- Prisma ORM
- PostgreSQL
- Mantine UI
- Zod validation
- Resend (email delivery)

---

## ✨ Features

- User submission form with validation
- Magic link email verification
- Secure token generation & hashing
- Token expiry and single-use enforcement
- Async (non-blocking) email sending
- PostgreSQL database with Prisma
- Clean UI with Mantine + notifications

---

## ⚙️ Setup Guide

### Prerequisites

- Node.js 18+
- PostgreSQL running locally or a remote PostgreSQL connection string

### Clone the repository

```bash
git clone <repository-url>
cd magic-link-generator
npm install
```

### Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/magic_link"
RESEND_API_KEY=your_resend_api_key
EMAIL_FROM=onboarding@yourdomain.com
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Prisma Setup

Generate Prisma Client and apply migrations:

```bash
npx prisma migrate dev
```

### Run the application

```bash
npm run dev
```
