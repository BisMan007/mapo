import { resend } from "@/lib/email";
import MagicLinkEmail from "@/emails/MagicLinkEmail";

type SendMagicLinkEmailArgs = {
  to: string;
  name: string;
  magicLink: string;
};

export function sendMagicLinkEmail({
  to,
  name,
  magicLink,
}: SendMagicLinkEmailArgs) {
  resend.emails
    .send({
      from: process.env.EMAIL_FROM!,
      to,
      subject: "Confirm your submission",
      react: MagicLinkEmail({ name, magicLink }),
    })
    .then((res) => {
      console.log("Email sent Success:", res);
    })
    .catch((err) => {
      console.error("Email failed:", err);
    });
}
