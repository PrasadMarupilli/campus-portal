# Campus Portal — Serverless AWS Reference Architecture

A prototype/demo enterprise campus portal built on serverless AWS, with a GitHub Actions CI/CD pipeline for deployment.

**Features:** student records & enrollment, attendance tracking, announcements, document management (uploads/downloads via presigned S3 URLs). **Auth:** AWS Cognito with `Students` and `Admins` groups.

## Architecture

- **IaC:** AWS CDK (TypeScript), 5 stacks in `infra/`:
  - `AuthStack` — Cognito User Pool, `Students`/`Admins` groups, app client
  - `DataStack` — 6 DynamoDB tables (Students, Courses, Enrollments, Attendance, Announcements, Documents metadata) + a private S3 bucket for document files
  - `ApiStack` — API Gateway HTTP API with a Cognito JWT authorizer, one Lambda per domain
  - `WebStack` — S3 + CloudFront hosting for the frontend SPA
  - `CicdStack` — GitHub OIDC identity provider + deploy role (deployed once, manually — see below)
- **Backend:** `backend/` — Node.js + TypeScript Lambda handlers, one per domain, using AWS SDK v3
- **Frontend:** `frontend/` — React + TypeScript + Vite SPA using AWS Amplify Auth for Cognito login

See [`infra/lib`](infra/lib) for stack definitions and [`backend/src`](backend/src) for the Lambda handlers and shared auth/data-access helpers.

## Prerequisites

- Node.js 20+ and npm
- An AWS account, with the [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) installed and configured (`aws configure` or SSO login) — **this repo cannot deploy anything without your own AWS credentials**
- A GitHub repository this project is pushed to (for the CI/CD pipeline)

## One-time manual setup

These steps use your own local AWS credentials and only need to be run once, before the CI/CD pipeline can deploy anything.

```bash
# 1. Install dependencies
cd infra && npm install

# 2. Bootstrap CDK in your AWS account/region (one-time per account/region)
npx cdk bootstrap

# 3. Deploy the CI/CD stack, telling it which GitHub repo will drive deploys
npx cdk deploy CampusPortalCicdStack -c githubOwner=<your-github-username> -c githubRepo=<your-repo-name>
```

This prints a `DeployRoleArn` output. In your GitHub repository settings → **Settings → Secrets and variables → Actions → Variables**, add:

| Name | Value |
|---|---|
| `AWS_DEPLOY_ROLE_ARN` | the `DeployRoleArn` output from above |
| `AWS_REGION` | the AWS region you bootstrapped/deployed to (e.g. `us-east-1`) |

No AWS access keys are ever stored in GitHub — the pipeline authenticates via GitHub's OIDC token exchanged for this IAM role.

## Ongoing flow

Once the above is done:

- **Pull requests / any push:** GitHub Actions runs the `validate` job — installs dependencies, type-checks `backend/` and `frontend/`, and runs `cdk synth` to catch infrastructure errors, with no AWS calls.
- **Push to `main`:** GitHub Actions also runs the `deploy` job — deploys `AuthStack`, `DataStack`, `ApiStack`, generates `frontend/.env` from the live stack outputs, builds the frontend, and deploys `WebStack` (uploads the build to S3 and invalidates CloudFront).

See [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml).

## Seeding demo data

Not run by the pipeline — this is a one-off, run locally with your own AWS credentials after the first deploy:

```bash
cd infra
npx cdk deploy CampusPortalAuthStack CampusPortalDataStack CampusPortalApiStack --outputs-file outputs.json  # if not already deployed via CI
npx tsx scripts/seed.ts
```

This creates one admin (`admin@campus.edu`) and two student accounts (`alice@campus.edu`, `bob@campus.edu`), all with password `CampusDemo1`, plus sample courses, enrollments, and an announcement.

## Onboarding a new student

