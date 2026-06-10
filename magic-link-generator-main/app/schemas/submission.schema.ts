import { z } from "zod";

export const submissionSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),

  companyName: z.string().min(2, "Company name must be at least 2 characters"),

  email: z.email("Invalid email address"),

  linkedinUrl: z
    .url("Invalid URL")
    .refine(
      (url) =>
        url.startsWith("https://www.linkedin.com/") ||
        url.startsWith("https://linkedin.com/"),
      "Must be a LinkedIn profile URL"
    ),
  documentName: z.string().optional(),
});

export type SubmissionFormValues = z.infer<typeof submissionSchema> & {
  document: File | null;
};
