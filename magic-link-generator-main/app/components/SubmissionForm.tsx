"use client";

import { useState } from "react";
import {
  TextInput,
  Button,
  Stack,
  FileInput,
  Title,
  Card,
  Center,
  Text,
  Divider,
} from "@mantine/core";

import { useForm } from "@mantine/form";
import { zod4Resolver } from "mantine-form-zod-resolver";
import {
  submissionSchema,
  SubmissionFormValues,
} from "../schemas/submission.schema";
import { notifications } from "@mantine/notifications";
import {IconUser, IconBuilding, IconMail, IconBrandLinkedin, IconUpload,} from "@tabler/icons-react";


export default function SubmissionForm() {
  const [loading, setLoading] = useState(false);

  const form = useForm<SubmissionFormValues>({
    validate: zod4Resolver(submissionSchema),
    initialValues: {
      name: "",
      companyName: "",
      email: "",
      linkedinUrl: "",
      document: null as unknown as File,
    },
  });

  const handleSubmit = async (values: SubmissionFormValues) => {
  try {
    setLoading(true);

    const formData = new FormData();
    formData.append("name", values.name);
    formData.append("companyName", values.companyName);
    formData.append("email", values.email);
    formData.append("linkedinUrl", values.linkedinUrl);

    if (values.document) {
      formData.append("document", values.document);
    }

    const res = await fetch("/api/submissions", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      notifications.show({
        title: "Submission failed",
        message: "Please try again.",
        color: "red",
      });
      return;
    }

    notifications.show({
      title: "Submission successful",
      message: "Check your email to confirm the submission.",
      color: "green",
    });

    form.reset();
  } catch (error) {
    notifications.show({
      title: "Error",
      message: "Unexpected error occurred.",
      color: "red",
    });
  } finally {
    setLoading(false);
  }
};


  return (
  <Center h="100vh" px="md">
    <Card
      shadow="md"
      radius="lg"
      p="xl"
      maw={460}
      w="100%"
      withBorder
    >
      <form onSubmit={form.onSubmit(handleSubmit)}>
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={2} ta="center">
              Submit your details
            </Title>
            <Text size="sm" c="dimmed" ta="center">
              We’ll send you a confirmation link via email
            </Text>
          </Stack>

          <Divider />

          <TextInput
            label="Name"
            placeholder="Your full name"
            leftSection={<IconUser size={16} />}
            disabled={loading}
            {...form.getInputProps("name")}
          />

          <TextInput
            label="Company Name"
            placeholder="Company name"
            leftSection={<IconBuilding size={16} />}
            disabled={loading}
            {...form.getInputProps("companyName")}
          />

          <TextInput
            label="Email"
            placeholder="you@example.com"
            leftSection={<IconMail size={16} />}
            disabled={loading}
            {...form.getInputProps("email")}
          />

          <TextInput
            label="LinkedIn URL"
            placeholder="https://linkedin.com/in/username"
            leftSection={<IconBrandLinkedin size={16} />}
            disabled={loading}
            {...form.getInputProps("linkedinUrl")}
          />

          <FileInput
            label="Upload document (PDF)"
            placeholder="Select PDF file"
            leftSection={<IconUpload size={16} />}
            accept="application/pdf"
            disabled={loading}
            {...form.getInputProps("document")}
          />

          <Button
            type="submit"
            loading={loading}
            disabled={loading || !form.isValid()}
            fullWidth
            size="md"
            radius="md"
          >
            {loading ? "Submitting..." : "Submit"}
          </Button>
        </Stack>
      </form>
    </Card>
  </Center>
);

}
