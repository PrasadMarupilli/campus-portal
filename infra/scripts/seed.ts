// One-off demo data seeder. Requires AWS credentials configured locally
// (this is NOT run by the CI/CD pipeline) and infra/outputs.json present
// (run: cdk deploy CampusPortalAuthStack CampusPortalDataStack CampusPortalApiStack --outputs-file outputs.json).
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import {
  AdminAddUserToGroupCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminSetUserPasswordCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";

const OUTPUTS_PATH = path.join(__dirname, "..", "outputs.json");
const DEMO_PASSWORD = "CampusDemo1";

function generateCourseId(department: string): string {
  const num = Math.floor(100 + Math.random() * 900);
  const deptCode = department.replace(/[^A-Za-z]/g, "").toUpperCase().padEnd(2, "X").slice(0, 2);
  const yy = String(new Date().getFullYear()).slice(-2);
  return `${num}${deptCode}${yy}`;
}

function generateEnrollmentId(): string {
  const letter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const yy = String(new Date().getFullYear()).slice(-2);
  const rand = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join("");
  return `${letter}${yy}${rand}`;
}

const TABLES = {
  students: "CampusPortal-Students",
  courses: "CampusPortal-Courses",
  enrollments: "CampusPortal-Enrollments",
  announcements: "CampusPortal-Announcements",
};

const cognito = new CognitoIdentityProviderClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function findOutput(outputs: Record<string, Record<string, string>>, stackSuffix: string, key: string): string {
  const stackName = Object.keys(outputs).find((name) => name.endsWith(stackSuffix));
  if (!stackName) throw new Error(`No stack ending in "${stackSuffix}" found in outputs.json`);
  return outputs[stackName][key];
}

async function createUser(userPoolId: string, email: string, given: string, family: string, studentId?: string) {
  const attributes = [
    { Name: "email", Value: email },
    { Name: "email_verified", Value: "true" },
    { Name: "given_name", Value: given },
    { Name: "family_name", Value: family },
  ];
  if (studentId) attributes.push({ Name: "custom:studentId", Value: studentId });

  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: attributes,
      MessageAction: "SUPPRESS",
    })
  );
  await cognito.send(
    new AdminSetUserPasswordCommand({
      UserPoolId: userPoolId,
      Username: email,
      Password: DEMO_PASSWORD,
      Permanent: true,
    })
  );
  const user = await cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }));
  const sub = user.UserAttributes?.find((a) => a.Name === "sub")?.Value;
  if (!sub) throw new Error(`Could not resolve sub for ${email}`);
  return sub;
}

async function main() {
  if (!fs.existsSync(OUTPUTS_PATH)) {
    console.error(`outputs.json not found at ${OUTPUTS_PATH}. Deploy AuthStack/DataStack/ApiStack with --outputs-file first.`);
    process.exit(1);
  }
  const outputs = JSON.parse(fs.readFileSync(OUTPUTS_PATH, "utf-8"));
  const userPoolId = findOutput(outputs, "AuthStack", "UserPoolId");

  console.log("Creating admin user...");
  await createUser(userPoolId, "admin@campus.edu", "Ada", "Admin");
  await cognito.send(
    new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: "admin@campus.edu", GroupName: "Admins" })
  );

  console.log("Creating student users...");
  const students = [
    { email: "alice@campus.edu", first: "Alice", last: "Nguyen", program: "Computer Science", year: 2 },
    { email: "bob@campus.edu", first: "Bob", last: "Martinez", program: "Mechanical Engineering", year: 3 },
  ];

  const studentRecords: { studentId: string; email: string; first: string; last: string }[] = [];
  for (const s of students) {
    const studentId = randomUUID();
    const sub = await createUser(userPoolId, s.email, s.first, s.last, studentId);
    await cognito.send(
      new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: s.email, GroupName: "Students" })
    );
    await ddb.send(
      new PutCommand({
        TableName: TABLES.students,
        Item: {
          studentId,
          cognitoSub: sub,
          email: s.email,
          firstName: s.first,
          lastName: s.last,
          program: s.program,
          year: s.year,
          status: "active",
          createdAt: new Date().toISOString(),
        },
      })
    );
    studentRecords.push({ studentId, email: s.email, first: s.first, last: s.last });
  }

  console.log("Creating sample courses...");
  const courses = [
    { courseId: generateCourseId("Computer Science"), courseCode: "CS101", title: "Intro to Programming", department: "Computer Science", credits: 3, instructor: "Dr. Turing", semester: "Fall 2026" },
    { courseId: generateCourseId("Mechanical Engineering"), courseCode: "ME201", title: "Statics and Dynamics", department: "Mechanical Engineering", credits: 4, instructor: "Dr. Newton", semester: "Fall 2026" },
  ];
  for (const c of courses) {
    await ddb.send(new PutCommand({ TableName: TABLES.courses, Item: c }));
  }

  console.log("Creating sample enrollments...");
  await ddb.send(
    new PutCommand({
      TableName: TABLES.enrollments,
      Item: { enrollmentId: generateEnrollmentId(), studentId: studentRecords[0].studentId, courseId: courses[0].courseId, enrolledAt: new Date().toISOString(), status: "enrolled" },
    })
  );
  await ddb.send(
    new PutCommand({
      TableName: TABLES.enrollments,
      Item: { enrollmentId: generateEnrollmentId(), studentId: studentRecords[1].studentId, courseId: courses[1].courseId, enrolledAt: new Date().toISOString(), status: "enrolled" },
    })
  );

  console.log("Creating a sample announcement...");
  await ddb.send(
    new PutCommand({
      TableName: TABLES.announcements,
      Item: {
        announcementId: randomUUID(),
        title: "Welcome to the new semester",
        body: "Classes begin Monday. Check your enrollment and course schedule in the portal.",
        audience: "ALL",
        createdBy: "seed-script",
        createdAt: new Date().toISOString(),
        pinned: true,
      },
    })
  );

  console.log("\nSeed complete. Demo credentials (password for all accounts):", DEMO_PASSWORD);
  console.log("  Admin:   admin@campus.edu");
  for (const s of studentRecords) console.log(`  Student: ${s.email} (studentId: ${s.studentId})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
