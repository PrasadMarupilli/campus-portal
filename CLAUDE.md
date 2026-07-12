# Campus Portal

Serverless AWS campus portal (Cognito + DynamoDB + Lambda + API Gateway + CloudFront) with a GitHub Actions CI/CD pipeline. See `README.md` for full architecture, API reference, and setup steps.

## Current live state (update this section as things change)

- GitHub repo: `PrasadMarupilli/campus-portal` (public), pushes to `main` auto-deploy via GitHub Actions.
- AWS account: `911480091729`, region `ap-south-2`.
- `AuthStack`, `DataStack`, `ApiStack` are deployed and working. `WebStack` (S3 + CloudFront) is **blocked**: AWS returns "Access denied ... Your account must be verified before you can add new CloudFront resources" — a routine new-account restriction, not a code bug. An AWS Support case was filed; check whether it's resolved before re-diagnosing this from scratch (retry with `cd infra && npx cdk deploy CampusPortalWebStack --require-approval never`).
- Until `WebStack` deploys, the only way to use the app is `cd frontend && npm run dev` (http://localhost:5173) against the live deployed API — `frontend/.env` is already populated locally (gitignored) with the real API URL / Cognito IDs.
- Demo/admin credentials and the exact onboarding flow are documented in `README.md` ("Seeding demo data" / "Onboarding a new student").

## Conventions established in this project

- CDK stacks (`infra/lib/*.ts`) are wired via constructor props in `bin/campus-portal.ts`, not cross-stack `Fn::ImportValue` lookups where avoidable.
- Every Lambda gets least-privilege IAM grants scoped to only what it needs (see `api-stack.ts`) — don't add blanket permissions.
- `courseId`/`enrollmentId` use short human-readable generated codes (`backend/src/shared/ids.ts`), not UUIDs — students/documents/announcements still use UUIDs.
- Adding a student must go through `POST /students` (creates the Cognito account + DB record together with matching `custom:studentId`) — never create a student DB row without a matching Cognito account, and vice versa, or the student's own pages (attendance/enrollments/documents) won't resolve their identity.
