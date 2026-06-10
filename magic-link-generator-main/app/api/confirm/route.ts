import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token";

export async function POST(req: Request) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "Token required" }, { status: 400 });
    }

    const tokenHash = hashToken(token);

    const result = await prisma.$transaction(async (tx) => {
      const magicToken = await tx.magicLinkToken.findUnique({
        where: { tokenHash },
        include: { submission: true },
      });

      if (!magicToken) {
        return { status: "INVALID" };
      }

      if (magicToken.usedAt) {
        return {
          status: "ALREADY_CONFIRMED",
          submission: magicToken.submission,
        };
      }

      if (magicToken.expiresAt < new Date()) {
        return { status: "EXPIRED" };
      }

      await tx.magicLinkToken.update({
        where: { id: magicToken.id },
        data: { usedAt: new Date() },
      });

      const submission = await tx.submission.update({
        where: { id: magicToken.submissionId },
        data: {
          status: "CONFIRMED",
        },
      });

      return { status: "CONFIRMED", submission };
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