Students authenticate via Cognito, and there's no public sign-up (only admins create accounts). **Admins can add students directly from the Students page in the app** — fill in email/name/program/year, submit, and the `POST /students` Lambda creates the Cognito account (with `custom:studentId` set to match the new database record from the start), adds them to the `Students` group, sets an initial password, and shows it once so you can share it with the student.

For scripted/bulk onboarding instead, `infra/scripts/add-student.ts` does the same thing from the CLI:

```bash
cd infra
npx tsx scripts/add-student.ts --email=jane@campus.edu --firstName=Jane --lastName=Doe --program="Computer Science" --year=1
```

Omit `--password` to use the default demo password (`CampusDemo1`), or pass your own with `--password=...`.

## Local development

```bash
# Backend/infra type-check
cd backend && npm install && npm run build
cd ../infra && npm install && npx cdk synth --all

# Frontend — point at a deployed API/User Pool via frontend/.env (see .env.example),
# then:
cd frontend && npm install && npm run dev
```

## API reference

All routes require a valid Cognito JWT (`Authorization: Bearer <idToken>`). `[A]` = admin-only, `[S]` = student (own record only unless noted).

| Domain | Route | Access |
|---|---|---|
| Students | `GET /students` | [A] |
| | `GET /students/me` | [S] |
| | `GET /students/{studentId}` | [S: own] / [A] |
| | `POST /students`, `PUT /students/{id}`, `DELETE /students/{id}` | [A] |
| Courses | `GET /courses`, `GET /courses/{id}` | [S+A] |
| | `POST /courses`, `PUT /courses/{id}`, `DELETE /courses/{id}` | [A] |
| Enrollments | `GET /enrollments/student/{studentId}` | [S: own] / [A] |
| | `GET /enrollments/course/{courseId}`, `POST /enrollments`, `DELETE /enrollments/{studentId}/{courseId}` | [A] |
| Attendance | `GET /attendance/student/{studentId}/course/{courseId}` | [S: own] / [A] |
| | `GET /attendance/course/{courseId}?date=`, `POST /attendance`, `PUT /attendance/{studentId}/{courseId}/{date}` | [A] |
| Announcements | `GET /announcements` (filtered by caller's audience) | [S+A] |
| | `POST /announcements`, `PUT /announcements/{id}`, `DELETE /announcements/{id}` | [A] |
| Documents | `GET /documents` (own for students, all/filterable for admins) | [S+A] |
| | `POST /documents/upload-url`, `GET /documents/{id}/download-url`, `DELETE /documents/{id}` | [S: own] / [A] |

Example, after signing in and grabbing an ID token:

```bash
curl -H "Authorization: Bearer $ID_TOKEN" "$API_URL/students/me"
curl -H "Authorization: Bearer $ID_TOKEN" "$API_URL/announcements"
```

## Manual walkthrough once deployed

1. Open the `SiteUrl` CloudFront output → sign in as `admin@campus.edu` / `CampusDemo1`.
2. As admin: create a course, view students, enroll a student in a course, mark attendance for that course/date, post an announcement, upload a document on a student's behalf.
3. Sign out, sign in as `alice@campus.edu` / `CampusDemo1`.
4. As a student: view your dashboard, your enrollments, your attendance, announcements, and upload/download your own documents.

## Known prototype trade-offs

This is intentionally scoped as a demo, not a production system:

- No WAF, rate limiting, or multi-environment (dev/staging/prod) promotion pipeline — single environment, deploys straight to one AWS account on every merge to `main`.
- Course listing uses a DynamoDB `Scan` (fine at demo scale; would need a GSI or search index at real scale).
- Lambda cold starts are unmitigated (no provisioned concurrency).
- Batch attendance writes are chunked at 25 items (DynamoDB `BatchWriteCommand` limit).
- Enrollment is admin-only (no self-service course registration).
- CORS is configured to allow the `Authorization` header explicitly — a common failure point when adding Cognito auth to API Gateway; if you see CORS errors in the browser after redeploying, check `ApiStack`'s `corsPreflight` config first.
