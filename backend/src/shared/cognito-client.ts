import { CognitoIdentityProviderClient } from "@aws-sdk/client-cognito-identity-provider";

export const cognito = new CognitoIdentityProviderClient({});
export const UserPoolId = process.env.USER_POOL_ID ?? "";
