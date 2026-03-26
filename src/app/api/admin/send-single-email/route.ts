import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { to, name, password } = await req.json();

  if (!to || !name || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    await resend.emails.send({
      from: "StaffVA <notifications@staffva.com>",
      to,
      subject: "Your StaffVA recruiter access is ready",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1C1B1A;">StaffVA</h2>
          <p style="color: #1C1B1A; font-size: 16px;">Hi ${name},</p>
          <p style="color: #444; font-size: 14px; line-height: 1.6;">
            Your StaffVA recruiter account has been created.
          </p>
          <div style="background: #f9f9f9; border: 1px solid #e0e0e0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666;"><strong>Login URL:</strong> <a href="https://staffva.com/login" style="color: #FE6E3E;">staffva.com/login</a></p>
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #666;"><strong>Email:</strong> ${to}</p>
            <p style="margin: 0; font-size: 13px; color: #666;"><strong>Temporary password:</strong> <code style="background: #fff; padding: 2px 6px; border-radius: 3px; border: 1px solid #e0e0e0;">${password}</code></p>
          </div>
          <p style="color: #444; font-size: 14px; line-height: 1.6;">
            Log in and change your password immediately from the Account menu.
          </p>
          <p style="color: #444; font-size: 14px; line-height: 1.6;">
            Your dashboard shows candidates assigned to your role categories.
            You can view full profiles, test scores, and recordings.
            Reach out to Ahmed if you have any questions.
          </p>
        </div>
      `,
    });

    return NextResponse.json({ status: "sent", to });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
