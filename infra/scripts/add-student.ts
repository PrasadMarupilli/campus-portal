// Onboard a single new student: creates the Cognito account and the
// DynamoDB student record together, with custom:studentId wired to match
// from the start (avoids the "onboard via UI, then patch Cognito" gap).
//
// Usage (from infra/):
//   npx tsx scripts/add-student.ts --email=jane@campus.edu --firstName=Jane --lastName=Doe \
//     --program="Computer Science" --year=1 [--password=SomePass1]
//
// Requires infra/outputs.json (from `cdk deploy ...AuthStack... --outputs-file outputs.json`)
// and local AWS credentials with Cognito/DynamoDB access.
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
const STUDENTS_TABLE = "CampusPortal-Students";
const DEFAULT_PASSWORD = "CampusDemo1";

const cognito = new CognitoIdentityProviderClient({});
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

function parseArgs(argv: string[]): Record<string, string> {
  const args: Record<string, string> = {};
  for (const arg of argv) {
    const match = arg.match(/^--([^=]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
  }
  return args;
}

function findOutput(outputs: Record<string, Record<string, string>>, stackSuffix: string, key: string): string {
  const stackName = Object.keys(outputs).find((name) => name.endsWith(stackSuffix));
  if (!stackName) throw new Error(`No stack ending in "${stackSuffix}" found in outputs.json`);
  return outputs[stackName][key];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { email, firstName, lastName } = args;
  if (!email || !firstName || !lastName) {
    console.error("Usage: tsx scripts/add-student.ts --email=... --firstName=... --lastName=... [--program=...] [--year=...] [--password=...]");
    process.exit(1);
  }
  const program = args.program ?? "";
  const year = args.year ? Number(args.year) : 1;
  const password = args.password ?? DEFAULT_PASSWORD;

  if (!fs.existsSync(OUTPUTS_PATH)) {
    console.error(`outputs.json not found at ${OUTPUTS_PATH}. Deploy AuthStack with --outputs-file first.`);
    process.exit(1);
  }
  const outputs = JSON.parse(fs.readFileSync(OUTPUTS_PATH, "utf-8"));
  const userPoolId = findOutput(outputs, "AuthStack", "UserPoolId");

  const studentId = randomUUID();

  console.log(`Creating Cognito user ${email}...`);
  await cognito.send(
    new AdminCreateUserCommand({
      UserPoolId: userPoolId,
      Username: email,
      UserAttributes: [
        { Name: "email", Value: email },
        { Name: "email_verified", Value: "true" },
        { Name: "given_name", Value: firstName },
        { Name: "family_name", Value: lastName },
        { Name: "custom:studentId", Value: studentId },
      ],
      MessageAction: "SUPPRESS",
    })
  );
  await cognito.send(
    new AdminSetUserPasswordCommand({ UserPoolId: userPoolId, Username: email, Password: password, Permanent: true })
  );
  await cognito.send(new AdminAddUserToGroupCommand({ UserPoolId: userPoolId, Username: email, GroupName: "Students" }));

  const user = await cognito.send(new AdminGetUserCommand({ UserPoolId: userPoolId, Username: email }));
  const cognitoSub = user.UserAttributes?.find((a) => a.Name === "sub")?.Value;
  if (!cognitoSub) throw new Error("Could not resolve Cognito sub for the new user");

  console.log("Writing student record...");
  await ddb.send(
    new PutCommand({
      TableName: STUDENTS_TABLE,
      Item: {
        studentId,
        cognitoSub,
        email,
        firstName,
        lastName,
        program,
        year,
        status: "active",
        createdAt: new Date().toISOString(),
      },
    })
  );

  console.log("\nDone.");
  console.log(`  Student ID: ${studentId}`);
  console.log(`  Login:      ${email} / ${password}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
