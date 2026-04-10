import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Interview purchasing has been discontinued." },
    { status: 410 }
  );
}
