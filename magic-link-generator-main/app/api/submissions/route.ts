import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { submissionSchema } from "@/app/schemas/submission.schema";
import { generateToken, hashToken } from "@/lib/token";
import { sendMagicLinkEmail } from "@/lib/magicLink.service";

export async function POST(req: Request) {
  try {
    // Parse FormData as the client sends "multipart/form-data"
    const formData = await req.formData();

    const body = {
      name: formData.get("name"),
      companyName: formData.get("companyName"),
      email: formData.get("email"),
      linkedinUrl: formData.get("linkedinUrl"),
      documentName: (formData.get("document") as File)?.name,
    };

    const data = submissionSchema.parse(body);

    const rawToken = generateToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    const submission = await prisma.$transaction(
      async (tx) => {
        const submission = await tx.submission.upsert({
          where: { email: data.email },
          update: {
            ...data,
            status: "PENDING",
          },
          create: {
            ...data,
            status: "PENDING",
          },
        });

        // Invalidate previous unused tokens
        await tx.magicLinkToken.updateMany({
          where: {
            submissionId: submission.id,
            usedAt: null,
            expiresAt: { gt: new Date() },
          },
          data: {
            expiresAt: new Date(),
          },
        });

        await tx.magicLinkToken.create({
          data: {
            submissionId: submission.id,
            tokenHash,
            expiresAt,
          },
        });

        return submission;
      },
      {
        maxWait: 5000,
        timeout: 10000,
      }
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const magicLink = `${baseUrl}/confirm?token=${rawToken}`;

    console.log("magicLink URL:", magicLink);

   sendMagicLinkEmail({
      to: submission.email,
      name: submission.name,
      magicLink,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
