import { SignJWT } from "jose";

export async function generateInterviewToken(candidateId: string): Promise<string> {
  const secret = new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET!);
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(candidateId)
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(secret);
}
