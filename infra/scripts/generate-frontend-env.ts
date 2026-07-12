// Reads infra/outputs.json (produced by `cdk deploy --outputs-file outputs.json`)
// and writes frontend/.env so the Vite build never hardcodes deployed resource IDs.
import * as fs from "fs";
import * as path from "path";

const OUTPUTS_PATH = path.join(__dirname, "..", "outputs.json");
const FRONTEND_ENV_PATH = path.join(__dirname, "..", "..", "frontend", ".env");

type CdkOutputs = Record<string, Record<string, string>>;

function findOutput(outputs: CdkOutputs, stackSuffix: string, key: string): string {
  const stackName = Object.keys(outputs).find((name) => name.endsWith(stackSuffix));
  if (!stackName) {
    throw new Error(`Could not find a stack ending in "${stackSuffix}" in ${OUTPUTS_PATH}`);
  }
  const value = outputs[stackName][key];
  if (!value) {
    throw new Error(`Stack "${stackName}" has no output "${key}". Available: ${Object.keys(outputs[stackName]).join(", ")}`);
  }
  return value;
}

function main() {
  if (!fs.existsSync(OUTPUTS_PATH)) {
    console.error(
      `outputs.json not found at ${OUTPUTS_PATH}.\n` +
        "Run: cdk deploy CampusPortalAuthStack CampusPortalDataStack CampusPortalApiStack --outputs-file outputs.json"
    );
    process.exit(1);
  }

  const outputs: CdkOutputs = JSON.parse(fs.readFileSync(OUTPUTS_PATH, "utf-8"));

  const apiUrl = findOutput(outputs, "ApiStack", "ApiUrl");
  const userPoolId = findOutput(outputs, "AuthStack", "UserPoolId");
  const userPoolClientId = findOutput(outputs, "AuthStack", "UserPoolClientId");
  const region = process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || "us-east-1";

  const envContents = [
    `VITE_API_URL=${apiUrl}`,
    `VITE_USER_POOL_ID=${userPoolId}`,
    `VITE_USER_POOL_CLIENT_ID=${userPoolClientId}`,
    `VITE_AWS_REGION=${region}`,
    "",
  ].join("\n");

  fs.writeFileSync(FRONTEND_ENV_PATH, envContents);
  console.log(`Wrote ${FRONTEND_ENV_PATH}`);
}

main();
