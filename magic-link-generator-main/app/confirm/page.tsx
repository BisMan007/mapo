import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/token";
import {Center, Card, Title, Text, Stack, Button, ThemeIcon} from "@mantine/core";
import { IconCircleCheck, IconAlertTriangle } from "@tabler/icons-react";
import Link from "next/link";

interface PageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function ConfirmPage({ searchParams }: PageProps) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <Center h="100vh" px="md">
        <Card shadow="md" radius="md" p="xl" maw={420} w="100%">
          <Stack align="center">
            <ThemeIcon color="red" size={56} radius="xl">
              <IconAlertTriangle size={32} />
            </ThemeIcon>

            <Title order={3}>Invalid link</Title>
            <Text c="dimmed" ta="center">
              The confirmation link is missing or invalid.
            </Text>

            <Link href="/submission">
              <Button mt="md">Go back</Button>
            </Link>
          </Stack>
        </Card>
      </Center>
    );
  }

  const tokenHash = hashToken(token);

  const magicLinkToken = await prisma.magicLinkToken.findUnique({
    where: { tokenHash },
    include: { submission: true },
  });

  if (
    !magicLinkToken ||
    magicLinkToken.usedAt ||
    magicLinkToken.expiresAt < new Date()
  ) {
    return (
      <Center h="100vh" px="md">
        <Card shadow="md" radius="md" p="xl" maw={420} w="100%">
          <Stack align="center">
            <ThemeIcon color="orange" size={56} radius="xl">
              <IconAlertTriangle size={32} />
            </ThemeIcon>

            <Title order={3}>Link expired</Title>
            <Text c="dimmed" ta="center">
              This magic link has already been used or expired.
            </Text>

            <Link href="/submission">
              <Button mt="md">Submit again</Button>
            </Link>
          </Stack>
        </Card>
      </Center>
    );
  }

  await prisma.$transaction([
    prisma.magicLinkToken.update({
      where: { id: magicLinkToken.id },
      data: { usedAt: new Date() },
    }),
    prisma.submission.update({
      where: { id: magicLinkToken.submission.id },
      data: { status: "CONFIRMED" },
    }),
  ]);

  return (
    <Center h="100vh" px="md">
      <Card shadow="md" radius="md" p="xl" maw={480} w="100%">
        <Stack align="center">
          <ThemeIcon color="green" size={64} radius="xl">
            <IconCircleCheck size={36} />
          </ThemeIcon>

          <Title order={2}>Submission confirmed</Title>

          <Text ta="center">
            Thank you,{" "}
            <strong>{magicLinkToken.submission.name}</strong>. Your email has
            been verified successfully.
          </Text>
          <Text ta="center"> 
            Company:{" "}
            <strong>{magicLinkToken.submission.companyName}</strong>
          </Text>
          <Text ta="center">
            LinkedIn:{" "}
            <strong>{magicLinkToken.submission.linkedinUrl}</strong>
          </Text>
          {magicLinkToken.submission.documentName && (
            <Text size="sm" c="dimmed">
              Document:{" "}
              <strong>{magicLinkToken.submission.documentName}</strong>
            </Text>
          )}

          <Link href="/submission">
            <Button mt="lg" variant="light">
              Submit another response
            </Button>
          </Link>
        </Stack>
      </Card>
    </Center>
  );
}
